import { useEffect, useState } from "react";
import * as api from "../api";
import type { AuthorityDashboard, Language } from "../types";
import { RISK_COLOR } from "./RiskDial";

const T: Record<Language, Record<string, string>> = {
  en: {
    centres: "Landing centres",
    extreme: "Extreme risk",
    high: "High risk",
    warnings: "Official warnings",
    board: "Coastal risk board",
    refresh: "refreshes every 30 s",
    export: "Export CSV",
    hCentre: "Landing centre",
    hState: "State",
    hRisk: "Risk",
    hWave: "Wave",
    hWind: "Wind",
    hWarning: "Active warning",
    loading: "Loading coastline…",
  },
  hi: {
    centres: "लैंडिंग सेंटर",
    extreme: "अत्यधिक जोखिम",
    high: "उच्च जोखिम",
    warnings: "आधिकारिक चेतावनियाँ",
    board: "तटीय जोखिम बोर्ड",
    refresh: "हर 30 सेकंड में ताज़ा",
    export: "CSV निर्यात",
    hCentre: "लैंडिंग सेंटर",
    hState: "राज्य",
    hRisk: "जोखिम",
    hWave: "लहर",
    hWind: "हवा",
    hWarning: "सक्रिय चेतावनी",
    loading: "तटरेखा लोड हो रही है…",
  },
  mr: {
    centres: "लँडिंग सेंटर",
    extreme: "अत्यंत धोका",
    high: "जास्त धोका",
    warnings: "अधिकृत इशारे",
    board: "किनारी धोका फलक",
    refresh: "दर ३० सेकंदांनी ताजे",
    export: "CSV निर्यात",
    hCentre: "लँडिंग सेंटर",
    hState: "राज्य",
    hRisk: "धोका",
    hWave: "लाट",
    hWind: "वारा",
    hWarning: "सक्रिय इशारा",
    loading: "किनारपट्टी लोड होत आहे…",
  },
};

/** The board as a CSV file — the format an administration actually circulates. */
function exportCsv(data: AuthorityDashboard) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Landing centre", "State", "Risk score", "Category", "Official warning",
     "Wave (m)", "Wind (km/h)", "Active warning"].join(","),
    ...data.locations.map((r) =>
      [q(r.name), q(r.state), r.risk_score, r.risk_category,
       r.official_warning ? "YES" : "", r.wave_height_m ?? "",
       r.wind_speed_kmh ?? "", q(r.headline)].join(","),
    ),
    "",
    q(`Generated ${data.generated_at} IST by ORCA (SIH26176). Demo / simulated data is labelled — this sheet is decision support, not an official advisory.`),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([rows], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `orca-coastal-risk-board-${data.generated_at.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The district-administration view: every monitored landing centre, ranked by
 * risk. Same engine, same evidence — one screen that shows ORCA scales beyond
 * a single fisher to the people who issue the warnings.
 */
export default function AuthorityPanel({ language = "en" }: { language?: Language }) {
  const t = T[language] ?? T.en;
  const [data, setData] = useState<AuthorityDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .authority()
        .then((d) => alive && setData(d))
        .catch((e) => alive && setError(String(e)));
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (error)
    return <div className="panel p-6 text-sm text-risk-extreme">Failed to load: {error}</div>;
  if (!data) return <div className="panel p-6 text-sm italic text-ink-400">{t.loading}</div>;

  const tiles = [
    { key: "monitored", label: t.centres, color: "#1E5F7A" },
    { key: "extreme", label: t.extreme, color: RISK_COLOR.EXTREME },
    { key: "high", label: t.high, color: RISK_COLOR.HIGH },
    { key: "official_warnings", label: t.warnings, color: "#A17000" },
  ];

  return (
    <div className="space-y-4">
      <div className="panel grid grid-cols-2 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <div
            key={t.key}
            className={`px-5 py-4 ${i > 0 ? "border-l" : ""}`}
            style={{ borderColor: "var(--rule-faint)" }}
          >
            <div
              className="font-display text-[34px] font-black leading-none tabular-nums"
              style={{ color: t.color }}
            >
              {data.summary[t.key] ?? 0}
            </div>
            <div className="label mt-1.5">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="panel rule-double overflow-hidden">
        <div className="hd">
          <span className="label">{t.board}</span>
          <span className="flex items-center gap-3">
            <span className="font-mono text-[10px] tabular-nums text-ink-400">
              {data.generated_at.slice(0, 16).replace("T", " ")} IST · {t.refresh}
            </span>
            {/* The day's advisory board as a file the administration can circulate. */}
            <button
              onClick={() => exportCsv(data)}
              className="btn-line !px-2.5 !py-1 !text-[9.5px]"
              title="Download the board as a CSV advisory sheet"
            >
              {t.export}
            </button>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--rule-strong)" }}>
                {[t.hCentre, t.hState, t.hRisk, t.hWave, t.hWind, t.hWarning].map((h, i) => (
                  <th
                    key={h}
                    className={`py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-400 ${
                      i === 0 ? "pl-4 pr-3" : i === 5 ? "px-4" : "px-3"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.locations.map((row) => {
                const color = RISK_COLOR[row.risk_category];
                return (
                  <tr
                    key={row.name}
                    className="border-b transition last:border-0 hover:bg-paper-150"
                    style={{ borderColor: "var(--rule-faint)" }}
                  >
                    <td className="py-2.5 pl-4 pr-3 font-display text-[13.5px] font-bold text-ink-900">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 text-ink-500">{row.state}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[13px] font-bold tabular-nums"
                          style={{ color }}
                        >
                          {row.risk_score}
                        </span>
                        <span
                          className="border px-1.5 py-px font-mono text-[8.5px] font-bold tracking-wider"
                          style={{ color, borderColor: color }}
                        >
                          {row.risk_category}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-ink-800">
                      {row.wave_height_m ?? "—"} m
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-ink-800">
                      {row.wind_speed_kmh ?? "—"} km/h
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-[12px] text-ink-500">
                      {row.headline ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
