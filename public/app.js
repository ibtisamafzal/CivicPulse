/* ============================================================
   CivicPulse Montgomery — Client-Side SPA
   Router, page renderers, feature page logic
   ============================================================ */

/* ─── Constants ─── */
const SCORE_COLORS = { high: "#06d6a0", medium: "#f59e0b", low: "#ef4444" };
const THEME_STORAGE_KEY = "civicpulse-theme";

const FALLBACK_BOUNDARIES = {
  "West Montgomery": [
    [32.381, -86.357],
    [32.368, -86.357],
    [32.362, -86.336],
    [32.376, -86.324],
  ],
  Cloverdale: [
    [32.366, -86.306],
    [32.355, -86.306],
    [32.351, -86.291],
    [32.363, -86.286],
  ],
  "Garden District": [
    [32.361, -86.289],
    [32.349, -86.289],
    [32.346, -86.275],
    [32.358, -86.271],
  ],
  "Oak Park": [
    [32.385, -86.279],
    [32.373, -86.279],
    [32.37, -86.263],
    [32.382, -86.259],
  ],
  Chisholm: [
    [32.35, -86.348],
    [32.338, -86.348],
    [32.334, -86.327],
    [32.346, -86.322],
  ],
};

let map,
  mapBaseLayer,
  chart,
  briefingPlayerBound = false;

