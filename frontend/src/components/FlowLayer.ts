import L from "leaflet";
import * as api from "../api";

/**
 * The sea in motion — an earth.nullschool-style particle field, drawn in the
 * chart's own ink so the paper map comes alive rather than turning into a
 * different product.
 *
 * Two canvases ride the Leaflet overlay pane:
 *   - an SST shade (repainted only when the field or view changes),
 *   - a particle canvas advecting ~1000 motes along the wind or surface
 *     current, with fading trails.
 *
 * Doctrine: this layer is pure decoration. It never carries safety
 * information, so it may pause (hidden tab), skip (reduced motion → one
 * static frame of streaks), or fail to fetch (drawn empty) without any
 * fallback machinery.
 */

export type FlowMode = "wind" | "current" | "off";

type Vec = { u: number; v: number } | null;

const WIND_RAMP: [number, string][] = [
  [5, "#8FB0C0"], [14, "#2A7391"], [24, "#1D7A50"], [34, "#63862B"], [999, "#B08000"],
];
const CUR_RAMP: [number, string][] = [
  [0.4, "#8FB0C0"], [0.9, "#2A7391"], [1.6, "#1D7A50"], [2.6, "#63862B"], [999, "#B08000"],
];
const SST_RAMP: [number, string][] = [
  [25.0, "#3E7A99"], [27.0, "#2F8A7D"], [28.5, "#7E9A4A"], [30.0, "#B08532"], [99, "#BF6A1F"],
];

function rampColor(ramp: [number, string][], v: number): string {
  for (const [limit, color] of ramp) if (v <= limit) return color;
  return ramp[ramp.length - 1][1];
}

const prefersStill = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface Particle {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
}

export class FlowLayer {
  private map: L.Map;
  private sstCanvas: HTMLCanvasElement;
  private flowCanvas: HTMLCanvasElement;
  private field: api.FlowField | null = null;
  private particles: Particle[] = [];
  private mode: FlowMode = "wind";
  private raf = 0;
  private fetchTimer = 0;
  private fetchSeq = 0;
  private destroyed = false;

  constructor(map: L.Map) {
    this.map = map;
    this.sstCanvas = this.makeCanvas("400");
    this.flowCanvas = this.makeCanvas("401");
    map.on("moveend zoomend resize", this.onViewChange);
    map.on("movestart zoomstart", this.pause);
    this.onViewChange();
  }

