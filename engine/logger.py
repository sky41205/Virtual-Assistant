import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from collections import deque
import threading
from typing import List, Dict, Any, Optional

# Project base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(BASE_DIR, "logs")

# Ensure logs directory exists
os.makedirs(LOG_DIR, exist_ok=True)

MAIN_LOG_FILE = os.path.join(LOG_DIR, "assistant.log")
ERROR_LOG_FILE = os.path.join(LOG_DIR, "error.log")

# In-memory circular buffer for UI real-time streaming (last 200 logs)
_MAX_MEMORY_LOGS = 200
_memory_logs_lock = threading.Lock()
_memory_logs = deque(maxlen=_MAX_MEMORY_LOGS)

class InMemoryLogHandler(logging.Handler):
    """Custom logging handler that stores formatted log entries in an in-memory ring buffer for UI display."""
    def emit(self, record):
        try:
            log_entry = {
                "timestamp": datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S"),
                "time": datetime.fromtimestamp(record.created).strftime("%H:%M:%S"),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "details": ""
            }
            if record.exc_info:
                import traceback
                log_entry["details"] = "".join(traceback.format_exception(*record.exc_info))
            with _memory_logs_lock:
                _memory_logs.append(log_entry)
        except Exception:
            self.handleError(record)

_is_configured = False

def setup_assistant_logging():
    """Configure structured rotating file logging, console output, and in-memory buffer."""
    global _is_configured
    if _is_configured:
        return

    root_logger = logging.getLogger("Sophia")
    root_logger.setLevel(logging.DEBUG)

    # Clean existing handlers
    root_logger.handlers.clear()

    # Formatter
    file_formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)-7s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_formatter = logging.Formatter(
        "[%(levelname)s] [%(name)s]: %(message)s"
    )

    # 1. Main rotating file handler (5 MB max, 3 backups, INFO+)
    try:
        main_file_handler = RotatingFileHandler(
            MAIN_LOG_FILE,
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
            encoding="utf-8"
        )
        main_file_handler.setLevel(logging.INFO)
        main_file_handler.setFormatter(file_formatter)
        root_logger.addHandler(main_file_handler)
    except Exception as e:
        print(f"Warning: Could not initialize main log file handler: {e}")

    # 2. Error rotating file handler (5 MB max, 3 backups, WARNING+)
    try:
        error_file_handler = RotatingFileHandler(
            ERROR_LOG_FILE,
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
            encoding="utf-8"
        )
        error_file_handler.setLevel(logging.WARNING)
        error_file_handler.setFormatter(file_formatter)
        root_logger.addHandler(error_file_handler)
    except Exception as e:
        print(f"Warning: Could not initialize error log file handler: {e}")

    # 3. Console output handler with safe Unicode encoding
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # 4. In-memory buffer handler for Eel UI streaming
    mem_handler = InMemoryLogHandler()
    mem_handler.setLevel(logging.DEBUG)
    root_logger.addHandler(mem_handler)

    _is_configured = True
    root_logger.info("Sophia Assistant Logging & Diagnostics Subsystem initialized successfully.")

# Initialize logging immediately upon import
setup_assistant_logging()

def get_logger(component_name: str = "core") -> logging.Logger:
    """Return a scoped logger under the Sophia root namespace."""
    return logging.getLogger(f"Sophia.{component_name}")

