/** The names of the currencies that pages 300 and 301 show, by code. */
export const CURRENCY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  EUR: "Euro",
  GBP: "Pound sterling",
  JPY: "Japanese yen",
  KRW: "South Korean won",
  CNY: "Chinese yuan",
  INR: "Indian rupee",
  AUD: "Australian dollar",
  CAD: "Canadian dollar",
  CHF: "Swiss franc",
  SEK: "Swedish krona",
  NOK: "Norwegian krone",
  MXN: "Mexican peso",
  BRL: "Brazilian real",
  SGD: "Singapore dollar",
  HKD: "Hong Kong dollar",
  ZAR: "South African rand",
});

/** The ten currencies of the `Other rates` block on page 300, in order (owner answer 3). */
export const OTHER_CODES: readonly string[] = Object.freeze([
  "AUD",
  "CAD",
  "CHF",
  "SEK",
  "NOK",
  "MXN",
  "BRL",
  "SGD",
  "HKD",
  "ZAR",
]);
