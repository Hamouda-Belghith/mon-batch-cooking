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
import { replaceWeek, snapshotWeek } from "./savedWeeks";
import { SPECIAL_MEAL_LABELS, type PlannedMeal, type SavedWeekEntry } from "./types";

// Vue « Mois » : la rotation (motif de répétition de N semaines, voir
// repeat.ts) vue comme une liste de semaines qu'on réordonne, complète
// ou raccourcit, et le calendrier des semaines autour d'aujourd'hui.
//
// Toute modification de la rotation s'applique à partir de la semaine
// prochaine (jamais à la semaine en cours, déjà entamée) : la rotation
// est réenregistrée avec cette semaine comme point de départ et ses
// semaines dans l'ordre affiché, puis les repas qu'elle avait posés
// sont recalculés. Les repas modifiés à la main restent.

/** Nombre de couleurs de la palette des semaines de rotation (voir globals.css). */
export const ROTATION_PALETTE_SIZE = 6;
/** Semaines passées affichées dans le calendrier (on peut y reprendre une semaine réussie). */
export const PAST_WEEKS = 3;
/** Semaines à venir affichées, semaine en cours comprise. */
export const UPCOMING_WEEKS = 9;

export interface RotationWeek {
  /** Indice de palette, stable quand la semaine change de place. */
  color: number;
  /** Repas de la semaine ; `dayOffset` 0 (lundi) … 6. */
  entries: MealCycleEntry[];
}

export interface Rotation {
  patternId: string;
  /** Lundi de la première semaine concernée par une modification. */
  firstWeekISO: string;
  /** Semaines dans l'ordre où elles reviennent à partir de `firstWeekISO`. */
  weeks: RotationWeek[];
}

export interface CalendarWeek {
  weekStartISO: string;
  isPast: boolean;
  isCurrent: boolean;
  meals: PlannedMeal[];
  /** Noms des plats / repas spéciaux, sans doublon, dans l'ordre de la semaine. */
  labels: string[];
  /** Indice dans `Rotation.weeks` de la semaine de rotation reconnue dans ses repas. */
  rotationIndex: number | null;
  /** Modifiée à la main par rapport à la rotation. */
  modified: boolean;
}

export interface MonthOverview {
  rotation: Rotation | null;
  calendar: CalendarWeek[];
}

function todayWeekISO(): string {
  return toISODate(startOfWeek(new Date()));
}

function weekAfter(iso: string, weeks = 1): string {
  return toISODate(addDays(parseISODate(iso), 7 * weeks));
}

/** Semaine à partir de laquelle une modification de la rotation s'applique. */
function firstChangeWeek(pattern: MealCycle | null): string {
  const next = weekAfter(todayWeekISO());
  if (!pattern) return next;
  const start = toISODate(startOfWeek(parseISODate(pattern.startDate)));
  return start > next ? start : next;
}

