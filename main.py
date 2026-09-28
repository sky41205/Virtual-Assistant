import os
import socket
import eel
import webbrowser
from engine.logger import get_logger
from engine.features import *
from engine.command import *

logger = get_logger("main")

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def on_client_close(page, sockets):
    """Keep Eel server alive even if client tab refreshes or reconnects."""
    logger.debug(f"Web client socket closed on '{page}'. Remaining sockets: {len(sockets)}")

def start_assistant():
    eel.init('www')

    port = 8000
    if is_port_in_use(port):
        port = 8001
        while is_port_in_use(port):
            port += 1

    logger.info(f"AI Virtual Assistant launching on http://localhost:{port}/index.html")
    playAssistantSound()

    # Pre-warm Gemini client in background — eliminates cold-start on first query
    import threading
    def _prewarm_llm():
        try:
            from engine.llm import get_gemini_client
            get_gemini_client()
            logger.info("Gemini client pre-warmed successfully.")
        except Exception as e:
            logger.debug(f"Gemini pre-warm skipped: {e}")
    threading.Thread(target=_prewarm_llm, daemon=True).start()

    try:
        ret = os.system(f'start chrome.exe --app="http://localhost:{port}/index.html"')
        if ret != 0:
            webbrowser.open(f"http://localhost:{port}/index.html")
    except Exception as e:
        logger.warning(f"Chrome launch notice: {e}, using default browser.")
        webbrowser.open(f"http://localhost:{port}/index.html")

    try:
        eel.start(
            'index.html',
            mode=None,
            host='localhost',
            port=port,
            block=True,
            close_callback=on_client_close
        )
    except Exception as e:
        logger.exception(f"Assistant server runtime error: {e}")

if __name__ == '__main__':
    start_assistant()