import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUserId, getSupabase } from "@/lib/supabase/client";
import { fetchPlannedMeals } from "@/features/planning/api";
import {
  addInclusiveDuration,
  endOfWeek,
  toISODate,
  type DurationUnit,
} from "@/lib/date";
import { refreshShoppingList } from "./useShoppingList";
import {
  addDemoExtraItem,
  generateDemoShoppingList,
  isDemoMode,
} from "@/lib/localDemo";

type MutateResult = { error: PostgrestError | null };

interface PlannedDishRow {
  id: string;
  dish_ingredients?: {
    ingredient_id: string;
    quantity: number;
    unit: string;
    ingredients?: { name: string } | null;
  }[];
}

/**
 * Agrège les ingrédients des plats planifiés sur une période et remplace
 * entièrement la section « dishes » (une seule liste à la fois, quelle
 * que soit la période précédente — sinon « À acheter » additionnerait
 * d'anciennes périodes). Les articles générés sont cochés, donc
 * directement dans « À acheter ». La section « extra » n'est pas touchée. Même ingrédient + même unité : quantités
 * additionnées. Un plat planifié plusieurs fois multiplie ses quantités.
 * Un repas spécial (ex. « Manger dehors », voir `features/planning/types.ts`)
 * n'a pas d'ingrédients et n'est jamais compté.
 */
export async function generateShoppingList(
  periodStart: string,
  periodEnd: string
): Promise<{ count: number }> {
  if (isDemoMode()) {
    return generateDemoShoppingList(periodStart, periodEnd);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré");
  }

  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Utilisateur non connecté");

  const planned = (await fetchPlannedMeals(periodStart, periodEnd)).filter(
    (meal): meal is typeof meal & { dishId: string } => meal.dishId !== null
  );
  if (planned.length === 0) {
    throw new Error("Aucun repas planifié sur cette période");
  }

  const dishOccurrences = new Map<string, number>();
  for (const meal of planned) {
    dishOccurrences.set(
      meal.dishId,
      (dishOccurrences.get(meal.dishId) ?? 0) + 1
    );
  }

  const dishIds = [...dishOccurrences.keys()];
  const { data: dishRows, error: dishError } = (await supabase
    .from("dishes")
    .select(
      "id, dish_ingredients(ingredient_id, quantity, unit, ingredients(name))"
    )
    .in("id", dishIds)) as {
    data: PlannedDishRow[] | null;
    error: PostgrestError | null;
  };

  if (dishError || !dishRows) {
    console.warn("Impossible de charger les plats pour la liste de courses", dishError);
    throw new Error("Impossible de générer la liste");
  }

  const totals = new Map<
    string,
    { name: string; quantities: Map<string, number> }
  >();

  for (const row of dishRows) {
    const occurrences = dishOccurrences.get(row.id) ?? 1;
    for (const ing of row.dish_ingredients ?? []) {
      const aggregate = totals.get(ing.ingredient_id) ?? {
        name: ing.ingredients?.name ?? "",
        quantities: new Map<string, number>(),
      };
      const unit = ing.unit || "pièce";
      aggregate.quantities.set(
        unit,
        (aggregate.quantities.get(unit) ?? 0) +
          Number(ing.quantity) * occurrences
      );
      totals.set(ing.ingredient_id, aggregate);
    }
  }

  if (totals.size === 0) {
    throw new Error("Les plats planifiés n'ont pas d'ingrédients");
  }

  const { error: delError } = (await supabase
    .from("shopping_list_items")
    .delete()
    .eq("user_id", userId)
    .eq("section", "dishes")) as MutateResult;

  if (delError) {
    console.warn("Impossible de vider l'ancienne liste", delError);
    throw new Error("Impossible de régénérer la liste");
  }

  const rows: Array<{
    user_id: string;
    ingredient_id: string;
    period_start: string;
    period_end: string;
    quantity: number;
    unit: string;
    is_checked: boolean;
    section: "dishes";
  }> = [];

  for (const [ingredientId, agg] of totals) {
    for (const [unit, quantity] of agg.quantities) {
      rows.push({
        user_id: userId,
        ingredient_id: ingredientId,
        period_start: periodStart,
        period_end: periodEnd,
        quantity,
        unit,
        is_checked: true,
        section: "dishes",
      });
    }
  }

  const { error: insertError } = (await supabase
    .from("shopping_list_items")
    .insert(rows as never)) as MutateResult;

  if (insertError) {
    console.warn("Impossible d'insérer la liste de courses", insertError);
    throw new Error("Impossible d'enregistrer la liste");
  }

  await refreshShoppingList();

  return { count: rows.length };
}

