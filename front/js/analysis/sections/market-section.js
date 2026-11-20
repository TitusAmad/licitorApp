
import {
    formatPrice,
    formatNumber,
    escapeHTML
} from "../analysis-utils.js";


/**
 * Formate une date ISO en date française.
 */
function formatSaleDate(value) {

    if (!value) return "Non renseignée";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Non renseignée";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC"
    }).format(date);
}


/**
 * Formate un prix au m².
 */
function formatPriceM2(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "—";
    }

    return `${formatPrice(value)}/m²`;
}


/**
 * Formate une fourchette de prix.
 */
function formatPriceRange(min, max) {

    if (
        min === null || min === undefined ||
        max === null || max === undefined ||
        !Number.isFinite(Number(min)) ||
        !Number.isFinite(Number(max))
    ) {
        return "—";
    }

    return `${formatNumber(min, 0)} – ${formatNumber(max, 0)} €/m²`;
}


/**
 * Génère une ligne du tableau des périodes.
 */
function renderPeriodRow(label, statistics) {

    if (!statistics) return "";

    const total = statistics.transactionCount ?? null;
    const usable = statistics.count ?? 0;
    const additional = statistics.additionalTransactions;

    let transactionLabel = "—";

    if (total !== null) {

        transactionLabel = formatNumber(total, 0);

        if (additional > 0) {
            transactionLabel += ` <span class="market-additional">(+${formatNumber(additional, 0)})</span>`;
        }

        transactionLabel += `
            <span class="market-usable-count">
                ${formatNumber(usable, 0)} exploitables
            </span>
        `;
    }

    return `
        <tr>
            <td class="market-period-label">${label}</td>

            <td>
                ${transactionLabel}
            </td>

            <td class="market-price-value">
                ${formatPriceM2(statistics.average)}
            </td>

            <td class="market-range-value">
                ${formatPriceRange(statistics.min, statistics.max)}
            </td>
        </tr>
    `;
}


/**
 * Génère la section 02 - Synthèse du marché.
 */
export function renderMarketSection(metadata, statistics) {

    const container = document.getElementById(
        "analysis-market-content"
    );

    if (!container) {
        console.warn(
            "Conteneur de la section Synthèse du marché introuvable."
        );
        return;
    }

    if (!metadata || !statistics) {

        container.innerHTML = `
            <p class="market-empty">
                Données de marché indisponibles.
            </p>
        `;

        return;
    }

    // -----------------------------------------
    // 1. MÉTADONNÉES
    // -----------------------------------------

    const radius = Number(metadata.radiusKm);

    const radiusLabel = Number.isFinite(radius)
        ? `${formatNumber(radius)} km`
        : "Non renseigné";

    const firstSaleDate = formatSaleDate(
        metadata.firstSaleDate
    );

    const lastSaleDate = formatSaleDate(
        metadata.lastSaleDate
    );


    // -----------------------------------------
    // 2. INDICATEURS GÉNÉRAUX
    // -----------------------------------------

    const totalTransactions = Number(
        metadata.totalTransactions ?? 0
    );

    const transactionsWithSurface = Number(
        metadata.transactionsWithSurface ?? 0
    );

    const transactionsWithoutSurface = Number(
        metadata.transactionsWithoutSurface ?? 0
    );

    const coverage = totalTransactions > 0
        ? (transactionsWithSurface / totalTransactions) * 100
        : null;


    // -----------------------------------------
    // 3. STATISTIQUES GLOBALES
    // -----------------------------------------

    const all = statistics.all ?? {};

    const average = formatPriceM2(all.average);
    const median = formatPriceM2(all.median);
    const min = formatPriceM2(all.min);
    const max = formatPriceM2(all.max);


    // -----------------------------------------
    // 4. TABLEAU DES PÉRIODES
    // -----------------------------------------

    const periodsHTML = [
        renderPeriodRow("3 mois", statistics["3months"]),
        renderPeriodRow("6 mois", statistics["6months"]),
        renderPeriodRow("12 mois", statistics["12months"])
    ].join("");


    // -----------------------------------------
    // 5. GÉNÉRATION HTML
    // -----------------------------------------

    container.innerHTML = `

        <div class="market-summary">


            <!-- EN-TÊTE -->

            <div class="market-header">

                <span class="market-radius">
                    Rayon d'analyse : ${escapeHTML(radiusLabel)}
                </span>

                <div class="market-dates">

                    <span>
                        Première vente :
                        <strong>${escapeHTML(firstSaleDate)}</strong>
                    </span>

                    <span>
                        Dernière vente :
                        <strong>${escapeHTML(lastSaleDate)}</strong>
                    </span>

                </div>

            </div>


            <!-- INDICATEURS -->

            <div class="market-indicators">


                <div class="market-indicator">

                    <span class="market-label">
                        Transactions recensées
                    </span>

                    <strong class="market-indicator-value">
                        ${formatNumber(totalTransactions, 0)}
                    </strong>

                    <span class="market-indicator-detail">
                        ${formatNumber(transactionsWithSurface, 0)} avec surface exploitable
                    </span>

                </div>


                <div class="market-indicator">

                    <span class="market-label">
                        Prix moyen au m²
                    </span>

                    <strong class="market-indicator-value">
                        ${average}
                    </strong>

                    <span class="market-indicator-detail">
                        Toutes périodes
                    </span>

                </div>


                <div class="market-indicator">

                    <span class="market-label">
                        Prix médian au m²
                    </span>

                    <strong class="market-indicator-value">
                        ${median}
                    </strong>

                    <span class="market-indicator-detail">
                        Toutes périodes
                    </span>

                </div>


                <div class="market-indicator">

                    <span class="market-label">
                        Couverture des données
                    </span>

                    <strong class="market-indicator-value">
                        ${coverage !== null
                            ? `${formatNumber(coverage, 1)} %`
                            : "—"}
                    </strong>

                    <span class="market-indicator-detail">
                        ${formatNumber(transactionsWithoutSurface, 0)} sans surface exploitable
                    </span>

                </div>

            </div>


            <!-- DISTRIBUTION GLOBALE -->

            <div class="market-range">

                <div class="market-range-heading">
                    Fourchette des prix observés
                </div>

                <div class="market-range-values">

                    <div>
                        <span class="market-label">Minimum</span>
                        <strong>${min}</strong>
                    </div>

                    <div class="market-range-separator"></div>

                    <div>
                        <span class="market-label">Maximum</span>
                        <strong>${max}</strong>
                    </div>

                </div>

            </div>


            <!-- TABLEAU DES PÉRIODES -->

            <div class="market-periods">

                <div class="market-periods-heading">
                    Évolution des statistiques selon la période
                </div>

                <div class="market-table-wrapper">

                    <table class="market-table">

                        <thead>
                            <tr>
                                <th>Période</th>
                                <th>Transactions</th>
                                <th>Moyenne</th>
                                <th>Min. / Max.</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${periodsHTML}
                        </tbody>

                    </table>

                </div>

                <div class="market-table-legend">
                    Le nombre entre parenthèses indique les transactions
                    supplémentaires par rapport à la période précédente.
                    Les transactions exploitables sont celles disposant
                    d'une surface permettant de calculer un prix au m².
                </div>

            </div>

        </div>

    `;
}
