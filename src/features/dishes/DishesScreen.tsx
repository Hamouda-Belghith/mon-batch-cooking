"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";
import { useConfirm, useToast } from "@/components/ui/Feedback";
import { formatQuantity } from "@/lib/date";
import { deleteDish, fetchDishes } from "./api";
import { DishFormModal } from "./DishFormModal";
import type { Dish } from "./types";

function NutritionFacts({ dish }: { dish: Dish }) {
  if (dish.calories === null && dish.proteinG === null) return null;
  return (
    <span className="dish-facts">
      {dish.calories !== null ? <span>{formatQuantity(dish.calories)} kcal</span> : null}
      {dish.proteinG !== null ? (
        <span>{formatQuantity(dish.proteinG)} g de protéines</span>
      ) : null}
    </span>
  );
}

export function DishesScreen() {
  const confirm = useConfirm();
  const toast = useToast();
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [search, setSearch] = useState("");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);

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

      {dishes !== null && dishes.length > 0 ? (
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

      {filteredDishes === null ? (
        <Spinner />
      ) : dishes && dishes.length === 0 ? (
        <div className="empty-state">
          <Icon name="book" size={32} />
          <p className="empty-title">Aucun plat pour l&apos;instant</p>
          <p className="empty-text">
            Ajoute un plat avec ses ingrédients : il servira à remplir le planning et à
            générer la liste de courses.
          </p>
          <Button onClick={openCreate}>Créer le premier plat</Button>
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
          {filteredDishes.map((dish) => (
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
                    <NutritionFacts dish={dish} />
                    <span className="dish-ingredients">
                      {dish.ingredients.length === 0
                        ? "Aucun ingrédient"
                        : dish.ingredients.map((ing) => ing.ingredientName).join(", ")}
                    </span>
                  </span>
                </span>
                <Icon name="chevronRight" size={18} className="dish-row-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <DishFormModal
          dish={editing}
          onClose={() => setCreating(false)}
          onDelete={editing ? () => void handleDelete(editing) : undefined}
          onSaved={async () => {
            setCreating(false);
            await load();
            toast(editing ? "Plat enregistré." : "Plat créé.");
          }}
        />
      ) : null}
    </div>
  );
}
