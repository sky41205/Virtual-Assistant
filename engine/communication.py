import os
import re
import sqlite3
import urllib.parse
import webbrowser
import random

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sophia.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_contacts_table():
    """Ensure contacts table exists."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) UNIQUE COLLATE NOCASE,
                phone_no VARCHAR(20),
                email VARCHAR(100)
            )
        """)
        conn.commit()

init_contacts_table()

# ----------------- CONTACTS CRUD -----------------
def add_contact(name: str, phone_no: str, email: str = "") -> bool:
    """Add or update contact in the database."""
    name = name.strip()
    phone_no = phone_no.strip()
    email = email.strip() if email else ""
    if not name or not phone_no:
        return False
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO contacts (name, phone_no, email)
                VALUES (?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    phone_no = excluded.phone_no,
                    email = excluded.email
            """, (name, phone_no, email))
            conn.commit()
            return True
    except Exception as e:
        print(f"Error saving contact: {e}")
        return False

def get_contact(name: str):
    """Find a contact by name (case-insensitive, exact or fuzzy)."""
    clean_name = name.strip().lower()
    if not clean_name:
        return None
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # 1. Exact case-insensitive match
            cursor.execute("SELECT * FROM contacts WHERE LOWER(name) = ?", (clean_name,))
            row = cursor.fetchone()
            if row:
                return dict(row)

            # 2. Contains match
            cursor.execute("SELECT * FROM contacts WHERE LOWER(name) LIKE ?", (f"%{clean_name}%",))
            row = cursor.fetchone()
            if row:
                return dict(row)

            # 3. First name match
            first_word = clean_name.split()[0]
            cursor.execute("SELECT * FROM contacts WHERE LOWER(name) LIKE ?", (f"{first_word}%",))
            row = cursor.fetchone()
            if row:
                return dict(row)

            return None
    except Exception as e:
        print(f"Error querying contact: {e}")
        return None

def get_all_contacts():
    """Return all saved contacts ordered by name."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, phone_no, email FROM contacts ORDER BY name ASC")
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error getting all contacts: {e}")
        return []

