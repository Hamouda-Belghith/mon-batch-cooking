import type { MealSlot } from "@/lib/supabase/database.types";
import type { CatalogIngredientName } from "@/features/ingredients/catalog";
import { UNITS } from "@/lib/units";

/**
 * Catalogue de plats connus, proposés à l'ajout dans « Mes plats ».
 *
 * Un plat du catalogue n'est jamais utilisé tel quel dans le planning :
 * l'ajouter crée une copie dans les plats de l'utilisateur (nom,
 * catégories, ingrédients), qu'il peut ensuite modifier librement.
 *
 * Règles d'écriture :
 * - Quantités pour 2 personnes.
 * - Les ingrédients ne peuvent être que des noms du catalogue d'ingrédients
 *   (vérifié à la compilation par `CatalogIngredientName`) : un plat ajouté
 *   depuis le catalogue est donc toujours « propre ».
 * - Les basiques du placard (sel, poivre, huile de cuisson, eau) et les
 *   épices courantes sont omis pour ne pas encombrer la liste de courses ;
 *   seules les épices qui font le plat sont listées (cumin du lablabi…).
 * - `aliases` : autres noms du même plat (derja, arabe, variantes), pour
 *   le retrouver et détecter qu'un plat saisi à la main existe déjà.
 */

type Unit = (typeof UNITS)[number];

export type Cuisine = "tunisienne" | "classique" | "monde";

export const CUISINE_LABELS: Record<Cuisine, string> = {
  tunisienne: "Tunisienne",
  classique: "Classique",
  monde: "Du monde",
};

export interface CatalogDishIngredient {
  readonly name: CatalogIngredientName;
  readonly quantity: number;
  readonly unit: Unit;
}

export interface CatalogDish {
  readonly name: string;
  readonly cuisine: Cuisine;
  readonly mealSlots: readonly MealSlot[];
  readonly aliases?: readonly string[];
  readonly ingredients: readonly CatalogDishIngredient[];
}

const i = (name: CatalogIngredientName, quantity: number, unit: Unit): CatalogDishIngredient => ({
  name,
  quantity,
  unit,
});

const MAIN: readonly MealSlot[] = ["lunch", "dinner"];

