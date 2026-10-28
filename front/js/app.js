// --------------------------------------------------
// Variables globales
// --------------------------------------------------

let announcements = [];
const announcementElements = new Map();

let map;
let markerClusterGroup;
const activeMarkerIds = new Set();
let markers = new Map();

let sortField = "dt_vente";
let searchTerm = "";

const appliedFilters = {
    surfaceMin: null,
    surfaceMax: null,
    prixMin: null,
    prixMax: null,
    estimationMin: null,
    estimationMax: null,
    tribunaux: [],
    dateField: "dt_vente",
    dateStart: null,
    dateEnd: null
};


// --------------------------------------------------
// Initialisation
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {

    initializeMap();
    initializeSorting();
    initializeSearch();

    initializeFilterDropdowns();

    initializeListScrollToTop();

    document.getElementById("apply-filters")
        .addEventListener("click", applyFilters);

    document.getElementById("reset-filters")
        .addEventListener("click", resetFilters);

    updateFilterButtonStates();

    await loadAnnouncements();
});


// --------------------------------------------------
// Carte
// --------------------------------------------------

function initializeMap() {

    map = L.map("map");

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: '&copy; OpenStreetMap contributors'
        }
    ).addTo(map);

    // Groupe intelligent de marqueurs
    markerClusterGroup = L.markerClusterGroup({

        // Rayon de regroupement en pixels
        maxClusterRadius: 55,

        // Ne pas afficher les zones de couverture au survol
        showCoverageOnHover: false,

        // Zoomer sur les biens au clic sur un groupe
        zoomToBoundsOnClick: true,

        // Séparer les marqueurs superposés au zoom maximal
        spiderfyOnMaxZoom: true,

        // Afficher les marqueurs individuels à partir de ce zoom
        disableClusteringAtZoom: 16,

        // Charger les marqueurs progressivement si nécessaire
        chunkedLoading: true,

        // Retirer les marqueurs éloignés de la zone visible
        removeOutsideVisibleBounds: true,

        // Apparence personnalisée des groupes
        iconCreateFunction: function (cluster) {

            const count = cluster.getChildCount();

            let sizeClass = "cluster-medium";

            if (count < 10) {
                sizeClass = "cluster-small";
            } else if (count >= 100) {
                sizeClass = "cluster-large";
            }

            return L.divIcon({

                html: `
                    <div class="cluster-circle ${sizeClass}">
                        <span>${count}</span>
                    </div>
                `,

                className: "custom-marker-cluster",

                iconSize: [46, 46],
                iconAnchor: [23, 23]
            });
        }
    });

    map.addLayer(markerClusterGroup);

    // Vue initiale approximative sur le sud de la France
    map.setView([43.5, 5.5], 9);
}


// --------------------------------------------------
// Chargement des données
// --------------------------------------------------

async function loadAnnouncements() {

    try {

        const response = await fetch("./data/auctions.json");

        if (!response.ok) {
            throw new Error(
                `Erreur HTTP : ${response.status}`
            );
        }

        const data = await response.json();

        // Convertir le dictionnaire en tableau d'annonces
        announcements = Object.values(data);

        console.log(
            `${announcements.length} annonces chargées`
        );

        updateTribunalFilters();
        updateDisplay();

    } catch (error) {

        console.error(
            "Impossible de charger les annonces :",
            error
        );

        document.getElementById(
            "announcement-list"
        ).innerHTML = `
            <div class="announcement">
                Impossible de charger les données.
            </div>
        `;
    }
}

// --------------------------------------------------
// Recherche
// --------------------------------------------------

function initializeSearch() {

    const searchInput = document.getElementById(
        "announcement-search"
    );

    const clearButton = document.getElementById(
        "clear-search"
    );

    searchInput.addEventListener("input", () => {

        searchTerm = searchInput.value
            .trim()
            .toLowerCase();

        updateClearButton();
        updateTribunalFilters();
        updateDisplay();
    });


    clearButton.addEventListener("click", () => {

        searchInput.value = "";

        searchTerm = "";

        updateClearButton();
        updateTribunalFilters();
        updateDisplay();

        searchInput.focus();
    });

    updateClearButton();
}

