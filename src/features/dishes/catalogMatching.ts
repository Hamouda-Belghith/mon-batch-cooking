import type { MealSlot } from "@/lib/supabase/database.types";
import { isLikelyTypo, nameKey } from "@/lib/text";
import { estimateDish } from "@/features/nutrition/estimate";
import { DISH_CATALOG, type CatalogDish, type Cuisine } from "./catalog";
import { MEAL_SLOTS } from "@/features/cycles/types";
import type { Dish } from "./types";
import { catalogPhotoUrl } from "./catalogPhotos";

/*
 * Noms de plats : doublons parmi les plats de l'utilisateur, plats connus
 * du catalogue (`catalog.ts`) et suggestions à ajouter.
 */

interface IndexedDish {
  dish: CatalogDish;
  keys: string[];
}

let catalogIndex: IndexedDish[] | null = null;

function indexedCatalog(): IndexedDish[] {
  catalogIndex ??= DISH_CATALOG.map((dish) => ({
    dish,
    keys: [dish.name, ...(dish.aliases ?? [])].map(nameKey),
  }));
  return catalogIndex;
}

/**
 * Plat de l'utilisateur qui porte déjà ce nom (`exact` : même nom à
 * l'écriture près, « pate saumon » = « Pâtes au saumon ») ou un nom très
 * proche (faute de frappe probable). `excludeId` : le plat en cours de
 * modification.
 */
export function findSimilarDish<T extends { id: string; name: string }>(
  name: string,
  dishes: readonly T[],
  excludeId?: string
): { dish: T; exact: boolean } | null {
  const key = nameKey(name);
  if (!key) return null;
  const others = dishes.filter((dish) => dish.id !== excludeId);
  const exact = others.find((dish) => nameKey(dish.name) === key);
  if (exact) return { dish: exact, exact: true };
  const close = others.find((dish) => isLikelyTypo(key, nameKey(dish.name)));
  return close ? { dish: close, exact: false } : null;
}

/**
 * Plat du catalogue désigné par ce nom : même nom, autre nom connu
 * (« ma9rouna poulet » → Makrouna au poulet) ou faute de frappe probable.
 * Une correspondance partielle ne compte pas : trop souvent fausse.
 */
export function findCatalogDish(name: string): CatalogDish | null {
  const key = nameKey(name);
  if (!key) return null;
  const catalog = indexedCatalog();
  return (
    catalog.find((item) => item.keys.includes(key))?.dish ??
    catalog.find((item) => item.keys.some((k) => isLikelyTypo(key, k)))?.dish ??
    null
  );
}

/** Nom du catalogue à proposer pour un plat existant, quand il diffère de son nom. */
export function suggestedDishName(name: string): string | null {
  const known = findCatalogDish(name);
  return known && known.name !== name.trim() ? known.name : null;
}

/**
 * Plats du catalogue à proposer : des cuisines choisies, du créneau
 * demandé, correspondant à la recherche, et que l'utilisateur n'a pas
 * déjà (sous ce nom ou un autre nom connu).
 */
export function catalogSuggestions({
  cuisines,
  mealSlot,
  query = "",
  existingNames,
}: {
  cuisines: readonly Cuisine[];
  mealSlot?: MealSlot;
  query?: string;
  existingNames: readonly string[];
}): CatalogDish[] {
  const owned = new Set(existingNames.map(nameKey));
  const queryKey = nameKey(query);
  return indexedCatalog()
    .filter(
      ({ dish, keys }) =>
        cuisines.includes(dish.cuisine) &&
        (!mealSlot || dish.mealSlots.includes(mealSlot)) &&
        !keys.some((key) => owned.has(key)) &&
        (!queryKey || keys.some((key) => key.includes(queryKey)))
    )
    .map(({ dish }) => dish);
}

/**
 * Plat prêt à enregistrer à partir d'un plat du catalogue : ingrédients
 * du catalogue, photo du catalogue s'il y en a une, apports estimés
 * d'après le nom. `extraSlots` : créneaux à ajouter (ex. le repas de la
 * case du planning).
 */
export function catalogDishToDraft(
  dish: CatalogDish,
  extraSlots: readonly MealSlot[] = []
): Omit<Dish, "id"> {
  const mealSlots = MEAL_SLOTS.filter((slot) => dish.mealSlots.includes(slot) || extraSlots.includes(slot));
  const ingredients = dish.ingredients.map((ing) => ({
    ingredientId: "",
    ingredientName: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
  }));
  const { macros } = estimateDish({
    name: dish.name,
    description: null,
    mealSlots,
    ingredientNames: ingredients.map((ing) => ing.ingredientName),
  });
  return {
    name: dish.name,
    description: null,
    mealSlots,
    ...macros,
    nutritionEstimated: true,
    ingredients,
    photoUrl: catalogPhotoUrl(dish.name),
  };
}
