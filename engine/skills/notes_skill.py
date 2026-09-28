import os
import re
import sqlite3
from typing import Optional, Dict, Any, List
from engine.skills.base_skill import BaseSkill, SkillResult

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "sophia.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_notes_table():
    with get_db() as conn:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(notes)").fetchall()]
        if not cols:
            conn.execute("""
                CREATE TABLE notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    note_text TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        else:
            if "title" not in cols:
                conn.execute("ALTER TABLE notes ADD COLUMN title TEXT DEFAULT ''")
            if "content" not in cols:
                conn.execute("ALTER TABLE notes ADD COLUMN content TEXT DEFAULT ''")
                conn.execute("UPDATE notes SET content = note_text WHERE (content IS NULL OR content = '') AND note_text IS NOT NULL")
            if "note_text" not in cols:
                conn.execute("ALTER TABLE notes ADD COLUMN note_text TEXT DEFAULT ''")
            if "category" not in cols:
                conn.execute("ALTER TABLE notes ADD COLUMN category TEXT DEFAULT 'general'")
            if "updated_at" not in cols:
                conn.execute("ALTER TABLE notes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        conn.commit()

init_notes_table()

class NotesSkill(BaseSkill):
    name = "notes_skill"
    description = "Personal organization: create, find, edit, categorize, and search user notes."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        triggers = [
            "take a note", "take note", "save a note", "create a note", "new note", "add note",
            "jot down", "write down", "show notes", "my notes", "list notes", "find note", "search notes",
            "delete note", "remove note", "notes in",
            "note banao", "note likho", "note save karo", "notes dikhao", "mera note", "mere notes",
            "note dhundho", "note khojo", "note delete karo", "note hatao",
            "नोट बनाओ", "नोट लिखो", "नोट सहेजें", "नोट दिखाओ", "मेरे नोट", "नोट खोजो", "नोट हटाओ"
        ]
        return any(t in q for t in triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        from engine.language_detector import detect_language
        lang_info = detect_language(query)
        mode = lang_info["mode"]
        q = query.lower().strip()

        # 1. ADD / TAKE A NOTE
        add_triggers = [
            "take a note", "take note", "save a note", "create a note", "new note", "add note", "jot down", "write down",
            "note banao", "note likho", "note save karo", "नोट बनाओ", "नोट लिखो", "नोट सहेजें"
        ]
        if any(w in q for w in add_triggers):
            content = q
            for p in [
                "take a note that", "take a note saying", "take a note about", "take a note", "take note",
                "save a note", "create a note", "add note", "jot down", "write down",
                "note banao ki", "note banao", "note likho ki", "note likho", "note save karo",
                "नोट बनाओ कि", "नोट बनाओ", "नोट लिखो", "नोट सहेजें"
            ]:
                content = content.replace(p, "").strip()
            content = content.strip(':').strip()

            # Check category (e.g., "in study", "category work")
            category = "general"
            m_cat = re.search(r'\b(?:in|under|category)\s+(work|study|ideas?|personal|project)\b', content)
            if m_cat:
                category = m_cat.group(1).rstrip('s')
                content = content.replace(m_cat.group(0), "").strip()

            title = content[:32] + "..." if len(content) > 32 else (content or "Quick Note")
            if not content:
                if mode == "hindi_devanagari":
                    spoken = "आप नोट में क्या लिखना चाहते हैं?"
                    disp = "कृपया नोट की सामग्री बताएं।"
                elif mode == "hinglish":
                    spoken = "Aap note me kya likhna chahte hain?"
                    disp = "Note ka content batayein."
                else:
                    spoken = "What would you like me to write in your note?"
                    disp = "Please provide the note content."
                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    display_text=disp
                )

            with get_db() as conn:
                cur = conn.cursor()
                cur.execute("INSERT INTO notes (title, content, category, note_text) VALUES (?, ?, ?, ?)", (title, content, category, content))
                conn.commit()
                note_id = cur.lastrowid

            if mode == "hindi_devanagari":
                spoken = f"नोट सहेज लिया गया ({category}): '{title}'।"
            elif mode == "hinglish":
                spoken = f"Note save ho gaya ({category}): '{title}'."
            else:
                spoken = f"Note saved under {category}: '{title}'."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=f"📝 Note #{note_id} ({category}): {content}",
                card_type="note",
                card_data={"id": note_id, "title": title, "content": content, "category": category}
            )

        # 2. SEARCH / FIND NOTES
        if any(w in q for w in ["find note", "search note", "note dhundho", "note khojo", "नोट खोजो"]):
            term = re.sub(r'\b(?:find|search|look for|notes?|about|dhundho|khojo|खोजो)\b', '', q).strip(': ').strip()
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC LIMIT 5", (f"%{term}%", f"%{term}%"))
                rows = [dict(r) for r in cur.fetchall()]

            if not rows:
                if mode == "hindi_devanagari":
                    spoken = f"'{term}' से संबंधित कोई नोट नहीं मिला।"
                    disp = f"'{term}' के लिए कोई नोट नहीं मिला।"
                elif mode == "hinglish":
                    spoken = f"'{term}' se related koi note nahi mila."
                    disp = f"No notes found for '{term}'."
                else:
                    spoken = f"I couldn't find any notes matching '{term}'."
                    disp = f"No notes found for '{term}'."
                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    display_text=disp
                )

            if mode == "hindi_devanagari":
                spoken = f"{len(rows)} नोट मिले। मुख्य नोट: {rows[0]['title']}।"
            elif mode == "hinglish":
                spoken = f"{len(rows)} notes mile. Top note: {rows[0]['title']}."
            else:
                spoken = f"Found {len(rows)} notes for {term}. Top note: {rows[0]['title']}."

            display = "\n\n".join([f"**Note #{r['id']} ({r['category']})**: {r['content']}" for r in rows])
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="notes_list",
                card_data={"notes": rows}
            )

        # 3. LIST ALL NOTES
        if any(w in q for w in ["my notes", "show notes", "list notes", "notes dikhao", "mere notes", "नोट दिखाओ", "मेरे नोट"]):
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute("SELECT * FROM notes ORDER BY id DESC LIMIT 5")
                rows = [dict(r) for r in cur.fetchall()]

            if not rows:
                if mode == "hindi_devanagari":
                    spoken = "आपके पास अभी कोई नोट नहीं है। नया नोट बनाने के लिए 'नोट बनाओ' कहें।"
                    disp = "कोई सहेजे गए नोट नहीं मिले।"
                elif mode == "hinglish":
                    spoken = "Aapke paas abhi koi notes saved nahi hain. Naya note banane ke liye 'note banao' bolein."
                    disp = "No notes saved yet."
                else:
                    spoken = "You don't have any notes saved yet. Say 'take a note' to create one."
                    disp = "No notes saved yet."
                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    display_text=disp
                )

            if mode == "hindi_devanagari":
                spoken = f"आपके पास {len(rows)} नोट्स हैं। हालिया नोट: {rows[0]['title']}।"
            elif mode == "hinglish":
                spoken = f"Aapke paas {len(rows)} saved notes hain. Recent note: {rows[0]['title']}."
            else:
                spoken = f"You have {len(rows)} saved notes. Recent note: {rows[0]['title']}."

            display = "\n\n".join([f"**#{r['id']} [{r['category']}]**: {r['content']}" for r in rows])
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="notes_list",
                card_data={"notes": rows}
            )

        # 4. DELETE NOTE
        m_del = re.search(r'(?:delete|remove|hatao)\s+note\s+(\d+)', q)
        if m_del:
            nid = int(m_del.group(1))
            with get_db() as conn:
                conn.execute("DELETE FROM notes WHERE id = ?", (nid,))
                conn.commit()
            if mode == "hindi_devanagari":
                spoken = f"नोट #{nid} हटा दिया गया है।"
            elif mode == "hinglish":
                spoken = f"Note #{nid} delete kar diya gaya hai."
            else:
                spoken = f"Note #{nid} has been deleted."
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=f"Note #{nid} deleted."
            )

        return SkillResult(handled=False, spoken_response="")

    @staticmethod
    def get_all_notes_payload(limit=20) -> List[Dict[str, Any]]:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM notes ORDER BY id DESC LIMIT ?", (limit,))
            notes = []
            for r in cur.fetchall():
                d = dict(r)
                content = d.get('content') or d.get('note_text') or ""
                title = d.get('title') or ((content[:30] + '...') if len(content) > 30 else (content or "Quick Note"))
                d['content'] = content
                d['title'] = title
                d['category'] = d.get('category') or 'general'
                notes.append(d)
            return notes
