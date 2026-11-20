
import {
    renderPropertySection
} from "./sections/property-section.js";

import {
    renderMarketSection
} from "./sections/market-section.js";

import {
    renderEvolutionSection
} from "./sections/evolution-section.js";

import {
    renderTransactionsSection
} from "./sections/transactions-section.js";

import {
    renderMapSection,
} from "./sections/map-section.js";

import {
    renderDistributionSection
} from "./sections/distribution-section.js";

import {
    renderPositionSection
} from "./sections/position-section.js";


/**
 * Générateur principal de la fiche d'analyse.
 */

export function generateAnalysisSheet({
    announcement,
    nearbyAnalysis
}) {

    renderPropertySection(announcement);

    renderMarketSection(
        nearbyAnalysis.metadata,
        nearbyAnalysis.statistics
    );

    renderEvolutionSection(
        nearbyAnalysis.monthlyEvolution
    );

    renderTransactionsSection(
        nearbyAnalysis.latestTransactions
    );

    renderMapSection(
        announcement,
        nearbyAnalysis.radiusTransactions
    );

    renderDistributionSection(
        announcement,
        nearbyAnalysis.marketTransactions
    );

    renderPositionSection(
        announcement,
        nearbyAnalysis.statistics.all
    );

}
