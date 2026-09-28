import os
import platform
import socket
import time
import datetime
from typing import Optional, Dict, Any
from engine.skills.base_skill import BaseSkill, SkillResult
from engine.logger import get_logger

logger = get_logger("system_skill")

try:
    import psutil
except ImportError:
    psutil = None

try:
    import pyautogui
except ImportError:
    pyautogui = None

class SystemInformationSkill(BaseSkill):
    name = "system_skill"
    description = "Handles system telemetry (CPU, RAM, Disk, Network, Battery) and core desktop controls (volume, screenshot, lock)."

    def can_handle(self, query: str, context: Optional[Dict[str, Any]] = None) -> bool:
        q = query.lower().strip()
        triggers = [
            # Telemetry
            "system info", "system information", "system status", "os information", "os info",
            "cpu usage", "cpu statistics", "cpu stats", "memory usage", "ram usage",
            "how much ram", "how much memory", "free memory", "disk usage", "disk space",
            "hard drive space", "free disk", "network status", "network connection",
            "internet status", "internet speed", "system specifications", "system specs",
            "hardware info", "computer info", "battery status", "battery percentage",
            "how much battery", "battery",
            # Active System Controls
            "volume up", "increase volume", "raise volume", "turn up the volume", "turn up volume", "turn volume up",
            "volume badhao", "aawaz badhao", "awaaz badhao", "aawaaz badhao", "sound badhao",
            "आवाज़ बढ़ाओ", "आवाज बढ़ाओ", "आवाज़ बढ़ाएं", "आवाज बढ़ाएं", "ध्वनि बढ़ाओ", "वॉल्यूम बढ़ाओ",
            "volume down", "decrease volume", "lower volume", "turn down the volume", "turn down volume", "turn volume down",
            "volume kam karo", "aawaz kam karo", "awaaz kam karo", "aawaaz kam karo", "sound kam karo",
            "आवाज़ कम करो", "आवाज कम करो", "आवाज़ घटाओ", "आवाज घटाओ", "ध्वनि कम करो", "वॉल्यूम कम करो",
            "mute speech", "mute assistant", "stop speech", "stop talking", "be quiet", "chup raho", "shant raho",
            "शांत रहो", "चुप रहो", "आवाज़ बंद करो", "बोलना बंद करो",
            "mute pc", "mute computer", "mute laptop", "mute system volume", "mute hardware",
            "unmute pc", "unmute computer", "unmute system volume", "unmute hardware",
            "take screenshot", "capture screenshot", "screenshot lo", "screenshot",
            "lock screen", "lock computer", "lock pc", "screen lock karo"
        ]
        return any(t in q for t in triggers)

    @staticmethod
    def get_sanitized_system_info() -> Dict[str, Any]:
        """Collect hardware and OS statistics, strictly sanitizing sensitive data."""
        os_name = platform.system() or "Unknown OS"
        os_release = platform.release() or ""
        os_version = platform.version() or ""
        os_arch = platform.machine() or "64-bit"
        os_summary = f"{os_name} {os_release} ({os_arch})"

        # CPU Statistics
        cpu_pct = 0.0
        cpu_cores_logical = 1
        cpu_cores_physical = 1
        cpu_freq_mhz = 0.0
        if psutil:
            try:
                cpu_pct = psutil.cpu_percent(interval=0.08)
                cpu_cores_logical = psutil.cpu_count(logical=True) or 1
                cpu_cores_physical = psutil.cpu_count(logical=False) or 1
                freq = psutil.cpu_freq()
                if freq:
                    cpu_freq_mhz = round(freq.current, 1)
            except Exception as e:
                logger.debug(f"psutil CPU read notice: {e}")

        # Memory (RAM)
        ram_total_gb = 0.0
        ram_used_gb = 0.0
        ram_free_gb = 0.0
        ram_pct = 0.0
        if psutil:
            try:
                vm = psutil.virtual_memory()
                ram_total_gb = round(vm.total / (1024 ** 3), 1)
                ram_used_gb = round(vm.used / (1024 ** 3), 1)
                ram_free_gb = round(vm.available / (1024 ** 3), 1)
                ram_pct = vm.percent
            except Exception as e:
                logger.debug(f"psutil RAM read notice: {e}")

        # Disk Usage (System Drive)
        disk_total_gb = 0.0
        disk_used_gb = 0.0
        disk_free_gb = 0.0
        disk_pct = 0.0
        disk_drive = "C:" if os_name == "Windows" else "/"
        if psutil:
            try:
                du = psutil.disk_usage(disk_drive)
                disk_total_gb = round(du.total / (1024 ** 3), 1)
                disk_used_gb = round(du.used / (1024 ** 3), 1)
                disk_free_gb = round(du.free / (1024 ** 3), 1)
                disk_pct = du.percent
            except Exception:
                try:
                    du = psutil.disk_usage(os.getcwd())
                    disk_total_gb = round(du.total / (1024 ** 3), 1)
                    disk_used_gb = round(du.used / (1024 ** 3), 1)
                    disk_free_gb = round(du.free / (1024 ** 3), 1)
                    disk_pct = du.percent
                except Exception as e:
                    logger.debug(f"psutil disk read notice: {e}")

        # Network Connection Status
        is_online = False
        latency_ms = 0
        adapter_type = "Standard Interface"
        try:
            start_t = time.time()
            s = socket.create_connection(("8.8.8.8", 53), timeout=1.5)
            s.close()
            latency_ms = round((time.time() - start_t) * 1000, 1)
            is_online = True
        except Exception:
            is_online = False

        if psutil:
            try:
                stats = psutil.net_if_stats()
                for name, stat in stats.items():
                    if stat.isup and not name.lower().startswith("loopback"):
                        if "wi-fi" in name.lower() or "wlan" in name.lower():
                            adapter_type = "Wi-Fi (Wireless)"
                            break
                        elif "ethernet" in name.lower():
                            adapter_type = "Ethernet (Wired)"
                            break
            except Exception:
                pass

        # Battery Status
        battery_pct = 100
        power_plugged = True
        has_battery = False
        if psutil:
            try:
                bat = psutil.sensors_battery()
                if bat:
                    has_battery = True
                    battery_pct = bat.percent
                    power_plugged = bat.power_plugged
            except Exception:
                pass

        return {
            "os": {
                "name": os_name,
                "release": os_release,
                "summary": os_summary,
                "architecture": os_arch,
                "build": os_version[:32]
            },
            "cpu": {
                "usage_percent": cpu_pct,
                "physical_cores": cpu_cores_physical,
                "logical_cores": cpu_cores_logical,
                "frequency_mhz": cpu_freq_mhz
            },
            "memory": {
                "total_gb": ram_total_gb,
                "used_gb": ram_used_gb,
                "free_gb": ram_free_gb,
                "usage_percent": ram_pct
            },
            "disk": {
                "drive": disk_drive,
                "total_gb": disk_total_gb,
                "used_gb": disk_used_gb,
                "free_gb": disk_free_gb,
                "usage_percent": disk_pct
            },
            "network": {
                "online": is_online,
                "latency_ms": latency_ms,
                "adapter_type": adapter_type,
                "status": "Connected" if is_online else "Offline"
            },
            "battery": {
                "has_battery": has_battery,
                "percent": battery_pct,
                "plugged": power_plugged
            }
        }

    def execute(self, query: str, context: Optional[Dict[str, Any]] = None) -> SkillResult:
        q = query.lower().strip()
        logger.info(f"SystemSkill executing: '{query}'")
        from engine.language_detector import detect_language
        lang_mode = detect_language(query).get("mode", "english")

        # 1. VOLUME CONTROLS
        vol_up_triggers = [
            "volume up", "increase volume", "raise volume", "turn up the volume", "turn up volume",
            "turn volume up", "volume badhao", "aawaz badhao", "awaaz badhao", "aawaaz badhao", "sound badhao",
            "आवाज़ बढ़ाओ", "आवाज बढ़ाओ", "आवाज़ बढ़ाएं", "आवाज बढ़ाएं", "ध्वनि बढ़ाओ", "वॉल्यूम बढ़ाओ", "आवाज़ बढ़ा", "आवाज बढ़ा"
        ]
        if any(w in q for w in vol_up_triggers):
            try:
                if pyautogui:
                    pyautogui.FAILSAFE = False
                    pyautogui.press('volumeup', presses=5)
                logger.info("Executed volume up")
                if lang_mode == "hindi_devanagari":
                    spoken = "आवाज़ 10% बढ़ा दी गई है।"
                    display = "🔊 **आवाज़ 10% बढ़ाई गई**"
                elif lang_mode == "hinglish":
                    spoken = "Volume 10% badha diya gaya hai."
                    display = "🔊 **Volume Increased by 10%**"
                else:
                    spoken = "Volume turned up by 10%."
                    display = "🔊 **Volume increased** by 10%"
                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    display_text=display,
                    card_type="action_result",
                    card_data={"action": "volume_up", "status": "SUCCESS"}
                )
            except Exception as e:
                logger.error(f"Volume up error: {e}")
                err = "आवाज़ नहीं बढ़ाई जा सकी।" if lang_mode == "hindi_devanagari" else "Aawaz nahi badhai ja saki." if lang_mode == "hinglish" else "Unable to adjust volume."
                return SkillResult(handled=True, spoken_response=err)

        vol_down_triggers = [
            "volume down", "decrease volume", "lower volume", "turn down the volume", "turn down volume",
            "turn volume down", "volume kam karo", "aawaz kam karo", "awaaz kam karo", "aawaaz kam karo", "sound kam karo",
            "आवाज़ कम करो", "आवाज कम करो", "आवाज़ घटाओ", "आवाज घटाओ", "ध्वनि कम करो", "वॉल्यूम कम करो", "आवाज़ कम", "आवाज कम"
        ]
        if any(w in q for w in vol_down_triggers):
            try:
                if pyautogui:
                    pyautogui.FAILSAFE = False
                    pyautogui.press('volumedown', presses=5)
                logger.info("Executed volume down")
                if lang_mode == "hindi_devanagari":
                    spoken = "आवाज़ 10% कम कर दी गई है।"
                    display = "🔉 **आवाज़ 10% कम की गई**"
                elif lang_mode == "hinglish":
                    spoken = "Volume 10% kam kar diya gaya hai."
                    display = "🔉 **Volume Decreased by 10%**"
                else:
                    spoken = "Turned volume down by 10%."
                    display = "🔉 **Volume decreased** by 10%"
                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    display_text=display,
                    card_type="action_result",
                    card_data={"action": "volume_down", "status": "SUCCESS"}
                )
            except Exception as e:
                logger.error(f"Volume down error: {e}")
                err = "आवाज़ नहीं घटाई जा सकी।" if lang_mode == "hindi_devanagari" else "Aawaz nahi kam ki ja saki." if lang_mode == "hinglish" else "Unable to adjust volume."
                return SkillResult(handled=True, spoken_response=err)

        # Assistant Speech Stopping (Safe, does not touch PC sound card)
        if any(w in q for w in ["mute speech", "mute assistant", "stop speech", "stop talking", "be quiet", "chup raho", "shant raho", "chup ho jao"]):
            from engine.command import stop_speech
            stop_speech()
            if lang_mode == "hindi_devanagari":
                spoken = "आवाज़ रोक दी गई है।"
                display = "🔇 **आवाज़ रोक दी गई**"
            elif lang_mode == "hinglish":
                spoken = "Speech rok di gayi hai."
                display = "🔇 **Speech Stopped**"
            else:
                spoken = "Speech stopped."
                display = "🔇 **Speech Stopped**"
            return SkillResult(
                handled=True,
                spoken_response=spoken,
                display_text=display,
                card_type="action_result",
                card_data={"action": "speech_stopped", "status": "SUCCESS"}
            )

        # Physical Hardware PC Muting (Explicit only)
        if any(w in q for w in ["mute pc", "mute computer", "mute laptop", "mute system volume", "mute hardware"]):
            try:
                if pyautogui:
                    pyautogui.FAILSAFE = False
                    pyautogui.press('volumemute')
                logger.info("Executed hardware volume mute")
                if lang_mode == "hindi_devanagari":
                    spoken = "कंप्यूटर का वॉल्यूम म्यूट कर दिया गया है।"
                    display = "🔇 **कंप्यूटर वॉल्यूम म्यूट**"
                elif lang_mode == "hinglish":
                    spoken = "Computer audio mute kar diya gaya hai."
                    display = "🔇 **Computer Audio Muted**"
                else:
                    spoken = "Computer audio muted."
                    display = "🔇 **Computer Audio Muted**"
                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    display_text=display,
                    card_type="action_result",
                    card_data={"action": "volume_mute", "status": "SUCCESS"}
                )
            except Exception as e:
                logger.error(f"Volume mute error: {e}")
                return SkillResult(handled=True, spoken_response="Unable to mute audio.")

        if any(w in q for w in ["unmute pc", "unmute computer", "unmute laptop", "unmute system volume", "unmute hardware"]):
            try:
                if pyautogui:
                    pyautogui.FAILSAFE = False
                    pyautogui.press('volumemute')
                logger.info("Executed hardware volume unmute")
                if lang_mode == "hindi_devanagari":
                    spoken = "कंप्यूटर का वॉल्यूम अनम्यूट कर दिया गया है।"
                    display = "🔊 **कंप्यूटर वॉल्यूम अनम्यूट**"
                elif lang_mode == "hinglish":
                    spoken = "Computer audio unmute kar diya gaya hai."
                    display = "🔊 **Computer Audio Unmuted**"
                else:
                    spoken = "Computer audio unmuted."
                    display = "🔊 **Computer Audio Unmuted**"
                return SkillResult(
                    handled=True,
                    spoken_response=spoken,
                    display_text=display,
                    card_type="action_result",
                    card_data={"action": "volume_unmute", "status": "SUCCESS"}
                )
            except Exception as e:
                logger.error(f"Volume unmute error: {e}")
                return SkillResult(handled=True, spoken_response="Unable to unmute audio.")

        # 2. SCREENSHOT CAPTURE
        if any(w in q for w in ["take screenshot", "capture screenshot", "screenshot lo", "screenshot"]):
            try:
                if pyautogui:
                    pictures_dir = os.path.join(os.environ.get('USERPROFILE', os.getcwd()), 'Pictures', 'Screenshots')
                    os.makedirs(pictures_dir, exist_ok=True)
                    fname = f"Screenshot_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                    filepath = os.path.join(pictures_dir, fname)
                    try:
                        pyautogui.screenshot(filepath)
                    except Exception as s_err:
                        from PIL import ImageGrab
                        img = ImageGrab.grab()
                        img.save(filepath)
                    logger.info(f"Screenshot saved to: {filepath}")
                    return SkillResult(
                        handled=True,
                        spoken_response="Screenshot captured and saved to your Pictures folder.",
                        display_text=f"📸 **Screenshot Captured**\nSaved to `{fname}`",
                        card_type="action_result",
                        card_data={"action": "screenshot", "file": filepath, "status": "SUCCESS"}
                    )
            except Exception as e:
                logger.error(f"Screenshot error: {e}")
                return SkillResult(handled=True, spoken_response="Failed to capture screenshot.")

        # 3. LOCK SCREEN
        if any(w in q for w in ["lock screen", "lock computer", "lock pc", "screen lock karo"]):
            try:
                import ctypes
                logger.info("Locking workstation")
                ctypes.windll.user32.LockWorkStation()
                return SkillResult(
                    handled=True,
                    spoken_response="Locking your workstation.",
                    display_text="🔒 **Workstation Locked**",
                    card_type="action_result",
                    card_data={"action": "lock", "status": "SUCCESS"}
                )
            except Exception as e:
                logger.error(f"Lock screen error: {e}")
                return SkillResult(handled=True, spoken_response="Unable to lock screen.")

        # 4. TELEMETRY QUERIES
        data = self.get_sanitized_system_info()

        # Battery
        if any(w in q for w in ["battery", "charge"]):
            bat = data["battery"]
            if bat["has_battery"]:
                plug_str = "plugged in and charging" if bat["plugged"] else "running on battery"
                spoken = f"Your battery is at {bat['percent']} percent and {plug_str}."
                display = f"🔋 **Battery Status**: {bat['percent']}% ({plug_str})"
            else:
                spoken = "This device is running on continuous AC desktop power."
                display = "🔌 **Power**: AC Desktop Power Connected"
            return SkillResult(handled=True, spoken_response=spoken, display_text=display, card_type="system_info", card_data=data)

        # CPU
        if any(w in q for w in ["cpu", "processor"]):
            cpu = data["cpu"]
            spoken = f"CPU utilization is currently at {cpu['usage_percent']} percent across {cpu['logical_cores']} logical cores."
            display = (
                f"💻 **CPU Usage**: {cpu['usage_percent']}%\n"
                f"- **Cores**: {cpu['physical_cores']} Physical / {cpu['logical_cores']} Logical\n"
                f"- **Frequency**: {cpu['frequency_mhz']} MHz"
            )
            return SkillResult(handled=True, spoken_response=spoken, display_text=display, card_type="system_info", card_data=data)

        # RAM
        if any(w in q for w in ["ram", "memory"]):
            mem = data["memory"]
            spoken = f"You have {mem['free_gb']} GB of available memory out of {mem['total_gb']} GB total. Memory load is {mem['usage_percent']} percent."
            display = (
                f"🧠 **Memory (RAM)**: {mem['usage_percent']}% Used\n"
                f"- **Used**: {mem['used_gb']} GB\n"
                f"- **Available**: {mem['free_gb']} GB\n"
                f"- **Total**: {mem['total_gb']} GB"
            )
            return SkillResult(handled=True, spoken_response=spoken, display_text=display, card_type="system_info", card_data=data)

        # Disk
        if any(w in q for w in ["disk", "storage", "hard drive"]):
            disk = data["disk"]
            spoken = f"Drive {disk['drive']} has {disk['free_gb']} GB free out of {disk['total_gb']} GB. Usage is at {disk['usage_percent']} percent."
            display = (
                f"💾 **Disk Storage ({disk['drive']})**: {disk['usage_percent']}% Used\n"
                f"- **Free Space**: {disk['free_gb']} GB\n"
                f"- **Used Space**: {disk['used_gb']} GB\n"
                f"- **Total Size**: {disk['total_gb']} GB"
            )
            return SkillResult(handled=True, spoken_response=spoken, display_text=display, card_type="system_info", card_data=data)

        # Network
        if any(w in q for w in ["network", "internet", "connection"]):
            net = data["network"]
            stat = "Online" if net["online"] else "Offline"
            spoken = f"Network is currently {stat}. Connection latency is {net['latency_ms']} milliseconds over {net['adapter_type']}."
            display = (
                f"🌐 **Network Status**: {stat}\n"
                f"- **Adapter**: {net['adapter_type']}\n"
                f"- **Ping Latency**: {net['latency_ms']} ms"
            )
            return SkillResult(handled=True, spoken_response=spoken, display_text=display, card_type="system_info", card_data=data)

        # Full System Overview
        os_info = data["os"]
        cpu = data["cpu"]
        mem = data["memory"]
        net = data["network"]
        spoken = (
            f"Your system is running {os_info['summary']}. CPU load is {cpu['usage_percent']} percent, "
            f"and you have {mem['free_gb']} GB of available memory. Network is {net['status']}."
        )
        display = (
            f"🖥️ **System Status Overview**\n"
            f"- **OS**: {os_info['summary']}\n"
            f"- **CPU**: {cpu['usage_percent']}% load ({cpu['logical_cores']} cores)\n"
            f"- **Memory**: {mem['used_gb']} GB / {mem['total_gb']} GB ({mem['usage_percent']}%)\n"
            f"- **Disk**: {data['disk']['free_gb']} GB free on {data['disk']['drive']}\n"
            f"- **Network**: {net['status']} ({net['latency_ms']} ms)"
        )
        return SkillResult(
            handled=True,
            spoken_response=spoken,
            display_text=display,
            card_type="system_info",
            card_data=data
        )
