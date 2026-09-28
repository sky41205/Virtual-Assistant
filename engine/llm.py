import re
import os
import time
from engine.config import (
    ASSISTANT_NAME,
    AI_PROVIDER,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL
)
from engine.logger import get_logger

logger = get_logger("nlp_llm")

gemini_client_instance = None
openai_client_instance = None

gemini_conversation_history = []
openai_conversation_history = []

active_gemini_model = "gemini-3.5-flash-lite"

from engine.language_detector import detect_language

def get_system_prompt(query_mode: str = "english"):
    from engine.config import ASSISTANT_NAME
    
    if query_mode == "hindi_devanagari":
        script_directive = (
            "\n- STRICT SCRIPT & LANGUAGE REQUIREMENT (Hindi Devanagari): The user is communicating in Hindi written in Devanagari script. "
            "You MUST compose your response exclusively in pure, natural, fluent Hindi written in DEVANAGARI SCRIPT (हिंदी लिपि). "
            "Do NOT use English or Latin alphabet. Example: 'नमस्ते! मैं आपकी सहायता के लिए तैयार हूँ।'"
        )
    elif query_mode == "hinglish":
        script_directive = (
            "\n- STRICT SCRIPT & LANGUAGE REQUIREMENT (Hinglish / Romanized Hindi): The user is communicating in Hinglish (Hindi written using the Roman / English alphabet, e.g. 'kya haal hai', 'tum kaun ho'). "
            "You MUST compose your response in natural, modern conversational Hinglish written in the EXACT SAME ROMAN SCRIPT (Latin letters). "
            "Do NOT use Devanagari script. Example: 'Main badhiya hoon! Aap bataiye aaj main aapki kya madad kar sakta hoon?'"
        )
    else:
        script_directive = (
            "\n- STRICT SCRIPT & LANGUAGE REQUIREMENT (English): The user is communicating in English. "
            "You MUST compose your response in articulate, natural, modern English using the Latin alphabet."
        )

    return (
        f"You are {ASSISTANT_NAME}, an ultra-intelligent, lightning-fast, and deeply capable AI Virtual Assistant. "
        "You combine executive competence with natural warmth, charisma, and intellectual depth.\n"
        "- Crystal Clarity & Directness: Deliver answers with maximum clarity, precision, and zero filler. Never use robotic preambles such as 'Sure!', 'Certainly!', 'I would be happy to help', or 'As an AI model'. Lead immediately with the key insight, fact, or solution.\n"
        "- Speed First for Voice: Spoken responses MUST be 1 to 2 punchy sentences maximum (under 25 words). Be concise, rapid, and conversational. Never pad answers.\n"
        "- Zero Markdown in Voice: Strictly avoid asterisks, bullet points, headers, or emojis so the voice engine speaks smoothly without verbalizing symbols.\n"
        "- Task Automation & Domain Specialization: You specialize in Academic learning, Workplace productivity, and Personal management."
        f"{script_directive}"
    )

