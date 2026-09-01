/**
 * Extracts variable placeholders from an objective description.
 *
 * A placeholder looks like `{name}` — e.g. "I want to do {pushups} pushups"
 * has one placeholder: "pushups".
 *
 * Rules:
 * - Names may contain letters, numbers, and underscores only.
 * - Duplicate placeholders (same name used twice) are returned once.
 * - Empty braces `{}` and malformed braces (e.g. unclosed `{pushups`) are ignored.
 * - Order returned matches first appearance in the description.
 */
export function parseCounterLabels(description: string): string[] {
  const PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

  const seen = new Set<string>();
  const labels: string[] = [];

  for (const match of description.matchAll(PLACEHOLDER_PATTERN)) {
    const label = match[1];
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }

  return labels;
}