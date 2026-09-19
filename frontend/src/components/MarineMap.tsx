import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import * as api from "../api";
import { FlowLayer, type FlowMode } from "./FlowLayer";
import type {
  FishingArea,
  GeofenceAlert,
  Language,
  Location,
  MarineAlert,
  PFZZone,
  PositionCheck,
  RouteOption,
  ZoneFeature,
} from "../types";
import { RATING_COLOR } from "./FishingPanel";
import { CompassMark } from "./glyphs";

/** Zone stroke colours; the fills are true chart hatching via CSS patterns. */
const ZONE_COLOR: Record<string, string> = {
  critical: "#AF2318",
  warning: "#BF4E12",
  info: "#2A7391",
};

const HINT: Record<Language, string> = {
  en: "Drag the boat to check any position",
  hi: "किसी भी स्थान की जाँच के लिए नाव खींचें",
  mr: "कोणतेही ठिकाण तपासण्यासाठी होडी ओढा",
};

const LEGEND: Record<Language, Record<string, string>> = {
  en: {
    symbols: "Symbols",
    veryGood: "Very good chance",
    some: "Some chance",
    noEntry: "Do not enter",
    course: "Safest course",
    storm: "Cyclone / warning area",
    marginL: "Indian coastal waters · scale varies",
    marginR: "Illustrative boundaries — not for navigation",
    flow: "Sea in motion",
    wind: "Wind",
    current: "Current",
    off: "Off",
    sstCool: "cool",
    sstWarm: "warm",
    sstLabel: "Sea temperature",
  },
  hi: {
    symbols: "संकेत",
    veryGood: "बहुत अच्छी संभावना",
    some: "कुछ संभावना",
    noEntry: "प्रवेश न करें",
    course: "सबसे सुरक्षित मार्ग",
    storm: "चक्रवात / चेतावनी क्षेत्र",
    marginL: "भारतीय तटीय जल · पैमाना बदलता है",
    marginR: "सांकेतिक सीमाएँ — नौवहन के लिए नहीं",
    flow: "बहता समुद्र",
    wind: "हवा",
    current: "धारा",
    off: "बंद",
    sstCool: "ठंडा",
    sstWarm: "गर्म",
    sstLabel: "समुद्री तापमान",
  },
  mr: {
    symbols: "खुणा",
    veryGood: "खूप चांगली शक्यता",
    some: "थोडी शक्यता",
    noEntry: "प्रवेश करू नका",
    course: "सर्वात सुरक्षित मार्ग",
    storm: "चक्रीवादळ / इशारा क्षेत्र",
    marginL: "भारतीय किनारी पाणी · प्रमाण बदलते",
    marginR: "सांकेतिक सीमा — नौकानयनासाठी नाही",
    flow: "वाहता समुद्र",
    wind: "वारा",
    current: "प्रवाह",
    off: "बंद",
    sstCool: "थंड",
    sstWarm: "उबदार",
    sstLabel: "समुद्र तापमान",
  },
};

const STATUS_STYLE: Record<PositionCheck["status"], string> = {
  clear: "bg-risk-low",
  warning: "bg-risk-high",
  critical: "bg-risk-extreme",
};

const SERIF = `'Fraunces Variable',Georgia,serif`;
const MONO = `'Spline Sans Mono Variable',Consolas,monospace`;

/**
 * Leaflet map presented as a chart sheet: paper margin, tick marks, double
 * neatline, compass rose, hatched danger areas, plotted courses.
 *
 * Custom divIcons throughout so we never depend on Leaflet's default marker
 * image assets, which break under bundlers and would 404 with no network.
 */
