import type { PostgrestError } from "@supabase/supabase-js";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type LocalShoppingListItem } from "@/lib/db/dexie";
import { getCurrentUserId, getSupabase } from "@/lib/supabase/client";
import { queueMutation } from "./syncQueue";
import type { ShoppingListItem, ShoppingSection } from "./types";
import { isDemoMode } from "@/lib/localDemo";

function mapItem(item: LocalShoppingListItem): ShoppingListItem {
  return {
    id: item.id,
    ingredientId: item.ingredientId,
    ingredientName: item.ingredientName,
    quantity: item.quantity,
    unit: item.unit,
    isChecked: item.isChecked,
    isBought: item.isBought ?? false,
    section: item.section as ShoppingSection,
  };
}

export interface ShoppingListItemWithPeriod extends ShoppingListItem {
  /** Uniquement pour la section « dishes » ; `null` pour « extra ». */
  periodStart: string | null;
  periodEnd: string | null;
}

/**
 * Source de vérité = Dexie. On lit toujours la table entière pour que
 * useLiveQuery s'abonne correctement (un early-return avant la lecture
 * Dexie empêchait les mises à jour après génération / cochage).
 *
 * Renvoie TOUS les articles de l'utilisateur (les deux sections) — à
 * l'appelant de filtrer par section.
 */
export function useShoppingList(): ShoppingListItemWithPeriod[] | undefined {
  return useLiveQuery(async () => {
    // Toujours observer la table, même avant d'avoir l'userId.
    const all = await getDb().shoppingListItems.toArray();
    const userId = await getCurrentUserId();
    if (!userId) return [];

    return all
      .filter((item) => item.userId === userId && item.section !== "final")
      .map((item) => ({
        ...mapItem(item),
        periodStart: item.periodStart,
        periodEnd: item.periodEnd,
      }))
      .sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName, "fr", {
          sensitivity: "base",
        })
      );
  }, []);
}

/**
 * Coche/décoche un article dans sa section d'origine = l'ajoute à / le
 * retire de « À acheter ». Le retirer le sort aussi du panier.
 * Écriture locale immédiate + file de synchro.
 */
export async function toggleItemChecked(
  itemId: string,
  isChecked: boolean
): Promise<void> {
  const changes = isChecked ? { isChecked } : { isChecked, isBought: false };
  await getDb().shoppingListItems.update(itemId, {
    ...changes,
    updatedAt: new Date().toISOString(),
  });

  if (isDemoMode()) return;

  await queueMutation(itemId, "toggle_checked", changes);
}

/**
 * Marque un article de « À acheter » comme mis dans le panier (ou non).
 * Une ligne de « À acheter » peut regrouper plusieurs articles sources
 * (même ingrédient + unité dans les deux sections) : on les met tous à
 * jour.
 */
export async function setItemsBought(
  itemIds: string[],
  isBought: boolean
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await getDb().shoppingListItems.bulkUpdate(
    itemIds.map((id) => ({ key: id, changes: { isBought, updatedAt } }))
  );

  if (isDemoMode()) return;

  for (const id of itemIds) {
    await queueMutation(id, "toggle_bought", { isBought });
  }
}

/**
 * Bouton « Vider » de « À acheter » : décoche tous les articles des
 * sections d'origine (qui y restent, simplement plus à acheter) et
 * vide le panier.
 */
export async function clearPurchaseList(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const checked = await getDb()
    .shoppingListItems.where("userId")
    .equals(userId)
    .filter((item) => item.isChecked || (item.isBought ?? false))
    .toArray();

  for (const item of checked) {
    await toggleItemChecked(item.id, false);
  }
}

/**
 * Supprime un article : local d'abord (offline), puis Supabase.
 */
export async function removeItem(itemId: string): Promise<void> {
  await getDb().shoppingListItems.delete(itemId);

  if (isDemoMode()) return;

  const supabase = getSupabase();
  if (!supabase || !navigator.onLine) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const { error } = (await supabase
    .from("shopping_list_items")
    .delete()
    .eq("user_id", userId)
    .eq("id", itemId)) as { error: PostgrestError | null };
  if (error) console.warn("Suppression Supabase échouée", error);
}

interface RemoteRow {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  is_checked: boolean;
  is_bought: boolean;
  section: ShoppingSection;
  period_start: string | null;
  period_end: string | null;
  updated_at: string;
  ingredients: { name: string } | null;
}

function toLocalRow(row: RemoteRow, userId: string): LocalShoppingListItem {
  return {
    id: row.id,
    userId,
    ingredientId: row.ingredient_id,
    ingredientName: row.ingredients?.name ?? "",
    periodStart: row.period_start,
    periodEnd: row.period_end,
    quantity: row.quantity,
    unit: row.unit,
    isChecked: row.is_checked,
    isBought: row.is_bought,
    section: row.section,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id, ingredient_id, quantity, unit, is_checked, is_bought, section, period_start, period_end, updated_at, ingredients(name)";

/**
 * Recharge le cache Dexie depuis Supabase : toutes les lignes de
 * l'utilisateur (« dishes » ne contient qu'une liste à la fois, voir
 * `generateShoppingList`). Remplace entièrement le cache local.
 */
export async function refreshShoppingList(): Promise<void> {
  if (isDemoMode()) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const { data, error } = (await supabase
    .from("shopping_list_items")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)) as { data: RemoteRow[] | null; error: PostgrestError | null };

  if (error || !data) {
    console.warn("Impossible de rafraîchir la liste de courses", error);
    return;
  }

  const db = getDb();
  await db.shoppingListItems.where("userId").equals(userId).delete();

  const rows = data.map((row) => toLocalRow(row, userId));
  if (rows.length > 0) {
    await db.shoppingListItems.bulkPut(rows);
  }
}
