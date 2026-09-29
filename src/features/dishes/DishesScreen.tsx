"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatQuantity } from "@/lib/date";
import { deleteDish, fetchDishes } from "./api";
import { DishFormModal } from "./DishFormModal";
import type { Dish } from "./types";

function formatNutrition(dish: Dish): string | null {
  const parts: string[] = [];
  if (dish.calories !== null) parts.push(`${formatQuantity(dish.calories)} kcal`);
  if (dish.proteinG !== null) parts.push(`${formatQuantity(dish.proteinG)} g de protéines`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function DishesScreen() {
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    if (!window.confirm(`Supprimer le plat « ${dish.name} » ?`)) return;
    try {
      await deleteDish(dish.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
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
      <div className="row-spread" style={{ marginBottom: "0.25rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Plats</h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Tes recettes avec leurs ingrédients.
          </p>
        </div>
        <Button onClick={openCreate}>+ Nouveau plat</Button>
      </div>

      {error ? (
        <p style={{ color: "var(--danger)", fontWeight: 700 }}>{error}</p>
      ) : null}

      {dishes !== null && dishes.length > 0 ? (
        <input
          type="search"
          className="input"
          placeholder="Rechercher un plat…"
          aria-label="Rechercher un plat"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: "0.75rem" }}
        />
      ) : null}

      {filteredDishes === null ? (
        <Spinner />
      ) : dishes && dishes.length === 0 ? (
        <div className="card empty">
          Aucun plat pour l'instant. Crée ton premier plat avec le bouton
          « + Nouveau plat ».
        </div>
      ) : filteredDishes.length === 0 ? (
        <div className="card empty">
          Aucun plat ne correspond à « {search} ».
        </div>
      ) : (
        <div className="grid">
          {filteredDishes.map((dish) => (
            <div key={dish.id} className="card">
              {dish.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dish.photoUrl} alt="" className="dish-card-photo" />
              ) : null}
              <div className="row-spread">
                <div>
                  <h2 style={{ fontSize: "1.1rem", marginBottom: "0.2rem" }}>
                    {dish.name}
                  </h2>
                  {dish.description ? (
                    <p
                      style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}
                    >
                      {dish.description}
                    </p>
                  ) : null}
                  {formatNutrition(dish) ? (
                    <p
                      style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", fontWeight: 650 }}
                    >
                      {formatNutrition(dish)}
                    </p>
                  ) : null}
                </div>
                <div className="row" style={{ gap: "0.3rem" }}>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(dish)}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(dish)}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
              {dish.ingredients.length > 0 ? (
                <div className="stack" style={{ gap: "0.3rem", marginTop: "0.6rem" }}>
                  {dish.ingredients.map((ing, idx) => (
                    <div
                      key={`${ing.ingredientId}-${idx}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        borderBottom: "2px solid var(--ink)",
                        paddingBottom: "0.25rem",
                        fontSize: "0.92rem",
                      }}
                    >
                      <span>{ing.ingredientName}</span>
                      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {formatQuantity(ing.quantity)} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  style={{ margin: "0.6rem 0 0", color: "var(--muted)", fontStyle: "italic" }}
                >
                  Aucun ingrédient.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {creating ? (
        <DishFormModal
          dish={editing}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
