import Dexie, { type EntityTable } from "dexie";
import type { ShoppingSection } from "@/features/shopping-list/types";

// Miroir local (offline) de shopping_list_items, voir supabase/migrations.
export interface LocalShoppingListItem {
  id: string; // même id que côté Supabase (uuid généré côté client à la création)
  userId: string;
  ingredientId: string;
  ingredientName: string; // dénormalisé pour affichage offline sans jointure
  // ISO date (YYYY-MM-DD). Uniquement pour la section "dishes" (générée
  // sur une période) ; null pour "extra", liste continue.
  periodStart: string | null;
  periodEnd: string | null;
  quantity: number;
  unit: string;
  isChecked: boolean;
  // Absent des lignes mises en cache avant son ajout : lu avec `?? false`.
  isBought?: boolean;
  // "final" : ancienne section, peut subsister dans un cache local
  // antérieur à 0012 ; ignorée à la lecture (voir useShoppingList).
  section: ShoppingSection | "final";
  updatedAt: string;
}

// File d'attente des modifications faites hors-ligne, rejouées vers
// Supabase dès que le réseau est disponible (voir syncQueue.ts).
export interface PendingMutation {
  id: string; // uuid de la mutation elle-même
  userId: string;
  itemId: string; // id du shopping_list_item concerné
  // toggle_checked : ajouter/retirer de « À acheter » (retirer remet
  // aussi isBought à false) ; toggle_bought : mis dans le panier.
  action: "toggle_checked" | "toggle_bought";
  payload: { isChecked?: boolean; isBought?: boolean };
  createdAt: string;
}

class MealPlannerDB extends Dexie {
  shoppingListItems!: EntityTable<LocalShoppingListItem, "id">;
  pendingMutations!: EntityTable<PendingMutation, "id">;

  constructor() {
    super("meal-planner");
    this.version(1).stores({
      shoppingListItems: "id, userId, periodStart, periodEnd, ingredientId",
      pendingMutations: "id, userId, itemId, createdAt",
    });
  }
}

let cachedDb: MealPlannerDB | null = null;

// Instance unique partagée dans toute l'app.
// Créée paresseusement : IndexedDB n'existe pas côté serveur (SSR),
// donc getDb() n'est appelé que dans le navigateur (hooks, handlers
// d'événements), jamais au niveau module.
export function getDb(): MealPlannerDB {
  if (!cachedDb) {
    cachedDb = new MealPlannerDB();
  }
  return cachedDb;
}
