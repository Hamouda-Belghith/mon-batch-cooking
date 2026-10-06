"use client";

import type { MealSlot } from "@/lib/supabase/database.types";
import { useDragDrop } from "@/lib/useDragDrop";

/** Une case du planning. */
export interface CellRef {
  date: string;
  mealSlot: MealSlot;
}

export function cellKey(cell: CellRef): string {
  return `${cell.date}|${cell.mealSlot}`;
}

function parseCellKey(key: string): CellRef {
  const [date, mealSlot] = key.split("|");
  return { date, mealSlot: mealSlot as MealSlot };
}

/** Glisser-déposer des repas entre les cases du planning (voir `useDragDrop`). */
export function useMealDrag({
  enabled,
  onDrop,
}: {
  enabled: boolean;
  onDrop: (source: CellRef, target: CellRef) => void;
}) {
  const dnd = useDragDrop({
    enabled,
    onDrop: (source, target) => onDrop(parseCellKey(source), parseCellKey(target)),
  });
  return {
    dragging: dnd.dragging
      ? { source: parseCellKey(dnd.dragging.key), label: dnd.dragging.label }
      : null,
    overKey: dnd.overKey,
    ghostRef: dnd.ghostRef,
    cellProps: (cell: CellRef, label: string | null) => dnd.itemProps(cellKey(cell), label),
  };
}
