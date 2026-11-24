
/* ==================================================
   ANNOUNCEMENT FILTERING
   Combinaison des trois couches de filtrage
================================================== */

import {
    filterAnnouncements as applyPredefinedFilter
} from "./announcement-filters.js";


// --------------------------------------------------
// CONFIGURATION DES SOURCES
// --------------------------------------------------

const PAGE_SOURCES = {

    visits: "non_realisees",

    sales: "historiques"

};


// --------------------------------------------------
// FONCTION PRINCIPALE
// --------------------------------------------------

export function getFilteredAnnouncements(
    announcements,
    options = {}
) {

    if (!Array.isArray(announcements)) {
        throw new TypeError(
            "Les annonces doivent être fournies sous forme de tableau."
        );
    }

    const {
        pageType,
        predefinedMethod = "toutes",
        searchTerm = "",
        appliedFilters = {},
        getTotalPrice,
        getPricePerM2
    } = options;


    // --------------------------------------------------
    // VÉRIFICATION DE LA PAGE
    // --------------------------------------------------

    const source = PAGE_SOURCES[pageType];

    if (!source) {
        throw new Error(
            `Type de page inconnu : ${pageType}`
        );
    }


    // --------------------------------------------------
    // 1. FILTRE PRÉDÉFINI
    // --------------------------------------------------

    let filteredAnnouncements = applyPredefinedFilter(
        announcements,
        predefinedMethod,
        { source }
    );


    // --------------------------------------------------
    // 2. RECHERCHE TEXTUELLE
    // --------------------------------------------------

    const normalizedSearch = normalizeSearchValue(searchTerm);

    if (normalizedSearch) {

        filteredAnnouncements = filteredAnnouncements.filter(
            announcement => {

                const valeursRecherche = [
                    announcement.ville || "",
                    announcement.nom_departement || "",
                    announcement.nom_region || ""
                ];

                return valeursRecherche.some(value =>
                    normalizeSearchValue(value).includes(
                        normalizedSearch
                    )
                );

            }
        );

    }


    // --------------------------------------------------
    // 3. FILTRES MANUELS
    // --------------------------------------------------

    filteredAnnouncements = filteredAnnouncements.filter(
        announcement => {

            // ------------------------------------------
            // SURFACE
            // ------------------------------------------

            const surface = toNumber(
                announcement.surface_m2
            );

            if (!matchesNumericRange(
                surface,
                appliedFilters.surfaceMin,
                appliedFilters.surfaceMax
            )) return false;


            // ------------------------------------------
            // MISE À PRIX
            // ------------------------------------------

            const prix = toNumber(
                announcement.mise_a_prix
            );

            if (!matchesNumericRange(
                prix,
                appliedFilters.prixMin,
                appliedFilters.prixMax
            )) return false;


            // ------------------------------------------
            // PRIX TOTAL
            // ------------------------------------------

            if (
                appliedFilters.prixTotalMin !== null ||
                appliedFilters.prixTotalMax !== null
            ) {

                const prixTotal = getTotalPrice(announcement);

                if (!matchesNumericRange(
                    prixTotal,
                    appliedFilters.prixTotalMin,
                    appliedFilters.prixTotalMax
                )) return false;

            }


            // ------------------------------------------
            // PRIX AU M²
            // ------------------------------------------

            if (
                appliedFilters.prixM2Min !== null ||
                appliedFilters.prixM2Max !== null
            ) {

                const prixM2 = getPricePerM2(announcement);

                if (!matchesNumericRange(
                    prixM2,
                    appliedFilters.prixM2Min,
                    appliedFilters.prixM2Max
                )) return false;

            }

            // ------------------------------------------
            // OCCUPATION
            // ------------------------------------------

            const occupation = appliedFilters.occupation;

            if ( 
                occupation != "Toutes" &&
                occupation != announcement.occupation
            ) {
                return false
            }

            // ------------------------------------------
            // FACULTE BAISSE
            // ------------------------------------------

            const faculteBaisse = appliedFilters.faculteBaisse;

            if ( 
                faculteBaisse &&
                !(announcement.fac_baisse === true)
            ) {
                return false
            }

            // ------------------------------------------
            // ANOMALIE TRIBUNAL
            // ------------------------------------------

            const tribunalAnomalie = appliedFilters.tribunalAnomalie;

            if ( 
                tribunalAnomalie &&
                !(announcement.trib_anom === true)
            ) {
                return false
            }
        
            // ------------------------------------------
            // TRIBUNAUX
            // ------------------------------------------

            const tribunaux = appliedFilters.tribunaux || [];

            if (
                tribunaux.length > 0 &&
                !tribunaux.includes(
                    String(announcement.tribunal ?? "").trim()
                )
            ) return false;


            // ------------------------------------------
            // PÉRIODE DE VISITE OU DE VENTE
            // ------------------------------------------

            if (
                appliedFilters.dateStart ||
                appliedFilters.dateEnd
            ) {

                const dateValue = parseSaleDate(
                    announcement[appliedFilters.dateField]
                );

                // Une annonce sans date ne correspond pas
                if (dateValue === null) {
                    return false;
                }

                const startDate = appliedFilters.dateStart
                    ? new Date(
                        appliedFilters.dateStart + "T00:00:00"
                    ).getTime()
                    : null;

                const endDate = appliedFilters.dateEnd
                    ? new Date(
                        appliedFilters.dateEnd + "T23:59:59.999"
                    ).getTime()
                    : null;

                if (
                    startDate !== null &&
                    dateValue < startDate
                ) return false;

                if (
                    endDate !== null &&
                    dateValue > endDate
                ) return false;

            }


            return true;

        }
    );


    return filteredAnnouncements;

}


// --------------------------------------------------
// UTILITAIRES
// --------------------------------------------------


// Normalisation de la recherche textuelle
function normalizeSearchValue(value) {

    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

}


// Conversion numérique sécurisée
function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;

}


// Vérification d'un intervalle numérique
function matchesNumericRange(value, min, max) {

    const hasMin = min !== null;
    const hasMax = max !== null;

    // Aucun filtre sur cette valeur
    if (!hasMin && !hasMax) {
        return true;
    }

    // Valeur absente ou inexploitable
    if (value === null) {
        return false;
    }

    if (hasMin && value < min) {
        return false;
    }

    if (hasMax && value > max) {
        return false;
    }

    return true;

}


// Parsing des dates
function parseSaleDate(dateString) {

    if (!dateString) {
        return null;
    }

    const date = new Date(
        String(dateString).replace(" ", "T")
    );

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.getTime();

}
