import os
import re
import sqlite3
import datetime
from typing import Optional, Dict, Any, List
from engine.skills.base_skill import BaseSkill, SkillResult

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "sophia.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_calendar_table():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                location TEXT,
                description TEXT,
                status TEXT DEFAULT 'confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

init_calendar_table()

class CalendarSkill(BaseSkill):
    name = "calendar_skill"
    description = "Calendar Integration: view schedule, create events, check conflicts, and cancel appointments."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        triggers = [
            "calendar", "schedule meeting", "add event", "create event", "new event",
            "what is on my calendar", "my schedule", "events today", "appointments today",
            "cancel event", "delete event", "schedule conflict"
        ]
        return any(t in q for t in triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()
        now = datetime.datetime.now()

        # 1. VIEW CALENDAR / TODAY'S SCHEDULE
        if any(w in q for w in ["calendar", "my schedule", "events today", "what is on my calendar", "appointments today"]):
            today_str = now.strftime("%Y-%m-%d")
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM calendar_events WHERE start_time LIKE ? ORDER BY start_time ASC", (f"{today_str}%",))
                events = [dict(r) for r in cur.fetchall()]

            if not events:
                return SkillResult(
                    handled=True,
                    spoken_response="Your calendar is completely clear for today. You have no upcoming events.",
                    display_text=f"📅 Calendar for Today ({today_str}): Clear (No events)",
                    card_type="calendar",
                    card_data={"events": []}
                )

            summary = [f"{e['title']} at {e['start_time'].split(' ')[-1]}" for e in events]
            spoken = f"You have {len(events)} event{'s' if len(events)>1 else ''} today: " + ", ".join(summary)
            display = "\n".join([f"• **{e['title']}** — {e['start_time']} ({e['location'] or 'No location'})" for e in events])
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="calendar",
                card_data={"events": events}
            )

        # 2. ADD EVENT / SCHEDULE MEETING
        if any(w in q for w in ["schedule", "add event", "create event", "new event", "appointment"]):
            title = q
            for p in ["schedule meeting with", "schedule meeting", "add event", "create event", "new event", "schedule a", "schedule"]:
                title = title.replace(p, "").strip()

            # Parse time (e.g., "at 4pm", "at 16:00", "tomorrow at 3pm")
            time_part = now.strftime("%Y-%m-%d 10:00")
            m_time = re.search(r'\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b', title)
            if m_time:
                time_str = m_time.group(1).strip()
                title = title.replace(m_time.group(0), "").strip()
                time_part = f"{now.strftime('%Y-%m-%d')} {time_str}"

            if not title:
                title = "Meeting / Event"

            # Check for scheduling conflict
            conflict = self._check_conflict(time_part)
            conflict_warning = ""
            if conflict:
                conflict_warning = f" Notice: you already have '{conflict['title']}' scheduled around this time."

            with get_db() as conn:
                cur = conn.cursor()
                cur.execute("INSERT INTO calendar_events (title, start_time) VALUES (?, ?)", (title, time_part))
                conn.commit()
                eid = cur.lastrowid

            spoken = f"Event scheduled: '{title}' at {time_part}.{conflict_warning}"
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=f"📅 Event #{eid}: {title}\nTime: {time_part}{conflict_warning}",
                card_type="calendar_event",
                card_data={"id": eid, "title": title, "start_time": time_part, "conflict": bool(conflict)}
            )

        # 3. DELETE / CANCEL EVENT
        m_del = re.search(r'(?:cancel|delete|remove)\s+(?:calendar\s+)?event\s+(\d+)', q)
        if m_del:
            eid = int(m_del.group(1))
            with get_db() as conn:
                conn.execute("DELETE FROM calendar_events WHERE id = ?", (eid,))
                conn.commit()
            return SkillResult(
                handled=True,
                spoken_response=f"Event #{eid} has been cancelled from your calendar.",
                display_text=f"Event #{eid} cancelled."
            )

        return SkillResult(handled=False, spoken_response="")

    def _check_conflict(self, start_time: str) -> Optional[Dict[str, Any]]:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM calendar_events WHERE start_time = ?", (start_time,))
            row = cur.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_upcoming_events(limit=10) -> List[Dict[str, Any]]:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM calendar_events ORDER BY start_time ASC LIMIT ?", (limit,))
            return [dict(r) for r in cur.fetchall()]

    @staticmethod
    def get_today_events(limit=10) -> List[Dict[str, Any]]:
        return CalendarSkill.get_upcoming_events(limit=limit)
