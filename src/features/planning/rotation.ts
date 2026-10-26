import { addDays, parseISODate, startOfWeek, toISODate } from "@/lib/date";
import type { MealCycle, MealCycleEntry } from "@/features/cycles/types";
import { fetchPlannedMeals, deleteLinkedMealsFrom } from "./api";
import {
  applyForward,
  dayOffsetForDate,
  deletePattern,
  ensurePatternApplied,
  fetchSinglePattern,
  upsertPattern,
} from "./repeat";
import { snapshotWeek } from "./savedWeeks";
import { SPECIAL_MEAL_LABELS, type PlannedMeal, type SavedWeekEntry } from "./types";

// Vue « Cycle » : le motif de répétition de N semaines (voir repeat.ts)
// vu comme la suite de ses semaines, qui s'enchaînent puis recommencent.
// On y ajoute, retire, réordonne ou modifie des semaines.
//
// Toute modification s'applique à partir de la semaine prochaine (jamais
// à la semaine en cours, déjà entamée) : le motif est réenregistré avec
// cette semaine comme point de départ et ses semaines dans l'ordre, puis
// les repas qu'il avait posés sont recalculés. Les repas modifiés à la
// main restent.

/** Nombre de couleurs de la palette des semaines du cycle (voir globals.css). */
export const ROTATION_PALETTE_SIZE = 6;
/** Semaines du planning proposées comme modèle : celle-ci et les précédentes. */
export const RECENT_WEEKS = 9;

export interface RotationWeek {
  /** Indice de palette, stable quand la semaine change de place. */
  color: number;
  /** Repas de la semaine ; `dayOffset` 0 (lundi) … 6. */
  entries: MealCycleEntry[];
}

export interface Rotation {
  patternId: string;
  /** Lundi de la première semaine concernée par une modification (semaine prochaine). */
  firstWeekISO: string;
  /** Semaines dans l'ordre où elles reviennent à partir de `firstWeekISO`. */
  weeks: RotationWeek[];
  /**
   * Semaine du cycle en cours cette semaine-ci : toujours la dernière de
   * `weeks` (celle d'avant `firstWeekISO`), ou `null` si le cycle ne
   * couvre pas la semaine en cours (il démarre plus tard).
   */
  currentIndex: number | null;
}

/** Semaine récente du planning, proposée comme modèle pour le cycle. */
export interface RecentWeek {
  weekStartISO: string;
  isCurrent: boolean;
  /** Noms des plats / repas spéciaux, sans doublon, dans l'ordre de la semaine. */
  labels: string[];
  dishCount: number;
}

export interface CycleOverview {
  rotation: Rotation | null;
  /** Cette semaine et les précédentes qui ont des plats, de la plus récente à la plus ancienne. */
  recentWeeks: RecentWeek[];
}

function todayWeekISO(): string {
  return toISODate(startOfWeek(new Date()));
}

function weekAfter(iso: string, weeks = 1): string {
  return toISODate(addDays(parseISODate(iso), 7 * weeks));
}

function weekEnd(iso: string): string {
  return toISODate(addDays(parseISODate(iso), 6));
}

/** Semaine à partir de laquelle une modification du cycle s'applique. */
function firstChangeWeek(pattern: MealCycle | null): string {
  const next = weekAfter(todayWeekISO());
  if (!pattern) return next;
  const start = toISODate(startOfWeek(parseISODate(pattern.startDate)));
  return start > next ? start : next;
}

/** Découpe le motif en semaines, dans l'ordre où elles reviennent à partir de `fromISO`. */
function rotationFromPattern(pattern: MealCycle, fromISO: string): Omit<Rotation, "currentIndex"> {
  const count = Math.max(1, Math.round(pattern.durationDays / 7));
  const blocks: RotationWeek[] = Array.from({ length: count }, (_, i) => ({
    color: pattern.weekColors?.[i] ?? i % ROTATION_PALETTE_SIZE,
    entries: [],
  }));
  for (const entry of pattern.entries) {
    const block = blocks[Math.floor(entry.dayOffset / 7)];
    block?.entries.push({ ...entry, dayOffset: entry.dayOffset % 7 });
  }
  const first = Math.floor(dayOffsetForDate(fromISO, pattern.startDate, count * 7) / 7);
  return {
    patternId: pattern.id,
    firstWeekISO: fromISO,
    weeks: blocks.map((_, i) => blocks[(first + i) % count]),
  };
}

