/**
 * Apports nutritionnels suivis par l'application, pour une portion
 * (plat) ou une journée (objectif, total). Mêmes clés partout pour
 * pouvoir boucler dessus (formulaire, totaux, détails du jour).
 */
export type MacroKey = "calories" | "proteinG" | "carbsG" | "fatG";

export type Macros = Record<MacroKey, number>;

/** `null` = non renseigné (distinct de 0). */
export type NullableMacros = Record<MacroKey, number | null>;

export interface MacroInfo {
  key: MacroKey;
  /** Libellé complet (« Protéines »). */
  label: string;
  /** Unité affichée après la valeur. */
  unit: string;
  /** Libellé court pour les totaux du planning (« g prot. »). */
  shortUnit: string;
  /** Décimales conservées à la saisie et à l'affichage. */
  decimals: number;
}

export const MACROS: readonly MacroInfo[] = [
  { key: "calories", label: "Calories", unit: "kcal", shortUnit: "kcal", decimals: 0 },
  { key: "proteinG", label: "Protéines", unit: "g", shortUnit: "g prot.", decimals: 1 },
  { key: "carbsG", label: "Glucides", unit: "g", shortUnit: "g gluc.", decimals: 1 },
  { key: "fatG", label: "Lipides", unit: "g", shortUnit: "g lip.", decimals: 1 },
];

export const EMPTY_MACROS: NullableMacros = {
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
};

export function hasAnyMacro(values: NullableMacros): boolean {
  return MACROS.some(({ key }) => values[key] !== null);
}

/** numeric(6,1) : PostgREST peut le renvoyer sous forme de chaîne. */
export function toNumberOrNull(value: number | string | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}
