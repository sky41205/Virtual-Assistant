"""
Language & Script Detection Engine for DRACARYS / Sophia AI Assistant
Accurately detects English, Hindi (Devanagari script), and Hinglish (Hindi in Roman script).
Enables strict language and script mirroring across NLP responses, TTS voices, and UI badges.
"""
import re
from typing import Dict, Any, Tuple

# Comprehensive lexicon of Hinglish / Romanized Hindi words
# Includes question words, pronouns, verbs, auxiliaries, particles, greetings, and common nouns.
HINGLISH_LEXICON = {
    # Question words
    'kya', 'kyun', 'kyu', 'kaise', 'kaisa', 'kaisi', 'kaun', 'kab', 'kaha', 'kahan', 
    'kidhar', 'kitna', 'kitne', 'kitni', 'kisko', 'kiska', 'kiski', 'kiske', 'kisne',

    # Pronouns & determiners
    'main', 'mai', 'mera', 'meri', 'mere', 'mujhe', 'mujhko', 'hum', 'hamara', 'hamari', 
    'hamare', 'tum', 'tumhara', 'tumhari', 'tumhare', 'tumhe', 'aap', 'aapka', 'aapki', 
    'aapke', 'aapko', 'ye', 'yeh', 'wo', 'woh', 'inka', 'unka', 'iska', 'uska', 'inki', 
    'unki', 'iski', 'uski', 'inhe', 'unhe', 'isne', 'usne', 'apna', 'apni', 'apne',

    # Auxiliaries & State verbs
    'hai', 'hain', 'ho', 'hoon', 'hun', 'tha', 'thi', 'the', 'hoga', 'hogi', 'honge', 
    'hona', 'huye', 'hue', 'hoti', 'hota', 'hote',

    # Common Action Verbs & Imperatives
    'karo', 'karna', 'kariye', 'kar', 'karta', 'karti', 'karte', 'kiya', 'kiyi', 'kiye',
    'batao', 'bataiye', 'bata', 'bol', 'bolo', 'boliye', 'sunao', 'sunaiye', 'suno', 'suniye',
    'kholo', 'kholna', 'chalao', 'chalana', 'bajao', 'bajana', 'ruk', 'ruko', 'rukiye',
    'de', 'do', 'dijiye', 'dena', 'le', 'lo', 'lijiye', 'lena', 'aao', 'aaiye', 'aana',
    'jao', 'jaiye', 'jana', 'samjhao', 'samajh', 'samjhe', 'samjho', 'padho', 'padhiye',
    'likho', 'likhiye', 'dekh', 'dekho', 'dekhiye', 'raha', 'rahi', 'rahe',

    # Connectors, Adverbs, Negation & Affirmatives
    'aur', 'ya', 'lekin', 'par', 'magar', 'bhi', 'toh', 'to', 'na', 'nahi', 'nahin', 
    'mat', 'haan', 'ha', 'bilkul', 'zaroor', 'jarur',

    # Time, Quantifiers & Adjectives
    'aaj', 'kal', 'parso', 'ab', 'abhi', 'phir', 'badhiya', 'badiya', 'achha', 'accha', 
    'achhi', 'acchi', 'achhe', 'acche', 'theek', 'thik', 'bahut', 'bohot', 'thoda', 
    'zara', 'kuch', 'kuchh', 'sab', 'sabko', 'saare', 'sari', 'sabhi', 'pehle', 'baad',

    # Salutations & Conversational Markers
    'namaste', 'namaskar', 'pranam', 'shukriya', 'dhanyawad', 'dhanyavad', 'alvida',
    'mausam', 'samay', 'waqt', 'din', 'raat', 'subah', 'shaam', 'dost', 'yaar', 'bhai',
    'kaam', 'madad', 'sawaal', 'sawal', 'jawab', 'khabar', 'baat', 'gaana', 'gana',
    'aawaz', 'awaaz', 'aawaaz', 'awaz', 'badhao', 'badhana', 'badha', 'kam', 'ghatao',
    'ghatana', 'ghata', 'jyada', 'zyada', 'chup', 'shant', 'kripya', 'pata', 'maloom',
    'chai', 'khana', 'paani', 'paisa', 'paise', 'rupiya', 'rupaye'
}

