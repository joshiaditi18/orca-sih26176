"""Planner / Orchestrator — the central agent.

It owns the graph, not the marine maths: it decides WHICH specialists a question
needs, runs the independent ones concurrently, waits for the dependent ones, and
assembles the state that the Risk and Explanation agents consume.

    intent -> {weather, ocean, pfz, cyclone, gis}  (parallel)
           -> risk        (needs all four data agents)
           -> route       (needs pfz + risk)
           -> explanation (needs everything)

This is a hand-written state machine with the same execution semantics as a
LangGraph graph. It is written out explicitly so the whole orchestration is
readable in one screen during a code walkthrough, and so the demo has zero
heavyweight dependencies. `ORCA_USE_LANGGRAPH=1` is the documented upgrade path;
the node functions below are already shaped as LangGraph nodes (state in,
state out).
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from ..config import get_data_mode
from ..data.demo_store import IST, now_ist
from ..schemas import (AgentTrace, ChatRequest, ChatResponse, Evidence,
                       GeofenceAlert, Intent, Location, PFZZone, RiskAssessment,
                       RouteOption)
from ..services.i18n import t
from . import (cyclone_agent, explanation_agent, gis_agent, intent_agent,
               ocean_agent, pfz_agent, risk_agent, route_agent, weather_agent)

# session_id -> last intent (gives follow-ups their context)
_SESSIONS: Dict[str, Intent] = {}

AGENT_SUMMARY = {
    "weather": lambda d: f"wind {d.get('wind_speed_kmh')} km/h, rain {d.get('rain_probability_pct')}%",
    "ocean": lambda d: f"wave {d.get('wave_height_m')} m, {d.get('sea_state')}",
    "pfz": lambda d: f"{len(d.get('zones', []))} zones ranked",
    "cyclone": lambda d: (d.get("headline") or "no active warning"),
    "gis": lambda d: f"{d.get('distance_from_shore_km')} km offshore, "
                     f"{len(d.get('zones_nearby', []))} zones nearby",
    "risk": lambda d: f"{d.get('score')}/100 {d.get('category')}",
    "route": lambda d: (f"{d.get('recommended', {}).get('distance_km')} km recommended"
                        if d.get("recommended") else "no route"),
    "explanation": lambda d: "answer composed",
    "intent": lambda d: f"{d.get('intent')} @ {d.get('location_text') or 'unknown'} {d.get('time')}",
}


def _target_datetime(intent: Intent) -> datetime:
    """Combine the parsed date + time into an IST timestamp."""
    base = now_ist()
    try:
        y, m, d = (int(x) for x in (intent.date or base.date().isoformat()).split("-"))
        hh, mm = (int(x) for x in (intent.time or "06:00").split(":"))
        return datetime(y, m, d, hh, mm, tzinfo=IST)
    except Exception:
        return base


def _trace(result, name: str) -> AgentTrace:
    status = "ok" if result.ok else "failed"
    if result.ok and result.unavailable:
        status = "degraded"
    try:
        summary = AGENT_SUMMARY.get(name, lambda d: "")(result.data or {})
    except Exception:
        summary = ""
    return AgentTrace(agent=name, status=status,  # type: ignore[arg-type]
                      latency_ms=result.latency_ms or 0, summary=summary or "",
                      source=result.source, mode=result.mode)


def handle(req: ChatRequest) -> ChatResponse:
    """Run the full ORCA graph for one user message."""
    started = time.perf_counter()

    # ---- node 1: intent --------------------------------------------------
    previous = _SESSIONS.get(req.session_id)
    intent_res = intent_agent.run(
        req.message, language=req.language, latitude=req.latitude,
        longitude=req.longitude, location_name=req.location_name, previous=previous,
    )
    intent = Intent(**intent_res.data)
    if intent.location is None:
        from ..data.geo import DEFAULT_PORT
        intent.location = Location(name=DEFAULT_PORT["name"], latitude=DEFAULT_PORT["lat"],
                                   longitude=DEFAULT_PORT["lon"], state=DEFAULT_PORT["state"])
        intent.location_text = DEFAULT_PORT["name"]
    _SESSIONS[req.session_id] = intent

    location = intent.location
    when = _target_datetime(intent)
    needs = set(intent.needs)

    trace: List[AgentTrace] = [_trace(intent_res, "intent")]
    agents: Dict[str, object] = {}

    # ---- node 2: specialists, concurrently -------------------------------
    jobs = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        if "weather" in needs:
            jobs["weather"] = pool.submit(weather_agent.run, location, when)
        if "ocean" in needs:
            jobs["ocean"] = pool.submit(ocean_agent.run, location, when)
        if "pfz" in needs:
            jobs["pfz"] = pool.submit(pfz_agent.run, location, when)
        if "cyclone" in needs:
            jobs["cyclone"] = pool.submit(cyclone_agent.run, location, when)
        if "gis" in needs:
            jobs["gis"] = pool.submit(gis_agent.run, location, when)
        results = {name: fut.result() for name, fut in jobs.items()}

    for name, res in results.items():
        agents[name] = res
        trace.append(_trace(res, name))

    weather_d = results["weather"].data if "weather" in results else {}
    ocean_d = results["ocean"].data if "ocean" in results else {}
    cyclone_d = results["cyclone"].data if "cyclone" in results else {}
    gis_d = results["gis"].data if "gis" in results else {}

    sources = [r.source for r in results.values() if r.ok]
    mode = "LIVE" if any(r.mode == "LIVE" for r in results.values()) else get_data_mode()
    if mode not in ("LIVE", "DEMO", "CACHE"):
        mode = "DEMO"

    # ---- node 3: risk ----------------------------------------------------
    risk: Optional[RiskAssessment] = None
    if "risk" in needs:
        risk_res = risk_agent.run(location, when, weather=weather_d, ocean=ocean_d,
                                  cyclone=cyclone_d, gis=gis_d, sources=sources, mode=mode)
        agents["risk"] = risk_res
        trace.append(_trace(risk_res, "risk"))
        if risk_res.ok:
            risk = RiskAssessment(**risk_res.data)

    # ---- node 4: pfz list / route ---------------------------------------
    pfz_zones: List[PFZZone] = []
    if "pfz" in results and results["pfz"].ok:
        pfz_zones = [PFZZone(**z) for z in results["pfz"].data.get("zones", [])]

    routes: List[RouteOption] = []
    if "route" in needs and pfz_zones:
        target = pfz_zones[0]
        route_res = route_agent.run(location, when,
                                    destination=(target.latitude, target.longitude),
                                    destination_name=f"PFZ #{target.rank}",
                                    ocean=ocean_d, weather=weather_d,
                                    risk=(risk.model_dump() if risk else {}))
        agents["route"] = route_res
        trace.append(_trace(route_res, "route"))
        if route_res.ok:
            routes = [RouteOption(**o) for o in route_res.data.get("options", [])]

    geofence = [GeofenceAlert(**a) for a in gis_d.get("geofence_alerts", [])]

    # ---- node 5: explanation --------------------------------------------
    expl_res = explanation_agent.run(
        intent=intent, risk=risk, pfz=pfz_zones, routes=routes, geofence=geofence,
        weather=weather_d, ocean=ocean_d, cyclone=cyclone_d, gis=gis_d,
        agents=agents, mode=mode, when=when,  # type: ignore[arg-type]
    )
    trace.append(_trace(expl_res, "explanation"))

    evidence = [Evidence(**e) for e in expl_res.data.get("evidence", [])]

    return ChatResponse(
        session_id=req.session_id,
        language=intent.language,
        answer=expl_res.data.get("answer", ""),
        intent=intent,
        risk=risk,
        pfz=pfz_zones,
        routes=routes,
        geofence=geofence,
        alerts=cyclone_d.get("alerts", []),
        evidence=evidence,
        trace=trace,
        suggestions=expl_res.data.get("suggestions", []),
        mode=mode,  # type: ignore[arg-type]
        disclaimer=expl_res.data.get("disclaimer", ""),
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )


def reset_session(session_id: str) -> None:
    _SESSIONS.pop(session_id, None)
