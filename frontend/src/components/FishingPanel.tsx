import type { CatchRating, FishingOutlook, Language } from "../types";
import { FishGlyph, SchoolGlyph, WarnGlyph } from "./glyphs";

/** Rating colours tuned for chart paper — inky enough to read as drafted. */
export const RATING_COLOR: Record<CatchRating, string> = {
  very_good: "#1D7A50",
  good: "#63862B",
  fair: "#B08000",
  poor: "#9C5F44",
};

const RATING_WORD: Record<Language, Record<CatchRating, string>> = {
  en: { very_good: "Very good", good: "Good", fair: "Some chance", poor: "Low chance" },
  hi: { very_good: "बहुत अच्छा", good: "अच्छा", fair: "कुछ उम्मीद", poor: "कम उम्मीद" },
  mr: { very_good: "खूप चांगली", good: "चांगली", fair: "थोडी शक्यता", poor: "कमी शक्यता" },
};

const T: Record<Language, Record<string, string>> = {
  en: {
    advice: "What you should do",
    areas: "Best places to fish",
    within: "within",
    away: "away",
    chance: "chance of fish",
    trip: "Your trip",
    stay: "Stay there",
    travel: "Travel each way",
    total: "Whole trip",
    hours: "hours",
    min: "min",
    bestTime: "Best time to fish",
    avoid: "Stay out of these areas",
    closedNow: "closed now",
    closedBetween: "closed",
    always: "always closed",
    forecast: "Next days",
    today: "Today",
    tomorrow: "Tomorrow",
    dayAfter: "Day after",
    bestAt: "best around",
    notWorth: "Not enough safe time today for this trip.",
    likely: "Likely",
    likelyNote:
      "indicative — SST/chlorophyll bands × regional occurrence records (OBIS / Map of Life). Never a promise",
    returnBy: "Be back before",
    returnWhy: "waves reach about",
    econ: "What the trip is worth",
    fuel: "Fuel",
    catch: "Expected catch",
    revenue: "Revenue",
    profit: "Profit estimate",
    econNote: "Planning estimate — never a promise.",
    barsCaption: "Bars: chlorophyll · SST band · front · sea state · time of day",
  },
  hi: {
    advice: "आपको क्या करना चाहिए",
    areas: "मछली पकड़ने की सबसे अच्छी जगहें",
    within: "के अंदर",
    away: "दूर",
    chance: "मछली की उम्मीद",
    trip: "आपकी यात्रा",
    stay: "वहाँ रुकें",
    travel: "एक तरफ़ का सफ़र",
    total: "पूरी यात्रा",
    hours: "घंटे",
    min: "मिनट",
    bestTime: "मछली पकड़ने का सबसे अच्छा समय",
    avoid: "इन जगहों से दूर रहें",
    closedNow: "अभी बंद",
    closedBetween: "बंद",
    always: "हमेशा बंद",
    forecast: "अगले दिन",
    today: "आज",
    tomorrow: "कल",
    dayAfter: "परसों",
    bestAt: "सबसे अच्छा समय",
    notWorth: "आज इतना सुरक्षित समय नहीं है।",
    likely: "संभावित",
    likelyNote:
      "तापमान-क्लोरोफिल + क्षेत्रीय उपस्थिति रिकॉर्ड (OBIS) से अनुमान — मछली की गारंटी नहीं",
    returnBy: "इससे पहले लौट आएँ",
    returnWhy: "लहरें लगभग इतनी हो जाएँगी",
    econ: "यात्रा से कितना मिलेगा",
    fuel: "ईंधन",
    catch: "अनुमानित मछली",
    revenue: "आमदनी",
    profit: "अनुमानित मुनाफ़ा",
    econNote: "योजना के लिए अनुमान — कोई वादा नहीं।",
    barsCaption: "पट्टियाँ: क्लोरोफिल · तापमान · फ्रंट · समुद्र · समय",
  },
  mr: {
    advice: "तुम्ही काय करावे",
    areas: "मासेमारीसाठी सर्वोत्तम जागा",
    within: "च्या आत",
    away: "अंतरावर",
    chance: "मासे मिळण्याची शक्यता",
    trip: "तुमची फेरी",
    stay: "तिथे थांबा",
    travel: "एका बाजूचा प्रवास",
    total: "संपूर्ण फेरी",
    hours: "तास",
    min: "मिनिटे",
    bestTime: "मासेमारीसाठी सर्वोत्तम वेळ",
    avoid: "या जागांपासून दूर राहा",
    closedNow: "आत्ता बंद",
    closedBetween: "बंद",
    always: "नेहमी बंद",
    forecast: "पुढील दिवस",
    today: "आज",
    tomorrow: "उद्या",
    dayAfter: "परवा",
    bestAt: "सर्वोत्तम वेळ",
    notWorth: "आज पुरेसा सुरक्षित वेळ नाही.",
    likely: "शक्यता",
    likelyNote:
      "तापमान-क्लोरोफिल + प्रादेशिक उपस्थिती नोंदी (OBIS) वरून अंदाज — माशांची हमी नाही",
    returnBy: "या वेळेआधी परत या",
    returnWhy: "लाटा सुमारे इतक्या होतील",
    econ: "फेरीतून किती मिळेल",
    fuel: "इंधन",
    catch: "अपेक्षित मासे",
    revenue: "उत्पन्न",
    profit: "अंदाजे नफा",
    econNote: "नियोजनासाठी अंदाज — हमी नाही.",
    barsCaption: "पट्ट्या: क्लोरोफिल · तापमान · फ्रंट · समुद्र · वेळ",
  },
};

