/* ================================================================
   DRACARYS AI — voiceEngine.ts
   Universal Speech Recognition & Multimodal Voice Recording Engine:
   - Tier 1: Real-time Web Speech API (Chrome/Edge/Safari)
   - Tier 2: Multimodal MediaRecorder Audio Upload to /api/chat (Firefox/Brave/Mobile)
   - Tier 3: Native PyAudio Eel Bridge (Desktop Python Mode)
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
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private activeStream: MediaStream | null = null;
    private isListening: boolean = false;
    private isPythonListening: boolean = false;
    private callbacks: VoiceEngineCallbacks;
    private SpeechAPI: any = null;
    private silenceTimer: any = null;

    constructor(callbacks: VoiceEngineCallbacks) {
        this.callbacks = callbacks;
        this.SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
    }

    public isSupported(): boolean {
        return !!this.SpeechAPI || !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || (!!(window as any).eel && !!(window as any).eel.allCommands);
    }

    public async startListening(preferredLang?: string): Promise<void> {
        if (this.isListening || this.isPythonListening) {
            this.stopListening();
            return;
        }

        const langSelect = document.getElementById("settingSpeechLang") as HTMLSelectElement;
        const lang = preferredLang || (langSelect ? langSelect.value : "en-IN") || "en-IN";

        // Desktop Python Eel Mode: use native PyAudio directly
        if ((window as any).eel && (window as any).eel.allCommands) {
            this.triggerPythonSpeech();
            return;
        }

        // Web / Vercel Live Mode:
        this.isListening = true;
        this.audioChunks = [];
        this.callbacks.onStateChange(AssistantState.LISTENING, "Listening… Speak clearly now");

        // Request microphone stream for MediaRecorder & Visualizer
        let stream: MediaStream | null = null;
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                this.activeStream = stream;
            }
        } catch (permErr: any) {
            this.isListening = false;
            console.warn("Microphone getUserMedia permission notice:", permErr);
            this.callbacks.onError(
                "permission-denied",
                "Microphone access blocked. Click the lock icon in your browser address bar to allow microphone."
            );
            return;
        }

        // Initialize MediaRecorder as reliable multimodal audio fallback
        if (stream && typeof MediaRecorder !== "undefined") {
            try {
                const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                    ? "audio/webm;codecs=opus"
                    : MediaRecorder.isTypeSupported("audio/webm")
                        ? "audio/webm"
                        : MediaRecorder.isTypeSupported("audio/mp4")
                            ? "audio/mp4"
                            : "";
                
                this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        this.audioChunks.push(e.data);
                    }
                };
                this.mediaRecorder.start(250);
            } catch (mrErr) {
                console.warn("MediaRecorder init note:", mrErr);
            }
        }

        // If Web Speech API is available, try real-time streaming recognition
        if (this.SpeechAPI) {
            try {
                this.recognition = new this.SpeechAPI();
                this.recognition.lang = lang;
                this.recognition.interimResults = true;
                this.recognition.continuous = false;
                this.recognition.maxAlternatives = 1;

                let finalTranscript = "";
                let capturedAny = false;

                this.recognition.onstart = () => {
                    this.callbacks.onStateChange(AssistantState.LISTENING, "Listening… Speak now (English / हिंदी)");
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
                    console.warn("Web Speech API notice:", event.error);
                    if (event.error === "aborted") return;

                    // If Web Speech fails (e.g. network/no-speech on Vercel), fall back to recorded audio
                    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
                        this.finishRecordingAndSendAudio(lang);
                    } else {
                        this.callbacks.onError(event.error, "Voice recognition error. You can also type below.");
                    }
                };

                this.recognition.onend = () => {
                    this.isListening = false;
                    const result = finalTranscript.trim();
                    if (result) {
                        this.cleanupStream();
                        this.callbacks.onFinalResult(result);
                    } else if (!capturedAny) {
                        // If no text captured by Web Speech, try processing recorded audio with serverless Gemini
                        this.finishRecordingAndSendAudio(lang);
                    }
                };

                this.recognition.start();
                return;
            } catch (recErr) {
                console.warn("Web Speech start exception, using direct MediaRecorder audio capture:", recErr);
            }
        }

        // Fallback: Set a 5-second automatic recording window for MediaRecorder
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
            if (this.isListening) {
                this.finishRecordingAndSendAudio(lang);
            }
        }, 5000);
    }

    private async finishRecordingAndSendAudio(lang: string): Promise<void> {
        this.isListening = false;
        if (this.silenceTimer) clearTimeout(this.silenceTimer);

        if (!this.mediaRecorder || this.audioChunks.length === 0) {
            this.cleanupStream();
            this.callbacks.onError("no-speech", "No speech detected. Please speak clearly or type below.");
            return;
        }

        this.callbacks.onStateChange(AssistantState.PROCESSING, "Thinking… Processing your voice");

        try {
            if (this.mediaRecorder.state === "recording") {
                this.mediaRecorder.stop();
            }

            // Small delay to let final dataavailable chunk arrive
            await new Promise((resolve) => setTimeout(resolve, 300));

            const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || "audio/webm" });
            this.cleanupStream();

            if (audioBlob.size < 1000) {
                this.callbacks.onError("no-speech", "Audio was too short. Please try speaking again.");
                return;
            }

            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Data = (reader.result as string).split(",")[1];
                if (!base64Data) {
                    this.callbacks.onError("audio-error", "Could not process audio. Type your request below.");
                    return;
                }

                try {
                    const res = await fetch("/api/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            audio: base64Data,
                            mimeType: audioBlob.type || "audio/webm",
                            lang: lang
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data.response) {
                            if (window.assistantApp && window.assistantApp.displayActiveResponse) {
                                window.assistantApp.displayActiveResponse(data.response, "🎤 Voice Command", lang, true);
                            }
                            if (window.assistantApp && window.assistantApp.conversationManager) {
                                window.assistantApp.conversationManager.addUserMessage("🎤 Spoken Voice Input", "voice");
                                window.assistantApp.conversationManager.addAssistantMessage(data.response, "ai_chat", {}, "SUCCESS", true, lang);
                            }
                            return;
                        }
                    }
                    this.callbacks.onError("network", "Could not reach assistant server. Please type your message.");
                } catch (apiErr) {
                    console.warn("Direct voice API error:", apiErr);
                    this.callbacks.onError("network", "Connection error. Please try again or type below.");
                }
            };
        } catch (err) {
            this.cleanupStream();
            console.warn("Audio processing error:", err);
            this.callbacks.onError("error", "Error processing voice. Please type below.");
        }
    }

    private cleanupStream(): void {
        if (this.activeStream) {
            try {
                this.activeStream.getTracks().forEach((track) => track.stop());
            } catch (e) {}
            this.activeStream = null;
        }
        if (this.mediaRecorder) {
            this.mediaRecorder = null;
        }
        this.audioChunks = [];
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
        if (this.silenceTimer) clearTimeout(this.silenceTimer);

        if (this.recognition) {
            try {
                this.recognition.abort();
            } catch (e) {}
            this.recognition = null;
        }
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            try {
                this.mediaRecorder.stop();
            } catch (e) {}
        }
        this.cleanupStream();
    }

    public getListeningState(): boolean {
        return this.isListening || this.isPythonListening;
    }
}