function updateClearButton() {

    const searchInput = document.getElementById(
        "announcement-search"
    );

    const clearButton = document.getElementById(
        "clear-search"
    );

    clearButton.style.display =
        searchInput.value
            ? "block"
            : "none";
}

// --------------------------------------------------
// Gestion Filtres
// --------------------------------------------------


function initializeFilterDropdowns() {

    const button = document.getElementById("filters-toggle");
    const panel = document.getElementById("filters-panel");

    function closePanel() {
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
    }

    button.addEventListener("click", () => {

        const isOpen = !panel.hidden;

        panel.hidden = isOpen;
        button.setAttribute(
            "aria-expanded",
            String(!isOpen)
        );
    });

    document.addEventListener("click", event => {

        if (
            event.target.closest(".filters-dropdown")
        ) {
            return;
        }

        closePanel();
    });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {
            closePanel();
            button.focus();
        }
    });
}


function updateFilterButtonStates() {

    let activeCount = 0;

    // Chaque catégorie compte comme un filtre actif
    if (
        appliedFilters.surfaceMin !== null ||
        appliedFilters.surfaceMax !== null
    ) activeCount++;

    if (
        appliedFilters.prixMin !== null ||
        appliedFilters.prixMax !== null
    ) activeCount++;

    if (
        appliedFilters.estimationMin !== null ||
        appliedFilters.estimationMax !== null
    ) activeCount++;

    if (
        appliedFilters.dateStart ||
        appliedFilters.dateEnd
    ) activeCount++;

    if (appliedFilters.tribunaux.length > 0) {
        activeCount++;
    }

    const button = document.getElementById("filters-toggle");
    const counter = document.getElementById("active-filter-count");

    counter.textContent = activeCount;
    counter.hidden = activeCount === 0;

    button.classList.toggle("has-active-filters", activeCount > 0);
}

function applyFilters() {

    appliedFilters.surfaceMin = getNumericInput("surface-min");
    appliedFilters.surfaceMax = getNumericInput("surface-max");

    appliedFilters.prixMin = getNumericInput("prix-min");
    appliedFilters.prixMax = getNumericInput("prix-max");

    appliedFilters.estimationMin = getNumericInput("estimation-min");
    appliedFilters.estimationMax = getNumericInput("estimation-max");

    // Période de dates
    appliedFilters.dateField =
        document.getElementById("date-filter-field").value;

    appliedFilters.dateStart =
        document.getElementById("date-start").value || null;

    appliedFilters.dateEnd =
        document.getElementById("date-end").value || null;

    // Vérifier la cohérence de la période
    if (
        appliedFilters.dateStart &&
        appliedFilters.dateEnd &&
        appliedFilters.dateStart > appliedFilters.dateEnd
    ) {
        alert("La date de début doit précéder la date de fin.");
        return;
    }

    // Tribunaux sélectionnés
    appliedFilters.tribunaux = [
        ...document.querySelectorAll(
            "#tribunal-filters input[type='checkbox']:checked"
        )
    ].map(checkbox => checkbox.value);

    updateFilterButtonStates();
    updateDisplay();

    // Fermer le panneau après application
    document.getElementById("filters-panel").hidden = true;
    document.getElementById("filters-toggle")
        .setAttribute("aria-expanded", "false");
}


function resetFilters() {

    [
        "surface-min",
        "surface-max",
        "prix-min",
        "prix-max",
        "estimation-min",
        "estimation-max",
        "date-start",
        "date-end"
    ].forEach(id => {
        document.getElementById(id).value = "";
    });

    document.getElementById("date-filter-field").value = "dt_vente";

    document.querySelectorAll(
        "#tribunal-filters input[type='checkbox']"
    ).forEach(checkbox => {
        checkbox.checked = false;
    });

    document.getElementById("tribunal-select-all").checked = false;
    document.getElementById("tribunal-select-all").indeterminate = false;

    Object.assign(appliedFilters, {
        surfaceMin: null,
        surfaceMax: null,
        prixMin: null,
        prixMax: null,
        estimationMin: null,
        estimationMax: null,
        tribunaux: [],
        dateField: "dt_vente",
        dateStart: null,
        dateEnd: null
    });

    updateFilterButtonStates();
    updateDisplay();
}


