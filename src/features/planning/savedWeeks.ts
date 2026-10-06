import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUserId, getSupabase } from "@/lib/supabase/client";
import {
  deleteDemoSavedWeek,
  fetchDemoSavedWeeks,
  isDemoMode,
  saveDemoSavedWeek,
} from "@/lib/localDemo";
import { addDays, parseISODate, toISODate } from "@/lib/date";
import type { MealSlot } from "@/lib/supabase/database.types";
import { fetchPlannedMeals, replaceMealsInRange, type MealRow } from "./api";
import { dayOffsetForDate, fetchSinglePattern } from "./repeat";
import type { SavedWeek, SavedWeekEntry, SpecialMeal } from "./types";

type MutateResult = { error: PostgrestError | null };

interface SavedWeekRow {
  id: string;
  name: string;
  created_at: string;
  saved_week_entries: {
    day_offset: number;
    meal_slot: MealSlot;
    dish_id: string | null;
    special: string | null;
  }[];
}

/** Semaines enregistrées, de la plus récente à la plus ancienne. */
export async function fetchSavedWeeks(): Promise<SavedWeek[]> {
  const weeks = await (async () => {
    if (isDemoMode()) return fetchDemoSavedWeeks();

    const supabase = getSupabase();
    if (!supabase) return [];

    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = (await supabase
      .from("saved_weeks")
      .select("id, name, created_at, saved_week_entries(day_offset, meal_slot, dish_id, special)")
      .eq("user_id", userId)) as { data: SavedWeekRow[] | null; error: PostgrestError | null };

    if (error || !data) {
      console.warn("Impossible de charger les semaines enregistrées", error);
      throw new Error("Impossible de charger les semaines enregistrées");
    }

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      entries: row.saved_week_entries.map((e) => ({
        dayOffset: e.day_offset,
        mealSlot: e.meal_slot,
        dishId: e.dish_id,
        special: e.special as SpecialMeal | null,
      })),
    }));
  })();

  return weeks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Repas de la semaine [weekStartISO, +6 jours] sous forme d'entrées de semaine enregistrée. */
export async function snapshotWeek(weekStartISO: string): Promise<SavedWeekEntry[]> {
  const start = parseISODate(weekStartISO);
  const meals = await fetchPlannedMeals(weekStartISO, toISODate(addDays(start, 6)));
  const msPerDay = 24 * 60 * 60 * 1000;
  return meals.map((meal) => ({
    dayOffset: Math.round((parseISODate(meal.date).getTime() - start.getTime()) / msPerDay),
    mealSlot: meal.mealSlot,
    dishId: meal.dishId,
    special: meal.special,
  }));
}

/**
 * Enregistre les repas de la semaine affichée sous `name`. Une semaine
 * enregistrée portant déjà ce nom est remplacée (la confirmation est à
 * la charge de l'UI).
 */
export async function saveWeek(name: string, weekStartISO: string): Promise<{ count: number }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Donne un nom à cette semaine.");

  const entries = await snapshotWeek(weekStartISO);
  if (entries.length === 0) {
    throw new Error("Cette semaine est vide : rien à enregistrer.");
  }

  if (isDemoMode()) {
    await saveDemoSavedWeek(trimmed, entries);
    return { count: entries.length };
  }

  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase n'est pas configuré");

  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Utilisateur non connecté");

  const { error: delError } = (await supabase
    .from("saved_weeks")
    .delete()
    .eq("user_id", userId)
    .eq("name", trimmed)) as MutateResult;
  if (delError) {
    console.warn("Impossible de remplacer la semaine enregistrée", delError);
    throw new Error("Impossible d'enregistrer la semaine");
  }

  const { data: saved, error: weekError } = (await supabase
    .from("saved_weeks")
    .insert({ user_id: userId, name: trimmed } as never)
    .select("id")) as { data: { id: string }[] | null; error: PostgrestError | null };
  if (weekError || !saved?.[0]) {
    console.warn("Impossible d'enregistrer la semaine", weekError);
    throw new Error("Impossible d'enregistrer la semaine");
  }

  const { error: entriesError } = (await supabase.from("saved_week_entries").insert(
    entries.map((e) => ({
      saved_week_id: saved[0].id,
      day_offset: e.dayOffset,
      meal_slot: e.mealSlot,
      dish_id: e.dishId,
      special: e.special,
    })) as never
  )) as MutateResult;
  if (entriesError) {
    console.warn("Impossible d'enregistrer les repas de la semaine", entriesError);
    // Pas de semaine enregistrée à moitié : on retire l'en-tête.
    await supabase.from("saved_weeks").delete().eq("id", saved[0].id);
    throw new Error("Impossible d'enregistrer la semaine");
  }

  return { count: entries.length };
}

export async function deleteSavedWeek(id: string): Promise<void> {
  if (isDemoMode()) {
    await deleteDemoSavedWeek(id);
    return;
  }

  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase n'est pas configuré");

  const { error } = (await supabase.from("saved_weeks").delete().eq("id", id)) as MutateResult;
  if (error) {
    console.warn("Impossible de supprimer la semaine enregistrée", error);
    throw new Error("Impossible de supprimer cette semaine");
  }
}

/**
 * Remplace entièrement la semaine [weekStartISO, +6 jours] par la
 * semaine enregistrée. Si une répétition est active, chaque case est un
 * override « cette semaine seulement » : le motif et les autres
 * semaines ne sont pas touchés.
 */
export async function applySavedWeek(week: SavedWeek, weekStartISO: string): Promise<void> {
  await replaceWeek(weekStartISO, week.entries);
}

/**
 * Remplace la semaine [weekStartISO, +6 jours] par `entries`, en
 * overrides « cette semaine seulement ». Si une répétition est active,
 * les cases qu'elle remplirait et que `entries` laisse vides sont
 * marquées vidées : sinon le motif les remplirait au prochain affichage.
 */
export async function replaceWeek(weekStartISO: string, entries: SavedWeekEntry[]): Promise<void> {
  const start = parseISODate(weekStartISO);
  const rows: MealRow[] = entries
    .filter((e) => e.dishId || e.special)
    .map((e) => ({
      date: toISODate(addDays(start, e.dayOffset)),
      mealSlot: e.mealSlot,
      dishId: e.special ? null : e.dishId,
      special: e.special,
    }));

  const pattern = await fetchSinglePattern();
  if (pattern) {
    const taken = new Set(rows.map((r) => `${r.date}|${r.mealSlot}`));
    const byOffset = new Set(pattern.entries.map((e) => `${e.dayOffset}|${e.mealSlot}`));
    for (let d = 0; d < 7; d++) {
      const date = toISODate(addDays(start, d));
      const offset = dayOffsetForDate(date, pattern.startDate, pattern.durationDays);
      for (const key of byOffset) {
        const [off, slot] = key.split("|");
        if (Number(off) !== offset || taken.has(`${date}|${slot}`)) continue;
        rows.push({ date, mealSlot: slot as MealSlot, dishId: null, special: null });
      }
    }
  }

  await replaceMealsInRange(weekStartISO, toISODate(addDays(start, 6)), rows);
}
