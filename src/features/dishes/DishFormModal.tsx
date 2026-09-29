"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, TextareaField } from "@/components/ui/Field";
import { fetchIngredients, saveDish } from "./api";
import type { Dish, DishIngredient } from "./types";

const UNITS = [
  "g",
  "kg",
  "ml",
  "cl",
  "l",
  "pièce",
  "pincée",
  "c. à soupe",
  "c. à café",
  "boîte",
];

/** Champ numérique optionnel : vide = non renseigné (`null`), jamais 0 par défaut. */
function parseOptionalAmount(value: string, decimals: number): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function EmptyIngredientRow(): DishIngredient {
  return { ingredientId: "", ingredientName: "", quantity: 1, unit: "pièce" };
}

/**
 * Modale de création / modification d'un plat. Partagée entre l'écran
 * Plats et le Planning (création d'un plat depuis le choix d'une case).
 * `onSaved` reçoit l'id du plat enregistré.
 */
export function DishFormModal({
  dish,
  initialName = "",
  onClose,
  onSaved,
}: {
  /** Plat à modifier ; `null` = nouveau plat. */
  dish: Dish | null;
  /** Nom prérempli pour un nouveau plat (ex. texte déjà tapé dans une recherche). */
  initialName?: string;
  onClose: () => void;
  onSaved: (dishId: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(dish?.name ?? initialName);
  const [description, setDescription] = useState(dish?.description ?? "");
  const [calories, setCalories] = useState(
    dish?.calories == null ? "" : String(dish.calories)
  );
  const [proteinG, setProteinG] = useState(
    dish?.proteinG == null ? "" : String(dish.proteinG)
  );
  const [ingredients, setIngredients] = useState<DishIngredient[]>(
    dish && dish.ingredients.length > 0 ? dish.ingredients : [EmptyIngredientRow()]
  );
  const [ingredientSuggestions, setIngredientSuggestions] = useState<string[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(dish?.photoUrl ?? null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  // Erreur affichée dans la modale : le formulaire reste ouvert pour ne
  // rien faire ressaisir.
  const [formError, setFormError] = useState<string | null>(null);
  // Identifiant d'un nouveau plat, fixé à l'ouverture du formulaire : si
  // l'enregistrement échoue à mi-chemin puis est retenté, on réécrit le
  // même plat au lieu d'en créer un second.
  const draftId = useRef<string>(dish?.id ?? crypto.randomUUID());

  useEffect(() => {
    void fetchIngredients().then(setIngredientSuggestions);
  }, []);

  function handlePhotoSelect(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(typeof reader.result === "string" ? reader.result : null);
      setPhotoChanged(true);
    };
    reader.readAsDataURL(file);
  }

  function handlePhotoRemove() {
    setPhotoPreview(null);
    setPhotoChanged(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await saveDish({
        id: draftId.current,
        name,
        description,
        calories: parseOptionalAmount(calories, 0),
        proteinG: parseOptionalAmount(proteinG, 1),
        ingredients: ingredients.filter((i) => i.ingredientName.trim() !== ""),
        photoUrl: photoChanged ? photoPreview : undefined,
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Impossible d'enregistrer le plat. Réessaie."
      );
      setSaving(false);
      return;
    }
    setSaving(false);
    await onSaved(draftId.current);
  }

  function updateIngredient(idx: number, patch: Partial<DishIngredient>) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing))
    );
  }

  return (
    <Modal title={dish ? "Modifier le plat" : "Nouveau plat"} onClose={onClose} wide>
      <form onSubmit={handleSave} className="stack">
        <Field
          label="Nom du plat"
          name="dish-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Pâtes bolognaise"
        />
        <TextareaField
          label="Description (optionnel)"
          name="dish-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex : la recette de grand-mère, 20 min de cuisson…"
        />

        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: "8rem" }}>
            <Field
              label="Calories (kcal, optionnel)"
              name="dish-calories"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="Ex : 650"
              hint="Pour une portion."
            />
          </div>
          <div style={{ flex: 1, minWidth: "8rem" }}>
            <Field
              label="Protéines (g, optionnel)"
              name="dish-protein"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={proteinG}
              onChange={(e) => setProteinG(e.target.value)}
              placeholder="Ex : 35"
              hint="Pour une portion."
            />
          </div>
        </div>

        <div>
          <span
            style={{
              display: "block",
              fontWeight: 650,
              fontSize: "0.9rem",
              marginBottom: "0.4rem",
            }}
          >
            Photo (optionnel)
          </span>
          <div className="dish-photo-field">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="" className="dish-photo-preview" />
            ) : (
              <div className="dish-photo-placeholder" aria-hidden="true">
                📷
              </div>
            )}
            <div className="stack" style={{ gap: "0.4rem" }}>
              <input
                type="file"
                accept="image/*"
                aria-label="Choisir une photo du plat"
                onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
              />
              {photoPreview ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handlePhotoRemove}
                >
                  Retirer la photo
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="row-spread">
          <h3 style={{ fontSize: "1rem", margin: 0 }}>Ingrédients</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setIngredients((prev) => [...prev, EmptyIngredientRow()])
            }
          >
            + Ajouter un ingrédient
          </Button>
        </div>

        {ingredients.map((ing, idx) => (
          <div
            key={idx}
            className="row"
            style={{
              border: "2px dashed var(--ink)",
              borderRadius: "var(--radius)",
              padding: "0.5rem",
            }}
          >
            <input
              list="ingredient-names"
              className="input"
              style={{ flex: 1, minWidth: "8rem" }}
              placeholder="Nom de l'ingrédient"
              value={ing.ingredientName}
              onChange={(e) => updateIngredient(idx, { ingredientName: e.target.value })}
            />
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              style={{ width: "5rem" }}
              placeholder="Qté"
              value={Number.isNaN(ing.quantity) ? "" : String(ing.quantity)}
              onChange={(e) =>
                updateIngredient(idx, {
                  quantity: e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
            />
            <select
              className="select"
              style={{ width: "8rem" }}
              value={ing.unit}
              onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="Retirer l'ingrédient"
              onClick={() =>
                setIngredients((prev) => prev.filter((_, i) => i !== idx))
              }
            >
              ✕
            </button>
          </div>
        ))}
        <datalist id="ingredient-names">
          {ingredientSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>

        {formError ? (
          <p role="alert" style={{ margin: 0, color: "var(--danger)", fontWeight: 650 }}>
            {formError}
          </p>
        ) : null}

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
