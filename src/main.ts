import "./style.css";
import { HeatFieldBackground } from "./shader-background";

interface Currency {
  code: string;
  flag: string;
  name: string;
  unitsPerUsd: number;
  fractionDigits: number;
}

const currencies: Currency[] = [
  {
    code: "USD",
    flag: "🇺🇸",
    name: "US Dollar",
    unitsPerUsd: 1,
    fractionDigits: 2,
  },
  {
    code: "EUR",
    flag: "🇪🇺",
    name: "Euro",
    unitsPerUsd: 0.92,
    fractionDigits: 2,
  },
  {
    code: "GBP",
    flag: "🇬🇧",
    name: "British Pound",
    unitsPerUsd: 0.79,
    fractionDigits: 2,
  },
  {
    code: "NOK",
    flag: "🇳🇴",
    name: "Norwegian Krone",
    unitsPerUsd: 10.93,
    fractionDigits: 2,
  },
  {
    code: "ILS",
    flag: "🇮🇱",
    name: "Israeli New Shekel",
    unitsPerUsd: 3.62,
    fractionDigits: 2,
  },
  {
    code: "JPY",
    flag: "🇯🇵",
    name: "Japanese Yen",
    unitsPerUsd: 157.3,
    fractionDigits: 0,
  },
  {
    code: "CAD",
    flag: "🇨🇦",
    name: "Canadian Dollar",
    unitsPerUsd: 1.37,
    fractionDigits: 2,
  },
  {
    code: "AUD",
    flag: "🇦🇺",
    name: "Australian Dollar",
    unitsPerUsd: 1.53,
    fractionDigits: 2,
  },
];

function currencyOptions(selectedCode: string): string {
  return currencies
    .map(
      ({ code, flag }) =>
        `<option value="${code}" ${
          code === selectedCode ? "selected" : ""
        }>${flag} ${code}</option>`,
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

    <main class="converter" aria-label="Currency converter">
      <div class="converter__sections">
        <section class="converter__section">
          <label class="converter__label" for="amount">Convert</label>
          <div class="converter__value-row">
            <input
              id="amount"
              class="converter__amount"
              type="text"
              inputmode="decimal"
              value="1000"
              autocomplete="off"
              spellcheck="false"
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
          <label class="converter__label" for="converted-amount">To</label>
          <div class="converter__value-row">
            <input
              id="converted-amount"
              class="converter__amount"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              spellcheck="false"
              aria-describedby="to-currency-name conversion-rate"
            />
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
  requireElement<HTMLInputElement>("#converted-amount");
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

const numberSeparators = new Intl.NumberFormat()
  .formatToParts(12345.6)
  .reduce(
    (separators, part) => {
      if (part.type === "group") {
        separators.group = part.value;
      }

      if (part.type === "decimal") {
        separators.decimal = part.value;
      }

      return separators;
    },
    { group: "", decimal: "." },
  );

function parseAmount(value: string): number {
  let normalized = value.trim().replace(/\s/g, "");

  if (numberSeparators.group) {
    normalized = normalized
      .split(numberSeparators.group)
      .join("");
  }

  if (numberSeparators.decimal !== ".") {
    normalized = normalized.replace(numberSeparators.decimal, ".");
  }

  return normalized === "" ? Number.NaN : Number(normalized);
}

type ConversionDirection = "from" | "to";

let conversionDirection: ConversionDirection = "from";

function updateConversion(
  direction: ConversionDirection = conversionDirection,
): void {
  const fromCurrency = getCurrency(fromSelect.value);
  const toCurrency = getCurrency(toSelect.value);
  const rate = toCurrency.unitsPerUsd / fromCurrency.unitsPerUsd;
  const sourceInput =
    direction === "from" ? amountInput : convertedAmount;
  const targetInput =
    direction === "from" ? convertedAmount : amountInput;
  const sourceAmount = parseAmount(sourceInput.value);
  const convertedValue =
    direction === "from"
      ? sourceAmount * rate
      : sourceAmount / rate;
  const targetCurrency =
    direction === "from" ? toCurrency : fromCurrency;

  fromCurrencyName.textContent = fromCurrency.name;
  toCurrencyName.textContent = toCurrency.name;
  conversionRate.textContent = `1 ${fromCurrency.code} = ${new Intl.NumberFormat(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    },
  ).format(rate)} ${toCurrency.code}`;

  targetInput.value =
    Number.isFinite(sourceAmount) && sourceAmount >= 0
      ? formatAmount(convertedValue, targetCurrency)
      : "";
}

amountInput.addEventListener("input", () => {
  conversionDirection = "from";
  updateConversion();
});
convertedAmount.addEventListener("input", () => {
  conversionDirection = "to";
  updateConversion();
});
fromSelect.addEventListener("change", () => updateConversion());
toSelect.addEventListener("change", () => updateConversion());
updateConversion();

const heatField = new HeatFieldBackground(canvas, {
  speed: 1.6,
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
