import os
import re
import time
import math
import random
import datetime
import threading
import sqlite3
import urllib.parse
import webbrowser
import requests
import pyautogui
import psutil

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sophia.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_alexa_tables():
    """Ensure notes and reminders tables exist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reminder_text TEXT NOT NULL,
                remind_at TIMESTAMP NOT NULL,
                status TEXT DEFAULT 'pending'
            )
        """)
        conn.commit()

init_alexa_tables()

# ----------------- 1. LIVE WEATHER -----------------
def get_live_weather(city: str = "") -> str:
    """Fetch live weather from wttr.in with human-like reporting."""
    clean_city = city.strip().title() if city else ""
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
            loc_str = f"in {loc_name}" if loc_name else "outside"

            return f"Currently {loc_str}, it is {temp_c}°C and {desc.lower()} with {humidity}% humidity. It feels like {feels_c}°C with winds around {wind} km/h."
    except Exception as e:
        print(f"Weather lookup note: {e}")

    # Fallback to simple text format
    try:
        url_simple = f"https://wttr.in/{urllib.parse.quote(clean_city)}?format=%C+%t" if clean_city else "https://wttr.in/?format=%C+%t"
        r = requests.get(url_simple, timeout=3)
        if r.status_code == 200 and r.text.strip():
            loc_str = f"in {clean_city}" if clean_city else "right now"
            return f"The weather {loc_str} is {r.text.strip()}."
    except Exception:
        pass

    return f"I couldn't reach the weather service right now, but you can check your local forecast in your browser."

# ----------------- 2. TIME, DATE & CLOCK -----------------
def get_current_time_date(is_hindi: bool = False) -> str:
    """Return natural formatted time, date, and day."""
    now = datetime.datetime.now()
    time_str = now.strftime("%I:%M %p").lstrip("0")
    day_str = now.strftime("%A")
    date_str = now.strftime("%B %d, %Y")

    if is_hindi:
        return f"अभी {time_str} बजे हैं, और आज {day_str}, {now.day} तारीख है।"
    return f"It is currently {time_str} on {day_str}, {date_str}."

# ----------------- 3. TIMERS & ALARMS -----------------
active_timers = []

def start_timer_thread(seconds: int, label: str = "Timer"):
    """Run countdown timer and chime when complete."""
    def _timer_worker():
        time.sleep(seconds)
        try:
            from engine.command import speak
            speak(f"Time is up! Your {label} for {seconds} seconds has finished.")
        except Exception:
            pass

    t = threading.Thread(target=_timer_worker, daemon=True)
    t.start()
    active_timers.append({"thread": t, "seconds": seconds, "label": label})

# ----------------- 4. QUICK NOTES -----------------
def save_quick_note(text: str, lang_mode: str = "english") -> str:
    """Save a note to the SQLite database with script and language mirroring."""
    clean_text = text.strip()
    if not clean_text:
        if lang_mode == "hindi_devanagari":
            return "आप नोट में क्या लिखना चाहते हैं?"
        elif lang_mode == "hinglish":
            return "Aap note me kya likhna chahte hain?"
        return "What would you like me to note down?"
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO notes (note_text) VALUES (?)", (clean_text,))
        conn.commit()
    if lang_mode == "hindi_devanagari":
        return f"नोट सहेज लिया गया है: '{clean_text}'।"
    elif lang_mode == "hinglish":
        return f"Note save kar liya gaya hai: '{clean_text}'."
    return f"Got it! I have noted that down: '{clean_text}'."

