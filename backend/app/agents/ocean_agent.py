"""Ocean agent — wave height/period, sea state, SST, surface current."""
from __future__ import annotations

from datetime import datetime

from ..data import demo_store, live_client
from ..schemas import AgentResult, Location
from .base import live_enabled, measurement, timed


@timed
def run(location: Location, when: datetime) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    mode, source = "DEMO", "DEMO"
    unavailable = []

    live = live_client.fetch_marine(location.latitude, location.longitude, when) if live_enabled() else None
    cond = demo_store.conditions(location.name, when)

    if live and live.get("wave_height_m") is not None:
        mode, source = "LIVE", "OPEN_METEO"
        wave = live["wave_height_m"]
        period = live.get("wave_period_s")
        sst = live.get("sst_c")
        stamp = live.get("valid_time", stamp)
        # Open-Meteo Marine does not expose surface currents; fall back and say so.
        current = cond["current"]
        unavailable.append("surface current not available from the live provider — demo value shown")
    else:
        if live_enabled():
            unavailable.append("live marine provider unreachable — using cached demo data")
        wave = cond["wave"]
        period = cond["period"]
        sst = cond["sst"]
        current = cond["current"]

    state = demo_store.sea_state(float(wave))

    return AgentResult(
        agent="ocean",
        ok=True,
        location=location,
        data={
            "wave_height_m": round(float(wave), 2),
            "wave_period_s": None if period is None else round(float(period), 1),
            "sea_state": state,
            "sst_c": None if sst is None else round(float(sst), 1),
            "current_speed_ms": round(float(current), 2),
            "chlorophyll_mg_m3": round(float(cond["chl"]), 2),
        },
        measurements={
            "wave_height": measurement(round(float(wave), 2), "m", "Wave height", source, stamp, mode),
            "wave_period": measurement(None if period is None else round(float(period), 1),
                                       "s", "Wave period", source, stamp, mode),
            "sst": measurement(None if sst is None else round(float(sst), 1),
                               "deg C", "Sea surface temperature", source, stamp, mode),
        },
        unavailable=unavailable,
        source=source,
        timestamp=stamp,
        confidence=0.88 if mode == "LIVE" else 0.75,
        mode=mode,  # type: ignore[arg-type]
    )
