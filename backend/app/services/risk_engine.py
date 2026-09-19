"""The safety core.

Three layers, in this order — and the order is the whole point:

  1. NORMALISE   each hazard to a 0..1 factor via documented breakpoint curves
  2. COMBINE     weighted sum -> 0..100 score  (the "ML/statistical" layer;
                 swap in the trained XGBoost regressor without touching callers)
  3. OVERRIDE    deterministic safety floors that an official warning or a
                 life-threatening sea state imposes on the result

Layer 3 can only ever RAISE a score. No model output, and no LLM, can talk the
system down from an official IMD/INCOIS warning. That property is what makes
this defensible as a safety product rather than a chatbot with a number.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

from ..config import RISK
from ..schemas import RiskAssessment, RiskFactor

Breakpoints = Sequence[Tuple[float, float]]


def _curve(value: Optional[float], points: Breakpoints, default: float = 0.3) -> float:
    """Piecewise-linear normalisation to 0..1."""
    if value is None:
        return default
    lo_x, lo_y = points[0]
    if value <= lo_x:
        return lo_y
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if value <= x1:
            span = (x1 - x0) or 1e-9
            return y0 + (y1 - y0) * (value - x0) / span
    return points[-1][1]


# --- documented hazard curves ---------------------------------------------
# Calibrated for SMALL MOTORISED FISHING CRAFT (the ORCA user), which is why
# they are far more conservative than curves for a merchant vessel.
WAVE_CURVE: Breakpoints = [(0.0, 0.0), (0.5, 0.10), (1.0, 0.25), (1.5, 0.45),
                           (2.0, 0.68), (2.5, 0.87), (3.0, 0.95), (4.0, 1.0)]
WIND_CURVE: Breakpoints = [(0.0, 0.0), (10.0, 0.10), (20.0, 0.35), (30.0, 0.62),
                           (35.0, 0.77), (45.0, 0.90), (62.0, 1.0)]
CURRENT_CURVE: Breakpoints = [(0.0, 0.0), (0.5, 0.20), (1.0, 0.55), (1.5, 0.80), (2.5, 1.0)]
VISIBILITY_CURVE: Breakpoints = [(0.0, 1.0), (1.0, 0.85), (3.0, 0.60), (6.0, 0.35),
                                 (10.0, 0.15), (15.0, 0.05)]
OFFSHORE_CURVE: Breakpoints = [(0.0, 0.05), (10.0, 0.20), (25.0, 0.38), (40.0, 0.55),
                               (60.0, 0.72), (100.0, 0.90)]

ALERT_FACTOR = {
    "severe": 1.00,     # cyclone / tsunami
    "high": 0.88,
    "moderate": 0.84,   # standard "do not venture" fishermen warning
    "low": 0.45,
}

SEA_STATE_BONUS = {"calm": 0.0, "slight": 0.05, "moderate": 0.15,
                   "rough": 0.30, "very rough": 0.45, "phenomenal": 0.55}


def _wave_factor(wave_m: Optional[float]) -> float:
    return _curve(wave_m, WAVE_CURVE)


def _wind_factor(wind_kmh: Optional[float]) -> float:
    return _curve(wind_kmh, WIND_CURVE)


def _weather_factor(rain_pct: Optional[float], lightning: bool,
                    visibility_km: Optional[float]) -> float:
    rain = (rain_pct or 0) / 100.0
    f = 0.8 * rain + 0.25 * _curve(visibility_km, VISIBILITY_CURVE)
    if lightning:
        f = max(f, 0.9)
    return min(1.0, f)


def _ocean_factor(sea_state_label: Optional[str], current_ms: Optional[float]) -> float:
    base = SEA_STATE_BONUS.get((sea_state_label or "moderate").lower(), 0.25)
    return min(1.0, base + 0.55 * _curve(current_ms, CURRENT_CURVE))


def _alert_factor(alerts: Sequence[Dict]) -> Tuple[float, bool, Optional[Dict]]:
    """Highest-severity active alert drives the factor."""
    if not alerts:
        return 0.05, False, None
    worst, best_f = None, 0.0
    for a in alerts:
        f = ALERT_FACTOR.get(str(a.get("severity", "moderate")).lower(), 0.6)
        if f > best_f:
            best_f, worst = f, a
    official = bool(worst and worst.get("official"))
    return best_f, official, worst


def _gis_factor(distance_from_shore_km: Optional[float],
                nearest_zone_km: Optional[float],
                inside_zone: bool) -> float:
    f = _curve(distance_from_shore_km, OFFSHORE_CURVE)
    if inside_zone:
        return 1.0
    if nearest_zone_km is not None and nearest_zone_km < 10:
        f = max(f, 0.55 + 0.04 * (10 - nearest_zone_km))
    return min(1.0, f)


def assess(
    *,
    wave_height_m: Optional[float],
    wave_period_s: Optional[float],
    wind_speed_kmh: Optional[float],
    rain_probability_pct: Optional[float],
    lightning: bool,
    visibility_km: Optional[float],
    sea_state_label: Optional[str],
    current_speed_ms: Optional[float],
    alerts: Sequence[Dict],
    distance_from_shore_km: Optional[float],
    nearest_zone_km: Optional[float],
    inside_zone: bool,
    sources: Sequence[str],
    mode: str = "DEMO",
    generated_at: str = "",
) -> RiskAssessment:
    """Produce a fully explained 0-100 risk assessment."""

    alert_f, official_warning, worst_alert = _alert_factor(alerts)

    factors_raw = {
        "wave": (_wave_factor(wave_height_m),
                 f"Wave height {wave_height_m:.1f} m" if wave_height_m is not None
                 else "Wave height unavailable"),
        "cyclone": (alert_f,
                    worst_alert["headline"] if worst_alert else "No active marine warning"),
        "wind": (_wind_factor(wind_speed_kmh),
                 f"Wind {wind_speed_kmh:.0f} km/h" if wind_speed_kmh is not None
                 else "Wind unavailable"),
        "weather": (_weather_factor(rain_probability_pct, lightning, visibility_km),
                    f"Rain probability {rain_probability_pct:.0f}%"
                    + (", lightning likely" if lightning else "")
                    + (f", visibility {visibility_km:.0f} km" if visibility_km is not None else "")
                    if rain_probability_pct is not None else "Weather detail unavailable"),
        "ocean": (_ocean_factor(sea_state_label, current_speed_ms),
                  f"Sea state {sea_state_label or 'unknown'}"
                  + (f", current {current_speed_ms:.1f} m/s" if current_speed_ms is not None else "")),
        "gis": (_gis_factor(distance_from_shore_km, nearest_zone_km, inside_zone),
                ("Inside a restricted zone" if inside_zone else
                 (f"{distance_from_shore_km:.0f} km offshore" if distance_from_shore_km is not None
                  else "Position unavailable")
                 + (f", restricted zone {nearest_zone_km:.1f} km away"
                    if nearest_zone_km is not None and nearest_zone_km < 15 else ""))),
    }

    labels = {"wave": "Wave height", "cyclone": "Official warnings", "wind": "Wind",
              "weather": "Rain / visibility", "ocean": "Sea state & current",
              "gis": "Position & zones"}

    factors: List[RiskFactor] = []
    score = 0.0
    for key, weight in RISK.weights.items():
        f, detail = factors_raw[key]
        contribution = 100.0 * weight * f
        score += contribution
        factors.append(RiskFactor(key=key, label=labels[key], factor=round(f, 3),
                                  weight=weight, contribution=round(contribution, 1),
                                  detail=detail))

    # ---- layer 3: deterministic safety floors ----------------------------
    overrides: List[str] = []

    def floor(value: int, reason: str):
        nonlocal score
        if score < value:
            score = float(value)
            overrides.append(reason)

    if worst_alert and str(worst_alert.get("severity")).lower() == "severe" and official_warning:
        floor(RISK.severe_warning_floor,
              f"Official severe warning in force ({worst_alert.get('source', 'IMD')}) — "
              "overrides model output")
    if worst_alert and worst_alert.get("type") == "fishermen_warning" and official_warning:
        floor(RISK.fishermen_warning_floor,
              f"{worst_alert.get('source', 'IMD')} fishermen warning active — "
              "advisory overrides model output")
    if wave_height_m is not None and wave_height_m >= RISK.wave_danger_m:
        floor(RISK.wave_danger_floor, f"Wave height {wave_height_m:.1f} m exceeds the "
                                      f"{RISK.wave_danger_m} m small-craft danger threshold")
    if wind_speed_kmh is not None and wind_speed_kmh >= RISK.wind_danger_kmh:
        floor(RISK.wind_danger_floor, f"Wind {wind_speed_kmh:.0f} km/h at or above gale force")
    if inside_zone:
        floor(RISK.restricted_zone_floor, "Position falls inside a restricted maritime zone")

    score = max(0.0, min(100.0, score))
    category = RISK.categorise(score)
    factors.sort(key=lambda f: f.contribution, reverse=True)

    return RiskAssessment(
        score=round(score),
        category=category,
        factors=factors,
        overrides=overrides,
        official_warning=official_warning,
        go=category in ("LOW", "MODERATE") and not official_warning,
        sources=list(dict.fromkeys(sources)),
        generated_at=generated_at,
        mode=mode,  # type: ignore[arg-type]
    )
