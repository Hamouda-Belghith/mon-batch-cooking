"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import {
  addDays,
  formatQuantity,
  parseISODate,
  startOfWeek,
  toISODate,
  formatDateShort,
  formatDateLong,
  formatWeekRange,
} from "@/lib/date";
import type { MealSlot } from "@/lib/supabase/database.types";
import type { Dish } from "@/features/dishes/types";
import { DishFormModal } from "@/features/dishes/DishFormModal";
import {
  fetchDishesForCycles,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
} from "@/features/cycles/api";
import { fetchPlannedMeals } from "./api";
import {
  clearAllWeeks,
  clearWeek,
  ensurePatternApplied,
  findRepeatConflicts,
  getRepeatConfig,
  setMealWithScope,
  setRepeatInterval,
  type MealEditScope,
  type RepeatConfig,
  type RepeatInterval,
} from "./repeat";
import { sumNutrition } from "./nutrition";
import { applySavedWeek, deleteSavedWeek, fetchSavedWeeks, saveWeek } from "./savedWeeks";
import {
  SPECIAL_MEAL_LABELS,
  type PlannedMeal,
  type SavedWeek,
  type SpecialMeal,
} from "./types";

const WEEK_DAYS = 7;
const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Préférence d'affichage mémorisée sur cet appareil. Lue après le
 * premier rendu (et non dans `useState`) pour que le HTML pré-rendu
 * côté serveur reste identique à celui du premier rendu client.
 */
function usePersistedFlag(key: string, initial: boolean) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(stored === "1");
    } catch {
      // Stockage indisponible (navigation privée…) : on garde la valeur par défaut.
    }
  }, [key]);

  function update(next: boolean) {
    setValue(next);
    try {
      window.localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // Non bloquant : la préférence ne sera simplement pas mémorisée.
    }
  }

  return [value, update] as const;
}

/**
 * « – » quand la somme est nulle (aucun repas, ou plats sans valeur
 * renseignée) ; « * » quand la somme ignore certains plats.
 */
