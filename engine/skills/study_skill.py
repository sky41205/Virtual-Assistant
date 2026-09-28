import re
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.llm import ask_dracarys

class StudySkill(BaseSkill):
    name = "study_skill"
    description = "Study Assistant: concept explanations, quiz generation, note summaries, and exam prep."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        study_triggers = [
            "quiz me on", "give me a quiz", "create a quiz", "test my knowledge",
            "explain the concept of", "explain to me like i am five", "eli5",
            "study guide for", "exam prep for", "summarize my notes", "summarize these notes",
            "flashcards for", "study notes on", "help me study"
        ]
        return any(t in q for t in study_triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # 1. Quiz Generation
        if any(w in q for w in ["quiz me", "give me a quiz", "create a quiz", "test my knowledge"]):
            topic = q
            for p in ["quiz me on", "give me a quiz on", "create a quiz on", "test my knowledge on", "quiz me", "give me a quiz"]:
                topic = topic.replace(p, "").strip()
            topic = topic or "general science"

            prompt = (
                f"You are a brilliant study tutor. Create a fun, interactive 3-question quiz on '{topic}'. "
                "Format clearly with: Question 1, multiple choice options (A, B, C, D), and a brief hidden answer key at the bottom. "
                "Keep the spoken summary encouraging and concise (1-2 sentences), while providing the full interactive quiz in the text."
            )
            response = ask_dracarys(prompt) or f"Here is a quick quiz on {topic} for you!"
            spoken = f"I've generated a 3-question quiz on {topic} for you. Check the screen to test your knowledge!"

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="quiz",
                card_data={"topic": topic, "content": response}
            )

        # 2. Concept Explanation / ELI5
        if any(w in q for w in ["explain the concept", "explain to me like", "eli5", "explain concept"]):
            topic = q
            for p in ["explain the concept of", "explain to me like i am five", "eli5", "explain concept of", "explain"]:
                topic = topic.replace(p, "").strip()
            topic = topic or "this topic"

            prompt = (
                f"Explain '{topic}' with crystal clarity. Use an intuitive real-world analogy, "
                "followed by 3 clear key takeaway bullet points. Keep the spoken explanation concise and conversational (under 3 sentences)."
            )
            response = ask_dracarys(prompt)
            spoken = re.sub(r'[\*\#\_`]', '', (response.split('\n\n')[0] if response else f"Here is an explanation of {topic}."))

            return SkillResult(
                handled=True,
                spoken_response=spoken[:220],
                display_text=response or f"Explanation of {topic}",
                card_type="study_concept",
                card_data={"topic": topic, "content": response}
            )

        # 3. Exam Prep / Flashcards
        prompt = (
            f"You are an academic exam prep tutor. Provide a high-yield study sheet for: '{query}'. "
            "Include: 1. Core Principles, 2. Important Formulas/Definitions, and 3. Common Exam Pitfalls. "
            "Keep the spoken introduction to 1-2 sentences."
        )
        response = ask_dracarys(prompt)
        spoken = "I've compiled your high-yield exam preparation sheet with core formulas and key definitions."

        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=response or "Here is your study guide.",
            card_type="exam_prep",
            card_data={"query": query, "content": response}
        )
