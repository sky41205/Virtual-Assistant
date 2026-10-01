import os
import re
import io
import time
import asyncio
import sqlite3
import pyttsx3
import speech_recognition as sr
import eel
import pygame
import edge_tts

from engine.config import (
    get_assistant_name,
    get_assistant_config,
    reset_default_config,
    save_assistant_config
)
from engine.logger import (
    get_logger,
    get_recent_logs,
    clear_memory_logs,
    get_system_health
)

logger = get_logger("command")
speech_logger = get_logger("speech")
tts_logger = get_logger("tts")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sophia.db")

def init_history_table():
    """Ensure command_history table exists in database."""
    try:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS command_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    command TEXT NOT NULL,
                    response TEXT,
                    source TEXT DEFAULT 'chat',
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
    except Exception as e:
        print(f"History table init error: {e}")

init_history_table()

def log_command_history(command: str, response: str = "", source: str = "chat"):
    """Record command and response into history."""
    if not command or not str(command).strip():
        return
    try:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO command_history (command, response, source)
                VALUES (?, ?, ?)
            """, (str(command).strip(), str(response or "").strip(), source))
            conn.commit()
    except Exception as e:
        print(f"Log history error: {e}")

# Initialize pygame mixer once
try:
    if not pygame.mixer.get_init():
        pygame.mixer.init()
except Exception as e:
    print(f"Mixer init note: {e}")

import threading

_speech_generation = 0
_speech_lock = threading.Lock()

def stop_speech():
    """Immediately halt any playing TTS audio and cancel active speech sessions."""
    global _speech_generation
    with _speech_lock:
        _speech_generation += 1
    try:
        if pygame.mixer.get_init():
            pygame.mixer.music.stop()
    except Exception:
        pass
    try:
        eel.SetSpeakingState(False)
    except Exception:
        pass

# Expanded Hinglish vocabulary markers for natural language routing
HINGLISH_MARKERS = {
    'kya', 'hai', 'hain', 'kaise', 'kaisa', 'kaisi', 'karo', 'karna', 'kariye',
    'batao', 'bataiye', 'mujhe', 'mera', 'meri', 'mere', 'aaj', 'kal', 'namaste',
    'shukriya', 'dhanyawad', 'dhanyavad', 'haan', 'nahin', 'nahi', 'theek',
    'accha', 'achha', 'achhi', 'chalo', 'kholo', 'bajao', 'laga', 'do', 'sunao',
    'sunaiye', 'aap', 'aapka', 'aapki', 'aapke', 'tum', 'tumhara', 'tumhari',
    'hum', 'hoga', 'hogi', 'honge', 'raha', 'rahi', 'rahe', 'kuch', 'kuchh',
    'bahut', 'zara', 'thoda', 'ruk', 'ruko', 'bolo', 'baat', 'sab', 'sabko',
    'kaam', 'samay', 'waqt', 'din', 'raat', 'subah', 'shaam', 'dost'
}

from engine.language_detector import detect_language, is_hindi_or_hinglish

def has_hindi(text: str, query: str = "") -> bool:
    """
    Check if text contains Devanagari Hindi characters or Hinglish vocabulary markers.
    """
    if not text and not query:
        return False
    combined = f"{text or ''} {query or ''}".strip()
    return is_hindi_or_hinglish(combined)

def sanitize_speech_text(text: str, is_hindi: bool = False) -> str:
    """
    Sanitize text prior to TTS synthesis:
    - Strips emojis and pictographs so Edge-TTS does not pronounce literal symbol names.
    - Strips markdown formatting (*, _, #, ~, `, >).
    - Cleans URLs and links.
    - Translates currency symbols (₹ to 'rupees' or 'रुपये', $ to 'dollars').
    - Normalizes bullet points and excessive whitespace.
    """
    if not text:
        return ""

    t = str(text)

    # 1. Convert currencies
    if is_hindi:
        t = re.sub(r'₹\s*(\d+(?:\.\d+)?)', r'\1 रुपये', t)
        t = t.replace('₹', 'रुपये ')
        t = t.replace('$', 'डॉलर ')
    else:
        t = re.sub(r'₹\s*(\d+(?:\.\d+)?)', r'\1 rupees', t)
        t = t.replace('₹', 'rupees ')
        t = t.replace('$', 'dollars ')

    # 2. Strip URLs: [Text](URL) -> Text; https://... -> link
    t = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', t)
    t = re.sub(r'https?://\S+', 'link', t)

    # 3. Strip emojis and pictographs
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U0001F900-\U0001F9FF"  # supplemental symbols
        "\U0001FA00-\U0001FA6F"  # chess symbols
        "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-a
        "\U00002702-\U000027B0"  # Dingbats
        "\U000024C2-\U0001F251"
        "\U00002600-\U000026FF"  # Misc symbols
        "]+", flags=re.UNICODE
    )
    t = emoji_pattern.sub('', t)

    # 4. Strip markdown formatting
    t = re.sub(r'```[\s\S]*?```', '', t)    # remove full code blocks from speech
    t = re.sub(r'`([^`]+)`', r'\1', t)      # inline code
    t = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', t) # bold / italic
    t = re.sub(r'_{1,3}([^_]+)_{1,3}', r'\1', t)   # bold / italic underline
    t = re.sub(r'~~([^~]+)~~', r'\1', t)    # strikethrough
    t = re.sub(r'^\s*#{1,6}\s*', '', t, flags=re.MULTILINE) # headers
    t = re.sub(r'^\s*[-*•▪▫]\s*', '', t, flags=re.MULTILINE) # bullets

    # 5. Collapse excessive whitespace and linebreaks into clean pauses
    t = re.sub(r'[\r\n]+', '. ', t)
    t = re.sub(r'\s{2,}', ' ', t).strip()

    return t

async def _synthesize_edge_tts(text: str, voice: str, rate: str = "+0%") -> bytes:
    """Stream audio bytes directly from edge-tts with precise rate control."""
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    chunks = []
    async for chunk in communicate.stream():
        if chunk['type'] == 'audio':
            chunks.append(chunk['data'])
    return b''.join(chunks)

def _play_audio_bytes(audio_bytes: bytes, generation: int = None):
    """Play audio in-memory using pygame.mixer safely without starving Eel, preemptible by new speech."""
    if not audio_bytes:
        return
    if not pygame.mixer.get_init():
        pygame.mixer.init()
    
    # Check if this speech session is already preempted
    if generation is not None and generation != _speech_generation:
        return

    # Stop any prior audio
    pygame.mixer.music.stop()
    
    audio_stream = io.BytesIO(audio_bytes)
    pygame.mixer.music.load(audio_stream)
    pygame.mixer.music.play()
    
    start_time = time.time()
    while pygame.mixer.music.get_busy() and (time.time() - start_time < 30):
        # Preempt if a newer speech command arrived or stop_speech() called
        if generation is not None and generation != _speech_generation:
            pygame.mixer.music.stop()
            break
        pygame.time.Clock().tick(20)
        try:
            eel.sleep(0.02)
        except Exception:
            pass

def speak(text, voice_index=None, rate=None, volume=None):
    """
    Non-blocking bilingual voice output — runs TTS synthesis in a daemon thread
    so the UI card and response appear instantly without waiting for audio.
    Uses Microsoft Neural TTS with preemption and Edge-TTS clarity.
    """
    if not text:
        return

    def _do_speak():
        # Immediately stop and invalidate any previous speech
        stop_speech()

        # Capture current generation
        with _speech_lock:
            gen = _speech_generation

        try:
            eel.DisplayMessage(text)
            eel.SetSpeakingState(True)
        except Exception:
            pass

        # Determine language & voice with strict script & phonetic detection
        lang_info = detect_language(text)
        is_hi = lang_info["mode"] in ("hindi_devanagari", "hinglish")
        from engine.config import TTS_HINDI_VOICE, TTS_ENGLISH_VOICE, VOICE_INDEX, VOICE_RATE, VOICE_VOLUME
        
        primary_voice = (TTS_HINDI_VOICE or 'hi-IN-SwaraNeural') if is_hi else (TTS_ENGLISH_VOICE or 'en-IN-NeerjaNeural')
        if is_hi:
            secondary_voice = 'hi-IN-MadhurNeural' if primary_voice == 'hi-IN-SwaraNeural' else 'hi-IN-SwaraNeural'
        else:
            secondary_voice = 'en-IN-PrabhatNeural' if primary_voice == 'en-IN-NeerjaNeural' else 'en-US-JennyNeural'

        # Sanitize spoken text so emojis and markdown asterisks aren't read aloud
        spoken_text = sanitize_speech_text(text, is_hi)
        if not spoken_text:
            return

        speech_rate = "-2%" if is_hi else "+0%"

        # Try high-fidelity Neural TTS with dual-voice fallback
        for voice_candidate in [primary_voice, secondary_voice]:
            if gen != _speech_generation:
                return
            try:
                audio_data = asyncio.run(_synthesize_edge_tts(spoken_text, voice_candidate, rate=speech_rate))
                if gen != _speech_generation:
                    return
                if audio_data:
                    _play_audio_bytes(audio_data, gen)
                    if gen == _speech_generation:
                        try:
                            eel.SetSpeakingState(False)
                        except Exception:
                            pass
                    return
            except Exception as edge_err:
                tts_logger.warning(f"Neural TTS voice ({voice_candidate}) fallback notice: {edge_err}")

        # Fallback to local SAPI5 (pyttsx3)
        if gen != _speech_generation:
            return
        try:
            from engine.config import VOICE_INDEX, VOICE_RATE, VOICE_VOLUME
            # Check if text contains Devanagari script: SAPI5 on English Windows lacks Hindi phonemes
            if re.search(r'[\u0900-\u097F]', spoken_text):
                tts_logger.warning("SAPI5 local engine does not support Devanagari script; skipping local fallback.")
                return

            engine = pyttsx3.init()
            voices = engine.getProperty('voices')
            v_idx = voice_index if voice_index is not None else VOICE_INDEX
            r = rate if rate is not None else VOICE_RATE
            vol = volume if volume is not None else VOICE_VOLUME

            if voices and len(voices) > 0:
                chosen_idx = max(0, min(int(v_idx), len(voices) - 1))
                engine.setProperty('voice', voices[chosen_idx].id)

            engine.setProperty('rate', int(r))
            engine.setProperty('volume', float(vol))

            engine.say(spoken_text)
            engine.runAndWait()
        except Exception as e:
            tts_logger.error(f"Error in pyttsx3 speak fallback: {e}")
        finally:
            if gen == _speech_generation:
                try:
                    eel.SetSpeakingState(False)
                except Exception:
                    pass

    # Launch TTS in background thread so UI responds instantly
    t = threading.Thread(target=_do_speak, daemon=True)
    t.start()



# ----------------- EEL EXPOSED API -----------------

@eel.expose
def detectLanguageMode(text):
    """Expose live bilingual language and script detection to Eel frontend."""
    from engine.language_detector import detect_language
    return detect_language(text or "")

@eel.expose
def getAvailableVoices():
    """Return available neural voices and system SAPI5 voices."""
    neural_voices = [
        {"id": "hi-IN-SwaraNeural", "name": "Hindi - Swara (Female Neural)", "lang": "hi-IN"},
        {"id": "hi-IN-MadhurNeural", "name": "Hindi - Madhur (Male Neural)", "lang": "hi-IN"},
        {"id": "en-IN-NeerjaNeural", "name": "Indian English - Neerja (Female Neural)", "lang": "en-IN"},
        {"id": "en-IN-PrabhatNeural", "name": "Indian English - Prabhat (Male Neural)", "lang": "en-IN"},
        {"id": "en-US-JennyNeural", "name": "US English - Jenny (Female Neural)", "lang": "en-US"},
        {"id": "en-US-GuyNeural", "name": "US English - Guy (Male Neural)", "lang": "en-US"}
    ]
    return neural_voices

@eel.expose
def getAssistantSettings():
    """Return all assistant customization settings dynamically."""
    return get_assistant_config()

@eel.expose
def resetDefaultSettings():
    """Reset all assistant settings to default baseline."""
    reset_default_config()
    return get_assistant_config()

@eel.expose
def resetAssistantState():
    """Immediately stop audio playback, clear speech, and restore main UI."""
    stop_speech()
    try:
        eel.ShowHood()
    except Exception:
        pass
    return True

@eel.expose
def getCommandHistory(limit=50):
    """Retrieve command history items ordered by most recent."""
    try:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, command, response, source, timestamp 
                FROM command_history 
                ORDER BY id DESC LIMIT ?
            """, (int(limit),))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
    except Exception as e:
        print(f"Get history error: {e}")
        return []

