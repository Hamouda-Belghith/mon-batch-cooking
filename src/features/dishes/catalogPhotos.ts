import { normalizeText } from "@/lib/text";

/*
 * Photos des plats du catalogue (`catalog.ts`), servies depuis
 * `public/dishes/<slug>.webp` (480 × 360, recadrées et compressées).
 *
 * Toutes viennent de Wikimedia Commons, sous licence libre (CC0, domaine
 * public, CC BY, CC BY-SA) : les licences CC BY / BY-SA imposent de citer
 * l'auteur, la licence et la source, d'où ces crédits affichés sous la
 * photo et dans « Crédits photos ». Sélection du 2026-11-17 ; un plat sans
 * photo convenable sur Commons n'a pas d'entrée (son initiale s'affiche).
 */

export interface PhotoCredit {
  author: string;
  license: string;
  /** Vide pour le domaine public. */
  licenseUrl: string;
  /** Page de la photo sur Wikimedia Commons. */
  source: string;
}

/** Identifiant de fichier d'un plat : « Brik à l'œuf » → `brik-a-l-oeuf`. */
export function catalogDishSlug(name: string): string {
  return normalizeText(name).replace(/ /g, "-");
}

export const CATALOG_PHOTO_CREDITS: Record<string, PhotoCredit> = {
  "assida-zgougou": { author: "Habib M'henni", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Assida_Zgougou_Tunisia_20240915_113756.jpg" },
  "boulettes-de-kefta-en-sauce": { author: "Juan Emilio Prades Bel", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0", source: "https://commons.wikimedia.org/wiki/File:Meatballs_with_tomato_sauce_(Spain).jpg" },
  "brik-a-l-oeuf": { author: "Souad Anane Lesina", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Tunisian_Briks.JPG" },
  "bsissa": { author: "Yamen", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Bsissa_08.JPG" },
  "burger-maison": { author: "Horacio Cambeiro", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Homemade_hamburger_with_french_fries_in_Argentina.jpg" },
  "butter-chicken": { author: "stu_spivack", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Chicken_makhani.jpg" },
  "chakchouka": { author: "Calliopejen1", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Shakshuka_by_Calliopejen1.jpg" },
  "chawarma-au-poulet": { author: "Andy Li", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Chicken_Shawarma_Wrap_-_Lavash_2024-09-11.jpg" },
  "chili-con-carne": { author: "Carstor", license: "CC BY-SA 2.5", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5", source: "https://commons.wikimedia.org/wiki/File:Bowl_of_chili.jpg" },
  "chorba-frik": { author: "Slothtysloth", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Chorba_frik_algerienne.jpg" },
  "chorba-langues-d-oiseau": { author: "E4024", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Soup_details.jpg" },
  "couscous-a-l-agneau": { author: "TheGirlsNY", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Moroccan_cuisine-Couscous_lamb_berber.jpg" },
  "couscous-au-kadid": { author: "Habib M'henni", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:%D9%83%D8%B3%D9%83%D8%B3%D9%8A_%D8%A8%D8%A7%D9%84%D8%AE%D8%B6%D8%B1%D8%A9_%D9%88%D8%A7%D9%84%D9%82%D8%AF%D9%8A%D8%AF%D8%8C_%D8%AA%D9%88%D9%86%D8%B3_2013.jpg" },
  "couscous-au-poisson": { author: "Elcèd77", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Fish_couscous_from_Kerkenah,_Tunisia,_August_16th,_2007.jpg" },
  "couscous-au-poulet": { author: "Ypsilon from Finland", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Chicken_couscous_in_Tangier.jpg" },
  "crepes": { author: "David Monniaux", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Crepes_dsc07085.jpg" },
  "croque-monsieur": { author: "Ruth Hartnup", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Croque_Monsieur_and_salad_at_Paris_Bakery.jpg" },
  "escalope-a-la-creme-et-aux-champignons": { author: "Jon Sullivan", license: "Domaine public", licenseUrl: "", source: "https://commons.wikimedia.org/wiki/File:Chicken_mushrooms_sauces.jpg" },
  "escalope-grillee-et-salade": { author: "Prayitno", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Caesar_Salad_%26_Grilled_Chicken_(30548011308).jpg" },
  "escalope-panee": { author: "Kobako", license: "CC BY-SA 2.5", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5", source: "https://commons.wikimedia.org/wiki/File:Wiener-Schnitzel02.jpg" },
  "fajitas-au-poulet": { author: "Missvain", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0", source: "https://commons.wikimedia.org/wiki/File:Chicken_fajitas_-_La_Hacienda_-_Sarah_Stierch.jpg" },
  "gratin-d-aubergines": { author: "Schellenberg", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Parmigiana_di_melanzane.jpg" },
  "gratin-dauphinois": { author: "Ludovic Péron", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Gratin_dauphinois.jpg" },
  "hachis-parmentier": { author: "Bycro", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Hachis_parmentier_02.jpg" },
  "houmous": { author: "Paul Goyette", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Hummus_from_The_Nile.jpg" },
  "kabsa-au-poulet": { author: "Basel15 at en.wikipedia", license: "Domaine public", licenseUrl: "", source: "https://commons.wikimedia.org/wiki/File:Kabsa.jpg" },
  "kafteji": { author: "Sami Mlouhi", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Kafteji_%D9%83%D9%81%D8%AA%D8%A7%D8%AC%D9%8A.jpg" },
  "kamounia": { author: "Touzrimounir", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:%D9%83%D9%85%D9%88%D9%86%D9%8A%D8%A9.JPG" },
  "kumpir": { author: "Atilim Gunes Baydin", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Kumpir2.jpg" },
  "lablabi": { author: "Habib M'henni", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Bol_de_Leblabi_de_Tunisie,_21_mars_2017.jpg" },
  "lasagnes-a-la-bolognaise": { author: "Breville USA", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Meaty_Lasagna_8of8_(8736299782).jpg" },
  "makloub-au-poulet": { author: "Touzrimounir", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Makloub.jpg" },
  "makrouna-a-l-agneau": { author: "Bikofungi", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Macaronade.jpg" },
  "makrouna-au-four": { author: "Benoît Prieur", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Pizzeria_Bella_Italia_(Cr%C3%A9pieux-la-Pape)_-_Gratin_de_cappelletti.jpg" },
  "makrouna-au-poulet": { author: "Apeach316", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Baked_chicken_steak_pasta_with_tomato_sauce.jpg" },
  "makrouna-au-thon": { author: "Julien Seguinot from Lille, France", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Pasta_with_tomato_sauce,_capers_and_tuna_(50540741211).jpg" },
  "makrouna-aux-crevettes": { author: "FranHogan", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Shrimp_pasta.jpg" },
  "makrouna-sauce-rouge": { author: "Roundhere44", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:American_Chop_Suey_on_White_Plate.jpg" },
  "marqa-de-gombo": { author: "Tamorlan", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Bamia-Ocras_tomate_(cropped).JPG" },
  "marqa-de-haricots-blancs": { author: "E4024", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Etli_kuru_fasulye.jpg" },
  "marqa-de-petits-pois": { author: "HaJunkiyada", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Liat_Portal_for_Foodie_Disorder_-_Stuffed_Artichoke_Bottoms_with_Rice_and_Peas.jpg" },
  "marqa-de-pois-chiches": { author: "E4024", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Nohut_yahni.jpg" },
  "mhamsa-au-poulet": { author: "Lochefaicha", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Mhamas_karkouch.JPG" },
  "mloukhia": { author: "Charlie010n", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Plat_alg%C3%A9rien.jpg" },
  "mosli-d-agneau": { author: "RegionVisitor90", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Roast_Lamb_@_Willaston_Hotel_20250925-124625.jpg" },
  "mosli-de-poisson": { author: "Likikouet Raïssa", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Poisson_au_four.JPG" },
  "oeufs-brouilles": { author: "Takeaway", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Scrambed_eggs.jpg" },
  "ojja-aux-crevettes": { author: "HaJunkiyada", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Liat_Portal_for_Foodie_Disorder_-_Shrimp_Shakshuka.jpg" },
  "ojja-merguez": { author: "Maherdz", license: "Domaine public", licenseUrl: "", source: "https://commons.wikimedia.org/wiki/File:Ojjaauxboulettes.jpg" },
  "omelette": { author: "Renee Comet (photographer)", license: "Domaine public", licenseUrl: "", source: "https://commons.wikimedia.org/wiki/File:FoodOmelete.jpg" },
  "pancakes": { author: "Mae Mu", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Foodiesfeed.com_pouring-honey-on-pancakes-with-walnuts.jpg" },
  "pates-au-saumon": { author: "JIP", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Pasta_with_cold-smoked_salmon_and_peas_in_Loviisa.jpg" },
  "pates-bolognaise": { author: "Chingon", license: "Domaine public", licenseUrl: "", source: "https://commons.wikimedia.org/wiki/File:Spaghetti_Bolognese.jpg" },
  "pates-carbonara-a-la-dinde": { author: "Javier Somoza", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Espaguetis_carbonara.jpg" },
  "pizza-maison": { author: "jeffreyw", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Homemade_pizza_(5).jpg" },
  "poisson-grille": { author: "T.Tseng", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Grilled_Japanese_sea_bream.jpg" },
  "poke-bowl-au-saumon": { author: "Mojmir Churavy", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Poke_Bowl_Losos_Zlaty_Klas_2025.jpg" },
  "porridge": { author: "UserTwoSix", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Oatmeal_porridge_1-minute_with_additional_ingredients.jpg" },
  "poulet-au-curry-et-riz": { author: "Gaurav Dhwaj Khadka", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Chicken_Curry_with_Rice.jpg" },
  "poulet-roti-et-pommes-de-terre": { author: "Biso", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0", source: "https://commons.wikimedia.org/wiki/File:Roasted_chicken_and_potatoes.JPG" },
  "quiche-a-la-dinde": { author: "Arnaud 25", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Quiche_lorraine_04.jpg" },
  "riz-au-poulet": { author: "T.Tseng", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Hainanese_Chicken_Rice,_with_asparagus.jpg" },
  "riz-cantonais": { author: "LN9267", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Hung_Hom_Station_Maxim%27s_MX_Yangzhou_fried_rice_11-01-2023.jpg" },
  "rouz-jerbi": { author: "DALIBAK", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Riz_jerbi.JPG" },
  "salade-cesar": { author: "Banej", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Caesar_Salad_from_Tony_Roma_Restaurant-_March_2024_02.jpg" },
  "salade-mechouia": { author: "Habib M'henni", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Salade_Mechouwya,_Tunisie,_juin_2021.jpg" },
  "salade-tunisienne": { author: "Emna Mizouni", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Tunisian_Salad.jpg" },
  "sardines-au-four": { author: "Yusuke Kawasaki from Tokyo, Japan", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Grilled_Sardines_5.50%E2%82%AC_Marisqueira_O_Varino_Nazar%C3%A9_(3785526688).jpg" },
  "saumon-au-four-et-riz": { author: "Daderot", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Grilled_salmon_and_asparagus_on_rice_-_Boston,_Massachusetts.jpg" },
  "soupe-de-legumes": { author: "Horacio Cambeiro", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Traditional_Vegetable_Soup_from_Argentina.jpg" },
  "steak-frites": { author: "Missvain", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0", source: "https://commons.wikimedia.org/wiki/File:Steak_frites_at_The_Bar_at_MacArthur_Place_in_Sonoma_-_Sarah_Stierch.jpg" },
  "taboule": { author: "cyclonebill", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Flickr_-_cyclonebill_-_Tabbouleh.jpg" },
  "tajine-malsouka": { author: "Souad Anane Lesina", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Tajine_malsouka.JPG" },
  "tajine-tunisien-au-poulet": { author: "Habib M'henni", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Tajine_tunisien_au_poulet,_novembre_2022.jpg" },
  "wok-de-poulet-aux-legumes": { author: "Andy Li", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Stir_fried_chicken_with_satay_sauce_-_Stir_Fry_by_CK_2025-04-06.jpg" },
};

/** Photo du catalogue pour ce plat (nom exact du catalogue), ou null. */
export function catalogPhotoUrl(dishName: string): string | null {
  const slug = catalogDishSlug(dishName);
  return CATALOG_PHOTO_CREDITS[slug] ? `/dishes/${slug}.webp` : null;
}

/** Crédits d'une photo du catalogue à partir de son URL, ou null si ce n'en est pas une. */
export function catalogPhotoCredit(photoUrl: string | null | undefined): PhotoCredit | null {
  const match = photoUrl?.match(/^\/dishes\/([a-z0-9-]+)\.webp$/);
  return match ? (CATALOG_PHOTO_CREDITS[match[1]] ?? null) : null;
}
