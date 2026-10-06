"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Field, TextareaField } from "@/components/ui/Field";
import { fetchIngredients, saveDish } from "./api";
import { MEAL_SLOTS } from "@/features/cycles/types";
import type { MealSlot } from "@/lib/supabase/database.types";
import {
  DEFAULT_DISH_MEAL_SLOTS,
  DISH_CATEGORY_LABELS,
  type Dish,
  type DishIngredient,
} from "./types";

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
  initialMealSlots = DEFAULT_DISH_MEAL_SLOTS,
  onClose,
  onSaved,
  onDelete,
}: {
  /** Plat à modifier ; `null` = nouveau plat. */
  dish: Dish | null;
  /** Nom prérempli pour un nouveau plat (ex. texte déjà tapé dans une recherche). */
  initialName?: string;
  /** Catégories précochées pour un nouveau plat (ex. le repas de la case du planning). */
  initialMealSlots?: MealSlot[];
  onClose: () => void;
  onSaved: (dishId: string) => void | Promise<void>;
  /** Affiche « Supprimer le plat » (modification depuis l'écran Plats). */
  onDelete?: () => void;
}) {
  const [name, setName] = useState(dish?.name ?? initialName);
  const [description, setDescription] = useState(dish?.description ?? "");
  const [mealSlots, setMealSlots] = useState<MealSlot[]>(dish?.mealSlots ?? initialMealSlots);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || mealSlots.length === 0) return;
    setSaving(true);
    setFormError(null);
    try {
      await saveDish({
        id: draftId.current,
        name,
        description,
        mealSlots,
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

  function toggleMealSlot(slot: MealSlot, checked: boolean) {
    setMealSlots((prev) =>
      MEAL_SLOTS.filter((s) => (s === slot ? checked : prev.includes(s)))
    );
  }

  function updateIngredient(idx: number, patch: Partial<DishIngredient>) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing))
    );
  }

  return (
    <Modal title={dish ? "Modifier le plat" : "Nouveau plat"} onClose={onClose} size="wide">
      <form onSubmit={handleSave} className="dish-form">
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

        <fieldset className="field category-field">
          <legend className="field-label">Catégories</legend>
          <div className="category-options">
            {MEAL_SLOTS.map((slot) => {
              const checked = mealSlots.includes(slot);
              return (
                <label key={slot} className={`chip category-chip ${checked ? "chip-basil" : ""}`}>
                  <input
                    type="checkbox"
                    className="visually-hidden"
                    checked={checked}
                    onChange={(e) => toggleMealSlot(slot, e.target.checked)}
                  />
                  {checked ? <Icon name="check" size={14} /> : null}
                  {DISH_CATEGORY_LABELS[slot]}
                </label>
              );
            })}
          </div>
          <p className="field-hint">
            {mealSlots.length === 0
              ? "Choisis au moins une catégorie."
              : "Le planning ne propose ce plat que pour ces repas."}
          </p>
        </fieldset>

        <div className="form-grid-2">
          <Field
            label="Calories par portion (kcal)"
            name="dish-calories"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="Optionnel"
          />
          <Field
            label="Protéines par portion (g)"
            name="dish-protein"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={proteinG}
            onChange={(e) => setProteinG(e.target.value)}
            placeholder="Optionnel"
          />
        </div>

        <div className="field">
          <span className="field-label">Photo (optionnel)</span>
          <div className="dish-photo-field">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="" className="dish-photo-preview" />
            ) : (
              <div className="dish-photo-placeholder" aria-hidden="true">
                <Icon name="camera" size={24} />
              </div>
            )}
            <div className="row">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? "Changer la photo" : "Ajouter une photo"}
              </Button>
              {photoPreview ? (
                <Button size="sm" variant="ghost" onClick={handlePhotoRemove}>
                  Retirer
                </Button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>

        <fieldset className="ingredients">
          <legend className="field-label">Ingrédients</legend>
          <div className="ingredient-head" aria-hidden="true">
            <span>Nom</span>
            <span>Qté</span>
            <span>Unité</span>
            <span />
          </div>
          {ingredients.map((ing, idx) => (
            <div key={idx} className="ingredient-row">
              <input
                list="ingredient-names"
                className="input"
                placeholder="Ex : Tomates"
                aria-label={`Ingrédient ${idx + 1}, nom`}
                value={ing.ingredientName}
                onChange={(e) => updateIngredient(idx, { ingredientName: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                aria-label={`Ingrédient ${idx + 1}, quantité`}
                value={Number.isNaN(ing.quantity) ? "" : String(ing.quantity)}
                onChange={(e) =>
                  updateIngredient(idx, {
                    quantity: e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
              />
              <select
                className="select"
                aria-label={`Ingrédient ${idx + 1}, unité`}
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
                aria-label={`Retirer l'ingrédient ${ing.ingredientName || idx + 1}`}
                onClick={() =>
                  setIngredients((prev) => prev.filter((_, i) => i !== idx))
                }
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="add-ingredient"
            onClick={() => setIngredients((prev) => [...prev, EmptyIngredientRow()])}
          >
            <Icon name="plus" size={16} />
            Ajouter un ingrédient
          </Button>
        </fieldset>
        <datalist id="ingredient-names">
          {ingredientSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>

        {formError ? (
          <div className="notice notice-error" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="modal-actions modal-actions-sticky">
          {onDelete ? (
            <Button variant="ghost" className="btn-text-danger push-left" onClick={onDelete}>
              Supprimer le plat
            </Button>
          ) : null}
          <Button variant="ghost" className="cancel-action" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving || !name.trim() || mealSlots.length === 0}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