/* ─── Helpers ─── */
function colorByScore(s) {
  if (s >= 70) return SCORE_COLORS.high;
  if (s >= 50) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

async function fetchJson(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

function formatDuration(sec) {
  const t = Number(sec) || 0;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function getThemeToken(name, fallback) {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function getActiveTheme() {
  const htmlTheme = document.documentElement.dataset.theme;
  const bodyTheme = document.body.dataset.theme;
  return htmlTheme === "dark" || bodyTheme === "dark" ? "dark" : "light";
}

function updateThemeToggleButton(theme) {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  const isDark = theme === "dark";
  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute(
    "aria-label",
    isDark ? "Activate light theme" : "Activate dark theme",
  );
  toggle.title = isDark ? "Activate light theme" : "Activate dark theme";
}

function getMapBaseLayer(theme) {
  const style = theme === "dark" ? "dark_all" : "light_all";
  return L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`,
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    },
  );
}

function applyMapTheme(theme) {
  if (!map || typeof L === "undefined") return;
  if (mapBaseLayer) {
    map.removeLayer(mapBaseLayer);
  }
  mapBaseLayer = getMapBaseLayer(theme);
  mapBaseLayer.addTo(map);
}

function applyChartTheme() {
  if (!chart) return;

  const gridColor = getThemeToken("--chart-grid", "rgba(17, 35, 63, 0.11)");
  const tickColor = getThemeToken("--chart-ticks", "#41597c");

  if (chart.options?.scales?.y) {
    chart.options.scales.y.grid.color = gridColor;
    chart.options.scales.y.ticks.color = tickColor;
  }
  if (chart.options?.scales?.x) {
    chart.options.scales.x.ticks.color = tickColor;
  }

  chart.update();
}

function applyTheme(theme, { persist = true } = {}) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
  document.body.dataset.theme = nextTheme;
  updateThemeToggleButton(nextTheme);

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures in private browsing or restricted contexts.
    }
  }

  applyMapTheme(nextTheme);
  applyChartTheme();
}

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  let initialTheme = "light";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      initialTheme = stored;
    }
  } catch {
    initialTheme = "light";
  }

  applyTheme(initialTheme, { persist: false });

  toggle.addEventListener("click", () => {
    const nextTheme = getActiveTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });
}

/* ============================================================
   ROUTER
   ============================================================ */
const routes = {
  "/": renderLanding,
  "/features/map": renderFeatureMap,
  "/features/scores": renderFeatureScores,
  "/features/chart": renderFeatureChart,
  "/features/briefing": renderFeatureBriefing,
  "/features/alerts": renderFeatureAlerts,
  "/features/ask": renderFeatureAsk,
  "/features/voice": renderFeatureVoice,
  "/about": renderAbout,
  "/contact": renderContact,
  "/faq": renderFAQ,
};

function navigate(path) {
  if (path === window.location.pathname) return;
  window.history.pushState({}, "", path);
  handleRoute();
}

function handleRoute() {
  const path = window.location.pathname;
  const render = routes[path] || render404;

  // Reset scroll
  window.scrollTo(0, 0);

  // Cleanup map/chart if leaving those pages
  if (map && path !== "/features/map") {
    map.remove();
    map = null;
    mapBaseLayer = null;
  }
  if (chart && path !== "/features/chart") {
    chart.destroy();
    chart = null;
  }

  // Render
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.className = "page-transition";
  render(app);
  
  // Remove loading class after render
  requestAnimationFrame(() => {
    app.classList.remove("app-loading");
    // Also show footer after initial render
    const footer = document.getElementById("footer");
    if (footer) {
      footer.classList.remove("footer-loading");
    }
  });
  
  // Auto-open tour on homepage
  if (path === "/" || path === "") {
    setTimeout(() => {
      if (tourInitialized) {
        openTour();
      }
    }, 500);
  }

  // Update nav active state
  document.querySelectorAll("[data-link]").forEach((el) => {
    el.classList.toggle("active", el.dataset.link === path);
  });

  // Close mobile menu
  document.getElementById("mobile-menu").classList.remove("open");

  // Show footer on all pages
  document.getElementById("footer").style.display = "";

  // Kick off reveal animations
  requestAnimationFrame(() => {
    document.querySelectorAll(".reveal").forEach((el) => {
      revealObserver.observe(el);
    });
  });
}

/* ─── Intersection Observer for scroll reveals ─── */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        revealObserver.unobserve(e.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
);

/* ============================================================
   PAGE: LANDING
   ============================================================ */
function renderLanding(app) {
  app.innerHTML = `
    <!-- Hero -->
    <section class="hero">
      <div class="hero__bg">
        <div class="hero__gradient"></div>
        <div class="hero__grid"></div>
      </div>
      <div class="hero__content">
        <div class="hero__eyebrow">
          <span class="badge badge--brand">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);"></span>
            Live in Montgomery, AL
          </span>
        </div>
        <h1 class="hero__title">
          Neighborhood Intelligence,<br/><span class="text-gradient">Powered by AI</span>
        </h1>
        <p class="hero__subtitle">
          Real-time civic data transformed into actionable equity insights.
          Empowering residents, leaders, and businesses to build a stronger Montgomery.
        </p>
        <div class="hero__actions">
          <a class="btn btn--primary btn--lg" data-link="/features/map">Explore the Map</a>
          <a class="btn btn--secondary btn--lg" data-link="/about">Learn More</a>
        </div>
        <div class="hero__stats reveal">
          <div class="hero__stat">
            <div class="hero__stat-value text-gradient">5</div>
            <div class="hero__stat-label">Neighborhoods tracked</div>
          </div>
          <div class="hero__stat">
            <div class="hero__stat-value text-gradient">24/7</div>
            <div class="hero__stat-label">AI-powered monitoring</div>
          </div>
          <div class="hero__stat">
            <div class="hero__stat-value text-gradient">Live</div>
            <div class="hero__stat-label">Open data pipeline</div>
          </div>
        </div>
      </div>
      <div class="hero__scroll">
        <span>Scroll to explore</span>
        <div class="hero__scroll-line"></div>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="section">
      <div class="container">
        <div class="section__header reveal">
          <p class="section__eyebrow">Platform Features</p>
          <h2 class="section__title">Everything you need for civic intelligence</h2>
          <p class="section__desc">Seven integrated tools that turn raw civic data into neighborhood-level insights, alerts, and actions.</p>
        </div>
        <div class="features-grid">
          ${featureCardsHTML()}
        </div>
      </div>
    </section>

    <!-- Showcase Sections -->
    ${showcaseSectionsHTML()}

    <!-- CTA -->
    <section class="cta-section">
      <div class="container">
        <div class="cta-section__inner reveal">
          <h2 class="cta-section__title">Ready to explore your neighborhood?</h2>
          <p class="cta-section__desc">Dive into real-time health scores, alerts, and AI-powered briefings for Montgomery neighborhoods.</p>
          <div class="hero__actions">
            <a class="btn btn--primary btn--lg" data-link="/features/scores">View Scores</a>
            <a class="btn btn--secondary btn--lg" data-link="/faq">Read the FAQ</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function featureCardsHTML() {
  const features = [
    {
      icon: "🗺️",
      cls: "map",
      title: "Equity Map",
      desc: "Interactive map color-coded by daily neighborhood health scores. See geographic disparities at a glance.",
      link: "/features/map",
    },
    {
      icon: "📊",
      cls: "scores",
      title: "Health Scores",
      desc: "Composite scores weighted across safety, blight, service quality, activity, and communications.",
      link: "/features/scores",
    },
    {
      icon: "☀️",
      cls: "briefing",
      title: "Morning Briefing",
      desc: "AI-generated daily audio and text briefing summarizing the latest civic intelligence.",
      link: "/features/briefing",
    },
    {
      icon: "🚨",
      cls: "alerts",
      title: "Proactive Alerts",
      desc: "Anomaly detection that surfaces issues before they escalate, with severity-based prioritization.",
      link: "/features/alerts",
    },
    {
      icon: "💬",
      cls: "query",
      title: "Ask CivicPulse",
      desc: "Perplexity-powered Q&A about neighborhoods, businesses, and city services — backed by live data.",
      link: "/features/ask",
    },
    {
      icon: "🎙️",
      cls: "voice",
      title: "311 Voice Agent",
      desc: "24/7 conversational AI for filing service tickets, reporting issues, and getting instant answers.",
      link: "/features/voice",
    },
  ];

  return features
    .map(
      (f, i) => `
    <div class="feature-card reveal reveal-delay-${Math.min(i + 1, 5)}">
      <div class="feature-card__icon feature-card__icon--${f.cls}">${f.icon}</div>
      <h3 class="feature-card__title">${f.title}</h3>
      <p class="feature-card__desc">${f.desc}</p>
      <span class="feature-card__link" data-link="${f.link}">Explore &rarr;</span>
    </div>
  `,
    )
    .join("");
}

function showcaseSectionsHTML() {
  return `
    <!-- Showcase 01: Equity Map -->
    <section class="section">
      <div class="container">
        <div class="showcase reveal">
          <div class="showcase__content">
            <div class="showcase__number">01</div>
            <h2 class="showcase__title">Real-Time Equity Mapping</h2>
            <p class="showcase__desc">Our Leaflet-powered map pulls live civic data and overlays neighborhood boundaries with color-coded health scores. Instantly spot areas that need attention and track improvements over time.</p>
            <div class="showcase__features">
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Color-coded boundaries</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Live data refresh</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Click for details</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Mobile-friendly gestures</span></div>
            </div>
            <a class="btn btn--primary" data-link="/features/map">Try it now</a>
          </div>
          <div class="showcase__visual">
            <div class="showcase__visual-inner sc-vis--map">
              <svg class="sc-map" viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="320" height="240" rx="12" fill="#0a1628"/>
                <!-- grid lines -->
                <line x1="0" y1="60" x2="320" y2="60" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="0" y1="120" x2="320" y2="120" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="0" y1="180" x2="320" y2="180" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="80" y1="0" x2="80" y2="240" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="160" y1="0" x2="160" y2="240" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="240" y1="0" x2="240" y2="240" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <!-- neighborhoods -->
                <polygon points="40,40 120,35 130,100 60,110" fill="rgba(6,214,160,0.25)" stroke="#06d6a0" stroke-width="1.5"/>
                <polygon points="135,30 220,50 210,105 140,95" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" stroke-width="1.5"/>
                <polygon points="230,45 290,55 285,115 225,100" fill="rgba(6,214,160,0.3)" stroke="#06d6a0" stroke-width="1.5"/>
                <polygon points="55,120 140,110 150,185 70,190" fill="rgba(239,68,68,0.2)" stroke="#ef4444" stroke-width="1.5"/>
                <polygon points="160,108 250,105 240,180 165,178" fill="rgba(6,214,160,0.2)" stroke="#06d6a0" stroke-width="1.5"/>
                <!-- dots -->
                <circle cx="85" cy="70" r="5" fill="#06d6a0" opacity="0.9"/>
                <circle cx="175" cy="72" r="5" fill="#f59e0b" opacity="0.9"/>
                <circle cx="255" cy="78" r="5" fill="#06d6a0" opacity="0.9"/>
                <circle cx="100" cy="150" r="5" fill="#ef4444" opacity="0.9"/>
                <circle cx="200" cy="142" r="5" fill="#06d6a0" opacity="0.9"/>
                <!-- labels -->
                <text x="70" y="88" font-size="8" fill="rgba(255,255,255,0.5)" font-family="Inter">78</text>
                <text x="163" y="90" font-size="8" fill="rgba(255,255,255,0.5)" font-family="Inter">52</text>
                <text x="243" y="96" font-size="8" fill="rgba(255,255,255,0.5)" font-family="Inter">81</text>
                <text x="88" y="168" font-size="8" fill="rgba(255,255,255,0.5)" font-family="Inter">34</text>
                <text x="188" y="160" font-size="8" fill="rgba(255,255,255,0.5)" font-family="Inter">72</text>
                <!-- legend -->
                <rect x="16" y="210" width="8" height="8" rx="2" fill="#06d6a0"/>
                <text x="28" y="217" font-size="7" fill="rgba(255,255,255,0.4)" font-family="Inter">High</text>
                <rect x="56" y="210" width="8" height="8" rx="2" fill="#f59e0b"/>
                <text x="68" y="217" font-size="7" fill="rgba(255,255,255,0.4)" font-family="Inter">Medium</text>
                <rect x="108" y="210" width="8" height="8" rx="2" fill="#ef4444"/>
                <text x="120" y="217" font-size="7" fill="rgba(255,255,255,0.4)" font-family="Inter">Low</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Showcase 02: AI Briefings -->
    <section class="section">
      <div class="container">
        <div class="showcase showcase--reverse reveal">
          <div class="showcase__content">
            <div class="showcase__number">02</div>
            <h2 class="showcase__title">AI-Powered Daily Briefings</h2>
            <p class="showcase__desc">Every morning, our pipeline aggregates overnight data changes into a concise briefing — complete with audio narration powered by ElevenLabs. Stay informed without digging through raw data.</p>
            <div class="showcase__features">
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Auto-generated scripts</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Audio narration</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Headline cards</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Historical archive</span></div>
            </div>
            <a class="btn btn--primary" data-link="/features/briefing">Try it now</a>
          </div>
          <div class="showcase__visual">
            <div class="showcase__visual-inner sc-vis--briefing">
              <div class="sc-briefing">
                <div class="sc-briefing__header">
                  <span class="sc-briefing__dot sc-briefing__dot--live"></span>
                  <span class="sc-briefing__title">Morning Briefing</span>
                  <span class="sc-briefing__date">Today</span>
                </div>
                <div class="sc-briefing__card">
                  <div class="sc-briefing__icon">☀️</div>
                  <div>
                    <div class="sc-briefing__headline">West Montgomery scores improve +4</div>
                    <div class="sc-briefing__sub">Blight resolution up 12% this week</div>
                  </div>
                </div>
                <div class="sc-briefing__card">
                  <div class="sc-briefing__icon">🚨</div>
                  <div>
                    <div class="sc-briefing__headline">Oak Park alert: response time spike</div>
                    <div class="sc-briefing__sub">311 tickets avg. 4.2 days vs 2.1 norm</div>
                  </div>
                </div>
                <div class="sc-briefing__card">
                  <div class="sc-briefing__icon">📊</div>
                  <div>
                    <div class="sc-briefing__headline">Cloverdale holds steady at 78</div>
                    <div class="sc-briefing__sub">Community engagement score highest</div>
                  </div>
                </div>
                <div class="sc-briefing__audio">
                  <div class="sc-briefing__play">▶</div>
                  <div class="sc-briefing__wave">
                    <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                  </div>
                  <span class="sc-briefing__dur">2:45</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Showcase 03: Health Scores -->
    <section class="section">
      <div class="container">
        <div class="showcase reveal">
          <div class="showcase__content">
            <div class="showcase__number">03</div>
            <h2 class="showcase__title">Composite Health Scores</h2>
            <p class="showcase__desc">Every neighborhood gets a daily score weighted across safety, blight, service quality, activity, and communications — giving you a single number that captures civic health at a glance.</p>
            <div class="showcase__features">
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>5-factor weighted scoring</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Daily automated updates</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Trend direction indicators</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Color-coded severity</span></div>
            </div>
            <a class="btn btn--primary" data-link="/features/scores">Try it now</a>
          </div>
          <div class="showcase__visual">
            <div class="showcase__visual-inner sc-vis--scores">
              <div class="sc-scores">
                <div class="sc-scores__card sc-scores__card--high">
                  <div class="sc-scores__name">Cloverdale</div>
                  <div class="sc-scores__val">78</div>
                  <div class="sc-scores__trend sc-scores__trend--up">↑ +3</div>
                  <div class="sc-scores__bar"><div class="sc-scores__fill" style="width:78%"></div></div>
                </div>
                <div class="sc-scores__card sc-scores__card--high">
                  <div class="sc-scores__name">Garden District</div>
                  <div class="sc-scores__val">72</div>
                  <div class="sc-scores__trend sc-scores__trend--up">↑ +1</div>
                  <div class="sc-scores__bar"><div class="sc-scores__fill" style="width:72%"></div></div>
                </div>
                <div class="sc-scores__card sc-scores__card--med">
                  <div class="sc-scores__name">Oak Park</div>
                  <div class="sc-scores__val">55</div>
                  <div class="sc-scores__trend sc-scores__trend--down">↓ -2</div>
                  <div class="sc-scores__bar"><div class="sc-scores__fill sc-scores__fill--med" style="width:55%"></div></div>
                </div>
                <div class="sc-scores__card sc-scores__card--low">
                  <div class="sc-scores__name">West Montgomery</div>
                  <div class="sc-scores__val">38</div>
                  <div class="sc-scores__trend sc-scores__trend--down">↓ -5</div>
                  <div class="sc-scores__bar"><div class="sc-scores__fill sc-scores__fill--low" style="width:38%"></div></div>
                </div>
                <div class="sc-scores__card sc-scores__card--med">
                  <div class="sc-scores__name">Chisholm</div>
                  <div class="sc-scores__val">52</div>
                  <div class="sc-scores__trend sc-scores__trend--up">↑ +2</div>
                  <div class="sc-scores__bar"><div class="sc-scores__fill sc-scores__fill--med" style="width:52%"></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Showcase 04: Signal Snapshot Chart -->
    <section class="section">
      <div class="container">
        <div class="showcase showcase--reverse reveal">
          <div class="showcase__content">
            <div class="showcase__number">04</div>
            <h2 class="showcase__title">Signal Snapshot Chart</h2>
            <p class="showcase__desc">A clear visual comparison of all neighborhoods side by side. The bar chart makes it effortless to identify which communities are thriving and which need attention.</p>
            <div class="showcase__features">
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Side-by-side comparison</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Color-coded bars</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Interactive tooltips</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Chart.js powered</span></div>
            </div>
            <a class="btn btn--primary" data-link="/features/chart">Try it now</a>
          </div>
          <div class="showcase__visual">
            <div class="showcase__visual-inner sc-vis--chart">
              <svg class="sc-chart" viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="320" height="220" rx="12" fill="#0a1628"/>
                <!-- y-axis labels -->
                <text x="12" y="38" font-size="8" fill="rgba(255,255,255,0.3)" font-family="Inter">100</text>
                <text x="18" y="78" font-size="8" fill="rgba(255,255,255,0.3)" font-family="Inter">75</text>
                <text x="18" y="118" font-size="8" fill="rgba(255,255,255,0.3)" font-family="Inter">50</text>
                <text x="18" y="158" font-size="8" fill="rgba(255,255,255,0.3)" font-family="Inter">25</text>
                <text x="24" y="198" font-size="8" fill="rgba(255,255,255,0.3)" font-family="Inter">0</text>
                <!-- grid lines -->
                <line x1="40" y1="34" x2="305" y2="34" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="40" y1="74" x2="305" y2="74" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="40" y1="114" x2="305" y2="114" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="40" y1="154" x2="305" y2="154" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <line x1="40" y1="194" x2="305" y2="194" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
                <!-- bars: Cloverdale 78, Garden 72, Oak Park 55, West 38, Chisholm 52 -->
                <rect x="52" y="69" width="38" height="125" rx="4" fill="#06d6a0" opacity="0.8"/>
                <rect x="106" y="79" width="38" height="115" rx="4" fill="#06d6a0" opacity="0.7"/>
                <rect x="160" y="106" width="38" height="88" rx="4" fill="#f59e0b" opacity="0.7"/>
                <rect x="214" y="133" width="38" height="61" rx="4" fill="#ef4444" opacity="0.7"/>
                <rect x="268" y="111" width="38" height="83" rx="4" fill="#f59e0b" opacity="0.7"/>
                <!-- score labels -->
                <text x="63" y="63" font-size="9" fill="#06d6a0" font-family="Inter" font-weight="700">78</text>
                <text x="117" y="73" font-size="9" fill="#06d6a0" font-family="Inter" font-weight="700">72</text>
                <text x="171" y="100" font-size="9" fill="#f59e0b" font-family="Inter" font-weight="700">55</text>
                <text x="225" y="127" font-size="9" fill="#ef4444" font-family="Inter" font-weight="700">38</text>
                <text x="279" y="105" font-size="9" fill="#f59e0b" font-family="Inter" font-weight="700">52</text>
                <!-- x-axis labels -->
                <text x="48" y="210" font-size="7" fill="rgba(255,255,255,0.4)" font-family="Inter">Cloverdale</text>
                <text x="108" y="210" font-size="7" fill="rgba(255,255,255,0.4)" font-family="Inter">Garden</text>
                <text x="155" y="210" font-size="7" fill="rgba(255,255,255,0.4)" font-family="Inter">Oak Park</text>
                <text x="218" y="210" font-size="7" fill="rgba(255,255,255,0.4)" font-family="Inter">West</text>
                <text x="266" y="210" font-size="7" fill="rgba(255,255,255,0.4)" font-family="Inter">Chisholm</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Showcase 05: Proactive Alerts -->
    <section class="section">
      <div class="container">
        <div class="showcase reveal">
          <div class="showcase__content">
            <div class="showcase__number">05</div>
            <h2 class="showcase__title">Proactive Alerts</h2>
            <p class="showcase__desc">Our anomaly detection engine monitors civic signals around the clock and surfaces issues before they escalate — so city leaders and residents can act early, not react late.</p>
            <div class="showcase__features">
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Anomaly detection</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Severity-based priority</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Actionable summaries</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Real-time monitoring</span></div>
            </div>
            <a class="btn btn--primary" data-link="/features/alerts">Try it now</a>
          </div>
          <div class="showcase__visual">
            <div class="showcase__visual-inner sc-vis--alerts">
              <div class="sc-alerts">
                <div class="sc-alerts__card sc-alerts__card--critical">
                  <div class="sc-alerts__severity">CRITICAL</div>
                  <div class="sc-alerts__msg">West Montgomery: 311 response time spiked 3.2× above baseline</div>
                  <div class="sc-alerts__time">12 min ago</div>
                </div>
                <div class="sc-alerts__card sc-alerts__card--warning">
                  <div class="sc-alerts__severity">WARNING</div>
                  <div class="sc-alerts__msg">Oak Park: Blight reports increased 45% in last 48 hours</div>
                  <div class="sc-alerts__time">1 hour ago</div>
                </div>
                <div class="sc-alerts__card sc-alerts__card--info">
                  <div class="sc-alerts__severity">INFO</div>
                  <div class="sc-alerts__msg">Cloverdale safety score at 6-month high, sustained 3+ days</div>
                  <div class="sc-alerts__time">3 hours ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Showcase 06: Ask CivicPulse AI -->
    <section class="section">
      <div class="container">
        <div class="showcase showcase--reverse reveal">
          <div class="showcase__content">
            <div class="showcase__number">06</div>
            <h2 class="showcase__title">Intelligent Q&A with Live Sources</h2>
            <p class="showcase__desc">Ask any question about Montgomery neighborhoods — business viability, safety trends, service quality — and get AI-synthesized answers grounded in real civic data and live web sources.</p>
            <div class="showcase__features">
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Perplexity-powered answers</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Source citations</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Context-aware</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Business & resident queries</span></div>
            </div>
            <a class="btn btn--primary" data-link="/features/ask">Try it now</a>
          </div>
          <div class="showcase__visual">
            <div class="showcase__visual-inner sc-vis--ask">
              <div class="sc-ask">
                <div class="sc-ask__input">
                  <span class="sc-ask__prompt">💬</span>
                  <span class="sc-ask__q">Is Oak Park safe for a new bakery?</span>
                </div>
                <div class="sc-ask__answer">
                  <div class="sc-ask__label">AI Answer <span class="sc-ask__conf">high confidence</span></div>
                  <div class="sc-ask__text">Oak Park has seen a <strong>steady improvement</strong> in safety scores over the past 6 months, rising from 52 to 68. Foot traffic near Fairview Ave is up 18%, making it a <strong>promising corridor</strong> for food-service businesses.</div>
                  <div class="sc-ask__sources">
                    <span class="sc-ask__src">1 data.montgomery.gov</span>
                    <span class="sc-ask__src">2 census.gov</span>
                    <span class="sc-ask__src">3 yelp.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Showcase 07: 311 Voice Agent -->
    <section class="section">
      <div class="container">
        <div class="showcase reveal">
          <div class="showcase__content">
            <div class="showcase__number">07</div>
            <h2 class="showcase__title">24/7 Voice Agent for 311</h2>
            <p class="showcase__desc">An AI-powered conversational agent that lets residents file service tickets, report neighborhood issues, and get instant answers — by typing or speaking, anytime day or night.</p>
            <div class="showcase__features">
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Voice & text input</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Automatic ticket filing</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>ElevenLabs integration</span></div>
              <div class="showcase__feature-item"><span class="showcase__feature-check">✓</span><span>Smart issue routing</span></div>
            </div>
            <a class="btn btn--primary" data-link="/features/voice">Try it now</a>
          </div>
          <div class="showcase__visual">
            <div class="showcase__visual-inner sc-vis--voice">
              <div class="sc-voice">
                <div class="sc-voice__header">
                  <span class="sc-voice__dot"></span>
                  <span class="sc-voice__label">311 Voice Agent</span>
                  <span class="sc-voice__status">Online</span>
                </div>
                <div class="sc-voice__bubble sc-voice__bubble--ai">Hi! I'm Montgomery's 311 AI assistant. How can I help?</div>
                <div class="sc-voice__bubble sc-voice__bubble--user">There's a big pothole on 450 Dexter Ave</div>
                <div class="sc-voice__bubble sc-voice__bubble--ai">
                  <div class="sc-voice__ticket">
                    <div class="sc-voice__ticket-head">✅ Ticket Filed</div>
                    <div class="sc-voice__ticket-row"><strong>ID:</strong> #3421</div>
                    <div class="sc-voice__ticket-row"><strong>Type:</strong> Pothole</div>
                    <div class="sc-voice__ticket-row"><strong>Priority:</strong> 2</div>
                  </div>
                </div>
                <div class="sc-voice__input-bar">
                  <span class="sc-voice__mic">🎙️</span>
                  <span class="sc-voice__placeholder">Type or speak...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* ============================================================
   FEATURE PAGES
   ============================================================ */
function featurePageShell(
  icon,
  iconCls,
  title,
  desc,
  contentHTML,
  sidebarHTML = "",
) {
  const hasSidebar = sidebarHTML.length > 0;
  return `
    <div class="feature-page">
      <div class="container">
        <div class="feature-page__header reveal">
          <div class="feature-page__icon feature-card__icon--${iconCls}">${icon}</div>
          <h1 class="feature-page__title">${title}</h1>
          <p class="feature-page__desc">${desc}</p>
        </div>
        <div class="feature-page__body ${hasSidebar ? "feature-page__body--sidebar" : ""} reveal reveal-delay-2">
          <div class="feature-page__main">
            ${contentHTML}
          </div>
          ${hasSidebar ? `<aside class="feature-page__sidebar">${sidebarHTML}</aside>` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderFeatureMap(app) {
  app.innerHTML = featurePageShell(
    "🗺️",
    "map",
    "Neighborhood Equity Map",
    "Interactive map color-coded by each neighborhood's daily health score. Click any area to see details.",
    `<div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">Live Map</h2>
        <span class="panel__subtitle">Updated daily at 2:00 AM CT</span>
      </div>
      <div id="map" style="min-height:500px;"></div>
    </div>`,
    `<div class="sidebar-card">
      <h3 class="sidebar-card__title">🎨 Color Legend</h3>
      <div class="legend">
        <div class="legend__item"><span class="legend__dot" style="background:#06d6a0;"></span><span>70–100 Healthy</span></div>
        <div class="legend__item"><span class="legend__dot" style="background:#f59e0b;"></span><span>50–69 At Risk</span></div>
        <div class="legend__item"><span class="legend__dot" style="background:#ef4444;"></span><span>0–49 Critical</span></div>
      </div>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">ℹ️ How to Use</h3>
      <ul class="sidebar-tips">
        <li>Click a neighborhood polygon for details</li>
        <li>Colors reflect today's health score</li>
        <li>Zoom and pan to explore the full city</li>
        <li>Scores combine safety, blight, service, activity & communications</li>
      </ul>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">📊 Related</h3>
      <a class="sidebar-link" data-link="/features/scores">View Health Scores →</a>
      <a class="sidebar-link" data-link="/features/chart">Signal Snapshot →</a>
    </div>`,
  );
  loadMapData();
}

function renderFeatureScores(app) {
  app.innerHTML = featurePageShell(
    "📊",
    "scores",
    "Health Score Grid",
    "Composite health scores for every tracked neighborhood. Weighted by safety, blight, service, activity, and communications.",
    `<div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">All Neighborhoods</h2>
        <span class="panel__subtitle">Ranked by score</span>
      </div>
      <div id="score-grid" class="score-grid">
        <div class="loading-skeleton">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      </div>
    </div>`,
    `<div class="sidebar-card">
      <h3 class="sidebar-card__title">📐 Score Breakdown</h3>
      <p class="sidebar-text">Each neighborhood score is a weighted composite of five dimensions:</p>
      <div class="breakdown-list">
        <div class="breakdown-item"><span class="breakdown-label">Safety</span><span class="breakdown-weight">25%</span></div>
        <div class="breakdown-item"><span class="breakdown-label">Blight</span><span class="breakdown-weight">20%</span></div>
        <div class="breakdown-item"><span class="breakdown-label">Service Quality</span><span class="breakdown-weight">20%</span></div>
        <div class="breakdown-item"><span class="breakdown-label">Civic Activity</span><span class="breakdown-weight">20%</span></div>
        <div class="breakdown-item"><span class="breakdown-label">Communications</span><span class="breakdown-weight">15%</span></div>
      </div>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">📈 Related</h3>
      <a class="sidebar-link" data-link="/features/chart">View Chart Comparison →</a>
      <a class="sidebar-link" data-link="/features/map">View on Map →</a>
    </div>`,
  );
  loadScoresData();
}

function renderFeatureChart(app) {
  app.innerHTML = featurePageShell(
    "📈",
    "chart",
    "Signal Snapshot",
    "Side-by-side bar chart for quick relative comparison of neighborhood health.",
    `<div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">Score Comparison</h2>
        <span class="panel__subtitle">All neighborhoods</span>
      </div>
      <div class="chart-container">
        <canvas id="score-chart" height="350"></canvas>
      </div>
    </div>`,
    `<div class="sidebar-card">
      <h3 class="sidebar-card__title">📊 Reading the Chart</h3>
      <ul class="sidebar-tips">
        <li>Taller bars indicate higher health scores</li>
        <li>Green bars (70+) are healthy neighborhoods</li>
        <li>Yellow bars (50-69) need attention</li>
        <li>Red bars (below 50) are critical</li>
      </ul>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">🔗 Related</h3>
      <a class="sidebar-link" data-link="/features/scores">Detailed Scores →</a>
      <a class="sidebar-link" data-link="/features/alerts">Active Alerts →</a>
    </div>`,
  );
  loadChartData();
}

function renderFeatureBriefing(app) {
  app.innerHTML = featurePageShell(
    "☀️",
    "briefing",
    "Montgomery Morning Briefing",
    "AI-generated daily briefing combining overnight data into a concise summary with audio narration.",
    `<div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">Today's Briefing</h2>
        <span id="briefing-status" class="panel__subtitle briefing-status">Loading...</span>
      </div>
      <div class="briefing-player">
        <button id="briefing-play" type="button" disabled>▶ Play Briefing</button>
        <small id="briefing-audio-status">Checking audio...</small>
        <audio id="briefing-audio" preload="none"></audio>
      </div>
      <div class="briefing-divider"></div>
      <h3 class="briefing-section-title">📝 Script</h3>
      <article id="briefing-script" class="briefing-script"><p>Loading...</p></article>
      <h3 class="briefing-section-title" style="margin-top:var(--space-lg);">📰 Headlines</h3>
      <div id="briefing-cards" class="briefing-cards"><p class="empty">Loading...</p></div>
    </div>`,
    `<div class="sidebar-card">
      <h3 class="sidebar-card__title">🕐 Schedule</h3>
      <p class="sidebar-text">Briefings are generated automatically at <strong>2:00 AM CT</strong> every day from the latest pipeline data.</p>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">🔊 Audio</h3>
      <p class="sidebar-text">When available, briefings include AI-generated narration via ElevenLabs for an on-the-go listening experience.</p>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">🔗 Related</h3>
      <a class="sidebar-link" data-link="/features/alerts">View Alerts →</a>
      <a class="sidebar-link" data-link="/features/scores">Health Scores →</a>
    </div>`,
  );
  loadBriefingData();
}

function renderFeatureAlerts(app) {
  app.innerHTML = featurePageShell(
    "🚨",
    "alerts",
    "Proactive Alerts",
    "Anomaly detection that surfaces civic issues before they escalate. Prioritized by severity.",
    `<div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">Active Alerts</h2>
        <span class="panel__subtitle">Latest anomalies</span>
      </div>
      <div id="alert-feed" class="alert-feed">
        <div class="loading-skeleton">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      </div>
    </div>`,
    `<div class="sidebar-card">
      <h3 class="sidebar-card__title">⚡ Severity Levels</h3>
      <div class="severity-list">
        <div class="severity-item"><span class="badge critical">critical</span><span class="sidebar-text">Immediate attention needed</span></div>
        <div class="severity-item"><span class="badge warning">warning</span><span class="sidebar-text">Developing concern</span></div>
        <div class="severity-item"><span class="badge info">info</span><span class="sidebar-text">Notable change detected</span></div>
      </div>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">🤖 How It Works</h3>
      <p class="sidebar-text">Alerts are automatically generated when the scoring pipeline detects significant changes in neighborhood metrics between daily snapshots.</p>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">🔗 Related</h3>
      <a class="sidebar-link" data-link="/features/briefing">Morning Briefing →</a>
      <a class="sidebar-link" data-link="/features/scores">Health Scores →</a>
    </div>`,
  );
  loadAlertsData();
}

function renderFeatureAsk(app) {
  app.innerHTML = featurePageShell(
    "💬",
    "query",
    "Ask CivicPulse",
    "Ask any question about Montgomery. Get AI-synthesized answers grounded in live civic data.",
    `<div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">AI-Powered Q&A</h2>
        <span class="panel__subtitle">Powered by Perplexity</span>
      </div>
      <form id="query-form" class="query-form">
        <label for="query-input">Ask a question about Montgomery neighborhoods</label>
        <div class="query-row">
          <input id="query-input" type="text" placeholder="Is Garden District a good area to open a restaurant this month?" required />
          <button type="submit">Analyze</button>
        </div>
      </form>
      <article id="query-output" class="query-output"><p class="query-placeholder">Your AI-generated answer will appear here. Try asking about safety, businesses, trends, or services.</p></article>
    </div>`,
    `<div class="sidebar-card">
      <h3 class="sidebar-card__title">💡 Example Questions</h3>
      <div class="example-questions">
        <button class="example-q" type="button">What are the safest neighborhoods in Montgomery?</button>
        <button class="example-q" type="button">How is blight trending in West Montgomery?</button>
        <button class="example-q" type="button">Which areas have the best city services?</button>
        <button class="example-q" type="button">Is Cloverdale good for starting a small business?</button>
      </div>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">ℹ️ About</h3>
      <p class="sidebar-text">Answers are generated using Perplexity's Sonar model with context from Montgomery's open data and live web sources. Response includes confidence level and source citations.</p>
    </div>`,
  );
  document
    .getElementById("query-form")
    .addEventListener("submit", handleQuerySubmit);
  // Example question click handlers
  document.querySelectorAll(".example-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("query-input").value = btn.textContent;
      document.getElementById("query-form").requestSubmit();
    });
  });
}

function renderFeatureVoice(app) {
  app.innerHTML = featurePageShell(
    "🎙️",
    "voice",
    "311 Voice Agent",
    "24/7 conversational AI for filing service requests and getting instant answers by voice.",
    `<div class="panel voice-chat-panel" style="max-width:640px;margin:0 auto;">
      <div class="panel__header">
        <h2 class="panel__title">Voice Assistant</h2>
        <span class="panel__subtitle" id="vp-conn-status">Initializing...</span>
      </div>
      <div id="vp-transcript" class="voice-transcript voice-transcript--lg">
        <div class="bubble ai">Hi! I'm Montgomery's 311 AI assistant. I can help you:<br/>• <strong>Report issues</strong> — potholes, street lights, illegal dumping<br/>• <strong>Ask questions</strong> — safety, services, neighborhoods<br/><br/>Type below or tap 🎙️ to speak.</div>
      </div>
      <div class="chat-input-row">
        <input type="text" id="vp-input" class="chat-input" placeholder="Describe your issue or ask a question..." autocomplete="off" />
        <button id="vp-mic" class="chat-mic-btn" aria-label="Voice input" title="Tap to speak">🎙️</button>
        <button id="vp-send" class="chat-send-btn" aria-label="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>`,
    `<div class="sidebar-card">
      <h3 class="sidebar-card__title">📞 What You Can Do</h3>
      <ul class="sidebar-tips">
        <li>Report potholes, broken street lights, or illegal dumping</li>
        <li>Ask about neighborhood safety or trends</li>
        <li>Get info about city services and hours</li>
        <li>File a service ticket hands-free by voice</li>
      </ul>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">💡 Try Saying</h3>
      <div class="example-questions">
        <button class="example-q vp-example" type="button">Street light out at 412 Jefferson Ave</button>
        <button class="example-q vp-example" type="button">Is Cloverdale safe for families?</button>
        <button class="example-q vp-example" type="button">Report a pothole on Oak Street</button>
        <button class="example-q vp-example" type="button">What services does the city offer?</button>
      </div>
    </div>
    <div class="sidebar-card">
      <h3 class="sidebar-card__title">🛡️ Privacy</h3>
      <p class="sidebar-text">Voice is processed locally in your browser. Text messages go to our AI for answers. No audio is stored.</p>
    </div>`,
  );

  const chatEngine = createChatEngine({
    transcriptId: "vp-transcript",
    inputId: "vp-input",
    micId: "vp-mic",
    sendId: "vp-send",
    statusId: "vp-conn-status",
  });

  // Wire example buttons
  document.querySelectorAll(".vp-example").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("vp-input").value = btn.textContent;
      chatEngine.send(btn.textContent);
    });
  });
}

