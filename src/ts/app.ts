/* ================================================================
   DRACARYS AI — app.ts
   Minimalist Futuristic AI Orchestrator & State Controller
   ================================================================ */

import { AssistantState, DocumentAnalysisResult } from "./types";
import { AudioVisualizer } from "./audioVisualizer";
import { VoiceEngine } from "./voiceEngine";
import { SpeechManager } from "./speechManager";
import { HistoryManager } from "./historyManager";
import { VoiceSettingsManager } from "./voiceSettings";
import { DocumentUploader } from "./documentUploader";
import { UICustomizer } from "./uiCustomizer";
import { WidgetsManager } from "./widgetsManager";
import { ShortcutManager } from "./shortcutManager";
import { QuickActionsManager } from "./quickActions";
import { ConversationManager, detectClientLanguage } from "./conversationManager";
import { LogsManager } from "./logsManager";
import { DomainManager } from "./domainManager";
import { DragonBackground } from "./dragonBackground";

export class AssistantApp {
    public dragonBackground: DragonBackground | null = null;
    public visualizer: AudioVisualizer;
    public voiceEngine: VoiceEngine;
    public speechManager: SpeechManager;
    public historyManager: HistoryManager;
    public settingsManager: VoiceSettingsManager;
    public documentUploader: DocumentUploader;
    public uiCustomizer: UICustomizer;
    public widgetsManager: WidgetsManager;
    public shortcutManager: ShortcutManager;
    public quickActionsManager: QuickActionsManager;
    public conversationManager: ConversationManager;
    public logsManager: LogsManager;
    public domainManager: DomainManager;

    private currentActiveState: AssistantState = AssistantState.IDLE;
    private pendingActionId: string | null = null;
    private lastUserQuery: string = "";
    private lastAssistantResponse: string = "";

