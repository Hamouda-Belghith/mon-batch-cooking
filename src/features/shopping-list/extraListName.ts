import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUserId, getSupabase } from "@/lib/supabase/client";
import {
  fetchDemoExtraListName,
  isDemoMode,
  saveDemoExtraListName,
} from "@/lib/localDemo";

// Nom de l'onglet « Courses supplémentaires », personnalisable par
// utilisateur (table `user_settings`, voir 0015_user_settings.sql).
// Une copie locale permet de l'afficher tout de suite et hors-ligne,
// comme le reste de l'écran Courses.

export const DEFAULT_EXTRA_LIST_NAME = "Courses supplémentaires";
export const EXTRA_LIST_NAME_MAX_LENGTH = 60;

const CACHE_KEY = "extra-list-name";

export function readCachedExtraListName(): string {
  try {
    return window.localStorage.getItem(CACHE_KEY) || DEFAULT_EXTRA_LIST_NAME;
  } catch {
    return DEFAULT_EXTRA_LIST_NAME;
  }
}

function writeCache(name: string) {
  try {
    window.localStorage.setItem(CACHE_KEY, name);
  } catch {
    // Stockage indisponible (navigation privée…) : le nom reste en mémoire.
  }
}

/** Nom enregistré, ou le nom par défaut. Garde la copie locale si la base est injoignable. */
export async function fetchExtraListName(): Promise<string> {
  if (isDemoMode()) {
    const name = (await fetchDemoExtraListName()) ?? DEFAULT_EXTRA_LIST_NAME;
    writeCache(name);
    return name;
  }

  const supabase = getSupabase();
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return readCachedExtraListName();

  const { data, error } = (await supabase
    .from("user_settings")
    .select("extra_list_name")
    .eq("user_id", userId)
    .maybeSingle()) as {
    data: { extra_list_name: string } | null;
    error: PostgrestError | null;
  };

  if (error) {
    console.warn("Impossible de charger le nom des courses supplémentaires", error);
    return readCachedExtraListName();
  }
  const name = data?.extra_list_name ?? DEFAULT_EXTRA_LIST_NAME;
  writeCache(name);
  return name;
}

/** Enregistre le nouveau nom (déjà validé) ; lève une `Error` lisible en cas d'échec. */
export async function saveExtraListName(name: string): Promise<void> {
  if (isDemoMode()) {
    await saveDemoExtraListName(name);
    writeCache(name);
    return;
  }

  const supabase = getSupabase();
  if (!supabase) throw new Error("Base de données non configurée.");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Pas de connexion internet : le nom n'a pas pu être enregistré.");
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Ta session n'est plus valide. Reconnecte-toi puis réessaie.");
  }

  const { error } = (await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, extra_list_name: name, updated_at: new Date().toISOString() } as never,
      { onConflict: "user_id" } as never
    )) as { error: PostgrestError | null };

  if (error) {
    console.warn("Impossible d'enregistrer le nom des courses supplémentaires", error);
    throw new Error("Le nouveau nom n'a pas pu être enregistré. Réessaie.");
  }
  writeCache(name);
}
