"use client";

import { useMemo, useState } from "react";
import { suggestIngredients, suggestedIngredientName } from "./matching";

/**
 * Champ de saisie d'un ingrédient, partagé par le formulaire de plat et
 * les courses supplémentaires :
 * - en tapant, propose les ingrédients déjà utilisés et ceux du catalogue,
 *   y compris par un autre nom (« djej » fait remonter Poulet) ;
 * - une fois le champ quitté, si le texte ressemble à un ingrédient du
 *   catalogue sous un autre nom, propose de le renommer.
 * Le texte libre reste toujours possible : c'est alors un nouvel ingrédient.
 */
export function IngredientInput({
  id,
  value,
  onChange,
  knownNames,
  placeholder,
  ariaLabel,
  className = "",
  renameLabel = (name) => `Tu voulais dire « ${name} » ?`,
  onAcceptRename,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Ingrédients déjà utilisés par l'utilisateur. */
  knownNames: readonly string[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Texte du bouton qui propose le nom du catalogue. */
  renameLabel?: (name: string) => string;
  /** Appelé quand le nom proposé est accepté ; par défaut, remplace simplement le texte. */
  onAcceptRename?: (name: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(
    () => (focused ? suggestIngredients(value, knownNames) : []),
    [focused, value, knownNames]
  );
  const rename = useMemo(() => (focused ? null : suggestedIngredientName(value)), [focused, value]);

  return (
    <div className={`autocomplete ${className}`}>
      <input
        id={id}
        className="input"
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
      />
      {suggestions.length > 0 ? (
        <ul className="autocomplete-list">
          {suggestions.map((suggestion) => (
            <li key={suggestion.name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(suggestion.name);
                  setFocused(false);
                }}
              >
                <span>{suggestion.name}</span>
                {suggestion.hint ? (
                  <span className="autocomplete-hint">{suggestion.hint}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {rename ? (
        <button
          type="button"
          className="name-suggestion"
          onClick={() => (onAcceptRename ?? onChange)(rename.entry.name)}
        >
          {renameLabel(rename.entry.name)}
        </button>
      ) : null}
    </div>
  );
}
