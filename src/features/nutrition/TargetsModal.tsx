"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, SelectField } from "@/components/ui/Field";
import { MACROS, type MacroKey, type NullableMacros } from "./types";
import {
  TARGET_GOAL_LABELS,
  saveNutritionTargets,
  suggestTargets,
  type TargetGoal,
} from "./targets";

function toInputs(values: NullableMacros): Record<MacroKey, string> {
  return {
    calories: values.calories == null ? "" : String(values.calories),
    proteinG: values.proteinG == null ? "" : String(values.proteinG),
    carbsG: values.carbsG == null ? "" : String(values.carbsG),
    fatG: values.fatG == null ? "" : String(values.fatG),
  };
}

/** Vide = pas d'objectif ; une valeur invalide ou ≤ 0 aussi. */
function parseTarget(value: string, decimals: number): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * Objectifs nutritionnels du jour (propres au compte), avec un calcul
 * de départ à partir du poids, des séances et de l'objectif.
 */
export function TargetsModal({
  targets,
  onClose,
  onSaved,
}: {
  targets: NullableMacros;
  onClose: () => void;
  onSaved: (targets: NullableMacros) => void;
}) {
  const [inputs, setInputs] = useState(() => toInputs(targets));
  const [weight, setWeight] = useState("");
  const [sessions, setSessions] = useState("3");
  const [goal, setGoal] = useState<TargetGoal>("gain");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightKg = Number(weight.replace(",", "."));
  const canSuggest = Number.isFinite(weightKg) && weightKg >= 30 && weightKg <= 250;

  function applySuggestion() {
    if (!canSuggest) return;
    const sessionsPerWeek = Math.max(0, Math.min(14, Math.round(Number(sessions) || 0)));
    setInputs(toInputs(suggestTargets(weightKg, sessionsPerWeek, goal)));
  }

  async function save(values: NullableMacros) {
    setSaving(true);
    setError(null);
    try {
      await saveNutritionTargets(values);
      onSaved(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible. Réessaie.");
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values = Object.fromEntries(
      MACROS.map(({ key, decimals }) => [key, parseTarget(inputs[key], decimals)])
    ) as NullableMacros;
    void save(values);
  }

  const hasTargets = MACROS.some(({ key }) => targets[key] !== null);

  return (
    <Modal title="Objectifs du jour" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="panel-section">
          <p className="field-hint">
            Ce que tu vises chaque jour. Le planning signale les jours en dessous. Laisse un
            champ vide pour ne pas suivre cet apport.
          </p>
          <div className="macro-grid">
            {MACROS.map((info) => (
              <Field
                key={info.key}
                label={`${info.label} (${info.unit})`}
                name={`target-${info.key}`}
                type="number"
                inputMode="decimal"
                min="0"
                step={info.decimals === 0 ? "10" : "1"}
                value={inputs[info.key]}
                onChange={(e) => setInputs({ ...inputs, [info.key]: e.target.value })}
                placeholder="Aucun"
              />
            ))}
          </div>
        </div>

        <div className="panel-section">
          <h3 className="panel-heading">Calculer à partir de mon profil</h3>
          <div className="form-grid-2">
            <Field
              label="Poids (kg)"
              name="target-weight"
              type="number"
              inputMode="decimal"
              min="30"
              max="250"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Ex : 79"
            />
            <Field
              label="Séances de sport par semaine"
              name="target-sessions"
              type="number"
              inputMode="numeric"
              min="0"
              max="14"
              step="1"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
            />
          </div>
          <SelectField
            label="Objectif"
            name="target-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value as TargetGoal)}
          >
            {(Object.keys(TARGET_GOAL_LABELS) as TargetGoal[]).map((key) => (
              <option key={key} value={key}>
                {TARGET_GOAL_LABELS[key]}
              </option>
            ))}
          </SelectField>
          <div>
            <Button variant="secondary" size="sm" onClick={applySuggestion} disabled={!canSuggest}>
              Calculer et remplir
            </Button>
          </div>
          <p className="field-hint">
            Point de départ simple (sans taille ni âge) : protéines 2 g/kg en prise de muscle,
            lipides 1 g/kg, glucides pour le reste, léger surplus de calories. Ajuste selon
            l&apos;évolution de ton poids sur quelques semaines.
          </p>
        </div>

        {error ? (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="modal-actions">
          {hasTargets ? (
            <Button
              variant="ghost"
              className="btn-text-danger push-left"
              disabled={saving}
              onClick={() =>
                void save({ calories: null, proteinG: null, carbsG: null, fatG: null })
              }
            >
              Ne plus suivre
            </Button>
          ) : null}
          <Button variant="ghost" className="cancel-action" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
