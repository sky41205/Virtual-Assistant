# DRACARYS AI Virtual Assistant

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Google Gemini](https://img.shields.io/badge/Gemini_AI-3.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Dracarys AI** is a next-generation bilingual (English & Hindi) autonomous desktop AI assistant built with Python, Eel WebSocket IPC, and modern WebGL HUD interfaces. It combines hands-free voice intelligence, full desktop OS automation, multi-format RAG document querying, and 15+ modular skills into a zero-latency local companion.

---

## ✨ Key Features

- 🎙️ **Bilingual Speech & Neural Voices**: Native code-switching between English, Hindi (हिंदी), and Hinglish with Microsoft Azure Edge Neural voices (*Madhur*, *Swara*, *Neerja*).
- 🧠 **Hybrid Multi-LLM Brain**: Pre-warmed Google Gemini 3.5 Flash core with automatic OpenAI GPT-4o fallback for high-availability conversational intelligence.
- 🐉 **3D WebGL Particle HUD & Dracarys Fire**: Real-time Three.js audio-reactive harmonic sine-wave visualizer and dragonfire effects.
- ⚡ **Full OS & Hardware Automation**: Hands-free application launcher, system volume, brightness, battery metrics, screenshot capture, and process management.
- 📄 **RAG Multi-Format Document Analyzer**: Contextual parsing and question answering across PDF, Word (DOCX), CSV, JSON, TXT, and Markdown files (`Ctrl + U`).
- 💬 **WhatsApp & Phone Calling Suite**: Hands-free WhatsApp messaging, voice/video call triggers, and contact fuzzy matching.
- 🧩 **15+ Modular Skill Engines**: Isolated, high-performance skills for Weather, Math & Unit Conversions, Maps & Transit, Live News, Quick Notes, Calendar & Reminders, and Writing assistance.
- 🌐 **Modern Interactive Landing Page**: Included standalone [landing.html](landing.html) with live assistant playground and audio synthesis testing.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.10+, Eel (WebSocket IPC), PyAutoGUI, SpeechRecognition, Pyttsx3, Edge-TTS, Requests, BeautifulSoup4
- **Frontend**: HTML5, CSS3 Glassmorphism, TypeScript / JavaScript ES6+, Three.js (3D WebGL), Bootstrap 5
- **AI & NLP**: Google Gemini 3.5 Flash, OpenAI GPT-4o, Custom Devanagari/Hinglish Language Detector
- **Storage**: SQLite local database for conversations, contact books, and persistent memory

---

## 🚀 Quickstart & Installation

### Prerequisites

Make sure you have **Python 3.10+** and **Git** installed on your system.

### 1. Clone the Repository

```bash
git clone https://github.com/sky41205/Virtual-Assistant.git
cd Virtual-Assistant
```

### 2. Set Up a Virtual Environment

```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Copy the example environment template and add your API keys:

```bash
copy .env.example .env
```

Edit `.env` with your preferred settings:

```env
ASSISTANT_NAME=Dracarys
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
SPEECH_LANG=en-IN
TTS_HINDI_VOICE=hi-IN-MadhurNeural
TTS_ENGLISH_VOICE=en-IN-NeerjaNeural
ASSISTANT_THEME=fire
```

> 💡 *Note: You can get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).*

### 5. Launch Dracarys AI

```bash
python main.py
```

*Or simply double-click `run.bat` on Windows for one-click startup!*

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `Win + J` | Global wake shortcut to bring Dracarys to the foreground |
| `Ctrl + M` | Toggle Microphone & Voice Recognition |
| `Ctrl + U` | Open Document File Ingestion (PDF, DOCX, CSV, TXT) |
| `Ctrl + H` | Open Conversation & Task History |
| `Ctrl + ,` | Open Voice, Accent & Theme Settings |
| `Esc` | Stop Speaking / Mute Audio Voice Output |
| `D` | Trigger 3D Dragonfire Dracarys Mode |

---

## 🗣️ Supported Commands & Examples

### 🌐 Query Answering & Bilingual Chat
- *"Tell me about quantum computing in simple terms."*
- *"कल का मौसम कैसा रहेगा और 15% डिस्काउंट के बाद 4500 कितना होगा?"* (Hindi)

### 💻 Desktop App & OS Automation
- *"Open Visual Studio Code"*
- *"Open Notepad and increase system volume to 80%"*
- *"Take a screenshot"*

### 📱 Communication & WhatsApp
- *"Send WhatsApp message to Ali: Meeting is at 4 PM"*
- *"Ali ko WhatsApp par call karo"*

### 📄 Document Analysis (RAG)
- Upload file with `Ctrl + U` and ask: *"Summarize the risk clauses in this agreement."*

### 🎵 Multimedia & YouTube
- *"Play Hans Zimmer Interstellar soundtrack on YouTube"*
- *"Search for latest machine learning research on YouTube"*

---

## 📂 Project Structure

```
Virtual-Assistant/
├── engine/                   # Python core engine & modular skills
│   ├── skills/               # 15+ modular skill implementations
│   │   ├── automation_skill.py
│   │   ├── calculator_skill.py
│   │   ├── calendar_skill.py
│   │   ├── system_skill.py
│   │   └── ...
│   ├── app_launcher.py       # Start menu and app indexing
│   ├── command.py            # Command router & eel exposed bridges
│   ├── communication.py      # WhatsApp & telephony automation
│   ├── config.py             # App configurations & .env manager
│   ├── document_analyzer.py  # RAG document parser
│   ├── intent_resolver.py    # Intent classifier & pattern matcher
│   ├── language_detector.py  # Hindi/English NLP detector
│   ├── llm.py                # Gemini & OpenAI client wrapper
│   └── logger.py             # Logging subsystem
├── src/                      # TypeScript frontend source
├── www/                      # Web UI (Eel viewport assets)
│   ├── index.html            # Main desktop application interface
│   ├── landing.html          # In-app landing page
│   ├── style.css             # Glassmorphism design system
│   └── assets/               # Audio clips, icons, and 3D vendor scripts
├── landing.html              # Standalone web landing page
├── main.py                   # Application entrypoint
├── requirements.txt          # Python dependencies
├── run.bat                   # Windows one-click launcher
└── .env.example              # Environment variables template
```

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome! Feel free to open an issue or submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
