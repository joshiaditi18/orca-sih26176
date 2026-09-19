import type { ChatResponse, Language } from "../types";

const L: Record<Language, Record<string, string>> = {
  en: { wave: "Wave", wind: "Wind", sea: "Sea state", vis: "Visibility", sst: "Sea temp", rain: "Rain" },
  hi: { wave: "लहरें", wind: "हवा", sea: "समुद्र", vis: "दृश्यता", sst: "तापमान", rain: "वर्षा" },
  mr: { wave: "लाटा", wind: "वारा", sea: "समुद्र", vis: "दृश्यमानता", sst: "तापमान", rain: "पाऊस" },
};

/** Reads the traced evidence rows rather than duplicating any parsing. */
function findEvidence(res: ChatResponse, label: string): string | null {
  const row = res.evidence.find((e) => e.label.toLowerCase() === label.toLowerCase());
  return row ? row.value : null;
}

/** One instrument bank: six readings behind hairline dividers, like a bridge console. */
export default function ConditionsStrip({
  res,
  language = "en",
}: {
  res: ChatResponse;
  language?: Language;
}) {
  const t = L[language] ?? L.en;
  const tiles = [
    { label: t.wave, value: findEvidence(res, "Wave height"), accent: true },
    { label: t.wind, value: findEvidence(res, "Wind"), accent: true },
    { label: t.sea, value: findEvidence(res, "Sea state") },
    { label: t.rain, value: findEvidence(res, "Rain probability") },
    { label: t.vis, value: findEvidence(res, "Visibility") },
    { label: t.sst, value: findEvidence(res, "Sea surface temperature") },
  ];

  return (
    <div className="panel grid grid-cols-3 sm:grid-cols-6">
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          className={`min-w-0 px-3 py-2.5 ${i > 0 ? "border-l" : ""} ${
            tile.accent ? "bg-chart-100/40" : ""
          }`}
          style={{ borderColor: "var(--rule-faint)" }}
        >
          <div className="label truncate !text-[9px]">{tile.label}</div>
          <div className="mt-1 truncate font-mono text-[14.5px] font-bold tabular-nums leading-none text-ink-900">
            {tile.value ?? "—"}
          </div>
        </div>
      ))}
    </div>
  );
}