/* ============================================================
   INFO PAGES: About, Contact, FAQ
   ============================================================ */
function renderAbout(app) {
  app.innerHTML = `
    <div class="info-page">
      <div class="container">
        <div class="info-page__header reveal">
          <h1 class="info-page__title">About <span class="text-gradient">CivicPulse</span></h1>
          <p class="info-page__desc">An AI-powered platform dedicated to making neighborhood civic intelligence accessible, equitable, and actionable for every Montgomery resident.</p>
        </div>
        <div class="info-page__content">
          <div class="about-grid">
            <div class="about-card reveal reveal-delay-1">
              <div class="about-card__icon">🎯</div>
              <h3 class="about-card__title">Our Mission</h3>
              <p class="about-card__desc">To democratize civic data by transforming fragmented government datasets into unified, neighborhood-level intelligence that empowers informed decision-making.</p>
            </div>
            <div class="about-card reveal reveal-delay-2">
              <div class="about-card__icon">⚡</div>
              <h3 class="about-card__title">How It Works</h3>
              <p class="about-card__desc">Our automated pipeline crawls city portals, Socrata open data, and news sources daily — scoring, analyzing, and generating actionable briefings powered by advanced AI.</p>
            </div>
            <div class="about-card reveal reveal-delay-3">
              <div class="about-card__icon">🔓</div>
              <h3 class="about-card__title">Open Data First</h3>
              <p class="about-card__desc">Every data point comes from publicly available government datasets. We believe transparency is the foundation of equitable civic engagement.</p>
            </div>
            <div class="about-card reveal reveal-delay-4">
              <div class="about-card__icon">🤖</div>
              <h3 class="about-card__title">AI-Powered</h3>
              <p class="about-card__desc">Perplexity, ElevenLabs, and Firecrawl power our research, voice, and data pipeline respectively — making CivicPulse smarter every day.</p>
            </div>
          </div>

          <div class="team-section reveal">
            <h2 class="team-section__title">Built for Montgomery</h2>
            <div class="team-grid">
              <div class="team-card">
                <div class="team-card__avatar">🏛️</div>
                <div class="team-card__name">Open Data</div>
                <div class="team-card__role">Socrata city datasets</div>
              </div>
              <div class="team-card">
                <div class="team-card__avatar">🧠</div>
                <div class="team-card__name">AI Research</div>
                <div class="team-card__role">Perplexity sonar</div>
              </div>
              <div class="team-card">
                <div class="team-card__avatar">🎙️</div>
                <div class="team-card__name">Voice</div>
                <div class="team-card__role">ElevenLabs conversational AI</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderContact(app) {
  app.innerHTML = `
    <div class="info-page">
      <div class="container">
        <div class="info-page__header reveal">
          <h1 class="info-page__title">Get in <span class="text-gradient">Touch</span></h1>
          <p class="info-page__desc">Have questions, feedback, or partnership ideas? We'd love to hear from you.</p>
        </div>
        <div class="info-page__content">
          <form class="contact-form reveal" id="contact-form" onsubmit="return false;">
            <div class="form-group">
              <label for="contact-name">Full Name</label>
              <input type="text" id="contact-name" placeholder="Your name" required />
            </div>
            <div class="form-group">
              <label for="contact-email">Email Address</label>
              <input type="email" id="contact-email" placeholder="you@example.com" required />
            </div>
            <div class="form-group">
              <label for="contact-subject">Subject</label>
              <select id="contact-subject">
                <option value="general">General Inquiry</option>
                <option value="feedback">Platform Feedback</option>
                <option value="partnership">Partnership</option>
                <option value="data">Data Question</option>
                <option value="bug">Report an Issue</option>
              </select>
            </div>
            <div class="form-group">
              <label for="contact-message">Message</label>
              <textarea id="contact-message" placeholder="Tell us what's on your mind..." required></textarea>
            </div>
            <button type="submit" class="btn btn--primary" style="width:100%;" id="contact-submit">Send Message</button>
          </form>

          <div class="contact-info reveal reveal-delay-2">
            <div class="contact-info__item">
              <h4>📍 Location</h4>
              <p>Montgomery, Alabama<br/>Serving all city neighborhoods</p>
            </div>
            <div class="contact-info__item">
              <h4>🕐 Availability</h4>
              <p>AI platform: 24/7<br/>Human support: Mon–Fri, 9am–5pm CT</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("contact-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = document.getElementById("contact-submit");
    btn.textContent = "Message Sent ✓";
    btn.style.background = "var(--accent)";
    setTimeout(() => {
      btn.textContent = "Send Message";
      btn.style.background = "";
    }, 3000);
  });
}