function updateTribunalFilters() {

    const container = document.getElementById("tribunal-filters");
    const selectAll = document.getElementById("tribunal-select-all");

    const searchFilteredAnnouncements = announcements.filter(announcement => {

        if (!searchTerm) {
            return true;
        }

        const valeursRecherche = [
            announcement.ville || "",
            announcement.nom_departement || "",
            announcement.nom_region || ""
        ];

        return valeursRecherche.some(value =>
            normalizeSearchValue(value).includes(
                normalizeSearchValue(searchTerm)
            )
        );
    });

    const tribunaux = [
        ...new Set(
            searchFilteredAnnouncements
                .map(a => a.tribunal)
                .filter(value => value != null && String(value).trim() !== "")
                .map(value => String(value).trim())
        )
    ].sort((a, b) => a.localeCompare(b, "fr"));

    container.innerHTML = "";
    selectAll.checked = false;
    selectAll.indeterminate = false;

    tribunaux.forEach((tribunal, index) => {

        const label = document.createElement("label");
        label.className = "tribunal-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = tribunal;
        checkbox.id = `tribunal-${index}`;

        checkbox.addEventListener("change", updateSelectAllState);

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(tribunal));

        container.appendChild(label);
    });

    selectAll.onchange = () => {
        container.querySelectorAll('input[type="checkbox"]')
            .forEach(checkbox => {
                checkbox.checked = selectAll.checked;
            });

        updateSelectAllState();
    };
}

function updateSelectAllState() {

    const selectAll = document.getElementById("tribunal-select-all");

    const checkboxes = [
        ...document.querySelectorAll(
            "#tribunal-filters input[type='checkbox']"
        )
    ];

    const checkedCount = checkboxes.filter(cb => cb.checked).length;

    selectAll.checked =
        checkboxes.length > 0 && checkedCount === checkboxes.length;

    selectAll.indeterminate =
        checkedCount > 0 && checkedCount < checkboxes.length;
}

// --------------------------------------------------
// Filtre
// --------------------------------------------------

function getFilteredAnnouncements() {

    return announcements.filter(announcement => {

        // Recherche textuelle instantanée
        if (searchTerm) {

            const valeursRecherche = [
                announcement.ville || "",
                announcement.nom_departement || "",
                announcement.nom_region || ""
            ];

            const correspond = valeursRecherche.some(value =>
                normalizeSearchValue(value).includes(
                    normalizeSearchValue(searchTerm)
                )
            );

            if (!correspond) return false;
        }

        // Surface
        const surface = toNumber(announcement.surface_m2);

        if (
            (appliedFilters.surfaceMin !== null ||
             appliedFilters.surfaceMax !== null) &&
            surface === null
        ) return false;

        if (appliedFilters.surfaceMin !== null &&
            surface < appliedFilters.surfaceMin) return false;

        if (appliedFilters.surfaceMax !== null &&
            surface > appliedFilters.surfaceMax) return false;

        // Mise à prix
        const prix = toNumber(announcement.mise_a_prix);

        if (
            (appliedFilters.prixMin !== null ||
             appliedFilters.prixMax !== null) &&
            prix === null
        ) return false;

        if (appliedFilters.prixMin !== null &&
            prix < appliedFilters.prixMin) return false;

        if (appliedFilters.prixMax !== null &&
            prix > appliedFilters.prixMax) return false;

        // Prix estimé
        const estimation = toNumber(announcement.stats_bien?.avg);

        if (
            (appliedFilters.estimationMin !== null ||
             appliedFilters.estimationMax !== null) &&
            estimation === null
        ) return false;

        if (appliedFilters.estimationMin !== null &&
            estimation < appliedFilters.estimationMin) return false;

        if (appliedFilters.estimationMax !== null &&
            estimation > appliedFilters.estimationMax) return false;

        // Tribunaux : correspondance avec au moins un tribunal sélectionné
        if (
            appliedFilters.tribunaux.length > 0 &&
            !appliedFilters.tribunaux.includes(
                String(announcement.tribunal ?? "").trim()
            )
        ) return false;

        // Période de vente ou de visite
        if (appliedFilters.dateStart || appliedFilters.dateEnd) {

            const dateValue = parseSaleDate(
                announcement[appliedFilters.dateField]
            );

            // Une annonce sans date ne correspond pas à la période
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

            if (startDate !== null && dateValue < startDate) {
                return false;
            }

            if (endDate !== null && dateValue > endDate) {
                return false;
            }
        }

        return true;
    });
}



