import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { isDemoMode, renameDemoIngredient } from "@/lib/localDemo";

/**
 * Renomme un ingrédient partout : dans tous les plats et dans la liste de
 * courses. Si l'utilisateur a déjà un ingrédient de ce nom, les deux sont
 * fusionnés (fonction SQL `rename_ingredient`, une seule transaction).
 * Lève une `Error` lisible en cas d'échec.
 */
export async function renameIngredient(ingredientId: string, newName: string): Promise<void> {
  if (isDemoMode()) {
    await renameDemoIngredient(ingredientId, newName);
    return;
  }

  const supabase = getSupabase();
  if (!supabase) throw new Error("Base de données non configurée.");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Pas de connexion internet : vérifie ta connexion puis réessaie.");
  }

  const { error } = (await supabase.rpc(
    "rename_ingredient" as never,
    { p_ingredient_id: ingredientId, p_new_name: newName } as never
  )) as { error: PostgrestError | null };

  if (error) {
    console.warn("Impossible de renommer l'ingrédient", error);
    throw new Error(`Impossible de renommer l'ingrédient en « ${newName} » (détail : ${error.message}).`);
  }
}
