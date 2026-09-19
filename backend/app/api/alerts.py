"""Marine alerts + the authority-side rollup."""
from __future__ import annotations

from fastapi import APIRouter, Query

from ..agents import cyclone_agent, gis_agent, ocean_agent, risk_agent, weather_agent
from ..data.demo_store import now_ist
from ..data.geo import PORTS, nearest_port
from ..schemas import Location

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts")
def alerts(lat: float = Query(...), lon: float = Query(...)) -> dict:
    port = nearest_port(lat, lon)
    loc = Location(name=port["name"], latitude=lat, longitude=lon, state=port["state"])
    now = now_ist()
    cyc = cyclone_agent.run(loc, now)
    gis = gis_agent.run(loc, now)
    return {
        "location": loc.model_dump(),
        "marine_alerts": cyc.data.get("alerts", []),
        "geofence_alerts": gis.data.get("geofence_alerts", []),
        "generated_at": now.isoformat(timespec="seconds"),
    }


@router.get("/authority/dashboard")
def authority_dashboard() -> dict:
    """Every monitored landing centre, scored — the authority view.

    Shows ORCA serving district administrations, not just individual fishers.
    """
    now = now_ist()
    rows = []
    for port in PORTS:
        loc = Location(name=port["name"], latitude=port["lat"],
                       longitude=port["lon"], state=port["state"])
        weather = weather_agent.run(loc, now)
        ocean = ocean_agent.run(loc, now)
        cyclone = cyclone_agent.run(loc, now)
        gis = gis_agent.run(loc, now)
        assessment = risk_agent.run(
            loc, now, weather=weather.data, ocean=ocean.data, cyclone=cyclone.data,
            gis=gis.data, sources=[], mode=weather.mode,
        )
        data = assessment.data
        rows.append({
            "name": port["name"],
            "state": port["state"],
            "latitude": port["lat"],
            "longitude": port["lon"],
            "risk_score": data.get("score"),
            "risk_category": data.get("category"),
            "official_warning": data.get("official_warning"),
            "wave_height_m": ocean.data.get("wave_height_m"),
            "wind_speed_kmh": weather.data.get("wind_speed_kmh"),
            "headline": cyclone.data.get("headline"),
        })

    rows.sort(key=lambda r: r["risk_score"] or 0, reverse=True)
    summary = {
        "monitored": len(rows),
        "extreme": sum(1 for r in rows if r["risk_category"] == "EXTREME"),
        "high": sum(1 for r in rows if r["risk_category"] == "HIGH"),
        "moderate": sum(1 for r in rows if r["risk_category"] == "MODERATE"),
        "low": sum(1 for r in rows if r["risk_category"] == "LOW"),
        "official_warnings": sum(1 for r in rows if r["official_warning"]),
    }
    return {"generated_at": now.isoformat(timespec="seconds"),
            "summary": summary, "locations": rows}
