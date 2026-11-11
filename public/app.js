// Page 100 client script (server-and-viewer 12): adds keys, keypad, fragment swaps, rotation and
// the text view to the server-rendered page. Imports nothing, stores nothing, same origin only.

const ROTATE_MS = 12000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * @typedef {{ target: number, label: string }} QuickLink
 * @typedef {"push" | "replace" | "pop" | "rotate"} How
 */

const state = {
  page: 100,
  title: "",
  s: 1,
  m: 1,
  prev: 100,
  next: 100,
  /** @type {QuickLink[]} */
  links: [],
  digits: "",
  hold: false,
  textView: false,
  /** Row 0 cols 0 to 3 and row 1 cols 35 to 39 as the server wrote them. */
  pn: "",
  si: "",
  rotateTimer: 0,
  seq: 0,
};

/** @param {string} id */
function byId(id) {
  return document.getElementById(id);
}

/** @param {number} n */
function two(n) {
  return String(n).padStart(2, "0");
}

/** `Ddd DD Mon HH:MM:SS` in the viewer's local time, the format of `formatHeaderClock`. */
function localClock(/** @type {Date} */ d) {
  return (
    `${WEEKDAYS[d.getDay()] ?? "???"} ${two(d.getDate())} ${MONTHS[d.getMonth()] ?? "???"} ` +
    `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
  );
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 */
function int(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

/** @param {number} n @param {number} s */
function urlFor(n, s) {
  return s > 1 ? `/${String(n)}?s=${String(s)}` : `/${String(n)}`;
}

/** Reads the data attributes of the current `#view`; false when there is none. */
function readView() {
  const view = byId("view");
  if (!view) return false;
  const d = view.dataset;
  state.page = int(d["page"], state.page);
  state.title = d["title"] ?? "";
  state.s = int(d["s"], 1);
  state.m = int(d["m"], 1);
  state.prev = int(d["prev"], 100);
  state.next = int(d["next"], 100);
  state.links = (d["links"] ?? "")
    .split("|")
    .map((item) => {
      const space = item.indexOf(" ");
      return { target: int(item.slice(0, space), 100), label: item.slice(space + 1) };
    })
    .filter((link) => link.label !== "");
  state.pn = view.querySelector(".pn")?.textContent ?? "";
  state.si = view.querySelector(".si")?.textContent ?? "";
  return true;
}

/**
 * Sets the text of the one matching run; a row split into several runs is left alone.
 * @param {string} selector
 * @param {string} text
 */
function setText(selector, text) {
  const found = document.querySelectorAll(`#view ${selector}`);
  const only = found.length === 1 ? found[0] : undefined;
  if (only && only.textContent !== text) only.textContent = text;
}

/** Typed digits, Hold and the local clock: what the script owns in rows 0 and 1. */
function paintHeader() {
  setText(".pn", state.digits === "" ? state.pn : `P${state.digits.padEnd(3, "-")}`);
  setText(".si", state.hold ? " HOLD" : state.si);
  setText(".ck", localClock(new Date()));
}

/**
 * @param {Element | null} a
 * @param {string | null} href
 */
function setHref(a, href) {
  if (!a) return;
  if (href === null) {
    a.removeAttribute("href");
    a.setAttribute("aria-disabled", "true");
  } else {
    a.setAttribute("href", href);
    a.removeAttribute("aria-disabled");
  }
}

/** Points the navigation at the page now in the view. */
function updateNav() {
  state.links.forEach((link, k) => {
    const a = byId(`q${String(k + 1)}`);
    if (!a) return;
    a.setAttribute("href", `/${String(link.target)}`);
    const label = a.lastChild;
    if (label && label.nodeType === Node.TEXT_NODE) label.textContent = link.label;
  });
  setHref(byId("prev"), `/${String(state.prev)}`);
  setHref(byId("next"), `/${String(state.next)}`);
  const many = state.m > 1;
  setHref(byId("sup"), many ? urlFor(state.page, state.s === 1 ? state.m : state.s - 1) : null);
  setHref(byId("sdown"), many ? urlFor(state.page, state.s === state.m ? 1 : state.s + 1) : null);
  const text = `/${String(state.page)}.txt`;
  setHref(byId("txt"), state.s > 1 ? `${text}?s=${String(state.s)}` : text);
}

/** Keeps aria-pressed of Hold, Reveal and Text in step. */
function syncButtons() {
  const reveal = byId("reveal");
  const revealed = reveal instanceof HTMLInputElement && reveal.checked;
  document.querySelector('[data-key="h"]')?.setAttribute("aria-pressed", String(state.hold));
  document.querySelector('[data-key="r"]')?.setAttribute("aria-pressed", String(revealed));
  byId("tv")?.setAttribute("aria-pressed", String(state.textView));
}

function announce() {
  const live = byId("live");
  if (!live) return;
  const part = state.m > 1 ? `, subpage ${String(state.s)} of ${String(state.m)}` : "";
  live.textContent = `Page ${String(state.page)}, ${state.title}${part}`;
}

/**
 * Fetches a page fragment and swaps it in. Never moves focus.
 * @param {number} n
 * @param {number} s
 * @param {How} how
 */
async function load(n, s, how) {
  state.seq += 1;
  const seq = state.seq;
  let html = "";
  try {
    const response = await fetch(`/${String(n)}.frag${s > 1 ? `?s=${String(s)}` : ""}`, {
      headers: { Accept: "text/html" },
    });
    if (response.status !== 200 && response.status !== 404) throw new Error("status");
    html = await response.text();
  } catch {
    if (seq === state.seq) location.assign(urlFor(n, s));
    return;
  }
  if (seq !== state.seq) return;
  const next = new DOMParser().parseFromString(html, "text/html").getElementById("view");
  const current = byId("view");
  if (!next || !current) {
    location.assign(urlFor(n, s));
    return;
  }
  const before = state.page;
  current.replaceWith(document.importNode(next, true));
  readView();
  state.digits = "";
  if (state.page !== before) {
    state.hold = false;
    const reveal = byId("reveal");
    if (reveal instanceof HTMLInputElement) reveal.checked = false;
  }
  document.title = `${String(state.page)} ${state.title} - Page 100`;
  const url = urlFor(n, s);
  const here = location.pathname + location.search;
  const mark = { page: n, s: state.s };
  if (how === "push" && url !== here) history.pushState(mark, "", url);
  else if (how === "push" || how === "replace" || how === "rotate")
    history.replaceState(mark, "", url);
  updateNav();
  paintHeader();
  syncButtons();
  if (how === "push" || how === "replace") announce();
  scheduleRotate();
}

/** The subpage after `s` going `step` forward or back, wrapping. */
function subpage(/** @type {number} */ step) {
  return ((state.s - 1 + step + state.m) % state.m) + 1;
}

function scheduleRotate() {
  clearTimeout(state.rotateTimer);
  state.rotateTimer = window.setTimeout(rotate, ROTATE_MS);
}

function rotate() {
  const view = byId("view");
  const active = document.activeElement;
  const ok =
    state.m > 1 &&
    !state.hold &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    document.visibilityState === "visible" &&
    !state.textView &&
    !(view && active && view.contains(active));
  if (ok) void load(state.page, subpage(1), "rotate");
  else scheduleRotate();
}

function toggleReveal() {
  const reveal = byId("reveal");
  if (reveal instanceof HTMLInputElement) reveal.checked = !reveal.checked;
  syncButtons();
}

function toggleText() {
  state.textView = !state.textView;
  document.querySelector("main")?.classList.toggle("text", state.textView);
  syncButtons();
}

function toggleHold() {
  state.hold = !state.hold;
  paintHeader();
  syncButtons();
  if (!state.hold) scheduleRotate();
}

/** @param {string} digit */
function typeDigit(digit) {
  state.digits += digit;
  paintHeader();
  if (state.digits.length === 3) void load(Number(state.digits), 1, "push");
}

/**
 * Acts on a key from the keyboard or keypad; false when it does nothing.
 * @param {string} key
 */
function press(key) {
  if (/^[0-9]$/.test(key)) {
    typeDigit(key);
    return true;
  }
  const lower = key.length === 1 ? key.toLowerCase() : key;
  const quick = "zxcv".indexOf(lower);
  switch (lower) {
    case "Backspace":
      state.digits = state.digits.slice(0, -1);
      paintHeader();
      return true;
    case "Escape":
      state.digits = "";
      paintHeader();
      return true;
    case "ArrowLeft":
      void load(state.prev, 1, "push");
      return true;
    case "ArrowRight":
      void load(state.next, 1, "push");
      return true;
    case "ArrowUp":
    case "ArrowDown":
      if (state.m < 2) return false;
      void load(state.page, subpage(lower === "ArrowUp" ? -1 : 1), "replace");
      return true;
    case "h":
      toggleHold();
      return true;
    case "r":
      toggleReveal();
      return true;
    case "t":
      toggleText();
      return true;
    case "i":
      void load(100, 1, "push");
      return true;
    default: {
      const link = quick >= 0 && lower.length === 1 ? state.links[quick] : undefined;
      if (!link) return false;
      void load(link.target, 1, "push");
      return true;
    }
  }
}

/** @param {KeyboardEvent} event */
function onKey(event) {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
  const t = event.target;
  if (t instanceof HTMLElement && t.closest("input, textarea, select, [contenteditable]")) return;
  if (press(event.key)) event.preventDefault();
}

/** @param {MouseEvent} event */
function onClick(event) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  const t = event.target instanceof Element ? event.target : null;
  if (!t) return;
  const key = t.closest("[data-key]");
  if (key instanceof HTMLElement && key.dataset["key"]) {
    press(key.dataset["key"]);
    return;
  }
  if (t.closest("#tv")) {
    toggleText();
    return;
  }
  const a = t.closest(".nav a[href], .foot a[href]");
  if (!(a instanceof HTMLAnchorElement) || a.origin !== location.origin) return;
  const match = /^\/([0-9]{3})$/.exec(a.pathname);
  if (!match) return;
  const n = Number(match[1]);
  const s = int(new URLSearchParams(a.search).get("s") ?? "1", 1);
  event.preventDefault();
  void load(n, s, n === state.page ? "replace" : "push");
}

/** @param {SubmitEvent} event */
function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.classList.contains("go")) return;
  const input = form.elements.namedItem("p");
  if (!(input instanceof HTMLInputElement) || !/^[0-9]{3}$/.test(input.value)) return;
  event.preventDefault();
  const n = Number(input.value);
  input.value = "";
  void load(n, 1, "push");
}

/** @param {PopStateEvent} event */
function onPop(event) {
  const saved = /** @type {{ page?: unknown, s?: unknown } | null} */ (event.state);
  const match = /^\/([0-9]{3})?$/.exec(location.pathname);
  const n = typeof saved?.page === "number" ? saved.page : match ? int(match[1], 100) : null;
  const s =
    typeof saved?.s === "number"
      ? saved.s
      : int(new URLSearchParams(location.search).get("s") ?? "1", 1);
  if (n === null) location.reload();
  else void load(n, s, "pop");
}

/** Repaints the clock each whole second. */
function tick() {
  paintHeader();
  window.setTimeout(tick, 1000 - (Date.now() % 1000));
}

function start() {
  document.documentElement.classList.add("js");
  byId("keypad")?.removeAttribute("hidden");
  document.querySelectorAll(".js-only").forEach((el) => {
    el.removeAttribute("hidden");
  });
  readView();
  history.replaceState({ page: state.page, s: state.s }, "");
  syncButtons();
  document.addEventListener("keydown", onKey);
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  byId("reveal")?.addEventListener("change", syncButtons);
  window.addEventListener("popstate", onPop);
  scheduleRotate();
  tick();
}

start();