function renderFAQ(app) {
  const faqs = [
    {
      q: "What is CivicPulse?",
      a: "CivicPulse is an AI-powered neighborhood equity intelligence platform. It aggregates public civic data from Montgomery's open data portals, scores neighborhoods on multiple dimensions, and generates daily briefings, alerts, and interactive visualizations.",
    },
    {
      q: "Where does the data come from?",
      a: "All data comes from publicly available sources — primarily Montgomery's Socrata open data portal, city government websites (crawled via Firecrawl), and enriched with AI research from Perplexity.",
    },
    {
      q: "How are health scores calculated?",
      a: "Scores are a weighted composite of five dimensions: safety, blight, service quality, civic activity, and communications. Each dimension is scored 0-100 and combined into an overall neighborhood health score.",
    },
    {
      q: "How often is data updated?",
      a: "The pipeline runs daily at 2:00 AM Central Time. Manual runs can also be triggered. All data shown reflects the most recent pipeline snapshot.",
    },
    {
      q: "What is the Morning Briefing?",
      a: "It's an AI-generated daily summary of civic data changes across all neighborhoods. It includes a written script, audio narration (via ElevenLabs), and headline cards highlighting key developments.",
    },
    {
      q: "Can I ask questions about specific neighborhoods?",
      a: "Yes! The 'Ask CivicPulse' feature uses Perplexity's AI to answer any question about Montgomery neighborhoods — from business viability to safety trends — grounded in live data.",
    },
    {
      q: "What is the 311 Voice Agent?",
      a: "It's a 24/7 conversational AI that lets residents file service tickets and report issues by voice. When ElevenLabs credentials are configured, it provides a fully interactive voice experience.",
    },
    {
      q: "Is this platform free to use?",
      a: "Yes. CivicPulse is designed to make civic data accessible to everyone. The platform runs on public data and aims to promote equity and transparency.",
    },
    {
      q: "Can I use this for other cities?",
      a: "The platform architecture is designed to be adaptable. While currently configured for Montgomery, the pipeline can be reconfigured for any city with Socrata open data endpoints.",
    },
    {
      q: "How can I contribute or report issues?",
      a: "Visit our Contact page to reach out with feedback, bug reports, or partnership ideas. We welcome community input to make CivicPulse better for everyone.",
    },
  ];

  app.innerHTML = `
    <div class="info-page">
      <div class="container">
        <div class="info-page__header reveal">
          <h1 class="info-page__title">Frequently Asked <span class="text-gradient">Questions</span></h1>
          <p class="info-page__desc">Everything you need to know about the CivicPulse platform.</p>
        </div>
        <div class="info-page__content">
          <div class="faq-list">
            ${faqs
              .map(
                (f, i) => `
              <div class="faq-item reveal reveal-delay-${Math.min(i + 1, 5)}">
                <button class="faq-question" type="button">
                  <span>${f.q}</span>
                  <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div class="faq-answer">
                  <div class="faq-answer__inner">${f.a}</div>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  // FAQ accordion logic
  app.querySelectorAll(".faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const wasOpen = item.classList.contains("open");
      // Close all
      app
        .querySelectorAll(".faq-item.open")
        .forEach((el) => el.classList.remove("open"));
      // Toggle clicked
      if (!wasOpen) item.classList.add("open");
    });
  });
}

