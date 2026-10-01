/* ================================================================
   DRACARYS AI — voiceEngine.ts
   Speech Recognition Handler: Web Speech API with Seamless Python Fallback,
   Live Audio Transcription, Multi-Tier Error Recovery, and Status Sync
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
    private isPythonListening: boolean = false;

    constructor(callbacks: VoiceEngineCallbacks) {
        this.callbacks = callbacks;
        this.SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
    }

    public isSupported(): boolean {
        return !!this.SpeechAPI || (!!(window as any).eel && !!(window as any).eel.allCommands);
    }

    public async startListening(preferredLang?: string): Promise<void> {
        if (this.isListening || this.isPythonListening) {
            this.stopListening();
            return;
        }

        const lang = preferredLang || (document.getElementById("settingSpeechLang") as HTMLSelectElement)?.value || "en-IN";

        // If Web Speech API is not supported, directly trigger Python desktop speech recognition
        if (!this.SpeechAPI) {
            console.info("Web Speech API not supported in this browser. Activating Python SpeechRecognition.");
            this.triggerPythonSpeech();
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
                console.warn("VoiceEngine Web Speech error:", event.error);

                // Ignore explicit user cancellations
                if (event.error === "aborted") {
                    return;
                }

                // If running in Eel Desktop mode, automatically fall back to Python microphone capture
                if ((window as any).eel && (window as any).eel.allCommands) {
                    console.info("Web Speech error (" + event.error + "); falling back to Python PyAudio engine.");
                    this.triggerPythonSpeech();
                    return;
                }

                let errorTitle = "Speech recognition error";
                switch (event.error) {
                    case "not-allowed":
                    case "permission-denied":
                        errorTitle = "Microphone access blocked. Please allow mic permissions or type below.";
                        break;
                    case "no-speech":
                        errorTitle = "No speech detected. Speak again or type below.";
                        break;
                    case "audio-capture":
                        errorTitle = "Microphone not ready. Check your audio device or type below.";
                        break;
                    case "network":
                        errorTitle = "Speech network connection error. Type your message below.";
                        break;
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
                    // Fall back to Python if no speech caught in Web Speech API
                    if ((window as any).eel && (window as any).eel.allCommands) {
                        console.info("No audio captured in Web Speech; attempting Python recognition fallback.");
                        this.triggerPythonSpeech();
                    } else {
                        this.callbacks.onError("no-speech", "No speech detected. Please try again.");
                    }
                }
            };

            this.recognition.start();

        } catch (err: any) {
            console.warn("VoiceEngine start exception, switching to Python fallback:", err);
            if ((window as any).eel && (window as any).eel.allCommands) {
                this.triggerPythonSpeech();
            } else {
                this.callbacks.onError("start-failed", "Could not start microphone. You can type in the box below.");
            }
        }
    }

    public triggerPythonSpeech(): void {
        this.isPythonListening = true;
        this.callbacks.onStateChange(AssistantState.LISTENING, "Listening via microphone…");

        if ((window as any).eel && (window as any).eel.allCommands) {
            try {
                if ((window as any).eel.playClickSound) (window as any).eel.playClickSound();
            } catch (e) {}

            (window as any).eel.allCommands(1)(() => {
                this.isPythonListening = false;
            });
        }
    }

    public stopListening(): void {
        this.isListening = false;
        this.isPythonListening = false;
        if (this.recognition) {
            try {
                this.recognition.abort();
            } catch (e) {}
            this.recognition = null;
        }
    }

    public getListeningState(): boolean {
        return this.isListening || this.isPythonListening;
    }
}