def read_quick_notes(lang_mode: str = "english") -> str:
    """Retrieve saved notes with script and language mirroring."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT note_text, created_at FROM notes ORDER BY id DESC LIMIT 5")
        rows = cursor.fetchall()
        if not rows:
            if lang_mode == "hindi_devanagari":
                return "आपके पास अभी कोई नोट नहीं है।"
            elif lang_mode == "hinglish":
                return "Aapke paas abhi koi notes nahi hain."
            return "You don't have any notes saved right now."
        notes_list = [f"{i+1}. {r['note_text']}" for i, r in enumerate(rows)]
        if lang_mode == "hindi_devanagari":
            return "आपके हाल के नोट्स: " + " | ".join(notes_list)
        elif lang_mode == "hinglish":
            return "Aapke recent notes: " + " | ".join(notes_list)
        return f"Here are your latest notes: " + " | ".join(notes_list)

def clear_all_notes(lang_mode: str = "english") -> str:
    """Clear all notes with script and language mirroring."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notes")
        conn.commit()
    if lang_mode == "hindi_devanagari":
        return "सभी नोट्स हटा दिए गए हैं।"
    elif lang_mode == "hinglish":
        return "Sabhi notes clear kar diye gaye hain."
    return "All your saved notes have been cleared."

# ----------------- 5. MATH & UNIT CONVERSION -----------------
def calculate_math(expression: str) -> str:
    """Safely calculate arithmetic expression."""
    expr = expression.lower()
    for w in ["what is", "calculate", "tell me", "solve", "how much is", "equals", "equal to"]:
        expr = expr.replace(w, "")
    expr = expr.strip(" ?=")

    # Handle percentage: "15 percent of 500" -> "(15/100)*500"
    pct_match = re.search(r'([\d.]+)\s*(?:percent|%)\s+of\s+([\d.]+)', expr)
    if pct_match:
        pct = float(pct_match.group(1))
        val = float(pct_match.group(2))
        res = (pct / 100.0) * val
        return f"{pct}% of {val} is {round(res, 2)}."

    # Clean words to operators
    expr = expr.replace("plus", "+").replace("minus", "-").replace("into", "*").replace("times", "*").replace("multiplied by", "*").replace("x", "*").replace("divided by", "/").replace("over", "/")
    expr = re.sub(r'[^\d+\-*/().^]', '', expr)

    if not expr:
        return ""

    try:
        # Safe eval using math constants
        allowed_names = {"sqrt": math.sqrt, "pow": math.pow, "abs": abs, "pi": math.pi}
        result = eval(expr, {"__builtins__": None}, allowed_names)
        if isinstance(result, float) and result.is_integer():
            result = int(result)
        elif isinstance(result, float):
            result = round(result, 4)
        return f"The answer is {result}."
    except Exception:
        return ""

def convert_units(query: str) -> str:
    """Handle common unit conversions."""
    q = query.lower()
    # Miles <-> Km
    m_km = re.search(r'([\d.]+)\s*(?:km|kilometers?)\s+(?:in|to)\s+miles?', q)
    if m_km:
        v = float(m_km.group(1))
        return f"{v} kilometers is equal to {round(v * 0.621371, 2)} miles."
    m_mi = re.search(r'([\d.]+)\s*miles?\s+(?:in|to)\s+(?:km|kilometers?)', q)
    if m_mi:
        v = float(m_mi.group(1))
        return f"{v} miles is equal to {round(v * 1.60934, 2)} kilometers."

    # Kg <-> Lbs
    m_kg = re.search(r'([\d.]+)\s*(?:kg|kilos?|kilograms?)\s+(?:in|to)\s+(?:lbs|pounds?)', q)
    if m_kg:
        v = float(m_kg.group(1))
        return f"{v} kilograms is equal to {round(v * 2.20462, 2)} pounds."
    m_lbs = re.search(r'([\d.]+)\s*(?:lbs|pounds?)\s+(?:in|to)\s+(?:kg|kilograms?)', q)
    if m_lbs:
        v = float(m_lbs.group(1))
        return f"{v} pounds is equal to {round(v * 0.453592, 2)} kilograms."

    # Celsius <-> Fahrenheit
    m_c = re.search(r'([\d.]+)\s*(?:c|celsius)\s+(?:in|to)\s+(?:f|fahrenheit)', q)
    if m_c:
        v = float(m_c.group(1))
        f_val = (v * 9/5) + 32
        return f"{v} degrees Celsius is {round(f_val, 1)} degrees Fahrenheit."
    m_f = re.search(r'([\d.]+)\s*(?:f|fahrenheit)\s+(?:in|to)\s+(?:c|celsius)', q)
    if m_f:
        v = float(m_f.group(1))
        c_val = (v - 32) * 5/9
        return f"{v} degrees Fahrenheit is {round(c_val, 1)} degrees Celsius."

    return ""

