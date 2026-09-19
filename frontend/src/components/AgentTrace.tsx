import type { AgentTrace as Trace, Language } from "../types";

const LABEL: Record<Language, Record<string, string>> = {
  en: {
    intent: "Intent", weather: "Weather", ocean: "Ocean", pfz: "Fishing zones",
    cyclone: "Alerts", gis: "GIS", risk: "Risk engine", route: "Route",
    explanation: "Explanation",
  },
  hi: {
    intent: "आशय", weather: "मौसम", ocean: "समुद्र", pfz: "मत्स्य क्षेत्र",
    cyclone: "चेतावनियाँ", gis: "GIS", risk: "रिस्क इंजन", route: "मार्ग",
    explanation: "व्याख्या",
  },
  mr: {
    intent: "हेतू", weather: "हवामान", ocean: "समुद्र", pfz: "मासेमारी क्षेत्रे",
    cyclone: "इशारे", gis: "GIS", risk: "रिस्क इंजिन", route: "मार्ग",
    explanation: "स्पष्टीकरण",
  },
};

const T: Record<Language, Record<string, string>> = {
  en: {
    crew: "Agent crew",
    agents: "agents",
    total: "ms total",
    concurrent: "CONCURRENT",
    understand: "Understand", understandN: "parse the question",
    gather: "Gather", gatherN: "specialists run in parallel",
    decide: "Decide", decideN: "fuse evidence, plan",
    explain: "Explain", explainN: "answer in the user's language",
    note: "The planner decides which specialists a question needs and runs the independent ones concurrently. The risk engine waits for all of them — no agent's opinion can skip it.",
  },
  hi: {
    crew: "एजेंट टीम",
    agents: "एजेंट",
    total: "ms कुल",
    concurrent: "एक साथ",
    understand: "समझो", understandN: "सवाल परखो",
    gather: "जुटाओ", gatherN: "विशेषज्ञ एक साथ चलते हैं",
    decide: "तय करो", decideN: "प्रमाण जोड़ो, योजना बनाओ",
    explain: "समझाओ", explainN: "उपयोगकर्ता की भाषा में जवाब",
    note: "प्लानर तय करता है कि किस सवाल के लिए कौन से विशेषज्ञ चाहिए और स्वतंत्र एजेंटों को एक साथ चलाता है। रिस्क इंजन सबका इंतज़ार करता है — कोई भी एजेंट इसे लाँघ नहीं सकता।",
  },
  mr: {
    crew: "एजंट टीम",
    agents: "एजंट",
    total: "ms एकूण",
    concurrent: "एकाच वेळी",
    understand: "समजून घ्या", understandN: "प्रश्न पारखा",
    gather: "गोळा करा", gatherN: "तज्ज्ञ एकाच वेळी चालतात",
    decide: "ठरवा", decideN: "पुरावे जोडा, योजना करा",
    explain: "समजावा", explainN: "वापरकर्त्याच्या भाषेत उत्तर",
    note: "प्लॅनर ठरवतो की प्रश्नाला कोणते तज्ज्ञ हवेत आणि स्वतंत्र एजंटांना एकाच वेळी चालवतो. रिस्क इंजिन सर्वांची वाट पाहते — कोणताही एजंट ते टाळू शकत नाही.",
  },
};

/** The graph, as it actually executes. */
const PHASES: { key: string; agents: string[] }[] = [
  { key: "understand", agents: ["intent"] },
  { key: "gather", agents: ["weather", "ocean", "pfz", "cyclone", "gis"] },
  { key: "decide", agents: ["risk", "route"] },
  { key: "explain", agents: ["explanation"] },
];

const STATUS_DOT: Record<Trace["status"], string> = {
  ok: "#1D7A50",
  degraded: "#A17000",
  failed: "#AF2318",
  skipped: "#82949F",
};

/**
 * The crew manifest — the panel that proves ORCA is a crew rather than a
 * single prompt. Grouped by execution phase so the parallel fan-out is
 * visible, with real measured latencies, set like a ship's log.
 */
export default function AgentTracePanel({
  trace,
  elapsed,
  language = "en",
}: {
  trace: Trace[];
  elapsed?: number;
  language?: Language;
}) {
  if (!trace.length) return null;
  const t = T[language] ?? T.en;
  const labels = LABEL[language] ?? LABEL.en;

  const byName = new Map(trace.map((x) => [x.agent, x]));
  const maxLatency = Math.max(...trace.map((x) => x.latency_ms), 1);
  const ran = PHASES.map((p) => ({
    ...p,
    title: t[p.key],
    note: t[`${p.key}N`],
    rows: p.agents.map((a) => byName.get(a)).filter(Boolean) as Trace[],
  })).filter((p) => p.rows.length);

  return (
    <div className="panel overflow-hidden">
      <div className="hd">
        <span className="label">{t.crew}</span>
        <span className="font-mono text-[10px] tabular-nums text-ink-400">
          {trace.length} {t.agents} · {elapsed ?? trace.reduce((s, x) => s + x.latency_ms, 0)}{" "}
          {t.total}
        </span>
      </div>

      <div className="space-y-3.5 px-4 py-3.5">
        {ran.map((phase) => (
          <div key={phase.key}>
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="font-display text-[13px] font-bold text-ink-900">{phase.title}</span>
              <span className="text-[10.5px] italic text-ink-400">{phase.note}</span>
              {phase.key === "gather" && phase.rows.length > 1 && (
                <span className="ml-auto border border-chart-500/50 bg-chart-100/50 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wide text-chart-700">
                  ∥ {phase.rows.length} {t.concurrent}
                </span>
              )}
            </div>

            <div
              className={
                phase.key === "gather"
                  ? "space-y-1 border-l-2 border-chart-500/40 pl-2.5"
                  : "space-y-1"
              }
            >
              {phase.rows.map((row) => {
                return (
                  // Deliberately NOT per-row entrance-animated. A staggered
                  // animation with fill-mode:both leaves rows at opacity 0 if
                  // animations never run (hidden tab, reduced motion, some
                  // projectors) — and an invisible agent trace during a demo,
                  // or invisible safety data, is not an acceptable failure.
                  <div
                    key={row.agent}
                    className="rounded-[2px] border bg-paper-100 px-2.5 py-1.5"
                    style={{
                      borderColor:
                        row.status === "ok" || row.status === "skipped"
                          ? "var(--rule-faint)"
                          : STATUS_DOT[row.status] + "66",
                    }}
                  >
                    <div className="flex items-center gap-2 text-[11.5px]">
                      <span
                        className="h-2 w-2 shrink-0 rotate-45"
                        style={{ background: STATUS_DOT[row.status] }}
                      />
                      <span className="w-[96px] shrink-0 font-semibold text-ink-900">
                        {labels[row.agent] ?? row.agent}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-500">
                        {row.summary || "—"}
                      </span>
                      <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-ink-400">
                        {row.latency_ms}ms
                      </span>
                    </div>
                    {row.latency_ms > 0 && (
                      <div className="mt-1 h-[2px] overflow-hidden bg-ink-900/[0.07]">
                        <div
                          className="grow-x h-full bg-chart-500/70 transition-all duration-500"
                          style={{ width: `${(row.latency_ms / maxLatency) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p
        className="border-t px-4 py-2.5 text-[10.5px] italic leading-relaxed text-ink-400"
        style={{ borderColor: "var(--rule-faint)" }}
      >
        {t.note}
      </p>
    </div>
  );
}
