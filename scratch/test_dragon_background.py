import os
import unittest
import urllib.request

class TestDragonBackground(unittest.TestCase):

    def setUp(self):
        self.base_url = "http://localhost:8000"

    def test_01_three_js_vendor_file_exists(self):
        vendor_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "www", "assets", "vendore", "three.min.js")
        self.assertTrue(os.path.exists(vendor_path), "three.min.js must exist locally")
        self.assertGreater(os.path.getsize(vendor_path), 500000, "three.min.js must be a valid complete Three.js build")

    def test_02_html_dragon_canvas_and_video_present(self):
        resp = urllib.request.urlopen(f"{self.base_url}/index.html", timeout=5)
        self.assertEqual(resp.status, 200)
        html = resp.read().decode("utf-8")

        self.assertIn('id="dragonBackgroundContainer"', html)
        self.assertIn('id="dragon3DCanvas"', html)
        self.assertIn('id="dragonVideoPlayer"', html)
        self.assertIn('id="btnDragonDracarys"', html)
        # btnDragonMode + btnDragonToggle intentionally removed (non-functional)
        self.assertNotIn('id="btnDragonMode"', html)
        self.assertNotIn('id="btnDragonToggle"', html)
        self.assertIn('assets/vendore/three.min.js', html)

        # Background image customizer
        self.assertIn('bg-preset-grid', html)
        self.assertIn('id="bgImageUploadInput"', html)
        self.assertIn('data-bg="nebula"', html)
        self.assertIn('data-bg="aurora"', html)

    def test_03_css_dragon_styling_present(self):
        resp = urllib.request.urlopen(f"{self.base_url}/style.css", timeout=5)
        self.assertEqual(resp.status, 200)
        css = resp.read().decode("utf-8")

        self.assertIn(".dragon-bg-container", css)
        self.assertIn(".dragon-canvas", css)
        self.assertIn(".dragon-video-layer", css)
        self.assertIn(".video-mode-filter", css)
        self.assertIn(".dragon-fire-btn", css)
        self.assertIn("dragonFirePulse", css)

    def test_04_bundle_has_dragon_logic(self):
        resp = urllib.request.urlopen(f"{self.base_url}/dist/app.bundle.js", timeout=5)
        self.assertEqual(resp.status, 200)
        bundle = resp.read().decode("utf-8")

        self.assertIn("DragonBackground", bundle)
        self.assertIn("triggerFireBreath", bundle)
        self.assertIn("dracarys", bundle.lower())

if __name__ == "__main__":
    unittest.main()
