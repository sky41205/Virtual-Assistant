import os
import re
import random
import sqlite3
import webbrowser
import eel

from engine.command import speak
from engine.config import get_assistant_name
from engine.app_launcher import launch_app, find_app
import pywhatkit as kit

conn = sqlite3.connect("sophia.db", check_same_thread=False)
cursor = conn.cursor()

# Friendly human-like action acknowledgments
OPEN_PHRASES = [
    "Right away! Opening {name} for you.",
    "You got it, pulling up {name} now!",
    "Sure thing, launching {name} right away.",
    "On it! Getting {name} opened up.",
    "Right on it! Opening {name}."
]

OPEN_PHRASES_HI = [
    "ज़रूर! {name} खोल रहा हूँ।",
    "बिल्कुल, {name} शुरू कर रहा हूँ!",
    "{name} अभी खोला जा रहा है।"
]

OPEN_PHRASES_HINGLISH = [
    "Zaroor! {name} open kar raha hoon.",
    "Bilkul, {name} shuru kar raha hoon!",
    "Abhi {name} khol raha hoon."
]

YT_PHRASES = [
    "Oh great choice! Playing {term} on YouTube.",
    "You got it! Putting {term} on YouTube right now.",
    "Awesome, playing {term} on YouTube for you!"
]

YT_PHRASES_HI = [
    "बहुत बढ़िया पसंद! YouTube पर {term} चला रहा हूँ।",
    "बिल्कुल! YouTube पर {term} लगा दिया है।"
]

YT_PHRASES_HINGLISH = [
    "Bahut badhiya pasand! YouTube par {term} play kar raha hoon.",
    "Bilkul! YouTube par {term} chala diya hai."
]

def _init_audio_mixer():
    try:
        import pygame
        if not pygame.mixer.get_init():
            pygame.mixer.init()
    except Exception:
        pass

def playAssistantSound():
    """Play startup sound asynchronously without blocking startup."""
    def _play():
        try:
            import pygame
            _init_audio_mixer()
            sound_path = os.path.join("www", "assets", "audio", "start_sound.mp3")
            if os.path.exists(sound_path):
                sound = pygame.mixer.Sound(sound_path)
                sound.set_volume(0.6)
                sound.play()
        except Exception as e:
            print(f"Start sound notice: {e}")
    import threading
    threading.Thread(target=_play, daemon=True).start()

@eel.expose
def playClickSound():
    """Play UI click sound asynchronously."""
    def _play():
        try:
            import pygame
            _init_audio_mixer()
            sound_path = os.path.join("www", "assets", "audio", "click_sound.mp3")
            if os.path.exists(sound_path):
                sound = pygame.mixer.Sound(sound_path)
                sound.set_volume(0.4)
                sound.play()
        except Exception as e:
            pass
    import threading
    threading.Thread(target=_play, daemon=True).start()

def is_hindi(text: str) -> bool:
    return bool(re.search(r'[\u0900-\u097F]', text)) or any(w in text.lower() for w in ["kholo", "chalao", "bajao", "sunao", "karo", "bhejo"])

def openCommand(query):
    """Open any desktop application, store app, file, folder, drive, browser, or web shortcut."""
    from engine.language_detector import detect_language
    from engine.app_launcher import clean_app_query, launch_app, find_app
    lang_info = detect_language(query)
    lang_mode = lang_info["mode"]

    clean_query = clean_app_query(query)

    if lang_mode == "hindi_devanagari":
        phrase_list = OPEN_PHRASES_HI
    elif lang_mode == "hinglish":
        phrase_list = OPEN_PHRASES_HINGLISH
    else:
        phrase_list = OPEN_PHRASES

    if not clean_query:
        if lang_mode == "hindi_devanagari":
            msg = "आप क्या खोलना चाहते हैं?"
        elif lang_mode == "hinglish":
            msg = "Aap kya open karna chahte hain?"
        else:
            msg = "What would you like me to open?"
        speak(msg)
        return msg

    # Check 0: Browser shortcuts
    browser_keywords = ["browser", "web browser", "internet", "default browser", "web"]
    if clean_query in browser_keywords:
        msg = random.choice(phrase_list).format(name="Browser")
        speak(msg)
        webbrowser.open("https://www.google.com")
        return msg

    # Check 0.5: WhatsApp shortcut
    if clean_query in ["whatsapp", "whatsapp web"]:
        from engine.communication import open_whatsapp
        success, msg = open_whatsapp()
        speak(msg)
        return msg

    # Check 1: Universal Launcher (Apps, Modern UWP, Special Folders, Drives, Settings, Web Portals, Files)
    success, app_name = launch_app(clean_query)
    if success:
        msg = random.choice(phrase_list).format(name=app_name)
        speak(msg)
        return msg

    # Check 2: Universal Web Search Fallback (Guarantee 100% resolution)
    try:
        if "." in clean_query and not clean_query.endswith(".exe"):
            url = clean_query if clean_query.startswith("http") else f"https://{clean_query}"
        else:
            url = f"https://www.google.com/search?q={clean_query}"
        webbrowser.open(url)
        msg = random.choice(phrase_list).format(name=clean_query.title())
        speak(msg)
        return msg
    except Exception as e:
        print(f"Universal fallback launch failed: {e}")

    if lang_mode == "hindi_devanagari":
        msg = f"{clean_query} खोला जा रहा है।"
    elif lang_mode == "hinglish":
        msg = f"{clean_query} open kiya ja raha hai."
    else:
        msg = f"Opening {clean_query} now."
    speak(msg)
    return msg

def PlayYoutube(query):
    from engine.language_detector import detect_language
    lang_info = detect_language(query)
    lang_mode = lang_info["mode"]
    search_term = extract_yt_term(query)
    if search_term:
        if lang_mode == "hindi_devanagari":
            phrase_list = YT_PHRASES_HI
        elif lang_mode == "hinglish":
            phrase_list = YT_PHRASES_HINGLISH
        else:
            phrase_list = YT_PHRASES
        phrase = random.choice(phrase_list).format(term=search_term)
        speak(phrase)
        kit.playonyt(search_term)
        return phrase
    else:
        if lang_mode == "hindi_devanagari":
            phrase = "मुझे समझ नहीं आया कि YouTube पर क्या चलाना है।"
        elif lang_mode == "hinglish":
            phrase = "Mujhe samajh nahi aaya ki YouTube par kya chalana hai."
        else:
            phrase = "I couldn't quite catch what you'd like to watch on YouTube."
        speak(phrase)
        return phrase

def extract_yt_term(command):
    # Hindi patterns: "[term] bajao / chalao / sunao / laga do"
    hi_pattern = r'^(.*?)\s+(?:bajao|chalao|sunao|laga do|बजाओ|चलाओ|सुनाओ)(?:\s+on\s+youtube)?$'
    m_hi = re.search(hi_pattern, command.strip(), re.IGNORECASE)
    if m_hi and m_hi.group(1).strip():
        term = m_hi.group(1).strip()
        for w in ["play", "youtube pe", "youtube par", "song", "gaana", "gaane"]:
            term = re.sub(rf'\b{w}\b', '', term, flags=re.IGNORECASE).strip()
        return term if term else None

    # English pattern: "play [term] [on youtube]"
    pattern = r'play\s+(.*?)(?:\s+on\s+youtube)?$'
    match = re.search(pattern, command.strip(), re.IGNORECASE)
    if match and match.group(1).strip():
        return match.group(1).strip()
    term = command.replace("play", "").replace("on youtube", "").strip()
    return term if term else None