export default function MarineMap({
  origin,
  zones,
  pfz,
  areas = [],
  radiusKm,
  routes,
  geofence,
  alerts = [],
  language = "en",
  onPickLocation,
  focusRank,
  heightPx,
}: {
  origin: Location | null;
  zones: ZoneFeature[];
  pfz: PFZZone[];
  /** Scored fishing grounds — takes precedence over `pfz` when present. */
  areas?: FishingArea[];
  radiusKm?: number;
  routes: RouteOption[];
  geofence: GeofenceAlert[];
  /** Official warnings; those carrying `storm` geometry are drawn on the chart. */
  alerts?: MarineAlert[];
  /** Fixed map height (px) — the phone layout sizes the chart to the screen. */
  heightPx?: number;
  language?: Language;
  /** Tap anywhere on the water to move the fisher's position. */
  onPickLocation?: (lat: number, lon: number) => void;
  focusRank?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const boatRef = useRef<L.Marker | null>(null);
  const flowRef = useRef<FlowLayer | null>(null);
  const [flowMode, setFlowMode] = useState<FlowMode>("wind");
  const [probe, setProbe] = useState<PositionCheck | null>(null);
  const [dragging, setDragging] = useState(false);
  const mapHeight = heightPx ?? (areas.length ? 540 : 420);

  // Leaflet caches the container size, so tell it whenever the height changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(id);
  }, [mapHeight]);

  // ---- init once -------------------------------------------------------
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    // SVG renderer (not canvas): zone polygons take CSS pattern fills, and the
    // recommended course animates its dashes — neither works on canvas.
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([18.92, 72.6], 10);

    L.control.zoom({ position: "topleft" }).addTo(map);

    // OSM standard tiles — keyless and never watermarked. CARTO's free
    // basemaps started stamping "API KEY REQUIRED" over anonymous raster
    // tiles mid-demo-rehearsal; a basemap that can silently start demanding
    // a key is not acceptable on stage. The sepia tile filter in index.css
    // warms OSM's palette to match the paper.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    flowRef.current = new FlowLayer(map);
    flowRef.current.setMode("wind");
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      flowRef.current?.destroy();
      flowRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    flowRef.current?.setMode(flowMode);
  }, [flowMode]);

  // Tap-to-choose-position. Registered separately so the handler always closes
  // over the latest callback rather than the one from first render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPickLocation) return;
    const handler = (e: L.LeafletMouseEvent) =>
      onPickLocation(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4));
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onPickLocation]);

  // ---- redraw content --------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    boatRef.current = null;
    setProbe(null);

    const bounds: L.LatLngExpression[] = [];

    // search radius — shows exactly how far ORCA looked for grounds
    if (origin && radiusKm) {
      L.circle([origin.latitude, origin.longitude], {
        radius: radiusKm * 1000,
        color: "#2A7391",
        weight: 1.6,
        opacity: 0.75,
        dashArray: "2 7",
        fillColor: "#2A7391",
        fillOpacity: 0.03,
        interactive: false,
        className: "radius-drift",
      })
        .bindTooltip(`${radiusKm} km search area`, { permanent: false, direction: "top" })
        .addTo(group);
    }

    // restricted zones — hatched like chart danger areas
    zones.forEach((z) => {
      const ring = z.geometry.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number]);
      const severity = z.properties.severity in ZONE_COLOR ? z.properties.severity : "critical";
      const color = ZONE_COLOR[severity];
      L.polygon(ring, {
        color,
        weight: 2,
        dashArray: "9 5",
        className: `zone-hatch-${severity}`,
      })
        .bindPopup(
          `<b>${z.properties.name}</b><br/><span style="opacity:.75">${z.properties.zone_type.replace(/_/g, " ")}</span><br/><span style="font-size:10px;opacity:.6">${z.properties.note}</span>`,
        )
        .addTo(group);
    });

    // official warnings with geometry — the storm is DRAWN, not just recited
    alerts.forEach((al) => {
      const s = al.storm;
      if (!s) return;
      const isCyclone = al.type === "cyclone_warning";

      // warning area, hatched like every danger area on this chart
      L.circle([s.latitude, s.longitude], {
        radius: s.radius_km * 1000,
        color: "#AF2318",
        weight: 2,
        opacity: 0.9,
        dashArray: "10 6",
        className: "zone-hatch-critical",
        interactive: false,
      }).addTo(group);

      // past + forecast track with timestamped position dots
      const track = s.track ?? [];
      if (track.length > 1) {
        const line = track.map((p) => [p.latitude, p.longitude] as [number, number]);
        L.polyline(line, {
          color: "#AF2318",
          weight: 2.5,
          opacity: 0.85,
          dashArray: "3 7",
          className: "route-live",
        }).addTo(group);
        track.forEach((p) => {
          L.marker([p.latitude, p.longitude], {
            icon: L.divIcon({
              className: "",
              iconSize: [11, 11],
              iconAnchor: [5.5, 5.5],
              html: `<div style="width:11px;height:11px;border-radius:50%;background:#FBF7ED;
                       border:2.5px solid #AF2318;box-shadow:0 1px 4px rgba(18,33,45,.4)"></div>`,
            }),
          })
            .bindTooltip(p.label, { direction: "top", offset: [0, -6] })
            .addTo(group);
          bounds.push([p.latitude, p.longitude]);
        });
      }

      // the storm itself — the meteorological symbol, turning
      if (isCyclone) {
        L.marker([s.latitude, s.longitude], {
          zIndexOffset: 800,
          icon: L.divIcon({
            className: "",
            iconSize: [56, 56],
            iconAnchor: [28, 28],
            html: `<div class="storm-spin" style="width:56px;height:56px;
                        filter:drop-shadow(0 0 3px rgba(245,238,221,.95)) drop-shadow(0 2px 6px rgba(18,33,45,.35))">
                     <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
                       <path d="M28 5 A 23 23 0 0 1 51 28" stroke="#AF2318" stroke-width="6" stroke-linecap="round"/>
                       <path d="M28 51 A 23 23 0 0 1 5 28" stroke="#AF2318" stroke-width="6" stroke-linecap="round"/>
                       <circle cx="28" cy="28" r="10.5" fill="#AF2318"/>
                       <circle cx="28" cy="28" r="4" fill="#FBF7ED"/>
                     </svg>
                   </div>`,
          }),
        })
          .bindTooltip(al.headline, {
            permanent: true,
            direction: "top",
            offset: [0, -32],
            className: "storm-label",
          })
          .bindPopup(
            `<b>${al.headline}</b><br/>${al.detail}<br/>
             <span style="font-size:10px;opacity:.65">${al.source} · illustrative storm geometry — Demo / simulated</span>`,
          )
          .addTo(group);
      }
      bounds.push([s.latitude, s.longitude]);
    });

    // plotted courses (under the pins)
    routes.forEach((r) => {
      const line = r.legs.map((l) => [l.latitude, l.longitude] as [number, number]);
      line.forEach((p) => bounds.push(p));
      const rec = r.recommended;
      L.polyline(line, {
        color: rec ? "#1D7A50" : "#5D7386",
        weight: rec ? 4 : 2.5,
        opacity: rec ? 0.95 : 0.55,
        dashArray: rec ? "12 12" : "2 8",
        className: rec ? "route-live" : "",
      })
        .bindPopup(
          `<b>${r.name}</b><br/>${r.distance_km} km · ${Math.round(r.eta_minutes)} min<br/><span style="font-size:11px;opacity:.8">${r.notes}</span>`,
        )
        .addTo(group);
    });

    // fishing grounds as numbered buoys: paper face, rating-coloured ring,
    // rank set in the chart's serif, probability as a sounding beneath it.
    if (areas.length) {
      areas.forEach((a) => {
        const best = a.rank === 1;
        const size = best ? 46 : 38;
        const color = RATING_COLOR[a.rating];
        const focused = focusRank === a.rank;
        L.marker([a.latitude, a.longitude], {
          zIndexOffset: best ? 500 : 0,
          icon: L.divIcon({
            className: "",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            html: `<div class="bob" style="position:relative;width:${size}px;height:${size}px;
                        animation-delay:${((a.rank * 7) % 10) / 3}s">
                     ${focused ? `<div style="position:absolute;inset:-8px;border-radius:50%;
                        border:2px solid ${color};animation:ping2 1.6s cubic-bezier(0,0,.2,1) infinite"></div>` : ""}
                     <div class="buoy" style="position:absolute;inset:0;border-radius:50%;background:#FBF7ED;
                       border:${best ? 4 : 3.5}px solid ${color};display:flex;flex-direction:column;
                       align-items:center;justify-content:center;line-height:1;gap:1px;
                       box-shadow:0 3px 10px rgba(18,33,45,.4);color:#12212D">
                       <span style="font:${best ? "800 16px" : "700 14px"} ${SERIF}">${a.rank}</span>
                       <span style="font:600 ${best ? 8.5 : 8}px ${MONO};color:#42596D">${a.probability}%</span>
                     </div>
                   </div>`,
          }),
        })
          .bindPopup(
            `<b>Area ${a.rank}</b> — ${a.probability}% chance of fish<br/>
             ${Math.round(a.distance_km)} km ${a.bearing}<br/>
             SST ${a.sst_c ?? "—"} °C · chlorophyll ${a.chlorophyll_mg_m3 ?? "—"} mg/m³<br/>
             ${a.likely_species?.length ? `Likely: ${a.likely_species.join(", ")}<br/>` : ""}
             <span style="font-size:10px;opacity:.65">A likelihood from the data — never a guarantee of fish.</span>`,
          )
          .addTo(group);
        bounds.push([a.latitude, a.longitude]);
      });
    } else {
      pfz.forEach((z) => {
        const best = z.rank === 1;
        const size = best ? 40 : 32;
        const color = best ? "#1D7A50" : "#2A7391";
        L.marker([z.latitude, z.longitude], {
          icon: L.divIcon({
            className: "",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            html: `<div class="bob" style="width:${size}px;height:${size}px;animation-delay:${((z.rank * 7) % 10) / 3}s">
                     <div class="buoy" style="width:100%;height:100%;border-radius:50%;background:#FBF7ED;
                       border:${best ? 4 : 3}px solid ${color};display:grid;place-items:center;
                       color:#12212D;font:${best ? "800 16px" : "700 13px"} ${SERIF};
                       box-shadow:0 3px 10px rgba(18,33,45,.4)">${z.rank}</div>
                   </div>`,
          }),
        })
          .bindPopup(
            `<b>Fishing zone #${z.rank}</b><br/>${z.distance_km} km ${z.bearing}<br/>
             SST ${z.sst_c ?? "—"} °C · chlorophyll ${z.chlorophyll_mg_m3 ?? "—"} mg/m³<br/>
             confidence ${Math.round(z.confidence * 100)}%<br/>
             <span style="font-size:10px;opacity:.65">Potential zone — not a guarantee of fish.</span>`,
          )
          .addTo(group);
        bounds.push([z.latitude, z.longitude]);
      });
    }

    // draggable vessel — ink boat on a paper disc
    if (origin) {
      const boat = L.marker([origin.latitude, origin.longitude], {
        draggable: true,
        autoPan: true,
        icon: L.divIcon({
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          // Inline SVG rather than an emoji: emoji glyphs vary by OS and can
          // fail to render entirely on a projector/kiosk machine.
          html: `<div class="roll" style="position:relative;width:34px;height:34px;cursor:grab">
                   <div style="position:absolute;inset:-9px;border-radius:50%;
                     border:2px solid rgba(42,115,145,.6);
                     animation:ping2 2s cubic-bezier(0,0,.2,1) infinite"></div>
                   <div class="buoy" style="position:absolute;inset:0;border-radius:50%;background:#12212D;
                     border:2.5px solid #FBF7ED;box-shadow:0 3px 10px rgba(18,33,45,.5);
                     display:grid;place-items:center">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="#FBF7ED" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round">
                       <path d="M12 3v10"/><path d="M12 5l7 8H5l7-8z" fill="#FBF7ED" stroke="none"/>
                       <path d="M3 17c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0"/>
                     </svg>
                   </div>
                 </div>`,
        }),
      })
        .bindPopup(`<b>${origin.name}</b><br/>Drag me anywhere to check that position`)
        .addTo(group);

      boat.on("dragstart", () => setDragging(true));
      boat.on("dragend", async () => {
        setDragging(false);
        const { lat, lng } = boat.getLatLng();
        try {
          setProbe(await api.checkPosition(+lat.toFixed(4), +lng.toFixed(4)));
        } catch {
          setProbe(null);
        }
      });

      boatRef.current = boat;
      bounds.push([origin.latitude, origin.longitude]);
    }

    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds).pad(0.22), { animate: true });
    else if (origin) map.setView([origin.latitude, origin.longitude], 10, { animate: true });
  }, [origin, zones, pfz, areas, routes, radiusKm, focusRank, alerts]);

  // Fly to a ground when the user taps its card in the list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRank) return;
    const target = areas.find((a) => a.rank === focusRank);
    if (target) map.flyTo([target.latitude, target.longitude], 11, { duration: 0.8 });
  }, [focusRank, areas]);

  const critical = geofence.filter((g) => g.severity === "critical");
  const banner =
    probe != null
      ? { style: STATUS_STYLE[probe.status], text: probe.headline, sub: probeSub(probe) }
      : critical.length
        ? { style: STATUS_STYLE.critical, text: critical[0].message, sub: null }
        : null;

  return (
    <div className="chart-sheet">
      <div className="chart-frame">
        {/*
          The height is an inline style on purpose. Leaflet adds its own classes
          (leaflet-container, leaflet-touch, ...) to this element on mount; a
          conditional `className` makes React rewrite the whole class attribute
          when it changes, silently removing them. Without leaflet-container the
          library's CSS stops applying, the tile panes collapse to 0x0 and every
          tile renders at zero width — tiles download fine, the map just vanishes.
          React writes style properties individually, so this leaves classes alone.
        */}
        <div ref={containerRef} className="w-full" style={{ height: mapHeight }} />

        {/* compass rose, printed on the water */}
        <CompassMark
          size={62}
          className="pointer-events-none absolute right-3 top-3 z-[500] text-ink-800 opacity-70"
        />

        {/* the sea in motion — flow layer control */}
        <div className="absolute left-3 top-[92px] z-[500] rounded-[2px] border border-ink-700/50 bg-paper-50/95 px-2 pb-2 pt-1.5 shadow-md">
          <div className="mb-1 font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
            {(LEGEND[language] ?? LEGEND.en).flow}
          </div>
          <div className="flex gap-1">
            {(["wind", "current", "off"] as FlowMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setFlowMode(m)}
                className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold transition ${
                  flowMode === m
                    ? "border-ink-900 bg-ink-900 text-paper-50"
                    : "border-ink-700/30 text-ink-500 hover:text-ink-900"
                }`}
              >
                {(LEGEND[language] ?? LEGEND.en)[m]}
              </button>
            ))}
          </div>
        </div>

        {/* symbols legend, as a chart's key */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-[2px] border border-ink-700/50 bg-paper-50/95 px-3 pb-2 pt-1.5 shadow-md">
          <div className="mb-1 font-mono text-[8.5px] font-bold uppercase tracking-[0.16em] text-ink-400">
            {(LEGEND[language] ?? LEGEND.en).symbols}
          </div>
          {[
            ["#1D7A50", (LEGEND[language] ?? LEGEND.en).veryGood],
            ["#B08000", (LEGEND[language] ?? LEGEND.en).some],
          ].map(([c, label]) => (
            <div key={label} className="flex items-center gap-2 py-[1.5px] text-[10.5px] font-medium text-ink-700">
              <span
                className="h-2.5 w-2.5 rounded-full border-2 bg-paper-50"
                style={{ borderColor: c }}
              />
              {label}
            </div>
          ))}
          <div className="flex items-center gap-2 py-[1.5px] text-[10.5px] font-medium text-ink-700">
            <svg width="10" height="10" aria-hidden>
              <rect x="0.5" y="0.5" width="9" height="9" fill="url(#hatch-critical)" stroke="#AF2318" strokeWidth="1" />
            </svg>
            {(LEGEND[language] ?? LEGEND.en).noEntry}
          </div>
          <div className="flex items-center gap-2 py-[1.5px] text-[10.5px] font-medium text-ink-700">
            <svg width="12" height="6" aria-hidden>
              <line x1="0" y1="3" x2="12" y2="3" stroke="#1D7A50" strokeWidth="2" strokeDasharray="4 2.5" />
            </svg>
            {(LEGEND[language] ?? LEGEND.en).course}
          </div>
          {alerts.some((a) => a.storm) && (
            <div className="flex items-center gap-2 py-[1.5px] text-[10.5px] font-medium text-ink-700">
              <svg width="11" height="11" viewBox="0 0 56 56" fill="none" aria-hidden>
                <path d="M28 5 A 23 23 0 0 1 51 28" stroke="#AF2318" strokeWidth="9" strokeLinecap="round" />
                <path d="M28 51 A 23 23 0 0 1 5 28" stroke="#AF2318" strokeWidth="9" strokeLinecap="round" />
                <circle cx="28" cy="28" r="12" fill="#AF2318" />
              </svg>
              {(LEGEND[language] ?? LEGEND.en).storm}
            </div>
          )}
          {flowMode !== "off" && (
            <div
              className="mt-1 flex items-center gap-1.5 border-t pt-1 text-[9px] font-medium text-ink-500"
              style={{ borderColor: "var(--rule-faint)" }}
              title={(LEGEND[language] ?? LEGEND.en).sstLabel}
            >
              <span>{(LEGEND[language] ?? LEGEND.en).sstCool}</span>
              <span
                className="h-[5px] w-14 rounded-sm"
                style={{
                  background:
                    "linear-gradient(90deg,#3E7A99,#2F8A7D,#7E9A4A,#B08532,#BF6A1F)",
                }}
              />
              <span>{(LEGEND[language] ?? LEGEND.en).sstWarm}</span>
            </div>
          )}
        </div>

        {/* drag hint */}
        {origin && !probe && !dragging && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-[500] rounded-[2px] border border-ink-700/40 bg-paper-50/95 px-2.5 py-1.5 text-[10.5px] font-medium text-ink-700 shadow-md">
            {HINT[language] ?? HINT.en}
          </div>
        )}

        {/* live geofence banner */}
        {banner && (
          <div
            className={`absolute left-1/2 top-3 z-[500] max-w-[78%] -translate-x-1/2 animate-rise rounded-[2px] px-3.5 py-2 text-[12px] font-semibold text-paper-50 shadow-lg ${banner.style}`}
          >
            <div>{banner.text}</div>
            {banner.sub && (
              <div className="mt-0.5 font-mono text-[10px] font-normal opacity-85">{banner.sub}</div>
            )}
          </div>
        )}
      </div>

      {/* sheet margin note */}
      <div className="mt-[7px] flex items-baseline justify-between">
        <span className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          {(LEGEND[language] ?? LEGEND.en).marginL}
        </span>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-300">
          {(LEGEND[language] ?? LEGEND.en).marginR}
        </span>
      </div>
    </div>
  );
}

function probeSub(p: PositionCheck): string {
  const bits: string[] = [];
  if (p.distance_from_shore_km != null) bits.push(`${p.distance_from_shore_km} km offshore`);
  if (p.nearest_zone_name && p.nearest_zone_km != null && !p.inside_restricted_zone)
    bits.push(`${p.nearest_zone_name}: ${p.nearest_zone_km} km`);
  return bits.join(" · ");
}
