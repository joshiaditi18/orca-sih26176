"""LIVE data clients.

VERIFIED 24 Aug 2026 against the real endpoints (HTTP 200, field names and
units below are copied from actual responses):

  * https://marine-api.open-meteo.com/v1/marine
        hourly = wave_height (m), wave_period (s), sea_surface_temperature (degC)
  * https://api.open-meteo.com/v1/forecast
        hourly = temperature_2m (degC), wind_speed_10m (km/h),
                 wind_direction_10m (deg), precipitation_probability (%),
                 visibility (m)

Both are public and keyless.

CACHING — the reason live mode is usable at all:
one response already carries 3 days of HOURLY data for a point, but the
callers ask hour by hour (risk timeline = 24 hours, safe-window scan = 14,
authority board = 10 ports, refreshed every 30 s). Without a cache that is
hundreds of sequential HTTPS round-trips per screen — the timeline alone took
32 s and the burst got this IP throttled by the provider, which then made
agents silently fall back to demo data. So we fetch the full hourly series
once per (provider, ~km-rounded position), remember it for CACHE_TTL, and
answer every hour of every later call from memory. Failures are remembered
briefly too, so live mode with no internet degrades in seconds, not minutes
(24 x 2 x 4 s of timeouts).

ON INCOIS / IMD / MOSDAC — the honest position we state in Q&A:
these agencies publish advisories through portals and bulletins, not through an
open, documented public JSON API that a hackathon team can key into. ORCA is
therefore built with a provider interface: Open-Meteo Marine is the open live
provider today, and INCOIS/IMD/MOSDAC slot in behind the same interface via a
data-sharing arrangement or bulletin parser without touching agent code.
We never label Open-Meteo output as INCOIS or IMD data.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime
from typing import Dict, Optional, Tuple

import httpx

from ..config import LIVE_TIMEOUT_SECONDS

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

CACHE_TTL_OK = 600.0     # forecast data does not change minute to minute
CACHE_TTL_FAIL = 60.0    # remember failures briefly so offline mode fails fast
CACHE_MAX_ENTRIES = 256  # plenty for every port + a demo's worth of map taps

# key -> (expires_at_monotonic, hourly-series dict or None)
_cache: Dict[Tuple[str, float, float], Tuple[float, Optional[Dict]]] = {}
_lock = threading.Lock()
_client: Optional[httpx.Client] = None


def _http() -> httpx.Client:
    """One shared client so concurrent agents reuse pooled connections."""
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                _client = httpx.Client(timeout=LIVE_TIMEOUT_SECONDS)
    return _client


def _series(kind: str, url: str, hourly_fields: str, lat: float, lon: float,
            extra: Optional[Dict] = None) -> Optional[Dict]:
    """The full 3-day hourly series for a point, cached.

    The key is rounded to 2 decimals (~1.1 km) — finer than the forecast
    model's own grid, so dragging the boat around one bay reuses the series.
    The request still sends the exact coordinates.
    """
    key = (kind, round(lat, 2), round(lon, 2))
    now = time.monotonic()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            return hit[1]

    data: Optional[Dict] = None
    try:
        r = _http().get(
            url,
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": hourly_fields,
                "forecast_days": 3,
                "timezone": "Asia/Kolkata",
                **(extra or {}),
            },
        )
        r.raise_for_status()
        hourly = r.json().get("hourly") or {}
        if hourly.get("time"):
            data = hourly
    except Exception:
        data = None

    with _lock:
        if len(_cache) >= CACHE_MAX_ENTRIES:
            expired = [k for k, (exp, _) in _cache.items() if exp <= now]
            for k in expired or [next(iter(_cache))]:
                _cache.pop(k, None)
        _cache[key] = (now + (CACHE_TTL_OK if data else CACHE_TTL_FAIL), data)
    return data


def clear_cache() -> None:
    """Drop cached series — used when the data mode is toggled."""
    with _lock:
        _cache.clear()


def _pick_hour_index(times: list, target: datetime) -> int:
    """Index of the hourly slot closest to `target` (times are local ISO strings)."""
    stamp = target.strftime("%Y-%m-%dT%H:00")
    if stamp in times:
        return times.index(stamp)
    # fall back to the same hour on the first available day
    hour_suffix = target.strftime("T%H:00")
    for i, t in enumerate(times):
        if t.endswith(hour_suffix):
            return i
    return 0


def fetch_marine(lat: float, lon: float, when: datetime) -> Optional[Dict]:
    """Wave height / period / SST. Returns None on any failure."""
    h = _series("marine", MARINE_URL,
                "wave_height,wave_period,sea_surface_temperature", lat, lon)
    if not h:
        return None
    times = h.get("time") or []
    i = _pick_hour_index(times, when)

    def at(key: str):
        series = h.get(key) or []
        return series[i] if i < len(series) else None

    return {
        "wave_height_m": at("wave_height"),
        "wave_period_s": at("wave_period"),
        "sst_c": at("sea_surface_temperature"),
        "valid_time": times[i],
        "provider": "Open-Meteo Marine",
    }


def fetch_weather(lat: float, lon: float, when: datetime) -> Optional[Dict]:
    """Wind / rain probability / visibility / temperature. None on failure."""
    h = _series("forecast", FORECAST_URL,
                ("temperature_2m,wind_speed_10m,wind_direction_10m,"
                 "precipitation_probability,visibility"),
                lat, lon, extra={"wind_speed_unit": "kmh"})
    if not h:
        return None
    times = h.get("time") or []
    i = _pick_hour_index(times, when)

    def at(key: str):
        series = h.get(key) or []
        return series[i] if i < len(series) else None

    visibility_m = at("visibility")
    return {
        "temperature_c": at("temperature_2m"),
        "wind_speed_kmh": at("wind_speed_10m"),
        "wind_direction_deg": at("wind_direction_10m"),
        "rain_probability_pct": at("precipitation_probability"),
        "visibility_km": round(visibility_m / 1000.0, 1) if visibility_m is not None else None,
        "valid_time": times[i],
        "provider": "Open-Meteo",
    }