/**
 * La semaine en cours a-t-elle (au moins pour moitié) les plats de la
 * semaine `week` du cycle ? Sert quand le motif a été réenregistré pour
 * démarrer la semaine prochaine : la semaine en cours en fait encore
 * partie si elle ressemble à la dernière semaine du cycle.
 */
function weekMatches(week: RotationWeek, weekStartISO: string, meals: PlannedMeal[]): boolean {
  const start = parseISODate(weekStartISO).getTime();
  const keys = new Set(
    meals
      .filter((m) => m.dishId)
      .map((m) => {
        const d = Math.round((parseISODate(m.date).getTime() - start) / (24 * 60 * 60 * 1000));
        return `${d}|${m.mealSlot}|${m.dishId}`;
      })
  );
  if (keys.size === 0 || week.entries.length === 0) return false;
  const common = week.entries.filter((e) => keys.has(`${e.dayOffset}|${e.mealSlot}|${e.dishId}`))
    .length;
  return common / Math.max(week.entries.length, keys.size) >= 0.5;
}

function labelsOf(meals: PlannedMeal[]): string[] {
  return [
    ...new Set(
      [...meals]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((m) => (m.special ? SPECIAL_MEAL_LABELS[m.special] : m.dishName))
        .filter((label): label is string => Boolean(label))
    ),
  ];
}

export async function fetchCycleOverview(): Promise<CycleOverview> {
  const current = todayWeekISO();
  const from = weekAfter(current, -(RECENT_WEEKS - 1));

  // Comme le Planning : la semaine en cours est remplie par le cycle
  // avant d'être lue (jamais les semaines passées).
  await ensurePatternApplied(current, weekEnd(current));
  const [pattern, meals] = await Promise.all([
    fetchSinglePattern(),
    fetchPlannedMeals(from, weekEnd(current)),
  ]);

  const recentWeeks: RecentWeek[] = [];
  for (let i = 0; i < RECENT_WEEKS; i++) {
    const weekStartISO = weekAfter(current, -i);
    const weekMeals = meals.filter(
      (m) => m.date >= weekStartISO && m.date <= weekEnd(weekStartISO)
    );
    const dishCount = weekMeals.filter((m) => m.dishId).length;
    if (dishCount === 0) continue;
    recentWeeks.push({
      weekStartISO,
      isCurrent: i === 0,
      labels: labelsOf(weekMeals),
      dishCount,
    });
  }

  if (!pattern) return { rotation: null, recentWeeks };

  const base = rotationFromPattern(pattern, firstChangeWeek(pattern));
  const last = base.weeks.length - 1;
  const startsBeforeNow = toISODate(startOfWeek(parseISODate(pattern.startDate))) <= current;
  const currentMeals = meals.filter((m) => m.date >= current);
  const coversCurrent =
    base.firstWeekISO === weekAfter(current) &&
    (startsBeforeNow || weekMatches(base.weeks[last], current, currentMeals));

  return {
    rotation: { ...base, currentIndex: coversCurrent ? last : null },
    recentWeeks,
  };
}

/** Lundi de la prochaine fois où revient la semaine `index` du cycle (cette semaine si en cours). */
export function occurrenceISO(rotation: Rotation, index: number): string {
  if (index === rotation.currentIndex) return todayWeekISO();
  return weekAfter(rotation.firstWeekISO, index);
}

/** Lundi de la fois suivante, après l'occurrence en cours ou à venir. */
export function nextTimeISO(rotation: Rotation, index: number): string {
  return weekAfter(rotation.firstWeekISO, index);
}

