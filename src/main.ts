import "./style.css";
import { HeatFieldBackground } from "./shader-background";

interface Currency {
  code: string;
  name: string;
  unitsPerUsd: number;
  fractionDigits: number;
}

const currencies: Currency[] = [
  {
    code: "USD",
    name: "US Dollar",
    unitsPerUsd: 1,
    fractionDigits: 2,
  },
  {
    code: "EUR",
    name: "Euro",
    unitsPerUsd: 0.92,
    fractionDigits: 2,
  },
  {
    code: "GBP",
    name: "British Pound",
    unitsPerUsd: 0.79,
    fractionDigits: 2,
  },
  {
    code: "NOK",
    name: "Norwegian Krone",
    unitsPerUsd: 10.93,
    fractionDigits: 2,
  },
  {
    code: "ILS",
    name: "Israeli New Shekel",
    unitsPerUsd: 3.62,
    fractionDigits: 2,
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    unitsPerUsd: 157.3,
    fractionDigits: 0,
  },
  {
    code: "CAD",
    name: "Canadian Dollar",
    unitsPerUsd: 1.37,
    fractionDigits: 2,
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    unitsPerUsd: 1.53,
    fractionDigits: 2,
  },
];

function currencyOptions(selectedCode: string): string {
  return currencies
    .map(
      ({ code }) =>
        `<option value="${code}" ${
          code === selectedCode ? "selected" : ""
        }>${code}</option>`,
    )
    .join("");
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required element was not found: ${selector}`);
  }

  return element;
}

const app = requireElement<HTMLDivElement>("#app");

app.innerHTML = `
  <div class="scene">
    <canvas class="heat-field" aria-hidden="true"></canvas>

    <main class="converter" aria-labelledby="converter-title">
      <div class="converter__bar">
        <span id="converter-title">Currency converter</span>
        <span class="converter__status">
          <span class="converter__status-dot"></span>
          Live calculation
        </span>
      </div>

      <div class="converter__sections">
        <section class="converter__section">
          <label class="converter__label" for="amount">Convert from</label>
          <div class="converter__value-row">
            <input
              id="amount"
              class="converter__amount"
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              value="1000"
              aria-describedby="from-currency-name"
            />
            <div class="converter__select-wrap">
              <select
                id="from-currency"
                class="converter__select"
                aria-label="Convert from currency"
              >
                ${currencyOptions("USD")}
              </select>
            </div>
          </div>
          <p class="converter__meta" id="from-currency-name">US Dollar</p>
        </section>

        <section class="converter__section">
          <p class="converter__label">Convert to</p>
          <div class="converter__value-row">
            <output
              id="converted-amount"
              class="converter__output"
              for="amount from-currency to-currency"
              aria-live="polite"
              aria-atomic="true"
            ></output>
            <div class="converter__select-wrap">
              <select
                id="to-currency"
                class="converter__select"
                aria-label="Convert to currency"
              >
                ${currencyOptions("NOK")}
              </select>
            </div>
          </div>
          <div class="converter__meta converter__meta--split">
            <span id="to-currency-name">Norwegian Krone</span>
            <span id="conversion-rate"></span>
          </div>
        </section>
      </div>
    </main>

    <p class="scene__note">
      Instant conversion · Demo rates
    </p>
  </div>
`;

const canvas = requireElement<HTMLCanvasElement>(".heat-field");
const amountInput = requireElement<HTMLInputElement>("#amount");
const fromSelect =
  requireElement<HTMLSelectElement>("#from-currency");
const toSelect = requireElement<HTMLSelectElement>("#to-currency");
const convertedAmount =
  requireElement<HTMLOutputElement>("#converted-amount");
const fromCurrencyName =
  requireElement<HTMLElement>("#from-currency-name");
const toCurrencyName =
  requireElement<HTMLElement>("#to-currency-name");
const conversionRate =
  requireElement<HTMLElement>("#conversion-rate");

function getCurrency(code: string): Currency {
  const currency = currencies.find((candidate) => candidate.code === code);

  if (!currency) {
    throw new Error(`Unsupported currency: ${code}`);
  }

  return currency;
}

function formatAmount(value: number, currency: Currency): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: currency.fractionDigits,
    maximumFractionDigits: currency.fractionDigits,
  }).format(value);
}

function updateConversion(): void {
  const fromCurrency = getCurrency(fromSelect.value);
  const toCurrency = getCurrency(toSelect.value);
  const amount = amountInput.valueAsNumber;
  const rate = toCurrency.unitsPerUsd / fromCurrency.unitsPerUsd;

  fromCurrencyName.textContent = fromCurrency.name;
  toCurrencyName.textContent = toCurrency.name;
  conversionRate.textContent = `1 ${fromCurrency.code} = ${new Intl.NumberFormat(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    },
  ).format(rate)} ${toCurrency.code}`;

  convertedAmount.textContent =
    Number.isFinite(amount) && amount >= 0
      ? formatAmount(amount * rate, toCurrency)
      : "—";
}

amountInput.addEventListener("input", updateConversion);
fromSelect.addEventListener("change", updateConversion);
toSelect.addEventListener("change", updateConversion);
updateConversion();

const heatField = new HeatFieldBackground(canvas, {
  speed: 1.3,
  warpStrength: 0.34,
  pixelRatioCap: 1,
});

heatField.start();

window.addEventListener(
  "pagehide",
  () => {
    heatField.destroy();
  },
  { once: true },
);
