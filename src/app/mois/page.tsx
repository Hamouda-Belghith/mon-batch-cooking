import { redirect } from "next/navigation";

// Ancienne vue « Mois », remplacée par la vue « Cycle » (favoris, raccourcis PWA).
export default function MonthPage() {
  redirect("/cycle");
}
