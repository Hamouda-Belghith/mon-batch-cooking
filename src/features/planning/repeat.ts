import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUserId, getSupabase } from "@/lib/supabase/client";
import {
  applyDemoCycleToRange,
  clearDemoRepeatPattern,
  fetchDemoRepeatPattern,
  isDemoMode,
  upsertDemoRepeatPattern,
  updateDemoPatternEntryAndFuture,
} from "@/lib/localDemo";
import { addDays, parseISODate, toISODate } from "@/lib/date";
import type { MealSlot } from "@/lib/supabase/database.types";
import type { MealCycle, MealCycleEntry } from "@/features/cycles/types";
import { SPECIAL_MEAL_LABELS, type SpecialMeal } from "./types";
import {
  applyCycleToRange,
  clearAllPlannedMeals,
  clearPlannedMeal,
  fetchPlannedMeals,
  setPlannedMeal,
} from "./api";

/** Fréquence de répétition, en nombre de semaines (1 = chaque semaine, 3 = toutes les 3 semaines, etc). */
export type RepeatInterval = number;
export type MealEditScope = "this_week" | "all_future";

export interface RepeatConfig {
  active: boolean;
  intervalWeeks: RepeatInterval | null;
  patternId: string | null;
  startDate: string | null;
  durationDays: number | null;
}

const PATTERN_NAME = "Répétition";
const FORWARD_WEEKS = 8;

type MutateResult = { error: PostgrestError | null };

interface CycleRow {
  id: string;
  name: string;
  duration_days: number;
  start_date: string;
  week_colors?: number[] | null;
}

interface EntryRow {
  day_offset: number;
  meal_slot: MealSlot;
  dish_id: string;
}

function intervalFromDuration(durationDays: number): RepeatInterval {
  return Math.max(1, Math.round(durationDays / 7));
}

function durationFromInterval(intervalWeeks: RepeatInterval): number {
  return Math.max(1, Math.floor(intervalWeeks)) * 7;
}

export function dayOffsetForDate(
  dateISO: string,
  patternStartISO: string,
  durationDays: number
): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (parseISODate(dateISO).getTime() - parseISODate(patternStartISO).getTime()) /
      msPerDay
  );
  return ((diffDays % durationDays) + durationDays) % durationDays;
}

export async function fetchSinglePattern(): Promise<MealCycle | null> {
  if (isDemoMode()) {
    return fetchDemoRepeatPattern();
  }

  const supabase = getSupabase();
  if (!supabase) return null;

  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data: cycles, error } = (await supabase
    .from("meal_cycles")
    .select("id, name, duration_days, start_date, week_colors")
    .eq("user_id", userId)
    .limit(1)) as {
    data: CycleRow[] | null;
    error: PostgrestError | null;
  };

  if (error || !cycles?.[0]) {
    if (error) console.warn("Impossible de charger le motif de répétition", error);
    return null;
  }

  const cycle = cycles[0];
  const { data: entries, error: entriesError } = (await supabase
    .from("meal_cycle_entries")
    .select("day_offset, meal_slot, dish_id")
    .eq("meal_cycle_id", cycle.id)) as {
    data: EntryRow[] | null;
    error: PostgrestError | null;
  };

  if (entriesError || !entries) {
    console.warn("Impossible de charger les entrées du motif", entriesError);
    return null;
  }

  return {
    id: cycle.id,
    name: cycle.name,
    durationDays: cycle.duration_days,
    startDate: cycle.start_date,
    weekColors: cycle.week_colors ?? null,
    entries: entries.map((e) => ({
      dayOffset: e.day_offset,
      mealSlot: e.meal_slot,
      dishId: e.dish_id,
    })),
  };
}

export async function getRepeatConfig(): Promise<RepeatConfig> {
  const pattern = await fetchSinglePattern();
  if (!pattern) {
    return {
      active: false,
      intervalWeeks: null,
      patternId: null,
      startDate: null,
      durationDays: null,
    };
  }

  return {
    active: true,
    intervalWeeks: intervalFromDuration(pattern.durationDays),
    patternId: pattern.id,
    startDate: pattern.startDate,
    durationDays: pattern.durationDays,
  };
}

