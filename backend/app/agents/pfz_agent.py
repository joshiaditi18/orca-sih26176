"""Potential Fishing Zone agent.

WHAT PFZ MEANS (we say this on stage, because it is the single most likely
"gotcha" question): a PFZ is not a fish detector. INCOIS derives PFZ advisories
from sea-surface-temperature fronts and chlorophyll concentration — the physical
signature of nutrient upwelling where forage species, and therefore catch,
concentrate. ORCA reproduces that reasoning and ranks candidate zones. It never
claims to see fish.
"""
from __future__ import annotations

from datetime import datetime
from typing import List

from ..data import demo_store
from ..data.geo import RESTRICTED_ZONES, point_in_polygon
from ..schemas import AgentResult, Location, PFZZone
from .base import timed


def _score(zone: dict) -> float:
    """Rank by front strength (chlorophyll) discounted by distance and sea state."""
    chl = zone.get("chlorophyll_mg_m3") or 0.0
    distance = zone.get("distance_km") or 1.0
    wave = zone.get("wave_height_m") or 1.0
    return (chl * 1.6) - (distance / 45.0) - (wave * 0.25)


def _blocking_zone(lat: float, lon: float):
    """The restricted area containing this point, if any."""
    for zone in RESTRICTED_ZONES:
        if point_in_polygon((lat, lon), zone["polygon"]):
            return zone
    return None


@timed
def run(location: Location, when: datetime, count: int = 3) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    raw = demo_store.pfz_zones(location.latitude, location.longitude,
                               location.name, when, count=count)

    # SAFETY FILTER: never recommend a fishing zone that sits inside a marine
    # protected area, defence zone or port limit. A good catch prediction that
    # gets a fisher arrested or fined is not a good recommendation.
    kept, excluded = [], []
    for z in raw:
        blocker = _blocking_zone(z["latitude"], z["longitude"])
        if blocker:
            excluded.append({"latitude": z["latitude"], "longitude": z["longitude"],
                             "reason": blocker["name"], "zone_type": blocker["zone_type"]})
        else:
            kept.append(z)

    kept.sort(key=_score, reverse=True)
    kept = kept[:count]

    zones: List[PFZZone] = []
    for rank, z in enumerate(kept, start=1):
        z["rank"] = rank
        z["timestamp"] = stamp
        zones.append(PFZZone(**{k: v for k, v in z.items() if k in PFZZone.model_fields}))

    return AgentResult(
        agent="pfz",
        ok=True,
        location=location,
        data={"zones": [z.model_dump() for z in zones],
              "excluded_zones": excluded,
              "excluded_count": len(excluded),
              "method": "SST front + chlorophyll concentration ranking (INCOIS methodology)",
              "safety_filter": "Candidate zones inside restricted maritime areas are removed.",
              "caveat": "Potential zone — indicates likelihood of fish aggregation, not a guarantee."},
        source="DEMO",
        timestamp=stamp,
        confidence=zones[0].confidence if zones else 0.0,
        mode="DEMO",
    )
