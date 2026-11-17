"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { formatQuantity } from "@/lib/date";
import { deleteDish, fetchDishes, saveDish, saveDishNutrition } from "./api";
import { DishFormModal } from "./DishFormModal";
import { DISH_CATEGORY_LABELS, type Dish } from "./types";
import { CUISINE_LABELS, type CatalogDish } from "./catalog";
import {
  catalogDishToDraft,
  catalogSuggestions,
  findSimilarDish,
  suggestedDishName,
} from "./catalogMatching";
import { useCuisinePreference } from "./cuisinePreference";
import { catalogPhotoUrl } from "./catalogPhotos";
import { PhotoCreditsModal } from "./PhotoCredits";
import { SettingsModal } from "@/features/settings/SettingsModal";
import { estimateDish } from "@/features/nutrition/estimate";
import { MACROS, hasAnyMacro } from "@/features/nutrition/types";

function NutritionFacts({ dish }: { dish: Dish }) {
  if (!hasAnyMacro(dish)) return null;
  return (
    <span className="dish-facts">
      {dish.nutritionEstimated ? (
        <span className="estimated-tag" title="Estimé automatiquement d'après le nom du plat">
          ≈ estimé
        </span>
      ) : null}
      {MACROS.map(({ key, shortUnit }) =>
        dish[key] !== null ? (
          <span key={key}>
            {formatQuantity(dish[key] as number)} {shortUnit}
          </span>
        ) : null
      )}
    </span>
  );
}

/**
 * Nom du catalogue à proposer pour un plat (« ma9rouna poulet » →
 * Makrouna au poulet), sauf si un autre plat porte déjà ce nom.
 */
function knownNameFor(dish: Dish, dishes: Dish[]): string | null {
  const suggested = suggestedDishName(dish.name);
  if (!suggested) return null;
  return findSimilarDish(suggested, dishes, dish.id)?.exact ? null : suggested;
}

/** Plats sans aucun apport renseigné : ceux que l'estimation en lot remplit. */
function withoutNutrition(dishes: Dish[]): Dish[] {
  return dishes.filter((dish) => !hasAnyMacro(dish));
}

