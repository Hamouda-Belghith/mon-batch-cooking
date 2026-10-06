"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { addDays, formatWeekRange, parseISODate, toISODate } from "@/lib/date";
import { useDragDrop } from "@/lib/useDragDrop";
import { fetchDishesForCycles } from "@/features/cycles/api";
import { PlanningTabs } from "./PlanningTabs";
import { fetchSavedWeeks } from "./savedWeeks";
import {
  addRotationWeek,
  calendarWeekEntries,
  copyIntoCalendarWeek,
  fetchMonthOverview,
  moveRotationWeek,
  plannedRotationIndex,
  removeRotationWeek,
  rotationEntriesFrom,
  swapCalendarWeeks,
  type CalendarWeek,
  type MonthOverview,
} from "./rotation";
import type { SavedWeek } from "./types";

// Clés des éléments glissables / cibles (voir useDragDrop) :
//   rot:<i>     i-ème semaine de la rotation      rot:add  zone « ajouter »
//   cal:<iso>   semaine du calendrier (lundi)     saved:<id> semaine enregistrée
type Key = string;

function weekEndISO(startISO: string): string {
  return toISODate(addDays(parseISODate(startISO), 6));
}

function weekLabel(startISO: string): string {
  return formatWeekRange(startISO, weekEndISO(startISO));
}

function shortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Style portant la couleur d'une semaine de rotation (palette dans globals.css). */
function colorStyle(color: number | null | undefined): React.CSSProperties | undefined {
  return color === null || color === undefined
    ? undefined
    : ({ "--wk": `var(--wk-${color})` } as React.CSSProperties);
}

