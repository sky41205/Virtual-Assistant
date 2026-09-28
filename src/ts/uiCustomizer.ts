/* ================================================================
   DRACARYS AI — uiCustomizer.ts
   UI Customization, Accessibility Engine, and Keyboard Controller
   ================================================================ */

import { UIPreferences } from "./types";

// Built-in background presets (served from www/assets/bg/)
const BG_PRESETS: { id: string; label: string; url: string }[] = [
    { id: "none",     label: "None",     url: "" },
    { id: "nebula",   label: "Nebula",   url: "assets/bg/nebula.jpg" },
    { id: "aurora",   label: "Aurora",   url: "assets/bg/aurora.jpg" },
    { id: "space",    label: "Space",    url: "assets/bg/space.jpg" },
    { id: "forest",   label: "Forest",   url: "assets/bg/forest.jpg" },
    { id: "abstract", label: "Abstract", url: "assets/bg/abstract.jpg" },
];

export class UICustomizer {
    private prefs: UIPreferences & { bgImage?: string } = {
        theme_mode: "dark",
        accent_color: "cyan",
        font_size: "medium",
        reduced_motion: false,
        widgets_pinned: ["clock", "weather", "tasks", "notes", "calendar", "telemetry"],
        bgImage: ""
    };

    constructor() {
        this.loadPreferences();
        this.bindEvents();
        this.setupKeyboardShortcuts();
    }

