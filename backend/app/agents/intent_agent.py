"""Intent agent — turns one free-text/voice line into a structured request.

Rule-based on purpose. A hackathon demo cannot depend on an LLM round-trip (or
an API key) to understand "उद्या सकाळी ६ वाजता", and a safety product should not
let a language model decide *what was asked* without a deterministic fallback.
When an LLM is configured it is used only to enrich, never to replace, this.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from ..data.demo_store import now_ist
from ..data.geo import find_port, nearest_port
from ..schemas import Intent, Language, Location
from ..services.i18n import detect_language
from .base import timed
from ..schemas import AgentResult

# Devanagari -> Latin digits
DEV_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

TIME_WORDS: Dict[str, int] = {
    # English
    "dawn": 5, "sunrise": 6, "early morning": 5, "morning": 6, "forenoon": 10,
    "noon": 12, "midday": 12, "afternoon": 14, "evening": 18, "sunset": 18,
    "night": 21, "midnight": 0,
    # Hindi
    "सुबह": 6, "तड़के": 5, "दोपहर": 12, "शाम": 18, "रात": 21,
    # Marathi
    "सकाळी": 6, "पहाटे": 5, "दुपारी": 12, "संध्याकाळी": 18, "रात्री": 21,
}

INTENT_KEYWORDS: Dict[str, List[str]] = {
    "find_pfz": ["pfz", "fishing zone", "fishing zones", "where are the fish", "where to fish",
                 "catch", "मत्स्य क्षेत्र", "मछली", "मासेमारी क्षेत्र", "मासे कुठे", "जवळचे pfz",
                 "मछली कहाँ", "मासेमारीसाठी जागा"],
    "route": ["route", "way to", "how do i get", "navigate", "रास्ता", "मार्ग", "सुरक्षित मार्ग",
              "कसे जाऊ", "कैसे जाऊं"],
    "alerts": ["cyclone", "storm", "warning", "alert", "tsunami", "चक्रवात", "चक्रीवादळ",
               "तूफान", "वादळ", "चेतावनी", "इशारा", "अलर्ट"],
    "explain": ["why", "explain", "reason", "क्यों", "क्यूँ", "का ", "कारण", "कशामुळे"],
    "restricted": ["restricted", "boundary", "border", "prohibited", "प्रतिबंधित", "सीमा",
                   "बंदी", "निषिद्ध"],
}

ACTIVITY_KEYWORDS = {
    "fishing": ["fish", "fishing", "मासेमारी", "मछली", "मच्छीमारी"],
    "travel": ["travel", "go to", "sail", "प्रवास", "जाना", "जाणे"],
}


def _normalise(text: str) -> str:
    return text.translate(DEV_DIGITS).lower().strip()


def _extract_time(text: str) -> Optional[str]:
    """Return 'HH:MM' if the message pins a time of day."""
    t = _normalise(text)

    # 6 am / 6pm / 06:00 / 12 pm
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b", t)
    if m:
        hour = int(m.group(1)) % 12
        minute = int(m.group(2) or 0)
        if m.group(3).startswith("p"):
            hour += 12
        return f"{hour:02d}:{minute:02d}"

    m = re.search(r"\b(\d{1,2}):(\d{2})\b", t)
    if m:
        return f"{int(m.group(1)):02d}:{int(m.group(2)):02d}"

    # "सकाळी ६ वाजता" / "दुपारी १२" — word sets the part of day, digit the hour
    for word, default_hour in TIME_WORDS.items():
        if word in t:
            m = re.search(rf"{re.escape(word)}\D{{0,12}}(\d{{1,2}})", t)
            if not m:
                m = re.search(rf"(\d{{1,2}})\D{{0,12}}{re.escape(word)}", t)
            if m:
                hour = int(m.group(1))
                if default_hour >= 12 and hour < 12:
                    hour += 12
                if hour <= 23:
                    return f"{hour:02d}:00"
            return f"{default_hour:02d}:00"

    # bare "at 6" / "६ वाजता"
    m = re.search(r"\b(?:at|वाजता|बजे)\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:वाजता|बजे)\b", t)
    if m:
        hour = int(m.group(1) or m.group(2))
        if hour <= 23:
            return f"{hour:02d}:00"
    return None


def _extract_date(text: str, base: datetime) -> str:
    t = _normalise(text)
    if any(w in t for w in ["day after tomorrow", "परवा", "परसों"]):
        return (base + timedelta(days=2)).date().isoformat()
    if any(w in t for w in ["tomorrow", "उद्या", "कल"]):
        return (base + timedelta(days=1)).date().isoformat()
    if any(w in t for w in ["today", "आज", "अभी", "आत्ता"]):
        return base.date().isoformat()
    return base.date().isoformat()


# Most specific question wins: "safest route to the fishing zone" is a ROUTE
# question even though it also mentions fishing zones.
INTENT_PRIORITY = ["route", "find_pfz", "restricted", "alerts", "explain"]


def _classify(text: str) -> str:
    t = _normalise(text)
    for intent in INTENT_PRIORITY:
        if any(w in t for w in INTENT_KEYWORDS[intent]):
            return intent
    return "fishing_safety"


def _activity(text: str) -> str:
    t = _normalise(text)
    for activity, words in ACTIVITY_KEYWORDS.items():
        if any(w in t for w in words):
            return activity
    return "fishing"


# Every question gets the full safety core — a user who asks "is there a cyclone"
# still deserves a go/no-go verdict. Intent only adds the optional specialists.
SAFETY_CORE = ["weather", "ocean", "cyclone", "gis", "risk"]
EXTRA_BY_INTENT = {
    "fishing_safety": [],
    "find_pfz":       ["pfz"],
    "route":          ["pfz", "route"],
    "alerts":         [],
    "restricted":     [],
    "explain":        [],
}


def needs_for(intent_type: str) -> List[str]:
    return SAFETY_CORE + EXTRA_BY_INTENT.get(intent_type, [])


@timed
def run(message: str, *, language: Optional[Language] = None,
        latitude: Optional[float] = None, longitude: Optional[float] = None,
        location_name: Optional[str] = None,
        previous: Optional[Intent] = None) -> AgentResult:
    """Extract language, intent, place and time; inherit context on follow-ups."""
    now = now_ist()
    lang: Language = language or detect_language(message)
    intent_type = _classify(message)
    activity = _activity(message)

    # --- location ---------------------------------------------------------
    location: Optional[Location] = None
    port = find_port(message) or (find_port(location_name) if location_name else None)
    if latitude is not None and longitude is not None:
        near = nearest_port(latitude, longitude)
        location = Location(name=location_name or near["name"], latitude=latitude,
                            longitude=longitude, state=near["state"])
    elif port:
        location = Location(name=port["name"], latitude=port["lat"],
                            longitude=port["lon"], state=port["state"])
    elif previous and previous.location:
        location = previous.location            # follow-up inherits the place

    # --- time -------------------------------------------------------------
    time_str = _extract_time(message)
    date_str = _extract_date(message, now)
    if time_str is None and previous and previous.time and not _mentions_new_day(message):
        time_str = previous.time
        date_str = previous.date or date_str

    missing: List[str] = []
    if location is None:
        missing.append("location")

    intent = Intent(
        intent=intent_type,
        activity=activity,
        location=location,
        location_text=(location.name if location else ""),
        date=date_str,
        time=time_str or f"{now.hour:02d}:00",
        language=lang,
        raw_query=message,
        needs=needs_for(intent_type),
        missing=missing,
    )

    return AgentResult(
        agent="intent",
        ok=True,
        location=location,
        data=intent.model_dump(),
        source="ORCA",
        timestamp=now.isoformat(timespec="seconds"),
        confidence=0.9 if location else 0.6,
        mode="DEMO",
    )


def _mentions_new_day(text: str) -> bool:
    t = _normalise(text)
    return any(w in t for w in ["tomorrow", "today", "उद्या", "आज", "कल", "परवा", "परसों"])
