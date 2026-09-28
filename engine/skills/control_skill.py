import os
import subprocess
import eel
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.skills.automation_skill import log_action

# Strict Allowlist of verified desktop applications
ALLOWLISTED_APPS = {
    "calculator": {"target": "calc.exe", "name": "Calculator", "type": "exe", "consequential": False},
    "calc": {"target": "calc.exe", "name": "Calculator", "type": "exe", "consequential": False},
    "notepad": {"target": "notepad.exe", "name": "Notepad", "type": "exe", "consequential": False},
    "text editor": {"target": "notepad.exe", "name": "Notepad", "type": "exe", "consequential": False},
    "paint": {"target": "mspaint.exe", "name": "Paint", "type": "exe", "consequential": False},
    "mspaint": {"target": "mspaint.exe", "name": "Paint", "type": "exe", "consequential": False},
    "file explorer": {"target": "explorer.exe", "name": "File Explorer", "type": "exe", "consequential": False},
    "explorer": {"target": "explorer.exe", "name": "File Explorer", "type": "exe", "consequential": False},
    "my computer": {"target": "explorer.exe", "name": "File Explorer", "type": "exe", "consequential": False},
    "this pc": {"target": "explorer.exe", "name": "File Explorer", "type": "exe", "consequential": False},
    "settings": {"target": "ms-settings:", "name": "Windows Settings", "type": "uri", "consequential": False},
    "windows settings": {"target": "ms-settings:", "name": "Windows Settings", "type": "uri", "consequential": False},
    "clock": {"target": "ms-clock:", "name": "Windows Clock", "type": "uri", "consequential": False},
    "alarms": {"target": "ms-clock:", "name": "Windows Clock", "type": "uri", "consequential": False},
    "camera": {"target": "microsoft.windows.camera:", "name": "Windows Camera", "type": "uri", "consequential": False},
    "task manager": {"target": "taskmgr.exe", "name": "Task Manager", "type": "exe", "consequential": True},
    "taskmgr": {"target": "taskmgr.exe", "name": "Task Manager", "type": "exe", "consequential": True}
}

RESTRICTED_SHELL_PATTERNS = [
    "cmd", "powershell", "terminal", "command prompt", "bash", "sh", "regedit",
    "format", "del ", "rm ", "rmdir", "drop table", "shutdown"
]

