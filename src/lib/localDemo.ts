import type { MealSlot } from "@/lib/supabase/database.types";
import type { Dish, DishIngredient } from "@/features/dishes/types";
import { MEAL_SLOTS, type MealCycle, type MealCycleEntry } from "@/features/cycles/types";
import type {
  PlannedMeal,
  SavedWeek,
  SavedWeekEntry,
  SpecialMeal,
} from "@/features/planning/types";
import { getDb, type LocalShoppingListItem } from "./db/dexie";
import { DEMO_USER_ID, getSupabase } from "./supabase/client";
import { addDays, toISODate } from "./date";

const STORAGE_KEY = "meal-planner-demo-state";

interface DemoIngredient {
  id: string;
  name: string;
  defaultUnit: string;
  createdAt: string;
}

interface DemoDish {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  // Absents des états sauvegardés avant l'ajout des apports : lus avec `?? null`.
  calories?: number | null;
  proteinG?: number | null;
  createdAt: string;
}

interface DemoDishIngredient {
  id: string;
  dishId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
}

interface DemoMealCycle {
  id: string;
  name: string;
  durationDays: number;
  startDate: string;
  createdAt: string;
}

interface DemoMealCycleEntry {
  id: string;
  mealCycleId: string;
  dayOffset: number;
  mealSlot: MealSlot;
  dishId: string;
}

interface DemoPlannedMeal {
  id: string;
  date: string;
  mealSlot: MealSlot;
  dishId: string | null;
  mealCycleId: string | null;
  // Absent des états sauvegardés avant l'ajout des repas spéciaux.
  special?: SpecialMeal | null;
  createdAt: string;
}

interface DemoState {
  ingredients: DemoIngredient[];
  dishes: DemoDish[];
  dishIngredients: DemoDishIngredient[];
  mealCycles: DemoMealCycle[];
  mealCycleEntries: DemoMealCycleEntry[];
  plannedMeals: DemoPlannedMeal[];
  savedWeeks: SavedWeek[];
}

function createState(): DemoState {
  return {
    ingredients: [],
    dishes: [],
    dishIngredients: [],
    mealCycles: [],
    mealCycleEntries: [],
    plannedMeals: [],
    savedWeeks: [],
  };
}

function now(): string {
  return new Date().toISOString();
}

function loadState(): DemoState {
  if (typeof window === "undefined") return createState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createState();
    // Rétrocompatibilité : les états sauvegardés avant l'ajout des
    // photos n'ont pas ce champ.
    return { ...createState(), ...(JSON.parse(raw) as Partial<DemoState>) };
  } catch {
    return createState();
  }
}

function saveState(state: DemoState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function ensureIngredientId(name: string, state: DemoState): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const normalized = normalizeName(trimmed);
  const existing = state.ingredients.find(
    (ingredient) => normalizeName(ingredient.name) === normalized
  );
  if (existing) return existing.id;

  const ingredientId = crypto.randomUUID();
  state.ingredients.push({
    id: ingredientId,
    name: trimmed,
    defaultUnit: "pièce",
    createdAt: now(),
  });
  return ingredientId;
}

export async function fetchDemoIngredients(): Promise<string[]> {
  const state = loadState();
  return state.ingredients
    .map((ingredient) => ingredient.name)
    .sort((a, b) => a.localeCompare(b, "fr"));
}

