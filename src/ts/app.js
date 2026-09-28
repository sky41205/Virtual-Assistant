/* ================================================================
   DRACARYS AI — app.ts
   Main Application Controller & State Orchestrator
   ================================================================ */
import { AssistantState } from "./types";
import { AudioVisualizer } from "./audioVisualizer";
import { VoiceEngine } from "./voiceEngine";
import { SpeechManager } from "./speechManager";
import { HistoryManager } from "./historyManager";
import { VoiceSettingsManager } from "./voiceSettings";
import { DocumentUploader } from "./documentUploader";
export class AssistantApp {
    constructor() {
        this.currentActiveState = AssistantState.IDLE;
        this.visualizer = new AudioVisualizer("audioVisualizerCanvas");
        this.speechManager = new SpeechManager((isSpeaking) => {
            if (isSpeaking) {
                this.visualizer.setState(AssistantState.SPEAKING);
            }
        });
        this.voiceEngine = new VoiceEngine({
            onStateChange: (state, msg) => {
                this.showSiriScreen();
                this.visualizer.setState(state, msg);
                if (msg)
                    this.setMessageText(msg);
                this.hideErrorActions();
            },
            onInterimText: (text) => {
                this.setMessageText(text);
                this.visualizer.setState(AssistantState.LISTENING, "Listening…");
            },
            onFinalResult: (transcript) => {
                this.setMessageText(transcript);
                this.visualizer.setState(AssistantState.PROCESSING, "Thinking…");
                this.dispatchCommand(transcript, "voice");
            },
            onError: (errorType, message) => {
                this.visualizer.setState(AssistantState.ERROR, "Error");
                this.setMessageText(message);
                this.showErrorActions();
            }
        });
        this.historyManager = new HistoryManager((cmd) => {
            this.dispatchCommand(cmd, "chat");
        });
        this.settingsManager = new VoiceSettingsManager();
        this.documentUploader = new DocumentUploader((filename) => {
            this.showSiriScreen();
            this.visualizer.setState(AssistantState.PROCESSING, "Analyzing " + filename + "…");
            this.setMessageText("Analyzing document: " + filename + "…");
        }, (result) => {
            this.restoreMainUI();
        });
        this.bindUserControls();
        this.initTextillate();
        this.exportGlobalBridge();
    }
    initTextillate() {
        const $ = window.$ || window.jQuery;
        if ($ && $.fn && $.fn.textillate) {
            try {
                $(".text").textillate({
                    loop: true,
                    sync: true,
                    in: { effect: "bounceIn" },
                    out: { effect: "bounceOut" }
                });
            }
            catch (e) {
                console.warn("Textillate init notice:", e);
            }
        }
    }
    bindUserControls() {
        // Microphone button
        const micBtn = document.getElementById("MicBtn");
        if (micBtn) {
            micBtn.addEventListener("click", () => {
                if (window.eel && window.eel.playClickSound)
                    window.eel.playClickSound();
                this.voiceEngine.startListening();
            });
        }
        // Refresh button
        const refreshBtn = document.getElementById("RefreshBtn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                refreshBtn.classList.add("spin-animation");
                if (window.eel && window.eel.playClickSound)
                    window.eel.playClickSound();
                if (window.eel && window.eel.resetAssistantState) {
                    window.eel.resetAssistantState()(() => {
                        this.restoreMainUI();
                        this.settingsManager.loadSettings();
                        this.historyManager.loadHistory();
                        const chatbox = document.getElementById("chatbox");
                        if (chatbox)
                            chatbox.value = "";
                        setTimeout(() => refreshBtn.classList.remove("spin-animation"), 900);
                    });
                }
                else {
                    this.restoreMainUI();
                    refreshBtn.classList.remove("spin-animation");
                }
            });
        }
        // Chat input field
        const chatbox = document.getElementById("chatbox");
        if (chatbox) {
            chatbox.addEventListener("keyup", (e) => {
                if (e.key === "Enter") {
                    const query = chatbox.value.trim();
                    if (!query)
                        return;
                    chatbox.value = "";
                    this.dispatchCommand(query, "chat");
                }
            });
        }
        // Cancel / Stop button on SiriWave screen
        const btnCancel = document.getElementById("btnCancelSpeech");
        if (btnCancel) {
            btnCancel.addEventListener("click", (e) => {
                e.stopPropagation();
                this.cancelAllAndDismiss();
            });
        }
        // Retry Voice button (on error)
        const btnRetry = document.getElementById("btnRetryVoice");
        if (btnRetry) {
            btnRetry.addEventListener("click", (e) => {
                e.stopPropagation();
                this.hideErrorActions();
                this.voiceEngine.startListening();
            });
        }
        // Type Instead / Text fallback button
        const btnSwitchText = document.getElementById("btnSwitchToText");
        if (btnSwitchText) {
            btnSwitchText.addEventListener("click", (e) => {
                e.stopPropagation();
                this.switchToTextFallback();
            });
        }
        // Dismiss on SiriWave container click
        const siriSection = document.getElementById("SiriWave");
        if (siriSection) {
            siriSection.addEventListener("click", (e) => {
                const target = e.target;
                if (!target.closest("#visualizerActionButtons") && !target.closest("#btnCancelSpeech") && !target.closest("#btnRetryVoice") && !target.closest("#btnSwitchToText")) {
                    this.cancelAllAndDismiss();
                }
            });
        }
        // Keyboard shortcuts
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.cancelAllAndDismiss();
            }
        });
    }
    showSiriScreen(initialText) {
        const oval = document.getElementById("Oval");
        const siri = document.getElementById("SiriWave");
        if (oval)
            oval.hidden = true;
        if (siri)
            siri.hidden = false;
        if (initialText)
            this.setMessageText(initialText);
    }
    restoreMainUI() {
        this.voiceEngine.stopListening();
        this.visualizer.setState(AssistantState.IDLE);
        this.hideErrorActions();
        const oval = document.getElementById("Oval");
        const siri = document.getElementById("SiriWave");
        if (siri)
            siri.hidden = true;
        if (oval)
            oval.hidden = false;
    }
    cancelAllAndDismiss() {
        this.voiceEngine.stopListening();
        this.speechManager.cancelAndReset();
        this.restoreMainUI();
    }
    switchToTextFallback() {
        this.restoreMainUI();
        const chatbox = document.getElementById("chatbox");
        if (chatbox) {
            chatbox.focus();
        }
    }
    dispatchCommand(query, source) {
        if (!query || !query.trim())
            return;
        const cleanQuery = query.trim();
        this.showSiriScreen(cleanQuery);
        this.visualizer.setState(AssistantState.PROCESSING, "Thinking…");
        if (window.eel && window.eel.playClickSound) {
            window.eel.playClickSound();
        }
        if (window.eel && window.eel.allCommands) {
            window.eel.allCommands(cleanQuery)();
        }
    }
    setMessageText(text) {
        const msgEl = document.getElementById("siriMessageText");
        if (msgEl) {
            msgEl.textContent = text;
        }
    }
    showErrorActions() {
        const btnRetry = document.getElementById("btnRetryVoice");
        const btnSwitch = document.getElementById("btnSwitchToText");
        if (btnRetry)
            btnRetry.style.display = "inline-block";
        if (btnSwitch)
            btnSwitch.style.display = "inline-block";
    }
    hideErrorActions() {
        const btnRetry = document.getElementById("btnRetryVoice");
        const btnSwitch = document.getElementById("btnSwitchToText");
        if (btnRetry)
            btnRetry.style.display = "none";
        if (btnSwitch)
            btnSwitch.style.display = "none";
    }
    exportGlobalBridge() {
        window.assistantApp = this;
        window.dispatchCommand = (q, s) => this.dispatchCommand(q, s);
        window.restoreMainUI = () => this.restoreMainUI();
        window.applyAssistantTheme = (t) => this.settingsManager.applyTheme(t);
    }
}
// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    new AssistantApp();
});
