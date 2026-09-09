/**
 * Friday Truth Brief — static edition loader & renderer
 * Loads edition JSON over HTTP (file:// will fail CORS/fetch). Current path: EDITION_PATH.
 */

const EDITION_PATH = "data/edition-2026-09-05.json";
const THEME_KEY = "ftb-theme";
/** Current homepage edition. Archive entries may point at other JSON files via ?edition= path. */
const ARCHIVE = [
  {
    date: "2026-09-05",
    title: "Week of September 5, 2026",
    path: "data/edition-2026-09-05.json",
    note: "Researched Labor Day week brief (Sep 1–7, 2026). Editorial prototype — verify sources.",
    isDemo: false,
  },
  {
    date: "2026-09-05",
    title: "Week of September 5, 2026 (Demo archive)",
    path: "data/edition-2026-09-05-demo.json",
    note: "Sample edition — fictional composite data for layout preview.",
    isDemo: true,
  },
];

function $(sel, root = document) {
  return root.querySelector(sel);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function formatWeekOf(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function severityClass(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "false" || s === "misleading" || s === "omission") return s;
  return "misleading";
}

function typeLabel(t) {
  return String(t || "").replace(/_/g, " ");
}

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch (_) {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {
    /* ignore */
  }
  const btn = $("#theme-toggle");
  if (btn) {
    const label = next === "dark" ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }
}

function initThemeToggle() {
  applyTheme(getPreferredTheme());
  const btn = $("#theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // If user has no stored preference, follow OS changes live
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", (e) => {
      let stored = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch (_) {
        /* ignore */
      }
      if (stored !== "light" && stored !== "dark") {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  } catch (_) {
    /* older browsers */
  }
}

async function loadEdition(path = EDITION_PATH) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  const data = await res.json();
  if (!data || !Array.isArray(data.stories)) throw new Error("Invalid edition JSON");
  return data;
}

function setWeekLabel(edition) {
  const node = $("#week-label");
  if (!node || !edition) return;
  node.textContent = `Week of ${formatWeekOf(edition.editionDate)}`;
  const demo = !!edition.isDemo;
  node.title = demo
    ? `Week of ${formatWeekOf(edition.editionDate)} · Sample edition`
    : `Week of ${formatWeekOf(edition.editionDate)}`;
}

function updateDemoBanner(edition) {
  const banner = document.querySelector(".demo-banner");
  if (!banner) return;
  if (edition && edition.isDemo === false) {
    banner.innerHTML =
      "<strong>Editorial prototype</strong> — researched brief with cited sources. Verify primary links; not a formal newsroom product.";
    banner.hidden = false;
  } else {
    banner.innerHTML =
      "<strong>Sample edition</strong> — example data for layout preview. Not a live fact-check.";
    banner.hidden = false;
  }
}

function resolveEditionPath() {
  const params = new URLSearchParams(location.search);
  const q = params.get("edition");
  if (q && ARCHIVE.some((a) => a.path === q)) return q;
  return EDITION_PATH;
}


const ADS_PATH = "data/ads.json";
const AD_ROTATE_MS = 10000; // ~10s: Baymard 5–7s short / up to 10s text-heavy; UXmatters ~10s min for auto banners

function isPlaceholderAdUrl(url) {
  const u = String(url || "").trim();
  if (!u || u === "#") return true;
  try {
    const parsed = new URL(u, location.href);
    return parsed.hostname === "example.com" || parsed.hostname.endsWith(".example.com");
  } catch (_) {
    return true;
  }
}

async function loadAds(path = ADS_PATH) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  const data = await res.json();
  if (!data || !Array.isArray(data.ads) || !data.ads.length) {
    throw new Error("Invalid ads JSON");
  }
  return data;
}

/**
 * Slim rotating sponsor bar shared by homepage + story pages.
 * @param {HTMLElement} container — typically #ad-rail
 */