/* ============================================================
   404
   ============================================================ */
function render404(app) {
  app.innerHTML = `
    <div class="info-page" style="display:flex;align-items:center;justify-content:center;">
      <div style="text-align:center;">
        <h1 style="font-family:var(--font-display);font-size:80px;font-weight:800;opacity:.15;margin-bottom:var(--space-md);">404</h1>
        <h2 style="font-family:var(--font-display);font-size:24px;margin-bottom:var(--space-md);">Page Not Found</h2>
        <p style="color:var(--text-muted);margin-bottom:var(--space-xl);">The page you're looking for doesn't exist.</p>
        <a class="btn btn--primary" data-link="/">Go Home</a>
      </div>
    </div>
  `;
}

/* ============================================================
   DATA LOADERS
   ============================================================ */

async function loadMapData() {
  try {
    const p = await fetchJson("/api/scores");
    renderMap(p.scores || []);
  } catch {
    document.getElementById("map").innerHTML =
      '<p class="empty" style="padding:var(--space-xl);text-align:center;">Could not load map data.</p>';
  }
}

async function loadScoresData() {
  try {
    const p = await fetchJson("/api/scores");
    renderScoreCards(p.scores || []);
  } catch {
    document.getElementById("score-grid").innerHTML =
      '<p class="empty">Could not load scores.</p>';
  }
}

async function loadChartData() {
  try {
    const p = await fetchJson("/api/scores");
    renderChart(p.scores || []);
  } catch {}
}

