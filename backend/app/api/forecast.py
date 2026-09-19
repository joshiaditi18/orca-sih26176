"""Raw weather / ocean / risk lookups (no conversation involved)."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Query

from ..agents import (cyclone_agent, gis_agent, ocean_agent, pfz_agent,
                      risk_agent, weather_agent)
from ..data.demo_store import IST, now_ist
from ..data.geo import is_on_land, nearest_port
from ..schemas import Location

router = APIRouter(prefix="/api", tags=["forecast"])


def _resolve(lat: float, lon: float, when: Optional[str]) -> tuple[Location, datetime]:
    port = nearest_port(lat, lon)
    loc = Location(name=port["name"], latitude=lat, longitude=lon, state=port["state"])
    if when:
        try:
            dt = datetime.fromisoformat(when)
            dt = dt.replace(tzinfo=IST) if dt.tzinfo is None else dt.astimezone(IST)
            return loc, dt
        except ValueError:
            pass
    return loc, now_ist()


@router.get("/forecast")
def forecast(lat: float = Query(...), lon: float = Query(...),
             when: Optional[str] = Query(None, description="ISO datetime, IST assumed")) -> dict:
    loc, dt = _resolve(lat, lon, when)
    weather = weather_agent.run(loc, dt)
    ocean = ocean_agent.run(loc, dt)
    return {
        "location": loc.model_dump(),
        "valid_for": dt.isoformat(timespec="seconds"),
        "weather": weather.model_dump(),
        "ocean": ocean.model_dump(),
    }


@router.get("/risk")
def risk(lat: float = Query(...), lon: float = Query(...),
         when: Optional[str] = Query(None)) -> dict:
    loc, dt = _resolve(lat, lon, when)
    weather = weather_agent.run(loc, dt)
    ocean = ocean_agent.run(loc, dt)
    cyclone = cyclone_agent.run(loc, dt)
    gis = gis_agent.run(loc, dt)
    assessment = risk_agent.run(
        loc, dt, weather=weather.data, ocean=ocean.data, cyclone=cyclone.data,
        gis=gis.data, sources=[weather.source, ocean.source, cyclone.source, gis.source],
        mode=weather.mode,
    )
    return {
        "location": loc.model_dump(),
        "valid_for": dt.isoformat(timespec="seconds"),
        "risk": assessment.data,
        "inputs": {"weather": weather.data, "ocean": ocean.data,
                   "alerts": cyclone.data, "gis": gis.data},
    }


@router.get("/position")
def position(lat: float = Query(...), lon: float = Query(...)) -> dict:
    """Fast position check — drives the draggable boat on the map.

    Deliberately light (GIS + alerts only, no full risk fusion) so it can be
    called continuously while a vessel marker is being dragged.
    """
    loc, dt = _resolve(lat, lon, None)
    gis = gis_agent.run(loc, dt)
    cyc = cyclone_agent.run(loc, dt)
    data = gis.data
    zones = data.get("zones_nearby", [])
    nearest = zones[0] if zones else None

    if is_on_land(lat, lon):
        status, headline = "warning", "That position is on land — drop the boat on the water"
    elif data.get("inside_restricted_zone"):
        status, headline = "critical", f"Inside {data.get('nearest_zone_name')}"
    elif nearest and nearest["distance_km"] <= 2.5:
        status, headline = "critical", f"{nearest['name']} is {nearest['distance_km']} km away"
    elif nearest and nearest["distance_km"] <= 5.0:
        status, headline = "warning", f"Approaching {nearest['name']}"
    else:
        status, headline = "clear", "No restricted area nearby"

    return {
        "latitude": lat,
        "longitude": lon,
        "status": status,
        "headline": headline,
        "distance_from_shore_km": data.get("distance_from_shore_km"),
        "nearest_landing_centre": data.get("nearest_landing_centre"),
        "nearest_zone_km": data.get("nearest_zone_km"),
        "nearest_zone_name": data.get("nearest_zone_name"),
        "inside_restricted_zone": data.get("inside_restricted_zone"),
        "geofence_alerts": data.get("geofence_alerts", []),
        "official_warning_active": cyc.data.get("official_warning_active"),
        "checked_at": dt.isoformat(timespec="seconds"),
    }


@router.get("/risk/timeline")
def risk_timeline(lat: float = Query(...), lon: float = Query(...),
                  hours: int = Query(24, ge=1, le=48)) -> dict:
    """Hour-by-hour risk — powers the 'when does it get safe?' chart."""
    loc, start = _resolve(lat, lon, None)
    start = start.replace(minute=0, second=0, microsecond=0)
    points = []
    for h in range(hours):
        dt = start + timedelta(hours=h)
        weather = weather_agent.run(loc, dt)
        ocean = ocean_agent.run(loc, dt)
        cyclone = cyclone_agent.run(loc, dt)
        gis = gis_agent.run(loc, dt)
        assessment = risk_agent.run(
            loc, dt, weather=weather.data, ocean=ocean.data, cyclone=cyclone.data,
            gis=gis.data, sources=[], mode=weather.mode,
        )
        points.append({
            "time": dt.isoformat(timespec="minutes"),
            "hour": dt.hour,
            "score": assessment.data.get("score"),
            "category": assessment.data.get("category"),
            "wave_height_m": ocean.data.get("wave_height_m"),
            "wind_speed_kmh": weather.data.get("wind_speed_kmh"),
            "warning": bool(cyclone.data.get("official_warning_active")),
        })
    return {"location": loc.model_dump(), "points": points}
