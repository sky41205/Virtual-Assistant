from typing import List, Dict, Tuple, Optional, Any
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.skills.control_skill import AppControlSkill
from engine.skills.calculator_skill import CalculatorSkill
from engine.skills.study_skill import StudySkill
from engine.skills.writing_skill import WritingSkill
from engine.skills.notes_skill import NotesSkill
from engine.skills.calendar_skill import CalendarSkill
from engine.skills.productivity_skill import ProductivitySkill
from engine.skills.datetime_skill import DateTimeSkill
from engine.skills.weather_skill import WeatherSkill
from engine.skills.news_skill import NewsSkill
from engine.skills.maps_skill import MapsSkill
from engine.skills.search_skill import WebSearchSkill
from engine.skills.navigation_skill import WebsiteNavigationSkill
from engine.skills.system_skill import SystemInformationSkill
from engine.skills.automation_skill import SafeAutomationSkill
from engine.skills.domain_skill import DomainSpecificSkill
from engine.skills.conversation_skill import GeneralConversationSkill

class SkillManager:
    """Master registry and coordinator for all voice command skills."""

    def __init__(self):
        self.skills: List[BaseSkill] = [
            AppControlSkill(),
            SafeAutomationSkill(),
            SystemInformationSkill(),
            CalculatorSkill(),
            StudySkill(),
            WritingSkill(),
            NotesSkill(),
            CalendarSkill(),
            ProductivitySkill(),
            DateTimeSkill(),
            WeatherSkill(),
            NewsSkill(),
            MapsSkill(),
            WebSearchSkill(),
            WebsiteNavigationSkill(),
            DomainSpecificSkill(),      # Domain-specific tasks for Academic, Workplace, Personal
            GeneralConversationSkill()  # Fallback LLM brain
        ]
        self.pending_confirmations: Dict[str, Tuple[BaseSkill, str]] = {}

    def dispatch(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        """Route user query to the most specific matching skill."""
        if not query or not query.strip():
            return SkillResult(handled=False, spoken_response="")

        # Check for confirmation responses ("yes", "confirm", "proceed", "cancel", "no")
        q_norm = query.lower().strip()
        if self.pending_confirmations:
            if q_norm in ["yes", "confirm", "proceed", "sure", "haan", "sahi hai", "ok"]:
                # Pop last confirmation
                action_id, (skill, orig_id) = self.pending_confirmations.popitem()
                res = skill.confirm(orig_id, context)
                res.assistant_state = "speaking"
                return res
            elif q_norm in ["no", "cancel", "stop", "abort", "nahin", "mat karo"]:
                self.pending_confirmations.clear()
                return SkillResult(handled=True, spoken_response="Action cancelled as requested.", assistant_state="idle")

        for skill in self.skills:
            try:
                if skill.can_handle(query, context):
                    result = skill.execute(query, context)
                    if result.handled:
                        # Record pending confirmation if required
                        if result.requires_confirmation and result.confirmation_action_id:
                            self.pending_confirmations[result.confirmation_action_id] = (skill, result.confirmation_action_id)
                            result.assistant_state = "confirmation"
                        else:
                            result.assistant_state = "speaking"
                        return result
            except Exception as e:
                print(f"Error in {skill.name}: {e}")
                continue

        return SkillResult(handled=False, spoken_response="I'm not sure how to handle that request.")

    def confirm_action(self, action_id: str, confirmed: bool) -> SkillResult:
        """Called directly by UI buttons for confirmation prompts."""
        if action_id in self.pending_confirmations:
            skill, orig_id = self.pending_confirmations.pop(action_id)
            if confirmed:
                return skill.confirm(orig_id)
            else:
                return SkillResult(handled=True, spoken_response="Action cancelled.")
        return SkillResult(handled=False, spoken_response="No pending action found.")

_global_skill_manager = None

def get_skill_manager() -> SkillManager:
    global _global_skill_manager
    if _global_skill_manager is None:
        _global_skill_manager = SkillManager()
    return _global_skill_manager
