import os
import glob
import re
import difflib
import subprocess
import winreg
import webbrowser
import threading
import json
from pathlib import Path

# In-memory application index
_app_cache = {}
_cache_initialized = False
_cache_lock = threading.RLock()

user_home = os.environ.get('USERPROFILE', '')

# Comprehensive Built-in Windows system tools, special folders, drives, settings, web services, and protocol URI handlers
BUILTIN_APPS = {
    # Special Folders
    "downloads": (os.path.join(user_home, "Downloads"), "folder", "Downloads"),
    "download": (os.path.join(user_home, "Downloads"), "folder", "Downloads"),
    "documents": (os.path.join(user_home, "Documents"), "folder", "Documents"),
    "document": (os.path.join(user_home, "Documents"), "folder", "Documents"),
    "my documents": (os.path.join(user_home, "Documents"), "folder", "Documents"),
    "desktop": (os.path.join(user_home, "Desktop"), "folder", "Desktop"),
    "pictures": (os.path.join(user_home, "Pictures"), "folder", "Pictures"),
    "my pictures": (os.path.join(user_home, "Pictures"), "folder", "Pictures"),
    "photos folder": (os.path.join(user_home, "Pictures"), "folder", "Pictures"),
    "videos": (os.path.join(user_home, "Videos"), "folder", "Videos"),
    "my videos": (os.path.join(user_home, "Videos"), "folder", "Videos"),
    "music": (os.path.join(user_home, "Music"), "folder", "Music"),
    "my music": (os.path.join(user_home, "Music"), "folder", "Music"),
    "recycle bin": ("shell:RecycleBinFolder", "uri", "Recycle Bin"),
    "trash": ("shell:RecycleBinFolder", "uri", "Recycle Bin"),

    # Drives
    "c drive": ("C:\\", "folder", "C: Drive"),
    "drive c": ("C:\\", "folder", "C: Drive"),
    "c:": ("C:\\", "folder", "C: Drive"),
    "d drive": ("D:\\", "folder", "D: Drive"),
    "drive d": ("D:\\", "folder", "D: Drive"),
    "d:": ("D:\\", "folder", "D: Drive"),
    "s drive": ("S:\\", "folder", "S: Drive"),
    "drive s": ("S:\\", "folder", "S: Drive"),
    "s:": ("S:\\", "folder", "S: Drive"),
    "e drive": ("E:\\", "folder", "E: Drive"),
    "drive e": ("E:\\", "folder", "E: Drive"),
    "e:": ("E:\\", "folder", "E: Drive"),

    # Windows Settings URIs
    "settings": ("ms-settings:", "uri", "Windows Settings"),
    "windows settings": ("ms-settings:", "uri", "Windows Settings"),
    "bluetooth": ("ms-settings:bluetooth", "uri", "Bluetooth Settings"),
    "bluetooth settings": ("ms-settings:bluetooth", "uri", "Bluetooth Settings"),
    "wifi": ("ms-settings:network-wifi", "uri", "Wi-Fi Settings"),
    "wifi settings": ("ms-settings:network-wifi", "uri", "Wi-Fi Settings"),
    "network": ("ms-settings:network", "uri", "Network Settings"),
    "network settings": ("ms-settings:network", "uri", "Network Settings"),
    "sound": ("ms-settings:sound", "uri", "Sound Settings"),
    "sound settings": ("ms-settings:sound", "uri", "Sound Settings"),
    "display": ("ms-settings:display", "uri", "Display Settings"),
    "display settings": ("ms-settings:display", "uri", "Display Settings"),
    "apps settings": ("ms-settings:appsfeatures", "uri", "Installed Apps"),
    "installed apps": ("ms-settings:appsfeatures", "uri", "Installed Apps"),
    "windows update": ("ms-settings:windowsupdate", "uri", "Windows Update"),
    "battery settings": ("ms-settings:batterysaver", "uri", "Battery Settings"),
    "storage settings": ("ms-settings:storagesense", "uri", "Storage Settings"),
    "notifications": ("ms-settings:notifications", "uri", "Notification Settings"),
    "privacy settings": ("ms-settings:privacy", "uri", "Privacy Settings"),

    # Administrative Utilities & System Tools
    "calculator": ("calc.exe", "exe", "Calculator"),
    "calc": ("calc.exe", "exe", "Calculator"),
    "notepad": ("notepad.exe", "exe", "Notepad"),
    "paint": ("mspaint.exe", "exe", "Paint"),
    "mspaint": ("mspaint.exe", "exe", "Paint"),
    "paint 3d": ("ms-paint:", "uri", "Paint 3D"),
    "task manager": ("taskmgr.exe", "exe", "Task Manager"),
    "taskmgr": ("taskmgr.exe", "exe", "Task Manager"),
    "command prompt": ("cmd.exe", "exe", "Command Prompt"),
    "cmd": ("cmd.exe", "exe", "Command Prompt"),
    "terminal": ("wt.exe", "exe", "Windows Terminal"),
    "windows terminal": ("wt.exe", "exe", "Windows Terminal"),
    "powershell": ("powershell.exe", "exe", "PowerShell"),
    "file explorer": ("explorer.exe", "exe", "File Explorer"),
    "explorer": ("explorer.exe", "exe", "File Explorer"),
    "my computer": ("explorer.exe", "exe", "File Explorer"),
    "this pc": ("explorer.exe", "exe", "File Explorer"),
    "control panel": ("control.exe", "exe", "Control Panel"),
    "regedit": ("regedit.exe", "exe", "Registry Editor"),
    "registry": ("regedit.exe", "exe", "Registry Editor"),
    "registry editor": ("regedit.exe", "exe", "Registry Editor"),
    "device manager": ("devmgmt.msc", "exe", "Device Manager"),
    "disk management": ("diskmgmt.msc", "exe", "Disk Management"),
    "programs and features": ("appwiz.cpl", "exe", "Programs and Features"),
    "network connections": ("ncpa.cpl", "exe", "Network Connections"),
    "system properties": ("sysdm.cpl", "exe", "System Properties"),
    "resource monitor": ("resmon.exe", "exe", "Resource Monitor"),
    "disk cleanup": ("cleanmgr.exe", "exe", "Disk Cleanup"),
    "event viewer": ("eventvwr.msc", "exe", "Event Viewer"),
    "services": ("services.msc", "exe", "Windows Services"),
    "snipping tool": ("ms-ScreenClip:", "uri", "Snipping Tool"),
    "snip": ("ms-ScreenClip:", "uri", "Snipping Tool"),
    "camera": ("microsoft.windows.camera:", "uri", "Camera"),
    "store": ("ms-windows-store:", "uri", "Microsoft Store"),
    "microsoft store": ("ms-windows-store:", "uri", "Microsoft Store"),
    "clock": ("ms-clock:", "uri", "Clock"),
    "alarms": ("ms-clock:", "uri", "Clock & Alarms"),
    "weather": ("bingweather:", "uri", "Weather"),
    "photos": ("ms-photos:", "uri", "Photos"),
    "voice recorder": ("ms-soundrecorder:", "uri", "Voice Recorder"),
    "sticky notes": ("shell:AppsFolder\\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe!App", "appx", "Sticky Notes"),

    # AI & LLM Portals
    "chatgpt": ("https://chatgpt.com", "url", "ChatGPT"),
    "chat gpt": ("https://chatgpt.com", "url", "ChatGPT"),
    "openai": ("https://chatgpt.com", "url", "ChatGPT"),
    "claude": ("https://claude.ai", "url", "Claude AI"),
    "claude ai": ("https://claude.ai", "url", "Claude AI"),
    "gemini": ("https://gemini.google.com", "url", "Google Gemini"),
    "google gemini": ("https://gemini.google.com", "url", "Google Gemini"),
    "perplexity": ("https://www.perplexity.ai", "url", "Perplexity AI"),
    "copilot": ("https://copilot.microsoft.com", "url", "Microsoft Copilot"),
    "deepseek": ("https://chat.deepseek.com", "url", "DeepSeek"),
    "poe": ("https://poe.com", "url", "Poe"),
    "huggingface": ("https://huggingface.co", "url", "Hugging Face"),
    "hugging face": ("https://huggingface.co", "url", "Hugging Face"),

    # Coding & Development Portals
    "github": ("https://github.com", "url", "GitHub"),
    "gitlab": ("https://gitlab.com", "url", "GitLab"),
    "leetcode": ("https://leetcode.com", "url", "LeetCode"),
    "leet code": ("https://leetcode.com", "url", "LeetCode"),
    "geeksforgeeks": ("https://www.geeksforgeeks.org", "url", "GeeksforGeeks"),
    "gfg": ("https://www.geeksforgeeks.org", "url", "GeeksforGeeks"),
    "hackerrank": ("https://www.hackerrank.com", "url", "HackerRank"),
    "codechef": ("https://www.codechef.com", "url", "CodeChef"),
    "codeforces": ("https://codeforces.com", "url", "Codeforces"),
    "stackoverflow": ("https://stackoverflow.com", "url", "Stack Overflow"),
    "stack overflow": ("https://stackoverflow.com", "url", "Stack Overflow"),
    "w3schools": ("https://www.w3schools.com", "url", "W3Schools"),
    "mdn": ("https://developer.mozilla.org", "url", "MDN Web Docs"),
    "kaggle": ("https://www.kaggle.com", "url", "Kaggle"),
    "replit": ("https://replit.com", "url", "Replit"),
    "vercel": ("https://vercel.com", "url", "Vercel"),
    "netlify": ("https://www.netlify.com", "url", "Netlify"),
    "npm": ("https://www.npmjs.com", "url", "npm"),

    # Streaming & Entertainment Portals
    "youtube": ("https://www.youtube.com", "url", "YouTube"),
    "netflix": ("https://www.netflix.com", "url", "Netflix"),
    "prime video": ("https://www.primevideo.com", "url", "Amazon Prime Video"),
    "amazon prime": ("https://www.primevideo.com", "url", "Amazon Prime Video"),
    "hotstar": ("https://www.hotstar.com", "url", "Disney+ Hotstar"),
    "disney hotstar": ("https://www.hotstar.com", "url", "Disney+ Hotstar"),
    "disney+ hotstar": ("https://www.hotstar.com", "url", "Disney+ Hotstar"),
    "jiocinema": ("https://www.jiocinema.com", "url", "JioCinema"),
    "jio cinema": ("https://www.jiocinema.com", "url", "JioCinema"),
    "sonyliv": ("https://www.sonyliv.com", "url", "SonyLIV"),
    "sony liv": ("https://www.sonyliv.com", "url", "SonyLIV"),
    "zee5": ("https://www.zee5.com", "url", "ZEE5"),
    "twitch": ("https://www.twitch.tv", "url", "Twitch"),
    "crunchyroll": ("https://www.crunchyroll.com", "url", "Crunchyroll"),
    "imdb": ("https://www.imdb.com", "url", "IMDb"),

    # Social & Communication Portals
    "instagram": ("https://www.instagram.com", "url", "Instagram"),
    "insta": ("https://www.instagram.com", "url", "Instagram"),
    "facebook": ("https://www.facebook.com", "url", "Facebook"),
    "fb": ("https://www.facebook.com", "url", "Facebook"),
    "twitter": ("https://x.com", "url", "X (Twitter)"),
    "x": ("https://x.com", "url", "X (Twitter)"),
    "linkedin": ("https://www.linkedin.com", "url", "LinkedIn"),
    "reddit": ("https://www.reddit.com", "url", "Reddit"),
    "pinterest": ("https://www.pinterest.com", "url", "Pinterest"),
    "threads": ("https://www.threads.net", "url", "Threads"),
    "snapchat": ("https://web.snapchat.com", "url", "Snapchat"),

    # Google Workspace & Cloud Utilities
    "browser": ("https://www.google.com", "url", "Google"),
    "web browser": ("https://www.google.com", "url", "Google"),
    "internet": ("https://www.google.com", "url", "Google"),
    "google": ("https://www.google.com", "url", "Google"),
    "gmail": ("https://mail.google.com", "url", "Gmail"),
    "mail": ("https://mail.google.com", "url", "Gmail"),
    "google mail": ("https://mail.google.com", "url", "Gmail"),
    "google drive": ("https://drive.google.com", "url", "Google Drive"),
    "drive": ("https://drive.google.com", "url", "Google Drive"),
    "google docs": ("https://docs.google.com", "url", "Google Docs"),
    "docs": ("https://docs.google.com", "url", "Google Docs"),
    "google sheets": ("https://sheets.google.com", "url", "Google Sheets"),
    "sheets": ("https://sheets.google.com", "url", "Google Sheets"),
    "google slides": ("https://slides.google.com", "url", "Google Slides"),
    "slides": ("https://slides.google.com", "url", "Google Slides"),
    "google photos": ("https://photos.google.com", "url", "Google Photos"),
    "google maps": ("https://maps.google.com", "url", "Google Maps"),
    "maps": ("https://maps.google.com", "url", "Google Maps"),
    "google translate": ("https://translate.google.com", "url", "Google Translate"),
    "translate": ("https://translate.google.com", "url", "Google Translate"),
    "wikipedia": ("https://www.wikipedia.org", "url", "Wikipedia"),
    "wiki": ("https://www.wikipedia.org", "url", "Wikipedia"),

    # Productivity, Design & Shopping
    "canva": ("https://www.canva.com", "url", "Canva"),
    "notion": ("https://www.notion.so", "url", "Notion"),
    "figma web": ("https://www.figma.com", "url", "Figma Web"),
    "amazon": ("https://www.amazon.in", "url", "Amazon"),
    "flipkart": ("https://www.flipkart.com", "url", "Flipkart"),
    "myntra": ("https://www.myntra.com", "url", "Myntra"),
    "swiggy": ("https://www.swiggy.com", "url", "Swiggy"),
    "zomato": ("https://www.zomato.com", "url", "Zomato"),
    "speedtest": ("https://www.speedtest.net", "url", "Speedtest"),

    # Common Productivity & Development Aliases
    "word": ("winword.exe", "alias", "Microsoft Word"),
    "ms word": ("winword.exe", "alias", "Microsoft Word"),
    "microsoft word": ("winword.exe", "alias", "Microsoft Word"),
    "excel": ("excel.exe", "alias", "Microsoft Excel"),
    "ms excel": ("excel.exe", "alias", "Microsoft Excel"),
    "microsoft excel": ("excel.exe", "alias", "Microsoft Excel"),
    "powerpoint": ("powerpnt.exe", "alias", "Microsoft PowerPoint"),
    "ms powerpoint": ("powerpnt.exe", "alias", "Microsoft PowerPoint"),
    "ppt": ("powerpnt.exe", "alias", "Microsoft PowerPoint"),
    "onenote": ("onenote.exe", "alias", "OneNote"),
    "outlook": ("outlook.exe", "alias", "Microsoft Outlook"),
    "vs code": ("code.exe", "alias", "Visual Studio Code"),
    "vscode": ("code.exe", "alias", "Visual Studio Code"),
    "code": ("code.exe", "alias", "Visual Studio Code"),
    "visual studio code": ("code.exe", "alias", "Visual Studio Code"),
    "cursor": ("cursor.exe", "alias", "Cursor"),
    "antigravity": ("antigravity.exe", "alias", "Antigravity"),
    "edge": ("msedge.exe", "alias", "Microsoft Edge"),
    "microsoft edge": ("msedge.exe", "alias", "Microsoft Edge"),
    "ms edge": ("msedge.exe", "alias", "Microsoft Edge"),
    "chrome": ("chrome.exe", "alias", "Google Chrome"),
    "google chrome": ("chrome.exe", "alias", "Google Chrome"),
    "brave": ("brave.exe", "alias", "Brave Browser"),
    "firefox": ("firefox.exe", "alias", "Mozilla Firefox"),
    "opera": ("opera.exe", "alias", "Opera Browser"),
    "spotify": ("spotify:", "uri", "Spotify"),
    "whatsapp": ("whatsapp:", "uri", "WhatsApp"),
    "discord": ("discord:", "uri", "Discord"),
    "telegram": ("tg:", "uri", "Telegram"),
    "slack": ("slack:", "uri", "Slack"),
    "zoom": ("zoom.exe", "alias", "Zoom"),
    "teams": ("msteams:", "uri", "Microsoft Teams"),
    "vlc": ("vlc.exe", "alias", "VLC Media Player"),
    "bluestacks": ("bluestacks_nxt", "alias", "BlueStacks 5"),
    "bluestacks 5": ("bluestacks_nxt", "alias", "BlueStacks 5"),
    "obs": ("obs64.exe", "alias", "OBS Studio"),
    "postman": ("postman.exe", "alias", "Postman"),
    "figma": ("figma.exe", "alias", "Figma"),
    "docker": ("docker desktop.exe", "alias", "Docker Desktop"),
    "docker desktop": ("docker desktop.exe", "alias", "Docker Desktop"),
    "steam": ("steam.exe", "alias", "Steam"),
}

