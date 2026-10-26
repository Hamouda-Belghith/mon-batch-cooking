"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { formatDateLong, formatQuantity } from "@/lib/date";
import type { MealSlot } from "@/lib/supabase/database.types";
import { MEAL_SLOT_LABELS } from "@/features/cycles/api";
import { compareToTargets, mealMacros, sumNutrition } from "@/features/planning/nutrition";
import { SPECIAL_MEAL_LABELS, type PlannedMeal } from "@/features/planning/types";
import { MACROS, type MacroInfo, type NullableMacros } from "./types";

function round(value: number, info: MacroInfo): string {
  const factor = 10 ** info.decimals;
  return formatQuantity(Math.round(value * factor) / factor);
}

/**
 * Détail des apports d'un jour : total de chaque apport face à son
 * objectif, et ce que chaque repas apporte. Compte les mêmes repas que
 * la ligne « Total » du planning (créneaux affichés).
 */
export function DayNutritionModal({
  dateISO,
  meals,
  hiddenSlots,
  targets,
  onEditTargets,
  onClose,
}: {
  dateISO: string;
  /** Repas des créneaux affichés, dans l'ordre des créneaux. */
  meals: PlannedMeal[];
  /** Créneaux masqués qui ont un repas ce jour-là (non comptés). */
  hiddenSlots: MealSlot[];
  targets: NullableMacros;
  onEditTargets: () => void;
  onClose: () => void;
}) {
  const day = sumNutrition(meals);
  const { status } = compareToTargets(day, targets);
  const hasTargets = MACROS.some(({ key }) => targets[key] !== null);
  const anyIncomplete = MACROS.some(({ key }) => day.incomplete[key]);

  return (
    <Modal title={formatDateLong(dateISO)} onClose={onClose}>
      <div className="stack">
        {status === "under" ? (
          <div className="notice notice-error day-status" role="status">
            <Icon name="target" size={18} />
            Objectif non atteint ce jour-là.
          </div>
        ) : status === "reached" ? (
          <div className="notice notice-info day-status" role="status">
            <Icon name="check" size={18} />
            Objectifs atteints.
          </div>
        ) : null}

        {meals.length === 0 ? (
          <p className="muted">Aucun repas prévu ce jour-là.</p>
        ) : (
          <ul className="macro-list">
            {MACROS.map((info) => {
              const total = day.totals[info.key];
              const target = targets[info.key];
              const missing = target !== null ? target - total : 0;
              const under = target !== null && missing > 0;
              const percent = target ? Math.min(100, (total / target) * 100) : 0;
              return (
                <li key={info.key} className={`macro-row ${under ? "macro-under" : ""}`}>
                  <div className="macro-row-head">
                    <span className="macro-label">{info.label}</span>
                    <span className="macro-value">
                      {round(total, info)}
                      {day.incomplete[info.key] ? "*" : ""}
                      {target !== null ? ` / ${round(target, info)}` : ""} {info.unit}
                    </span>
                  </div>
                  {target !== null ? (
                    <>
                      <div
                        className="progress"
                        role="progressbar"
                        aria-label={info.label}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(percent)}
                      >
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <span className="macro-status">
                        {under
                          ? `Il manque ${round(missing, info)} ${info.unit}`
                          : "Objectif atteint"}
                      </span>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {anyIncomplete ? (
          <p className="field-hint">
            * Certains repas n&apos;ont pas cette valeur (plat sans apports ou repas dehors) :
            le total est sous-estimé.
          </p>
        ) : null}
        {day.estimated ? (
          <p className="field-hint">
            Certaines valeurs sont estimées automatiquement d&apos;après le nom des plats.
            Ajuste-les dans l&apos;onglet Plats si besoin.
          </p>
        ) : null}

        {meals.length > 0 ? (
          <div className="panel-section">
            <h3 className="panel-heading">Repas comptés</h3>
            <ul className="list">
              {meals.map((meal) => {
                const values = mealMacros(meal);
                const facts = MACROS.filter(({ key }) => values[key] !== null)
                  .map((info) => `${round(values[info.key] as number, info)} ${info.shortUnit}`)
                  .join(" · ");
                return (
                  <li key={meal.id} className="list-row">
                    <span className="list-row-main">
                      <span className="list-row-sub">{MEAL_SLOT_LABELS[meal.mealSlot]}</span>
                      <span className="list-row-title">
                        {meal.special ? SPECIAL_MEAL_LABELS[meal.special] : meal.dishName}
                      </span>
                      <span className="list-row-sub">
                        {facts
                          ? `${meal.dishNutritionEstimated ? "≈ " : ""}${facts}`
                          : "Apports non renseignés"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {hiddenSlots.length > 0 ? (
          <p className="field-hint">
            Non compté{hiddenSlots.length > 1 ? "s" : ""} car masqué
            {hiddenSlots.length > 1 ? "s" : ""} dans l&apos;affichage :{" "}
            {hiddenSlots.map((slot) => MEAL_SLOT_LABELS[slot]).join(", ")}.
          </p>
        ) : null}

        <div className="modal-actions">
          <Button variant="secondary" onClick={onEditTargets}>
            <Icon name="target" size={18} />
            {hasTargets ? "Modifier mes objectifs" : "Définir mes objectifs"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