async function initAdRotator(container) {
  if (!container) return null;

  let feed;
  try {
    feed = await loadAds();
  } catch (err) {
    console.warn("Ad rotator skipped:", err);
    container.hidden = true;
    return null;
  }

  const ads = feed.ads.filter((a) => a && a.name);
  if (!ads.length) {
    container.hidden = true;
    return null;
  }

  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  container.hidden = false;
  container.classList.add("ad-rail");
  if (reduced) container.classList.add("is-reduced");
  container.innerHTML = "";

  const chrome = el("div", { className: "ad-rail-chrome" }, [
    el("span", { className: "ad-rail-label", text: feed.label || "Sponsored" }),
    el("span", {
      className: "ad-rail-note",
      text: feed.placeholderNote || "Placeholder — not live ads",
    }),
  ]);

  const viewport = el("div", {
    className: "ad-rail-viewport",
    role: "group",
    "aria-roledescription": "carousel",
    "aria-label": feed.label || "Sponsored",
  });

  const slides = ads.map((ad, i) => {
    const href = ad.url && String(ad.url).trim() ? String(ad.url).trim() : "#";
    const placeholder = isPlaceholderAdUrl(href);
    const slide = el("a", {
      className: "ad-slide" + (i === 0 ? " is-active" : ""),
      href,
      "aria-hidden": i === 0 ? "false" : "true",
      tabindex: i === 0 ? "0" : "-1",
    }, [
      el("span", {
        className: "ad-accent",
        "aria-hidden": "true",
        style: ad.accent ? `background:${ad.accent}` : undefined,
      }),
      el("span", { className: "ad-copy" }, [
        el("span", { className: "ad-name", text: ad.name }),
        el("span", { className: "ad-tagline", text: ad.tagline || "" }),
      ]),
      el("span", { className: "ad-cta", text: "Learn more", "aria-hidden": "true" }),
    ]);

    if (!placeholder) {
      slide.setAttribute("target", "_blank");
      slide.setAttribute("rel", "noopener noreferrer sponsored");
    } else if (href === "#") {
      slide.addEventListener("click", (e) => e.preventDefault());
    } else {
      slide.setAttribute("target", "_blank");
      slide.setAttribute("rel", "noopener noreferrer");
    }

    // Fix: el() may not support style attr well — set directly
    if (ad.accent) {
      const accent = slide.querySelector(".ad-accent");
      if (accent) accent.style.background = ad.accent;
    }

    viewport.appendChild(slide);
    return slide;
  });

  container.append(chrome, viewport);

  if (slides.length < 2) {
    return { destroy() {} };
  }

  let index = 0;
  let timer = null;
  let paused = false;
  let animating = false;

  function setPaused(next) {
    paused = next;
    if (paused) stop();
    else start();
  }

  function show(nextIndex) {
    if (animating || nextIndex === index) return;
    animating = true;
    const prev = slides[index];
    const next = slides[nextIndex];

    prev.classList.remove("is-active");
    prev.classList.add("is-leaving");
    prev.setAttribute("aria-hidden", "true");
    prev.setAttribute("tabindex", "-1");

    next.classList.remove("is-leaving");
    // force reflow so enter-from-right applies
    void next.offsetWidth;
    next.classList.add("is-active");
    next.setAttribute("aria-hidden", "false");
    next.setAttribute("tabindex", "0");

    const done = () => {
      prev.classList.remove("is-leaving");
      animating = false;
    };

    if (reduced) {
      // crossfade / instant — no slide travel
      window.setTimeout(done, 280);
    } else {
      window.setTimeout(done, 480);
    }

    index = nextIndex;
  }

  function tick() {
    if (paused || document.hidden) return;
    show((index + 1) % slides.length);
  }

  function start() {
    stop();
    if (paused || document.hidden) return;
    timer = window.setInterval(tick, AD_ROTATE_MS);
  }

  function stop() {
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  container.addEventListener("mouseenter", () => setPaused(true));
  container.addEventListener("mouseleave", () => setPaused(false));
  container.addEventListener("focusin", () => setPaused(true));
  container.addEventListener("focusout", (e) => {
    if (!container.contains(e.relatedTarget)) setPaused(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!paused) start();
  });

  start();

  return {
    destroy() {
      stop();
    },
  };
}

function ensureAdRail({ afterSelector, beforeSelector, storyClass } = {}) {
  let rail = $("#ad-rail");
  if (!rail) {
    rail = el("aside", {
      id: "ad-rail",
      className: "ad-rail" + (storyClass ? " ad-rail--story" : ""),
      "aria-label": "Sponsored",
      hidden: "hidden",
    });
    if (beforeSelector) {
      const before = $(beforeSelector);
      if (before && before.parentNode) {
        before.parentNode.insertBefore(rail, before);
      } else {
        const main = $("#main");
        if (main) main.appendChild(rail);
      }
    } else if (afterSelector) {
      const after = $(afterSelector);
      if (after && after.parentNode) {
        after.parentNode.insertBefore(rail, after.nextSibling);
      } else {
        const main = $("#main");
        if (main) main.appendChild(rail);
      }
    } else {
      const main = $("#main");
      if (main) main.appendChild(rail);
    }
  } else if (storyClass) {
    rail.classList.add("ad-rail--story");
  }
  return rail;
}

function renderHome(edition) {
  setWeekLabel(edition);

  const method = $("#methodology-text");
  if (method) {
    method.classList.remove("loading");
    method.textContent = edition.methodology || "";
  }

  const count = $("#story-count");
  if (count) count.textContent = `${edition.stories.length} stories`;

  const list = $("#story-list");
  if (!list) return;
  list.innerHTML = "";

  const sorted = [...edition.stories].sort((a, b) => a.rank - b.rank);
  for (const story of sorted) {
    const mis = (story.misrepresentations || []).length;
    const nar = (story.narratives || []).length;
    const tags = (story.tags || []).map((t) => el("span", { className: "tag", text: t }));

    const card = el("a", {
      className: "story-card",
      href: (() => {
        const ed = resolveEditionPath();
        const base = `story.html?id=${encodeURIComponent(story.id)}`;
        return ed === EDITION_PATH ? base : `${base}&edition=${encodeURIComponent(ed)}`;
      })(),
    }, [
      el("div", { className: "story-card-top" }, [
        el("div", { className: "rank-badge", text: String(story.rank) }),
        el("div", {}, [
          el("div", { className: "story-card-title-row" }, edition.isDemo
            ? [el("span", { className: "demo-chip", text: "Demo" })]
            : []),
          el("h3", { text: story.title }),
          el("p", { className: "summary", text: story.summary }),
        ]),
      ]),
      el("div", { className: "card-meta" }, [
        ...tags,
        el("span", { className: "flag-chip", text: `${mis} misrep` }),
        el("span", { className: "flag-chip", text: `${nar} narrative` }),
      ]),
    ]);

    list.appendChild(el("li", {}, [card]));
  }
}


function buildGrokContext(edition, story) {
  const facts = (story.knownFacts || [])
    .map((f, i) => `${i + 1}. ${f.claim}${f.evidence ? " Evidence: " + f.evidence : ""}`)
    .join("\n");
  const mis = (story.misrepresentations || [])
    .map((m, i) => `${i + 1}. [${m.severity}] ${m.outlet}: "${m.claimMade}" — ${m.whyInaccurate}`)
    .join("\n");
  const nar = (story.narratives || [])
    .map((n, i) => `${i + 1}. (${n.type}) ${n.description} Example: ${n.example}`)
    .join("\n");
  return [
    "You are helping a reader dig into a Friday Truth Brief story. Be evidence-first, note uncertainty, and do not invent sources.",
    `Edition: ${edition.title || edition.editionDate} (isDemo=${!!edition.isDemo})`,
    `Rank #${story.rank}: ${story.title}`,
    `Summary: ${story.summary || ""}`,
    `Overview: ${story.overview || ""}`,
    "Known facts:",
    facts || "(none listed)",
    "Misrepresentations called out:",
    mis || "(none listed)",
    "Narratives / spin notes:",
    nar || "(none listed)",
  ].join("\n\n");
}

function grokUrlForPrompt(prompt) {
  return "https://grok.com/?q=" + encodeURIComponent(prompt);
}

function openGrokWithStory(edition, story, userQuestion) {
  const q = String(userQuestion || "").trim();
  if (!q) return;
  const prompt = [
    buildGrokContext(edition, story),
    "---",
    "Reader question:",
    q,
    "",
    "Answer the question using the brief above and publicly checkable sources when useful. If something is unknown, say so.",
  ].join("\n");
  // Keep URL reasonably sized for browsers
  const max = 3500;
  const clipped = prompt.length > max ? prompt.slice(0, max) + "\n\n[Context truncated for URL length — ask follow-ups in Grok.]" : prompt;
  window.open(grokUrlForPrompt(clipped), "_blank", "noopener,noreferrer");
}

function renderAskGrok(edition, story) {
  const suggestions = [
    "Challenge the known facts — what would a skeptical reader ask next?",
    "What is the strongest piece of evidence here, and what is still missing?",
    "How could the framing or headlines push someone toward a false conclusion?",
    "Summarize what is solidly documented vs still contested in this story.",
    "What primary sources should I open first to verify this brief?",
  ];

  const textarea = el("textarea", {
    id: "grok-question",
    className: "grok-input",
    rows: "3",
    placeholder: "Ask Grok anything about this story — challenge a claim, ask for more evidence, or dig into the framing…",
    "aria-label": "Question for Grok about this story",
  });

  const chips = suggestions.map((s) =>
    el("button", {
      type: "button",
      className: "grok-chip",
      text: s.length > 72 ? s.slice(0, 69) + "…" : s,
      title: s,
      onClick: () => {
        textarea.value = s;
        textarea.focus();
      },
    })
  );

  const askBtn = el("button", {
    type: "button",
    className: "grok-ask-btn",
    text: "Ask Grok",
    onClick: () => openGrokWithStory(edition, story, textarea.value),
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      openGrokWithStory(edition, story, textarea.value);
    }
  });

  return el("section", { className: "detail-section ask-grok", id: "ask-grok" }, [
    el("div", { className: "ask-grok-header" }, [
      el("h2", { text: "Ask Grok" }),
      el("span", { className: "grok-badge", text: "grok.com" }),
    ]),
    el("p", {
      className: "ask-grok-lede",
      text: "Challenge claims, press for more evidence, or explore the framing. Opens Grok in a new tab with this story’s brief as context. Requires your Grok / X sign-in.",
    }),
    el("div", { className: "grok-chips", "aria-label": "Suggested questions" }, chips),
    textarea,
    el("div", { className: "grok-actions" }, [
      askBtn,
      el("span", { className: "grok-hint", text: "Tip: Ctrl/Cmd + Enter to send" }),
    ]),
  ]);
}

