/* ================================================================
   DRACARYS AI — voiceSettings.ts
   Voice & Assistant Settings Panel Manager
   ================================================================ */

import { VoiceSettings } from "./types";

export class VoiceSettingsManager {
    private currentTheme: string = "cyan";

    constructor() {
        this.currentTheme = localStorage.getItem("assistant_theme") || "cyan";
        this.applyTheme(this.currentTheme);
        this.bindEvents();
        this.loadSettings();
    }

    private bindEvents(): void {
        const btnSave = document.getElementById("btnSaveSettings");
        if (btnSave) {
            btnSave.addEventListener("click", () => this.saveSettings());
        }

        const btnTestHindi = document.getElementById("btnTestHindiVoice");
        if (btnTestHindi) {
            btnTestHindi.addEventListener("click", () => {
                const voice = (document.getElementById("settingHindiVoice") as HTMLSelectElement)?.value || "hi-IN-SwaraNeural";
                if (window.eel && window.eel.testVoice) {
                    window.eel.testVoice(voice, "hindi")();
                }
            });
        }

        const btnTestEnglish = document.getElementById("btnTestEnglishVoice");
        if (btnTestEnglish) {
            btnTestEnglish.addEventListener("click", () => {
                const voice = (document.getElementById("settingEnglishVoice") as HTMLSelectElement)?.value || "en-IN-NeerjaNeural";
                if (window.eel && window.eel.testVoice) {
                    window.eel.testVoice(voice, "english")();
                }
            });
        }

        const btnResetState = document.getElementById("btnResetState");
        if (btnResetState) {
            btnResetState.addEventListener("click", () => {
                if (window.eel && window.eel.resetAssistantState) {
                    window.eel.resetAssistantState()(() => {
                        this.closeDrawer();
                        if (window.restoreMainUI) window.restoreMainUI();
                    });
                }
            });
        }

        // Theme picker buttons
        document.querySelectorAll(".theme-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLElement;
                const theme = target.getAttribute("data-theme");
                if (theme) this.applyTheme(theme);
            });
        });

        const settingsDrawer = document.getElementById("settingsOffcanvas");
        if (settingsDrawer) {
            settingsDrawer.addEventListener("show.bs.offcanvas", () => this.loadSettings());
        }
    }

    public applyTheme(theme: string): void {
        document.body.classList.remove("theme-fire", "theme-cyan", "theme-purple", "theme-emerald", "theme-stealth");
        document.body.classList.add("theme-" + theme);

        document.querySelectorAll(".theme-btn").forEach(b => {
            if (b.getAttribute("data-theme") === theme) {
                b.classList.add("active");
            } else {
                b.classList.remove("active");
            }
        });

        localStorage.setItem("assistant_theme", theme);
        this.currentTheme = theme;
    }

    public loadSettings(): void {
        if (!window.eel || !window.eel.getAssistantSettings) return;

        window.eel.getAssistantSettings()((s: VoiceSettings) => {
            if (!s) return;

            const nameInput = document.getElementById("settingAssistantName") as HTMLInputElement;
            const titleEl = document.getElementById("assistantDisplayTitle");
            if (s.name) {
                if (nameInput) nameInput.value = s.name;
                if (titleEl) titleEl.textContent = s.name.toUpperCase();
                document.title = s.name.toUpperCase();
            }

            const langSelect = document.getElementById("settingSpeechLang") as HTMLSelectElement;
            if (langSelect && s.speech_lang) langSelect.value = s.speech_lang;

            const hindiSelect = document.getElementById("settingHindiVoice") as HTMLSelectElement;
            if (hindiSelect && s.tts_hindi_voice) hindiSelect.value = s.tts_hindi_voice;

            const engSelect = document.getElementById("settingEnglishVoice") as HTMLSelectElement;
            if (engSelect && s.tts_english_voice) engSelect.value = s.tts_english_voice;

            if (s.theme) this.applyTheme(s.theme);
        });
    }

    public saveSettings(): void {
        const name = (document.getElementById("settingAssistantName") as HTMLInputElement)?.value.trim() || "Dracarys";
        const speechLang = (document.getElementById("settingSpeechLang") as HTMLSelectElement)?.value || "en-IN";
        const hindiVoice = (document.getElementById("settingHindiVoice") as HTMLSelectElement)?.value || "hi-IN-SwaraNeural";
        const engVoice = (document.getElementById("settingEnglishVoice") as HTMLSelectElement)?.value || "en-IN-NeerjaNeural";

        const titleEl = document.getElementById("assistantDisplayTitle");
        if (titleEl) titleEl.textContent = name.toUpperCase();
        document.title = name.toUpperCase();

        if (window.eel && window.eel.saveAssistantSettings) {
            window.eel.saveAssistantSettings(
                name, 0, 170, 1.0, this.currentTheme, speechLang, hindiVoice, engVoice
            )(() => {
                this.closeDrawer();
            });
        }
    }

    private closeDrawer(): void {
        const el = document.getElementById("settingsOffcanvas");
        if (el && window.bootstrap) {
            const inst = window.bootstrap.Offcanvas.getInstance(el);
            if (inst) inst.hide();
        }
    }
}
