import re
import os
import sqlite3
import datetime
from typing import Optional, Dict, Any, List
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.llm import ask_dracarys
from engine.logger import get_logger

logger = get_logger("domain_skill")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "sophia.db")

def init_domain_tables():
    """Initialize persistent tables for domain-specific tasks (e.g. personal expenses, habit logs)."""
    try:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS personal_expenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount REAL NOT NULL,
                    category TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
    except Exception as e:
        logger.error(f"Error initializing domain tables: {e}")

init_domain_tables()

class DomainSpecificSkill(BaseSkill):
    name = "domain_skill"
    description = "Tailored specialist for Academic (Research, Quiz, Concept Explainer), Workplace (Email drafting, Standup, Meeting Notes), and Personal (Expense tracking, Day planning, Wellness) needs."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        triggers = [
            # 1. ACADEMIC TRIGGERS
            "explain simply", "explain concept", "eli5", "feynman",
            "summarize paper", "summarize research", "academic summary",
            "quiz me", "create a quiz", "test my knowledge", "flashcard",
            "cite this", "citation for", "apa citation", "ieee citation", "mla citation",
            "solve math", "solve equation", "math problem", "step by step math",
            "study timer", "pomodoro", "start pomodoro", "study session",

            # 2. WORKPLACE TRIGGERS
            "draft email", "write an email", "compose email", "client email",
            "follow up email", "apology email", "resignation letter",
            "meeting minutes", "meeting notes", "action items from meeting",
            "daily standup", "standup update", "status report", "work report",
            "debug code", "explain this code", "code review", "write regex",
            "project breakdown", "task breakdown", "workplace memo",

            # 3. PERSONAL TRIGGERS
            "log expense", "add expense", "track expense", "spent", "paid", "put down", "cost", "my expenses", "show expenses", "kharch",
            "plan my day", "daily routine", "morning routine", "plan schedule",
            "water reminder", "drink water", "health break", "stretch reminder", "posture check"
        ]
        return any(t in q for t in triggers)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()
        logger.info(f"Executing DomainSpecificSkill: '{query}'")

        # ==============================================================
        # 1. ACADEMIC DOMAIN TASKS
        # ==============================================================

        # A. Concept Explainer (Feynman Technique)
        if any(w in q for w in ["explain simply", "explain concept", "eli5", "feynman", "explain to me like"]):
            topic = q
            for p in ["explain simply", "explain concept of", "explain the concept of", "explain to me like i am 5", "eli5", "explain"]:
                topic = topic.replace(p, "").strip()
            topic = topic or "the requested concept"

            prompt = (
                f"You are a master academic educator using the Feynman Technique. Explain '{topic}' with crystal clarity: "
                "1. Intuitive Real-world Analogy (simple, vivid comparison). "
                "2. Core Mechanism (in plain language without jargon). "
                "3. Three High-Yield Bullet Takeaways. "
                "Keep the spoken summary to exactly 2 concise, memorable sentences, and provide the structured explanation in text."
            )
            response = ask_dracarys(prompt)
            spoken = f"Here is a simple explanation of {topic}. At its core, it works like an intuitive system—check your screen for the breakdown."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="academic_concept",
                card_data={"topic": topic, "content": response, "domain": "academic"}
            )

        # B. Academic Paper / Article Summarizer
        if any(w in q for w in ["summarize paper", "summarize research", "academic summary"]):
            topic = q
            for p in ["summarize paper on", "summarize research on", "academic summary of", "summarize paper"]:
                topic = topic.replace(p, "").strip()
            topic = topic or "this paper"

            prompt = (
                f"You are an academic research fellow. Provide a rigorous, structured summary for: '{topic}'. "
                "Include: "
                "- Research Objective & Hypothesis "
                "- Methodology & Key Experiment "
                "- Primary Findings "
                "- Significance & Limitations. "
                "Keep the spoken overview to 2 sentences."
            )
            response = ask_dracarys(prompt)
            spoken = f"I've synthesized the academic research breakdown for {topic}. Key findings and methodology are summarized on screen."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="academic_paper",
                card_data={"topic": topic, "content": response, "domain": "academic"}
            )

        # C. Citation & Bibliography Formatter
        if any(w in q for w in ["cite this", "citation", "apa citation", "ieee citation", "mla citation"]):
            style = "APA 7th"
            if "ieee" in q: style = "IEEE"
            elif "mla" in q: style = "MLA 9th"
            elif "harvard" in q: style = "Harvard"

            prompt = (
                f"Format an academic citation for '{query}' in {style} style. "
                "Provide both the full bibliography reference and the in-text citation example. "
                "State why this style format is appropriate."
            )
            response = ask_dracarys(prompt)
            spoken = f"Here is your {style} format citation and in-text reference."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="academic_citation",
                card_data={"style": style, "content": response, "domain": "academic"}
            )

        # D. Interactive Quiz / Flashcards
        if any(w in q for w in ["quiz me", "create a quiz", "test my knowledge", "flashcard"]):
            topic = q
            for p in ["quiz me on", "create a quiz on", "test my knowledge on", "flashcards for", "quiz me"]:
                topic = topic.replace(p, "").strip()
            topic = topic or "general science"

            prompt = (
                f"Create a high-yield 3-question active recall quiz on '{topic}'. "
                "Each question should have 4 options (A, B, C, D) and an explanation of why the correct option is right. "
                "Keep the spoken audio to 1 cheerful sentence inviting the student to test their knowledge."
            )
            response = ask_dracarys(prompt)
            spoken = f"I've prepared a 3-question revision quiz on {topic}. Test your knowledge on screen!"

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="academic_quiz",
                card_data={"topic": topic, "content": response, "domain": "academic"}
            )

        # E. Step-by-Step Math / Problem Solver
        if any(w in q for w in ["solve math", "solve equation", "math problem", "step by step math"]):
            math_expr = q
            for p in ["solve math", "solve equation", "solve the equation", "solve", "math problem"]:
                math_expr = math_expr.replace(p, "").strip()

            prompt = (
                f"Solve this mathematics problem step-by-step: '{math_expr}'. "
                "Show: 1. Given Equation, 2. Step-by-Step Working, 3. Final Answer in bold box. "
                "Keep spoken response concise with just the final answer and primary rule used."
            )
            response = ask_dracarys(prompt)
            spoken = f"Solved: {math_expr}. Check your screen for the complete step-by-step proof."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="academic_math",
                card_data={"expression": math_expr, "content": response, "domain": "academic"}
            )

        # F. Study Pomodoro Timer
        if any(w in q for w in ["study timer", "pomodoro", "start pomodoro"]):
            spoken = "Pomodoro study session started! Focus on your reading for 25 minutes. I will notify you when it's time for a 5-minute break."
            display = (
                "🍅 **Pomodoro Study Session Active**\n"
                "- **Focus Interval**: 25 Minutes\n"
                "- **Target**: Deep uninterrupted academic focus\n"
                "- **Next Break**: 5 Minutes rest"
            )
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="academic_pomodoro",
                card_data={"duration": 25, "domain": "academic"}
            )

        # ==============================================================
        # 2. WORKPLACE & PROFESSIONAL DOMAIN TASKS
        # ==============================================================

        # A. Professional Email Drafter
        if any(w in q for w in ["draft email", "write an email", "compose email", "client email", "follow up email", "apology email", "resignation letter"]):
            prompt = (
                f"You are an executive corporate communication strategist. Draft a high-impact professional workplace email based on: '{query}'. "
                "Format clearly with: "
                "- Subject Line (compelling & concise) "
                "- Professional Salutation "
                "- Clear Context & Value Proposition "
                "- Direct Call-to-Action "
                "- Professional Sign-off. "
                "Keep spoken answer to exactly 1 sentence confirming the email is drafted and ready to copy."
            )
            response = ask_dracarys(prompt)
            spoken = "I have drafted the professional email for you. You can review and copy it directly to your clipboard."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="workplace_email",
                card_data={"query": query, "content": response, "domain": "workplace"}
            )

        # B. Meeting Minutes & Action Items Extractor
        if any(w in q for w in ["meeting minutes", "meeting notes", "action items from meeting"]):
            prompt = (
                f"You are a chief of staff. Transform these meeting notes/details into a clean workplace summary: '{query}'. "
                "Include: "
                "1. Meeting Objective & Key Decisions "
                "2. Prioritized Action Items with assigned owners & deadlines "
                "3. Open Questions / Next Steps. "
                "Spoken response must be 1 sentence."
            )
            response = ask_dracarys(prompt)
            spoken = "Here is your meeting summary with prioritized action items and key decisions."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="workplace_meeting",
                card_data={"query": query, "content": response, "domain": "workplace"}
            )

        # C. Daily Standup / Status Report Generator
        if any(w in q for w in ["daily standup", "standup update", "status report", "work report"]):
            prompt = (
                f"Create a crisp agile daily standup report based on: '{query}'. "
                "Use standard 3-part format: "
                "- What was completed yesterday "
                "- What is on deck for today "
                "- Any blockers or dependencies. "
                "Keep spoken response to 1 sentence."
            )
            response = ask_dracarys(prompt)
            spoken = "Here is your daily standup update formatted and ready for your team."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="workplace_standup",
                card_data={"query": query, "content": response, "domain": "workplace"}
            )

        # D. Technical Code Review & Debugging
        if any(w in q for w in ["debug code", "explain this code", "code review", "write regex"]):
            prompt = (
                f"You are a principal software engineer. Provide clear, production-ready code analysis for: '{query}'. "
                "Include: "
                "1. Direct bug fix or implementation with code block "
                "2. Concise explanation of why the fix works "
                "3. Edge cases and performance considerations."
            )
            response = ask_dracarys(prompt)
            spoken = "I've analyzed the code and provided the optimized fix with explanation on screen."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="workplace_code",
                card_data={"query": query, "content": response, "domain": "workplace"}
            )

        # E. Project Task Breakdown (WBS)
        if any(w in q for w in ["project breakdown", "task breakdown", "workplace memo"]):
            prompt = (
                f"Break down this project initiative into practical agile deliverables: '{query}'. "
                "Provide: Phase 1 (Planning & Architecture), Phase 2 (Implementation), Phase 3 (QA & Launch)."
            )
            response = ask_dracarys(prompt)
            spoken = "I've structured your project roadmap into phases and actionable milestones."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="workplace_project",
                card_data={"query": query, "content": response, "domain": "workplace"}
            )

        # ==============================================================
        # 3. PERSONAL & DAILY LIFE DOMAIN TASKS
        # ==============================================================

        # A. Personal Expense Logging & Budget
        if any(w in q for w in ["log expense", "add expense", "track expense", "spent", "paid", "put down", "cost", "my expenses", "show expenses", "kharch"]):
            if any(w in q for w in ["show expenses", "my expenses", "expense list"]):
                # Retrieve expenses
                try:
                    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
                        cur = conn.cursor()
                        cur.execute("SELECT amount, category, description, timestamp FROM personal_expenses ORDER BY id DESC LIMIT 10")
                        rows = cur.fetchall()
                        if rows:
                            total = sum(r[0] for r in rows)
                            exp_list = "\n".join([f"• ₹{r[0]:.2f} - {r[1].title()} ({r[2] or 'No note'}) [{r[3][:10]}]" for r in rows])
                            spoken = f"You have logged {len(rows)} recent expenses totaling {total:.2f} rupees."
                            display = f"💰 **Recent Personal Expenses** (Total: ₹{total:.2f})\n\n{exp_list}"
                            return SkillResult(handled=True, spoken_response=spoken, display_text=display, card_type="personal_expense", card_data={"total": total, "domain": "personal"})
                        else:
                            return SkillResult(handled=True, spoken_response="You haven't logged any personal expenses yet. Say 'log expense 250 on lunch' to add one.", display_text="No expenses recorded.")
                except Exception as e:
                    logger.error(f"Error fetching expenses: {e}")

            # Parse new expense: e.g. "log expense 450 for groceries", "spent 120 on coffee", "put down 120 rupees for coffee"
            amt_match = re.search(r'(?:expense|spent|paid|cost|put down|add expense|track expense)\s*(?:of|about|around)?\s*(?:rs|inr|₹|\$)?\s*(\d+(?:\.\d{1,2})?)', q)
            if not amt_match:
                amt_match = re.search(r'(\d+(?:\.\d{1,2})?)\s*(?:bucks|rupees|rs|dollars|inr|₹|\$)', q)
            amount = float(amt_match.group(1)) if amt_match else 0.0
            
            # Category extraction
            category = "general"
            for cat in ["groceries", "food", "lunch", "dinner", "fuel", "petrol", "diesel", "travel", "cab", "uber", "bills", "shopping", "medicine", "entertainment", "coffee", "tea", "snacks", "rent"]:
                if cat in q:
                    category = cat
                    break

            if amount > 0:
                try:
                    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
                        conn.execute("INSERT INTO personal_expenses (amount, category, description) VALUES (?, ?, ?)", (amount, category, query))
                        conn.commit()
                    spoken = f"Logged {amount:.2f} rupees under {category} in your personal expense tracker."
                    display = f"💳 **Expense Recorded**\n- **Amount**: ₹{amount:.2f}\n- **Category**: {category.title()}\n- **Date**: {datetime.date.today()}"
                    return SkillResult(handled=True, spoken_response=spoken, display_text=display, card_type="personal_expense", card_data={"amount": amount, "category": category, "domain": "personal"})
                except Exception as e:
                    logger.error(f"Error recording expense: {e}")

        # B. Personal Day Planner & Routine
        if any(w in q for w in ["plan my day", "daily routine", "morning routine", "plan schedule"]):
            prompt = (
                f"You are a personal lifestyle & productivity coach. Create an energizing, balanced day plan for: '{query}'. "
                "Include: "
                "- Morning Momentum Block (health, clarity, deep work) "
                "- Afternoon Focus Block (high priority tasks) "
                "- Evening Wind Down (reflection, rest). "
                "Keep spoken answer to 2 motivating sentences."
            )
            response = ask_dracarys(prompt)
            spoken = "I've structured a balanced daily routine for peak productivity and well-being. Check your daily plan on screen."

            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=response,
                card_type="personal_routine",
                card_data={"query": query, "content": response, "domain": "personal"}
            )

        # C. Wellness & Health Break Reminders
        if any(w in q for w in ["water reminder", "drink water", "health break", "stretch reminder", "posture check"]):
            spoken = "Take a moment to sit up straight, drink a refreshing glass of water, and rest your eyes away from the screen."
            display = (
                "💧 **Personal Wellness Check**\n"
                "- **Hydration**: Drink 250ml water\n"
                "- **Posture**: Roll shoulders back, align spine\n"
                "- **20-20-20 Rule**: Look at something 20 feet away for 20 seconds"
            )
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="personal_wellness",
                card_data={"type": "wellness", "domain": "personal"}
            )

        return SkillResult(handled=False, spoken_response="")