/* --------------------------------------------------
   Tri des annonces
-------------------------------------------------- */

function initializeSorting() {
    const sortButton = document.getElementById(
        "sort-menu-button"
    );

    const sortMenu = document.getElementById("sort-menu");

    const currentLabel = document.getElementById(
        "sort-current-label"
    );

    const sortOptions = document.querySelectorAll(
        ".sort-option"
    );

    // Ouvrir ou fermer le menu
    sortButton.addEventListener("click", () => {
        const isOpen =
            sortButton.getAttribute("aria-expanded") === "true";

        sortMenu.hidden = isOpen;
        sortButton.setAttribute(
            "aria-expanded",
            String(!isOpen)
        );
    });

    // Choisir un critère de tri
    sortOptions.forEach(option => {
        option.addEventListener("click", () => {
            sortField = option.dataset.sort;

            updateSortButton();

            sortMenu.hidden = true;
            sortButton.setAttribute("aria-expanded", "false");

            updateListOnly();
        });
    });

    // Fermer le menu en cliquant à l'extérieur
    document.addEventListener("click", event => {
        if (!event.target.closest(".sort-dropdown")) {
            sortMenu.hidden = true;
            sortButton.setAttribute("aria-expanded", "false");
        }
    });

    // Fermer avec Échap
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            sortMenu.hidden = true;
            sortButton.setAttribute("aria-expanded", "false");
            sortButton.focus();
        }
    });

    updateSortButton();
}

function updateSortButton() {
    const currentLabel = document.getElementById(
        "sort-current-label"
    );

    const sortOptions = document.querySelectorAll(
        ".sort-option"
    );

    const labels = {
        dt_vente: "Vente",
        visite_dt: "Visite",
        mise_a_prix: "Mise à prix",
        surface_m2: "Surface",
        prix_estime: "Prix estimé"
    };

    currentLabel.textContent = labels[sortField] || "Vente";

    sortOptions.forEach(option => {
        const isActive = option.dataset.sort === sortField;

        option.classList.toggle("active", isActive);

        if (isActive) {
            option.setAttribute("aria-current", "true");
        } else {
            option.removeAttribute("aria-current");
        }
    });
}


// --------------------------------------------------
// GESTION AFFICHAGE
// --------------------------------------------------

function updateDisplay() {

    const filteredAnnouncements =
        getFilteredAnnouncements();

    displayAnnouncements(filteredAnnouncements);
    displayMarkers(filteredAnnouncements);
}

function updateListOnly() {

    const filteredAnnouncements =
        getFilteredAnnouncements();

    displayAnnouncements(filteredAnnouncements);
}


// --------------------------------------------------
// Liste
// --------------------------------------------------

