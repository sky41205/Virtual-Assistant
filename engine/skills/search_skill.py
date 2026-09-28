import re
import urllib.parse
import requests
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult

class WebSearchSkill(BaseSkill):
    name = "web_search_skill"
    description = "Searches the web, extracts verified summaries and source links, and requires confirmation before launching."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        search_triggers = [
            "search for", "search web for", "search the web for", "google search for",
            "search on google", "look up", "find information about", "who is",
            "tell me about", "what is happening with", "latest news on"
        ]
        # Only handle if query explicitly asks to search or look up
        if any(q.startswith(t) for t in ["search for", "search the web", "search web", "look up", "google search"]):
            return True
        if any(t in q for t in ["search for", "search the web for", "search on google for"]):
            return True
        return False

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()
        # Clean query search phrase
        clean_q = query
        for prefix in ["search the web for", "search web for", "search google for", "search for", "look up", "google"]:
            if clean_q.lower().startswith(prefix):
                clean_q = clean_q[len(prefix):].strip()
                break

        if not clean_q:
            return SkillResult(
                handled=True,
                spoken_response="What would you like me to search the web for?"
            )

        encoded_q = urllib.parse.quote(clean_q)
        summary = ""
        source_url = f"https://duckduckgo.com/?q={encoded_q}"
        is_verified = False

        # Attempt DuckDuckGo Instant Answer API (Free, secure, trusted)
        try:
            ddg_api = f"https://api.duckduckgo.com/?q={encoded_q}&format=json&no_html=1&skip_disambig=1"
            headers = {"User-Agent": "DracarysAssistant/2.0"}
            resp = requests.get(ddg_api, headers=headers, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                abstract = data.get("AbstractText", "").strip()
                heading = data.get("Heading", "")
                abstract_url = data.get("AbstractURL", "")

                if abstract:
                    summary = abstract
                    is_verified = True
                    if abstract_url:
                        source_url = abstract_url
                elif data.get("RelatedTopics"):
                    # Check first related topic
                    for topic in data.get("RelatedTopics", []):
                        if isinstance(topic, dict) and topic.get("Text"):
                            summary = topic["Text"]
                            if topic.get("FirstURL"):
                                source_url = topic["FirstURL"]
                            is_verified = True
                            break
        except Exception as e:
            print(f"DuckDuckGo search notice: {e}")

        # If Instant Answer didn't yield text, ask LLM with web search persona
        if not summary:
            try:
                from engine.llm import ask_dracarys
                prompt = f"Give a concise factual summary with verified information about: {clean_q}. State if any information is uncertain or pending official confirmation. Keep under 3 sentences."
                summary = ask_dracarys(prompt)
                is_verified = False  # Derived knowledge, not direct source match
            except Exception:
                summary = f"I looked up '{clean_q}'. I have prepared search results and sources for you to explore."

        verification_label = "Verified via Encyclopedia / Official Data" if is_verified else "Synthesized AI Summary (Verify with source)"

        # Prepare spoken response
        spoken = f"Here is what I found about {clean_q}: {summary}"
        # Trim spoken if too long
        if len(spoken) > 280:
            spoken = spoken[:275] + "..."

        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=summary,
            card_type="search",
            card_data={
                "query": clean_q,
                "summary": summary,
                "source_url": source_url,
                "is_verified": is_verified,
                "verification_label": verification_label,
                "domain": urllib.parse.urlparse(source_url).netloc or "duckduckgo.com"
            },
            requires_confirmation=True,
            confirmation_action_id=f"open_url:{source_url}",
            confirmation_prompt=f"Would you like me to open the external source link ({urllib.parse.urlparse(source_url).netloc}) in your browser?"
        )

    def confirm(self, action_id: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        import webbrowser
        if action_id.startswith("open_url:"):
            url = action_id[len("open_url:"):]
            webbrowser.open(url)
            return SkillResult(
                handled=True,
                spoken_response=f"Opening external link in your browser."
            )
        return SkillResult(handled=False, spoken_response="Unknown confirmation action.")
