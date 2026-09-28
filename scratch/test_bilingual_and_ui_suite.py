import sys, os
sys.path.insert(0, os.path.abspath("."))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import unittest
from engine.language_detector import detect_language, is_hindi_or_hinglish
from engine.llm import get_system_prompt, _fallback_answer
from engine.command import sanitize_speech_text, has_hindi, detectLanguageMode

class TestBilingualLanguageMirroring(unittest.TestCase):

    def test_english_detection(self):
        queries = [
            "What is the capital of France?",
            "Open Google Chrome",
            "Set a timer for 10 minutes",
            "How does quantum computing work?",
            "Tell me a funny joke"
        ]
        for q in queries:
            res = detect_language(q)
            self.assertEqual(res["mode"], "english", f"Expected english for '{q}', got '{res['mode']}'")
            self.assertEqual(res["language"], "en")
            self.assertEqual(res["script"], "latin")

    def test_hindi_devanagari_detection(self):
        queries = [
            "आज का मौसम कैसा रहेगा?",
            "तुम कौन हो?",
            "नमस्ते, आप कैसे हैं?",
            "मुझे एक अच्छी कहानी सुनाओ",
            "भारत की राजधानी क्या है?"
        ]
        for q in queries:
            res = detect_language(q)
            self.assertEqual(res["mode"], "hindi_devanagari", f"Expected hindi_devanagari for '{q}', got '{res['mode']}'")
            self.assertEqual(res["language"], "hi")
            self.assertEqual(res["script"], "devanagari")

    def test_hinglish_detection(self):
        queries = [
            "aaj ka mausam kaisa hai",
            "tum kaun ho aur kya kar sakte ho",
            "mujhe ek kahani sunao",
            "kya haal hai bhai",
            "kaise ho",
            "namaste dracarys",
            "tell me a story in hindi",
            "gravity ko hindi me samjhao"
        ]
        for q in queries:
            res = detect_language(q)
            self.assertEqual(res["mode"], "hinglish", f"Expected hinglish for '{q}', got '{res['mode']}'")
            self.assertEqual(res["language"], "hi")
            self.assertEqual(res["script"], "latin")

    def test_fallback_answers_mirror_script(self):
        from engine.config import ASSISTANT_NAME
        # 1. English query -> English response
        ans_en = _fallback_answer("who are you", "")
        self.assertIn(ASSISTANT_NAME, ans_en)
        self.assertTrue(detect_language(ans_en)["mode"] == "english", f"Expected English answer, got: {ans_en}")

        # 2. Devanagari Hindi query -> Devanagari Hindi response
        ans_deva = _fallback_answer("तुम कौन हो", "")
        self.assertIn(ASSISTANT_NAME, ans_deva)
        self.assertTrue(detect_language(ans_deva)["mode"] == "hindi_devanagari", f"Expected Devanagari answer, got: {ans_deva}")

        # 3. Hinglish query -> Hinglish (Roman script) response
        ans_hing = _fallback_answer("tum kaun ho", "")
        self.assertIn(ASSISTANT_NAME, ans_hing)
        self.assertTrue(detect_language(ans_hing)["mode"] == "hinglish", f"Expected Hinglish answer, got: {ans_hing}")
        # Crucial check: Hinglish answer must NOT contain Devanagari characters
        import re
        self.assertFalse(bool(re.search(r'[\u0900-\u097F]', ans_hing)), f"Hinglish answer contained Devanagari characters: {ans_hing}")

    def test_system_prompt_script_directives(self):
        p_en = get_system_prompt("english")
        self.assertIn("STRICT SCRIPT & LANGUAGE REQUIREMENT (English)", p_en)

        p_deva = get_system_prompt("hindi_devanagari")
        self.assertIn("STRICT SCRIPT & LANGUAGE REQUIREMENT (Hindi Devanagari)", p_deva)
        self.assertIn("DEVANAGARI SCRIPT", p_deva)

        p_hing = get_system_prompt("hinglish")
        self.assertIn("STRICT SCRIPT & LANGUAGE REQUIREMENT (Hinglish", p_hing)
        self.assertIn("EXACT SAME ROMAN SCRIPT", p_hing)

    def test_speech_sanitization(self):
        dirty = "Hello! 👋 Check **this** out: `code` and ₹500 at https://example.com"
        clean = sanitize_speech_text(dirty, is_hindi=False)
        self.assertNotIn("👋", clean)
        self.assertNotIn("**", clean)
        self.assertNotIn("`", clean)
        self.assertNotIn("https://", clean)
        self.assertIn("500 rupees", clean)

    def test_eel_detect_endpoint(self):
        res = detectLanguageMode("aaj ka mausam kaisa hai")
        self.assertEqual(res["mode"], "hinglish")
        self.assertEqual(res["tts_voice_type"], "hi")

if __name__ == "__main__":
    unittest.main()