    private bindEvents(): void {
        // Light / Dark mode toggle
        const modeToggle = document.getElementById("toggleThemeMode") as HTMLInputElement;
        if (modeToggle) {
            modeToggle.addEventListener("change", () => {
                this.prefs.theme_mode = modeToggle.checked ? "light" : "dark";
                this.applyPreferences();
                this.savePreferences();
            });
        }

        // Accent color buttons
        document.querySelectorAll(".accent-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLElement;
                const accent = target.getAttribute("data-accent");
                if (accent) {
                    this.prefs.accent_color = accent;
                    this.applyPreferences();
                    this.savePreferences();
                }
            });
        });

        // Font size buttons
        document.querySelectorAll(".font-size-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLElement;
                const size = target.getAttribute("data-size") as any;
                if (size) {
                    this.prefs.font_size = size;
                    this.applyPreferences();
                    this.savePreferences();
                }
            });
        });

        // Reduced motion checkbox
        const motionToggle = document.getElementById("toggleReducedMotion") as HTMLInputElement;
        if (motionToggle) {
            motionToggle.addEventListener("change", () => {
                this.prefs.reduced_motion = motionToggle.checked;
                this.applyPreferences();
                this.savePreferences();
            });
        }

        // Background Image Preset buttons
        document.querySelectorAll(".bg-preset-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLElement;
                const presetId = target.getAttribute("data-bg");
                const preset = BG_PRESETS.find(p => p.id === presetId);
                if (preset !== undefined) {
                    this.prefs.bgImage = preset.url;
                    this.applyBackground(this.prefs.bgImage);
                    this.savePreferences();
                    // Highlight active
                    document.querySelectorAll(".bg-preset-btn").forEach(b => b.classList.remove("active"));
                    target.classList.add("active");
                }
            });
        });

        // Custom background image file upload
        const bgUploadInput = document.getElementById("bgImageUploadInput") as HTMLInputElement;
        if (bgUploadInput) {
            bgUploadInput.addEventListener("change", () => {
                const file = bgUploadInput.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    if (dataUrl) {
                        this.prefs.bgImage = dataUrl;
                        this.applyBackground(dataUrl);
                        // Save to localStorage only (data URL too large for backend)
                        localStorage.setItem("assistant_ui_prefs", JSON.stringify(this.prefs));
                        document.querySelectorAll(".bg-preset-btn").forEach(b => b.classList.remove("active"));
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    }

    /** Apply a background image (URL or data URL) or clear it if empty. */
    public applyBackground(imageUrl: string): void {
        const body = document.body;
        if (imageUrl) {
            body.style.setProperty("--custom-bg-image", `url('${imageUrl}')`);
            body.classList.add("has-custom-bg");
        } else {
            body.style.removeProperty("--custom-bg-image");
            body.classList.remove("has-custom-bg");
        }
        // Sync active state on preset buttons
        document.querySelectorAll(".bg-preset-btn").forEach(btn => {
            const presetId = btn.getAttribute("data-bg");
            const preset = BG_PRESETS.find(p => p.id === presetId);
            if (preset && preset.url === imageUrl) {
                btn.classList.add("active");
            } else if (presetId === "none" && !imageUrl) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            // Ignore when user is typing inside text fields (unless Escape or Enter)
            const activeTag = (document.activeElement?.tagName || "").toLowerCase();
            const isInputActive = activeTag === "input" || activeTag === "textarea";

            // Ctrl + M: Toggle Voice Input
            if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
                e.preventDefault();
                const micBtn = document.getElementById("MicBtn");
                micBtn?.click();
                this.announce("Microphone toggled via shortcut.");
                return;
            }

            // Ctrl + W: Toggle Dashboard Widgets Drawer
            if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
                e.preventDefault();
                this.toggleDrawer("widgetsOffcanvas");
                this.announce("Dashboard widgets toggled.");
                return;
            }

            // Ctrl + H: Toggle Task History Drawer
            if (e.ctrlKey && (e.key === "h" || e.key === "H")) {
                e.preventDefault();
                this.toggleDrawer("historyOffcanvas");
                this.announce("Task history drawer toggled.");
                return;
            }

            // Ctrl + ,: Toggle Voice & Assistant Settings
            if (e.ctrlKey && e.key === ",") {
                e.preventDefault();
                this.toggleDrawer("settingsOffcanvas");
                this.announce("Settings drawer toggled.");
                return;
            }

            // Ctrl + U: Trigger Document Upload
            if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
                e.preventDefault();
                const uploadBtn = document.getElementById("UploadBtn");
                uploadBtn?.click();
                this.announce("Document upload file picker opened.");
                return;
            }

            // Quick focus chatbox on "/" when not inside an input
            if (e.key === "/" && !isInputActive) {
                e.preventDefault();
                const chatbox = document.getElementById("chatbox");
                chatbox?.focus();
            }
        });
    }

    private toggleDrawer(drawerId: string): void {
        const el = document.getElementById(drawerId);
        if (el && window.bootstrap) {
            const inst = window.bootstrap.Offcanvas.getOrCreateInstance(el);
            inst.toggle();
        }
    }

    public applyPreferences(): void {
        const body = document.body;

        // 1. Theme Mode (Dark / Light)
        if (this.prefs.theme_mode === "light") {
            body.classList.add("mode-light");
            body.classList.remove("mode-dark");
        } else {
            body.classList.add("mode-dark");
            body.classList.remove("mode-light");
        }

        // Sync toggle switch UI
        const modeToggle = document.getElementById("toggleThemeMode") as HTMLInputElement;
        if (modeToggle) modeToggle.checked = (this.prefs.theme_mode === "light");

        // 2. Accent Color
        body.classList.remove(
            "theme-cyan", "theme-fire", "theme-emerald", "theme-purple",
            "theme-crimson", "theme-blue", "theme-amber", "theme-stealth"
        );
        body.classList.add("theme-" + this.prefs.accent_color);

        // Highlight active accent button
        document.querySelectorAll(".accent-btn").forEach(b => {
            if (b.getAttribute("data-accent") === this.prefs.accent_color) {
                b.classList.add("active");
            } else {
                b.classList.remove("active");
            }
        });

        // 3. Font Size Scaling
        document.documentElement.setAttribute("data-font-size", this.prefs.font_size);
        document.querySelectorAll(".font-size-btn").forEach(b => {
            if (b.getAttribute("data-size") === this.prefs.font_size) {
                b.classList.add("active");
            } else {
                b.classList.remove("active");
            }
        });

        // 4. Reduced Motion
        if (this.prefs.reduced_motion) {
            body.classList.add("reduced-motion");
        } else {
            body.classList.remove("reduced-motion");
        }
        const motionToggle = document.getElementById("toggleReducedMotion") as HTMLInputElement;
        if (motionToggle) motionToggle.checked = this.prefs.reduced_motion;

        // 5. Background Image
        this.applyBackground(this.prefs.bgImage || "");
    }

    public loadPreferences(): void {
        // Check localStorage first
        const saved = localStorage.getItem("assistant_ui_prefs");
        if (saved) {
            try {
                this.prefs = { ...this.prefs, ...JSON.parse(saved) };
                this.applyPreferences();
            } catch (e) {}
        }

        // Then sync with backend database
        if (window.eel && window.eel.getUIPreferences) {
            window.eel.getUIPreferences()((dbPrefs: UIPreferences) => {
                if (dbPrefs) {
                    this.prefs = { ...this.prefs, ...dbPrefs };
                    this.applyPreferences();
                }
            });
        }
    }

    public savePreferences(): void {
        localStorage.setItem("assistant_ui_prefs", JSON.stringify(this.prefs));
        if (window.eel && window.eel.saveUIPreferences) {
            window.eel.saveUIPreferences(
                this.prefs.theme_mode,
                this.prefs.accent_color,
                this.prefs.font_size,
                this.prefs.reduced_motion,
                this.prefs.widgets_pinned
            )();
        }
    }

    public announce(message: string): void {
        const sr = document.getElementById("srAnnouncer");
        if (sr) {
            sr.textContent = message;
        }
    }

    public getPreferences(): UIPreferences {
        return this.prefs;
    }
}