def _get_registry_app_paths() -> dict:
    """Scan Windows App Paths in HKLM and HKCU registry keys."""
    app_paths = {}
    for root_hkey in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
        try:
            key = winreg.OpenKey(root_hkey, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths")
            i = 0
            while True:
                try:
                    sub_name = winreg.EnumKey(key, i)
                    sub_key = winreg.OpenKey(key, sub_name)
                    path_val, _ = winreg.QueryValueEx(sub_key, "")
                    if path_val and os.path.exists(path_val):
                        base = os.path.splitext(sub_name)[0].lower()
                        app_paths[sub_name.lower()] = path_val
                        app_paths[base] = path_val
                    winreg.CloseKey(sub_key)
                    i += 1
                except OSError:
                    break
            winreg.CloseKey(key)
        except Exception:
            pass
    return app_paths

def _get_start_apps_powershell() -> dict:
    """Scan all installed Modern & Win32 apps using PowerShell Get-StartApps."""
    powershell_apps = {}
    try:
        cmd = ["powershell", "-NoProfile", "-NonInteractive", "-Command", "Get-StartApps | ConvertTo-Json -Compress"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=6)
        if res.returncode == 0 and res.stdout.strip():
            data = json.loads(res.stdout)
            items = data if isinstance(data, list) else [data]
            for item in items:
                name = (item.get("Name") or "").strip()
                appid = (item.get("AppID") or "").strip()
                if name and appid:
                    clean_name = name.lower()
                    powershell_apps[clean_name] = (appid, "appx", name)
                    # Also index words
                    clean_simple = re.sub(r'[^a-zA-Z0-9\s]', '', clean_name).strip()
                    if clean_simple and clean_simple != clean_name:
                        powershell_apps[clean_simple] = (appid, "appx", name)
    except Exception as e:
        print(f"PowerShell Get-StartApps notice: {e}")
    return powershell_apps

def _get_uninstall_registry_apps() -> dict:
    """Scan Installed applications from Windows Uninstall Registry keys."""
    uninstall_apps = {}
    reg_locations = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]

    for root_key, subpath in reg_locations:
        try:
            key = winreg.OpenKey(root_key, subpath)
            i = 0
            while True:
                try:
                    sub_name = winreg.EnumKey(key, i)
                    sub_key = winreg.OpenKey(key, sub_name)
                    try:
                        disp_name, _ = winreg.QueryValueEx(sub_key, "DisplayName")
                        disp_icon, _ = winreg.QueryValueEx(sub_key, "DisplayIcon")
                        if disp_name and disp_icon:
                            clean_icon = disp_icon.split(",")[0].strip().strip('"')
                            if clean_icon.lower().endswith(".exe") and os.path.exists(clean_icon):
                                clean_key = disp_name.lower().strip()
                                uninstall_apps[clean_key] = (clean_icon, "exe", disp_name)
                    except Exception:
                        pass
                    winreg.CloseKey(sub_key)
                    i += 1
                except OSError:
                    break
            winreg.CloseKey(key)
        except Exception:
            pass
    return uninstall_apps

