import os
import glob
import difflib
import subprocess
import winreg
import webbrowser
from pathlib import Path

# Cache for indexed applications
_app_cache = {}
_cache_initialized = False

user_home = os.environ.get('USERPROFILE', '')

# Built-in Windows system tools, folders, drives & protocols
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

    # Web & Browser
    "browser": ("https://www.google.com", "url", "Browser"),
    "web browser": ("https://www.google.com", "url", "Browser"),
    "internet": ("https://www.google.com", "url", "Browser"),
    "google": ("https://www.google.com", "url", "Google"),

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

    # Administrative Utilities
    "device manager": ("devmgmt.msc", "exe", "Device Manager"),
    "disk management": ("diskmgmt.msc", "exe", "Disk Management"),
    "programs and features": ("appwiz.cpl", "exe", "Programs and Features"),
    "add or remove programs": ("appwiz.cpl", "exe", "Programs and Features"),
    "network connections": ("ncpa.cpl", "exe", "Network Connections"),
    "network settings": ("ms-settings:network", "uri", "Network Settings"),
    "system properties": ("sysdm.cpl", "exe", "System Properties"),
    "resource monitor": ("resmon.exe", "exe", "Resource Monitor"),
    "disk cleanup": ("cleanmgr.exe", "exe", "Disk Cleanup"),
    "event viewer": ("eventvwr.msc", "exe", "Event Viewer"),
    "services": ("services.msc", "exe", "Windows Services"),
    "bluetooth": ("ms-settings:bluetooth", "uri", "Bluetooth Settings"),
    "bluetooth settings": ("ms-settings:bluetooth", "uri", "Bluetooth Settings"),
    "wifi": ("ms-settings:network-wifi", "uri", "Wi-Fi Settings"),
    "wifi settings": ("ms-settings:network-wifi", "uri", "Wi-Fi Settings"),
    "sound": ("ms-settings:sound", "uri", "Sound Settings"),
    "sound settings": ("ms-settings:sound", "uri", "Sound Settings"),
    "display": ("ms-settings:display", "uri", "Display Settings"),
    "display settings": ("ms-settings:display", "uri", "Display Settings"),

    # Apps & Tools
    "settings": ("ms-settings:", "uri", "Windows Settings"),
    "windows settings": ("ms-settings:", "uri", "Windows Settings"),
    "calculator": ("calc.exe", "exe", "Calculator"),
    "calc": ("calc.exe", "exe", "Calculator"),
    "notepad": ("notepad.exe", "exe", "Notepad"),
    "paint": ("mspaint.exe", "exe", "Paint"),
    "mspaint": ("mspaint.exe", "exe", "Paint"),
    "task manager": ("taskmgr.exe", "exe", "Task Manager"),
    "taskmgr": ("taskmgr.exe", "exe", "Task Manager"),
    "command prompt": ("cmd.exe", "exe", "Command Prompt"),
    "cmd": ("cmd.exe", "exe", "Command Prompt"),
    "terminal": ("powershell.exe", "exe", "PowerShell"),
    "powershell": ("powershell.exe", "exe", "PowerShell"),
    "file explorer": ("explorer.exe", "exe", "File Explorer"),
    "explorer": ("explorer.exe", "exe", "File Explorer"),
    "my computer": ("explorer.exe", "exe", "File Explorer"),
    "this pc": ("explorer.exe", "exe", "File Explorer"),
    "control panel": ("control.exe", "exe", "Control Panel"),
    "regedit": ("regedit.exe", "exe", "Registry Editor"),
    "registry": ("regedit.exe", "exe", "Registry Editor"),
    "camera": ("microsoft.windows.camera:", "uri", "Camera"),
    "store": ("ms-windows-store:", "uri", "Microsoft Store"),
    "microsoft store": ("ms-windows-store:", "uri", "Microsoft Store"),
    "clock": ("ms-clock:", "uri", "Clock"),
    "alarms": ("ms-clock:", "uri", "Clock & Alarms"),
    "weather": ("bingweather:", "uri", "Weather"),
    "photos": ("ms-photos:", "uri", "Photos"),
    "word": ("winword.exe", "alias", "Microsoft Word"),
    "ms word": ("winword.exe", "alias", "Microsoft Word"),
    "excel": ("excel.exe", "alias", "Microsoft Excel"),
    "ms excel": ("excel.exe", "alias", "Microsoft Excel"),
    "powerpoint": ("powerpnt.exe", "alias", "Microsoft PowerPoint"),
    "ms powerpoint": ("powerpnt.exe", "alias", "Microsoft PowerPoint"),
    "ppt": ("powerpnt.exe", "alias", "Microsoft PowerPoint"),
    "vs code": ("code.exe", "alias", "Visual Studio Code"),
    "vscode": ("code.exe", "alias", "Visual Studio Code"),
    "code": ("code.exe", "alias", "Visual Studio Code"),
    "edge": ("msedge.exe", "alias", "Microsoft Edge"),
    "chrome": ("chrome.exe", "alias", "Google Chrome"),
    "spotify": ("spotify:", "uri", "Spotify"),
    "whatsapp": ("whatsapp:", "uri", "WhatsApp"),
    "discord": ("discord:", "uri", "Discord"),
    "telegram": ("tg:", "uri", "Telegram"),
    "slack": ("slack:", "uri", "Slack"),
}

def _get_registry_app_paths():
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
                        # Index by full filename (e.g. 'chrome.exe') and base name ('chrome')
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