async function snapshotEntries(
  weekStartISO: string,
  intervalWeeks: RepeatInterval
): Promise<MealCycleEntry[]> {
  const durationDays = durationFromInterval(intervalWeeks);
  const periodEnd = toISODate(addDays(parseISODate(weekStartISO), durationDays - 1));
  const meals = await fetchPlannedMeals(weekStartISO, periodEnd);
  const start = parseISODate(weekStartISO);
  const msPerDay = 24 * 60 * 60 * 1000;

  // Un repas spécial (ex. « Manger dehors ») n'a pas de dishId : il ne
  // peut pas intégrer le motif de répétition (voir `setMealWithScope`),
  // on l'exclut du snapshot plutôt que de le laisser produire une entrée
  // invalide.
  return meals
    .filter((meal): meal is typeof meal & { dishId: string } => meal.dishId !== null)
    .map((meal) => ({
      dayOffset: Math.round(
        (parseISODate(meal.date).getTime() - start.getTime()) / msPerDay
      ),
      mealSlot: meal.mealSlot,
      dishId: meal.dishId,
    }));
}

export async function upsertPattern(params: {
  id?: string;
  startDate: string;
  durationDays: number;
  /** undefined = ne change pas les couleurs ; null = couleurs par défaut. */
  weekColors?: number[] | null;
  entries: MealCycleEntry[];
}): Promise<MealCycle | null> {
  if (isDemoMode()) {
    return upsertDemoRepeatPattern(params);
  }

  const supabase = getSupabase();
  if (!supabase) return null;

  const userId = await getCurrentUserId();
  if (!userId) return null;

  const existing = await fetchSinglePattern();

  // Upsert du motif unique (contrainte unique sur user_id).
  const payload: Record<string, unknown> = {
    user_id: userId,
    name: PATTERN_NAME,
    duration_days: params.durationDays,
    start_date: params.startDate,
  };
  if (params.weekColors !== undefined) payload.week_colors = params.weekColors;
  const cycleId = params.id ?? existing?.id;
  if (cycleId) {
    payload.id = cycleId;
  }

  const { data: savedRows, error: cycleError } = (await supabase
    .from("meal_cycles")
    .upsert(payload as never, { onConflict: "user_id" } as never)
    .select("id, name, duration_days, start_date, week_colors")) as {
    data: CycleRow[] | null;
    error: PostgrestError | null;
  };

  if (cycleError || !savedRows?.[0]) {
    console.warn("Impossible d'enregistrer le motif de répétition", cycleError);
    throw new Error("Impossible d'enregistrer la répétition");
  }

  const savedId = savedRows[0].id;

  const { error: delError } = (await supabase
    .from("meal_cycle_entries")
    .delete()
    .eq("meal_cycle_id", savedId)) as MutateResult;
  if (delError) {
    console.warn("Impossible de remplacer les entrées du motif", delError);
    throw new Error("Impossible d'enregistrer la répétition");
  }

  // Une seule requête pour toutes les entrées (une rotation de 3
  // semaines en compte facilement une trentaine).
  const rows = params.entries
    .filter((e) => e.dayOffset >= 0 && e.dayOffset < params.durationDays && e.dishId)
    .map((e) => ({
      meal_cycle_id: savedId,
      day_offset: e.dayOffset,
      meal_slot: e.mealSlot,
      dish_id: e.dishId,
    }));
  if (rows.length > 0) {
    const { error: insertError } = (await supabase
      .from("meal_cycle_entries")
      .insert(rows as never)) as MutateResult;
    if (insertError) {
      console.warn("Impossible d'ajouter les entrées du motif", insertError);
      throw new Error("Impossible d'enregistrer la répétition");
    }
  }

  return fetchSinglePattern();
}

export async function deletePattern(): Promise<void> {
  if (isDemoMode()) {
    await clearDemoRepeatPattern();
    return;
  }

  const supabase = getSupabase();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const { error } = (await supabase
    .from("meal_cycles")
    .delete()
    .eq("user_id", userId)) as MutateResult;

  if (error) {
    console.warn("Impossible de supprimer le motif de répétition", error);
    throw new Error("Impossible d'arrêter la répétition");
  }
}

export async function applyForward(
  patternId: string,
  fromISO: string,
  overwrite = false
): Promise<void> {
  const periodEnd = toISODate(
    addDays(parseISODate(fromISO), FORWARD_WEEKS * 7 - 1)
  );
  if (isDemoMode()) {
    await applyDemoCycleToRange(patternId, fromISO, periodEnd, overwrite);
    return;
  }
  await applyCycleToRange(patternId, fromISO, periodEnd, overwrite);
}

export interface RepeatConflict {
  date: string;
  mealSlot: MealSlot;
  /** Nom du plat, ou libellé du repas spécial (ex. « Manger dehors »). */
  dishName: string;
}

/**
 * Repère les repas déjà planifiés (dans l'horizon de remplissage
 * futur) qui ne correspondent pas à ce que la fréquence choisie y
 * placerait. Sert à prévenir l'utilisateur avant d'activer/changer la
 * fréquence, plutôt que de silencieusement ignorer ces cases.
 */