def index_desktop_apps():
    """Build a comprehensive index of all applications, shortcuts, tools, and store apps."""
    global _app_cache, _cache_initialized
    with _cache_lock:
        temp_cache = {}

        # 1. PowerShell Get-StartApps (Modern UWP & Start Menu entries)
        ps_apps = _get_start_apps_powershell()
        for k, v in ps_apps.items():
            temp_cache[k] = v

        # 2. Start Menu & Desktop .lnk and .url shortcuts
        user_profile = os.environ.get('USERPROFILE', '')
        search_directories = [
            r'C:\ProgramData\Microsoft\Windows\Start Menu\Programs',
            os.path.join(user_profile, r'AppData\Roaming\Microsoft\Windows\Start Menu\Programs'),
            os.path.join(user_profile, 'Desktop'),
            r'C:\Users\Public\Desktop',
            os.path.join(user_profile, r'OneDrive\Desktop'),
            os.path.join(user_profile, r'AppData\Local\Programs'),
        ]

        for folder in search_directories:
            if os.path.exists(folder):
                for root, _, files in os.walk(folder):
                    for filename in files:
                        lower_f = filename.lower()
                        if lower_f.endswith(('.lnk', '.url')):
                            display_name = os.path.splitext(filename)[0]
                            clean_key = display_name.lower().strip()
                            full_path = os.path.join(root, filename)
                            temp_cache[clean_key] = (full_path, "lnk", display_name)
                            # Simplified alphanumeric name
                            simp = re.sub(r'[^a-zA-Z0-9\s]', '', clean_key).strip()
                            if simp and simp not in temp_cache:
                                temp_cache[simp] = (full_path, "lnk", display_name)

        # 3. Registry App Paths
        reg_apps = _get_registry_app_paths()
        for name, path in reg_apps.items():
            clean_key = name.lower().strip()
            if clean_key not in temp_cache:
                display_name = os.path.splitext(os.path.basename(path))[0].title()
                temp_cache[clean_key] = (path, "exe", display_name)

        # 4. Uninstall Registry entries
        un_apps = _get_uninstall_registry_apps()
        for name, entry in un_apps.items():
            if name not in temp_cache:
                temp_cache[name] = entry

        # 5. Integrate Built-in applications
        for name, entry in BUILTIN_APPS.items():
            target, kind, display = entry
            if kind == "alias":
                # Check if target is already resolved
                if target in temp_cache:
                    temp_cache[name] = temp_cache[target]
                else:
                    temp_cache[name] = (target, "exe", display)
            else:
                temp_cache[name] = entry

        _app_cache = temp_cache
        _cache_initialized = True
        return _app_cache

