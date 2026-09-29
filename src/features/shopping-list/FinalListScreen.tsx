"use client";

import { useEffect } from "react";
import { FinalListSection } from "./FinalListSection";
import { refreshShoppingList } from "./useShoppingList";
import { flushPendingMutations } from "./syncQueue";

/**
 * Écran dédié à la liste « À acheter » (même contenu que la section du
 * bas de l'écran Courses), accessible directement depuis la navigation
 * pour la consulter/cocher sans passer par les onglets de génération.
 */
export function FinalListScreen() {
  useEffect(() => {
    void (async () => {
      // Rejoue d'abord les modifications hors-ligne, sinon le
      // rafraîchissement les masquerait jusqu'à la prochaine synchro.
      await flushPendingMutations();
      await refreshShoppingList();
    })();
  }, []);

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 style={{ margin: 0 }}>À acheter</h1>
        </div>
      </div>
      <FinalListSection />
    </div>
  );
}
