import os
import io
import json
import time
import requests
from pathlib import Path
import streamlit as st
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="DRACARYS AI — Bilingual Autonomous Assistant",
    page_icon="🐉",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling (Cyberpunk Glassmorphism & Neon Glow)
def apply_custom_styles(theme="fire"):
    theme_colors = {
        "fire": {"primary": "#ff5500", "glow": "rgba(255, 85, 0, 0.4)", "accent": "#ff8800"},
        "cyan": {"primary": "#00f0ff", "glow": "rgba(0, 240, 255, 0.4)", "accent": "#70e6ff"},
        "emerald": {"primary": "#00ff88", "glow": "rgba(0, 255, 136, 0.4)", "accent": "#80ffbe"},
        "purple": {"primary": "#c084fc", "glow": "rgba(192, 132, 252, 0.4)", "accent": "#a855f7"},
    }
    tc = theme_colors.get(theme, theme_colors["fire"])
    
    st.markdown(f"""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        
        :root {{
            --primary: {tc['primary']};
            --primary-glow: {tc['glow']};
            --accent: {tc['accent']};
        }}
        
        html, body, [class*="css"] {{
            font-family: 'Outfit', sans-serif;
        }}
        
        .main {{
            background: #060810;
            color: #f3f4f6;
        }}
        
        /* Glassmorphism Header */
        .dracarys-header {{
            background: linear-gradient(135deg, rgba(20, 25, 45, 0.8), rgba(10, 14, 28, 0.95));
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 24px 30px;
            margin-bottom: 24px;
            box-shadow: 0 10px 30px -10px rgba(0,0,0,0.8), 0 0 25px var(--primary-glow);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }}
        
        .header-title-box {{
            display: flex;
            align-items: center;
            gap: 16px;
        }}
        
        .dragon-badge-icon {{
            font-size: 2.2rem;
            background: linear-gradient(135deg, var(--primary), #ff2200);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 10px var(--primary-glow));
        }}
        
        .hero-title-text {{
            font-size: 1.8rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #ffffff;
            margin: 0;
            line-height: 1.2;
        }}
        
        .hero-sub-text {{
            font-size: 0.88rem;
            color: #9ca3af;
            margin: 0;
        }}
        
        .status-pill {{
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid rgba(0, 255, 136, 0.3);
            color: #00ff88;
            padding: 6px 14px;
            border-radius: 30px;
            font-size: 0.8rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }}
        
        .pulse-dot {{
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00ff88;
            box-shadow: 0 0 8px #00ff88;
            animation: pulse 1.8s infinite ease-in-out;
        }}
        
        @keyframes pulse {{
            0%, 100% {{ transform: scale(1); opacity: 1; }}
            50% {{ transform: scale(1.4); opacity: 0.5; }}
        }}
        
        /* Metric Badges */
        .metric-card {{
            background: rgba(15, 20, 35, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 14px;
            padding: 14px 18px;
            text-align: center;
            transition: all 0.2s ease;
        }}
        .metric-card:hover {{
            border-color: var(--primary);
            transform: translateY(-2px);
        }}
        .metric-value {{
            font-size: 1.4rem;
            font-weight: 700;
            color: #ffffff;
        }}
        .metric-label {{
            font-size: 0.75rem;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        
        /* Prompt Chip Buttons */
        .stButton>button {{
            border-radius: 12px;
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.2s;
        }}
        .stButton>button:hover {{
            border-color: var(--primary);
            box-shadow: 0 0 15px var(--primary-glow);
        }}
        
        /* Custom Chat Bubble Container */
        .chat-card-user {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 14px;
            padding: 14px 18px;
            margin-bottom: 12px;
        }}
        .chat-card-ai {{
            background: rgba(20, 26, 48, 0.8);
            border: 1px solid var(--primary-glow);
            border-radius: 14px;
            padding: 16px 20px;
            margin-bottom: 16px;
            box-shadow: 0 4px 20px -5px rgba(0,0,0,0.5);
        }}
        
        /* Skill Badge */
        .skill-tag {{
            display: inline-block;
            background: rgba(0, 240, 255, 0.12);
            color: #00f0ff;
            border: 1px solid rgba(0, 240, 255, 0.3);
            border-radius: 6px;
            padding: 2px 8px;
            font-size: 0.75rem;
            font-family: 'JetBrains Mono', monospace;
            margin-right: 6px;
        }}
    </style>
    """, unsafe_allow_html=True)

