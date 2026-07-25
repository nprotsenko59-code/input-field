import "./style.css";
import { HeatFieldBackground } from "./shader-background";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <div class="scene">
    <canvas class="heat-field" aria-hidden="true"></canvas>
    <div class="soft-grain" aria-hidden="true"></div>

    <main class="composer">
      <div class="composer__bar">
        <span>Input layer</span>
        <span class="composer__status">
          <span class="composer__status-dot"></span>
          Live field
        </span>
      </div>

      <label class="composer__label" for="prompt">
        What should happen next?
      </label>

      <textarea
        id="prompt"
        class="composer__input"
        rows="3"
        spellcheck="false"
        placeholder="Describe what should happen next…"
      ></textarea>

      <div class="composer__footer">
        <span>Slow heat-field shader</span>
        <button class="composer__button" type="button">Run process</button>
      </div>
    </main>

    <p class="scene__note">
      WebGL2 · reduced-motion aware · CSS fallback
    </p>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>(".heat-field");

if (!canvas) {
  throw new Error("Shader canvas was not found.");
}

const heatField = new HeatFieldBackground(canvas, {
  speed: 0.82,
  warpStrength: 0.34,
  pixelRatioCap: 1.75,
});

heatField.start();

window.addEventListener(
  "pagehide",
  () => {
    heatField.destroy();
  },
  { once: true },
);
