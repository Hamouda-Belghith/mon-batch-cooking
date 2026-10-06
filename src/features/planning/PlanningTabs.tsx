"use client";

import Link from "next/link";

/** Bascule entre la vue Semaines (par défaut) et la vue Mois du planning. */
export function PlanningTabs({ active }: { active: "weeks" | "month" }) {
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
        href="/mois"
        className={`segment ${active === "month" ? "active" : ""}`}
        aria-current={active === "month" ? "page" : undefined}
      >
        Mois
      </Link>
    </nav>
  );
}
