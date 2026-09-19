import { useState } from "react";
import type { Evidence, Language, RiskAssessment } from "../types";
import { LockGlyph } from "./glyphs";
import RiskDial, { RISK_COLOR } from "./RiskDial";

const VERDICT: Record<Language, Record<string, string>> = {
  en: {
    LOW: "Conditions look safe",
    MODERATE: "Go with caution",
    HIGH: "High risk — not recommended",
    EXTREME: "EXTREME — do not go to sea",
  },
  hi: {
    LOW: "स्थिति सुरक्षित लग रही है",
    MODERATE: "सावधानी से जाएँ",
    HIGH: "जोखिम अधिक है — जाने की सलाह नहीं",
    EXTREME: "अत्यधिक जोखिम — समुद्र में न जाएँ",
  },
  mr: {
    LOW: "परिस्थिती सुरक्षित दिसते",
    MODERATE: "सावधगिरीने जा",
    HIGH: "धोका जास्त आहे — जाऊ नका",
    EXTREME: "अत्यंत धोका — समुद्रात जाऊ नका",
  },
};

const UI: Record<Language, Record<string, string>> = {
  en: {
    why: "Why — ranked contribution to the score",
    warning: "Official warning",
    improves: "Conditions expected to improve after",
    askAgain: "— ask again then.",
    overrides: "Safety overrides applied",
    overrideNote:
      "Deterministic rules can only raise a risk score — never lower it. No model or language output can talk ORCA down from an official warning.",
    evidence: "Evidence",
    traced: "traced values",
    show: "show ▾",
    hide: "hide ▴",
    cols: "Value|Reading|Source|Updated",
  },
  hi: {
    why: "क्यों — स्कोर में योगदान",
    warning: "आधिकारिक चेतावनी",
    improves: "स्थिति सुधरने की संभावना",
    askAgain: "बजे के बाद — तब दोबारा पूछें।",
    overrides: "सुरक्षा नियम लागू",
    overrideNote:
      "नियम केवल जोखिम बढ़ा सकते हैं, घटा नहीं। कोई भी मॉडल आधिकारिक चेतावनी को रद्द नहीं कर सकता।",
    evidence: "प्रमाण",
    traced: "स्रोत-सहित मान",
    show: "दिखाएँ ▾",
    hide: "छिपाएँ ▴",
    cols: "मान|रीडिंग|स्रोत|अपडेट",
  },
  mr: {
    why: "का — गुणांमधील योगदान",
    warning: "अधिकृत इशारा",
    improves: "परिस्थिती सुधारण्याची शक्यता",
    askAgain: "नंतर — तेव्हा पुन्हा विचारा.",
    overrides: "सुरक्षा नियम लागू",
    overrideNote:
      "नियम फक्त धोका वाढवू शकतात, कमी करू शकत नाहीत. कोणतेही मॉडेल अधिकृत इशाऱ्याला ओलांडू शकत नाही.",
    evidence: "पुरावा",
    traced: "स्रोतासह मूल्ये",
    show: "दाखवा ▾",
    hide: "लपवा ▴",
    cols: "मूल्य|वाचन|स्रोत|अपडेट",
  },
};

export default function RiskCard({
  risk,
  evidence,
  language = "en",
}: {
  risk: RiskAssessment;
  evidence: Evidence[];
  language?: Language;
}) {
  const ui = UI[language] ?? UI.en;
  const [colValue, colReading, colSource, colUpdated] = ui.cols.split("|");
  const [showEvidence, setShowEvidence] = useState(false);
  const color = RISK_COLOR[risk.category];
  const top = risk.factors.filter((f) => f.contribution > 0).slice(0, 5);
  const max = Math.max(...top.map((f) => f.contribution), 1);

  return (
    <div className="panel rule-double overflow-hidden">
      <div className="flex items-center gap-5 p-5">
        <RiskDial score={risk.score} category={risk.category} />
        <div className="min-w-0 flex-1">
          <div
            className="font-display text-[22px] font-bold leading-tight tracking-tight"
            style={{ color }}
          >
            {(VERDICT[language] ?? VERDICT.en)[risk.category]}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            {/* the verdict, stamped on the document */}
            <span
              key={`${risk.category}-${risk.score}`}
              className="stamp animate-stampIn text-[11px]"
              style={{ color }}
            >
              {risk.category}
            </span>
            {risk.official_warning && (
              <span className="stamp animate-stampIn text-[11px] text-risk-extreme" style={{ animationDelay: "120ms" }}>
                {ui.warning}
              </span>
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              {risk.mode} data
            </span>
          </div>
          {risk.window && (
            <div className="mt-3 border border-dashed border-risk-low/70 bg-risk-low/[0.07] px-3 py-2 text-[13px] text-risk-low">
              {ui.improves} <span className="font-display font-bold">{risk.window}</span>{" "}
              {ui.askAgain}
            </div>
          )}
        </div>
      </div>

      {/* why */}
      <div className="border-t px-5 py-4" style={{ borderColor: "var(--rule-faint)" }}>
        <div className="label mb-3">{ui.why}</div>
        <ul className="space-y-2.5">
          {top.map((f) => (
            <li key={f.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink-800">{f.label}</span>
                <span className="shrink-0 font-mono text-xs font-bold tabular-nums" style={{ color }}>
                  +{f.contribution.toFixed(1)}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden bg-ink-900/10">
                <div
                  className="grow-x h-full transition-all duration-700"
                  style={{ width: `${(f.contribution / max) * 100}%`, background: color }}
                />
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-ink-400">{f.detail}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* deterministic overrides — the trust moment */}
      {risk.overrides.length > 0 && (
        <div className="hatch-danger border-t border-risk-extreme/40 px-5 py-3.5">
          <div className="label mb-2 !text-risk-extreme">{ui.overrides}</div>
          <ul className="space-y-1.5">
            {risk.overrides.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] font-medium text-ink-800">
                <LockGlyph size={13} className="mt-0.5 shrink-0 text-risk-extreme" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] italic leading-relaxed text-ink-500">{ui.overrideNote}</p>
        </div>
      )}

      {/* evidence */}
      <div className="border-t px-5 py-3" style={{ borderColor: "var(--rule-faint)" }}>
        <button
          onClick={() => setShowEvidence((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="label">
            {ui.evidence} · {evidence.length} {ui.traced}
          </span>
          <span className="font-mono text-[11px] text-chart-600">
            {showEvidence ? ui.hide : ui.show}
          </span>
        </button>

        {showEvidence && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--rule)" }}>
                  <th className="pb-1.5 pr-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">{colValue}</th>
                  <th className="pb-1.5 pr-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">{colReading}</th>
                  <th className="pb-1.5 pr-3 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">{colSource}</th>
                  <th className="pb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">{colUpdated}</th>
                </tr>
              </thead>
              <tbody className="text-ink-800">
                {evidence.map((e, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--rule-faint)" }}>
                    <td className="py-1.5 pr-3 font-sans">{e.label}</td>
                    <td className="py-1.5 pr-3 font-bold tabular-nums">{e.value}</td>
                    <td className="py-1.5 pr-3 text-ink-500">{e.source}</td>
                    <td className="py-1.5 tabular-nums text-ink-500">
                      {e.timestamp?.slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
