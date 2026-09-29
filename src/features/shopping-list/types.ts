/**
 * - `dishes` : générée automatiquement depuis les plats planifiés sur
 *   une période choisie (onglet « Depuis le planning »). Une seule
 *   liste à la fois : une nouvelle génération remplace la précédente.
 * - `extra` : articles ajoutés à la main (onglet « Courses
 *   supplémentaires »), liste continue (pas de période).
 *
 * La liste « À acheter » n'est pas une section stockée : c'est la
 * réunion des articles cochés (`isChecked`) de ces deux sections,
 * fusionnés par ingrédient + unité (voir `FinalListSection`).
 */
export type ShoppingSection = "dishes" | "extra";

export interface ShoppingListItem {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  /** Coché dans sa section d'origine = fait partie de « À acheter ». */
  isChecked: boolean;
  /** Mis dans le panier (coché sur l'écran « À acheter »). */
  isBought: boolean;
  section: ShoppingSection;
}