/** Trouve ou crée l'ingrédient référentiel correspondant à ce nom. */
async function upsertShoppingIngredient(
  userId: string,
  name: string
): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase n'est pas configuré");

  const { data, error } = (await supabase
    .from("ingredients")
    .upsert(
      { user_id: userId, name, default_unit: "" } as never,
      { onConflict: "user_id,name" } as never
    )
    .select("id")) as { data: { id: string }[] | null; error: PostgrestError | null };

  if (error || !data?.[0]) {
    console.warn("Impossible de créer l'ingrédient", name, error);
    throw new Error(`Impossible d'ajouter « ${name} »`);
  }
  return data[0].id;
}

/**
 * Ajoute un article à la section « extra » (courses supplémentaires,
 * liste continue — pas de période). Réutilise l'ingrédient référentiel
 * existant s'il porte déjà ce nom (voir `fetchIngredients`), sinon en
 * crée un nouveau. Fusionne avec un article déjà présent (même
 * ingrédient + unité) plutôt que de dupliquer une ligne. L'article est
 * coché (donc dans « À acheter »), y compris s'il existait décoché.
 */
export async function addExtraItem(
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

  if (isDemoMode()) {
    await addDemoExtraItem(trimmedName, quantity, normalizedUnit);
    return;
  }

  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase n'est pas configuré");

  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Utilisateur non connecté");

  const ingredientId = await upsertShoppingIngredient(userId, trimmedName);

  const { data: existingRows, error: existingError } = (await supabase
    .from("shopping_list_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .is("period_start", null)
    .eq("section", "extra")
    .eq("ingredient_id", ingredientId)
    .eq("unit", normalizedUnit)
    .limit(1)) as { data: { id: string; quantity: number }[] | null; error: PostgrestError | null };

  if (existingError) {
    console.warn("Impossible de vérifier les articles existants", existingError);
    throw new Error("Impossible d'ajouter cet article");
  }

  if (existingRows?.[0]) {
    const { error } = (await supabase
      .from("shopping_list_items")
      .update({
        quantity: Number(existingRows[0].quantity) + quantity,
        is_checked: true,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", existingRows[0].id)) as MutateResult;
    if (error) {
      console.warn("Impossible de mettre à jour l'article", error);
      throw new Error("Impossible d'ajouter cet article");
    }
  } else {
    const { error } = (await supabase.from("shopping_list_items").insert({
      user_id: userId,
      ingredient_id: ingredientId,
      quantity,
      unit: normalizedUnit,
      is_checked: true,
      section: "extra",
    } as never)) as MutateResult;
    if (error) {
      console.warn("Impossible d'ajouter l'article", error);
      throw new Error("Impossible d'ajouter cet article");
    }
  }

  await refreshShoppingList();
}

export interface ShoppingPeriod {
  periodStart: string;
  periodEnd: string;
  amount: number;
  unit: DurationUnit;
}

/** Période par défaut : aujourd'hui → dimanche de la semaine en cours. */
export function getDefaultPeriod(): ShoppingPeriod {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sunday = endOfWeek(today);
  const msPerDay = 24 * 60 * 60 * 1000;
  const days =
    Math.round((sunday.getTime() - today.getTime()) / msPerDay) + 1;

  return {
    periodStart: toISODate(today),
    periodEnd: toISODate(sunday),
    amount: Math.max(1, days),
    unit: "day",
  };
}

/** Calcule la période à partir d'aujourd'hui + durée (nombre + unité). */
export function periodFromDuration(
  amount: number,
  unit: DurationUnit
): ShoppingPeriod {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const safeAmount = Math.max(1, Math.floor(amount));
  return {
    periodStart: toISODate(today),
    periodEnd: toISODate(addInclusiveDuration(today, safeAmount, unit)),
    amount: safeAmount,
    unit,
  };
}
