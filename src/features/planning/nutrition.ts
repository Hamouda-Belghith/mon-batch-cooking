import { MACROS, type MacroKey, type Macros, type NullableMacros } from "@/features/nutrition/types";
import type { PlannedMeal } from "./types";

export interface DayNutrition {
  totals: Macros;
  /** Au moins un repas du jour n'a pas cette valeur renseignée. */
  incomplete: Record<MacroKey, boolean>;
  /** Au moins une valeur vient d'une estimation automatique. */
  estimated: boolean;
  /** Nombre de repas comptés (plats et repas spéciaux). */
  mealCount: number;
}

/** Apports du plat d'un repas ; un repas spécial (manger dehors) n'en a pas. */
export function mealMacros(meal: PlannedMeal): NullableMacros {
  return {
    calories: meal.dishCalories,
    proteinG: meal.dishProteinG,
    carbsG: meal.dishCarbsG,
    fatG: meal.dishFatG,
  };
}

/**
 * Additionne les apports des repas donnés. Un plat sans valeur
 * renseignée (`null`) ne compte pas dans la somme mais la marque
 * comme incomplète, pour ne pas afficher un total trompeur.
 */
export function sumNutrition(meals: PlannedMeal[]): DayNutrition {
  const day: DayNutrition = {
    totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    incomplete: { calories: false, proteinG: false, carbsG: false, fatG: false },
    estimated: false,
    mealCount: meals.length,
  };
  for (const meal of meals) {
    const values = mealMacros(meal);
    for (const { key } of MACROS) {
      const value = values[key];
      if (value === null) day.incomplete[key] = true;
      else day.totals[key] += value;
    }
    if (meal.dishNutritionEstimated) day.estimated = true;
  }
  return day;
}

export type TargetStatus = "none" | "reached" | "under";

/**
 * Compare un jour à ses objectifs. Un objectif est atteint quand le
 * total l'égale ou le dépasse (objectifs de prise de muscle : ce sont
 * des minimums). « none » : aucun objectif défini, ou rien de prévu ce
 * jour-là (un jour vide n'est pas signalé).
 */
export function compareToTargets(
  day: DayNutrition,
  targets: NullableMacros
): { status: TargetStatus; under: MacroKey[] } {
  const tracked = MACROS.filter(({ key }) => targets[key] !== null);
  if (tracked.length === 0 || day.mealCount === 0) return { status: "none", under: [] };
  const under = tracked
    .filter(({ key }) => day.totals[key] < (targets[key] as number))
    .map(({ key }) => key);
  return { status: under.length > 0 ? "under" : "reached", under };
}
