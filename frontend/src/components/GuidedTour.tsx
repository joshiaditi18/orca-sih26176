import { useEffect, useRef, useState } from "react";
import type { Language } from "../types";
import { PauseGlyph, PlayGlyph } from "./glyphs";

type L10n = Record<Language, string>;

export interface TourStep {
  title: L10n;
  say: L10n;
  /** Question to run through the full agent pipeline for this step. */
  ask?: string;
  /** Switch view before narrating. */
  tab?: "home" | "ask" | "authority" | "system";
  /** How long to dwell after the action, in ms. */
  dwell: number;
  /** Highlighted feature name shown as a chip. */
  feature?: string;
  /** Continue the existing conversation instead of starting a fresh one. */
  followUp?: boolean;
}

/**
 * The scripted walkthrough. Runs unattended — this is both the "explain the
 * product in 3 minutes" tour and the fallback if a live demo goes wrong.
 */
export const TOUR: TourStep[] = [
  {
    title: {
      en: "What ORCA is",
      hi: "ORCA क्या है",
      mr: "ORCA म्हणजे काय",
    },
    say: {
      en: "ORCA is not a chatbot. It is a crew of ten AI agents that read India's marine data together and return one safe, explainable decision for a fisher.",
      hi: "ORCA कोई चैटबॉट नहीं है। यह दस AI एजेंटों की एक टीम है जो भारत का समुद्री डेटा मिलकर पढ़ती है और मछुआरे के लिए एक सुरक्षित, समझाने योग्य फ़ैसला देती है।",
      mr: "ORCA चॅटबॉट नाही. ही दहा AI एजंटांची टीम आहे जी भारताचा सागरी डेटा एकत्र वाचते आणि मच्छीमारासाठी एक सुरक्षित, स्पष्टीकरणासह निर्णय देते.",
    },
    tab: "home",
    dwell: 7000,
    feature: "Overview",
  },
  {
    title: {
      en: "It opens knowing where you are",
      hi: "खुलते ही आपकी जगह जानता है",
      mr: "उघडताच तुमचे ठिकाण ओळखते",
    },
    say: {
      en: "The moment the app opens it finds the fisher's position and reads the sea around it — no typing, no settings. He sees his answer before he asks a question.",
      hi: "ऐप खुलते ही मछुआरे की जगह ढूँढ लेता है और आसपास का समुद्र पढ़ लेता है — न कुछ टाइप करना, न कोई सेटिंग। सवाल पूछने से पहले ही जवाब सामने होता है।",
      mr: "अ‍ॅप उघडताच मच्छीमाराचे ठिकाण शोधते आणि भोवतालचा समुद्र वाचते — टायपिंग नाही, सेटिंग नाही. प्रश्न विचारण्याआधीच उत्तर समोर असते.",
    },
    tab: "home",
    dwell: 9000,
    feature: "Auto location",
  },
  {
    title: {
      en: "Plain words, not weather jargon",
      hi: "सीधी भाषा, मौसम की तकनीकी नहीं",
      mr: "सोपी भाषा, हवामानाची क्लिष्टता नाही",
    },
    say: {
      en: "Everything is written the way a fisherman speaks: do not enter the red area between 2 PM and 6 PM, areas 1, 2 and 3 are your best chances, stay about three hours.",
      hi: "सब कुछ उसी भाषा में जो मछुआरा बोलता है: दोपहर 2 से 6 बजे तक लाल इलाक़े में मत जाओ, जगह 1, 2, 3 सबसे अच्छी हैं, क़रीब तीन घंटे रुको।",
      mr: "सगळे मच्छीमाराच्या भाषेत: दुपारी २ ते ६ लाल भागात जाऊ नका, जागा १, २, ३ सर्वोत्तम आहेत, सुमारे तीन तास थांबा.",
    },
    tab: "home",
    dwell: 10000,
    feature: "Plain language",
  },
  {
    title: {
      en: "Where the fish are, within 100 km",
      hi: "100 किमी में मछली कहाँ है",
      mr: "१०० किमीत मासे कुठे आहेत",
    },
    say: {
      en: "ORCA scores every ground within 100 kilometres for the chance of fish, and ranks them by what the trip is actually worth — a slightly better ground twice as far is usually the wrong advice.",
      hi: "ORCA 100 किलोमीटर के हर इलाक़े को मछली मिलने की संभावना पर आँकता है, और यात्रा की असली क़ीमत से रैंक करता है — थोड़ी बेहतर पर दुगनी दूर जगह अक्सर ग़लत सलाह होती है।",
      mr: "ORCA १०० किमीतील प्रत्येक जागेला मासे मिळण्याच्या शक्यतेवर गुण देते, आणि फेरी खरोखर किती फायद्याची यावरून क्रम लावते — थोडी चांगली पण दुप्पट दूरची जागा बहुधा चुकीचा सल्ला असतो.",
    },
    tab: "home",
    dwell: 10000,
    feature: "Fishing probability",
  },
  {
    title: {
      en: "How long to stay, and the next two days",
      hi: "कितनी देर रुकें, और अगले दो दिन",
      mr: "किती वेळ थांबायचे, आणि पुढचे दोन दिवस",
    },
    say: {
      en: "It recommends how many hours to work the ground, what the trip should earn after fuel, and shows whether tomorrow or the day after will be better.",
      hi: "यह बताता है कि कितने घंटे काम करें, ईंधन के बाद यात्रा से कितना मिलेगा, और कल या परसों बेहतर होगा या नहीं।",
      mr: "किती तास काम करायचे, इंधनानंतर फेरीतून किती मिळेल, आणि उद्या-परवा चांगला असेल का — हे सांगते.",
    },
    tab: "home",
    dwell: 9000,
    feature: "Trip plan · economics",
  },
  {
    title: {
      en: "Ask in your own language",
      hi: "अपनी भाषा में पूछिए",
      mr: "तुमच्या भाषेत विचारा",
    },
    say: {
      en: "A fisherman near Mumbai asks in Marathi whether he can go out at 6 AM tomorrow. ORCA detects the language itself — no setting to change.",
      hi: "मुंबई के पास एक मछुआरा मराठी में पूछता है कि कल सुबह 6 बजे जा सकता है या नहीं। ORCA भाषा ख़ुद पहचान लेता है — कोई सेटिंग नहीं बदलनी।",
      mr: "मुंबईजवळचा मच्छीमार मराठीत विचारतो — उद्या सकाळी ६ ला जाऊ का? ORCA भाषा स्वतः ओळखते — कोणतीही सेटिंग बदलावी लागत नाही.",
    },
    ask: "मी उद्या सकाळी ६ वाजता मुंबईजवळ मासेमारीला जाऊ शकतो का?",
    dwell: 9000,
    feature: "Multilingual · voice",
  },
  {
    title: {
      en: "A decision, with reasons",
      hi: "फ़ैसला, कारणों के साथ",
      mr: "निर्णय, कारणांसह",
    },
    say: {
      en: "70 out of 100 — HIGH RISK. Every point is attributed: an active IMD fishermen warning, high waves, strong winds. Nothing is a black box.",
      hi: "100 में 70 — ज़्यादा जोखिम। हर अंक का हिसाब है: IMD की सक्रिय चेतावनी, ऊँची लहरें, तेज़ हवा। कुछ भी ब्लैक बॉक्स नहीं।",
      mr: "१०० पैकी ७० — जास्त धोका. प्रत्येक गुणाचा हिशेब आहे: IMD चा सक्रिय इशारा, उंच लाटा, जोराचा वारा. काहीही ब्लॅक बॉक्स नाही.",
    },
    dwell: 9000,
    feature: "Explainable risk",
  },
  {
    title: {
      en: "It knows when to go instead",
      hi: "कब जाना ठीक है, यह भी बताता है",
      mr: "कधी जाणे योग्य, हेही सांगते",
    },
    say: {
      en: "The 24-hour timeline shows the safe window. ORCA does not just say no — it says conditions improve after 11:00, come back then.",
      hi: "24 घंटे की टाइमलाइन सुरक्षित समय दिखाती है। ORCA सिर्फ़ मना नहीं करता — कहता है 11 बजे के बाद हालात सुधरेंगे, तब आइए।",
      mr: "२४ तासांची टाइमलाइन सुरक्षित वेळ दाखवते. ORCA फक्त नाही म्हणत नाही — ११ नंतर परिस्थिती सुधारेल, तेव्हा या, असे सांगते.",
    },
    dwell: 8000,
    feature: "Risk timeline",
  },
  {
    title: {
      en: "It remembers the conversation",
      hi: "बातचीत याद रखता है",
      mr: "संभाषण लक्षात ठेवते",
    },
    say: {
      en: "He asks a follow-up: what about 12 PM? ORCA keeps the place and the day, re-checks only what changed, and the risk drops to MODERATE.",
      hi: "वह आगे पूछता है: दोपहर 12 बजे क्या? ORCA जगह और दिन याद रखता है, सिर्फ़ बदला हुआ दोबारा जाँचता है, और जोखिम घटकर मध्यम हो जाता है।",
      mr: "तो पुढे विचारतो: दुपारी १२ वाजता काय? ORCA जागा आणि दिवस लक्षात ठेवते, फक्त बदललेले पुन्हा तपासते, आणि धोका मध्यम होतो.",
    },
    ask: "दुपारी १२ वाजता काय?",
    followUp: true, // must NOT reset the session — that is the whole point
    dwell: 9000,
    feature: "Context memory",
  },
  {
    title: {
      en: "Official warnings always win",
      hi: "आधिकारिक चेतावनी हमेशा ऊपर",
      mr: "अधिकृत इशारा नेहमी वरचढ",
    },
    say: {
      en: "Near Paradip a severe cyclone warning is in force — and the storm is drawn on the chart, warning area hatched, track heading for the coast. A deterministic rule forces EXTREME.",
      hi: "पारादीप के पास भीषण चक्रवात की चेतावनी लागू है — तूफ़ान नक़्शे पर बना है, चेतावनी क्षेत्र और तट की ओर उसका रास्ता भी। एक निश्चित नियम EXTREME लागू कर देता है।",
      mr: "पारादीपजवळ तीव्र चक्रीवादळाचा इशारा लागू आहे — वादळ नकाशावर काढले आहे, इशारा क्षेत्र आणि किनाऱ्याकडे जाणारा मार्गही. एक निश्चित नियम EXTREME लागू करतो.",
    },
    ask: "Is there a cyclone near Paradip? Can I go fishing?",
    dwell: 10000,
    feature: "Safety override",
  },
  {
    title: {
      en: "Where the fish are likely to be",
      hi: "मछली कहाँ मिल सकती है",
      mr: "मासे कुठे मिळू शकतात",
    },
    say: {
      en: "Asked in Hindi near Kochi, ORCA ranks potential fishing zones from sea-surface-temperature fronts and chlorophyll — the same reasoning INCOIS uses. It never claims to see fish.",
      hi: "कोच्चि के पास हिंदी में पूछने पर ORCA तापमान और क्लोरोफिल से संभावित मत्स्य क्षेत्र रैंक करता है — वही तरीक़ा जो INCOIS अपनाता है। मछली देखने का दावा कभी नहीं करता।",
      mr: "कोचीजवळ हिंदीत विचारल्यावर ORCA तापमान आणि क्लोरोफिलवरून संभाव्य मासेमारी क्षेत्रे क्रमाने लावते — INCOIS हीच पद्धत वापरते. मासे दिसल्याचा दावा कधीही करत नाही.",
    },
    ask: "कोच्चि के पास मछली पकड़ने का क्षेत्र कहाँ है?",
    dwell: 10000,
    feature: "PFZ intelligence",
  },
  {
    title: {
      en: "The safest route is not the shortest",
      hi: "सबसे सुरक्षित रास्ता सबसे छोटा नहीं",
      mr: "सर्वात सुरक्षित मार्ग सर्वात छोटा नाही",
    },
    say: {
      en: "The direct track to the fishing ground cuts through a port channel and a naval exercise area. ORCA plans around them — five kilometres longer, and legal.",
      hi: "सीधा रास्ता बंदरगाह चैनल और नौसेना क्षेत्र से होकर जाता है। ORCA उनके चारों ओर से योजना बनाता है — पाँच किलोमीटर लंबा, पर क़ानूनी।",
      mr: "थेट मार्ग बंदर चॅनेल आणि नौदल क्षेत्रातून जातो. ORCA त्यांना वळसा घालून मार्ग आखते — पाच किलोमीटर लांब, पण कायदेशीर.",
    },
    ask: "Give me the safest route to the nearest fishing zone near Mumbai",
    dwell: 11000,
    feature: "Route + geofencing",
  },
  {
    title: {
      en: "Drag the boat anywhere",
      hi: "नाव कहीं भी खींचिए",
      mr: "होडी कुठेही ओढा",
    },
    say: {
      en: "The vessel marker is draggable. Drop it near a restricted area and ORCA geofences that exact position live — this is what warns a fisher before he crosses a maritime boundary.",
      hi: "नाव का निशान खींचा जा सकता है। प्रतिबंधित क्षेत्र के पास छोड़िए और ORCA उसी जगह की जाँच तुरंत करता है — यही मछुआरे को सीमा पार करने से पहले चेताता है।",
      mr: "होडीचा मार्कर ओढता येतो. प्रतिबंधित क्षेत्राजवळ सोडा आणि ORCA त्या जागेची लगेच तपासणी करते — हेच मच्छीमाराला सीमा ओलांडण्याआधी सावध करते.",
    },
    dwell: 9000,
    feature: "Live geofence",
  },
  {
    title: {
      en: "Ten agents, working in parallel",
      hi: "दस एजेंट, एक साथ",
      mr: "दहा एजंट, एकाच वेळी",
    },
    say: {
      en: "The agent panel shows what actually ran: weather, ocean, fishing zones, alerts and GIS all fan out concurrently, then the risk engine waits for every one of them.",
      hi: "एजेंट पैनल दिखाता है कि असल में क्या चला: मौसम, समुद्र, मत्स्य क्षेत्र, चेतावनियाँ और GIS साथ-साथ चलते हैं, फिर रिस्क इंजन सबका इंतज़ार करता है।",
      mr: "एजंट पॅनेल खरोखर काय चालले ते दाखवते: हवामान, समुद्र, मासेमारी क्षेत्रे, इशारे आणि GIS एकाच वेळी चालतात, मग रिस्क इंजिन सर्वांची वाट पाहते.",
    },
    dwell: 9000,
    feature: "Agent crew",
  },
  {
    title: {
      en: "The engine room",
      hi: "इंजन रूम",
      mr: "इंजिन रूम",
    },
    say: {
      en: "The system view shows the whole machine running: live providers feeding a 72-hour series cache, ten agents fanning out, the safety floors no model can undo — and the coast being read live, port by port.",
      hi: "सिस्टम व्यू पूरी मशीन चलती हुई दिखाता है: लाइव स्रोत, 72 घंटे का कैश, दस एजेंट, सुरक्षा नियम जिन्हें कोई मॉडल नहीं बदल सकता — और तट की लाइव रीडिंग, बंदरगाह-दर-बंदरगाह।",
      mr: "सिस्टम व्ह्यू संपूर्ण यंत्रणा चालताना दाखवते: लाइव्ह स्रोत, ७२ तासांचा कॅशे, दहा एजंट, कोणताही मॉडेल बदलू न शकणारे सुरक्षा नियम — आणि किनाऱ्याचे लाइव्ह वाचन, बंदर-दर-बंदर.",
    },
    tab: "system" as const,
    dwell: 11000,
    feature: "Architecture · live feed",
  },
  {
    title: {
      en: "It scales past one fisherman",
      hi: "एक मछुआरे से आगे",
      mr: "एका मच्छीमाराच्या पुढे",
    },
    say: {
      en: "The authority view scores every landing centre on the coast with the same engine — the district administration sees the same evidence the fisher sees.",
      hi: "प्रशासन व्यू उसी इंजन से तट के हर लैंडिंग सेंटर को आँकता है — ज़िला प्रशासन वही प्रमाण देखता है जो मछुआरा देखता है।",
      mr: "प्रशासन व्ह्यू त्याच इंजिनने किनाऱ्यावरील प्रत्येक लँडिंग सेंटरला गुण देते — जिल्हा प्रशासनाला तेच पुरावे दिसतात जे मच्छीमाराला दिसतात.",
    },
    tab: "authority" as const,
    dwell: 10000,
    feature: "Authority dashboard",
  },
  {
    title: {
      en: "Built to be trusted",
      hi: "भरोसे के लिए बना",
      mr: "विश्वासासाठी बांधलेले",
    },
    say: {
      en: "Every value carries its source, timestamp and confidence. Simulated data is always labelled. ORCA is decision support — it never replaces an official advisory.",
      hi: "हर मान के साथ उसका स्रोत, समय और भरोसा है। नक़ली डेटा पर हमेशा लेबल है। ORCA निर्णय में सहायक है — आधिकारिक सलाह की जगह कभी नहीं लेता।",
      mr: "प्रत्येक मूल्यासोबत त्याचा स्रोत, वेळ आणि विश्वास आहे. नमुना डेटावर नेहमी लेबल असते. ORCA निर्णयाला मदत करते — अधिकृत सल्ल्याची जागा कधीही घेत नाही.",
    },
    tab: "home",
    dwell: 8000,
    feature: "Provenance",
  },
];

