
/**
 * SECTION 07 - POSITIONNEMENT DU BIEN
 */


/**
 * Échappement HTML.
 */
function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);

}


/**
 * Formate un prix au m².
 */
function formatPositionPrice(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "—";
    }

    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(value) + " €/m²";

}


/**
 * Formate un pourcentage.
 */
function formatPositionPercentage(value) {

    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 1,
        signDisplay: "always"
    }).format(value) + " %";

}

function getValidPrice(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) && number > 0
        ? number
        : null;

}


/**
 * Détermine le prix de référence du bien.
 *
 * Bien vendu :
 * prix final / surface
 *
 * Bien non vendu :
 * stats_bien.avg
 *
 * Si le bien est vendu mais que sa surface est
 * indisponible, aucune estimation de remplacement.
 */
function getPropertyReference(announcement) {

    const finalPrice = Number(announcement?.prix_final);

    const isSold =
        announcement?.prix_final !== null &&
        announcement?.prix_final !== undefined &&
        Number.isFinite(finalPrice) &&
        finalPrice > 0;

    if (isSold) {

        const surface = Number(announcement?.surface_m2);

        if (
            !Number.isFinite(surface) ||
            surface <= 0
        ) {
            return null;
        }

        return {
            value: finalPrice / surface,
            label: "Prix de vente",
            type: "sold"
        };

    }

    const estimatedPrice = Number(
        announcement?.stats_bien?.avg
    );

    if (
        announcement?.stats_bien?.avg === null ||
        announcement?.stats_bien?.avg === undefined ||
        !Number.isFinite(estimatedPrice) ||
        estimatedPrice <= 0
    ) {
        return null;
    }

    return {
        value: estimatedPrice,
        label: "Estimation du bien",
        type: "estimated"
    };

}


/**
 * Calcule l'écart en pourcentage par rapport
 * à une valeur de référence.
 */
function calculatePercentageDifference(value, reference) {

    if (
        !Number.isFinite(value) ||
        !Number.isFinite(reference) ||
        reference <= 0
    ) {
        return null;
    }

    return ((value - reference) / reference) * 100;

}


/**
 * Génère un commentaire descriptif.
 */
function generatePositionComment(propertyPrice, market) {

    if (
        propertyPrice === null ||
        !Number.isFinite(market.average) ||
        market.average <= 0 ||
        !Number.isFinite(market.median) ||
        market.median <= 0
    ) {
        return null;
    }

    const averageDifference = calculatePercentageDifference(
        propertyPrice,
        market.average
    );

    const medianDifference = calculatePercentageDifference(
        propertyPrice,
        market.median
    );

    const averageDescription =
        averageDifference < 0
            ? `${Math.abs(averageDifference).toFixed(1).replace(".", ",")} % inférieur à la moyenne`
            : averageDifference > 0
                ? `${averageDifference.toFixed(1).replace(".", ",")} % supérieur à la moyenne`
                : "égal à la moyenne";

    const medianDescription =
        medianDifference < 0
            ? `${Math.abs(medianDifference).toFixed(1).replace(".", ",")} % inférieur à la médiane`
            : medianDifference > 0
                ? `${medianDifference.toFixed(1).replace(".", ",")} % supérieur à la médiane`
                : "égal à la médiane";

    return {
        averageDifference,
        medianDifference,
        averageDescription,
        medianDescription
    };

}


/**
 * Calcule la position d'une valeur sur une échelle.
 */
function getScalePosition(value, min, max) {

    if (max <= min) return 50;

    return Math.max(
        0,
        Math.min(
            100,
            ((value - min) / (max - min)) * 100
        )
    );

}


/**
 * Génère le bloc de positionnement visuel.
 */
function renderPositionGauge(propertyPrice, market) {

    if (
        propertyPrice === null ||
        market.min === null ||
        market.max === null ||
        !Number.isFinite(market.min) ||
        !Number.isFinite(market.max) ||
        market.max < market.min
    ) {

        return `
            <div class="position-gauge-unavailable">
                Positionnement graphique indisponible.
            </div>
        `;

    }

    // L'échelle inclut le prix du bien, même s'il
    // est situé en dehors de la fourchette du marché.
    const scaleMin = Math.min(market.min, propertyPrice);
    const scaleMax = Math.max(market.max, propertyPrice);

    const padding = Math.max(
        (scaleMax - scaleMin) * 0.08,
        scaleMax * 0.01,
        1
    );

    const min = scaleMin - padding;
    const max = scaleMax + padding;

    const marketStart = getScalePosition(
        market.min,
        min,
        max
    );

    const marketEnd = getScalePosition(
        market.max,
        min,
        max
    );

    const propertyPosition = getScalePosition(
        propertyPrice,
        min,
        max
    );

    const medianPosition = market.median !== null
        ? getScalePosition(market.median, min, max)
        : null;

    const averagePosition = market.average !== null
        ? getScalePosition(market.average, min, max)
        : null;

    const belowMarket = propertyPrice < market.min;
    const aboveMarket = propertyPrice > market.max;

    let positionLabel = "Dans la fourchette du marché";

    if (belowMarket) {
        positionLabel = "Sous la fourchette du marché";
    } else if (aboveMarket) {
        positionLabel = "Au-dessus de la fourchette du marché";
    }

    return `

        <div class="position-gauge">

            <div class="position-gauge-status">
                ${escapeHTML(positionLabel)}
            </div>

            <div class="position-gauge-track">

                <div
                    class="position-gauge-market-range"
                    style="
                        left: ${marketStart}%;
                        width: ${Math.max(0, marketEnd - marketStart)}%;
                    "
                ></div>

                ${averagePosition !== null ? `
                    <div
                        class="position-gauge-average"
                        style="left: ${averagePosition}%"
                        title="Moyenne du marché"
                    ></div>
                ` : ""}

                ${medianPosition !== null ? `
                    <div
                        class="position-gauge-median"
                        style="left: ${medianPosition}%"
                        title="Médiane du marché"
                    ></div>
                ` : ""}

                <div
                    class="position-gauge-property"
                    style="left: ${propertyPosition}%"
                ></div>

            </div>

            <div class="position-gauge-labels">

                <div>
                    <strong>${formatPositionPrice(market.min)}</strong>
                    <span>Minimum</span>
                </div>

                <div>
                    <strong>${formatPositionPrice(market.max)}</strong>
                    <span>Maximum</span>
                </div>

                <div class="position-gauge-property-label">
                    <strong>${formatPositionPrice(propertyPrice)}</strong>
                    <span>Bien analysé</span>
                </div>
            </div>

            <div class="position-gauge-legend">

                <span>
                    <i class="position-legend-range"></i>
                    Fourchette du marché
                </span>

                <span>
                    <i class="position-legend-average"></i>
                    Moyenne
                </span>

                <span>
                    <i class="position-legend-median"></i>
                    Médiane
                </span>

                <span>
                    <i class="position-legend-property"></i>
                    Bien analysé
                </span>

            </div>

        </div>

    `;

}


