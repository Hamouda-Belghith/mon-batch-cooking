"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Field, TextareaField } from "@/components/ui/Field";
import { fetchIngredients, saveDish } from "./api";
import { IngredientInput } from "@/features/ingredients/IngredientInput";
import { renameIngredient } from "@/features/ingredients/api";
import { catalogDishToDraft, findCatalogDish, findSimilarDish } from "./catalogMatching";
import { catalogPhotoCredit } from "./catalogPhotos";
import { PhotoCreditLine } from "./PhotoCredits";
import { nameKey } from "@/lib/text";
import { MEAL_SLOTS } from "@/features/cycles/types";
import type { MealSlot } from "@/lib/supabase/database.types";
import { describeEstimate, estimateDish } from "@/features/nutrition/estimate";
import { MACROS, type MacroKey, type NullableMacros } from "@/features/nutrition/types";
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

function toInputValues(values: NullableMacros): Record<MacroKey, string> {
  return {
    calories: values.calories == null ? "" : String(values.calories),
    proteinG: values.proteinG == null ? "" : String(values.proteinG),
    carbsG: values.carbsG == null ? "" : String(values.carbsG),
    fatG: values.fatG == null ? "" : String(values.fatG),
  };
}

/**
 * Ligne d'ingrédient du formulaire. `originalName` : nom chargé depuis la
 * base ; `renameEverywhere` : le nom proposé par le catalogue a été
 * accepté pour cet ingrédient déjà enregistré, il sera renommé dans tous
 * les plats et la liste de courses.
 */
type FormIngredient = DishIngredient & { originalName?: string; renameEverywhere?: boolean };

function EmptyIngredientRow(): FormIngredient {
  return { ingredientId: "", ingredientName: "", quantity: 1, unit: "pièce" };
}