function renderStoryDetail(edition, storyId) {
  setWeekLabel(edition);
  const root = $("#story-root");
  if (!root) return;

  const story = edition.stories.find((s) => s.id === storyId);
  if (!story) {
    root.innerHTML = "";
    root.classList.remove("loading");
    root.appendChild(
      el("div", { className: "error-box", text: `Story "${storyId}" not found in this demo edition.` })
    );
    return;
  }

  document.title = `${story.title} · Friday Truth Brief`;

  const tags = (story.tags || []).map((t) => el("span", { className: "tag", text: t }));

  const facts = (story.knownFacts || []).map((f) => {
    const sources = (f.sources || []).map((s) =>
      el("li", {}, [
        el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", text: s.name }),
        document.createTextNode(` · ${s.date}`),
      ])
    );
    return el("li", { className: "fact-item" }, [
      el("p", { className: "claim", text: f.claim }),
      el("p", { className: "evidence", text: f.evidence }),
      el("ul", { className: "sources" }, sources),
    ]);
  });

  const misreps = (story.misrepresentations || []).map((m) =>
    el("li", { className: "misrep-item" }, [
      el("div", { className: "misrep-head" }, [
        el("span", { className: "outlet", text: m.outlet }),
        el("span", { className: `severity ${severityClass(m.severity)}`, text: m.severity }),
        edition.isDemo ? el("span", { className: "demo-chip", text: "Demo outlet" }) : null,
      ]),
      el("p", { className: "piece-title" }, [
        el("a", {
          href: m.pieceUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          text: m.pieceTitle,
        }),
      ]),
      el("p", { className: "claim-made" }, [
        el("strong", { text: "Claim made: " }),
        document.createTextNode(m.claimMade),
      ]),
      el("p", { className: "why-inaccurate" }, [
        el("strong", { text: "Why inaccurate: " }),
        document.createTextNode(m.whyInaccurate),
      ]),
    ])
  );

  const narratives = (story.narratives || []).map((n) =>
    el("li", { className: "narrative-item" }, [
      el("span", { className: "type-badge", text: typeLabel(n.type) }),
      el("p", { className: "narr-desc" }, [
        el("strong", { text: "What we noticed: " }),
        document.createTextNode(n.description),
      ]),
      el("p", { className: "narr-example" }, [
        el("strong", { text: "Example: " }),
        document.createTextNode(n.example),
      ]),
      el("p", { className: "narr-how" }, [
        el("strong", { text: "How it misleads: " }),
        document.createTextNode(n.howItMisleads),
      ]),
    ])
  );

  root.classList.remove("loading");
  root.innerHTML = "";
  root.append(
    el("a", { className: "back-link", href: (function(){ const e=new URLSearchParams(location.search).get("edition"); return e?("index.html?edition="+encodeURIComponent(e)):"index.html"; })(), text: "← Top 10 list" }),
    el("header", { className: "story-hero" }, [
      el("div", { className: "rank-line" }, [
        el("div", { className: "rank-badge", text: String(story.rank) }),
        ...(edition.isDemo ? [el("span", { className: "demo-chip", text: "Demo story" })] : []),
        ...tags,
      ]),
      el("h1", { text: story.title }),
      el("p", { className: "summary", text: story.summary }),
    ]),
    el("section", { className: "detail-section", id: "overview" }, [
      el("h2", { text: "Overview" }),
      el("p", { className: "overview-text", text: story.overview }),
    ]),
    el("section", { className: "detail-section", id: "known-facts" }, [
      el("h2", { text: "Known facts" }),
      el("ul", { className: "fact-list" }, facts),
    ]),
    el("section", { className: "detail-section", id: "misrepresentations" }, [
      el("h2", { text: "Misrepresentations" }),
      el("ul", { className: "misrep-list" }, misreps),
    ]),
    el("section", { className: "detail-section", id: "narratives" }, [
      el("h2", { text: "Narratives & spin" }),
      el("ul", { className: "narrative-list" }, narratives),
    ]),
  );

  const adRail = ensureAdRail({ storyClass: true });
  // Place after narratives, before Ask Grok
  root.appendChild(adRail);
  root.appendChild(renderAskGrok(edition, story));
  initAdRotator(adRail);
}

