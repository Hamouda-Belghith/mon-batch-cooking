import type { MealSlot } from "@/lib/supabase/database.types";
import { MACROS, type Macros } from "./types";

/*
 * Estimation des apports d'un plat (une portion) à partir de son nom,
 * écrit en arabe tunisien (« كسكسي بالعلوش »), en arabizi (« ma9rouna »)
 * ou en français.
 *
 * Pas d'IA ni d'API (budget 0 €, fonctionne hors-ligne) : un
 * dictionnaire de plats et d'aliments courants, avec leurs variantes
 * d'écriture, et des apports moyens par portion. Le résultat est un
 * ordre de grandeur, présenté comme une estimation modifiable.
 *
 * Principe :
 * 1. On repère la source de protéines (poulet, bœuf, poisson, thon…)
 *    dans le nom ou la description, sinon dans les ingrédients.
 * 2. On repère le plat de base (couscous, pâtes, ملوخية…) — un seul —
 *    et les éléments ajoutés (frites, salade, œufs, pain…).
 * 3. Déjeuner/dîner : ~180 g de viande par portion (habitude du foyer),
 *    du type repéré, sinon un mélange poulet/bœuf. Les plats dont la
 *    protéine est déjà comptée (œufs d'une عجة, pizza…) n'en reçoivent
 *    pas par défaut.
 *
 * Chaque texte est découpé : un passage reconnu est effacé avant de
 * chercher la suite, pour qu'un mot ne compte qu'une fois (« مرقاز »
 * ne doit pas aussi être lu comme « مرقة », « salade de fruits » comme
 * « salade »). L'ordre des listes compte donc : du plus précis au plus
 * général.
 */

// ---------------------------------------------------------------------------
// Normalisation et recherche de motifs

/**
 * Minuscules, sans accents ni signes diacritiques arabes, variantes de
 * lettres unifiées (أ إ آ → ا, ة → ه, ى → ي, ڨ → ق…), ponctuation → espace.
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/ٱ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىی]/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/[ڨگ]/g, "ق")
    .replace(/ڤ/g, "ف")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const ARABIC = "\\u0600-\\u06FF";
const ARABIC_LETTER = new RegExp(`[${ARABIC}]`);

interface CompiledPattern {
  regex: RegExp;
}

/**
 * Motifs :
 * - arabe : présent n'importe où dans un mot (« بالدجاج » contient
 *   « دجاج »), sauf préfixe `=` : mot entier, préfixes و ف ب ل ك ال
 *   admis (« بالتن » pour « تن », sans lire « بتنجان »).
 * - latin : début de mot à partir de 5 lettres (« poulet » → « poulets »),
 *   mot entier en dessous (« riz », « lait » sans « laitue ») ou avec `=`.
 *   Pluriel en s/x admis pour un mot entier.
 */
function compilePattern(raw: string): CompiledPattern {
  const whole = raw.startsWith("=");
  const text = normalizeText(whole ? raw.slice(1) : raw);
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (ARABIC_LETTER.test(text)) {
    if (!whole) return { regex: new RegExp(`()(${escaped})`) };
    return {
      regex: new RegExp(
        `(^|[^${ARABIC}])((?:و|ف)?(?:لل|(?:ب|ل|ك)?(?:ال)?)${escaped})(?=$|[^${ARABIC}])`
      ),
    };
  }

  const wholeWord = whole || text.length < 5;
  return {
    regex: new RegExp(
      `(^|[^a-z0-9])(${escaped}${wholeWord ? "(?:s|x)?(?=$|[^a-z0-9])" : ""})`
    ),
  };
}

/** Cherche le motif ; s'il est trouvé, renvoie le texte où il est effacé. */
function consume(text: string, pattern: CompiledPattern): string | null {
  const match = pattern.regex.exec(text);
  if (!match) return null;
  const start = match.index + match[1].length;
  const end = start + match[2].length;
  return text.slice(0, start) + " ".repeat(end - start) + text.slice(end);
}

// ---------------------------------------------------------------------------
// Données

function m(calories: number, proteinG: number, carbsG: number, fatG: number): Macros {
  return { calories, proteinG, carbsG, fatG };
}

interface ProteinSource {
  id: string;
  /** Libellé affiché dans l'explication (« poulet ≈ 180 g »). */
  label: string;
  patterns: string[];
  /** Apports pour 100 g (cru). */
  per100g: Macros;
  /** Famille : un terme général (« لحم ») s'efface devant un terme précis (« علوش »). */
  family: "volaille" | "rouge" | "mer";
  /** Terme général de sa famille (poulet, viande, poisson). */
  generic?: boolean;
  /** Portion plafond pour un déjeuner/dîner (ex. une boîte de thon). */
  portionMain?: number;
  /** Portion plafond ailleurs (petit-déjeuner, collation). */
  portionOther?: number;
}

