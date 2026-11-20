import { parseDate } from "./date-utils.js";

// PARAMÈTRES GÉNÉRAUX
const TOP_LATEST_TRANSACTIONS = 10;

// --------------------------------------------------
// NORMALISATION DES TRANSACTIONS
// --------------------------------------------------

function prepareTransaction(sale) {

    const finalPrice = toNumber(sale.prix_final);

    const surface = toNumber(sale.surface_m2);

    const estimatedPriceM2 = toNumber(
        sale.stats_bien?.avg
    );

    const date = parseDate(sale.dt_vente);

    // Prix final au m²
    const priceM2 =
        finalPrice !== null &&
        finalPrice > 0 &&
        surface !== null &&
        surface > 0
            ? finalPrice / surface
            : null;

    // Estimation totale
    const estimatedTotal =
        estimatedPriceM2 !== null &&
        estimatedPriceM2 > 0 &&
        surface !== null &&
        surface > 0
            ? estimatedPriceM2 * surface
            : null;

    // Ratio par rapport à l'estimation
    let saleRatio = null;

    if (
        finalPrice !== null &&
        estimatedTotal !== null &&
        estimatedTotal > 0
    ) {

        saleRatio =
            ((finalPrice - estimatedTotal) /
                estimatedTotal) * 100;

    }

    // Classification du ratio
    let ratioCategory = "unavailable";

    if (saleRatio !== null) {

        if (saleRatio < -5) {
            ratioCategory = "below";
        } else if (saleRatio > 5) {
            ratioCategory = "above";
        } else {
            ratioCategory = "near";
        }

    }

    return {

        ...sale,

        finalPrice,
        surface,

        priceM2,

        estimatedPriceM2,

        estimatedTotal,

        saleRatio,

        ratioCategory,

        saleDate: date,

        // Distance en kilomètres
        distanceKm:
            toNumber(sale.distance_m) !== null
                ? toNumber(sale.distance_m) / 1000
                : null

    };
}


// --------------------------------------------------
// STATISTIQUES TEMPORELLES
// --------------------------------------------------


function getPeriodStatistics(
    transactions,
    referenceDate
) {

    const periods = [
        {
            key: "3months",
            months: 3
        },
        {
            key: "6months",
            months: 6
        },
        {
            key: "12months",
            months: 12
        }
    ];

    const result = {};

    // Nombre de transactions par période
    const periodCounts = {};

    periods.forEach(period => {

        const startDate = new Date(referenceDate);

        startDate.setMonth(
            startDate.getMonth() - period.months
        );

        // Toutes les transactions vendues sur la période
        const periodTransactions = transactions.filter(
            transaction => {

                return (
                    transaction.saleDate >= startDate &&
                    transaction.saleDate <= referenceDate
                );

            }
        );

        // Transactions exploitables pour les statistiques au m²
        const transactionsWithSurface = periodTransactions.filter(
            transaction => transaction.priceM2 !== null
        );

        // Calculs statistiques existants
        const statistics = calculateStatistics(
            transactionsWithSurface
        );

        // Enrichissement des résultats
        periodCounts[period.key] = periodTransactions.length;

        result[period.key] = {

            ...statistics,

            transactionCount: periodTransactions.length,

            additionalTransactions: 0

        };

    });


    // Transactions supplémentaires par rapport à la période précédente

    result["6months"].additionalTransactions =
        periodCounts["6months"] -
        periodCounts["3months"];

    result["12months"].additionalTransactions =
        periodCounts["12months"] -
        periodCounts["6months"];


    // Historique complet
    const allTransactions = transactions.filter(
        transaction => transaction.priceM2 !== null
    );

    result.all = {

        ...calculateStatistics(allTransactions),

        transactionCount: transactions.length,

        additionalTransactions: null

    };

    return result;
}


// --------------------------------------------------
// ÉVOLUTION MENSUELLE
// --------------------------------------------------

function prepareMonthlyEvolution(transactions) {

    const monthlyGroups = new Map();

    transactions.forEach(transaction => {

        if (
            !transaction.saleDate ||
            transaction.priceM2 === null
        ) {
            return;
        }

        const year = transaction.saleDate.getFullYear();

        const month = String(
            transaction.saleDate.getMonth() + 1
        ).padStart(2, "0");

        const key = `${year}-${month}`;

        if (!monthlyGroups.has(key)) {
            monthlyGroups.set(key, []);
        }

        monthlyGroups.get(key).push(
            transaction.priceM2
        );

    });

    return [...monthlyGroups.entries()]
        .map(([month, prices]) => {

            const sum = prices.reduce(
                (total, price) => total + price,
                0
            );

            return {

                month,

                count: prices.length,

                average: sum / prices.length,

                median: getMedian(prices),

                min: Math.min(...prices),

                max: Math.max(...prices)

            };

        })
        .sort((a, b) =>
            a.month.localeCompare(b.month)
        );
}

