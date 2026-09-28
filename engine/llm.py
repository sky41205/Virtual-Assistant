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

_http_session = None

def get_http_session():
    """Maintain persistent HTTP keep-alive session with connection pooling for low-latency calls."""
    global _http_session
    if _http_session is None:
        import requests
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        _http_session = requests.Session()
        retries = Retry(total=2, backoff_factor=0.1, status_forcelist=[500, 502, 503, 504])
        _http_session.mount('https://', HTTPAdapter(max_retries=retries, pool_connections=5, pool_maxsize=10))
    return _http_session

def _ask_gemini_rest(query: str, model_name: str, key: str, sys_prompt: str) -> str:
    """Direct high-speed REST endpoint call with HTTP keep-alive connection pooling."""
    session = get_http_session()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"{sys_prompt}\n\nUser Question: {query.strip()}"}]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 120
        }
    }
    resp = session.post(url, json=payload, timeout=1.5)
    if resp.status_code == 200:
        res_data = resp.json()
        candidates = res_data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            for p in parts:
                if isinstance(p, dict) and "text" in p and p["text"].strip():
                    return p["text"].strip()
    return ""

def ask_gemini(query: str, api_key: str = None) -> str:
    """Fast Gemini query: cache-first, single-shot REST with instant sub-second failover."""
    global gemini_conversation_history, active_gemini_model

    # ── Cache check — return instantly (0ms) for repeated queries ──
    cache_key = query.strip().lower()
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"Cache HIT: '{query[:50]}'")
        return cached

    key = api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("Google Gemini API key is missing.")

    lang_info = detect_language(query)
    sys_prompt = get_system_prompt(lang_info["mode"])
    primary_model = GEMINI_MODEL or "gemini-3.5-flash-lite"

    start_time = time.time()

    # Step 1: Direct High-Speed REST Execution (1.5s max timeout)
    try:
        rest_answer = _ask_gemini_rest(query, primary_model, key, sys_prompt)
        if rest_answer:
            answer = clean_speech_text(rest_answer)
            active_gemini_model = primary_model
            latency = round((time.time() - start_time) * 1000, 1)
            logger.info(f"Gemini REST [{primary_model}] {latency}ms (mode={lang_info['mode']})")
            _cache_put(cache_key, answer)
            return answer
    except Exception as rest_err:
        logger.debug(f"Gemini REST fast attempt notice: {rest_err}")

    raise RuntimeError(f"Gemini model {primary_model} fast timeout / unavailable.")

_openai_disabled = False

# ----------------- OPENAI PROVIDER -----------------
def get_openai_client(api_key=None):
    global openai_client_instance, _openai_disabled
    if _openai_disabled:
        return None
    if api_key is None and openai_client_instance is not None:
        return openai_client_instance

    try:
        from openai import OpenAI
        key = api_key or OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
        if not key or _openai_disabled:
            return None
        client = OpenAI(api_key=key, max_retries=0, timeout=2.0)
        if api_key is None:
            openai_client_instance = client
        return client
    except Exception as e:
        logger.error(f"Error initializing OpenAI client: {e}")
        return None

def ask_openai(query: str, api_key: str = None) -> str:
    """Query OpenAI API with dynamic bilingual script mirroring."""
    global openai_conversation_history, _openai_disabled
    if _openai_disabled:
        raise ValueError("OpenAI is disabled due to quota exhaustion.")
    client = get_openai_client(api_key)
    if not client:
        raise ValueError("OpenAI API key is missing or disabled.")

    lang_info = detect_language(query)
    sys_prompt = get_system_prompt(lang_info["mode"])

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": query.strip()}
    ]

    start_time = time.time()
    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL or "gpt-4o-mini",
            messages=messages,
            max_tokens=150,
            temperature=0.5,
        )
        answer = response.choices[0].message.content.strip()
        latency = round((time.time() - start_time) * 1000, 1)
        logger.info(f"OpenAI [{OPENAI_MODEL or 'gpt-4o-mini'}] response generated in {latency}ms (mode={lang_info['mode']})")
        return clean_speech_text(answer)
    except Exception as oe:
        err_str = str(oe).lower()
        if "insufficient_quota" in err_str or "quota" in err_str or "billing" in err_str or "invalid_api_key" in err_str:
            _openai_disabled = True
            logger.warning("OpenAI API quota exhausted or key invalid — disabling OpenAI for active session.")
        raise oe

