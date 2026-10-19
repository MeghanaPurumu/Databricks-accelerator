/**
 * Helper to consistently format similarity / match score values as standardized percentages.
 * Correctly converts values between 0.0 and 1.0 (e.g. 0.985 -> "98.5%") or values already 0-100 (98.5 -> "98.5%").
 */
export function formatSimilarityScore(score?: number | null): string {
  if (score === undefined || score === null || isNaN(score)) return '0.0%';
  let val = score;
  if (val > 0 && val <= 1.0) {
    val = val * 100;
  }
  return `${val.toFixed(1)}%`;
}
