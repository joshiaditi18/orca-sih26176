"""Shared plumbing for every specialist agent."""
from __future__ import annotations

import time
from typing import Any, Callable, Dict, Optional

from ..config import DEMO_DISCLAIMER, get_data_mode
from ..schemas import AgentResult, Measurement, Provenance


def provenance(source: str, timestamp: str, mode: str = "DEMO",
               confidence: Optional[float] = None) -> Provenance:
    note = DEMO_DISCLAIMER if mode == "DEMO" else None
    return Provenance(source=source, timestamp=timestamp, mode=mode,  # type: ignore[arg-type]
                      confidence=confidence, note=note)


def measurement(value: Optional[float], unit: str, label: str, source: str,
                timestamp: str, mode: str = "DEMO",
                confidence: Optional[float] = None) -> Measurement:
    return Measurement(value=value, unit=unit, label=label,
                       provenance=provenance(source, timestamp, mode, confidence))


def timed(fn: Callable[..., AgentResult]) -> Callable[..., AgentResult]:
    """Stamp every agent result with its wall-clock latency (drives the UI trace)."""

    def wrapper(*args, **kwargs) -> AgentResult:
        start = time.perf_counter()
        try:
            result = fn(*args, **kwargs)
        except Exception as exc:  # an agent must never take the whole request down
            result = AgentResult(agent=getattr(fn, "__agent__", fn.__name__),
                                 ok=False, error=f"{type(exc).__name__}: {exc}")
        result.latency_ms = int((time.perf_counter() - start) * 1000)
        return result

    wrapper.__name__ = fn.__name__
    return wrapper


def live_enabled() -> bool:
    return get_data_mode() == "LIVE"
