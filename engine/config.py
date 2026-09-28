import os
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / '.env'

def load_environment():
    try:
        from dotenv import load_dotenv
        if ENV_PATH.exists():
            load_dotenv(dotenv_path=ENV_PATH, override=True)
    except ImportError:
        pass

load_environment()

ASSISTANT_NAME = os.getenv('ASSISTANT_NAME', 'Dracarys')
AI_PROVIDER = os.getenv('AI_PROVIDER', 'gemini')  # 'gemini' or 'openai'

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

try:
    VOICE_INDEX = int(os.getenv('VOICE_INDEX', '1'))
except ValueError:
    VOICE_INDEX = 1

try:
    VOICE_RATE = int(os.getenv('VOICE_RATE', '170'))
except ValueError:
    VOICE_RATE = 170

try:
    VOICE_VOLUME = float(os.getenv('VOICE_VOLUME', '1.0'))
except ValueError:
    VOICE_VOLUME = 1.0

ASSISTANT_THEME = os.getenv('ASSISTANT_THEME', 'fire')

SPEECH_LANG = os.getenv('SPEECH_LANG', 'en-IN')
TTS_HINDI_VOICE = os.getenv('TTS_HINDI_VOICE', 'hi-IN-MadhurNeural')
TTS_ENGLISH_VOICE = os.getenv('TTS_ENGLISH_VOICE', 'en-IN-NeerjaNeural')

def save_assistant_config(
    name=None,
    voice_index=None,
    rate=None,
    volume=None,
    theme=None,
    ai_provider=None,
    gemini_key=None,
    gemini_model=None,
    openai_key=None,
    openai_model=None,
    speech_lang=None,
    tts_hindi_voice=None,
    tts_english_voice=None
):
    """Save updated configurations to .env file and update module variables."""
    global ASSISTANT_NAME, VOICE_INDEX, VOICE_RATE, VOICE_VOLUME, ASSISTANT_THEME
    global AI_PROVIDER, GEMINI_API_KEY, GEMINI_MODEL, OPENAI_API_KEY, OPENAI_MODEL
    global SPEECH_LANG, TTS_HINDI_VOICE, TTS_ENGLISH_VOICE

    if name is not None:
        ASSISTANT_NAME = str(name).strip()
    if voice_index is not None:
        VOICE_INDEX = int(voice_index)
    if rate is not None:
        VOICE_RATE = int(rate)
    if volume is not None:
        VOICE_VOLUME = float(volume)
    if theme is not None:
        ASSISTANT_THEME = str(theme).strip().lower()
    if ai_provider is not None:
        AI_PROVIDER = str(ai_provider).strip().lower()
    if gemini_key is not None:
        GEMINI_API_KEY = str(gemini_key).strip()
    if gemini_model is not None:
        GEMINI_MODEL = str(gemini_model).strip()
    if openai_key is not None:
        OPENAI_API_KEY = str(openai_key).strip()
    if openai_model is not None:
        OPENAI_MODEL = str(openai_model).strip()
    if speech_lang is not None:
        SPEECH_LANG = str(speech_lang).strip()
    if tts_hindi_voice is not None:
        TTS_HINDI_VOICE = str(tts_hindi_voice).strip()
    if tts_english_voice is not None:
        TTS_ENGLISH_VOICE = str(tts_english_voice).strip()

    lines = [
        f"ASSISTANT_NAME={ASSISTANT_NAME}\n",
        f"AI_PROVIDER={AI_PROVIDER}\n",
        f"GEMINI_API_KEY={GEMINI_API_KEY}\n",
        f"GEMINI_MODEL={GEMINI_MODEL}\n",
        f"OPENAI_API_KEY={OPENAI_API_KEY}\n",
        f"OPENAI_MODEL={OPENAI_MODEL}\n",
        f"VOICE_INDEX={VOICE_INDEX}\n",
        f"VOICE_RATE={VOICE_RATE}\n",
        f"VOICE_VOLUME={VOICE_VOLUME}\n",
        f"ASSISTANT_THEME={ASSISTANT_THEME}\n",
        f"SPEECH_LANG={SPEECH_LANG}\n",
        f"TTS_HINDI_VOICE={TTS_HINDI_VOICE}\n",
        f"TTS_ENGLISH_VOICE={TTS_ENGLISH_VOICE}\n",
    ]

    try:
        with open(ENV_PATH, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        return True
    except Exception as e:
        print(f"Error saving config to {ENV_PATH}: {e}")
        return False

def get_assistant_name() -> str:
    """Return current assistant name dynamically."""
    return ASSISTANT_NAME

def get_assistant_config() -> dict:
    """Return all active assistant configurations as a dictionary."""
    return {
        "name": ASSISTANT_NAME,
        "ai_provider": AI_PROVIDER,
        "voice_index": VOICE_INDEX,
        "rate": VOICE_RATE,
        "volume": VOICE_VOLUME,
        "theme": ASSISTANT_THEME,
        "speech_lang": SPEECH_LANG,
        "tts_hindi_voice": TTS_HINDI_VOICE,
        "tts_english_voice": TTS_ENGLISH_VOICE
    }

def reset_default_config() -> bool:
    """Reset all assistant preferences to default baseline."""
    return save_assistant_config(
        name="Dracarys",
        voice_index=1,
        rate=170,
        volume=1.0,
        theme="fire",
        speech_lang="en-IN",
        tts_hindi_voice="hi-IN-MadhurNeural",
        tts_english_voice="en-IN-NeerjaNeural"
    )