def initialize_app_index_async():
    """Initialize app index in a background thread to prevent blocking startup."""
    t = threading.Thread(target=index_desktop_apps, daemon=True)
    t.start()

def clean_app_query(query: str) -> str:
    """Normalize and clean user voice/text query for app/file/url name extraction."""
    q = query.lower().strip()
    
    # Strip common command prefixes in English and Hindi/Hinglish
    prefixes = [
        "can you please open the ", "can you please open ", "can you open the ", "can you open ",
        "please open the ", "please open ", "open the ", "launch the ", "start the ", "run the ",
        "pull up the ", "open up the ", "open ", "launch ", "start ", "run ", "pull up ", "kholo ", "chalao ",
        "khol do ", "chala do ", "kholiye ", "shuru karo ", "start karo ",
        "खोलो ", "चलाओ ", "खोलें ", "शुरू करो ", "शुरू करें ", "खोल दो ", "चला दो "
    ]
    for p in prefixes:
        if q.startswith(p):
            q = q[len(p):].strip()
            break

    # Strip common postfixes
    postfixes = [
        " open karo", " start karo", " shuru karo", " chala do", " khol do", " kholo", " chalao", " kholiye",
        " खोलो", " चलाओ", " खोलें", " शुरू करो", " शुरू करें", " खोल दो", " चला दो",
        " website", " site", " portal", " app", " application", " please", " now"
    ]
    for p in postfixes:
        if q.endswith(p):
            q = q[:-len(p)].strip()

    # Clean punctuation
    q = re.sub(r'[?!.,;:]', '', q).strip()
    return q

