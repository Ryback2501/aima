// The movement sources, from the SOURCES table of the App sheet (issue #124). Its columns:
// Source, Icon, Paired with.
//
// - Icon: the icon of the source's movements in the goal card. Empty: no icon.
// - The order of the rows is the order of the sources inside a day, from top to bottom, when a
//   movement is saved or changed. A source that is not in the table goes last.
// - Paired with: the source of the movement that goes right below a movement of this source,
//   when both have the same amount on the same day (for example Provisioned below Cash).
//
// Names are matched exactly, with the same capital letters; spaces around them do not matter.

// The icons a source may use (from icons.js), written exactly like this.
export const SOURCE_ICONS = ['bank', 'card', 'cash'];

const TABLE = 'SOURCES';

// A cell as a text, without the spaces around it ('' when it is empty).
const textOf = (cell) => (cell === undefined || cell === null ? '' : String(cell).trim());

// Reads the table (see app-sheet.js). Returns { value, mistakes }. value has the settings the
// goal and the save use (see goal.js and movements.js):
// - sources: the icon of each source that has one;
// - sourceOrder: the sources, from top to bottom;
// - sourcePairs: for each source with a "Paired with", the source that goes right below it.
export function readSources(table) {
  const items = table.rows.map(({ row, cells }) => {
    const [source, icon, partner] = [0, 1, 2].map((index) => textOf(cells[index]));
    return { row, source, icon, partner };
  });
  // The first row of each source, and the source each one names in "Paired with".
  const rowOf = new Map();
  const partnerOf = new Map();
  // For each source named in "Paired with": the source it goes below (the first row naming it).
  const below = new Map();
  for (const { row, source, partner } of items) {
    if (!rowOf.has(source)) rowOf.set(source, row);
    if (partner && !partnerOf.has(source)) partnerOf.set(source, partner);
    if (partner && !below.has(partner)) below.set(partner, source);
  }

  const icons = [];
  const order = [];
  const pairs = [];
  const mistakes = [];
  const seen = new Set();
  const named = new Set();
  for (const { row, source, icon, partner } of items) {
    const before = mistakes.length;
    const mistake = (kind, details) => mistakes.push({ kind, table: TABLE, row, ...details });
    if (icon && !SOURCE_ICONS.includes(icon)) mistake('badSourceIcon', { icon });
    if (seen.has(source)) mistake('sourceTwice', { source });
    seen.add(source);
    if (partner) {
      if (partner === source) mistake('pairedWithItself', { source });
      else if (!rowOf.has(partner)) mistake('unknownPartner', { partner });
      else if (named.has(partner)) mistake('partnerTwice', { partner });
      else if (partnerOf.get(partner) === source) {
        // Two sources paired with each other: one line, on the lower of the two rows.
        if (rowOf.get(partner) < row) mistake('pairedBothWays', { first: partner, second: source });
      } else if (below.has(source)) {
        // This source goes below another one, so it cannot have a source below it too.
        mistake('pairedChain', { source, above: below.get(source) });
      }
      named.add(partner);
    }
    if (mistakes.length > before) continue;
    if (icon) icons.push([source, icon]);
    order.push(source);
    if (partner) pairs.push([source, partner]);
  }
  // Built from lists, so that any name, even an odd one, is kept as it is written.
  return {
    value: {
      sources: Object.fromEntries(icons),
      sourceOrder: order,
      sourcePairs: Object.fromEntries(pairs),
    },
    mistakes,
  };
}
