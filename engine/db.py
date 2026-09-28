import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sophia.db")

def init_database():
    """Ensure all required database tables exist with proper schemas."""
    try:
        with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
            cursor = conn.cursor()

            # 1. System Commands
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sys_command (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    path VARCHAR(1000) NOT NULL
                )
            """)

            # 2. Web Commands
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS web_command (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    url VARCHAR(1000) NOT NULL
                )
            """)

            # 3. Contacts
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS contacts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200) NOT NULL,
                    mobile_no VARCHAR(50) NOT NULL,
                    email VARCHAR(200) DEFAULT ''
                )
            """)

            # 4. Command History
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS command_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    command TEXT NOT NULL,
                    response TEXT,
                    source TEXT DEFAULT 'chat',
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 5. Productivity Tasks
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    completed INTEGER DEFAULT 0,
                    priority TEXT DEFAULT 'medium',
                    due_date TEXT DEFAULT '',
                    category TEXT DEFAULT 'general',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 6. Notes
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    note_text TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 7. Calendar Events
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS calendar_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT DEFAULT '',
                    location TEXT DEFAULT '',
                    status TEXT DEFAULT 'scheduled',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 8. UI Preferences
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ui_preferences (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    theme_mode TEXT DEFAULT 'dark',
                    accent_color TEXT DEFAULT 'cyan',
                    font_size TEXT DEFAULT 'medium',
                    reduced_motion INTEGER DEFAULT 0,
                    widgets_pinned TEXT DEFAULT '[]'
                )
            """)

            conn.commit()
            return True
    except Exception as e:
        print(f"Database initialization error: {e}")
        return False

# Initialize database schema on load
init_database()