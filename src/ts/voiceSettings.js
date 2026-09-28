/* ================================================================
   DRACARYS AI — voiceSettings.ts
   Voice & Assistant Settings Panel Manager
   ================================================================ */
export class VoiceSettingsManager {
    constructor() {
        this.currentTheme = "cyan";
        this.currentTheme = localStorage.getItem("assistant_theme") || "cyan";
        this.applyTheme(this.currentTheme);
        this.bindEvents();
        this.loadSettings();
    }
    bindEvents() {
        const btnSave = document.getElementById("btnSaveSettings");
        if (btnSave) {
            btnSave.addEventListener("click", () => this.saveSettings());
        }
        const btnTestHindi = document.getElementById("btnTestHindiVoice");
        if (btnTestHindi) {
            btnTestHindi.addEventListener("click", () => {
                var _a;
                const voice = ((_a = document.getElementById("settingHindiVoice")) === null || _a === void 0 ? void 0 : _a.value) || "hi-IN-SwaraNeural";
                if (window.eel && window.eel.testVoice) {
                    window.eel.testVoice(voice, "hindi")();
                }
            });
        }
        const btnTestEnglish = document.getElementById("btnTestEnglishVoice");
        if (btnTestEnglish) {
            btnTestEnglish.addEventListener("click", () => {
                var _a;
                const voice = ((_a = document.getElementById("settingEnglishVoice")) === null || _a === void 0 ? void 0 : _a.value) || "en-IN-NeerjaNeural";
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
                        if (window.restoreMainUI)
                            window.restoreMainUI();
                    });
                }
            });
        }
        // Theme picker buttons
        document.querySelectorAll(".theme-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget;
                const theme = target.getAttribute("data-theme");
                if (theme)
                    this.applyTheme(theme);
            });
        });
        const settingsDrawer = document.getElementById("settingsOffcanvas");
        if (settingsDrawer) {
            settingsDrawer.addEventListener("show.bs.offcanvas", () => this.loadSettings());
        }
    }
    applyTheme(theme) {
        document.body.classList.remove("theme-fire", "theme-cyan", "theme-purple", "theme-emerald", "theme-stealth");
        document.body.classList.add("theme-" + theme);
        document.querySelectorAll(".theme-btn").forEach(b => {
            if (b.getAttribute("data-theme") === theme) {
                b.classList.add("active");
            }
            else {
                b.classList.remove("active");
            }
        });
        localStorage.setItem("assistant_theme", theme);
        this.currentTheme = theme;
    }
    loadSettings() {
        if (!window.eel || !window.eel.getAssistantSettings)
            return;
        window.eel.getAssistantSettings()((s) => {
            if (!s)
                return;
            const nameInput = document.getElementById("settingAssistantName");
            const titleEl = document.getElementById("assistantDisplayTitle");
            if (s.name) {
                if (nameInput)
                    nameInput.value = s.name;
                if (titleEl)
                    titleEl.textContent = s.name.toUpperCase();
                document.title = s.name.toUpperCase();
            }
            const langSelect = document.getElementById("settingSpeechLang");
            if (langSelect && s.speech_lang)
                langSelect.value = s.speech_lang;
            const hindiSelect = document.getElementById("settingHindiVoice");
            if (hindiSelect && s.tts_hindi_voice)
                hindiSelect.value = s.tts_hindi_voice;
            const engSelect = document.getElementById("settingEnglishVoice");
            if (engSelect && s.tts_english_voice)
                engSelect.value = s.tts_english_voice;
            if (s.theme)
                this.applyTheme(s.theme);
        });
    }
    saveSettings() {
        var _a, _b, _c, _d;
        const name = ((_a = document.getElementById("settingAssistantName")) === null || _a === void 0 ? void 0 : _a.value.trim()) || "Dracarys";
        const speechLang = ((_b = document.getElementById("settingSpeechLang")) === null || _b === void 0 ? void 0 : _b.value) || "en-IN";
        const hindiVoice = ((_c = document.getElementById("settingHindiVoice")) === null || _c === void 0 ? void 0 : _c.value) || "hi-IN-SwaraNeural";
        const engVoice = ((_d = document.getElementById("settingEnglishVoice")) === null || _d === void 0 ? void 0 : _d.value) || "en-IN-NeerjaNeural";
        const titleEl = document.getElementById("assistantDisplayTitle");
        if (titleEl)
            titleEl.textContent = name.toUpperCase();
        document.title = name.toUpperCase();
        if (window.eel && window.eel.saveAssistantSettings) {
            window.eel.saveAssistantSettings(name, 0, 170, 1.0, this.currentTheme, speechLang, hindiVoice, engVoice)(() => {
                this.closeDrawer();
            });
        }
    }
    closeDrawer() {
        const el = document.getElementById("settingsOffcanvas");
        if (el && window.bootstrap) {
            const inst = window.bootstrap.Offcanvas.getInstance(el);
            if (inst)
                inst.hide();
        }
    }
}
