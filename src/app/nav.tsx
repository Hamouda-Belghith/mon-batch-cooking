"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useSignOut } from "@/features/auth/AuthContext";
import { useShoppingList } from "@/features/shopping-list/useShoppingList";
import { Icon, type IconName } from "@/components/ui/Icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Planning", icon: "calendar" },
  { href: "/plats", label: "Plats", icon: "book" },
  { href: "/courses", label: "Courses", icon: "list" },
  { href: "/a-acheter", label: "À acheter", icon: "basket" },
];

/**
 * Nombre de lignes encore à acheter, comptées comme dans « À acheter »
 * (articles cochés fusionnés par ingrédient + unité, hors panier).
 */
function useToBuyCount(): number {
  const items = useShoppingList();
  return useMemo(() => {
    const lines = new Map<string, boolean>();
    for (const item of items ?? []) {
      if (!item.isChecked) continue;
      const key = `${item.ingredientId}-${item.unit}`;
      lines.set(key, (lines.get(key) ?? true) && item.isBought);
    }
    return [...lines.values()].filter((bought) => !bought).length;
  }, [items]);
}

/**
 * Barre du haut (marque + onglets sur grand écran) et barre d'onglets
 * en bas de l'écran sur téléphone, à portée de pouce.
 */
export function Nav() {
  const pathname = usePathname();
  const signOut = useSignOut();
  const toBuy = useToBuyCount();

  const tabs = LINKS.map((link) => {
    const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
    const badge = link.href === "/a-acheter" && toBuy > 0 ? toBuy : null;
    return { ...link, isActive, badge };
  });

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            Meal Planner
          </Link>
          <nav className="topbar-links" aria-label="Navigation principale">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`topbar-link ${tab.isActive ? "active" : ""}`}
                aria-current={tab.isActive ? "page" : undefined}
              >
                {tab.label}
                {tab.badge ? <span className="badge">{tab.badge}</span> : null}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className="btn btn-ghost btn-sm signout"
            onClick={() => void signOut()}
          >
            <Icon name="logout" size={18} />
            <span className="signout-label">Déconnexion</span>
          </button>
        </div>
      </header>

      <nav className="tabbar" aria-label="Navigation principale">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tabbar-link ${tab.isActive ? "active" : ""}`}
            aria-current={tab.isActive ? "page" : undefined}
          >
            <span className="tabbar-icon">
              <Icon name={tab.icon} size={22} />
              {tab.badge ? <span className="badge">{tab.badge}</span> : null}
            </span>
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