  private makeCanvas(z: string): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.style.position = "absolute";
    c.style.pointerEvents = "none";
    c.style.zIndex = z;
    this.map.getPanes().overlayPane.appendChild(c);
    return c;
  }

  setMode(mode: FlowMode) {
    this.mode = mode;
    if (mode === "off") {
      this.pause();
      this.clear(this.flowCanvas);
      this.clear(this.sstCanvas);
      return;
    }
    this.seed();
    this.repaintSst();
    this.run();
  }

  destroy() {
    this.destroyed = true;
    this.pause();
    window.clearTimeout(this.fetchTimer);
    this.map.off("moveend zoomend resize", this.onViewChange);
    this.map.off("movestart zoomstart", this.pause);
    this.sstCanvas.remove();
    this.flowCanvas.remove();
  }

  // ---------------------------------------------------------------- view
  private onViewChange = () => {
    if (this.destroyed) return;
    this.layoutCanvases();
    window.clearTimeout(this.fetchTimer);
    this.fetchTimer = window.setTimeout(() => this.fetchField(), 350);
  };

  private layoutCanvases() {
    const size = this.map.getSize();
    for (const c of [this.sstCanvas, this.flowCanvas]) {
      c.width = size.x;
      c.height = size.y;
      L.DomUtil.setPosition(c, this.map.containerPointToLayerPoint([0, 0]));
    }
  }

  private async fetchField() {
    if (this.destroyed || this.mode === "off") return;
    const seq = ++this.fetchSeq;
    const b = this.map.getBounds().pad(0.15);
    try {
      const f = await api.flowField(
        {
          minLat: b.getSouth(), maxLat: b.getNorth(),
          minLon: b.getWest(), maxLon: b.getEast(),
        },
        13,
        10,
      );
      if (this.destroyed || seq !== this.fetchSeq || !f.points.length) return;
      this.field = f;
      this.seed();
      this.repaintSst();
      this.run();
    } catch {
      /* decorative — nothing to do */
    }
  }

  // ---------------------------------------------------------------- field
  /**
   * Sea-ness at a point from the FINE mask (0..1 via bilinear over the 0/1
   * grid). The vector grid is far too coarse to know where the coast is;
   * this is what keeps particles off the land.
   */
  private seaAt(lat: number, lon: number): number {
    const f = this.field;
    if (!f?.mask || !f.mask_nx || !f.mask_ny) return 1;
    const { lats, lons } = f;
    const yf = ((lat - lats[0]) / (lats[lats.length - 1] - lats[0])) * (f.mask_ny - 1);
    const xf = ((lon - lons[0]) / (lons[lons.length - 1] - lons[0])) * (f.mask_nx - 1);
    if (yf < 0 || xf < 0 || yf > f.mask_ny - 1 || xf > f.mask_nx - 1) return 0;
    const y0 = Math.min(Math.floor(yf), f.mask_ny - 2);
    const x0 = Math.min(Math.floor(xf), f.mask_nx - 2);
    const ty = yf - y0;
    const tx = xf - x0;
    const at = (j: number, i: number) => (f.mask!.charCodeAt(j * f.mask_nx! + i) === 49 ? 1 : 0);
    return (
      (at(y0, x0) * (1 - tx) + at(y0, x0 + 1) * tx) * (1 - ty) +
      (at(y0 + 1, x0) * (1 - tx) + at(y0 + 1, x0 + 1) * tx) * ty
    );
  }

  /** Bilinear interpolation over the regular grid; null over land/no-data. */
  private sample(lat: number, lon: number): Vec {
    const f = this.field;
    if (!f) return null;
    const { lats, lons, nx, points } = f;
    const y0f = ((lat - lats[0]) / (lats[lats.length - 1] - lats[0])) * (lats.length - 1);
    const x0f = ((lon - lons[0]) / (lons[lons.length - 1] - lons[0])) * (lons.length - 1);
    if (y0f < 0 || x0f < 0 || y0f > lats.length - 1 || x0f > lons.length - 1) return null;
    const y0 = Math.min(Math.floor(y0f), lats.length - 2);
    const x0 = Math.min(Math.floor(x0f), lons.length - 2);
    const ty = y0f - y0;
    const tx = x0f - x0;

    const wind = this.mode === "wind";
    const get = (j: number, i: number): Vec => {
      const p = points[j * nx + i];
      if (!p || !p.sea) return null;
      const u = wind ? p.wind_u : p.cur_u;
      const v = wind ? p.wind_v : p.cur_v;
      if (u == null || v == null) return null;
      return { u, v };
    };
    // Weighted average over whichever corners actually have sea data. The
    // old all-four-corners rule cut the field off along whole grid cells,
    // leaving a saw-tooth edge kilometres offshore; this lets the flow run
    // up to the coast and die only where there is genuinely nothing left.
    const corners: [Vec, number][] = [
      [get(y0, x0), (1 - tx) * (1 - ty)],
      [get(y0, x0 + 1), tx * (1 - ty)],
      [get(y0 + 1, x0), (1 - tx) * ty],
      [get(y0 + 1, x0 + 1), tx * ty],
    ];
    let u = 0, v = 0, w = 0;
    for (const [c, wt] of corners) {
      if (c) {
        u += c.u * wt;
        v += c.v * wt;
        w += wt;
      }
    }
    if (w < 0.25) return null; // effectively over land
    return { u: u / w, v: v / w };
  }

  private randomSeaPoint(): { lat: number; lon: number } | null {
    const f = this.field;
    if (!f) return null;
    for (let tries = 0; tries < 16; tries++) {
      const lat = f.lats[0] + Math.random() * (f.lats[f.lats.length - 1] - f.lats[0]);
      const lon = f.lons[0] + Math.random() * (f.lons[f.lons.length - 1] - f.lons[0]);
      if (this.seaAt(lat, lon) >= 0.75 && this.sample(lat, lon)) return { lat, lon };
    }
    return null;
  }

  private seed() {
    const size = this.map.getSize();
    const count = Math.min(1100, Math.round((size.x * size.y) / 1300));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const p = this.randomSeaPoint();
      if (p) this.particles.push({ ...p, age: Math.random() * 80, maxAge: 60 + Math.random() * 60 });
    }
  }

  // ---------------------------------------------------------------- paint
  private clear(c: HTMLCanvasElement) {
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }

  /** SST at a point — weighted bilinear over sea corners of the coarse grid. */
  private sstAt(lat: number, lon: number): number | null {
    const f = this.field;
    if (!f) return null;
    const { lats, lons, nx, points } = f;
    const yf = ((lat - lats[0]) / (lats[lats.length - 1] - lats[0])) * (lats.length - 1);
    const xf = ((lon - lons[0]) / (lons[lons.length - 1] - lons[0])) * (lons.length - 1);
    if (yf < 0 || xf < 0 || yf > lats.length - 1 || xf > lons.length - 1) return null;
    const y0 = Math.min(Math.floor(yf), lats.length - 2);
    const x0 = Math.min(Math.floor(xf), lons.length - 2);
    const ty = yf - y0;
    const tx = xf - x0;
    let s = 0, w = 0;
    const acc = (j: number, i: number, wt: number) => {
      const p = points[j * nx + i];
      if (p?.sea && p.sst != null) {
        s += p.sst * wt;
        w += wt;
      }
    };
    acc(y0, x0, (1 - tx) * (1 - ty));
    acc(y0, x0 + 1, tx * (1 - ty));
    acc(y0 + 1, x0, (1 - tx) * ty);
    acc(y0 + 1, x0 + 1, tx * ty);
    return w > 0.2 ? s / w : null;
  }

  private repaintSst() {
    const f = this.field;
    const ctx = this.sstCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.sstCanvas.width, this.sstCanvas.height);
    if (!f || this.mode === "off") return;

    // Paint at the FINE mask's resolution (so the shade ends at the actual
    // coast), sampling temperature from the coarse grid, then let the
    // browser smooth it up to full size — the classic cheap-gradient trick.
    const mw = f.mask_nx ?? f.nx;
    const mh = f.mask_ny ?? f.ny;
    const mini = document.createElement("canvas");
    mini.width = mw;
    mini.height = mh;
    const mctx = mini.getContext("2d");
    if (!mctx) return;
    const latSpan = f.lats[f.lats.length - 1] - f.lats[0];
    const lonSpan = f.lons[f.lons.length - 1] - f.lons[0];
    for (let j = 0; j < mh; j++) {
      const lat = f.lats[0] + (latSpan * j) / (mh - 1);
      for (let i = 0; i < mw; i++) {
        const lon = f.lons[0] + (lonSpan * i) / (mw - 1);
        if (this.seaAt(lat, lon) < 0.5) continue;
        const sst = this.sstAt(lat, lon);
        if (sst == null) continue;
        mctx.fillStyle = rampColor(SST_RAMP, sst);
        mctx.fillRect(i, j, 1, 1);
      }
    }
    const nw = this.map.latLngToContainerPoint([f.lats[f.lats.length - 1], f.lons[0]]);
    const se = this.map.latLngToContainerPoint([f.lats[0], f.lons[f.lons.length - 1]]);
    ctx.globalAlpha = 0.26;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mini, nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    ctx.globalAlpha = 1;
  }

  private pause = () => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private run() {
    this.pause();
    if (this.mode === "off" || !this.field) return;
    if (prefersStill()) {
      this.drawStaticStreaks();
      return;
    }
    const tick = () => {
      this.step();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Reduced motion: the field as ~250 still streaks — informative, silent. */
  private drawStaticStreaks() {
    const ctx = this.flowCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.flowCanvas.width, this.flowCanvas.height);
    const scale = this.mode === "wind" ? 0.0016 : 0.011;
    const ramp = this.mode === "wind" ? WIND_RAMP : CUR_RAMP;
    ctx.lineWidth = 1.2;
    for (let n = 0; n < 250; n++) {
      const start = this.randomSeaPoint();
      if (!start) continue;
      let { lat, lon } = start;
      const first = this.sample(lat, lon);
      if (!first) continue;
      ctx.strokeStyle = rampColor(ramp, Math.hypot(first.u, first.v));
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      const p0 = this.map.latLngToContainerPoint([lat, lon]);
      ctx.moveTo(p0.x, p0.y);
      for (let s = 0; s < 10; s++) {
        const vec = this.sample(lat, lon);
        if (!vec) break;
        const nlat = lat + vec.v * scale;
        const nlon = lon + (vec.u * scale) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
        if (this.seaAt(nlat, nlon) < 0.45) break;
        lat = nlat;
        lon = nlon;
        const pt = this.map.latLngToContainerPoint([lat, lon]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private step() {
    const ctx = this.flowCanvas.getContext("2d");
    if (!ctx || !this.field) return;

    // fade existing trails
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0,0,0,0.96)";
    ctx.fillRect(0, 0, this.flowCanvas.width, this.flowCanvas.height);
    ctx.globalCompositeOperation = "source-over";

    const wind = this.mode === "wind";
    const scale = wind ? 0.00042 : 0.0028; // deg per (km/h · frame), tuned by eye
    const ramp = wind ? WIND_RAMP : CUR_RAMP;
    ctx.lineWidth = 1.15;

    for (const p of this.particles) {
      const vec = this.sample(p.lat, p.lon);
      p.age += 1;
      if (!vec || p.age > p.maxAge) {
        const np = this.randomSeaPoint();
        if (np) {
          p.lat = np.lat;
          p.lon = np.lon;
          p.age = 0;
          p.maxAge = 60 + Math.random() * 60;
        }
        continue;
      }
      const from = this.map.latLngToContainerPoint([p.lat, p.lon]);
      const nlat = p.lat + vec.v * scale;
      const nlon = p.lon + (vec.u * scale) / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
      // The step is only drawn if it STAYS at sea — a trail never runs ashore.
      if (this.seaAt(nlat, nlon) < 0.45) {
        p.age = p.maxAge + 1;
        continue;
      }
      p.lat = nlat;
      p.lon = nlon;
      const to = this.map.latLngToContainerPoint([p.lat, p.lon]);
      ctx.strokeStyle = rampColor(ramp, Math.hypot(vec.u, vec.v));
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
