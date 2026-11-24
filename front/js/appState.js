// --------------------------------------------------
// PERSISTANCE DES PRÉFÉRENCES
// --------------------------------------------------

const APP_STATE_KEY = "immobilier_app_state";
const APP_STATE_VERSION = 1;

export function getDefaultAppState() {

    return {
        version: APP_STATE_VERSION,

        pages: {
            visits: {
                search: "",
                filters: null,
                predefinedFilter: "toutes"
            },

            sales: {
                search: "",
                filters: null,
                predefinedFilter: "toutes"
            }
        }
    };

}

export function loadAppState() {

    try {

        const storedState = sessionStorage.getItem(APP_STATE_KEY);

        if (!storedState) {
            return getDefaultAppState();
        }

        const parsedState = JSON.parse(storedState);

        // Vérifier la version
        if (parsedState.version !== APP_STATE_VERSION) {
            return getDefaultAppState();
        }

        // Vérifier la structure générale
        if (
            !parsedState.pages ||
            !parsedState.pages.visits ||
            !parsedState.pages.sales
        ) {
            return getDefaultAppState();
        }

        return parsedState;

    } catch (error) {

        console.error(
            "Impossible de restaurer les préférences :",
            error
        );

        return getDefaultAppState();

    }

}

export function saveAppState(
    searchByPage,
    filtersByPage,
    predefinedFiltersByPage
) {

    try {

        const state = {

            version: APP_STATE_VERSION,

            pages: {

                visits: {
                    search: searchByPage.visits,
                    filters: filtersByPage.visits,
                    predefinedFilter:
                        predefinedFiltersByPage.visits || "toutes"
                },

                sales: {
                    search: searchByPage.sales,
                    filters: filtersByPage.sales,
                    predefinedFilter:
                        predefinedFiltersByPage.sales || "toutes"
                }

            }

        };

        sessionStorage.setItem(
            APP_STATE_KEY,
            JSON.stringify(state)
        );

    } catch (error) {

        console.error(
            "Impossible de sauvegarder les préférences :",
            error
        );

    }

}

export function restoreAppState(
    searchByPage,
    filtersByPage,
    predefinedFiltersByPage
) {

    const state = loadAppState();

    // Restaurer les recherches
    searchByPage.visits =
        state.pages.visits.search || "";

    searchByPage.sales =
        state.pages.sales.search || "";

    // Restaurer les filtres manuels
    filtersByPage.visits =
        state.pages.visits.filters;

    filtersByPage.sales =
        state.pages.sales.filters;

    // Restaurer les filtres prédéfinis
    predefinedFiltersByPage.visits =
        state.pages.visits.predefinedFilter || "toutes";

    predefinedFiltersByPage.sales =
        state.pages.sales.predefinedFilter || "toutes";

}