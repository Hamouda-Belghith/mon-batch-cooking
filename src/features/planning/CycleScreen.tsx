"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { addDays, formatWeekRange, parseISODate, toISODate } from "@/lib/date";
import { useDragDrop } from "@/lib/useDragDrop";
import { fetchDishesForCycles } from "@/features/cycles/api";
import type { MealCycleEntry } from "@/features/cycles/types";
import type { Dish } from "@/features/dishes/types";
import { PlanningTabs } from "./PlanningTabs";
import { CycleWeekEditor } from "./CycleWeekEditor";
import { fetchSavedWeeks } from "./savedWeeks";
import {
  addRotationWeek,
  fetchCycleOverview,
  moveRotationWeek,
  nextTimeISO,
  occurrenceISO,
  planningWeekEntries,
  removeRotationWeek,
  replaceRotationWeek,
  rotationEntriesFrom,
  type CycleOverview,
} from "./rotation";
import type { SavedWeek } from "./types";

function weekLabel(startISO: string): string {
  return formatWeekRange(startISO, toISODate(addDays(parseISODate(startISO), 6)));
}

function shortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

/** Style portant la couleur d'une semaine du cycle (palette dans globals.css). */
function colorStyle(color: number): React.CSSProperties {
  return { "--wk": `var(--wk-${color})` } as React.CSSProperties;
}

/** Choix d'une semaine modèle : pour en ajouter une au cycle, ou remplacer la semaine `index`. */
type PickerMode = { kind: "add" } | { kind: "replace"; index: number };

/** Édition des plats : nouvelle semaine, ou semaine `index` du cycle. */
type EditorMode = { kind: "new" } | { kind: "edit"; index: number };

/**
 * Vue « Cycle » du planning : les semaines qui reviennent, dans l'ordre,
 * la semaine en cours en tête. On y ajoute une semaine (nouvelle, reprise
 * du planning ou d'une semaine enregistrée), on en retire, on les
 * réordonne et on modifie leurs plats.
 */
