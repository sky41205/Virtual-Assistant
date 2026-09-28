import re
import urllib.parse
import requests
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult

class WeatherSkill(BaseSkill):
    name = "weather_skill"
    description = "Fetches live weather, forecast, temperature, humidity, and location-based meteorological conditions."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        weather_words = [
            "weather", "mausam", "temperature", "forecast", "how hot is it",
            "how cold is it", "is it raining", "will it rain", "humidity", "climate"
        ]
        return any(w in q for w in weather_words)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # Extract city if requested
        city = ""
        m_city = re.search(r'(?:weather|mausam|temperature|forecast|climate)\s+(?:in|of|at|for)\s+([a-zA-Z\s]+)$', q)
        if m_city:
            city = m_city.group(1).strip()
        elif re.search(r'^([a-zA-Z]+)\s+(?:weather|forecast|temperature)', q):
            city = q.split()[0].strip()

        clean_city = city.title() if city else ""
        target_url = f"https://wttr.in/{urllib.parse.quote(clean_city)}?format=j1" if clean_city else "https://wttr.in/?format=j1"

        try:
            resp = requests.get(target_url, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                curr = data['current_condition'][0]
                temp_c = curr['temp_C']
                feels_c = curr['FeelsLikeC']
                desc = curr['weatherDesc'][0]['value']
                humidity = curr['humidity']
                wind = curr['windspeedKmph']

                loc_name = clean_city
                if not loc_name and 'nearest_area' in data and data['nearest_area']:
                    loc_name = data['nearest_area'][0]['areaName'][0]['value']

                # 3-day forecast summary
                forecast_summary = []
                if "weather" in data:
                    for day in data["weather"][:2]:
                        date = day.get("date", "")
                        max_c = day.get("maxtempC", "")
                        min_c = day.get("mintempC", "")
                        forecast_summary.append(f"{date}: High {max_c}°C / Low {min_c}°C")

                from engine.language_detector import detect_language
                lang_mode = detect_language(query).get("mode", "english")

                WEATHER_DESC_HI = {
                    "clear": "मौसम साफ",
                    "sunny": "धूप खिली",
                    "partly cloudy": "हल्के बादल",
                    "cloudy": "बादल छाए",
                    "overcast": "घने बादल",
                    "light rain": "हल्की बारिश",
                    "rain": "बारिश",
                    "heavy rain": "तेज बारिश",
                    "patchy rain nearby": "आसपास हल्की बारिश",
                    "thunderstorm": "तूफान",
                    "mist": "धुंध",
                    "fog": "कोहरा",
                    "snow": "बर्फबारी"
                }

                WEATHER_DESC_HING = {
                    "clear": "mausam saaf",
                    "sunny": "dhoop khili",
                    "partly cloudy": "halke baadal",
                    "cloudy": "baadal chhaye",
                    "overcast": "ghane baadal",
                    "light rain": "halki baarish",
                    "rain": "baarish",
                    "heavy rain": "tez baarish",
                    "patchy rain nearby": "aaspas halki baarish",
                    "thunderstorm": "toofan",
                    "mist": "dhundh",
                    "fog": "kohra",
                    "snow": "barfbaari"
                }

                if lang_mode == "hindi_devanagari":
                    loc_str = f"{loc_name} में" if loc_name else "आपके इलाके में"
                    d_lower = desc.lower()
                    d_hi = WEATHER_DESC_HI.get(d_lower, desc)
                    spoken = f"वर्तमान में {loc_str} तापमान {temp_c}°C है, {d_hi} है और नमी {humidity}% है।"
                    display_text = f"🌤️ **मौसम**: {temp_c}°C, {d_hi} ({loc_str})"
                elif lang_mode == "hinglish":
                    loc_str = f"{loc_name} me" if loc_name else "aapke ilaqe me"
                    d_lower = desc.lower()
                    d_hing = WEATHER_DESC_HING.get(d_lower, desc)
                    spoken = f"Abhi {loc_str} taapmaan {temp_c}°C hai, {d_hing} hai aur humidity {humidity}% hai."
                    display_text = f"🌤️ **Mausam**: {temp_c}°C, {d_hing} ({loc_str})"
                else:
                    loc_str = f"in {loc_name}" if loc_name else "in your current area"
                    spoken = f"Currently {loc_str}, it is {temp_c}°C with {desc.lower()} and {humidity}% humidity. It feels like {feels_c}°C."
                    display_text = f"🌤️ **Weather**: {temp_c}°C, {desc} ({loc_str})"

                card_data = {
                    "location": loc_name or "Local Area",
                    "temp_c": temp_c,
                    "feels_like": feels_c,
                    "condition": desc,
                    "humidity": humidity,
                    "wind_kmph": wind,
                    "forecast": forecast_summary
                }

                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    display_text=display_text,
                    card_type="weather",
                    card_data=card_data
                )
        except Exception as e:
            print(f"Weather skill API exception: {e}")

        # Quick text fallback
        try:
            url_simple = f"https://wttr.in/{urllib.parse.quote(clean_city)}?format=%C+%t" if clean_city else "https://wttr.in/?format=%C+%t"
            r = requests.get(url_simple, timeout=3)
            if r.status_code == 200 and r.text.strip():
                loc_str = f"in {clean_city}" if clean_city else "right now"
                spoken = f"The weather {loc_str} is {r.text.strip()}."
                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    card_type="weather",
                    card_data={"location": clean_city or "Current Location", "condition": r.text.strip()}
                )
        except Exception:
            pass

        # Informative explanation when offline/unavailable
        err_msg = f"I was unable to retrieve live weather data for {clean_city or 'your location'}. This may be due to network connectivity or location services being temporarily unreachable."
        return SkillResult(
            handled=True,
            spoken_response=err_msg,
            card_type="info",
            card_data={"title": "Weather Unavailable", "message": err_msg}
        )
