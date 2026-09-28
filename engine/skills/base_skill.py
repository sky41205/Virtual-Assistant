from dataclasses import dataclass, field
from typing import Optional, Dict, Any, Tuple
from abc import ABC, abstractmethod

@dataclass
class SkillResult:
    handled: bool
    spoken_response: str
    display_text: Optional[str] = None
    card_type: str = "none"  # "none", "weather", "search", "task", "link", "confirmation", "info"
    card_data: Dict[str, Any] = field(default_factory=dict)
    requires_confirmation: bool = False
    confirmation_action_id: str = ""
    confirmation_prompt: str = ""
    assistant_state: str = "idle"  # "idle", "listening", "processing", "speaking", "error", "confirmation"

class BaseSkill(ABC):
    """Abstract base class for all modular voice skills."""
    name: str = "base_skill"
    description: str = ""

    @abstractmethod
    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        """Return True if this skill is capable of handling the query."""
        pass

    @abstractmethod
    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        """Execute the skill and return a structured SkillResult."""
        pass

    def confirm(self, action_id: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        """Execute consequential action after user confirmed."""
        return SkillResult(handled=False, spoken_response="Action not implemented.")
