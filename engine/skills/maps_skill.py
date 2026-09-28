import re
import urllib.parse
import webbrowser
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult

class MapsSkill(BaseSkill):
    name = "maps_skill"
    description = "Maps & Location: search places, get directions, locate nearby services, and travel info."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        triggers = [
            "directions to", "directions from", "how do i get to", "route to",
            "where is", "map of", "find nearby", "restaurants near me", "coffee near me",
            "locate nearby", "distance from", "distance between"
        ]
        return any(t in q for t in triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # 1. Directions From A to B
        m_dir = re.search(r'directions?\s+(?:from\s+)?(.+?)\s+to\s+(.+)$', q)
        if m_dir:
            origin = m_dir.group(1).strip()
            destination = m_dir.group(2).strip()
            orig_enc = urllib.parse.quote(origin)
            dest_enc = urllib.parse.quote(destination)
            map_url = f"https://www.google.com/maps/dir/{orig_enc}/{dest_enc}"

            spoken = f"Opening directions from {origin} to {destination} on the map."
            display = f"🗺️ **Route**: [{origin} ➔ {destination}]({map_url})\n\nClick to view full turn-by-turn directions."
            try:
                webbrowser.open(map_url)
            except Exception:
                pass

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="map_directions",
                card_data={"origin": origin, "destination": destination, "url": map_url}
            )

        # 2. Directions To Destination (Single)
        m_to = re.search(r'(?:directions?\s+to|route\s+to|how\s+do\s+i\s+get\s+to)\s+(.+)$', q)
        if m_to:
            destination = m_to.group(1).strip()
            dest_enc = urllib.parse.quote(destination)
            map_url = f"https://www.google.com/maps/dir/?api=1&destination={dest_enc}"

            spoken = f"Finding directions to {destination}."
            display = f"🗺️ **Directions to**: [{destination}]({map_url})\n\nClick link to launch navigation."
            try:
                webbrowser.open(map_url)
            except Exception:
                pass

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="map_directions",
                card_data={"destination": destination, "url": map_url}
            )

        # 3. Nearby Search
        m_near = re.search(r'(?:find\s+nearby|locate\s+nearby|near\s+me)\s*(.+)?', q)
        place = "services"
        if m_near and m_near.group(1):
            place = m_near.group(1).strip()
        elif "near me" in q:
            place = q.replace("near me", "").strip()

        place_enc = urllib.parse.quote(place + " near me")
        map_url = f"https://www.google.com/maps/search/{place_enc}"

        spoken = f"Searching for {place} near your current location."
        display = f"📍 **Nearby Search**: [{place}]({map_url})\n\nShowing nearby locations on map."
        try:
            webbrowser.open(map_url)
        except Exception:
            pass

        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=display,
            card_type="map_search",
            card_data={"search": place, "url": map_url}
        )
