"use client";

import { useEffect } from "react";
import { FinalListSection } from "./FinalListSection";
import { refreshShoppingList } from "./useShoppingList";
import { flushPendingMutations } from "./syncQueue";

/**
 * Écran de la liste « À acheter » (onglet de navigation `/a-acheter`),
 * seul endroit où elle est affichée — elle n'apparaît plus en bas de
 * l'écran Courses.
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
      <header className="page-header">
        <div>
          <h1 className="page-title">À acheter</h1>
          <p className="page-sub">Disponible même sans réseau.</p>
        </div>
      </header>
      <FinalListSection />
    </div>
  );
}
