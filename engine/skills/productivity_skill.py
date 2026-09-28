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

def init_productivity_tables():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                priority TEXT DEFAULT 'medium',
                due_date TEXT,
                category TEXT DEFAULT 'general',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        for col, col_type in [("priority", "TEXT DEFAULT 'medium'"), ("due_date", "TEXT"), ("category", "TEXT DEFAULT 'general'")]:
            try:
                cursor.execute(f"ALTER TABLE tasks ADD COLUMN {col} {col_type}")
            except Exception:
                pass

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reminder_text TEXT NOT NULL,
                remind_at TEXT,
                recurrence TEXT DEFAULT 'none',
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            cursor.execute("ALTER TABLE reminders ADD COLUMN recurrence TEXT DEFAULT 'none'")
        except Exception:
            pass
        conn.commit()

init_productivity_tables()

class ProductivitySkill(BaseSkill):
    name = "productivity_skill"
    description = "Advanced Task & Reminder Management: priorities, due dates, recurring reminders, filtering, and deletion safeguards."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        if re.search(r'\b(add|create|new|my|show|list|get|delete|remove|clear|complete|finish|search|filter)\b.*\btasks?\b', q):
            return True
        if re.search(r'\b(remind\s+me|set\s+reminder|new\s+reminder|show\s+reminders|my\s+reminders|clear\s+reminders)\b', q):
            return True
        return False

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # 1. ADD TASK (with priority and due date)
        if re.search(r'\b(add|create|new)\b.*\btasks?\b', q):
            # Priority extraction
            priority = "medium"
            if "high priority" in q or "urgent" in q:
                priority = "high"
            elif "low priority" in q:
                priority = "low"

            raw = re.sub(r'^(?:please\s+)?(?:add|create|new)\s+(?:a\s+)?(?:(?:high|medium|low)\s+priority\s+|urgent\s+)?tasks?\s+(?:to\s+|that\s+)?', '', q).strip()

            # Due date extraction (e.g. "due tomorrow at 5pm", "due Friday")
            due_date = ""
            m_due = re.search(r'\bdue\s+(.+)$', raw)
            if m_due:
                due_date = m_due.group(1).strip()
                raw = raw[:m_due.start()].strip()

            task_title = raw.strip(': ').strip()
            for w in ["to", "that", "saying"]:
                if task_title.startswith(w + " "):
                    task_title = task_title[len(w)+1:].strip()

            if not task_title:
                task_title = "New Task"

            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO tasks (title, completed, priority, due_date) VALUES (?, 0, ?, ?)",
                    (task_title, priority, due_date or None)
                )
                conn.commit()
                new_id = cur.lastrowid

            due_info = f" due {due_date}" if due_date else ""
            spoken = f"Added {priority} priority task: '{task_title}'{due_info}."
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=f"Task #{new_id} [{priority.upper()}]: {task_title}{due_info}",
                card_type="task",
                card_data=self.get_all_tasks_payload()
            )

        # 2. FILTER / SEARCH TASKS
        if any(w in q for w in ["high priority", "completed tasks", "pending tasks", "search tasks", "filter tasks"]):
            tasks = self._get_all_tasks()
            if "high priority" in q:
                filtered = [t for t in tasks if t['priority'] == 'high']
                label = "high priority"
            elif "completed" in q:
                filtered = [t for t in tasks if t['completed']]
                label = "completed"
            elif "pending" in q:
                filtered = [t for t in tasks if not t['completed']]
                label = "pending"
            else:
                filtered = tasks
                label = "all"

            if not filtered:
                return SkillResult(
                    handled=True,
                    spoken_response=f"You have no {label} tasks.",
                    display_text=f"No {label} tasks found.",
                    card_type="task",
                    card_data=self.get_all_tasks_payload()
                )

            spoken = f"You have {len(filtered)} {label} tasks. First one: {filtered[0]['title']}."
            display = "\n".join([f"• #{t['id']} [{t['priority'].upper()}]: {t['title']} ({'done' if t['completed'] else 'pending'})" for t in filtered])
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="task",
                card_data=self.get_all_tasks_payload()
            )

        # 3. LIST ALL TASKS
        if any(w in q for w in ["my tasks", "show tasks", "list tasks", "get tasks", "task list"]):
            tasks = self._get_all_tasks()
            if not tasks:
                return SkillResult(
                    handled=True,
                    spoken_response="Your task list is empty. You can say 'add task' to create one.",
                    display_text="No tasks recorded.",
                    card_type="task",
                    card_data=self.get_all_tasks_payload()
                )
            spoken = f"You have {len(tasks)} tasks. Top task: {tasks[0]['title']} with {tasks[0]['priority']} priority."
            display = "\n".join([f"• #{t['id']} [{t['priority'].upper()}]: {t['title']} ({'done' if t['completed'] else 'pending'})" for t in tasks[:5]])
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="task",
                card_data=self.get_all_tasks_payload()
            )

        # 4. COMPLETE TASK
        m_comp = re.search(r'(?:complete|finish|check off)\s+task\s+(\d+)', q)
        if m_comp:
            tid = int(m_comp.group(1))
            with get_db() as conn:
                conn.execute("UPDATE tasks SET completed = 1 WHERE id = ?", (tid,))
                conn.commit()
            return SkillResult(
                handled=True,
                spoken_response=f"Task #{tid} has been marked as complete!",
                display_text=f"Task #{tid} marked complete.",
                card_type="task",
                card_data=self.get_all_tasks_payload()
            )

        # 5. DELETE TASK WITH SAFEGUARD
        m_del = re.search(r'(?:delete|remove)\s+task\s+(\d+)', q)
        if m_del:
            tid = int(m_del.group(1))
            return SkillResult(
                handled=True,
                spoken_response=f"Are you sure you want to permanently delete task number {tid}? Please say yes to confirm or no to cancel.",
                display_text=f"Delete task #{tid}? Confirmation required.",
                requires_confirmation=True,
                confirmation_prompt=f"Are you sure you want to delete task #{tid}?",
                confirmation_action_id=f"delete_task:{tid}"
            )

        # 6. RECURRING & STANDARD REMINDERS
        if any(w in q for w in ["remind me", "set reminder", "new reminder"]):
            rem_text = q
            for p in ["remind me to", "remind me", "set a reminder to", "set reminder to", "set reminder"]:
                rem_text = rem_text.replace(p, "").strip()

            recurrence = "none"
            if "daily" in rem_text or "every day" in rem_text:
                recurrence = "daily"
            elif "weekly" in rem_text or "every week" in rem_text:
                recurrence = "weekly"

            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO reminders (reminder_text, recurrence) VALUES (?, ?)",
                    (rem_text, recurrence)
                )
                conn.commit()
                rid = cur.lastrowid

            rec_info = f" recurring {recurrence}" if recurrence != "none" else ""
            return SkillResult(
                handled=True,
                spoken_response=f"Reminder set{rec_info}: '{rem_text}'.",
                display_text=f"⏰ Reminder #{rid}{rec_info}: {rem_text}",
                card_type="reminder",
                card_data={"id": rid, "text": rem_text, "recurrence": recurrence}
            )

        # 7. SHOW REMINDERS
        if any(w in q for w in ["my reminders", "show reminders", "list reminders"]):
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM reminders WHERE status = 'pending' ORDER BY id DESC LIMIT 5")
                rems = [dict(r) for r in cur.fetchall()]

            if not rems:
                return SkillResult(
                    handled=True,
                    spoken_response="You have no pending reminders.",
                    display_text="No pending reminders."
                )

            spoken = f"You have {len(rems)} pending reminder{'s' if len(rems)>1 else ''}: " + ", ".join([r['reminder_text'] for r in rems])
            display = "\n".join([f"⏰ #{r['id']} ({r.get('recurrence', 'none')}): {r['reminder_text']}" for r in rems])
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="reminders_list",
                card_data={"reminders": rems}
            )

        return SkillResult(handled=False, spoken_response="")

    def confirm(self, action_id: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        if action_id.startswith("delete_task:"):
            tid = int(action_id.split(":")[1])
            with get_db() as conn:
                conn.execute("DELETE FROM tasks WHERE id = ?", (tid,))
                conn.commit()
            return SkillResult(
                handled=True,
                spoken_response=f"Task #{tid} has been deleted.",
                display_text=f"Task #{tid} deleted.",
                card_type="task",
                card_data=self.get_all_tasks_payload()
            )
        return SkillResult(handled=False, spoken_response="No action to confirm.")

    def _get_all_tasks(self) -> List[Dict[str, Any]]:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM tasks ORDER BY id DESC")
            return [dict(r) for r in cur.fetchall()]

    def get_all_tasks_payload(self) -> Dict[str, Any]:
        tasks = self._get_all_tasks()
        return {
            "total": len(tasks),
            "completed": sum(1 for t in tasks if t['completed']),
            "pending": sum(1 for t in tasks if not t['completed']),
            "tasks": tasks
        }
