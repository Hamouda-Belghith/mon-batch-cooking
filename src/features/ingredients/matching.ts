import { formatName, isLikelyTypo, nameKey } from "@/lib/text";
import { INGREDIENT_CATALOG, type CatalogIngredient } from "./catalog";

/*
 * Rapprochement d'un nom d'ingrédient saisi à la main avec les noms
 * connus : ceux du catalogue (`catalog.ts`) et ceux déjà utilisés par
 * l'utilisateur. Trois niveaux, du plus sûr au moins sûr :
 * - « same » : même nom à l'écriture près (casse, accents, pluriel,
 *   petits mots) — c'est le même ingrédient, appliqué sans demander ;
 * - « alias » : synonyme connu (« djej » → Poulet) — proposé ;
 * - « typo » : faute de frappe probable (« champignion ») — proposé.
 */

export type IngredientMatchKind = "same" | "alias" | "typo";

export interface CatalogIngredientMatch {
  entry: CatalogIngredient;
  kind: IngredientMatchKind;
  /** Texte du catalogue reconnu : le nom ou l'alias. */
  via: string;
}

interface IndexedIngredient {
  entry: CatalogIngredient;
  key: string;
  aliases: { key: string; alias: string }[];
}

let catalogIndex: IndexedIngredient[] | null = null;

function indexedCatalog(): IndexedIngredient[] {
  catalogIndex ??= INGREDIENT_CATALOG.map((entry: CatalogIngredient) => ({
    entry,
    key: nameKey(entry.name),
    aliases: (entry.aliases ?? []).map((alias) => ({ key: nameKey(alias), alias })),
  }));
  return catalogIndex;
}

/** Ingrédient du catalogue désigné par ce nom, s'il y en a un. */
export function findCatalogIngredient(name: string): CatalogIngredientMatch | null {
  const key = nameKey(name);
  if (!key) return null;
  const catalog = indexedCatalog();

  const same = catalog.find((item) => item.key === key);
  if (same) return { entry: same.entry, kind: "same", via: same.entry.name };

  for (const item of catalog) {
    const alias = item.aliases.find((a) => a.key === key);
    if (alias) return { entry: item.entry, kind: "alias", via: alias.alias };
  }

  for (const item of catalog) {
    if (isLikelyTypo(key, item.key)) return { entry: item.entry, kind: "typo", via: item.entry.name };
    const alias = item.aliases.find((a) => isLikelyTypo(key, a.key));
    if (alias) return { entry: item.entry, kind: "typo", via: alias.alias };
  }
  return null;
}

/**
 * Nom du catalogue à proposer pour un ingrédient déjà saisi, quand il
 * diffère du nom actuel (« bsal » → Oignon, « oeufs » → Œufs).
 */
export function suggestedIngredientName(name: string): CatalogIngredientMatch | null {
  const match = findCatalogIngredient(name);
  if (!match || match.entry.name === name.trim()) return null;
  return match;
}

/**
 * Nom à enregistrer pour un ingrédient saisi : l'ingrédient déjà utilisé
 * par l'utilisateur qui a la même clé (pour réutiliser sa ligne en base),
 * sinon le nom du catalogue qui a la même clé, sinon le texte mis en
 * forme. Un synonyme ou une faute de frappe n'est jamais remplacé ici :
 * c'est une suggestion que l'utilisateur accepte ou non.
 */
export function canonicalIngredientName(name: string, knownNames: readonly string[]): string {
  const key = nameKey(name);
  if (!key) return formatName(name);
  const known = knownNames.find((candidate) => nameKey(candidate) === key);
  if (known) return known;
  const match = findCatalogIngredient(name);
  return match?.kind === "same" ? match.entry.name : formatName(name);
}

export interface IngredientSuggestion {
  name: string;
  /** Alias qui a fait remonter la suggestion (ex. « djej » pour Poulet). */
  hint?: string;
  /** Déjà utilisé par l'utilisateur (dans un plat ou ses courses). */
  known: boolean;
}

/** Rang d'un texte pour une recherche (plus petit = meilleur), ou null s'il ne correspond pas. */
function rank(textKey: string, queryKey: string): number | null {
  if (textKey === queryKey) return 0;
  if (textKey.startsWith(queryKey)) return 1;
  if (textKey.split(" ").some((word) => word.startsWith(queryKey))) return 2;
  if (textKey.includes(queryKey)) return 3;
  if (queryKey.length >= 5 && isLikelyTypo(queryKey, textKey)) return 4;
  return null;
}

/**
 * Suggestions pour l'autocomplétion d'un ingrédient : ingrédients de
 * l'utilisateur et du catalogue dont le nom ou un alias correspond au
 * texte tapé, les mieux classés d'abord.
 */
export function suggestIngredients(
  query: string,
  knownNames: readonly string[],
  limit = 8
): IngredientSuggestion[] {
  const queryKey = nameKey(query);
  if (!queryKey) return [];

  const best = new Map<string, IngredientSuggestion & { score: number }>();
  const known = new Set(knownNames);
  const consider = (name: string, textKey: string, hint?: string) => {
    const base = rank(textKey, queryKey);
    if (base === null) return;
    // Un nom direct passe avant un alias, un ingrédient déjà utilisé avant le catalogue.
    const score = base + (hint ? 0.5 : 0) - (known.has(name) ? 0.25 : 0);
    const current = best.get(name);
    if (!current || score < current.score) best.set(name, { name, hint, known: known.has(name), score });
  };

  for (const name of knownNames) consider(name, nameKey(name));
  for (const item of indexedCatalog()) {
    consider(item.entry.name, item.key);
    for (const alias of item.aliases) consider(item.entry.name, alias.key, alias.alias);
  }

  const typed = query.trim();
  return [...best.values()]
    .filter((suggestion) => suggestion.name !== typed)
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name, "fr"))
    .slice(0, limit)
    .map(({ name, hint, known: isKnown }) => ({ name, hint, known: isKnown }));
}
