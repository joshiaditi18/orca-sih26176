"""Cyclone / marine-alert agent.

Highest-priority agent in the system. If it reports an official severe warning,
the risk engine's deterministic floor forces EXTREME regardless of what every
other agent — or the language model — thinks.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from ..data import demo_store
from ..schemas import AgentResult, Location
from .base import timed

SEVERITY_RANK = {"low": 0, "moderate": 1, "high": 2, "severe": 3}


@timed
def run(location: Location, when: datetime) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    alerts: List[Dict] = demo_store.alerts(location.name, when)
    alerts.sort(key=lambda a: SEVERITY_RANK.get(str(a.get("severity")).lower(), 0), reverse=True)

    worst = alerts[0] if alerts else None
    official = any(a.get("official") for a in alerts)

    return AgentResult(
        agent="cyclone",
        ok=True,
        location=location,
        data={
            "alerts": alerts,
            "count": len(alerts),
            "official_warning_active": official,
            "highest_severity": (worst or {}).get("severity"),
            "headline": (worst or {}).get("headline"),
        },
        source="DEMO",
        timestamp=stamp,
        confidence=0.95 if alerts else 0.8,
        mode="DEMO",
    )