/** Découpe le motif en semaines, dans l'ordre où elles reviennent à partir de `fromISO`. */
export function rotationFromPattern(pattern: MealCycle, fromISO: string): Rotation {
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

/** Indice (dans `rotation.weeks`) de la semaine que la rotation prévoit pour `weekISO`. */
export function plannedRotationIndex(rotation: Rotation, weekISO: string): number | null {
  if (weekISO < rotation.firstWeekISO) return null;
  const diffWeeks = Math.round(
    (parseISODate(weekISO).getTime() - parseISODate(rotation.firstWeekISO).getTime()) /
      (7 * 24 * 60 * 60 * 1000)
  );
  return diffWeeks % rotation.weeks.length;
}

/**
 * Semaine de rotation la plus proche des plats de `meals` (au moins la
 * moitié en commun), pour colorer une semaine du calendrier d'après ce
 * qu'elle contient vraiment — y compris une semaine passée ou échangée.
 */
function matchRotationWeek(
  rotation: Rotation,
  weekStartISO: string,
  meals: PlannedMeal[]
): number | null {
  const start = parseISODate(weekStartISO).getTime();
  const keys = new Set(
    meals
      .filter((m) => m.dishId)
      .map((m) => {
        const d = Math.round((parseISODate(m.date).getTime() - start) / (24 * 60 * 60 * 1000));
        return `${d}|${m.mealSlot}|${m.dishId}`;
      })
  );
  if (keys.size === 0) return null;
  let best: { index: number; score: number } | null = null;
  rotation.weeks.forEach((week, index) => {
    if (week.entries.length === 0) return;
    const common = week.entries.filter((e) =>
      keys.has(`${e.dayOffset}|${e.mealSlot}|${e.dishId}`)
    ).length;
    const score = common / Math.max(week.entries.length, keys.size);
    if (!best || score > best.score) best = { index, score };
  });
  const found = best as { index: number; score: number } | null;
  return found && found.score >= 0.5 ? found.index : null;
}

export async function fetchMonthOverview(): Promise<MonthOverview> {
  const current = todayWeekISO();
  const from = weekAfter(current, -PAST_WEEKS);
  const lastWeek = weekAfter(current, UPCOMING_WEEKS - 1);
  const to = toISODate(addDays(parseISODate(lastWeek), 6));

  // Comme le Planning : les semaines à venir sont remplies par la
  // rotation avant d'être affichées (jamais les semaines passées).
  await ensurePatternApplied(current, to);
  const [pattern, meals] = await Promise.all([fetchSinglePattern(), fetchPlannedMeals(from, to)]);
  const rotation = pattern ? rotationFromPattern(pattern, firstChangeWeek(pattern)) : null;

  const calendar: CalendarWeek[] = [];
  for (let i = 0; i < PAST_WEEKS + UPCOMING_WEEKS; i++) {
    const weekStartISO = weekAfter(from, i);
    const weekEnd = toISODate(addDays(parseISODate(weekStartISO), 6));
    const weekMeals = meals
      .filter((m) => m.date >= weekStartISO && m.date <= weekEnd)
      .sort((a, b) => a.date.localeCompare(b.date));
    const labels = [
      ...new Set(
        weekMeals
          .map((m) => (m.special ? SPECIAL_MEAL_LABELS[m.special] : m.dishName))
          .filter((label): label is string => Boolean(label))
      ),
    ];
    const rotationIndex = rotation ? matchRotationWeek(rotation, weekStartISO, weekMeals) : null;
    const isPast = weekStartISO < current;
    calendar.push({
      weekStartISO,
      isPast,
      isCurrent: weekStartISO === current,
      meals: weekMeals,
      labels,
      rotationIndex,
      modified:
        !isPast &&
        rotationIndex !== null &&
        weekMeals.some((m) => m.mealCycleId === null && (m.dishId || m.special)),
    });
  }

  return { rotation, calendar };
}

/** Plats d'une semaine du calendrier, au format d'une semaine de rotation. */
export function rotationEntriesFrom(entries: SavedWeekEntry[]): MealCycleEntry[] {
  return entries
    .filter((e): e is SavedWeekEntry & { dishId: string } => Boolean(e.dishId) && !e.special)
    .map((e) => ({ dayOffset: e.dayOffset, mealSlot: e.mealSlot, dishId: e.dishId }));
}

export async function calendarWeekEntries(weekStartISO: string): Promise<SavedWeekEntry[]> {
  return snapshotWeek(weekStartISO);
}

/**
 * Enregistre la rotation `weeks` (dans l'ordre où elles reviennent à
 * partir de `firstWeekISO`) puis recalcule les repas qu'elle pose à
 * partir de cette semaine. Une liste vide arrête la rotation.
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
  if (!pattern) throw new Error("Impossible d'enregistrer la rotation");

  await deleteLinkedMealsFrom(pattern.id, firstWeekISO);
  await applyForward(pattern.id, firstWeekISO);
}

/** Déplace la semaine `from` de la rotation à la place `to`. */
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

/**
 * Ajoute une semaine à la rotation, à la place `position` (à la fin par
 * défaut). Sans rotation, en crée une qui démarre la semaine prochaine.
 */
export async function addRotationWeek(
  rotation: Rotation | null,
  entries: MealCycleEntry[],
  position?: number
): Promise<void> {
  if (entries.length === 0) {
    throw new Error("Cette semaine n'a aucun plat : rien à répéter.");
  }
  const weeks = [...(rotation?.weeks ?? [])];
  const used = new Set(weeks.map((w) => w.color));
  const color =
    Array.from({ length: ROTATION_PALETTE_SIZE }, (_, i) => i).find((c) => !used.has(c)) ??
    weeks.length % ROTATION_PALETTE_SIZE;
  weeks.splice(position ?? weeks.length, 0, { color, entries });
  await saveRotation(
    rotation?.patternId ?? null,
    rotation?.firstWeekISO ?? firstChangeWeek(null),
    weeks
  );
}

/** Échange les repas de deux semaines du calendrier (une seule fois, la rotation ne change pas). */
export async function swapCalendarWeeks(aISO: string, bISO: string): Promise<void> {
  const [a, b] = await Promise.all([snapshotWeek(aISO), snapshotWeek(bISO)]);
  await replaceWeek(aISO, b);
  await replaceWeek(bISO, a);
}

/** Remplace les repas de la semaine `targetISO` par `entries` (une seule fois). */
export async function copyIntoCalendarWeek(
  entries: SavedWeekEntry[],
  targetISO: string
): Promise<void> {
  await replaceWeek(targetISO, entries);
}
