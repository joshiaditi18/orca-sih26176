"""Geospatial primitives, coastal gazetteer and geofence layers.

Deliberately dependency-free (no shapely/geopandas needed to run the demo):
haversine, bearing, ray-casting point-in-polygon and point-to-polygon distance
are ~80 lines of maths and remove an install-time failure mode on stage.
PostGIS/GeoPandas remain the production path for real cadastral polygons.

HONESTY NOTE: the restricted-zone polygons below are ILLUSTRATIVE geofences
drawn for demonstration. They are not official maritime boundaries. Production
ORCA ingests authoritative polygons (MPA notifications, port limits, IMBL).
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence, Tuple

EARTH_RADIUS_KM = 6371.0088

Coord = Tuple[float, float]  # (latitude, longitude)


# --------------------------------------------------------------------------
# Core maths
# --------------------------------------------------------------------------
def haversine_km(a: Coord, b: Coord) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(h)))


def bearing_deg(a: Coord, b: Coord) -> float:
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlon = math.radians(b[1] - a[1])
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360.0) % 360.0


_COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def compass(bearing: float) -> str:
    return _COMPASS[int((bearing + 11.25) % 360 / 22.5)]


def destination(origin: Coord, bearing: float, distance_km: float) -> Coord:
    """Point reached travelling `distance_km` from `origin` along `bearing`."""
    ang = distance_km / EARTH_RADIUS_KM
    br = math.radians(bearing)
    lat1, lon1 = math.radians(origin[0]), math.radians(origin[1])
    lat2 = math.asin(math.sin(lat1) * math.cos(ang) + math.cos(lat1) * math.sin(ang) * math.cos(br))
    lon2 = lon1 + math.atan2(
        math.sin(br) * math.sin(ang) * math.cos(lat1),
        math.cos(ang) - math.sin(lat1) * math.sin(lat2),
    )
    return (math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180)


def point_in_polygon(pt: Coord, poly: Sequence[Coord]) -> bool:
    """Ray-casting test. `poly` is a closed-or-open ring of (lat, lon)."""
    lat, lon = pt
    inside = False
    n = len(poly)
    for i in range(n):
        lat_i, lon_i = poly[i]
        lat_j, lon_j = poly[(i - 1) % n]
        intersects = ((lon_i > lon) != (lon_j > lon)) and (
            lat < (lat_j - lat_i) * (lon - lon_i) / ((lon_j - lon_i) or 1e-12) + lat_i
        )
        if intersects:
            inside = not inside
    return inside


def _segment_distance_km(pt: Coord, a: Coord, b: Coord) -> float:
    """Approximate point-to-segment distance using a local equirectangular
    projection — accurate to well under a metre at the scales we care about."""
    lat0 = math.radians((a[0] + b[0]) / 2)
    kx = math.cos(lat0) * 111.320
    ky = 110.574

    px, py = pt[1] * kx, pt[0] * ky
    ax, ay = a[1] * kx, a[0] * ky
    bx, by = b[1] * kx, b[0] * ky

    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def distance_to_polygon_km(pt: Coord, poly: Sequence[Coord]) -> float:
    """0.0 when inside, otherwise distance to the nearest edge."""
    if point_in_polygon(pt, poly):
        return 0.0
    n = len(poly)
    return min(_segment_distance_km(pt, poly[i], poly[(i + 1) % n]) for i in range(n))


def segment_intersects_polygon(a: Coord, b: Coord, poly: Sequence[Coord], samples: int = 24) -> bool:
    """Cheap swept test: sample the leg and check containment."""
    for i in range(samples + 1):
        t = i / samples
        p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        if point_in_polygon(p, poly):
            return True
    return False


# --------------------------------------------------------------------------
# Coastal gazetteer — landing centres / harbours used for location lookup
# --------------------------------------------------------------------------
PORTS: List[Dict] = [
    {"name": "Mumbai",         "aliases": ["mumbai", "bombay", "मुंबई", "सस्सून", "sassoon"],
     "lat": 18.9220, "lon": 72.8347, "state": "Maharashtra", "shore_bearing": 270},
    {"name": "Ratnagiri",      "aliases": ["ratnagiri", "रत्नागिरी"],
     "lat": 16.9902, "lon": 73.3120, "state": "Maharashtra", "shore_bearing": 270},
    {"name": "Panaji (Goa)",   "aliases": ["goa", "panaji", "panjim", "गोवा", "गोव्या", "पणजी"],
     "lat": 15.4909, "lon": 73.8278, "state": "Goa", "shore_bearing": 270},
    {"name": "Veraval",        "aliases": ["veraval", "gujarat", "गुजरात", "वेरावळ", "वेरावल"],
     "lat": 20.9070, "lon": 70.3679, "state": "Gujarat", "shore_bearing": 200},
    {"name": "Kochi",          "aliases": ["kochi", "cochin", "kerala", "केरळ", "केरल",
                                           "कोच्चि", "कोची", "कोचीन"],
     "lat": 9.9312, "lon": 76.2673, "state": "Kerala", "shore_bearing": 260},
    {"name": "Chennai",        "aliases": ["chennai", "madras", "tamil nadu", "चेन्नई",
                                           "तमिळनाडू", "तमिलनाडु", "मद्रास"],
     "lat": 13.0827, "lon": 80.2707, "state": "Tamil Nadu", "shore_bearing": 90},
    {"name": "Visakhapatnam",  "aliases": ["visakhapatnam", "vizag", "andhra", "आंध्र",
                                           "विशाखापट्टणम", "विशाखापत्तनम"],
     "lat": 17.6868, "lon": 83.2185, "state": "Andhra Pradesh", "shore_bearing": 90},
    {"name": "Paradip",        "aliases": ["paradip", "paradeep", "odisha", "ओडिशा", "puri",
                                           "पुरी", "पारादीप", "ओडिसा"],
     "lat": 20.2648, "lon": 86.6947, "state": "Odisha", "shore_bearing": 110},
    {"name": "Digha",          "aliases": ["digha", "west bengal", "bengal", "बंगाल",
                                           "kolkata", "दीघा"],
     "lat": 21.6270, "lon": 87.5090, "state": "West Bengal", "shore_bearing": 150},
    {"name": "Port Blair",     "aliases": ["port blair", "andaman", "nicobar", "अंदमान",
                                           "अंडमान", "पोर्ट ब्लेअर"],
     "lat": 11.6234, "lon": 92.7265, "state": "Andaman & Nicobar", "shore_bearing": 90},
]

DEFAULT_PORT = PORTS[0]


def find_port(text: str) -> Optional[Dict]:
    """Match a free-text place mention (any of the 3 languages) to a landing centre."""
    if not text:
        return None
    t = text.lower()
    for port in PORTS:
        for alias in port["aliases"]:
            if alias in t:
                return port
    return None


def nearest_port(lat: float, lon: float) -> Dict:
    return min(PORTS, key=lambda p: haversine_km((lat, lon), (p["lat"], p["lon"])))


def distance_from_shore_km(lat: float, lon: float) -> float:
    """Distance to the nearest landing centre — our proxy for 'offshore-ness'.

    Real ORCA measures to the OSM coastline polyline; for the prototype the
    harbour gazetteer is a defensible approximation and keeps the demo offline.
    """
    port = nearest_port(lat, lon)
    return haversine_km((lat, lon), (port["lat"], port["lon"]))


# --------------------------------------------------------------------------
# Landmass layer — so nothing marine is ever placed on land
# --------------------------------------------------------------------------
# A deliberately SIMPLIFIED coastline (tens of vertices, ±10-20 km in the
# river deltas), traced clockwise and closed far inland so every interior
# point tests as land. That is plenty to keep a synthetic fishing ground out
# of a wheat field: candidates sit 25-100 km offshore, an order of magnitude
# beyond the polygon's error. Production ORCA uses the OSM/GSHHG coastline.
_MAINLAND_INDIA: List[Coord] = [
    (23.90, 68.10),                                       # Sir Creek
    (23.00, 68.45), (22.85, 69.30), (22.95, 70.15),       # Kutch shore
    (22.55, 70.35),                                       # head of Gulf of Kutch
    (22.47, 69.60), (22.25, 68.97),                       # Saurashtra north shore
    (22.20, 68.95), (21.64, 69.61), (20.90, 70.37),       # Dwarka, Porbandar, Veraval
    (20.70, 70.98), (21.08, 71.80),                       # Diu, Mahuva
    (21.40, 72.05), (21.77, 72.20), (22.20, 72.50),       # west shore, Gulf of Khambhat
    (22.30, 72.60),                                       # head of Gulf of Khambhat
    (21.90, 72.70), (21.60, 72.65), (21.10, 72.65),       # east shore (Narmada, Surat)
    (20.90, 72.75), (20.40, 72.83),                       # Daman
    (19.90, 72.75), (19.30, 72.78), (18.92, 72.80),       # Konkan, Mumbai
    (17.99, 73.01), (16.99, 73.27), (15.99, 73.46),       # Raigad, Ratnagiri, Malvan
    (15.49, 73.80), (14.80, 74.10), (13.35, 74.70),       # Goa, Karwar, Udupi
    (12.85, 74.83), (11.25, 75.77), (10.55, 76.03),       # Mangalore, Kozhikode
    (9.93, 76.24), (9.00, 76.52), (8.29, 77.05),          # Kochi, Kollam, Vizhinjam
    (8.07, 77.55),                                        # Kanyakumari
    (8.75, 78.15), (9.28, 79.20),                         # Tuticorin, Rameswaram base
    (9.85, 79.05), (10.29, 79.86),                        # Palk Bay, Point Calimere
    (10.77, 79.85), (11.75, 79.77), (12.62, 80.19),       # Nagapattinam, Cuddalore
    (13.08, 80.30), (13.70, 80.23), (14.60, 80.15),       # Chennai, Sriharikota, Nellore
    (15.90, 80.85), (16.00, 81.15),                       # Krishna delta
    (16.60, 82.30), (17.69, 83.30), (18.30, 84.10),       # Godavari delta, Vizag
    (19.30, 84.90), (19.80, 85.85), (20.26, 86.75),       # Gopalpur, Puri, Paradip
    (20.80, 87.05), (21.63, 87.55), (21.65, 88.20),       # Dhamra, Digha, Sagar Island
    (21.60, 89.05),                                       # Sundarbans / Bangladesh border
    (27.00, 89.00), (30.00, 78.00), (28.00, 70.00),       # inland closure — all land
    (24.50, 68.20),
]

_ANDAMAN: List[Coord] = [
    (13.70, 92.55), (13.70, 93.00), (10.40, 92.85), (10.40, 92.35),
]

_SRI_LANKA: List[Coord] = [
    (9.83, 80.22), (8.50, 81.35), (6.90, 81.85), (5.95, 80.55),
    (6.80, 79.85), (8.05, 79.70),
]

LANDMASS: List[List[Coord]] = [_MAINLAND_INDIA, _ANDAMAN, _SRI_LANKA]


def is_on_land(lat: float, lon: float) -> bool:
    """True when the point falls inside the (simplified) landmass."""
    return any(point_in_polygon((lat, lon), poly) for poly in LANDMASS)


def open_water_run(origin: Coord, bearing: float,
                   max_km: float = 90.0, step_km: float = 15.0) -> int:
    """How many `step_km` hops along `bearing` stay at sea before hitting land."""
    n = 0
    d = step_km
    while d <= max_km:
        p = destination(origin, bearing, d)
        if is_on_land(p[0], p[1]):
            break
        n += 1
        d += step_km
    return n


def seaward_bearing(lat: float, lon: float, prior: float) -> float:
    """The compass direction with the most open water from this point.

    `prior` (the nearest port's shore_bearing) breaks ties, so the rehearsed
    ports keep their exact layouts while an arbitrary point inside a gulf gets
    a fan that actually points down the gulf.
    """
    best_bearing, best_key = prior, (-1, 0.0)
    for k in range(16):
        b = k * 22.5
        run = open_water_run((lat, lon), b)
        diff = abs(b - prior) % 360
        key = (run, -(min(diff, 360 - diff)))
        if key > best_key:
            best_key, best_bearing = key, b
    return best_bearing if best_key[0] > 0 else prior


# --------------------------------------------------------------------------
# Geofence layers (ILLUSTRATIVE — see module docstring)
# --------------------------------------------------------------------------
RESTRICTED_ZONES: List[Dict] = [
    {
        # Sits OFFSHORE of the Sassoon Dock launch point, straddling the direct
        # track to the nearest fishing grounds — so the "shortest route clips a
        # restricted area, ORCA routes around it" demo triggers naturally.
        "id": "mum-port-limit",
        "name": "Mumbai Port approach channel",
        "zone_type": "port_limit",
        "severity": "warning",
        "polygon": [(18.9300, 72.6800), (18.9300, 72.7600), (18.8600, 72.7600), (18.8600, 72.6800)],
        "note": "Illustrative port-approach exclusion for demo purposes.",
    },
    {
        "id": "mum-defence-area",
        "name": "Naval exercise area (notified)",
        "zone_type": "defence",
        "severity": "critical",
        "polygon": [(18.9100, 72.5800), (18.9100, 72.7000), (18.8500, 72.7000), (18.8500, 72.5800)],
        # Firing/exercise windows are time-bound in real notifications, which is
        # why a zone can be "closed this afternoon, open tomorrow morning".
        "active_hours": (14, 18),
        "note": "Illustrative notified-area polygon for demo purposes.",
    },
    {
        "id": "mpa-malvan",
        "name": "Malvan Marine Sanctuary",
        "zone_type": "marine_protected_area",
        "severity": "critical",
        "polygon": [(16.0700, 73.4300), (16.0700, 73.4900), (16.0100, 73.4900), (16.0100, 73.4300)],
        "note": "Approximate MPA footprint — illustrative.",
    },
    {
        "id": "imbl-palk",
        "name": "International Maritime Boundary (Palk Bay approach)",
        "zone_type": "international_boundary",
        "severity": "critical",
        "polygon": [(9.6000, 79.3000), (9.6000, 79.6500), (9.1000, 79.6500), (9.1000, 79.3000)],
        "note": "Illustrative IMBL buffer — crossing risks detention.",
    },
    {
        "id": "kochi-channel",
        "name": "Kochi Port navigation channel",
        "zone_type": "port_limit",
        "severity": "warning",
        "polygon": [(9.9800, 76.1900), (9.9800, 76.2400), (9.9200, 76.2400), (9.9200, 76.1900)],
        "note": "Illustrative channel polygon for demo purposes.",
    },
]


def zone_active_at(zone: Dict, hour: Optional[float] = None) -> bool:
    """Is this restriction in force at `hour`? Zones with no window are always on."""
    window = zone.get("active_hours")
    if not window:
        return True
    if hour is None:
        return True
    start, end = window
    return start <= hour < end


def zone_window_text(zone: Dict) -> Optional[str]:
    window = zone.get("active_hours")
    if not window:
        return None
    start, end = window
    return f"{start:02d}:00-{end:02d}:00"


def zones_near(lat: float, lon: float, radius_km: float = 60.0,
               hour: Optional[float] = None) -> List[Dict]:
    """Restricted zones within `radius_km`, annotated with distance/containment."""
    out: List[Dict] = []
    for zone in RESTRICTED_ZONES:
        d = distance_to_polygon_km((lat, lon), zone["polygon"])
        if d <= radius_km:
            item = dict(zone)
            item["distance_km"] = round(d, 2)
            item["inside"] = d == 0.0
            item["active_now"] = zone_active_at(zone, hour)
            item["window"] = zone_window_text(zone)
            out.append(item)
    return sorted(out, key=lambda z: z["distance_km"])


def route_zone_conflicts(legs: Sequence[Coord]) -> List[Dict]:
    """Zones a proposed track would cut through."""
    hits: List[Dict] = []
    for zone in RESTRICTED_ZONES:
        for i in range(len(legs) - 1):
            if segment_intersects_polygon(legs[i], legs[i + 1], zone["polygon"]):
                hits.append(zone)
                break
    return hits
