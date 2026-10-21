// --------------------------------------------------
// Variables globales
// --------------------------------------------------

let announcements = [];
let map;
let markers = new Map();
// Champ utilisé pour le tri
let sortField = "dt_vente";
// État de la recherche : chaîne vide = pas de recherche
let searchTerm = "";
const appliedFilters = {
    surfaceMin: null,
    surfaceMax: null,
    prixMin: null,
    prixMax: null,
    estimationMin: null,
    estimationMax: null,
    tribunaux: []
};

// --------------------------------------------------
// Initialisation
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {

    initializeMap();
    initializeSorting();
    initializeSearch();

    initializeFilterDropdowns();

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

    // Vue initiale approximative sur le sud de la France
    map.setView([43.5, 5.5], 9);
}

function clearMarkers() {

    markers.forEach(marker => {
        map.removeLayer(marker);
    });

    markers.clear();
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

    const buttons = document.querySelectorAll(".filter-button");

    buttons.forEach(button => {
        button.addEventListener("click", () => {

            const filter = button.dataset.filter;
            const panel = document.getElementById(`panel-${filter}`);
            const wasOpen = !panel.hidden;

            // Fermer tous les panneaux
            document.querySelectorAll(".filter-panel").forEach(p => {
                p.hidden = true;
            });

            buttons.forEach(b => {
                b.setAttribute("aria-expanded", "false");
            });

            // Ouvrir le panneau demandé s'il était fermé
            if (!wasOpen) {
                panel.hidden = false;
                button.setAttribute("aria-expanded", "true");
            }
        });
    });

    document.addEventListener("click", event => {
        if (event.target.closest(".filter-dropdown")) {
            return;
        }

        document.querySelectorAll(".filter-panel").forEach(panel => {
            panel.hidden = true;
        });

        buttons.forEach(button => {
            button.setAttribute("aria-expanded", "false");
        });
    });
}

function updateFilterButtonStates() {

    const filterStates = {
        surface:
            appliedFilters.surfaceMin !== null ||
            appliedFilters.surfaceMax !== null,

        prix:
            appliedFilters.prixMin !== null ||
            appliedFilters.prixMax !== null,

        estimation:
            appliedFilters.estimationMin !== null ||
            appliedFilters.estimationMax !== null,

        tribunaux:
            appliedFilters.tribunaux.length > 0
    };

    document.querySelectorAll(".filter-button").forEach(button => {

        const isActive = filterStates[button.dataset.filter];

        button.classList.toggle("active", isActive);
    });
}

function applyFilters() {

    appliedFilters.surfaceMin = getNumericInput("surface-min");
    appliedFilters.surfaceMax = getNumericInput("surface-max");

    appliedFilters.prixMin = getNumericInput("prix-min");
    appliedFilters.prixMax = getNumericInput("prix-max");

    appliedFilters.estimationMin = getNumericInput("estimation-min");
    appliedFilters.estimationMax = getNumericInput("estimation-max");

    appliedFilters.tribunaux = [
        ...document.querySelectorAll(
            "#tribunal-filters input[type='checkbox']:checked"
        )
    ].map(checkbox => checkbox.value);

    // Fermer le panneau ouvert
    document.querySelectorAll(".filter-panel").forEach(panel => {
        panel.hidden = true;
    });

    document.querySelectorAll(".filter-button").forEach(button => {
        button.setAttribute("aria-expanded", "false");
    });

    updateFilterButtonStates();
    updateDisplay();
}

function resetFilters() {

    [
        "surface-min",
        "surface-max",
        "prix-min",
        "prix-max",
        "estimation-min",
        "estimation-max"
    ].forEach(id => {
        document.getElementById(id).value = "";
    });

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
        tribunaux: []
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

        return true;
    });
}


// --------------------------------------------------
// Tri
// --------------------------------------------------

function initializeSorting() {

    const sortButton = document.getElementById(
        "sort-announcements"
    );

    sortButton.addEventListener("click", () => {

        sortField = sortField === "dt_vente" 
            ? "visite_dt" 
            : "dt_vente";

        updateSortButton();

        updateDisplay();
    });

    updateSortButton();
}