def _search_user_files(query: str):
    """Deep search user folders (Desktop, Documents, Downloads, Pictures, Videos) for files or subfolders."""
    if not query or len(query) < 2:
        return None
    user_home = os.environ.get('USERPROFILE', '')
    search_dirs = [
        os.path.join(user_home, "Desktop"),
        os.path.join(user_home, "Documents"),
        os.path.join(user_home, "Downloads"),
        os.path.join(user_home, "Pictures"),
        os.path.join(user_home, "Videos"),
        os.path.join(user_home, "OneDrive"),
    ]
    
    q_clean = query.lower().strip()
    
    for base_dir in search_dirs:
        if not os.path.exists(base_dir):
            continue
        try:
            for root, dirs, files in os.walk(base_dir):
                # Search matching directory
                for d in dirs:
                    if d.lower() == q_clean or q_clean == os.path.splitext(d.lower())[0]:
                        full_p = os.path.join(root, d)
                        return (full_p, "folder", d)
                # Search matching file
                for f in files:
                    base_f = os.path.splitext(f.lower())[0]
                    if f.lower() == q_clean or base_f == q_clean:
                        full_p = os.path.join(root, f)
                        return (full_p, "file", f)
                # Depth limit of 3 to stay fast
                rel_depth = len(Path(root).relative_to(Path(base_dir)).parts)
                if rel_depth >= 3:
                    dirs.clear()
        except Exception:
            pass
    return None

