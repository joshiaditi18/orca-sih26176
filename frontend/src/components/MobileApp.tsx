import { useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { FishingOutlook, Language, ZoneFeature } from "../types";
import { RATING_COLOR } from "./FishingPanel";
import {
  BoatGlyph,
  ChartDefs,
  CompassMark,
  FishGlyph,
  MapGlyph,
  MicGlyph,
  SpeakerGlyph,
  StopGlyph,
  WarnGlyph,
} from "./glyphs";
import { PORTS } from "./LocationPicker";
import MarineMap from "./MarineMap";
import { RISK_COLOR } from "./RiskDial";

/**
 * The phone — ORCA for the fisher himself, many of whom read little.
 *
 * Design rules, in order:
 *   1. Zero taps to the verdict: open → GPS → the big coloured circle.
 *   2. One tap to HEAR everything (browsers demand one gesture before TTS,
 *      so the speaker button is the biggest thing on screen).
 *   3. Everything important is a symbol, a colour or a large numeral;
 *      words are short and secondary.
 *   4. Three destinations, never deeper: Today · Map · Ask (by voice).
 */

type MTab = "today" | "map" | "ask";

const SESSION = "phone";
const DEFAULT_PORT = PORTS[0];

const T: Record<Language, Record<string, string>> = {
  en: {
    today: "Today",
    map: "Map",
    ask: "Ask",
    listen: "LISTEN",
    stop: "STOP",
    bestTime: "Best time",
    returnBy: "Be back by",
    areas: "Where the fish are",
    km: "km",
    profit: "Profit est.",
    fuel: "Fuel",
    tapMic: "Tap and speak",
    listening: "Listening…",
    thinking: "Asking the crew…",
    reading: "Reading the sea…",
    warnSpeak: "Official warning",
    askExamples: "Can I go tomorrow at 6 AM?",
    bestTimeSay: "Best time to fish is {a} to {b}.",
    returnBySay: "Be back before {t}.",
  },
  hi: {
    today: "आज",
    map: "नक्शा",
    ask: "पूछें",
    listen: "सुनें",
    stop: "रोकें",
    bestTime: "सबसे अच्छा समय",
    returnBy: "इससे पहले लौटें",
    areas: "मछली कहाँ है",
    km: "किमी",
    profit: "अनुमानित मुनाफ़ा",
    fuel: "ईंधन",
    tapMic: "दबाकर बोलिए",
    listening: "सुन रहे हैं…",
    thinking: "टीम से पूछ रहे हैं…",
    reading: "समुद्र पढ़ रहे हैं…",
    warnSpeak: "आधिकारिक चेतावनी",
    askExamples: "क्या मैं कल सुबह 6 बजे जा सकता हूँ?",
    bestTimeSay: "मछली पकड़ने का सबसे अच्छा समय {a} से {b} तक है।",
    returnBySay: "{t} से पहले लौट आएँ।",
  },
  mr: {
    today: "आज",
    map: "नकाशा",
    ask: "विचारा",
    listen: "ऐका",
    stop: "थांबवा",
    bestTime: "सर्वोत्तम वेळ",
    returnBy: "याआधी परत या",
    areas: "मासे कुठे आहेत",
    km: "किमी",
    profit: "अंदाजे नफा",
    fuel: "इंधन",
    tapMic: "दाबून बोला",
    listening: "ऐकत आहोत…",
    thinking: "टीमला विचारत आहोत…",
    reading: "समुद्र वाचत आहोत…",
    warnSpeak: "अधिकृत इशारा",
    askExamples: "मी उद्या सकाळी ६ वाजता जाऊ का?",
    bestTimeSay: "मासेमारीसाठी सर्वोत्तम वेळ {a} ते {b}.",
    returnBySay: "{t} च्या आधी परत या.",
  },
};

const SPEECH_LOCALE: Record<Language, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

function speak(text: string, lang: Language) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LOCALE[lang];
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* no TTS — the text is on screen anyway */
  }
}

function clock12(h: number): string {
  const hh = h % 24;
  return `${hh % 12 || 12} ${hh < 12 ? "AM" : "PM"}`;
}

