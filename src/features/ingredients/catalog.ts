import { UNITS } from "@/lib/units";

/**
 * Catalogue des ingrédients connus de l'application.
 *
 * Sert de référence pour nommer les ingrédients de la même façon partout
 * (plats, planning, liste de courses) : l'autocomplétion propose ces noms
 * en priorité, et un ingrédient saisi à la main qui ressemble à l'un d'eux
 * se voit proposer d'être renommé.
 *
 * Règles d'écriture :
 * - `name` : nom canonique en français, au singulier sauf usage courant
 *   (« Épinards », « Petits pois »), majuscule initiale. C'est ce nom qui
 *   est enregistré en base.
 * - `aliases` : autres façons de le dire ou de l'écrire — derja en arabizi
 *   et en arabe, anglais, raccourcis et fautes fréquentes. Inutile d'y
 *   mettre les variantes de casse, d'accents, de pluriel en -s/-x ou de
 *   petits mots (de, au, et…) : la normalisation les ramène déjà au même
 *   nom. Un alias ne doit appartenir qu'à un seul ingrédient.
 * - `unit` : unité proposée par défaut dans le formulaire d'un plat.
 * - `category` : rayon du magasin, pour regrouper la liste de courses.
 *
 * Données statiques versionnées avec le code (comme le dictionnaire de
 * `features/nutrition/estimate.ts`) : rien à migrer en base, fonctionne
 * aussi en mode démo et hors ligne.
 */

type Unit = (typeof UNITS)[number];

export type IngredientCategory =
  | "legumes"
  | "herbes"
  | "fruits"
  | "viandes"
  | "volailles"
  | "poissons"
  | "cremerie"
  | "boulangerie"
  | "feculents"
  | "epicerie-salee"
  | "epices"
  | "epicerie-sucree"
  | "fruits-secs"
  | "boissons"
  | "surgeles"
  | "maison"
  | "hygiene";

/** Rayons, dans l'ordre d'affichage de la liste de courses. */
export const INGREDIENT_CATEGORIES: readonly { id: IngredientCategory; label: string }[] = [
  { id: "legumes", label: "Légumes" },
  { id: "herbes", label: "Herbes & aromates frais" },
  { id: "fruits", label: "Fruits" },
  { id: "viandes", label: "Viandes" },
  { id: "volailles", label: "Volailles" },
  { id: "poissons", label: "Poissons & fruits de mer" },
  { id: "cremerie", label: "Œufs & crèmerie" },
  { id: "boulangerie", label: "Pain & pâtes à tarte" },
  { id: "feculents", label: "Pâtes, riz, semoule & légumineuses" },
  { id: "epicerie-salee", label: "Huiles, sauces & conserves" },
  { id: "epices", label: "Épices & herbes séchées" },
  { id: "epicerie-sucree", label: "Petit-déjeuner & pâtisserie" },
  { id: "fruits-secs", label: "Fruits secs & graines" },
  { id: "boissons", label: "Boissons" },
  { id: "surgeles", label: "Surgelés" },
  { id: "maison", label: "Entretien & maison" },
  { id: "hygiene", label: "Hygiène" },
];

export interface CatalogIngredient {
  readonly name: string;
  readonly category: IngredientCategory;
  readonly unit: Unit;
  readonly aliases?: readonly string[];
}