function renderArchive() {
  const list = $("#archive-list");
  if (!list) return;
  list.innerHTML = "";
  for (const item of ARCHIVE) {
    const href = `index.html?edition=${encodeURIComponent(item.path)}`;
    list.appendChild(
      el("li", {}, [
        el("a", { className: "archive-card", href }, [
          el("span", { className: "demo-chip", text: item.isDemo ? "Demo" : "Live" }),
          el("h3", { text: item.title }),
          el("p", { text: `${item.note} · ${item.date}` }),
        ]),
      ])
    );
  }
  const week = $("#week-label");
  if (week) week.textContent = "Archive";
  const banner = document.querySelector(".demo-banner");
  if (banner) {
    banner.innerHTML =
      "<strong>Archive</strong> — open an edition card to load that JSON on the homepage.";
  }
}

function pageKind() {
  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (file === "story.html") return "story";
  if (file === "archive.html") return "archive";
  return "home";
}

function showError(msg) {
  const targets = ["#story-list", "#story-root", "#archive-list", "main"];
  for (const sel of targets) {
    const node = $(sel);
    if (node) {
      node.innerHTML = "";
      node.classList.remove("loading");
      node.appendChild(el("div", { className: "error-box", text: msg }));
      break;
    }
  }
}

async function init() {
  initThemeToggle();

  const kind = pageKind();
  if (kind === "archive") {
    renderArchive();
    return;
  }

  try {
    const edition = await loadEdition(resolveEditionPath());
    updateDemoBanner(edition);
    if (kind === "story") {
      const id = new URLSearchParams(location.search).get("id");
      if (!id) {
        showError("Missing story id. Open a story from the homepage.");
        setWeekLabel(edition);
        return;
      }
      renderStoryDetail(edition, id);
    } else {
      renderHome(edition);
      const homeRail = $("#ad-rail") || ensureAdRail({ afterSelector: ".methodology", beforeSelector: ".section-label" });
      initAdRotator(homeRail);
    }
  } catch (err) {
    console.error(err);
    showError(
      "Could not load edition data. Serve this folder over HTTP (e.g. python3 -m http.server 8765) rather than opening the HTML file directly."
    );
  }
}