function updateSortButton() {

    const sortButton = document.getElementById(
        "sort-announcements"
    );

    const isSaleDate = sortField === "dt_vente";

    sortButton.textContent = isSaleDate
        ? "Vente ↑"
        : "Visite ↑";

    sortButton.title = isSaleDate
        ? "Tri croissant par date de vente. Cliquer pour trier par date de visite."
        : "Tri croissant par date de visite. Cliquer pour trier par date de vente.";

    sortButton.setAttribute(
        "aria-label",
        sortButton.title
    );
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

        const dateA = parseSaleDate(a[sortField]);
        const dateB = parseSaleDate(b[sortField]);

        // Les dates absentes sont placées à la fin
        if (dateA === null && dateB === null) {
            return 0;
        }

        if (dateA === null) {
            return 1;
        }

        if (dateB === null) {
            return -1;
        }

        // Toujours de la date la plus récente à la plus ancienne
        return dateA - dateB;
    });

    sortedAnnouncements.forEach(announcement => {

        const element = createAnnouncementElement(
            announcement
        );

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

    element.innerHTML = `
        <h3 class="announcement-title">
            ${escapeHtml(announcement.ville)}
        </h3>

        <div class="announcement-city">
            ${escapeHtml(typeBien)}
        </div>

        <div class="announcement-info">

            <span class="quant">
                ${price}
            </span>

            <span class="quant">
                ${surface != null ? surface + " m²" : ""}
            </span>

            <span class="quant estimated-price">
                ${estPricePerSquareMeter
                    ? estPricePerSquareMeter + " / m²"
                    : "Estimé : N/A"}
            </span>

        </div>

        <div class="date-info">

            <span class="date">
                ${dateVisite
                    ? "Visite : " + dateVisite
                    : ""}
            </span>

            <span class="date">
                ${dateVente
                    ? "Vente : " + dateVente
                    : ""}
            </span>

        </div>

        <a
            class="announcement-link"
            href="${escapeHtml(announcement.url)}"
            target="_blank"
            rel="noopener noreferrer"
        >
            Voir l'annonce
        </a>
    `;

    element.addEventListener("click", () => {
        selectAnnouncement(announcement.id);
    });

    return element;
}

// --------------------------------------------------
// Marqueurs
// --------------------------------------------------

function displayMarkers(filteredAnnouncements) {

    // Supprimer tous les anciens marqueurs
    clearMarkers();

    const coordinates = [];

    filteredAnnouncements.forEach(announcement => {

        if (
            !announcement.coords ||
            announcement.coords.latitude == null ||
            announcement.coords.longitude == null
        ) {
            return;
        }

        const latitude =
            announcement.coords.latitude;

        const longitude =
            announcement.coords.longitude;


        const marker = L.marker([
            latitude,
            longitude
        ]).addTo(map);


        marker.bindPopup(`
            <strong>
                ${escapeHtml(announcement.ville)}
            </strong>
            <br>
            ${formatPrice(announcement.mise_a_prix)}
            <br><br>
            <a
                href="${announcement.url}"
                target="_blank"
                rel="noopener noreferrer"
            >
                Voir l'annonce
            </a>
        `);


        marker.on("click", () => {

            selectAnnouncement(
                announcement.id,
                false
            );

        });


        markers.set(
            announcement.id,
            marker
        );


        coordinates.push([
            latitude,
            longitude
        ]);
    });


    // --------------------------------------------------
    // Aucun résultat
    // --------------------------------------------------

    const noResultsElement =
        document.getElementById(
            "map-no-results"
        );

    if (filteredAnnouncements.length === 0) {

        noResultsElement.style.display =
            "block";

        return;
    }

    noResultsElement.style.display =
        "none";


    // --------------------------------------------------
    // Adapter la carte aux résultats
    // --------------------------------------------------

    if (coordinates.length > 0) {

        const bounds =
            L.latLngBounds(coordinates);

        map.fitBounds(
            bounds,
            {
                padding: [40, 40]
            }
        );

        setTimeout(() => {
            map.invalidateSize();
        }, 100);
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