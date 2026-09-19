# ORCA — session handoff

Everything a new session (or a teammate) needs to pick this up cold.
Last updated: **24 August 2026**.

---

## 1. Who and what

| | |
|---|---|
| Event | Smart India Hackathon 2026 — college internal round was **24 Aug 2026** |
| Team | **Team Random**, Team ID **U3M71E5U** |
| Problem statement | **SIH26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents** (ISRO, Software, theme *Miscellaneous*) |
| National idea deadline | **20 September 2026** |
| GitHub | https://github.com/SaudSatopay/orca-sih26176 (public, account `SaudSatopay`) |

**The pitch in one line:** ORCA is not a chatbot — it is a crew of ten cooperating
AI agents that turn India's marine data into one safe, explainable decision for a
fisher, in his own language.

---

## 2. Where everything lives

```
C:\Users\USER\Desktop\SIH\
├─ ORCA-SIH26176-Idea.pptx      Round-1 deck, FINAL (team details filled in)
├─ ORCA-SIH26176-Idea.pdf       PDF copy — the format the SIH portal accepts
├─ SIH-2026-Playbook.pdf        earlier problem-statement strategy brief
└─ orca\                        the application (git repo, pushed to GitHub)
   ├─ RUN-ORCA.bat              ONE-CLICK LAUNCH — double-click this
   ├─ start-orca.ps1 / dev.ps1  PowerShell equivalents
   ├─ README.md                 architecture, model docs, API table
   ├─ HANDOFF.md                this file
   ├─ backend\                  FastAPI + the ten agents
   └─ frontend\                 React + TypeScript + Tailwind + Leaflet
```

**Run it:** double-click `RUN-ORCA.bat`, or:

```bash
cd C:\Users\USER\Desktop\SIH\orca\backend; python -m uvicorn app.main:app --port 8000
```

Then open <http://127.0.0.1:8000>. Single process serves API *and* the built UI.
`cd backend; python smoke_test.py` runs all five demo scenarios headless.

Deep links: `/?tour=1` (guided walkthrough), `/?demo=safe|danger|cyclone|pfz|route`,
`/?tab=home|ask|authority|system`, `/?at=lat,lon` (pin the Today-tab position,
skips GPS), `/?lang=en|hi|mr` (force the UI language).

**Whole-app i18n (31 Aug 2026):** EVERY page is now trilingual — landing,
System/engine room, Authority, agent crew, guided-tour narration (17 steps ×3),
map legend/margins, header cells, scenario chips, route/warning cards. Pattern:
per-component `T`/`L10N` records keyed by `Language`; global switcher lives in
the header title block and on the landing (sets `langChoice`, same state the
chat toggle uses). Keep new UI strings in all three languages; Hindi/Marathi
postpositions go AFTER the number ("100 km च्या आत", not "च्या आत 100 km").