class AppControlSkill(BaseSkill):
    name = "control_skill"
    description = "Controls assistant state, speech playback, themes, UI panels, dashboard widgets, and launches allowlisted applications safely."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()

        # 1. Shell commands blocked
        if any(p in q for p in RESTRICTED_SHELL_PATTERNS) and any(v in q for v in ["open", "run", "launch", "start", "exec"]):
            return True

        # 2. Allowlisted app launching
        if any(v in q for v in ["open ", "launch ", "start "]) and any(k in q for k in ALLOWLISTED_APPS):
            return True

        # 3. Dashboard and quick actions
        if any(p in q for p in ["open dashboard", "show dashboard", "open widgets", "show widgets", "dashboard", "quick actions", "show quick actions", "open quick actions"]):
            return True

        # 4. Speech and UI control phrases
        control_phrases = [
            "stop talking", "stop speaking", "be quiet", "shut up", "silence", "mute speech",
            "stop speech", "mute audio", "unmute audio",
            "show chat panel", "open chat panel", "hide chat panel", "close chat panel",
            "toggle chat panel", "show transcript", "hide transcript",
            "switch to dark theme", "dark theme", "light theme", "switch to light theme",
            "cyan theme", "fire theme", "emerald theme", "purple theme", "stealth theme",
            "start listening", "stop listening",
            "change voice", "voice settings"
        ]
        return any(p in q for p in control_phrases)

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()

        # 1. SECURITY SAFEGUARD: BLOCK ARBITRARY SHELL ACCESS
        if any(p in q for p in RESTRICTED_SHELL_PATTERNS) and any(v in q for v in ["open", "run", "launch", "start", "exec"]):
            log_action("launch_app", q, "BLOCKED", "Arbitrary shell or command prompt execution is prohibited")
            return SkillResult(
                handled=True,
                spoken_response="Direct shell execution and arbitrary terminal access are restricted for security. Only pre-verified applications are permitted.",
                display_text="🛡️ **Security Safeguard**: Raw shell execution and arbitrary scripts are blocked to protect your system.",
                card_type="action_result",
                card_data={"action": "launch_app", "target": q, "status": "BLOCKED"}
            )

        # 2. OPEN ASSISTANT DASHBOARD
        if any(w in q for w in ["open dashboard", "show dashboard", "open widgets", "show widgets", "dashboard"]):
            try:
                eel.openDashboard()
            except Exception:
                pass
            log_action("dashboard", "widgets_drawer", "SUCCESS", "Opened assistant dashboard widgets")
            return SkillResult(
                handled=True,
                spoken_response="Opening your assistant dashboard widgets.",
                display_text="📊 **Assistant Dashboard Opened**",
                card_type="action_result",
                card_data={"action": "dashboard", "status": "SUCCESS"}
            )

        # 3. OPEN QUICK ACTIONS
        if any(w in q for w in ["quick actions", "show quick actions", "open quick actions"]):
            try:
                eel.openQuickActions()
            except Exception:
                pass
            return SkillResult(
                handled=True,
                spoken_response="Opening Quick Actions menu.",
                display_text="⚡ **Quick Actions Palette Opened**",
                card_type="action_result",
                card_data={"action": "quick_actions", "status": "SUCCESS"}
            )

        # 4. LAUNCH ALLOWLISTED DESKTOP APPLICATIONS
        for key, app_info in ALLOWLISTED_APPS.items():
            if f"open {key}" in q or f"launch {key}" in q or f"start {key}" in q:
                if app_info["consequential"]:
                    # Require user confirmation for administrative / consequential tools
                    log_action("launch_app", app_info["name"], "PENDING_CONFIRMATION", "Awaiting confirmation for consequential utility")
                    return SkillResult(
                        handled=True,
                        spoken_response=f"Task Manager is an administrative tool. Would you like me to launch {app_info['name']}?",
                        display_text=f"⚠️ **Confirmation Required**: Launch {app_info['name']}?",
                        card_type="confirmation",
                        card_data={"action": "launch_app", "app": app_info["name"]},
                        requires_confirmation=True,
                        confirmation_action_id=f"launch_app:{key}",
                        confirmation_prompt=f"Launch {app_info['name']}?"
                    )
                else:
                    return self._launch_target(app_info)

        # 5. STOP SPEECH / MUTE
        if any(w in q for w in ["stop talking", "stop speaking", "be quiet", "shut up", "silence", "mute speech", "stop speech", "mute audio"]):
            try:
                from engine.command import stop_speech
                stop_speech()
            except Exception:
                pass
            return SkillResult(
                handled=True,
                spoken_response="",
                display_text="Speech halted."
            )

        # 6. CHAT / HISTORY PANEL CONTROLS
        if any(w in q for w in ["show chat panel", "open chat panel", "show transcript", "toggle chat panel"]):
            try:
                eel.toggleChatPanel(True)
            except Exception:
                pass
            return SkillResult(
                handled=True,
                spoken_response="Displaying the task history transcript.",
                card_type="info",
                card_data={"action": "show_chat"}
            )

        if any(w in q for w in ["hide chat panel", "close chat panel", "hide transcript"]):
            try:
                eel.toggleChatPanel(False)
            except Exception:
                pass
            return SkillResult(
                handled=True,
                spoken_response="Closing the task history transcript.",
                card_type="info",
                card_data={"action": "hide_chat"}
            )

        # 7. THEME SWITCHING
        if "dark theme" in q or "stealth theme" in q:
            try:
                eel.setAssistantTheme("stealth")
            except Exception:
                pass
            return SkillResult(handled=True, spoken_response="Switching to dark focus theme.")

        if "light theme" in q:
            try:
                eel.setAssistantTheme("light")
            except Exception:
                pass
            return SkillResult(handled=True, spoken_response="Switching to high-contrast light theme.")

        # 8. VOICE SETTINGS
        if any(w in q for w in ["change voice", "voice settings"]):
            try:
                eel.openSettingsPanel()
            except Exception:
                pass
            return SkillResult(
                handled=True,
                spoken_response="Opening voice and system preferences.",
                card_type="info"
            )

        # 9. START / STOP LISTENING
        if "stop listening" in q:
            try:
                eel.stopSpeechRecognition()
            except Exception:
                pass
            return SkillResult(handled=True, spoken_response="Microphone deactivated.")

        if "start listening" in q:
            try:
                eel.startSpeechRecognition()
            except Exception:
                pass
            return SkillResult(handled=True, spoken_response="Microphone active. I am listening.")

        return SkillResult(handled=False, spoken_response="")

    def confirm(self, action_id: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        if action_id.startswith("launch_app:"):
            key = action_id[len("launch_app:"):]
            if key in ALLOWLISTED_APPS:
                return self._launch_target(ALLOWLISTED_APPS[key], confirmed=True)
        return SkillResult(handled=False, spoken_response="Action cannot be confirmed.")

    def _launch_target(self, target_info: Dict[str, Any], confirmed: bool = False) -> SkillResult:
        name = target_info["name"]
        target = target_info["target"]
        t_type = target_info["type"]
        try:
            if t_type == "uri":
                os.startfile(target)
            else:
                # shell=False prevents shell injection attacks
                subprocess.Popen([target], shell=False)

            log_action("launch_app", name, "SUCCESS", f"Launched allowlisted {name}", user_confirmed=confirmed)
            return SkillResult(
                handled=True,
                spoken_response=f"Successfully opened {name}.",
                display_text=f"🚀 **Action Successful**: Launched {name}",
                card_type="action_result",
                card_data={"action": "launch_app", "app": name, "status": "SUCCESS"}
            )
        except Exception as e:
            log_action("launch_app", name, "FAILED", str(e), user_confirmed=confirmed)
            return SkillResult(
                handled=True,
                spoken_response=f"Could not launch {name}. The application was not found on this system.",
                display_text=f"❌ **Action Failed**: Could not launch {name} ({e})",
                card_type="action_result",
                card_data={"action": "launch_app", "app": name, "status": "FAILED", "error": str(e)}
            )
