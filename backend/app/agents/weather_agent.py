"""Weather agent — wind, rain, lightning, visibility."""
from __future__ import annotations

from datetime import datetime

from ..data import demo_store, live_client
from ..data.geo import compass
from ..schemas import AgentResult, Location
from .base import live_enabled, measurement, timed


@timed
def run(location: Location, when: datetime) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    mode, source = "DEMO", "DEMO"
    unavailable = []

    live = live_client.fetch_weather(location.latitude, location.longitude, when) if live_enabled() else None

    if live and live.get("wind_speed_kmh") is not None:
        mode, source = "LIVE", "OPEN_METEO"
        wind = live["wind_speed_kmh"]
        wind_dir = live.get("wind_direction_deg") or 0
        rain = live.get("rain_probability_pct")
        visibility = live.get("visibility_km")
        temperature = live.get("temperature_c")
        # Open-Meteo has no lightning field; infer conservatively.
        lightning = bool(rain is not None and rain >= 80 and wind and wind >= 30)
        stamp = live.get("valid_time", stamp)
    else:
        if live_enabled():
            unavailable.append("live weather provider unreachable — using cached demo data")
        cond = demo_store.conditions(location.name, when)
        wind = cond["wind"]
        wind_dir = cond["wind_dir"]
        rain = cond["rain"]
        visibility = cond["visibility"]
        temperature = None
        lightning = bool(cond["lightning"])

    return AgentResult(
        agent="weather",
        ok=True,
        location=location,
        data={
            "wind_speed_kmh": round(float(wind), 1),
            "wind_direction_deg": round(float(wind_dir)),
            "wind_direction": compass(float(wind_dir)),
            "rain_probability_pct": None if rain is None else round(float(rain)),
            "visibility_km": None if visibility is None else round(float(visibility), 1),
            "temperature_c": None if temperature is None else round(float(temperature), 1),
            "lightning": lightning,
        },
        measurements={
            "wind_speed": measurement(round(float(wind), 1), "km/h", "Wind speed", source, stamp, mode),
            "rain_probability": measurement(None if rain is None else round(float(rain)),
                                            "%", "Rain probability", source, stamp, mode),
            "visibility": measurement(None if visibility is None else round(float(visibility), 1),
                                      "km", "Visibility", source, stamp, mode),
        },
        unavailable=unavailable,
        source=source,
        timestamp=stamp,
        confidence=0.85 if mode == "LIVE" else 0.75,
        mode=mode,  # type: ignore[arg-type]
    )
