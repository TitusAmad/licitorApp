
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

    // Sous-titre
    const subtitle = document.getElementById(
        "analysis-sheet-subtitle"
    );

    subtitle.textContent = [
        announcement.ville || "Ville non renseignée",
        `${analysis.metadata.radiusKm} km de rayon`,
        `${analysis.metadata.totalTransactions} transactions`
    ].join(" · ");

    const address = document.getElementById(
        "analysis-sheet-address"
    );

    address.textContent = announcement.adresse || "Adresse non renseignée";

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