# ----------------- 6. SYSTEM CONTROLS & HARDWARE -----------------
import ctypes

VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF

def _press_vk(vk_code: int):
    try:
        ctypes.windll.user32.keybd_event(vk_code, 0, 0, 0)
        ctypes.windll.user32.keybd_event(vk_code, 0, 2, 0)
    except Exception:
        pass

def adjust_volume(action: str, lang_mode: str = "english") -> str:
    """Adjust system master volume via native Windows keyboard event with language mirroring."""
    if action == "up":
        for _ in range(5):
            _press_vk(VK_VOLUME_UP)
        if lang_mode == "hindi_devanagari":
            return "आवाज़ बढ़ा दी गई है।"
        elif lang_mode == "hinglish":
            return "Aawaaz badha di gayi hai."
        return "Volume turned up."
    elif action == "down":
        for _ in range(5):
            _press_vk(VK_VOLUME_DOWN)
        if lang_mode == "hindi_devanagari":
            return "आवाज़ कम कर दी गई है।"
        elif lang_mode == "hinglish":
            return "Aawaaz kam kar di gayi hai."
        return "Volume turned down."
    elif action in ["mute", "unmute"]:
        _press_vk(VK_VOLUME_MUTE)
        if action == "mute":
            if lang_mode == "hindi_devanagari":
                return "सिस्टम आवाज़ म्यूट कर दी गई है।"
            elif lang_mode == "hinglish":
                return "System audio mute kar diya gaya hai."
            return "System volume muted."
        else:
            if lang_mode == "hindi_devanagari":
                return "सिस्टम आवाज़ अनम्यूट कर दी गई है।"
            elif lang_mode == "hinglish":
                return "System audio unmute kar diya gaya hai."
            return "System volume unmuted."
    return ""

def get_system_health(lang_mode: str = "english") -> str:
    """Report battery percentage, CPU usage, and memory usage."""
    cpu = psutil.cpu_percent(interval=0.2)
    ram = psutil.virtual_memory().percent
    bat_str = ""
    try:
        battery = psutil.sensors_battery()
        if battery:
            if lang_mode == "hindi_devanagari":
                plugged = "चार्जिंग पर है" if battery.power_plugged else "बैटरी पर चल रहा है"
                bat_str = f"बैटरी {battery.percent}% है और {plugged}। "
            elif lang_mode == "hinglish":
                plugged = "charging par hai" if battery.power_plugged else "battery par chal raha hai"
                bat_str = f"Battery {battery.percent}% hai aur {plugged}. "
            else:
                plugged = "plugged in" if battery.power_plugged else "on battery power"
                bat_str = f"Your battery is at {battery.percent}% and {plugged}. "
    except Exception:
        pass
    if lang_mode == "hindi_devanagari":
        return f"{bat_str}सीपीयू उपयोग {cpu}% और रैम {ram}% है।"
    elif lang_mode == "hinglish":
        return f"{bat_str}CPU usage {cpu}% aur RAM usage {ram}% hai."
    return f"{bat_str}CPU usage is currently at {cpu}%, and RAM usage is at {ram}%."

def lock_workstation(lang_mode: str = "english") -> str:
    """Lock the Windows desktop session."""
    try:
        os.system("rundll32.exe user32.dll,LockWorkStation")
        if lang_mode == "hindi_devanagari":
            return "आपका कंप्यूटर लॉक किया जा रहा है।"
        elif lang_mode == "hinglish":
            return "Aapka computer lock kiya ja raha hai."
        return "Locking your computer now."
    except Exception as e:
        return f"Could not lock computer: {e}"