export async function findRepeatConflicts(
  weekStartISO: string,
  intervalWeeks: RepeatInterval
): Promise<RepeatConflict[]> {
  const durationDays = durationFromInterval(intervalWeeks);
  const entries = await snapshotEntries(weekStartISO, intervalWeeks);
  if (entries.length === 0) return [];

  const entriesByOffset = new Map(
    entries.map((e) => [`${e.dayOffset}-${e.mealSlot}`, e])
  );

  const scanStart = toISODate(addDays(parseISODate(weekStartISO), durationDays));
  const scanEnd = toISODate(
    addDays(parseISODate(weekStartISO), FORWARD_WEEKS * 7 - 1)
  );
  if (scanStart > scanEnd) return [];

  const existing = await fetchPlannedMeals(scanStart, scanEnd);
  const conflicts: RepeatConflict[] = [];

  for (const meal of existing) {
    const offset = dayOffsetForDate(meal.date, weekStartISO, durationDays);
    const entry = entriesByOffset.get(`${offset}-${meal.mealSlot}`);
    if (entry && entry.dishId !== meal.dishId) {
      const dishName =
        meal.dishName ?? (meal.special ? SPECIAL_MEAL_LABELS[meal.special] : "");
      conflicts.push({ date: meal.date, mealSlot: meal.mealSlot, dishName });
    }
  }

  return conflicts;
}

/**
 * Active, met à jour ou désactive la répétition à partir de la semaine visible.
 * intervalWeeks null = arrêter. Sinon snapshot la ou les semaines couvertes
 * par la fréquence et matérialise. `overwrite` remplace les repas déjà
 * planifiés qui entrent en conflit avec la fréquence (voir `findRepeatConflicts`) ;
 * sans cette option, ces cases restent inchangées.
 */
export async function setRepeatInterval(
  intervalWeeks: RepeatInterval | null,
  weekStartISO: string,
  overwrite = false
): Promise<RepeatConfig> {
  if (intervalWeeks === null) {
    await deletePattern();
    return getRepeatConfig();
  }

  const durationDays = durationFromInterval(intervalWeeks);
  const entries = await snapshotEntries(weekStartISO, intervalWeeks);
  const existing = await fetchSinglePattern();

  const pattern = await upsertPattern({
    id: existing?.id,
    startDate: weekStartISO,
    durationDays,
    weekColors: null,
    entries,
  });

  if (!pattern) {
    throw new Error("Impossible d'enregistrer la répétition");
  }

  // Marque les repas du snapshot comme issus du motif, puis remplit le futur.
  for (const entry of entries) {
    const date = toISODate(addDays(parseISODate(weekStartISO), entry.dayOffset));
    await setPlannedMeal(date, entry.mealSlot, entry.dishId, pattern.id);
  }

  await applyForward(pattern.id, weekStartISO, overwrite);
  return getRepeatConfig();
}

/** Remplit les cases vides de la période depuis le motif actif. */
export async function ensurePatternApplied(
  periodStart: string,
  periodEnd: string
): Promise<void> {
  const pattern = await fetchSinglePattern();
  if (!pattern) return;

  if (isDemoMode()) {
    await applyDemoCycleToRange(pattern.id, periodStart, periodEnd);
    return;
  }
  await applyCycleToRange(pattern.id, periodStart, periodEnd);
}

/**
 * Modifie un créneau. Si un motif est actif et qu'un scope est fourni :
 * - this_week : override local (meal_cycle_id null)
 * - all_future : met à jour le motif + les occurrences futures liées
 */
/**
 * Modifie un créneau. `special` (ex. « Manger dehors ») est mutuellement
 * exclusif avec `dishId` et ne fait jamais partie du motif de répétition
 * (pas de sens pour "toutes les semaines à venir") : le choisir applique
 * toujours un override "cette semaine seulement", quel que soit `scope`.
 */
