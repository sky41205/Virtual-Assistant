import re
import datetime
from typing import Optional, Dict, Any
from zoneinfo import ZoneInfo
from engine.skills.base_skill import BaseSkill, SkillResult

# Map common city names to IANA timezone
CITY_TIMEZONES = {
    "london": "Europe/London",
    "new york": "America/New_York",
    "nyc": "America/New_York",
    "tokyo": "Asia/Tokyo",
    "paris": "Europe/Paris",
    "sydney": "Australia/Sydney",
    "dubai": "Asia/Dubai",
    "singapore": "Asia/Singapore",
    "san francisco": "America/Los_Angeles",
    "los angeles": "America/Los_Angeles",
    "delhi": "Asia/Kolkata",
    "mumbai": "Asia/Kolkata",
    "india": "Asia/Kolkata",
    "toronto": "America/Toronto",
    "berlin": "Europe/Berlin",
    "beijing": "Asia/Shanghai",
}

class DateTimeSkill(BaseSkill):
    name = "datetime_skill"
    description = "Provides trusted date, time, timezone conversion, and day calculations."

    def __init__(self):
        # Default local timezone
        self.default_tz = "Asia/Kolkata"

    def get_configured_tz(self) -> str:
        try:
            import os
            return os.getenv("ASSISTANT_TIMEZONE", self.default_tz)
        except Exception:
            return self.default_tz

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        time_triggers = [
            "what time", "current time", "time right now", "time in", "what is the time",
            "kitne baje", "samay kya", "tell me the time", "what's the time",
            "what date", "today's date", "what is the date", "current date", "todays date",
            "aaj konsi date", "aaj konsi taareekh", "what day is today", "what day is it",
            "days until", "how many days to", "how many days until", "what was yesterday"
        ]
        return any(t in q for t in time_triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()
        is_hi = any(w in q for w in ["baje", "samay", "aaj", "taareekh", "kya"])
        tz_name = self.get_configured_tz()

        # Check for specific world city
        target_city = None
        for city, tz in CITY_TIMEZONES.items():
            if f"time in {city}" in q or f"time of {city}" in q or f"time at {city}" in q:
                target_city = city
                tz_name = tz
                break

        try:
            tz = ZoneInfo(tz_name)
            now = datetime.datetime.now(tz)
        except Exception:
            now = datetime.datetime.now()

        time_str = now.strftime("%I:%M %p").lstrip("0")
        day_str = now.strftime("%A")
        date_str = now.strftime("%B %d, %Y")

        # 1. World city time
        if target_city:
            resp = f"The current time in {target_city.title()} is {time_str} on {day_str}, {date_str}."
            return SkillResult(
                handled=True,
                spoken_response=resp,
                card_type="info",
                card_data={"title": f"Time in {target_city.title()}", "time": time_str, "date": date_str, "timezone": tz_name}
            )

        # 2. Days until calculation: "how many days until friday"
        m_until = re.search(r'(?:days\s+until|how\s+many\s+days\s+to|days\s+to)\s+([a-zA-Z]+)', q)
        if m_until:
            target_day_name = m_until.group(1).capitalize()
            days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            if target_day_name in days_of_week:
                today_idx = now.weekday()
                target_idx = days_of_week.index(target_day_name)
                diff = (target_idx - today_idx) % 7
                if diff == 0:
                    diff = 7  # Next week
                resp = f"There are {diff} {'day' if diff == 1 else 'days'} until {target_day_name}."
                return SkillResult(handled=True, spoken_response=resp, card_type="info", card_data={"text": resp})

        # 3. Yesterday
        if "yesterday" in q:
            yest = now - datetime.timedelta(days=1)
            yest_str = yest.strftime("%A, %B %d")
            resp = f"Yesterday was {yest_str}."
            return SkillResult(handled=True, spoken_response=resp, card_type="info", card_data={"text": resp})

        from engine.language_detector import detect_language
        lang_mode = detect_language(query).get("mode", "english")

        # 4. Standard Date
        if any(w in q for w in ["date", "taareekh", "tareekh", "what day"]):
            if lang_mode == "hindi_devanagari":
                resp = f"आज {day_str}, {now.day} {now.strftime('%B')} {now.year} है।"
            elif lang_mode == "hinglish":
                resp = f"Aaj {day_str}, {date_str} hai."
            else:
                resp = f"Today is {day_str}, {date_str}."
            return SkillResult(
                handled=True,
                spoken_response=resp,
                card_type="info",
                card_data={"title": "Current Date", "date": date_str, "day": day_str, "timezone": tz_name}
            )

        # 5. Current Time
        if lang_mode == "hindi_devanagari":
            resp = f"अभी {time_str} बजे हैं, और आज {date_str} है।"
        elif lang_mode == "hinglish":
            resp = f"Abhi {time_str} baje hain, aur aaj {date_str} hai."
        else:
            resp = f"It is currently {time_str} on {day_str}, {date_str}."

        return SkillResult(
            handled=True,
            spoken_response=resp,
            card_type="info",
            card_data={"time": time_str, "date": date_str, "day": day_str, "timezone": tz_name}
        )

    @staticmethod
    def get_world_clocks() -> list:
        cities = [
            ("New York", "America/New_York"),
            ("London", "Europe/London"),
            ("Tokyo", "Asia/Tokyo"),
            ("Dubai", "Asia/Dubai"),
            ("Sydney", "Australia/Sydney"),
        ]
        res = []
        for city, tz_id in cities:
            try:
                dt = datetime.datetime.now(ZoneInfo(tz_id))
                res.append({
                    "city": city,
                    "time": dt.strftime("%I:%M %p").lstrip("0"),
                    "date": dt.strftime("%a, %b %d")
                })
            except Exception:
                pass
        return res
