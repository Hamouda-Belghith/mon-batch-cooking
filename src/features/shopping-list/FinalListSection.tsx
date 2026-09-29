"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/dexie";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatQuantity } from "@/lib/date";
import {
  useShoppingList,
  toggleItemChecked,
  setItemsBought,
  clearPurchaseList,
} from "./useShoppingList";

/**
 * Une ligne de « À acheter » : les articles cochés des deux sections
 * d'origine, fusionnés par ingrédient + unité (quantités additionnées).
 */
interface PurchaseLine {
  key: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  itemIds: string[];
  isBought: boolean;
}

function PurchaseRow({
  line,
  onToggleBought,
  onRemove,
}: {
  line: PurchaseLine;
  onToggleBought: (line: PurchaseLine, bought: boolean) => void;
  onRemove: (line: PurchaseLine) => void;
}) {
  return (
    <div className={`shop-item ${line.isBought ? "checked" : ""}`}>
      <input
        type="checkbox"
        className="shop-checkbox"
        checked={line.isBought}
        onChange={(e) => onToggleBought(line, e.target.checked)}
        aria-label={
          line.isBought
            ? `${line.ingredientName} — dans le panier`
            : `${line.ingredientName} — à acheter`
        }
      />
      <span className="shop-name">{line.ingredientName}</span>
      <span className="shop-qty">
        {formatQuantity(line.quantity)} {line.unit}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={`Retirer ${line.ingredientName} de la liste`}
        onClick={() => onRemove(line)}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * La liste « À acheter » : calculée automatiquement à partir des
 * articles cochés des onglets « Depuis le planning » et « Courses
 * supplémentaires » (rien à exporter). Y cocher un article le met dans
 * le panier ; « ✕ » le décoche dans sa section d'origine. Composant
 * autonome (charge ses propres données) pour pouvoir être affiché à la
 * fois en bas de l'écran Courses et sur son propre onglet de navigation.
 */
export function FinalListSection() {
  const items = useShoppingList();
  const pendingCount = useLiveQuery(() => getDb().pendingMutations.count(), []);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => {
    const byKey = new Map<string, PurchaseLine>();
    for (const item of items ?? []) {
      if (!item.isChecked) continue;
      const key = `${item.ingredientId}-${item.unit}`;
      const line = byKey.get(key);
      if (line) {
        line.quantity += Number(item.quantity);
        line.itemIds.push(item.id);
        line.isBought = line.isBought && item.isBought;
      } else {
        byKey.set(key, {
          key,
          ingredientName: item.ingredientName,
          unit: item.unit,
          quantity: Number(item.quantity),
          itemIds: [item.id],
          isBought: item.isBought,
        });
      }
    }
    // `items` est déjà trié par nom : l'ordre d'insertion le conserve.
    return [...byKey.values()];
  }, [items]);

  const toBuy = useMemo(() => lines.filter((l) => !l.isBought), [lines]);
  const inCart = useMemo(() => lines.filter((l) => l.isBought), [lines]);

  async function handleToggleBought(line: PurchaseLine, bought: boolean) {
    await setItemsBought(line.itemIds, bought);
  }

  async function handleRemove(line: PurchaseLine) {
    if (!window.confirm(`Retirer « ${line.ingredientName} » de la liste d'achat ?`)) return;
    for (const id of line.itemIds) {
      await toggleItemChecked(id, false);
    }
  }

  async function handleClear() {
    if (
      !window.confirm(
        "Vider la liste « À acheter » ? Les articles restent dans leurs onglets, simplement décochés."
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await clearPurchaseList();
      setMessage("Liste vidée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de vider la liste");
    } finally {
      setBusy(false);
    }
  }

  if (items === undefined) return <Spinner />;

  return (
    <>
      {pendingCount && pendingCount > 0 ? (
        <p className="tag tag-warn" style={{ alignSelf: "flex-start" }}>
          {pendingCount} modification{pendingCount > 1 ? "s" : ""} en attente de synchro
        </p>
      ) : null}

      <div className="card stack" style={{ gap: "0.55rem" }}>
        {lines.length > 0 ? (
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void handleClear()}>
              Vider
            </Button>
          </div>
        ) : null}
        {error ? (
          <p style={{ color: "var(--danger)", fontWeight: 650, margin: 0 }}>{error}</p>
        ) : null}
        {message && !error ? (
          <p style={{ color: "var(--accent-dark)", fontWeight: 600, margin: 0 }}>{message}</p>
        ) : null}
        {lines.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Vide pour l&apos;instant. Coche des articles dans les onglets « Depuis le planning » et
            « Courses supplémentaires » de l&apos;écran Courses.
          </p>
        ) : (
          <div className="stack">
            <div className="stack" style={{ gap: "0.45rem" }}>
              <div className="row-spread">
                <p className="section-title">À acheter ({toBuy.length})</p>
                {toBuy.length === 0 ? <span className="tag">Tout est dans le panier</span> : null}
              </div>
              {toBuy.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)" }}>Plus rien à acheter.</p>
              ) : (
                toBuy.map((line) => (
                  <PurchaseRow
                    key={line.key}
                    line={line}
                    onToggleBought={handleToggleBought}
                    onRemove={handleRemove}
                  />
                ))
              )}
            </div>

            {inCart.length > 0 ? (
              <div className="stack" style={{ gap: "0.45rem", marginTop: "0.5rem" }}>
                <p className="section-title">Dans le panier ({inCart.length})</p>
                {inCart.map((line) => (
                  <PurchaseRow
                    key={line.key}
                    line={line}
                    onToggleBought={handleToggleBought}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
