// The busy layer of the movement form and of the delete question (issue #108). While a
// movement is saved or deleted, the content of the panel fades out (its card stays) and a
// spinner fades in, in the middle of the card. When it is done, a green thumbs-up takes its
// place for a moment; when it failed, a red warning, and then the content comes back.
// The look of the layer is in styles.css (.busy).

// The spinner: 16 grey dots on a ring 48px wide. The dots never move, they only fade: two
// neighbouring dots are visible, and every step the first one fades out while the dot after
// the second one fades in. So the pair goes around the ring clockwise, once every 1.6 seconds.
export const SPINNER = { dots: 16, size: 48, dotSize: 6, step: 100, color: '#6b7280' };

// The spinner shows for at least this long (ms), so it never just flashes. The thumbs-up or
// the warning stays fully visible this long. Every fade takes as long as --rise-time in
// styles.css.
export const BUSY = { minimum: 300, iconTime: 1000, fade: 250 };

// How visible each dot is (0 to 1) at a time in ms after the spinner started. Dot 1 (the first
// one) is at the top, and the others follow it clockwise.
export function dotOpacities(time) {
  const { dots, step } = SPINNER;
  const steps = Math.floor(time / step);
  const part = (time - steps * step) / step;
  const opacities = new Array(dots).fill(0);
  opacities[steps % dots] = 1 - part;
  opacities[(steps + 1) % dots] = 1;
  opacities[(steps + 2) % dots] = part;
  return opacities;
}

// Adds the busy layer to a panel. t gives the words a screen reader reads, in the app's
// language.
export function createBusy(panel, { document, window, createIcon, t }) {
  const svgName = 'http://www.w3.org/2000/svg';
  const layer = document.createElement('div');
  layer.className = 'busy';

  const { dots, size, dotSize } = SPINNER;
  const spinner = document.createElementNS(svgName, 'svg');
  spinner.classList.add('busy-spinner');
  spinner.setAttribute('width', String(size));
  spinner.setAttribute('height', String(size));
  spinner.setAttribute('viewBox', `0 0 ${size} ${size}`);
  spinner.setAttribute('aria-hidden', 'true');
  spinner.style.fill = SPINNER.color;
  const ring = size / 2 - dotSize / 2;
  const circles = [];
  for (let index = 0; index < dots; index += 1) {
    const angle = (index * 2 * Math.PI) / dots;
    const circle = document.createElementNS(svgName, 'circle');
    circle.setAttribute('cx', String(size / 2 + ring * Math.sin(angle)));
    circle.setAttribute('cy', String(size / 2 - ring * Math.cos(angle)));
    circle.setAttribute('r', String(dotSize / 2));
    circle.style.opacity = '0';
    spinner.append(circle);
    circles.push(circle);
  }

  const done = createIcon('thumbsUp', size);
  done.classList.add('busy-done');
  done.setAttribute('aria-hidden', 'true');
  const failed = createIcon('warning', size);
  failed.classList.add('busy-failed');
  failed.setAttribute('aria-hidden', 'true');

  // A screen reader reads this text each time it changes.
  const text = document.createElement('span');
  text.className = 'busy-text';
  text.setAttribute('role', 'status');

  layer.append(spinner, done, failed, text);
  panel.append(layer);

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  let texts = null;
  let started = 0;
  let frame = null;

  // At every frame, each dot gets its opacity for the time gone by. Before the spinner starts
  // (while the content fades out) it stays at its first step.
  function spin() {
    const opacities = dotOpacities(Math.max(0, window.performance.now() - started));
    circles.forEach((circle, index) => (circle.style.opacity = String(opacities[index])));
    frame = window.requestAnimationFrame(spin);
  }

  function stopSpinning() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
  }

  // Back to the start: the content shows and the layer is empty, without fading.
  function reset() {
    stopSpinning();
    panel.classList.remove('working');
    delete layer.dataset.show;
    text.textContent = '';
  }

  // The content fades out, then the spinner fades in (styles.css waits for the content).
  // words: the keys of i18n.js for each moment, { working, done, failed }.
  function start(words) {
    texts = words;
    panel.classList.add('working');
    started = window.performance.now() + BUSY.fade;
    layer.dataset.show = 'spinner';
    text.textContent = t(texts.working);
    stopSpinning();
    spin();
  }

  // The spinner (after at least BUSY.minimum) makes way for the thumbs-up (ok) or the
  // warning, which stays BUSY.iconTime and fades out. After the warning the content fades back
  // in. After the thumbs-up it stays hidden: the panel closes.
  async function end(ok) {
    const shown = window.performance.now() - started;
    if (shown < BUSY.minimum) await wait(BUSY.minimum - shown);
    layer.dataset.show = ok ? 'done' : 'failed';
    text.textContent = t(ok ? texts.done : texts.failed);
    await wait(BUSY.fade);
    stopSpinning();
    await wait(BUSY.iconTime);
    delete layer.dataset.show;
    await wait(BUSY.fade);
    if (!ok) {
      panel.classList.remove('working');
      await wait(BUSY.fade);
    }
  }

  return { start, end, reset };
}
