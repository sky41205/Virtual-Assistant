import re
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.llm import ask_dracarys

class WritingSkill(BaseSkill):
    name = "writing_skill"
    description = "Writing Assistant: drafts emails, project documentation, rewrites text, and formats structured content."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        triggers = [
            "draft an email", "write an email", "compose an email", "draft a message",
            "write documentation", "project documentation", "create a readme",
            "rewrite this", "rewrite more professionally", "make this sound professional",
            "make this more concise", "proofread", "draft a proposal", "write a letter"
        ]
        return any(t in q for t in triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # 1. Email Drafting
        if any(w in q for w in ["draft an email", "write an email", "compose an email"]):
            prompt = (
                f"You are an expert executive writing assistant. Draft an email based on this request: '{query}'. "
                "Include a clean Subject Line, professional greeting, body paragraphs, and formal closing. "
                "Keep the spoken reply brief (1 sentence confirming the draft), while displaying the complete formatted email on screen."
            )
            response = ask_dracarys(prompt) or "Here is the email draft for you."
            spoken = "I've drafted the email for you. You can review and copy it from the screen."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="email_draft",
                card_data={"query": query, "content": response}
            )

        # 2. Text Rewriting / Polishing
        if any(w in q for w in ["rewrite", "make this sound", "more concise", "proofread"]):
            prompt = (
                f"You are a master editor. Rewrite the following text to be professional, engaging, and clear: '{query}'. "
                "Provide: 1. The polished version, and 2. A bulleted note of key improvements made."
            )
            response = ask_dracarys(prompt) or "Here is your rewritten text."
            spoken = "I've polished and rewritten the text for you with improved clarity."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="rewrite",
                card_data={"query": query, "content": response}
            )

        # 3. Documentation / Structured Content
        prompt = (
            f"You are a technical writer. Create structured, publication-quality documentation for: '{query}'. "
            "Use clear markdown headings, overview, setup steps, and best practices. "
            "Keep the spoken answer to 1 sentence."
        )
        response = ask_dracarys(prompt) or "Here is the requested documentation."
        spoken = "I've generated the structured documentation. You can view the full guide on screen."

        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=response,
            card_type="documentation",
            card_data={"query": query, "content": response}
        )