document.addEventListener("DOMContentLoaded", init);



/** PWA install / Add to Home Screen helper */
let deferredInstallPrompt = null;

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function hideInstallUI() {
  document.querySelectorAll(".install-btn, .install-hint, #install-ios-tip").forEach((n) => {
    n.hidden = true;
  });
}

function showIosTip(show) {
  const tip = $("#install-ios-tip");
  if (!tip) return;
  tip.hidden = !show;
}

function initInstallPrompt() {
  if (isStandalone()) {
    hideInstallUI();
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.querySelectorAll(".install-btn").forEach((btn) => {
      btn.hidden = false;
      btn.disabled = false;
      btn.textContent = "Add to Home Screen";
    });
    showIosTip(false);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideInstallUI();
  });

  document.querySelectorAll(".install-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try {
          const choice = await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          if (choice && choice.outcome === "accepted") hideInstallUI();
        } catch (_) {
          /* ignore */
        }
        return;
      }
      if (isIos()) {
        showIosTip(true);
        const tip = $("#install-ios-tip");
        if (tip) tip.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      // Desktop Safari / Firefox / others: show generic hint
      showIosTip(true);
      const tip = $("#install-ios-tip");
      if (tip) {
        tip.innerHTML =
          "<strong>Add to Home Screen</strong> — use your browser menu: <em>Install app</em> / <em>Add to Home Screen</em> / <em>Create shortcut</em> (wording varies by browser).";
        tip.hidden = false;
      }
    });
  });

  // Always show a guide button when not installed (Chrome may later upgrade to native prompt)
  document.querySelectorAll(".install-btn").forEach((btn) => {
    btn.hidden = false;
    if (!btn.dataset.labelSet) {
      btn.textContent = isIos() ? "Add to Home Screen" : "Install / Add to Home Screen";
      btn.dataset.labelSet = "1";
    }
  });
}


function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

registerServiceWorker();