def delete_contact(contact_id_or_name) -> bool:
    """Delete a contact by ID or Name."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if str(contact_id_or_name).isdigit():
                cursor.execute("DELETE FROM contacts WHERE id = ?", (int(contact_id_or_name),))
            else:
                cursor.execute("DELETE FROM contacts WHERE LOWER(name) = ?", (str(contact_id_or_name).lower().strip(),))
            conn.commit()
            return cursor.rowcount > 0
    except Exception as e:
        print(f"Error deleting contact: {e}")
        return False

def format_phone_number(raw: str) -> str:
    """Normalize phone number to international format (defaulting to +91 for 10-digit Indian numbers)."""
    raw = raw.strip()
    digits = re.sub(r'[^\d+]', '', raw)
    if digits.startswith('+'):
        return digits
    # If 10 digits, assume standard Indian mobile number
    if len(digits) == 10:
        return '+91' + digits
    if len(digits) == 12 and digits.startswith('91'):
        return '+' + digits
    return '+' + digits if digits else ""

# ----------------- COMMUNICATION ACTIONS -----------------

def is_whatsapp_desktop_available() -> bool:
    """Check whether WhatsApp Desktop is properly installed and registered."""
    try:
        import winreg
        for root in [winreg.HKEY_CLASSES_ROOT, winreg.HKEY_CURRENT_USER]:
            try:
                key_path = r"whatsapp\shell\open\command" if root == winreg.HKEY_CLASSES_ROOT else r"Software\Classes\whatsapp\shell\open\command"
                with winreg.OpenKey(root, key_path) as k:
                    cmd_val, _ = winreg.QueryValueEx(k, "")
                    if cmd_val and len(cmd_val.strip()) > 0:
                        return True
            except Exception:
                pass
        for root in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
            try:
                with winreg.OpenKey(root, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\WhatsApp.exe") as k:
                    exe_val, _ = winreg.QueryValueEx(k, "")
                    if exe_val and os.path.exists(exe_val):
                        return True
            except Exception:
                pass
    except Exception:
        pass
    return False

def open_whatsapp() -> tuple[bool, str]:
    """Launch WhatsApp desktop app if available, or seamlessly open WhatsApp Web."""
    if is_whatsapp_desktop_available():
        try:
            res = os.system('start "" "whatsapp:"')
            if res == 0:
                return True, "Opening WhatsApp Desktop for you."
        except Exception as e:
            print(f"WhatsApp desktop launch notice: {e}")
    
    # Fallback to WhatsApp Web in default browser
    try:
        webbrowser.open("https://web.whatsapp.com")
        return True, "Opening WhatsApp Web in your browser."
    except Exception as e:
        return False, f"Could not open WhatsApp: {e}"

def open_facebook() -> tuple[bool, str]:
    """Launch Facebook in default browser."""
    try:
        webbrowser.open("https://www.facebook.com")
        return True, "Opening Facebook right away."
    except Exception as e:
        return False, f"Could not open Facebook: {e}"

def send_whatsapp_message(target: str, message: str) -> tuple[bool, str]:
    """
    Send WhatsApp message to a contact name or phone number.
    Uses WhatsApp Desktop if available, otherwise seamlessly opens WhatsApp Web.
    """
    if not target or not target.strip():
        return False, "Who would you like to send the WhatsApp message to?"

    target = target.strip()
    display_name = target
    phone = ""

    # Check if target is digits/phone number
    digits_only = re.sub(r'[^\d]', '', target)
    if len(digits_only) >= 10:
        phone = format_phone_number(target)
    else:
        # Search in contacts
        contact = get_contact(target)
        if contact:
            display_name = contact['name']
            phone = format_phone_number(contact['phone_no'])
        else:
            return False, f"I couldn't find '{target}' in your saved contacts. Would you like to add their number?"

    if not phone:
        return False, f"Could not determine a valid phone number for {display_name}."

    if not message or not message.strip():
        return False, f"What message would you like to send to {display_name}?"

    encoded_text = urllib.parse.quote(message.strip())
    whatsapp_uri = f"whatsapp://send?phone={phone}&text={encoded_text}"
    web_url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded_text}"

    # Try launching native WhatsApp Desktop first if available
    if is_whatsapp_desktop_available():
        try:
            res = os.system(f'start "" "{whatsapp_uri}"')
            if res == 0:
                return True, f"Sending WhatsApp message to {display_name}: '{message}'."
        except Exception as e:
            print(f"WhatsApp protocol launch notice: {e}")

    # Seamless fallback to WhatsApp Web
    try:
        webbrowser.open(web_url)
        return True, f"Opening WhatsApp Web to message {display_name}."
    except Exception as e:
        return False, f"Could not open WhatsApp Web: {e}"

def make_phone_call(target: str) -> tuple[bool, str]:
    """
    Make a phone call via Windows Phone Link / default dialer (`tel:` protocol).
    """
    if not target or not target.strip():
        return False, "Who would you like to call?"

    target = target.strip()
    display_name = target
    phone = ""

    digits_only = re.sub(r'[^\d]', '', target)
    if len(digits_only) >= 10:
        phone = format_phone_number(target)
    else:
        contact = get_contact(target)
        if contact:
            display_name = contact['name']
            phone = format_phone_number(contact['phone_no'])
        else:
            return False, f"I couldn't find '{target}' in your contacts list."

    if not phone:
        return False, f"No valid phone number found for {display_name}."

    try:
        os.system(f'start tel:{phone}')
        return True, f"Calling {display_name} on {phone} right now."
    except Exception as e:
        print(f"Dialer error: {e}")
        return False, f"Could not initiate call to {display_name}."

def make_whatsapp_call(target: str, is_video: bool = False) -> tuple[bool, str]:
    """
    Initiate WhatsApp call (opens contact chat with dial intent).
    """
    target = target.strip()
    contact = get_contact(target)
    display_name = contact['name'] if contact else target
    phone = format_phone_number(contact['phone_no'] if contact else target)

    if not phone:
        return False, f"I don't have a phone number for {display_name}."

    call_type = "video call" if is_video else "voice call"
    try:
        # Open contact in WhatsApp
        os.system(f'start whatsapp://send?phone={phone}')
        return True, f"Opening WhatsApp {call_type} with {display_name}."
    except Exception as e:
        return False, f"Could not initiate WhatsApp call: {e}"

# ----------------- BILINGUAL COMMAND PARSER -----------------

def handle_communication_command(query: str) -> tuple[bool, str]:
    """
    Parse and execute communication intents in both English and Hindi/Hinglish.
    Returns (handled, response_speech).
    """
    q = query.lower().strip()

    # 1. Open WhatsApp
    if (q in ["whatsapp", "open whatsapp", "whatsapp open", "launch whatsapp", "start whatsapp",
              "whatsapp kholo", "whatsapp open karo", "whatsapp chalao", "whatsapp web", "व्हाट्सएप खोलो"]
        or (("whatsapp" in q or "व्हाट्सएप" in q) and any(w in q for w in ["open", "kholo", "chalao", "launch", "start"]) and not any(w in q for w in ["message", "bhejo", "call", "video", "save", "add"]))):
        success, msg = open_whatsapp()
        return True, msg

    # 2. Open Facebook
    if q in ["open facebook", "facebook open", "launch facebook", "start facebook",
             "facebook kholo", "facebook open karo", "facebook chalao", "फेसबुक खोलो"]:
        success, msg = open_facebook()
        return True, msg

    # 3. Add Contact: "add contact Sachin 9876543210" or "save contact Sachin 9876543210"
    add_match = re.search(r'(?:add|save)\s+contact\s+([a-zA-Z\s]+?)\s+([+\d\s-]+)$', q)
    if add_match:
        name = add_match.group(1).strip()
        num = add_match.group(2).strip()
        if name and num:
            saved = add_contact(name, num)
            if saved:
                return True, f"Successfully saved {name.title()} with number {num}."
            return True, f"Could not save contact {name}."

    # Hindi contact save: "Sachin ka number save karo 9876543210"
    hi_add_match = re.search(r'([a-zA-Z\s]+?)\s+ka\s+number\s+save\s+karo\s+([+\d\s-]+)$', q)
    if hi_add_match:
        name = hi_add_match.group(1).strip()
        num = hi_add_match.group(2).strip()
        if name and num:
            saved = add_contact(name, num)
            if saved:
                return True, f"{name.title()} का नंबर {num} सेव कर दिया गया है।"
            return True, f"संपर्क सेव करने में समस्या आई।"

    # 4. WhatsApp Message Patterns
    # Pattern A: "send whatsapp [message] to [name]: [msg]" or "send whatsapp to [name] that [msg]"
    m_a = re.search(r'send\s+whatsapp(?:\s+message)?\s+to\s+([a-zA-Z0-9\s]+?)(?::|\s+that|\s+saying)\s+(.+)$', q)
    if m_a:
        target = m_a.group(1).strip()
        msg = m_a.group(2).strip()
        success, resp = send_whatsapp_message(target, msg)
        return True, resp

    # Pattern B: "whatsapp [name] [message]" or "whatsapp to [name] [message]"
    m_b = re.search(r'^whatsapp\s+(?:to\s+)?([a-zA-Z0-9]+)\s+(.+)$', q)
    if m_b and not any(w in q for w in ["call", "kholo", "open"]):
        target = m_b.group(1).strip()
        msg = m_b.group(2).strip()
        success, resp = send_whatsapp_message(target, msg)
        return True, resp

    # Pattern C (Hindi/Hinglish): "[name] ko whatsapp message bhejo [msg]" or "[name] ko whatsapp karo [msg]"
    # e.g. "sachin ko whatsapp message bhejo kal party hai"
    # e.g. "sachin ko whatsapp karo kal milte hain"
    m_c = re.search(r'([a-zA-Z0-9\s]+?)\s+ko\s+whatsapp(?:\s+message|\s+pe\s+message)?\s+(?:bhejo|karo)\s*(.*)$', q)
    if m_c:
        target = m_c.group(1).strip()
        msg = m_c.group(2).strip()
        if not msg:
            return True, f"{target} को क्या संदेश भेजना चाहते हैं?"
        success, resp = send_whatsapp_message(target, msg)
        return True, resp

    # Pattern D (Pure Hindi): "[name] को व्हाट्सएप करो [msg]" or "[name] को मैसेज भेजो [msg]"
    m_d = re.search(r'([\u0900-\u097Fa-zA-Z0-9\s]+?)\s+को\s+व्हाट्सएप\s*(?:करो|भेजो)?\s*(.*)$', q)
    if m_d:
        target = m_d.group(1).strip()
        msg = m_d.group(2).strip()
        if not msg:
            return True, f"{target} को क्या व्हाट्सएप संदेश भेजना चाहते हैं?"
        success, resp = send_whatsapp_message(target, msg)
        return True, resp

    # Pattern E: "send whatsapp to [name]" (without message)
    m_e = re.search(r'send\s+whatsapp(?:\s+message)?\s+to\s+([a-zA-Z0-9\s]+)$', q)
    if m_e:
        target = m_e.group(1).strip()
        return True, f"What message would you like me to send to {target}?"

    # 5. Calling Patterns
    # Pattern A (WhatsApp Call): "whatsapp call [name]" or "whatsapp video call [name]"
    m_wa_call = re.search(r'whatsapp\s+(video\s+)?call\s+(?:to\s+)?([a-zA-Z0-9\s]+)$', q)
    if m_wa_call:
        is_video = bool(m_wa_call.group(1))
        target = m_wa_call.group(2).strip()
        success, resp = make_whatsapp_call(target, is_video=is_video)
        return True, resp

    # Pattern B (Phone Call): "call [name/phone]" or "make a call to [name]" or "phone [name]"
    m_call = re.search(r'^(?:call|phone|dial|make\s+a\s+call\s+to)\s+([a-zA-Z0-9\s]+)$', q)
    if m_call and not any(w in q for w in ["whatsapp", "video", "karo", "lagao"]):
        target = m_call.group(1).strip()
        success, resp = make_phone_call(target)
        return True, resp

    # Pattern C (Hindi/Hinglish Call): "[name] ko call karo" or "[name] ko phone lagao" or "[name] ko call lagao"
    m_hi_call = re.search(r'([a-zA-Z0-9\s]+?)\s+ko\s+(?:phone|call)\s+(?:karo|lagao|milao)$', q)
    if m_hi_call:
        target = m_hi_call.group(1).strip()
        success, resp = make_phone_call(target)
        return True, resp

    # Pattern D (Pure Hindi Call): "[name] को कॉल करो" or "[name] को फोन लगाओ"
    m_hi_pure = re.search(r'([\u0900-\u097Fa-zA-Z0-9\s]+?)\s+को\s+(?:कॉल|फोन)\s+(?:करो|लगाओ|मिलाओ)$', q)
    if m_hi_pure:
        target = m_hi_pure.group(1).strip()
        success, resp = make_phone_call(target)
        return True, resp

    # 6. List / Show Contacts
    if q in ["show contacts", "list contacts", "all contacts", "contacts dikhao", "contact list", "संपर्क दिखाओ"]:
        contacts = get_all_contacts()
        if not contacts:
            return True, "You don't have any contacts saved yet. You can add them in the Settings drawer!"
        names = ", ".join([c['name'] for c in contacts[:5]])
        count = len(contacts)
        return True, f"You have {count} saved contacts including: {names}."

    return False, ""