    constructor() {
        this.visualizer = new AudioVisualizer("audioVisualizerCanvas");
        this.uiCustomizer = new UICustomizer();

        try {
            this.dragonBackground = new DragonBackground("dragon3DCanvas", "dragonVideoPlayer");
        } catch (e) {
            console.warn("DragonBackground initialization notice:", e);
        }

        this.speechManager = new SpeechManager((isSpeaking) => {
            const orbContainer = document.getElementById("aiOrbContainer");
            if (isSpeaking) {
                this.visualizer.setState(AssistantState.SPEAKING);
                this.dragonBackground?.setState(AssistantState.SPEAKING);
                orbContainer?.classList.add("is-speaking");
                this.uiCustomizer.announce("Assistant is speaking.");
            } else {
                this.visualizer.setState(AssistantState.IDLE);
                this.dragonBackground?.setState(AssistantState.IDLE);
                orbContainer?.classList.remove("is-speaking");
            }
        });

        this.voiceEngine = new VoiceEngine({
            onStateChange: (state, msg) => {
                const micBtn = document.getElementById("MicBtn");
                const orbContainer = document.getElementById("aiOrbContainer");
                const micStatusBadge = document.getElementById("micLiveStatusBadge");

                if (state === AssistantState.LISTENING) {
                    micBtn?.classList.add("is-listening");
                    orbContainer?.classList.add("is-listening");
                    if (micStatusBadge) micStatusBadge.classList.remove("d-none");
                    this.setMessageText("Listening…");
                    this.dragonBackground?.setState(AssistantState.LISTENING);
                } else if (state === AssistantState.PROCESSING) {
                    micBtn?.classList.remove("is-listening");
                    orbContainer?.classList.remove("is-listening");
                    if (micStatusBadge) micStatusBadge.classList.add("d-none");
                    this.dragonBackground?.setState(AssistantState.PROCESSING);
                } else {
                    micBtn?.classList.remove("is-listening");
                    orbContainer?.classList.remove("is-listening");
                    if (micStatusBadge) micStatusBadge.classList.add("d-none");
                    if (state === AssistantState.IDLE) {
                        this.setMessageText("Hi, how can i Help you ...");
                        this.dragonBackground?.setState(AssistantState.IDLE);
                    }
                }

                this.visualizer.setState(state, msg);
                if (msg && state !== AssistantState.IDLE) this.setMessageText(msg);
                this.uiCustomizer.announce(msg || `Assistant state: ${state}`);
            },
            onInterimText: (text) => {
                this.setMessageText(text);
                this.visualizer.setState(AssistantState.LISTENING, "Listening…");
                this.updateLanguageBadge(text);
            },
            onFinalResult: (transcript) => {
                const micBtn = document.getElementById("MicBtn");
                const orbContainer = document.getElementById("aiOrbContainer");
                const micStatusBadge = document.getElementById("micLiveStatusBadge");
                micBtn?.classList.remove("is-listening");
                orbContainer?.classList.remove("is-listening");
                if (micStatusBadge) micStatusBadge.classList.add("d-none");

                this.visualizer.setState(AssistantState.PROCESSING, "Thinking…");
                this.setMessageText("Thinking…");
                this.uiCustomizer.announce(`Heard: ${transcript}. Processing request.`);
                this.dispatchCommand(transcript, "voice");
            },
            onError: (errorType, message) => {
                const micBtn = document.getElementById("MicBtn");
                const orbContainer = document.getElementById("aiOrbContainer");
                const micStatusBadge = document.getElementById("micLiveStatusBadge");
                micBtn?.classList.remove("is-listening");
                orbContainer?.classList.remove("is-listening");
                if (micStatusBadge) micStatusBadge.classList.add("d-none");

                this.visualizer.setState(AssistantState.ERROR, "Error");
                this.setMessageText(message || "Error occurred");
                this.uiCustomizer.announce(`Error: ${message}`);
            }
        });

        this.historyManager = new HistoryManager((cmd) => {
            this.dispatchCommand(cmd, "chat");
        });

        this.settingsManager = new VoiceSettingsManager();

        this.documentUploader = new DocumentUploader(
            (filename) => {
                this.visualizer.setState(AssistantState.PROCESSING, "Analyzing " + filename + "…");
                this.setMessageText("Analyzing: " + filename + "…");
                this.uiCustomizer.announce(`Analyzing document ${filename}`);
            },
            (result) => {
                this.restoreMainUI();
            }
        );

        this.widgetsManager = new WidgetsManager((cmd) => {
            this.dispatchCommand(cmd, "chat");
        });

        this.quickActionsManager = new QuickActionsManager((cmd) => {
            this.dispatchCommand(cmd, "chat");
        });

        this.conversationManager = new ConversationManager((cmd) => {
            this.dispatchCommand(cmd, "chat");
        });

        this.logsManager = new LogsManager();

        this.domainManager = new DomainManager(
            (cmd) => {
                this.dispatchCommand(cmd, "chat");
            },
            (prompt) => {
                const chatbox = document.getElementById("chatbox") as HTMLInputElement;
                if (chatbox) {
                    chatbox.value = prompt;
                    chatbox.focus();
                    chatbox.setSelectionRange(prompt.length, prompt.length);
                }
            }
        );

        this.shortcutManager = new ShortcutManager({
            onToggleMic: () => {
                const micBtn = document.getElementById("MicBtn");
                micBtn?.click();
            },
            onFocusAssistant: () => {
                this.switchToTextFallback();
            },
            onMuteSpeech: () => {
                this.cancelAllAndDismiss();
            },
            onOpenQuickActions: () => {
                this.quickActionsManager.open();
            },
            onToggleDashboard: () => {
                this.toggleDrawer("widgetsOffcanvas");
            },
            onToggleHistory: () => {
                this.toggleDrawer("historyOffcanvas");
            },
            onOpenSettings: () => {
                this.toggleDrawer("settingsOffcanvas");
            },
            onOpenUpload: () => {
                const uploadBtn = document.getElementById("UploadBtn");
                uploadBtn?.click();
            },
            onOpenLogs: () => {
                this.logsManager.open();
            },
            onAnnounce: (msg) => {
                this.uiCustomizer.announce(msg);
            }
        });

        this.bindUserControls();
        this.bindConfirmationModal();
        this.bindResponseCardControls();
        this.exportGlobalBridge();
    }

    private bindUserControls(): void {
        // AI Orb Click to Toggle Voice Listening
        const aiOrb = document.getElementById("aiOrbContainer");
        if (aiOrb) {
            aiOrb.addEventListener("click", () => {
                const micBtn = document.getElementById("MicBtn");
                micBtn?.click();
            });
            aiOrb.addEventListener("keydown", (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const micBtn = document.getElementById("MicBtn");
                    micBtn?.click();
                }
            });
        }

