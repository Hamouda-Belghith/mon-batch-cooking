"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** `sm` : confirmations ; `wide` : formulaires longs (plat). */
  size?: "sm" | "md" | "wide";
  /** @deprecated utiliser `size="wide"`. */
  wide?: boolean;
}

/** Modales ouvertes, de la plus ancienne à celle du dessus. */
const openStack: string[] = [];

/**
 * Fenêtre modale. Centrée sur grand écran, en feuille ancrée en bas sur
 * téléphone (plus facile à atteindre au pouce).
 */
export function Modal({ title, onClose, children, size = "md", wide = false }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const resolvedSize = wide ? "wide" : size;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Modales empilées (ex. confirmation au-dessus d'un formulaire) :
      // seule celle du dessus se ferme.
      if (e.key === "Escape" && openStack[openStack.length - 1] === titleId) onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, titleId]);

  useEffect(() => {
    openStack.push(titleId);
    const previous = document.activeElement as HTMLElement | null;
    // Focus dans la modale à l'ouverture, sauf si un champ s'en est déjà chargé.
    if (!panelRef.current?.contains(document.activeElement)) {
      panelRef.current?.focus();
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      openStack.splice(openStack.indexOf(titleId), 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [titleId]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`modal modal-${resolvedSize}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Fermer"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
