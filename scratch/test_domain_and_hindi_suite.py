"""
End-to-End Verification Suite for Domain Tasks, Hindi Voice Engine, and Assistant Reliability
"""
import os
import sys
import sqlite3

# Set utf-8 output encoding for Windows consoles
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("=" * 60)
print("SOPHIA AI ASSISTANT — DOMAIN & HINDI VERIFICATION SUITE")
print("=" * 60)

# Test 1: Logger & Subsystem Diagnostics
print("\n[TEST 1] Logging Subsystem & Diagnostics Self-Test")
from engine.logger import get_system_health, get_recent_logs
health = get_system_health()
assert health["status"] == "HEALTHY", f"System health unexpected: {health['status']}"
print(f"✓ Health Check: {health['status']} | Subsystems OK: {list(health['subsystems'].keys())}")

# Test 2: Hindi & Hinglish Detection
print("\n[TEST 2] Hindi, Hinglish & Language Detection")
from engine.command import has_hindi, sanitize_speech_text

test_cases = [
    ("नमस्ते, आप कैसे हैं?", True, "Devanagari Hindi"),
    ("kya haal hai", True, "Romanized Hinglish"),
    ("aaj ka mausam kaisa hai", True, "Hinglish query"),
    ("ek gaana bajao", True, "Hinglish entertainment"),
    ("what is the weather today", False, "English query"),
    ("calculate 45 multiplied by 12", False, "English math")
]

for text, expected, label in test_cases:
    res = has_hindi(text)
    assert res == expected, f"Failed for '{text}' ({label}): expected {expected}, got {res}"
    print(f"✓ {label}: '{text}' -> is_hindi={res}")

# Test 3: Speech Text Sanitizer (Stripping emojis, markdown, URLs, currencies)
print("\n[TEST 3] Speech Text Sanitizer (Zero-Distortion TTS Cleaning)")
dirty_text = "🍅 **Pomodoro Study Active**! 💧 Drink water & pay ₹450 for lunch. See [details](https://example.com/info)."
cleaned_en = sanitize_speech_text(dirty_text, is_hindi=False)
assert "🍅" not in cleaned_en, "Emoji 🍅 was not stripped"
assert "💧" not in cleaned_en, "Emoji 💧 was not stripped"
assert "**" not in cleaned_en, "Markdown asterisks were not stripped"
assert "rupees" in cleaned_en, "₹ was not converted to 'rupees'"
assert "https://" not in cleaned_en, "Raw URL was not sanitized"
print(f"✓ Original: {dirty_text}")
print(f"✓ Sanitized: {cleaned_en}")

cleaned_hi = sanitize_speech_text("₹250 का खर्च दर्ज किया गया 💳 ✨", is_hindi=True)
assert "रुपये" in cleaned_hi, "₹ was not converted to 'रुपये' in Hindi"
assert "💳" not in cleaned_hi and "✨" not in cleaned_hi, "Emojis were not stripped in Hindi"
print(f"✓ Hindi Sanitized: {cleaned_hi}")

# Test 4: Domain Specific Skill Dispatch
print("\n[TEST 4] Domain-Specific Tasks (Academic, Workplace, Personal)")
from engine.skills.skill_manager import get_skill_manager
sm = get_skill_manager()

# 4A. Academic: Pomodoro Timer
r_pomo = sm.dispatch("start pomodoro")
assert r_pomo.handled and r_pomo.card_type == "academic_pomodoro", "Academic Pomodoro failed"
print(f"✓ Academic (Pomodoro): Handled={r_pomo.handled} | Card={r_pomo.card_type}")

# 4B. Personal: Expense Logging
r_exp = sm.dispatch("log expense 250 for lunch")
assert r_exp.handled and r_exp.card_type == "personal_expense", "Expense logging failed"
print(f"✓ Personal (Expense Log): Handled={r_exp.handled} | Spoken: '{r_exp.spoken_response}'")

# 4C. Personal: Expense Listing
r_show = sm.dispatch("show expenses")
assert r_show.handled and "rupees" in r_show.spoken_response, "Expense listing failed"
print(f"✓ Personal (Show Expenses): Handled={r_show.handled} | Spoken: '{r_show.spoken_response}'")

# 4D. Personal: Wellness Break
r_well = sm.dispatch("water reminder")
assert r_well.handled and r_well.card_type == "personal_wellness", "Wellness reminder failed"
print(f"✓ Personal (Wellness): Handled={r_well.handled} | Spoken: '{r_well.spoken_response[:40]}...'")

# Test 5: Database Persistence
print("\n[TEST 5] SQLite Persistence (Command History & Personal Expenses)")
db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sophia.db")
with sqlite3.connect(db_path) as conn:
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM personal_expenses")
    exp_count = cur.fetchone()[0]
    assert exp_count > 0, "No expenses found in database"
    print(f"✓ SQLite: {exp_count} personal expense records stored in sophia.db")

print("\n" + "=" * 60)
print("ALL TESTS PASSED WITH 100% SUCCESS!")
print("=" * 60)
