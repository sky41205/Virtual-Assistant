/* ================================================================
   DRACARYS AI — voiceEngine.ts
   Speech Recognition Handler: Web Speech API with Python Fallback,
   Live Transcription, Permission Handling, and Text Fallback
   ================================================================ */

import { AssistantState } from "./types";

export interface VoiceEngineCallbacks {
    onStateChange: (state: AssistantState, msg?: string) => void;
    onInterimText: (text: string) => void;
    onFinalResult: (transcript: string) => void;
    onError: (errorType: string, message: string) => void;
}

export class VoiceEngine {
    private recognition: any = null;
    private isListening: boolean = false;
    private callbacks: VoiceEngineCallbacks;
    private SpeechAPI: any = null;

    constructor(callbacks: VoiceEngineCallbacks) {
        this.callbacks = callbacks;
        this.SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
    }

    public isSupported(): boolean {
        return !!this.SpeechAPI;
    }

    public async startListening(preferredLang?: string): Promise<void> {
        if (this.isListening) {
            this.stopListening();
        }

        const lang = preferredLang || (document.getElementById("settingSpeechLang") as HTMLSelectElement)?.value || "en-IN";

        // If Web Speech is unsupported, trigger Python backend takeCommand
        if (!this.SpeechAPI) {
            console.warn("Web Speech API not supported in this browser. Falling back to Python SpeechRecognition.");
            this.callbacks.onStateChange(AssistantState.LISTENING, "Listening via system microphone…");
            if (window.eel && window.eel.allCommands) {
                window.eel.playClickSound();
                window.eel.allCommands()();
            }
            return;
        }

        // Check / request microphone permission
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop()); // release for SpeechRecognition
            }
        } catch (permErr: any) {
            console.warn("Browser getUserMedia failed, falling back to Python speech recognition:", permErr);
            if (window.eel && window.eel.allCommands) {
                this.callbacks.onStateChange(AssistantState.LISTENING, "Listening via microphone…");
                window.eel.allCommands()();
                return;
            }
            this.callbacks.onError("permission-denied", "Microphone access blocked. You can type in the box below.");
            return;
        }

        try {
            this.recognition = new this.SpeechAPI();
            this.recognition.lang = lang;
            this.recognition.interimResults = true;
            this.recognition.continuous = false;
            this.recognition.maxAlternatives = 1;

            let finalTranscript = "";
            let capturedAny = false;

            this.recognition.onstart = () => {
                this.isListening = true;
                this.callbacks.onStateChange(AssistantState.LISTENING, "Listening… Speak clearly now");
            };

            this.recognition.onresult = (event: any) => {
                let interim = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + " ";
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }
                const live = (finalTranscript + interim).trim();
                if (live) {
                    capturedAny = true;
                    this.callbacks.onInterimText(live);
                }
            };

            this.recognition.onerror = (event: any) => {
                this.isListening = false;
                console.warn("VoiceEngine error:", event.error);

                let errorTitle = "Speech recognition error";
                switch (event.error) {
                    case "not-allowed":
                    case "permission-denied":
                        if (window.eel && window.eel.allCommands) {
                            console.warn("Web Speech denied, fallback to Python backend takeCommand.");
                            this.callbacks.onStateChange(AssistantState.LISTENING, "Listening via microphone…");
                            window.eel.allCommands()();
                            return;
                        }
                        errorTitle = "Microphone access blocked. Click 'Type Instead' to enter text.";
                        break;
                    case "no-speech":
                        errorTitle = "No speech detected. Speak again or type below.";
                        break;
                    case "audio-capture":
                        if (window.eel && window.eel.allCommands) {
                            this.callbacks.onStateChange(AssistantState.LISTENING, "Listening via microphone…");
                            window.eel.allCommands()();
                            return;
                        }
                        errorTitle = "Microphone not ready. Type below to ask.";
                        break;
                    case "network":
                        errorTitle = "Network connection error during voice recognition.";
                        break;
                    case "aborted":
                        return; // User explicitly cancelled
                    default:
                        errorTitle = `Speech error: ${event.error}`;
                        break;
                }
                this.callbacks.onError(event.error, errorTitle);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                const result = finalTranscript.trim();
                if (result) {
                    this.callbacks.onFinalResult(result);
                } else if (!capturedAny) {
                    this.callbacks.onError("no-speech", "No speech detected. Please try again.");
                }
            };

            this.recognition.start();

        } catch (err: any) {
            console.warn("Recognition start exception, falling back to Python:", err);
            this.callbacks.onStateChange(AssistantState.LISTENING, "Listening via system microphone…");
            if (window.eel && window.eel.allCommands) {
                window.eel.playClickSound();
                window.eel.allCommands()();
            }
        }
    }

    public stopListening(): void {
        this.isListening = false;
        if (this.recognition) {
            try {
                this.recognition.abort();
            } catch (e) {}
            this.recognition = null;
        }
    }

    public getListeningState(): boolean {
        return this.isListening;
    }
}
