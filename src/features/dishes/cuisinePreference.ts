"use client";

import { useEffect, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUserId, getSupabase } from "@/lib/supabase/client";
import {
  fetchDemoDishCuisines,
  isDemoMode,
  saveDemoDishCuisines,
} from "@/lib/localDemo";
import { CUISINE_LABELS, type Cuisine } from "./catalog";

// Cuisines dont l'application propose des plats (réglage par
// utilisateur, colonne `user_settings.dish_cuisines`, voir
// 0018_ingredient_rename_and_cuisines.sql). Absent = toutes. Une copie
// locale permet d'afficher les suggestions tout de suite, comme pour le
// nom des courses supplémentaires.

export const ALL_CUISINES = Object.keys(CUISINE_LABELS) as Cuisine[];

const CACHE_KEY = "dish-cuisines";
const CHANGE_EVENT = "dish-cuisines-changed";

/** Garde les valeurs connues, dans l'ordre de `ALL_CUISINES` ; vide ou absent = toutes. */
function normalizeCuisines(values: readonly string[] | null | undefined): Cuisine[] {
  const known = ALL_CUISINES.filter((cuisine) => values?.includes(cuisine));
  return known.length > 0 ? known : [...ALL_CUISINES];
}

function readCache(): Cuisine[] {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return normalizeCuisines(raw ? (JSON.parse(raw) as string[]) : null);
  } catch {
    return [...ALL_CUISINES];
  }
}

function writeCache(cuisines: Cuisine[]) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cuisines));
  } catch {
    // Stockage indisponible (navigation privée…) : la valeur reste en mémoire.
  }
}

export async function fetchCuisinePreference(): Promise<Cuisine[]> {
  if (isDemoMode()) {
    const cuisines = normalizeCuisines(await fetchDemoDishCuisines());
    writeCache(cuisines);
    return cuisines;
  }

  const supabase = getSupabase();
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return readCache();

  const { data, error } = (await supabase
    .from("user_settings")
    .select("dish_cuisines")
    .eq("user_id", userId)
    .maybeSingle()) as {
    data: { dish_cuisines: string[] | null } | null;
    error: PostgrestError | null;
  };

  if (error) {
    console.warn("Impossible de charger les cuisines préférées", error);
    return readCache();
  }
  const cuisines = normalizeCuisines(data?.dish_cuisines);
  writeCache(cuisines);
  return cuisines;
}

/** Enregistre le choix (au moins une cuisine) ; lève une `Error` lisible en cas d'échec. */
export async function saveCuisinePreference(cuisines: Cuisine[]): Promise<void> {
  const value = normalizeCuisines(cuisines);

  if (isDemoMode()) {
    await saveDemoDishCuisines(value);
  } else {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Base de données non configurée.");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Pas de connexion internet : le réglage n'a pas pu être enregistré.");
    }
    const userId = await getCurrentUserId();
    if (!userId) throw new Error("Ta session n'est plus valide. Reconnecte-toi puis réessaie.");

    const { error } = (await supabase
      .from("user_settings")
      .upsert(
        { user_id: userId, dish_cuisines: value, updated_at: new Date().toISOString() } as never,
        { onConflict: "user_id" } as never
      )) as { error: PostgrestError | null };
    if (error) {
      console.warn("Impossible d'enregistrer les cuisines préférées", error);
      throw new Error("Le réglage n'a pas pu être enregistré. Réessaie.");
    }
  }

  writeCache(value);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Cuisines choisies, à jour quand le réglage change ailleurs dans
 * l'application (modale Réglages ouverte depuis une autre page).
 */
export function useCuisinePreference(): Cuisine[] {
  const [cuisines, setCuisines] = useState<Cuisine[]>(ALL_CUISINES);

  useEffect(() => {
    setCuisines(readCache());
    void fetchCuisinePreference().then(setCuisines);
    const onChange = () => setCuisines(readCache());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  return cuisines;
}
