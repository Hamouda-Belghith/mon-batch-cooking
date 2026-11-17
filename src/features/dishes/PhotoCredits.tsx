"use client";

import { Modal } from "@/components/ui/Modal";
import { DISH_CATALOG } from "./catalog";
import { CATALOG_PHOTO_CREDITS, catalogDishSlug, type PhotoCredit } from "./catalogPhotos";

/** « Photo : auteur, licence, Wikimedia Commons » sous une photo du catalogue. */
export function PhotoCreditLine({ credit }: { credit: PhotoCredit }) {
  return (
    <p className="photo-credit">
      Photo : {credit.author},{" "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      ,{" "}
      <a href={credit.source} target="_blank" rel="noreferrer">
        Wikimedia Commons
      </a>
    </p>
  );
}

/** Liste des crédits de toutes les photos du catalogue de plats. */
export function PhotoCreditsModal({ onClose }: { onClose: () => void }) {
  const entries = DISH_CATALOG.flatMap((dish) => {
    const credit = CATALOG_PHOTO_CREDITS[catalogDishSlug(dish.name)];
    return credit ? [{ name: dish.name, credit }] : [];
  });

  return (
    <Modal title="Crédits des photos" onClose={onClose}>
      <p className="field-hint">
        Les photos des plats proposés viennent de Wikimedia Commons, sous licence libre. Elles
        ont été recadrées et réduites.
      </p>
      <ul className="photo-credits-list">
        {entries.map(({ name, credit }) => (
          <li key={name}>
            <strong>{name}</strong>
            <PhotoCreditLine credit={credit} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}
