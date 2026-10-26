"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { MealSlot } from "@/lib/supabase/database.types";
import type { MealCycleEntry } from "@/features/cycles/types";
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from "@/features/cycles/api";
import type { Dish } from "@/features/dishes/types";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Créneaux affichés : ceux du Planning sur cet appareil, plus ceux déjà remplis. */
function readShownSlots(entries: MealCycleEntry[]): MealSlot[] {
  const pref = (key: string, fallback: boolean) => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : stored === "1";
    } catch {
      return fallback;
    }
  };
  const used = new Set(entries.map((e) => e.mealSlot));
  return MEAL_SLOTS.filter((slot) => {
    if (used.has(slot)) return true;
    if (slot === "breakfast") return pref("planning-show-breakfast", true);
    if (slot === "snack") return pref("planning-show-snack", false);
    return true;
  });
}

/**
 * Plats d'une semaine du cycle, jour par jour, créneau par créneau.
 * Sert à créer une nouvelle semaine ou à modifier une semaine du cycle
 * sans passer par la vue Semaines.
 */
export function CycleWeekEditor({
  title,
  note,
  initialEntries,
  dishes,
  saving,
  onSave,
  onClose,
}: {
  title: string;
  /** Rappel de quand s'appliquent les changements. */
  note: string;
  initialEntries: MealCycleEntry[];
  dishes: Dish[];
  saving: boolean;
  onSave: (entries: MealCycleEntry[]) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Map<string, string>>(
    () => new Map(initialEntries.map((e) => [`${e.dayOffset}|${e.mealSlot}`, e.dishId]))
  );
  const [slots, setSlots] = useState<MealSlot[]>(["lunch", "dinner"]);

  useEffect(() => {
    setSlots(readShownSlots(initialEntries));
  }, [initialEntries]);

  const dishById = new Map(dishes.map((d) => [d.id, d]));

  function set(day: number, slot: MealSlot, dishId: string) {
    setValues((prev) => {
      const next = new Map(prev);
      if (dishId) next.set(`${day}|${slot}`, dishId);
      else next.delete(`${day}|${slot}`);
      return next;
    });
  }

  const entries: MealCycleEntry[] = [...values].map(([key, dishId]) => {
    const [day, slot] = key.split("|");
    return { dayOffset: Number(day), mealSlot: slot as MealSlot, dishId };
  });

  return (
    <Modal title={title} onClose={onClose} size="wide">
      <div className="cycle-editor">
        <p className="field-hint">{note}</p>
        {DAY_LABELS.map((dayLabel, day) => (
          <fieldset key={dayLabel} className="cycle-editor-day">
            <legend className="cycle-editor-day-title">{dayLabel}</legend>
            {slots.map((slot) => {
              const current = values.get(`${day}|${slot}`) ?? "";
              // Seuls les plats de la catégorie du repas, plus celui déjà choisi.
              const options = dishes.filter(
                (d) => d.mealSlots.includes(slot) || d.id === current
              );
              const id = `cycle-${day}-${slot}`;
              return (
                <div key={slot} className="cycle-editor-row">
                  <label htmlFor={id}>{MEAL_SLOT_LABELS[slot]}</label>
                  <select
                    id={id}
                    className="select"
                    value={current}
                    onChange={(e) => set(day, slot, e.target.value)}
                  >
                    <option value="">—</option>
                    {current && !dishById.has(current) ? (
                      <option value={current}>Plat supprimé</option>
                    ) : null}
                    {options.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </fieldset>
        ))}
        <div className="modal-actions modal-actions-sticky">
          <span className="field-hint push-left">
            {entries.length} repas
          </span>
          <Button variant="ghost" className="cancel-action" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onSave(entries)} disabled={saving || entries.length === 0}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
