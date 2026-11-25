
 import {
    generateAnalysisSheet
} from "./analysis/analysis-sheet-generator.js";

import {
    refreshAnalysisMapSize
} from "./analysis/sections/map-section.js";
 
 // ==================================================
 // ANALYSIS SHEET
 // ==================================================

let currentAnalysis = null;


// --------------------------------------------------
// INITIALISATION
// --------------------------------------------------

export function initializeAnalysisSheet() {

    const overlay = document.getElementById(
        "analysis-sheet-overlay"
    );

    const closeButton = document.getElementById(
        "analysis-sheet-close"
    );

    if (!overlay || !closeButton) {
        console.error("Conteneur de termsheet introuvable.");
        return;
    }

    // Fermeture par bouton
    closeButton.addEventListener(
        "click",
        closeAnalysisSheet
    );

    // Fermeture par clic sur le fond
    overlay.addEventListener("click", event => {

        if (event.target === overlay) {
            closeAnalysisSheet();
        }

    });

    // Fermeture avec Échap
    document.addEventListener("keydown", event => {

        if (
            event.key === "Escape" &&
            !overlay.hidden
        ) {
            closeAnalysisSheet();
        }

    });

}


// --------------------------------------------------
// OUVERTURE
// --------------------------------------------------

export function openAnalysisSheet(
    analysis,
    announcement,
    pageType
) {

    const overlay = document.getElementById(
        "analysis-sheet-overlay"
    );

    if (!overlay) return;

    currentAnalysis = {
        analysis,
        announcement,
        pageType
    };

    // En tete dynamique

    const commLabel = announcement.ville || "ns"
    const adrLabel = announcement.adresse || "ns"

    document.getElementById("analysis-sheet-comm").textContent =
        commLabel;

    document.getElementById("analysis-sheet-address").textContent =
        adrLabel;

    document.getElementById("analysis-sheet-radius").textContent =
        `${analysis.metadata.radiusKm} km`;

    document.getElementById("analysis-sheet-surface").textContent =
        analysis.metadata.surfaceParamsLabel;

    document.getElementById("analysis-sheet-period").textContent =
        `${analysis.metadata.dateVenteParamsLabel}`;

    document.getElementById("analysis-sheet-transactions").textContent =
        analysis.metadata.totalTransactions;


    // Génération du contenu
    generateAnalysisSheet({
        announcement,
        nearbyAnalysis: analysis
    });

    // Afficher la fenêtre
    overlay.hidden = false;

    refreshAnalysisMapSize();

    document.body.style.overflow = "hidden";

    // Retour en haut du contenu
    document.querySelector(
        ".analysis-sheet-content"
    ).scrollTop = 0;

    document.getElementById(
        "analysis-sheet-close"
    ).focus();

}

// --------------------------------------------------
// FERMETURE
// --------------------------------------------------

export function closeAnalysisSheet() {

    const overlay = document.getElementById(
        "analysis-sheet-overlay"
    );

    if (!overlay || overlay.hidden) return;

    overlay.hidden = true;

    document.body.style.overflow = "";

    currentAnalysis = null;

}


// --------------------------------------------------
// ACCÈS AUX DONNÉES
// --------------------------------------------------

export function getCurrentAnalysis() {

    return currentAnalysis;

}
