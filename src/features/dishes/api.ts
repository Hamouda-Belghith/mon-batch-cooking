import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUserId, getSupabase } from "@/lib/supabase/client";
import {
  fetchDemoDishes,
  fetchDemoIngredients,
  saveDemoDish,
  deleteDemoDish,
  isDemoMode,
} from "@/lib/localDemo";
import { normalizeMealSlots, type Dish } from "./types";

// Les types du schéma sont écrits à la main (régénération prévue via
// `supabase gen types`). L'inférence de supabase-js produit des `never`
// sans ces casts localisés — on borne donc explicitement les formes.

type Result<T> = { data: T[] | null; error: PostgrestError | null };
type MutateResult = { error: PostgrestError | null };

interface IngredientRow {
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredients?: { name: string } | null;
}

interface DishRow {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  calories: number | null;
  protein_g: number | null;
  meal_slots: string[] | null;
}

function mapDishRow(row: DishRow, ingRows: IngredientRow[]): Dish {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    photoUrl: row.photo_url,
    calories: row.calories,
    // numeric(6,1) : PostgREST peut le renvoyer sous forme de chaîne.
    proteinG: row.protein_g === null ? null : Number(row.protein_g),
    mealSlots: normalizeMealSlots(row.meal_slots),
    ingredients: ingRows.map((r) => ({
      ingredientId: r.ingredient_id,
      ingredientName: r.ingredients?.name ?? "",
      quantity: Number(r.quantity),
      unit: r.unit,
    })),
  };
}