const PROTEINS: ProteinSource[] = [
  {
    id: "poulet-maigre",
    family: "volaille",
    label: "blanc de poulet",
    patterns: [
      "escalope", "اسكالوب", "سكالوب", "blanc de poulet", "filet de poulet",
      "chich taouk", "شيش طاووق", "=dinde", "ديك رومي",
    ],
    per100g: m(110, 23, 0, 2),
  },
  {
    id: "poulet",
    family: "volaille",
    generic: true,
    label: "poulet",
    patterns: [
      "دجاج", "=جاج", "فروج", "poulet", "=poule", "=jej", "djej", "dajaj", "farrouj",
      "cuisse", "pilon", "=wings", "ailes de poulet",
    ],
    per100g: m(140, 21, 0, 6),
  },
  {
    id: "hache",
    family: "rouge",
    label: "viande hachée",
    patterns: [
      "steak hache", "viande hachee", "لحم مفروم", "مفروم", "كفته", "=كفتا", "kefta", "kafta",
      "kofta", "boulette", "hachee", "=hache",
    ],
    per100g: m(215, 18, 0, 15),
  },
  {
    id: "foie",
    family: "rouge",
    label: "foie",
    patterns: ["كبده", "=كبد", "foie", "kebda", "kibda", "=kbida"],
    per100g: m(135, 20, 4, 4),
  },
  {
    id: "merguez",
    family: "rouge",
    label: "merguez",
    patterns: ["مرقاز", "مرقز", "merguez", "mergaz"],
    per100g: m(290, 15, 1, 25),
    portionMain: 100,
    portionOther: 60,
  },
  {
    id: "charcuterie",
    family: "rouge",
    label: "charcuterie",
    patterns: [
      "سلامي", "كاشير", "مرتديلا", "jambon", "salami", "charcuterie", "pastrami",
      "cachir", "mortadelle", "lardon", "bacon",
    ],
    per100g: m(200, 15, 2, 15),
    portionMain: 80,
    portionOther: 40,
  },
  {
    id: "agneau",
    family: "rouge",
    label: "agneau",
    patterns: [
      "علوش", "mouton", "agneau", "=ghalmi", "3allouch", "l3allouch", "allouch", "cotelette",
      "gigot",
    ],
    per100g: m(230, 18, 0, 17),
  },
  {
    id: "abats",
    family: "rouge",
    label: "abats",
    patterns: ["دواره", "كرشه", "tripes", "abats", "douara"],
    per100g: m(100, 15, 0, 4.5),
  },
  {
    id: "boeuf",
    family: "rouge",
    label: "bœuf",
    patterns: [
      "بقري", "=عجل", "boeuf", "=beef", "=veau", "steak", "ستيك", "entrecote", "bavette",
      "rumsteck",
    ],
    per100g: m(170, 21, 0, 9),
  },
  {
    id: "viande",
    family: "rouge",
    generic: true,
    label: "viande",
    patterns: [
      "=لحم", "=لحمه", "قديد", "viande", "l7am", "=lham", "l7em", "=lhem", "kadid", "9did",
    ],
    per100g: m(190, 20, 0, 12),
  },
  {
    id: "fruits-de-mer",
    family: "mer",
    label: "fruits de mer",
    patterns: ["fruits de mer", "فواكه البحر", "فواكه بحر"],
    per100g: m(90, 17, 1.5, 1.5),
  },
  {
    id: "saumon",
    family: "mer",
    label: "saumon",
    patterns: ["saumon", "سلمون", "سالمون", "salmon"],
    per100g: m(200, 20, 0, 13),
  },
  {
    id: "sardine",
    family: "mer",
    label: "sardines",
    patterns: ["سردين", "sardine"],
    per100g: m(140, 20, 0, 7),
  },
  {
    id: "thon",
    family: "mer",
    label: "thon",
    patterns: ["=تن", "=تونه", "=تونا", "thon", "=ton", "=tonn", "tuna"],
    per100g: m(180, 26, 0, 8),
    portionMain: 100,
    portionOther: 60,
  },
  {
    id: "crevettes",
    family: "mer",
    label: "crevettes",
    patterns: ["قمبري", "جمبري", "قمرون", "crevette", "gambas", "=gambri", "9ambri"],
    per100g: m(90, 20, 0.5, 1),
  },
  {
    id: "calamar",
    family: "mer",
    label: "calamar / seiche",
    patterns: [
      "كلمار", "قلمار", "سبيده", "قرنيط", "calamar", "seiche", "poulpe", "=sbida", "=karnit",
    ],
    per100g: m(85, 16, 2, 1.5),
  },
  {
    id: "poisson",
    family: "mer",
    generic: true,
    label: "poisson",
    patterns: [
      "=حوت", "سمك", "poisson", "=7out", "=l7out", "=hout", "دوراد", "dorade", "قاروص", "=loup",
      "=bar", "merlan", "مرلان", "=colin", "cabillaud", "=sole", "تريليه", "pageot",
      "=mulet", "=بوري",
    ],
    per100g: m(110, 19, 0, 3.5),
  },
];

/** Viande d'un déjeuner/dîner dont le type n'est pas précisé : mi-poulet, mi-bœuf. */
const UNKNOWN_MEAT: ProteinSource = {
  id: "inconnue",
  family: "rouge",
  generic: true,
  label: "viande (type non précisé)",
  patterns: [],
  per100g: m(155, 21, 0, 7.5),
};

/** Portion de viande d'un déjeuner/dîner (150–200 g selon le foyer). */
const MAIN_MEAT_G = 180;
/** Portion d'une protéine citée dans un petit-déjeuner ou une collation. */
const OTHER_MEAT_G = 80;

