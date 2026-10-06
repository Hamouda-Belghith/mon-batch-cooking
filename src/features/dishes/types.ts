export interface DishIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
}

import type { MealSlot } from "@/lib/supabase/database.types";
import { MEAL_SLOTS } from "@/features/cycles/types";

/**
 * Libellés des catégories d'un plat. Une catégorie = un créneau du
 * planning : le choix d'un plat pour une case ne propose que les plats
 * de cette catégorie.
 */
export const DISH_CATEGORY_LABELS: Record<MealSlot, string> = {
  breakfast: "Petit-déjeuner",
  lunch: "Déjeuner",
  snack: "Collation",
  dinner: "Dîner",
};

/** Catégories d'un plat créé sans précision (et des plats existants avant 0014). */
export const DEFAULT_DISH_MEAL_SLOTS: MealSlot[] = ["lunch", "dinner"];

/**
 * Catégories lues en base ou en mode démo : dans l'ordre du planning,
 * sans doublon, et jamais vides (valeur absente = plat antérieur aux
 * catégories → déjeuner + dîner, comme la migration 0014).
 */
export function normalizeMealSlots(slots: readonly string[] | null | undefined): MealSlot[] {
  const normalized = MEAL_SLOTS.filter((slot) => slots?.includes(slot));
  return normalized.length > 0 ? normalized : [...DEFAULT_DISH_MEAL_SLOTS];
}

export interface Dish {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  /** kcal pour une portion ; null = non renseigné. */
  calories: number | null;
  /** Grammes de protéines pour une portion ; null = non renseigné. */
  proteinG: number | null;
  /** Catégories (au moins une), dans l'ordre de `MEAL_SLOTS`. */
  mealSlots: MealSlot[];
  ingredients: DishIngredient[];
}