// --------------------------------------------------
// PRÉPARATION COMPLÈTE DE L'ANALYSE
// --------------------------------------------------

export function prepareNearbySalesAnalysis({
    sales,
    latitude,
    longitude,
    radiusKm,
    announcementId,
    referenceDate = new Date()
}) {

    // ADAPTER: id du bien initialement analysé ne doit pas exister dans la liste des ventes à proximité !!
    // XXXX

    // 1. Normalisation
    const transactions = sales
        .map(prepareTransaction)

        // Sécurité : seules les ventes avec
        // prix final positif et date valide sont conservées.
        .filter(transaction =>
            transaction.finalPrice !== null &&
            transaction.finalPrice > 0 &&
            transaction.saleDate !== null &&
            transaction.saleDate <= referenceDate
        )

        // Tri chronologique décroissant
        .sort((a, b) =>
            b.saleDate - a.saleDate
        );

    // Transactions conservées après normalisation et filtrage
    const radiusTransactions = [...transactions];

    // Transactions utilisées pour qualifier le marché
    const marketTransactions = radiusTransactions.filter(
        transaction =>
            String(transaction.id) !== String(announcementId)
    );

    // 2. Statistiques par période
    const statistics = getPeriodStatistics(
        marketTransactions,
        referenceDate
    );

    // 3. Évolution mensuelle
    const monthlyEvolution =
        prepareMonthlyEvolution(marketTransactions);

    // 4. Dix dernières transactions
    // Surface non obligatoire
    const latestTransactions =
        radiusTransactions.slice(0, TOP_LATEST_TRANSACTIONS);

    // 5. Répartition des ratios
    const transactionsWithRatio = marketTransactions.filter(
        transaction =>
            transaction.ratioCategory !== "unavailable"
    );

    const ratioDistribution = {

        count: transactionsWithRatio.length,

        below: transactionsWithRatio.filter(
            t => t.ratioCategory === "below"
        ).length,

        near: transactionsWithRatio.filter(
            t => t.ratioCategory === "near"
        ).length,

        above: transactionsWithRatio.filter(
            t => t.ratioCategory === "above"
        ).length

    };

    // 6. Métadonnées
    const firstSale = marketTransactions.length
        ? marketTransactions[marketTransactions.length - 1].saleDate
        : null;

    const lastSale = marketTransactions.length
        ? marketTransactions[0].saleDate
        : null;

    // 6. Métadonnées
    return {

        metadata: {

            latitude: Number(latitude),

            longitude: Number(longitude),

            radiusKm: Number(radiusKm),

            analysisDate: referenceDate.toISOString(),

            firstSaleDate: firstSale
                ? firstSale.toISOString()
                : null,

            lastSaleDate: lastSale
                ? lastSale.toISOString()
                : null,

            totalTransactions: marketTransactions.length,

            transactionsWithSurface: marketTransactions.filter(
                t => t.priceM2 !== null
            ).length,

            transactionsWithoutSurface: marketTransactions.filter(
                t => t.priceM2 === null
            ).length

        },

        statistics,

        monthlyEvolution,

        latestTransactions,

        ratioDistribution,

        marketTransactions,

        radiusTransactions

    };

}

// --------------------------------------------------
// UTILITAIRES
// --------------------------------------------------

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


function getMedian(values) {

    if (values.length === 0) return null;

    const sorted = [...values].sort(
        (a, b) => a - b
    );

    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {

        return (
            sorted[middle - 1] +
            sorted[middle]
        ) / 2;

    }

    return sorted[middle];
}


function calculateStatistics(transactions) {

    const prices = transactions
        .map(transaction => transaction.priceM2)
        .filter(value => value !== null);

    if (prices.length === 0) {

        return {
            count: 0,
            average: null,
            median: null,
            min: null,
            max: null
        };

    }

    const sum = prices.reduce(
        (total, price) => total + price,
        0
    );

    return {

        count: prices.length,

        average: sum / prices.length,

        median: getMedian(prices),

        min: Math.min(...prices),

        max: Math.max(...prices)

    };
}