export function DishesScreen() {
  const confirm = useConfirm();
  const toast = useToast();
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [search, setSearch] = useState("");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [tab, setTab] = useState<"mine" | "suggestions">("mine");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const cuisines = useCuisinePreference();

  async function load() {
    setDishes(await fetchDishes());
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setCreating(true);
  }

  function openEdit(dish: Dish) {
    setEditing(dish);
    setCreating(true);
  }

  async function handleDelete(dish: Dish) {
    // La confirmation s'ouvre par-dessus le formulaire : annuler y revient
    // sans perdre les modifications en cours.
    const ok = await confirm({
      title: `Supprimer « ${dish.name} » ?`,
      message: "Cette action est définitive.",
      confirmLabel: "Supprimer le plat",
      danger: true,
    });
    if (!ok) return;
    setCreating(false);
    try {
      await deleteDish(dish.id);
      await load();
      toast(`« ${dish.name} » supprimé.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Suppression impossible", "error");
    }
  }

  /**
   * Estime d'après leur nom les apports des plats qui n'en ont aucun.
   * Les valeurs restent modifiables plat par plat (marquées « estimé »).
   */
  async function handleEstimateAll() {
    if (!dishes) return;
    const targets = withoutNutrition(dishes);
    if (targets.length === 0) return;
    setEstimating(true);
    let done = 0;
    try {
      // Par petits paquets : rapide sans envoyer 40 requêtes d'un coup.
      for (let i = 0; i < targets.length; i += 6) {
        await Promise.all(
          targets.slice(i, i + 6).map(async (dish) => {
            const { macros } = estimateDish({
              name: dish.name,
              description: dish.description,
              mealSlots: dish.mealSlots,
              ingredientNames: dish.ingredients.map((ing) => ing.ingredientName),
            });
            await saveDishNutrition(dish.id, macros, true);
            done += 1;
          })
        );
      }
      toast(
        `${done} plat${done > 1 ? "s" : ""} estimé${done > 1 ? "s" : ""}. ` +
          "Ouvre un plat pour ajuster ses valeurs si besoin."
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "L'estimation des plats a échoué. Réessaie.",
        "error"
      );
    } finally {
      setEstimating(false);
      await load();
    }
  }

  /** Ajoute un plat du catalogue à « Mes plats », avec ses ingrédients. */
  async function handleAddSuggestion(suggestion: CatalogDish) {
    setAdding(suggestion.name);
    try {
      await saveDish(catalogDishToDraft(suggestion));
      await load();
      toast(`« ${suggestion.name} » ajouté à tes plats.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ajout impossible. Réessaie.", "error");
    } finally {
      setAdding(null);
    }
  }

  const missingNutrition = dishes ? withoutNutrition(dishes).length : 0;
  const suggestions =
    dishes === null
      ? []
      : catalogSuggestions({ cuisines, query: search, existingNames: dishes.map((d) => d.name) });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDishes =
    dishes === null
      ? null
      : normalizedSearch === ""
      ? dishes
      : dishes.filter((dish) =>
          [dish.name, dish.description ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
        );

  return (
    <div className="screen">
      <header className="page-header">
        <div>
          <h1 className="page-title">Plats</h1>
          <p className="page-sub">
            {dishes && dishes.length > 0
              ? `${dishes.length} recette${dishes.length > 1 ? "s" : ""} et leurs ingrédients`
              : "Tes recettes et leurs ingrédients"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Icon name="plus" size={18} />
          Nouveau plat
        </Button>
      </header>

      {dishes !== null ? (
        <div className="segmented" role="tablist" aria-label="Plats">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            className={`segment ${tab === "mine" ? "active" : ""}`}
            onClick={() => setTab("mine")}
          >
            Mes plats
            {dishes.length > 0 ? <span className="segment-count">{dishes.length}</span> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "suggestions"}
            className={`segment ${tab === "suggestions" ? "active" : ""}`}
            onClick={() => setTab("suggestions")}
          >
            Suggestions
          </button>
        </div>
      ) : null}

      {dishes !== null && (dishes.length > 0 || tab === "suggestions") ? (
        <div className="search-field">
          <Icon name="search" size={18} />
          <input
            type="search"
            className="input"
            placeholder="Rechercher par nom ou description"
            aria-label="Rechercher un plat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      ) : null}

      {tab === "suggestions" && dishes !== null ? (
        <section className="suggestions">
          <p className="suggestions-intro">
            Cuisines proposées : {cuisines.map((c) => CUISINE_LABELS[c]).join(", ")}.{" "}
            <button type="button" className="link-button" onClick={() => setSettingsOpen(true)}>
              Modifier
            </button>
          </p>
          {suggestions.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">
                {search.trim()
                  ? `Aucune suggestion ne correspond à « ${search.trim()} »`
                  : "Tous les plats proposés sont déjà dans tes plats"}
              </p>
            </div>
          ) : (
            <ul className="dish-list">
              {suggestions.map((suggestion) => (
                <li key={suggestion.name} className="dish-row suggestion-row">
                  {catalogPhotoUrl(suggestion.name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={catalogPhotoUrl(suggestion.name)!}
                      alt=""
                      className="dish-thumb"
                      loading="lazy"
                    />
                  ) : (
                    <span className="dish-thumb dish-thumb-empty" aria-hidden="true">
                      {suggestion.name.charAt(0)}
                    </span>
                  )}
                  <span className="dish-row-main">
                    <span className="dish-row-name">{suggestion.name}</span>
                    <span className="dish-row-meta">
                      <span className="dish-categories">
                        {CUISINE_LABELS[suggestion.cuisine]} ·{" "}
                        {suggestion.mealSlots.map((slot) => DISH_CATEGORY_LABELS[slot]).join(" · ")}
                      </span>
                      <span className="dish-ingredients">
                        {suggestion.ingredients.map((ing) => ing.name).join(", ")}
                      </span>
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={adding !== null}
                    onClick={() => void handleAddSuggestion(suggestion)}
                  >
                    {adding === suggestion.name ? "Ajout…" : "Ajouter"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="suggestions-credits">
            Photos : Wikimedia Commons, sous licences libres.{" "}
            <button type="button" className="link-button" onClick={() => setCreditsOpen(true)}>
              Crédits des photos
            </button>
          </p>
        </section>
      ) : null}

      {tab === "suggestions" ? null : missingNutrition > 0 ? (
        <div className="notice notice-info estimate-banner">
          <span>
            <Icon name="sparkle" size={18} />
            {missingNutrition} plat{missingNutrition > 1 ? "s" : ""} sans calories ni
            protéines. Estimation d&apos;après le nom (arabe, arabizi ou français), modifiable
            ensuite.
          </span>
          <Button size="sm" onClick={() => void handleEstimateAll()} disabled={estimating}>
            {estimating ? "Estimation…" : "Estimer automatiquement"}
          </Button>
        </div>
      ) : null}

      {tab === "suggestions" ? null : filteredDishes === null ? (
        <Spinner />
      ) : dishes && dishes.length === 0 ? (
        <div className="empty-state">
          <Icon name="book" size={32} />
          <p className="empty-title">Aucun plat pour l&apos;instant</p>
          <p className="empty-text">
            Ajoute un plat avec ses ingrédients : il servira à remplir le planning et à
            générer la liste de courses.
          </p>
          <div className="row">
            <Button onClick={openCreate}>Créer le premier plat</Button>
            <Button variant="secondary" onClick={() => setTab("suggestions")}>
              Voir les suggestions
            </Button>
          </div>
        </div>
      ) : filteredDishes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">Aucun plat ne correspond à « {search.trim()} »</p>
          <Button variant="ghost" onClick={() => setSearch("")}>
            Effacer la recherche
          </Button>
        </div>
      ) : (
        <ul className="dish-list">
          {filteredDishes.map((dish) => {
            const knownName = knownNameFor(dish, dishes ?? []);
            return (
            <li key={dish.id}>
              <button type="button" className="dish-row" onClick={() => openEdit(dish)}>
                {dish.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={dish.photoUrl} alt="" className="dish-thumb" />
                ) : (
                  <span className="dish-thumb dish-thumb-empty" aria-hidden="true">
                    {dish.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="dish-row-main">
                  <span className="dish-row-name">{dish.name}</span>
                  {dish.description ? (
                    <span className="dish-row-desc">{dish.description}</span>
                  ) : null}
                  <span className="dish-row-meta">
                    <span className="dish-categories">
                      {dish.mealSlots.map((slot) => DISH_CATEGORY_LABELS[slot]).join(" · ")}
                    </span>
                    <NutritionFacts dish={dish} />
                    <span className="dish-ingredients">
                      {dish.ingredients.length === 0
                        ? "Aucun ingrédient"
                        : dish.ingredients.map((ing) => ing.ingredientName).join(", ")}
                    </span>
                    {knownName ? (
                      <span className="dish-name-hint">
                        <Icon name="sparkle" size={14} /> Nom connu : {knownName}
                      </span>
                    ) : null}
                  </span>
                </span>
                <Icon name="chevronRight" size={18} className="dish-row-chevron" />
              </button>
            </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <DishFormModal
          dish={editing}
          existingDishes={dishes ?? []}
          onClose={() => setCreating(false)}
          onDelete={editing ? () => void handleDelete(editing) : undefined}
          onSaved={async () => {
            setCreating(false);
            await load();
            toast(editing ? "Plat enregistré." : "Plat créé.");
          }}
        />
      ) : null}

      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}
      {creditsOpen ? <PhotoCreditsModal onClose={() => setCreditsOpen(false)} /> : null}
    </div>
  );
}
