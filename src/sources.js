// The movement sources, from the SOURCES table of the App sheet (issue #124). Not written yet:
// the tests come first.

export const SOURCE_ICONS = [];

export function readSources() {
  return { value: { sources: {}, sourceOrder: [], sourcePairs: {} }, mistakes: [] };
}
