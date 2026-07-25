# Animated Heat Field

A dependency-light WebGL2 background inspired by broad red, orange, and yellow
heat-map gradients. The animation uses a full-screen fragment shader with
aspect-correct metaballs, low-frequency domain warping, and subtle dithering.

## Run locally

```sh
npm install
npm run dev
```

## Reuse

The renderer lives in `src/shader-background.ts`. Instantiate it with any
full-size canvas:

```ts
const field = new HeatFieldBackground(canvas, {
  speed: 0.82,
  warpStrength: 0.34,
  pixelRatioCap: 1.75,
});

field.start();
```

Call `field.destroy()` when the containing page or component is removed.

The renderer pauses when the document is hidden, renders a static frame when
`prefers-reduced-motion` is enabled, and lets the CSS background show through
when WebGL2 is unavailable.
