// Stops people from zooming the app with two fingers, so it feels like a phone app.
// The page settings (the "viewport" in index.html) already ask for this, but Safari on
// iPhone ignores them, so we also stop the zoom gestures here.
// styles.css also stops pinch and double-tap zoom on every element (touch-action).

export function blockZoom(target) {
  const stop = (event) => event.preventDefault();
  // passive: false lets us stop the touch. Without it, the browser ignores preventDefault.
  const options = { passive: false };

  // Safari's own pinch events.
  target.addEventListener('gesturestart', stop, options);
  target.addEventListener('gesturechange', stop, options);
  target.addEventListener('gestureend', stop, options);

  // Two fingers are a pinch. One finger is a tap or a scroll, so we let it happen.
  const stopPinch = (event) => {
    if (event.touches.length > 1) event.preventDefault();
  };
  // A second finger touching down: this can always be stopped, even while the first finger
  // scrolls.
  target.addEventListener('touchstart', stopPinch, options);
  // Two fingers moving. Once the page scrolls, the browser no longer lets us stop this one.
  target.addEventListener('touchmove', stopPinch, options);
}