export function MonthScreen() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [overview, setOverview] = useState<MonthOverview | null>(null);
  const [savedWeeks, setSavedWeeks] = useState<SavedWeek[]>([]);
  const [dishNames, setDishNames] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Élément dont on a ouvert le menu d'actions. */
  const [actionsFor, setActionsFor] = useState<Key | null>(null);
  /** « Choisir la cible » sans glisser : élément source + type de cible attendu. */
  const [pick, setPick] = useState<{ source: Key; targets: "cal" | "rot" } | null>(null);
  const [addingWeek, setAddingWeek] = useState(false);

  async function load() {
    const [data, saved, dishes] = await Promise.all([
      fetchMonthOverview(),
      fetchSavedWeeks().catch(() => [] as SavedWeek[]),
      fetchDishesForCycles(),
    ]);
    setOverview(data);
    setSavedWeeks(saved);
    setDishNames(new Map(dishes.map((d) => [d.id, d.name])));
  }

  useEffect(() => {
    void load().catch((err) =>
      setLoadError(err instanceof Error ? err.message : "Chargement impossible")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotation = overview?.rotation ?? null;
  const calendar = useMemo(() => overview?.calendar ?? [], [overview]);
  const calendarByISO = useMemo(
    () => new Map(calendar.map((w) => [w.weekStartISO, w])),
    [calendar]
  );

  function parse(key: Key): { kind: string; id: string } {
    const i = key.indexOf(":");
    return { kind: key.slice(0, i), id: key.slice(i + 1) };
  }

  function isUpcoming(iso: string) {
    return !calendarByISO.get(iso)?.isPast;
  }

  function canDrop(source: Key, target: Key): boolean {
    const s = parse(source);
    const t = parse(target);
    if (s.kind === "rot") return t.kind === "rot" && t.id !== "add";
    if (s.kind === "cal" || s.kind === "saved") {
      if (t.kind === "rot") return true;
      if (t.kind === "cal") return isUpcoming(t.id) && t.id !== s.id;
    }
    return false;
  }

  /** Ce que fera le lâcher de `source` sur `target`, affiché pendant le glisser. */
  function describeDrop(source: Key, target: Key): string {
    const s = parse(source);
    const t = parse(target);
    if (s.kind === "rot") return "Placer ici";
    if (t.kind === "rot") return "Ajouter à la rotation";
    if (s.kind === "cal" && isUpcoming(s.id)) return "Échanger les deux semaines";
    return "Copier dans cette semaine";
  }

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true);
    try {
      await action();
      await load();
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action impossible", "error");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function entriesOf(source: Key) {
    const s = parse(source);
    if (s.kind === "saved") return savedWeeks.find((w) => w.id === s.id)?.entries ?? [];
    return calendarWeekEntries(s.id);
  }

  function sourceName(source: Key): string {
    const s = parse(source);
    if (s.kind === "saved") return `« ${savedWeeks.find((w) => w.id === s.id)?.name ?? ""} »`;
    if (s.kind === "cal") return `la semaine du ${weekLabel(s.id)}`;
    return `la semaine ${Number(s.id) + 1} de la rotation`;
  }

  const fromLabel = rotation ? `dès la semaine du ${weekLabel(rotation.firstWeekISO)}` : "";

  async function performDrop(source: Key, target: Key) {
    setPick(null);
    const s = parse(source);
    const t = parse(target);

    if (s.kind === "rot" && rotation) {
      await run(
        () => moveRotationWeek(rotation, Number(s.id), Number(t.id)),
        `Rotation réordonnée, ${fromLabel}.`
      );
      return;
    }

    if (t.kind === "rot") {
      const position = t.id === "add" ? undefined : Number(t.id);
      await run(async () => {
        const entries = rotationEntriesFrom(await entriesOf(source));
        await addRotationWeek(rotation, entries, position);
      }, "Semaine ajoutée à la rotation.");
      return;
    }

    if (t.kind === "cal") {
      const targetWeek = calendarByISO.get(t.id);
      if (s.kind === "cal" && isUpcoming(s.id)) {
        await run(() => swapCalendarWeeks(s.id, t.id), "Semaines échangées.");
        return;
      }
      if (targetWeek && targetWeek.meals.some((m) => m.dishId || m.special)) {
        const ok = await confirm({
          title: `Remplacer la semaine du ${weekLabel(t.id)} ?`,
          message: `Ses repas seront remplacés par ceux de ${sourceName(source)}, pour cette semaine seulement.`,
          confirmLabel: "Remplacer",
        });
        if (!ok) return;
      }
      await run(
        async () => copyIntoCalendarWeek(await entriesOf(source), t.id),
        "Semaine copiée."
      );
    }
  }

  const drag = useDragDrop({
    enabled: !busy && !pick && !actionsFor && !addingWeek && overview !== null,
    canDrop,
    onDrop: (source, target) => void performDrop(source, target),
  });

  /** Clic sur un élément : en mode « choisir la cible », le choisit ; sinon `fallback`. */
  function handleItemClick(key: Key, fallback: () => void) {
    if (pick) {
      if (key !== pick.source && parse(key).kind === pick.targets && canDrop(pick.source, key)) {
        void performDrop(pick.source, key);
      }
      return;
    }
    fallback();
  }

  function targetClass(key: Key) {
    const isOver = drag.overKey === key;
    const isPickable =
      pick !== null && key !== pick.source && parse(key).kind === pick.targets && canDrop(pick.source, key);
    const isSource = drag.dragging?.key === key || pick?.source === key;
    return `${isOver ? "dnd-over" : ""} ${isPickable ? "dnd-pickable" : ""} ${isSource ? "dnd-source" : ""}`;
  }

  function openWeek(iso: string) {
    router.push(`/?semaine=${iso}`);
  }

  async function handleRemoveRotationWeek(index: number) {
    if (!rotation) return;
    setActionsFor(null);
    const last = rotation.weeks.length === 1;
    const ok = await confirm({
      title: last ? "Arrêter la rotation ?" : `Retirer la semaine ${index + 1} de la rotation ?`,
      message: last
        ? `Les semaines à venir ne seront plus remplies automatiquement, ${fromLabel}. Les repas déjà modifiés à la main restent.`
        : `Ses repas ne reviendront plus, ${fromLabel}. La rotation passera à ${rotation.weeks.length - 1} semaine${rotation.weeks.length - 1 > 1 ? "s" : ""}.`,
      confirmLabel: last ? "Arrêter" : "Retirer",
      danger: true,
    });
    if (!ok) return;
    await run(
      () => removeRotationWeek(rotation, index),
      last ? "Rotation arrêtée." : "Semaine retirée de la rotation."
    );
  }

  // ---------- Rendu ----------

  function rotationDishNames(index: number): string[] {
    const week = rotation?.weeks[index];
    if (!week) return [];
    const ordered = [...week.entries].sort((a, b) => a.dayOffset - b.dayOffset);
    return [...new Set(ordered.map((e) => dishNames.get(e.dishId) ?? ""))].filter(Boolean);
  }

  function renderCalendarWeek(week: CalendarWeek) {
    const key = `cal:${week.weekStartISO}`;
    const rotIndex = week.rotationIndex;
    const planned = rotation ? plannedRotationIndex(rotation, week.weekStartISO) : null;
    // Semaine vide que la rotation remplira : on montre sa couleur prévue.
    const shownIndex = rotIndex ?? (week.meals.length === 0 ? planned : null);
    const color = shownIndex !== null && rotation ? rotation.weeks[shownIndex]?.color : null;
    const mealCount = week.meals.filter((m) => m.dishId || m.special).length;
    const dragLabel = weekLabel(week.weekStartISO);

    return (
      <li
        key={key}
        {...drag.itemProps(key, mealCount > 0 ? dragLabel : null)}
        className={`month-week ${week.isPast ? "month-week-past" : ""} ${
          week.isCurrent ? "month-week-current" : ""
        } ${color !== null ? "month-week-colored" : ""} ${targetClass(key)}`}
        style={colorStyle(color)}
      >
        <button
          type="button"
          className="month-week-main"
          disabled={busy}
          onClick={() => handleItemClick(key, () => openWeek(week.weekStartISO))}
          aria-label={`Semaine du ${dragLabel}${
            shownIndex !== null ? `, semaine ${shownIndex + 1} de la rotation` : ""
          }. Ouvrir dans le planning.`}
        >
          <span className="month-week-top">
            <span className="month-week-dates">{dragLabel}</span>
            {week.isCurrent ? <span className="chip chip-today chip-xs">Cette semaine</span> : null}
            {shownIndex !== null ? (
              <span className="chip chip-xs rot-chip">
                <span className="rot-swatch" aria-hidden="true" />
                Semaine {shownIndex + 1}
              </span>
            ) : null}
            {week.modified ? <span className="chip chip-xs chip-modified">Modifiée</span> : null}
          </span>
          <span className="month-week-dishes">
            {week.labels.length > 0
              ? week.labels.join(" · ")
              : shownIndex !== null
                ? "Sera remplie par la rotation"
                : "Rien de prévu"}
          </span>
        </button>
        <span className="month-week-count" aria-hidden="true">
          {mealCount > 0 ? `${mealCount} repas` : ""}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label={`Actions pour la semaine du ${dragLabel}`}
          disabled={busy || pick !== null}
          onClick={() => setActionsFor(key)}
        >
          <Icon name="more" size={20} />
        </button>
      </li>
    );
  }

  function renderActions() {
    if (!actionsFor) return null;
    const a = parse(actionsFor);
    const close = () => setActionsFor(null);
    const choice = (title: string, desc: string, onClick: () => void, danger = false) => (
      <button
        type="button"
        className={`choice ${danger ? "choice-danger" : ""}`}
        disabled={busy}
        onClick={onClick}
      >
        <span className="choice-title">{title}</span>
        <span className="choice-desc">{desc}</span>
      </button>
    );

    let title = "";
    const items: React.ReactNode[] = [];

    if (a.kind === "cal") {
      const week = calendarByISO.get(a.id);
      title = `Semaine du ${weekLabel(a.id)}`;
      items.push(
        choice("Ouvrir dans le planning", "Pour modifier les repas de cette semaine.", () =>
          openWeek(a.id)
        )
      );
      items.push(
        choice(
          "Ajouter à la rotation",
          "Ses plats reviendront à chaque tour de la rotation.",
          () => {
            close();
            void performDrop(actionsFor, "rot:add");
          }
        )
      );
      if (week && !week.isPast) {
        items.push(
          choice("Échanger avec une autre semaine…", "Cette fois seulement ; la rotation ne change pas.", () => {
            close();
            setPick({ source: actionsFor, targets: "cal" });
          })
        );
      } else {
        items.push(
          choice("Copier dans une semaine à venir…", "Remplace les repas de la semaine choisie.", () => {
            close();
            setPick({ source: actionsFor, targets: "cal" });
          })
        );
      }
    } else if (a.kind === "rot" && rotation) {
      const index = Number(a.id);
      const count = rotation.weeks.length;
      const nextISO = toISODate(addDays(parseISODate(rotation.firstWeekISO), 7 * index));
      title = `Semaine ${index + 1} de la rotation`;
      items.push(
        choice(
          "Voir dans le planning",
          `Prochaine fois : semaine du ${weekLabel(nextISO)}.`,
          () => openWeek(nextISO)
        )
      );
      if (index > 0) {
        items.push(
          choice("Placer plus tôt", `Devient la semaine ${index}.`, () => {
            close();
            void performDrop(actionsFor, `rot:${index - 1}`);
          })
        );
      }
      if (index < count - 1) {
        items.push(
          choice("Placer plus tard", `Devient la semaine ${index + 2}.`, () => {
            close();
            void performDrop(actionsFor, `rot:${index + 1}`);
          })
        );
      }
      items.push(
        choice(
          count === 1 ? "Arrêter la rotation" : "Retirer de la rotation",
          count === 1
            ? "Plus aucune semaine ne sera remplie automatiquement."
            : `La rotation passera à ${count - 1} semaine${count - 1 > 1 ? "s" : ""}.`,
          () => void handleRemoveRotationWeek(index),
          true
        )
      );
    } else if (a.kind === "saved") {
      const saved = savedWeeks.find((w) => w.id === a.id);
      title = saved ? `« ${saved.name} »` : "Semaine enregistrée";
      items.push(
        choice("Ajouter à la rotation", "Ses plats reviendront à chaque tour de la rotation.", () => {
          close();
          void performDrop(actionsFor, "rot:add");
        })
      );
      items.push(
        choice("Copier dans une semaine à venir…", "Remplace les repas de la semaine choisie.", () => {
          close();
          setPick({ source: actionsFor, targets: "cal" });
        })
      );
    }

    return (
      <Modal title={title} onClose={close}>
        <div className="stack">{items}</div>
      </Modal>
    );
  }

  function renderAddWeek() {
    if (!addingWeek) return null;
    const sources = calendar.filter((w) => w.meals.some((m) => m.dishId));
    const add = (key: Key) => {
      setAddingWeek(false);
      void performDrop(key, "rot:add");
    };
    return (
      <Modal title="Ajouter une semaine à la rotation" onClose={() => setAddingWeek(false)}>
        <div className="stack">
          <p className="field-hint">
            Choisis une semaine réussie : ses plats reviendront à chaque tour de la rotation.
          </p>
          {sources.length > 0 ? (
            <div className="pick-group">
              <h3 className="pick-group-title">Semaines du planning</h3>
              {sources.map((w) => (
                <button
                  key={w.weekStartISO}
                  type="button"
                  className="choice"
                  disabled={busy}
                  onClick={() => add(`cal:${w.weekStartISO}`)}
                >
                  <span className="choice-title">
                    {weekLabel(w.weekStartISO)}
                    {w.isCurrent ? " · cette semaine" : ""}
                  </span>
                  <span className="choice-desc">{w.labels.slice(0, 4).join(" · ")}</span>
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
                  onClick={() => add(`saved:${w.id}`)}
                >
                  <span className="choice-title">{w.name}</span>
                  <span className="choice-desc">
                    {w.entries.filter((e) => e.dishId).length} plats
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {sources.length === 0 && savedWeeks.length === 0 ? (
            <p className="empty-inline">
              Aucune semaine avec des plats pour l&apos;instant : remplis une semaine dans la vue
              Semaines, puis reviens ici.
            </p>
          ) : null}
        </div>
      </Modal>
    );
  }

  const pickHint = pick
    ? parse(pick.source).kind === "cal" && isUpcoming(parse(pick.source).id)
      ? `Touche la semaine à échanger avec ${sourceName(pick.source)}.`
      : `Touche la semaine où copier ${sourceName(pick.source)}.`
    : null;

  const upcoming = calendar.filter((w) => !w.isPast);
  const past = calendar.filter((w) => w.isPast);

  return (
    <div className="screen">
      <PlanningTabs active="month" />

      <header className="page-header">
        <div>
          <h1 className="page-title">Les prochaines semaines</h1>
          <p className="page-sub">
            Glisse les semaines pour réorganiser (sur téléphone : appui long puis glisser), ou
            utilise le bouton <Icon name="more" size={14} /> d&apos;une semaine.
          </p>
        </div>
      </header>

      {loadError ? (
        <div className="notice notice-error" role="alert">
          {loadError}
        </div>
      ) : overview === null ? (
        <Spinner />
      ) : (
        <>
          {pick ? (
            <div className="notice notice-info swap-banner" role="status">
              <span>{pickHint}</span>
              <Button size="sm" variant="ghost" onClick={() => setPick(null)}>
                Annuler
              </Button>
            </div>
          ) : null}

          <section className="panel rot-panel" aria-labelledby="rot-title">
            <div className="rot-head">
              <h2 className="panel-heading" id="rot-title">
                <Icon name="repeat" size={18} />
                Rotation
              </h2>
              {rotation ? (
                <span className="rot-freq">
                  Revient toutes les {rotation.weeks.length > 1 ? `${rotation.weeks.length} semaines` : "semaines"}
                </span>
              ) : null}
            </div>
            <p className="field-hint">
              {rotation
                ? `Les semaines reviennent dans cet ordre, puis la rotation recommence. Les changements s'appliquent dès la semaine du ${weekLabel(rotation.firstWeekISO)}.`
                : "Pas encore de rotation. Glisse ici une semaine réussie (ou une semaine enregistrée) pour qu'elle revienne régulièrement."}
            </p>
            <ol className="rot-grid">
              {rotation?.weeks.map((week, index) => {
                const key = `rot:${index}`;
                const names = rotationDishNames(index);
                const nextISO = toISODate(
                  addDays(parseISODate(rotation.firstWeekISO), 7 * index)
                );
                return (
                  <li
                    key={`${week.color}-${index}`}
                    {...drag.itemProps(key, `Semaine ${index + 1}`)}
                    className={`rot-card ${targetClass(key)}`}
                    style={colorStyle(week.color)}
                  >
                    <button
                      type="button"
                      className="rot-card-main"
                      disabled={busy}
                      onClick={() => handleItemClick(key, () => setActionsFor(key))}
                    >
                      <span className="rot-card-head">
                        <span className="rot-swatch" aria-hidden="true" />
                        Semaine {index + 1}
                      </span>
                      <span className="rot-card-date">dès le {shortDate(nextISO)}</span>
                      <span className="rot-card-dishes">
                        {names.slice(0, 4).join(" · ") || "Aucun plat"}
                        {names.length > 4 ? ` +${names.length - 4}` : ""}
                      </span>
                      <span className="rot-card-count">{week.entries.length} repas</span>
                    </button>
                  </li>
                );
              })}
              <li
                {...drag.itemProps("rot:add", null)}
                className={`rot-card rot-add ${targetClass("rot:add")}`}
              >
                <button
                  type="button"
                  className="rot-card-main"
                  disabled={busy}
                  onClick={() =>
                    handleItemClick("rot:add", () => setAddingWeek(true))
                  }
                >
                  <Icon name="plus" size={20} />
                  <span className="rot-add-title">Ajouter une semaine</span>
                  <span className="rot-card-date">ou glisse-la ici</span>
                </button>
              </li>
            </ol>
          </section>

          <section className="list-section" aria-labelledby="cal-title">
            <h2 className="list-section-title" id="cal-title">
              Calendrier
            </h2>
            <ol className="month-weeks">{upcoming.map(renderCalendarWeek)}</ol>
            {past.length > 0 ? (
              <>
                <h3 className="list-section-title list-section-title-muted month-past-title">
                  Semaines passées
                </h3>
                <p className="field-hint">
                  Une semaine réussie ? Ajoute-la à la rotation ou copie-la dans une semaine à venir.
                </p>
                <ol className="month-weeks">{[...past].reverse().map(renderCalendarWeek)}</ol>
              </>
            ) : null}
          </section>

          <section className="list-section" aria-labelledby="saved-title">
            <h2 className="list-section-title" id="saved-title">
              Semaines enregistrées
            </h2>
            {savedWeeks.length === 0 ? (
              <p className="field-hint">
                Aucune pour l&apos;instant. Dans la vue Semaines, « Semaines enregistrées » garde une
                semaine sous un nom.
              </p>
            ) : (
              <ul className="saved-chips">
                {savedWeeks.map((w) => {
                  const key = `saved:${w.id}`;
                  return (
                    <li key={w.id} {...drag.itemProps(key, w.name)} className={targetClass(key)}>
                      <button
                        type="button"
                        className="chip chip-button saved-chip"
                        disabled={busy || pick !== null}
                        onClick={() => setActionsFor(key)}
                      >
                        <Icon name="bookmark" size={14} />
                        {w.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {drag.dragging ? (
        <div ref={drag.ghostRef} className="drag-ghost" aria-hidden="true">
          {drag.dragging.label}
          {drag.overKey ? (
            <span className="drag-ghost-action">{describeDrop(drag.dragging.key, drag.overKey)}</span>
          ) : null}
        </div>
      ) : null}

      {renderActions()}
      {renderAddWeek()}
    </div>
  );
}
