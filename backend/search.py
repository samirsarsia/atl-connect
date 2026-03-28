import os
import requests

SERPER_API_KEY = os.getenv("SERPER_API_KEY")
SERPER_SEARCH_URL = "https://google.serper.dev/search"
SERPER_PLACES_URL = "https://google.serper.dev/places"

HEADERS = {
    "X-API-KEY": SERPER_API_KEY or "",
    "Content-Type": "application/json",
}


def _web_search(query: str, location_str: str, num: int = 8) -> list:
    """Run a Serper web search and return normalized results."""
    payload = {
        "q": f"{query} {location_str}",
        "gl": "us",
        "hl": "en",
        "location": "Atlanta, Georgia, United States",
        "num": num,
    }
    try:
        resp = requests.post(SERPER_SEARCH_URL, headers=HEADERS, json=payload, timeout=7)
        resp.raise_for_status()
        data = resp.json()

        results = []
        for item in data.get("organic", []):
            results.append({
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "source": "web",
            })
        # Local pack results embedded in web search
        for place in data.get("places", [])[:5]:
            results.append({
                "title": place.get("title", ""),
                "address": place.get("address", ""),
                "phone": place.get("phoneNumber", ""),
                "rating": place.get("rating", ""),
                "link": place.get("website", ""),
                "snippet": place.get("description", ""),
                "source": "places",
            })
        return results
    except Exception as e:
        print(f"Serper web search error: {e}")
        return []


def _places_search(query: str) -> list:
    """Run a Serper places search for local organizations."""
    payload = {
        "q": query,
        "gl": "us",
        "hl": "en",
        "location": "Atlanta, Georgia, United States",
    }
    try:
        resp = requests.post(SERPER_PLACES_URL, headers=HEADERS, json=payload, timeout=7)
        resp.raise_for_status()
        data = resp.json()

        results = []
        for place in data.get("places", [])[:8]:
            results.append({
                "title": place.get("title", ""),
                "address": place.get("address", ""),
                "phone": place.get("phoneNumber", ""),
                "rating": place.get("rating", ""),
                "hours": place.get("openingHours", ""),
                "link": place.get("website", ""),
                "snippet": place.get("description", ""),
                "source": "places",
            })
        return results
    except Exception as e:
        print(f"Serper places search error: {e}")
        return []


def search_realtime_resources(query: str, lat: float = None, lng: float = None) -> list:
    """
    Fetch real-time Atlanta community resources via Serper.dev.
    Runs both a web search and a places search, deduplicates by title.
    """
    location_str = "Atlanta Georgia"
    if lat and lng:
        location_str = f"Atlanta Georgia near {lat:.4f},{lng:.4f}"

    # Web search — informational pages, org websites, directories
    web_results = _web_search(query, location_str, num=8)

    # Places search — local businesses / nonprofits with address & phone
    places_results = _places_search(f"{query} Atlanta Georgia")

    # Merge and deduplicate by title
    seen_titles: set[str] = set()
    combined = []
    for r in places_results + web_results:
        title = r.get("title", "").strip().lower()
        if title and title not in seen_titles:
            seen_titles.add(title)
            combined.append(r)

    return combined[:16]
