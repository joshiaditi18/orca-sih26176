"""Route agent — safest track from the boat to a destination (usually PFZ #1)."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Tuple

from ..schemas import AgentResult, Location
from ..services.route_optimizer import plan_routes
from .base import timed


@timed
def run(location: Location, when: datetime, *, destination: Optional[Tuple[float, float]] = None,
        destination_name: str = "", ocean: Optional[Dict] = None,
        weather: Optional[Dict] = None, risk: Optional[Dict] = None) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    ocean = ocean or {}
    weather = weather or {}
    risk = risk or {}

    if destination is None:
        return AgentResult(agent="route", ok=False, location=location,
                           data={"reason": "no destination supplied"},
                           unavailable=["destination unknown"],
                           source="ORCA", timestamp=stamp, mode="DEMO")

    options = plan_routes(
        (location.latitude, location.longitude),
        destination,
        wave_m=ocean.get("wave_height_m"),
        wind_kmh=weather.get("wind_speed_kmh"),
        risk_score=int(risk.get("score", 40)),
        risk_category=str(risk.get("category", "MODERATE")),
    )

    recommended = next((o for o in options if o.recommended), options[0])

    return AgentResult(
        agent="route",
        ok=True,
        location=location,
        data={
            "destination": {"latitude": destination[0], "longitude": destination[1],
                            "name": destination_name},
            "options": [o.model_dump() for o in options],
            "recommended": recommended.model_dump(),
        },
        source="ORCA",
        timestamp=stamp,
        confidence=0.78,
        mode="DEMO",
    )