**Trip economics + return-by (same date, inspired by a rival team's app):**
`services/fishing.py::trip_economics` — fuel L/₹, catch band, revenue, profit
for the recommended ground, with the assumption string riding along (typical
FRP boat, 0.45 L/km, ₹100/L, ₹140/kg — deliberately conservative, always
labelled "planning estimate"). `/api/fishing` also stamps
`duration.return_by` ("HH:MM", end of safe window) + `return_reason_wave_m`.
Today tab renders a red "Be back before HH:MM — waves reach X m" band and a
four-tile economics panel.

**Sea in motion (31 Aug 2026, nullschool-style):** `GET /api/field?bbox&nx&ny`
returns a regular grid of wind u/v, surface-current u/v and SST, land-masked
via `is_on_land`. LIVE = ONE multi-location Open-Meteo Marine call (their
`current=` params include `ocean_current_velocity/direction` — currents ARE
available live, contrary to the older ocean-agent comment) + one Forecast
call, cached 10 min per rounded bbox (`field.clear_cache()` runs on mode
toggle — forgetting that left a stale fallback stuck once). DEMO = smooth
synthetic field from rehearsed conditions, labelled. Frontend:
`FlowLayer.ts` — two canvases in the overlay pane (SST shade repainted on
move; ~1000 particles advected with fading trails, ink-teal→green→amber by
speed). Wind FROM-convention, current TO-convention → u/v on the server.
Controls: "Sea in motion — Wind/Current/Off" chips on the map (localized),
SST cool→warm strip in the legend. Sampling is a **weighted average over
whichever bilinear corners have sea data** (threshold w<0.25 → null) on a
13×10 grid — requiring all four corners produced saw-tooth field edges
kilometres offshore, cut along coarse grid cells. The lenient sampler alone
then let trails run ONTO land, so the response also carries a **fine 44×32
land/sea mask** (pure-Python `is_on_land`, ~free) and the client clips
particles, spawns and the SST shade against `seaAt()` bilinear over that
mask — vectors from the coarse grid, coastline from the fine one. Keep the
two resolutions separate; neither substitute works alone. Pure decoration by doctrine: pauses in
hidden tabs (rAF), draws 250 static streaks under reduced motion, fails
silent. The in-app browser pane is a HIDDEN tab — rAF never ticks there, so
verify flow via headless virtual-time screenshots, not the pane.

**Species occurrence from OBIS / Map of Life (31 Aug 2026):** mapoflife.ai is
a brochure site and api.mol.org is 403 — but **api.obis.org is open and
keyless** (the ocean-biodiversity backbone MOL aggregates). ORCA bundles a
dated snapshot of occurrence counts for the six target species × four
coastal regions (`fishing.py::SPECIES_OCCURRENCE`, raw counts in the
comment, query script pattern in the commit). `likely_species` multiplies
the physics-band fit by `0.15 + 0.85·√(prevalence)` for the point's region
(`_coastal_region`) — that is why tarli headlines Kochi, bombil Mumbai and
hilsa (added as the sixth species) Bengal. Provenance surfaces in the
species tooltip, the `method` string and a fifth System-page provider card
("BUNDLED SNAPSHOT"). To refresh the snapshot later, re-run the OBIS count
queries and update the table + date.

**The phone app (31 Aug 2026):** small screens (≤640px, or `?m=1` to force /
`?m=0` to suppress) render `MobileApp.tsx` instead of the desktop console —
the fisher's own app, designed for low literacy: zero taps to the coloured
verdict circle, ONE tap on the giant LISTEN button to hear the whole plan
spoken (browsers require a gesture before TTS — that button IS the gesture),
big tap-cards (areas speak themselves and jump to the map), giant mic on the
Ask screen, three bottom tabs (Today · Map · Ask), never deeper. Reuses
/api/fishing, /api/chat and MarineMap (new `heightPx` prop). PWA manifest +
SVG icon in `frontend/public/` → Add to Home Screen opens standalone at
`/?m=1` — the bridge to Android. `?tab=map|ask`, `?lang`, `?at` work on
mobile too; `?debug=1` overlays a layout probe listing over-wide elements.

**Headless-screenshot gotcha #2:** headless Edge clamps windows to ~500px
wide and CROPS the PNG to the requested size — a 390px capture chops the
right edge and looks like overflow when the layout is fine. For real phone
captures use the iframe harness trick (a local page with a 375px iframe
pointing at the app) at window-size 500×870.

**Stale-bundle guard:** `main.py` now serves `index.html` with
`Cache-Control: no-store` — a browser tab from before a rebuild was silently
running old JS on stage (the "missing cyclone" report). Hashed /assets stay
cacheable. If a feature "disappears", hard-refresh first.

---

## 3. Current state — what is DONE

**Deck** — 6 slides in the official SIH template, ocean visual identity, team
details filled, app mockup on slide 2. Considered final.

**Backend** (FastAPI, only 4 dependencies: fastapi, uvicorn, pydantic, httpx)
- Ten agents: `intent, planner, weather, ocean, pfz, cyclone, gis, risk, route, explanation`.
  Independent specialists run concurrently via `ThreadPoolExecutor` in `agents/planner.py`.
- `services/risk_engine.py` — weighted model + **deterministic safety floors that can
  only raise a score**. An official IMD severe warning forces EXTREME.
- `services/fishing.py` — chance-of-fish model (chlorophyll 34%, SST 20%, front 16%,
  sea state 18%, time of day 12%) + trip-duration recommendation.
- `services/plain_language.py` — non-technical advice in EN/HI/MR.
- `services/route_optimizer.py` — A* on a risk-weighted grid; safest ≠ shortest.
- `data/geo.py` — **pure-Python** geospatial (haversine, ray-casting point-in-polygon,
  A*). No shapely/GEOS to fail on stage.
- `data/demo_store.py` — cached scenarios keyed by *hour of day* (so "tomorrow 6 AM"
  always resolves to the rehearsed sea state) with day-to-day drift for forecasts.

**Frontend** — a landing page plus three tabs:
- **Landing (front door, default)**: chart-styled hero with plotted-course art,
  live coastline stats (centres/warnings from `/api/authority/dashboard`),
  three feature cards, the four-phase "How ORCA decides" strip, honesty footer.
  Every deep link (`?tab`, `?demo`, `?tour`, `?at`) skips it; clicking the ORCA
  wordmark in the app header returns to it.
- **Today**: GPS auto-location, harbour picker, tap-map, 100 km radius,
  ranked fishing grounds — each with the five model-factor mini-bars and an
  indicative **likely-species** line (bangda/tarli/surmai…, from SST/chl bands
  in `services/fishing.py::likely_species`, labelled indicative, additive only:
  probabilities untouched) — plain-language advice, trip plan, 3-day outlook.
- **Ask ORCA**: multilingual chat, voice in/out, risk card, 24-h risk timeline,
  agent-crew panel, route options.
- **Authority**: every landing centre scored, auto-refreshing, with one-click
  CSV export of the board.
- **System (`?tab=system`, added 27 Aug 2026)**: the engine room — provider
  cards with pulsing status, the series-cache story (what live data we pull and
  what we do with it), the agent pipeline with signals travelling connectors,
  the safety floors stamped in red, and a **live feed** polling
  `GET /api/forecast` for one port every 7 s (cycling the PORTS gazetteer,
  newest-first log with source/mode/latency provenance). Component:
  `SystemPanel.tsx`; the guided tour visits it (now 17 steps).
- **Fish everywhere (same date)**: `FishGlyph`/`SchoolGlyph` in `glyphs.tsx`,
  a `.fish-drift` fixed layer of schools crossing upstream of the swell on every
  view, fish in the landing hero water, panel-header schools, species-line fish,
  chat empty state. All decorative, transform-only (`swim`, `schoolrun`).
- **README** was rebuilt as the public face (badges, screenshot gallery from
  `docs/*.png`, mermaid architecture, the live-data pipeline explained). The
  `docs/` screenshots are committed — regenerate with the headless-Edge
  `--force-prefers-reduced-motion` trick after visual changes.
- **Guided tour**: 17 auto-advancing narrated steps — also the demo fallback.

**Design identity (redesigned 24 Aug 2026)** — a "living nautical chart":
warm chart-paper background with graticule, bathymetric-contour and compass-rose
watermarks; marine-ink foreground; hairline rules; 2–3 px corner radii.
- Fonts (all self-hosted via `@fontsource-variable/*`, offline-safe):
  **Fraunces** display serif (verdicts, headings, buoy numbers, italic
  "sounding" percentages), **Archivo** body, **Spline Sans Mono** labels/data,
  **Noto Serif Devanagari** for hi/mr headings. Nirmala UI remains the
  Devanagari fallback in body/mono stacks.
- Component vocabulary in `index.css`: `.panel`, `.rule-double`, `.hd`,
  `.label`, `.btn-ink`, `.btn-line`, `.btn-square`, `.chip`, `.tab`, `.field`,
  `.stamp` (rotated rubber-stamp verdicts), `.hatch-danger`, `.sounding`,
  `.chart-sheet`/`.chart-frame` (the map's tick-marked neatline).
- The map: **OSM standard** tiles (sepia-filtered to match paper — do NOT
  switch back to CARTO: their anonymous raster tiles started stamping
  "API KEY REQUIRED" watermarks mid-rehearsal), SVG
  renderer (NOT canvas — required for the pattern fills), restricted zones use
  real SVG hatch patterns from `<ChartDefs/>` in App via classes
  `zone-hatch-{critical|warning|info}`, recommended route animates its dashes
  via class `route-live`, markers are paper-faced "buoys" with rating-coloured
  rings that match the list badges 1:1.
- All icons are inline SVGs in `components/glyphs.tsx` — **no emoji anywhere**
  (OS-dependent rendering). The ORCA mark is a compass rose whose needle is an
  orca fin.
- **Sea layer + motion doctrine (added 27 Aug 2026):** every screen stands in
  water — a blue wash rises from the foot of the body background and a
  `.sea-drift` element (three translucent swell layers drifting at different
  speeds) sits fixed behind all content. Motion is everywhere but obeys two
  rules: (1) decorative loops (buoy `bob` with staggered delays, boat `roll`,
  `wavecrawl` waterlines, `dashdrift` courses, compass sway) are transform-only
  and infinite; (2) anything that REVEALS content either uses keyframes with
  **no fill-mode** (`.grow-x` bars — if animations never run the bar is simply
  full) or state+transition with an rAF + timeout fail-safe AND a
  `prefers-reduced-motion` check (`Reveal`/`useCountUp` in `Landing.tsx` start
  at the end state for reduced-motion users). Never animate opacity with
  `fill-mode: both`. Hover grammar: cards `.lift`, rows lift + buoy badge
  `.badge-ping` ripple + sounding scales, buttons rise 1px and arrows nudge,
  tab underlines draw from the left (teal preview on inactive tabs).
  Screenshot tip: add `--force-prefers-reduced-motion` to headless Edge to
  capture finished end-states.

**Verified demo numbers (Mumbai):** area 1 = 80% at 31 km · best time 2–7 PM ·
stay ~3–4 h · trip ~8 h · 3-day outlook 82/84/79%.
Chat scenarios: Mumbai 06:00 → 70 HIGH, 12:00 → 37 MODERATE, Paradip → 92 EXTREME,
Goa → 9 LOW.

---

## 4. Design decisions to defend in Q&A

These are deliberate. Do not "simplify" them away.

1. **The LLM never decides safety.** Intent parsing is rule-based and multilingual;
   the score comes from a documented weighted model; deterministic floors override
   everything. No API key is needed for the whole demo to run.
2. **Two separate fishing numbers.** *Chance of fish* is a statement about the water
   and drives the numbering, so "area 1" always means best chance. *Trip value*
   discounts those odds by distance and picks the ground we route to and badge
   "Best trip" — a slightly better ground twice as far is usually wrong advice.
3. **Demo data is always labelled.** Synthetic values carry
   *"Demo / simulated data — not a live government feed"*. Never claim otherwise.
4. **INCOIS / IMD / MOSDAC have no open public JSON API.** Say this honestly.
   Open-Meteo Marine + Forecast are the verified live providers (keyless, tested
   working); the agencies slot in behind the same provider interface. Never label
   Open-Meteo output as INCOIS or IMD data.
5. **Restricted-zone polygons are illustrative**, not official maritime boundaries.
6. **A fishing ground inside a restricted zone is filtered out** before ranking —
   a good catch prediction that gets a fisher arrested is not a good recommendation.
7. **Risk bands:** LOW ≤25, MODERATE ≤50, HIGH ≤79, EXTREME 80+. EXTREME is reserved
   for official severe warnings / life-threatening seas so it always means
   "do not launch, no judgement call". (This deviates from the original spec's 76+;
   the deviation is intentional and documented.)

---

## 5. Bugs already fixed — do not reintroduce

| Bug | Lesson |
|---|---|
| **Map rendered empty** while tiles downloaded fine | A conditional `className` on the Leaflet container made React rewrite the class attribute and delete Leaflet's own classes (`leaflet-container`…), collapsing tile panes to 0×0. **Any DOM node handed to an imperative library must have a constant `className`** — drive size via inline `style`, and call `invalidateSize()` on change. |
| Safest route drew as a straight line through restricted zones | The naive "drop near-collinear points" simplifier flattened the detour. Uses **Douglas–Peucker** now, plus a guard that refuses to reintroduce a zone conflict. |
| Risk dial rendered **0** instead of 92 | `requestAnimationFrame` is suspended in hidden/non-compositing tabs. Animation is decoration; the number is safety information — there is a `setTimeout` fail-safe that snaps to the final value. |
| Agent-trace rows invisible | Staggered entrance animation with `fill-mode: both` leaves rows at opacity 0 if animations never run. Per-row stagger removed. **Follow-through:** every entrance keyframe (`rise`, `stampIn`) is now transform-only — opacity never animates, so nothing can be left invisible. Keep it that way. |
| Nearest fishing ground ranked **worst** | It had the best chlorophyll but `sst_delta = 0` → no thermal front → near-zero front factor. Ground profiles now model productive water closer in. |
| Marathi question answered in English | The UI was forcing its language selection over server-side detection. Language is now auto-detected unless the user explicitly clicks EN/हिं/मरा. |
| PFZ #1 sat inside the naval exclusion zone | Added the restricted-zone filter to `pfz_agent`. |
| `RUN-ORCA.bat` printed ECHO help text | A batch `echo` line must never start with `/?`. Use full URLs. |
| **LIVE mode looked broken** — Today tab hung ~10 s, risk timeline ~32 s, and values kept falling back to demo | `live_client` made a fresh HTTPS call per agent per hour per port (timeline = 48 sequential requests, safe-window scan = 28, authority board = 20 every 30 s poll) even though ONE Open-Meteo response already contains 3 days of hourly data. The burst also got the IP throttled → silent demo fallbacks. Fixed with a TTL cache of the full hourly series per (provider, ~km-rounded position) in `data/live_client.py` (10 min for hits, 60 s for failures so offline live-mode fails fast, cleared on mode toggle). After: fishing 1.4 s cold, timeline 0.02 s warm, authority 0.01 s repeat. **Don't add per-hour fetching back.** |

| **Cyclone verdict said EXTREME but the map showed a calm coast** | Alerts were text-only: no geometry from the backend, no warning layer on the map. Demo-store alerts now carry an illustrative `storm` object (centre, `radius_km`, timestamped `track`) which flows through the cyclone agent untouched (`ChatResponse.alerts` is `List[Dict]`); `MarineMap` gained an `alerts` prop that draws a hatched warning circle, the dashed past/forecast track with labelled position dots, a **spinning meteorological storm symbol** (`.storm-spin`, transform-only) and a permanent chart annotation (`.storm-label`). Squall warnings (Mumbai, Digha) get a circle only — the spiral is reserved for `type == "cyclone_warning"`. Storm geometry is labelled illustrative/simulated in the popup, and renders in LIVE mode too (warnings have no live provider — they come from the demo store either way). |
| **Fishing grounds rendered on land** (tap near Bhavnagar → markers inland across Saurashtra) | Candidates were fanned around the nearest port's hard-coded `shore_bearing` (Veraval's 200° is wrong from inside the Gulf of Khambhat) and nothing anywhere tested land vs sea. Fix in `geo.py`: a simplified pure-Python landmass polygon set (mainland + Andaman + Sri Lanka, ±10-20 km in deltas, honesty-noted) with `is_on_land()` and `seaward_bearing()` (picks the compass direction with the most open water, tie-broken toward the port prior so rehearsed layouts don't move). `pfz_zones` now fans around that axis and slides any on-land candidate along its distance arc into water or drops it. Distance is preserved, and probability/ranking never used bearing, so all rehearsed numbers are unchanged (verified). The boat-drag position check also says "That position is on land" now. |

Also know: in LIVE mode the **ocean agent always reports `degraded` (amber)** —
that is honest labelling, not a failure: Open-Meteo Marine has no surface-current
field, so the current comes from demo data and the agent says so. Wave/SST are
genuinely live (check the evidence table's source column).

---

## 6. Environment quirks on this machine

- **PowerShell, not bash.** No `&&`, no ternary. Use `;` and `if ($?)`.
- **Multi-line strings:** PowerShell here-strings (`@'…'@`) have repeatedly mangled
  git commit messages. Write the message to a file and use `git commit -F <file>`.
- **git/gh write to stderr**, which PowerShell surfaces as a red error even on
  success. Check the actual output (`main -> main`) before believing a failure.
- **`gh` is installed and authenticated** as `SaudSatopay` with `repo` scope.
- **Screenshots:** the in-app Browser pane does not composite, so
  `mcp__Claude_Browser__computer screenshot` fails. Use headless Edge instead:
  `msedge --headless=new --disable-gpu --screenshot=out.png --window-size=W,H
  --virtual-time-budget=15000 <url>`. Note that under virtual time, `rAF`-driven
  animations may capture mid-flight — verify real values via `javascript_tool`.
- **Rendering PPTX/PDF:** LibreOffice is absent; PowerPoint COM automation works
  (`New-Object -ComObject PowerPoint.Application`) for export and slide images.
- **Stop a stuck server:**
  `Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- After editing backend code, **restart uvicorn** (it runs without `--reload`).
  After editing frontend code, **`npm run build`** — the backend serves `frontend/dist`.
  `frontend/dist` is committed on purpose so `RUN-ORCA.bat` works without npm.

---

## 7. Sensible next steps

Not started, roughly in order of value:

1. **Species-specific predictions** — mackerel/sardine/pomfret have different SST bands;
   the model already has the shape for it.
2. **Offline PWA install** + service-worker caching, so the app opens at sea.
3. **SMS / IVR fallback** for feature phones — the real last mile.
4. **Train the risk model** (XGBoost) on historical incident data instead of the
   documented weighted baseline. Currently claimed honestly as future work.
5. **Real INCOIS/IMD ingestion** via bulletin parsing or a data-sharing arrangement.
6. **Tide and moon phase** as fishing-model inputs.
7. Deploy somewhere public (Render/Railway + Vercel) for the national round.

---

## 8. Pitch script that maps to the current build

1. Open on the landing page — *"ten agents read the sea, one safe explainable
   decision"* — then click **Open ORCA**: *"it already knows where he is, and
   it has already read the sea."*
2. Point at the plain-language panel — *"no jargon: do not enter the red area between
   2 and 6 PM, areas 1, 2, 3 are your best chances, stay about three hours."*
3. Ask in Marathi (Ask ORCA tab, scenario 2) — Marathi in, Marathi out, 70/100 HIGH.
4. Follow up *"दुपारी १२ वाजता काय?"* — context kept, drops to MODERATE.
5. Scenario 3 (Paradip) — **official warning overrides the model**, forced EXTREME.
6. Scenario 5 — safest route detours around the naval area; hand a judge the mouse
   and let them **drag the boat** into the red zone.
7. Authority tab — same engine, district scale.
8. Close: *"Built entirely on India's own data infrastructure. Every number carries
   its source. ORCA is decision support — it never replaces an official advisory."*