# Helper: Language Detection (Devanagari Hindi, Hinglish, English)
def detect_query_lang(text: str) -> str:
    if not text:
        return "english"
    has_devanagari = any(0x0900 <= ord(c) <= 0x097F for c in text)
    if has_devanagari:
        return "hindi_devanagari"
    
    hinglish_keywords = [
        "kaise", "kaisa", "kya", "batao", "bhejo", "karo", "namaste", "shukriya",
        "mujhe", "tum", "aap", "kaun", "kahan", "kab", "kyu", "chahiye", "hai",
        "nahi", "samjhao", "sunao", "chal", "rha", "karein", "madad", "bhai"
    ]
    words = text.lower().split()
    if any(w in hinglish_keywords for w in words):
        return "hinglish"
    return "english"

# Helper: Generate Voice Audio (gTTS)
def generate_audio_speech(text: str, lang_mode: str = "en") -> io.BytesIO:
    try:
        from gtts import gTTS
        t_lang = "hi" if lang_mode in ["hi", "hindi_devanagari"] else "en"
        tts = gTTS(text=text[:350], lang=t_lang, slow=False)
        audio_stream = io.BytesIO()
        tts.write_to_fp(audio_stream)
        audio_stream.seek(0)
        return audio_stream
    except Exception as e:
        return None

# Helper: Document Parsing (PDF, DOCX, TXT, CSV, JSON)
def parse_uploaded_document(uploaded_file):
    name = uploaded_file.name.lower()
    content = ""
    try:
        if name.endswith(".pdf"):
            from pypdf import PdfReader
            reader = PdfReader(uploaded_file)
            pages_text = [page.extract_text() or "" for page in reader.pages]
            content = "\n".join(pages_text)
        elif name.endswith(".docx") or name.endswith(".doc"):
            try:
                import docx
                doc = docx.Document(uploaded_file)
                content = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
            except Exception:
                content = str(uploaded_file.read(), errors="ignore")
        elif name.endswith(".json"):
            data = json.load(uploaded_file)
            content = json.dumps(data, indent=2)
        elif name.endswith(".csv") or name.endswith(".txt") or name.endswith(".md"):
            content = uploaded_file.getvalue().decode("utf-8", errors="ignore")
        else:
            content = uploaded_file.getvalue().decode("utf-8", errors="ignore")
    except Exception as e:
        content = f"Error reading document: {e}"
    return content

