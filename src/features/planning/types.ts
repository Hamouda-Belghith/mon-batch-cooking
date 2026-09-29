import type { MealSlot } from "@/lib/supabase/database.types";

/**
 * Repas "spécial" : pas un plat, une case du planning qui représente
 * autre chose (ex. manger dehors). Liste fermée pour l'instant — voir
 * `supabase/migrations/0008_planned_meal_special.sql`.
 */
export type SpecialMeal = "eating_out";

export const SPECIAL_MEAL_LABELS: Record<SpecialMeal, string> = {
  eating_out: "Manger dehors",
};

export interface PlannedMeal {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  mealSlot: MealSlot;
  /** Mutuellement exclusif avec `special` : jamais les deux renseignés. */
  dishId: string | null;
  dishName: string | null;
  dishCalories: number | null;
  dishProteinG: number | null;
  special: SpecialMeal | null;
  mealCycleId: string | null;
}

/** Une case d'une semaine enregistrée : 0 = lundi … 6 = dimanche. */
export interface SavedWeekEntry {
  dayOffset: number;
  mealSlot: MealSlot;
  /** Mutuellement exclusif avec `special`, comme pour `PlannedMeal`. */
  dishId: string | null;
  special: SpecialMeal | null;
}

/**
 * Semaine enregistrée : les repas d'une semaine du planning, gardés
 * sous un nom pour remplir plus tard une autre semaine. Indépendante du
 * motif de répétition (voir `supabase/migrations/0013_saved_weeks.sql`).
 */
export interface SavedWeek {
  id: string;
  name: string;
  createdAt: string;
  entries: SavedWeekEntry[];
}
