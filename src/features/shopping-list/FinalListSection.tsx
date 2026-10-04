"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db/dexie";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { useConfirm, useToast } from "@/components/ui/Feedback";
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

/** Toute la ligne est cliquable : en magasin, on coche d'un pouce. */
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
    <div className={`shop-item shop-item-lg ${line.isBought ? "shop-item-done" : ""}`}>
      <label className="shop-item-hit">
        <input
          type="checkbox"
          className="shop-checkbox"
          checked={line.isBought}
          onChange={(e) => onToggleBought(line, e.target.checked)}
        />
        <span className="shop-name">{line.ingredientName}</span>
        <span className="shop-qty">
          {formatQuantity(line.quantity)} {line.unit}
        </span>
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-icon shop-remove"
        aria-label={`Retirer ${line.ingredientName} de la liste`}
        onClick={() => onRemove(line)}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

/**
 * La liste « À acheter » : calculée automatiquement à partir des
 * articles cochés des onglets « Depuis le planning » et « Courses
 * supplémentaires » (rien à exporter). Y cocher un article le met dans
 * le panier ; « ✕ » le décoche dans sa section d'origine. Composant
 * autonome (charge ses propres données), affiché par `FinalListScreen`
 * (onglet de navigation « À acheter »).
 */
export function FinalListSection() {
  const confirm = useConfirm();
  const toast = useToast();
  const items = useShoppingList();
  const pendingCount = useLiveQuery(() => getDb().pendingMutations.count(), []);

  const [busy, setBusy] = useState(false);

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
    const ok = await confirm({
      title: `Retirer « ${line.ingredientName} » ?`,
      message: "L'article reste dans l'écran Courses, simplement décoché.",
      confirmLabel: "Retirer",
    });
    if (!ok) return;
    for (const id of line.itemIds) {
      await toggleItemChecked(id, false);
    }
  }

  async function handleClear() {
    const ok = await confirm({
      title: "Vider la liste « À acheter » ?",
      message: "Les articles restent dans l'écran Courses, simplement décochés.",
      confirmLabel: "Vider la liste",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await clearPurchaseList();
      toast("Liste vidée.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible de vider la liste", "error");
    } finally {
      setBusy(false);
    }
  }

  if (items === undefined) return <Spinner />;

  const progress = lines.length === 0 ? 0 : inCart.length / lines.length;

  return (
    <>
      {pendingCount && pendingCount > 0 ? (
        <div className="notice notice-warn">
          {pendingCount} modification{pendingCount > 1 ? "s" : ""} hors-ligne, envoyée
          {pendingCount > 1 ? "s" : ""} au retour du réseau.
        </div>
      ) : null}

      {lines.length === 0 ? (
        <div className="empty-state">
          <Icon name="basket" size={32} />
          <p className="empty-title">La liste est vide</p>
          <p className="empty-text">
            Coche des articles dans l&apos;écran Courses : ils apparaissent ici
            automatiquement.
          </p>
          <Link href="/courses" className="btn btn-primary">
            Aller aux courses
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-progress">
            <div className="cart-progress-text">
              <strong>
                {toBuy.length === 0
                  ? "Tout est dans le panier"
                  : `${toBuy.length} article${toBuy.length > 1 ? "s" : ""} à prendre`}
              </strong>
              <span>
                {inCart.length} sur {lines.length} dans le panier
              </span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label="Articles dans le panier"
              aria-valuemin={0}
              aria-valuemax={lines.length}
              aria-valuenow={inCart.length}
            >
              <span style={{ width: `${progress * 100}%` }} />
            </div>
          </div>

          {toBuy.length > 0 ? (
            <div className="shop-list">
              {toBuy.map((line) => (
                <PurchaseRow
                  key={line.key}
                  line={line}
                  onToggleBought={handleToggleBought}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          ) : null}

          {inCart.length > 0 ? (
            <section className="list-section">
              <h2 className="list-section-title list-section-title-muted">
                Dans le panier ({inCart.length})
              </h2>
              <div className="shop-list">
                {inCart.map((line) => (
                  <PurchaseRow
                    key={line.key}
                    line={line}
                    onToggleBought={handleToggleBought}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <div className="row" style={{ justifyContent: "center" }}>
            <Button
              variant="ghost"
              className="btn-text-danger"
              disabled={busy}
              onClick={() => void handleClear()}
            >
              Vider la liste
            </Button>
          </div>
        </>
      )}
    </>
  );
}