/** Ingrédient déjà enregistré dont le nom n'a pas été retouché dans le formulaire. */
function isSavedUnchanged(ing: FormIngredient): boolean {
  return ing.ingredientId !== "" && ing.ingredientName === ing.originalName;
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
  existingDishes = [],
}: {
  /** Plat à modifier ; `null` = nouveau plat. */
  dish: Dish | null;
  /** Plats de l'utilisateur, pour éviter d'en créer un deuxième au même nom. */
  existingDishes?: readonly { id: string; name: string }[];
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
  // Apports : estimés automatiquement d'après le nom (mode auto) tant
  // qu'ils n'ont pas été saisis à la main. Toucher un champ passe en
  // saisie manuelle, à partir des valeurs estimées.
  const [nutritionAuto, setNutritionAuto] = useState(
    !dish ||
      dish.nutritionEstimated ||
      MACROS.every(({ key }) => dish[key] === null)
  );
  const [manualNutrition, setManualNutrition] = useState<Record<MacroKey, string>>(() =>
    toInputValues(dish ?? { calories: null, proteinG: null, carbsG: null, fatG: null })
  );
  const [ingredients, setIngredients] = useState<FormIngredient[]>(
    dish && dish.ingredients.length > 0
      ? dish.ingredients.map((ing) => ({ ...ing, originalName: ing.ingredientName }))
      : [EmptyIngredientRow()]
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

  const ingredientKey = ingredients.map((i) => i.ingredientName).join("|");
  const estimate = useMemo(
    () =>
      name.trim()
        ? estimateDish({
            name,
            description,
            mealSlots,
            ingredientNames: ingredientKey.split("|").filter(Boolean),
          })
        : null,
    [name, description, mealSlots, ingredientKey]
  );
  const nutritionInputs: Record<MacroKey, string> = nutritionAuto
    ? estimate
      ? toInputValues(estimate.macros)
      : toInputValues({ calories: null, proteinG: null, carbsG: null, fatG: null })
    : manualNutrition;

  // Doublon : même nom (à l'écriture près) qu'un autre plat → bloquant ;
  // nom très proche → simple avertissement.
  const similarDish = findSimilarDish(name, existingDishes, dish?.id);
  const duplicateOf = similarDish?.exact ? similarDish.dish : null;

  // Plat connu du catalogue : proposer son nom (et ses ingrédients pour
  // un nouveau plat), jamais l'imposer.
  const knownDish = findCatalogDish(name);
  const hasIngredients = ingredients.some((ing) => ing.ingredientName.trim() !== "");
  const knownDishTaken = knownDish ? findSimilarDish(knownDish.name, existingDishes, dish?.id)?.exact : false;
  const catalogOffer =
    knownDish && !knownDishTaken && (knownDish.name !== name.trim() || (!dish && !hasIngredients))
      ? knownDish
      : null;

  // Photo issue du catalogue : ses crédits s'affichent dessous (licence libre).
  const photoCredit = catalogPhotoCredit(photoPreview);

  function applyCatalogDish() {
    if (!catalogOffer) return;
    setName(catalogOffer.name);
    if (dish || hasIngredients) return;
    const draft = catalogDishToDraft(catalogOffer, mealSlots);
    setMealSlots(draft.mealSlots);
    setIngredients(draft.ingredients);
    if (!photoPreview && draft.photoUrl) {
      setPhotoPreview(draft.photoUrl);
      setPhotoChanged(true);
    }
  }

  function editNutrition(key: MacroKey, value: string) {
    setManualNutrition({ ...nutritionInputs, [key]: value });
    setNutritionAuto(false);
  }

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
    if (!name.trim() || mealSlots.length === 0 || duplicateOf) return;
    // Deux lignes pour le même ingrédient (ex. « bsal » et « Oignon ») :
    // on le signale avant de renommer quoi que ce soit.
    const keys = ingredients.map((ing) => nameKey(ing.ingredientName)).filter(Boolean);
    const repeated = keys.find((key, i) => keys.indexOf(key) !== i);
    if (repeated) {
      setFormError(
        "Le même ingrédient apparaît sur plusieurs lignes. Garde une seule ligne et additionne les quantités."
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      for (const ing of ingredients) {
        if (ing.renameEverywhere && ing.ingredientId) {
          await renameIngredient(ing.ingredientId, ing.ingredientName.trim());
        }
      }
      await saveDish({
        id: draftId.current,
        name,
        description,
        mealSlots,
        ...(nutritionAuto && estimate
          ? { ...estimate.macros, nutritionEstimated: true }
          : {
              calories: parseOptionalAmount(nutritionInputs.calories, 0),
              proteinG: parseOptionalAmount(nutritionInputs.proteinG, 1),
              carbsG: parseOptionalAmount(nutritionInputs.carbsG, 1),
              fatG: parseOptionalAmount(nutritionInputs.fatG, 1),
              nutritionEstimated: false,
            }),
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

  function updateIngredient(idx: number, patch: Partial<FormIngredient>) {
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
        {duplicateOf ? (
          <p className="notice notice-error name-notice" role="alert">
            « {duplicateOf.name} » existe déjà dans tes plats : choisis-le plutôt que d&apos;en
            créer un deuxième, ou change le nom.
          </p>
        ) : similarDish ? (
          <p className="notice notice-info name-notice">
            Ressemble à « {similarDish.dish.name} », que tu as déjà. Vérifie que ce n&apos;est
            pas le même plat.
          </p>
        ) : null}
        {catalogOffer && !duplicateOf ? (
          <div className="notice notice-info name-notice">
            <span>
              <Icon name="sparkle" size={16} /> Plat connu : « {catalogOffer.name} »
            </span>
            <button type="button" className="notice-action" onClick={applyCatalogDish}>
              {catalogOffer.name !== name.trim()
                ? dish || hasIngredients
                  ? "Utiliser ce nom"
                  : "Utiliser ce plat et ses ingrédients"
                : "Pré-remplir les ingrédients"}
            </button>
          </div>
        ) : null}
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

        <fieldset className="field nutrition-field">
          <legend className="field-label">Apports par portion</legend>
          <div className="macro-grid">
            {MACROS.map((info) => (
              <Field
                key={info.key}
                label={`${info.label} (${info.unit})`}
                name={`dish-${info.key}`}
                type="number"
                inputMode={info.decimals === 0 ? "numeric" : "decimal"}
                min="0"
                step={info.decimals === 0 ? "1" : "0.1"}
                value={nutritionInputs[info.key]}
                onChange={(e) => editNutrition(info.key, e.target.value)}
                placeholder={nutritionAuto ? "Auto" : "Optionnel"}
              />
            ))}
          </div>
          {nutritionAuto ? (
            <p className="nutrition-note" aria-live="polite">
              <Icon name="sparkle" size={16} />
              <span>
                {estimate ? (
                  <>
                    Estimé d&apos;après le nom : {describeEstimate(estimate)}.
                    {estimate.recognized ? "" : " Ajoute la viande ou le plat dans le nom pour affiner."}{" "}
                    Modifie une valeur pour la fixer toi-même.
                  </>
                ) : (
                  "Les apports seront estimés à partir du nom du plat."
                )}
              </span>
            </p>
          ) : (
            <p className="nutrition-note">
              <span>Valeurs saisies à la main.</span>
              {estimate ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setNutritionAuto(true)}
                >
                  Revenir à l&apos;estimation (≈ {estimate.macros.calories} kcal,{" "}
                  {estimate.macros.proteinG} g de protéines)
                </button>
              ) : null}
            </p>
          )}
        </fieldset>

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
          {photoCredit ? <PhotoCreditLine credit={photoCredit} /> : null}
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
              <IngredientInput
                className="ingredient-name"
                value={ing.ingredientName}
                knownNames={ingredientSuggestions}
                placeholder="Ex : Tomates"
                ariaLabel={`Ingrédient ${idx + 1}, nom`}
                onChange={(value) =>
                  updateIngredient(idx, { ingredientName: value, renameEverywhere: false })
                }
                {...(isSavedUnchanged(ing)
                  ? {
                      renameLabel: (suggested: string) => `Renommer en « ${suggested} » partout`,
                      onAcceptRename: (suggested: string) =>
                        updateIngredient(idx, { ingredientName: suggested, renameEverywhere: true }),
                    }
                  : {})}
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
          <Button
            type="submit"
            disabled={saving || !name.trim() || mealSlots.length === 0 || duplicateOf !== null}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
