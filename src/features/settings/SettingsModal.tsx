"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Feedback";
import { CUISINE_LABELS, type Cuisine } from "@/features/dishes/catalog";
import {
  ALL_CUISINES,
  saveCuisinePreference,
  useCuisinePreference,
} from "@/features/dishes/cuisinePreference";

/** Réglages de l'utilisateur. Pour l'instant : les cuisines des plats suggérés. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const saved = useCuisinePreference();
  // `null` tant que rien n'est touché : on affiche le réglage enregistré.
  const [draft, setDraft] = useState<Cuisine[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = draft ?? saved;

  function toggle(cuisine: Cuisine, checked: boolean) {
    setDraft(ALL_CUISINES.filter((c) => (c === cuisine ? checked : selected.includes(c))));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveCuisinePreference(selected);
      toast("Réglages enregistrés.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le réglage n'a pas pu être enregistré.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Réglages" onClose={onClose}>
      <fieldset className="field category-field">
        <legend className="field-label">Plats proposés</legend>
        <div className="category-options">
          {ALL_CUISINES.map((cuisine) => {
            const checked = selected.includes(cuisine);
            return (
              <label key={cuisine} className={`chip category-chip ${checked ? "chip-basil" : ""}`}>
                <input
                  type="checkbox"
                  className="visually-hidden"
                  checked={checked}
                  onChange={(e) => toggle(cuisine, e.target.checked)}
                />
                {checked ? <Icon name="check" size={14} /> : null}
                {CUISINE_LABELS[cuisine]}
              </label>
            );
          })}
        </div>
        <p className="field-hint">
          {selected.length === 0
            ? "Choisis au moins une cuisine."
            : "L'application te suggère des plats de ces cuisines : onglet Suggestions de l'écran Plats et choix d'un plat dans le Planning."}
        </p>
      </fieldset>

      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={() => void handleSave()} disabled={saving || selected.length === 0}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </Modal>
  );
}
