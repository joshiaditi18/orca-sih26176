"""Smoke test — runs the five rehearsed demo scenarios without a server.

    python smoke_test.py
"""
from __future__ import annotations

import sys

from app.agents import planner
from app.schemas import ChatRequest

CASES = [
    ("Scenario 2 (KILLER DEMO) — Marathi, Mumbai 6 AM",
     "मी उद्या सकाळी ६ वाजता मुंबईजवळ मासेमारीला जाऊ शकतो का?", "s1"),
    ("Follow-up — what about 12 PM? (context retained)",
     "दुपारी १२ वाजता काय?", "s1"),
    ("Scenario 1 — Safe conditions, Goa, English",
     "Is it safe to go fishing tomorrow morning near Goa?", "s2"),
    ("Scenario 3 — Cyclone, Paradip",
     "Is there a cyclone near Paradip? Can I go fishing?", "s3"),
    ("Scenario 4 — PFZ, Kochi, Hindi",
     "कोच्चि के पास मछली पकड़ने का क्षेत्र कहाँ है?", "s4"),
    ("Scenario 5 — Safest route, Mumbai",
     "Give me the safest route to the nearest fishing zone near Mumbai", "s5"),
]


def show(title: str, message: str, session: str) -> None:
    print("=" * 78)
    print(title)
    print(f"  ASK  : {message}")
    resp = planner.handle(ChatRequest(message=message, session_id=session))
    print(f"  LANG : {resp.language}   INTENT: {resp.intent.intent}   "
          f"PLACE: {resp.intent.location_text}   TIME: {resp.intent.time}")
    if resp.risk:
        print(f"  RISK : {resp.risk.score}/100 {resp.risk.category}"
              f"   official_warning={resp.risk.official_warning}   go={resp.risk.go}")
        for f in resp.risk.factors[:3]:
            print(f"         +{f.contribution:>5.1f}  {f.label:<20} {f.detail}")
        for o in resp.risk.overrides:
            print(f"         OVERRIDE: {o}")
        if resp.risk.window:
            print(f"         improves after {resp.risk.window}")
    if resp.pfz:
        z = resp.pfz[0]
        print(f"  PFZ  : #{z.rank} {z.distance_km} km {z.bearing}, SST {z.sst_c}, "
              f"chl {z.chlorophyll_mg_m3}, conf {z.confidence}")
    if resp.routes:
        for r in resp.routes:
            flag = "<= recommended" if r.recommended else ""
            print(f"  ROUTE: {r.name:<14} {r.distance_km:>6.1f} km  {r.eta_minutes:>4} min  "
                  f"{r.risk_category:<9} {flag}")
            if r.notes:
                print(f"         {r.notes}")
    if resp.geofence:
        for gfa in resp.geofence:
            print(f"  FENCE: [{gfa.severity}] {gfa.message}")
    print(f"  TRACE: {' -> '.join(f'{t.agent}({t.latency_ms}ms)' for t in resp.trace)}")
    print(f"  TOTAL: {resp.elapsed_ms} ms   MODE: {resp.mode}")
    print(f"  ANSWER: {resp.answer}")
    print()


def main() -> int:
    for title, message, session in CASES:
        show(title, message, session)

    # --- assertions the demo depends on ---------------------------------
    failures = []

    r1 = planner.handle(ChatRequest(
        message="मी उद्या सकाळी ६ वाजता मुंबईजवळ मासेमारीला जाऊ शकतो का?", session_id="a"))
    if r1.language != "mr":
        failures.append(f"Mumbai query language detected as {r1.language}, expected mr")
    if not r1.risk or r1.risk.category != "HIGH":
        failures.append(f"Mumbai 06:00 expected HIGH, got {r1.risk.category if r1.risk else None}")

    r2 = planner.handle(ChatRequest(message="दुपारी १२ वाजता काय?", session_id="a"))
    if not r2.risk or r2.risk.score >= r1.risk.score:
        failures.append("12:00 should be safer than 06:00")
    if r2.intent.location_text != "Mumbai":
        failures.append(f"follow-up lost context: {r2.intent.location_text}")

    r3 = planner.handle(ChatRequest(message="Can I fish near Paradip?", session_id="b"))
    if not r3.risk or r3.risk.category != "EXTREME":
        failures.append(f"Paradip expected EXTREME, got {r3.risk.category if r3.risk else None}")
    if not r3.risk.official_warning:
        failures.append("Paradip should carry an official warning")

    r4 = planner.handle(ChatRequest(message="Is it safe near Goa tomorrow morning?", session_id="c"))
    if not r4.risk or r4.risk.category not in ("LOW", "MODERATE"):
        failures.append(f"Goa expected LOW/MODERATE, got {r4.risk.category if r4.risk else None}")

    print("=" * 78)
    if failures:
        print("FAILED CHECKS:")
        for f in failures:
            print("  x", f)
        return 1
    print("ALL DEMO CHECKS PASSED")
    print(f"  Mumbai 06:00 -> {r1.risk.score}/100 {r1.risk.category}")
    print(f"  Mumbai 12:00 -> {r2.risk.score}/100 {r2.risk.category}")
    print(f"  Paradip      -> {r3.risk.score}/100 {r3.risk.category}")
    print(f"  Goa          -> {r4.risk.score}/100 {r4.risk.category}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