@eel.expose
def clearCommandHistory():
    """Clear all command history entries."""
    try:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM command_history")
            conn.commit()
            return True
    except Exception as e:
        print(f"Clear history error: {e}")
        return False

@eel.expose
def deleteHistoryItem(item_id):
    """Delete a single command history entry."""
    try:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM command_history WHERE id = ?", (int(item_id),))
            conn.commit()
            return True
    except Exception as e:
        print(f"Delete history item error: {e}")
        return False

@eel.expose
def saveAssistantSettings(name, voice_index, rate, volume, theme, speech_lang=None, tts_hindi_voice=None, tts_english_voice=None):
    """Save all updated customization preferences."""
    success = save_assistant_config(
        name=name,
        voice_index=voice_index,
        rate=rate,
        volume=volume,
        theme=theme,
        speech_lang=speech_lang,
        tts_hindi_voice=tts_hindi_voice,
        tts_english_voice=tts_english_voice
    )
    return success

@eel.expose
def testVoice(voice_id="en-IN-NeerjaNeural", lang_type="english"):
    """Play a sample speech test for the selected neural voice."""
    curr_name = get_assistant_name()
    if lang_type == "hindi" or "hi-IN" in voice_id:
        sample_text = f"नमस्ते! मैं {curr_name} हूँ, और यह मेरी हिंदी आवाज़ है।"
    else:
        sample_text = f"Hello! I am {curr_name}, and this is how my voice sounds."
    
    try:
        audio = asyncio.run(_synthesize_edge_tts(sample_text, voice_id))
        _play_audio_bytes(audio)
    except Exception as e:
        print(f"Test voice error: {e}")
        speak(sample_text)

