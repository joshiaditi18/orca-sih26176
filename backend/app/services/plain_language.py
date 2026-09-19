"""Plain-language advice.

Everything here is written for someone who has never read a marine bulletin.
Rules we hold ourselves to:

  * no jargon — "waves are about as tall as a person", not "Hs 1.8 m"
  * no percentages without a word for them — "good chance", not "62%"
  * clock times, not ISO timestamps — "between 2 PM and 6 PM"
  * every instruction is an action — "come back before dark", not "advisory"
  * the safety line always comes first, before any advice about fish

The technical numbers still exist everywhere else in the API. This module is
the translation layer, not a replacement for the evidence.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Sequence

Language = str


def clock(hour: int) -> Dict[Language, str]:
    """12-hour clock in each language — how people actually say the time."""
    h = int(hour) % 24
    suffix_en = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return {
        "en": f"{h12} {suffix_en}",
        "hi": f"{'सुबह' if 4 <= h < 12 else 'दोपहर' if 12 <= h < 17 else 'शाम' if 17 <= h < 20 else 'रात'} {h12} बजे",
        "mr": f"{'सकाळी' if 4 <= h < 12 else 'दुपारी' if 12 <= h < 17 else 'संध्याकाळी' if 17 <= h < 20 else 'रात्री'} {h12} वाजता",
    }


def span(from_h: int, to_h: int, lang: Language) -> str:
    a, b = clock(from_h)[lang], clock(to_h)[lang]
    joiner = {"en": "to", "hi": "से", "mr": "ते"}[lang]
    return f"{a} {joiner} {b}"


# A fisher navigates by "towards the west", not by "WSW".
_DIRECTION_WORDS = {
    "N": {"en": "north", "hi": "उत्तर", "mr": "उत्तर"},
    "NE": {"en": "north-east", "hi": "उत्तर-पूर्व", "mr": "ईशान्य"},
    "E": {"en": "east", "hi": "पूर्व", "mr": "पूर्व"},
    "SE": {"en": "south-east", "hi": "दक्षिण-पूर्व", "mr": "आग्नेय"},
    "S": {"en": "south", "hi": "दक्षिण", "mr": "दक्षिण"},
    "SW": {"en": "south-west", "hi": "दक्षिण-पश्चिम", "mr": "नैऋत्य"},
    "W": {"en": "west", "hi": "पश्चिम", "mr": "पश्चिम"},
    "NW": {"en": "north-west", "hi": "उत्तर-पश्चिम", "mr": "वायव्य"},
}


def direction_words(bearing: Optional[str], lang: Language) -> str:
    """Collapse a 16-point compass label to a plain 8-point direction word."""
    if not bearing:
        return ""
    b = bearing.upper()
    # NNE -> NE, ESE -> SE, and so on: keep the last two letters of a 3-letter
    # label, which is always the adjacent 8-point direction.
    key = b if b in _DIRECTION_WORDS else b[1:]
    return _DIRECTION_WORDS.get(key, _DIRECTION_WORDS.get(b[:1], {})).get(lang, "")


def sentence(text: str) -> str:
    """Capitalise the first letter without touching the rest (units, names)."""
    return text[:1].upper() + text[1:] if text else text


# --- how big is a wave, in human terms ------------------------------------
def wave_words(wave_m: Optional[float], lang: Language) -> str:
    if wave_m is None:
        return {"en": "sea height unknown", "hi": "लहरों की जानकारी नहीं",
                "mr": "लाटांची माहिती नाही"}[lang]
    if wave_m < 0.8:
        return {"en": "the sea is calm — small ripples only",
                "hi": "समुद्र शांत है — छोटी लहरें",
                "mr": "समुद्र शांत आहे — लहान लाटा"}[lang]
    if wave_m < 1.5:
        return {"en": "waves are about knee to waist high",
                "hi": "लहरें घुटने से कमर तक ऊँची हैं",
                "mr": "लाटा गुडघ्यापासून कंबरेइतक्या उंच आहेत"}[lang]
    if wave_m < 2.5:
        return {"en": "waves are taller than a person — the boat will be thrown about",
                "hi": "लहरें आदमी से ऊँची हैं — नाव बहुत हिलेगी",
                "mr": "लाटा माणसापेक्षा उंच आहेत — होडी खूप हलेल"}[lang]
    if wave_m < 4.0:
        return {"en": "waves are as tall as a house — very dangerous for a small boat",
                "hi": "लहरें घर जितनी ऊँची हैं — छोटी नाव के लिए बहुत खतरनाक",
                "mr": "लाटा घराएवढ्या उंच आहेत — लहान होडीसाठी अत्यंत धोकादायक"}[lang]
    return {"en": "the sea is wild — no small boat can survive this",
            "hi": "समुद्र बहुत भयंकर है — कोई छोटी नाव नहीं टिकेगी",
            "mr": "समुद्र अत्यंत खवळलेला आहे — कोणतीही लहान होडी टिकणार नाही"}[lang]


def wind_words(wind_kmh: Optional[float], lang: Language) -> str:
    if wind_kmh is None:
        return ""
    if wind_kmh < 15:
        return {"en": "there is barely any wind", "hi": "हवा बहुत कम है",
                "mr": "वारा फारच कमी आहे"}[lang]
    if wind_kmh < 30:
        return {"en": "there is a steady breeze", "hi": "हवा सामान्य है",
                "mr": "वारा सामान्य आहे"}[lang]
    if wind_kmh < 50:
        return {"en": "the wind is strong", "hi": "हवा तेज़ है", "mr": "वारा जोरदार आहे"}[lang]
    return {"en": "the wind is dangerously strong", "hi": "हवा बहुत ही खतरनाक तेज़ है",
            "mr": "वारा अत्यंत धोकादायक जोरात आहे"}[lang]


# --- the headline verdict --------------------------------------------------
GO_LINE = {
    "LOW": {"en": "You can go today.", "hi": "आप आज जा सकते हैं।", "mr": "तुम्ही आज जाऊ शकता."},
    "MODERATE": {"en": "You can go, but be careful and stay close to shore.",
                 "hi": "आप जा सकते हैं, पर सावधान रहें और किनारे के पास रहें।",
                 "mr": "तुम्ही जाऊ शकता, पण काळजी घ्या आणि किनाऱ्याजवळ राहा."},
    "HIGH": {"en": "Do not go out today.", "hi": "आज समुद्र में मत जाइए।",
             "mr": "आज समुद्रात जाऊ नका."},
    "EXTREME": {"en": "Do not go out. Stay on land and keep your boat tied.",
                "hi": "बिल्कुल मत जाइए। ज़मीन पर रहें और नाव बाँधकर रखें।",
                "mr": "अजिबात जाऊ नका. जमिनीवर राहा आणि होडी बांधून ठेवा."},
}

CATCH_WORD = {
    "very_good": {"en": "very good chance of fish", "hi": "मछली मिलने की बहुत अच्छी उम्मीद",
                  "mr": "मासे मिळण्याची खूप चांगली शक्यता"},
    "good": {"en": "good chance of fish", "hi": "मछली मिलने की अच्छी उम्मीद",
             "mr": "मासे मिळण्याची चांगली शक्यता"},
    "fair": {"en": "some chance of fish", "hi": "मछली मिलने की कुछ उम्मीद",
             "mr": "मासे मिळण्याची थोडी शक्यता"},
    "poor": {"en": "low chance of fish", "hi": "मछली मिलने की कम उम्मीद",
             "mr": "मासे मिळण्याची कमी शक्यता"},
}


def build(*, lang: Language, risk_category: str, official_warning: bool,
          wave_m: Optional[float], wind_kmh: Optional[float],
          improve_hour: Optional[int], zones: Sequence[Dict],
          closed_zones: Sequence[Dict], duration: Optional[Dict],
          best_window: Optional[Sequence[int]], forecast: Sequence[Dict]) -> List[str]:
    """The whole advisory, as short spoken-style sentences."""
    lines: List[str] = []

    # 1. safety first, always
    lines.append(GO_LINE.get(risk_category, GO_LINE["MODERATE"])[lang])
    sea = wave_words(wave_m, lang)
    wind = wind_words(wind_kmh, lang)
    lines.append(sentence(f"{sea}." if not wind else f"{sea}, {wind}."))

    if official_warning:
        lines.append({
            "en": "The government has put out a warning for this coast. Please follow it.",
            "hi": "सरकार ने इस तट के लिए चेतावनी दी है। कृपया उसका पालन करें।",
            "mr": "सरकारने या किनाऱ्यासाठी इशारा दिला आहे. कृपया तो पाळा.",
        }[lang])

    if risk_category in ("HIGH", "EXTREME") and improve_hour is not None:
        lines.append({
            "en": f"The sea should settle after {clock(improve_hour)['en']}. Ask me again then.",
            "hi": f"{clock(improve_hour)['hi']} के बाद समुद्र शांत होना चाहिए। तब दोबारा पूछें।",
            "mr": f"{clock(improve_hour)['mr']} नंतर समुद्र शांत व्हायला हवा. तेव्हा पुन्हा विचारा.",
        }[lang])

    # 2. closed areas, with the hours spelled out
    for z in closed_zones:
        window = z.get("window")
        name = z.get("name", "restricted area")
        if window:
            a, b = window.split("-")
            phrase = span(int(a.split(":")[0]), int(b.split(":")[0]), lang)
            lines.append({
                "en": f"Do not go into the red area on the map from {phrase} today. It is closed then.",
                "hi": f"नक्शे के लाल हिस्से में {phrase} के बीच मत जाइए। उस समय वह बंद रहता है।",
                "mr": f"नकाशावरील लाल भागात {phrase} या वेळेत जाऊ नका. त्या वेळी तो बंद असतो.",
            }[lang])
        else:
            lines.append({
                "en": f"Never enter the red area on the map — {name}. Boats are stopped and fined there.",
                "hi": f"नक्शे के लाल हिस्से में कभी मत जाइए — {name}। वहाँ नाव पकड़ी जाती है।",
                "mr": f"नकाशावरील लाल भागात कधीही जाऊ नका — {name}. तिथे होडी पकडली जाते.",
            }[lang])

    # 3. where the fish are
    good = [z for z in zones if z.get("rating") in ("very_good", "good")]
    if good:
        numbers = ", ".join(str(z["rank"]) for z in good[:3])
        # Point him at the ground worth the trip, not merely the highest odds.
        top = next((z for z in zones if z.get("recommended")), good[0])
        lines.append({
            "en": f"Areas {numbers} on the map are your best chances today.",
            "hi": f"नक्शे पर {numbers} नंबर की जगहें आज सबसे अच्छी हैं।",
            "mr": f"नकाशावरील {numbers} क्रमांकाच्या जागा आज सर्वात चांगल्या आहेत.",
        }[lang])
        where = direction_words(top.get("bearing"), lang)
        lines.append({
            "en": f"Area {top['rank']} is about {round(top['distance_km'])} kilometres "
                  f"towards the {where} — {CATCH_WORD[top['rating']]['en']} there.",
            "hi": f"जगह {top['rank']} यहाँ से लगभग {round(top['distance_km'])} किलोमीटर "
                  f"{where} की ओर है — वहाँ {CATCH_WORD[top['rating']]['hi']} है।",
            "mr": f"जागा {top['rank']} इथून अंदाजे {round(top['distance_km'])} किलोमीटर "
                  f"{where} दिशेला आहे — तिथे {CATCH_WORD[top['rating']]['mr']} आहे.",
        }[lang])
    elif zones:
        lines.append({
            "en": "None of the nearby areas look good today. Fishing will be hard.",
            "hi": "आज आसपास की कोई जगह अच्छी नहीं लग रही। मछली मिलना मुश्किल होगा।",
            "mr": "आज जवळपासची कोणतीही जागा चांगली दिसत नाही. मासे मिळणे कठीण होईल.",
        }[lang])

    # 4. best hours to be on the water
    if best_window and len(best_window) == 2:
        lines.append({
            "en": f"The best time to fish is {span(best_window[0], best_window[1], 'en')}.",
            "hi": f"मछली पकड़ने का सबसे अच्छा समय {span(best_window[0], best_window[1], 'hi')} है।",
            "mr": f"मासेमारीसाठी सर्वोत्तम वेळ {span(best_window[0], best_window[1], 'mr')} आहे.",
        }[lang])

    # 5. how long to stay
    if duration and duration.get("feasible"):
        hours = duration["recommended_hours"]
        trip = duration["total_trip_hours"]
        lines.append({
            "en": f"Stay there about {hours:g} hours. With travel, the whole trip is "
                  f"roughly {trip:g} hours.",
            "hi": f"वहाँ लगभग {hours:g} घंटे रुकिए। आने-जाने के साथ पूरी यात्रा "
                  f"करीब {trip:g} घंटे की होगी।",
            "mr": f"तिथे अंदाजे {hours:g} तास थांबा. ये-जा धरून संपूर्ण फेरी "
                  f"साधारण {trip:g} तासांची होईल.",
        }[lang])
        if duration.get("limited_by_weather"):
            lines.append({
                "en": "Come back earlier than usual — the weather turns after that.",
                "hi": "सामान्य से जल्दी लौट आइए — उसके बाद मौसम बिगड़ेगा।",
                "mr": "नेहमीपेक्षा लवकर परत या — त्यानंतर हवामान बिघडेल.",
            }[lang])
    elif duration is not None:
        lines.append({
            "en": "There is not enough safe time today to make the trip worthwhile.",
            "hi": "आज इतना सुरक्षित समय नहीं है कि जाना ठीक रहे।",
            "mr": "आज फेरी करण्याइतका सुरक्षित वेळ नाही.",
        }[lang])

    # 6. next two days
    for f in forecast[1:3]:
        day = {"en": {1: "Tomorrow", 2: "The day after"},
               "hi": {1: "कल", 2: "परसों"},
               "mr": {1: "उद्या", 2: "परवा"}}[lang][f["day_offset"]]
        lines.append({
            "en": f"{day}: {CATCH_WORD[f['rating']]['en']}, and the sea will be "
                  f"{'calmer' if f['calmer'] else 'rougher'}.",
            "hi": f"{day}: {CATCH_WORD[f['rating']]['hi']}, और समुद्र "
                  f"{'शांत' if f['calmer'] else 'ज़्यादा खराब'} रहेगा।",
            "mr": f"{day}: {CATCH_WORD[f['rating']]['mr']}, आणि समुद्र "
                  f"{'शांत' if f['calmer'] else 'अधिक खवळलेला'} असेल.",
        }[lang])

    # 7. the promise we never break
    lines.append({
        "en": "This is our best guess from the data — it is not a promise of fish. "
              "Always follow the Coast Guard and the government warning.",
        "hi": "यह आँकड़ों से लगाया गया अनुमान है — मछली की गारंटी नहीं। "
              "तटरक्षक बल और सरकारी चेतावनी का पालन ज़रूर करें।",
        "mr": "हा माहितीवरून काढलेला अंदाज आहे — माशांची हमी नाही. "
              "तटरक्षक दल आणि सरकारी इशारा नेहमी पाळा.",
    }[lang])

    return lines