export default function GuidedTour({
  step,
  language = "en",
  paused,
  onPause,
  onNext,
  onPrev,
  onExit,
}: {
  step: number;
  language?: Language;
  paused: boolean;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
}) {
  const s = TOUR[step];
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number>(Date.now());

  // Progress bar driven by wall-clock, not rAF, so it still advances when the
  // window is not compositing.
  useEffect(() => {
    startedAt.current = Date.now();
    setProgress(0);
    if (paused) return;
    const id = window.setInterval(() => {
      setProgress(Math.min(1, (Date.now() - startedAt.current) / s.dwell));
    }, 100);
    return () => window.clearInterval(id);
  }, [step, paused, s.dwell]);

  if (!s) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex justify-center p-4">
      <div
        className="panel rule-double pointer-events-auto w-full max-w-3xl shadow-2xl"
        style={{ background: "var(--paper-bright)" }}
      >
        {/* progress */}
        <div className="h-[3px] bg-ink-900/10">
          <div
            className="h-full bg-ink-900 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex items-start gap-4 px-5 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[2px] bg-ink-900 font-display text-[16px] font-black text-paper-50">
            {step + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-[16px] font-bold text-ink-900">
                {s.title[language] ?? s.title.en}
              </h3>
              {s.feature && (
                <span className="border border-chart-500/50 bg-chart-100/50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-chart-700">
                  {s.feature}
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-400">
                {step + 1} / {TOUR.length}
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-700">
              {s.say[language] ?? s.say.en}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={onPrev}
              disabled={step === 0}
              title="Previous"
              className="btn-square !h-8 !w-8 disabled:opacity-30"
            >
              ‹
            </button>
            <button
              onClick={onPause}
              title={paused ? "Resume" : "Pause"}
              className="grid h-9 w-9 place-items-center rounded-[2px] bg-ink-900 text-paper-50 transition hover:bg-ink-700"
            >
              {paused ? <PlayGlyph size={12} /> : <PauseGlyph size={12} />}
            </button>
            <button onClick={onNext} title="Next" className="btn-square !h-8 !w-8">
              ›
            </button>
            <button
              onClick={onExit}
              title="Exit tour"
              className="btn-square !h-8 !w-8 hover:!border-risk-extreme hover:!bg-risk-extreme"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
