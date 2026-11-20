import {
    loadAnnouncements as fetchAnnouncements,
    loadNearbySales
} from "./data-loader.js";

import {
    prepareNearbySalesAnalysis
} from "./sales-analysis.js";

import {
    initializeAnalysisSheet,
    openAnalysisSheet
} from "./analysis-sheet.js";

import { formatDate } from "./date-utils.js";

import { showToast } from './toast.js';

// --------------------------------------------------
// Variables globales
// --------------------------------------------------

let announcements = [];
let searchTerm = "";

const announcementElements = new Map();

let map;
let markerClusterGroup;
const activeMarkerIds = new Set();
let markers = new Map();

// --------------------------------------------------
// ANALYSE GÉOGRAPHIQUE
// --------------------------------------------------

let selectedAnalysisAnnouncement = null;

// RADIUS

const ANALYSIS_RADIUS_KEY = "analysis_radius";
const DEFAULT_ANALYSIS_RADIUS = 5;

let analysisRadius = Number(
    sessionStorage.getItem(ANALYSIS_RADIUS_KEY)
) || DEFAULT_ANALYSIS_RADIUS;

// SURFACE

// SURFACE MIN

const ANALYSIS_SURFACE_KEY = "analysis_surface_min";
const DEFAULT_ANALYSIS_SURFACE = -1;

let analysisSurface = sessionStorage.getItem(ANALYSIS_SURFACE_KEY) || DEFAULT_ANALYSIS_SURFACE;

// --------------------------------------------------
// CONFIGURATION DE LA PAGE
// --------------------------------------------------

const PAGE_TYPE = document.body.dataset.page || "visits";

const PAGE_CONFIG = {

    visits: {
        defaultSort: "visite_dt",
        sortDirection: "asc",

        totalPriceField: "estimated",
        priceM2Field: "estimated"
    },

    sales: {
        defaultSort: "dt_vente",
        sortDirection: "desc",

        totalPriceField: "final",
        priceM2Field: "final"
    }

};

let sortField = PAGE_CONFIG[PAGE_TYPE]?.defaultSort || "dt_vente";

let sortDirection =
    PAGE_CONFIG[PAGE_TYPE]?.sortDirection || "asc";