def find_app(query: str):
    """Find the best matching application, file, folder, drive, web portal, or system tool."""
    global _cache_initialized, _app_cache
    if not _cache_initialized:
        index_desktop_apps()

    q = clean_app_query(query)
    if not q:
        return None

    # Check 1: Direct match in BUILTIN_APPS
    if q in BUILTIN_APPS:
        target, kind, display = BUILTIN_APPS[q]
        if kind == "alias":
            if target in _app_cache:
                return _app_cache[target]
            return (target, "exe", display)
        return (target, kind, display)

    # Check 2: Direct path on disk (e.g. "C:\...", "S:\...", folder or file)
    if os.path.exists(q):
        display = os.path.basename(q) or q
        kind = "folder" if os.path.isdir(q) else "file"
        return (os.path.abspath(q), kind, display)

    # Check 3: Check User Documents Analyzer
    try:
        from engine.document_analyzer import resolve_document_path
        doc_path = resolve_document_path(q)
        if doc_path and os.path.exists(doc_path):
            display = os.path.basename(doc_path)
            kind = "folder" if os.path.isdir(doc_path) else "file"
            return (doc_path, kind, display)
    except Exception:
        pass

    # Check 4: Exact match in indexed applications
    if q in _app_cache:
        return _app_cache[q]

    # Check 5: Deep search in User Files & Folders
    user_file_match = _search_user_files(q)
    if user_file_match:
        return user_file_match

    # Check 6: Simplified alphanumeric match (e.g. "vs code" -> "vscode")
    q_simple = re.sub(r'[^a-zA-Z0-9]', '', q)
    if q_simple:
        for key, val in _app_cache.items():
            key_simple = re.sub(r'[^a-zA-Z0-9]', '', key)
            if q_simple == key_simple:
                return val

    # Check 7: Substring match
    for key, val in _app_cache.items():
        if key.startswith(q) or q.startswith(key):
            return val

    for key, val in _app_cache.items():
        if q in key or key in q:
            return val

    # Check 8: Word-boundary / Token matching
    q_words = [w for w in q.split() if len(w) >= 3]
    if q_words:
        for word in q_words:
            for key, val in _app_cache.items():
                if word in key.split():
                    return val

    # Check 9: Fuzzy matching with difflib
    candidates = list(_app_cache.keys())
    matches = difflib.get_close_matches(q, candidates, n=1, cutoff=0.55)
    if matches:
        return _app_cache[matches[0]]

    # Check 10: URL or Web Domain resolution (e.g., "example.com", "subdomain.org", "http://...")
    domain_match = re.search(r'^[a-zA-Z0-9\-]+\.(com|org|net|in|io|ai|co|app|gov|edu|tech|dev|me|info)$', q)
    if domain_match or q.startswith("http://") or q.startswith("https://") or ("." in q and not q.endswith(".exe")):
        url = q if q.startswith("http") else f"https://{q}"
        return (url, "url", q)

    return None

