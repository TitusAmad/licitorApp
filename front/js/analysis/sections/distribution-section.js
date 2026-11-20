
/**
 * SECTION 06 - DISTRIBUTION DES PRIX AU M²
 */

let distributionChart = null;


/**
 * Formate un prix au m².
 */
function formatDistributionPrice(value) {

    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(value) + " €/m²";

}


/**
 * Détermine le prix de référence du bien analysé.
 *
 * Bien vendu : prix final / surface
 * Bien non vendu : estimation moyenne au m²
 */
function getReferencePriceM2(announcement) {

    const finalPrice = Number(announcement?.prix_final);
    const surface = Number(announcement?.surface_m2);

    // Bien vendu
    if (
        announcement?.prix_final !== null &&
        announcement?.prix_final !== undefined &&
        Number.isFinite(finalPrice) &&
        finalPrice > 0
    ) {

        if (
            !Number.isFinite(surface) ||
            surface <= 0
        ) {
            return null;
        }

        return finalPrice / surface;
    }

    // Bien non vendu : estimation issue des statistiques du bien
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

    return estimatedPrice;

}


/**
 * Détermine un nombre de classes adapté.
 *
 * Règle de Sturges :
 * nombre de classes = 1 + 3.322 × log10(n)
 */
function getBinCount(count) {

    if (count <= 1) return 1;

    return Math.max(
        5,
        Math.min(
            12,
            Math.ceil(1 + 3.322 * Math.log10(count))
        )
    );

}


/**
 * Détermine un pas de prix lisible.
 */
function getNiceStep(value) {

    if (!Number.isFinite(value) || value <= 0) {
        return 1000;
    }

    const magnitude = Math.pow(
        10,
        Math.floor(Math.log10(value))
    );

    const normalized = value / magnitude;

    let niceValue;

    if (normalized <= 1) {
        niceValue = 1;
    } else if (normalized <= 2) {
        niceValue = 2;
    } else if (normalized <= 5) {
        niceValue = 5;
    } else {
        niceValue = 10;
    }

    return niceValue * magnitude;

}


/**
 * Construit les classes de l'histogramme.
 */

function prepareDistribution(prices, referencePrice = null) {

    const domainValues = referencePrice !== null
        ? [...prices, referencePrice]
        : prices;

    const min = Math.min(...domainValues);
    const max = Math.max(...domainValues);

    // Conserver ici le reste de la fonction précédente.

    // Cas particulier : toutes les valeurs sont identiques
    if (min === max) {

        const step = getNiceStep(min * 0.1);

        const start = Math.floor(min / step) * step;

        return {
            min: start,
            max: start + step,
            step,
            bins: [{
                start,
                end: start + step,
                count: prices.length
            }]
        };

    }

    const binCount = getBinCount(prices.length);

    const rawStep = (max - min) / binCount;

    const step = getNiceStep(rawStep);

    const start = Math.floor(min / step) * step;

    const end = Math.ceil(max / step) * step;

    const actualBinCount = Math.max(
        1,
        Math.ceil((end - start) / step)
    );

    const bins = Array.from(
        { length: actualBinCount },
        (_, index) => {

            const binStart = start + index * step;

            return {
                start: binStart,
                end: binStart + step,
                count: 0
            };

        }
    );

    prices.forEach(price => {

        let index = Math.floor(
            (price - start) / step
        );

        index = Math.max(
            0,
            Math.min(index, bins.length - 1)
        );

        bins[index].count++;

    });

    return {
        min: start,
        max: start + bins.length * step,
        step,
        bins
    };

}


/**
 * Formate les bornes d'une classe.
 */
function formatBinLabel(bin) {

    const formatter = new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    });

    return `${formatter.format(bin.start)} – ${formatter.format(bin.end)}`;

}


/**
 * Plugin Chart.js : ligne verticale de référence.
 */
const referenceLinePlugin = {

    id: "distributionReferenceLine",

    afterDatasetsDraw(chart, args, options) {

        const reference = options?.value;

        if (
            reference === null ||
            reference === undefined ||
            !Number.isFinite(reference)
        ) {
            return;
        }

        const { ctx, chartArea } = chart;

        if (!chartArea) return;

        const { left, right, top, bottom } = chartArea;

        const min = options.min;
        const max = options.max;

        if (
            !Number.isFinite(min) ||
            !Number.isFinite(max) ||
            max <= min ||
            reference < min ||
            reference > max
        ) {
            return;
        }

        const x = left + (
            (reference - min) / (max - min)
        ) * (right - left);

        ctx.save();

        // Ligne verticale
        ctx.beginPath();

        ctx.setLineDash([5, 4]);

        ctx.strokeStyle = "#3985C8";
        ctx.lineWidth = 2;

        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);

        ctx.stroke();

        ctx.setLineDash([]);

        // Libellé
        const label = options.label;

        ctx.font = "600 10px sans-serif";

        const textWidth = ctx.measureText(label).width;

        const labelWidth = textWidth + 16;
        const labelHeight = 24;

        // Éviter que le libellé sorte du graphique
        const labelX = Math.max(
            left,
            Math.min(
                x - labelWidth / 2,
                right - labelWidth
            )
        );

        ctx.fillStyle = "#3985C8";

        ctx.beginPath();

        ctx.roundRect(
            labelX,
            top + 5,
            labelWidth,
            labelHeight,
            5
        );

        ctx.fill();

        ctx.fillStyle = "#FFFFFF";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            label,
            labelX + labelWidth / 2,
            top + 5 + labelHeight / 2
        );

        ctx.restore();

    }

};


