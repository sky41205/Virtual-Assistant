import sys, os
sys.path.insert(0, os.path.abspath("."))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from engine.language_detector import detect_language

tests = [
    'What is the weather today?',
    'Open Chrome and search Wikipedia',
    'aaj ka mausam kaisa hai',
    'tum kaun ho aur kya kar sakte ho',
    'mujhe ek accha sa gaana sunao',
    'kya haal hai bhai',
    'आज का मौसम कैसा रहेगा?',
    'तुम कौन हो?',
    'नमस्ते, आप कैसे हैं?',
    'tell me a story in hindi',
    'quantum computing ko hindi me samjhao',
    'spent 400 on lunch'
]

print("-" * 65)
for t in tests:
    res = detect_language(t)
    print(f"{t:40} -> {res['mode']:16} {res['label']}")
print("-" * 65)