# ----------------- CONTACTS EEL API -----------------

@eel.expose
def getAllContacts():
    """Retrieve contacts list for UI."""
    from engine.communication import get_all_contacts
    return get_all_contacts()

@eel.expose
def saveContact(name, phone_no, email=""):
    """Save contact from UI."""
    from engine.communication import add_contact
    return add_contact(name, phone_no, email)

@eel.expose
def deleteContact(contact_id):
    """Delete contact from UI."""
    from engine.communication import delete_contact
    return delete_contact(contact_id)

# ----------------- DOCUMENT ANALYSIS EEL API -----------------

@eel.expose
def analyzeDocumentData(filename, b64_data, question=""):
    """Analyze document uploaded from UI file picker."""
    from engine.document_analyzer import analyze_document_base64
    res = analyze_document_base64(filename, b64_data, question)
    if res.get("spoken_summary"):
        speak(res["spoken_summary"])
    try:
        eel.ShowHood()
    except Exception:
        pass
    return res

@eel.expose
def analyzeDocumentPath(file_path, question=""):
    """Analyze document by local file path."""
    from engine.document_analyzer import analyze_document
    res = analyze_document(file_path, question)
    if res.get("spoken_summary"):
        speak(res["spoken_summary"])
    try:
        eel.ShowHood()
    except Exception:
        pass
    return res

# ----------------- JARVIS SKILLS EEL API -----------------