/**
 * Génère la section 06 - Distribution des prix au m².
 */
export function renderDistributionSection(
    announcement,
    mktTransactions
) {

    const container = document.getElementById(
        "analysis-distribution-content"
    );

    if (!container) {
        console.warn(
            "Conteneur de la distribution des prix introuvable."
        );
        return;
    }

    // Destruction du graphique précédent
    if (distributionChart) {
        distributionChart.destroy();
        distributionChart = null;
    }

    const transactions = Array.isArray(mktTransactions)
        ? mktTransactions
        : [];


    // -----------------------------------------
    // 1. RÉCUPÉRATION DES PRIX
    // -----------------------------------------

    const prices = transactions
        .map(transaction => Number(transaction.priceM2))
        .filter(price =>
            Number.isFinite(price) && price > 0
        );


    if (prices.length === 0) {

        container.innerHTML = `
            <div class="distribution-empty">
                Aucune transaction avec un prix au m² exploitable
                n'est disponible pour construire l'histogramme.
            </div>
        `;

        return;
    }


    // -----------------------------------------
    // 2. PRIX DE RÉFÉRENCE
    // -----------------------------------------

    const referencePrice = getReferencePriceM2(
        announcement
    );


    // -----------------------------------------
    // 3. PRÉPARATION DE L'HISTOGRAMME
    // -----------------------------------------

    const distribution = prepareDistribution(
        prices,
        referencePrice
    );

    const bins = distribution.bins;

    const labels = bins.map(formatBinLabel);

    const values = bins.map(bin => bin.count);


    // -----------------------------------------
    // 4. STRUCTURE HTML
    // -----------------------------------------

    container.innerHTML = `

        <div class="distribution-container">

            <div class="distribution-heading">

                <div>
                    <div class="distribution-title">
                        Répartition des prix au m²
                    </div>

                    <div class="distribution-subtitle">
                        ${prices.length} transaction(s) avec surface exploitable
                    </div>
                </div>

            </div>

            <div class="distribution-chart-wrapper">

                <canvas
                    id="analysis-distribution-chart"
                    role="img"
                    aria-label="Histogramme de distribution des prix au mètre carré"
                ></canvas>

            </div>

            <div class="distribution-legend">

                <span class="distribution-legend-item">
                    <span class="distribution-legend-dot"></span>
                    Transactions réalisées
                </span>

                ${referencePrice !== null ? `
                    <span class="distribution-legend-item">
                        <span class="distribution-legend-line"></span>
                        Référence du bien analysé
                    </span>
                ` : ""}

            </div>

            <div class="distribution-footer">
                Les transactions sans surface exploitable
                sont exclues de cette distribution.
            </div>

        </div>

    `;


    // -----------------------------------------
    // 5. CRÉATION DU GRAPHIQUE
    // -----------------------------------------

    const canvas = container.querySelector(
        "#analysis-distribution-chart"
    );

    distributionChart = new Chart(
        canvas.getContext("2d"),
        {

            type: "bar",

            data: {

                labels,

                datasets: [{

                    label: "Transactions",

                    data: values,

                    backgroundColor: "rgba(57, 133, 200, 0.72)",

                    hoverBackgroundColor: "#3985C8",

                    borderRadius: 4,

                    borderSkipped: false,

                    categoryPercentage: 0.95,
                    barPercentage: 0.95

                }]

            },

            plugins: [
                referenceLinePlugin
            ],

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    },

                    distributionReferenceLine: {

                        value: referencePrice,

                        min: distribution.min,

                        max: distribution.max,

                        label: referencePrice !== null
                            ? formatDistributionPrice(referencePrice)
                            : ""

                    },

                    tooltip: {

                        backgroundColor: "#202936",

                        titleColor: "#FFFFFF",
                        bodyColor: "#FFFFFF",

                        padding: 12,

                        cornerRadius: 8,

                        callbacks: {

                            title(context) {

                                return context[0]?.label ?? "";

                            },

                            label(context) {

                                const count = context.parsed.y;

                                return ` ${count} transaction(s)`;

                            },

                            afterLabel(context) {

                                const percentage = (
                                    context.parsed.y / prices.length
                                ) * 100;

                                return `${percentage.toFixed(1).replace(".", ",")} % des transactions`;

                            }

                        }

                    }

                },

                scales: {

                    x: {

                        title: {
                            display: true,
                            text: "Prix au m²",
                            color: "#8993A2",
                            font: {
                                size: 11
                            }
                        },

                        grid: {
                            display: false
                        },

                        ticks: {
                            color: "#8993A2",
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                            font: {
                                size: 10
                            }
                        },

                        border: {
                            display: false
                        }

                    },

                    y: {

                        beginAtZero: true,

                        ticks: {

                            precision: 0,

                            stepSize: 1,

                            color: "#8993A2"

                        },

                        title: {
                            display: true,
                            text: "Nombre de transactions",
                            color: "#8993A2",
                            font: {
                                size: 11
                            }
                        },

                        grid: {
                            color: "rgba(138, 148, 163, 0.15)"
                        },

                        border: {
                            display: false
                        }

                    }

                }

            }

        }
    );

}
