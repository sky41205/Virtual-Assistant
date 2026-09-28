import re
import urllib.parse
import webbrowser
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.skills.automation_skill import log_action

# Whitelist of verified safe, approved web destinations
TRUSTED_SITES = {
    "youtube": ("https://www.youtube.com", "YouTube"),
    "google": ("https://www.google.com", "Google"),
    "github": ("https://www.github.com", "GitHub"),
    "wikipedia": ("https://www.wikipedia.org", "Wikipedia"),
    "chatgpt": ("https://chatgpt.com", "ChatGPT"),
    "canva": ("https://www.canva.com", "Canva"),
    "reddit": ("https://www.reddit.com", "Reddit"),
    "netflix": ("https://www.netflix.com", "Netflix"),
    "twitter": ("https://x.com", "X (Twitter)"),
    "x": ("https://x.com", "X"),
    "linkedin": ("https://www.linkedin.com", "LinkedIn"),
    "gmail": ("https://mail.google.com", "Gmail"),
    "whatsapp": ("https://web.whatsapp.com", "WhatsApp Web"),
    "amazon": ("https://www.amazon.in", "Amazon"),
    "flipkart": ("https://www.flipkart.com", "Flipkart"),
    "stackoverflow": ("https://stackoverflow.com", "Stack Overflow"),
    "spotify": ("https://open.spotify.com", "Spotify"),
    "notion": ("https://www.notion.so", "Notion"),
    "figma": ("https://www.figma.com", "Figma"),
    "medium": ("https://medium.com", "Medium")
}

class WebsiteNavigationSkill(BaseSkill):
    name = "navigation_skill"
    description = "Safely opens approved websites, validates external destinations, prompts for confirmation on unverified domains, and logs navigation events."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        nav_verbs = ["open website", "go to", "visit", "open url", "browse to", "navigate to"]
        if any(v in q for v in nav_verbs):
            return True
        if q.startswith("open ") and any(k in q for k in TRUSTED_SITES):
            return True
        # Domain or IP address matching
        if re.search(r'open\s+([a-zA-Z0-9-]+\.(?:com|org|net|io|in|edu|gov|xyz|app|dev))', q):
            return True
        if re.search(r'open\s+(?:https?://)?(?:\d{1,3}\.){3}\d{1,3}', q):
            return True
        if any(h in q for h in ["localhost", "127.0.0.1", "0.0.0.0"]) and any(v in q for v in ["open", "go to", "visit", "browse"]):
            return True
        return False

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # Clean command verb
        target = q
        for v in ["open website", "browse to", "navigate to", "go to", "visit", "open url", "open"]:
            if target.startswith(v):
                target = target[len(v):].strip()
                break

        # 1. Match against trusted whitelist
        for key, (url, name) in TRUSTED_SITES.items():
            if target == key or f"{key}.com" in target or target.startswith(key):
                try:
                    webbrowser.open(url)
                    log_action("open_website", name, "SUCCESS", f"Opened approved website {url}")
                    return SkillResult(
                        handled=True,
                        spoken_response=f"Opening approved website: {name}.",
                        display_text=f"🌐 **Action Successful**: Opened {name} ({url})",
                        card_type="action_result",
                        card_data={"name": name, "url": url, "status": "SUCCESS", "safe": True}
                    )
                except Exception as e:
                    log_action("open_website", name, "FAILED", str(e))
                    return SkillResult(
                        handled=True,
                        spoken_response=f"Failed to open {name}.",
                        display_text=f"❌ **Action Failed**: Could not launch browser ({e})",
                        card_type="action_result",
                        card_data={"name": name, "status": "FAILED", "error": str(e)}
                    )

        # 2. Arbitrary URL validation & external action confirmation
        candidate_url = target
        if not candidate_url.startswith(("http://", "https://")):
            candidate_url = "https://" + candidate_url

        parsed = urllib.parse.urlparse(candidate_url)
        # Security validation: must have valid scheme and valid network location
        if parsed.scheme in ["http", "https"] and parsed.netloc and "." in parsed.netloc:
            domain = parsed.netloc

            # Check for suspicious schemes or local loops
            if domain in ["localhost", "127.0.0.1", "0.0.0.0"]:
                log_action("open_website", domain, "BLOCKED", "Loopback address blocked")
                return SkillResult(
                    handled=True,
                    spoken_response="Local loopback navigation is restricted for security.",
                    display_text="🛡️ **Security Alert**: Localhost and loopback URLs cannot be opened.",
                    card_type="action_result",
                    card_data={"target": domain, "status": "BLOCKED"}
                )

            # Safeguard: Require explicit user confirmation for unverified arbitrary URLs
            log_action("open_website", domain, "PENDING_CONFIRMATION", f"Awaiting confirmation to open unlisted domain: {domain}")
            return SkillResult(
                handled=True,
                spoken_response=f"You requested to visit {domain}. For your security, would you like me to open this external website?",
                display_text=f"⚠️ **Confirmation Required**: Open external website **{domain}**?",
                card_type="confirmation",
                card_data={"action": "navigate_url", "url": candidate_url, "domain": domain},
                requires_confirmation=True,
                confirmation_action_id=f"open_url:{candidate_url}",
                confirmation_prompt=f"Open unverified website: {domain}?"
            )

        return SkillResult(
            handled=True,
            spoken_response=f"I couldn't identify a valid web address for '{target}'."
        )

    def confirm(self, action_id: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        if action_id.startswith("open_url:"):
            url = action_id[len("open_url:"):]
            try:
                webbrowser.open(url)
                log_action("open_website", url, "CONFIRMED", "User confirmed external navigation", user_confirmed=True)
                return SkillResult(
                    handled=True,
                    spoken_response="Opening requested website.",
                    display_text=f"🌐 **Action Successful**: Opened {url}",
                    card_type="action_result",
                    card_data={"url": url, "status": "SUCCESS"}
                )
            except Exception as e:
                log_action("open_website", url, "FAILED", str(e), user_confirmed=True)
                return SkillResult(
                    handled=True,
                    spoken_response="Failed to open requested website.",
                    display_text=f"❌ **Action Failed**: {e}",
                    card_type="action_result",
                    card_data={"url": url, "status": "FAILED", "error": str(e)}
                )
        return SkillResult(handled=False, spoken_response="Navigation confirmation not recognized.")
