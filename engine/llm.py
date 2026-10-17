import re
import os
import time
import json
import urllib.parse
import urllib.request
from typing import Optional, Dict, Any, List

from engine.config import (
    ASSISTANT_NAME,
    AI_PROVIDER,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL
)
from engine.logger import get_logger
from engine.language_detector import detect_language

logger = get_logger("nlp_llm")

gemini_client_instance = None
openai_client_instance = None

gemini_conversation_history = []
openai_conversation_history = []

active_gemini_model = "gemini-3.5-flash-lite"

FALLBACK_GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest"
]

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
        "You combine executive competence with authoritative intellectual depth and engaging warmth.\n"
        "- Crystal Clarity & Directness: Deliver answers with maximum credibility, factual precision, and zero filler. "
        "Never use robotic preambles such as 'Sure!', 'Certainly!', 'I would be happy to help', or 'As an AI model'. "
        "Lead immediately with the core insight, definition, or solution.\n"
        "- Spoken & Display Balance: Make the first 1 to 2 sentences punchy, conversational, and direct so voice engine sounds great, "
        "followed by any necessary structured breakdown, key dates, steps, or code if the question requires it.\n"
        "- Factual Credibility: Be rigorously accurate in science, math, history, coding, and geography."
        f"{script_directive}"
    )

def clean_speech_text(text: str) -> str:
    """Remove markdown characters that sound odd when read by TTS."""
    if not text:
        return ""
    cleaned = re.sub(r'[\*\#\_`~]', '', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

# ----------------- SEMANTIC FAST CACHE -----------------
_response_cache: dict = {}
_cache_order: list = []
_CACHE_MAX = 150

def _normalize_cache_key(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r'[^\w\s]', '', text.lower()).strip()
    return re.sub(r'\s+', ' ', cleaned)

def _cache_get(key: str):
    return _response_cache.get(key)

def _cache_put(key: str, value: str):
    if not key or not value:
        return
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
        _http_session.mount('https://', HTTPAdapter(max_retries=retries, pool_connections=8, pool_maxsize=16))
    return _http_session

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
            "maxOutputTokens": 450
        }
    }
    resp = session.post(url, json=payload, timeout=4.0)
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
    """Fast Gemini query: cache-first, single-shot REST with multi-model failover."""
    global gemini_conversation_history, active_gemini_model

    cache_key = _normalize_cache_key(query)
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"Cache HIT: '{query[:50]}'")
        return cached

    key = api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("Google Gemini API key is missing.")

    lang_info = detect_language(query)
    sys_prompt = get_system_prompt(lang_info["mode"])
    primary_model = GEMINI_MODEL or "gemini-3.8-flash"

    models_to_try = [primary_model]
    for m in FALLBACK_GEMINI_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    start_time = time.time()
    for model_name in models_to_try:
        try:
            rest_answer = _ask_gemini_rest(query, model_name, key, sys_prompt)
            if rest_answer:
                answer = clean_speech_text(rest_answer)
                active_gemini_model = model_name
                latency = round((time.time() - start_time) * 1000, 1)
                logger.info(f"Gemini REST [{model_name}] {latency}ms (mode={lang_info['mode']})")
                _cache_put(cache_key, answer)
                return answer
        except Exception as rest_err:
            logger.debug(f"Gemini REST fast attempt notice ({model_name}): {rest_err}")
            continue

    raise RuntimeError(f"All Gemini models {models_to_try} failed or timed out.")

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
        client = OpenAI(api_key=key, max_retries=0, timeout=2.5)
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
            max_tokens=250,
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