export function CycleScreen() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [overview, setOverview] = useState<CycleOverview | null>(null);
  const [savedWeeks, setSavedWeeks] = useState<SavedWeek[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Semaine du cycle dont le menu d'actions est ouvert. */
  const [actionsFor, setActionsFor] = useState<number | null>(null);
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);

  async function load() {
    const [data, saved, dishRows] = await Promise.all([
      fetchCycleOverview(),
      fetchSavedWeeks().catch(() => [] as SavedWeek[]),
      fetchDishesForCycles(),
    ]);
    setOverview(data);
    setSavedWeeks(saved);
    setDishes(dishRows);
  }

  useEffect(() => {
    void load().catch((err) =>
      setLoadError(err instanceof Error ? err.message : "Chargement impossible")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotation = overview?.rotation ?? null;
  const count = rotation?.weeks.length ?? 0;
  /** Semaines à venir (réordonnables) : toutes sauf celle en cours, rangée à la fin. */
  const upcomingCount = rotation ? (rotation.currentIndex ?? count) : 0;
  /** Ordre d'affichage : la semaine en cours d'abord, puis les suivantes. */
  const displayOrder = rotation
    ? rotation.currentIndex !== null
      ? [rotation.currentIndex, ...Array.from({ length: upcomingCount }, (_, i) => i)]
      : Array.from({ length: count }, (_, i) => i)
    : [];
  const dishName = new Map(dishes.map((d) => [d.id, d.name]));
  const fromLabel = rotation ? `dès la semaine du ${weekLabel(rotation.firstWeekISO)}` : "";

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await action();
      await load();
      toast(done);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action impossible", "error");
      await load().catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const drag = useDragDrop({
    enabled: !busy && actionsFor === null && !picker && !editor && rotation !== null,
    // Seules les semaines à venir se réordonnent entre elles.
    canDrop: (source, target) => source !== target,
    onDrop: (source, target) => {
      if (!rotation) return;
      void run(
        () => moveRotationWeek(rotation, Number(source), Number(target)),
        `Ordre du cycle mis à jour, ${fromLabel}.`
      );
    },
  });

  function weekDishNames(entries: MealCycleEntry[]): string[] {
    const ordered = [...entries].sort((a, b) => a.dayOffset - b.dayOffset);
    return [...new Set(ordered.map((e) => dishName.get(e.dishId) ?? ""))].filter(Boolean);
  }

  async function handleRemove(index: number) {
    if (!rotation) return;
    setActionsFor(null);
    const last = count === 1;
    const ok = await confirm({
      title: last ? "Arrêter le cycle ?" : "Retirer cette semaine du cycle ?",
      message: last
        ? `Les semaines à venir ne seront plus remplies automatiquement, ${fromLabel}. Les repas modifiés à la main restent.`
        : `Ses repas ne reviendront plus, ${fromLabel}. Le cycle passera à ${plural(count - 1, "semaine")}.`,
      confirmLabel: last ? "Arrêter" : "Retirer",
      danger: true,
    });
    if (!ok) return;
    await run(
      () => removeRotationWeek(rotation, index),
      last ? "Cycle arrêté." : `Semaine retirée : le cycle fait ${plural(count - 1, "semaine")}.`
    );
  }

  /** Ajoute ou remplace une semaine du cycle avec les plats d'une semaine modèle. */
  async function applyEntries(
    mode: PickerMode,
    loadEntries: () => Promise<MealCycleEntry[]> | MealCycleEntry[]
  ) {
    setPicker(null);
    if (mode.kind === "add") {
      await run(
        async () => addRotationWeek(rotation, await loadEntries()),
        `Semaine ajoutée : le cycle fait ${plural(count + 1, "semaine")}.`
      );
    } else if (rotation) {
      await run(
        async () => replaceRotationWeek(rotation, mode.index, await loadEntries()),
        `Semaine remplacée, ${fromLabel}.`
      );
    }
  }

  async function handleEditorSave(entries: MealCycleEntry[]) {
    if (!editor) return;
    const ok =
      editor.kind === "new"
        ? await run(
            () => addRotationWeek(rotation, entries),
            `Semaine créée : le cycle fait ${plural(count + 1, "semaine")}.`
          )
        : rotation
          ? await run(
              () => replaceRotationWeek(rotation, editor.index, entries),
              `Semaine modifiée, ${fromLabel}.`
            )
          : false;
    if (ok) setEditor(null);
  }

  // ---------- Rendu ----------

  function renderCard(index: number, position: number) {
    if (!rotation) return null;
    const week = rotation.weeks[index];
    const isCurrent = index === rotation.currentIndex;
    const isNext = !isCurrent && index === 0;
    const names = weekDishNames(week.entries);
    const draggable = !isCurrent && upcomingCount > 1;
    const key = String(index);
    const whenISO = occurrenceISO(rotation, index);

    return (
      <li
        key={`${week.color}-${index}`}
        {...(draggable ? drag.itemProps(key, `Semaine ${position + 1}`) : {})}
        className={`cycle-card ${isCurrent ? "cycle-card-current" : ""} ${
          drag.overKey === key ? "dnd-over" : ""
        } ${drag.dragging?.key === key ? "dnd-source" : ""}`}
        style={colorStyle(week.color)}
      >
        <button
          type="button"
          className="cycle-card-main"
          disabled={busy}
          onClick={() => setActionsFor(index)}
          aria-label={`Semaine ${position + 1} du cycle${isCurrent ? ", en cours" : ""} : ${
            names.join(", ") || "aucun plat"
          }. Actions.`}
        >
          <span className="cycle-card-head">
            <span className="cycle-card-num">{position + 1}</span>
            <span className="cycle-card-title">Semaine {position + 1}</span>
            {isCurrent ? (
              <span className="chip chip-today chip-xs">En cours</span>
            ) : isNext ? (
              <span className="chip chip-xs cycle-chip-next">Prochaine</span>
            ) : null}
          </span>
          <span className="cycle-card-date">
            {isCurrent ? `Cette semaine (${weekLabel(whenISO)})` : `Semaine du ${weekLabel(whenISO)}`}
          </span>
          <span className="cycle-card-dishes">
            {names.length > 0 ? (
              <>
                {names.slice(0, 6).join(" · ")}
                {names.length > 6 ? ` +${names.length - 6}` : ""}
              </>
            ) : (
              "Aucun plat : touche pour la remplir"
            )}
          </span>
          <span className="cycle-card-count">{week.entries.length} repas</span>
        </button>
      </li>
    );
  }

  function renderActions() {
    if (actionsFor === null || !rotation) return null;
    const index = actionsFor;
    const position = displayOrder.indexOf(index);
    const isCurrent = index === rotation.currentIndex;
    const close = () => setActionsFor(null);
    const choice = (title: string, desc: string, onClick: () => void, danger = false) => (
      <button
        key={title}
        type="button"
        className={`choice ${danger ? "choice-danger" : ""}`}
        disabled={busy}
        onClick={onClick}
      >
        <span className="choice-title">{title}</span>
        <span className="choice-desc">{desc}</span>
      </button>
    );

    const items: React.ReactNode[] = [
      choice(
        "Modifier les plats",
        isCurrent
          ? `S'applique la prochaine fois : semaine du ${weekLabel(nextTimeISO(rotation, index))}.`
          : "Jour par jour, repas par repas.",
        () => {
          close();
          setEditor({ kind: "edit", index });
        }
      ),
      choice(
        "Remplacer par une autre semaine…",
        "Une semaine du planning ou une semaine enregistrée.",
        () => {
          close();
          setPicker({ kind: "replace", index });
        }
      ),
      choice("Voir dans le planning", `Semaine du ${weekLabel(occurrenceISO(rotation, index))}.`, () =>
        router.push(`/?semaine=${occurrenceISO(rotation, index)}`)
      ),
    ];
    if (!isCurrent && index > 0) {
      items.push(
        choice("Placer plus tôt", "Revient une semaine plus tôt dans le cycle.", () => {
          close();
          void run(() => moveRotationWeek(rotation, index, index - 1), `Ordre du cycle mis à jour, ${fromLabel}.`);
        })
      );
    }
    if (!isCurrent && index < upcomingCount - 1) {
      items.push(
        choice("Placer plus tard", "Revient une semaine plus tard dans le cycle.", () => {
          close();
          void run(() => moveRotationWeek(rotation, index, index + 1), `Ordre du cycle mis à jour, ${fromLabel}.`);
        })
      );
    }
    items.push(
      choice(
        count === 1 ? "Arrêter le cycle" : "Retirer du cycle",
        count === 1
          ? "Plus aucune semaine ne sera remplie automatiquement."
          : `Le cycle passera à ${plural(count - 1, "semaine")}.`,
        () => void handleRemove(index),
        true
      )
    );

    return (
      <Modal title={`Semaine ${position + 1}${isCurrent ? " (en cours)" : ""}`} onClose={close}>
        <div className="stack">{items}</div>
      </Modal>
    );
  }

  function renderPicker() {
    if (!picker || !overview) return null;
    const mode = picker;
    const recent = overview.recentWeeks;
    return (
      <Modal
        title={mode.kind === "add" ? "Ajouter une semaine au cycle" : "Remplacer cette semaine"}
        onClose={() => setPicker(null)}
      >
        <div className="stack">
          {mode.kind === "add" ? (
            <button
              type="button"
              className="choice"
              disabled={busy}
              onClick={() => {
                setPicker(null);
                setEditor({ kind: "new" });
              }}
            >
              <span className="choice-title">
                <Icon name="plus" size={16} /> Créer une nouvelle semaine
              </span>
              <span className="choice-desc">Choisis les plats jour par jour.</span>
            </button>
          ) : null}

          {recent.length > 0 ? (
            <div className="pick-group">
              <h3 className="pick-group-title">Semaines précédentes</h3>
              {recent.map((w) => (
                <button
                  key={w.weekStartISO}
                  type="button"
                  className="choice"
                  disabled={busy}
                  onClick={() =>
                    void applyEntries(mode, () => planningWeekEntries(w.weekStartISO))
                  }
                >
                  <span className="choice-title">
                    {w.isCurrent ? "Cette semaine" : `Semaine du ${weekLabel(w.weekStartISO)}`}
                  </span>
                  <span className="choice-desc">
                    {w.labels.slice(0, 4).join(" · ")}
                    {w.labels.length > 4 ? ` +${w.labels.length - 4}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {savedWeeks.length > 0 ? (
            <div className="pick-group">
              <h3 className="pick-group-title">Semaines enregistrées</h3>
              {savedWeeks.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="choice"
                  disabled={busy}
                  onClick={() => void applyEntries(mode, () => rotationEntriesFrom(w.entries))}
                >
                  <span className="choice-title">{w.name}</span>
                  <span className="choice-desc">
                    {plural(w.entries.filter((e) => e.dishId).length, "plat")}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {mode.kind === "replace" && recent.length === 0 && savedWeeks.length === 0 ? (
            <p className="empty-inline">
              Aucune semaine avec des plats pour l&apos;instant. Utilise plutôt « Modifier les
              plats ».
            </p>
          ) : null}
        </div>
      </Modal>
    );
  }

  function renderEditor() {
    if (!editor) return null;
    const isNew = editor.kind === "new";
    const index = editor.kind === "edit" ? editor.index : null;
    const position = index !== null ? displayOrder.indexOf(index) : count;
    let note =
      "Elle démarre le cycle dès la semaine prochaine et revient chaque semaine tant que tu n'en ajoutes pas d'autres.";
    if (rotation && index === null) {
      // Ajoutée juste avant que la semaine en cours ne revienne (voir addRotationWeek).
      const firstTime = nextTimeISO(rotation, rotation.currentIndex ?? count);
      note = `Elle s'ajoute à la fin du cycle (semaine ${count + 1}) : première fois la semaine du ${weekLabel(firstTime)}.`;
    } else if (rotation && index !== null) {
      note =
        index === rotation.currentIndex
          ? `Les changements s'appliquent la prochaine fois : semaine du ${weekLabel(
              nextTimeISO(rotation, index)
            )}. Cette semaine ne change pas.`
          : `Les changements s'appliquent dès la semaine du ${weekLabel(
              occurrenceISO(rotation, index)
            )}.`;
    }
    return (
      <CycleWeekEditor
        title={isNew ? "Nouvelle semaine" : `Semaine ${position + 1}`}
        note={note}
        initialEntries={index !== null && rotation ? rotation.weeks[index].entries : []}
        dishes={dishes}
        saving={busy}
        onSave={(entries) => void handleEditorSave(entries)}
        onClose={() => setEditor(null)}
      />
    );
  }

  const loopISO = rotation
    ? rotation.currentIndex !== null
      ? nextTimeISO(rotation, rotation.currentIndex)
      : nextTimeISO(rotation, count)
    : null;

  return (
    <div className="screen cycle-screen">
      <PlanningTabs active="cycle" />

      <header className="page-header">
        <div>
          <h1 className="page-title">Mon cycle</h1>
          <p className="page-sub">
            {rotation
              ? `${plural(count, "semaine")} qui s'enchaînent, puis le cycle recommence.`
              : "Les semaines qui reviennent, dans l'ordre."}
          </p>
        </div>
        <Button onClick={() => setPicker({ kind: "add" })} disabled={busy || overview === null}>
          <Icon name="plus" size={18} />
          Ajouter une semaine
        </Button>
      </header>

      {loadError ? (
        <div className="notice notice-error" role="alert">
          {loadError}
        </div>
      ) : overview === null ? (
        <Spinner />
      ) : !rotation ? (
        <div className="empty-state">
          <Icon name="repeat" size={32} />
          <p className="empty-title">Pas encore de cycle</p>
          <p className="empty-text">
            Ajoute une semaine : elle reviendra chaque semaine. Ajoutes-en d&apos;autres pour
            alterner (par exemple 4 semaines qui tournent).
          </p>
          <Button onClick={() => setPicker({ kind: "add" })}>Ajouter une semaine</Button>
        </div>
      ) : (
        <>
          <ol className="cycle-list">
            {displayOrder.map((index, position) => (
              <Fragment key={`${rotation.weeks[index].color}-${index}`}>
                {position > 0 ? (
                  <li className="cycle-arrow" aria-hidden="true">
                    ↓
                  </li>
                ) : null}
                {renderCard(index, position)}
              </Fragment>
            ))}
          </ol>
          <p className="cycle-loop">
            <Icon name="repeat" size={16} />
            {count === 1
              ? `La même semaine revient chaque semaine (prochaine fois le ${shortDate(loopISO as string)})`
              : `Puis retour à la semaine 1, le ${shortDate(loopISO as string)}`}
          </p>
          <p className="field-hint">
            Les changements s&apos;appliquent {fromLabel} ; la semaine en cours ne change pas.
            {upcomingCount > 1
              ? " Pour changer l'ordre, glisse une semaine (sur téléphone : appui long) ou touche-la."
              : ""}
          </p>
        </>
      )}

      {drag.dragging ? (
        <div ref={drag.ghostRef} className="drag-ghost" aria-hidden="true">
          {drag.dragging.label}
          {drag.overKey ? <span className="drag-ghost-action">Placer ici</span> : null}
        </div>
      ) : null}

      {renderActions()}
      {renderPicker()}
      {renderEditor()}
    </div>
  );
}