# Ambiguous tokens that overlap with English vocabulary and should not trigger Hinglish on their own
AMBIGUOUS_WORDS = {'the', 'to', 'do', 'so', 'me', 'in', 'is', 'us', 'at', 'on', 'no', 'up'}

# Explicit phrases signaling Hindi intent
HINDI_INTENT_PATTERNS = [
    r'\bin hindi\b',
    r'\bhindi me\b',
    r'\bhindi mein\b',
    r'\bhindi mai\b',
    r'\bhindi bolo\b',
    r'\bhindi batao\b',
    r'\bhindi sunao\b',
    r'\bहिंदी में\b'
]


def detect_language(text: str) -> Dict[str, Any]:
    """
    Detect language and script of user query or assistant response.
    
    Returns a structured dictionary:
    {
        "mode": "english" | "hindi_devanagari" | "hinglish",
        "language": "en" | "hi",
        "script": "latin" | "devanagari",
        "label": "English" | "Hindi (देवनागरी)" | "Hinglish (हिंदी)",
        "badge_html": HTML string for UI badge display,
        "tts_voice_type": "en" | "hi",
        "confidence": float
    }
    """
    if not text or not str(text).strip():
        return {
            "mode": "english",
            "language": "en",
            "script": "latin",
            "label": "English",
            "badge_html": "<span class='badge-lang lang-en'>🇬🇧 English</span>",
            "tts_voice_type": "en",
            "confidence": 1.0
        }

    clean_text = str(text).strip()

    # 1. Check for Devanagari Unicode characters (U+0900 to U+097F)
    devanagari_chars = re.findall(r'[\u0900-\u097F]', clean_text)
    if devanagari_chars:
        # If there are Devanagari characters, prioritize Hindi Devanagari
        return {
            "mode": "hindi_devanagari",
            "language": "hi",
            "script": "devanagari",
            "label": "Hindi (देवनागरी)",
            "badge_html": "<span class='badge-lang lang-hi-deva'>🇮🇳 हिंदी (देवनागरी)</span>",
            "tts_voice_type": "hi",
            "confidence": 1.0
        }

    # 2. Check for explicit phrases requesting Hindi
    text_lower = clean_text.lower()
    for pattern in HINDI_INTENT_PATTERNS:
        if re.search(pattern, text_lower):
            return {
                "mode": "hinglish",
                "language": "hi",
                "script": "latin",
                "label": "Hinglish (हिंदी)",
                "badge_html": "<span class='badge-lang lang-hinglish'>🇮🇳 Hinglish</span>",
                "tts_voice_type": "hi",
                "confidence": 0.95
            }

    # 3. Tokenize words for Hinglish vocabulary matching
    words = re.findall(r'\b[a-zA-Z]+\b', text_lower)
    if not words:
        return {
            "mode": "english",
            "language": "en",
            "script": "latin",
            "label": "English",
            "badge_html": "<span class='badge-lang lang-en'>🇬🇧 English</span>",
            "tts_voice_type": "en",
            "confidence": 0.8
        }

    matched_hinglish = [w for w in words if w in HINGLISH_LEXICON]
    unambiguous_matches = [w for w in matched_hinglish if w not in AMBIGUOUS_WORDS]
    unambiguous_count = len(unambiguous_matches)
    total_words = len(words)

    # Must contain at least one unambiguous Hinglish token
    is_hinglish = False
    if unambiguous_count >= 1:
        if total_words <= 4:
            is_hinglish = True
        elif unambiguous_count >= 2 or (unambiguous_count / total_words) >= 0.2:
            is_hinglish = True

    if is_hinglish:
        return {
            "mode": "hinglish",
            "language": "hi",
            "script": "latin",
            "label": "Hinglish (हिंदी)",
            "badge_html": "<span class='badge-lang lang-hinglish'>🇮🇳 Hinglish</span>",
            "tts_voice_type": "hi",
            "confidence": min(1.0, 0.5 + (unambiguous_count * 0.25))
        }

    # 4. Default to English
    return {
        "mode": "english",
        "language": "en",
        "script": "latin",
        "label": "English",
        "badge_html": "<span class='badge-lang lang-en'>🇬🇧 English</span>",
        "tts_voice_type": "en",
        "confidence": 0.9
    }


def is_hindi_or_hinglish(text: str) -> bool:
    """Convenience helper to check if text is Hindi or Hinglish."""
    res = detect_language(text)
    return res["mode"] in ("hindi_devanagari", "hinglish")