async function loadBriefingData() {
  setupBriefingAudioPlayer();
  try {
    const [bp, sp] = await Promise.all([
      fetchJson("/api/briefing").catch(() => ({ briefing: null })),
      fetchJson("/api/scores").catch(() => ({ briefing: null })),
    ]);
    renderBriefing(bp.briefing || sp.briefing || null);
  } catch {
    renderBriefing(null);
  }
}

async function loadAlertsData() {
  try {
    const p = await fetchJson("/api/alerts");
    renderAlerts(p.alerts || []);
  } catch {
    document.getElementById("alert-feed").innerHTML =
      '<p class="empty">Could not load alerts.</p>';
  }
}

/* ============================================================
   RENDERERS (same logic as before, adapted)
   ============================================================ */
function renderGeneratedAt(date, generatedAt) {
  const el = document.getElementById("generated-at");
  if (!el) return;
  const time = new Date(generatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  el.textContent = `Snapshot ${date} at ${time}`;
}

function renderMap(scores) {
  const el = document.getElementById("map");
  if (!el) return;

  if (!map) {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
    }).setView([32.3668, -86.3], 12);
    applyMapTheme(getActiveTheme());
  }

  map.eachLayer((l) => {
    if (l instanceof L.Polygon) map.removeLayer(l);
  });

  scores.forEach((item) => {
    const boundary = item.boundary || FALLBACK_BOUNDARIES[item.name];
    if (!boundary) return;
    const color = colorByScore(item.score);
    L.polygon(boundary, {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.3,
    })
      .addTo(map)
      .bindPopup(
        `<strong>${item.name}</strong><br/>Score: ${item.score}<br/>Top: ${item.topIssues?.[0] || "None"}`,
      );
  });
}

function renderScoreCards(scores) {
  const grid = document.getElementById("score-grid");
  if (!grid) return;
  grid.innerHTML = "";

  scores
    .slice()
    .sort((a, b) => b.score - a.score)
    .forEach((item) => {
      const color = colorByScore(item.score);
      const trend =
        item.trend === "up"
          ? "↑ Up"
          : item.trend === "down"
            ? "↓ Down"
            : "→ Stable";
      const card = document.createElement("article");
      card.className = "score-card";
      card.innerHTML = `
      <div class="ring" style="background:conic-gradient(${color} ${item.score}%,var(--border) ${item.score}%);">
        <div class="ring-inner">${item.score}</div>
      </div>
      <div>
        <h3>${item.name}</h3>
        <p class="score-meta">Trend: ${trend} &nbsp;|&nbsp; Safety ${item.breakdown?.safety || "—"} &nbsp;|&nbsp; Service ${item.breakdown?.service || "—"}</p>
        <p class="score-issue">${item.topIssues?.[0] || "No major issues today."}</p>
      </div>
    `;
      grid.appendChild(card);
    });
}

function renderChart(scores) {
  const ctx = document.getElementById("score-chart");
  if (!ctx) return;
  const labels = scores.map((x) => x.name);
  const data = scores.map((x) => x.score);
  const gridColor = getThemeToken("--chart-grid", "rgba(17, 35, 63, 0.11)");
  const tickColor = getThemeToken("--chart-ticks", "#41597c");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Health Score",
          data,
          backgroundColor: data.map((s) => colorByScore(s) + "cc"),
          borderColor: data.map((s) => colorByScore(s)),
          borderWidth: 1.5,
          borderRadius: 10,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: gridColor },
          ticks: { color: tickColor },
        },
        x: {
          grid: { display: false },
          ticks: { color: tickColor, maxRotation: 0, minRotation: 0 },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderAlerts(alerts) {
  const feed = document.getElementById("alert-feed");
  if (!feed) return;
  feed.innerHTML = "";

  if (!alerts.length) {
    feed.innerHTML =
      '<p class="empty">No anomalies detected for this snapshot.</p>';
    return;
  }

  alerts.forEach((alert) => {
    const card = document.createElement("article");
    card.className = "alert-card";
    card.innerHTML = `
      <div class="alert-head">
        <small>${new Date(alert.detectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
        <span class="badge ${alert.severity}">${alert.severity}</span>
      </div>
      <h3 class="alert-title">${alert.title}</h3>
      <p class="alert-body">${alert.body}</p>
    `;
    feed.appendChild(card);
  });
}

function renderBriefing(briefing) {
  const status = document.getElementById("briefing-status");
  const script = document.getElementById("briefing-script");
  const cards = document.getElementById("briefing-cards");
  const play = document.getElementById("briefing-play");
  const audioStatus = document.getElementById("briefing-audio-status");
  const audio = document.getElementById("briefing-audio");

  if (!status) return;

  if (!briefing) {
    status.textContent = "Briefing not available yet.";
    script.innerHTML = "<p>Run the pipeline to generate today's briefing.</p>";
    cards.innerHTML = '<p class="empty">No cards available.</p>';
    if (play) {
      play.disabled = true;
      play.textContent = "Play";
    }
    if (audioStatus) audioStatus.textContent = "Audio unavailable";
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
    }
    return;
  }

  const source = briefing.source || "fallback";
  const duration = formatDuration(briefing.durationSeconds || 0);
  status.textContent = `${briefing.title} | ${duration} | Source: ${source}`;

  const hasAudio = Boolean(briefing.audio?.available && briefing.audio?.url);
  if (play) {
    play.disabled = !hasAudio;
    play.textContent = "Play briefing";
  }
  if (audioStatus)
    audioStatus.textContent = hasAudio
      ? `Audio ready via ${briefing.audio.provider || "provider"}`
      : "Audio unavailable";
  if (audio) {
    if (hasAudio) audio.src = briefing.audio.url;
    else {
      audio.removeAttribute("src");
      audio.load();
    }
  }

  script.innerHTML = `<p>${briefing.script || "No script available."}</p>`;
  cards.innerHTML = "";

  const headlineCards = Array.isArray(briefing.headlines)
    ? briefing.headlines.slice(0, 3)
    : [];
  if (!headlineCards.length) {
    cards.innerHTML = '<p class="empty">No cards available.</p>';
    return;
  }

  headlineCards.forEach((c) => {
    const node = document.createElement("article");
    node.className = "briefing-card";
    node.innerHTML = `
      <div class="briefing-head"><span class="briefing-icon">${c.icon || "📰"}</span><small>${c.category || "Update"}</small></div>
      <h3>${c.headline || "Daily update"}</h3>
      <p>${c.detail || "No details."}</p>
    `;
    cards.appendChild(node);
  });
}

function setupBriefingAudioPlayer() {
  if (briefingPlayerBound) return;
  const play = document.getElementById("briefing-play");
  const audio = document.getElementById("briefing-audio");
  if (!play || !audio) return;

  play.addEventListener("click", async () => {
    if (!audio.src) return;
    if (!audio.paused) {
      audio.pause();
      play.textContent = "Play briefing";
      return;
    }
    try {
      await audio.play();
      play.textContent = "Pause briefing";
    } catch {
      play.textContent = "Play briefing";
    }
  });
  audio.addEventListener("ended", () => {
    play.textContent = "Play briefing";
  });
  audio.addEventListener("pause", () => {
    if (!audio.ended) play.textContent = "Play briefing";
  });
  briefingPlayerBound = true;
}

/* ============================================================
   QUERY HANDLER
   ============================================================ */
async function handleQuerySubmit(event) {
  event.preventDefault();
  const input = document.getElementById("query-input");
  const output = document.getElementById("query-output");
  const query = input.value.trim();
  if (!query) return;

  output.innerHTML =
    '<p style="color:var(--brand);">Analyzing live sources...</p>';

  try {
    const data = await fetchJson(`/api/query?q=${encodeURIComponent(query)}`);
    const sources = Array.isArray(data.sources) ? data.sources : [];
    output.innerHTML = formatQueryAnswer(
      query,
      data.answer,
      data.confidence,
      sources,
    );
  } catch {
    output.innerHTML =
      '<div class="qr-error"><span class="qr-error__icon">⚠️</span><p>Query unavailable right now. Please retry shortly.</p></div>';
  }
}

/* ============================================================
   QUERY ANSWER FORMATTER
   ============================================================ */
