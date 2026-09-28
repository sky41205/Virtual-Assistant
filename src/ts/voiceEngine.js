/* ================================================================
   DRACARYS AI — voiceEngine.ts
   Speech Recognition Handler: Web Speech API with Python Fallback,
   Live Transcription, Permission Handling, and Text Fallback
   ================================================================ */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { AssistantState } from "./types";
export class VoiceEngine {
    constructor(callbacks) {
        this.recognition = null;
        this.isListening = false;
        this.SpeechAPI = null;
        this.callbacks = callbacks;
        this.SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }
    isSupported() {
        return !!this.SpeechAPI;
    }
    startListening(preferredLang) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this.isListening) {
                this.stopListening();
            }
            const lang = preferredLang || ((_a = document.getElementById("settingSpeechLang")) === null || _a === void 0 ? void 0 : _a.value) || "en-IN";
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
                    const stream = yield navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop()); // release for SpeechRecognition
                }
            }
            catch (permErr) {
                console.warn("Microphone permission check failed:", permErr);
                const msg = permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError"
                    ? "Microphone permission denied. Please allow mic access or use text input."
                    : "Microphone unavailable. Check your system audio settings.";
                this.callbacks.onError("permission-denied", msg);
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
                this.recognition.onresult = (event) => {
                    let interim = "";
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript + " ";
                        }
                        else {
                            interim += event.results[i][0].transcript;
                        }
                    }
                    const live = (finalTranscript + interim).trim();
                    if (live) {
                        capturedAny = true;
                        this.callbacks.onInterimText(live);
                    }
                };
                this.recognition.onerror = (event) => {
                    this.isListening = false;
                    console.warn("VoiceEngine error:", event.error);
                    let errorTitle = "Speech recognition error";
                    switch (event.error) {
                        case "not-allowed":
                        case "permission-denied":
                            errorTitle = "Microphone access blocked. Click 'Type Instead' to enter text.";
                            break;
                        case "no-speech":
                            errorTitle = "No speech detected. Click retry to speak again.";
                            break;
                        case "audio-capture":
                            errorTitle = "No microphone hardware found.";
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
                    }
                    else if (!capturedAny) {
                        this.callbacks.onError("no-speech", "No speech detected. Please try again.");
                    }
                };
                this.recognition.start();
            }
            catch (err) {
                console.warn("Recognition start exception, falling back to Python:", err);
                this.callbacks.onStateChange(AssistantState.LISTENING, "Listening via system microphone…");
                if (window.eel && window.eel.allCommands) {
                    window.eel.playClickSound();
                    window.eel.allCommands()();
                }
            }
        });
    }
    stopListening() {
        this.isListening = false;
        if (this.recognition) {
            try {
                this.recognition.abort();
            }
            catch (e) { }
            this.recognition = null;
        }
    }
    getListeningState() {
        return this.isListening;
    }
}
