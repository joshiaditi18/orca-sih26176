"""Cached demo datasets — the reason ORCA cannot be killed by stage Wi-Fi.

Design choice: demo conditions are keyed by HOUR OF DAY, not absolute date, so
"tomorrow 6 AM" and "today 6 AM" both resolve to the same rehearsed sea state.
Every value returned from here is stamped source="DEMO" and carries the
disclaimer text — synthetic data is never dressed up as an official feed.

Scenario is selected by the place the user asks about, which keeps the demo
script natural (no hidden switches to flip on stage):

    Mumbai      -> rough morning, IMD warning, clears after 11:00   (HIGH)
    Goa         -> calm all day                                     (LOW)
    Paradip     -> severe cyclone warning                           (EXTREME)
    Kochi       -> moderate seas, excellent fishing zones           (MODERATE)
    Digha       -> rough seas                                       (HIGH)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from ..config import DEMO_DISCLAIMER
from .geo import (PORTS, compass, bearing_deg, destination, haversine_km,
                  is_on_land, nearest_port, seaward_bearing)

IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    return datetime.now(IST)


def iso(dt: Optional[datetime] = None) -> str:
    return (dt or now_ist()).isoformat(timespec="seconds")


# --------------------------------------------------------------------------
# Hourly keyframes per scenario.  hour -> conditions
# --------------------------------------------------------------------------
Keyframes = Dict[int, Dict[str, float]]

SCENARIOS: Dict[str, Dict] = {
    # ---- THE KILLER DEMO -------------------------------------------------
    "rough_clearing": {
        "label": "Rough morning clearing by midday",
        "keyframes": {
            0:  {"wave": 2.5, "period": 6.6, "wind": 33, "wind_dir": 225, "rain": 65,
                 "visibility": 6.0, "sst": 27.6, "current": 0.85, "chl": 1.30},
            6:  {"wave": 2.4, "period": 7.2, "wind": 34, "wind_dir": 230, "rain": 70,
                 "visibility": 5.0, "sst": 27.8, "current": 0.85, "chl": 1.42},
            11: {"wave": 1.9, "period": 7.4, "wind": 27, "wind_dir": 240, "rain": 45,
                 "visibility": 8.0, "sst": 28.0, "current": 0.65, "chl": 1.38},
            14: {"wave": 1.3, "period": 7.8, "wind": 20, "wind_dir": 250, "rain": 20,
                 "visibility": 12.0, "sst": 28.4, "current": 0.45, "chl": 1.30},
            18: {"wave": 1.2, "period": 8.0, "wind": 18, "wind_dir": 250, "rain": 15,
                 "visibility": 12.0, "sst": 28.2, "current": 0.40, "chl": 1.26},
            23: {"wave": 1.7, "period": 7.0, "wind": 25, "wind_dir": 235, "rain": 35,
                 "visibility": 9.0, "sst": 27.8, "current": 0.60, "chl": 1.32},
        },
        "alerts": [
            {
                "type": "fishermen_warning",
                "severity": "moderate",
                "official": True,
                "active_hours": (0, 11),          # expires at 11:00 IST
                "headline": "Fishermen advised not to venture into the sea",
                "detail": "Squally weather with wind speed reaching 35-45 kmph very likely "
                          "over the north Maharashtra coast.",
                "source": "IMD",
                # The squall belt off the north Maharashtra coast — circle only.
                "storm": {"latitude": 19.40, "longitude": 72.20, "radius_km": 110, "track": []},
            }
        ],
    },
    "calm": {
        "label": "Calm seas",
        "keyframes": {
            0:  {"wave": 0.7, "period": 8.4, "wind": 12, "wind_dir": 275, "rain": 5,
                 "visibility": 14.0, "sst": 28.6, "current": 0.25, "chl": 0.85},
            6:  {"wave": 0.8, "period": 8.6, "wind": 13, "wind_dir": 280, "rain": 5,
                 "visibility": 15.0, "sst": 28.5, "current": 0.28, "chl": 0.92},
            12: {"wave": 1.0, "period": 8.2, "wind": 16, "wind_dir": 285, "rain": 10,
                 "visibility": 14.0, "sst": 29.1, "current": 0.32, "chl": 0.88},
            18: {"wave": 0.9, "period": 8.4, "wind": 14, "wind_dir": 280, "rain": 8,
                 "visibility": 14.0, "sst": 28.9, "current": 0.30, "chl": 0.86},
            23: {"wave": 0.8, "period": 8.5, "wind": 12, "wind_dir": 275, "rain": 5,
                 "visibility": 15.0, "sst": 28.6, "current": 0.26, "chl": 0.84},
        },
        "alerts": [],
    },
    "cyclone": {
        "label": "Severe cyclonic storm approaching",
        "keyframes": {
            0:  {"wave": 4.6, "period": 9.5, "wind": 78, "wind_dir": 110, "rain": 92,
                 "visibility": 1.5, "sst": 29.4, "current": 1.6, "chl": 0.55},
            6:  {"wave": 5.2, "period": 9.8, "wind": 88, "wind_dir": 105, "rain": 95,
                 "visibility": 1.0, "sst": 29.5, "current": 1.8, "chl": 0.52},
            12: {"wave": 5.8, "period": 10.2, "wind": 95, "wind_dir": 100, "rain": 96,
                 "visibility": 0.8, "sst": 29.6, "current": 1.9, "chl": 0.50},
            18: {"wave": 5.4, "period": 10.0, "wind": 90, "wind_dir": 95, "rain": 94,
                 "visibility": 1.0, "sst": 29.5, "current": 1.8, "chl": 0.51},
            23: {"wave": 4.9, "period": 9.6, "wind": 82, "wind_dir": 90, "rain": 90,
                 "visibility": 1.4, "sst": 29.4, "current": 1.7, "chl": 0.54},
        },
        "alerts": [
            {
                "type": "cyclone_warning",
                "severity": "severe",
                "official": True,
                "active_hours": (0, 24),
                "headline": "Severe Cyclonic Storm — Orange message for north Odisha coast",
                "detail": "Sea condition phenomenal. Fishermen are advised NOT to venture into "
                          "the sea and to return to coast immediately.",
                "source": "IMD",
                # Synthetic storm geometry so the chart can DRAW the warning,
                # not just recite it: centre, warning radius, and a track with
                # past (solid history) and forecast positions. Illustrative —
                # carried to the UI with the same simulated-data labelling.
                "storm": {
                    "latitude": 19.55, "longitude": 87.65, "radius_km": 180,
                    "track": [
                        {"latitude": 17.80, "longitude": 89.30, "label": "-24 h"},
                        {"latitude": 18.80, "longitude": 88.40, "label": "-12 h"},
                        {"latitude": 19.55, "longitude": 87.65, "label": "now"},
                        {"latitude": 20.30, "longitude": 86.90, "label": "+12 h"},
                        {"latitude": 20.95, "longitude": 86.15, "label": "+24 h"},
                    ],
                },
            },
            {
                "type": "high_wave_alert",
                "severity": "high",
                "official": True,
                "active_hours": (0, 24),
                "headline": "High Wave Alert — wave height 4.5-6.0 m",
                "detail": "INCOIS high wave alert in force along the Odisha coast.",
                "source": "INCOIS",
            },
        ],
    },
    "moderate": {
        "label": "Moderate seas, good fishing",
        "keyframes": {
            0:  {"wave": 1.4, "period": 7.8, "wind": 21, "wind_dir": 260, "rain": 25,
                 "visibility": 10.0, "sst": 28.9, "current": 0.45, "chl": 1.65},
            6:  {"wave": 1.3, "period": 8.0, "wind": 19, "wind_dir": 265, "rain": 20,
                 "visibility": 12.0, "sst": 28.8, "current": 0.42, "chl": 1.72},
            12: {"wave": 1.6, "period": 7.6, "wind": 24, "wind_dir": 270, "rain": 30,
                 "visibility": 10.0, "sst": 29.3, "current": 0.50, "chl": 1.60},
            18: {"wave": 1.5, "period": 7.7, "wind": 22, "wind_dir": 265, "rain": 28,
                 "visibility": 11.0, "sst": 29.0, "current": 0.47, "chl": 1.58},
            23: {"wave": 1.4, "period": 7.9, "wind": 20, "wind_dir": 260, "rain": 22,
                 "visibility": 11.0, "sst": 28.9, "current": 0.44, "chl": 1.62},
        },
        "alerts": [],
    },
    "rough": {
        "label": "Rough seas all day",
        "keyframes": {
            0:  {"wave": 2.8, "period": 6.8, "wind": 42, "wind_dir": 160, "rain": 75,
                 "visibility": 4.0, "sst": 28.2, "current": 1.0, "chl": 1.10},
            6:  {"wave": 3.0, "period": 6.6, "wind": 45, "wind_dir": 155, "rain": 80,
                 "visibility": 3.5, "sst": 28.1, "current": 1.1, "chl": 1.08},
            12: {"wave": 3.2, "period": 6.9, "wind": 47, "wind_dir": 150, "rain": 82,
                 "visibility": 3.0, "sst": 28.4, "current": 1.15, "chl": 1.05},
            18: {"wave": 2.9, "period": 6.7, "wind": 43, "wind_dir": 155, "rain": 78,
                 "visibility": 4.0, "sst": 28.3, "current": 1.05, "chl": 1.07},
            23: {"wave": 2.7, "period": 6.8, "wind": 40, "wind_dir": 160, "rain": 72,
                 "visibility": 4.5, "sst": 28.2, "current": 1.0, "chl": 1.09},
        },
        "alerts": [
            {
                "type": "fishermen_warning",
                "severity": "high",
                "official": True,
                "active_hours": (0, 24),
                "headline": "Fishermen warning — squally weather over the north Bay of Bengal",
                "detail": "Wind speed reaching 45-55 kmph. Fishermen advised not to venture out.",
                "source": "IMD",
                # A warning belt, not a storm — circle only, no track.
                "storm": {"latitude": 21.00, "longitude": 88.60, "radius_km": 130, "track": []},
            }
        ],
    },
}

# place -> scenario
PORT_SCENARIO: Dict[str, str] = {
    "Mumbai": "rough_clearing",
    "Ratnagiri": "rough_clearing",
    "Panaji (Goa)": "calm",
    "Veraval": "moderate",
    "Kochi": "moderate",
    "Chennai": "moderate",
    "Visakhapatnam": "calm",
    "Paradip": "cyclone",
    "Digha": "rough",
    "Port Blair": "calm",
}

# Lightning is scenario-level rather than hourly.
LIGHTNING_SCENARIOS = {"cyclone", "rough"}

SEA_STATE_BANDS: List[Tuple[float, str, str]] = [
    (0.5, "calm", "शांत"),
    (1.25, "slight", "किंचित"),
    (2.5, "moderate", "मध्यम"),
    (4.0, "rough", "खवळलेला"),
    (6.0, "very rough", "अतिशय खवळलेला"),
    (99.0, "phenomenal", "अत्यंत धोकादायक"),
]


def sea_state(wave_m: float) -> str:
    for limit, label, _ in SEA_STATE_BANDS:
        if wave_m < limit:
            return label
    return "phenomenal"


# --------------------------------------------------------------------------
# Interpolation
# --------------------------------------------------------------------------
# Day-to-day drift so a 2-day forecast is a genuine forecast rather than the
# same day repeated. Day 1 settles, day 2 builds again — the pattern a fisher
# actually plans around.
DAY_MODIFIERS: Dict[int, Dict[str, float]] = {
    0: {"wave": 1.00, "wind": 1.00, "chl": 1.00, "rain": 1.00},
    1: {"wave": 0.78, "wind": 0.84, "chl": 1.10, "rain": 0.72},
    2: {"wave": 1.14, "wind": 1.10, "chl": 0.90, "rain": 1.18},
}


def day_offset(when: Optional[datetime]) -> int:
    """Whole days between `when` and today (IST), clamped to the forecast range."""
    if when is None:
        return 0
    return max(0, min(2, (when.date() - now_ist().date()).days))


def _interpolate(keyframes: Keyframes, hour: float) -> Dict[str, float]:
    hours = sorted(keyframes)
    lo = max([h for h in hours if h <= hour], default=hours[-1])
    hi = min([h for h in hours if h >= hour], default=hours[0])
    if lo == hi:
        return dict(keyframes[lo])
    span = (hi - lo) or 1
    t = (hour - lo) / span
    a, b = keyframes[lo], keyframes[hi]
    return {k: a[k] + (b[k] - a[k]) * t for k in a}


def scenario_for(location_name: str) -> str:
    return PORT_SCENARIO.get(location_name, "moderate")


def resolve_hour(when: Optional[datetime]) -> float:
    dt = when or now_ist()
    return dt.hour + dt.minute / 60.0


# --------------------------------------------------------------------------
# Public API used by the agents
# --------------------------------------------------------------------------
def conditions(location_name: str, when: Optional[datetime] = None) -> Dict:
    """Full synthetic condition set for a place/time."""
    key = scenario_for(location_name)
    sc = SCENARIOS[key]
    hour = resolve_hour(when)
    values = _interpolate(sc["keyframes"], hour)

    offset = day_offset(when)
    mod = DAY_MODIFIERS[offset]
    values["wave"] = round(values["wave"] * mod["wave"], 2)
    values["wind"] = round(values["wind"] * mod["wind"], 1)
    values["chl"] = round(values["chl"] * mod["chl"], 2)
    values["rain"] = min(100.0, round(values["rain"] * mod["rain"], 1))

    values["lightning"] = key in LIGHTNING_SCENARIOS and values["rain"] > 70
    values["sea_state"] = sea_state(values["wave"])
    values["scenario"] = key
    values["scenario_label"] = sc["label"]
    values["day_offset"] = offset
    values["disclaimer"] = DEMO_DISCLAIMER
    return values


def alerts(location_name: str, when: Optional[datetime] = None) -> List[Dict]:
    """Active official-style warnings for a place/time (demo copies)."""
    key = scenario_for(location_name)
    hour = resolve_hour(when)
    out: List[Dict] = []
    for raw in SCENARIOS[key]["alerts"]:
        start, end = raw["active_hours"]
        if start <= hour < end:
            item = {k: v for k, v in raw.items() if k != "active_hours"}
            item["valid_till"] = f"{end:02d}:00 IST"
            item["location"] = location_name
            item["mode"] = "DEMO"
            item["disclaimer"] = DEMO_DISCLAIMER
            out.append(item)
    return out


def next_improvement_hour(location_name: str, from_hour: float) -> Optional[int]:
    """First hour after `from_hour` where the scenario becomes materially safer.

    Powers the 'conditions improve after 11:00, ask me again then' advice.
    """
    key = scenario_for(location_name)
    sc = SCENARIOS[key]
    base = _interpolate(sc["keyframes"], from_hour)
    for h in range(int(from_hour) + 1, 24):
        nxt = _interpolate(sc["keyframes"], h)
        calmer = nxt["wave"] <= base["wave"] - 0.4 and nxt["wind"] <= base["wind"] - 5
        warning_gone = not any(
            a["active_hours"][0] <= h < a["active_hours"][1] for a in sc["alerts"]
        )
        if calmer and warning_gone:
            return h
    return None


# Candidate grounds around the offshore arc. Deterministic (no RNG) so the same
# place always returns the same grounds — a fisher must be able to come back to
# "zone 2" tomorrow and find the same patch of sea.
#
# NOTE on sst_delta: it is the ground's temperature difference from the
# surrounding water, i.e. the strength of the thermal front. A delta of 0.0
# means flat, featureless water and scores BADLY however rich it is — an
# earlier version gave the nearest ground the best chlorophyll but no front,
# so the model ranked the richest patch of sea last.
#
# The shelf here is modelled with the productive water closer in and thinning
# offshore, which is the usual picture along this coast.
_CANDIDATE_LAYOUT = [
    {"d_bearing": -20, "distance": 31.0, "sst_delta": 0.90, "chl_mult": 1.00},
    {"d_bearing": 45, "distance": 38.0, "sst_delta": 0.70, "chl_mult": 0.90},
    {"d_bearing": 25, "distance": 46.5, "sst_delta": -0.60, "chl_mult": 0.84},
    {"d_bearing": -42, "distance": 54.0, "sst_delta": 0.50, "chl_mult": 0.78},
    {"d_bearing": 5, "distance": 62.0, "sst_delta": 0.45, "chl_mult": 0.72},
    {"d_bearing": 62, "distance": 71.0, "sst_delta": -0.35, "chl_mult": 0.68},
    {"d_bearing": -8, "distance": 78.0, "sst_delta": 0.30, "chl_mult": 0.64},
    {"d_bearing": -58, "distance": 88.0, "sst_delta": -0.25, "chl_mult": 0.60},
    {"d_bearing": 33, "distance": 96.0, "sst_delta": 0.20, "chl_mult": 0.56},
]


def pfz_zones(lat: float, lon: float, location_name: str,
              when: Optional[datetime] = None, count: int = 3,
              radius_km: float = 100.0) -> List[Dict]:
    """Synthetic Potential Fishing Zone candidates within `radius_km`.

    Mirrors the INCOIS approach conceptually: zones sit on SST/chlorophyll
    fronts. Values here are SIMULATED — production ORCA parses the INCOIS PFZ
    advisory bulletin for the district.
    """
    cond = conditions(location_name, when)
    port = nearest_port(lat, lon)
    # The fan axis is wherever the most open water actually lies FROM THIS
    # POINT, not the nearest port's coast direction — a point inside the Gulf
    # of Khambhat is 'near Veraval', but its sea is down the gulf, not SSW
    # across the Saurashtra peninsula.
    offshore = seaward_bearing(lat, lon, prior=float(port.get("shore_bearing", 270)))

    zones: List[Dict] = []
    for i, spec in enumerate(_CANDIDATE_LAYOUT, start=1):
        if spec["distance"] > radius_km:
            continue
        # A fishing ground on land is nonsense (the on-screen equivalent of
        # recommending a wheat field), so a candidate that falls on land slides
        # along its distance arc toward the open-water axis until it is wet —
        # or is dropped. Distance is preserved, so ranking and trip maths
        # (which never use the bearing) are unaffected.
        placed = None
        off = spec["d_bearing"]
        step = 18 if off <= 0 else -18
        for attempt in range(8):
            trial = off + attempt * step
            cand = destination((lat, lon), (offshore + trial) % 360, spec["distance"])
            if not is_on_land(cand[0], cand[1]):
                placed = cand
                break
        if placed is None:
            continue
        plat, plon = placed
        actual_km = haversine_km((lat, lon), (plat, plon))
        if actual_km > radius_km:
            continue
        chl = round(cond["chl"] * spec["chl_mult"], 2)
        sst = round(cond["sst"] + spec["sst_delta"], 1)
        zones.append({
            "id": f"z{i}",
            "rank": i,
            "latitude": round(plat, 4),
            "longitude": round(plon, 4),
            "distance_km": round(actual_km, 1),
            "bearing": compass(bearing_deg((lat, lon), (plat, plon))),
            "sst_c": sst,
            "chlorophyll_mg_m3": chl,
            "wave_height_m": round(max(0.3, cond["wave"] - 0.25 - 0.03 * i), 2),
            "confidence": 0.0,   # filled in by services/fishing.py
            "rationale": "",
            "source": "DEMO",
            "disclaimer": DEMO_DISCLAIMER,
        })
    return zones