/**
 * Génère la comparaison statistique.
 */
function renderPositionStatistics(propertyReference, market) {

    const propertyValue = propertyReference?.value ?? null;

    const rows = [

        {
            label: propertyReference?.label ?? "Bien analysé",
            value: propertyValue,
            className: "property"
        },

        {
            label: "Moyenne du marché",
            value: market.average,
            className: ""
        },

        {
            label: "Médiane du marché",
            value: market.median,
            className: ""
        },

        {
            label: "Minimum du marché",
            value: market.min,
            className: ""
        },

        {
            label: "Maximum du marché",
            value: market.max,
            className: ""
        }

    ];

    return `

        <div class="position-statistics">

            ${rows.map(row => `

                <div class="position-statistics-row ${row.className}">

                    <span>${escapeHTML(row.label)}</span>

                    <strong>
                        ${formatPositionPrice(row.value)}
                    </strong>

                </div>

            `).join("")}

        </div>

    `;

}


/**
 * Génère l'interprétation automatique.
 */
function renderPositionInterpretation(comment, market) {

    if (!comment) {

        return `
            <div class="position-interpretation-unavailable">
                Les données disponibles ne permettent pas
                de comparer précisément le bien au marché.
            </div>
        `;

    }

    const averageText = comment.averageDifference < 0
        ? "Le prix du bien se situe"
        : "Le prix du bien se situe";

    return `

        <div class="position-interpretation">

            <div class="position-interpretation-title">
                Lecture du positionnement
            </div>

            <p>
                ${averageText}
                <strong>${escapeHTML(comment.averageDescription)}</strong>
                observée sur les transactions du secteur.
            </p>

            <p>
                Par rapport à la médiane, il est
                <strong>${escapeHTML(comment.medianDescription)}</strong>.
            </p>

            <div class="position-interpretation-sample">
                Comparaison établie sur
                <strong>${market.count}</strong>
                transaction(s) disposant d'un prix au m² exploitable.
            </div>

        </div>

    `;

}

/**
 * Génère la section 07 - Positionnement du bien.
 */
export function renderPositionSection(announcement, stats) {

    const container = document.getElementById(
        "analysis-position-content"
    );

    if (!container) {
        console.warn(
            "Conteneur du positionnement introuvable."
        );
        return;
    }

    if (!stats) {

        container.innerHTML = `
            <div class="position-empty">
                Les statistiques du marché sont indisponibles.
            </div>
        `;

        return;
    }


    // -----------------------------------------
    // 1. STATISTIQUES DU MARCHÉ
    // -----------------------------------------

    const market = {

        count: Number(stats.count) || 0,

        average: getValidPrice(stats.average),

        median: getValidPrice(stats.median),

        min: getValidPrice(stats.min),

        max: getValidPrice(stats.max)

    };


    // -----------------------------------------
    // 2. PRIX DE RÉFÉRENCE DU BIEN
    // -----------------------------------------

    const propertyReference = getPropertyReference(
        announcement
    );

    const propertyPrice = propertyReference?.value ?? null;


    // -----------------------------------------
    // 3. COMMENTAIRE AUTOMATIQUE
    // -----------------------------------------

    const comment = generatePositionComment(
        propertyPrice,
        market
    );


    // -----------------------------------------
    // 4. RENDU
    // -----------------------------------------

    container.innerHTML = `

        <div class="position-container">

            <div class="position-heading">

                <div>
                    <div class="position-title">
                        Positionnement par rapport au marché
                    </div>

                    <div class="position-subtitle">
                        Comparaison des prix au m²
                    </div>
                </div>

            </div>

            ${propertyReference ? `
                <div class="position-property-reference">

                    <span>
                        ${escapeHTML(propertyReference.label)}
                    </span>

                    <strong>
                        ${formatPositionPrice(propertyPrice)}
                    </strong>

                </div>
            ` : `
                <div class="position-reference-unavailable">
                    Le prix de référence du bien est indisponible.
                </div>
            `}

            ${renderPositionGauge(propertyPrice, market)}

            ${renderPositionStatistics(propertyReference, market)}

            ${renderPositionInterpretation(comment, market)}

        </div>

    `;

}
