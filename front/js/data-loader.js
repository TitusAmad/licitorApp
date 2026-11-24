import { supabase } from "./supabase.js";

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const SALES_LIMIT = 100;

const CACHE_VERSION = "v1";

const CACHE_TTL = 1 * 24 * 60 * 60 * 1000; // 1 jour

const CACHE_KEYS = {
    visits: `announcements_visits_${CACHE_VERSION}`,
    sales: `announcements_sales_${CACHE_VERSION}`
};


// --------------------------------------------------
// CHARGEMENT PRINCIPAL
// --------------------------------------------------

export async function loadAnnouncementsWithMeta(
    pageType = "visits",
    options = {}
) {

    const data = await loadAnnouncements(
        pageType,
        options
    );

    return {
        data,
        fingerprint: createDataFingerprint(data)
    };

}

export async function loadAnnouncements(
    pageType = "visits",
    { forceRefresh = false } = {}
) {

    const cacheKey = CACHE_KEYS[pageType];

    if (!cacheKey) {
        throw new Error(`Type de page inconnu : ${pageType}`);
    }

    // Lecture du cache
    const cached = getCachedData(cacheKey);

    // Retour immédiat si le cache est encore valide
    if (
        !forceRefresh &&
        cached &&
        Date.now() - cached.timestamp < CACHE_TTL
    ) {

        console.log(
            `Données ${pageType} chargées depuis le cache`
        );

        return cached.data;
    }

    // Cache absent ou expiré : récupération des données
    try {

        console.log(
            `Actualisation des données ${pageType}...`
        );

        let data;

        if (pageType === "sales") {
            data = await loadSales();
        } else {
            data = await loadVisits();
        }

        // Mise en cache
        setCachedData(cacheKey, data);

        console.log(
            `${data.length} annonces ${pageType} actualisées`
        );

        return data;

    } catch (error) {

        console.error(
            `Erreur lors du chargement des données ${pageType} :`,
            error
        );

        // Utilisation du cache expiré en cas d'indisponibilité
        if (cached) {

            console.warn(
                `Utilisation du cache expiré pour ${pageType}`
            );

            return cached.data;
        }

        // Aucune donnée disponible
        throw error;
    }
}


// --------------------------------------------------
// GESTION DU CACHE
// --------------------------------------------------

function createDataFingerprint(data) {

    const json = JSON.stringify(data);

    let hash = 2166136261;

    for (let i = 0; i < json.length; i++) {

        hash ^= json.charCodeAt(i);

        hash = Math.imul(hash, 16777619);

    }

    return (hash >>> 0).toString(16);

}

function getCachedData(key) {

    try {

        const cached = localStorage.getItem(key);

        if (!cached) {
            return null;
        }

        const parsed = JSON.parse(cached);

        if (
            !Array.isArray(parsed.data) ||
            typeof parsed.timestamp !== "number"
        ) {
            return null;
        }

        // Compatibilité avec les anciens caches
        const fingerprint =
            parsed.fingerprint ||
            createDataFingerprint(parsed.data);

        return {
            ...parsed,
            fingerprint
        };

    } catch (error) {

        console.warn(
            "Impossible de lire le cache local :",
            error
        );

        return null;
    }
}

function setCachedData(key, data) {

    try {

        const cache = {
            timestamp: Date.now(),
            fingerprint: createDataFingerprint(data),
            data
        };

        localStorage.setItem(
            key,
            JSON.stringify(cache)
        );

        return cache;

    } catch (error) {

        console.warn(
            "Impossible d'enregistrer le cache local :",
            error
        );

        return {
            timestamp: Date.now(),
            fingerprint: createDataFingerprint(data),
            data
        };
    }
}


// --------------------------------------------------
// CHARGEMENT DES VISITES
// --------------------------------------------------

async function loadVisits() {

    const response = await fetch("./data/auctions.json");

    if (!response.ok) {
        throw new Error(`Erreur HTTP : ${response.status}`);
    }

    const data = await response.json();

    return Object.values(data);
}


// --------------------------------------------------
// CHARGEMENT DES VENTES
// --------------------------------------------------

async function loadSales() {

    const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("dt_vente", {
            ascending: false,
            nullsFirst: false
        })
        .limit(SALES_LIMIT);

    if (error) {
        throw error;
    }

    return data.map(normalizeSale);
}


// --------------------------------------------------
// CHARGEMENT DES TRANSACTIONS À PROXIMITÉ
// --------------------------------------------------

export async function loadNearbySales({
    latitude,
    longitude,
    radiusKm,
    surfaceBien,
    surfaceAdj
}) {

    const lat = Number(latitude);
    const lng = Number(longitude);
    const radius = Number(radiusKm);

    const surface = Number(surfaceBien);
    const adjustedSurface = Number(surfaceAdj);
    
    let minSurface = null
    let maxSurface = null

    if (adjustedSurface > 0 && surface > 0) {
        minSurface = Math.floor(Math.max(0, surface - adjustedSurface));
        maxSurface = Math.ceil(surface + adjustedSurface)
    }

    // Vérification des paramètres
    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 || lat > 90 ||
        lng < -180 || lng > 180
    ) {
        throw new Error("Coordonnées géographiques invalides.");
    }

    if (
        !Number.isFinite(radius) ||
        radius <= 0 ||
        radius > 20
    ) {
        throw new Error("Rayon de recherche invalide.");
    }

    console.log("Recherche des transactions à proximité...", {
        latitude: lat,
        longitude: lng,
        radiusKm: radius,
        SurfaceAdjusted: adjustedSurface,
    });

    const { data, error } = await supabase.rpc(
        "get_nearby_sales",
        {
            p_latitude: lat,
            p_longitude: lng,
            p_radius_km: radius,
            p_surface_min: minSurface,
            p_surface_max: maxSurface
        }
    );

    if (error) {
        console.error(
            "Erreur lors de la recherche géographique :",
            error
        );

        throw error;
    }

    const normalizedData = data.map(sale => ({
        ...normalizeSale(sale),

        distance_m: Number(sale.distance_m)
    }));

    if (minSurface !== null && maxSurface !== null) {
        console.log(
            `${normalizedData.length} transactions trouvées dans un rayon de ${radius} km avec une surface entre ${minSurface} m² et ${maxSurface} m²`
        );
    }
    else {
        console.log(
            `${normalizedData.length} transactions trouvées dans un rayon de ${radius} km`
        );
    }

    return normalizedData;
}

// --------------------------------------------------
// NORMALISATION DES VENTES
// --------------------------------------------------

function normalizeSale(sale) {

    return {

        ...sale,

        id: String(sale.id),

        coords: {
            latitude: sale.latitude != null
                ? Number(sale.latitude)
                : null,

            longitude: sale.longitude != null
                ? Number(sale.longitude)
                : null
        },

        mise_a_prix: sale.mise_a_prix != null
            ? Number(sale.mise_a_prix)
            : null,

        prix_final: sale.prix_final != null
            ? Number(sale.prix_final)
            : null,

        est_price: sale.est_price != null
            ? Number(sale.est_price)
            : null,

        est_price_m2: sale.est_price_m2 != null
            ? Number(sale.est_price_m2)
            : null,

        surface_m2: sale.surface_m2 != null
            ? Number(sale.surface_m2)
            : null,

        stats_bien: sale.stats_bien || null

    };
}