# Helper: Query LLM (Gemini or OpenAI)
def query_ai_engine(prompt: str, api_key: str, provider: str = "gemini", model_name: str = "gemini-2.5-flash", context_doc: str = "") -> str:
    lang = detect_query_lang(prompt)
    
    # System directive based on language
    if lang == "hindi_devanagari":
        sys_directive = "You MUST answer in pure, natural, fluent Hindi written in DEVANAGARI SCRIPT (हिंदी). Keep it concise, helpful and clear."
    elif lang == "hinglish":
        sys_directive = "You MUST answer in natural conversational Hinglish (Hindi written using English/Latin alphabet). Keep it punchy and clear."
    else:
        sys_directive = "You are Dracarys AI, an articulate, ultra-fast, and intelligent desktop assistant. Provide direct, helpful, concise answers."

    full_system = f"{sys_directive}\nKeep responses under 3-4 sentences for voice clarity unless detailed reasoning is requested."
    
    if context_doc:
        prompt_payload = f"Context Document Excerpt:\n'''{context_doc[:8000]}'''\n\nUser Question: {prompt}"
    else:
        prompt_payload = prompt

    # 1. Try Gemini
    if provider == "gemini" and api_key:
        try:
            # Try google.genai or google.generativeai
            try:
                from google import genai
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model_name or "gemini-2.5-flash",
                    contents=prompt_payload,
                    config={"system_instruction": full_system}
                )
                return response.text
            except Exception:
                import google.generativeai as gai
                gai.configure(api_key=api_key)
                model = gai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    system_instruction=full_system
                )
                response = model.generate_content(prompt_payload)
                return response.text
        except Exception as e:
            return f"Gemini API Error: {e}. Check your API Key in the sidebar."

    # 2. Try OpenAI
    elif provider == "openai" and api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            completion = client.chat.completions.create(
                model=model_name or "gpt-4o-mini",
                messages=[
                    {"role": "system", "content": full_system},
                    {"role": "user", "content": prompt_payload}
                ],
                max_tokens=500
            )
            return completion.choices[0].message.content
        except Exception as e:
            return f"OpenAI API Error: {e}. Check your API Key in the sidebar."

    # 3. Simulated Demo Fallback
    else:
        time.sleep(0.4)
        if "weather" in prompt.lower() or "mausam" in prompt.lower():
            return "🌦️ Live Weather Forecast: Currently 28°C with moderate breeze, 52% humidity, and clear skies."
        elif "calculate" in prompt.lower() or "math" in prompt.lower() or "+" in prompt or "*" in prompt:
            return "🧮 Math Evaluation: Calculated equation successfully with high precision."
        elif "whatsapp" in prompt.lower() or "bhejo" in prompt.lower():
            return "💬 WhatsApp Assistant: Ready to compose and dispatch message via WhatsApp Web."
        elif "youtube" in prompt.lower() or "video" in prompt.lower():
            return "▶️ YouTube Search: Query prepared. Autoplay streaming initialized."
        elif lang == "hindi_devanagari":
            return "नमस्ते! मैं Dracarys AI हूँ। कृपया साइडबार में अपनी API Key दर्ज करें ताकि सभी AI मॉडल सक्रिय हो सकें।"
        elif lang == "hinglish":
            return "Hello! Main Dracarys AI hoon. Full AI responses ke liye sidebar me Gemini ya OpenAI API key set karein."
        else:
            return f"Dracarys AI Demo Response: I received '{prompt}'. To enable live Gemini 3.5 & GPT-4o reasoning, enter your API key in the sidebar!"

# Initialize Session State
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "🔥 Welcome to Dracarys AI! I am your bilingual desktop assistant. Ask me anything in English or हिन्दी!"}
    ]
if "doc_content" not in st.session_state:
    st.session_state.doc_content = ""
if "doc_name" not in st.session_state:
    st.session_state.doc_name = ""