function formatTotal(
  value: number,
  incomplete: boolean,
  unit: string,
  decimals: number
): string {
  if (value === 0) return "–";
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${formatQuantity(rounded)} ${unit}${incomplete ? "*" : ""}`;
}

function DisplayToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`pill-checkbox ${checked ? "active" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function PlanningScreen() {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date())
  );

  const [meals, setMeals] = useState<PlannedMeal[] | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [repeat, setRepeat] = useState<RepeatConfig | null>(null);
  const [frequencyInput, setFrequencyInput] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showBreakfast, setShowBreakfast] = usePersistedFlag("planning-show-breakfast", true);
  const [showSnack, setShowSnack] = usePersistedFlag("planning-show-snack", false);
  const [showCalories, setShowCalories] = usePersistedFlag("planning-show-calories", false);
  const [showProtein, setShowProtein] = usePersistedFlag("planning-show-protein", false);

  const [editingCell, setEditingCell] = useState<{
    date: string;
    mealSlot: MealSlot;
  } | null>(null);

  // Recherche dans la liste des plats de la modale de choix, et création
  // d'un plat sans quitter le Planning (le plat créé remplit la case).
  const [dishSearch, setDishSearch] = useState("");
  const [creatingDish, setCreatingDish] = useState(false);

  const [pendingDishId, setPendingDishId] = useState<string | null | undefined>(
    undefined
  );

  const [nextWeekEmpty, setNextWeekEmpty] = useState<{
    startISO: string;
    endISO: string;
  } | null>(null);

  /** Modale des semaines enregistrées : enregistrer la semaine affichée, ou en choisir une pour la remplir. */
  const [savedWeeksModal, setSavedWeeksModal] = useState<"save" | "use" | null>(null);
  const [savedWeeks, setSavedWeeks] = useState<SavedWeek[] | null>(null);
  const [saveName, setSaveName] = useState("");

  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(addDays(weekStart, WEEK_DAYS - 1));

  async function loadMeals() {
    await ensurePatternApplied(weekStartISO, weekEndISO);
    const [mealRows, dishRows, repeatConfig] = await Promise.all([
      fetchPlannedMeals(weekStartISO, weekEndISO),
      fetchDishesForCycles(),
      getRepeatConfig(),
    ]);
    setMeals(mealRows);
    setDishes(dishRows);
    setRepeat(repeatConfig);
    if (repeatConfig.active && repeatConfig.intervalWeeks) {
      setFrequencyInput(repeatConfig.intervalWeeks);
    }
    void checkNextWeek();
  }

  /**
   * Vérifie si la semaine qui suit celle d'aujourd'hui (pas celle
   * affichée) a au moins un repas planifié, pour prévenir l'utilisateur
   * s'il ne l'a pas encore remplie.
   */
  async function checkNextWeek() {
    const nextStart = toISODate(addDays(startOfWeek(new Date()), WEEK_DAYS));
    const nextEnd = toISODate(addDays(parseISODate(nextStart), WEEK_DAYS - 1));
    try {
      const nextMeals = await fetchPlannedMeals(nextStart, nextEnd);
      setNextWeekEmpty(
        nextMeals.length === 0 ? { startISO: nextStart, endISO: nextEnd } : null
      );
    } catch {
      // Non bloquant : une notification manquée n'empêche pas d'utiliser le planning.
    }
  }

  useEffect(() => {
    void loadMeals().catch((err) => {
      setError(err instanceof Error ? err.message : "Chargement impossible");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO]);

  function previousWeek() {
    setWeekStart((prev) => addDays(prev, -7));
  }

  function nextWeek() {
    setWeekStart((prev) => addDays(prev, 7));
  }

  function currentWeek() {
    setWeekStart(startOfWeek(new Date()));
  }

  function jumpToDate(dateISO: string) {
    if (!dateISO) return;
    setWeekStart(startOfWeek(parseISODate(dateISO)));
  }

  async function handleClearWeek() {
    const ok = window.confirm(
      `Vider tous les repas de la semaine du ${formatDateLong(weekStartISO)} ? ` +
        "Cette action est irréversible."
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      await clearWeek(weekStartISO, weekEndISO);
      await loadMeals();
      setHint("Semaine vidée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de vider la semaine");
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    const ok = window.confirm(
      "Vider tout le planning (toutes les semaines, passées et futures) et désactiver " +
        "la répétition ? Cette action est irréversible."
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const config = await clearAllWeeks();
      setRepeat(config);
      await loadMeals();
      setHint("Planning entièrement vidé.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de vider le planning");
    } finally {
      setBusy(false);
    }
  }

  async function applyRepeat(interval: RepeatInterval | null, overwrite = false) {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const config = await setRepeatInterval(interval, weekStartISO, overwrite);
      setRepeat(config);
      await loadMeals();
      if (interval === null) {
        setHint("Répétition désactivée.");
      } else {
        setHint(
          interval === 1
            ? "Cette semaine se répète chaque semaine."
            : `Cette semaine se répète toutes les ${interval} semaines.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Répétition impossible");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisableRepeat() {
    await applyRepeat(null);
  }

  async function handleApplyFrequency() {
    const interval = Math.max(1, Math.floor(frequencyInput) || 1);

    // Recliquer sur la fréquence déjà active = remplacer le motif par la semaine affichée.
    if (repeat?.active && repeat.intervalWeeks === interval) {
      const ok = window.confirm(
        "Remplacer le modèle répété par la semaine affichée ?"
      );
      if (!ok) return;
    }

    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const conflicts = await findRepeatConflicts(weekStartISO, interval);
      if (conflicts.length > 0) {
        const preview = conflicts
          .slice(0, 3)
          .map((c) => `${formatDateLong(c.date)} (${MEAL_SLOT_LABELS[c.mealSlot]} — ${c.dishName})`)
          .join(", ");
        const more = conflicts.length > 3 ? `, et ${conflicts.length - 3} autre(s)` : "";
        const ok = window.confirm(
          `${conflicts.length} repas déjà planifié(s) ne correspond(ent) pas à cette fréquence : ${preview}${more}.\n\n` +
            "Choisis une autre fréquence pour les garder, ou continue pour les remplacer par le motif répété."
        );
        if (!ok) {
          setBusy(false);
          return;
        }
      }
      const config = await setRepeatInterval(interval, weekStartISO, conflicts.length > 0);
      setRepeat(config);
      await loadMeals();
      setHint(
        interval === 1
          ? "Cette semaine se répète chaque semaine."
          : `Cette semaine se répète toutes les ${interval} semaines.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Répétition impossible");
    } finally {
      setBusy(false);
    }
  }

  async function openSavedWeeks(mode: "save" | "use") {
    setError(null);
    setHint(null);
    setSavedWeeks(null);
    setSaveName(`Semaine du ${formatWeekRange(weekStartISO, weekEndISO)}`);
    setSavedWeeksModal(mode);
    try {
      setSavedWeeks(await fetchSavedWeeks());
    } catch (err) {
      setSavedWeeksModal(null);
      setError(err instanceof Error ? err.message : "Chargement impossible");
    }
  }

  async function handleSaveWeek(e: React.FormEvent) {
    e.preventDefault();
    const name = saveName.trim();
    if (!name) return;
    if (
      savedWeeks?.some((w) => w.name === name) &&
      !window.confirm(`Une semaine « ${name} » existe déjà. La remplacer ?`)
    ) {
      return;
    }
    setBusy(true);
    try {
      const { count } = await saveWeek(name, weekStartISO);
      setSavedWeeksModal(null);
      setHint(`Semaine enregistrée sous « ${name} » (${count} repas).`);
    } catch (err) {
      setSavedWeeksModal(null);
      setError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  async function handleApplySavedWeek(week: SavedWeek) {
    const ok = window.confirm(
      `Remplacer tous les repas de la semaine du ${formatWeekRange(weekStartISO, weekEndISO)} ` +
        `par « ${week.name} » ?`
    );
    if (!ok) return;
    setBusy(true);
    setSavedWeeksModal(null);
    try {
      await applySavedWeek(week, weekStartISO);
      await loadMeals();
      setHint(`Semaine remplie avec « ${week.name} ».`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de remplir la semaine");
      await loadMeals().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSavedWeek(week: SavedWeek) {
    if (!window.confirm(`Supprimer la semaine enregistrée « ${week.name} » ?`)) return;
    setBusy(true);
    try {
      await deleteSavedWeek(week.id);
      setSavedWeeks((prev) => prev?.filter((w) => w.id !== week.id) ?? null);
    } catch (err) {
      setSavedWeeksModal(null);
      setError(err instanceof Error ? err.message : "Suppression impossible");
    } finally {
      setBusy(false);
    }
  }

  function handleCellClick(date: string, mealSlot: MealSlot) {
    setPendingDishId(undefined);
    setDishSearch("");
    setCreatingDish(false);
    setEditingCell({ date, mealSlot });
  }

  function handlePickDish(dishId: string | null) {
    if (!editingCell) return;

    if (repeat?.active && editingMeal) {
      // La case a déjà un plat (issu ou non du modèle) : demande la
      // portée du changement dans la même modale. Une case vide se
      // remplit directement, sans cette question — elle ne peut pas
      // « appartenir » à un modèle avant d'avoir été remplie.
      setPendingDishId(dishId);
      return;
    }

    const { date, mealSlot } = editingCell;
    setEditingCell(null);
    void applyEdit(date, mealSlot, dishId, null);
  }

  /**
   * Un repas spécial (ex. « Manger dehors ») ne peut pas faire partie du
   * motif de répétition (voir `setMealWithScope`) : le choisir applique
   * toujours un override "cette semaine seulement", sans passer par la
   * question de portée même si un motif est actif.
   */
  function handlePickSpecial(special: SpecialMeal) {
    if (!editingCell) return;
    const { date, mealSlot } = editingCell;
    setEditingCell(null);
    void applyEdit(date, mealSlot, null, "this_week", special);
  }

  async function applyEdit(
    date: string,
    mealSlot: MealSlot,
    dishId: string | null,
    scope: MealEditScope | null,
    special: SpecialMeal | null = null
  ) {
    setBusy(true);
    setError(null);
    try {
      await setMealWithScope(date, mealSlot, dishId, scope, special);
      await loadMeals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  }

  async function handleDishCreated(dishId: string) {
    setCreatingDish(false);
    setDishes(await fetchDishesForCycles());
    handlePickDish(dishId);
  }

  async function handleScopeChoice(scope: MealEditScope) {
    if (!editingCell || pendingDishId === undefined) return;
    const { date, mealSlot } = editingCell;
    const dishId = pendingDishId;
    setEditingCell(null);
    setPendingDishId(undefined);
    await applyEdit(date, mealSlot, dishId, scope);
  }

  const editingMeal = editingCell
    ? (meals ?? []).find(
        (m) => m.date === editingCell.date && m.mealSlot === editingCell.mealSlot
      )
    : undefined;

  const choosingScope = editingCell !== null && pendingDishId !== undefined;

  const normalizedDishSearch = dishSearch.trim().toLowerCase();
  const filteredDishes =
    normalizedDishSearch === ""
      ? dishes
      : dishes.filter((dish) => dish.name.toLowerCase().includes(normalizedDishSearch));

  const visibleSlots = MEAL_SLOTS.filter(
    (slot) =>
      (slot !== "breakfast" || showBreakfast) && (slot !== "snack" || showSnack)
  );
  const totalsCount = Number(showCalories) + Number(showProtein);

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 style={{ margin: 0 }}>Planning</h1>
          <button
            type="button"
            className="screen-kicker screen-kicker-button"
            onClick={currentWeek}
            title="Revenir à la semaine d'aujourd'hui"
          >
            Semaine du {formatWeekRange(weekStartISO, weekEndISO)}
          </button>
        </div>
      </div>

      {nextWeekEmpty ? (
        <button
          type="button"
          className="week-warning-banner"
          onClick={() => jumpToDate(nextWeekEmpty.startISO)}
        >
          <span aria-hidden="true">⚠️</span>
          La semaine prochaine (du {formatWeekRange(nextWeekEmpty.startISO, nextWeekEmpty.endISO)}
          ) n&apos;a encore aucun repas prévu.
        </button>
      ) : null}

      <div className="card planning-toolbar">
        <div className="repeat-panel">
          <span className="repeat-panel-label">Répéter</span>
          <div className="repeat-frequency-row">
            <button
              type="button"
              className={`repeat-off-toggle ${!repeat?.active ? "active" : ""}`}
              disabled={busy || repeat === null || !repeat?.active}
              onClick={() => void handleDisableRepeat()}
            >
              Non
            </button>
            <div className="repeat-frequency-input">
              <span>Toutes les</span>
              <input
                type="number"
                min={1}
                step={1}
                className="input"
                value={frequencyInput}
                disabled={busy || repeat === null}
                onChange={(e) => setFrequencyInput(Number(e.target.value))}
                style={{ width: "3.5rem" }}
                aria-label="Nombre de semaines entre chaque répétition"
              />
              <span>semaine{frequencyInput > 1 ? "s" : ""}</span>
            </div>
            <Button
              size="sm"
              disabled={busy || repeat === null || frequencyInput < 1}
              onClick={() => void handleApplyFrequency()}
            >
              {repeat?.active ? "Mettre à jour" : "Activer"}
            </Button>
          </div>
          {repeat?.active ? (
            <p className="repeat-hint">
              Modèle basé sur la semaine du {formatDateLong(repeat.startDate ?? weekStartISO)},
              répété toutes les {repeat.intervalWeeks} semaine
              {(repeat.intervalWeeks ?? 1) > 1 ? "s" : ""}, visible sur les cases
              encadrées en vert. Modifier une case déjà remplie proposera de choisir : cette
              semaine seulement, ou le modèle pour toutes les semaines à venir. Remplir
              une case vide l&apos;ajoute simplement pour cette semaine-là.
            </p>
          ) : (
            <p className="repeat-hint">
              Remplis la semaine, choisis une fréquence, puis clique sur « Activer » pour la
              prolonger automatiquement.
            </p>
          )}
        </div>

        <div className="repeat-panel">
          <span className="repeat-panel-label">Semaines enregistrées</span>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <Button
              size="sm"
              disabled={busy || !meals || meals.length === 0}
              onClick={() => void openSavedWeeks("save")}
            >
              Enregistrer cette semaine
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void openSavedWeeks("use")}
            >
              Remplir depuis une semaine enregistrée
            </Button>
          </div>
        </div>

        <div className="repeat-panel">
          <span className="repeat-panel-label">Vider</span>
          <div className="row" style={{ gap: "0.5rem" }}>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => void handleClearWeek()}
            >
              Cette semaine
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => void handleClearAll()}
            >
              Toutes les semaines
            </Button>
          </div>
        </div>

        <div className="repeat-panel">
          <span className="repeat-panel-label">Affichage</span>
          <div className="row">
            <DisplayToggle
              label="Petit-déjeuner"
              checked={showBreakfast}
              onChange={setShowBreakfast}
            />
            <DisplayToggle
              label="Collation"
              checked={showSnack}
              onChange={setShowSnack}
            />
            <DisplayToggle
              label="Calories du jour"
              checked={showCalories}
              onChange={setShowCalories}
            />
            <DisplayToggle
              label="Protéines du jour"
              checked={showProtein}
              onChange={setShowProtein}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p style={{ color: "var(--danger)", fontWeight: 650 }}>{error}</p>
      ) : null}
      {hint && !error ? (
        <p style={{ color: "var(--accent-dark)", fontWeight: 600, margin: 0 }}>
          {hint}
        </p>
      ) : null}

      <label className="week-calendar-bar">
        <span aria-hidden="true">📅</span>
        <input
          type="date"
          className="week-calendar-input"
          value={weekStartISO}
          disabled={busy}
          onChange={(e) => jumpToDate(e.target.value)}
          aria-label="Aller directement à la semaine d'une date (pour sauter plusieurs semaines)"
          title="Aller directement à une semaine précise"
        />
      </label>

      <div className="week-grid-row">
        <button
          type="button"
          className="week-edge-nav"
          onClick={previousWeek}
          disabled={busy}
          aria-label="Semaine précédente"
        >
          ‹
        </button>

        {meals === null ? (
          <Spinner />
        ) : (
        <div className="week-grid">
          <div className="week-slot-col">
            <div className="week-day-head" aria-hidden="true">
              .
              <br />
              <span style={{ fontSize: "0.78rem", fontWeight: 500 }}>.</span>
            </div>
            {visibleSlots.map((slot) => (
              <div key={slot} className="week-slot-label">
                {MEAL_SLOT_LABELS[slot]}
              </div>
            ))}
            {totalsCount > 0 ? (
              <div className={`week-total-label week-total-${totalsCount}`}>Total</div>
            ) : null}
          </div>

          {Array.from({ length: WEEK_DAYS }, (_, i) => {
            const date = addDays(weekStart, i);
            const dateISO = toISODate(date);
            const isToday = dateISO === toISODate(new Date());
            const dayMeals = (meals ?? []).filter((m) => m.date === dateISO);
            const bySlot = new Map(dayMeals.map((m) => [m.mealSlot, m]));
            // Seuls les créneaux affichés comptent : le total doit
            // correspondre à ce que l'on voit dans la colonne.
            const totals = sumNutrition(
              dayMeals.filter((m) => visibleSlots.includes(m.mealSlot))
            );

            return (
              <div key={dateISO} className="week-day-col">
                <div className={`week-day-head ${isToday ? "today" : ""}`}>
                  {DAY_LABELS[i]}
                  <br />
                  <span style={{ fontSize: "0.78rem", fontWeight: 500 }}>
                    {formatDateShort(dateISO).split(" ")[1] ?? ""}
                  </span>
                </div>
                {visibleSlots.map((slot) => {
                  const meal = bySlot.get(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`meal-cell ${meal ? "" : "meal-cell-empty"} ${
                        meal?.mealCycleId ? "meal-cell-repeated" : ""
                      } ${meal?.special ? "meal-cell-special" : ""}`}
                      title={
                        meal?.mealCycleId
                          ? "Fait partie du modèle de répétition actif (barre « Répéter » en haut). Le modifier proposera de choisir : cette semaine seulement, ou le modèle pour toutes les semaines à venir."
                          : undefined
                      }
                      onClick={() => handleCellClick(dateISO, slot)}
                      disabled={busy}
                    >
                      {meal ? (
                        <span className="meal-cell-name">
                          {meal.special ? SPECIAL_MEAL_LABELS[meal.special] : meal.dishName}
                        </span>
                      ) : (
                        <span>+</span>
                      )}
                    </button>
                  );
                })}
                {totalsCount > 0 ? (
                  <div className={`week-total-cell week-total-${totalsCount}`}>
                    {showCalories ? (
                      <span
                        title={
                          totals.caloriesIncomplete
                            ? "Certains plats n'ont pas de calories renseignées (onglet Plats)."
                            : undefined
                        }
                      >
                        {formatTotal(totals.calories, totals.caloriesIncomplete, "kcal", 0)}
                      </span>
                    ) : null}
                    {showProtein ? (
                      <span
                        title={
                          totals.proteinIncomplete
                            ? "Certains plats n'ont pas de protéines renseignées (onglet Plats)."
                            : undefined
                        }
                      >
                        {formatTotal(totals.proteinG, totals.proteinIncomplete, "g prot.", 1)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        )}

        <button
          type="button"
          className="week-edge-nav"
          onClick={nextWeek}
          disabled={busy}
          aria-label="Semaine suivante"
        >
          ›
        </button>
      </div>

      {savedWeeksModal ? (
        <Modal
          title={
            savedWeeksModal === "save" ? "Enregistrer cette semaine" : "Semaines enregistrées"
          }
          onClose={() => setSavedWeeksModal(null)}
        >
          {savedWeeks === null ? (
            <Spinner />
          ) : savedWeeksModal === "save" ? (
            <form className="stack" onSubmit={(e) => void handleSaveWeek(e)}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="saved-week-name">Nom</label>
                <input
                  id="saved-week-name"
                  className="input"
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
                Les {meals?.length ?? 0} repas de la semaine affichée (plats et jours) pourront
                ensuite remplir n&apos;importe quelle semaine du planning.
              </p>
              <Button type="submit" disabled={busy || !saveName.trim()}>
                Enregistrer
              </Button>
            </form>
          ) : savedWeeks.length === 0 ? (
            <p className="empty" style={{ padding: "1rem" }}>
              Aucune semaine enregistrée. Remplis une semaine puis clique sur « Enregistrer cette
              semaine ».
            </p>
          ) : (
            <div className="stack" style={{ gap: "0.55rem" }}>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
                Remplace tous les repas de la semaine du {formatWeekRange(weekStartISO, weekEndISO)}.
              </p>
              {savedWeeks.map((week) => (
                <div key={week.id} className="shop-item">
                  <span className="shop-name">
                    {week.name}
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem", fontWeight: 500 }}>
                      {week.entries.length} repas
                    </span>
                  </span>
                  <Button
                    size="sm"
                    disabled={busy || week.entries.length === 0}
                    onClick={() => void handleApplySavedWeek(week)}
                  >
                    Utiliser
                  </Button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label={`Supprimer ${week.name}`}
                    disabled={busy}
                    onClick={() => void handleDeleteSavedWeek(week)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      ) : null}

      {editingCell && creatingDish ? (
        <DishFormModal
          dish={null}
          initialName={dishSearch.trim()}
          onClose={() => setCreatingDish(false)}
          onSaved={handleDishCreated}
        />
      ) : null}

      {editingCell && !creatingDish ? (
        <Modal
          title={
            choosingScope
              ? "Appliquer ce changement"
              : `${formatDateLong(editingCell.date)} — ${MEAL_SLOT_LABELS[editingCell.mealSlot]}`
          }
          onClose={() => {
            setEditingCell(null);
            setPendingDishId(undefined);
          }}
        >
          {choosingScope ? (
            <div className="stack">
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Une répétition est active. Ce changement concerne…
              </p>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void handleScopeChoice("this_week")}
              >
                Cette semaine seulement
              </Button>
              <Button
                disabled={busy}
                onClick={() => void handleScopeChoice("all_future")}
              >
                Le modèle (toutes les semaines à venir)
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPendingDishId(undefined)}
              >
                Retour
              </Button>
            </div>
          ) : (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <div className="row" style={{ gap: "0.5rem", flexWrap: "nowrap" }}>
                <input
                  type="search"
                  className="input"
                  placeholder="Rechercher un plat…"
                  aria-label="Rechercher un plat"
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Button size="sm" onClick={() => setCreatingDish(true)} style={{ whiteSpace: "nowrap" }}>
                  + Nouveau plat
                </Button>
              </div>
              <div className="dish-pick-list">
                <button
                  type="button"
                  className="dish-pick-item"
                  onClick={() => handlePickDish(null)}
                  disabled={!editingMeal}
                  style={{ color: "var(--danger)" }}
                >
                  Retirer le repas
                </button>
                <button
                  type="button"
                  className="dish-pick-item dish-pick-special"
                  onClick={() => handlePickSpecial("eating_out")}
                >
                  <span aria-hidden="true">🍽️</span>
                  {SPECIAL_MEAL_LABELS.eating_out}
                </button>
                {filteredDishes.map((dish) => (
                  <button
                    key={dish.id}
                    type="button"
                    className="dish-pick-item"
                    onClick={() => handlePickDish(dish.id)}
                  >
                    {dish.name}
                  </button>
                ))}
                {dishes.length === 0 ? (
                  <p className="empty" style={{ padding: "1rem" }}>
                    Aucun plat. Crée-en un avec « + Nouveau plat ».
                  </p>
                ) : filteredDishes.length === 0 ? (
                  <p className="empty" style={{ padding: "1rem" }}>
                    Aucun plat ne correspond à « {dishSearch.trim()} ». « + Nouveau plat » le crée
                    avec ce nom.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