export async function setMealWithScope(
  date: string,
  mealSlot: MealSlot,
  dishId: string | null,
  scope: MealEditScope | null,
  special: SpecialMeal | null = null
): Promise<void> {
  const pattern = await fetchSinglePattern();

  if (special) {
    await setPlannedMeal(date, mealSlot, null, null, special);
    return;
  }

  if (!pattern || !scope || scope === "this_week") {
    if (dishId === null) {
      if (pattern) {
        // Un motif est actif : une simple suppression serait aussitôt
        // recréée par `ensurePatternApplied` au prochain chargement (la
        // case redeviendrait "vide" pour le motif). On pose une case
        // "vidée" (dish_id null) à la place, qui occupe l'emplacement
        // sans représenter de repas — voir `setPlannedMeal`.
        await setPlannedMeal(date, mealSlot, null, null);
      } else {
        await clearPlannedMeal(date, mealSlot);
      }
    } else {
      await setPlannedMeal(date, mealSlot, dishId, null);
    }
    return;
  }

  // all_future
  const offset = dayOffsetForDate(date, pattern.startDate, pattern.durationDays);

  if (isDemoMode()) {
    await updateDemoPatternEntryAndFuture({
      patternId: pattern.id,
      dayOffset: offset,
      mealSlot,
      dishId,
      fromDate: date,
    });
    // Aussi la case courante
    if (dishId === null) {
      await clearPlannedMeal(date, mealSlot);
    } else {
      await setPlannedMeal(date, mealSlot, dishId, pattern.id);
    }
    return;
  }

  const supabase = getSupabase();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  // Met à jour l'entrée du motif.
  const { error: delEntryError } = (await supabase
    .from("meal_cycle_entries")
    .delete()
    .eq("meal_cycle_id", pattern.id)
    .eq("day_offset", offset)
    .eq("meal_slot", mealSlot)) as MutateResult;
  if (delEntryError) {
    console.warn("Impossible de mettre à jour l'entrée du motif", delEntryError);
    throw new Error("Mise à jour du motif impossible");
  }

  if (dishId !== null) {
    const { error: insertError } = (await supabase
      .from("meal_cycle_entries")
      .insert({
        meal_cycle_id: pattern.id,
        day_offset: offset,
        meal_slot: mealSlot,
        dish_id: dishId,
      } as never)) as MutateResult;
    if (insertError) {
      console.warn("Impossible d'ajouter l'entrée du motif", insertError);
      throw new Error("Mise à jour du motif impossible");
    }
  }

  // Propage aux occurrences futures encore liées au motif.
  const { data: futureRows, error: futureError } = (await supabase
    .from("planned_meals")
    .select("id, date, meal_slot, meal_cycle_id")
    .eq("user_id", userId)
    .eq("meal_cycle_id", pattern.id)
    .eq("meal_slot", mealSlot)
    .gte("date", date)) as {
    data:
      | { id: string; date: string; meal_slot: MealSlot; meal_cycle_id: string | null }[]
      | null;
    error: PostgrestError | null;
  };

  if (futureError) {
    console.warn("Impossible de propager le motif", futureError);
    throw new Error("Mise à jour des semaines futures impossible");
  }

  for (const row of futureRows ?? []) {
    const rowOffset = dayOffsetForDate(
      row.date,
      pattern.startDate,
      pattern.durationDays
    );
    if (rowOffset !== offset) continue;

    if (dishId === null) {
      const { error } = (await supabase
        .from("planned_meals")
        .delete()
        .eq("id", row.id)) as MutateResult;
      if (error) console.warn("Impossible de retirer un repas futur", error);
    } else {
      const { error } = (await supabase
        .from("planned_meals")
        .update({ dish_id: dishId } as never)
        .eq("id", row.id)) as MutateResult;
      if (error) console.warn("Impossible de mettre à jour un repas futur", error);
    }
  }

  // Case courante (peut ne pas encore être liée au motif).
  if (dishId === null) {
    await clearPlannedMeal(date, mealSlot);
  } else {
    await setPlannedMeal(date, mealSlot, dishId, pattern.id);
  }
}

/** Helper pour l'UI : savoir si un scope est requis. */
export async function isRepeatActive(): Promise<boolean> {
  const config = await getRepeatConfig();
  return config.active;
}

/**
 * Vide tous les repas de la semaine [weekStartISO, weekEndISO], y compris
 * ceux issus du motif de répétition actif (équivaut à faire "cette
 * semaine seulement" sur chaque case remplie). Les autres semaines du
 * motif ne sont pas touchées.
 */
export async function clearWeek(
  weekStartISO: string,
  weekEndISO: string
): Promise<void> {
  const meals = await fetchPlannedMeals(weekStartISO, weekEndISO);
  for (const meal of meals) {
    await setMealWithScope(meal.date, meal.mealSlot, null, "this_week");
  }
}

/**
 * Vide tout le planning (tous les repas, toutes les semaines, passées
 * et futures) et désactive le motif de répétition actif. Action
 * destructrice — la confirmation est à la charge de l'appelant (UI).
 */
export async function clearAllWeeks(): Promise<RepeatConfig> {
  await clearAllPlannedMeals();
  await deletePattern();
  return getRepeatConfig();
}
