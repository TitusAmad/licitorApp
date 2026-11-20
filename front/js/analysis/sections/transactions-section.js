
/**
 * SECTION 04 - DERNIÈRES TRANSACTIONS
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
 * Formate une date.
 */
function formatTransactionDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC"
    }).format(date);

}


/**
 * Formate un montant en euros.
 */
function formatTransactionPrice(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "—";
    }

    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0
    }).format(value);

}


/**
 * Formate un prix au m².
 */
function formatTransactionPriceM2(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(Number(value))
    ) {
        return "—";
    }

    return `${new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(value)} €/m²`;

}


/**
 * Récupère le type du bien.
 */
function getTransactionType(transaction) {

    const type = transaction.type;

    if (Array.isArray(type)) {
        return type.join(", ") || "Bien immobilier";
    }

    return type || "Bien immobilier";

}


/**
 * Détermine le libellé du positionnement.
 */
function getPositionLabel(category) {

    const labels = {
        below: "Sous le marché",
        near: "Proche du marché",
        above: "Au-dessus du marché"
    };

    return labels[category] ?? null;

}


/**
 * Génère l'indicateur de positionnement.
 */
function renderPosition(transaction) {

    const label = getPositionLabel(
        transaction.ratioCategory
    );

    if (!label) return "";

    const ratio = transaction.saleRatio === null ||
                transaction.saleRatio === undefined
        ? NaN
        : Number(transaction.saleRatio);

    const ratioLabel = Number.isFinite(ratio)
        ? ` (${ratio > 0 ? "+" : ""}${ratio.toFixed(1).replace(".", ",")} %)`
        : "";

    return `
        <span class="transaction-position transaction-position-${transaction.ratioCategory}">
            ${label}${ratioLabel}
        </span>
    `;

}


/**
 * Génère une ligne du tableau.
 */
function renderTransactionRow(transaction) {

    const url = typeof transaction.url === "string"
        ? transaction.url
        : "";

    // Sécurité : seuls les liens HTTPS sont autorisés.
    let safeUrl = "";

    try {
        const parsedUrl = new URL(url);

        if (
            parsedUrl.protocol === "https:" &&
            parsedUrl.hostname === "www.licitor.com"
        ) {
            safeUrl = parsedUrl.href;
        }

    } catch {
        // URL invalide : ligne non cliquable.
    }


    const type = escapeHTML(
        getTransactionType(transaction)
    );

    const address = escapeHTML(
        [transaction.adresse, transaction.ville]
            .filter(Boolean)
            .join(", ")
    );

    const surface = transaction.surface;

    const surfaceLabel =
        surface !== null &&
        surface !== undefined &&
        Number.isFinite(Number(surface))
            ? `${new Intl.NumberFormat("fr-FR", {
                maximumFractionDigits: 2
            }).format(surface)} m²`
            : "—";

    const finalPrice = transaction.finalPrice ??
        transaction.prix_final;

    const priceM2 = transaction.priceM2;

    const estimatedPriceM2 = transaction.estimatedPriceM2;

    const position = renderPosition(transaction);

    return `
        <tr
            class="transaction-row ${safeUrl ? "transaction-row-clickable" : ""}"
            ${safeUrl ? `data-url="${escapeHTML(safeUrl)}" tabindex="0" role="link" aria-label="Consulter l'annonce ${escapeHTML(transaction.id)}"` : ""}
        >

            <td class="transaction-date">
                ${formatTransactionDate(
                    transaction.saleDate ?? transaction.dt_vente
                )}
            </td>

            <td class="transaction-property">

                <strong>${type}</strong>

                <span title="${address || "Adresse non renseignée"}">
                    ${address || "Adresse non renseignée"}
                </span>

            </td>

            <td class="transaction-surface">
                ${surfaceLabel}
            </td>

            <td class="transaction-final-price">

                <strong>
                    ${formatTransactionPrice(finalPrice)}
                </strong>

                ${position}

            </td>

            <td class="transaction-price-m2">
                ${formatTransactionPriceM2(priceM2)}
            </td>

            <td class="transaction-estimated-price">
                ${formatTransactionPriceM2(estimatedPriceM2)}
            </td>

        </tr>
    `;

}


/**
 * Génère la section 04 - Dernières transactions.
 */
export function renderTransactionsSection(transactions) {

    const container = document.getElementById(
        "analysis-transactions-content"
    );

    if (!container) {
        console.warn(
            "Conteneur de la section Dernières transactions introuvable."
        );
        return;
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {

        container.innerHTML = `
            <div class="transactions-empty">
                Aucune transaction récente disponible.
            </div>
        `;

        return;
    }


    // Génération du tableau
    container.innerHTML = `

        <div class="transactions-container">

            <div class="transactions-heading">

                <div>
                    <div class="transactions-title">
                        Dernières ventes réalisées
                    </div>

                    <div class="transactions-subtitle">
                        ${transactions.length} transaction(s) présentée(s)
                    </div>
                </div>

            </div>


            <div class="transactions-table-wrapper">

                <table class="transactions-table">

                    <thead>

                        <tr>
                            <th>Date</th>
                            <th>Bien</th>
                            <th>Surface</th>
                            <th>Prix final</th>
                            <th>Prix au m²</th>
                            <th>Référence marché</th>
                        </tr>

                    </thead>

                    <tbody>
                        ${transactions.map(renderTransactionRow).join("")}
                    </tbody>

                </table>

            </div>


            <div class="transactions-legend">
                La référence marché correspond au prix estimé au m²
                du bien, lorsqu'une estimation est disponible.
                Cliquez sur une ligne pour consulter l'annonce originale.
            </div>

        </div>

    `;


    // Gestion des clics et du clavier
    container.querySelectorAll(
        ".transaction-row-clickable"
    ).forEach(row => {

        const openAnnouncement = () => {

            const url = row.dataset.url;

            if (url) {
                window.open(
                    url,
                    "_blank",
                    "noopener,noreferrer"
                );
            }

        };

        row.addEventListener("click", openAnnouncement);

        row.addEventListener("keydown", event => {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {
                event.preventDefault();
                openAnnouncement();
            }

        });

    });

}
