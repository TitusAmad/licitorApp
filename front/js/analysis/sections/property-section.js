
import {
    formatPrice,
    formatSurface,
    escapeHTML,
    getFinalPricePerSquareMeter
} from "../analysis-utils.js";


/**
 * Détermine le statut de vente du bien.
 *
 * La présence d'un prix final valide indique
 * que le bien a été vendu.
 */
function getSaleContext(announcement) {

    const finalPrice = Number(announcement.prix_final);

    const isSold =
        announcement.prix_final !== null &&
        announcement.prix_final !== undefined &&
        announcement.prix_final !== "" &&
        Number.isFinite(finalPrice) &&
        finalPrice > 0;

    return {
        isSold,
        status: isSold ? "sold" : "pending",
        startingPrice: announcement.mise_a_prix ?? null,
        finalPrice: isSold ? finalPrice : null
    };
}


/**
 * Génère la section 01 - Bien analysé.
 */
export function renderPropertySection(announcement) {

    const container = document.getElementById(
        "analysis-property-content"
    );

    if (!container) {
        console.warn("Conteneur de la section Bien analysé introuvable.");
        return;
    }

    if (!announcement) {
        container.innerHTML = "<p>Informations du bien indisponibles.</p>";
        return;
    }

    // -----------------------------------------
    // 1. CONTEXTE DE VENTE
    // -----------------------------------------

    const sale = getSaleContext(announcement);


    // -----------------------------------------
    // 2. ESTIMATION STATISTIQUE
    // -----------------------------------------

    const stats = announcement.stats_bien || {};

    const finalPricePerM2 = getFinalPricePerSquareMeter(announcement);

    const estimatedPriceM2 = Number(stats.avg);
    const surface = Number(announcement.surface_m2);

    const hasEstimatedPriceM2 =
        Number.isFinite(estimatedPriceM2) &&
        estimatedPriceM2 > 0;

    const hasSurface =
        Number.isFinite(surface) &&
        surface > 0;

    const estimatedTotal =
        hasEstimatedPriceM2 && hasSurface
            ? estimatedPriceM2 * surface
            : null;


    // -----------------------------------------
    // 3. PRÉPARATION DES INFORMATIONS
    // -----------------------------------------

    const propertyType = Array.isArray(announcement.type)
        ? announcement.type.join(", ")
        : announcement.type;

    const description = Array.isArray(announcement.description)
        ? announcement.description.join(" ")
        : announcement.description;

    const statusHTML = sale.isSold
        ? `<span class="property-status property-status-sold">Vendu</span>`
        : `<span class="property-status property-status-pending">Non vendu</span>`;


    // -----------------------------------------
    // 4. GÉNÉRATION HTML
    // -----------------------------------------

    container.innerHTML = `

        <div class="property-summary">

            <div class="property-summary-header">

                <div class="property-main-info">

                    <div class="property-type">
                        ${escapeHTML(propertyType || "Bien immobilier")}
                    </div>

                    <div class="property-address">
                        ${escapeHTML(announcement.adresse || "Adresse non renseignée")}
                    </div>

                    <div class="property-location">
                        ${escapeHTML(announcement.code_postal || "")}
                        ${escapeHTML(announcement.ville || "")}
                    </div>

                </div>

                ${statusHTML}

            </div>


            <div class="property-characteristics">

                <div class="property-characteristic">

                    <span class="property-label">Surface</span>

                    <strong>
                        ${formatSurface(announcement.surface_m2)}
                    </strong>

                </div>

                <div class="property-characteristic">

                    <span class="property-label">Occupation</span>

                    <strong>
                        ${escapeHTML(announcement.occupation || "Non renseignée")}
                    </strong>

                </div>

            </div>


            ${description ? `
                <div class="property-description">
                    ${escapeHTML(description)}
                </div>
            ` : ""}


            <div class="property-financial">

                <div class="property-financial-heading">
                    Informations financières
                </div>

                <div class="property-financial-grid">

                    <div class="property-financial-item">

                        <span class="property-label">Mise à prix</span>

                        <strong>
                            ${formatPrice(sale.startingPrice)}
                        </strong>

                    </div>


                    ${sale.isSold ? `

                        <div class="property-financial-item">

                            <span class="property-label">Prix final</span>

                            <strong>
                                ${formatPrice(sale.finalPrice)}
                            </strong>

                        </div>

                        <div class="property-financial-item">

                            <span class="property-label">Prix final/m²</span>

                            <strong>
                                ${formatPrice(finalPricePerM2)}
                            </strong>

                        </div>

                    ` : ""}


                    ${hasEstimatedPriceM2 ? `

                        <div class="property-financial-item">

                            <span class="property-label">Estimation au m²</span>

                            <strong>
                                ${formatPrice(estimatedPriceM2)}/m²
                            </strong>

                        </div>

                    ` : ""}


                    ${estimatedTotal !== null ? `

                        <div class="property-financial-item">

                            <span class="property-label">Estimation totale</span>

                            <strong>
                                ${formatPrice(estimatedTotal)}
                            </strong>

                        </div>

                    ` : ""}

                </div>

            </div>

        </div>

    `;
}