@eel.expose
def getSystemStatus():
    """Return live system telemetry: time, timezone, CPU, memory, battery, online status."""
    import psutil, datetime, os
    now = datetime.datetime.now()
    tz = os.getenv("ASSISTANT_TIMEZONE", "Asia/Kolkata")
    cpu = psutil.cpu_percent(interval=0.05)
    ram = psutil.virtual_memory().percent
    bat_pct = 100
    plugged = True
    try:
        bat = psutil.sensors_battery()
        if bat:
            bat_pct = bat.percent
            plugged = bat.power_plugged
    except Exception:
        pass
    return {
        "status": "ONLINE",
        "time": now.strftime("%I:%M:%S %p"),
        "date": now.strftime("%a, %b %d"),
        "timezone": tz,
        "cpu": cpu,
        "ram": ram,
        "battery": bat_pct,
        "plugged": plugged
    }

@eel.expose
def getTasks():
    """Return all tasks from productivity skill."""
    from engine.skills.productivity_skill import ProductivitySkill
    return ProductivitySkill().get_all_tasks_payload()

@eel.expose
def addTask(title):
    """Add a new task via Eel."""
    from engine.skills import get_skill_manager
    res = get_skill_manager().dispatch(f"add task {title}")
    return res.card_data

@eel.expose
def deleteTask(task_id):
    """Delete a task via Eel."""
    from engine.skills.productivity_skill import ProductivitySkill
    skill = ProductivitySkill()
    skill.confirm(f"delete_task:{task_id}")
    return skill.get_all_tasks_payload()

@eel.expose
def toggleTask(task_id):
    """Toggle task completion via Eel."""
    from engine.skills import get_skill_manager
    res = get_skill_manager().dispatch(f"complete task {task_id}")
    return res.card_data

@eel.expose
def confirmPendingAction(action_id, confirmed):
    """Handle user confirmation response from UI buttons or voice."""
    from engine.skills import get_skill_manager
    res = get_skill_manager().confirm_action(action_id, bool(confirmed))
    if res.spoken_response:
        speak(res.spoken_response)
        try:
            eel.AppendAIBubble(res.spoken_response)
        except Exception:
            pass
    return res.card_data

@eel.expose
def stopSpeechOutput():
    """Halt any speech immediately."""
    stop_speech()
    try:
        eel.SetSpeakingState(False)
    except Exception:
        pass
    return True

@eel.expose
def getLiveWeather(city=""):
    """Fetch real-time weather via Eel."""
    from engine.alexa_skills import get_live_weather
    return get_live_weather(city)

@eel.expose
def getSavedNotes():
    """Retrieve saved notes via Eel."""
    from engine.skills.notes_skill import NotesSkill
    return NotesSkill.get_all_notes_payload()

@eel.expose
def getNotes():
    """Retrieve structured notes list."""
    from engine.skills.notes_skill import NotesSkill
    return NotesSkill.get_all_notes_payload()

@eel.expose
def addNote(title, content, category="general"):
    """Create a new note with category."""
    from engine.skills.notes_skill import get_db, NotesSkill
    with get_db() as conn:
        conn.execute("INSERT INTO notes (title, content, category, note_text) VALUES (?, ?, ?, ?)", (title, content, category, content))
        conn.commit()
    return NotesSkill.get_all_notes_payload()

@eel.expose
def deleteNote(note_id):
    """Delete a note."""
    from engine.skills.notes_skill import get_db, NotesSkill
    with get_db() as conn:
        conn.execute("DELETE FROM notes WHERE id = ?", (int(note_id),))
        conn.commit()
    return NotesSkill.get_all_notes_payload()

@eel.expose
def searchNotes(query):
    """Search notes by term or category."""
    from engine.skills.notes_skill import get_db
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY id DESC LIMIT 10", (f"%{query}%", f"%{query}%"))
        return [dict(r) for r in cur.fetchall()]

@eel.expose
def getCalendarEvents():
    """Retrieve upcoming calendar events."""
    from engine.skills.calendar_skill import CalendarSkill
    return CalendarSkill.get_upcoming_events()

@eel.expose
def addCalendarEvent(title, start_time, location=""):
    """Schedule a new calendar event."""
    from engine.skills.calendar_skill import get_db, CalendarSkill
    with get_db() as conn:
        conn.execute("INSERT INTO calendar_events (title, start_time, location) VALUES (?, ?, ?)", (title, start_time, location))
        conn.commit()
    return CalendarSkill.get_upcoming_events()

@eel.expose
def deleteCalendarEvent(event_id):
    """Cancel a calendar event."""
    from engine.skills.calendar_skill import get_db, CalendarSkill
    with get_db() as conn:
        conn.execute("DELETE FROM calendar_events WHERE id = ?", (int(event_id),))
        conn.commit()
    return CalendarSkill.get_upcoming_events()

@eel.expose
def getWidgetData():
    """Bundle all dashboard widget data in a single call."""
    from engine.skills.datetime_skill import DateTimeSkill
    from engine.skills.productivity_skill import ProductivitySkill
    from engine.skills.notes_skill import NotesSkill
    from engine.skills.calendar_skill import CalendarSkill

    sys_status = getSystemStatus()
    world_clocks = DateTimeSkill.get_world_clocks()
    tasks_payload = ProductivitySkill().get_all_tasks_payload()
    notes_list = NotesSkill.get_all_notes_payload(limit=5)
    events_list = CalendarSkill.get_upcoming_events(limit=5)

    return {
        "system": sys_status,
        "world_clocks": world_clocks,
        "tasks": tasks_payload,
        "notes": notes_list,
        "calendar": events_list
    }