def index_desktop_apps():
    """Scan Start Menu, Desktop folders, and Registry to build app index."""
    global _app_cache, _cache_initialized
    _app_cache.clear()

    user_profile = os.environ.get('USERPROFILE', '')
    search_directories = [
        r'C:\ProgramData\Microsoft\Windows\Start Menu\Programs',
        os.path.join(user_profile, r'AppData\Roaming\Microsoft\Windows\Start Menu\Programs'),
        os.path.join(user_profile, 'Desktop'),
        r'C:\Users\Public\Desktop'
    ]

    # Index all .lnk shortcut files
    for folder in search_directories:
        if os.path.exists(folder):
            for root, _, files in os.walk(folder):
                for filename in files:
                    if filename.lower().endswith('.lnk'):
                        display_name = os.path.splitext(filename)[0]
                        clean_key = display_name.lower().strip()
                        full_path = os.path.join(root, filename)
                        _app_cache[clean_key] = (full_path, "lnk", display_name)

    # Index registry app paths
    reg_apps = _get_registry_app_paths()
    for name, path in reg_apps.items():
        clean_key = name.lower().strip()
        if clean_key not in _app_cache:
            display_name = os.path.splitext(os.path.basename(path))[0].title()
            _app_cache[clean_key] = (path, "exe", display_name)

    _cache_initialized = True
    return _app_cache

def find_app(query: str):
    """Find the best matching application, folder, file, or tool for a given user query."""
    global _cache_initialized, _app_cache
    if not _cache_initialized:
        index_desktop_apps()

    # Clean the query (remove common prefixes)
    q = query.lower().strip()
    for prefix in ["open the ", "launch the ", "start the ", "open ", "launch ", "start ", "run "]:
        if q.startswith(prefix):
            q = q[len(prefix):].strip()
            break
    q = q.replace("app", "").replace("application", "").strip()

    if not q:
        return None

    # Check 1: Direct match in BUILTIN_APPS (folders, drives, tools, protocols)
    if q in BUILTIN_APPS:
        target, kind, display = BUILTIN_APPS[q]
        if kind == "alias":
            if target in _app_cache:
                return _app_cache[target]
            return (target, "exe", display)
        return (target, kind, display)

    # Check 2: Direct path on disk (e.g. "C:\...", "S:\...", relative paths)
    if os.path.exists(q):
        display = os.path.basename(q) or q
        kind = "folder" if os.path.isdir(q) else "file"
        return (os.path.abspath(q), kind, display)

    # Check 3: Check User Folders / Files (Desktop, Documents, Downloads)
    try:
        from engine.document_analyzer import resolve_document_path
        doc_path = resolve_document_path(q)
        if doc_path and os.path.exists(doc_path):
            display = os.path.basename(doc_path)
            kind = "folder" if os.path.isdir(doc_path) else "file"
            return (doc_path, kind, display)
    except Exception:
        pass

    # Check 4: Exact match in indexed shortcuts & apps
    if q in _app_cache:
        return _app_cache[q]

    # Check 5: Substring search (e.g. "bluestacks" in "bluestacks 5", "word" in "microsoft word")
    for key, val in _app_cache.items():
        if q in key or key in q:
            return val

    # Check 6: Word-boundary matching
    q_words = q.split()
    for word in q_words:
        if len(word) >= 3:
            for key, val in _app_cache.items():
                if word in key.split():
                    return val

    # Check 7: Fuzzy matching with difflib
    candidates = list(_app_cache.keys())
    matches = difflib.get_close_matches(q, candidates, n=1, cutoff=0.5)
    if matches:
        return _app_cache[matches[0]]

    return None

def launch_app(query: str) -> tuple[bool, str]:
    """Search and launch an application, file, folder, drive, or system utility."""
    match = find_app(query)
    if not match:
        # Last-resort: try to directly start whatever was asked
        clean_name = query.lower()
        for w in ["open the ", "open ", "launch the ", "launch ", "start the ", "start "]:
            if clean_name.startswith(w):
                clean_name = clean_name[len(w):]
        clean_name = clean_name.strip()
        try:
            subprocess.Popen(f'start "" "{clean_name}"', shell=True)
            return True, clean_name.title()
        except Exception:
            return False, clean_name

    target, kind, display_name = match

    def _run(cmd):
        """Helper: launch via shell start command with proper quoting."""
        subprocess.Popen(f'start "" {cmd}', shell=True)

    try:
        if kind == "url":
            webbrowser.open(target)
            return True, display_name

        elif kind == "uri":
            if target == "whatsapp:":
                from engine.communication import open_whatsapp
                success, _ = open_whatsapp()
                return success, display_name
            # URI schemes: ms-settings:, shell:, bingweather:, whatsapp:, etc.
            subprocess.Popen(f'start "" "{target}"', shell=True)
            return True, display_name

        elif kind in ["lnk", "file"]:
            os.startfile(target)
            return True, display_name

        elif kind == "folder":
            os.startfile(target)
            return True, display_name

        elif kind == "exe":
            # Check if it's an absolute existing path
            if os.path.isabs(target) and os.path.exists(target):
                subprocess.Popen([target], shell=False)
            elif target.endswith(('.msc', '.cpl')):
                # MMC snap-ins and Control Panel applets need to run via start
                subprocess.Popen(f'start "" "{target}"', shell=True)
            else:
                # System executables on PATH (calc.exe, notepad.exe, etc.)
                subprocess.Popen(target, shell=True)
            return True, display_name

        else:
            os.startfile(target)
            return True, display_name

    except Exception as e:
        print(f"Error launching {display_name} ({target}): {e}")
        try:
            # Universal fallback
            subprocess.Popen(f'start "" "{target}"', shell=True)
            return True, display_name
        except Exception as e2:
            print(f"Secondary launch error: {e2}")
            return False, display_name

