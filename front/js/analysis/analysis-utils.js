
/**
 * Formate un montant en euros.
 */
export function formatPrice(value) {

    if (value === null || value === undefined || value === "") {
        return "Non renseigné";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Non renseigné";
    }

    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0
    }).format(number);
}


/**
 * Formate un nombre.
 */
export function formatNumber(value, decimals = 2) {

    if (value === null || value === undefined || value === "") {
        return "Non renseigné";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Non renseigné";
    }

    return new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
    }).format(number);
}


/**
 * Formate une surface en m².
 */
export function formatSurface(value) {

    if (value === null || value === undefined || value === "") {
        return "Non renseignée";
    }

    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return "Non renseignée";
    }

    return `${formatNumber(number)} m²`;
}


/**
 * Échappe les caractères HTML.
 * Évite l'injection de HTML provenant des données externes.
 */
export function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}


/**
 * Vérifie qu'une valeur numérique est exploitable.
 */
export function isValidNumber(value) {

    if (value === null || value === undefined || value === "") {
        return false;
    }

    return Number.isFinite(Number(value));
}

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

export function getFinalPricePerSquareMeter(announcement) {

    const finalPrice = toNumber(announcement.prix_final);
    const surface = toNumber(announcement.surface_m2);

    if (finalPrice === null || surface === null || surface <= 0) {
        return null;
    }

    return finalPrice / surface;
}