const appliedFilters = {
    surfaceMin: null,
    surfaceMax: null,

    prixMin: null,
    prixMax: null,

    prixTotalMin: null,
    prixTotalMax: null,

    prixM2Min: null,
    prixM2Max: null,

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

    initializeAnalysisSheet();
    
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

// --------------------------------------------------
// VISITES A VENIR
// --------------------------------------------------

async function loadAnnouncements() {

    try {

        announcements = await fetchAnnouncements(PAGE_TYPE);

        console.log(
            `${announcements.length} annonces chargées (${PAGE_TYPE})`
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
        appliedFilters.prixTotalMin !== null ||
        appliedFilters.prixTotalMax !== null
    ) activeCount++;

    if (
        appliedFilters.prixM2Min !== null ||
        appliedFilters.prixM2Max !== null
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

    appliedFilters.prixTotalMin =
        getNumericInput("prix-total-min");
    appliedFilters.prixTotalMax =
        getNumericInput("prix-total-max");
    appliedFilters.prixM2Min =
        getNumericInput("prix-m2-min");
    appliedFilters.prixM2Max =
        getNumericInput("prix-m2-max");

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
        "prix-total-min",
        "prix-total-max",
        "prix-m2-min",
        "prix-m2-max",
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
        prixTotalMin: null,
        prixTotalMax: null,
        prixM2Min: null,
        prixM2Max: null,
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

        // Prix total
        const prixTotal = getTotalPrice(announcement);

        if (
            (appliedFilters.prixTotalMin !== null ||
            appliedFilters.prixTotalMax !== null) &&
            prixTotal === null
        ) return false;

        if (
            appliedFilters.prixTotalMin !== null &&
            prixTotal < appliedFilters.prixTotalMin
        ) return false;

        if (
            appliedFilters.prixTotalMax !== null &&
            prixTotal > appliedFilters.prixTotalMax
        ) return false;


        // Prix au m²
        const prixM2 = getPricePerM2(announcement);

        if (
            (appliedFilters.prixM2Min !== null ||
            appliedFilters.prixM2Max !== null) &&
            prixM2 === null
        ) return false;

        if (
            appliedFilters.prixM2Min !== null &&
            prixM2 < appliedFilters.prixM2Min
        ) return false;

        if (
            appliedFilters.prixM2Max !== null &&
            prixM2 > appliedFilters.prixM2Max
        ) return false;

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

            if (sortField === "dt_vente") {

                sortDirection =
                    PAGE_TYPE === "sales" ? "desc" : "asc";

            } else {

                sortDirection = "asc";

            }

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
        prix_total: "Prix total",
        prix_m2: "Prix au m²"
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

        let valueA;
        let valueB;

        switch (sortField) {

            case "mise_a_prix":
                valueA = toNumber(a.mise_a_prix);
                valueB = toNumber(b.mise_a_prix);
                break;

            case "surface_m2":
                valueA = toNumber(a.surface_m2);
                valueB = toNumber(b.surface_m2);
                break;

            case "prix_total":
                valueA = getTotalPrice(a);
                valueB = getTotalPrice(b);
                break;

            case "prix_m2":
                valueA = getPricePerM2(a);
                valueB = getPricePerM2(b);
                break;

            default: {
                const dateA = parseSaleDate(a[sortField]);
                const dateB = parseSaleDate(b[sortField]);

                // Dates absentes en dernier
                if (dateA === null && dateB !== null) return 1;
                if (dateA !== null && dateB === null) return -1;

                if (dateA === null && dateB === null) return 0;

                return sortDirection === "desc"
                    ? dateB - dateA
                    : dateA - dateB;
            }
        }

        return compareNumbers(valueA, valueB);
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

    // --------------------------------------------------
    // DONNÉES COMMUNES
    // --------------------------------------------------

    const price = formatPrice(announcement.mise_a_prix);

    const surface = announcement.surface_m2 != null
        ? Math.round(announcement.surface_m2)
        : null;

    const dateVente = formatDate(announcement.dt_vente);

    const dateVisite = formatDate(announcement.visite_dt);

    const tribunal = announcement.tribunal || "";

    const typeBien = Array.isArray(announcement.type)
        ? announcement.type.join(", ")
        : announcement.type || "Annonce";

    const adresseBien = announcement.adresse || "";

    // --------------------------------------------------
    // DONNÉES FINANCIÈRES
    // --------------------------------------------------

    // Prix estimé total
    const estimatedTotal = getEstimatedTotalPrice(announcement);

    // Prix final total
    const finalPrice = toNumber(announcement.prix_final);

    // Prix final au m²
    const finalPricePerM2 =
        getFinalPricePerSquareMeter(announcement);

    // Ratio par rapport à l'estimation
    const saleRatio = getSaleRatio(announcement);

    // Formatage
    const estPrice = estimatedTotal !== null
        ? formatPrice(estimatedTotal)
        : null;

    const finalPriceFormatted = finalPrice !== null
        ? formatPrice(finalPrice)
        : null;

    const finalPricePerM2Formatted = finalPricePerM2 !== null
        ? formatPrice(finalPricePerM2)
        : null;

    // Couleur du ratio
    let ratioClass = "ratio-neutral";

    if (saleRatio !== null) {

        if (saleRatio < -5) {
            ratioClass = "ratio-positive";
        } else if (saleRatio > 5) {
            ratioClass = "ratio-negative";
        }
    }

    // --------------------------------------------------
    // HTML DE LA CARD
    // --------------------------------------------------

    element.innerHTML = `

        <div class="property-description">

            <div class="property-heading">
                <h3 class="property-city">
                    ${escapeHtml(announcement.ville || "Ville non renseignée")}
                </h3>

                <span class="property-type">
                    ${escapeHtml(typeBien)}
                </span>
            </div>

            ${adresseBien ? `
                <div class="property-address">
                    <svg xmlns="http://www.w3.org/2000/svg"
                        width="15" height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true">
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

            ${PAGE_TYPE === "sales" ? `

                <div class="metric-estimation">

                    <div class="metric-estimation-header">
                        <span class="metric-label">
                            Prix de vente final
                        </span>

                        <span class="metric-value">
                            ${finalPriceFormatted || "N/A"}
                        </span>
                    </div>

                    ${finalPricePerM2Formatted ? `
                        <span class="metric-detail">
                            Soit ${finalPricePerM2Formatted}/m²
                        </span>
                    ` : ""}

                    ${saleRatio !== null ? `
                        <div class="sale-ratio ${ratioClass}">
                            <span class="metric-label">
                                Écart par rapport à l'estimation
                            </span>

                            <span class="metric-value">
                                ${saleRatio > 0 ? "+" : ""}${saleRatio.toFixed(1).replace(".", ",")} %
                            </span>
                        </div>
                    ` : ""}

                    ${estimatedTotal !== null ? `
                        <div class="metric-detail">
                            Estimation : ${estPrice}
                        </div>
                    ` : ""}

                </div>

            ` : `

                <div class="metric-estimation">

                    <div class="metric-estimation-header">
                        <span class="metric-label">
                            Prix de vente estimé
                        </span>

                        <span class="metric-value">
                            ${estPrice || "N/A"}
                        </span>
                    </div>

                    ${announcement.stats_bien?.avg != null ? `
                        <span class="metric-detail">
                            Soit ${formatPrice(announcement.stats_bien.avg)}/m²
                        </span>
                    ` : ""}

                </div>

            `}

        </div>

        <div class="date-info">

            ${PAGE_TYPE === "sales" ? `

                <div class="date-row date-tribunal">
                    <svg xmlns="http://www.w3.org/2000/svg"
                        width="16" height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true">
                        <path d="M3 21h18"/>
                        <path d="M5 21V7l8-4v18"/>
                        <path d="M19 21V11l-6-4"/>
                    </svg>

                    <span class="date-label">Tribunal</span>

                    <span class="date-value"
                        title="${escapeHtml(announcement.tribunal || "")}"
                    >
                        ${escapeHtml(announcement.tribunal || "Non renseigné")}
                    </span>
                </div>

            ` : dateVisite ? `
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

            <button 
                type="button" 
                class="licitor-folder-btn"
                title="Accéder au dossier du bien"
                aria-label="Accéder au dossier du bien"
            >
                <svg xmlns="http://www.w3.org/2000/svg"
                    width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
                </svg>
            </button>

            <button 
                type="button" 
                class="street-view-btn"
                title="Visualiser sur la carte"
                aria-label="Visualiser sur la carte"
            >
                <svg xmlns="http://www.w3.org/2000/svg"
                    width="20" height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/>
                    <circle cx="12" cy="10" r="2.5"/>
                </svg>
            </button>

            <button
                type="button"
                class="analyze-property-btn"
                title="Analyser le marché local"
                aria-label="Analyser le marché local"
            >
                <svg xmlns="http://www.w3.org/2000/svg"
                    width="20" height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <circle cx="11" cy="11" r="7"/>
                    <path d="m20 20-4-4"/>
                    <path d="M8 13V9"/>
                    <path d="M11 13V7"/>
                    <path d="M14 13v-2"/>
                </svg>
            </button>

        </div>
    `;

    // --------------------------------------------------
    // INTERACTIONS
    // --------------------------------------------------

    element.addEventListener("click", () => {
        selectAnnouncement(announcement.id);
    });

    const licitorFolderBtn = element.querySelector(
        ".licitor-folder-btn"
    );

    licitorFolderBtn.addEventListener("click", event => {

        event.stopPropagation();

        if (!announcement.url) return;

        window.open(
            announcement.url,
            "_blank",
            "noopener,noreferrer"
        );
    });

    const streetViewBtn = element.querySelector(
        ".street-view-btn"
    );

    streetViewBtn.addEventListener("click", event => {

        event.stopPropagation();

        const latitude = Number(
            announcement.coords?.latitude
        );

        const longitude = Number(
            announcement.coords?.longitude
        );

        if (
            announcement.coords?.latitude == null ||
            announcement.coords?.longitude == null ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180
        ) {
            console.warn(
                "Coordonnées invalides pour cette annonce",
                announcement
            );

            alert(
                "Les coordonnées géographiques de cette annonce ne sont pas disponibles."
            );

            return;
        }

        const url =
            `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );
    });

    const analyzeBtn = element.querySelector(
        ".analyze-property-btn"
    );

    analyzeBtn.addEventListener("click", event => {

        event.stopPropagation();

        console.log(announcement);

        openAnalysisSelector(announcement);

    });

    return element;
}

// --------------------------------------------------
// SÉLECTEUR D'ANALYSE
// --------------------------------------------------

function openAnalysisSelector(announcement) {

    selectedAnalysisAnnouncement = announcement;

    // Supprimer une éventuelle fenêtre précédente
    document.querySelector(
        ".analysis-modal-overlay"
    )?.remove();

    const overlay = document.createElement("div");

    overlay.className = "analysis-modal-overlay";

    overlay.innerHTML = `

        <div class="analysis-modal">

            <div class="analysis-modal-header">

                <h3>Analyser le marché local</h3>

                <button
                    type="button"
                    class="analysis-modal-close"
                    aria-label="Fermer"
                >
                    &times;
                </button>

            </div>

            <div class="analysis-modal-params">

                <div class="analysis-modal-radius">

                    <label
                        for="analysis-radius"
                        class="analysis-label"
                    >
                        Rayon
                    </label>

                    <select
                        id="analysis-radius"
                        class="analysis-select"
                    >
                        <option value="0.5">500 m</option>
                        <option value="1">1 km</option>
                        <option value="2">2 km</option>
                        <option value="5">5 km</option>
                        <option value="10">10 km</option>
                        <option value="15">15 km</option>
                        <option value="20">20 km</option>
                    </select>

                </div>

                <div class="analysis-modal-surface">

                    <label
                        for="analysis-surface"
                        class="analysis-label"
                    >
                        Surface
                    </label>

                    <select
                        id="analysis-surface"
                        class="analysis-select"
                    >
                        <option value="-1">Toutes les surfaces</option>
                        <option value="5">+/- 5 m²</option>
                        <option value="10">+/- 10 m²</option>
                        <option value="15">+/- 15 m²</option>
                        <option value="20">+/- 20 m²</option>
                        <option value="30">+/- 30 m²</option>
                    </select>

                </div>

            </div>

            <div class="analysis-modal-actions">

                <button
                    type="button"
                    class="analysis-cancel-btn"
                >
                    Annuler
                </button>

                <button
                    type="button"
                    class="analysis-confirm-btn"
                >
                    Confirmer
                </button>

            </div>

        </div>

    `;

    document.body.appendChild(overlay);

    // GET MEMORY VALUES

    // RADIUS

    const radiusSelect = overlay.querySelector(
        "#analysis-radius"
    );

    radiusSelect.value = String(analysisRadius);

    // SURFACE

    const surfaceSelect = overlay.querySelector(
        "#analysis-surface"
    );

    surfaceSelect.value = String(analysisSurface != null ? analysisSurface : -1);

    // Fermeture
    function closeModal() {

        overlay.remove();

        document.removeEventListener(
            "keydown",
            handleEscape
        );

    }

    function handleEscape(event) {

        if (event.key === "Escape") {
            closeModal();
        }

    }

    overlay.querySelector(
        ".analysis-modal-close"
    ).addEventListener("click", closeModal);

    overlay.querySelector(
        ".analysis-cancel-btn"
    ).addEventListener("click", closeModal);

    overlay.addEventListener("click", event => {

        if (event.target === overlay) {
            closeModal();
        }

    });

    document.addEventListener(
        "keydown",
        handleEscape
    );


    // --------------------------------------------------
    // CONFIRMATION ET LANCEMENT DE L'ANALYSE
    // --------------------------------------------------

    const confirmBtn = overlay.querySelector(
        ".analysis-confirm-btn"
    );

    confirmBtn.addEventListener("click", async () => {

        // TCHECK RADIUS

        const radius = Number(radiusSelect.value);

        if (![0.5, 1, 2, 5, 10, 15, 20].includes(radius)) {
            return;
        }

        const rawLatitude =
            announcement.latitude ??
            announcement.coords?.latitude;

        const rawLongitude =
            announcement.longitude ??
            announcement.coords?.longitude;

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

            alert(
                "Les coordonnées géographiques de ce bien sont indisponibles."
            );

            return;
        }

        // Mémoriser le rayon
        analysisRadius = radius;

        sessionStorage.setItem(
            ANALYSIS_RADIUS_KEY,
            String(radius)
        );

        // CODE DE TCHECK DES VALEURS DE SURFACE 

        const surfaceAdj = Number(surfaceSelect.value);

        if (![-1, 5, 10, 15, 20, 25, 30].includes(surfaceAdj)) {
            return;
        }

        // Mémoriser l'ajustement de surface
        analysisSurface = surfaceAdj;

        sessionStorage.setItem(
            ANALYSIS_SURFACE_KEY,
            String(surfaceAdj)
        );

        const surface = toNumber(announcement.surface_m2);

        // État de chargement
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Recherche...";

        try {

            const nearbySales = await loadNearbySales({
                latitude,
                longitude,
                radiusKm: radius,
                surfaceBien: surface,
                surfaceAdj: surfaceAdj
            });

            const nbrMktTransactions = nearbySales.length - 1;

            if (nbrMktTransactions === 0) {

                showToast("Aucune transaction n'a été trouvée pour les paramètres sélectionnés", 'warning');

                confirmBtn.disabled = false;
                confirmBtn.textContent = "Confirmer";

            }

            else {

                // Préparation des données pour la termsheet
                const nearbyAnalysis = prepareNearbySalesAnalysis({

                    sales: nearbySales,

                    latitude,

                    longitude,

                    radiusKm: radius,

                    announcementId: announcement.id,

                });

                console.log("Analyse géographique préparée :", {
                    announcementId: announcement.id,
                    radiusKm: radius,
                    totalTransactions: nearbySales.length,
                    transactions: nearbySales,
                    analysis: nearbyAnalysis
                });

                openAnalysisSheet(
                    nearbyAnalysis,
                    announcement,
                    PAGE_TYPE
                );

                closeModal();

            }

        } catch (error) {

            console.error(
                "Impossible de réaliser l'analyse :",
                error
            );

            alert(
                "Une erreur est survenue lors de la récupération des transactions."
            );

            confirmBtn.disabled = false;
            confirmBtn.textContent = "Confirmer";

        }

    });


}

// --------------------------------------------------
// Marqueurs
// --------------------------------------------------

function displayMarkers(filteredAnnouncements) {

    const visibleIds = new Set();
    const coordinates = [];
    const markersToAdd = [];

    filteredAnnouncements.forEach(announcement => {

        const rawLatitude =
            announcement.latitude ?? announcement.coords?.latitude;
        const rawLongitude =
            announcement.longitude ?? announcement.coords?.longitude;

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

            marker = createPropertyMarker(
                announcement,
                latitude,
                longitude
            );

            // DESACTIVATION DES POPUPS AU CLICK
            /*
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
            */

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
// Style des marqueurs individuels
// --------------------------------------------------

// --------------------------------------------------
// Création des marqueurs individuels
// --------------------------------------------------

function createPropertyMarker(
    announcement,
    latitude,
    longitude
) {

    // Page visites : marqueur Leaflet classique
    if (PAGE_TYPE !== "sales") {

        return L.marker([
            latitude,
            longitude
        ]);
    }

    // Prix affiché
    const finalPrice = toNumber(announcement.prix_final);

    const priceLabel = finalPrice !== null
        ? formatMarkerPrice(finalPrice)
        : "N/A";

    // Couleur selon le prix au m² ou le prix total
    const markerColor = getMarkerColor(announcement);

    // Indicateur de comparaison avec l'estimation
    const ratioIndicator = getMarkerRatioIndicator(announcement);

    // HTML de l'indicateur
    const ratioHtml = ratioIndicator
        ? `
            <span
                class="property-marker-ratio ${ratioIndicator.className}"
                title="${ratioIndicator.label}"
                aria-label="${ratioIndicator.label}"
            >
                ${ratioIndicator.symbol}
            </span>
        `
        : "";

    const icon = L.divIcon({

        html: `
            <div class="property-price-marker marker-${markerColor}">

                <span class="property-marker-price">
                    ${escapeHtml(priceLabel)}
                </span>

                ${ratioHtml}

            </div>
        `,

        className: "property-price-marker-container",

        iconSize: [88, 44],
        iconAnchor: [44, 44]
    });

    return L.marker(
        [latitude, longitude],
        { icon }
    );
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

function formatMarkerPrice(price) {

    const value = toNumber(price);

    if (value === null) {
        return "N/A";
    }

    if (value >= 1000000) {

        return new Intl.NumberFormat("fr-FR", {
            maximumFractionDigits: 1
        }).format(value / 1000000) + " M€";

    }

    else {

        if (value < 1000) {
            return new Intl.NumberFormat("fr-FR", {
                maximumFractionDigits: 0
            }).format(value) + " €";
        }

        else {

            return new Intl.NumberFormat("fr-FR", {
                maximumFractionDigits: 0
            }).format(value / 1000) + " K€";

        }

    }
}

// --------------------------------------------------
// Couleur des marqueurs - PAGE VENTES
// --------------------------------------------------

function getMarkerColor(announcement) {

    const finalPrice = toNumber(announcement.prix_final);

    // Aucun prix final : marqueur gris
    if (finalPrice === null) {
        return "gray";
    }

    // Priorité au prix final au m²
    const priceM2 = getPricePerM2(announcement);

    if (priceM2 !== null) {

        if (priceM2 <= 3000) {
            return "green";
        }

        if (priceM2 <= 6000) {
            return "orange";
        }

        return "red";
    }

    // Sinon, utilisation du prix final total
    if (finalPrice <= 200000) {
        return "green";
    }

    if (finalPrice <= 400000) {
        return "orange";
    }

    return "red";
}

// --------------------------------------------------
// Indicateur du ratio - PAGE VENTES
// --------------------------------------------------

function getMarkerRatioIndicator(announcement) {

    const ratio = getSaleRatio(announcement);

    // Pas d'estimation ou de prix final exploitable
    if (ratio === null) {
        return null;
    }

    if (ratio < -5) {
        return {
            className: "ratio-down",
            symbol: "↓",
            label: "Prix inférieur à l'estimation"
        };
    }

    if (ratio > 5) {
        return {
            className: "ratio-up",
            symbol: "↑",
            label: "Prix supérieur à l'estimation"
        };
    }

    return {
        className: "ratio-neutral",
        symbol: "−",
        label: "Prix proche de l'estimation"
    };
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

    return sortDirection === "desc"
        ? numberB - numberA
        : numberA - numberB;
}

function getTotalPrice(announcement) {

    if (PAGE_CONFIG[PAGE_TYPE].totalPriceField === "final") {
        return toNumber(announcement.prix_final);
    }

    return toNumber(getEstimatedTotalPrice(announcement));
}

function getPricePerM2(announcement) {

    if (PAGE_CONFIG[PAGE_TYPE].priceM2Field === "final") {
        return toNumber(getFinalPricePerSquareMeter(announcement));
    }

    return toNumber(announcement.stats_bien?.avg);
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

function getFinalPricePerSquareMeter(announcement) {

    const finalPrice = toNumber(announcement.prix_final);
    const surface = toNumber(announcement.surface_m2);

    if (finalPrice === null || surface === null || surface <= 0) {
        return null;
    }

    return finalPrice / surface;
}

function getSaleRatio(announcement) {

    const finalPrice = toNumber(announcement.prix_final);
    const estimatedPrice = getEstimatedTotalPrice(announcement);

    if (
        finalPrice === null ||
        estimatedPrice === null ||
        estimatedPrice <= 0
    ) {
        return null;
    }

    return ((finalPrice - estimatedPrice) / estimatedPrice) * 100;
}
