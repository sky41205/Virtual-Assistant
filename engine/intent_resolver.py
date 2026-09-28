"""
Natural Language Intent & Entity Resolver
Allows users to speak naturally without rigid phrasing or exact keywords.
Handles conversational idioms, colloquialisms, clipboard automation, and everyday workflows.
"""
import re
import os
import pyperclip
from typing import Optional, Dict, Any
from engine.logger import get_logger
from engine.skills.base_skill import SkillResult

logger = get_logger("intent_resolver")

def get_clipboard_content() -> str:
    """Safely fetch current text from the clipboard."""
    try:
        text = pyperclip.paste()
        return text.strip() if text else ""
    except Exception as e:
        logger.warning(f"Could not read clipboard: {e}")
        return ""

def set_clipboard_content(text: str) -> bool:
    """Safely copy text back to the clipboard."""
    try:
        pyperclip.copy(text)
        return True
    except Exception as e:
        logger.warning(f"Could not write to clipboard: {e}")
        return False

class NaturalIntentResolver:
    """
    Translates free-form conversational spoken queries into structured assistant actions.
    Eliminates the requirement for rigid, exact command syntax.
    """

    @classmethod
    def resolve_intent(cls, query: str) -> Optional[SkillResult]:
        if not query or not query.strip():
            return None

        q = query.lower().strip()
        logger.info(f"Resolving natural spoken intent for: '{query}'")

        # ==============================================================
        # 1. VOLUME & SOUND CONTROLS (Colloquial & Natural Phrasing)
        # ==============================================================
        vol_down_patterns = [
            "turn it down", "turn down the sound", "turn down the volume", "too loud",
            "make it quieter", "drop the sound", "lower the volume", "lower sound",
            "decrease volume", "sound is too high", "aawaz kam karo", "awaaz kam karo",
            "bahut tej hai", "volume thoda kam karo"
        ]
        if any(p in q for p in vol_down_patterns):
            from engine.skills.system_skill import SystemInformationSkill
            return SystemInformationSkill().execute(query)

        vol_up_patterns = [
            "turn it up", "turn up the sound", "turn up the volume", "can't hear",
            "make it louder", "raise the volume", "crank it up", "louder please",
            "increase volume", "volume badhao", "aawaz badhao", "awaaz badhao",
            "thoda aawaz badhao"
        ]
        if any(p in q for p in vol_up_patterns):
            from engine.skills.system_skill import SystemInformationSkill
            return SystemInformationSkill().execute(query)

        mute_patterns = [
            "shut up", "silence please", "mute sound", "mute volume", "be quiet",
            "chup raho", "shant raho", "aawaz band karo", "awaaz band karo", "chup", "shant",
            "stop speech", "stop talking", "ruko", "pause speech"
        ]
        if q == "mute" or any(p in q for p in mute_patterns):
            from engine.command import stop_speech
            stop_speech()
            from engine.language_detector import detect_language
            l_mode = detect_language(query).get("mode", "english")
            if l_mode == "hindi_devanagari":
                spoken = "आवाज़ रोक दी गई है।"
            elif l_mode == "hinglish":
                spoken = "Aawaz rok di gayi hai."
            else:
                spoken = "Speech paused."
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=f"🔇 **{spoken}**",
                card_type="action_result",
                card_data={"action": "speech_paused", "status": "SUCCESS"}
            )

        # ==============================================================
        # 2. CLIPBOARD AI AUTOMATION (Saves massive repetitive effort)
        # ==============================================================
        clip_patterns = [
            "summarize my clipboard", "summarize clipboard", "what did i copy",
            "summarize what's on my clipboard", "clipboard summary", "explain clipboard",
            "explain what i copied", "fix grammar in clipboard", "proofread my clipboard",
            "check clipboard"
        ]
        if any(p in q for p in clip_patterns):
            clip_text = get_clipboard_content()
            if not clip_text:
                return SkillResult(
                    handled=True,
                    spoken_response="Your clipboard is currently empty. Copy some text first!",
                    display_text="📋 **Clipboard is Empty**\nCopy text from any document or webpage, then ask me to summarize or explain it.",
                    card_type="info"
                )

            from engine.llm import ask_dracarys
            if any(w in q for w in ["fix grammar", "proofread"]):
                prompt = (
                    f"Proofread and polish this text for pristine professional grammar, clarity, and tone: '{clip_text}'. "
                    "Output the polished text directly, followed by 2 bullet points explaining key improvements made."
                )
                spoken = "I have proofread and improved your copied text, and copied the result back to your clipboard."
            elif any(w in q for w in ["explain"]):
                prompt = f"Explain this copied snippet or code with crystal clarity in 3 structured points: '{clip_text}'"
                spoken = "Here is the explanation of your copied text."
            else:
                prompt = (
                    f"Provide an executive, high-yield summary of this clipboard text in 3 bullet points: '{clip_text}'. "
                    "Keep spoken answer to exactly 1 concise sentence."
                )
                spoken = "I've summarized your clipboard content. The polished breakdown is on screen."

            processed_result = ask_dracarys(prompt)
            set_clipboard_content(processed_result)

            display = f"📋 **Clipboard AI Assistant**\n\n{processed_result}\n\n*✓ Result has been automatically copied to your clipboard.*"
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="action_result",
                card_data={"action": "clipboard_ai", "status": "SUCCESS"}
            )

        # ==============================================================
        # 3. CONVERSATIONAL WEATHER & OUTSIDE CONDITIONS
        # ==============================================================
        weather_natural = [
            "need an umbrella", "is it gonna rain", "will it rain", "what's it like outside",
            "how hot is it", "how cold is it", "outside weather", "bahar ka mausam",
            "baarish hogi kya", "dhoop niklegi kya"
        ]
        if any(p in q for p in weather_natural):
            # Extract city if mentioned (e.g. "is it gonna rain in Mumbai")
            city = ""
            city_match = re.search(r'\b(?:in|at|for)\s+([a-zA-Z]+)\b', q)
            if city_match:
                city = city_match.group(1)

            from engine.skills.weather_skill import WeatherSkill
            res = WeatherSkill().execute(f"weather in {city}" if city else "weather")
            if res.handled:
                # Add conversational answer prefix
                if "umbrella" in q or "rain" in q or "baarish" in q:
                    res.spoken_response = f"Checking conditions: {res.spoken_response}"
                return res

        # ==============================================================
        # 4. NATURAL EXPENSE TRACKING ("spent 450 bucks on lunch")
        # ==============================================================
        exp_match = re.search(r'(?:spent|paid|cost|put down|add)\s*(?:about|around)?\s*(?:rs|inr|₹|\$)?\s*(\d+(?:\.\d{1,2})?)\s*(?:bucks|rupees|rs)?\s*(?:on|for|in)?\s*([a-zA-Z\s]+)?', q)
        if exp_match and any(w in q for w in ["spent", "paid", "cost", "bucks", "lunch", "dinner", "groceries", "fuel", "travel", "coffee", "kharch"]):
            from engine.skills.domain_skill import DomainSpecificSkill
            res = DomainSpecificSkill().execute(query)
            if res.handled:
                return res

        # ==============================================================
        # 5. NATURAL MEDIA PLAYBACK ("put on some lo-fi jazz", "let's hear taylor swift")
        # ==============================================================
        music_patterns = [
            "put on some", "put on", "let's hear", "let's listen to", "listen to",
            "play some", "pull up some", "koi gaana chalao", "gaana sunao", "kuch baja do"
        ]
        for mp in music_patterns:
            if q.startswith(mp) or f" {mp} " in q:
                music_query = q.replace(mp, "").strip()
                music_query = re.sub(r'\b(?:on youtube|please|music|track|songs|song)\b', '', music_query).strip()
                if music_query:
                    from engine.features import PlayYoutube
                    PlayYoutube(music_query)
                    from engine.language_detector import detect_language
                    m_mode = detect_language(query).get("mode", "english")
                    if m_mode == "hindi_devanagari":
                        spoken = f"YouTube पर {music_query} चला रहा हूँ।"
                        display = f"▶ **YouTube मीडिया**: {music_query.title()}"
                    elif m_mode == "hinglish":
                        spoken = f"YouTube par {music_query} play kar raha hoon."
                        display = f"▶ **Playing Media**: {music_query.title()} on YouTube"
                    else:
                        spoken = f"Playing {music_query} on YouTube."
                        display = f"▶ **Playing Media**: {music_query.title()} on YouTube"

                    return SkillResult(
                        handled=True,
                        spoken_response=spoken,
                        display_text=display,
                        card_type="media",
                        card_data={"action": "youtube", "query": music_query}
                    )

        # ==============================================================
        # 6. NATURAL APP LAUNCHING ("fire up chrome", "bring up notepad")
        # ==============================================================
        app_patterns = ["fire up", "bring up", "switch to", "let's open", "can you open", "zara kholo"]
        for ap in app_patterns:
            if ap in q:
                app_target = q.replace(ap, "").strip()
                app_target = re.sub(r'\b(?:please|for me|app|software|program)\b', '', app_target).strip()
                if app_target:
                    from engine.features import openCommand
                    openCommand(f"open {app_target}")
                    from engine.language_detector import detect_language
                    a_mode = detect_language(query).get("mode", "english")
                    if a_mode == "hindi_devanagari":
                        spoken = f"ज़रूर! {app_target} खोल रहा हूँ।"
                        display = f"🚀 **खोला गया**: {app_target.title()}"
                    elif a_mode == "hinglish":
                        spoken = f"Zaroor! {app_target} open kar raha hoon."
                        display = f"🚀 **Launched**: {app_target.title()}"
                    else:
                        spoken = f"Opening {app_target}."
                        display = f"🚀 **Launched**: {app_target.title()}"

                    return SkillResult(
                        handled=True,
                        spoken_response=spoken,
                        display_text=display,
                        card_type="action_result",
                        card_data={"action": "open", "query": app_target}
                    )

        # ==============================================================
        # 7. SCREENSHOT & WORKSTATION LOCK
        # ==============================================================
        if any(w in q for w in ["take a snap", "take a screenshot", "grab a screenshot", "capture screen", "screenshot le lo"]):
            from engine.skills.system_skill import SystemInformationSkill
            res = SystemInformationSkill().execute("screenshot")
            return res

        if any(w in q for w in ["lock my computer", "lock pc", "lock the screen", "pc lock karo"]):
            from engine.skills.system_skill import SystemInformationSkill
            res = SystemInformationSkill().execute("lock pc")
            return res

        # ==============================================================
        # 8. CONVERSATIONAL NOTES ("don't let me forget to call mom")
        # ==============================================================
        note_match = re.search(r"(?:don't let me forget to|remember that i need to|jot down that|write down that|remind me to)\s+(.+)", q)
        if note_match:
            note_content = note_match.group(1).strip()
            from engine.skills.notes_skill import NotesSkill
            res = NotesSkill().execute(f"create a note {note_content}")
            if res.handled:
                res.spoken_response = f"Got it. I've noted down: {note_content}."
                return res

        # ==============================================================
        # 9. REPETITIVE WORKFLOW AUTOMATION ("start my day", "morning routine")
        # ==============================================================
        if any(w in q for w in ["start my day", "morning briefing", "daily briefing", "what's on deck today"]):
            from engine.skills.automation_skill import SafeAutomationSkill
            res = SafeAutomationSkill().execute("daily briefing")
            if res.handled:
                return res

        return None