function formatQueryAnswer(question, raw, confidence, sources) {
  if (!raw) return '<p class="qr-empty">No answer available.</p>';

  // Convert markdown bold **text** to <strong>
  let text = raw.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Replace [Context data], [Context], and [number] citations
  text = text.replace(
    /\[Context(?:\s+data)?\]/gi,
    '<sup class="qr-cite qr-cite--data" title="CivicPulse data">CD</sup>',
  );
  text = text.replace(/\[(\d+)\]/g, (_, n) => {
    const url = sources[parseInt(n) - 1];
    if (url)
      return `<sup class="qr-cite"><a href="${url}" target="_blank" rel="noopener noreferrer">${n}</a></sup>`;
    return `<sup class="qr-cite">${n}</sup>`;
  });

  // Build body HTML: split on double-newlines into blocks, then
  // detect list blocks vs prose blocks
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  let bodyHTML = "";

  for (const block of blocks) {
    const lines = block.split(/\n/).filter((l) => l.trim());
    // Check if this block is a list (lines starting with - or •)
    const listLines = lines.filter((l) => /^\s*[-•]\s/.test(l));
    if (
      listLines.length >= 2 ||
      (listLines.length === lines.length && listLines.length >= 1)
    ) {
      // Render as list; non-list lines before it become a paragraph
      const proseLines = [];
      const items = [];
      for (const line of lines) {
        if (/^\s*[-•]\s/.test(line)) {
          if (proseLines.length) {
            bodyHTML += `<p>${proseLines.join(" ").trim()}</p>`;
            proseLines.length = 0;
          }
          items.push(line.replace(/^\s*[-•]\s+/, "").trim());
        } else {
          if (items.length) {
            // line continuation of list context — treat as item
            items.push(line.trim());
          } else {
            proseLines.push(line.trim());
          }
        }
      }
      if (proseLines.length) {
        bodyHTML += `<p>${proseLines.join(" ").trim()}</p>`;
      }
      if (items.length) {
        bodyHTML += `<ul>${items.map((it) => `<li>${it}</li>`).join("")}</ul>`;
      }
    } else if (lines.length > 1) {
      // Multiple lines but not a list — join with <br>
      bodyHTML += `<p>${lines.map((l) => l.trim()).join("<br>")}</p>`;
    } else {
      bodyHTML += `<p>${block.trim()}</p>`;
    }
  }

  // Fallback: if no blocks were produced, split long prose into paragraphs
  if (!bodyHTML.trim()) {
    bodyHTML = splitIntoParagraphs(text);
  }

  // Confidence badge
  const confLevel = (confidence || "unknown").toLowerCase();
  const confClass =
    confLevel === "high"
      ? "qr-conf--high"
      : confLevel === "medium"
        ? "qr-conf--med"
        : "qr-conf--low";

  // Sources list
  let sourcesHTML = "";
  if (sources.length) {
    sourcesHTML = `
      <div class="qr-sources">
        <h4 class="qr-sources__title">📎 Sources</h4>
        <div class="qr-sources__list">
          ${sources
            .map((url, i) => {
              let domain = "";
              try {
                domain = new URL(url).hostname.replace("www.", "");
              } catch {
                domain = url;
              }
              return `<a class="qr-source" href="${url}" target="_blank" rel="noopener noreferrer">
              <span class="qr-source__num">${i + 1}</span>
              <span class="qr-source__domain">${domain}</span>
              <span class="qr-source__arrow">↗</span>
            </a>`;
            })
            .join("")}
        </div>
      </div>`;
  }

  // Generate unique ID for this answer's audio controls
  const qrId = "qr-" + Date.now();

  return `
    <div class="qr" id="${qrId}">
      <div class="qr__header">
        <span class="qr__label">AI Answer</span>
        <div class="qr__header-actions">
          <button class="qr-audio-btn" data-qr-id="${qrId}" title="Listen to answer" onclick="window.__qrToggleAudio(this)">
            <svg class="qr-audio-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.08"></path>
            </svg>
            <span class="qr-audio-label">Listen</span>
          </button>
          <span class="qr-conf ${confClass}">${confLevel} confidence</span>
        </div>
      </div>
      <div class="qr__body">${bodyHTML}</div>
      ${sourcesHTML}
    </div>`;
}

/* Global audio controller for query results */
(function () {
  let currentUtterance = null;
  let currentBtn = null;

  function updateBtn(btn, state) {
    const label = btn.querySelector(".qr-audio-label");
    const icon = btn.querySelector(".qr-audio-icon");
    btn.dataset.state = state;
    if (state === "playing") {
      label.textContent = "Pause";
      icon.innerHTML =
        '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
      btn.title = "Pause audio";
    } else if (state === "paused") {
      label.textContent = "Resume";
      icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
      btn.title = "Resume audio";
    } else {
      label.textContent = "Listen";
      icon.innerHTML =
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.08"></path>';
      btn.title = "Listen to answer";
    }
  }

  window.__qrToggleAudio = function (btn) {
    if (!window.speechSynthesis) return;
    const state = btn.dataset.state || "idle";

    if (state === "playing") {
      window.speechSynthesis.pause();
      updateBtn(btn, "paused");
      return;
    }

    if (state === "paused") {
      window.speechSynthesis.resume();
      updateBtn(btn, "playing");
      return;
    }

    // Start new playback — cancel any previous
    window.speechSynthesis.cancel();
    if (currentBtn && currentBtn !== btn) {
      updateBtn(currentBtn, "idle");
    }

    const qrEl = document.getElementById(btn.dataset.qrId);
    if (!qrEl) return;
    const bodyText = qrEl.querySelector(".qr__body").textContent;

    currentUtterance = new SpeechSynthesisUtterance(bodyText);
    currentUtterance.rate = 1.05;
    currentUtterance.pitch = 1;
    currentUtterance.onend = () => updateBtn(btn, "idle");
    currentUtterance.onerror = () => updateBtn(btn, "idle");
    currentBtn = btn;

    window.speechSynthesis.speak(currentUtterance);
    updateBtn(btn, "playing");
  };
})();

function splitIntoParagraphs(text) {
  const sentences = text.split(/(?<=\.)\s+(?=[A-Z**<])/);
  if (sentences.length <= 3) return `<p>${text}</p>`;

  const third = Math.ceil(sentences.length / 3);
  const chunks = [
    sentences.slice(0, third).join(" "),
    sentences.slice(third, third * 2).join(" "),
    sentences.slice(third * 2).join(" "),
  ].filter((c) => c.trim());

  return chunks.map((c) => `<p>${c.trim()}</p>`).join("");
}

/* ============================================================
   CHAT ENGINE (shared by FAB widget + voice feature page)
   ============================================================ */
const REPORT_KEYWORDS = [
  "report",
  "broken",
  "pothole",
  "street light",
  "light out",
  "dump",
  "graffiti",
  "trash",
  "sidewalk",
  "damage",
  "leak",
  "fire hydrant",
  "sign down",
  "flooding",
  "sewer",
  "noise",
  "abandoned",
];

function isServiceReport(text) {
  const lower = text.toLowerCase();
  return REPORT_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractAddress(text) {
  const m = text.match(
    /\b\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Circle|Pkwy|Hwy)\.?\b/i,
  );
  return m ? m[0] : null;
}

function guessIssueType(text) {
  const lower = text.toLowerCase();
  if (/pothole/.test(lower)) return "Pothole";
  if (/street\s*light|light\s*out/.test(lower)) return "Street Light Outage";
  if (/trash|dump|garbage/.test(lower)) return "Illegal Dumping";
  if (/graffiti/.test(lower)) return "Graffiti";
  if (/sidewalk/.test(lower)) return "Sidewalk Damage";
  if (/leak|water/.test(lower)) return "Water Leak";
  if (/sewer|drain/.test(lower)) return "Sewer/Drainage";
  if (/sign/.test(lower)) return "Sign Issue";
  if (/flood/.test(lower)) return "Flooding";
  if (/noise/.test(lower)) return "Noise Complaint";
  return "General Service Request";
}

