"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Appui long avant de saisir un élément au doigt (en dessous : on fait défiler la page). */
const LONG_PRESS_MS = 350;
/** Au doigt, bouger plus que ça avant l'appui long = défilement, pas un glisser. */
const TOUCH_TOLERANCE_PX = 10;
/** À la souris, le glisser commence après ce déplacement (en dessous : simple clic). */
const MOUSE_THRESHOLD_PX = 6;
/** Près du haut / bas de l'écran, la page défile toute seule pendant le glisser. */
const AUTOSCROLL_EDGE_PX = 70;
const AUTOSCROLL_MAX_SPEED = 14;

interface Gesture {
  pointerId: number;
  isTouch: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  source: string;
  label: string;
  active: boolean;
  timer: number | null;
}

/**
 * Glisser-déposer à la souris et au doigt (Pointer Events, sans
 * dépendance). Le glisser HTML5 natif ne marche pas sur écran tactile,
 * d'où cette implémentation. Sert aux repas du Planning et aux semaines
 * de la vue Mois.
 *
 * - Souris : on saisit un élément en le déplaçant de quelques pixels.
 * - Doigt : appui long (le défilement normal reste possible), puis on
 *   glisse ; la page défile près des bords.
 *
 * Chaque élément a une clé texte (voir `itemProps`, attribut
 * `data-dnd`). `canDrop(source, cible)` filtre les cibles valides ;
 * `onDrop(source, cible)` est appelé quand on lâche sur l'une d'elles.
 */
export function useDragDrop({
  enabled,
  canDrop,
  onDrop,
}: {
  enabled: boolean;
  canDrop?: (source: string, target: string) => boolean;
  onDrop: (source: string, target: string) => void;
}) {
  const [dragging, setDragging] = useState<{ key: string; label: string } | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const overRef = useRef<string | null>(null);
  // Le clic qui suit un glisser ne doit pas ouvrir la modale de la case.
  const suppressClick = useRef(false);
  const frame = useRef<number | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const canDropRef = useRef(canDrop);
  canDropRef.current = canDrop;

  const moveGhost = useCallback(() => {
    const g = gesture.current;
    if (!g || !ghostRef.current) return;
    ghostRef.current.style.transform = `translate(${g.x + 12}px, ${g.y + 12}px)`;
  }, []);

  const updateOver = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    const el = document.elementFromPoint(g.x, g.y)?.closest<HTMLElement>("[data-dnd]");
    const key = el?.dataset.dnd ?? null;
    const next =
      key && key !== g.source && (canDropRef.current?.(g.source, key) ?? true) ? key : null;
    if (next !== overRef.current) {
      overRef.current = next;
      setOverKey(next);
    }
  }, []);

  const stopAutoscroll = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const autoscroll = useCallback(() => {
    const g = gesture.current;
    if (!g?.active) return;
    let dy = 0;
    if (g.y < AUTOSCROLL_EDGE_PX) {
      dy = -AUTOSCROLL_MAX_SPEED * (1 - g.y / AUTOSCROLL_EDGE_PX);
    } else if (g.y > window.innerHeight - AUTOSCROLL_EDGE_PX) {
      dy = AUTOSCROLL_MAX_SPEED * (1 - (window.innerHeight - g.y) / AUTOSCROLL_EDGE_PX);
    }
    if (dy !== 0) {
      window.scrollBy(0, dy);
      updateOver();
    }
    frame.current = requestAnimationFrame(autoscroll);
  }, [updateOver]);

  const activate = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    g.active = true;
    suppressClick.current = true;
    navigator.vibrate?.(20);
    setDragging({ key: g.source, label: g.label });
    document.body.classList.add("meal-dragging");
    // Le fantôme est rendu au prochain rendu : on le place dès qu'il existe.
    requestAnimationFrame(moveGhost);
    frame.current = requestAnimationFrame(autoscroll);
  }, [autoscroll, moveGhost]);

  const end = useCallback(
    (drop: boolean) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;
      if (g.timer !== null) window.clearTimeout(g.timer);
      stopAutoscroll();
      document.body.classList.remove("meal-dragging");
      const target = overRef.current;
      overRef.current = null;
      setOverKey(null);
      setDragging(null);
      if (g.active) {
        // Aucun clic ne suit parfois (lâcher hors d'une case) : on lève
        // le blocage juste après.
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        if (drop && target) onDropRef.current(g.source, target);
      }
    },
    [stopAutoscroll]
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const g = gesture.current;
      if (!g || e.pointerId !== g.pointerId) return;
      g.x = e.clientX;
      g.y = e.clientY;
      const dist = Math.hypot(g.x - g.startX, g.y - g.startY);
      if (!g.active) {
        if (g.isTouch) {
          if (dist > TOUCH_TOLERANCE_PX) end(false); // l'utilisateur fait défiler
        } else if (dist > MOUSE_THRESHOLD_PX) {
          activate();
        }
        return;
      }
      moveGhost();
      updateOver();
    }
    function onUp(e: PointerEvent) {
      if (gesture.current && e.pointerId === gesture.current.pointerId) end(true);
    }
    function onCancel(e: PointerEvent) {
      if (gesture.current && e.pointerId === gesture.current.pointerId) end(false);
    }
    // Une fois le repas saisi au doigt, la page ne doit plus défiler sous
    // le doigt (écouteur non passif pour pouvoir l'empêcher).
    function onTouchMove(e: TouchEvent) {
      if (gesture.current?.active) e.preventDefault();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && gesture.current) end(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      end(false);
    };
  }, [activate, end, moveGhost, updateOver]);

  useEffect(() => {
    if (!enabled) end(false);
  }, [enabled, end]);

  /**
   * Props à poser sur un élément. `label` = texte du fantôme pendant le
   * glisser ; `null` pour un élément qui peut recevoir mais pas être saisi.
   */
  function itemProps(key: string, label: string | null) {
    return {
      "data-dnd": key,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (!enabled || !label || gesture.current) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const isTouch = e.pointerType !== "mouse";
        gesture.current = {
          pointerId: e.pointerId,
          isTouch,
          startX: e.clientX,
          startY: e.clientY,
          x: e.clientX,
          y: e.clientY,
          source: key,
          label,
          active: false,
          timer: isTouch ? window.setTimeout(activate, LONG_PRESS_MS) : null,
        };
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
      // Appui long sur Android : pas de menu contextuel pendant un glisser.
      onContextMenu: (e: React.MouseEvent) => {
        if (gesture.current) e.preventDefault();
      },
    };
  }

  return { dragging, overKey, ghostRef, itemProps };
}
