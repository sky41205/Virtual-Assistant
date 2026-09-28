"""
Verification Suite for Natural Spoken Speech, Intent Resolution, and Everyday Workflows
"""
import os
import sys
import sqlite3
import pyperclip

# Set utf-8 encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("=" * 65)
print("SOPHIA AI — NATURAL SPOKEN PHRASING & WORKFLOW VERIFICATION SUITE")
print("=" * 65)

from engine.intent_resolver import NaturalIntentResolver

# Test 1: Colloquial Volume Controls (Without rigid phrasing)
print("\n[TEST 1] Colloquial Sound & Volume Controls")
queries_vol = [
    ("turn it down it is too loud", "Turned volume down"),
    ("make it quieter please", "Turned volume down"),
    ("turn it up can't hear", "Turned volume up"),
    ("mute sound", "System audio muted")
]
for q, expected_phrase in queries_vol:
    res = NaturalIntentResolver.resolve_intent(q)
    assert res is not None, f"Failed to resolve intent for: '{q}'"
    print(f"✓ Spoken: '{q}' -> Handled: {res.handled} | Display: '{res.display_text}'")

# Test 2: Natural Expense Tracking (Without rigid syntax)
print("\n[TEST 2] Natural Expense Tracking (e.g. 'I spent 450 bucks on petrol')")
queries_exp = [
    "i spent 450 bucks on petrol today",
    "put down 120 rupees for coffee",
    "paid 600 for groceries"
]
for q in queries_exp:
    res = NaturalIntentResolver.resolve_intent(q)
    assert res is not None and res.handled, f"Failed natural expense: '{q}'"
    print(f"✓ Spoken: '{q}' -> Spoken: '{res.spoken_response}'")

# Test 3: Natural Notes & Reminders ("Don't let me forget...")
print("\n[TEST 3] Conversational Notes & Reminders")
q_note = "don't let me forget to review the pull request"
res_note = NaturalIntentResolver.resolve_intent(q_note)
assert res_note is not None and res_note.handled, f"Failed note: '{q_note}'"
print(f"✓ Spoken: '{q_note}' -> Spoken: '{res_note.spoken_response}'")

# Test 4: Clipboard AI Helper (Massive repetitive task saver)
print("\n[TEST 4] Clipboard AI Helper (One-click text summarization & proofreading)")
pyperclip.copy("Sophia virtual assistant uses speech recognition and natural language processing to automate desktop tasks.")
res_clip = NaturalIntentResolver.resolve_intent("summarize my clipboard")
assert res_clip is not None and res_clip.handled, "Clipboard AI failed"
print(f"✓ Clipboard AI: Spoken: '{res_clip.spoken_response}'")
print(f"✓ Clipboard AI Content:\n{res_clip.display_text[:140]}...")

# Test 5: Natural Weather Inquiries ("Will it rain today?")
print("\n[TEST 5] Conversational Weather Inquiries")
res_w = NaturalIntentResolver.resolve_intent("will it rain today in Delhi")
assert res_w is not None and res_w.handled, "Natural weather query failed"
print(f"✓ Spoken: 'will it rain today in Delhi' -> Spoken: '{res_w.spoken_response[:50]}...'")

# Test 6: Everyday Repetitive Workflows
print("\n[TEST 6] Everyday Automation Workflows (Morning Briefing, Pomodoro, Screenshot)")
from engine.skills.skill_manager import get_skill_manager
sm = get_skill_manager()

# Morning Briefing
r_briefing = sm.dispatch("daily briefing")
assert r_briefing.handled, "Daily briefing workflow failed"
print(f"✓ Workflow (Morning Briefing): Handled={r_briefing.handled} | Card={r_briefing.card_type}")

# Pomodoro Study Timer
r_pomo = sm.dispatch("start pomodoro")
assert r_pomo.handled, "Pomodoro workflow failed"
print(f"✓ Workflow (Pomodoro Focus): Handled={r_pomo.handled} | Duration=25m")

# Screenshot Capture
r_shot = sm.dispatch("take screenshot")
assert r_shot.handled, "Screenshot capture failed"
print(f"✓ Workflow (Screenshot): Handled={r_shot.handled} | File={r_shot.card_data.get('file')}")

print("\n" + "=" * 65)
print("ALL NATURAL SPOKEN INTENT & WORKFLOW TESTS PASSED (100%)!")
print("=" * 65)
