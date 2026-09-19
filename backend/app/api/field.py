"""Vector-field endpoint — the sea in motion.

Returns a regular lat/lon grid over the requested bounding box with, per
point: wind (u, v in km/h), surface current (u, v in km/h) and sea-surface
temperature — plus a sea/land flag from the landmass layer so the client
never draws current across a wheat field.

LIVE mode: one multi-location Open-Meteo Marine call + one Forecast call for
the WHOLE grid (their APIs accept comma-separated coordinate lists), cached
for ten minutes per rounded bbox. DEMO mode (and any live failure): a smooth
synthetic field derived from the rehearsed conditions — clearly labelled, as
always.

Conventions: wind_direction is meteorological (direction the wind comes
FROM); ocean current direction is oceanographic (direction it flows TO).
Both are converted to u/v components here so the client just interpolates.
"""
from __future__ import annotations

import math
import threading
import time
from typing import Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, Query

from ..config import LIVE_TIMEOUT_SECONDS, get_data_mode
from ..data import demo_store
from ..data.demo_store import now_ist
from ..data.geo import is_on_land, nearest_port

router = APIRouter(prefix="/api", tags=["field"])

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

_CACHE_TTL = 600.0
_cache: Dict[Tuple, Tuple[float, dict]] = {}
_lock = threading.Lock()


def _uv_from(speed: float, direction_deg: float, blows_from: bool) -> Tuple[float, float]:
    """Convert speed+direction to eastward (u) / northward (v) components."""
    rad = math.radians(direction_deg)
    if blows_from:  # meteorological: direction the flow COMES FROM
        return (-speed * math.sin(rad), -speed * math.cos(rad))
    return (speed * math.sin(rad), speed * math.cos(rad))  # oceanographic: TO


def _grid(min_lat: float, max_lat: float, min_lon: float, max_lon: float,
          nx: int, ny: int) -> Tuple[List[float], List[float]]:
    lats = [min_lat + (max_lat - min_lat) * j / (ny - 1) for j in range(ny)]
    lons = [min_lon + (max_lon - min_lon) * i / (nx - 1) for i in range(nx)]
    return lats, lons


def _fetch_live(lats: List[float], lons: List[float]) -> Optional[List[dict]]:
    """One Marine + one Forecast call for every grid point at once."""
    pts = [(la, lo) for la in lats for lo in lons]
    lat_q = ",".join(f"{p[0]:.3f}" for p in pts)
    lon_q = ",".join(f"{p[1]:.3f}" for p in pts)
    try:
        with httpx.Client(timeout=LIVE_TIMEOUT_SECONDS + 2) as client:
            marine = client.get(MARINE_URL, params={
                "latitude": lat_q, "longitude": lon_q,
                "current": "sea_surface_temperature,ocean_current_velocity,ocean_current_direction",
                "timezone": "Asia/Kolkata",
            })
            forecast = client.get(FORECAST_URL, params={
                "latitude": lat_q, "longitude": lon_q,
                "current": "wind_speed_10m,wind_direction_10m",
                "wind_speed_unit": "kmh",
                "timezone": "Asia/Kolkata",
            })
        marine.raise_for_status()
        forecast.raise_for_status()
        m_list = marine.json()
        f_list = forecast.json()
        if isinstance(m_list, dict):
            m_list = [m_list]
        if isinstance(f_list, dict):
            f_list = [f_list]
        if len(f_list) != len(pts):
            return None

        out: List[dict] = []
        for i, (la, lo) in enumerate(pts):
            f_cur = (f_list[i] or {}).get("current") or {}
            m_cur = (m_list[i] or {}).get("current") if i < len(m_list) else None
            m_cur = m_cur or {}
            wind_u, wind_v = _uv_from(
                float(f_cur.get("wind_speed_10m") or 0.0),
                float(f_cur.get("wind_direction_10m") or 0.0),
                blows_from=True,
            )
            cur_speed = m_cur.get("ocean_current_velocity")
            cur_dir = m_cur.get("ocean_current_direction")
            if cur_speed is not None and cur_dir is not None:
                cur_u, cur_v = _uv_from(float(cur_speed), float(cur_dir), blows_from=False)
            else:
                cur_u = cur_v = None
            out.append({
                "sea": not is_on_land(la, lo),
                "wind_u": round(wind_u, 2), "wind_v": round(wind_v, 2),
                "cur_u": None if cur_u is None else round(cur_u, 3),
                "cur_v": None if cur_v is None else round(cur_v, 3),
                "sst": m_cur.get("sea_surface_temperature"),
            })
        return out
    except Exception:
        return None