# ----------------- 7. ALEXA FUN & ENTERTAINMENT -----------------
JOKES = [
    "Why don't scientists trust atoms? Because they make up everything!",
    "Why did the computer go to the doctor? Because it had a virus!",
    "What do you call a fake noodle? An impasta!",
    "Why did the scarecrow win an award? Because he was outstanding in his field!",
    "How does a penguin build its house? Igloos it together!",
    "Why can't you give Elsa a balloon? Because she will let it go!"
]

RIDDLES = [
    "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I? ... An echo!",
    "What has to be broken before you can use it? ... An egg!",
    "I’m tall when I’m young, and I’m short when I’m old. What am I? ... A candle!",
    "What has hands, but can’t clap? ... A clock!"
]

QUOTES = [
    "The secret of getting ahead is getting started. — Mark Twain",
    "It always seems impossible until it is done. — Nelson Mandela",
    "Believe you can and you are halfway there. — Theodore Roosevelt",
    "Quality is not an act, it is a habit. — Aristotle",
    "The only way to do great work is to love what you do. — Steve Jobs"
]

def tell_joke() -> str:
    return random.choice(JOKES)

def tell_riddle() -> str:
    return random.choice(RIDDLES)

def get_motivational_quote() -> str:
    return random.choice(QUOTES)

def flip_coin() -> str:
    res = random.choice(["Heads", "Tails"])
    return f"I flipped a coin and it landed on... {res}!"

def roll_dice() -> str:
    val = random.randint(1, 6)
    return f"Rolling the dice... You rolled a {val}!"

# ----------------- 8. GOOGLE SEARCH -----------------
def open_google_search(query: str, lang_mode: str = "english") -> str:
    """Open search in Google and return acknowledgement."""
    clean_q = query
    for w in ["search for", "google search", "search google for", "search on google", "google"]:
        clean_q = clean_q.replace(w, "").strip()
    encoded = urllib.parse.quote(clean_q)
    webbrowser.open(f"https://www.google.com/search?q={encoded}")
    if lang_mode == "hindi_devanagari":
        return f"Google पर '{clean_q}' खोजा जा रहा है।"
    elif lang_mode == "hinglish":
        return f"Google par '{clean_q}' search kiya ja raha hai."
    return f"Searching Google for '{clean_q}'."

