"""Risk agent — fuses every specialist's evidence into one explained score."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from ..data import demo_store
from ..schemas import AgentResult, Location
from ..services import risk_engine
from .base import timed


@timed
def run(location: Location, when: datetime, *, weather: Optional[Dict], ocean: Optional[Dict],
        cyclone: Optional[Dict], gis: Optional[Dict], sources, mode: str) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    weather = weather or {}
    ocean = ocean or {}
    cyclone = cyclone or {}
    gis = gis or {}

    assessment = risk_engine.assess(
        wave_height_m=ocean.get("wave_height_m"),
        wave_period_s=ocean.get("wave_period_s"),
        wind_speed_kmh=weather.get("wind_speed_kmh"),
        rain_probability_pct=weather.get("rain_probability_pct"),
        lightning=bool(weather.get("lightning")),
        visibility_km=weather.get("visibility_km"),
        sea_state_label=ocean.get("sea_state"),
        current_speed_ms=ocean.get("current_speed_ms"),
        alerts=cyclone.get("alerts") or [],
        distance_from_shore_km=gis.get("distance_from_shore_km"),
        nearest_zone_km=gis.get("nearest_zone_km"),
        inside_zone=bool(gis.get("inside_restricted_zone")),
        sources=sources,
        mode=mode,
        generated_at=stamp,
    )

    # When will it get better? (drives "ask me again at 11")
    improve_hour = demo_store.next_improvement_hour(
        location.name, when.hour + when.minute / 60.0
    )
    if assessment.category in ("HIGH", "EXTREME") and improve_hour is not None:
        assessment.window = f"{improve_hour:02d}:00"

    return AgentResult(
        agent="risk",
        ok=True,
        location=location,
        data=assessment.model_dump(),
        risk=assessment.score / 100.0,
        source="ORCA",
        timestamp=stamp,
        confidence=0.8,
        mode=mode,  # type: ignore[arg-type]
    )