def _synth_demo(lats: List[float], lons: List[float]) -> List[dict]:
    """A smooth, plausible field from the rehearsed sea state.

    Not random: seeded entirely by position and the demo conditions, so the
    picture is stable within a session and honest about being synthetic.
    """
    now = now_ist()
    out: List[dict] = []
    for la in lats:
        for lo in lons:
            port = nearest_port(la, lo)
            cond = demo_store.conditions(port["name"], now)
            base_dir = float(cond["wind_dir"])
            speed = float(cond["wind"]) * (0.75 + 0.25 * math.sin(la * 1.31 + lo * 0.73))
            direction = base_dir + 24 * math.sin(la * 0.9 - lo * 0.55)
            wind_u, wind_v = _uv_from(max(2.0, speed), direction % 360, blows_from=True)
            # surface current: slower, veered ~35° from the wind, coast-following
            cur_speed = max(0.2, float(cond["current"]) * 3.6) * (
                0.7 + 0.3 * math.cos(la * 1.7 + lo * 0.41)
            )
            cur_u, cur_v = _uv_from(cur_speed, (direction + 145) % 360, blows_from=False)
            sst = float(cond["sst"]) - 0.12 * (la - port["lat"]) + 0.35 * math.sin(lo * 0.5)
            out.append({
                "sea": not is_on_land(la, lo),
                "wind_u": round(wind_u, 2), "wind_v": round(wind_v, 2),
                "cur_u": round(cur_u, 3), "cur_v": round(cur_v, 3),
                "sst": round(sst, 1),
            })
    return out


def clear_cache() -> None:
    """Drop cached fields — called when the data mode is toggled."""
    with _lock:
        _cache.clear()


@router.get("/field")
def field(
    min_lat: float = Query(..., ge=-60, le=60),
    max_lat: float = Query(..., ge=-60, le=60),
    min_lon: float = Query(..., ge=20, le=140),
    max_lon: float = Query(..., ge=20, le=140),
    nx: int = Query(10, ge=4, le=16),
    ny: int = Query(8, ge=4, le=14),
) -> dict:
    """The flow field for a map view — one call, whole grid."""
    if max_lat - min_lat < 0.05 or max_lon - min_lon < 0.05:
        return {"mode": "DEMO", "nx": 0, "ny": 0, "lats": [], "lons": [], "points": []}

    mode = get_data_mode()
    key = (mode, round(min_lat, 1), round(max_lat, 1), round(min_lon, 1),
           round(max_lon, 1), nx, ny)
    now = time.monotonic()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            return hit[1]

    lats, lons = _grid(min_lat, max_lat, min_lon, max_lon, nx, ny)
    points = _fetch_live(lats, lons) if mode == "LIVE" else None
    served_mode = "LIVE" if points else "DEMO"
    if points is None:
        points = _synth_demo(lats, lons)

    # A separate FINE land/sea mask. The vector grid is coarse (a data
    # resolution limit); the coastline is not — the pure-Python landmass
    # test costs microseconds per point, so the client can clip particles
    # at the actual shore instead of at grid-cell edges.
    mask_nx, mask_ny = 44, 32
    m_lats, m_lons = _grid(min_lat, max_lat, min_lon, max_lon, mask_nx, mask_ny)
    mask = "".join(
        "0" if is_on_land(la, lo) else "1" for la in m_lats for lo in m_lons
    )

    result = {
        "mode": served_mode,
        "generated_at": now_ist().isoformat(timespec="seconds"),
        "nx": nx, "ny": ny,
        "lats": [round(v, 4) for v in lats],
        "lons": [round(v, 4) for v in lons],
        # row-major: index = j * nx + i  (j over lats, i over lons)
        "points": points,
        # fine sea mask, same bbox, row-major "1"=sea (j over mask_ny lats)
        "mask": mask,
        "mask_nx": mask_nx,
        "mask_ny": mask_ny,
        "note": ("Open-Meteo Marine + Forecast grid" if served_mode == "LIVE"
                 else "Synthetic flow field from rehearsed conditions — Demo / simulated data"),
    }
    with _lock:
        if len(_cache) > 64:
            _cache.clear()
        _cache[key] = (now + _CACHE_TTL, result)
    return result
