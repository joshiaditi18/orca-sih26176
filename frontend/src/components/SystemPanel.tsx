import { Fragment, useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { Language } from "../types";
import { CourseArrow, FishGlyph, LockGlyph, WarnGlyph } from "./glyphs";
import { PORTS } from "./LocationPicker";

/** The engine room, in the fisher's three languages. */
const L10N: Record<Language, Record<string, string>> = {
  en: {
    engineRoom: "The engine room",
    configNote: "GET /api/config exposes every weight and threshold — nothing is hidden",
    title: "What we do with the data",
    intro:
      "One question triggers one sweep of the machine below: live providers are read once per position, remembered as a 72-hour series, reasoned over by ten agents in parallel, floored by deterministic safety rules — and every number that reaches the screen carries its source, timestamp and mode.",
    s1: "01 · Intake — what comes in",
    s2: "02 · Reasoning — who touches it",
    s2note: "ThreadPoolExecutor fan-out · real latencies in the Agent crew panel",
    s3: "03 · The law — floors that only raise",
    s4: "04 · Out — what it becomes",
    oneFetch: "one HTTP fetch",
    perProvider: "per provider · per position",
    cacheTitle: "The series cache",
    cacheBody:
      "One response already holds 72 hours of hourly sea for that spot. We keep it — keyed to the kilometre, for ten minutes — so the 24-hour timeline, the safe-window scan and the authority board all answer from memory instead of hammering the provider.",
    cacheMeta: "failures remembered 60 s · cleared on mode toggle · 32 s → 0.02 s",
    everyAgent: "every agent · every hour",
    fromMemory: "answered from memory",
    degrade:
      "If a live provider fails, the agent degrades to the demo store and says so — the answer arrives either way, relabelled, never silently pretending to be live.",
    stamp: "Official severe warning → 92",
    law1: "IMD fishermen warning active → floor 70",
    law2: "wave ≥ 4.0 m → floor 85 · gale wind ≥ 62 km/h → floor 85",
    law3: "inside a restricted zone → floor 60",
    lawNote:
      "Deterministic rules can only raise a score. No model, no language output, no prompt can talk ORCA down from an official warning.",
    reading: "Reading the coast — right now",
    onePort: "one port every",
    flipNote: "edition · flip DATA EDITION in the header and watch the sources change",
    nowReading: "Now reading",
    wave: "Wave",
    wind: "Wind",
    sst: "Sea temp",
    vis: "Visibility",
    hailing: "Hailing the first landing centre…",
    unreachable: "Backend unreachable — is uvicorn running on port 8000?",
    hPort: "Port",
    hSource: "Source",
    hMode: "Mode",
    hLatency: "Latency",
    hAt: "At",
    feedNote:
      "These are the same readings the fishing model and the risk engine consume — wave and wind feed the safety score, SST and chlorophyll feed the chance-of-fish, and the provenance column is what the evidence table shows a fisher.",
    outVerdict: "A verdict",
    outVerdictD:
      "0–100 risk with every point attributed, floored by the safety law, spoken in the fisher's language.",
    outPlan: "A plan",
    outPlanD:
      "Ranked grounds with chance of fish and likely species, the best window, how long to stay, the safest course.",
    outLedger: "A ledger",
    outLedgerD:
      "Every value with source · timestamp · confidence · mode. Simulated data is always labelled. CSV export for the authority.",
  },
  hi: {
    engineRoom: "इंजन रूम",
    configNote: "GET /api/config हर वेट और सीमा दिखाता है — कुछ भी छिपा नहीं",
    title: "डेटा का हम क्या करते हैं",
    intro:
      "एक सवाल नीचे की पूरी मशीन चलाता है: लाइव स्रोत हर स्थान के लिए एक बार पढ़े जाते हैं, 72 घंटे की सीरीज़ के रूप में याद रहते हैं, दस एजेंट एक साथ उन पर तर्क करते हैं, निश्चित सुरक्षा नियम लागू होते हैं — और स्क्रीन तक पहुँचने वाले हर आँकड़े के साथ उसका स्रोत, समय और मोड होता है।",
    s1: "01 · आगम — क्या आता है",
    s2: "02 · तर्क — कौन छूता है",
    s2note: "ThreadPoolExecutor फैन-आउट · असली लेटेंसी एजेंट पैनल में",
    s3: "03 · नियम — जो सिर्फ़ जोखिम बढ़ाते हैं",
    s4: "04 · परिणाम — क्या बनता है",
    oneFetch: "एक HTTP कॉल",
    perProvider: "प्रति स्रोत · प्रति स्थान",
    cacheTitle: "सीरीज़ कैश",
    cacheBody:
      "एक जवाब में उस जगह के 72 घंटे का प्रति-घंटा समुद्र होता है। हम उसे रखते हैं — किलोमीटर पर, दस मिनट के लिए — ताकि 24 घंटे की टाइमलाइन, सुरक्षित-समय की जाँच और प्रशासन बोर्ड सब स्मृति से जवाब दें, स्रोत को बार-बार न पुकारें।",
    cacheMeta: "विफलता 60 सेकंड याद · मोड बदलने पर साफ़ · 32 s → 0.02 s",
    everyAgent: "हर एजेंट · हर घंटा",
    fromMemory: "स्मृति से जवाब",
    degrade:
      "लाइव स्रोत विफल हो तो एजेंट डेमो डेटा पर उतर आता है और यह बताता भी है — जवाब हर हाल में आता है, सही लेबल के साथ, कभी चुपचाप लाइव होने का दिखावा नहीं।",
    stamp: "आधिकारिक भीषण चेतावनी → 92",
    law1: "IMD मछुआरा चेतावनी सक्रिय → कम-से-कम 70",
    law2: "लहर ≥ 4.0 मी → 85 · आँधी हवा ≥ 62 किमी/घं → 85",
    law3: "प्रतिबंधित क्षेत्र के भीतर → 60",
    lawNote:
      "निश्चित नियम स्कोर सिर्फ़ बढ़ा सकते हैं। कोई मॉडल, कोई भाषा, कोई प्रॉम्प्ट ORCA को आधिकारिक चेतावनी से नीचे नहीं ला सकता।",
    reading: "तट की रीडिंग — अभी",
    onePort: "हर",
    flipNote: "संस्करण · हेडर में DATA EDITION बदलिए और स्रोत बदलते देखिए",
    nowReading: "अभी पढ़ रहे हैं",
    wave: "लहर",
    wind: "हवा",
    sst: "समुद्री तापमान",
    vis: "दृश्यता",
    hailing: "पहले लैंडिंग सेंटर से संपर्क…",
    unreachable: "बैकएंड नहीं मिला — क्या uvicorn पोर्ट 8000 पर चल रहा है?",
    hPort: "बंदरगाह",
    hSource: "स्रोत",
    hMode: "मोड",
    hLatency: "लेटेंसी",
    hAt: "समय",
    feedNote:
      "यही रीडिंग मत्स्य मॉडल और रिस्क इंजन खाते हैं — लहर-हवा सुरक्षा स्कोर में, तापमान-क्लोरोफिल मछली की संभावना में, और स्रोत वाला कॉलम वही है जो मछुआरे को प्रमाण तालिका में दिखता है।",
    outVerdict: "फ़ैसला",
    outVerdictD:
      "0–100 जोखिम, हर अंक के हिसाब के साथ, सुरक्षा नियमों से बँधा, मछुआरे की भाषा में बोला हुआ।",
    outPlan: "योजना",
    outPlanD:
      "रैंक की हुई जगहें, मछली की संभावना और संभावित प्रजातियाँ, सबसे अच्छा समय, कितना रुकना, सबसे सुरक्षित मार्ग।",
    outLedger: "बहीखाता",
    outLedgerD:
      "हर मान के साथ स्रोत · समय · भरोसा · मोड। नक़ली डेटा पर हमेशा लेबल। प्रशासन के लिए CSV निर्यात।",
  },
  mr: {
    engineRoom: "इंजिन रूम",
    configNote: "GET /api/config प्रत्येक वेट व मर्यादा दाखवते — काहीही लपवलेले नाही",
    title: "डेटाचे आम्ही काय करतो",
    intro:
      "एक प्रश्न खालची संपूर्ण यंत्रणा चालवतो: लाइव्ह स्रोत प्रत्येक ठिकाणासाठी एकदाच वाचले जातात, ७२ तासांची मालिका म्हणून लक्षात राहतात, दहा एजंट एकाच वेळी त्यावर तर्क करतात, निश्चित सुरक्षा नियम लागू होतात — आणि स्क्रीनवर पोहोचणाऱ्या प्रत्येक आकड्यासोबत त्याचा स्रोत, वेळ आणि मोड असतो.",
    s1: "01 · आवक — काय येते",
    s2: "02 · तर्क — कोण हाताळते",
    s2note: "ThreadPoolExecutor फॅन-आउट · खऱ्या लेटन्सी एजंट पॅनेलमध्ये",
    s3: "03 · नियम — जे फक्त धोका वाढवतात",
    s4: "04 · निकाल — काय बनते",
    oneFetch: "एक HTTP कॉल",
    perProvider: "प्रति स्रोत · प्रति ठिकाण",
    cacheTitle: "मालिका कॅशे",
    cacheBody:
      "एका उत्तरात त्या जागेचा ७२ तासांचा तासागणिक समुद्र असतो. आम्ही तो ठेवतो — किलोमीटरवर, दहा मिनिटांसाठी — म्हणजे २४ तासांची टाइमलाइन, सुरक्षित-वेळ तपासणी आणि प्रशासन फलक सर्व स्मृतीतून उत्तर देतात, स्रोताला पुन्हा पुन्हा हाक मारत नाहीत.",
    cacheMeta: "अपयश ६० सेकंद लक्षात · मोड बदलल्यावर साफ · 32 s → 0.02 s",
    everyAgent: "प्रत्येक एजंट · प्रत्येक तास",
    fromMemory: "स्मृतीतून उत्तर",
    degrade:
      "लाइव्ह स्रोत अयशस्वी झाला तर एजंट डेमो डेटावर उतरतो आणि तसे सांगतोही — उत्तर कोणत्याही परिस्थितीत येते, योग्य लेबलसह, लाइव्ह असल्याचा आव कधीही आणत नाही.",
    stamp: "अधिकृत तीव्र इशारा → 92",
    law1: "IMD मच्छीमार इशारा सक्रिय → किमान 70",
    law2: "लाट ≥ 4.0 मी → 85 · वादळी वारा ≥ 62 किमी/ता → 85",
    law3: "प्रतिबंधित क्षेत्रात → 60",
    lawNote:
      "निश्चित नियम गुण फक्त वाढवू शकतात. कोणताही मॉडेल, कोणतीही भाषा, कोणताही प्रॉम्प्ट ORCA ला अधिकृत इशाऱ्याखाली आणू शकत नाही.",
    reading: "किनाऱ्याचे वाचन — आत्ता",
    onePort: "दर",
    flipNote: "आवृत्ती · हेडरमधील DATA EDITION बदला आणि स्रोत बदलताना पाहा",
    nowReading: "आत्ता वाचत आहोत",
    wave: "लाट",
    wind: "वारा",
    sst: "समुद्र तापमान",
    vis: "दृश्यमानता",
    hailing: "पहिल्या लँडिंग सेंटरशी संपर्क…",
    unreachable: "बॅकएंड मिळाले नाही — uvicorn पोर्ट 8000 वर चालू आहे का?",
    hPort: "बंदर",
    hSource: "स्रोत",
    hMode: "मोड",
    hLatency: "लेटन्सी",
    hAt: "वेळ",
    feedNote:
      "हेच वाचन मासेमारी मॉडेल आणि रिस्क इंजिन वापरतात — लाट-वारा सुरक्षा गुणांत, तापमान-क्लोरोफिल माशांच्या शक्यतेत, आणि स्रोताचा स्तंभ तोच जो मच्छीमाराला पुरावा तक्त्यात दिसतो.",
    outVerdict: "निर्णय",
    outVerdictD:
      "0–100 धोका, प्रत्येक गुणाच्या हिशेबासह, सुरक्षा नियमांनी बांधलेला, मच्छीमाराच्या भाषेत बोललेला.",
    outPlan: "योजना",
    outPlanD:
      "क्रमवारी लावलेल्या जागा, माशांची शक्यता व संभाव्य प्रजाती, सर्वोत्तम वेळ, किती थांबायचे, सर्वात सुरक्षित मार्ग.",
    outLedger: "नोंदवही",
    outLedgerD:
      "प्रत्येक मूल्यासोबत स्रोत · वेळ · विश्वास · मोड. नमुना डेटावर नेहमी लेबल. प्रशासनासाठी CSV निर्यात.",
  },
};

/**
 * The engine room — the whole machine on one sheet, running.
 *
 * Three stories, told in order: what data comes in and what we do with it
 * (the part judges ask about), the crew that reasons over it, and the safety
 * law that no model output can undo. At the bottom, the machine is shown
 * actually running: a live feed cycling through the coast, port by port,
 * with provenance on every reading.
 */

type FeedRow = {
  port: string;
  state: string;
  mode: string;
  source: string;
  latency: number;
  wave: string;
  wind: string;
  sst: string;
  vis: string;
  at: string;
};

const POLL_MS = 7000;

function fmt(m?: api.Measurement | null): string {
  if (!m || m.value == null) return "—";
  return `${m.value} ${m.unit}`;
}

export default function SystemPanel({
  mode,
  language = "en",
}: {
  mode: string;
  language?: Language;
}) {
  const t = L10N[language] ?? L10N.en;
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [tick, setTick] = useState(0);
  const [scanning, setScanning] = useState(true);
  const portIdx = useRef(0);

  // Cycle the coastline: one port per poll, newest reading on top.
  useEffect(() => {
    let alive = true;
    const read = async () => {
      const port = PORTS[portIdx.current % PORTS.length];
      portIdx.current += 1;
      try {
        const f = await api.forecast(port.lat, port.lon);
        if (!alive) return;
        const row: FeedRow = {
          port: port.name,
          state: port.state,
          mode: f.ocean.mode,
          source: f.ocean.source === "OPEN_METEO" ? "Open-Meteo" : "Demo store",
          latency: (f.ocean.latency_ms ?? 0) + (f.weather.latency_ms ?? 0),
          wave: fmt(f.ocean.measurements?.wave_height),
          wind: fmt(f.weather.measurements?.wind_speed),
          sst: fmt(f.ocean.measurements?.sst),
          vis: fmt(f.weather.measurements?.visibility),
          at: new Date().toLocaleTimeString("en-IN", { hour12: false }),
        };
        setRows((r) => [row, ...r].slice(0, 6));
        setTick((t) => t + 1);
        setScanning(true);
      } catch {
        if (alive) setScanning(false);
      }
    };
    read();
    const timer = setInterval(read, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const latest = rows[0];

  const providerText: Record<Language, { gives: string; note: string }[]> = {
    en: [
      { gives: "wave height · wave period · sea-surface temperature · currents", note: "keyless public API — verified working" },
      { gives: "wind · rain probability · visibility · air temperature", note: "keyless public API — verified working" },
      { gives: "PFZ advisories · marine warnings · satellite SST", note: "no open public JSON API — slots in behind the same interface" },
      { gives: "species occurrence records, Indian coastal waters", note: "open biodiversity data, bundled as a dated snapshot — offline-safe" },
      { gives: "rehearsed sea states, keyed by hour of day", note: "every synthetic value is labelled simulated" },
    ],
    hi: [
      { gives: "लहर की ऊँचाई · अवधि · समुद्री सतह तापमान · धाराएँ", note: "बिना कुंजी सार्वजनिक API — जाँचा हुआ" },
      { gives: "हवा · वर्षा संभावना · दृश्यता · तापमान", note: "बिना कुंजी सार्वजनिक API — जाँचा हुआ" },
      { gives: "PFZ सलाह · समुद्री चेतावनियाँ · उपग्रह SST", note: "खुला JSON API नहीं — उसी इंटरफ़ेस के पीछे जुड़ते हैं" },
      { gives: "प्रजातियों की उपस्थिति के रिकॉर्ड, भारतीय तटीय जल", note: "खुला जैवविविधता डेटा, दिनांकित स्नैपशॉट — ऑफ़लाइन-सुरक्षित" },
      { gives: "घंटे के हिसाब से तैयार समुद्री स्थितियाँ", note: "हर नक़ली मान पर 'सिम्युलेटेड' लेबल" },
    ],
    mr: [
      { gives: "लाटेची उंची · कालावधी · समुद्र पृष्ठ तापमान · प्रवाह", note: "किल्लीशिवाय सार्वजनिक API — तपासलेले" },
      { gives: "वारा · पावसाची शक्यता · दृश्यमानता · तापमान", note: "किल्लीशिवाय सार्वजनिक API — तपासलेले" },
      { gives: "PFZ सल्ले · सागरी इशारे · उपग्रह SST", note: "खुले JSON API नाही — त्याच इंटरफेसमागे जोडले जातात" },
      { gives: "प्रजातींच्या उपस्थितीच्या नोंदी, भारतीय किनारी पाणी", note: "खुला जैवविविधता डेटा, दिनांकित स्नॅपशॉट — ऑफलाइन-सुरक्षित" },
      { gives: "तासागणिक तयार समुद्री स्थिती", note: "प्रत्येक नमुना मूल्यावर 'सिम्युलेटेड' लेबल" },
    ],
  };
  const pText = providerText[language] ?? providerText.en;

  const providers = [
    { name: "Open-Meteo Marine", status: "LIVE", color: "#1D7A50", live: true, ...pText[0] },
    { name: "Open-Meteo Forecast", status: "LIVE", color: "#1D7A50", live: true, ...pText[1] },
    { name: "INCOIS · IMD · MOSDAC", status: "INTERFACE READY", color: "#A17000", live: false, ...pText[2] },
    { name: "OBIS · Map of Life", status: "BUNDLED SNAPSHOT", color: "#1E5F7A", live: false, ...pText[3] },
    { name: "Demo store", status: "ALWAYS ON", color: "#42596D", live: false, ...pText[4] },
  ];

  const crewText: Record<Language, { phase: string; agents: string[]; note: string }[]> = {
    en: [
      { phase: "Understand", agents: ["Intent"], note: "rule-based parsing — language, place, time. No LLM." },
      { phase: "Gather", agents: ["Weather", "Ocean", "PFZ", "Alerts", "GIS"], note: "independent specialists fan out concurrently" },
      { phase: "Decide", agents: ["Risk engine", "Route (A*)"], note: "weighted model, then floors; safest ≠ shortest" },
      { phase: "Explain", agents: ["Explanation"], note: "plain words in EN / HI / MR, spoken back" },
    ],
    hi: [
      { phase: "समझो", agents: ["आशय"], note: "नियम-आधारित — भाषा, जगह, समय। कोई LLM नहीं।" },
      { phase: "जुटाओ", agents: ["मौसम", "समुद्र", "PFZ", "चेतावनियाँ", "GIS"], note: "स्वतंत्र विशेषज्ञ एक साथ निकलते हैं" },
      { phase: "तय करो", agents: ["रिस्क इंजन", "मार्ग (A*)"], note: "भारित मॉडल, फिर नियम; सुरक्षित ≠ छोटा" },
      { phase: "समझाओ", agents: ["व्याख्या"], note: "EN / HI / MR में सीधी भाषा, बोलकर भी" },
    ],
    mr: [
      { phase: "समजून घ्या", agents: ["हेतू"], note: "नियम-आधारित — भाषा, ठिकाण, वेळ. LLM नाही." },
      { phase: "गोळा करा", agents: ["हवामान", "समुद्र", "PFZ", "इशारे", "GIS"], note: "स्वतंत्र तज्ज्ञ एकाच वेळी निघतात" },
      { phase: "ठरवा", agents: ["रिस्क इंजिन", "मार्ग (A*)"], note: "भारित मॉडेल, मग नियम; सुरक्षित ≠ छोटा" },
      { phase: "समजावा", agents: ["स्पष्टीकरण"], note: "EN / HI / MR मध्ये सोपी भाषा, बोलूनही" },
    ],
  };
  const crew = crewText[language] ?? crewText.en;

  return (
    <div className="space-y-4">
      {/* ---------------- intro ---------------- */}
      <div className="panel rule-double overflow-hidden">
        <div className="hd">
          <span className="label">{t.engineRoom}</span>
          <span className="hidden font-mono text-[10px] text-chart-600 sm:block">
            {t.configNote}
          </span>
        </div>
        <div className="px-5 py-4">
          <h2 className="font-display text-[24px] font-bold leading-snug text-ink-900">
            {t.title}
          </h2>
          <p className="mt-1.5 max-w-[860px] text-[13.5px] leading-relaxed text-ink-500">
            {t.intro}
          </p>
        </div>
      </div>

      {/* ---------------- the data intake ---------------- */}
      <div className="panel overflow-hidden">
        <div className="hd">
          <span className="label">{t.s1}</span>
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-5">
          {providers.map((p) => (
            <div
              key={p.name}
              className="lift rounded-[2px] border bg-paper-100 px-3.5 py-3"
              style={{ borderColor: "var(--rule)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`pulse-dot ${p.live ? "" : "pulse-dot--still"}`}
                  style={{ background: p.color, color: p.color }}
                />
                <span className="font-display text-[14px] font-bold text-ink-900">{p.name}</span>
              </div>
              <div
                className="mt-1.5 inline-block border px-1.5 py-px font-mono text-[8.5px] font-bold tracking-[0.14em]"
                style={{ color: p.color, borderColor: p.color }}
              >
                {p.status}
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-700">{p.gives}</p>
              <p className="mt-1 text-[10.5px] italic leading-snug text-ink-400">{p.note}</p>
            </div>
          ))}
        </div>

        {/* the flow into the cache */}
        <div className="grid items-center gap-2 px-4 pb-4 lg:grid-cols-[1fr_auto_1.2fr_auto_1fr]">
          <div className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
            {t.oneFetch}
            <br />
            <span className="text-ink-400">{t.perProvider}</span>
          </div>
          <div className="signal-line hidden w-24 lg:block">
            <i />
            <i />
            <i />
          </div>
          <div
            className="rounded-[2px] border-2 border-chart-600 bg-chart-100/40 px-4 py-3 text-center"
          >
            <div className="font-display text-[15px] font-bold text-ink-900">
              {t.cacheTitle}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-700">{t.cacheBody}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-chart-700">
              {t.cacheMeta}
            </p>
          </div>
          <div className="signal-line hidden w-24 lg:block">
            <i />
            <i />
            <i />
          </div>
          <div className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
            {t.everyAgent}
            <br />
            <span className="text-ink-400">{t.fromMemory}</span>
          </div>
        </div>

        <p
          className="border-t px-4 py-2.5 text-[11px] italic leading-relaxed text-ink-500"
          style={{ borderColor: "var(--rule-faint)" }}
        >
          {t.degrade}
        </p>
      </div>

      {/* ---------------- the crew ---------------- */}
      <div className="panel overflow-hidden">
        <div className="hd">
          <span className="label">{t.s2}</span>
          <span className="font-mono text-[10px] text-ink-400">{t.s2note}</span>
        </div>
        <div className="grid gap-0 px-4 py-4 lg:grid-cols-[1fr_auto_1.6fr_auto_1.2fr_auto_1fr]">
          {crew.map((c, i) => (
            <Fragment key={c.phase}>
              {i > 0 && (
                <div className="signal-line mx-1 hidden w-14 self-center lg:block">
                  <i />
                  <i />
                  <i />
                </div>
              )}
              <div className="py-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[16px] font-bold text-ink-900">{c.phase}</span>
                  {c.agents.length > 1 && i === 1 && (
                    <span className="font-mono text-[9px] font-bold text-chart-700">
                      ∥ {c.agents.length} CONCURRENT
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.agents.map((a, j) => (
                    <span
                      key={a}
                      className="flex items-center gap-1.5 rounded-[2px] border bg-paper-100 px-2 py-1 font-mono text-[10px] font-semibold text-ink-800"
                      style={{ borderColor: "var(--rule)" }}
                    >
                      <span
                        className="pulse-dot !h-[6px] !w-[6px]"
                        style={{
                          background: "#2A7391",
                          color: "#2A7391",
                          animationDelay: `${j * 0.3}s`,
                        }}
                      />
                      {a}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] italic leading-snug text-ink-500">{c.note}</p>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      {/* ---------------- the safety law ---------------- */}
      <div className="panel hatch-danger overflow-hidden border-risk-extreme/50">
        <div className="hd border-risk-extreme/25">
          <span className="label flex items-center gap-2 !text-risk-extreme">
            <WarnGlyph size={13} /> {t.s3}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <span className="stamp text-[12px] text-risk-extreme">{t.stamp}</span>
          <div className="space-y-1 font-mono text-[11px] text-ink-800">
            <div>{t.law1}</div>
            <div>{t.law2}</div>
            <div>{t.law3}</div>
          </div>
          <p className="max-w-[380px] text-[11.5px] italic leading-relaxed text-ink-600">
            <LockGlyph size={12} className="mr-1 inline text-risk-extreme" />
            {t.lawNote}
          </p>
        </div>
      </div>

      {/* ---------------- the live feed ---------------- */}
      <div className="panel rule-double overflow-hidden">
        <div className="hd">
          <span className="label flex items-center gap-2">
            <span
              className={`pulse-dot ${scanning ? "" : "pulse-dot--still"}`}
              style={{ background: scanning ? "#1D7A50" : "#AF2318", color: scanning ? "#1D7A50" : "#AF2318" }}
            />
            {t.reading}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-ink-400">
            {t.onePort} {POLL_MS / 1000} s · {mode} {t.flipNote}
          </span>
        </div>

        {latest ? (
          <div key={tick} className="popin grid grid-cols-2 gap-0 border-b sm:grid-cols-6" style={{ borderColor: "var(--rule-faint)" }}>
            <div className="col-span-2 px-4 py-3">
              <div className="label !text-[9px]">{t.nowReading}</div>
              <div className="font-display text-[19px] font-bold leading-tight text-ink-900">
                {latest.port}
              </div>
              <div className="font-mono text-[10px] text-ink-400">
                {latest.state} · {latest.at} IST
              </div>
            </div>
            {[
              { k: t.wave, v: latest.wave },
              { k: t.wind, v: latest.wind },
              { k: t.sst, v: latest.sst },
              { k: t.vis, v: latest.vis },
            ].map((x) => (
              <div key={x.k} className="border-l px-3 py-3" style={{ borderColor: "var(--rule-faint)" }}>
                <div className="label truncate !text-[9px]">{x.k}</div>
                <div className="mt-1 font-mono text-[16px] font-bold tabular-nums text-ink-900">
                  {x.v}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-b px-4 py-4 text-[13px] italic text-ink-400" style={{ borderColor: "var(--rule-faint)" }}>
            {scanning ? t.hailing : t.unreachable}
          </div>
        )}

        {/* the log */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left font-mono text-[11px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--rule)" }}>
                {[t.hPort, t.wave, t.wind, "SST", t.vis, t.hSource, t.hMode, t.hLatency, t.hAt].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`py-2 text-[8.5px] font-bold uppercase tracking-[0.14em] text-ink-400 ${
                        i === 0 ? "pl-4 pr-3" : "px-3"
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.port}-${r.at}`}
                  className={`border-b last:border-0 ${i === 0 ? "popin bg-chart-100/40" : ""}`}
                  style={{ borderColor: "var(--rule-faint)", opacity: 1 - i * 0.1 }}
                >
                  <td className="py-2 pl-4 pr-3 font-sans font-bold text-ink-900">{r.port}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-800">{r.wave}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-800">{r.wind}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-800">{r.sst}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-800">{r.vis}</td>
                  <td className="px-3 py-2 text-ink-500">{r.source}</td>
                  <td className="px-3 py-2">
                    <span
                      className="border px-1.5 py-px text-[8.5px] font-bold tracking-wider"
                      style={{
                        color: r.mode === "LIVE" ? "#1D7A50" : "#A17000",
                        borderColor: r.mode === "LIVE" ? "#1D7A50" : "#A17000",
                      }}
                    >
                      {r.mode}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ink-500">{r.latency} ms</td>
                  <td className="px-3 py-2 tabular-nums text-ink-400">{r.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p
          className="flex items-center gap-2 border-t px-4 py-2.5 text-[11px] italic leading-relaxed text-ink-500"
          style={{ borderColor: "var(--rule-faint)" }}
        >
          <FishGlyph size={16} className="swim shrink-0 text-chart-500" />
          {t.feedNote}
        </p>
      </div>

      {/* ---------------- where it goes ---------------- */}
      <div className="panel overflow-hidden">
        <div className="hd">
          <span className="label">{t.s4}</span>
        </div>
        <div className="grid gap-0 sm:grid-cols-3">
          {[
            { h: t.outVerdict, d: t.outVerdictD },
            { h: t.outPlan, d: t.outPlanD },
            { h: t.outLedger, d: t.outLedgerD },
          ].map((x, i) => (
            <div
              key={x.h}
              className={`group px-5 py-4 transition-colors hover:bg-chart-100/40 ${i > 0 ? "sm:border-l" : ""}`}
              style={{ borderColor: "var(--rule-faint)" }}
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-[16px] font-bold text-ink-900">{x.h}</span>
                <CourseArrow
                  size={12}
                  className="text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-chart-600"
                />
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
