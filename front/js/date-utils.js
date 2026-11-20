
const PARIS_TIMEZONE = "Europe/Paris";

const parisFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: PARIS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
});

// Convertit une date locale française en instant UTC.
export function parseDate(value) {

    if (!value) return null;

    const input = String(value).replace(" ", "T");

    // Date déjà accompagnée d'un fuseau :
    // on conserve son instant.
    if (/([zZ]|[+-]\d{2}:\d{2})$/.test(input)) {
        const date = new Date(input);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const match = input.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/
    );

    if (!match) return null;

    const [, y, mo, d, h, mi, s = "0", fraction = ""] = match;

    const parts = {
        year: Number(y),
        month: Number(mo),
        day: Number(d),
        hour: Number(h),
        minute: Number(mi),
        second: Number(s),
        millisecond: Number((fraction + "000").slice(0, 3))
    };

    const target = Date.UTC(
        parts.year, parts.month - 1, parts.day,
        parts.hour, parts.minute, parts.second,
        parts.millisecond
    );

    // Recherche de l'offset applicable à Paris.
    let candidate = target;

    for (let i = 0; i < 4; i++) {

        const formatted = Object.fromEntries(
            parisFormatter.formatToParts(new Date(candidate))
                .filter(p => p.type !== "literal")
                .map(p => [p.type, Number(p.value)])
        );

        const represented = Date.UTC(
            formatted.year,
            formatted.month - 1,
            formatted.day,
            formatted.hour,
            formatted.minute,
            formatted.second,
            parts.millisecond
        );

        const offset = represented - candidate;

        const next = target - offset;

        if (next === candidate) break;

        candidate = next;
    }

    const result = new Date(candidate);

    // Vérification : rejette notamment les heures inexistantes
    // lors du passage à l'heure d'été.
    const check = Object.fromEntries(
        parisFormatter.formatToParts(result)
            .filter(p => p.type !== "literal")
            .map(p => [p.type, Number(p.value)])
    );

    if (
        check.year !== parts.year ||
        check.month !== parts.month ||
        check.day !== parts.day ||
        check.hour !== parts.hour ||
        check.minute !== parts.minute ||
        check.second !== parts.second
    ) {
        return null;
    }

    return result;
}

export function formatDate(value) {

    const date = value instanceof Date
        ? value
        : parseDate(value);

    if (!date) return "";

    return new Intl.DateTimeFormat("fr-FR", {
        timeZone: PARIS_TIMEZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}