export async function fetchDemoDishes(): Promise<Dish[]> {
  const state = loadState();

  return state.dishes
    .map((dish) => ({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      photoUrl: dish.photoUrl,
      calories: dish.calories ?? null,
      proteinG: dish.proteinG ?? null,
      ingredients: state.dishIngredients
        .filter((entry) => entry.dishId === dish.id)
        .map((entry) => ({
          ingredientId: entry.ingredientId,
          ingredientName:
            state.ingredients.find((ingredient) => ingredient.id === entry.ingredientId)
              ?.name ?? "",
          quantity: entry.quantity,
          unit: entry.unit,
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function saveDemoDish(
  dish: Omit<Dish, "id" | "photoUrl"> & { id?: string; photoUrl?: string | null }
): Promise<Dish | null> {
  const state = loadState();
  const dishId = dish.id ?? crypto.randomUUID();
  const existingIndex = state.dishes.findIndex((row) => row.id === dishId);
  const existingPhotoUrl = state.dishes[existingIndex]?.photoUrl ?? null;

  const trimmedName = dish.name.trim();
  if (!trimmedName) return null;

  const dishRow: DemoDish = {
    id: dishId,
    name: trimmedName,
    description: dish.description?.trim() || null,
    photoUrl: dish.photoUrl === undefined ? existingPhotoUrl : dish.photoUrl,
    calories: dish.calories,
    proteinG: dish.proteinG,
    createdAt: now(),
  };

  if (existingIndex >= 0) {
    state.dishes[existingIndex] = { ...state.dishes[existingIndex], ...dishRow };
  } else {
    state.dishes.push(dishRow);
  }

  state.dishIngredients = state.dishIngredients.filter(
    (entry) => entry.dishId !== dishId
  );

  for (const ingredient of dish.ingredients) {
    const ingredientId = ensureIngredientId(ingredient.ingredientName, state);
    if (!ingredientId) continue;

    state.dishIngredients.push({
      id: crypto.randomUUID(),
      dishId,
      ingredientId,
      quantity: ingredient.quantity,
      unit: ingredient.unit.trim() || "pièce",
    });
  }

  saveState(state);
  return fetchDemoDishes().then((dishes) => dishes.find((d) => d.id === dishId) ?? null);
}

export async function deleteDemoDish(id: string): Promise<void> {
  const state = loadState();
  state.dishes = state.dishes.filter((dish) => dish.id !== id);
  state.dishIngredients = state.dishIngredients.filter(
    (entry) => entry.dishId !== id
  );
  state.plannedMeals = state.plannedMeals.filter((meal) => meal.dishId !== id);
  saveState(state);
}

export async function fetchDemoDishesForCycles(): Promise<Dish[]> {
  const state = loadState();
  return state.dishes
    .map((dish) => ({
      id: dish.id,
      name: dish.name,
      description: null,
      photoUrl: null,
      calories: dish.calories ?? null,
      proteinG: dish.proteinG ?? null,
      ingredients: [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function fetchDemoMealCycles(): Promise<MealCycle[]> {
  const pattern = await fetchDemoRepeatPattern();
  return pattern ? [pattern] : [];
}

export async function fetchDemoRepeatPattern(): Promise<MealCycle | null> {
  const state = loadState();
  const cycle = state.mealCycles[0] ?? null;
  if (!cycle) return null;

  return {
    id: cycle.id,
    name: cycle.name,
    durationDays: cycle.durationDays,
    startDate: cycle.startDate,
    entries: state.mealCycleEntries
      .filter((entry) => entry.mealCycleId === cycle.id)
      .map((entry) => ({
        dayOffset: entry.dayOffset,
        mealSlot: entry.mealSlot,
        dishId: entry.dishId,
      })),
  };
}

export async function clearDemoRepeatPattern(): Promise<void> {
  const state = loadState();
  const ids = new Set(state.mealCycles.map((cycle) => cycle.id));
  state.mealCycles = [];
  state.mealCycleEntries = [];
  for (const meal of state.plannedMeals) {
    if (meal.mealCycleId && ids.has(meal.mealCycleId)) {
      meal.mealCycleId = null;
    }
  }
  saveState(state);
}

export async function upsertDemoRepeatPattern(params: {
  id?: string;
  startDate: string;
  durationDays: number;
  entries: MealCycleEntry[];
}): Promise<MealCycle | null> {
  const state = loadState();
  // Un seul motif en démo.
  const existingId = state.mealCycles[0]?.id;
  const cycleId = params.id ?? existingId ?? crypto.randomUUID();

  state.mealCycles = [
    {
      id: cycleId,
      name: "Répétition",
      durationDays: params.durationDays,
      startDate: params.startDate,
      createdAt: now(),
    },
  ];
  state.mealCycleEntries = [];

  for (const entry of params.entries) {
    if (entry.dayOffset < 0 || entry.dayOffset >= params.durationDays) continue;
    if (!entry.dishId) continue;
    state.mealCycleEntries.push({
      id: crypto.randomUUID(),
      mealCycleId: cycleId,
      dayOffset: entry.dayOffset,
      mealSlot: entry.mealSlot,
      dishId: entry.dishId,
    });
  }

  saveState(state);
  return fetchDemoRepeatPattern();
}

export async function updateDemoPatternEntryAndFuture(params: {
  patternId: string;
  dayOffset: number;
  mealSlot: MealSlot;
  dishId: string | null;
  fromDate: string;
}): Promise<void> {
  const state = loadState();
  const cycle = state.mealCycles.find((c) => c.id === params.patternId);
  if (!cycle) throw new Error("Motif de répétition introuvable");

  state.mealCycleEntries = state.mealCycleEntries.filter(
    (entry) =>
      !(
        entry.mealCycleId === params.patternId &&
        entry.dayOffset === params.dayOffset &&
        entry.mealSlot === params.mealSlot
      )
  );

  if (params.dishId !== null) {
    state.mealCycleEntries.push({
      id: crypto.randomUUID(),
      mealCycleId: params.patternId,
      dayOffset: params.dayOffset,
      mealSlot: params.mealSlot,
      dishId: params.dishId,
    });
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const cycleStart = new Date(`${cycle.startDate}T00:00:00`);

  const matchesOffset = (dateStr: string): boolean => {
    const mealDate = new Date(`${dateStr}T00:00:00`);
    const diffDays = Math.round(
      (mealDate.getTime() - cycleStart.getTime()) / msPerDay
    );
    const offset =
      ((diffDays % cycle.durationDays) + cycle.durationDays) % cycle.durationDays;
    return offset === params.dayOffset;
  };

  // Met à jour ou retire les occurrences futures encore liées au motif.
  const nextPlanned: DemoPlannedMeal[] = [];
  for (const meal of state.plannedMeals) {
    const isFutureLinked =
      meal.date >= params.fromDate &&
      meal.mealCycleId === params.patternId &&
      meal.mealSlot === params.mealSlot &&
      matchesOffset(meal.date);

    if (!isFutureLinked) {
      nextPlanned.push(meal);
      continue;
    }

    if (params.dishId !== null) {
      nextPlanned.push({
        ...meal,
        dishId: params.dishId,
        createdAt: now(),
      });
    }
  }
  state.plannedMeals = nextPlanned;

  // Crée les occurrences futures manquantes (horizon 8 semaines).
  if (params.dishId !== null) {
    const from = new Date(`${params.fromDate}T00:00:00`);
    const end = new Date(from);
    end.setDate(end.getDate() + 8 * 7 - 1);
    const existingKeys = new Set(
      state.plannedMeals.map((meal) => `${meal.date}-${meal.mealSlot}`)
    );

    let cursor = new Date(from);
    while (cursor <= end) {
      const dateStr = toISODate(cursor);
      if (
        matchesOffset(dateStr) &&
        !existingKeys.has(`${dateStr}-${params.mealSlot}`)
      ) {
        state.plannedMeals.push({
          id: crypto.randomUUID(),
          date: dateStr,
          mealSlot: params.mealSlot,
          dishId: params.dishId,
          mealCycleId: params.patternId,
          createdAt: now(),
        });
        existingKeys.add(`${dateStr}-${params.mealSlot}`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  saveState(state);
}

export async function deleteDemoMealCycle(id: string): Promise<void> {
  const state = loadState();
  state.mealCycles = state.mealCycles.filter((cycle) => cycle.id !== id);
  state.mealCycleEntries = state.mealCycleEntries.filter(
    (entry) => entry.mealCycleId !== id
  );
  for (const meal of state.plannedMeals) {
    if (meal.mealCycleId === id) meal.mealCycleId = null;
  }
  saveState(state);
}

export async function saveDemoMealCycle(cycle: {
  id?: string;
  name: string;
  durationDays: number;
  entries: MealCycleEntry[];
}): Promise<MealCycle | null> {
  // Conservé pour compatibilité interne : bascule vers un motif unique.
  return upsertDemoRepeatPattern({
    id: cycle.id,
    startDate: toISODate(new Date()),
    durationDays: Math.max(1, Math.floor(cycle.durationDays)),
    entries: cycle.entries,
  });
}

export async function fetchDemoPlannedMeals(
  periodStart: string,
  periodEnd: string
): Promise<PlannedMeal[]> {
  const state = loadState();
  // dishId et special tous deux null = case explicitement vidée (voir
  // setMealWithScope) : ne représente pas un vrai repas, on la cache de
  // tout le reste de l'app. Un repas spécial (dishId null, special
  // renseigné) reste affiché.
  return state.plannedMeals
    .filter((meal) => meal.date >= periodStart && meal.date <= periodEnd)
    .filter((meal) => meal.dishId !== null || meal.special)
    .map((meal) => {
      const dish = meal.dishId
        ? state.dishes.find((d) => d.id === meal.dishId)
        : undefined;
      return {
        id: meal.id,
        date: meal.date,
        mealSlot: meal.mealSlot,
        dishId: meal.dishId,
        dishName: dish?.name ?? null,
        dishCalories: dish?.calories ?? null,
        dishProteinG: dish?.proteinG ?? null,
        special: meal.special ?? null,
        mealCycleId: meal.mealCycleId,
      };
    });
}

/**
 * Emplacements occupés (dish_id inclus même `null`) sur la période.
 * Sert uniquement à `applyDemoCycleToRange` pour savoir où ne pas
 * réappliquer le motif — contrairement à `fetchDemoPlannedMeals`.
 */
export async function fetchDemoOccupiedSlots(
  periodStart: string,
  periodEnd: string
): Promise<{ id: string; date: string; mealSlot: MealSlot; dishId: string | null }[]> {
  const state = loadState();
  return state.plannedMeals
    .filter((meal) => meal.date >= periodStart && meal.date <= periodEnd)
    .map((meal) => ({
      id: meal.id,
      date: meal.date,
      mealSlot: meal.mealSlot,
      dishId: meal.dishId,
    }));
}

export async function setDemoPlannedMeal(
  date: string,
  mealSlot: MealSlot,
  dishId: string | null,
  mealCycleId: string | null = null,
  special: SpecialMeal | null = null
): Promise<void> {
  const state = loadState();
  const existingIndex = state.plannedMeals.findIndex(
    (meal) => meal.date === date && meal.mealSlot === mealSlot
  );

  if (existingIndex >= 0) {
    state.plannedMeals[existingIndex] = {
      ...state.plannedMeals[existingIndex],
      dishId,
      mealCycleId,
      special,
      createdAt: now(),
    };
  } else {
    state.plannedMeals.push({
      id: crypto.randomUUID(),
      date,
      mealSlot,
      dishId,
      mealCycleId,
      special,
      createdAt: now(),
    });
  }

  saveState(state);
}

export async function clearDemoPlannedMeal(
  date: string,
  mealSlot: MealSlot
): Promise<void> {
  const state = loadState();
  state.plannedMeals = state.plannedMeals.filter(
    (meal) => !(meal.date === date && meal.mealSlot === mealSlot)
  );
  saveState(state);
}

export async function clearAllDemoPlannedMeals(): Promise<void> {
  const state = loadState();
  state.plannedMeals = [];
  saveState(state);
}

export async function applyDemoCycleToRange(
  cycleId: string,
  periodStart: string,
  periodEnd: string,
  overwrite = false
): Promise<void> {
  const state = loadState();
  const cycle = state.mealCycles.find((c) => c.id === cycleId);
  if (!cycle) throw new Error("Motif de répétition introuvable");

  const existingByKey = new Map(
    state.plannedMeals
      .filter((meal) => meal.date >= periodStart && meal.date <= periodEnd)
      .map((meal) => [`${meal.date}-${meal.mealSlot}`, meal])
  );

  const cycleEntriesByOffset = new Map(
    state.mealCycleEntries
      .filter((entry) => entry.mealCycleId === cycleId)
      .map((entry) => [`${entry.dayOffset}-${entry.mealSlot}`, entry])
  );

  const cycleStart = new Date(`${cycle.startDate}T00:00:00`);
  const startDate = new Date(`${periodStart}T00:00:00`);
  const endDate = new Date(`${periodEnd}T00:00:00`);

  const msPerDay = 24 * 60 * 60 * 1000;
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const diffDays = Math.round((cursor.getTime() - cycleStart.getTime()) / msPerDay);
    const cycleOffset = ((diffDays % cycle.durationDays) + cycle.durationDays) % cycle.durationDays;
    const dateStr = toISODate(cursor);

    for (const slot of MEAL_SLOTS) {
      const entry = cycleEntriesByOffset.get(`${cycleOffset}-${slot}`);
      if (!entry) continue;

      const key = `${dateStr}-${slot}`;
      const existingMeal = existingByKey.get(key);
      if (!existingMeal) {
        state.plannedMeals.push({
          id: crypto.randomUUID(),
          date: dateStr,
          mealSlot: slot,
          dishId: entry.dishId,
          mealCycleId: cycleId,
          createdAt: now(),
        });
      } else if (overwrite && existingMeal.dishId !== entry.dishId) {
        existingMeal.dishId = entry.dishId;
        existingMeal.mealCycleId = cycleId;
        existingMeal.createdAt = now();
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  saveState(state);
}

export async function generateDemoShoppingList(
  periodStart: string,
  periodEnd: string
): Promise<{ count: number }> {
  const state = loadState();

  // Un repas spécial (ex. « Manger dehors ») n'a pas de dishId et n'a
  // jamais d'ingrédients.
  const planned = (await fetchDemoPlannedMeals(periodStart, periodEnd)).filter(
    (meal): meal is typeof meal & { dishId: string } => meal.dishId !== null
  );
  if (planned.length === 0) {
    throw new Error("Aucun repas planifié sur cette période");
  }

  const ingredientMap = new Map<string, string>();
  for (const ingredient of state.ingredients) {
    ingredientMap.set(ingredient.id, ingredient.name);
  }

  const dishOccurrences = new Map<string, number>();
  for (const meal of planned) {
    dishOccurrences.set(
      meal.dishId,
      (dishOccurrences.get(meal.dishId) ?? 0) + 1
    );
  }

  const totals = new Map<string, Map<string, number>>();
  for (const row of state.dishIngredients) {
    const occurrences = dishOccurrences.get(row.dishId);
    if (!occurrences) continue;

    const name = ingredientMap.get(row.ingredientId) ?? "";
    if (!name) continue;

    const unitTotals = totals.get(row.ingredientId) ?? new Map();
    unitTotals.set(
      row.unit,
      (unitTotals.get(row.unit) ?? 0) + row.quantity * occurrences
    );
    totals.set(row.ingredientId, unitTotals);
  }

  if (totals.size === 0) {
    throw new Error("Les plats planifiés n'ont pas d'ingrédients");
  }

  const db = getDb();
  const userId = DEMO_USER_ID;
  // Une seule liste « dishes » à la fois (voir `generateShoppingList`).
  await db.shoppingListItems.filter((item) => item.section === "dishes").delete();

  const rows: LocalShoppingListItem[] = [];

  for (const [ingredientId, unitTotals] of totals) {
    for (const [unit, quantity] of unitTotals) {
      rows.push({
        id: crypto.randomUUID(),
        userId,
        ingredientId,
        ingredientName: ingredientMap.get(ingredientId) ?? "",
        periodStart,
        periodEnd,
        quantity,
        unit,
        isChecked: true,
        isBought: false,
        section: "dishes",
        updatedAt: now(),
      });
    }
  }

  await db.shoppingListItems.bulkAdd(rows);
  return { count: rows.length };
}

/**
 * Ajoute un article à la section « extra » (courses supplémentaires,
 * liste continue — pas de période). Réutilise l'ingrédient référentiel
 * existant s'il porte déjà ce nom, sinon en crée un nouveau. Fusionne
 * avec un article déjà présent (même ingrédient + unité) plutôt que de
 * dupliquer une ligne.
 */
export async function addDemoExtraItem(
  name: string,
  quantity: number,
  unit: string
): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Le nom de l'article est obligatoire.");
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("La quantité doit être un nombre supérieur à 0.");
  }
  const normalizedUnit = unit.trim() || "pièce";

  const state = loadState();
  const ingredientId = ensureIngredientId(trimmedName, state);
  if (!ingredientId) throw new Error(`Impossible d'ajouter « ${trimmedName} »`);
  saveState(state);

  const db = getDb();
  const userId = DEMO_USER_ID;

  const existing = await db.shoppingListItems
    .filter(
      (item) =>
        item.periodStart === null &&
        item.section === "extra" &&
        item.ingredientId === ingredientId &&
        item.unit === normalizedUnit
    )
    .first();

  if (existing) {
    await db.shoppingListItems.update(existing.id, {
      quantity: existing.quantity + quantity,
      isChecked: true,
      updatedAt: now(),
    });
  } else {
    await db.shoppingListItems.add({
      id: crypto.randomUUID(),
      userId,
      ingredientId,
      ingredientName: trimmedName,
      periodStart: null,
      periodEnd: null,
      quantity,
      unit: normalizedUnit,
      isChecked: true,
      isBought: false,
      section: "extra",
      updatedAt: now(),
    });
  }
}

export async function fetchDemoSavedWeeks(): Promise<SavedWeek[]> {
  const state = loadState();
  // Même règle que la cascade côté Supabase : une entrée dont le plat a
  // été supprimé disparaît.
  const dishIds = new Set(state.dishes.map((d) => d.id));
  return state.savedWeeks.map((week) => ({
    ...week,
    entries: week.entries.filter((e) => e.special || (e.dishId && dishIds.has(e.dishId))),
  }));
}

/** Enregistre une semaine ; remplace celle qui porte déjà ce nom. */
export async function saveDemoSavedWeek(
  name: string,
  entries: SavedWeekEntry[]
): Promise<void> {
  const state = loadState();
  state.savedWeeks = state.savedWeeks.filter((w) => w.name !== name);
  state.savedWeeks.push({ id: crypto.randomUUID(), name, createdAt: now(), entries });
  saveState(state);
}

export async function deleteDemoSavedWeek(id: string): Promise<void> {
  const state = loadState();
  state.savedWeeks = state.savedWeeks.filter((w) => w.id !== id);
  saveState(state);
}

export function isDemoMode(): boolean {
  return getSupabase() === null;
}
