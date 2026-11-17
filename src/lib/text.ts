/*
 * Normalisation et comparaison de noms (plats, ingrédients).
 *
 * Fonctions pures, sans dépendance : utilisées par l'estimation des
 * apports (`features/nutrition/estimate.ts`) et par le rapprochement des
 * noms saisis à la main avec les noms connus (catalogues, plats et
 * ingrédients de l'utilisateur).
 */

/**
 * Minuscules, sans accents ni signes diacritiques arabes, variantes de
 * lettres unifiées (أ إ آ → ا, ة → ه, ى → ي, ڨ → ق…), ponctuation → espace.
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/ٱ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىی]/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/[ڨگ]/g, "ق")
    .replace(/ڤ/g, "ف")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Petits mots ignorés pour comparer deux noms (français et derja). */
const STOPWORDS = new Set([
  "de", "d", "du", "des", "la", "le", "les", "l", "a", "au", "aux", "en", "et", "avec",
  "b", "bel", "bl", "fel", "fil", "w",
]);

/**
 * Clé de comparaison : deux noms qui ont la même clé désignent la même
 * chose. Ignore la casse, les accents, la ponctuation, les petits mots
 * (« pâtes au saumon » = « pate saumon ») et le pluriel en -s/-x
 * (« tomates » = « tomate »).
 */
export function nameKey(name: string): string {
  return normalizeText(name)
    .split(" ")
    .filter((word) => word !== "" && !STOPWORDS.has(word))
    .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word))
    .join(" ");
}

/** Distance d'édition (Levenshtein) : nombre de lettres à changer, ajouter ou retirer. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

/**
 * Deux clés différentes mais assez proches pour être une faute de frappe :
 * aucune tolérance sous 5 lettres (« riz » ≠ « ris »), une lettre jusqu'à
 * 8, deux au-delà.
 */
export function isLikelyTypo(keyA: string, keyB: string): boolean {
  if (keyA === keyB) return false;
  const shortest = Math.min(keyA.length, keyB.length);
  const allowed = shortest <= 4 ? 0 : shortest <= 8 ? 1 : 2;
  return allowed > 0 && Math.abs(keyA.length - keyB.length) <= allowed && editDistance(keyA, keyB) <= allowed;
}

/**
 * Mise en forme d'un nom saisi : espaces superflus retirés, première
 * lettre en majuscule, le reste tel quel (« ma9rouna  poulet » →
 * « Ma9rouna poulet »).
 */
export function formatName(name: string): string {
  const compact = name.replace(/\s+/g, " ").trim();
  return compact.charAt(0).toLocaleUpperCase("fr") + compact.slice(1);
}
