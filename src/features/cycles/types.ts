import type { MealSlot } from "@/lib/supabase/database.types";

export interface MealCycleEntry {
  dayOffset: number;
  mealSlot: MealSlot;
  dishId: string;
}

export interface MealCycle {
  id: string;
  name: string;
  durationDays: number;
  startDate: string;
  /**
   * Couleur (indice de palette) de chaque semaine de la rotation, depuis
   * `startDate`. Null = couleurs par défaut 0, 1, 2… (voir 0016).
   */
  weekColors?: number[] | null;
  entries: MealCycleEntry[];
}

/** Créneaux de repas dans l'ordre d'affichage de la journée. */
export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
