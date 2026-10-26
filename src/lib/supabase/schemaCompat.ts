import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Vrai quand une requête échoue parce qu'une colonne n'existe pas
 * (encore) en base : 42703 côté Postgres (lecture), PGRST204 côté
 * PostgREST (écriture d'une colonne inconnue).
 *
 * Sert aux colonnes ajoutées par `0017_dish_macros_and_targets.sql` :
 * le code peut être déployé avant que la migration soit appliquée, et
 * se rabat alors sur les colonnes d'avant (glucides/lipides absents)
 * au lieu de casser le Planning et la liste des plats. À retirer une
 * fois la migration appliquée partout.
 */
export function isMissingColumnError(error: PostgrestError | null | undefined): boolean {
  return !!error && (error.code === "42703" || error.code === "PGRST204");
}