# ----------------- LIVE WEB INTELLIGENCE -----------------
def _extract_query_topic(query: str) -> str:
    """Extract core entity or subject from question string."""
    q = query.strip('?!., ')
    patterns = [
        r'^(?:what is the|what is a|what is an|what is|what are|who is|who was|where is|when was|why is|how does|how do|tell me about|explain|define|meaning of|history of)\s+(?:the\s+)?(.+)',
        r'^(?:kya hai|kaun hai|kahan hai|kab hua|batao|kiske baare me|क्या है|कौन है|बताओ|किसके बारे में)\s+(.+)',
        r'(.+?)\s+(?:kya hai|kaun hai|kise kehte hain|kahan hai|क्या है|कौन है|किसे कहते हैं|कहाँ है)',
    ]
    for p in patterns:
        m = re.match(p, q, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            if candidate:
                return candidate
    return q

def _search_wikipedia_summary(query: str, is_hindi: bool = False) -> str:
    """Instant authoritative encyclopedia lookup with dual language support."""
    topic = _extract_query_topic(query)
    if not topic or len(topic) < 2:
        return ""

    lang_prefix = "hi" if is_hindi else "en"
    candidates = [topic, topic.title(), topic.replace(' ', '_')]
    session = get_http_session()

    for target in candidates:
        try:
            url = f"https://{lang_prefix}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(target)}"
            headers = {"User-Agent": "DracarysAssistant/2.0 (Mozilla/5.0; AI Assistant)"}
            resp = session.get(url, headers=headers, timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                extract = data.get("extract", "")
                if extract and len(extract) > 20:
                    sents = [s.strip() for s in extract.split(". ") if s.strip()]
                    short_summary = ". ".join(sents[:3])
                    if not short_summary.endswith("."):
                        short_summary += "."
                    ans = clean_speech_text(short_summary)
                    return ans
        except Exception:
            continue
    return ""

def _search_duckduckgo_instant(query: str) -> str:
    """Query DuckDuckGo Instant Knowledge API for zero-click definitions and facts."""
    topic = _extract_query_topic(query)
    if not topic:
        return ""
    session = get_http_session()
    try:
        url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(topic)}&format=json&no_html=1&skip_disambig=1"
        resp = session.get(url, timeout=2.0)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("AbstractText", "").strip()
            answer = data.get("Answer", "").strip()
            if answer:
                return clean_speech_text(answer)
            if abstract and len(abstract) > 20:
                sents = [s.strip() for s in abstract.split(". ") if s.strip()]
                return clean_speech_text(". ".join(sents[:3]) + ".")
            # Check related topics
            for t in data.get("RelatedTopics", []):
                if isinstance(t, dict) and t.get("Text"):
                    txt = t["Text"]
                    if len(txt) > 25:
                        return clean_speech_text(txt)
    except Exception:
        pass
    return ""

# ----------------- COMPREHENSIVE OFFLINE KNOWLEDGE -----------------
OFFLINE_KNOWLEDGE_BASE = {
    # Computing & Tech
    "python": "Python is a high-level, interpreted programming language known for its readability, dynamic typing, and massive ecosystem for AI, data science, and web development.",
    "javascript": "JavaScript is a versatile, event-driven programming language that powers interactive web pages, browser applications, and modern server runtimes via Node.js.",
    "artificial intelligence": "Artificial Intelligence is the simulation of human intelligence in machines programmed to think, learn, solve problems, and adapt to new information.",
    "machine learning": "Machine learning is a branch of artificial intelligence where statistical algorithms automatically learn patterns from data and generalize to unseen tasks without explicit programming.",
    "quantum computing": "Quantum computing harnesses the principles of quantum mechanics—such as superposition and entanglement—to process complex multidimensional data exponentially faster than classical computers.",
    "open source": "Open source software refers to code that is publicly accessible, allowing anyone to view, modify, improve, and distribute it freely under open licenses.",
    "open source software": "Open source software refers to code that is publicly accessible, allowing anyone to view, modify, improve, and distribute it freely under open licenses.",
    "cloud computing": "Cloud computing delivers computing services—including servers, storage, databases, networking, and software—over the internet with on-demand scalability.",
    "docker": "Docker is an open-source platform that packages applications and their dependencies into standardized containers, ensuring identical execution across any environment.",
    "git": "Git is a distributed version control system designed to track changes in source code during software development and coordinate collaborative work among teams.",

    # Science & Physics
    "gravity": "Gravity is a fundamental natural phenomenon by which all things with mass or energy are attracted toward one another, described by Einstein's general relativity as spacetime curvature.",
    "photosynthesis": "Photosynthesis is the biological process by which green plants and algae convert light energy from the sun into chemical energy (glucose) while releasing oxygen.",
    "dna": "DNA, or deoxyribonucleic acid, is the hereditary molecule carrying genetic instructions for the development, functioning, growth, and reproduction of all known living organisms.",
    "speed of light": "The speed of light in a vacuum is exactly 299,792,458 meters per second (approximately 300,000 kilometers per second), a universal physical constant.",
    "theory of relativity": "Albert Einstein's theory of relativity encompasses special relativity (spacetime and mass-energy equivalence) and general relativity (gravity as spacetime curvature).",

    # Geography & General
    "mount everest": "Mount Everest is Earth's highest mountain above sea level, located in the Himalayas on the border between Nepal and China, with a peak elevation of 8,848.86 meters.",
    "pacific ocean": "The Pacific Ocean is the largest and deepest of the world's five oceans, extending from the Arctic in the north to Antarctica in the south.",
    "solar system": "Our solar system consists of the Sun and everything bound to it by gravity: eight planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune), moons, asteroids, and comets."
}

def _check_offline_knowledge(query: str, lang_mode: str) -> str:
    """Match query against curated high-credibility offline knowledge repository."""
    q_norm = _normalize_cache_key(query)
    for topic, ans in OFFLINE_KNOWLEDGE_BASE.items():
        if topic in q_norm:
            if lang_mode == "hindi_devanagari":
                return f"{topic.title()}: {ans}"
            elif lang_mode == "hinglish":
                return f"{topic.title()}: {ans}"
            return ans
    return ""

def _live_web_and_offline_answer(query: str, err_context: str = "") -> str:
    """Multi-tiered zero-failure knowledge pipeline: Wikipedia -> DuckDuckGo -> Curated Base -> Conversational."""
    lang_info = detect_language(query)
    mode = lang_info["mode"]
    is_hi = mode == "hindi_devanagari"

    # Tier 1: Wikipedia REST API
    wiki_res = _search_wikipedia_summary(query, is_hindi=is_hi)
    if wiki_res:
        logger.info(f"Answered via Wikipedia Encyclopedia: '{query[:40]}'")
        return wiki_res

    # Tier 2: DuckDuckGo Instant Answer
    ddg_res = _search_duckduckgo_instant(query)
    if ddg_res:
        logger.info(f"Answered via DuckDuckGo Instant Knowledge: '{query[:40]}'")
        return ddg_res

    # Tier 3: Curated Offline Knowledge Base
    offline_res = _check_offline_knowledge(query, mode)
    if offline_res:
        logger.info(f"Answered via Curated Knowledge Base: '{query[:40]}'")
        return offline_res

    # Tier 4: Conversational Fallback
    return _conversational_fallback(query, mode)

def _conversational_fallback(query: str, mode: str) -> str:
    from engine.config import ASSISTANT_NAME
    q = query.lower().strip()

    if mode == "hindi_devanagari":
        if any(w in q for w in ["नमस्ते", "प्रणाम", "कैसे हो", "क्या हाल है", "कैसा चल रहा है"]):
            return "नमस्ते! मैं बहुत बढ़िया हूँ। आप बताइए, आज आपका दिन कैसा चल रहा है?"
        if any(w in q for w in ["तुम कौन हो", "आप कौन हो", "तुम्हारा नाम क्या है", "आपका नाम क्या है"]):
            return f"मैं {ASSISTANT_NAME} हूँ, आपका पर्सनल AI वर्चुअल असिस्टेंट! मैं आपके सभी सवालों के सटीक जवाब दे सकता हूँ, ऐप्स चला सकता हूँ और काम आसान कर सकता हूँ।"
        if any(w in q for w in ["क्या कर सकते हो", "क्या करते हो", "मदद"]):
            return "मैं किसी भी विषय पर ज्ञान, कोडिंग, गणित, सिस्टम ऑटोमेशन, मौसम, समाचार और ऐप्स संचालन में आपकी त्वरित सहायता कर सकता हूँ।"
        if any(w in q for w in ["धन्यवाद", "शुक्रिया"]):
            return "अरे आपका बहुत स्वागत है! हमेशा आपकी सेवा और सहायता के लिए तत्पर हूँ।"
        if any(w in q for w in ["अलविदा", "बाय"]):
            return "फिर मिलते हैं! अपना ख्याल रखिएगा और आपका दिन बहुत शुभ हो।"
        return f"{ASSISTANT_NAME} सक्रिय है। आपके प्रश्न '{query}' के लिए मैं निरंतर तैयार और उपस्थित हूँ।"

    elif mode == "hinglish":
        if any(w in q for w in ["namaste", "kaise ho", "kya haal hai", "kaisa chal raha hai", "hello"]):
            return "Namaste! Main bahut badhiya hoon. Aap bataiye, aaj aapka din kaisa chal raha hai?"
        if any(w in q for w in ["tum kaun ho", "aap kaun ho", "tumhara naam kya hai", "aapka naam kya hai"]):
            return f"Main {ASSISTANT_NAME} hoon, aapka personal AI Virtual Assistant! Main aapke sawaalon ke answers de sakta hoon aur system automate kar sakta hoon."
        if any(w in q for w in ["kya kar sakte ho", "kya karte ho", "madad"]):
            return "Main kisi bhi question ka answer de sakta hoon, apps launch kar sakta hoon, notes aur reminders manage kar sakta hoon, aur calculations solve kar sakta hoon."
        if any(w in q for w in ["dhanyawaad", "shukriya", "thanks"]):
            return "Aapka bahut-bahut swagat hai! Hamesha aapki madad ke liye taiyar hoon."
        if any(w in q for w in ["alvida", "bye", "phir milenge"]):
            return "Phir milenge! Apna khayal rakhiyega aur aapka din shubh ho."
        return f"{ASSISTANT_NAME} active hai. Aapke query '{query}' ke liye main taiyar hoon."

    else:
        if any(w in q for w in ["hello", "hi", "hey"]):
            return "Hey there! I am ready to assist. What question or task is on your mind?"
        if "how are you" in q:
            return "I'm performing at peak efficiency, thank you! How can I assist you with your research or work today?"
        if any(w in q for w in ["who are you", "what is your name"]):
            return f"I'm {ASSISTANT_NAME}, your high-performance AI Virtual Assistant. I'm equipped to answer questions across all domains, automate desktop tasks, and solve complex problems."
        if any(w in q for w in ["what can you do", "help"]):
            return "I can answer questions on any topic, solve math, fetch real-time weather and news, automate your OS, and run modular productivity skills."
        if "thank" in q:
            return "Anytime! Always happy to provide fast, reliable assistance."
        if any(w in q for w in ["bye", "goodbye"]):
            return "Have a wonderful day! Call upon me whenever you need anything."
        return f"{ASSISTANT_NAME} AI core is active and ready to assist you with '{query}'."

def _fallback_answer(query: str, err_msg: str) -> str:
    """Backward-compatible fallback dispatcher."""
    return _live_web_and_offline_answer(query, err_msg)

# ----------------- UNIFIED DISPATCHER -----------------
def ask_dracarys(query: str) -> str:
    """Send a user query to the active AI provider with automatic fast failover."""
    if not query or not query.strip():
        return ""

    cache_key = _normalize_cache_key(query)
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
                result = _live_web_and_offline_answer(query, str(e))
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
                result = _live_web_and_offline_answer(query, str(e))

    if result:
        _cache_put(cache_key, result)
    return result

def reset_conversation():
    """Reset chat history for both providers."""
    global gemini_conversation_history, openai_conversation_history, gemini_client_instance, openai_client_instance
    gemini_conversation_history = []
    openai_conversation_history = []
    gemini_client_instance = None
    openai_client_instance = None
    logger.info("Conversation history reset.")