def launch_app(query: str) -> tuple[bool, str]:
    """Search and launch any application, file, folder, drive, modern store app, website, or tool."""
    match = find_app(query)
    clean_name = clean_app_query(query)

    if not match:
        if not clean_name:
            return False, query
        # Universal web/search fallback: launch directly in default browser or Windows shell
        try:
            # Check if likely a website name (e.g., "netflix", "flipkart", "amazon")
            if " " not in clean_name and len(clean_name) >= 3:
                url = f"https://www.{clean_name}.com"
                webbrowser.open(url)
                return True, clean_name.title()
            else:
                # Open Google search for the query
                url = f"https://www.google.com/search?q={clean_name}"
                webbrowser.open(url)
                return True, clean_name.title()
        except Exception as e:
            print(f"Fallback web launch failed for {clean_name}: {e}")
            try:
                subprocess.Popen(f'start "" "{clean_name}"', shell=True)
                return True, clean_name.title()
            except Exception as e2:
                print(f"Shell start failed: {e2}")
                return False, clean_name

    target, kind, display_name = match

    try:
        if kind == "appx":
            appx_path = target if target.startswith("shell:") else f"shell:AppsFolder\\{target}"
            subprocess.Popen(f'explorer.exe "{appx_path}"', shell=True)
            return True, display_name

        elif kind == "url":
            webbrowser.open(target)
            return True, display_name

        elif kind == "uri":
            if target == "whatsapp:":
                from engine.communication import open_whatsapp
                success, _ = open_whatsapp()
                return success, display_name
            subprocess.Popen(f'start "" "{target}"', shell=True)
            return True, display_name

        elif kind in ["lnk", "file", "folder"]:
            os.startfile(target)
            return True, display_name

        elif kind == "exe":
            if os.path.isabs(target) and os.path.exists(target):
                subprocess.Popen([target], shell=False)
            elif target.endswith(('.msc', '.cpl')):
                subprocess.Popen(f'start "" "{target}"', shell=True)
            else:
                subprocess.Popen(target, shell=True)
            return True, display_name

        else:
            os.startfile(target)
            return True, display_name

    except Exception as e:
        print(f"Primary launch failed for {display_name} ({target}): {e}. Attempting universal fallback.")
        try:
            subprocess.Popen(f'start "" "{target}"', shell=True)
            return True, display_name
        except Exception as e2:
            print(f"Secondary launch failed: {e2}")
            # Try web browser fallback
            try:
                webbrowser.open(f"https://www.google.com/search?q={clean_name}")
                return True, display_name
            except Exception:
                return False, display_name

# Start async indexing when module is imported
initialize_app_index_async()
