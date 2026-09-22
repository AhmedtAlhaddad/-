export const SEARCH_ANALYTICS_MIN_LENGTH = 2;
export const SEARCH_ANALYTICS_MAX_LENGTH = 100;

export function normalizeAnalyticsTerm(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
}

export function isTrackableSearchTerm(value: string) {
  const normalized = normalizeAnalyticsTerm(value);

  return (
    normalized.length >= SEARCH_ANALYTICS_MIN_LENGTH &&
    normalized.length <= SEARCH_ANALYTICS_MAX_LENGTH &&
    /\p{L}/u.test(normalized) &&
    !/\d{6,}/.test(normalized) &&
    !normalized.includes("@") &&
    !/(?:https?:\/\/|www\.)/i.test(normalized)
  );
}
