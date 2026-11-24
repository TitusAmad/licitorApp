
/* ==================================================
   ANNOUNCEMENT FILTERS
   Moteur générique de filtrage des annonces
================================================== */


// --------------------------------------------------
// CONFIGURATION DES MÉTHODES
// --------------------------------------------------


const FILTER_METHODS = {

    // ----------------------------------------------
    // MÉTHODES COMMUNES AUX DEUX PAGES
    // ----------------------------------------------

    toutes: {
        source: "all",
        filter: () => true
    },

    mise_a_prix_inferieure_30000: {
        source: "all",
        filter: announcement => {
            const prix = Number(announcement.mise_a_prix);

            return (
                announcement.mise_a_prix !== null &&
                announcement.mise_a_prix !== undefined &&
                String(announcement.mise_a_prix).trim() !== "" &&
                Number.isFinite(prix) &&
                prix < 30000
            );
        }
    },

    // ----------------------------------------------
    // VISITES ET VENTES NON RÉALISÉES
    // ----------------------------------------------

    visites_a_venir: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateAfterOrEqual(
                announcement.visite_dt,
                context.now
            )
    },

    visites_passees: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateBefore(
                announcement.visite_dt,
                context.now
            )
    },

    visites_aujourdhui: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.visite_dt,
                context.todayStart,
                context.tomorrowStart
            )
    },

    visites_semaine_en_cours: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.visite_dt,
                context.currentWeekStart,
                context.nextWeekStart
            )
    },

    visites_semaine_prochaine: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.visite_dt,
                context.nextWeekStart,
                context.weekAfterNextStart
            )
    },

    visites_7_prochains_jours: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.visite_dt,
                context.now,
                context.next7Days
            )
    },

    visites_sans_date: {
        source: "non_realisees",
        filter: announcement =>
            !parseAnnouncementDate(announcement.visite_dt)
    },


    // ----------------------------------------------
    // VENTES À VENIR
    // ----------------------------------------------

    ventes_a_venir: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateAfterOrEqual(
                announcement.dt_vente,
                context.now
            )
    },

    ventes_aujourdhui: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.dt_vente,
                context.todayStart,
                context.tomorrowStart
            )
    },

    ventes_semaine_en_cours: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.dt_vente,
                context.currentWeekStart,
                context.nextWeekStart
            )
    },

    ventes_semaine_prochaine: {
        source: "non_realisees",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.dt_vente,
                context.nextWeekStart,
                context.weekAfterNextStart
            )
    },


    // ----------------------------------------------
    // VENTES HISTORIQUES
    // ----------------------------------------------

    ventes_7_derniers_jours: {
        source: "historiques",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.dt_vente,
                context.last7Days,
                context.now
            )
    },

    ventes_30_derniers_jours: {
        source: "historiques",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.dt_vente,
                context.last30Days,
                context.now
            )
    },

    ventes_mois_en_cours: {
        source: "historiques",
        filter: (announcement, context) =>
            isDateInRange(
                announcement.dt_vente,
                context.currentMonthStart,
                context.nextMonthStart
            )
    },

    surencheres: {
        source: "historiques",
        filter: announcement =>
            Number(announcement.sell_state) === 1
    }

};


// --------------------------------------------------
// FONCTION PRINCIPALE
// --------------------------------------------------

export function filterAnnouncements(
    announcements,
    method = "toutes",
    options = {}
) {

    if (!Array.isArray(announcements)) {
        throw new TypeError(
            "Les annonces doivent être fournies sous forme de tableau."
        );
    }

    const config = FILTER_METHODS[method];

    if (!config) {
        throw new Error(
            `Méthode de filtrage inconnue : ${method}`
        );
    }

    // Vérification facultative de la source
    if (
        options.source &&
        config.source !== "all" &&
        config.source !== options.source
    ) {

        throw new Error(
            `La méthode "${method}" nécessite la source "${config.source}".`
        );

    }

    // Création du contexte temporel
    const context = createDateContext(
        options.referenceDate ?? new Date()
    );

    // Filtrage sans modifier le tableau original
    return announcements.filter(announcement =>
        config.filter(announcement, context)
    );

}