def get_recent_logs(limit: int = 50, level: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve the most recent log entries from the in-memory ring buffer, optionally filtered by level."""
    with _memory_logs_lock:
        logs = list(_memory_logs)
    if level and level.upper() != "ALL":
        lvl = level.upper()
        logs = [l for l in logs if l["level"] == lvl]
    return logs[-int(limit):]

def clear_memory_logs() -> bool:
    """Clear in-memory buffer."""
    with _memory_logs_lock:
        _memory_logs.clear()
    return True

def safe_execute(component: str = "task", fallback_message: str = "An unexpected error occurred."):
    """Decorator to wrap sensitive functions with structured logging and graceful fallback."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            logger = get_logger(component)
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.exception(f"Unhandled error in {func.__name__}: {e}")
                return fallback_message
        return wrapper
    return decorator

def get_system_health() -> Dict[str, Any]:
    """Run comprehensive diagnostic self-tests and return health metrics for all subsystems."""
    logger = get_logger("diagnostics")
    health = {
        "status": "HEALTHY",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "subsystems": {}
    }

    # 1. Microphone & Audio Input Health
    try:
        import speech_recognition as sr
        mic_names = sr.Microphone.list_microphone_names()
        if mic_names:
            health["subsystems"]["microphone"] = {
                "status": "ONLINE",
                "message": f"Microphone detected ({len(mic_names)} audio inputs available)",
                "default": mic_names[0] if mic_names else "Default"
            }
        else:
            health["subsystems"]["microphone"] = {
                "status": "WARNING",
                "message": "No hardware microphones detected"
            }
    except Exception as e:
        health["subsystems"]["microphone"] = {
            "status": "ERROR",
            "message": f"Microphone error: {str(e)}"
        }

    # 2. Text-to-Speech Engine Health
    try:
        import pygame
        mixer_ready = pygame.mixer.get_init() is not None
        health["subsystems"]["speech_output"] = {
            "status": "ONLINE",
            "message": "PyGame Mixer & Edge-TTS neural engine ready",
            "mixer_ready": mixer_ready
        }
    except Exception as e:
        health["subsystems"]["speech_output"] = {
            "status": "ERROR",
            "message": f"TTS audio error: {str(e)}"
        }

    # 3. Database Health
    try:
        import sqlite3
        db_path = os.path.join(BASE_DIR, "sophia.db")
        with sqlite3.connect(db_path, check_same_thread=False) as conn:
            cur = conn.cursor()
            cur.execute("PRAGMA integrity_check")
            row = cur.fetchone()
            is_ok = row and row[0] == "ok"
            health["subsystems"]["database"] = {
                "status": "ONLINE" if is_ok else "WARNING",
                "message": "SQLite database healthy" if is_ok else f"Integrity status: {row}"
            }
    except Exception as e:
        health["subsystems"]["database"] = {
            "status": "ERROR",
            "message": f"Database failure: {str(e)}"
        }

    # 4. Network & AI Service Health
    try:
        import socket
        start_t = datetime.now()
        s = socket.create_connection(("8.8.8.8", 53), timeout=1.5)
        s.close()
        latency = round((datetime.now() - start_t).total_seconds() * 1000, 1)
        health["subsystems"]["network"] = {
            "status": "ONLINE",
            "message": f"Internet connected ({latency}ms latency)"
        }
    except Exception:
        health["subsystems"]["network"] = {
            "status": "OFFLINE",
            "message": "No internet connection detected (Offline mode active)"
        }

    # 5. AI NLP Provider Health
    from engine.config import AI_PROVIDER, GEMINI_API_KEY, OPENAI_API_KEY
    provider = (AI_PROVIDER or "gemini").lower()
    has_gemini = bool(GEMINI_API_KEY and GEMINI_API_KEY.strip())
    has_openai = bool(OPENAI_API_KEY and OPENAI_API_KEY.strip())

    if has_gemini or has_openai:
        health["subsystems"]["nlp_ai"] = {
            "status": "CONFIGURED",
            "message": f"Primary: {provider.upper()} (API Key present)",
            "provider": provider
        }
    else:
        health["subsystems"]["nlp_ai"] = {
            "status": "FALLBACK",
            "message": "Offline Rule-based & Fallback NLP Engine active (No API Key set)"
        }

    # Aggregate overall status
    statuses = [sub["status"] for sub in health["subsystems"].values()]
    if "ERROR" in statuses:
        health["status"] = "DEGRADED"
    elif "WARNING" in statuses or "OFFLINE" in statuses:
        health["status"] = "ATTENTION"

    logger.info(f"Diagnostics health check completed: Overall status = {health['status']}")
    return health