interface FoodEntry {
  id: string;
  label: string;
  /** Un seul motif suffit. */
  patterns?: string[];
  /** Ou bien : un motif de chaque groupe (« pâtes » + « four »). */
  combo?: [string[], string[]];
  /** Apports d'une portion, sans la viande (comptée à part). */
  macros: Macros;
  /**
   * `base` : plat principal — un seul retenu (le premier de la liste).
   * `side` : élément qui s'ajoute (frites, œufs, yaourt…).
   */
  kind: "base" | "side";
  /** Se mange avec du pain (ajouté une fois). */
  bread?: boolean;
  /** Protéine déjà comptée dans le plat : pas de viande par défaut. */
  noDefaultMeat?: boolean;
  /** Viande par défaut quand aucune n'est citée. */
  defaultProtein?: string;
  /** Portion de viande pour ce plat (déjeuner/dîner), si différente de 180 g. */
  meatG?: number;
  /** Éléments déjà contenus dans le plat (ne pas les ajouter une 2e fois). */
  includes?: string[];
  /** Élément féculent (le repas a déjà son accompagnement). */
  starchy?: boolean;
  /** Élément de petit-déjeuner/collation (ne fait pas d'un repas un plat complet). */
  light?: boolean;
}

const BREAD = m(215, 7, 44, 1);

const PASTA = [
  "مقرون", "معكرون", "مكرون", "makrouna", "ma9rouna", "makarouna", "macaroni", "=pates",
  "pasta", "spaghetti", "penne", "coquillette",
];
const RICE = ["=رز", "=روز", "=ارز", "riz", "rouz", "=roz"];
const MILK = ["حليب", "=lait", "7lib", "=hlib"];
const SALAD = ["سلاط", "شلاط", "=سلطه", "salade", "slata", "salata", "=salad"];