/** The five documented model factors, in reading order, with tooltip labels. */
const FACTOR_ORDER: { key: string; label: string }[] = [
  { key: "chlorophyll", label: "Chlorophyll" },
  { key: "sst", label: "SST band" },
  { key: "front", label: "Thermal front" },
  { key: "sea_state", label: "Sea state" },
  { key: "time_of_day", label: "Time of day" },
];

function clock12(h: number): string {
  const hh = h % 24;
  return `${hh % 12 || 12} ${hh < 12 ? "AM" : "PM"}`;
}

function dayName(offset: number, t: Record<string, string>): string {
  return offset === 0 ? t.today : offset === 1 ? t.tomorrow : t.dayAfter;
}

export default function FishingPanel({
  data,
  language = "en",
  onSelectArea,
}: {
  data: FishingOutlook;
  language?: Language;
  onSelectArea?: (rank: number) => void;
}) {
  const t = T[language] ?? T.en;
  const words = RATING_WORD[language] ?? RATING_WORD.en;
  const top = data.areas.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* ---------- plain-language advice: the most important panel ---------- */}
      <div className="panel rule-double overflow-hidden">
        <div className="hd">
          <span className="label">{t.advice}</span>
        </div>
        <div className="px-5 py-4">
          {data.advice.map((line, i) =>
            i === 0 ? (
              <p
                key={i}
                className="font-display text-[19px] font-semibold leading-snug text-ink-900"
              >
                {line}
              </p>
            ) : (
              <p
                key={i}
                className="mt-2.5 flex gap-2.5 text-[13.5px] leading-relaxed text-ink-700"
              >
                <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rotate-45 bg-chart-500/70" />
                <span>{line}</span>
              </p>
            ),
          )}
        </div>
      </div>

      {/* ---------- best places ---------- */}
      {top.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="hd">
            <span className="label flex items-center gap-2">
              {t.areas}
              <SchoolGlyph size={26} className="swim text-chart-500" />
            </span>
            <span className="font-mono text-[10px] tabular-nums text-ink-400">
              {language === "en"
                ? `${t.within} ${data.radius_km} km`
                : `${data.radius_km} km ${t.within}`}
            </span>
          </div>

          <div className="px-4 py-3.5">
            <div className="space-y-2">
              {top.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelectArea?.(a.rank)}
                  className="group flex w-full items-center gap-3.5 rounded-[2px] border bg-paper-100 px-3 py-3 text-left transition-all duration-200 hover:-translate-y-[2px] hover:border-ink-700 hover:bg-paper-150 hover:shadow-md"
                  style={{ borderColor: "var(--rule)" }}
                >
                  {/* buoy badge — identical symbology to the map markers,
                      and it ripples back when the row is hovered */}
                  <div className="relative shrink-0" style={{ color: RATING_COLOR[a.rating] }}>
                    <span className="badge-ping" />
                    <div
                      className="grid h-11 w-11 place-items-center rounded-full border-[3.5px] bg-paper-50 font-display text-[17px] font-extrabold text-ink-900 shadow-sm"
                      style={{ borderColor: RATING_COLOR[a.rating] }}
                    >
                      {a.rank}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold text-ink-900">
                        {Math.round(a.distance_km)} km {t.away}
                      </span>
                      {a.recommended && (
                        <span className="stamp !px-1.5 !py-0.5 !text-[8.5px] text-risk-low">
                          {language === "mr" ? "सुचवलेली" : language === "hi" ? "सुझाई गई" : "Best trip"}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-500">
                      {words[a.rating]} {t.chance}
                    </div>
                    {/* the five model factors behind this number — nothing is a black box */}
                    <div className="mt-1.5 flex items-center gap-1">
                      {FACTOR_ORDER.map((f) => {
                        const v = a.factors?.[f.key];
                        if (v == null) return null;
                        return (
                          <span
                            key={f.key}
                            title={`${f.label}: ${Math.round(v * 100)}%`}
                            className="inline-block h-[4px] w-[24px] overflow-hidden bg-ink-900/15"
                          >
                            <span
                              className="grow-x block h-full"
                              style={{
                                width: `${Math.round(v * 100)}%`,
                                background: RATING_COLOR[a.rating],
                                opacity: 0.85,
                              }}
                            />
                          </span>
                        );
                      })}
                    </div>
                    {(a.likely_species?.length ?? 0) > 0 && (
                      <div
                        className="mt-1 flex items-center gap-1.5 truncate font-mono text-[10px] text-chart-700"
                        title={`${t.likely}: ${a.likely_species!.join(" · ")} — ${t.likelyNote}`}
                      >
                        <FishGlyph size={13} className="swim shrink-0" />
                        <span className="truncate">
                          {t.likely}: {a.likely_species!.map((s) => s.split(" (")[0]).join(" · ")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <div
                      className="sounding text-[24px] leading-none tabular-nums transition-transform duration-300 group-hover:scale-110"
                      style={{ color: RATING_COLOR[a.rating] }}
                    >
                      {a.probability}
                      <span className="text-[13px]">%</span>
                    </div>
                    <div className="ml-auto mt-1.5 h-[3px] w-16 overflow-hidden bg-ink-900/10">
                      <div
                        className="grow-x h-full"
                        style={{
                          width: `${a.probability}%`,
                          background: RATING_COLOR[a.rating],
                        }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-300">
              {t.barsCaption}
            </p>

            {data.best_window && (
              <div className="mt-3 border border-dashed border-risk-low/70 bg-risk-low/[0.07] px-3.5 py-2.5">
                <div className="label !text-risk-low">{t.bestTime}</div>
                <div className="mt-0.5 font-display text-[17px] font-bold text-risk-low">
                  {clock12(data.best_window.from_hour)} – {clock12(data.best_window.to_hour)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- trip plan ---------- */}
      {data.duration && (
        <div className="panel overflow-hidden">
          <div className="hd">
            <span className="label">{t.trip}</span>
          </div>
          {data.duration.feasible ? (
            <>
              <div className="grid grid-cols-3">
                {[
                  { k: t.stay, v: `${data.duration.recommended_hours}`, u: t.hours, hero: true },
                  {
                    k: t.travel,
                    v: `${data.duration.travel_each_way_minutes}`,
                    u: t.min,
                    hero: false,
                  },
                  { k: t.total, v: `${data.duration.total_trip_hours}`, u: t.hours, hero: false },
                ].map((x, i) => (
                  <div
                    key={x.k}
                    className={`px-4 py-3 ${i > 0 ? "border-l" : ""} ${x.hero ? "bg-risk-low/[0.07]" : ""}`}
                    style={{ borderColor: "var(--rule-faint)" }}
                  >
                    <div className="label truncate">{x.k}</div>
                    <div
                      className={`mt-1 font-mono text-[20px] font-bold tabular-nums leading-none ${
                        x.hero ? "text-risk-low" : "text-ink-900"
                      }`}
                    >
                      {x.v}
                      <span className="ml-1 text-[10.5px] font-semibold opacity-65">{x.u}</span>
                    </div>
                  </div>
                ))}
              </div>
              {data.duration.return_by && (
                <div
                  className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t bg-risk-extreme/[0.05] px-4 py-2.5"
                  style={{ borderColor: "var(--rule-faint)" }}
                >
                  <span className="label !text-risk-extreme">{t.returnBy}</span>
                  <span className="font-display text-[19px] font-black leading-none text-risk-extreme">
                    {data.duration.return_by}
                  </span>
                  {data.duration.return_reason_wave_m != null && (
                    <span className="font-mono text-[10.5px] text-ink-500">
                      — {t.returnWhy} {data.duration.return_reason_wave_m} m
                    </span>
                  )}
                </div>
              )}
              {data.duration.limited_by_weather && (
                <p
                  className="flex items-center gap-2 border-t px-4 py-2.5 text-[12px] font-medium text-risk-high"
                  style={{ borderColor: "var(--rule-faint)" }}
                >
                  <WarnGlyph size={13} className="shrink-0" />
                  {language === "mr"
                    ? "हवामानामुळे वेळ कमी आहे — लवकर परत या."
                    : language === "hi"
                      ? "मौसम के कारण समय कम है — जल्दी लौटें।"
                      : "Weather shortens your window — come back earlier."}
                </p>
              )}
            </>
          ) : (
            <p className="px-4 py-3.5 text-[13px] font-medium text-risk-high">{t.notWorth}</p>
          )}
        </div>
      )}

      {/* ---------- what the trip is worth: honest economics ---------- */}
      {data.economics && data.duration?.feasible && (
        <div className="panel overflow-hidden">
          <div className="hd">
            <span className="label">{t.econ}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-400">
              {t.econNote}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {[
              {
                k: t.fuel,
                v: `₹${data.economics.fuel_cost_inr.toLocaleString("en-IN")}`,
                s: `${data.economics.fuel_litres} L`,
              },
              {
                k: t.catch,
                v: `${data.economics.catch_kg_low}–${data.economics.catch_kg_high}`,
                s: "kg",
              },
              {
                k: t.revenue,
                v: `₹${data.economics.revenue_inr.toLocaleString("en-IN")}`,
                s: "",
              },
              {
                k: t.profit,
                v: `₹${data.economics.profit_inr.toLocaleString("en-IN")}`,
                s: "",
                hero: true,
              },
            ].map((x, i) => (
              <div
                key={x.k}
                className={`px-4 py-3 ${i > 0 ? "border-l" : ""} ${x.hero ? "bg-risk-low/[0.07]" : ""}`}
                style={{ borderColor: "var(--rule-faint)" }}
              >
                <div className="label truncate !text-[9px]">{x.k}</div>
                <div
                  className={`mt-1 font-mono text-[18px] font-bold tabular-nums leading-none ${
                    x.hero ? "text-risk-low" : "text-ink-900"
                  }`}
                >
                  {x.v}
                  {x.s && <span className="ml-1 text-[10px] font-semibold opacity-60">{x.s}</span>}
                </div>
              </div>
            ))}
          </div>
          <p
            className="border-t px-4 py-2 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-400"
            style={{ borderColor: "var(--rule-faint)" }}
          >
            {data.economics.assumptions}
          </p>
        </div>
      )}

      {/* ---------- avoid: drawn as the chart's danger areas ---------- */}
      {data.avoid.length > 0 && (
        <div className="panel hatch-danger overflow-hidden border-risk-extreme/60">
          <div className="hd border-risk-extreme/25">
            <span className="label flex items-center gap-2 !text-risk-extreme">
              <WarnGlyph size={13} /> {t.avoid}
            </span>
          </div>
          <div className="space-y-2.5 px-4 py-3.5">
            {data.avoid.map((z) => (
              <div key={z.name} className="flex items-start gap-2.5">
                <svg width="14" height="14" className="mt-0.5 shrink-0" aria-hidden>
                  <rect x="0.5" y="0.5" width="13" height="13" fill="url(#hatch-critical)" stroke="#AF2318" strokeWidth="1" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-ink-900">{z.name}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink-500">
                    {Math.round(z.distance_km)} km {t.away} ·{" "}
                    {z.window ? (
                      <span className={z.active_now ? "font-bold text-risk-extreme" : ""}>
                        {t.closedBetween} {z.window}
                        {z.active_now ? ` (${t.closedNow})` : ""}
                      </span>
                    ) : (
                      t.always
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- 3-day outlook ---------- */}
      {data.forecast.length > 1 && (
        <div className="panel overflow-hidden">
          <div className="hd">
            <span className="label">{t.forecast}</span>
          </div>
          <div className="grid grid-cols-3">
            {data.forecast.map((f, i) => (
              <div
                key={f.day_offset}
                className={`px-3 py-3.5 text-center transition-colors hover:bg-chart-100/60 ${i > 0 ? "border-l" : ""} ${
                  f.day_offset === 0 ? "bg-chart-100/40" : ""
                }`}
                style={{ borderColor: "var(--rule-faint)" }}
              >
                <div className="label truncate !tracking-[0.1em]">{dayName(f.day_offset, t)}</div>
                <div
                  className="sounding mt-1.5 text-[27px] leading-none tabular-nums"
                  style={{ color: RATING_COLOR[f.rating] }}
                >
                  {f.probability}
                  <span className="text-[14px]">%</span>
                </div>
                <div className="mt-1.5 text-[10.5px] leading-tight text-ink-500">
                  {t.bestAt} {clock12(f.best_hour)}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-ink-400">{f.wave_height_m} m</div>
                {f.official_warning && (
                  <div className="mt-1.5 inline-flex items-center gap-1 border border-risk-extreme/60 px-1.5 py-0.5 text-risk-extreme">
                    <WarnGlyph size={10} />
                    <span className="font-mono text-[8.5px] font-bold uppercase tracking-wide">Warning</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p
            className="border-t px-4 py-2.5 font-mono text-[10px] leading-relaxed text-ink-400"
            style={{ borderColor: "var(--rule-faint)" }}
          >
            {data.method}
          </p>
        </div>
      )}
    </div>
  );
}
