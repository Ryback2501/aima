// Works out where the month items of the open goal card sit, between the top limit (below the
// number) and the bottom limit (above the back button). It only does sums.
//
// heights: the closed height of each month. gap: the space between months.
// open: the index of the open month, or null. openFull: how tall the open month would be with
// all its movements. room: the space between the two limits.
//
// Returns:
// - heights: each month's height. The open month is as tall as it needs, but never taller than
//   the room (its list of movements then scrolls).
// - shift: how far the whole column of months moves up. Months below the open one go out at the
//   bottom first; only when the open month still does not fit do the months above go out at
//   the top, just enough to show the whole open month.
// - fadeTop, fadeBottom: true when a closed month is cut by that limit, so a soft fade covers it.
//   Never over the open month.
// - outTop, outBottom: true when any month goes past that limit. Only then must the room cut
//   everything exactly at the limit; otherwise the shadows of the months may show past it.
export function monthLayout({ heights, gap, open, openFull, room }) {
  const sizes = heights.map((height, index) =>
    index === open ? Math.min(openFull, room) : height,
  );
  const tops = [];
  let top = 0;
  for (const size of sizes) {
    tops.push(top);
    top += size + gap;
  }

  const shift = open === null ? 0 : Math.max(0, tops[open] + sizes[open] - room);

  // True when a closed month starts before this line and ends after it.
  const cutAt = (line) =>
    sizes.some((size, index) => index !== open && tops[index] < line && tops[index] + size > line);

  const total = top - gap;
  return {
    heights: sizes,
    shift,
    fadeTop: cutAt(shift),
    fadeBottom: cutAt(shift + room),
    outTop: shift > 0,
    outBottom: total - shift > room,
  };
}