export const INGREDIENT_CATALOG = [
  // -------------------------------------------------------------------------
  // Légumes
  { name: "Tomate", category: "legumes", unit: "pièce", aliases: ["tmatem", "طماطم", "tmatim", "tomato"] },
  { name: "Tomate cerise", category: "legumes", unit: "g", aliases: ["tomate cherry", "cherry"] },
  { name: "Oignon", category: "legumes", unit: "pièce", aliases: ["bsal", "بصل", "onion", "oignon jaune", "ognon"] },
  { name: "Oignon rouge", category: "legumes", unit: "pièce", aliases: ["bsal a7mar", "red onion"] },
  { name: "Oignon vert", category: "legumes", unit: "pièce", aliases: ["cébette", "ciboule", "bsal a5dhar", "bsal akhdhar"] },
  { name: "Échalote", category: "legumes", unit: "pièce", aliases: ["echalotte"] },
  { name: "Ail", category: "legumes", unit: "pièce", aliases: ["thoum", "ثوم", "toum", "garlic", "gousse d'ail", "tête d'ail"] },
  { name: "Pomme de terre", category: "legumes", unit: "kg", aliases: ["batata", "بطاطا", "patate", "pdt", "potato"] },
  { name: "Pomme de terre grenaille", category: "legumes", unit: "g", aliases: ["grenaille", "baby potato", "baby potatoes", "pomme de terre nouvelle"] },
  { name: "Patate douce", category: "legumes", unit: "pièce", aliases: ["batata 7olwa", "sweet potato"] },
  { name: "Carotte", category: "legumes", unit: "pièce", aliases: ["sfenarya", "sfennaria", "سفنارية", "carrot"] },
  { name: "Courgette", category: "legumes", unit: "pièce", aliases: ["kar3a", "9ar3a", "قرع", "zucchini"] },
  { name: "Potiron", category: "legumes", unit: "kg", aliases: ["kar3a 7amra", "courge", "citrouille", "butternut"] },
  { name: "Aubergine", category: "legumes", unit: "pièce", aliases: ["bedhinjen", "badenjal", "باذنجان", "eggplant"] },
  { name: "Poivron", category: "legumes", unit: "pièce", aliases: ["poivron vert", "poivron rouge", "poivron jaune", "felfel 7lou", "bell pepper"] },
  { name: "Piment vert", category: "legumes", unit: "pièce", aliases: ["felfel", "فلفل", "felfel 7ar", "piment", "piment doux"] },
  { name: "Felfel bar abid", category: "legumes", unit: "pièce" },
  { name: "Concombre", category: "legumes", unit: "pièce", aliases: ["fakous", "فقوس", "khiar", "خيار", "cucumber"] },
  { name: "Salade verte", category: "legumes", unit: "pièce", aliases: ["salade", "laitue", "romaine", "batavia", "slata", "سلاطة"] },
  { name: "Jeunes pousses", category: "legumes", unit: "g", aliases: ["mesclun", "pousses d'épinard"] },
  { name: "Roquette", category: "legumes", unit: "g", aliases: ["rucola"] },
  { name: "Épinards", category: "legumes", unit: "g", aliases: ["sbenekh", "سبانخ", "spinach"] },
  { name: "Blettes", category: "legumes", unit: "g", aliases: ["sel9", "selk", "سلق", "bettes"] },
  { name: "Céleri", category: "legumes", unit: "pièce", aliases: ["celery", "céleri branche", "krafes", "كرافس"] },
  { name: "Fenouil", category: "legumes", unit: "pièce", aliases: ["besbes", "bisbes", "بسباس"] },
  { name: "Chou-fleur", category: "legumes", unit: "pièce", aliases: ["chouflour", "شفلور", "cauliflower"] },
  { name: "Brocoli", category: "legumes", unit: "pièce", aliases: ["broccoli"] },
  { name: "Chou", category: "legumes", unit: "pièce", aliases: ["krenb", "كرنب", "chou blanc", "chou vert", "cabbage"] },
  { name: "Chou rouge", category: "legumes", unit: "pièce" },
  { name: "Haricots verts", category: "legumes", unit: "g", aliases: ["loubya khadhra", "loubia 5adhra"] },
  { name: "Petits pois", category: "legumes", unit: "g", aliases: ["jelbana", "jelbena", "جلبانة", "peas"] },
  { name: "Fèves fraîches", category: "legumes", unit: "g", aliases: ["fève", "foul", "فول"] },
  { name: "Artichaut", category: "legumes", unit: "pièce", aliases: ["9arnoun", "qarnoun", "قرنون"] },
  { name: "Navet", category: "legumes", unit: "pièce", aliases: ["left", "لفت"] },
  { name: "Betterave", category: "legumes", unit: "pièce", aliases: ["betrave"] },
  { name: "Champignon", category: "legumes", unit: "g", aliases: ["champignon de paris", "mushroom"] },
  { name: "Poireau", category: "legumes", unit: "pièce", aliases: ["leek"] },
  { name: "Radis", category: "legumes", unit: "g", aliases: ["fjel", "فجل"] },
  { name: "Avocat", category: "legumes", unit: "pièce", aliases: ["avocado", "lavoka"] },
  { name: "Gombo", category: "legumes", unit: "g", aliases: ["gnawia", "gnaouia", "قناوية", "okra"] },

  // -------------------------------------------------------------------------
  // Herbes & aromates frais
  { name: "Persil", category: "herbes", unit: "pièce", aliases: ["ma3dnous", "ma3danous", "معدنوس", "parsley", "persil plat"] },
  { name: "Coriandre fraîche", category: "herbes", unit: "pièce", aliases: ["coriandre", "kosbor", "كسبر", "cilantro"] },
  { name: "Menthe", category: "herbes", unit: "pièce", aliases: ["na3na3", "نعناع", "naanaa", "mint"] },
  { name: "Aneth", category: "herbes", unit: "pièce", aliases: ["shebt", "chebt", "شبت", "dill"] },
  { name: "Basilic", category: "herbes", unit: "pièce", aliases: ["7ba9", "حبق", "basil"] },
  { name: "Ciboulette", category: "herbes", unit: "pièce" },
  { name: "Gingembre frais", category: "herbes", unit: "g", aliases: ["gingembre", "ginger"] },

  // -------------------------------------------------------------------------
  // Fruits
  { name: "Citron", category: "fruits", unit: "pièce", aliases: ["9ares", "qares", "قارص", "lemon", "citron jaune"] },
  { name: "Citron vert", category: "fruits", unit: "pièce", aliases: ["lime"] },
  { name: "Orange", category: "fruits", unit: "pièce", aliases: ["bordgen", "burtuqal"] },
  { name: "Mandarine", category: "fruits", unit: "pièce", aliases: ["clémentine", "mandarina"] },
  { name: "Banane", category: "fruits", unit: "pièce", aliases: ["banan", "بنان", "banana"] },
  { name: "Pomme", category: "fruits", unit: "pièce", aliases: ["teffe7", "tofe7", "تفاح", "apple"] },
  { name: "Poire", category: "fruits", unit: "pièce", aliases: ["pear"] },
  { name: "Fraise", category: "fruits", unit: "g", aliases: ["strawberry"] },
  { name: "Raisin", category: "fruits", unit: "g", aliases: ["3nab", "عنب", "grape"] },
  { name: "Pastèque", category: "fruits", unit: "pièce", aliases: ["della3", "dellaa", "دلاع", "watermelon"] },
  { name: "Melon", category: "fruits", unit: "pièce", aliases: ["bettikh", "بطيخ"] },
  { name: "Pêche", category: "fruits", unit: "pièce", aliases: ["khoukh", "خوخ"] },
  { name: "Abricot", category: "fruits", unit: "pièce", aliases: ["mechmech", "مشمش"] },
  { name: "Figue", category: "fruits", unit: "pièce", aliases: ["karmous", "كرموس"] },
  { name: "Grenade", category: "fruits", unit: "pièce", aliases: ["romman", "rommen", "رمان"] },
  { name: "Kiwi", category: "fruits", unit: "pièce" },
  { name: "Ananas", category: "fruits", unit: "pièce" },
  { name: "Mangue", category: "fruits", unit: "pièce", aliases: ["mango"] },

  // -------------------------------------------------------------------------
  // Viandes
  { name: "Bœuf en morceaux", category: "viandes", unit: "g", aliases: ["viande", "l7am", "لحم", "viande de bœuf", "bœuf", "l7am ba9ri", "viande rouge", "beef"] },
  { name: "Viande hachée", category: "viandes", unit: "g", aliases: ["l7am mar7i", "mar7i", "l7am mafroum", "haché", "viande hachée de bœuf"] },
  { name: "Steak haché", category: "viandes", unit: "pièce" },
  { name: "Viande sans os (habra)", category: "viandes", unit: "g", aliases: ["habra", "هبرة", "l7am habra", "viande maigre"] },
  { name: "Jarret de bœuf", category: "viandes", unit: "g", aliases: ["jarret", "viande jarret"] },
  { name: "Jarret de veau", category: "viandes", unit: "g" },
  { name: "Entrecôte", category: "viandes", unit: "g" },
  { name: "Steak", category: "viandes", unit: "g", aliases: ["bifteck", "faux-filet", "rumsteck"] },
  { name: "Rôti de bœuf", category: "viandes", unit: "g" },
  { name: "Veau en morceaux", category: "viandes", unit: "g", aliases: ["veau", "viande de veau", "3jel", "عجل"] },
  { name: "Escalope de veau", category: "viandes", unit: "g" },
  { name: "Agneau en morceaux", category: "viandes", unit: "g", aliases: ["agneau", "viande d'agneau", "3allouch", "علوش", "l7am 3allouch", "mouton", "lamb"] },
  { name: "Épaule d'agneau", category: "viandes", unit: "g" },
  { name: "Gigot d'agneau", category: "viandes", unit: "g", aliases: ["gigot"] },
  { name: "Côtelettes d'agneau", category: "viandes", unit: "g", aliases: ["côtelette", "cotlette"] },
  { name: "Souris d'agneau", category: "viandes", unit: "pièce" },
  { name: "Foie d'agneau", category: "viandes", unit: "g", aliases: ["kebda", "كبدة", "foie"] },
  { name: "Merguez", category: "viandes", unit: "g", aliases: ["mergaz", "مرقاز"] },
  { name: "Kadid (viande séchée)", category: "viandes", unit: "g", aliases: ["kadid", "9did", "قديد", "viande séchée"] },
  { name: "Saucisse", category: "viandes", unit: "pièce" },
  { name: "Jambon de dinde", category: "viandes", unit: "g", aliases: ["jambon", "blanc de dinde"] },

  // -------------------------------------------------------------------------
  // Volailles
  { name: "Poulet", category: "volailles", unit: "g", aliases: ["djej", "دجاج", "chicken", "poulet en morceaux"] },
  { name: "Poulet entier", category: "volailles", unit: "pièce", aliases: ["djeja", "دجاجة"] },
  { name: "Escalope de poulet", category: "volailles", unit: "g", aliases: ["escalope", "blanc de poulet", "filet de poulet", "escalope poulet", "chicken breast"] },
  { name: "Cuisses de poulet", category: "volailles", unit: "g", aliases: ["cuisse", "haut de cuisse"] },
  { name: "Pilons de poulet", category: "volailles", unit: "g", aliases: ["pilon"] },
  { name: "Ailes de poulet", category: "volailles", unit: "g", aliases: ["aile", "wings"] },
  { name: "Poulet haché", category: "volailles", unit: "g" },
  { name: "Escalope de dinde", category: "volailles", unit: "g", aliases: ["dinde", "escalope dinde", "turkey"] },
  { name: "Rôti de dinde", category: "volailles", unit: "g", aliases: ["dindon", "dindon rôti", "rôti dinde"] },
  { name: "Foie de volaille", category: "volailles", unit: "g", aliases: ["kebda djej"] },

  // -------------------------------------------------------------------------
  // Poissons & fruits de mer
  { name: "Poisson", category: "poissons", unit: "g", aliases: ["hout", "7out", "حوت", "fish"] },
  { name: "Dorade", category: "poissons", unit: "pièce", aliases: ["daurade", "dorade royale"] },
  { name: "Loup de mer", category: "poissons", unit: "pièce", aliases: ["loup", "bar", "9arous", "qarous"] },
  { name: "Sardine", category: "poissons", unit: "g", aliases: ["sardina", "سردينة"] },
  { name: "Saumon", category: "poissons", unit: "g", aliases: ["salmon", "pavé de saumon", "filet de saumon"] },
  { name: "Thon frais", category: "poissons", unit: "g", aliases: ["thon rouge"] },
  { name: "Merlan", category: "poissons", unit: "g" },
  { name: "Cabillaud", category: "poissons", unit: "g", aliases: ["cod"] },
  { name: "Colin", category: "poissons", unit: "g", aliases: ["lieu noir", "merlu"] },
  { name: "Rouget", category: "poissons", unit: "g", aliases: ["trilia", "تريليا"] },
  { name: "Maquereau", category: "poissons", unit: "g", aliases: ["scoumbri"] },
  { name: "Mulet", category: "poissons", unit: "g", aliases: ["bouri", "بوري"] },
  { name: "Crevettes", category: "poissons", unit: "g", aliases: ["gambri", "9ambri", "قمبري", "gambas", "shrimp"] },
  { name: "Calamar", category: "poissons", unit: "g", aliases: ["calmar", "encornet", "kalamar"] },
  { name: "Poulpe", category: "poissons", unit: "g", aliases: ["9arnit", "karnit", "قرنيط", "pieuvre", "octopus"] },
  { name: "Seiche", category: "poissons", unit: "g" },
  { name: "Moules", category: "poissons", unit: "g" },
  { name: "Fruits de mer (mélange)", category: "poissons", unit: "g", aliases: ["fruits de mer", "cocktail de fruits de mer"] },

  // -------------------------------------------------------------------------
  // Œufs & crèmerie
  { name: "Œufs", category: "cremerie", unit: "pièce", aliases: ["3dham", "عظم", "bidh", "بيض", "eggs"] },
  { name: "Lait", category: "cremerie", unit: "l", aliases: ["7lib", "hlib", "حليب", "milk", "lait demi-écrémé", "lait entier"] },
  { name: "Lait d'amande", category: "cremerie", unit: "l", aliases: ["lait amande", "almond milk"] },
  { name: "Lben", category: "cremerie", unit: "l", aliases: ["لبن", "leben", "lait fermenté", "lait ribot"] },
  { name: "Rayeb", category: "cremerie", unit: "l", aliases: ["رايب", "raib"] },
  { name: "Yaourt", category: "cremerie", unit: "pièce", aliases: ["yaourt nature", "yogourt", "yoghourt", "ياغورت"] },
  { name: "Yaourt grec", category: "cremerie", unit: "pièce", aliases: ["skyr"] },
  { name: "Beurre", category: "cremerie", unit: "g", aliases: ["zebda", "زبدة", "butter"] },
  { name: "Crème fraîche", category: "cremerie", unit: "cl", aliases: ["crème épaisse"] },
  { name: "Crème liquide", category: "cremerie", unit: "cl", aliases: ["crème fleurette", "crème cuisine", "crème légère"] },
  { name: "Fromage râpé", category: "cremerie", unit: "g", aliases: ["fromage", "gruyère râpé", "emmental râpé"] },
  { name: "Fromage frais", category: "cremerie", unit: "g", aliases: ["jben", "جبن"] },
  { name: "Emmental", category: "cremerie", unit: "g", aliases: ["emmenthal"] },
  { name: "Gruyère", category: "cremerie", unit: "g" },
  { name: "Mozzarella", category: "cremerie", unit: "g", aliases: ["mozarella", "mozza"] },
  { name: "Burrata", category: "cremerie", unit: "pièce", aliases: ["bouratta"] },
  { name: "Parmesan", category: "cremerie", unit: "g", aliases: ["parmigiano"] },
  { name: "Feta", category: "cremerie", unit: "g" },
  { name: "Ricotta", category: "cremerie", unit: "g" },
  { name: "Cheddar", category: "cremerie", unit: "g" },
  { name: "Fromage de chèvre", category: "cremerie", unit: "g", aliases: ["chèvre", "bûche de chèvre"] },
  { name: "Fromage fondu en portions", category: "cremerie", unit: "pièce", aliases: ["kiri", "vache qui rit", "fromage portion"] },
  { name: "Mascarpone", category: "cremerie", unit: "g" },

  // -------------------------------------------------------------------------
  // Pain & pâtes à tarte
  { name: "Pain", category: "boulangerie", unit: "pièce", aliases: ["khobz", "خبز", "bread"] },
  { name: "Baguette", category: "boulangerie", unit: "pièce" },
  { name: "Pain de mie", category: "boulangerie", unit: "pièce", aliases: ["pain toast"] },
  { name: "Pain complet", category: "boulangerie", unit: "pièce" },
  { name: "Tabouna", category: "boulangerie", unit: "pièce", aliases: ["طابونة", "khobz tabouna", "pain tabouna"] },
  { name: "Pain pita", category: "boulangerie", unit: "pièce", aliases: ["pita", "pain libanais", "pain arabe"] },
  { name: "Pain burger", category: "boulangerie", unit: "pièce", aliases: ["buns", "pain hamburger", "pain à burger"] },
  { name: "Brioche", category: "boulangerie", unit: "pièce" },
  { name: "Tortillas", category: "boulangerie", unit: "pièce", aliases: ["wrap", "galette de blé"] },
  { name: "Feuilles de brick", category: "boulangerie", unit: "pièce", aliases: ["brick", "malsouka", "ملسوقة", "dioul", "warka"] },
  { name: "Pâte feuilletée", category: "boulangerie", unit: "pièce" },
  { name: "Pâte brisée", category: "boulangerie", unit: "pièce" },
  { name: "Pâte à pizza", category: "boulangerie", unit: "pièce", aliases: ["pâte pizza"] },
  { name: "Pâte à pain", category: "boulangerie", unit: "pièce", aliases: ["pâte makloub", "pâte à makloub"] },

  // -------------------------------------------------------------------------
  // Pâtes, riz, semoule & légumineuses
  { name: "Riz", category: "feculents", unit: "g", aliases: ["rouz", "roz", "رز", "روز", "rice", "riz long"] },
  { name: "Riz basmati", category: "feculents", unit: "g", aliases: ["basmati"] },
  { name: "Riz rond", category: "feculents", unit: "g", aliases: ["riz risotto", "arborio"] },
  { name: "Pâtes", category: "feculents", unit: "g", aliases: ["ma9rouna", "ma9arouna", "makrouna", "makarouna", "مقرونة", "pasta", "macaroni"] },
  { name: "Spaghetti", category: "feculents", unit: "g", aliases: ["spagetti"] },
  { name: "Penne", category: "feculents", unit: "g" },
  { name: "Coquillettes", category: "feculents", unit: "g" },
  { name: "Tagliatelles", category: "feculents", unit: "g" },
  { name: "Cheveux d'ange", category: "feculents", unit: "g" },
  { name: "Vermicelles", category: "feculents", unit: "g", aliases: ["dwida", "دويدة"] },
  { name: "Langues d'oiseau", category: "feculents", unit: "g", aliases: ["lsen 3asfour", "لسان عصفور"] },
  { name: "Nouasser", category: "feculents", unit: "g", aliases: ["nwasser", "نواصر"] },
  { name: "Hlalem", category: "feculents", unit: "g", aliases: ["حلالم"] },
  { name: "Mhamsa", category: "feculents", unit: "g", aliases: ["m7amsa", "محمصة", "plombs"] },
  { name: "Feuilles de lasagne", category: "feculents", unit: "g", aliases: ["lasagne"] },
  { name: "Nouilles asiatiques", category: "feculents", unit: "g", aliases: ["nouilles", "noodles", "nouilles de riz", "ramen"] },
  { name: "Couscous", category: "feculents", unit: "g", aliases: ["kosksi", "kousksi", "كسكسي", "couscous moyen"] },
  { name: "Couscous fin", category: "feculents", unit: "g" },
  { name: "Couscous d'orge", category: "feculents", unit: "g", aliases: ["kosksi chir", "كسكسي شعير"] },
  { name: "Semoule", category: "feculents", unit: "g", aliases: ["smid", "سميد", "semoule fine"] },
  { name: "Boulgour", category: "feculents", unit: "g", aliases: ["borghol", "bourghoul", "برغل", "bulgur"] },
  { name: "Frik", category: "feculents", unit: "g", aliases: ["فريك", "blé vert concassé", "freekeh"] },
  { name: "Quinoa", category: "feculents", unit: "g" },
  { name: "Pois chiches", category: "feculents", unit: "g", aliases: ["homs", "7oms", "حمص", "pois chiches secs"] },
  { name: "Lentilles", category: "feculents", unit: "g", aliases: ["3dess", "adas", "عدس", "lentilles vertes", "lentils"] },
  { name: "Lentilles corail", category: "feculents", unit: "g", aliases: ["lentilles rouges"] },
  { name: "Haricots blancs", category: "feculents", unit: "g", aliases: ["loubya", "loubia", "لوبيا", "haricots blancs secs"] },
  { name: "Haricots rouges", category: "feculents", unit: "boîte", aliases: ["kidney beans"] },
  { name: "Fèves sèches", category: "feculents", unit: "g", aliases: ["foul yebes"] },
  { name: "Pois cassés", category: "feculents", unit: "g" },
  { name: "Fécule de maïs", category: "feculents", unit: "g", aliases: ["maïzena", "amidon de maïs", "cornstarch"] },
  { name: "Fécule de pomme de terre", category: "feculents", unit: "g", aliases: ["fécule"] },

  // -------------------------------------------------------------------------
  // Huiles, sauces & conserves
  { name: "Huile d'olive", category: "epicerie-salee", unit: "l", aliases: ["zit zitoun", "zit zitouna", "زيت زيتون", "olive oil"] },
  { name: "Huile de tournesol", category: "epicerie-salee", unit: "l", aliases: ["huile végétale", "huile de friture", "sunflower oil"] },
  { name: "Huile de sésame", category: "epicerie-salee", unit: "ml", aliases: ["sesame oil"] },
  { name: "Vinaigre", category: "epicerie-salee", unit: "cl", aliases: ["vinaigre blanc", "vinaigre de vin", "5al", "khal", "خل"] },
  { name: "Vinaigre balsamique", category: "epicerie-salee", unit: "cl", aliases: ["balsamique"] },
  { name: "Concentré de tomate", category: "epicerie-salee", unit: "c. à soupe", aliases: ["tomate concentrée", "salsa", "صلصة", "double concentré", "tomato paste"] },
  { name: "Sauce tomate", category: "epicerie-salee", unit: "pièce", aliases: ["coulis de tomate", "passata"] },
  { name: "Tomates pelées", category: "epicerie-salee", unit: "boîte", aliases: ["tomates concassées"] },
  { name: "Harissa", category: "epicerie-salee", unit: "c. à café", aliases: ["هريسة", "harisa", "hrissa"] },
  { name: "Moutarde", category: "epicerie-salee", unit: "c. à café", aliases: ["mustard"] },
  { name: "Mayonnaise", category: "epicerie-salee", unit: "c. à soupe", aliases: ["mayo"] },
  { name: "Ketchup", category: "epicerie-salee", unit: "c. à soupe" },
  { name: "Sauce soja", category: "epicerie-salee", unit: "c. à soupe", aliases: ["soja", "soy sauce", "sauce soya"] },
  { name: "Bouillon cube", category: "epicerie-salee", unit: "pièce", aliases: ["cube", "cube de bouillon", "bouillon", "knorr", "maggi"] },
  { name: "Olives vertes", category: "epicerie-salee", unit: "g", aliases: ["olive", "zitoun", "زيتون"] },
  { name: "Olives noires", category: "epicerie-salee", unit: "g", aliases: ["zitoun k7al"] },
  { name: "Câpres", category: "epicerie-salee", unit: "g" },
  { name: "Cornichons", category: "epicerie-salee", unit: "g" },
  { name: "Variantes", category: "epicerie-salee", unit: "g", aliases: ["légumes au vinaigre", "torchi", "طرشي", "pickles"] },
  { name: "Citron confit", category: "epicerie-salee", unit: "pièce" },
  { name: "Tahini", category: "epicerie-salee", unit: "c. à soupe", aliases: ["tahina", "tahin", "طحينة", "crème de sésame"] },
  { name: "Mloukhia", category: "epicerie-salee", unit: "g", aliases: ["ملوخية", "mloukhiya", "corète"] },
  { name: "Thon en conserve", category: "epicerie-salee", unit: "boîte", aliases: ["thon", "ton", "تن", "thon à l'huile", "thon au naturel", "tuna"] },
  { name: "Sardines en conserve", category: "epicerie-salee", unit: "boîte" },
  { name: "Pois chiches en conserve", category: "epicerie-salee", unit: "boîte" },
  { name: "Maïs doux", category: "epicerie-salee", unit: "boîte", aliases: ["maïs", "corn"] },
  { name: "Lait de coco", category: "epicerie-salee", unit: "boîte", aliases: ["coconut milk"] },
  { name: "Chapelure", category: "epicerie-salee", unit: "g", aliases: ["panure"] },

  // -------------------------------------------------------------------------
  // Épices & herbes séchées
  { name: "Sel", category: "epices", unit: "pincée", aliases: ["mel7", "melh", "ملح", "salt"] },
  { name: "Poivre noir", category: "epices", unit: "pincée", aliases: ["poivre", "felfel ak7el", "فلفل أكحل", "black pepper"] },
  { name: "Cumin", category: "epices", unit: "c. à café", aliases: ["kammoun", "kamoun", "كمون"] },
  { name: "Carvi", category: "epices", unit: "c. à café", aliases: ["karwiya", "karouia", "كروية"] },
  { name: "Coriandre moulue", category: "epices", unit: "c. à café", aliases: ["tabel", "tebel", "تابل", "coriandre en poudre"] },
  { name: "Paprika", category: "epices", unit: "c. à café", aliases: ["felfel a7mar", "فلفل أحمر", "felfel zina", "piment doux en poudre"] },
  { name: "Piment fort en poudre", category: "epices", unit: "c. à café", aliases: ["cayenne", "piment de cayenne", "chili en poudre"] },
  { name: "Curcuma", category: "epices", unit: "c. à café", aliases: ["kerkem", "كركم", "turmeric"] },
  { name: "Cannelle", category: "epices", unit: "c. à café", aliases: ["kerfa", "karfa", "قرفة", "cinnamon"] },
  { name: "Gingembre moulu", category: "epices", unit: "c. à café", aliases: ["skenjbir", "skinjbir", "سكنجبير", "gingembre en poudre"] },
  { name: "Curry", category: "epices", unit: "c. à café", aliases: ["curry en poudre"] },
  { name: "Garam masala", category: "epices", unit: "c. à café" },
  { name: "Ras el hanout", category: "epices", unit: "c. à café", aliases: ["رأس الحانوت"] },
  { name: "Bharat", category: "epices", unit: "c. à café", aliases: ["baharat", "بهارات"] },
  { name: "Herbes de Provence", category: "epices", unit: "c. à café" },
  { name: "Thym", category: "epices", unit: "c. à café", aliases: ["za3tar", "zaatar", "زعتر"] },
  { name: "Romarin", category: "epices", unit: "c. à café", aliases: ["klil", "إكليل"] },
  { name: "Origan", category: "epices", unit: "c. à café", aliases: ["oregano"] },
  { name: "Laurier", category: "epices", unit: "pièce", aliases: ["feuille de laurier", "rand", "رند"] },
  { name: "Safran", category: "epices", unit: "pincée", aliases: ["za3fran", "زعفران"] },
  { name: "Noix de muscade", category: "epices", unit: "pincée", aliases: ["muscade"] },
  { name: "Clou de girofle", category: "epices", unit: "pièce", aliases: ["girofle", "9ronfel", "قرنفل"] },
  { name: "Graines de sésame", category: "epices", unit: "c. à soupe", aliases: ["sésame", "jeljlen", "جلجلان"] },
  { name: "Nigelle", category: "epices", unit: "c. à café", aliases: ["sanouj", "سانوج", "cumin noir"] },
  { name: "Anis vert", category: "epices", unit: "c. à café", aliases: ["anis", "habbet 7lewa", "حبة حلاوة"] },
  { name: "Fenugrec", category: "epices", unit: "c. à café", aliases: ["7elba", "helba", "حلبة"] },
  { name: "Ail en poudre", category: "epices", unit: "c. à café" },

  // -------------------------------------------------------------------------
  // Petit-déjeuner & pâtisserie
  { name: "Farine", category: "epicerie-sucree", unit: "g", aliases: ["farina", "فارينة", "d9i9", "دقيق", "farine de blé", "flour"] },
  { name: "Sucre", category: "epicerie-sucree", unit: "g", aliases: ["sokkor", "سكر", "sucre en poudre", "sucre blanc", "sugar"] },
  { name: "Sucre glace", category: "epicerie-sucree", unit: "g" },
  { name: "Sucre roux", category: "epicerie-sucree", unit: "g", aliases: ["cassonade", "sucre brun"] },
  { name: "Sucre vanillé", category: "epicerie-sucree", unit: "pièce" },
  { name: "Extrait de vanille", category: "epicerie-sucree", unit: "c. à café", aliases: ["vanille", "arôme vanille"] },
  { name: "Levure chimique", category: "epicerie-sucree", unit: "pièce", aliases: ["levure", "poudre à lever", "baking powder"] },
  { name: "Levure boulangère", category: "epicerie-sucree", unit: "pièce", aliases: ["khmira", "خميرة", "levure de boulanger", "levure sèche"] },
  { name: "Miel", category: "epicerie-sucree", unit: "g", aliases: ["3sal", "عسل", "honey"] },
  { name: "Confiture", category: "epicerie-sucree", unit: "pièce", aliases: ["jam"] },
  { name: "Pâte à tartiner", category: "epicerie-sucree", unit: "pièce", aliases: ["nutella"] },
  { name: "Beurre de cacahuète", category: "epicerie-sucree", unit: "g", aliases: ["peanut butter"] },
  { name: "Chocolat noir", category: "epicerie-sucree", unit: "g", aliases: ["chocolat pâtissier", "chocolat dessert"] },
  { name: "Chocolat au lait", category: "epicerie-sucree", unit: "g" },
  { name: "Cacao en poudre", category: "epicerie-sucree", unit: "g", aliases: ["cacao", "cacao amer", "cocoa"] },
  { name: "Eau de fleur d'oranger", category: "epicerie-sucree", unit: "cl", aliases: ["fleur d'oranger", "ma zhar", "zhar", "ماء زهر"] },
  { name: "Eau de rose", category: "epicerie-sucree", unit: "cl", aliases: ["ma ward", "ماء ورد"] },
  { name: "Lait concentré sucré", category: "epicerie-sucree", unit: "boîte", aliases: ["lait concentré"] },
  { name: "Zgougou", category: "epicerie-sucree", unit: "g", aliases: ["زقوقو", "graines de pin d'alep"] },
  { name: "Bsissa", category: "epicerie-sucree", unit: "g", aliases: ["بسيسة", "bsisa"] },
  { name: "Halwa chamia", category: "epicerie-sucree", unit: "g", aliases: ["halwa", "7alwa", "حلوى شامية", "halva"] },
  { name: "Flocons d'avoine", category: "epicerie-sucree", unit: "g", aliases: ["avoine", "oats", "porridge"] },
  { name: "Granola", category: "epicerie-sucree", unit: "g", aliases: ["muesli"] },
  { name: "Céréales", category: "epicerie-sucree", unit: "pièce", aliases: ["corn flakes", "céréales petit-déjeuner"] },
  { name: "Biscuits", category: "epicerie-sucree", unit: "pièce", aliases: ["gâteaux secs", "petit beurre"] },

  // -------------------------------------------------------------------------
  // Fruits secs & graines
  { name: "Amandes", category: "fruits-secs", unit: "g", aliases: ["louz", "لوز"] },
  { name: "Noix", category: "fruits-secs", unit: "g", aliases: ["jouz", "جوز", "cerneaux de noix"] },
  { name: "Noisettes", category: "fruits-secs", unit: "g", aliases: ["bondo9", "بندق", "hazelnut"] },
  { name: "Noix de cajou", category: "fruits-secs", unit: "g", aliases: ["cajou", "cashew"] },
  { name: "Pistaches", category: "fruits-secs", unit: "g", aliases: ["fozdo9", "فزدق"] },
  { name: "Cacahuètes", category: "fruits-secs", unit: "g", aliases: ["kakawiya", "كاكاوية", "arachides", "cacahouète", "peanut"] },
  { name: "Pignons de pin", category: "fruits-secs", unit: "g", aliases: ["pignon", "snouber", "صنوبر"] },
  { name: "Raisins secs", category: "fruits-secs", unit: "g", aliases: ["zbib", "زبيب"] },
  { name: "Dattes", category: "fruits-secs", unit: "g", aliases: ["tmar", "تمر", "deglet nour"] },
  { name: "Figues sèches", category: "fruits-secs", unit: "g", aliases: ["chri7a", "شريحة"] },
  { name: "Abricots secs", category: "fruits-secs", unit: "g" },
  { name: "Graines de courge", category: "fruits-secs", unit: "g", aliases: ["graines de citrouille"] },
  { name: "Graines de chia", category: "fruits-secs", unit: "g", aliases: ["chia"] },
  { name: "Noix de coco râpée", category: "fruits-secs", unit: "g", aliases: ["coco râpée", "noix de coco"] },

  // -------------------------------------------------------------------------
  // Boissons
  { name: "Eau", category: "boissons", unit: "l", aliases: ["eau minérale", "eau plate", "pack d'eau", "water"] },
  { name: "Eau gazeuse", category: "boissons", unit: "l", aliases: ["eau pétillante"] },
  { name: "Jus d'orange", category: "boissons", unit: "l", aliases: ["jus orange"] },
  { name: "Jus de fruits", category: "boissons", unit: "l", aliases: ["jus", "3assir", "عصير"] },
  { name: "Soda", category: "boissons", unit: "l", aliases: ["gazouz", "gazouza", "coca", "boisson gazeuse"] },
  { name: "Sirop", category: "boissons", unit: "l", aliases: ["grenadine", "sirop de grenadine"] },
  { name: "Café moulu", category: "boissons", unit: "g", aliases: ["café", "9ahwa", "قهوة"] },
  { name: "Café en grains", category: "boissons", unit: "g", aliases: ["café grain"] },
  { name: "Capsules de café", category: "boissons", unit: "pièce", aliases: ["café capsule", "capsules", "dosettes", "nespresso"] },
  { name: "Café soluble", category: "boissons", unit: "pièce", aliases: ["nescafé", "café instantané"] },
  { name: "Thé vert", category: "boissons", unit: "pièce", aliases: ["thé", "tey", "تاي", "tey a5dhar"] },
  { name: "Thé noir", category: "boissons", unit: "pièce", aliases: ["tey a7mar"] },
  { name: "Tisane", category: "boissons", unit: "pièce", aliases: ["infusion", "verveine", "camomille"] },

  // -------------------------------------------------------------------------
  // Surgelés
  { name: "Frites surgelées", category: "surgeles", unit: "g", aliases: ["frites", "french fries"] },
  { name: "Légumes surgelés", category: "surgeles", unit: "g", aliases: ["poêlée de légumes", "mélange de légumes"] },
  { name: "Glaçons", category: "surgeles", unit: "pièce" },
  { name: "Glace", category: "surgeles", unit: "pièce", aliases: ["crème glacée", "ice cream"] },

  // -------------------------------------------------------------------------
  // Entretien & maison
  { name: "Sacs poubelle", category: "maison", unit: "pièce", aliases: ["sac à poubelle"] },
  { name: "Liquide vaisselle", category: "maison", unit: "pièce", aliases: ["vaisselle", "produit vaisselle"] },
  { name: "Tablettes lave-vaisselle", category: "maison", unit: "pièce", aliases: ["pastilles lave-vaisselle", "capsules lave-vaisselle"] },
  { name: "Éponges", category: "maison", unit: "pièce" },
  { name: "Lessive", category: "maison", unit: "pièce", aliases: ["détergent", "lessive liquide"] },
  { name: "Adoucissant", category: "maison", unit: "pièce" },
  { name: "Javel", category: "maison", unit: "pièce", aliases: ["eau de javel", "jevel"] },
  { name: "Nettoyant multi-usage", category: "maison", unit: "pièce", aliases: ["produit ménager", "nettoyant sol", "produit sol"] },
  { name: "Papier toilette", category: "maison", unit: "pièce", aliases: ["pq", "papier wc", "papier hygiénique"] },
  { name: "Essuie-tout", category: "maison", unit: "pièce", aliases: ["sopalin", "papier absorbant"] },
  { name: "Papier aluminium", category: "maison", unit: "pièce", aliases: ["papier alu", "alu"] },
  { name: "Film alimentaire", category: "maison", unit: "pièce", aliases: ["cellophane", "film étirable"] },
  { name: "Papier cuisson", category: "maison", unit: "pièce", aliases: ["papier sulfurisé"] },
  { name: "Sacs congélation", category: "maison", unit: "pièce" },
  { name: "Barquettes alimentaires", category: "maison", unit: "pièce", aliases: ["barquette", "boîte de conservation", "tupperware"] },
  { name: "Gant de four", category: "maison", unit: "pièce", aliases: ["manique"] },

  // -------------------------------------------------------------------------
  // Hygiène
  { name: "Shampoing", category: "hygiene", unit: "pièce", aliases: ["shampooing", "shampoo"] },
  { name: "Après-shampoing", category: "hygiene", unit: "pièce" },
  { name: "Gel douche", category: "hygiene", unit: "pièce" },
  { name: "Savon", category: "hygiene", unit: "pièce", aliases: ["savon liquide", "saboun", "صابون"] },
  { name: "Dentifrice", category: "hygiene", unit: "pièce" },
  { name: "Brosse à dents", category: "hygiene", unit: "pièce" },
  { name: "Déodorant", category: "hygiene", unit: "pièce", aliases: ["déo"] },
  { name: "Mouchoirs", category: "hygiene", unit: "pièce", aliases: ["kleenex"] },
  { name: "Cotons", category: "hygiene", unit: "pièce" },
  { name: "Rasoirs", category: "hygiene", unit: "pièce" },
  { name: "Lingettes", category: "hygiene", unit: "pièce" },
  { name: "Couches", category: "hygiene", unit: "pièce" },
] as const satisfies readonly CatalogIngredient[];

/** Nom canonique d'un ingrédient du catalogue (vérifié à la compilation). */
export type CatalogIngredientName = (typeof INGREDIENT_CATALOG)[number]["name"];
