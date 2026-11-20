
/**
 * SECTION 03 - ÉVOLUTION DES PRIX
 */

let evolutionChart = null;


/**
 * Formate un mois YYYY-MM en libellé français.
 */
function formatMonth(month) {

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return month ?? "";
    }

    const [year, monthNumber] = month.split("-").map(Number);

    const date = new Date(Date.UTC(year, monthNumber - 1, 1));

    return new Intl.DateTimeFormat("fr-FR", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC"
    }).format(date);
}


/**
 * Formate un prix au m² pour les infobulles.
 */
function formatPriceM2(value) {

    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "Non disponible";
    }

    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(value) + " €/m²";
}


/**
 * Génère la section 03 - Évolution des prix.
 */
export function renderEvolutionSection(monthlyEvolution) {

    const container = document.getElementById(
        "analysis-evolution-content"
    );

    if (!container) {
        console.warn(
            "Conteneur de la section Évolution des prix introuvable."
        );
        return;
    }

    // Destruction de l'ancien graphique
    if (evolutionChart) {
        evolutionChart.destroy();
        evolutionChart = null;
    }


    // -----------------------------------------
    // 1. VÉRIFICATION DES DONNÉES
    // -----------------------------------------

    if (!Array.isArray(monthlyEvolution) || monthlyEvolution.length === 0) {

        container.innerHTML = `
            <div class="evolution-empty">
                Aucune donnée historique disponible pour afficher
                l'évolution des prix.
            </div>
        `;

        return;
    }


    if (!window.Chart) {

        container.innerHTML = `
            <div class="evolution-empty">
                Impossible de charger le graphique.
                La bibliothèque Chart.js est indisponible.
            </div>
        `;

        console.error("Chart.js n'est pas disponible.");

        return;
    }


    // -----------------------------------------
    // 2. PRÉPARATION DES DONNÉES
    // -----------------------------------------

    const sortedData = [...monthlyEvolution]
        .filter(item => item.month)
        .sort((a, b) => a.month.localeCompare(b.month));

    if (sortedData.length === 0) {
        container.innerHTML = `
            <div class="evolution-empty">
                Aucune donnée historique exploitable.
            </div>
        `;
        return;
    }

    const labels = sortedData.map(item =>
        formatMonth(item.month)
    );

    const averages = sortedData.map(item =>
        item.average ?? null
    );

    const medians = sortedData.map(item =>
        item.median ?? null
    );


    // -----------------------------------------
    // 3. STRUCTURE HTML
    // -----------------------------------------

    container.innerHTML = `

        <div class="evolution-container">

            <div class="evolution-heading">

                <div>
                    <div class="evolution-title">
                        Évolution mensuelle des prix
                    </div>

                    <div class="evolution-subtitle">
                        Prix au m² des transactions réalisées
                    </div>
                </div>

                <div class="evolution-period">
                    ${sortedData.length} mois
                </div>

            </div>

            <div class="evolution-chart-wrapper">
                <canvas
                    id="analysis-evolution-chart"
                    role="img"
                    aria-label="Graphique de l'évolution mensuelle des prix moyens et médians au mètre carré"
                ></canvas>
            </div>

            <div class="evolution-legend">

                <div class="evolution-legend-item">
                    <span class="evolution-dot evolution-dot-average"></span>
                    Prix moyen
                </div>

                <div class="evolution-legend-item">
                    <span class="evolution-dot evolution-dot-median"></span>
                    Prix médian
                </div>

            </div>

            <div class="evolution-footer">
                Les prix sont calculés à partir des transactions
                disposant d'une surface exploitable.
            </div>

        </div>

    `;


    // -----------------------------------------
    // 4. CRÉATION DU GRAPHIQUE
    // -----------------------------------------

    const canvas = container.querySelector(
        "#analysis-evolution-chart"
    );

    const ctx = canvas.getContext("2d");

    evolutionChart = new Chart(ctx, {

        type: "line",

        data: {

            labels,

            datasets: [

                {
                    label: "Prix moyen",

                    data: averages,

                    borderColor: "#3985C8",
                    backgroundColor: "rgba(57, 133, 200, 0.10)",

                    borderWidth: 2.5,

                    pointRadius: 3,
                    pointHoverRadius: 6,

                    pointBackgroundColor: "#3985C8",

                    tension: 0.3,

                    fill: false,

                    spanGaps: false
                },

                {
                    label: "Prix médian",

                    data: medians,

                    borderColor: "#D69B42",
                    backgroundColor: "rgba(214, 155, 66, 0.10)",

                    borderWidth: 2,

                    pointRadius: 3,
                    pointHoverRadius: 6,

                    pointBackgroundColor: "#D69B42",

                    tension: 0.3,

                    fill: false,

                    spanGaps: false
                }

            ]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    backgroundColor: "#202936",

                    titleColor: "#FFFFFF",
                    bodyColor: "#FFFFFF",

                    padding: 12,

                    cornerRadius: 8,

                    callbacks: {

                        label(context) {

                            const value = context.parsed.y;

                            return ` ${context.dataset.label} : ${formatPriceM2(value)}`;

                        },

                        afterBody(context) {

                            const index = context[0]?.dataIndex;

                            if (index === undefined) return "";

                            const count = sortedData[index]?.count ?? 0;

                            return `\n ${count} transaction(s)`;

                        }

                    }

                }

            },

            scales: {

                x: {

                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#8A94A3",
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    },

                    border: {
                        display: false
                    }

                },

                y: {

                    beginAtZero: false,

                    grid: {
                        color: "rgba(138, 148, 163, 0.15)"
                    },

                    ticks: {

                        color: "#8A94A3",

                        callback(value) {
                            return new Intl.NumberFormat("fr-FR", {
                                notation: "compact",
                                maximumFractionDigits: 1
                            }).format(value) + " €";
                        }

                    },

                    border: {
                        display: false
                    }

                }

            }

        }

    });

}
