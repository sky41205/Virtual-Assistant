/* ================================================================
   DRACARYS AI — shortcutManager.ts
   Desktop & Keyboard Shortcuts Controller with Custom Configuration
   ================================================================ */

import { ShortcutConfig } from "./types";

export interface ShortcutCallbacks {
    onToggleMic: () => void;
    onFocusAssistant: () => void;
    onMuteSpeech: () => void;
    onOpenQuickActions: () => void;
    onToggleDashboard: () => void;
    onToggleHistory: () => void;
    onOpenSettings: () => void;
    onOpenUpload: () => void;
    onOpenLogs?: () => void;
    onAnnounce: (msg: string) => void;
}

export class ShortcutManager {
    private shortcuts: ShortcutConfig = {
        mic: "Ctrl+M",
        quickActions: "Ctrl+K",
        dashboard: "Ctrl+W",
        mute: "Escape",
        history: "Ctrl+H",
        settings: "Ctrl+,",
        upload: "Ctrl+U"
    };

    private callbacks: ShortcutCallbacks;

    constructor(callbacks: ShortcutCallbacks) {
        this.callbacks = callbacks;
        this.loadShortcuts();
        this.bindGlobalKeyboardEvents();
        this.bindSettingsForm();
    }

    private loadShortcuts(): void {
        try {
            const saved = localStorage.getItem("sophia_shortcuts");
            if (saved) {
                const parsed = JSON.parse(saved);
                this.shortcuts = { ...this.shortcuts, ...parsed };
            }
        } catch (e) {
            console.warn("ShortcutManager load error:", e);
        }
    }

    public saveShortcuts(newShortcuts: Partial<ShortcutConfig>): void {
        this.shortcuts = { ...this.shortcuts, ...newShortcuts };
        try {
            localStorage.setItem("sophia_shortcuts", JSON.stringify(this.shortcuts));
            if (window.eel && window.eel.saveUIPreferences) {
                // Sync with database preferences
                window.eel.saveUIPreferences(
                    undefined, undefined, undefined, undefined, undefined
                );
            }
        } catch (e) {}
    }

    public getShortcuts(): ShortcutConfig {
        return { ...this.shortcuts };
    }

    private bindGlobalKeyboardEvents(): void {
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const activeTag = (activeEl?.tagName || "").toLowerCase();
            const isInputActive = activeTag === "input" || activeTag === "textarea" || (activeEl as HTMLElement)?.isContentEditable;

            // 1. MUTE SPEECH (Escape or Ctrl+Space) — Always active even in input
            if (e.key === "Escape" || (e.ctrlKey && e.code === "Space")) {
                this.callbacks.onMuteSpeech();
                return;
            }

            // 2. FOCUS ASSISTANT WINDOW / CHATBOX (Ctrl + Shift + A or Alt + A)
            if ((e.ctrlKey && e.shiftKey && (e.key === "a" || e.key === "A")) || (e.altKey && (e.key === "a" || e.key === "A"))) {
                e.preventDefault();
                this.callbacks.onFocusAssistant();
                this.callbacks.onAnnounce("Focused assistant input field.");
                return;
            }

            // 3. QUICK ACTIONS MODAL (Ctrl + K or Ctrl + /)
            if (e.ctrlKey && (e.key === "k" || e.key === "K" || e.key === "/")) {
                e.preventDefault();
                this.callbacks.onOpenQuickActions();
                this.callbacks.onAnnounce("Quick actions menu opened.");
                return;
            }

            // 4. TOGGLE MICROPHONE (Ctrl + M)
            if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
                e.preventDefault();
                this.callbacks.onToggleMic();
                this.callbacks.onAnnounce("Microphone toggled via shortcut.");
                return;
            }

            // 5. TOGGLE DASHBOARD WIDGETS (Ctrl + W)
            if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
                e.preventDefault();
                this.callbacks.onToggleDashboard();
                this.callbacks.onAnnounce("Dashboard widgets toggled.");
                return;
            }

            // 6. TOGGLE TASK HISTORY (Ctrl + H)
            if (e.ctrlKey && (e.key === "h" || e.key === "H")) {
                e.preventDefault();
                this.callbacks.onToggleHistory();
                this.callbacks.onAnnounce("Task history toggled.");
                return;
            }

            // 7. TOGGLE SETTINGS (Ctrl + ,)
            if (e.ctrlKey && e.key === ",") {
                e.preventDefault();
                this.callbacks.onOpenSettings();
                this.callbacks.onAnnounce("Settings panel toggled.");
                return;
            }

            // 7.5. TOGGLE SYSTEM LOGS & DIAGNOSTICS (Ctrl + L)
            if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
                e.preventDefault();
                if (this.callbacks.onOpenLogs) {
                    this.callbacks.onOpenLogs();
                    this.callbacks.onAnnounce("System logs and diagnostics opened.");
                }
                return;
            }

            // 8. OPEN UPLOAD (Ctrl + U)
            if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
                e.preventDefault();
                this.callbacks.onOpenUpload();
                this.callbacks.onAnnounce("Upload picker opened.");
                return;
            }

            // 9. Quick focus chatbox on "/" when not inside an input field
            if (e.key === "/" && !isInputActive) {
                e.preventDefault();
                this.callbacks.onFocusAssistant();
            }
        });
    }

    private bindSettingsForm(): void {
        // Keyboard shortcuts are dynamically active and referenced via settings reference card
    }
}
