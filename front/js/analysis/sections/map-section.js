
/**
 * SECTION 05 - CARTE DES TRANSACTIONS
 */

const MAX_MAP_TRANSACTIONS = 200;

let transactionMap = null;
let transactionMarkers = null;

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
 * Récupère les coordonnées d'un bien.
 */
function getCoordinates(item) {

    const latitude = Number(
        item?.coords?.latitude ?? item?.latitude
    );

    const longitude = Number(
        item?.coords?.longitude ?? item?.longitude
    );

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    return [latitude, longitude];

}


/**
 * Formate un montant.
 */
function formatMapPrice(value) {

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
function formatMapPriceM2(value) {

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
 * Formate une date.
 */
function formatMapDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "UTC"
    }).format(date);

}


/**
 * Détermine la couleur du marqueur.
 */
function getMarkerColor(category) {

    const colors = {
        below: "#258F69",
        near: "#D69B42",
        above: "#C45151",
        unavailable: "#8993A2"
    };

    return colors[category] ?? colors.unavailable;

}


/**
 * Crée une icône personnalisée.
 */
function createTransactionIcon(category) {

    const color = getMarkerColor(category);

    return L.divIcon({

        className: "analysis-map-marker-wrapper",

        html: `
            <div
                class="analysis-map-marker"
                style="background-color: ${color}"
            ></div>
        `,

        iconSize: [16, 16],
        iconAnchor: [8, 8]

    });

}


/**
 * Crée l'icône du bien analysé.
 */
function createPropertyIcon() {

    return L.divIcon({

        className: "analysis-map-marker-wrapper",

        html: `
            <div class="analysis-map-property-marker">
                <span></span>
            </div>
        `,

        iconSize: [24, 24],
        iconAnchor: [12, 12]

    });

}


/**
 * Génère le contenu du popup d'une transaction.
 */
function renderTransactionPopup(transaction) {

    const type = Array.isArray(transaction.type)
        ? transaction.type.join(", ")
        : transaction.type || "Bien immobilier";

    const address = [
        transaction.adresse,
        transaction.ville
    ].filter(Boolean).join(", ");

    const finalPrice =
        transaction.finalPrice ?? transaction.prix_final;

    const surface =
        transaction.surface ?? transaction.surface_m2;

    const priceM2 = transaction.priceM2;

    const estimatedPriceM2 =
        transaction.estimatedPriceM2;

    const position = {
        below: "Sous le marché",
        near: "Proche du marché",
        above: "Au-dessus du marché",
        unavailable: "Positionnement indisponible"
    }[transaction.compRatioCategory] ?? "Positionnement indisponible";

    return `

        <div class="analysis-map-popup">

            <a class="analysis-map-popup-type" href="${escapeHTML(transaction.url)}" target="_blank" rel="noopener noreferrer">
                ${escapeHTML(type)}
            </a>

            <div class="analysis-map-popup-address">
                ${escapeHTML(address || "Adresse non renseignée")}
            </div>

            <div class="analysis-map-popup-date">
                ${formatMapDate(
                    transaction.saleDate ?? transaction.dt_vente
                )}
            </div>

            <div class="analysis-map-popup-divider"></div>

            <div class="analysis-map-popup-row">
                <span>Surface</span>
                <strong>
                    ${surface != null && Number.isFinite(Number(surface))
                        ? `${escapeHTML(surface)} m²`
                        : "—"}
                </strong>
            </div>

            <div class="analysis-map-popup-row">
                <span>Prix final</span>
                <strong>${formatMapPrice(finalPrice)}</strong>
            </div>

            <div class="analysis-map-popup-row">
                <span>Prix au m²</span>
                <strong>${formatMapPriceM2(priceM2)}</strong>
            </div>

            <div class="analysis-map-popup-row">
                <span>Référence marché</span>
                <strong>${formatMapPriceM2(estimatedPriceM2)}</strong>
            </div>

            <div class="analysis-map-popup-position">
                ${escapeHTML(position)}
            </div>

        </div>

    `;

}


/**
 * Génère la popup du bien analysé.
 */
function renderPropertyPopup(announcement) {

    const type = Array.isArray(announcement.type)
        ? announcement.type.join(", ")
        : announcement.type || "Bien immobilier";

    const address = [
        announcement.adresse,
        announcement.ville
    ].filter(Boolean).join(", ");

    return `

        <div class="analysis-map-popup">

            <div class="analysis-map-popup-property">
                BIEN ANALYSÉ
            </div>

            <a class="analysis-map-popup-type" href="${escapeHTML(announcement.url)}" target="_blank" rel="noopener noreferrer">
                ${escapeHTML(type)}
            </a>

            <div class="analysis-map-popup-address">
                ${escapeHTML(address)}
            </div>

            <div class="analysis-map-popup-divider"></div>

            <div class="analysis-map-popup-row">
                <span>Surface</span>
                <strong>
                    ${announcement.surface_m2 != null
                        ? `${escapeHTML(announcement.surface_m2)} m²`
                        : "—"}
                </strong>
            </div>

            <div class="analysis-map-popup-row">
                <span>Mise à prix</span>
                <strong>
                    ${formatMapPrice(announcement.mise_a_prix)}
                </strong>
            </div>

            <div class="analysis-map-popup-row">
                <span>Prix final</span>
                <strong>
                    ${announcement.prix_final != null
                        ? formatMapPrice(announcement.prix_final)
                        : "—"}
                </strong>
            </div>

        </div>

    `;

}