/** Plats d'une semaine (planning ou enregistrée), au format d'une semaine du cycle. */
export function rotationEntriesFrom(entries: SavedWeekEntry[]): MealCycleEntry[] {
  return entries
    .filter((e): e is SavedWeekEntry & { dishId: string } => Boolean(e.dishId) && !e.special)
    .map((e) => ({ dayOffset: e.dayOffset, mealSlot: e.mealSlot, dishId: e.dishId }));
}

/** Plats d'une semaine du planning (lundi `weekStartISO`). */
export async function planningWeekEntries(weekStartISO: string): Promise<MealCycleEntry[]> {
  return rotationEntriesFrom(await snapshotWeek(weekStartISO));
}

/**
 * Enregistre le cycle `weeks` (dans l'ordre où elles reviennent à partir
 * de `firstWeekISO`) puis recalcule les repas qu'il pose à partir de
 * cette semaine. Une liste vide arrête le cycle.
 */
async function saveRotation(
  patternId: string | null,
  firstWeekISO: string,
  weeks: RotationWeek[]
): Promise<void> {
  if (weeks.length === 0) {
    if (patternId) {
      await deleteLinkedMealsFrom(patternId, firstWeekISO);
      await deletePattern();
    }
    return;
  }

  const pattern = await upsertPattern({
    id: patternId ?? undefined,
    startDate: firstWeekISO,
    durationDays: weeks.length * 7,
    weekColors: weeks.map((w) => w.color),
    entries: weeks.flatMap((week, i) =>
      week.entries.map((e) => ({ ...e, dayOffset: i * 7 + e.dayOffset }))
    ),
  });
  if (!pattern) throw new Error("Impossible d'enregistrer le cycle");

  await deleteLinkedMealsFrom(pattern.id, firstWeekISO);
  await applyForward(pattern.id, firstWeekISO);
}

/** Déplace la semaine `from` du cycle à la place `to`. */
export async function moveRotationWeek(rotation: Rotation, from: number, to: number): Promise<void> {
  if (from === to) return;
  const weeks = [...rotation.weeks];
  const [moved] = weeks.splice(from, 1);
  weeks.splice(to, 0, moved);
  await saveRotation(rotation.patternId, rotation.firstWeekISO, weeks);
}

export async function removeRotationWeek(rotation: Rotation, index: number): Promise<void> {
  await saveRotation(
    rotation.patternId,
    rotation.firstWeekISO,
    rotation.weeks.filter((_, i) => i !== index)
  );
}

/** Remplace les plats de la semaine `index` du cycle (sa couleur et sa place ne changent pas). */
export async function replaceRotationWeek(
  rotation: Rotation,
  index: number,
  entries: MealCycleEntry[]
): Promise<void> {
  if (entries.length === 0) throw new Error("Choisis au moins un plat pour cette semaine.");
  const weeks = rotation.weeks.map((week, i) => (i === index ? { ...week, entries } : week));
  await saveRotation(rotation.patternId, rotation.firstWeekISO, weeks);
}

/**
 * Ajoute une semaine au cycle : juste avant la semaine en cours (donc la
 * dernière avant que le cycle ne recommence), sinon à la fin. Sans cycle,
 * en crée un qui démarre la semaine prochaine.
 */
export async function addRotationWeek(
  rotation: Rotation | null,
  entries: MealCycleEntry[]
): Promise<void> {
  if (entries.length === 0) {
    throw new Error("Cette semaine n'a aucun plat : rien à répéter.");
  }
  const weeks = [...(rotation?.weeks ?? [])];
  const used = new Set(weeks.map((w) => w.color));
  const color =
    Array.from({ length: ROTATION_PALETTE_SIZE }, (_, i) => i).find((c) => !used.has(c)) ??
    weeks.length % ROTATION_PALETTE_SIZE;
  const position = rotation?.currentIndex ?? weeks.length;
  weeks.splice(position, 0, { color, entries });
  await saveRotation(
    rotation?.patternId ?? null,
    rotation?.firstWeekISO ?? firstChangeWeek(null),
    weeks
  );
}
