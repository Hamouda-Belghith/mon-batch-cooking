"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import {
  addDays,
  formatQuantity,
  parseISODate,
  startOfWeek,
  toISODate,
  formatDateLong,
  formatWeekRange,
} from "@/lib/date";
import type { MealSlot } from "@/lib/supabase/database.types";
import { DISH_CATEGORY_LABELS, type Dish } from "@/features/dishes/types";
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
const DAY_LABELS_LONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Panneau d'options ouvert depuis la barre d'outils du planning. */
type Panel = "repeat" | "saved" | "display" | "clear";

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

function formatInterval(weeks: number): string {
  return weeks === 1 ? "chaque semaine" : `toutes les ${weeks} semaines`;
}

function DisplayToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="switch-row">
      <span>
        <span className="switch-label">{label}</span>
        {description ? <span className="switch-desc">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function PlanningScreen() {
  const confirm = useConfirm();
  const toast = useToast();

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date())
  );

  const [meals, setMeals] = useState<PlannedMeal[] | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [repeat, setRepeat] = useState<RepeatConfig | null>(null);
  const [frequencyInput, setFrequencyInput] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

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

  /** Semaines enregistrées, chargées à l'ouverture de leur panneau. */
  const [savedWeeks, setSavedWeeks] = useState<SavedWeek[] | null>(null);
  const [saveName, setSaveName] = useState("");

  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(addDays(weekStart, WEEK_DAYS - 1));
  const todayISO = toISODate(new Date());
  const isCurrentWeek = weekStartISO === toISODate(startOfWeek(new Date()));

  function reportError(err: unknown, fallback: string) {
    toast(err instanceof Error ? err.message : fallback, "error");
  }

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
    setLoadError(null);
    void loadMeals().catch((err) => {
      setLoadError(err instanceof Error ? err.message : "Chargement impossible");
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

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  async function handleClearWeek() {
    setPanel(null);
    setBusy(true);
    try {
      await clearWeek(weekStartISO, weekEndISO);
      await loadMeals();
      toast("Semaine vidée.");
    } catch (err) {
      reportError(err, "Impossible de vider la semaine");
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    setPanel(null);
    setBusy(true);
    try {
      const config = await clearAllWeeks();
      setRepeat(config);
      await loadMeals();
      toast("Planning entièrement vidé.");
    } catch (err) {
      reportError(err, "Impossible de vider le planning");
    } finally {
      setBusy(false);
    }
  }

  async function applyRepeat(interval: RepeatInterval | null, overwrite = false) {
    setBusy(true);
    try {
      const config = await setRepeatInterval(interval, weekStartISO, overwrite);
      setRepeat(config);
      await loadMeals();
      toast(
        interval === null
          ? "Répétition désactivée."
          : `Cette semaine se répète ${formatInterval(interval)}.`
      );
    } catch (err) {
      reportError(err, "Répétition impossible");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisableRepeat() {
    setPanel(null);
    await applyRepeat(null);
  }

  async function handleApplyFrequency() {
    const interval = Math.max(1, Math.floor(frequencyInput) || 1);
    setPanel(null);

    // Recliquer sur la fréquence déjà active = remplacer le motif par la semaine affichée.
    if (repeat?.active && repeat.intervalWeeks === interval) {
      const ok = await confirm({
        title: "Remplacer le modèle répété ?",
        message: `Les repas de la semaine du ${formatWeekRange(weekStartISO, weekEndISO)} deviendront le nouveau modèle.`,
        confirmLabel: "Remplacer le modèle",
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      const conflicts = await findRepeatConflicts(weekStartISO, interval);
      if (conflicts.length > 0) {
        setBusy(false);
        const ok = await confirm({
          title: `${conflicts.length} repas déjà planifié${conflicts.length > 1 ? "s" : ""} en conflit`,
          message: (
            <>
              <p>Ces repas ne correspondent pas à cette fréquence :</p>
              <ul className="confirm-list">
                {conflicts.slice(0, 4).map((c) => (
                  <li key={`${c.date}-${c.mealSlot}`}>
                    {formatDateLong(c.date)}, {MEAL_SLOT_LABELS[c.mealSlot].toLowerCase()} :{" "}
                    {c.dishName}
                  </li>
                ))}
                {conflicts.length > 4 ? <li>et {conflicts.length - 4} autre(s)</li> : null}
              </ul>
              <p>Choisis une autre fréquence pour les garder, ou remplace-les par le modèle.</p>
            </>
          ),
          confirmLabel: "Remplacer ces repas",
          cancelLabel: "Garder mes repas",
          danger: true,
        });
        if (!ok) return;
        setBusy(true);
      }
      const config = await setRepeatInterval(interval, weekStartISO, conflicts.length > 0);
      setRepeat(config);
      await loadMeals();
      toast(`Cette semaine se répète ${formatInterval(interval)}.`);
    } catch (err) {
      reportError(err, "Répétition impossible");
    } finally {
      setBusy(false);
    }
  }

  async function openSavedWeeks() {
    setSavedWeeks(null);
    setSaveName(`Semaine du ${formatWeekRange(weekStartISO, weekEndISO)}`);
    setPanel("saved");
    try {
      setSavedWeeks(await fetchSavedWeeks());
    } catch (err) {
      setPanel(null);
      reportError(err, "Chargement impossible");
    }
  }

  async function handleSaveWeek(e: React.FormEvent) {
    e.preventDefault();
    const name = saveName.trim();
    if (!name) return;
    if (savedWeeks?.some((w) => w.name === name)) {
      const ok = await confirm({
        title: "Remplacer la semaine enregistrée ?",
        message: `Une semaine « ${name} » existe déjà.`,
        confirmLabel: "Remplacer",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { count } = await saveWeek(name, weekStartISO);
      setPanel(null);
      toast(`Semaine enregistrée sous « ${name} » (${count} repas).`);
    } catch (err) {
      setPanel(null);
      reportError(err, "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  async function handleApplySavedWeek(week: SavedWeek) {
    const ok = await confirm({
      title: `Remplir avec « ${week.name} » ?`,
      message: `Tous les repas de la semaine du ${formatWeekRange(weekStartISO, weekEndISO)} seront remplacés.`,
      confirmLabel: "Remplir la semaine",
    });
    if (!ok) return;
    setPanel(null);
    setBusy(true);
    try {
      await applySavedWeek(week, weekStartISO);
      await loadMeals();
      toast(`Semaine remplie avec « ${week.name} ».`);
    } catch (err) {
      reportError(err, "Impossible de remplir la semaine");
      await loadMeals().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSavedWeek(week: SavedWeek) {
    setBusy(true);
    try {
      await deleteSavedWeek(week.id);
      setSavedWeeks((prev) => prev?.filter((w) => w.id !== week.id) ?? null);
      toast(`« ${week.name} » supprimée.`);
    } catch (err) {
      setPanel(null);
      reportError(err, "Suppression impossible");
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
    try {
      await setMealWithScope(date, mealSlot, dishId, scope, special);
      await loadMeals();
    } catch (err) {
      reportError(err, "Action impossible");
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

  // Seuls les plats de la catégorie du repas sont proposés. Le plat déjà
  // posé dans la case reste visible même s'il n'en fait pas (ou plus) partie.
  const slotDishes = editingCell
    ? dishes.filter(
        (dish) =>
          dish.mealSlots.includes(editingCell.mealSlot) || dish.id === editingMeal?.dishId
      )
    : dishes;
  const normalizedDishSearch = dishSearch.trim().toLowerCase();
  const filteredDishes =
    normalizedDishSearch === ""
      ? slotDishes
      : slotDishes.filter((dish) => dish.name.toLowerCase().includes(normalizedDishSearch));

  const visibleSlots = MEAL_SLOTS.filter(
    (slot) =>
      (slot !== "breakfast" || showBreakfast) && (slot !== "snack" || showSnack)
  );
  const totalsCount = Number(showCalories) + Number(showProtein);

  const showNextWeekBanner =
    nextWeekEmpty !== null && weekStartISO !== nextWeekEmpty.startISO;

  return (
    <div className="screen">
      {showNextWeekBanner && nextWeekEmpty ? (
        <div className="notice notice-warn">
          <span>
            Rien n&apos;est prévu la semaine prochaine, du{" "}
            {formatWeekRange(nextWeekEmpty.startISO, nextWeekEmpty.endISO)}.
          </span>
          <button
            type="button"
            className="notice-action"
            onClick={() => jumpToDate(nextWeekEmpty.startISO)}
          >
            La planifier
          </button>
        </div>
      ) : null}

      <header className="week-header">
        <div className="week-title-row">
          <h1 className="week-title" aria-live="polite">
            {formatWeekRange(weekStartISO, weekEndISO)}
          </h1>
          <button
            type="button"
            className="btn btn-icon week-nav"
            onClick={previousWeek}
            disabled={busy}
            aria-label="Semaine précédente"
          >
            <Icon name="chevronLeft" />
          </button>
          <button
            type="button"
            className="btn btn-icon week-nav"
            onClick={nextWeek}
            disabled={busy}
            aria-label="Semaine suivante"
          >
            <Icon name="chevronRight" />
          </button>
        </div>
        <div className="week-meta">
          {isCurrentWeek ? (
            <span className="chip chip-today">Cette semaine</span>
          ) : (
            <button type="button" className="chip chip-button" onClick={currentWeek}>
              Revenir à cette semaine
            </button>
          )}
          <button type="button" className="chip chip-button" onClick={openDatePicker}>
            <Icon name="calendar" size={16} />
            Aller à une date
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="visually-hidden"
            tabIndex={-1}
            value={weekStartISO}
            onChange={(e) => jumpToDate(e.target.value)}
            aria-hidden="true"
          />
          {repeat?.active && repeat.intervalWeeks ? (
            <button
              type="button"
              className="chip chip-basil chip-button"
              onClick={() => setPanel("repeat")}
            >
              <Icon name="repeat" size={16} />
              Répétée {formatInterval(repeat.intervalWeeks)}
            </button>
          ) : null}
        </div>
      </header>

      <div className="toolbar" role="toolbar" aria-label="Options du planning">
        <button
          type="button"
          className="tool"
          disabled={busy || repeat === null}
          onClick={() => setPanel("repeat")}
        >
          <Icon name="repeat" size={18} />
          Répétition
        </button>
        <button
          type="button"
          className="tool"
          disabled={busy}
          onClick={() => void openSavedWeeks()}
        >
          <Icon name="bookmark" size={18} />
          Semaines enregistrées
        </button>
        <button type="button" className="tool" onClick={() => setPanel("display")}>
          <Icon name="sliders" size={18} />
          Affichage
        </button>
        <button
          type="button"
          className="tool tool-danger"
          disabled={busy}
          onClick={() => setPanel("clear")}
        >
          <Icon name="trash" size={18} />
          Vider
        </button>
      </div>

      {loadError ? (
        <div className="notice notice-error" role="alert">
          {loadError}
        </div>
      ) : meals === null ? (
        <Spinner />
      ) : (
        <div
          className="week-grid"
          style={{ "--slots": visibleSlots.length } as React.CSSProperties}
          aria-busy={busy}
        >
          <div className="week-slot-col" aria-hidden="true">
            <div className="week-day-head" />
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
            const isToday = dateISO === todayISO;
            const dayMeals = (meals ?? []).filter((m) => m.date === dateISO);
            const bySlot = new Map(dayMeals.map((m) => [m.mealSlot, m]));
            // Seuls les créneaux affichés comptent : le total doit
            // correspondre à ce que l'on voit dans la colonne.
            const totals = sumNutrition(
              dayMeals.filter((m) => visibleSlots.includes(m.mealSlot))
            );

            return (
              <section
                key={dateISO}
                className={`week-day-col ${isToday ? "today" : ""}`}
                aria-label={formatDateLong(dateISO)}
              >
                <div className="week-day-head">
                  <span className="day-name">{DAY_LABELS[i]}</span>
                  <span className="day-name-long">{DAY_LABELS_LONG[i]}</span>
                  <span className="day-num">{date.getDate()}</span>
                  {isToday ? <span className="day-today">Aujourd&apos;hui</span> : null}
                </div>
                {visibleSlots.map((slot) => {
                  const meal = bySlot.get(slot);
                  const label = meal
                    ? meal.special
                      ? SPECIAL_MEAL_LABELS[meal.special]
                      : meal.dishName
                    : null;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`meal-cell ${meal ? "" : "meal-cell-empty"} ${
                        meal?.mealCycleId ? "meal-cell-repeated" : ""
                      } ${meal?.special ? "meal-cell-special" : ""}`}
                      title={
                        meal?.mealCycleId
                          ? "Fait partie du modèle répété. Le modifier proposera : cette semaine seulement, ou toutes les semaines à venir."
                          : undefined
                      }
                      aria-label={`${MEAL_SLOT_LABELS[slot]}, ${formatDateLong(dateISO)} : ${
                        label ?? "vide, ajouter un repas"
                      }`}
                      onClick={() => handleCellClick(dateISO, slot)}
                      disabled={busy}
                    >
                      <span className="meal-cell-slot">{MEAL_SLOT_LABELS[slot]}</span>
                      {label ? (
                        <span className="meal-cell-name">{label}</span>
                      ) : (
                        <span className="meal-cell-add">
                          <Icon name="plus" size={18} />
                        </span>
                      )}
                      {meal?.mealCycleId ? (
                        <span className="meal-cell-flag" aria-hidden="true">
                          <Icon name="repeat" size={12} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {totalsCount > 0 ? (
                  <div className={`week-total-cell week-total-${totalsCount}`}>
                    <span className="week-total-inline-label">Total</span>
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
              </section>
            );
          })}
        </div>
      )}

      {repeat?.active ? (
        <p className="legend">
          <span className="legend-swatch" aria-hidden="true" /> Repas du modèle répété
        </p>
      ) : null}

      {panel === "repeat" ? (
        <Modal title="Répéter cette semaine" onClose={() => setPanel(null)}>
          <div className="stack">
            {repeat?.active ? (
              <p className="muted">
                Le modèle est la semaine du {formatDateLong(repeat.startDate ?? weekStartISO)},
                répétée {formatInterval(repeat.intervalWeeks ?? 1)}. Ses repas sont surlignés en
                vert. Quand tu modifies l&apos;un d&apos;eux, tu choisis : cette semaine
                seulement, ou toutes les semaines à venir.
              </p>
            ) : (
              <p className="muted">
                Remplis la semaine affichée, puis choisis une fréquence : ses repas
                s&apos;ajouteront automatiquement aux semaines suivantes.
              </p>
            )}
            <div className="inline-field">
              <label htmlFor="repeat-frequency">Toutes les</label>
              <input
                id="repeat-frequency"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                className="input input-narrow"
                value={frequencyInput}
                disabled={busy}
                onChange={(e) => setFrequencyInput(Number(e.target.value))}
              />
              <span>semaine{frequencyInput > 1 ? "s" : ""}</span>
            </div>
            <div className="modal-actions">
              {repeat?.active ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void handleDisableRepeat()}
                >
                  Arrêter la répétition
                </Button>
              ) : null}
              <Button
                disabled={busy || frequencyInput < 1}
                onClick={() => void handleApplyFrequency()}
              >
                {repeat?.active ? "Mettre à jour" : "Répéter cette semaine"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {panel === "saved" ? (
        <Modal title="Semaines enregistrées" onClose={() => setPanel(null)}>
          {savedWeeks === null ? (
            <Spinner />
          ) : (
            <div className="stack">
              <form className="panel-section" onSubmit={(e) => void handleSaveWeek(e)}>
                <h3 className="panel-heading">Enregistrer la semaine affichée</h3>
                {meals && meals.length > 0 ? (
                  <>
                    <div className="input-with-button">
                      <input
                        id="saved-week-name"
                        className="input"
                        aria-label="Nom de la semaine"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                      />
                      <Button type="submit" disabled={busy || !saveName.trim()}>
                        Enregistrer
                      </Button>
                    </div>
                    <p className="field-hint">
                      Ses {meals.length} repas pourront remplir n&apos;importe quelle autre
                      semaine.
                    </p>
                  </>
                ) : (
                  <p className="field-hint">Cette semaine est vide : rien à enregistrer.</p>
                )}
              </form>

              <div className="panel-section">
                <h3 className="panel-heading">Remplir cette semaine avec…</h3>
                {savedWeeks.length === 0 ? (
                  <p className="field-hint">
                    Aucune semaine enregistrée pour l&apos;instant.
                  </p>
                ) : (
                  <ul className="list">
                    {savedWeeks.map((week) => (
                      <li key={week.id} className="list-row">
                        <span className="list-row-main">
                          <span className="list-row-title">{week.name}</span>
                          <span className="list-row-sub">{week.entries.length} repas</span>
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
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
                          <Icon name="trash" size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Modal>
      ) : null}

      {panel === "display" ? (
        <Modal title="Affichage" onClose={() => setPanel(null)}>
          <div className="switch-list">
            <DisplayToggle
              label="Petit-déjeuner"
              checked={showBreakfast}
              onChange={setShowBreakfast}
            />
            <DisplayToggle label="Collation" checked={showSnack} onChange={setShowSnack} />
            <DisplayToggle
              label="Calories du jour"
              description="Somme des repas affichés, pour une portion."
              checked={showCalories}
              onChange={setShowCalories}
            />
            <DisplayToggle
              label="Protéines du jour"
              description="Somme des repas affichés, pour une portion."
              checked={showProtein}
              onChange={setShowProtein}
            />
          </div>
          <p className="field-hint" style={{ marginTop: "0.75rem" }}>
            Mémorisé sur cet appareil.
          </p>
        </Modal>
      ) : null}

      {panel === "clear" ? (
        <Modal title="Vider le planning" onClose={() => setPanel(null)} size="sm">
          <div className="stack">
            <p className="muted">Cette action est définitive.</p>
            <button
              type="button"
              className="choice choice-danger"
              disabled={busy}
              onClick={() => void handleClearWeek()}
            >
              <span className="choice-title">Vider cette semaine</span>
              <span className="choice-desc">
                Retire les repas du {formatWeekRange(weekStartISO, weekEndISO)}.
              </span>
            </button>
            <button
              type="button"
              className="choice choice-danger"
              disabled={busy}
              onClick={() => void handleClearAll()}
            >
              <span className="choice-title">Vider toutes les semaines</span>
              <span className="choice-desc">
                Retire tous les repas, passés et à venir, et arrête la répétition.
              </span>
            </button>
          </div>
        </Modal>
      ) : null}

      {editingCell && creatingDish ? (
        <DishFormModal
          dish={null}
          initialName={dishSearch.trim()}
          initialMealSlots={[editingCell.mealSlot]}
          onClose={() => setCreatingDish(false)}
          onSaved={handleDishCreated}
        />
      ) : null}

      {editingCell && !creatingDish ? (
        <Modal
          title={
            choosingScope
              ? "Appliquer ce changement à…"
              : `${MEAL_SLOT_LABELS[editingCell.mealSlot]}, ${formatDateLong(editingCell.date)}`
          }
          onClose={() => {
            setEditingCell(null);
            setPendingDishId(undefined);
          }}
        >
          {choosingScope ? (
            <div className="stack">
              <button
                type="button"
                className="choice"
                disabled={busy}
                onClick={() => void handleScopeChoice("this_week")}
              >
                <span className="choice-title">Cette semaine seulement</span>
                <span className="choice-desc">Le modèle répété ne change pas.</span>
              </button>
              <button
                type="button"
                className="choice"
                disabled={busy}
                onClick={() => void handleScopeChoice("all_future")}
              >
                <span className="choice-title">Toutes les semaines à venir</span>
                <span className="choice-desc">Le modèle répété est modifié.</span>
              </button>
              <Button variant="ghost" onClick={() => setPendingDishId(undefined)}>
                Retour
              </Button>
            </div>
          ) : (
            <div className="stack" style={{ gap: "0.75rem" }}>
              <div className="search-row">
                <div className="search-field">
                  <Icon name="search" size={18} />
                  <input
                    type="search"
                    className="input"
                    placeholder="Rechercher un plat"
                    aria-label="Rechercher un plat"
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                  />
                </div>
                <Button variant="secondary" onClick={() => setCreatingDish(true)}>
                  <Icon name="plus" size={18} />
                  Nouveau plat
                </Button>
              </div>

              <div className="pick-quick">
                <button
                  type="button"
                  className="chip chip-button"
                  onClick={() => handlePickSpecial("eating_out")}
                >
                  <Icon name="utensils" size={16} />
                  {SPECIAL_MEAL_LABELS.eating_out}
                </button>
                {editingMeal ? (
                  <button
                    type="button"
                    className="chip chip-button chip-danger"
                    onClick={() => handlePickDish(null)}
                  >
                    <Icon name="close" size={16} />
                    Retirer le repas
                  </button>
                ) : null}
              </div>

              <div className="dish-pick-list">
                {filteredDishes.map((dish) => {
                  const isCurrent = editingMeal?.dishId === dish.id;
                  return (
                    <button
                      key={dish.id}
                      type="button"
                      className={`dish-pick-item ${isCurrent ? "current" : ""}`}
                      aria-current={isCurrent ? "true" : undefined}
                      onClick={() => handlePickDish(dish.id)}
                    >
                      <span>{dish.name}</span>
                      {isCurrent ? <Icon name="check" size={18} /> : null}
                    </button>
                  );
                })}
                {dishes.length === 0 ? (
                  <p className="empty-inline">
                    Aucun plat pour l&apos;instant. Crée le premier avec « Nouveau plat ».
                  </p>
                ) : slotDishes.length === 0 ? (
                  <p className="empty-inline">
                    Aucun plat dans la catégorie « {DISH_CATEGORY_LABELS[editingCell.mealSlot]} ».
                    Crée-en un avec « Nouveau plat », ou ajoute cette catégorie à un plat depuis
                    l&apos;écran Plats.
                  </p>
                ) : filteredDishes.length === 0 ? (
                  <p className="empty-inline">
                    Aucun plat ne correspond à « {dishSearch.trim()} ». « Nouveau plat » le crée
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
