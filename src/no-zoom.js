// Stops people from zooming the app with two fingers, so it feels like a phone app.
// The page settings (the "viewport" in index.html) already ask for this, but Safari on
// iPhone ignores them, so we also stop the zoom gestures here.
// Double-tap zoom is stopped in styles.css (touch-action: manipulation).

export function blockZoom(target) {
  const stop = (event) => event.preventDefault();
  // passive: false lets us stop the touch. Without it, the browser ignores preventDefault.
  const options = { passive: false };

  // Safari's own pinch events.
  target.addEventListener('gesturestart', stop, options);
  target.addEventListener('gesturechange', stop, options);
  target.addEventListener('gestureend', stop, options);

  // Two fingers moving is a pinch. One finger moving is a scroll, so we let it happen.
  target.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    options,
  );
}
