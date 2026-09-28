import re
from typing import Optional, Dict, Any, List
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.llm import ask_dracarys

class GeneralConversationSkill(BaseSkill):
    name = "conversation_skill"
    description = "Handles deep AI general knowledge, technical concept explanations, summarization, and context memory."

    def __init__(self):
        self.context_memory: List[Dict[str, str]] = []

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        # Fallback brain for any natural query not captured by specific utility skills
        return True

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.strip()
        q_lower = q.lower()

        # 1. TEXT SUMMARIZATION
        m_sum = re.search(r'^(?:summarize|summarise|summary\s+of)(?:\s+this)?(?::|\s+)?(.+)$', q, re.IGNORECASE | re.DOTALL)
        if m_sum:
            raw_text = m_sum.group(1).strip()
            prompt = f"Please provide a clear, concise executive summary of the following text:\n\n{raw_text}"
            try:
                summary_ans = ask_dracarys(prompt)
                self._record_turn(q, summary_ans)
                return SkillResult(
                    handled=True,
                    spoken_response=summary_ans,
                    display_text=summary_ans,
                    card_type="info",
                    card_data={"title": "Summary", "text": summary_ans}
                )
            except Exception as e:
                return SkillResult(handled=True, spoken_response=f"Could not summarize text: {e}")

        # 2. TECHNICAL CONCEPT EXPLANATION
        if any(q_lower.startswith(p) for p in ["explain ", "what is the concept of ", "how does ", "teach me ", "what does it mean to "]):
            prompt = f"Explain the following technical or educational concept clearly, accurately, and engagingly for voice delivery (2-4 sentences):\n{q}"
            try:
                expl_ans = ask_dracarys(prompt)
                self._record_turn(q, expl_ans)
                return SkillResult(
                    handled=True,
                    spoken_response=expl_ans,
                    display_text=expl_ans,
                    card_type="info",
                    card_data={"title": "Concept Explanation", "text": expl_ans}
                )
            except Exception as e:
                print(f"Explanation notice: {e}")

        # 3. GENERAL KNOWLEDGE & PRODUCTIVITY ASSISTANCE
        # Provide conversation context if available
        context_prompt = q
        if len(self.context_memory) > 0:
            last_turns = self.context_memory[-3:]
            hist_str = "\n".join([f"User: {t['user']}\nAssistant: {t['assistant']}" for t in last_turns])
            context_prompt = f"Conversation History:\n{hist_str}\n\nCurrent User Request: {q}"

        try:
            answer = ask_dracarys(context_prompt)
            if not answer:
                answer = "I heard you, but I couldn't generate a response. Could you rephrase that?"
            self._record_turn(q, answer)
            return SkillResult(
                handled=True,
                spoken_response=answer,
                display_text=answer,
                card_type="none"
            )
        except Exception as e:
            fallback = f"I'm here, but encountered a slight issue connecting to the AI core: {e}"
            return SkillResult(handled=True, spoken_response=fallback)

    def _record_turn(self, user_msg: str, ai_msg: str):
        self.context_memory.append({"user": user_msg, "assistant": ai_msg})
        if len(self.context_memory) > 10:
            self.context_memory = self.context_memory[-10:]

    def clear_memory(self):
        self.context_memory.clear()