const FOODS: FoodEntry[] = [
  // — Combinaisons et noms précis d'abord —
  {
    id: "pates-four",
    label: "Pâtes au four",
    combo: [PASTA, ["كوشه", "=فور", "فورنو", "four", "koucha", "gratin", "forno"]],
    macros: m(720, 32, 78, 29),
    kind: "base",
    starchy: true,
    meatG: 120,
    includes: ["oeufs", "fromage"],
  },
  {
    id: "riz-au-lait",
    label: "Riz au lait",
    combo: [RICE, MILK],
    macros: m(300, 8, 52, 7),
    kind: "base",
    starchy: true,
    noDefaultMeat: true,
    includes: ["lait"],
  },
  {
    id: "riz-djerbien",
    label: "Riz djerbien",
    patterns: ["رز جربي", "روز جربي", "جربي", "jerbi", "djerbi", "riz djerbien"],
    macros: m(580, 12, 92, 17),
    kind: "base",
    starchy: true,
  },
  {
    id: "salade-fruits",
    label: "Salade de fruits",
    patterns: ["salade de fruit", "سلاطه غلال", "سلاطه غله", "سلاطه فواكه", "سلطه فواكه"],
    macros: m(120, 1.5, 28, 0.5),
    kind: "side",
    light: true,
  },
  {
    id: "assiette-tunisienne",
    label: "Assiette tunisienne",
    patterns: ["صحن تونسي", "assiette tunisienne", "sa7n tounsi", "sahn tounsi"],
    macros: m(695, 11.5, 60, 42.5),
    kind: "base",
    starchy: true,
    defaultProtein: "thon",
    meatG: 60,
    includes: ["frites", "oeufs", "salade-mechouia", "salade"],
  },
  {
    id: "salade-mechouia",
    label: "Salade méchouia",
    combo: [SALAD, ["مشوي", "mechouia", "mechwia", "grillee"]],
    macros: m(195, 2.5, 10, 15),
    kind: "side",
  },
  {
    id: "salade-mechouia",
    label: "Salade méchouia",
    patterns: ["مشويه", "mechouia", "mechwia", "mechouiya", "mechwiya"],
    macros: m(195, 2.5, 10, 15),
    kind: "side",
  },
  {
    id: "frites",
    label: "frites",
    patterns: [
      "فريت", "بطاطا مقلي", "بطاطه مقلي", "frite", "chips", "batata ma9li", "batata maqli",
    ],
    macros: m(420, 5, 50, 22),
    kind: "side",
    starchy: true,
  },
  {
    id: "croissant",
    label: "viennoiserie",
    patterns: [
      "croissant", "كرواسو", "كرواسا", "pain au chocolat", "chocolatine", "viennoiserie",
    ],
    macros: m(260, 5, 30, 13),
    kind: "side",
    light: true,
  },
  {
    id: "gainer",
    label: "gainer",
    patterns: ["gainer"],
    macros: m(380, 25, 60, 4),
    kind: "side",
    light: true,
  },
  {
    id: "barre-proteinee",
    label: "barre protéinée",
    patterns: ["barre proteinee", "barre de proteine", "protein bar", "barre prot"],
    macros: m(200, 20, 20, 7),
    kind: "side",
    light: true,
  },
  {
    id: "barre",
    label: "barre de céréales",
    patterns: ["barre de cereale", "barre cereale", "=barre"],
    macros: m(130, 2, 20, 4.5),
    kind: "side",
    light: true,
  },
  {
    id: "beurre-cacahuete",
    label: "fruits secs",
    patterns: [
      "beurre de cacahuete", "لوز", "=جوز", "بندق", "فستق", "كاكاوي", "كاكوي", "amande",
      "=noix", "noisette", "cacahuete", "pistache", "fruits sec", "fruit sec", "oleagineux",
    ],
    macros: m(180, 6, 6, 15),
    kind: "side",
    light: true,
  },
  {
    id: "skyr",
    label: "skyr / fromage blanc",
    patterns: ["skyr", "fromage blanc", "yaourt grec", "yogourt grec", "greek", "=grec"],
    macros: m(120, 12, 6, 5),
    kind: "side",
    light: true,
  },
  {
    id: "cafe-lait",
    label: "café au lait",
    patterns: [
      "cafe au lait", "cafe creme", "capucin", "cappuccino", "latte", "direct", "ديراكت",
      "قهوه بالحليب", "قهوه حليب", "كابوسان", "كابتشينو",
    ],
    macros: m(70, 3.5, 6, 3.5),
    kind: "side",
    light: true,
  },

  // — Plats principaux —
  {
    id: "lasagne",
    label: "Lasagnes",
    patterns: ["لازاني", "lasagne", "lasagna"],
    macros: m(675, 24, 79, 28),
    kind: "base",
    starchy: true,
    defaultProtein: "hache",
    meatG: 120,
    includes: ["fromage"],
  },
  {
    id: "pizza",
    label: "Pizza",
    patterns: ["بيتز", "بيتسا", "pizza"],
    macros: m(750, 30, 90, 28),
    kind: "base",
    starchy: true,
    noDefaultMeat: true,
    meatG: 40,
    includes: ["fromage", "pain"],
  },
  {
    id: "burger",
    label: "Burger (viande comprise)",
    patterns: ["برقر", "برغر", "بورغر", "burger", "hamburger", "cheeseburger"],
    macros: m(550, 28, 42, 28),
    kind: "base",
    starchy: true,
    noDefaultMeat: true,
    meatG: 0,
    includes: ["fromage", "pain"],
  },
  {
    id: "wrap",
    label: "Chawarma / tacos / makloub (viande comprise)",
    patterns: [
      "شاورم", "شوارم", "chawarma", "shawarma", "chawerma", "tacos", "تاكوس", "kebab",
      "كباب", "makloub", "ma9loub", "مقلوب", "libanais", "durum", "=wrap",
    ],
    macros: m(750, 38, 70, 34),
    kind: "base",
    starchy: true,
    noDefaultMeat: true,
    meatG: 0,
    includes: ["pain", "frites"],
  },
  {
    id: "sandwich",
    label: "Sandwich",
    patterns: [
      "سندويت", "سندويش", "sandwich", "casse croute", "kaskrout", "كسكروت",
      "baguette farcie", "panini", "بانيني", "chapati", "شباتي", "fricasse", "فريكاسي",
      "فريكسي",
    ],
    macros: m(420, 12, 66, 12),
    kind: "base",
    starchy: true,
    noDefaultMeat: true,
    meatG: 80,
    includes: ["pain"],
  },
  {
    id: "couscous",
    label: "Couscous",
    patterns: [
      "كسكس", "بركوكش", "kosksi", "kousksi", "kouskous", "couscous", "ksksi", "kesksi",
      "kuskus", "kseksou", "berkoukech", "borkoukech",
    ],
    macros: m(620, 19, 93, 18),
    kind: "base",
    starchy: true,
  },
  {
    id: "mesfouf",
    label: "Mesfouf",
    patterns: ["مسفوف", "mesfouf", "masfouf", "msfouf", "seffa"],
    macros: m(475, 10, 83, 10),
    kind: "base",
    starchy: true,
    noDefaultMeat: true,
  },
  {
    id: "rechta",
    label: "Rechta / nouasser",
    patterns: ["رشته", "نواصر", "شعريه", "rechta", "nwasser", "nouasser", "vermicelle"],
    macros: m(580, 17, 85, 19.5),
    kind: "base",
    starchy: true,
  },
  {
    id: "pates",
    label: "Pâtes",
    patterns: [...PASTA, "tagliatelle", "fusilli", "nouille", "noodle", "carbonara", "bolognaise"],
    macros: m(530, 14, 78, 16.5),
    kind: "base",
    starchy: true,
  },
  {
    id: "mloukhia",
    label: "Mloukhia",
    patterns: ["ملوخي", "mloukhia", "mloukhiya", "mlou5ia", "molokhia", "mloukhya", "mlokhia"],
    macros: m(325, 5, 9, 30.5),
    kind: "base",
    bread: true,
    defaultProtein: "boeuf",
  },
  {
    id: "kamounia",
    label: "Kamounia",
    patterns: ["كمونيه", "كامونيه", "kamounia", "kammounia", "kamounya"],
    macros: m(220, 1, 7, 20),
    kind: "base",
    bread: true,
    defaultProtein: "boeuf",
  },
  {
    id: "kafteji",
    label: "Kafteji",
    patterns: ["كفتاجي", "كفتجي", "kafteji", "kaftaji"],
    macros: m(535, 18, 29, 36),
    kind: "base",
    bread: true,
    noDefaultMeat: true,
    includes: ["oeufs"],
  },
  {
    id: "ojja",
    label: "Ojja (œufs)",
    patterns: ["عجه", "=عجا", "ojja", "3ejja", "3ijja", "=oja"],
    macros: m(435, 23, 11, 32),
    kind: "base",
    bread: true,
    noDefaultMeat: true,
    includes: ["oeufs"],
  },
  {
    id: "chakchouka",
    label: "Chakchouka",
    patterns: ["شكشوك", "chakchouk", "shakshuka", "tchaktchouka", "chakchoka"],
    macros: m(385, 18, 16, 27),
    kind: "base",
    bread: true,
    noDefaultMeat: true,
    includes: ["oeufs"],
  },
  {
    id: "lablabi",
    label: "Lablabi",
    patterns: ["لبلاب", "lablabi", "leblebi", "lablebi"],
    macros: m(550, 25, 50, 26),
    kind: "base",
    bread: true,
    noDefaultMeat: true,
    includes: ["oeufs"],
  },
  {
    id: "tajine",
    label: "Tajine tunisien",
    patterns: ["طاجين", "طجين", "tajine", "tajin", "tagine"],
    macros: m(605, 36, 26, 39),
    kind: "base",
    meatG: 120,
    includes: ["oeufs", "fromage"],
  },
  {
    id: "dolma",
    label: "Légumes farcis (dolma)",
    patterns: ["دولم", "محشي", "مبطن", "dolma", "mahchi", "ma7chi", "farci", "mbatten"],
    macros: m(350, 5, 44, 15),
    kind: "base",
    bread: true,
    defaultProtein: "hache",
    meatG: 150,
  },
  {
    id: "osbane",
    label: "Osbane",
    patterns: ["عصبان", "osbane", "osban", "3osban"],
    macros: m(430, 8, 58, 16),
    kind: "base",
    defaultProtein: "abats",
    meatG: 150,
  },
  {
    id: "soupe",
    label: "Soupe / chorba",
    patterns: [
      "شربه", "=حسو", "حساء", "دويده", "حلالم", "فريك", "chorba", "chorb", "shorba",
      "soupe", "hsou", "7sou", "douida", "hlalem", "hlelem", "veloute", "=frik",
    ],
    macros: m(360, 11, 49, 12),
    kind: "base",
    meatG: 120,
  },
  {
    id: "jelbana",
    label: "Jelbana (petits pois)",
    patterns: ["جلبان", "jelbana", "jalbana", "jelbena", "petits pois", "petit pois"],
    macros: m(395, 13, 48, 16),
    kind: "base",
    bread: true,
  },
  {
    id: "haricots-verts",
    label: "Haricots verts",
    patterns: ["لوبيا خضرا", "لوبيه خضرا", "فاصوليا خضرا", "haricots verts", "haricot vert"],
    macros: m(230, 5, 16, 16),
    kind: "base",
    bread: true,
  },
  {
    id: "loubia",
    label: "Loubia (haricots blancs)",
    patterns: ["لوبي", "فاصولي", "loubia", "loubya", "lobia", "haricot", "flageolet"],
    macros: m(430, 18, 51, 16),
    kind: "base",
    bread: true,
  },
  {
    id: "lentilles",
    label: "Lentilles",
    patterns: ["=عدس", "lentille", "=adas", "3des", "3dess", "3adas"],
    macros: m(400, 19, 41, 16),
    kind: "base",
    bread: true,
  },
  {
    id: "pois-chiches",
    label: "Pois chiches",
    patterns: ["=حمص", "pois chiche", "hommos", "houmous", "houmos", "7ommos", "hummus"],
    macros: m(490, 19, 55, 20),
    kind: "base",
    bread: true,
  },
  {
    id: "puree",
    label: "Purée",
    patterns: ["بوريه", "=pure", "puree"],
    macros: m(300, 7, 46, 10),
    kind: "base",
    starchy: true,
  },
  {
    id: "gratin",
    label: "Gratin de pommes de terre",
    patterns: ["غراتان", "قراتان", "gratin"],
    macros: m(485, 21, 53, 20),
    kind: "base",
    starchy: true,
    includes: ["fromage"],
  },
  {
    id: "four",
    label: "Plat au four (pommes de terre, légumes)",
    patterns: ["كوشه", "=فور", "au four", "koucha", "forno", "روتي", "=roti"],
    macros: m(330, 5, 40, 15),
    kind: "base",
    starchy: true,
  },
  {
    id: "pommes-de-terre",
    label: "Pommes de terre",
    patterns: ["بطاط", "batata", "patate", "pomme de terre", "pommes de terre", "=pdt"],
    macros: m(370, 6, 50, 15),
    kind: "base",
    starchy: true,
  },
  {
    id: "riz",
    label: "Riz",
    patterns: [...RICE, "=ريز", "risotto", "biryani", "paella", "curry", "كاري"],
    macros: m(485, 9, 86, 11),
    kind: "base",
    starchy: true,
  },
  {
    id: "boulgour",
    label: "Boulgour",
    patterns: ["برغل", "بورغل", "borghol", "boulgour", "bulgur", "boulghour"],
    macros: m(470, 13.5, 77, 11.5),
    kind: "base",
    starchy: true,
  },
  {
    id: "grillades",
    label: "Grillades",
    patterns: [
      "grillade", "grille", "=مشوي", "شواء", "=شوي", "mechoui", "=mechwi", "barbecue", "=bbq",
      "brochette", "بروشات", "بروشيت",
    ],
    macros: m(140, 2, 9, 10),
    kind: "base",
    bread: true,
  },
  {
    id: "legumes",
    label: "Légumes",
    patterns: [
      "خضره", "خضار", "khodra", "5odra", "legume", "jardiniere", "ratatouille", "courgette",
      "aubergine", "=chou", "epinard", "brocoli", "=قرع", "بتنجان", "باذنجان", "بادنجان",
      "سبانخ", "=سلق", "شيفلور", "كرنب", "بروكلي", "بسباس",
    ],
    macros: m(225, 4, 15, 16),
    kind: "base",
  },
  {
    id: "marka",
    label: "Marka (ragoût)",
    patterns: [
      "مرقه", "=مرقا", "=مرق", "marka", "mar9a", "marqa", "ragout", "طبيخ", "tbikh",
      "شطيطح", "chtitha", "مثوم", "mthewem", "mtewem",
    ],
    macros: m(230, 3.5, 17, 16),
    kind: "base",
    bread: true,
  },

  // — Accompagnements et éléments ajoutés —
  {
    id: "salade",
    label: "salade",
    patterns: SALAD,
    macros: m(140, 2, 9, 10),
    kind: "side",
  },
  {
    id: "brik",
    label: "brik",
    patterns: ["بريك", "brik", "brick"],
    macros: m(310, 10, 24, 18),
    kind: "side",
    includes: ["oeufs"],
  },
  {
    id: "pane",
    label: "panure",
    patterns: ["panee", "=pane", "كريسبي", "crispy", "cordon bleu", "chapelure", "nugget"],
    macros: m(180, 4, 16, 11),
    kind: "side",
  },
  {
    id: "pain",
    label: "pain",
    patterns: [
      "خبز", "pain", "khobz", "5obz", "khobza", "baguette", "tabouna", "طابون", "=matlou3",
      "مطلوع",
    ],
    macros: BREAD,
    kind: "side",
    starchy: true,
  },
  {
    id: "mlewi",
    label: "mlewi / msemen",
    patterns: ["ملاوي", "ملوي", "مسمن", "مبسس", "mlewi", "mlawi", "msemen", "msamen", "mbesses"],
    macros: m(330, 7, 45, 13),
    kind: "side",
    starchy: true,
  },
  {
    id: "oeufs",
    label: "2 œufs",
    patterns: ["=عظم", "=بيض", "oeuf", "omelette", "omlette", "3dham", "=adham"],
    macros: m(160, 14, 1, 11),
    kind: "side",
  },
  {
    id: "fromage",
    label: "fromage",
    patterns: [
      "جبن", "فرماج", "فورماج", "fromage", "formage", "fourmaj", "=jben", "vache qui rit",
      "gruyere", "emmental", "mozzarella", "=feta", "ricotta",
    ],
    macros: m(100, 6, 1, 8),
    kind: "side",
  },
  {
    id: "bsissa",
    label: "bsissa",
    patterns: ["بسيس", "bsissa", "bsisa", "zmita", "زميط"],
    macros: m(370, 9, 48, 15),
    kind: "side",
    light: true,
  },
  {
    id: "assida",
    label: "assida",
    patterns: ["عصيد", "assida", "3assida", "zgougou", "زقوقو"],
    macros: m(470, 8, 62, 21),
    kind: "side",
    light: true,
  },
  {
    id: "yaourt",
    label: "yaourt",
    patterns: [
      "ياغرت", "ياغورت", "ياورت", "يوغرت", "زبادي", "yaourt", "yogourt", "yaourth",
      "yoghourt", "yogurt", "danone",
    ],
    macros: m(100, 5, 13, 4),
    kind: "side",
    light: true,
  },
  {
    id: "lben",
    label: "lben",
    patterns: ["=لبن", "رايب", "=lben", "leben", "rayeb", "=raib"],
    macros: m(100, 8, 11, 3),
    kind: "side",
    light: true,
  },
  {
    id: "avoine",
    label: "flocons d'avoine au lait",
    patterns: ["شوفان", "avoine", "flocon", "porridge", "=oat", "=oats", "gruau", "overnight"],
    macros: m(315, 14.5, 46, 7),
    kind: "side",
    light: true,
    includes: ["lait"],
  },
  {
    id: "cereales",
    label: "céréales au lait",
    patterns: ["cereale", "muesli", "granola", "cornflake", "corn flake", "سيريال"],
    macros: m(280, 11.5, 48, 6),
    kind: "side",
    light: true,
    includes: ["lait"],
  },
  {
    id: "lait",
    label: "lait",
    patterns: MILK,
    macros: m(115, 8, 12, 4),
    kind: "side",
    light: true,
  },
  {
    id: "cafe",
    label: "café / thé",
    patterns: ["=قهوه", "=cafe", "=the", "=شاي", "=تاي"],
    macros: m(20, 0, 5, 0),
    kind: "side",
    light: true,
  },
  {
    id: "whey",
    label: "shaker de protéines",
    patterns: ["whey", "proteine", "protein", "بروتين", "shaker", "isolat"],
    macros: m(120, 24, 3, 1.5),
    kind: "side",
    light: true,
  },
  {
    id: "crepe",
    label: "crêpes",
    patterns: ["كريب", "crepe", "pancake", "بنكيك", "gaufre", "waffle"],
    macros: m(280, 9, 38, 10),
    kind: "side",
    light: true,
  },
  {
    id: "beignet",
    label: "beignet",
    patterns: [
      "بمبالوني", "bambalouni", "beignet", "فطاير", "فطائر", "ftayer", "ftair", "sfenj",
      "donut", "doughnut",
    ],
    macros: m(380, 6, 45, 19),
    kind: "side",
    light: true,
  },
  {
    id: "chocolat",
    label: "pâte à tartiner",
    patterns: ["nutella", "نوتيلا", "pate a tartiner", "chocolat", "شكلاط", "=choco"],
    macros: m(110, 1, 12, 6),
    kind: "side",
    light: true,
  },
  {
    id: "beurre",
    label: "beurre",
    patterns: ["زبده", "=beurre", "zebda"],
    macros: m(75, 0, 0, 8),
    kind: "side",
    light: true,
  },
  {
    id: "confiture",
    label: "confiture",
    patterns: ["مربي", "confiture", "=confit"],
    macros: m(50, 0, 12, 0),
    kind: "side",
    light: true,
  },
  {
    id: "miel",
    label: "miel",
    patterns: ["=عسل", "=miel", "3sal", "=asal"],
    macros: m(60, 0, 16, 0),
    kind: "side",
    light: true,
  },
  {
    id: "huile",
    label: "huile d'olive",
    patterns: ["زيت", "=huile", "=zit", "zitoun", "olive"],
    macros: m(90, 0, 0, 10),
    kind: "side",
    light: true,
  },
  {
    id: "dattes",
    label: "dattes",
    patterns: ["=تمر", "دقله", "datte", "=tmar", "deglet"],
    macros: m(140, 1, 35, 0),
    kind: "side",
    light: true,
  },
  {
    id: "banane",
    label: "banane",
    patterns: ["=موز", "banane", "banana", "=mouz", "=banan"],
    macros: m(105, 1.3, 27, 0.4),
    kind: "side",
    light: true,
  },
  {
    id: "fruit",
    label: "fruit",
    patterns: [
      "تفاح", "برتقال", "بردقان", "=غله", "غلال", "فاكه", "فواكه", "=pomme", "orange",
      "mandarine", "clementine", "=kiwi", "fraise", "فراول", "melon", "pasteque", "دلاع",
      "بطيخ", "raisin", "=عنب", "=poire", "انجاص", "=peche", "خوخ", "=fruit", "ananas",
      "mangue", "compote",
    ],
    macros: m(90, 1, 22, 0.3),
    kind: "side",
    light: true,
  },
  {
    id: "jus",
    label: "jus / smoothie",
    patterns: ["عصير", "=jus", "smoothie", "3sir", "=asir", "milkshake"],
    macros: m(120, 1.5, 27, 0.5),
    kind: "side",
    light: true,
  },
  {
    id: "dessert",
    label: "dessert lacté",
    patterns: [
      "=flan", "فلان", "creme dessert", "creme caramel", "مهلبي", "mhalbia", "mhalbiya",
      "mousse", "panna cotta",
    ],
    macros: m(160, 4, 25, 5),
    kind: "side",
    light: true,
  },
  {
    id: "gateau",
    label: "gâteau / biscuits",
    patterns: [
      "gateau", "=cake", "كيك", "كعك", "بسكويت", "biscuit", "cookie", "مقروض", "makroudh",
      "baklawa", "بقلاو", "غريبه", "ghraiba", "brownie", "muffin", "gaufrette",
      "patisserie", "حلويات", "=حلو", "حلوي",
    ],
    macros: m(200, 3, 28, 9),
    kind: "side",
    light: true,
  },
];