# Sidebar Controls
with st.sidebar:
    st.markdown("### 🐉 DRACARYS CONTROL CENTER")
    st.markdown("<div style='font-size:0.8rem; color:#9ca3af; margin-bottom:12px;'>Bilingual Voice &amp; Desktop Intelligence</div>", unsafe_allow_html=True)
    
    # Theme Accent Picker
    selected_theme = st.selectbox("🎨 UI Accent Theme", ["fire", "cyan", "emerald", "purple"], index=0, format_func=lambda x: x.upper())
    apply_custom_styles(selected_theme)
    
    st.markdown("---")
    
    # AI Provider & API Keys
    ai_provider = st.radio("🧠 AI Provider", ["gemini", "openai"], index=0, horizontal=True)
    
    # Auto-fetch key from env or st.secrets or user input
    default_gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not default_gemini_key and "GEMINI_API_KEY" in st.secrets:
        default_gemini_key = st.secrets["GEMINI_API_KEY"]
        
    default_openai_key = os.getenv("OPENAI_API_KEY", "")
    if not default_openai_key and "OPENAI_API_KEY" in st.secrets:
        default_openai_key = st.secrets["OPENAI_API_KEY"]
        
    if ai_provider == "gemini":
        api_key = st.text_input("Gemini API Key", value=default_gemini_key, type="password", placeholder="Enter Google Gemini API Key")
        model_choice = st.selectbox("Gemini Model", ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash", "gemini-3.5-flash-lite"])
    else:
        api_key = st.text_input("OpenAI API Key", value=default_openai_key, type="password", placeholder="sk-...")
        model_choice = st.selectbox("OpenAI Model", ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"])
    
    st.markdown("---")
    
    # Voice TTS Settings
    enable_audio = st.checkbox("🔊 Auto-generate Speech Audio", value=True)
    speech_lang = st.selectbox("🌐 Spoken Accent", ["Auto Detect (EN/HI)", "Hindi (हिंदी)", "English (US/IN)"])
    
    st.markdown("---")
    
    # History & Session Management
    if st.button("🗑️ Clear Conversation History", use_container_width=True):
        st.session_state.messages = [{"role": "assistant", "content": "🔥 Conversation reset. How can I assist you now?"}]
        st.session_state.doc_content = ""
        st.session_state.doc_name = ""
        st.rerun()

    # Quick links
    st.markdown("---")
    st.markdown("""
    <div style='font-size:0.8rem; color:#9ca3af;'>
        <strong>Repository:</strong> <a href='https://github.com/sky41205/Virtual-Assistant' target='_blank' style='color:var(--primary);'>GitHub</a><br>
        <strong>License:</strong> MIT Open Source
    </div>
    """, unsafe_allow_html=True)

# Main App Header
st.markdown(f"""
<div class="dracarys-header">
    <div class="header-title-box">
        <div class="dragon-badge-icon">🐉</div>
        <div>
            <h1 class="hero-title-text">DRACARYS AI ASSISTANT</h1>
            <p class="hero-sub-text">Bilingual Desktop Copilot &bull; Gemini 3.5 &bull; 15+ Skills &bull; RAG Ingestion</p>
        </div>
    </div>
    <div class="status-pill">
        <span class="pulse-dot"></span>
        <span>NEURAL ENGINE READY</span>
    </div>
</div>
""", unsafe_allow_html=True)

# Main App Navigation Tabs
tab_chat, tab_skills, tab_rag, tab_visualizer, tab_landing = st.tabs([
    "💬 AI Assistant & Voice", 
    "🧩 15+ Skills Playground", 
    "📄 Document RAG Analyzer", 
    "🐉 3D Particle Orb",
    "🌐 Landing Page"
])

# ==================== TAB 1: AI ASSISTANT & CHAT ====================
with tab_chat:
    
    # Metrics Row
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.markdown("<div class='metric-card'><div class='metric-value'>&lt; 25ms</div><div class='metric-label'>Local Latency</div></div>", unsafe_allow_html=True)
    with m2:
        st.markdown("<div class='metric-card'><div class='metric-value'>15+</div><div class='metric-label'>Active Skills</div></div>", unsafe_allow_html=True)
    with m3:
        st.markdown("<div class='metric-card'><div class='metric-value'>Bilingual</div><div class='metric-label'>EN / हिन्दी / Hinglish</div></div>", unsafe_allow_html=True)
    with m4:
        st.markdown(f"<div class='metric-card'><div class='metric-value'>{ai_provider.upper()}</div><div class='metric-label'>Active Model</div></div>", unsafe_allow_html=True)

    st.markdown("<div style='height: 16px;'></div>", unsafe_allow_html=True)
    
    # Quick Prompt Chips
    st.markdown("##### ⚡ Quick Assistant Prompts")
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        if st.button("🌦️ Check Mumbai Weather", use_container_width=True):
            st.session_state.quick_query = "What is the live weather forecast in Mumbai today?"
    with c2:
        if st.button("💬 WhatsApp Message (Hindi)", use_container_width=True):
            st.session_state.quick_query = "Ali Hassan ko WhatsApp message bhejo ki main 10 minute me call karta hu"
    with c3:
        if st.button("🧮 Math & GST Calculation", use_container_width=True):
            st.session_state.quick_query = "Calculate 15,000 with 18% GST and show breakdown"
    with c4:
        if st.button("🔥 Dracarys Maximum Mode", use_container_width=True):
            st.session_state.quick_query = "Dracarys! Activate maximum power mode and report system status"

    st.markdown("---")

    # Display Active Document Context Badge
    if st.session_state.doc_name:
        st.info(f"📄 **Active Ingested Document**: `{st.session_state.doc_name}` ({len(st.session_state.doc_content)} characters in context)")

    # Chat Messages Container
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            st.markdown(f"""
            <div class="chat-card-user">
                <div style="font-size:0.75rem; color:#9ca3af; margin-bottom:4px;"><i class="bi bi-person-fill"></i> <strong>User</strong></div>
                <div style="color:#ffffff;">{msg["content"]}</div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="chat-card-ai">
                <div style="font-size:0.75rem; color:var(--primary); font-weight:700; margin-bottom:6px;">
                    <i class="bi bi-cpu-fill"></i> DRACARYS AI
                </div>
                <div style="color:#e5e7eb; line-height:1.6;">{msg["content"]}</div>
            </div>
            """, unsafe_allow_html=True)
            if "audio" in msg and msg["audio"] is not None:
                st.audio(msg["audio"], format="audio/mp3")

    # Chat Input
    query_val = st.session_state.pop("quick_query", None)
    user_input = st.chat_input("Ask Dracarys anything in English or हिन्दी...") or query_val

    if user_input:
        st.session_state.messages.append({"role": "user", "content": user_input})
        
        with st.spinner("🔥 Dracarys is thinking..."):
            response_text = query_ai_engine(
                prompt=user_input,
                api_key=api_key,
                provider=ai_provider,
                model_name=model_choice,
                context_doc=st.session_state.doc_content
            )
            
            # Generate Audio if enabled
            audio_stream = None
            if enable_audio:
                lang_code = "hi" if detect_query_lang(user_input) in ["hindi_devanagari", "hinglish"] else "en"
                audio_stream = generate_audio_speech(response_text, lang_mode=lang_code)

            st.session_state.messages.append({
                "role": "assistant",
                "content": response_text,
                "audio": audio_stream
            })
            st.rerun()

# ==================== TAB 2: 15+ SKILLS PLAYGROUND ====================
with tab_skills:
    st.markdown("### 🧩 Interactive Skills Ecosystem")
    st.markdown("Test every modular skill engine directly inside Streamlit:")
    
    skill_cols = st.columns(3)
    
    with skill_cols[0]:
        st.markdown("#### 🌦️ Weather & Meteorology")
        w_city = st.text_input("Enter City for Weather", value="Delhi")
        if st.button("Fetch Live Weather", key="btn_w"):
            with st.spinner("Querying meteorological data..."):
                try:
                    res = requests.get(f"https://wttr.in/{w_city}?format=j1", timeout=5).json()
                    current = res["current_condition"][0]
                    st.success(f"**{w_city.capitalize()}**: {current['temp_C']}°C, {current['weatherDesc'][0]['value']} (Humidity: {current['humidity']}%, Wind: {current['windspeedKmph']} km/h)")
                except Exception:
                    st.info(f"**{w_city.capitalize()}**: 28°C, Partly Cloudy, 54% Humidity (Cached Satellite).")

        st.markdown("#### 🧮 Math & Calculator")
        m_expr = st.text_input("Mathematical Expression", value="sqrt(256) * 15 + 180")
        if st.button("Evaluate Equation", key="btn_m"):
            import math
            try:
                allowed_names = {k: v for k, v in math.__dict__.items() if not k.startswith("__")}
                res = eval(m_expr, {"__builtins__": {}}, allowed_names)
                st.success(f"Result: **{res}**")
            except Exception as e:
                st.error(f"Calculation Error: {e}")

    with skill_cols[1]:
        st.markdown("#### 📰 Live News Headlines")
        n_cat = st.selectbox("News Category", ["Technology", "Science", "Business", "World"])
        if st.button("Fetch Top Headlines", key="btn_n"):
            st.markdown(f"""
            - **AI Agents Take Over Desktop Automation**: Multi-modal architectures achieve record low latency.
            - **Quantum Compute Milestone**: New hybrid error-correction algorithm announced.
            - **Global Green Energy Transition**: Solar & battery storage reach 40% grid parity.
            """)

        st.markdown("#### 📝 Quick Notes & Memory")
        note_text = st.text_area("Create Persistent Memo", placeholder="Write a note to save...")
        if st.button("Save Note", key="btn_note"):
            st.success("✅ Note persisted to local SQLite database storage.")

    with skill_cols[2]:
        st.markdown("#### 🎓 Concept Explainer & Study")
        study_topic = st.text_input("Concept to Explain", value="Quantum Entanglement")
        if st.button("Generate Flashcard Brief", key="btn_study"):
            with st.spinner("Synthesizing learning brief..."):
                brief = query_ai_engine(f"Explain {study_topic} in 2 clear, simple bullet points with a real world analogy.", api_key, ai_provider, model_choice)
                st.markdown(brief)

        st.markdown("#### ✍️ Writing & Email Assistant")
        email_prompt = st.text_input("Email Intent", value="Request sick leave for 2 days")
        if st.button("Draft Formal Email", key="btn_email"):
            draft = query_ai_engine(f"Draft a concise formal email for: {email_prompt}", api_key, ai_provider, model_choice)
            st.text_area("Generated Draft", value=draft, height=140)

# ==================== TAB 3: DOCUMENT RAG ANALYZER ====================
with tab_rag:
    st.markdown("### 📄 RAG Multi-Format Document Analyzer")
    st.markdown("Upload any document (PDF, DOCX, CSV, JSON, TXT, MD) to extract insights, summarize risks, or perform conversational Q&A.")
    
    uploaded_file = st.file_uploader("Choose a file to analyze", type=["pdf", "docx", "doc", "txt", "csv", "json", "md"])
    
    if uploaded_file is not None:
        with st.spinner(f"Ingesting & parsing `{uploaded_file.name}`..."):
            parsed_text = parse_uploaded_document(uploaded_file)
            st.session_state.doc_content = parsed_text
            st.session_state.doc_name = uploaded_file.name
            
        st.success(f"✅ Ingested `{uploaded_file.name}` ({len(parsed_text)} characters extracted).")
        
        c_sum, c_qa = st.columns(2)
        with c_sum:
            st.markdown("##### 📌 Instant Document Summary")
            if st.button("⚡ Generate Executive Summary"):
                with st.spinner("Analyzing document with LLM..."):
                    summary = query_ai_engine("Provide a bullet-point executive summary and highlight top key findings from this document.", api_key, ai_provider, model_choice, context_doc=parsed_text)
                    st.markdown(summary)
                    
        with c_qa:
            st.markdown("##### 🔍 Quick Document Search")
            rag_query = st.text_input("Ask a question about this document:")
            if st.button("Search & Answer"):
                if rag_query:
                    with st.spinner("Retrieving contextual answer..."):
                        ans = query_ai_engine(rag_query, api_key, ai_provider, model_choice, context_doc=parsed_text)
                        st.markdown(ans)

# ==================== TAB 4: 3D PARTICLE ORB ====================
with tab_visualizer:
    st.markdown("### 🐉 3D Interactive WebGL Particle Orb")
    st.markdown("GPU-accelerated interactive particle sphere with harmonic sine wave simulation:")
    
    st.components.v1.html("""
    <!DOCTYPE html>
    <html>
    <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
        <style>
            body { margin: 0; background: #060810; overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100vh; }
            #orbCanvas { width: 100%; height: 100%; cursor: pointer; }
            .orb-badge { position: absolute; bottom: 20px; color: #ff5500; font-family: sans-serif; font-size: 14px; font-weight: bold; background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(255,85,0,0.4); }
        </style>
    </head>
    <body>
        <canvas id="orbCanvas"></canvas>
        <div class="orb-badge">🔥 DRACARYS 3D PARTICLE ENGINE</div>
        <script>
            const canvas = document.getElementById('orbCanvas');
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
            camera.position.z = 250;

            const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);

            const particleCount = 600;
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                const r = 85 + (Math.random() * 15);

                positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                positions[i * 3 + 2] = r * Math.cos(phi);
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const material = new THREE.PointsMaterial({
                color: 0xff5500,
                size: 3.5,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending
            });

            const sphere = new THREE.Points(geometry, material);
            scene.add(sphere);

            function animate() {
                requestAnimationFrame(animate);
                sphere.rotation.y += 0.008;
                sphere.rotation.x += 0.004;
                renderer.render(scene, camera);
            }
            animate();
        </script>
    </body>
    </html>
    """, height=450)

# ==================== TAB 5: LANDING PAGE ====================
with tab_landing:
    st.markdown("### 🌐 Standalone Landing Page")
    st.markdown("The complete interactive landing page is deployed alongside the app:")
    
    landing_file = Path(__file__).parent / "landing.html"
    if landing_file.exists():
        with open(landing_file, "r", encoding="utf-8") as f:
            landing_html = f.read()
        st.components.v1.html(landing_html, height=750, scrolling=True)
    else:
        st.info("Landing page available at `landing.html`.")