function displayAnnouncements(filteredAnnouncements) {

    const container = document.getElementById(
        "announcement-list"
    );

    const count = document.getElementById(
        "announcement-count"
    );

    container.innerHTML = "";

    count.textContent =
        filteredAnnouncements.length;

    // Copie du tableau pour ne pas modifier
    // l'ordre original des annonces
    const sortedAnnouncements = [...filteredAnnouncements];

    if (sortedAnnouncements.length === 0) {

        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-title">
                    Aucun résultat
                </div>

                <div class="no-results-text">
                    Aucune annonce ne correspond à votre recherche.
                </div>
            </div>
        `;

        return;
    }


    sortedAnnouncements.sort((a, b) => {

        // Critères numériques
        if (sortField === "mise_a_prix") {
            return compareNumbers(
                a.mise_a_prix,
                b.mise_a_prix
            );
        }

        if (sortField === "surface_m2") {
            return compareNumbers(
                a.surface_m2,
                b.surface_m2
            );
        }

        if (sortField === "prix_estime") {
            const prixA = getEstimatedTotalPrice(a);
            const prixB = getEstimatedTotalPrice(b);

            return compareNumbers(prixA, prixB);
        }

        // Critères de date : du plus proche dans le temps
        // au plus éloigné dans le futur
        const dateA = parseSaleDate(a[sortField]);
        const dateB = parseSaleDate(b[sortField]);

        // Dates absentes en dernier
        if (dateA === null && dateB !== null) return 1;
        if (dateA !== null && dateB === null) return -1;

        if (dateA === null && dateB === null) return 0;

        return dateA - dateB;
    });

    sortedAnnouncements.forEach(announcement => {

        let element = announcementElements.get(announcement.id);

        if (!element) {

            element = createAnnouncementElement(announcement);

            announcementElements.set(announcement.id, element);
        }

        // appendChild déplace la carte existante
        // à la bonne position sans la recréer.
        container.appendChild(element);
    });
}


function createAnnouncementElement(announcement) {

    const element = document.createElement("article");

    element.className = "announcement";
    element.dataset.id = announcement.id;

    const price = formatPrice(
        announcement.mise_a_prix
    );

    // Les propriétés sont directement dans l'annonce,
    // et non dans announcement.lots[0].
    const surface = announcement.surface_m2 != null
        ? Math.round(announcement.surface_m2)
        : null;

    const avg = announcement.stats_bien?.avg;

    const estPricePerSquareMeter = avg != null
        ? formatPrice(avg)
        : null;

    const estPrice = formatPrice(getEstimatedTotalPrice(announcement));

    const dateVente = formatDate(
        announcement.dt_vente
    );

    const dateVisite = formatDate(
        announcement.visite_dt
    );

    // Le champ "type" est un tableau dans le JSON.
    const typeBien = Array.isArray(announcement.type)
        ? announcement.type.join(", ")
        : announcement.type || "Annonce";

    const adresseBien = announcement.adresse || "";

    element.innerHTML = `


        <div class="property-description">

            <div class="property-heading">
                <h3 class="property-city">
                    ${escapeHtml(announcement.ville || "Ville non renseignée")}
                </h3>

                <span class="property-type">
                    ${escapeHtml(
                        Array.isArray(announcement.type)
                            ? announcement.type.join(", ")
                            : announcement.type || "Type non renseigné"
                    )}
                </span>
            </div>

            ${adresseBien ? `
                <div class="property-address">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/>
                        <circle cx="12" cy="10" r="2.5"/>
                    </svg>

                    <span>${escapeHtml(adresseBien)}</span>
                </div>
            ` : ""}

        </div>

        <div class="property-metrics">
            <div class="property-metrics-grid">
                <div class="metric-card">
                    <span class="metric-label">Mise à prix</span>
                    <span class="metric-value metric-price">
                        ${price}
                    </span>
                </div>

                <div class="metric-card">
                    <span class="metric-label">Surface</span>
                    <span class="metric-value">
                        ${surface != null ? surface + " m²" : "N/A"}
                    </span>
                </div>
            </div>

            <div class="metric-estimation">
                <div class="metric-estimation-header">
                    <span class="metric-label">
                        Prix de vente estimé
                    </span>

                    <span class="metric-value">
                        ${estPrice || "N/A"}
                    </span>
                </div>

                ${estPricePerSquareMeter ? `
                    <span class="metric-detail">
                        Soit ${estPricePerSquareMeter}/m²
                    </span>
                ` : ""}
            </div>

        </div>


        <div class="date-info">

            ${dateVisite ? `
                <div class="date-row date-visite">
                    <svg xmlns="http://www.w3.org/2000/svg"
                        width="16" height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true">
                        <rect x="3" y="5" width="18" height="16" rx="2"/>
                        <path d="M16 3v4M8 3v4M3 11h18"/>
                        <path d="m9 16 2 2 4-4"/>
                    </svg>

                    <span class="date-label">Visite</span>
                    <span class="date-value">${dateVisite}</span>
                </div>
            ` : ""}

            ${dateVente ? `
                <div class="date-row date-vente">
                    <svg xmlns="http://www.w3.org/2000/svg"
                        width="16" height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>

                    <span class="date-label">Vente</span>
                    <span class="date-value">${dateVente}</span>
                </div>
            ` : ""}

        </div>

        <div class="links-info">

            <button type="button" class="licitor-folder-btn">
                <svg xmlns="http://www.w3.org/2000/svg"
                    width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
                </svg>
                <span>Dossier du bien</span>
            </button>

            <button type="button" class="street-view-btn">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/>
                    <circle cx="12" cy="10" r="2.5"/>
                </svg>
                <span>Visualiser</span>
            </button>

        </div>
    `;

    element.addEventListener("click", () => {
        selectAnnouncement(announcement.id);
    });

    const licitorFolderBtn = element.querySelector(".licitor-folder-btn");

    licitorFolderBtn.addEventListener("click", (event) => {
        event.stopPropagation();

        if (!announcement.url) {
            return;
        }

        window.open(
            announcement.url,
            "_blank",
            "noopener,noreferrer"
        );
    });

    // Bouton Street View de cette annonce
    const streetViewBtn = element.querySelector(".street-view-btn");

    streetViewBtn.addEventListener("click", (event) => {
        // Empêche le clic de déclencher aussi
        // la sélection de l'annonce parente
        event.stopPropagation();

        const latitude = Number(announcement.coords?.latitude);
        const longitude = Number(announcement.coords?.longitude);

        // Vérifier que les coordonnées sont valides
        if (
            announcement.coords?.latitude == null ||
            announcement.coords?.longitude == null ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180
        ) {
            console.warn("Coordonnées invalides pour cette annonce", announcement);
            alert("Les coordonnées géographiques de cette annonce ne sont pas disponibles.");
            return;
        }

        const url =
            `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

        window.open(url, "_blank", "noopener,noreferrer");
    });

    return element;
}