/**
 * Détruit la carte existante.
 */
function destroyTransactionMap() {

    if (transactionMap) {
        transactionMap.remove();
        transactionMap = null;
        transactionMarkers = null;
    }

}


/**
 * Génère la section 05 - Carte des transactions.
 *
 * @param {Object} announcement - Bien initialement analysé
 * @param {Object} analysis - Analyse des transactions
 */
export function renderMapSection(announcement, radiusTransactions) {

    const container = document.getElementById(
        "analysis-map-content"
    );

    if (!container) {
        console.warn("Conteneur de la carte introuvable.");
        return;
    }

    destroyTransactionMap();

    const transactions = Array.isArray(radiusTransactions)
        ? radiusTransactions
        : [];

    const propertyCoordinates = getCoordinates(announcement);


    // Vérification de Leaflet
    if (!window.L) {

        container.innerHTML = `
            <div class="analysis-map-empty">
                Impossible de charger la carte.
                La bibliothèque Leaflet est indisponible.
            </div>
        `;

        console.error("Leaflet n'est pas disponible.");

        return;
    }


    if (!propertyCoordinates) {

        container.innerHTML = `
            <div class="analysis-map-empty">
                Les coordonnées du bien analysé sont indisponibles.
            </div>
        `;

        return;
    }


    // -----------------------------------------
    // 1. FILTRAGE ET TRI DES TRANSACTIONS
    // -----------------------------------------

    const validTransactions = transactions
        .map(transaction => ({
            ...transaction,
            mapCoordinates: getCoordinates(transaction)
        }))
        .filter(transaction => transaction.mapCoordinates !== null)
        .sort((a, b) => {

            const dateA = new Date(
                a.saleDate ?? a.dt_vente ?? 0
            ).getTime();

            const dateB = new Date(
                b.saleDate ?? b.dt_vente ?? 0
            ).getTime();

            return dateB - dateA;

        });


    // Limitation du nombre de marqueurs
    const displayedTransactions = validTransactions.slice(
        0,
        MAX_MAP_TRANSACTIONS
    );


    // -----------------------------------------
    // 2. STRUCTURE HTML
    // -----------------------------------------

    container.innerHTML = `

        <div class="analysis-map-container">

            <div class="analysis-map-heading">

                <div>
                    <div class="analysis-map-title">
                        Transactions à proximité
                    </div>

                    <div class="analysis-map-subtitle">
                        ${displayedTransactions.length} transaction(s) affichée(s)
                        ${displayedTransactions.length < validTransactions.length
                            ? `sur ${validTransactions.length}`
                            : ""}
                    </div>
                </div>

            </div>

            <div
                id="analysis-leaflet-map"
                class="analysis-leaflet-map"
                role="application"
                aria-label="Carte interactive des transactions immobilières"
            ></div>

            <div class="analysis-map-legend">

                <div class="analysis-map-legend-item">
                    <span class="analysis-map-legend-dot property"></span>
                    Bien analysé
                </div>

                <div class="analysis-map-legend-item">
                    <span class="analysis-map-legend-dot below"></span>
                    Sous le marché
                </div>

                <div class="analysis-map-legend-item">
                    <span class="analysis-map-legend-dot near"></span>
                    Proche du marché
                </div>

                <div class="analysis-map-legend-item">
                    <span class="analysis-map-legend-dot above"></span>
                    Au-dessus du marché
                </div>

                <div class="analysis-map-legend-item">
                    <span class="analysis-map-legend-dot unavailable"></span>
                    Indisponible
                </div>

            </div>

        </div>

    `;


    // -----------------------------------------
    // 3. INITIALISATION LEAFLET
    // -----------------------------------------

    transactionMap = L.map(
        "analysis-leaflet-map",
        {
            scrollWheelZoom: false
        }
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
            maxZoom: 19
        }
    ).addTo(transactionMap);


    transactionMarkers = L.featureGroup().addTo(
        transactionMap
    );


    // -----------------------------------------
    // 4. MARQUEUR DU BIEN ANALYSÉ
    // -----------------------------------------

    L.marker(propertyCoordinates, {
        icon: createPropertyIcon(),
        zIndexOffset: 1000
    })
        .bindPopup(renderPropertyPopup(announcement))
        .addTo(transactionMarkers);


    // -----------------------------------------
    // 5. MARQUEURS DES TRANSACTIONS
    // -----------------------------------------

    displayedTransactions.forEach(transaction => {

        const marker = L.marker(
            transaction.mapCoordinates,
            {
                icon: createTransactionIcon(
                    transaction.compRatioCategory
                )
            }
        );

        marker.bindPopup(
            renderTransactionPopup(transaction)
        );

        marker.addTo(transactionMarkers);

    });


    // -----------------------------------------
    // 6. CADRAGE AUTOMATIQUE
    // -----------------------------------------

    transactionMap.fitBounds(
        transactionMarkers.getBounds(),
        {
            padding: [35, 35],
            maxZoom: 15
        }
    );

}


/**
 * À appeler lorsque la fiche devient visible.
 * Leaflet doit recalculer les dimensions de son conteneur.
 */

export function refreshAnalysisMapSize() {

    if (!transactionMap) return;

    transactionMap.invalidateSize({
        animate: false,
        pan: false
    });

    if (transactionMarkers && transactionMarkers.getLayers().length) {

        transactionMap.fitBounds(
            transactionMarkers.getBounds(),
            {
                padding: [35, 35],
                maxZoom: 15,
                animate: false
            }
        );

    }

}