/** Plats non reconnus : ordre de grandeur selon le moment de la journée. */
const FALLBACK = {
  main: m(530, 14, 70, 20),
  breakfast: m(400, 14, 50, 15),
  snack: m(250, 8, 30, 10),
};

// Compilation unique des motifs (au chargement du module).
interface Compiled<T> {
  entry: T;
  patterns: CompiledPattern[];
  combo?: [CompiledPattern[], CompiledPattern[]];
}

const COMPILED_PROTEINS: Compiled<ProteinSource>[] = PROTEINS.map((entry) => ({
  entry,
  patterns: entry.patterns.map(compilePattern),
}));

const COMPILED_FOODS: Compiled<FoodEntry>[] = FOODS.map((entry) => ({
  entry,
  patterns: (entry.patterns ?? []).map(compilePattern),
  combo: entry.combo
    ? [entry.combo[0].map(compilePattern), entry.combo[1].map(compilePattern)]
    : undefined,
}));

const PROTEIN_BY_ID = new Map(PROTEINS.map((p) => [p.id, p]));

/**
 * Entrées présentes dans le texte, dans l'ordre de la liste, chacune
 * une fois. Les passages reconnus sont effacés au fur et à mesure.
 */
function matchEntries<T extends { id: string }>(
  compiled: Compiled<T>[],
  input: string
): { matches: T[]; rest: string } {
  let text = input;
  const matches: T[] = [];
  for (const { entry, patterns, combo } of compiled) {
    let found = false;

    if (combo) {
      for (const first of combo[0]) {
        const afterFirst = consume(text, first);
        if (afterFirst === null) continue;
        for (const second of combo[1]) {
          const afterBoth = consume(afterFirst, second);
          if (afterBoth !== null) {
            text = afterBoth;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    for (const pattern of patterns) {
      // Tous les motifs de l'entrée sont effacés (« huile d'olive » = une fois).
      let next = consume(text, pattern);
      while (next !== null) {
        found = true;
        text = next;
        next = consume(text, pattern);
      }
    }

    if (found && !matches.some((m) => m.id === entry.id)) matches.push(entry);
  }
  return { matches, rest: text };
}

// ---------------------------------------------------------------------------
// Estimation

export interface DishEstimateInput {
  name: string;
  description?: string | null;
  /** Catégories du plat (déjeuner/dîner = repas principal). */
  mealSlots: readonly MealSlot[];
  /** Noms des ingrédients : servent à trouver la viande si le nom ne la cite pas. */
  ingredientNames?: readonly string[];
}

export interface DishEstimate {
  /** Apports estimés pour une portion (kcal à 10 près, grammes entiers). */
  macros: Macros;
  /** Ce qui a été reconnu, pour expliquer l'estimation. */
  parts: string[];
  /** false = rien de reconnu dans le nom : ordre de grandeur générique. */
  recognized: boolean;
}

function addScaled(total: Macros, values: Macros, factor = 1) {
  for (const { key } of MACROS) total[key] += values[key] * factor;
}

export function estimateDish(input: DishEstimateInput): DishEstimate {
  const isMain =
    input.mealSlots.length === 0 ||
    input.mealSlots.includes("lunch") ||
    input.mealSlots.includes("dinner");

  // 1. Protéines : d'abord dans le nom et la description, sinon dans
  //    les ingrédients.
  const nameText = normalizeText(`${input.name} ${input.description ?? ""}`);
  const proteinPass = matchEntries(COMPILED_PROTEINS, nameText);
  let proteins = proteinPass.matches;
  const ingredientText = normalizeText((input.ingredientNames ?? []).join(" | "));
  if (proteins.length === 0 && ingredientText) {
    proteins = matchEntries(COMPILED_PROTEINS, ingredientText).matches;
  }
  // « لحم علوش » = de l'agneau, pas agneau + viande.
  proteins = proteins.filter(
    (p) => !p.generic || !proteins.some((o) => o !== p && o.family === p.family && !o.generic)
  );

  // 2. Plat de base et éléments ajoutés, dans ce qui reste du nom.
  let foods = matchEntries(COMPILED_FOODS, proteinPass.rest).matches;
  let viaIngredients = false;
  if (foods.length === 0 && isMain && ingredientText) {
    // Nom non reconnu (« le plat de maman ») : les ingrédients peuvent
    // dire de quoi il s'agit (« pâtes », « riz »…), plat de base seulement.
    const base = matchEntries(COMPILED_FOODS, ingredientText).matches.find(
      (f) => f.kind === "base"
    );
    if (base) {
      foods = [base];
      viaIngredients = true;
    }
  }

  const included = new Set(foods.flatMap((f) => f.includes ?? []));
  const kept = foods.filter((f) => !included.has(f.id));
  const base = kept.find((f) => f.kind === "base");
  const sides = kept.filter((f) => f.kind === "side" && f.id !== "pain");
  // Pain : plat qui se mange avec (ملوخية…), pain cité, ou ragoût (« مرقة »)
  // sans féculent — pas pour un couscous dont la sauce s'appelle aussi مرقة.
  const stew = foods.some((f) => f.id === "marka") && !base?.starchy;
  let bread =
    !included.has("pain") &&
    (Boolean(base?.bread) || stew || kept.some((f) => f.id === "pain" || (f.kind === "side" && f.bread)));

  const total: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const parts: string[] = [];
  let recognized = true;
  let breadLabel = "pain";

  if (!base && sides.length === 0 && !bread && proteins.length === 0) {
    // Rien de reconnu : ordre de grandeur selon le moment du repas.
    recognized = false;
    const fallback = isMain
      ? FALLBACK.main
      : input.mealSlots.includes("breakfast")
        ? FALLBACK.breakfast
        : FALLBACK.snack;
    addScaled(total, fallback);
    parts.push("plat non reconnu : estimation générique");
  } else if (isMain && !base) {
    // Repas fait d'éléments (« escalope frites », « سلاطة بالتن ») : sans
    // féculent cité, on compte du pain pour l'accompagnement.
    const isMeal = proteins.length > 0 || sides.some((s) => !s.light);
    const hasStarch = bread || sides.some((s) => s.starchy);
    if (isMeal && !hasStarch) {
      bread = true;
      breadLabel = "pain (accompagnement supposé)";
    }
  }

  if (base) {
    addScaled(total, base.macros);
    parts.push(viaIngredients ? `${base.label} (d'après les ingrédients)` : base.label);
  }
  for (const side of sides) {
    addScaled(total, side.macros);
    parts.push(side.label);
  }
  if (bread) {
    addScaled(total, BREAD);
    parts.push(breadLabel);
  }

  // 3. Viande.
  const contextG = base?.meatG ?? (isMain ? MAIN_MEAT_G : OTHER_MEAT_G);
  const portionOf = (source: ProteinSource) =>
    Math.min(
      (isMain ? source.portionMain : source.portionOther) ?? Infinity,
      contextG
    );

  if (proteins.length > 0 && contextG > 0) {
    for (const source of proteins) {
      const grams = Math.round(portionOf(source) / proteins.length);
      addScaled(total, source.per100g, grams / 100);
      parts.push(`${source.label} ≈ ${grams} g`);
    }
  } else if (isMain && contextG > 0 && (!recognized || (base && !base.noDefaultMeat))) {
    const source =
      (base?.defaultProtein && PROTEIN_BY_ID.get(base.defaultProtein)) || UNKNOWN_MEAT;
    const grams = portionOf(source);
    addScaled(total, source.per100g, grams / 100);
    parts.push(
      source === UNKNOWN_MEAT ? `${source.label} ≈ ${grams} g` : `${source.label} ≈ ${grams} g (supposé)`
    );
  }

  return {
    macros: {
      calories: Math.round(total.calories / 10) * 10,
      proteinG: Math.round(total.proteinG),
      carbsG: Math.round(total.carbsG),
      fatG: Math.round(total.fatG),
    },
    parts,
    recognized,
  };
}

/** « Couscous · poulet ≈ 180 g » */
export function describeEstimate(estimate: DishEstimate): string {
  return estimate.parts.join(" · ");
}