function createChatEngine({ transcriptId, inputId, micId, sendId, statusId }) {
  const transcript = document.getElementById(transcriptId);
  const input = document.getElementById(inputId);
  const micBtn = document.getElementById(micId);
  const sendBtn = document.getElementById(sendId);
  const statusEl = statusId ? document.getElementById(statusId) : null;

  let listening = false;
  let recognition = null;
  let pendingReport = null; // state machine for multi-step ticket filing

  // Speech recognition setup
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      input.value = text;
      stopListening();
      send(text);
    };
    recognition.onerror = () => stopListening();
    recognition.onend = () => stopListening();
  }

  function startListening() {
    if (!recognition) {
      setStatus("Voice input not supported in this browser");
      return;
    }
    listening = true;
    micBtn.classList.add("chat-mic-btn--active");
    setStatus("🎤 Listening...");
    recognition.start();
  }

  function stopListening() {
    listening = false;
    micBtn.classList.remove("chat-mic-btn--active");
    setStatus("Ready");
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function addBubble(role, html) {
    const div = document.createElement("div");
    div.className = `bubble ${role}`;
    div.innerHTML = html;
    transcript.appendChild(div);
    transcript.scrollTop = transcript.scrollHeight;
    return div;
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    const plain = text.replace(/<[^>]+>/g, "");
    const utter = new SpeechSynthesisUtterance(plain);
    utter.rate = 1.05;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }

  async function handleReport(userText) {
    const type = guessIssueType(userText);
    const address = extractAddress(userText);

    if (!address) {
      // Ask for address
      pendingReport = { type, description: userText };
      const msg = `I'll file a <strong>${type}</strong> report for you. What's the street address?`;
      addBubble("ai", msg);
      speak(msg);
      return;
    }

    await fileTicket(type, address, userText);
  }

  async function fileTicket(type, address, description) {
    const thinking = addBubble(
      "ai",
      '<span class="chat-typing">Filing your report...</span>',
    );
    setStatus("Filing ticket...");

    try {
      const ticket = await fetchJson("/api/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          address,
          description,
          residentName: "Voice Agent User",
        }),
      });

      thinking.innerHTML = `
        <div class="ticket-result">
          <div class="ticket-result__header">✅ Ticket Filed Successfully</div>
          <div class="ticket-result__details">
            <div><strong>Ticket:</strong> ${ticket.ticketId}</div>
            <div><strong>Type:</strong> ${ticket.type}</div>
            <div><strong>Address:</strong> ${ticket.address}</div>
            <div><strong>Priority:</strong> ${ticket.priority}</div>
            <div><strong>Est. Resolution:</strong> ${ticket.estimatedResolution}</div>
          </div>
          <div class="ticket-result__footer">Is there anything else I can help with?</div>
        </div>`;
      speak(
        `Ticket ${ticket.ticketId} has been filed. Priority ${ticket.priority}. Estimated resolution: ${ticket.estimatedResolution}.`,
      );
    } catch {
      thinking.innerHTML =
        "Sorry, I couldn't file the ticket right now. Please try again.";
    }

    setStatus("Ready");
    pendingReport = null;
  }

  function formatChatAnswer(rawAnswer, confidence) {
    let text = (rawAnswer || "I don't have an answer for that right now.")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[Context(?:\s+data)?\]/gi, "")
      .replace(/\[\d+\]/g, "");

    // Split into lines, detect list items
    const lines = text.split(/\n/).filter((l) => l.trim());
    const listItems = [];
    const proseLines = [];
    for (const line of lines) {
      if (/^\s*[-•]\s/.test(line)) {
        listItems.push(line.replace(/^\s*[-•]\s+/, "").trim());
      } else {
        proseLines.push(line.trim());
      }
    }

    // Build concise output: short intro + up to 4 list items
    let bodyHTML = "";
    const intro = proseLines.slice(0, 2).join(" ").trim();
    if (intro) {
      const shortIntro =
        intro.length > 200 ? intro.slice(0, 197) + "..." : intro;
      bodyHTML += `<p>${shortIntro}</p>`;
    }

    const MAX_VISIBLE = 4;
    if (listItems.length) {
      const visible = listItems.slice(0, MAX_VISIBLE);
      bodyHTML += `<ul>${visible
        .map((it) => {
          const short = it.length > 120 ? it.slice(0, 117) + "..." : it;
          return `<li>${short}</li>`;
        })
        .join("")}</ul>`;
      if (listItems.length > MAX_VISIBLE) {
        const hiddenId = "chat-expand-" + Date.now();
        const hidden = listItems.slice(MAX_VISIBLE);
        bodyHTML += `<ul id="${hiddenId}" style="display:none">${hidden
          .map((it) => {
            const short = it.length > 120 ? it.slice(0, 117) + "..." : it;
            return `<li>${short}</li>`;
          })
          .join("")}</ul>`;
        bodyHTML += `<button class="chat-answer__expand" onclick="var el=document.getElementById('${hiddenId}');if(el.style.display==='none'){el.style.display='';this.textContent='Show less'}else{el.style.display='none';this.textContent='+ ${hidden.length} more'}">+ ${hidden.length} more</button>`;
      }
    } else if (!intro) {
      // No list, no prose lines → use raw truncated
      const plain = text.replace(/<[^>]+>/g, "");
      bodyHTML = `<p>${plain.length > 300 ? plain.slice(0, 297) + "..." : plain}</p>`;
    }

    // Confidence chip
    const conf = (confidence || "unknown").toLowerCase();
    const confCls =
      conf === "high" ? "high" : conf === "medium" ? "medium" : "low";

    // Audio button
    const audioId = "chat-audio-" + Date.now();

    return `<div class="chat-answer">
      <div class="chat-answer__text">${bodyHTML}</div>
      <div class="chat-answer__meta">
        <span class="chat-answer__conf chat-answer__conf--${confCls}">${conf}</span>
        <button class="chat-audio-btn" id="${audioId}" data-state="idle" title="Listen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.08"></path></svg>
          <span>Listen</span>
        </button>
      </div>
    </div>`;
  }

  async function handleQuestion(userText) {
    const thinking = addBubble(
      "ai",
      '<span class="chat-typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>',
    );
    setStatus("Thinking...");

    try {
      const data = await fetchJson(
        `/api/query?q=${encodeURIComponent(userText)}`,
      );
      thinking.innerHTML = formatChatAnswer(data.answer, data.confidence);

      // Wire up inline audio button
      const audioBtn = thinking.querySelector(".chat-audio-btn");
      if (audioBtn) {
        const plainText =
          thinking.querySelector(".chat-answer__text").textContent;
        let utter = null;
        audioBtn.addEventListener("click", () => {
          if (!window.speechSynthesis) return;
          const state = audioBtn.dataset.state;
          const label = audioBtn.querySelector("span");
          if (state === "playing") {
            window.speechSynthesis.pause();
            audioBtn.dataset.state = "paused";
            label.textContent = "Resume";
          } else if (state === "paused") {
            window.speechSynthesis.resume();
            audioBtn.dataset.state = "playing";
            label.textContent = "Pause";
          } else {
            window.speechSynthesis.cancel();
            utter = new SpeechSynthesisUtterance(plainText);
            utter.rate = 1.05;
            utter.pitch = 1;
            utter.onend = () => {
              audioBtn.dataset.state = "idle";
              label.textContent = "Listen";
            };
            utter.onerror = () => {
              audioBtn.dataset.state = "idle";
              label.textContent = "Listen";
            };
            window.speechSynthesis.speak(utter);
            audioBtn.dataset.state = "playing";
            label.textContent = "Pause";
          }
        });
      }
    } catch {
      thinking.innerHTML =
        "I'm having trouble answering right now. Please try again.";
    }

    setStatus("Ready");
  }

  async function send(text) {
    const msg = (text || input.value).trim();
    if (!msg) return;
    input.value = "";

    addBubble("user", msg);

    // If we're waiting for an address from a pending report
    if (pendingReport) {
      const address = extractAddress(msg) || msg;
      await fileTicket(pendingReport.type, address, pendingReport.description);
      return;
    }

    // Determine if this is a service report or a question
    if (isServiceReport(msg)) {
      await handleReport(msg);
    } else {
      await handleQuestion(msg);
    }
  }

  // Event listeners
  micBtn.addEventListener("click", () => {
    if (listening) {
      recognition?.stop();
      stopListening();
    } else startListening();
  });

  sendBtn.addEventListener("click", () => send());

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  setStatus("Ready — type or tap 🎙️ to speak");

  return { send };
}

/* ============================================================
   VOICE WIDGET (global FAB)
   ============================================================ */
function setupVoiceWidget() {
  const fab = document.getElementById("voice-fab");
  const widget = document.getElementById("voice-widget");
  const close = document.getElementById("voice-close");

  fab.addEventListener("click", () => {
    widget.classList.toggle("open");
    widget.setAttribute(
      "aria-hidden",
      widget.classList.contains("open") ? "false" : "true",
    );
  });

  close.addEventListener("click", () => {
    widget.classList.remove("open");
    widget.setAttribute("aria-hidden", "true");
  });

  // Initialize chat engine for the FAB widget
  createChatEngine({
    transcriptId: "voice-transcript",
    inputId: "voice-input",
    micId: "voice-mic",
    sendId: "voice-send",
    statusId: "voice-status",
  });
}

/* ============================================================
   SCROLL TO TOP
   ============================================================ */
function setupScrollTop() {
  const scrollTopBtn = document.getElementById("scroll-top");
  if (!scrollTopBtn) return;

  const onScroll = () => {
    scrollTopBtn.classList.toggle("visible", window.scrollY > 420);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ============================================================
   NAV BEHAVIOR
   ============================================================ */
function setupNav() {
  const nav = document.getElementById("nav");

  // Scroll effect
  const onScroll = () => {
    nav.classList.toggle("nav--scrolled", window.scrollY > 20);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile toggle
  const toggle = document.getElementById("mobile-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  toggle.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
  });
}

/* ============================================================
   GLOBAL LINK DELEGATION
   ============================================================ */
function setupLinks() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-link]");
    if (!el) return;
    e.preventDefault();
    navigate(el.dataset.link);
  });
}

/* ============================================================
   FEATURE TOUR
   ============================================================ */
let currentTourSlide = 0;
const totalTourSlides = 8;
let tourInitialized = false;

function openTour() {
  const overlay = document.getElementById("tour-overlay");
  if (!overlay) {
    console.warn("Tour overlay not found");
    return;
  }
  
  overlay.classList.add("tour-overlay--visible");
  document.body.style.overflow = "hidden";
  currentTourSlide = 0;
  updateTourSlide();
}

function closeTour() {
  const overlay = document.getElementById("tour-overlay");
  if (!overlay) return;
  
  overlay.classList.remove("tour-overlay--visible");
  document.body.style.overflow = "";
}

function updateTourSlide() {
  const slides = document.querySelectorAll(".tour-slide");
  const indicators = document.querySelectorAll(".tour-nav__dot");
  const nextBtn = document.getElementById("tour-next");
  
  // Update slides
  slides.forEach((slide, idx) => {
    slide.classList.toggle("tour-slide--active", idx === currentTourSlide);
  });
  
  // Update indicators
  indicators.forEach((dot, idx) => {
    dot.classList.toggle("tour-nav__dot--active", idx === currentTourSlide);
  });
  
  // Update next button text
  if (nextBtn) {
    nextBtn.textContent = currentTourSlide === totalTourSlides - 1 ? "Get Started" : "Next";
  }
}

function nextTourSlide() {
  if (currentTourSlide < totalTourSlides - 1) {
    currentTourSlide++;
    updateTourSlide();
  } else {
    closeTour();
  }
}

function prevTourSlide() {
  if (currentTourSlide > 0) {
    currentTourSlide--;
    updateTourSlide();
  }
}

function setupTour() {
  const guideButton = document.getElementById("guide-button");
  const closeButton = document.getElementById("tour-close");
  const skipButton = document.getElementById("tour-skip");
  const nextButton = document.getElementById("tour-next");
  const overlay = document.getElementById("tour-overlay");
  const indicators = document.querySelectorAll(".tour-nav__dot");
  
  // Open tour on Guide button click
  if (guideButton) {
    guideButton.addEventListener("click", (e) => {
      e.preventDefault();
      openTour();
    });
  }
  
  // Close tour
  if (closeButton) {
    closeButton.addEventListener("click", closeTour);
  }
  
  if (skipButton) {
    skipButton.addEventListener("click", closeTour);
  }
  
  // Next slide
  if (nextButton) {
    nextButton.addEventListener("click", nextTourSlide);
  }
  
  // Click indicator dots to jump to slide
  indicators.forEach((dot, idx) => {
    dot.addEventListener("click", () => {
      currentTourSlide = idx;
      updateTourSlide();
    });
  });
  
  // Close on overlay click (outside modal)
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeTour();
      }
    });
  }
  
  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("tour-overlay");
    if (!overlay || !overlay.classList.contains("tour-overlay--visible")) return;
    
    if (e.key === "Escape") {
      closeTour();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextTourSlide();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      prevTourSlide();
    }
  });
  
  tourInitialized = true;
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  setupThemeToggle();
  setupTour();
  setupNav();
  setupLinks();
  setupVoiceWidget();
  setupScrollTop();

  // Handle browser back/forward
  window.addEventListener("popstate", handleRoute);

  // Initial render
  handleRoute();
}

document.addEventListener("DOMContentLoaded", init);
