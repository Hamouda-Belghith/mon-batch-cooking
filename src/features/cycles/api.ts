import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { fetchDemoDishesForCycles, isDemoMode } from "@/lib/localDemo";
import { normalizeMealSlots, type Dish } from "@/features/dishes/types";
import type { MealSlot } from "@/lib/supabase/database.types";
import { MEAL_SLOTS } from "./types";

export { MEAL_SLOTS };

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Petit-déj",
  lunch: "Déjeuner",
  snack: "Collation",
  dinner: "Dîner",
};

/** Liste légère des plats pour le sélecteur du planning. */
export async function fetchDishesForCycles(): Promise<Dish[]> {
  if (isDemoMode()) {
    return fetchDemoDishesForCycles();
  }

  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = (await supabase
    .from("dishes")
    .select("id, name, calories, protein_g, meal_slots")
    .order("name")) as {
    data:
      | {
          id: string;
          name: string;
          calories: number | null;
          protein_g: number | null;
          meal_slots: string[] | null;
        }[]
      | null;
    error: PostgrestError | null;
  };

  if (error || !data) {
    console.warn("Impossible de charger les plats", error);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: null,
    photoUrl: null,
    calories: row.calories,
    proteinG: row.protein_g === null ? null : Number(row.protein_g),
    mealSlots: normalizeMealSlots(row.meal_slots),
    ingredients: [],
  }));
}