# ----------------- MASTER ALEXA DISPATCHER -----------------
def handle_alexa_command(query: str) -> tuple[bool, str]:
    """
    Check if query is a smart Alexa/Google Assistant skill.
    Returns (handled, response_speech).
    """
    from engine.language_detector import detect_language
    lang_info = detect_language(query)
    lang_mode = lang_info["mode"]
    q = query.lower().strip()

    # 1. Weather
    if any(w in q for w in ["weather", "mausam", "temperature", "forecast", "how hot is it", "how cold is it"]):
        # Extract city if specified: "weather in Delhi", "Mumbai weather"
        city = ""
        m_city = re.search(r'(?:weather|mausam|temperature)\s+(?:in|of|at|for)\s+([a-zA-Z\s]+)$', q)
        if m_city:
            city = m_city.group(1).strip()
        elif re.search(r'^([a-zA-Z]+)\s+weather', q):
            city = q.split()[0]
        return True, get_live_weather(city)

    # 2. Time & Date
    if any(w in q for w in ["what time", "current time", "time right now", "kitne baje", "samay kya", "tell me the time"]):
        is_hi = "baje" in q or "samay" in q
        return True, get_current_time_date(is_hindi=is_hi)
    if any(w in q for w in ["what is the date", "today's date", "aaj konsi date", "aaj konsi taareekh", "what day is today", "what day is it"]):
        is_hi = "aaj" in q or "taareekh" in q
        return True, get_current_time_date(is_hindi=is_hi)

    # 3. Timers
    m_timer = re.search(r'(?:set\s+a\s+timer|timer\s+for|timer\s+lagao)\s+(?:for\s+)?(\d+)\s*(seconds?|minutes?|secs?|mins?)', q)
    if m_timer:
        val = int(m_timer.group(1))
        unit = m_timer.group(2)
        total_seconds = val * 60 if "min" in unit else val
        start_timer_thread(total_seconds, f"{val} {unit} timer")
        if lang_mode == "hindi_devanagari":
            return True, f"{val} {unit} का टाइमर सेट कर दिया गया है। समय पूरा होते ही मैं आपको अलर्ट करूँगी!"
        elif lang_mode == "hinglish":
            return True, f"{val} {unit} ka timer set kar diya gaya hai. Time pura hote hi main aapko alert karungi!"
        return True, f"Timer set for {val} {unit}. I will alert you as soon as time is up!"

    # 4. Notes
    m_note = re.search(r'(?:take\s+a\s+note|note\s+down|save\s+note|note\s+banao|note\s+likho)(?::|\s+that|\s+saying)?\s+(.+)$', q)
    if m_note:
        note_content = m_note.group(1).strip()
        return True, save_quick_note(note_content, lang_mode)
    if any(w in q for w in ["clear my notes", "delete all notes", "clear notes", "delete notes", "notes hatao"]):
        return True, clear_all_notes(lang_mode)
    if any(w in q for w in ["read my notes", "show my notes", "my notes", "notes dikhao", "list notes", "get notes", "mere notes"]):
        return True, read_quick_notes(lang_mode)

    # 5. Volume & Hardware Controls
    if any(w in q for w in ["volume up", "increase volume", "aawaaz badhao", "sound badhao", "turn up the volume"]):
        return True, adjust_volume("up", lang_mode)
    if any(w in q for w in ["volume down", "decrease volume", "aawaaz kam karo", "lower the volume", "turn down the volume"]):
        return True, adjust_volume("down", lang_mode)
    # Hardware mute: only if explicitly targeted to system/pc/computer
    if any(w in q for w in ["mute pc volume", "mute computer volume", "mute system volume", "mute master volume", "mute system audio", "mute pc sound", "mute computer sound", "pc mute karo", "computer mute karo"]):
        return True, adjust_volume("mute", lang_mode)
    if any(w in q for w in ["unmute volume", "unmute pc", "unmute computer", "unmute audio", "unmute sound", "unmute"]):
        return True, adjust_volume("unmute", lang_mode)

    # Assistant speech pausing / silence (NEVER touches Windows hardware volume)
    if q in ["mute", "stop speech", "stop talking", "be quiet", "shut up", "silence", "quiet", "chup", "shant", "ruko", "chup raho", "shant raho"]:
        from engine.command import stop_speech
        stop_speech()
        if lang_mode == "hindi_devanagari":
            return True, "जी, मैंने बोलना बंद कर दिया है।"
        elif lang_mode == "hinglish":
            return True, "Ji, maine bolna band kar diya hai."
        return True, "Speech paused."

    if any(w in q for w in ["battery status", "battery percentage", "system status", "system health", "cpu usage"]):
        return True, get_system_health(lang_mode)
    if any(w in q for w in ["lock my pc", "lock pc", "lock screen", "lock workstation", "screen lock karo"]):
        return True, lock_workstation(lang_mode)

    # 6. Unit Conversions
    conv_result = convert_units(q)
    if conv_result:
        return True, conv_result

    # 7. Math Calculations
    if any(k in q for k in ["calculate", "what is", "how much is", "plus", "minus", "times", "multiplied by", "divided by", "percent of"]):
        if re.search(r'\d', q):
            math_ans = calculate_math(q)
            if math_ans:
                return True, math_ans

    # 8. Alexa Fun & Entertainment
    if 'joke' in q or 'chutkula' in q or 'make me laugh' in q:
        return True, tell_joke()
    if 'riddle' in q or 'paheli' in q:
        return True, tell_riddle()
    if 'quote' in q or 'inspire' in q:
        return True, get_motivational_quote()
    if 'coin' in q or 'toss' in q or 'heads or tails' in q:
        return True, flip_coin()
    if 'dice' in q or 'roll a die' in q:
        return True, roll_dice()

    # 9. Explicit Google Search
    if any(q.startswith(p) for p in ["search for ", "google search ", "search google for ", "search on google "]):
        return True, open_google_search(q, lang_mode)

    return False, ""