def clean_speech_text(text: str) -> str:
    """Remove markdown characters that sound odd when read by TTS."""
    if not text:
        return ""
    cleaned = re.sub(r'[\*\#\_`~]', '', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

# ----------------- GEMINI PROVIDER -----------------
def get_gemini_client(api_key=None):
    global gemini_client_instance
    if api_key is None and gemini_client_instance is not None:
        return gemini_client_instance

    try:
        from google import genai
        key = api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        if not key:
            return None
        client = genai.Client(api_key=key)
        if api_key is None:
            gemini_client_instance = client
        return client
    except Exception as e:
        logger.error(f"Error initializing Gemini client: {e}")
        return None

# --------------- FAST RESPONSE CACHE ---------------
# LRU cache for the 40 most recent queries — returns instantly on repeated input
_response_cache: dict = {}
_cache_order: list = []
_CACHE_MAX = 40

def _cache_get(key: str):
    return _response_cache.get(key)

def _cache_put(key: str, value: str):
    if key in _response_cache:
        _cache_order.remove(key)
    elif len(_cache_order) >= _CACHE_MAX:
        oldest = _cache_order.pop(0)
        _response_cache.pop(oldest, None)
    _response_cache[key] = value
    _cache_order.append(key)

def ask_gemini(query: str, api_key: str = None) -> str:
    """Fast Gemini query: cache-first, gemini-2.0-flash-lite first, single-shot (no per-token overhead)."""
    global gemini_conversation_history, active_gemini_model
    client = get_gemini_client(api_key)
    if not client:
        raise ValueError("Google Gemini API key is missing.")

    from google.genai import types

    # ── Cache check — return instantly for repeated queries ──
    cache_key = query.strip().lower()
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"Cache HIT: '{query[:50]}'")
        return cached

    user_content = types.Content(
        role="user",
        parts=[types.Part.from_text(text=query.strip())]
    )
    gemini_conversation_history.append(user_content)

    if len(gemini_conversation_history) > 6:
        gemini_conversation_history = gemini_conversation_history[-6:]

    lang_info = detect_language(query)
    config = types.GenerateContentConfig(
        system_instruction=get_system_prompt(lang_info["mode"]),
        temperature=0.5
    )

    # Fastest model first, then fallbacks
    candidate_models = list(dict.fromkeys([m for m in [
        "gemini-2.0-flash-lite",
        active_gemini_model,
        GEMINI_MODEL or "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ] if m]))

    start_time = time.time()
    last_err = None
    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=gemini_conversation_history,
                config=config
            )
            answer = clean_speech_text(response.text)
            gemini_conversation_history.append(types.Content(
                role="model",
                parts=[types.Part.from_text(text=answer)]
            ))
            active_gemini_model = model_name
            latency = round((time.time() - start_time) * 1000, 1)
            logger.info(f"Gemini [{model_name}] {latency}ms (mode={lang_info['mode']})")
            _cache_put(cache_key, answer)
            return answer
        except Exception as e:
            last_err = e
            logger.warning(f"Gemini '{model_name}' failed: {e}")
            continue

    raise last_err or RuntimeError("All Gemini models failed.")

# ----------------- OPENAI PROVIDER -----------------
def get_openai_client(api_key=None):
    global openai_client_instance
    if api_key is None and openai_client_instance is not None:
        return openai_client_instance

    try:
        from openai import OpenAI
        key = api_key or OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
        if not key:
            return None
        client = OpenAI(api_key=key)
        if api_key is None:
            openai_client_instance = client
        return client
    except Exception as e:
        logger.error(f"Error initializing OpenAI client: {e}")
        return None

def ask_openai(query: str, api_key: str = None) -> str:
    """Query OpenAI API with dynamic bilingual script mirroring."""
    global openai_conversation_history
    client = get_openai_client(api_key)
    if not client:
        raise ValueError("OpenAI API key is missing.")

    lang_info = detect_language(query)
    sys_prompt = get_system_prompt(lang_info["mode"])

    if not openai_conversation_history:
        openai_conversation_history = [{"role": "system", "content": sys_prompt}]
    else:
        openai_conversation_history[0] = {"role": "system", "content": sys_prompt}

    openai_conversation_history.append({"role": "user", "content": query.strip()})
    if len(openai_conversation_history) > 10:
        openai_conversation_history = [openai_conversation_history[0]] + openai_conversation_history[-8:]

    start_time = time.time()
    response = client.chat.completions.create(
        model=OPENAI_MODEL or "gpt-4o-mini",
        messages=openai_conversation_history,
        max_tokens=180,
        temperature=0.5,
    )
    answer = response.choices[0].message.content.strip()
    openai_conversation_history.append({"role": "assistant", "content": answer})
    latency = round((time.time() - start_time) * 1000, 1)
    logger.info(f"OpenAI [{OPENAI_MODEL or 'gpt-4o-mini'}] response generated in {latency}ms (mode={lang_info['mode']})")
    return clean_speech_text(answer)

# ----------------- UNIFIED DISPATCHER -----------------
def ask_dracarys(query: str) -> str:
    """Send a user query to the active AI provider with automatic fallback."""
    if not query or not query.strip():
        return ""

    from engine.config import AI_PROVIDER, GEMINI_API_KEY, OPENAI_API_KEY
    provider = (AI_PROVIDER or "gemini").lower().strip()

    logger.info(f"NLP Query requested (provider={provider}): '{query}'")

    if provider == "gemini" or (GEMINI_API_KEY and not OPENAI_API_KEY):
        try:
            return ask_gemini(query)
        except Exception as e:
            logger.warning(f"Gemini error, attempting OpenAI or fallback: {e}")
            if OPENAI_API_KEY:
                try:
                    return ask_openai(query)
                except Exception as oe:
                    logger.warning(f"OpenAI fallback error: {oe}")
            return _fallback_answer(query, str(e))
    else:
        try:
            return ask_openai(query)
        except Exception as e:
            logger.warning(f"OpenAI error, attempting Gemini or fallback: {e}")
            if GEMINI_API_KEY:
                try:
                    return ask_gemini(query)
                except Exception as ge:
                    logger.warning(f"Gemini fallback error: {ge}")
            return _fallback_answer(query, str(e))

def _fallback_answer(query: str, err_msg: str) -> str:
    """Warm, natural conversational fallback with strict language & script mirroring."""
    from engine.config import ASSISTANT_NAME
    q = query.lower().strip()
    lang_info = detect_language(query)
    mode = lang_info["mode"]
    logger.info(f"Using offline conversational fallback (mode={mode})")

    # 1. Hindi Devanagari Script Mode
    if mode == "hindi_devanagari":
        if any(w in q for w in ["नमस्ते", "प्रणाम", "कैसे हो", "क्या हाल है", "कैसा चल रहा है", "क्या चल रहा है"]):
            return "नमस्ते! मैं बहुत बढ़िया हूँ। आप बताइए, आज आपका दिन कैसा चल रहा है?"
        if any(w in q for w in ["तुम कौन हो", "आप कौन हो", "तुम्हारा नाम क्या है", "आपका नाम क्या है"]):
            return f"मैं {ASSISTANT_NAME} हूँ, आपका पर्सनल AI वर्चुअल असिस्टेंट! मैं आपके कंप्यूटर के काम आसान कर सकता हूँ, ऐप्स खोल सकता हूँ, और आपके साथ बातचीत कर सकता हूँ।"
        if any(w in q for w in ["क्या कर सकते हो", "क्या करते हो", "क्या कर सकती हो", "मदद"]):
            return "मैं आपके कंप्यूटर का कोई भी ऐप खोल सकता हूँ, सिस्टम कंट्रोल्स चला सकता हूँ, नोट्स और टास्क मैनेज कर सकता हूँ, मौसम बता सकता हूँ, और आपके सवालों के जवाब दे सकता हूँ।"
        if any(w in q for w in ["धन्यवाद", "शुक्रिया"]):
            return "अरे आपका बहुत स्वागत है! हमेशा आपकी सेवा और सहायता के लिए तत्पर हूँ।"
        if any(w in q for w in ["अलविदा", "बाय", "फिर मिलेंगे"]):
            return "फिर मिलते हैं! अपना ख्याल रखिएगा और आपका दिन बहुत शुभ हो।"
        return "मैं सुन रहा हूँ, लेकिन इंटरनेट कनेक्शन में थोड़ी रुकावट आई। क्या आप एक बार फिर कहेंगे?"

    # 2. Hinglish / Romanized Hindi Script Mode
    elif mode == "hinglish":
        if any(w in q for w in ["namaste", "kaise ho", "kya haal hai", "kaisa chal raha hai", "kya chal raha hai", "hello"]):
            return "Namaste! Main bahut badhiya hoon. Aap bataiye, aaj aapka din kaisa chal raha hai?"
        if any(w in q for w in ["tum kaun ho", "aap kaun ho", "tumhara naam kya hai", "aapka naam kya hai"]):
            return f"Main {ASSISTANT_NAME} hoon, aapka personal AI Virtual Assistant! Main aapke system ke apps open kar sakta hoon, notes aur tasks manage kar sakta hoon, aur aapke sawaalon ke jawab de sakta hoon."
        if any(w in q for w in ["kya kar sakte ho", "kya karte ho", "kya kar sakti ho", "madad"]):
            return "Main aapke PC ka koi bhi app open kar sakta hoon, volume aur system controls chala sakta hoon, notes aur tasks manage kar sakta hoon, aur weather bata sakta hoon."
        if any(w in q for w in ["dhanyawaad", "dhanyavad", "shukriya", "thanks"]):
            return "Aapka bahut-bahut swagat hai! Hamesha aapki madad ke liye taiyar hoon."
        if any(w in q for w in ["alvida", "bye", "phir milenge"]):
            return "Phir milenge! Apna khayal rakhiyega aur aapka din shubh ho."
        return "Main sun raha hoon, lekin network connection me thodi dikkat aayi. Kya aap ek baar phir bolenge?"

    # 3. English Script Mode
    else:
        if any(w in q for w in ["hello", "hi", "hey"]):
            return "Hey there! Always great to hear from you. What's on your mind today?"
        if "how are you" in q:
            return "I'm doing fantastic, thank you for asking! How can I assist you with your work today?"
        if any(w in q for w in ["who are you", "what is your name"]):
            return f"I'm {ASSISTANT_NAME}, your personal AI Virtual Assistant! I can automate your desktop tasks, manage schedules, launch applications, and answer any questions."
        if any(w in q for w in ["what can you do", "help"]):
            return "I can launch any app on your PC, adjust volume, take screenshots, manage your notes and tasks, check the weather, search the web, and answer your questions!"
        if "thank" in q:
            return "Anytime! Always happy to help."
        if any(w in q for w in ["bye", "goodbye"]):
            return "Have a wonderful rest of your day! Let me know whenever you need anything."
        return "I'm right here with you, but my connection had a tiny hiccup. Could you say that one more time?"

def reset_conversation():
    """Reset chat history for both providers."""
    global gemini_conversation_history, openai_conversation_history, gemini_client_instance, openai_client_instance
    gemini_conversation_history = []
    openai_conversation_history = []
    gemini_client_instance = None
    openai_client_instance = None
    logger.info("Conversation history reset.")