export async function fetchDishes(): Promise<Dish[]> {
  if (isDemoMode()) {
    return fetchDemoDishes();
  }

  const supabase = getSupabase();
  if (!supabase) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = (await supabase
    .from("dishes")
    .select("id, name, description, photo_url, calories, protein_g, meal_slots")
    .eq("user_id", userId)
    .order("name")) as Result<DishRow>;

  if (error || !data) {
    console.warn("Impossible de charger les plats", error);
    return [];
  }

  const dishes: Dish[] = [];
  for (const row of data) {
    const ingResult = (await supabase
      .from("dish_ingredients")
      .select("ingredient_id, quantity, unit, ingredients(name)")
      .eq("dish_id", row.id)) as Result<IngredientRow>;

    if (ingResult.error || !ingResult.data) {
      console.warn("Impossible de charger les ingrédients du plat", row.id, ingResult.error);
      continue;
    }

    dishes.push(mapDishRow(row, ingResult.data));
  }

  return dishes.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function fetchIngredients(): Promise<string[]> {
  if (isDemoMode()) {
    return fetchDemoIngredients();
  }

  const supabase = getSupabase();
  if (!supabase) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = (await supabase
    .from("ingredients")
    .select("name")
    .eq("user_id", userId)
    .order("name")) as Result<{ name: string }>;

  if (error || !data) {
    console.warn("Impossible de charger les ingrédients", error);
    return [];
  }
  return data.map((row) => row.name);
}

const OFFLINE_MESSAGE =
  "Pas de connexion internet : vérifie ta connexion puis réessaie.";
const SESSION_MESSAGE =
  "Ta session n'est plus valide. Déconnecte-toi, reconnecte-toi, puis réessaie.";

/**
 * Traduit une erreur Supabase en message compréhensible. Les cas
 * connus (réseau, session, migration manquante) ont un message dédié ;
 * sinon `fallback` décrit l'étape qui a échoué et le message technique
 * est ajouté entre parenthèses pour pouvoir diagnostiquer.
 */
function describeError(
  fallback: string,
  error: { code?: string; message?: string }
): Error {
  console.warn(fallback, error);
  const message = error.message ?? "";
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (offline || /failed to fetch|networkerror|load failed/i.test(message)) {
    return new Error(OFFLINE_MESSAGE);
  }
  if (error.code === "42501" || /row-level security|jwt/i.test(message)) {
    return new Error(SESSION_MESSAGE);
  }
  // Colonne / table inconnue : une migration SQL n'a pas été appliquée.
  if (["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    return new Error(
      "La base de données n'est pas à jour (migration SQL manquante). " +
        "Préviens la personne qui gère l'application."
    );
  }
  return new Error(`${fallback} (détail : ${message || error.code || "erreur inconnue"}).`);
}

async function upsertIngredient(userId: string, name: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Base de données non configurée.");

  // Upsert silencieux : même nom => même ligne (index unique sur user_id + name).
  const { data, error } = (await supabase
    .from("ingredients")
    .upsert(
      { user_id: userId, name, default_unit: "" } as never,
      { onConflict: "user_id,name" } as never
    )
    .select("id")) as Result<{ id: string }>;

  const fallback = `Impossible d'enregistrer l'ingrédient « ${name} »`;
  if (error) throw describeError(fallback, error);
  if (!data?.[0]) throw new Error(`${fallback}.`);
  return data[0].id;
}

const PHOTO_BUCKET = "dish-photos";

/** Extrait le chemin interne au bucket depuis une URL publique Supabase Storage. */
function photoPathFromPublicUrl(url: string): string | null {
  const marker = `/${PHOTO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function uploadDishPhoto(
  userId: string,
  dishId: string,
  dataUrl: string
): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Base de données non configurée.");

  const fallback =
    "L'envoi de la photo a échoué (photo trop lourde ou connexion instable). " +
    "Réessaie, ou enregistre le plat sans photo";

  try {
    const blob = await (await fetch(dataUrl)).blob();
    const ext = blob.type.split("/")[1]?.split("+")[0] || "jpg";
    const path = `${userId}/${dishId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (error) throw error;

    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (err) {
    throw describeError(fallback, err as { code?: string; message?: string });
  }
}

async function deleteDishPhoto(photoUrl: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const path = photoPathFromPublicUrl(photoUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.warn("Impossible de supprimer la photo du plat", error);
}

/**
 * Enregistre un plat (création ou modification). Lève une `Error` au
 * message lisible par l'utilisateur en cas d'échec — jamais d'échec
 * silencieux, sinon un plat peut être enregistré sans certains
 * ingrédients sans que personne ne le sache.
 */
export async function saveDish(
  dish: Omit<Dish, "id" | "photoUrl"> & { id?: string; photoUrl?: string | null }
): Promise<void> {
  // La base refuse deux fois le même ingrédient dans un plat (unique
  // dish_id + ingredient_id) : on prévient avant d'écrire quoi que ce soit.
  const seen = new Set<string>();
  for (const ing of dish.ingredients) {
    const name = ing.ingredientName.trim();
    if (!name) continue;
    if (seen.has(name.toLowerCase())) {
      throw new Error(
        `L'ingrédient « ${name} » apparaît plusieurs fois dans ce plat. ` +
          "Garde une seule ligne et additionne les quantités."
      );
    }
    seen.add(name.toLowerCase());
  }

  if (isDemoMode()) {
    if (!(await saveDemoDish(dish))) throw new Error("Le nom du plat est obligatoire.");
    return;
  }

  const supabase = getSupabase();
  if (!supabase) throw new Error("Base de données non configurée.");

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(OFFLINE_MESSAGE);
  }

  const userId = await getCurrentUserId();
  if (!userId) throw new Error(SESSION_MESSAGE);

  const dishId = dish.id ?? crypto.randomUUID();

  // photoUrl undefined = ne touche pas à la photo existante ; null = la
  // retire ; une data URL (data:...) = nouvelle photo à envoyer.
  let photoUrl: string | null | undefined;
  if (dish.photoUrl === undefined) {
    photoUrl = undefined;
  } else if (dish.photoUrl === null) {
    photoUrl = null;
  } else if (dish.photoUrl.startsWith("data:")) {
    photoUrl = await uploadDishPhoto(userId, dishId, dish.photoUrl);
  } else {
    photoUrl = dish.photoUrl;
  }

  // Mémorise l'ancienne photo pour la supprimer une fois le plat
  // réellement enregistré (jamais avant : un échec laisserait sinon le
  // plat pointer vers un fichier supprimé).
  let previousUrl: string | null | undefined;
  if (dish.photoUrl !== undefined && dish.id) {
    const previous = (await supabase
      .from("dishes")
      .select("photo_url")
      .eq("id", dish.id)
      .limit(1)) as Result<{ photo_url: string | null }>;
    previousUrl = previous.data?.[0]?.photo_url;
  }

  const payload: Record<string, unknown> = {
    id: dishId,
    user_id: userId,
    name: dish.name.trim(),
    description: dish.description?.trim() || null,
    calories: dish.calories,
    protein_g: dish.proteinG,
    meal_slots: normalizeMealSlots(dish.mealSlots),
  };
  if (photoUrl !== undefined) payload.photo_url = photoUrl;

  const savedResult = (await supabase
    .from("dishes")
    .upsert(payload as never, { onConflict: "id" } as never)
    .select("id")) as Result<{ id: string }>;

  if (savedResult.error) {
    throw describeError("Impossible d'enregistrer le plat", savedResult.error);
  }
  if (!savedResult.data?.[0]) {
    throw new Error("Impossible d'enregistrer le plat (aucune ligne enregistrée).");
  }

  if (previousUrl && previousUrl !== photoUrl) {
    await deleteDishPhoto(previousUrl);
  }

  const { error: delError } = (await supabase
    .from("dish_ingredients")
    .delete()
    .eq("dish_id", dishId)) as MutateResult;
  if (delError) {
    throw describeError("Impossible de mettre à jour les ingrédients du plat", delError);
  }

  for (const ing of dish.ingredients) {
    const name = ing.ingredientName.trim();
    if (!name) continue;

    const ingredientId = await upsertIngredient(userId, name);

    const { error: insertError } = (await supabase
      .from("dish_ingredients")
      .insert({
        dish_id: dishId,
        ingredient_id: ingredientId,
        quantity: ing.quantity,
        unit: ing.unit.trim() || "pièce",
      } as never)) as MutateResult;
    if (insertError) {
      throw describeError(`Impossible d'ajouter l'ingrédient « ${name} » au plat`, insertError);
    }
  }
}

export async function deleteDish(id: string): Promise<void> {
  if (isDemoMode()) {
    return deleteDemoDish(id);
  }

  const supabase = getSupabase();
  if (!supabase) return;

  const existing = (await supabase
    .from("dishes")
    .select("photo_url")
    .eq("id", id)
    .limit(1)) as Result<{ photo_url: string | null }>;

  const { error } = (await supabase
    .from("dishes")
    .delete()
    .eq("id", id)) as MutateResult;

  if (error) {
    console.warn("Impossible de supprimer le plat", error);
    throw new Error("Suppression du plat impossible");
  }

  const photoUrl = existing.data?.[0]?.photo_url;
  if (photoUrl) await deleteDishPhoto(photoUrl);
}