# ----------------- UNIFIED DISPATCHER -----------------
def ask_dracarys(query: str) -> str:
    """Send a user query to the active AI provider with automatic fast failover."""
    if not query or not query.strip():
        return ""

    # Instant sub-millisecond cache check for repeated questions
    cache_key = query.strip().lower()
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"Cache HIT (dispatcher): '{query[:50]}'")
        return cached

    from engine.config import AI_PROVIDER, GEMINI_API_KEY, OPENAI_API_KEY
    provider = (AI_PROVIDER or "gemini").lower().strip()

    logger.info(f"NLP Query requested (provider={provider}): '{query}'")

    result = ""
    if provider == "gemini" or (GEMINI_API_KEY and not OPENAI_API_KEY) or _openai_disabled:
        try:
            result = ask_gemini(query)
        except Exception as e:
            logger.warning(f"Gemini fast failover notice: {e}")
            if OPENAI_API_KEY and not _openai_disabled:
                try:
                    result = ask_openai(query)
                except Exception as oe:
                    logger.warning(f"OpenAI fallback notice: {oe}")
            if not result:
                result = _fallback_answer(query, str(e))
    else:
        try:
            result = ask_openai(query)
        except Exception as e:
            logger.warning(f"OpenAI fast failover notice: {e}")
            if GEMINI_API_KEY:
                try:
                    result = ask_gemini(query)
                except Exception as ge:
                    logger.warning(f"Gemini fallback notice: {ge}")
            if not result:
                result = _fallback_answer(query, str(e))

    if result:
        _cache_put(cache_key, result)
    return result

def _search_wikipedia_summary(query: str, is_hindi: bool = False) -> str:
    """Instant encyclopedia lookup for factual questions when LLM is unavailable."""
    import urllib.request
    import urllib.parse
    import json

    patterns = [
        r'^(?:what is the|what is a|what is an|what is|who is|who was|tell me about|explain|define|where is|how does|why is|what are)\s+(?:the\s+)?(.+)',
        r'^(?:kya hai|kaun hai|batao|kiske baare me|क्या है|कौन है|बताओ|किसके बारे में)\s+(.+)',
        r'(.+?)\s+(?:kya hai|kaun hai|kise kehte hain|क्या है|कौन है|किसे कहते हैं)',
    ]
    topic = query.strip('?!., ')
    for p in patterns:
        m = re.match(p, topic, re.IGNORECASE)
        if m:
            topic = m.group(1).strip()
            break

    if not topic or len(topic) < 2:
        return ""

    lang_prefix = "hi" if is_hindi else "en"
    candidates = [topic, topic.title(), topic.replace(' ', '_')]
    for target in candidates:
        try:
            url = f"https://{lang_prefix}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(target)}"
            req = urllib.request.Request(url, headers={"User-Agent": "DracarysAssistant/2.0"})
            with urllib.request.urlopen(req, timeout=1.8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                extract = data.get("extract", "")
                if extract and len(extract) > 15:
                    sents = [s.strip() for s in extract.split(". ") if s.strip()]
                    short_summary = ". ".join(sents[:2])
                    if not short_summary.endswith("."):
                        short_summary += "."
                    ans = clean_speech_text(short_summary)
                    _cache_put(query.strip().lower(), ans)
                    return ans
        except Exception:
            continue
    return ""

def _fallback_answer(query: str, err_msg: str) -> str:
    """Warm, natural conversational fallback with strict language & script mirroring."""
    from engine.config import ASSISTANT_NAME
    q = query.lower().strip()
    lang_info = detect_language(query)
    mode = lang_info["mode"]
    is_hi = mode in ("hindi_devanagari", "hinglish")
    logger.info(f"Using offline conversational fallback (mode={mode})")

    # Step 1: Check instant factual encyclopedia
    wiki_ans = _search_wikipedia_summary(query, mode == "hindi_devanagari")
    if wiki_ans:
        return wiki_ans

    # Step 2: Conversational patterns by language mode
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
        return f"आपके प्रश्न '{query}' के लिए: मैं आपकी सेवा और सहायता के लिए तैयार हूँ।"

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
        return f"Aapke sawaal '{query}' ke baare me: Main ready hoon aapki madad ke liye."

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
        return f"Regarding '{query}': Dracarys AI is active and ready to assist you."

def reset_conversation():
    """Reset chat history for both providers."""
    global gemini_conversation_history, openai_conversation_history, gemini_client_instance, openai_client_instance
    gemini_conversation_history = []
    openai_conversation_history = []
    gemini_client_instance = None
    openai_client_instance = None
    logger.info("Conversation history reset.")