// --------------------------------------------------
// Marqueurs
// --------------------------------------------------

function displayMarkers(filteredAnnouncements) {

    const visibleIds = new Set();
    const coordinates = [];
    const markersToAdd = [];

    filteredAnnouncements.forEach(announcement => {

        const rawLatitude = announcement.coords?.latitude;
        const rawLongitude = announcement.coords?.longitude;

        const latitude = Number(rawLatitude);
        const longitude = Number(rawLongitude);

        if (
            rawLatitude == null ||
            rawLongitude == null ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180
        ) {
            return;
        }

        const id = announcement.id;

        visibleIds.add(id);

        let marker = markers.get(id);

        // Création uniquement si ce marqueur n'existe pas encore.
        if (!marker) {

            marker = L.marker([
                latitude,
                longitude
            ]);

            marker.bindPopup(`
                <strong>
                    ${escapeHtml(announcement.ville || "Ville non renseignée")}
                </strong>
                <br>
                ${formatPrice(announcement.mise_a_prix)}
                <br><br>
                <a
                    href="${escapeHtml(announcement.url || "#")}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Voir l'annonce
                </a>
            `);

            marker.on("click", () => {
                selectAnnouncement(id, false);
            });

            markers.set(id, marker);
        }

        // Ajouter uniquement les marqueurs absents du groupe.
        if (!activeMarkerIds.has(id)) {
            markersToAdd.push(marker);
            activeMarkerIds.add(id);
        }

        coordinates.push([latitude, longitude]);
    });

    // Retirer les marqueurs qui ne correspondent plus aux filtres.
    const markersToRemove = [];

    activeMarkerIds.forEach(id => {

        if (!visibleIds.has(id)) {

            const marker = markers.get(id);

            if (marker) {
                markersToRemove.push(marker);
            }

            activeMarkerIds.delete(id);
        }
    });

    if (markersToRemove.length > 0) {
        markerClusterGroup.removeLayers(markersToRemove);
    }

    if (markersToAdd.length > 0) {
        markerClusterGroup.addLayers(markersToAdd);
    }

    // Gestion du message "Aucun résultat"
    const noResultsElement = document.getElementById(
        "map-no-results"
    );

    noResultsElement.style.display =
        coordinates.length === 0 ? "block" : "none";

    // Adapter la vue aux annonces filtrées.
    if (coordinates.length > 0) {

        if (coordinates.length === 1) {

            map.setView(coordinates[0], 12);

        } else {

            map.fitBounds(
                L.latLngBounds(coordinates),
                { padding: [40, 40] }
            );
        }

        map.invalidateSize();
    }
}

