"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { UNITS } from "@/lib/units";
import { fetchIngredients } from "@/features/dishes/api";
import { formatDateLong, formatQuantity, type DurationUnit } from "@/lib/date";
import {
  useShoppingList,
  refreshShoppingList,
  removeItem,
  toggleItemChecked,
} from "./useShoppingList";
import {
  addExtraItem,
  generateShoppingList,
  getDefaultPeriod,
  periodFromDuration,
} from "./generate";
import { flushPendingMutations } from "./syncQueue";
import {
  DEFAULT_EXTRA_LIST_NAME,
  EXTRA_LIST_NAME_MAX_LENGTH,
  fetchExtraListName,
  readCachedExtraListName,
  saveExtraListName,
} from "./extraListName";
import type { ShoppingListItem } from "./types";

const UNIT_OPTIONS: { value: DurationUnit; label: string }[] = [
  { value: "day", label: "jour(s)" },
  { value: "week", label: "semaine(s)" },
  { value: "month", label: "mois" },
];

type Tab = "week" | "extra";

/** Statut d'une action, rattaché à la zone de la page qui l'a déclenchée. */
type ActionStatus = {
  scope: "add" | "dishes" | null;
  message: string | null;
  error: string | null;
};

const IDLE_STATUS: ActionStatus = { scope: null, message: null, error: null };

/** Unité proposée par défaut pour un nouvel article. */
const DEFAULT_UNIT = "pièce";

function StatusBanner({ status, scope }: { status: ActionStatus; scope: ActionStatus["scope"] }) {
  if (status.scope !== scope) return null;
  if (status.error) {
    return (
      <div className="notice notice-error" role="alert">
        {status.error}
      </div>
    );
  }
  if (status.message) {
    return (
      <p className="status-ok" role="status">
        <Icon name="check" size={16} />
        {status.message}
      </p>
    );
  }
  return null;
}

/**
 * Article d'une section d'origine. Coché = à acheter : il apparaît
 * automatiquement dans « À acheter ». Décoché (déjà chez nous, pas
 * besoin) : grisé, reste dans l'onglet mais hors de la liste d'achat.
 */
function SourceRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
  onToggle: (id: string, checked: boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className={`shop-item ${item.isChecked ? "" : "shop-item-off"}`}>
      <label className="shop-item-hit">
        <input
          type="checkbox"
          className="shop-checkbox"
          checked={item.isChecked}
          onChange={(e) => onToggle(item.id, e.target.checked)}
        />
        <span className="shop-name">{item.ingredientName}</span>
        <span className="shop-qty">
          {formatQuantity(item.quantity)} {item.unit}
        </span>
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-icon shop-remove"
        aria-label={`Retirer ${item.ingredientName}`}
        onClick={() => onRemove(item.id)}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

/**
 * Champ texte avec suggestions filtrées d'un catalogue existant
 * (ingrédients déjà utilisés, dans un plat ou ajoutés ici) : cliquer une
 * suggestion la retient telle quelle, sinon le texte saisi sert à créer
 * un nouvel article.
 */
function IngredientSearchField({
  id,
  label,
  value,
  onChange,
  suggestions,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const normalized = value.trim().toLowerCase();
  const matches =
    normalized === ""
      ? []
      : suggestions
          .filter((s) => s.toLowerCase().includes(normalized) && s.toLowerCase() !== normalized)
          .slice(0, 8);

  return (
    <div className="field autocomplete add-form-name">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        autoComplete="off"
        placeholder="Ex : Sacs poubelle"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && matches.length > 0 ? (
        <ul className="autocomplete-list">
          {matches.map((m) => (
            <li key={m}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ShoppingListScreen() {
  const confirm = useConfirm();
  const toast = useToast();
  const defaults = useMemo(() => getDefaultPeriod(), []);
  const [amount, setAmount] = useState(defaults.amount);
  const [unit, setUnit] = useState<DurationUnit>(defaults.unit);
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);

  const [activeTab, setActiveTab] = useState<Tab>("week");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ActionStatus>(IDLE_STATUS);

  const [addName, setAddName] = useState("");
  const [addQuantity, setAddQuantity] = useState(1);
  const [addUnit, setAddUnit] = useState<string>(DEFAULT_UNIT);
  const [ingredientSuggestions, setIngredientSuggestions] = useState<string[]>([]);

  // Nom de l'onglet « Courses supplémentaires », renommable en cliquant
  // dessus quand il est actif. `nameDraft` non null = en cours d'édition.
  const [extraListName, setExtraListName] = useState(DEFAULT_EXTRA_LIST_NAME);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  // Échap : retirer le champ peut déclencher un blur, qui ne doit pas enregistrer.
  const cancelNameEdit = useRef(false);

  const items = useShoppingList();

  // Une seule liste « dishes » à la fois (la dernière générée), quelle
  // que soit la durée actuellement choisie dans le formulaire.
  const dishesItems = useMemo(() => items?.filter((i) => i.section === "dishes") ?? [], [items]);
  const dishesPeriod = dishesItems[0]?.periodStart && dishesItems[0]?.periodEnd
    ? { start: dishesItems[0].periodStart, end: dishesItems[0].periodEnd }
    : null;
  const extraItems = useMemo(() => items?.filter((i) => i.section === "extra") ?? [], [items]);

  useEffect(() => {
    void fetchIngredients().then(setIngredientSuggestions);
    // Copie locale d'abord (affichage immédiat, hors-ligne), puis la base.
    setExtraListName(readCachedExtraListName());
    void fetchExtraListName().then(setExtraListName);
  }, []);

  async function commitNameDraft() {
    if (nameDraft === null) return;
    if (cancelNameEdit.current) {
      cancelNameEdit.current = false;
      return;
    }
    const next = nameDraft.trim().slice(0, EXTRA_LIST_NAME_MAX_LENGTH);
    setNameDraft(null);
    // Vide ou inchangé : on garde l'ancien nom, rien à enregistrer.
    if (!next || next === extraListName) return;
    const previous = extraListName;
    setExtraListName(next);
    try {
      await saveExtraListName(next);
    } catch (err) {
      setExtraListName(previous);
      toast(err instanceof Error ? err.message : "Renommage impossible.", "error");
    }
  }

  function applyDuration(nextAmount: number, nextUnit: DurationUnit) {
    const period = periodFromDuration(nextAmount, nextUnit);
    setAmount(period.amount);
    setUnit(period.unit);
    setPeriodStart(period.periodStart);
    setPeriodEnd(period.periodEnd);
  }

  useEffect(() => {
    setStatus(IDLE_STATUS);
  }, [periodStart, periodEnd]);

  useEffect(() => {
    void (async () => {
      // Rejoue d'abord les modifications hors-ligne, sinon le
      // rafraîchissement les masquerait jusqu'à la prochaine synchro.
      await flushPendingMutations();
      await refreshShoppingList();
    })();
  }, []);

  async function handleAddExtra(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = addName.trim();
    if (!trimmed) return;
    setBusy(true);
    setStatus({ scope: "add", message: null, error: null });
    try {
      await addExtraItem(trimmed, addQuantity, addUnit);
      setStatus({ scope: "add", message: `« ${trimmed} » ajouté à « ${extraListName} ».`, error: null });
      setAddName("");
      setAddQuantity(1);
      setAddUnit(DEFAULT_UNIT);
    } catch (err) {
      setStatus({
        scope: "add",
        message: null,
        error: err instanceof Error ? err.message : "Ajout impossible",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setStatus({ scope: "dishes", message: null, error: null });
    try {
      const { count } = await generateShoppingList(periodStart, periodEnd);
      setStatus({
        scope: "dishes",
        message: count > 0 ? `Liste générée : ${count} article${count > 1 ? "s" : ""}.` : "La liste est vide.",
        error: null,
      });
    } catch (err) {
      setStatus({
        scope: "dishes",
        message: null,
        error: err instanceof Error ? err.message : "Génération impossible",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(itemId: string, isChecked: boolean) {
    await toggleItemChecked(itemId, isChecked);
  }

  async function handleRemove(itemId: string) {
    const item = items?.find((i) => i.id === itemId);
    const ok = await confirm({
      title: item ? `Retirer « ${item.ingredientName} » ?` : "Retirer cet article ?",
      confirmLabel: "Retirer",
      danger: true,
    });
    if (!ok) return;
    await removeItem(itemId);
  }

  const dishesToBuy = dishesItems.filter((i) => i.isChecked).length;
  const extraToBuy = extraItems.filter((i) => i.isChecked).length;

  return (
    <div className="screen">
      <header className="page-header">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="page-sub">
            Ce qui est coché part dans « À acheter ». Décoche ce que tu as déjà.
          </p>
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="Origine des articles">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "week"}
          className={`segment ${activeTab === "week" ? "active" : ""}`}
          onClick={() => setActiveTab("week")}
        >
          Depuis le planning
          {dishesItems.length > 0 ? <span className="segment-count">{dishesItems.length}</span> : null}
        </button>
        {nameDraft !== null ? (
          <div className="segment active segment-editing">
            <input
              className="segment-input"
              aria-label="Nouveau nom de la liste"
              autoFocus
              maxLength={EXTRA_LIST_NAME_MAX_LENGTH}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => void commitNameDraft()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  cancelNameEdit.current = true;
                  setNameDraft(null);
                }
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "extra"}
            className={`segment ${activeTab === "extra" ? "active" : ""}`}
            title={activeTab === "extra" ? "Cliquer pour renommer" : undefined}
            onClick={() => {
              if (activeTab !== "extra") return setActiveTab("extra");
              cancelNameEdit.current = false;
              setNameDraft(extraListName);
            }}
          >
            <span className="segment-label">{extraListName}</span>
            {activeTab === "extra" ? (
              <Icon name="edit" size={14} className="segment-edit-icon" />
            ) : null}
            {extraItems.length > 0 ? <span className="segment-count">{extraItems.length}</span> : null}
          </button>
        )}
      </div>

      {activeTab === "week" ? (
        <>
          <section className="panel">
            <h2 className="panel-heading">Générer depuis le planning</h2>
            <div className="generate-row">
              <div className="inline-field">
                <label htmlFor="duration-amount">Pour les</label>
                <input
                  id="duration-amount"
                  type="number"
                  inputMode="numeric"
                  className="input input-narrow"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next) || next < 1) return;
                    applyDuration(next, unit);
                  }}
                />
                <select
                  id="duration-unit"
                  className="select select-auto"
                  aria-label="Unité de durée"
                  value={unit}
                  onChange={(e) => applyDuration(amount, e.target.value as DurationUnit)}
                >
                  {UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span>à venir</span>
              </div>
              <Button disabled={busy} onClick={() => void handleGenerate()}>
                {busy && status.scope === "dishes" ? "Génération…" : "Générer la liste"}
              </Button>
            </div>
            <p className="field-hint">
              Du {formatDateLong(periodStart)} au {formatDateLong(periodEnd)}.
              {dishesItems.length > 0 ? " Remplace la liste générée précédemment." : ""}
            </p>
            <StatusBanner status={status} scope="dishes" />
          </section>

          {items === undefined ? (
            <Spinner />
          ) : dishesItems.length === 0 ? (
            <div className="empty-state">
              <Icon name="list" size={32} />
              <p className="empty-title">Pas encore de liste</p>
              <p className="empty-text">
                Planifie des repas, choisis une durée puis « Générer la liste » : les
                ingrédients des plats prévus s&apos;additionnent ici.
              </p>
            </div>
          ) : (
            <section className="list-section">
              <div className="list-section-head">
                <h2 className="list-section-title">
                  {dishesToBuy} sur {dishesItems.length} à acheter
                </h2>
                {dishesPeriod ? (
                  <span className="list-section-meta">
                    Du {formatDateLong(dishesPeriod.start)} au {formatDateLong(dishesPeriod.end)}
                  </span>
                ) : null}
              </div>
              <div className="shop-list">
                {dishesItems.map((item) => (
                  <SourceRow key={item.id} item={item} onToggle={handleToggle} onRemove={handleRemove} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="panel">
            <h2 className="panel-heading">Ajouter un article</h2>
            <form className="add-form" onSubmit={(e) => void handleAddExtra(e)}>
              <IngredientSearchField
                id="extra-name"
                label="Article"
                value={addName}
                onChange={setAddName}
                suggestions={ingredientSuggestions}
              />
              <div className="field add-form-qty">
                <label htmlFor="extra-quantity">Quantité</label>
                <input
                  id="extra-quantity"
                  type="number"
                  inputMode="decimal"
                  className="input"
                  min="0"
                  step="any"
                  value={Number.isNaN(addQuantity) ? "" : String(addQuantity)}
                  onChange={(e) => setAddQuantity(e.target.value === "" ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="field add-form-unit">
                <label htmlFor="extra-unit">Unité</label>
                <select
                  id="extra-unit"
                  className="select"
                  value={addUnit}
                  onChange={(e) => setAddUnit(e.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="add-form-submit" disabled={busy || !addName.trim()}>
                <Icon name="plus" size={18} />
                Ajouter
              </Button>
            </form>
            <StatusBanner status={status} scope="add" />
          </section>

          {items === undefined ? (
            <Spinner />
          ) : extraItems.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">Rien en plus pour l&apos;instant</p>
              <p className="empty-text">
                Ajoute ici ce qui ne vient pas d&apos;un plat : produits ménagers, petit-déjeuner,
                boissons…
              </p>
            </div>
          ) : (
            <section className="list-section">
              <div className="list-section-head">
                <h2 className="list-section-title">
                  {extraToBuy} sur {extraItems.length} à acheter
                </h2>
              </div>
              <div className="shop-list">
                {extraItems.map((item) => (
                  <SourceRow key={item.id} item={item} onToggle={handleToggle} onRemove={handleRemove} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