function getRecognition(): any | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function MobileApp() {
  const [language, setLanguage] = useState<Language>(() => {
    const l = new URLSearchParams(window.location.search).get("lang");
    return l === "hi" || l === "mr" || l === "en" ? l : "en";
  });
  const t = T[language] ?? T.en;

  const [tab, setTab] = useState<MTab>(() => {
    const tp = new URLSearchParams(window.location.search).get("tab");
    return tp === "map" || tp === "ask" ? tp : "today";
  });
  const [place, setPlace] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [outlook, setOutlook] = useState<FishingOutlook | null>(null);
  const [zones, setZones] = useState<ZoneFeature[]>([]);
  const [focusRank, setFocusRank] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);

  // ---- ask state ----
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  // Temporary layout probe: ?debug=1 prints the widest elements on screen so
  // headless screenshots can carry their own diagnosis.
  const [debugInfo, setDebugInfo] = useState<string>("");
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    const id = window.setTimeout(() => {
      const vw = document.documentElement.clientWidth;
      const rows = [...document.querySelectorAll("*")]
        .map((el) => ({ el, w: el.getBoundingClientRect().width }))
        .filter((x) => x.w > vw + 1)
        .sort((a, b) => b.w - a.w)
        .slice(0, 5)
        .map(
          (x) =>
            `${Math.round(x.w)} ${x.el.tagName}.${String((x.el as HTMLElement).className).slice(0, 44)}`,
        );
      setDebugInfo(
        `vw=${vw} sw=${document.documentElement.scrollWidth}\n${rows.join("\n") || "no wide elements"}`,
      );
    }, 3500);
    return () => window.clearTimeout(id);
  }, [outlook]);

  const [mapH, setMapH] = useState(() => Math.max(320, window.innerHeight - 200));
  useEffect(() => {
    const onR = () => setMapH(Math.max(320, window.innerHeight - 200));
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    api.zones().then((z) => setZones(z.features)).catch(() => {});
    const fallback = () =>
      setPlace({ lat: DEFAULT_PORT.lat, lon: DEFAULT_PORT.lon, name: DEFAULT_PORT.name });
    const at = (new URLSearchParams(window.location.search).get("at") ?? "")
      .split(",")
      .map(Number);
    if (at.length === 2 && at.every(Number.isFinite)) {
      setPlace({ lat: at[0], lon: at[1], name: "—" });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setPlace({
            lat: +pos.coords.latitude.toFixed(4),
            lon: +pos.coords.longitude.toFixed(4),
            name: "—",
          }),
        fallback,
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 300_000 },
      );
    } else fallback();
  }, []);

  useEffect(() => {
    if (!place) return;
    let alive = true;
    setOutlook(null);
    api
      .fishingOutlook(place.lat, place.lon, { radiusKm: 100, days: 3, lang: language })
      .then((d) => alive && setOutlook(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [place?.lat, place?.lon, language]);

  // ---------------------------------------------------------------- voice
  const speakPlan = () => {
    if (!outlook) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const bits = [...outlook.advice.slice(0, 4)];
    if (outlook.best_window)
      bits.push(
        t.bestTimeSay
          .replace("{a}", clock12(outlook.best_window.from_hour))
          .replace("{b}", clock12(outlook.best_window.to_hour)),
      );
    if (outlook.duration?.return_by)
      bits.push(t.returnBySay.replace("{t}", outlook.duration.return_by));
    speak(bits.join(" "), language);
    setSpeaking(true);
    const check = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
        window.clearInterval(check);
      }
    }, 400);
  };

  const askVoice = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = SPEECH_LOCALE[language];
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      setListening(false);
      sendAsk(e.results[0][0].transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const sendAsk = async (text: string) => {
    setQuestion(text);
    setAnswer(null);
    setBusy(true);
    try {
      const res = await api.ask({ message: text, sessionId: SESSION });
      setAnswer(res.answer);
      setSuggestions(res.suggestions.slice(0, 3));
      if (res.language !== language) setLanguage(res.language);
      speak(res.answer.split(". ").slice(0, 3).join(". "), res.language);
    } catch {
      setAnswer("…");
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- bits
  const cat = outlook?.safety.category;
  const color = cat ? RISK_COLOR[cat] : "#42596D";
  const danger = cat === "HIGH" || cat === "EXTREME";

  const speakArea = (a: FishingOutlook["areas"][number]) => {
    const line = `${a.rank}. ${Math.round(a.distance_km)} ${t.km}. ${a.probability}%. ${(
      a.likely_species ?? []
    )
      .map((s) => s.split(" (")[0])
      .join(", ")}`;
    speak(line, language);
    setFocusRank(a.rank);
    setTab("map");
  };

  return (
    <div className="flex min-h-full flex-col">
      <ChartDefs />
      <div className="sea-drift" aria-hidden />
      {debugInfo && (
        <pre className="fixed left-0 top-0 z-[999] max-w-[300px] whitespace-pre-wrap bg-black p-1 text-[10px] leading-tight text-white">
          {debugInfo}
        </pre>
      )}

      {/* ---------------- slim header ---------------- */}
      <header
        className="sticky top-0 z-[600] flex items-center gap-2.5 border-b bg-paper-100/95 px-3 py-2 backdrop-blur-sm"
        style={{ borderColor: "var(--rule)" }}
      >
        <CompassMark size={30} className="shrink-0 text-ink-900" />
        <div className="min-w-0">
          <div className="font-display text-[17px] font-black leading-none text-ink-900">ORCA</div>
          {place && outlook && (
            <div className="truncate font-mono text-[9px] text-chart-600">
              {outlook.location.nearest_landing_centre}
            </div>
          )}
        </div>
        <div className="ml-auto flex gap-1">
          {(["en", "hi", "mr"] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`min-w-[42px] rounded-[2px] border px-2 py-2 font-mono text-[13px] font-bold transition ${
                language === l
                  ? "border-ink-900 bg-ink-900 text-paper-50"
                  : "text-ink-400"
              }`}
              style={language === l ? undefined : { borderColor: "var(--rule)" }}
            >
              {l === "en" ? "EN" : l === "hi" ? "हिं" : "मरा"}
            </button>
          ))}
        </div>
      </header>

      {/* ================= TODAY ================= */}
      {tab === "today" && (
        <main className="flex-1 space-y-3 px-3 pb-24 pt-3">
          {!outlook && (
            <div className="panel flex flex-col items-center gap-3 p-10 text-center">
              <CompassMark size={56} className="text-ink-300" />
              <span className="text-[15px] italic text-ink-400">{t.reading}</span>
            </div>
          )}

          {outlook && (
            <>
              {/* the verdict — colour first, words second */}
              <div
                className="panel rule-double flex flex-col items-center px-4 pb-4 pt-6 text-center"
                style={{ background: `${color}14` }}
              >
                <div
                  className="grid h-32 w-32 place-items-center rounded-full border-[7px] bg-paper-50"
                  style={{ borderColor: color }}
                >
                  {danger ? (
                    <WarnGlyph size={54} className="" />
                  ) : (
                    <BoatGlyph size={58} className="" />
                  )}
                </div>
                <div
                  className="mt-3 font-display text-[30px] font-black leading-none"
                  style={{ color }}
                >
                  {outlook.safety.score}
                  <span className="text-[15px] font-bold opacity-70"> / 100</span>
                </div>
                <p className="mt-2.5 font-display text-[19px] font-semibold leading-snug text-ink-900">
                  {outlook.advice[0]}
                </p>

                {/* THE button — one tap, hear everything */}
                <button
                  onClick={speakPlan}
                  className="mt-4 flex w-full items-center justify-center gap-3 rounded-[3px] bg-ink-900 py-4 font-mono text-[17px] font-bold uppercase tracking-[0.14em] text-paper-50 active:translate-y-px"
                >
                  {speaking ? <StopGlyph size={20} /> : <SpeakerGlyph size={24} />}
                  {speaking ? t.stop : t.listen}
                </button>
              </div>

              {/* official warning — red, loud, speaks itself */}
              {outlook.safety.official_warning && (
                <button
                  onClick={() => speak(`${t.warnSpeak}. ${outlook.advice[0]}`, language)}
                  className="panel hatch-danger flex w-full items-center gap-3 border-risk-extreme/70 px-4 py-3 text-left"
                >
                  <WarnGlyph size={30} className="shrink-0 text-risk-extreme" />
                  <span className="font-display text-[16px] font-bold leading-tight text-risk-extreme">
                    {t.warnSpeak}
                  </span>
                  <SpeakerGlyph size={18} className="ml-auto shrink-0 text-risk-extreme" />
                </button>
              )}

              {/* times — big numerals, tiny labels */}
              <div className="grid grid-cols-2 gap-3">
                {outlook.best_window && (
                  <div className="panel px-3 py-3 text-center">
                    <div className="label !text-[9px]">{t.bestTime}</div>
                    <div className="mt-1 font-display text-[21px] font-bold leading-none text-risk-low">
                      {clock12(outlook.best_window.from_hour)}–
                      {clock12(outlook.best_window.to_hour)}
                    </div>
                  </div>
                )}
                {outlook.duration?.return_by && (
                  <div className="panel border-risk-extreme/50 bg-risk-extreme/[0.06] px-3 py-3 text-center">
                    <div className="label !text-[9px] !text-risk-extreme">{t.returnBy}</div>
                    <div className="mt-1 font-display text-[26px] font-black leading-none text-risk-extreme">
                      {outlook.duration.return_by}
                    </div>
                  </div>
                )}
              </div>

              {/* the grounds — tap to hear + see on the chart */}
              <div className="panel overflow-hidden">
                <div className="hd !py-2">
                  <span className="label flex items-center gap-2 !text-[10px]">
                    {t.areas} <FishGlyph size={14} className="swim text-chart-500" />
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--rule-faint)" }}>
                  {outlook.areas.slice(0, 3).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => speakArea(a)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-paper-150"
                    >
                      <span
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 bg-paper-50 font-display text-[19px] font-extrabold text-ink-900"
                        style={{ borderColor: RATING_COLOR[a.rating] }}
                      >
                        {a.rank}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-bold text-ink-900">
                          {Math.round(a.distance_km)} {t.km}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-chart-700">
                          {(a.likely_species ?? []).map((s) => s.split(" (")[0]).join(" · ")}
                        </span>
                      </span>
                      <span
                        className="sounding shrink-0 text-[26px]"
                        style={{ color: RATING_COLOR[a.rating] }}
                      >
                        {a.probability}
                        <span className="text-[14px]">%</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* money — two numbers a fisher weighs every morning */}
              {outlook.economics && (
                <div className="panel grid grid-cols-2">
                  <div className="px-3 py-3 text-center">
                    <div className="label !text-[9px]">{t.fuel}</div>
                    <div className="mt-1 font-mono text-[21px] font-bold text-ink-900">
                      ₹{outlook.economics.fuel_cost_inr.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div
                    className="border-l bg-risk-low/[0.07] px-3 py-3 text-center"
                    style={{ borderColor: "var(--rule-faint)" }}
                  >
                    <div className="label !text-[9px] !text-risk-low">{t.profit}</div>
                    <div className="mt-1 font-mono text-[21px] font-bold text-risk-low">
                      ₹{outlook.economics.profit_inr.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* ================= MAP ================= */}
      {tab === "map" && (
        <main className="flex-1 px-2 pb-20 pt-2">
          <MarineMap
            origin={
              place
                ? { name: outlook?.location.nearest_landing_centre ?? "—", latitude: place.lat, longitude: place.lon }
                : null
            }
            zones={zones}
            pfz={[]}
            areas={outlook?.areas ?? []}
            radiusKm={outlook?.radius_km ?? 100}
            routes={outlook?.routes ?? []}
            geofence={[]}
            language={language}
            onPickLocation={(lat, lon) => setPlace({ lat, lon, name: "—" })}
            focusRank={focusRank}
            heightPx={mapH}
          />
        </main>
      )}

      {/* ================= ASK ================= */}
      {tab === "ask" && (
        <main className="flex flex-1 flex-col items-center gap-4 px-4 pb-24 pt-6">
          {/* the mic IS the interface */}
          <button
            onClick={askVoice}
            className={`grid h-36 w-36 place-items-center rounded-full border-[6px] transition active:scale-95 ${
              listening
                ? "border-risk-extreme bg-risk-extreme text-paper-50"
                : "border-ink-900 bg-paper-50 text-ink-900"
            }`}
            style={listening ? { animation: "inkblink 1.1s ease-in-out infinite" } : undefined}
          >
            {listening ? <StopGlyph size={44} /> : <MicGlyph size={64} />}
          </button>
          <div className="font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-ink-500">
            {listening ? t.listening : busy ? t.thinking : t.tapMic}
          </div>

          {question && (
            <div className="w-full rounded-[3px] bg-ink-900 px-4 py-3 text-[15px] text-paper-50">
              {question}
            </div>
          )}
          {busy && (
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2.5 w-2.5 animate-bounce rounded-full bg-ink-700"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          )}
          {answer && (
            <button
              onClick={() => speak(answer, language)}
              className="panel w-full px-4 py-3.5 text-left"
            >
              <p className="text-[16px] leading-relaxed text-ink-800">{answer}</p>
              <span className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-chart-600">
                <SpeakerGlyph size={14} /> {t.listen}
              </span>
            </button>
          )}
          {suggestions.length > 0 && !busy && (
            <div className="flex w-full flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendAsk(s)}
                  className="chip w-full justify-center !py-3 !text-[14px]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {!question && !answer && (
            <p className="max-w-[260px] text-center text-[13px] italic text-ink-400">
              “{t.askExamples}”
            </p>
          )}
        </main>
      )}

      {/* ---------------- bottom nav: three doors, never deeper ---------------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[700] grid grid-cols-3 border-t bg-paper-50"
        style={{ borderColor: "var(--rule-strong)" }}
      >
        {(
          [
            ["today", <BoatGlyph key="b" size={26} />],
            ["map", <MapGlyph key="m" size={26} />],
            ["ask", <MicGlyph key="a" size={26} />],
          ] as [MTab, JSX.Element][]
        ).map(([m, icon]) => (
          <button
            key={m}
            onClick={() => setTab(m)}
            className={`flex flex-col items-center gap-1 py-2.5 transition ${
              tab === m ? "bg-ink-900 text-paper-50" : "text-ink-500"
            }`}
          >
            {icon}
            <span className="font-mono text-[11px] font-bold uppercase tracking-wide">{t[m]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
