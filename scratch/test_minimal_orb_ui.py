import unittest
import urllib.request
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine.language_detector import detect_language, is_hindi_or_hinglish

class TestMinimalOrbUI(unittest.TestCase):

    def setUp(self):
        self.base_url = "http://localhost:8000"

    def test_01_http_server_serves_minimal_ui(self):
        """Verify server returns 200 and the minimal UI with central AI Orb."""
        resp = urllib.request.urlopen(f"{self.base_url}/index.html", timeout=5)
        self.assertEqual(resp.status, 200)
        html = resp.read().decode("utf-8")

        # Core Hero Orb elements
        self.assertIn('id="aiOrbContainer"', html)
        self.assertIn('id="aiOrbSphere"', html)
        self.assertIn('id="audioVisualizerCanvas"', html)
        self.assertIn('id="siriMessageText"', html)
        self.assertIn("Hi, how can i Help you ...", html)

        # Specular light crescents matching image reference
        self.assertIn("top-crescent", html)
        self.assertIn("bottom-crescent", html)

        # Minimalist floating pill dock
        self.assertIn('id="textInput"', html)
        self.assertIn('id="MicBtn"', html)
        self.assertIn('id="chatbox"', html)
        self.assertIn('id="SendBtn"', html)
        self.assertIn('id="detectedLangPill"', html)

        # Live Response Card
        self.assertIn('id="activeResponseCard"', html)

    def test_02_clutter_removed_from_main_viewport(self):
        """Verify that legacy clutter (domain buttons, workflow row, sample prompts) is not cluttering viewport."""
        resp = urllib.request.urlopen(f"{self.base_url}/index.html", timeout=5)
        html = resp.read().decode("utf-8")

        # Domain mode pills shouldn't exist on main screen
        self.assertNotIn('id="tabAcademic"', html)
        self.assertNotIn('id="tabWorkplace"', html)
        self.assertNotIn('id="tabPersonal"', html)

        # Everyday workflow HUD shouldn't clutter the main screen
        self.assertNotIn('id="btnWfBriefing"', html)
        self.assertNotIn('id="btnWfPomodoro"', html)

        # Sample prompt chips shouldn't clutter the main screen
        self.assertNotIn('class="sample-prompt-chip"', html)

    def test_03_minimal_top_header_controls(self):
        """Verify top header only keeps essential controls: Cancel/Stop, History, Refresh, Settings."""
        resp = urllib.request.urlopen(f"{self.base_url}/index.html", timeout=5)
        html = resp.read().decode("utf-8")

        self.assertIn('id="btnCancelSpeech"', html)
        self.assertIn('id="ChatBtn"', html)
        self.assertIn('id="RefreshBtn"', html)
        self.assertIn('id="SettingsBtn"', html)

    def test_04_css_orb_and_dock_styling(self):
        """Verify stylesheet has orb radial gradients, cyan glow, and pill dock styling."""
        resp = urllib.request.urlopen(f"{self.base_url}/style.css", timeout=5)
        self.assertEqual(resp.status, 200)
        css = resp.read().decode("utf-8")

        self.assertIn(".ai-orb-container", css)
        self.assertIn(".ai-orb-sphere", css)
        self.assertIn(".specular-crescent.top-crescent", css)
        self.assertIn(".specular-crescent.bottom-crescent", css)
        self.assertIn(".minimal-pill-dock", css)
        self.assertIn(".active-response-card", css)

    def test_05_bilingual_detection_integrity(self):
        """Verify bilingual language detector works correctly across English, Hindi, and Hinglish."""
        en_res = detect_language("What is the current time and weather?")
        self.assertEqual(en_res["mode"], "english")

        hi_res = detect_language("आज का मौसम कैसा रहेगा?")
        self.assertEqual(hi_res["mode"], "hindi_devanagari")

        hing_res = detect_language("aaj ka mausam kaisa hai aur tum kya kar sakte ho")
        self.assertEqual(hing_res["mode"], "hinglish")

if __name__ == "__main__":
    unittest.main()