@eel.expose
def saveUIPreferences(theme_mode="dark", accent_color="cyan", font_size="medium", reduced_motion=False, widgets_pinned=None):
    """Save UI customization preferences to database."""
    try:
        import json
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS ui_preferences (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    theme_mode TEXT DEFAULT 'dark',
                    accent_color TEXT DEFAULT 'cyan',
                    font_size TEXT DEFAULT 'medium',
                    reduced_motion INTEGER DEFAULT 0,
                    widgets_pinned TEXT DEFAULT '[]'
                )
            """)
            conn.execute("""
                INSERT OR REPLACE INTO ui_preferences (id, theme_mode, accent_color, font_size, reduced_motion, widgets_pinned)
                VALUES (1, ?, ?, ?, ?, ?)
            """, (theme_mode, accent_color, font_size, int(reduced_motion), json.dumps(widgets_pinned or [])))
            conn.commit()
            return True
    except Exception as e:
        print(f"saveUIPreferences error: {e}")
        return False

@eel.expose
def getUIPreferences():
    """Load user's UI preferences."""
    try:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ui_preferences (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    theme_mode TEXT DEFAULT 'dark',
                    accent_color TEXT DEFAULT 'cyan',
                    font_size TEXT DEFAULT 'medium',
                    reduced_motion INTEGER DEFAULT 0,
                    widgets_pinned TEXT DEFAULT '[]'
                )
            """)
            cur.execute("SELECT * FROM ui_preferences WHERE id = 1")
            row = cur.fetchone()
            if row:
                import json
                d = dict(row)
                d['reduced_motion'] = bool(d.get('reduced_motion', 0))
                try:
                    d['widgets_pinned'] = json.loads(d.get('widgets_pinned') or '[]')
                except Exception:
                    d['widgets_pinned'] = []
                return d
    except Exception as e:
        print(f"getUIPreferences error: {e}")
    return {
        "theme_mode": "dark",
        "accent_color": "cyan",
        "font_size": "medium",
        "reduced_motion": False,
        "widgets_pinned": ["clock", "weather", "tasks", "notes", "calendar", "telemetry"],
        "shortcuts": {"mic": "Ctrl+M", "quickActions": "Ctrl+K", "dashboard": "Ctrl+W", "mute": "Escape"}
    }

@eel.expose
def getDetailedSystemInfo():
    """Return sanitized hardware and OS statistics."""
    from engine.skills.system_skill import SystemInformationSkill
    return SystemInformationSkill.get_sanitized_system_info()

@eel.expose
def getAuditLogs(limit=25):
    """Retrieve recent action audit log entries."""
    from engine.skills.automation_skill import get_recent_audit_logs
    return get_recent_audit_logs(int(limit))

@eel.expose
def runPredefinedWorkflow(workflow_name):
    """Run a safe predefined automation workflow (work_mode, study_session, daily_briefing, system_health_check, wrap_up_session)."""
    from engine.skills.automation_skill import SafeAutomationSkill
    skill = SafeAutomationSkill()
    res = skill.execute(workflow_name)
    if res and res.spoken_response:
        speak(res.spoken_response)
    return {
        "handled": res.handled if res else False,
        "spoken": res.spoken_response if res else "",
        "display": res.display_text if res else "",
        "card_type": res.card_type if res else "",
        "card_data": res.card_data if res else {},
        "requires_confirmation": res.requires_confirmation if res else False,
        "confirmation_action_id": res.confirmation_action_id if res else "",
        "confirmation_prompt": res.confirmation_prompt if res else ""
    }

@eel.expose
def confirmAction(action_id, confirmed):
    """Handle UI modal confirmation / cancellation callback."""
    from engine.skills.skill_manager import get_skill_manager
    res = get_skill_manager().confirm_action(action_id, bool(confirmed))
    if res and res.spoken_response:
        speak(res.spoken_response)
    return {
        "handled": res.handled if res else False,
        "spoken": res.spoken_response if res else "",
        "display": res.display_text if res else "",
        "card_type": res.card_type if res else "",
        "card_data": res.card_data if res else {}
    }


# ----------------- LOGGING & SYSTEM RELIABILITY EEL API -----------------

@eel.expose
def getLiveLogs(limit=50, level="ALL"):
    """Fetch live structured logs from the in-memory circular buffer for UI display."""
    return get_recent_logs(limit, level)

@eel.expose
def clearLiveLogs():
    """Clear all stored in-memory log entries."""
    return clear_memory_logs()

@eel.expose
def getDiagnosticHealth():
    """Run comprehensive system health diagnostics on microphone, TTS, AI, DB, and network."""
    return get_system_health()


# ----------------- SPEECH RECOGNITION -----------------

@eel.expose
def takeCommand():
    """Capture voice input from microphone with robust ambient calibration, clamped energy threshold, and multilingual fallback."""
    r = sr.Recognizer()
    r.dynamic_energy_threshold = True
    r.dynamic_energy_adjustment_damping = 0.15
    r.dynamic_energy_ratio = 1.5
    r.pause_threshold = 0.8          # Allows natural breathing and pauses (prevents mid-sentence cutoff)
    r.phrase_threshold = 0.3         # Minimum seconds of speaking to start a phrase
    r.non_speaking_duration = 0.5    # Non-speaking audio kept on both sides

    from engine.config import SPEECH_LANG
    primary_lang = SPEECH_LANG or 'en-IN'

    speech_logger.info(f"Initializing speech recognition cycle (primary_lang={primary_lang})...")

    try:
        with sr.Microphone() as source:
            speech_logger.info("Microphone open. Calibrating ambient noise...")
            try:
                eel.SetListeningState(True)
                eel.DisplayMessage('Listening... Speak now')
            except Exception:
                pass

            # Small sleep to let any UI click/tap sound settle before ambient calibration
            time.sleep(0.08)
            r.adjust_for_ambient_noise(source, duration=0.4)

            # Clamp energy threshold into a safe operational zone so neither silence nor loud clicks cause failure
            if r.energy_threshold < 150:
                r.energy_threshold = 150
            elif r.energy_threshold > 800:
                r.energy_threshold = 800

            speech_logger.info(f"Listening for speech (energy_threshold={r.energy_threshold:.1f})...")
            audio = r.listen(source, timeout=8, phrase_time_limit=12)

        speech_logger.info("Audio received. Transcribing speech...")
        try:
            eel.DisplayMessage('Recognizing your voice...')
        except Exception:
            pass

        # Multilingual candidate list: primary language, followed by Indian English, Hindi, US English
        candidates = [primary_lang]
        for lang_code in ['en-IN', 'hi-IN', 'en-US', 'hi']:
            if lang_code not in candidates:
                candidates.append(lang_code)

        query = ""
        for lang in candidates:
            try:
                query = r.recognize_google(audio, language=lang)
                if query and query.strip():
                    speech_logger.info(f"Voice recognized successfully with language '{lang}': '{query.strip()}'")
                    break
            except sr.UnknownValueError:
                continue
            except sr.RequestError as req_err:
                speech_logger.error(f"Google Speech Recognition service unreachable for {lang}: {req_err}")
                try:
                    eel.ShowErrorNotification("Voice Network Error", "Could not reach speech recognition servers. Please check your internet connection.", "network")
                except Exception:
                    pass
                break
            except Exception as e:
                speech_logger.debug(f"Candidate recognition error ({lang}): {e}")
                continue

        if not query:
            speech_logger.info("No speech detected or audio was unintelligible.")
            try:
                eel.SetListeningState(False)
                eel.DisplayMessage("Hi, how can i Help you ...")
            except Exception:
                pass
            return ""

        query_str = query.strip()
        speech_logger.info(f"Voice query processed: '{query_str}'")
        try:
            eel.ShowRecognizedText(query_str)
            eel.DisplayMessage(query_str)
            eel.SetListeningState(False)
        except Exception:
            pass
        return query_str

    except sr.WaitTimeoutError:
        speech_logger.info("Speech recognition timed out: no voice detected.")
        try:
            eel.SetListeningState(False)
            eel.DisplayMessage("Hi, how can i Help you ...")
        except Exception:
            pass
        return ""
    except Exception as e:
        speech_logger.error(f"Error during microphone recording: {e}", exc_info=True)
        try:
            eel.SetListeningState(False)
            eel.DisplayMessage("Hi, how can i Help you ...")
            eel.ShowErrorNotification("Microphone Error", f"Microphone error: {str(e)[:80]}. Try typing your command.", "mic")
        except Exception:
            pass
        return ""



# ----------------- COMMAND DISPATCHER -----------------

@eel.expose
def allCommands(message=1):
    """
    Main command routing engine.
    Handles voice or typed input, dispatches across automation skills, LLM, apps, and communication,
    and streams structured feedback, cards, logs, and error states directly to the user interface.
    """
    source = "voice" if message == 1 else "chat"
    stop_speech()
    query = ""
    start_time = time.time()

    try:
        if message == 1:
            try:
                eel.SetListeningState(True)
            except Exception:
                pass
            query = takeCommand()
            try:
                eel.SetListeningState(False)
            except Exception:
                pass
            if query:
                lang_res = detect_language(query)
                try:
                    eel.ShowRecognizedText(query)
                    eel.AppendUserBubble(query, "voice", lang_res.get("mode", "english"))
                except Exception:
                    pass
            else:
                try:
                    eel.ShowHood()
                    eel.UpdateAssistantState("idle", "Ready")
                except Exception:
                    pass
                return
        else:
            query = str(message).strip()
            lang_res = detect_language(query)
            try:
                eel.DisplayMessage(query)
                eel.AppendUserBubble(query, "chat", lang_res.get("mode", "english"))
            except Exception:
                pass

        if not query:
            return

        logger.info(f"Processing user command [{source.upper()}]: '{query}'")

        try:
            eel.UpdateAssistantState("processing", f"Processing: {query}")
        except Exception:
            pass

        q_lower = query.lower().strip()
        last_response = ""
        card_type = "none"
        card_data = {}
        status = "SUCCESS"
        display_text = ""

        # ── FAST PATH: pure conversational queries bypass all skill layers ──────
        # If the query contains no known action/command keywords, skip 6 handlers
        # and route directly to the LLM — saves 200-500ms per reply.
        _ACTION_KEYWORDS = {
            'open', 'kholo', 'launch', 'start', 'chalao', 'close', 'play', 'bajao',
            'search', 'find', 'whatsapp', 'call', 'email', 'send', 'volume', 'mute',
            'screenshot', 'shutdown', 'restart', 'sleep', 'task', 'note', 'remind',
            'calendar', 'weather', 'time', 'date', 'battery', 'cpu', 'youtube',
            'analyze', 'summarize', 'document', 'file', 'news', 'calculate', 'convert',
            'timer', 'alarm', 'dracarys', 'google', 'wikipedia', 'translate',
        }
        is_conversational = not any(kw in q_lower for kw in _ACTION_KEYWORDS)

        if is_conversational:
            try:
                from engine.llm import ask_dracarys
                fast_response = ask_dracarys(query)
                if fast_response:
                    lang_mode = lang_res.get("mode", "english")
                    speak(fast_response)
                    log_command_history(query, fast_response, source)
                    try:
                        eel.AppendAIBubble(fast_response, "chat_response", {}, "SUCCESS", lang_mode)
                    except Exception:
                        pass
                    logger.info(f"Fast-path LLM response in {round((time.time()-start_time)*1000,1)}ms")
                    return
            except Exception as fast_err:
                logger.warning(f"Fast-path LLM error, falling through to handlers: {fast_err}")
        # ── END FAST PATH ────────────────────────────────────────────────────────

        # 1. Communication actions (WhatsApp, Phone Call, Contacts, Facebook)
        try:
            from engine.communication import handle_communication_command
            handled, comm_resp = handle_communication_command(query)
            if handled:
                last_response = comm_resp or "Communication action completed."
                card_type = "action_result"
                card_data = {"action": "communication", "status": "SUCCESS"}
                status = "ACTION"
                speak(last_response)
                log_command_history(query, last_response, source)
                try:
                    eel.AppendAIBubble(last_response, card_type, card_data, status)
                except Exception:
                    pass
                logger.info(f"Communication command completed in {round((time.time() - start_time) * 1000, 1)}ms")
                return
        except Exception as ce:
            logger.error(f"Communication handler error: {ce}", exc_info=True)

        # 2. Document Analysis & Summarization Commands
        doc_keywords = [
            'analyze document', 'summarize document', 'analyze file', 'summarize file',
            'document summary', 'read file', 'summarize report', 'document analyze karo',
            'file summarize karo', 'file ka summary', 'document ka summary'
        ]
        if any(k in q_lower for k in doc_keywords):
            try:
                from engine.document_analyzer import resolve_document_path, analyze_document
                target = q_lower
                for k in doc_keywords:
                    target = target.replace(k, "")
                for w in ["please", "dracarys", "can you", "karo", "do", "the", "my", "sophia"]:
                    target = re.sub(rf'\b{w}\b', '', target).strip()
                target = target.strip(': ').strip()

                resolved = resolve_document_path(target) if target else ""
                if resolved and os.path.exists(resolved):
                    doc_name = os.path.basename(resolved)
                    eel.DisplayMessage(f"Analyzing {doc_name}...")
                    res = analyze_document(resolved)
                    if res.get("success"):
                        last_response = res.get("spoken_summary", f"Finished analyzing {doc_name}.")
                        card_type = "document_summary"
                        card_data = res
                        try:
                            eel.ShowDocumentResult(res["filename"], res["summary_text"])
                        except Exception:
                            pass
                    else:
                        last_response = res.get("spoken_summary", f"Could not analyze {doc_name}.")
                        status = "ERROR"
                    speak(last_response)
                    log_command_history(query, last_response, source)
                    try:
                        eel.AppendAIBubble(last_response, card_type, card_data, status)
                    except Exception:
                        pass
                    return
                elif target:
                    last_response = f"I couldn't locate the document {target}. You can click the paperclip icon to upload and analyze it directly."
                    speak(last_response)
                    log_command_history(query, last_response, source)
                    try:
                        eel.AppendAIBubble(last_response, "info", {}, "SUCCESS")
                    except Exception:
                        pass
                    return
            except Exception as de:
                logger.error(f"Document analysis error: {de}", exc_info=True)

        # 3. Universal Opener (desktop apps, folders, drives, files, settings, websites, browser)
        if any(w in q_lower for w in ['open', 'kholo', 'launch', 'start', 'chalao', 'खोलो', 'चलाओ']):
            try:
                from engine.features import openCommand
                opened_msg = openCommand(query)
                lang_mode = lang_res.get("mode", "english")
                if lang_mode == "hindi_devanagari":
                    disp = f"{query} खोला जा रहा है"
                elif lang_mode == "hinglish":
                    disp = f"{query} open kiya ja raha hai"
                else:
                    disp = f"Opened {query}"
                final_text = opened_msg or disp
                log_command_history(query, final_text, source)
                try:
                    eel.AppendAIBubble(final_text, "action_result", {"action": "open", "query": query}, "ACTION", lang_mode)
                except Exception:
                    pass
                return
            except Exception as oe:
                logger.error(f"Universal opener error: {oe}", exc_info=True)

        # 4. Media playback on YouTube (English and Hindi)
        elif any(w in q_lower for w in ['on youtube', 'play', 'bajao', 'gaana', 'song', 'बजाओ', 'सुनाओ', 'laga do']):
            try:
                from engine.features import PlayYoutube
                yt_msg = PlayYoutube(query)
                lang_mode = lang_res.get("mode", "english")
                if lang_mode == "hindi_devanagari":
                    disp = f"YouTube पर चलाया जा रहा है: '{query}'"
                elif lang_mode == "hinglish":
                    disp = f"YouTube par play ho raha hai: '{query}'"
                else:
                    disp = f"Playing '{query}' on YouTube"
                final_text = yt_msg or disp
                log_command_history(query, final_text, source)
                try:
                    eel.AppendAIBubble(final_text, "media", {"action": "youtube", "query": query}, "ACTION", lang_mode)
                except Exception:
                    pass
                return
            except Exception as ye:
                logger.error(f"YouTube playback error: {ye}", exc_info=True)

        # 4.5. Natural Spoken Intent Resolver (Understands conversational speech without rigid phrasing)
        try:
            from engine.intent_resolver import NaturalIntentResolver
            intent_res = NaturalIntentResolver.resolve_intent(query)
            if intent_res and intent_res.handled:
                last_response = intent_res.spoken_response
                card_type = intent_res.card_type or "action_result"
                card_data = intent_res.card_data or {}
                display_text = intent_res.display_text or last_response
                lang_mode = lang_res.get("mode", "english")

                if last_response:
                    speak(last_response)

                try:
                    eel.AppendAIBubble(display_text or last_response, card_type, card_data, "ACTION", lang_mode)
                except Exception:
                    pass

                log_command_history(query, last_response, source)
                logger.info(f"NaturalIntentResolver handled command in {round((time.time() - start_time) * 1000, 1)}ms")
                return
        except Exception as ie:
            logger.error(f"NaturalIntentResolver notice: {ie}", exc_info=True)

        # 5. Modular Voice Skills Engine (System, Tasks, Weather, Calendar, Notes, Calculator, Search, Automation)
        try:
            from engine.skills import get_skill_manager
            skill_res = get_skill_manager().dispatch(query)
            if skill_res and skill_res.handled:
                last_response = skill_res.spoken_response
                card_type = skill_res.card_type or "info"
                card_data = skill_res.card_data or {}
                display_text = skill_res.display_text or last_response
                lang_mode = lang_res.get("mode", "english")

                if last_response:
                    speak(last_response)

                try:
                    eel.ShowSkillResult(
                        skill_res.card_type,
                        skill_res.card_data,
                        skill_res.confirmation_prompt,
                        skill_res.confirmation_action_id,
                        display_text
                    )
                except Exception:
                    pass

                try:
                    eel.AppendAIBubble(display_text or last_response, card_type, card_data, "ACTION" if card_type != "none" else "SUCCESS", lang_mode)
                except Exception:
                    pass

                log_command_history(query, last_response or "Skill executed", source)
                logger.info(f"Skill handled command in {round((time.time() - start_time) * 1000, 1)}ms")
                return
        except Exception as se:
            logger.error(f"SkillManager dispatch notice: {se}", exc_info=True)

        # 6. Legacy Alexa / Smart Skills Fallback
        try:
            from engine.alexa_skills import handle_alexa_command
            is_alexa, alexa_resp = handle_alexa_command(query)
            if is_alexa:
                last_response = alexa_resp or "Completed task."
                lang_mode = lang_res.get("mode", "english")
                speak(last_response)
                log_command_history(query, last_response, source)
                try:
                    eel.AppendAIBubble(last_response, "info", {}, "SUCCESS", lang_mode)
                except Exception:
                    pass
                return
        except Exception as ae:
            logger.error(f"Alexa skills handler notice: {ae}")

        # 7. Executive AI Virtual Assistant (Gemini / OpenAI / Offline Conversational Brain)
        try:
            from engine.llm import ask_dracarys
            response = ask_dracarys(query)
            if response:
                last_response = response
            else:
                last_response = "मुझे समझ आया: " + query if has_hindi(query) else "I heard: " + query
            speak(last_response)
            status = "SUCCESS"
        except Exception as e:
            logger.error(f"AI response error: {e}", exc_info=True)
            last_response = f"I heard '{query}'. My AI brain momentarily glitched, but I'm here."
            speak(last_response)
            status = "ERROR"

        resp_lang = detect_language(last_response)
        log_command_history(query, last_response, source)
        try:
            eel.AppendAIBubble(last_response, "chat_response", {}, status, resp_lang.get("mode", "english"))
        except Exception:
            pass

        logger.info(f"Total command execution completed in {round((time.time() - start_time) * 1000, 1)}ms")

    except Exception as ge:
        logger.exception(f"Unhandled general command dispatch error: {ge}")
        err_msg = f"I encountered an unexpected issue: {str(ge)}"
        speak("Sorry, I ran into an issue processing that command.")
        try:
            eel.AppendAIBubble(err_msg, "error", {"error": str(ge)}, "ERROR")
            eel.ShowErrorNotification("Command Error", str(ge), "command")
        except Exception:
            pass
    finally:
        try:
            eel.ShowHood()
            eel.UpdateAssistantState("idle", "Ready")
        except Exception:
            pass