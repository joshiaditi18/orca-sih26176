"""Route planning + system/demo metadata endpoints."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..agents import ocean_agent, route_agent, weather_agent
from ..config import RISK, SOURCE_LABELS, get_data_mode, set_data_mode
from ..data import live_client
from ..data.demo_store import PORT_SCENARIO, SCENARIOS, now_ist
from ..data.geo import nearest_port
from ..schemas import Location

router = APIRouter(prefix="/api", tags=["routes"])


class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    dest_lat: float
    dest_lon: float
    dest_name: str = "destination"


@router.post("/routes")
def plan(req: RouteRequest) -> dict:
    port = nearest_port(req.start_lat, req.start_lon)
    loc = Location(name=port["name"], latitude=req.start_lat,
                   longitude=req.start_lon, state=port["state"])
    now = now_ist()
    weather = weather_agent.run(loc, now)
    ocean = ocean_agent.run(loc, now)
    result = route_agent.run(loc, now, destination=(req.dest_lat, req.dest_lon),
                             destination_name=req.dest_name,
                             ocean=ocean.data, weather=weather.data, risk={})
    return result.data


class ModeRequest(BaseModel):
    mode: str


@router.post("/config/mode")
def switch_mode(req: ModeRequest) -> dict:
    """Flip LIVE <-> DEMO at runtime (no restart) so the switch can be demoed."""
    try:
        mode = set_data_mode(req.mode)
    except ValueError as exc:
        return {"ok": False, "error": str(exc), "data_mode": get_data_mode()}
    # A fresh toggle should mean fresh data, not ten minutes of remembered series.
    live_client.clear_cache()
    from . import field as field_api
    field_api.clear_cache()
    return {
        "ok": True,
        "data_mode": mode,
        "note": ("Live public marine/weather providers; any failure falls back to "
                 "cached demo data, always relabelled."
                 if mode == "LIVE" else
                 "Cached demo data only — clearly labelled, never shown as an official feed."),
    }


@router.get("/config")
def config() -> dict:
    """What the system believes and why — shown in the UI's 'How it works' panel."""
    return {
        "data_mode": get_data_mode(),
        "risk_weights": RISK.weights,
        "risk_thresholds": RISK.thresholds,
        "deterministic_overrides": {
            "severe_warning_floor": RISK.severe_warning_floor,
            "fishermen_warning_floor": RISK.fishermen_warning_floor,
            "wave_danger_m": RISK.wave_danger_m,
            "wave_danger_floor": RISK.wave_danger_floor,
            "wind_danger_kmh": RISK.wind_danger_kmh,
            "wind_danger_floor": RISK.wind_danger_floor,
            "restricted_zone_floor": RISK.restricted_zone_floor,
        },
        "sources": SOURCE_LABELS,
        "note": ("Weights are an engineering baseline, not a certified maritime standard. "
                 "Deterministic overrides can only raise a score, never lower it — an "
                 "official warning always wins."),
    }


@router.get("/scenarios")
def scenarios() -> dict:
    """The five rehearsed demo scenarios (Round-2 safety net)."""
    catalogue = [
        {"id": "safe", "title": "Scenario 1 — Safe conditions", "location": "Panaji (Goa)",
         "ask": "Is it safe to go fishing tomorrow morning near Goa?",
         "expect": "LOW risk, green verdict"},
        {"id": "dangerous", "title": "Scenario 2 — Dangerous weather", "location": "Mumbai",
         "ask": "मी उद्या सकाळी ६ वाजता मासेमारीला जाऊ शकतो का?",
         "expect": "HIGH risk with IMD fishermen warning, improves after 11:00"},
        {"id": "cyclone", "title": "Scenario 3 — Cyclone", "location": "Paradip",
         "ask": "Is there a cyclone near Paradip?",
         "expect": "EXTREME — official severe warning overrides the model"},
        {"id": "pfz", "title": "Scenario 4 — Fishing zones", "location": "Kochi",
         "ask": "Show me the nearest potential fishing zones near Kochi",
         "expect": "3 ranked PFZ with SST / chlorophyll / confidence"},
        {"id": "route", "title": "Scenario 5 — Safe route & geofence", "location": "Mumbai",
         "ask": "Give me the safest route to the nearest fishing zone",
         "expect": "Safest track avoiding the naval area; direct track flagged"},
    ]
    return {
        "scenarios": catalogue,
        "location_scenarios": PORT_SCENARIO,
        "scenario_labels": {k: v["label"] for k, v in SCENARIOS.items()},
    }