        // Microphone Button inside the Pill Dock
        const micBtn = document.getElementById("MicBtn");
        if (micBtn) {
            micBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (window.eel && window.eel.playClickSound) window.eel.playClickSound();

                if (this.voiceEngine.getListeningState()) {
                    this.voiceEngine.stopListening();
                    micBtn.classList.remove("is-listening");
                    const orb = document.getElementById("aiOrbContainer");
                    orb?.classList.remove("is-listening");
                    const statusBadge = document.getElementById("micLiveStatusBadge");
                    if (statusBadge) statusBadge.classList.add("d-none");
                    this.setMessageText("Hi, how can i Help you ...");
                } else {
                    micBtn.classList.add("is-listening");
                    const orb = document.getElementById("aiOrbContainer");
                    orb?.classList.add("is-listening");
                    const statusBadge = document.getElementById("micLiveStatusBadge");
                    if (statusBadge) statusBadge.classList.remove("d-none");
                    this.setMessageText("Listening…");
                    this.voiceEngine.startListening();
                }
            });
        }

        // Refresh Button in Top Header
        const refreshBtn = document.getElementById("RefreshBtn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                refreshBtn.classList.add("spin-animation");
                if (window.eel && window.eel.playClickSound) window.eel.playClickSound();
                if (window.eel && window.eel.resetAssistantState) {
                    window.eel.resetAssistantState()(() => {
                        this.restoreMainUI();
                        this.settingsManager.loadSettings();
                        this.historyManager.loadHistory();
                        const chatbox = document.getElementById("chatbox") as HTMLInputElement;
                        if (chatbox) chatbox.value = "";
                        this.updateLanguageBadge("");
                        this.hideActiveResponse();
                        setTimeout(() => refreshBtn.classList.remove("spin-animation"), 900);
                        this.uiCustomizer.announce("Assistant state reset and refreshed.");
                    });
                } else {
                    this.restoreMainUI();
                    refreshBtn.classList.remove("spin-animation");
                }
            });
        }

        // Stop Audio Button in Top Header
        const btnCancel = document.getElementById("btnCancelSpeech");
        if (btnCancel) {
            btnCancel.addEventListener("click", (e) => {
                e.stopPropagation();
                this.cancelAllAndDismiss();
            });
        }

        // Chat Input Field & Send Button
        const chatbox = document.getElementById("chatbox") as HTMLInputElement;
        const sendBtn = document.getElementById("SendBtn");

        if (chatbox) {
            chatbox.addEventListener("input", () => {
                this.updateLanguageBadge(chatbox.value);
            });

            chatbox.addEventListener("keyup", (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    const query = chatbox.value.trim();
                    if (!query) return;
                    chatbox.value = "";
                    this.updateLanguageBadge("");
                    this.dispatchCommand(query, "chat");
                }
            });
        }

        if (sendBtn && chatbox) {
            sendBtn.addEventListener("click", () => {
                const query = chatbox.value.trim();
                if (!query) return;
                chatbox.value = "";
                this.updateLanguageBadge("");
                this.dispatchCommand(query, "chat");
            });
        }
    }

    private bindResponseCardControls(): void {
        const btnClose = document.getElementById("btnCloseResponse");
        if (btnClose) {
            btnClose.addEventListener("click", () => {
                this.hideActiveResponse();
            });
        }

        const btnCopy = document.getElementById("btnCopyResponse");
        if (btnCopy) {
            btnCopy.addEventListener("click", () => {
                if (!this.lastAssistantResponse) return;
                navigator.clipboard.writeText(this.lastAssistantResponse).then(() => {
                    const icon = btnCopy.querySelector("i");
                    if (icon) {
                        icon.className = "bi bi-check-lg text-success";
                        setTimeout(() => { icon.className = "bi bi-clipboard"; }, 1500);
                    }
                }).catch(() => {});
            });
        }

        const btnReplay = document.getElementById("btnReplayResponse");
        if (btnReplay) {
            btnReplay.addEventListener("click", () => {
                if (!this.lastAssistantResponse) return;
                const lang = detectClientLanguage(this.lastAssistantResponse);
                if (window.eel && window.eel.testVoice) {
                    const voice = (lang.mode === "hindi_devanagari" || lang.mode === "hinglish")
                        ? "hi-IN-SwaraNeural"
                        : "en-IN-NeerjaNeural";
                    window.eel.testVoice(voice, lang.mode)();
                } else if (window.eel && window.eel.allCommands) {
                    window.eel.allCommands(this.lastAssistantResponse)();
                }
            });
        }
    }

    public displayActiveResponse(text: string, query?: string, langMode?: string): void {
        this.lastAssistantResponse = text;
        const card = document.getElementById("activeResponseCard");
        const queryEcho = document.getElementById("responseQueryEcho");
        const bodyContent = document.getElementById("responseBodyContent");
        const langBadge = document.getElementById("responseLangBadge");
        if (!card || !bodyContent) return;

        if (query && queryEcho) {
            queryEcho.innerHTML = `<span class="text-info me-1">Q:</span> ${this.escapeHTML(query)}`;
            queryEcho.style.display = "block";
        } else if (queryEcho && this.lastUserQuery) {
            queryEcho.innerHTML = `<span class="text-info me-1">Q:</span> ${this.escapeHTML(this.lastUserQuery)}`;
            queryEcho.style.display = "block";
        } else if (queryEcho) {
            queryEcho.style.display = "none";
        }

        if (langBadge) {
            if (langMode === "hindi_devanagari") langBadge.textContent = "HI-DEVA";
            else if (langMode === "hinglish") langBadge.textContent = "HINGLISH";
            else langBadge.textContent = "EN";
        }

        bodyContent.innerHTML = this.formatResponseHTML(text);
        card.style.display = "block";

        // Reset orb greeting text
        this.setMessageText("Hi, how can i Help you ...");
    }

    public hideActiveResponse(): void {
        const card = document.getElementById("activeResponseCard");
        if (card) card.style.display = "none";
    }

    private formatResponseHTML(text: string): string {
        if (!text) return "";
        let formatted = this.escapeHTML(text);
        // Bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-info">$1</strong>');
        // Bullets
        formatted = formatted.replace(/^[•\-\*]\s+(.*)$/gm, '<li class="ms-3">$1</li>');
        // Line breaks
        formatted = formatted.replace(/\n\n/g, '<p class="mb-2"></p>');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    private escapeHTML(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private bindConfirmationModal(): void {
        const btnConfirm = document.getElementById("btnConfirmActionProceed");
        const btnCancel = document.getElementById("btnConfirmActionCancel");

        if (btnConfirm) {
            btnConfirm.addEventListener("click", () => {
                if (this.pendingActionId && window.eel && window.eel.confirmAction) {
                    window.eel.confirmAction(this.pendingActionId, true)((res: any) => {
                        this.hideConfirmationModal();
                        if (res && res.spoken) {
                            this.displayActiveResponse(res.display || res.spoken);
                        }
                    });
                } else {
                    this.hideConfirmationModal();
                }
            });
        }

        if (btnCancel) {
            btnCancel.addEventListener("click", () => {
                if (this.pendingActionId && window.eel && window.eel.confirmAction) {
                    window.eel.confirmAction(this.pendingActionId, false)(() => {
                        this.hideConfirmationModal();
                    });
                } else {
                    this.hideConfirmationModal();
                }
            });
        }
    }

    public showConfirmationModal(prompt: string, actionId: string): void {
        this.pendingActionId = actionId;
        const promptEl = document.getElementById("actionConfirmationPrompt");
        if (promptEl) promptEl.textContent = prompt || "Do you wish to proceed with this consequential action?";

        const modalEl = document.getElementById("actionConfirmationModal");
        if (modalEl && window.bootstrap) {
            window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
            this.uiCustomizer.announce(`Confirmation required: ${prompt}`);
        }
    }

    public hideConfirmationModal(): void {
        this.pendingActionId = null;
        const modalEl = document.getElementById("actionConfirmationModal");
        if (modalEl && window.bootstrap) {
            window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        }
    }

    private toggleDrawer(drawerId: string): void {
        const el = document.getElementById(drawerId);
        if (el && window.bootstrap) {
            const inst = window.bootstrap.Offcanvas.getOrCreateInstance(el);
            inst.toggle();
        }
    }

    public showSiriScreen(initialText?: string): void {
        if (initialText) this.setMessageText(initialText);
        this.visualizer.setState(AssistantState.PROCESSING, initialText || "Thinking…");
    }

    public restoreMainUI(): void {
        this.voiceEngine.stopListening();
        this.visualizer.setState(AssistantState.IDLE);
        this.dragonBackground?.setState(AssistantState.IDLE);
        this.setMessageText("Hi, how can i Help you ...");
    }

    public cancelAllAndDismiss(): void {
        this.voiceEngine.stopListening();
        this.speechManager.cancelAndReset();
        if (window.eel && window.eel.stopSpeechOutput) {
            window.eel.stopSpeechOutput()();
        }
        this.restoreMainUI();
        this.uiCustomizer.announce("Cancelled speech and returned to ready state.");
    }

    public switchToTextFallback(): void {
        this.restoreMainUI();
        const chatbox = document.getElementById("chatbox") as HTMLInputElement;
        if (chatbox) {
            chatbox.focus();
        }
        this.uiCustomizer.announce("Switched to keyboard text input.");
    }

    public dispatchCommand(query: string, source: "voice" | "chat"): void {
        if (!query || !query.trim()) return;
        const cleanQuery = query.trim();
        this.lastUserQuery = cleanQuery;

        // Unleash Dracarys 3D dragonfire breath on command
        const lower = cleanQuery.toLowerCase();
        if (lower.includes("dracarys") || lower.includes("breathe fire") || lower.includes("dragon") || lower.includes("fire")) {
            this.dragonBackground?.triggerFireBreath(2.4);
        }

        this.conversationManager.addUserMessage(cleanQuery, source);
        this.visualizer.setState(AssistantState.PROCESSING, "Thinking…");
        this.dragonBackground?.setState(AssistantState.PROCESSING);
        this.setMessageText("Thinking…");
        this.uiCustomizer.announce(`Processing: ${cleanQuery}`);

        if (window.eel && window.eel.playClickSound) {
            window.eel.playClickSound();
        }

        if (window.eel && window.eel.allCommands) {
            window.eel.allCommands(cleanQuery)();
        }
    }

    public updateLanguageBadge(text: string): void {
        const pill = document.getElementById("detectedLangPill");
        const label = document.getElementById("detectedLangText");
        if (!label) return;

        if (!text || !text.trim()) {
            label.textContent = "Auto: English / हिंदी / Hinglish";
            pill?.classList.remove("lang-hi-deva", "lang-hinglish");
            return;
        }

        const lang = detectClientLanguage(text);
        if (lang.mode === "hindi_devanagari") {
            label.textContent = "🇮🇳 हिंदी (Devanagari) Detected";
            pill?.classList.add("lang-hi-deva");
            pill?.classList.remove("lang-hinglish");
        } else if (lang.mode === "hinglish") {
            label.textContent = "🇮🇳 Hinglish (Hindi) Detected";
            pill?.classList.add("lang-hinglish");
            pill?.classList.remove("lang-hi-deva");
        } else {
            label.textContent = "🇬🇧 English Detected";
            pill?.classList.remove("lang-hi-deva", "lang-hinglish");
        }
    }

    public setMessageText(text: string): void {
        const msgEl = document.getElementById("siriMessageText");
        if (msgEl) {
            msgEl.textContent = text;
        }
    }

    private exportGlobalBridge(): void {
        window.assistantApp = this;
        window.dispatchCommand = (q, s) => this.dispatchCommand(q, s);
        window.restoreMainUI = () => this.restoreMainUI();
        window.applyAssistantTheme = (t) => {
            this.uiCustomizer.applyPreferences();
            if (t) this.dragonBackground?.setTheme(t);
        };
        window.openQuickActions = () => this.quickActionsManager.open();
        window.openDashboard = () => this.toggleDrawer("widgetsOffcanvas");
        window.openSettingsPanel = () => this.toggleDrawer("settingsOffcanvas");
        window.openLogsPanel = () => this.logsManager.open();
        window.appendUserCommand = (q, s, lm) => this.conversationManager.addUserMessage(q, (s || "chat") as any, undefined, true, lm as any);
        window.appendAssistantResponse = (text, cardType, cardData, status, lm) => {
            this.conversationManager.addAssistantMessage(text, cardType, cardData, (status || "SUCCESS") as any, true, lm as any);
            this.displayActiveResponse(text, this.lastUserQuery, lm);
        };
        window.showErrorNotification = (title, msg, type) => this.logsManager.showErrorToast(title, msg, type);

        // Dragon 3D & Video Controls
        (window as any).triggerDracarysFire = (intensity?: number) => this.dragonBackground?.triggerFireBreath(intensity || 1.6);
        (window as any).toggleDragonMode = () => this.dragonBackground?.toggleDisplayMode();
        (window as any).setDragonTheme = (theme: string) => this.dragonBackground?.setTheme(theme);
        (window as any).toggleDragonVisibility = () => this.dragonBackground?.toggleVisibility();
    }
}

// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    new AssistantApp();
});
