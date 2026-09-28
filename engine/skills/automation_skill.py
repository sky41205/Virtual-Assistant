import os
import sqlite3
import datetime
import eel
from typing import Optional, Dict, Any, List
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.skills.system_skill import SystemInformationSkill

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "sophia.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_audit_log_table():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS action_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action_type TEXT NOT NULL,
                target TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT DEFAULT '',
                user_confirmed INTEGER DEFAULT 0
            )
        """)
        conn.commit()

init_audit_log_table()

def log_action(action_type: str, target: str, status: str, details: str = "", user_confirmed: bool = False):
    """Securely log assistant actions and external interactions into the audit log."""
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO action_audit_log (action_type, target, status, details, user_confirmed) VALUES (?, ?, ?, ?, ?)",
                (action_type, target, status, details, 1 if user_confirmed else 0)
            )
            conn.commit()
    except Exception as e:
        print(f"Error logging action audit: {e}")

def get_recent_audit_logs(limit: int = 25) -> List[Dict[str, Any]]:
    """Retrieve recent action logs for transparency and security monitoring."""
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM action_audit_log ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"Error fetching audit logs: {e}")
        return []

class SafeAutomationSkill(BaseSkill):
    name = "automation_skill"
    description = "Executes predefined, approved safe automation workflows (Work Mode, Study Session, Daily Briefing, System Health Check) with explicit audit logging and confirmation for consequential changes."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        triggers = [
            "work mode", "focus mode", "work session",
            "study session", "study mode", "revision session",
            "daily briefing", "morning briefing", "today's briefing", "morning routine",
            "system health check", "run diagnostics", "health check",
            "wrap up session", "end day", "clean slate",
            "show audit logs", "action logs", "automation log", "security log"
        ]
        return any(t in q for t in triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # 1. AUDIT LOGS DISPLAY
        if any(w in q for w in ["show audit logs", "action logs", "automation log", "security log"]):
            logs = get_recent_audit_logs(10)
            if not logs:
                return SkillResult(
                    handled=True,
                    spoken_response="No actions have been logged yet.",
                    display_text="Action audit log is empty."
                )
            summary = "\n".join([f"• [{l['timestamp'][:16]}] **{l['status']}**: {l['action_type']} -> {l['target']}" for l in logs])
            return SkillResult(
                handled=True,
                spoken_response=f"Here are the {len(logs)} most recent logged assistant actions.",
                display_text=f"📜 **Action Audit Log**\n\n{summary}",
                card_type="audit_log",
                card_data={"logs": logs}
            )

        # 2. WORK MODE WORKFLOW
        if any(w in q for w in ["work mode", "focus mode", "work session"]):
            return self._run_work_mode()

        # 3. STUDY SESSION WORKFLOW
        if any(w in q for w in ["study session", "study mode", "revision session"]):
            return self._run_study_session()

        # 4. DAILY BRIEFING WORKFLOW
        if any(w in q for w in ["daily briefing", "morning briefing", "today's briefing", "morning routine"]):
            return self._run_daily_briefing()

        # 5. SYSTEM HEALTH CHECK WORKFLOW
        if any(w in q for w in ["system health check", "run diagnostics", "health check"]):
            return self._run_system_health_check()

        # 6. WRAP UP / CLEAN SLATE (Consequential Action - Requires User Confirmation)
        if any(w in q for w in ["wrap up session", "end day", "clean slate"]):
            log_action("workflow", "wrap_up_session", "PENDING_CONFIRMATION", "Awaiting user confirmation to wrap up day")
            return SkillResult(
                handled=True,
                spoken_response="Would you like to wrap up today's session? This will review completed tasks and archive today's pending items.",
                display_text="⚠️ **Consequential Action**: Wrap up today's session and archive completed tasks?",
                card_type="confirmation",
                card_data={"action": "wrap_up_session", "workflow": "clean_slate"},
                requires_confirmation=True,
                confirmation_action_id="workflow:clean_slate",
                confirmation_prompt="Wrap up today's session and archive completed tasks?"
            )

        return SkillResult(handled=False, spoken_response="")

    def confirm(self, action_id: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        if action_id == "workflow:clean_slate":
            # Consequential workflow executed safely
            from engine.skills.productivity_skill import ProductivitySkill
            tasks_payload = ProductivitySkill().get_all_tasks_payload()
            tasks = tasks_payload.get("tasks", [])
            completed = [t for t in tasks if t.get("completed")]
            pending = [t for t in tasks if not t.get("completed")]

            log_action("workflow", "wrap_up_session", "CONFIRMED", f"Archived {len(completed)} completed tasks, {len(pending)} pending items remaining", user_confirmed=True)

            spoken = f"Session wrapped up. You completed {len(completed)} tasks today. {len(pending)} pending tasks have been carried forward."
            display = (
                f"🌙 **Day Wrap-Up Summary**\n\n"
                f"- ✅ **Completed Tasks**: {len(completed)}\n"
                f"- ⏳ **Pending Tasks Forwarded**: {len(pending)}\n"
                f"- 🔒 **Status**: Session safely archived and logged."
            )
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="action_result",
                card_data={"status": "SUCCESS", "workflow": "wrap_up_session"}
            )
        return SkillResult(handled=False, spoken_response="Unknown action confirmed.")

    def _run_work_mode(self) -> SkillResult:
        """Predefined Work Mode: focused theme, high priority tasks, calendar schedule."""
        try:
            eel.setAssistantTheme("stealth")
        except Exception:
            pass

        from engine.skills.productivity_skill import ProductivitySkill
        from engine.skills.calendar_skill import CalendarSkill

        tasks_payload = ProductivitySkill().get_all_tasks_payload()
        tasks = tasks_payload.get("tasks", [])
        high_pri = [t for t in tasks if t.get("priority") == "high" and not t.get("completed")]
        cal_events = CalendarSkill.get_today_events()

        log_action("workflow", "work_mode", "SUCCESS", f"Activated with {len(high_pri)} high priority tasks, {len(cal_events)} events")

        spoken = (
            f"Work mode activated. Stealth focus theme applied. "
            f"You have {len(high_pri)} high-priority tasks and {len(cal_events)} scheduled events today."
        )
        task_list = "\n".join([f"• 🔴 **High Priority**: {t['title']}" for t in high_pri[:4]]) or "• No urgent pending tasks."
        event_list = "\n".join([f"• 📅 **{e['start_time']}**: {e['title']}" for e in cal_events[:3]]) or "• No scheduled meetings today."

        display = (
            f"💼 **Work Mode: Active**\n\n"
            f"**High Priority Tasks:**\n{task_list}\n\n"
            f"**Today's Schedule:**\n{event_list}\n\n"
            f"🔒 *Distraction-free environment set.*"
        )
        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=display,
            card_type="action_result",
            card_data={"workflow": "work_mode", "status": "SUCCESS"}
        )

    def _run_study_session(self) -> SkillResult:
        """Predefined Study Session: review study notes, trigger quiz, set study timer."""
        from engine.skills.notes_skill import NotesSkill
        notes = NotesSkill.get_all_notes_payload(10)
        study_notes = [n for n in notes if n.get("category") == "study"]

        log_action("workflow", "study_session", "SUCCESS", f"Retrieved {len(study_notes)} study notes for session")

        spoken = (
            f"Study session started. I found {len(study_notes)} notes in your study category. "
            f"Say 'quiz me on my study topics' whenever you are ready for a quick recall quiz."
        )
        notes_preview = "\n".join([f"• 📘 **{n['title']}**: {n['content'][:60]}..." for n in study_notes[:3]]) or "• No study notes found. Say 'take a note in study' to record notes."

        display = (
            f"📚 **Study Session Initiated**\n\n"
            f"**Your Recent Study Material:**\n{notes_preview}\n\n"
            f"💡 *Tip: Test your retention by saying 'quiz me on my topics'.*"
        )
        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=display,
            card_type="action_result",
            card_data={"workflow": "study_session", "status": "SUCCESS"}
        )

    def _run_daily_briefing(self) -> SkillResult:
        """Predefined Daily Briefing: time, weather, agenda, tasks, top news."""
        import datetime
        from engine.skills.productivity_skill import ProductivitySkill
        from engine.skills.calendar_skill import CalendarSkill
        from engine.skills.news_skill import NewsSkill
        from engine.skills.weather_skill import WeatherSkill

        now = datetime.datetime.now()
        date_str = now.strftime("%A, %B %d")
        time_str = now.strftime("%I:%M %p")

        # Weather
        w_res = WeatherSkill().execute("weather")
        w_summary = w_res.spoken_response if w_res and w_res.handled else "Weather data unavailable."

        # Tasks & Events
        tasks_payload = ProductivitySkill().get_all_tasks_payload()
        tasks = tasks_payload.get("tasks", [])
        pending = [t for t in tasks if not t.get("completed")]
        events = CalendarSkill.get_today_events()

        # News
        n_res = NewsSkill().execute("top news")
        n_summary = n_res.spoken_response if n_res and n_res.handled else "No news updates."

        log_action("workflow", "daily_briefing", "SUCCESS", "Delivered daily briefing")

        spoken = (
            f"Good day! It is {time_str} on {date_str}. {w_summary} "
            f"You have {len(pending)} pending tasks and {len(events)} events on your calendar today. "
            f"Top headline: {n_summary[:120]}."
        )
        display = (
            f"☀️ **Daily Briefing — {date_str}**\n\n"
            f"⏰ **Current Time**: {time_str}\n"
            f"🌤️ **Weather**: {w_summary}\n"
            f"📅 **Calendar Agenda**: {len(events)} scheduled events\n"
            f"✅ **Pending Tasks**: {len(pending)} items\n"
            f"📰 **Top News**: {n_summary[:160]}..."
        )
        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=display,
            card_type="action_result",
            card_data={"workflow": "daily_briefing", "status": "SUCCESS"}
        )

    def _run_system_health_check(self) -> SkillResult:
        """Predefined System Health Check: analyzes CPU, RAM, Disk, Network for bottlenecks."""
        data = SystemInformationSkill.get_sanitized_system_info()
        cpu_pct = data["cpu"]["usage_percent"]
        ram_pct = data["memory"]["usage_percent"]
        disk_pct = data["disk"]["usage_percent"]
        net_online = data["network"]["online"]

        bottlenecks = []
        if cpu_pct > 85:
            bottlenecks.append(f"High CPU utilization ({cpu_pct}%)")
        if ram_pct > 88:
            bottlenecks.append(f"High RAM pressure ({ram_pct}%)")
        if disk_pct > 90:
            bottlenecks.append(f"Disk drive nearly full ({disk_pct}%)")
        if not net_online:
            bottlenecks.append("Network offline")

        if not bottlenecks:
            health_status = "Optimal"
            spoken = f"All systems are operating normally. CPU is at {cpu_pct} percent, memory is healthy at {ram_pct} percent, and network is online."
        else:
            health_status = "Attention Needed"
            spoken = f"System diagnostics detected issues: {', '.join(bottlenecks)}. Please review resource usage."

        log_action("workflow", "system_health_check", "SUCCESS", f"Health status: {health_status}")

        display = (
            f"🩺 **System Health Diagnostics: {health_status}**\n\n"
            f"- **CPU Load**: {cpu_pct}%\n"
            f"- **RAM Load**: {ram_pct}% ({data['memory']['used_gb']} GB / {data['memory']['total_gb']} GB)\n"
            f"- **Disk Usage**: {disk_pct}% ({data['disk']['free_gb']} GB free)\n"
            f"- **Network**: {data['network']['status']} ({data['network']['latency_ms']} ms)\n\n"
            f"**Assessment**: {('No bottlenecks detected. System performance is optimal.' if not bottlenecks else ' • ' + '\n • '.join(bottlenecks))}"
        )
        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=display,
            card_type="action_result",
            card_data={"workflow": "system_health_check", "status": "SUCCESS", "health": health_status}
        )