// --------------------------------------------------
// CONTEXTE TEMPOREL
// --------------------------------------------------

function createDateContext(referenceDate) {

    const now = new Date(referenceDate);

    if (Number.isNaN(now.getTime())) {
        throw new TypeError(
            "Date de référence invalide."
        );
    }

    // Début de la journée actuelle
    const todayStart = startOfDay(now);

    // Début du lendemain
    const tomorrowStart = addDays(
        todayStart,
        1
    );

    // ----------------------------------------------
    // SEMAINES
    // ----------------------------------------------

    // Premier jour de la semaine : lundi
    const currentWeekStart = new Date(todayStart);

    const day = currentWeekStart.getDay();

    const daysSinceMonday = (day + 6) % 7;

    currentWeekStart.setDate(
        currentWeekStart.getDate() - daysSinceMonday
    );

    // Lundi de la semaine prochaine
    const nextWeekStart = addDays(
        currentWeekStart,
        7
    );

    // Lundi de la semaine suivante
    const weekAfterNextStart = addDays(
        currentWeekStart,
        14
    );


    // ----------------------------------------------
    // PÉRIODES GLISSANTES
    // ----------------------------------------------

    const next7Days = addDays(
        now,
        7
    );

    const last7Days = addDays(
        now,
        -7
    );

    const last30Days = addDays(
        now,
        -30
    );


    // ----------------------------------------------
    // MOIS
    // ----------------------------------------------

    const currentMonthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    );

    const nextMonthStart = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
    );


    return {

        now,

        todayStart,
        tomorrowStart,

        currentWeekStart,
        nextWeekStart,
        weekAfterNextStart,

        next7Days,
        last7Days,
        last30Days,

        currentMonthStart,
        nextMonthStart

    };

}

export function getAvailableFilterMethods(source = null) {

    return Object.entries(FILTER_METHODS)
        .filter(([, config]) =>
            source === null ||
            config.source === "all" ||
            config.source === source
        )
        .map(([method]) => method);

}

export function getFilterMethodsBySource() {

    return Object.fromEntries(
        Object.entries(FILTER_METHODS).map(
            ([method, config]) => [
                method,
                config.source
            ]
        )
    );

}

// --------------------------------------------------
// UTILITAIRES
// --------------------------------------------------

function parseAnnouncementDate(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    // Conversion des dates SQL :
    // YYYY-MM-DD HH:mm:ss
    //
    // Exemple :
    // 2026-11-23 14:30:00
    //
    // Devient :
    // 2026-11-23T14:30:00

    const normalized = String(value).replace(
        /^(\d{4}-\d{2}-\d{2})\s+/,
        "$1T"
    );

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;

}


// --------------------------------------------------
// UTILITAIRES TEMPORELS
// --------------------------------------------------

function startOfDay(date) {

    const result = new Date(date);

    result.setHours(0, 0, 0, 0);

    return result;

}


function addDays(date, days) {

    const result = new Date(date);

    result.setDate(
        result.getDate() + days
    );

    return result;

}


// --------------------------------------------------
// RÈGLES DE COMPARAISON
// --------------------------------------------------

// Date supérieure ou égale à maintenant
function isDateAfterOrEqual(value, now) {

    const date = parseAnnouncementDate(value);

    if (!date) return false;

    return date.getTime() >= now.getTime();

}


// Date strictement antérieure à maintenant
function isDateBefore(value, now) {

    const date = parseAnnouncementDate(value);

    if (!date) return false;

    return date.getTime() < now.getTime();

}


// Date comprise dans un intervalle
// Début inclus / fin exclue
function isDateInRange(value, start, end) {

    const date = parseAnnouncementDate(value);

    if (!date) return false;

    const timestamp = date.getTime();

    return (
        timestamp >= start.getTime() &&
        timestamp < end.getTime()
    );

}
