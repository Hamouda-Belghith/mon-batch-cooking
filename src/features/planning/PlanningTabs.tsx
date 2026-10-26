"use client";

import Link from "next/link";

/** Bascule entre la vue Semaines (par défaut) et la vue Cycle du planning. */
export function PlanningTabs({ active }: { active: "weeks" | "cycle" }) {
  return (
    <nav className="segmented planning-tabs" aria-label="Vue du planning">
      <Link
        href="/"
        className={`segment ${active === "weeks" ? "active" : ""}`}
        aria-current={active === "weeks" ? "page" : undefined}
      >
        Semaines
      </Link>
      <Link
        href="/cycle"
        className={`segment ${active === "cycle" ? "active" : ""}`}
        aria-current={active === "cycle" ? "page" : undefined}
      >
        Cycle
      </Link>
    </nav>
  );
}