export const DISH_CATALOG: readonly CatalogDish[] = [
  // -------------------------------------------------------------------------
  // Tunisienne
  {
    name: "Couscous au poulet",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["kosksi djej", "kosksi bel djej", "couscous poulet", "كسكسي بالدجاج"],
    ingredients: [
      i("Couscous", 250, "g"), i("Poulet", 400, "g"), i("Pomme de terre", 2, "pièce"),
      i("Carotte", 2, "pièce"), i("Courgette", 1, "pièce"), i("Pois chiches", 50, "g"),
      i("Oignon", 1, "pièce"), i("Tomate", 1, "pièce"), i("Concentré de tomate", 2, "c. à soupe"),
      i("Piment vert", 2, "pièce"), i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Couscous à l'agneau",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["kosksi bel 3allouch", "kosksi l7am", "couscous viande", "couscous agneau", "كسكسي بالعلوش"],
    ingredients: [
      i("Couscous", 250, "g"), i("Agneau en morceaux", 400, "g"), i("Pomme de terre", 2, "pièce"),
      i("Carotte", 2, "pièce"), i("Courgette", 1, "pièce"), i("Navet", 1, "pièce"),
      i("Pois chiches", 50, "g"), i("Oignon", 1, "pièce"), i("Concentré de tomate", 2, "c. à soupe"),
      i("Piment vert", 2, "pièce"),
    ],
  },
  {
    name: "Couscous au poisson",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["kosksi bel 7out", "kosksi hout", "couscous hout", "كسكسي بالحوت"],
    ingredients: [
      i("Couscous", 250, "g"), i("Poisson", 500, "g"), i("Pomme de terre", 2, "pièce"),
      i("Carotte", 2, "pièce"), i("Courgette", 1, "pièce"), i("Oignon", 1, "pièce"),
      i("Tomate", 1, "pièce"), i("Concentré de tomate", 2, "c. à soupe"),
      i("Piment vert", 2, "pièce"), i("Citron", 1, "pièce"),
    ],
  },
  {
    name: "Couscous au kadid",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["kosksi bel 9did", "couscous kadid", "كسكسي بالقديد"],
    ingredients: [
      i("Couscous", 250, "g"), i("Kadid (viande séchée)", 150, "g"), i("Pois chiches", 50, "g"),
      i("Pomme de terre", 2, "pièce"), i("Oignon", 1, "pièce"), i("Concentré de tomate", 2, "c. à soupe"),
      i("Piment vert", 2, "pièce"),
    ],
  },
  {
    name: "Makrouna sauce rouge",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["ma9rouna", "ma9arouna", "makarouna", "makrouna salsa", "مقرونة"],
    ingredients: [
      i("Pâtes", 250, "g"), i("Ail", 2, "pièce"), i("Concentré de tomate", 2, "c. à soupe"),
      i("Harissa", 1, "c. à café"), i("Piment vert", 1, "pièce"),
    ],
  },
  {
    name: "Makrouna au poulet",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["ma9rouna djej", "ma9rouna poulet", "ma9arouna poulet", "makarouna poulet", "مقرونة بالدجاج"],
    ingredients: [
      i("Pâtes", 250, "g"), i("Poulet", 400, "g"), i("Oignon", 1, "pièce"), i("Ail", 2, "pièce"),
      i("Concentré de tomate", 2, "c. à soupe"), i("Piment vert", 1, "pièce"), i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Makrouna à l'agneau",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["ma9rouna l7am", "ma9arouna l7am", "makrouna l7am", "ma9rouna 3allouch", "مقرونة باللحم"],
    ingredients: [
      i("Pâtes", 250, "g"), i("Agneau en morceaux", 300, "g"), i("Oignon", 1, "pièce"),
      i("Ail", 2, "pièce"), i("Pois chiches", 30, "g"), i("Concentré de tomate", 2, "c. à soupe"),
      i("Piment vert", 1, "pièce"),
    ],
  },
  {
    name: "Makrouna au thon",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["ma9rouna thon", "ma9arouna thon", "pâtes au thon", "مقرونة بالتن"],
    ingredients: [
      i("Pâtes", 250, "g"), i("Thon en conserve", 1, "boîte"), i("Oignon", 1, "pièce"),
      i("Ail", 2, "pièce"), i("Concentré de tomate", 2, "c. à soupe"), i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Makrouna aux crevettes",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["ma9rouna crevette", "ma9rouna gambri", "pâtes aux crevettes"],
    ingredients: [
      i("Pâtes", 250, "g"), i("Crevettes", 300, "g"), i("Ail", 3, "pièce"),
      i("Concentré de tomate", 2, "c. à soupe"), i("Piment vert", 1, "pièce"), i("Persil", 1, "pièce"),
    ],
  },
  {
    name: "Makrouna au four",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["ma9rouna fel koucha", "makrouna fil koucha", "gratin de pâtes", "مقرونة في الكوشة"],
    ingredients: [
      i("Penne", 250, "g"), i("Viande hachée", 250, "g"), i("Œufs", 3, "pièce"),
      i("Fromage râpé", 100, "g"), i("Oignon", 1, "pièce"), i("Concentré de tomate", 1, "c. à soupe"),
    ],
  },
  {
    name: "Marqa de petits pois",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["jelbana", "mar9a jelbana", "marka jelbana", "جلبانة"],
    ingredients: [
      i("Petits pois", 400, "g"), i("Agneau en morceaux", 300, "g"), i("Pomme de terre", 1, "pièce"),
      i("Carotte", 1, "pièce"), i("Oignon", 1, "pièce"), i("Concentré de tomate", 2, "c. à soupe"),
    ],
  },
  {
    name: "Marqa de haricots blancs",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["loubya", "loubia", "mar9a loubya", "لوبيا"],
    ingredients: [
      i("Haricots blancs", 250, "g"), i("Agneau en morceaux", 300, "g"), i("Oignon", 1, "pièce"),
      i("Ail", 2, "pièce"), i("Concentré de tomate", 2, "c. à soupe"), i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Marqa de pois chiches",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["homs bel l7am", "7oms b l7am", "hommous b lahma", "حمص باللحم"],
    ingredients: [
      i("Pois chiches", 250, "g"), i("Agneau en morceaux", 300, "g"), i("Oignon", 1, "pièce"),
      i("Ail", 2, "pièce"), i("Concentré de tomate", 2, "c. à soupe"), i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Marqa de blettes",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["mar9a sel9", "sel9", "سلق"],
    ingredients: [
      i("Blettes", 500, "g"), i("Agneau en morceaux", 300, "g"), i("Pois chiches", 80, "g"),
      i("Oignon", 1, "pièce"), i("Concentré de tomate", 2, "c. à soupe"),
    ],
  },
  {
    name: "Marqa de gombo",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["gnawia", "mar9a gnawia", "قناوية"],
    ingredients: [
      i("Gombo", 300, "g"), i("Agneau en morceaux", 300, "g"), i("Oignon", 1, "pièce"),
      i("Ail", 2, "pièce"), i("Concentré de tomate", 2, "c. à soupe"),
    ],
  },
  {
    name: "Boulettes de kefta en sauce",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["kefta", "mar9a kefta", "كفتة"],
    ingredients: [
      i("Viande hachée", 400, "g"), i("Oignon", 1, "pièce"), i("Persil", 1, "pièce"),
      i("Œufs", 1, "pièce"), i("Chapelure", 30, "g"), i("Pomme de terre", 2, "pièce"),
      i("Concentré de tomate", 2, "c. à soupe"),
    ],
  },
  {
    name: "Kafteji",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["كفتاجي", "kaftaji"],
    ingredients: [
      i("Pomme de terre", 2, "pièce"), i("Courgette", 1, "pièce"), i("Poivron", 1, "pièce"),
      i("Piment vert", 2, "pièce"), i("Tomate", 2, "pièce"), i("Œufs", 2, "pièce"),
    ],
  },
  {
    name: "Ojja merguez",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["3ejja merguez", "ojja", "عجة", "ojja mergaz"],
    ingredients: [
      i("Merguez", 300, "g"), i("Œufs", 4, "pièce"), i("Poivron", 1, "pièce"), i("Piment vert", 1, "pièce"),
      i("Tomate", 2, "pièce"), i("Ail", 2, "pièce"), i("Concentré de tomate", 1, "c. à soupe"),
      i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Ojja aux crevettes",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["3ejja crevette", "ojja gambri"],
    ingredients: [
      i("Crevettes", 300, "g"), i("Œufs", 4, "pièce"), i("Tomate", 2, "pièce"), i("Ail", 2, "pièce"),
      i("Piment vert", 1, "pièce"), i("Concentré de tomate", 1, "c. à soupe"), i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Chakchouka",
    cuisine: "tunisienne",
    mealSlots: ["breakfast", "lunch", "dinner"],
    aliases: ["شكشوكة", "shakshuka", "tchektchouka"],
    ingredients: [
      i("Poivron", 2, "pièce"), i("Piment vert", 1, "pièce"), i("Tomate", 3, "pièce"),
      i("Oignon", 1, "pièce"), i("Ail", 2, "pièce"), i("Œufs", 4, "pièce"),
    ],
  },
  {
    name: "Lablabi",
    cuisine: "tunisienne",
    mealSlots: ["breakfast", "lunch", "dinner"],
    aliases: ["لبلابي", "lablebi"],
    ingredients: [
      i("Pois chiches", 250, "g"), i("Pain", 1, "pièce"), i("Ail", 3, "pièce"), i("Citron", 1, "pièce"),
      i("Œufs", 2, "pièce"), i("Thon en conserve", 1, "boîte"), i("Cumin", 2, "c. à café"),
      i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Chorba frik",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["chorba", "شربة فريك", "soupe frik"],
    ingredients: [
      i("Frik", 80, "g"), i("Agneau en morceaux", 200, "g"), i("Oignon", 1, "pièce"), i("Tomate", 1, "pièce"),
      i("Pois chiches", 40, "g"), i("Céleri", 1, "pièce"), i("Persil", 1, "pièce"),
      i("Concentré de tomate", 1, "c. à soupe"),
    ],
  },
  {
    name: "Chorba langues d'oiseau",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["chorba lsen 3asfour", "chorba poulet", "شربة لسان عصفور"],
    ingredients: [
      i("Langues d'oiseau", 80, "g"), i("Poulet", 200, "g"), i("Oignon", 1, "pièce"),
      i("Pois chiches", 40, "g"), i("Persil", 1, "pièce"), i("Citron", 1, "pièce"),
      i("Concentré de tomate", 1, "c. à soupe"),
    ],
  },
  {
    name: "Brik à l'œuf",
    cuisine: "tunisienne",
    mealSlots: ["lunch", "snack", "dinner"],
    aliases: ["brik", "brick", "بريك", "brik thon"],
    ingredients: [
      i("Feuilles de brick", 2, "pièce"), i("Œufs", 2, "pièce"), i("Thon en conserve", 1, "boîte"),
      i("Pomme de terre", 1, "pièce"), i("Persil", 1, "pièce"),
    ],
  },
  {
    name: "Tajine tunisien au poulet",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["tajine", "tajine djej", "طاجين", "tarte tajine"],
    ingredients: [
      i("Poulet", 300, "g"), i("Œufs", 6, "pièce"), i("Fromage râpé", 100, "g"),
      i("Pomme de terre", 1, "pièce"), i("Oignon", 1, "pièce"), i("Persil", 1, "pièce"),
    ],
  },
  {
    name: "Tajine malsouka",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["طاجين ملسوقة"],
    ingredients: [
      i("Feuilles de brick", 6, "pièce"), i("Poulet", 300, "g"), i("Œufs", 4, "pièce"),
      i("Fromage râpé", 100, "g"), i("Oignon", 1, "pièce"), i("Persil", 1, "pièce"),
    ],
  },
  {
    name: "Mloukhia",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["ملوخية", "mloukhiya"],
    ingredients: [
      i("Mloukhia", 80, "g"), i("Bœuf en morceaux", 400, "g"), i("Ail", 3, "pièce"), i("Laurier", 2, "pièce"),
    ],
  },
  {
    name: "Kamounia",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["كمونية", "kammounia"],
    ingredients: [
      i("Bœuf en morceaux", 400, "g"), i("Ail", 4, "pièce"), i("Cumin", 2, "c. à café"),
      i("Concentré de tomate", 1, "c. à soupe"), i("Persil", 1, "pièce"),
    ],
  },
  {
    name: "Mosli d'agneau",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["mosli", "مصلي", "mosli l7am", "agneau au four"],
    ingredients: [
      i("Agneau en morceaux", 600, "g"), i("Pomme de terre", 4, "pièce"), i("Tomate", 2, "pièce"),
      i("Oignon", 1, "pièce"), i("Ail", 3, "pièce"), i("Piment vert", 2, "pièce"),
    ],
  },
  {
    name: "Mosli de poisson",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["mosli hout", "poisson au four", "حوت في الكوشة"],
    ingredients: [
      i("Dorade", 2, "pièce"), i("Pomme de terre", 3, "pièce"), i("Tomate", 2, "pièce"),
      i("Citron", 1, "pièce"), i("Ail", 3, "pièce"), i("Persil", 1, "pièce"),
    ],
  },
  {
    name: "Poisson grillé",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["hout mechwi", "حوت مشوي", "poisson mechwi"],
    ingredients: [i("Dorade", 2, "pièce"), i("Citron", 1, "pièce"), i("Persil", 1, "pièce")],
  },
  {
    name: "Sardines au four",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["sardine fel koucha", "sardine au four"],
    ingredients: [
      i("Sardine", 500, "g"), i("Tomate", 2, "pièce"), i("Ail", 2, "pièce"), i("Persil", 1, "pièce"),
      i("Citron", 1, "pièce"), i("Piment vert", 1, "pièce"),
    ],
  },
  {
    name: "Rouz jerbi",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["roz jerbi", "riz djerbien", "riz à la djerbienne", "رز جربي"],
    ingredients: [
      i("Riz", 200, "g"), i("Poulet", 300, "g"), i("Épinards", 150, "g"), i("Pois chiches", 50, "g"),
      i("Oignon", 1, "pièce"), i("Persil", 1, "pièce"), i("Concentré de tomate", 1, "c. à soupe"),
    ],
  },
  {
    name: "Mhamsa au poulet",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["m7amsa", "mhamsa", "محمصة"],
    ingredients: [
      i("Mhamsa", 200, "g"), i("Poulet", 300, "g"), i("Oignon", 1, "pièce"), i("Pois chiches", 40, "g"),
      i("Concentré de tomate", 2, "c. à soupe"),
    ],
  },
  {
    name: "Nouasser au poulet",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["nwasser", "نواصر"],
    ingredients: [
      i("Nouasser", 200, "g"), i("Poulet", 300, "g"), i("Oignon", 1, "pièce"), i("Pois chiches", 40, "g"),
    ],
  },
  {
    name: "Borghol à la viande",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["borghol bel l7am", "borghol", "برغل"],
    ingredients: [
      i("Boulgour", 200, "g"), i("Agneau en morceaux", 300, "g"), i("Oignon", 1, "pièce"),
      i("Pois chiches", 50, "g"), i("Concentré de tomate", 2, "c. à soupe"),
    ],
  },
  {
    name: "Makloub au poulet",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["makloub", "مقلوب", "makloub escalope"],
    ingredients: [
      i("Pâte à pain", 2, "pièce"), i("Escalope de poulet", 250, "g"), i("Mozzarella", 100, "g"),
      i("Frites surgelées", 200, "g"), i("Salade verte", 1, "pièce"), i("Harissa", 1, "c. à café"),
    ],
  },
  {
    name: "Salade méchouia",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["slata mechwiya", "mechouia", "mechwia", "سلاطة مشوية"],
    ingredients: [
      i("Poivron", 2, "pièce"), i("Piment vert", 3, "pièce"), i("Tomate", 3, "pièce"), i("Oignon", 1, "pièce"),
      i("Ail", 2, "pièce"), i("Thon en conserve", 1, "boîte"), i("Œufs", 2, "pièce"), i("Citron", 1, "pièce"),
    ],
  },
  {
    name: "Salade tunisienne",
    cuisine: "tunisienne",
    mealSlots: MAIN,
    aliases: ["slata tounsia", "slata 3arbi", "سلاطة تونسية"],
    ingredients: [
      i("Tomate", 2, "pièce"), i("Concombre", 1, "pièce"), i("Oignon", 1, "pièce"), i("Piment vert", 1, "pièce"),
      i("Thon en conserve", 1, "boîte"), i("Œufs", 2, "pièce"), i("Olives noires", 30, "g"),
    ],
  },
  {
    name: "Bsissa",
    cuisine: "tunisienne",
    mealSlots: ["breakfast", "snack"],
    aliases: ["بسيسة", "bsisa"],
    ingredients: [
      i("Bsissa", 80, "g"), i("Huile d'olive", 2, "c. à soupe"), i("Miel", 20, "g"), i("Dattes", 40, "g"),
    ],
  },
  {
    name: "Assida zgougou",
    cuisine: "tunisienne",
    mealSlots: ["breakfast", "snack"],
    aliases: ["assida", "3assida zgougou", "عصيدة زقوقو"],
    ingredients: [
      i("Zgougou", 250, "g"), i("Farine", 100, "g"), i("Sucre", 150, "g"), i("Lait", 0.5, "l"),
      i("Crème fraîche", 20, "cl"), i("Amandes", 50, "g"),
    ],
  },

  // -------------------------------------------------------------------------
  // Classique
  {
    name: "Riz au poulet",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["rouz djej", "riz poulet", "poulet riz", "رز بالدجاج"],
    ingredients: [
      i("Riz", 200, "g"), i("Poulet", 300, "g"), i("Oignon", 1, "pièce"), i("Carotte", 1, "pièce"),
      i("Bouillon cube", 1, "pièce"),
    ],
  },
  {
    name: "Poulet rôti et pommes de terre",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["poulet rôti", "poulet au four", "djej fel koucha"],
    ingredients: [
      i("Poulet entier", 1, "pièce"), i("Pomme de terre", 4, "pièce"), i("Ail", 4, "pièce"), i("Citron", 1, "pièce"),
    ],
  },
  {
    name: "Escalope panée",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["escalope pané", "escalope panné", "schnitzel"],
    ingredients: [
      i("Escalope de poulet", 300, "g"), i("Œufs", 1, "pièce"), i("Chapelure", 60, "g"), i("Farine", 30, "g"),
    ],
  },
  {
    name: "Escalope à la crème et aux champignons",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["escalope sauce champignon", "escalope champignon", "escalope à la crème"],
    ingredients: [
      i("Escalope de poulet", 300, "g"), i("Champignon", 200, "g"), i("Crème fraîche", 20, "cl"),
      i("Oignon", 1, "pièce"), i("Ail", 1, "pièce"),
    ],
  },
  {
    name: "Escalope grillée et salade",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["escalope salade", "poulet grillé salade"],
    ingredients: [
      i("Escalope de poulet", 300, "g"), i("Salade verte", 1, "pièce"), i("Tomate", 2, "pièce"),
      i("Concombre", 1, "pièce"), i("Citron", 1, "pièce"),
    ],
  },
  {
    name: "Poêlée de poulet aux légumes",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["escalope légumes", "poulet légumes", "poulet aux légumes"],
    ingredients: [
      i("Escalope de poulet", 300, "g"), i("Courgette", 1, "pièce"), i("Poivron", 1, "pièce"),
      i("Oignon", 1, "pièce"), i("Champignon", 150, "g"),
    ],
  },
  {
    name: "Pâtes bolognaise",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["spaghetti bolognaise", "bolognaise", "spaghetti bolo"],
    ingredients: [
      i("Spaghetti", 250, "g"), i("Viande hachée", 250, "g"), i("Tomates pelées", 1, "boîte"),
      i("Oignon", 1, "pièce"), i("Ail", 2, "pièce"), i("Carotte", 1, "pièce"), i("Parmesan", 40, "g"),
    ],
  },
  {
    name: "Pâtes carbonara à la dinde",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["carbonara", "pâtes carbonara"],
    ingredients: [
      i("Spaghetti", 250, "g"), i("Jambon de dinde", 150, "g"), i("Œufs", 2, "pièce"),
      i("Parmesan", 50, "g"), i("Crème liquide", 10, "cl"),
    ],
  },
  {
    name: "Pâtes au saumon",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["pâtes saumon", "tagliatelles au saumon"],
    ingredients: [
      i("Tagliatelles", 250, "g"), i("Saumon", 250, "g"), i("Crème liquide", 20, "cl"),
      i("Citron", 1, "pièce"), i("Aneth", 1, "pièce"),
    ],
  },
  {
    name: "Lasagnes à la bolognaise",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["lasagne", "lasagnes"],
    ingredients: [
      i("Feuilles de lasagne", 250, "g"), i("Viande hachée", 400, "g"), i("Tomates pelées", 1, "boîte"),
      i("Oignon", 1, "pièce"), i("Ail", 2, "pièce"), i("Lait", 0.5, "l"), i("Beurre", 40, "g"),
      i("Farine", 40, "g"), i("Fromage râpé", 100, "g"),
    ],
  },
  {
    name: "Gratin dauphinois",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["gratin de pommes de terre", "gratin patate"],
    ingredients: [
      i("Pomme de terre", 0.8, "kg"), i("Crème liquide", 20, "cl"), i("Lait", 0.25, "l"),
      i("Ail", 1, "pièce"), i("Fromage râpé", 60, "g"),
    ],
  },
  {
    name: "Gratin d'aubergines",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["gratin aubergine", "aubergines à la parmesane"],
    ingredients: [
      i("Aubergine", 2, "pièce"), i("Sauce tomate", 1, "pièce"), i("Mozzarella", 125, "g"), i("Parmesan", 30, "g"),
    ],
  },
  {
    name: "Hachis parmentier",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["hachis"],
    ingredients: [
      i("Pomme de terre", 0.8, "kg"), i("Viande hachée", 400, "g"), i("Oignon", 1, "pièce"),
      i("Lait", 0.15, "l"), i("Beurre", 30, "g"), i("Fromage râpé", 60, "g"),
    ],
  },
  {
    name: "Steak frites",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["steak frite"],
    ingredients: [i("Steak", 300, "g"), i("Frites surgelées", 400, "g"), i("Salade verte", 1, "pièce")],
  },
  {
    name: "Saumon au four et riz",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["saumon riz", "saumon mechwi", "saumon grillé"],
    ingredients: [
      i("Saumon", 300, "g"), i("Riz", 150, "g"), i("Citron", 1, "pièce"), i("Brocoli", 1, "pièce"),
    ],
  },
  {
    name: "Quiche à la dinde",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["quiche", "quiche lorraine"],
    ingredients: [
      i("Pâte brisée", 1, "pièce"), i("Œufs", 3, "pièce"), i("Crème liquide", 20, "cl"),
      i("Jambon de dinde", 150, "g"), i("Fromage râpé", 80, "g"),
    ],
  },
  {
    name: "Pizza maison",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["pizza"],
    ingredients: [
      i("Pâte à pizza", 1, "pièce"), i("Sauce tomate", 1, "pièce"), i("Mozzarella", 125, "g"),
      i("Champignon", 100, "g"), i("Olives noires", 30, "g"),
    ],
  },
  {
    name: "Burger maison",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["burger", "hamburger", "cheeseburger"],
    ingredients: [
      i("Pain burger", 2, "pièce"), i("Steak haché", 2, "pièce"), i("Cheddar", 40, "g"), i("Tomate", 1, "pièce"),
      i("Oignon rouge", 1, "pièce"), i("Salade verte", 1, "pièce"), i("Frites surgelées", 300, "g"),
    ],
  },
  {
    name: "Croque-monsieur",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["croque"],
    ingredients: [
      i("Pain de mie", 1, "pièce"), i("Jambon de dinde", 100, "g"), i("Emmental", 80, "g"), i("Beurre", 20, "g"),
    ],
  },
  {
    name: "Salade César",
    cuisine: "classique",
    mealSlots: MAIN,
    aliases: ["salade cesar", "caesar"],
    ingredients: [
      i("Salade verte", 1, "pièce"), i("Escalope de poulet", 250, "g"), i("Parmesan", 30, "g"), i("Pain", 1, "pièce"),
    ],
  },
  {
    name: "Soupe de légumes",
    cuisine: "classique",
    mealSlots: ["dinner"],
    aliases: ["velouté de légumes", "soupe"],
    ingredients: [
      i("Pomme de terre", 2, "pièce"), i("Carotte", 3, "pièce"), i("Poireau", 1, "pièce"),
      i("Courgette", 1, "pièce"), i("Oignon", 1, "pièce"), i("Bouillon cube", 1, "pièce"),
    ],
  },
  {
    name: "Omelette",
    cuisine: "classique",
    mealSlots: ["breakfast", "lunch", "dinner"],
    aliases: ["omelette au fromage"],
    ingredients: [i("Œufs", 4, "pièce"), i("Fromage râpé", 40, "g")],
  },
  {
    name: "Œufs brouillés",
    cuisine: "classique",
    mealSlots: ["breakfast"],
    ingredients: [i("Œufs", 4, "pièce"), i("Beurre", 10, "g"), i("Pain", 1, "pièce")],
  },
  {
    name: "Crêpes",
    cuisine: "classique",
    mealSlots: ["breakfast", "snack"],
    ingredients: [
      i("Farine", 150, "g"), i("Œufs", 2, "pièce"), i("Lait", 0.3, "l"), i("Sucre", 20, "g"), i("Beurre", 20, "g"),
    ],
  },
  {
    name: "Pancakes",
    cuisine: "classique",
    mealSlots: ["breakfast", "snack"],
    ingredients: [
      i("Farine", 150, "g"), i("Œufs", 1, "pièce"), i("Lait", 0.2, "l"), i("Sucre", 20, "g"),
      i("Levure chimique", 1, "pièce"), i("Beurre", 20, "g"),
    ],
  },
  {
    name: "Porridge",
    cuisine: "classique",
    mealSlots: ["breakfast"],
    aliases: ["overnight oats", "bouillie d'avoine"],
    ingredients: [i("Flocons d'avoine", 80, "g"), i("Lait", 0.4, "l"), i("Banane", 1, "pièce"), i("Miel", 20, "g")],
  },

  // -------------------------------------------------------------------------
  // Du monde
  {
    name: "Poulet au curry et riz",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["curry poulet", "poulet curry", "curry de poulet"],
    ingredients: [
      i("Escalope de poulet", 300, "g"), i("Riz basmati", 150, "g"), i("Lait de coco", 1, "boîte"),
      i("Oignon", 1, "pièce"), i("Ail", 2, "pièce"), i("Gingembre frais", 10, "g"), i("Curry", 2, "c. à café"),
    ],
  },
  {
    name: "Butter chicken",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["poulet au beurre", "murgh makhani"],
    ingredients: [
      i("Escalope de poulet", 400, "g"), i("Yaourt", 1, "pièce"), i("Crème liquide", 20, "cl"),
      i("Tomates pelées", 1, "boîte"), i("Beurre", 30, "g"), i("Oignon", 1, "pièce"), i("Ail", 3, "pièce"),
      i("Gingembre frais", 15, "g"), i("Garam masala", 2, "c. à café"), i("Riz basmati", 150, "g"),
    ],
  },
  {
    name: "Wok de poulet aux légumes",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["poulet asiat", "poulet asiatique", "wok poulet"],
    ingredients: [
      i("Escalope de poulet", 300, "g"), i("Nouilles asiatiques", 200, "g"), i("Poivron", 1, "pièce"),
      i("Carotte", 1, "pièce"), i("Oignon", 1, "pièce"), i("Sauce soja", 3, "c. à soupe"),
      i("Gingembre frais", 10, "g"), i("Ail", 2, "pièce"),
    ],
  },
  {
    name: "Riz cantonais",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["riz sauté", "riz frit"],
    ingredients: [
      i("Riz", 200, "g"), i("Œufs", 2, "pièce"), i("Petits pois", 100, "g"), i("Jambon de dinde", 100, "g"),
      i("Oignon vert", 1, "pièce"), i("Sauce soja", 2, "c. à soupe"),
    ],
  },
  {
    name: "Chili con carne",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["chili"],
    ingredients: [
      i("Viande hachée", 300, "g"), i("Haricots rouges", 1, "boîte"), i("Tomates pelées", 1, "boîte"),
      i("Oignon", 1, "pièce"), i("Poivron", 1, "pièce"), i("Cumin", 1, "c. à café"),
      i("Piment fort en poudre", 1, "c. à café"), i("Riz", 150, "g"),
    ],
  },
  {
    name: "Fajitas au poulet",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["fajitas", "wrap poulet", "tacos poulet"],
    ingredients: [
      i("Tortillas", 4, "pièce"), i("Escalope de poulet", 300, "g"), i("Poivron", 2, "pièce"),
      i("Oignon", 1, "pièce"), i("Crème fraîche", 10, "cl"), i("Avocat", 1, "pièce"),
    ],
  },
  {
    name: "Chawarma au poulet",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["chawarma", "shawarma", "شاورما"],
    ingredients: [
      i("Cuisses de poulet", 400, "g"), i("Pain pita", 2, "pièce"), i("Yaourt", 1, "pièce"), i("Ail", 2, "pièce"),
      i("Tomate", 1, "pièce"), i("Oignon", 1, "pièce"), i("Salade verte", 1, "pièce"),
    ],
  },
  {
    name: "Kabsa au poulet",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["rouz saoudi", "riz saoudien", "kabsa", "كبسة"],
    ingredients: [
      i("Riz basmati", 200, "g"), i("Poulet", 500, "g"), i("Oignon", 1, "pièce"), i("Tomate", 1, "pièce"),
      i("Carotte", 1, "pièce"), i("Concentré de tomate", 1, "c. à soupe"), i("Raisins secs", 30, "g"),
      i("Amandes", 30, "g"), i("Bharat", 2, "c. à café"),
    ],
  },
  {
    name: "Kumpir",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["kampir", "pomme de terre farcie", "patate farcie"],
    ingredients: [
      i("Pomme de terre", 2, "pièce"), i("Beurre", 30, "g"), i("Fromage râpé", 80, "g"),
      i("Maïs doux", 1, "boîte"), i("Olives noires", 30, "g"), i("Cornichons", 40, "g"),
    ],
  },
  {
    name: "Taboulé",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["tabouli", "salade boulgour", "salade bourghoul"],
    ingredients: [
      i("Boulgour", 150, "g"), i("Tomate", 2, "pièce"), i("Concombre", 1, "pièce"), i("Persil", 2, "pièce"),
      i("Menthe", 1, "pièce"), i("Citron", 2, "pièce"), i("Oignon vert", 1, "pièce"),
    ],
  },
  {
    name: "Houmous",
    cuisine: "monde",
    mealSlots: ["snack"],
    aliases: ["hommos", "hummus", "حمص بالطحينة"],
    ingredients: [
      i("Pois chiches en conserve", 1, "boîte"), i("Tahini", 2, "c. à soupe"), i("Citron", 1, "pièce"),
      i("Ail", 1, "pièce"),
    ],
  },
  {
    name: "Poké bowl au saumon",
    cuisine: "monde",
    mealSlots: MAIN,
    aliases: ["poke", "poke bowl", "bowl saumon"],
    ingredients: [
      i("Riz", 150, "g"), i("Saumon", 200, "g"), i("Avocat", 1, "pièce"), i("Concombre", 1, "pièce"),
      i("Sauce soja", 2, "c. à soupe"), i("Graines de sésame", 1, "c. à soupe"),
    ],
  },
];