// --------------------------------------------------
// Sélection d'une annonce
// --------------------------------------------------

function selectAnnouncement(
    id,
    openMarker = true
) {

    // Retirer l'état actif
    document
        .querySelectorAll(".announcement")
        .forEach(element => {

            element.classList.remove("active");

        });


    // Sélectionner la carte correspondante

    const element = document.querySelector(
        `.announcement[data-id="${id}"]`
    );

    if (element) {

        element.classList.add("active");

        element.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }

    // Sélectionner le marqueur

    const marker = markers.get(id);

    if (marker && openMarker) {

        map.setView(
            marker.getLatLng(),
            Math.max(map.getZoom(), 12)
        );

        marker.openPopup();
    }
}

// --------------------------------------------------
// Gestion Scroll to Top
// --------------------------------------------------

function initializeListScrollToTop() {

    const counter = document.getElementById(
        "back-to-announcements"
    );

    const listContainer = document.querySelector(
        ".list-container"
    );

    if (!counter || !listContainer) return;

    function scrollToTop() {

        // Sur mobile, c'est généralement la page entière
        // qui défile.
        if (window.matchMedia("(max-width: 800px)").matches) {

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            return;
        }

        // Sur ordinateur, la liste défile dans son conteneur.
        listContainer.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    counter.addEventListener("click", scrollToTop);

    counter.addEventListener("keydown", event => {

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            scrollToTop();
        }
    });
}

// --------------------------------------------------
// Utilitaires
// --------------------------------------------------

function formatPrice(price) {

    if (price == null) {
        return "Prix non renseigné";
    }

    return new Intl.NumberFormat(
        "fr-FR",
        {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0
        }
    ).format(price);
}


function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    const date = new Date(
        dateString.replace(" ", "T")
    );

    if (isNaN(date)) {
        return dateString;
    }

    return new Intl.DateTimeFormat(
        "fr-FR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);
}


// Évite d'injecter directement du contenu du JSON
// dans le HTML sans échappement.

function escapeHtml(value) {

    if (value == null) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function parseSaleDate(dateString) {

    if (!dateString) {
        return null;
    }

    const date = new Date(
        dateString.replace(" ", "T")
    );

    if (isNaN(date.getTime())) {
        return null;
    }

    return date.getTime();
}

function normalizeSearchValue(value) {

    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function getNumericInput(id) {

    const value = document.getElementById(id).value.trim();

    if (value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
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


function compareNumbers(a, b) {
    const numberA = toNumber(a);
    const numberB = toNumber(b);

    // Valeurs absentes en dernier
    if (numberA === null && numberB !== null) return 1;
    if (numberA !== null && numberB === null) return -1;

    if (numberA === null && numberB === null) return 0;

    // Ordre croissant
    return numberA - numberB;
}

function getEstimatedTotalPrice(announcement) {
    const avg = toNumber(announcement.stats_bien?.avg);
    const surface = toNumber(announcement.surface_m2);

    // Impossible de calculer sans les deux valeurs
    if (avg === null || surface === null || surface <= 0) {
        return null;
    }

    // avg correspond au prix estimé au m²
    return avg * surface;
}
