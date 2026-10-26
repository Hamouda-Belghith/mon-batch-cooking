import type { PostgrestError } from "@supabase/supabase-js";
import { getCurrentUserId, getSupabase } from "@/lib/supabase/client";
import {
  fetchDemoNutritionTargets,
  isDemoMode,
  saveDemoNutritionTargets,
} from "@/lib/localDemo";
import { EMPTY_MACROS, toNumberOrNull, type Macros, type NullableMacros } from "./types";

// Objectifs nutritionnels du jour, propres à chaque compte (colonnes
// `target_*` de `user_settings`, voir 0017). Une copie locale permet de
// les afficher tout de suite dans le Planning, comme le nom de l'onglet
// des courses supplémentaires.

const CACHE_KEY = "nutrition-targets";

export function readCachedTargets(): NullableMacros {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? { ...EMPTY_MACROS, ...(JSON.parse(raw) as Partial<NullableMacros>) } : EMPTY_MACROS;
  } catch {
    return EMPTY_MACROS;
  }
}

function writeCache(targets: NullableMacros) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(targets));
  } catch {
    // Stockage indisponible (navigation privée…) : non bloquant.
  }
}

interface TargetsRow {
  target_kcal: number | null;
  target_protein_g: number | string | null;
  target_carbs_g: number | string | null;
  target_fat_g: number | string | null;
}

/** Objectifs enregistrés ; garde la copie locale si la base est injoignable. */
export async function fetchNutritionTargets(): Promise<NullableMacros> {
  if (isDemoMode()) {
    const targets = (await fetchDemoNutritionTargets()) ?? EMPTY_MACROS;
    writeCache(targets);
    return targets;
  }

  const supabase = getSupabase();
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return readCachedTargets();

  const { data, error } = (await supabase
    .from("user_settings")
    .select("target_kcal, target_protein_g, target_carbs_g, target_fat_g")
    .eq("user_id", userId)
    .maybeSingle()) as { data: TargetsRow | null; error: PostgrestError | null };

  if (error) {
    console.warn("Impossible de charger les objectifs", error);
    return readCachedTargets();
  }

  const targets: NullableMacros = {
    calories: data?.target_kcal ?? null,
    proteinG: toNumberOrNull(data?.target_protein_g),
    carbsG: toNumberOrNull(data?.target_carbs_g),
    fatG: toNumberOrNull(data?.target_fat_g),
  };
  writeCache(targets);
  return targets;
}

/** Enregistre les objectifs (déjà validés) ; lève une `Error` lisible en cas d'échec. */
export async function saveNutritionTargets(targets: NullableMacros): Promise<void> {
  if (isDemoMode()) {
    await saveDemoNutritionTargets(targets);
    writeCache(targets);
    return;
  }

  const supabase = getSupabase();
  if (!supabase) throw new Error("Base de données non configurée.");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Pas de connexion internet : les objectifs n'ont pas pu être enregistrés.");
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Ta session n'est plus valide. Reconnecte-toi puis réessaie.");
  }

  // `extra_list_name` n'est pas envoyé : sa valeur par défaut (0017)
  // s'applique si la ligne n'existe pas encore, et un nom déjà
  // personnalisé n'est pas écrasé.
  const { error } = (await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      target_kcal: targets.calories,
      target_protein_g: targets.proteinG,
      target_carbs_g: targets.carbsG,
      target_fat_g: targets.fatG,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" } as never
  )) as { error: PostgrestError | null };

  if (error) {
    console.warn("Impossible d'enregistrer les objectifs", error);
    throw new Error("Les objectifs n'ont pas pu être enregistrés. Réessaie.");
  }
  writeCache(targets);
}

export type TargetGoal = "gain" | "maintain" | "loss";

export const TARGET_GOAL_LABELS: Record<TargetGoal, string> = {
  gain: "Prise de muscle",
  maintain: "Maintien",
  loss: "Perte de poids",
};

/**
 * Objectifs suggérés à partir du poids, du nombre de séances de sport
 * par semaine et de l'objectif. Volontairement simple (ni taille ni
 * âge) : un point de départ à ajuster, pas une prescription.
 *
 * - Maintien ≈ poids × (30 + 1 par séance hebdo, plafonné à 36) kcal.
 * - Prise de muscle : +10 % (surplus modéré) ; perte : −15 %.
 * - Protéines : 2 g/kg en prise de muscle ou en perte (préserver le
 *   muscle), 1,6 g/kg en maintien.
 * - Lipides : 1 g/kg (0,8 en perte).
 * - Glucides : le reste des calories (4 kcal/g prot. et gluc., 9 /g lip.).
 */
export function suggestTargets(weightKg: number, sessionsPerWeek: number, goal: TargetGoal): Macros {
  const kcalPerKg = Math.min(36, 30 + Math.max(0, sessionsPerWeek));
  const maintenance = weightKg * kcalPerKg;
  const factor = goal === "gain" ? 1.1 : goal === "loss" ? 0.85 : 1;
  const calories = Math.round((maintenance * factor) / 50) * 50;

  const proteinG = Math.round(weightKg * (goal === "maintain" ? 1.6 : 2));
  const fatG = Math.round(weightKg * (goal === "loss" ? 0.8 : 1));
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return { calories, proteinG, carbsG, fatG };
}
