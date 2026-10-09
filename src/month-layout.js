// Works out where the month items of the open goal card sit, between the top limit (below the
// number) and the bottom limit (above the back button). It only does sums.
//
// heights: the closed height of each month. gap: the space between months.
// open: the index of the open month, or null. openFull: how tall the open month would be with
// all its movements. room: the space between the two limits. current: how far the column is
// moved up now (with no month open the column stays there, as far as it can).
//
// Returns:
// - heights: each month's height. The open month is as tall as it needs, but never taller than
//   the room (its list of movements then scrolls).
// - shift: how far the whole column of months moves up. Months below the open one go out at the
//   bottom first; only when the open month still does not fit do the months above go out at
//   the top, just enough to show the whole open month. With no month open, the column stays
//   where it is, but never past its start or its end.
export function monthLayout({ heights, gap, open, openFull, room, current = 0 }) {
  const sizes = heights.map((height, index) =>
    index === open ? Math.min(openFull, room) : height,
  );
  const tops = [];
  let top = 0;
  for (const size of sizes) {
    tops.push(top);
    top += size + gap;
  }

  const total = top - gap;
  const shift =
    open === null
      ? Math.min(Math.max(current, 0), Math.max(0, total - room))
      : Math.max(0, tops[open] + sizes[open] - room);

  return { heights: sizes, shift };
}
