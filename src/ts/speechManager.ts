/* ================================================================
   DRACARYS AI — speechManager.ts
   Robust Multilingual Speech Synthesis Engine
   Supports Web Speech API (Edge/Chrome/Safari), Voice Selection,
   Chromium Long-Speech Keepalive, and Audio Streaming Fallback
   ================================================================ */

export class SpeechManager {
    private isSpeaking: boolean = false;
    private onSpeakingStateChange?: (speaking: boolean) => void;
    private availableVoices: SpeechSynthesisVoice[] = [];
    private keepAliveTimer: any = null;
    private fallbackAudio: HTMLAudioElement | null = null;
    private voicesLoaded: boolean = false;

    constructor(onStateChange?: (speaking: boolean) => void) {
        this.onSpeakingStateChange = onStateChange;
        this.initVoices();
    }

    private initVoices(): void {
        if (!("speechSynthesis" in window)) return;

        const load = () => {
            try {
                this.availableVoices = window.speechSynthesis.getVoices() || [];
                if (this.availableVoices.length > 0) {
                    this.voicesLoaded = true;
                }
            } catch (e) {
                console.warn("SpeechManager getVoices notice:", e);
            }
        };

        load();
        if ("onvoiceschanged" in window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = () => load();
        }

        // Periodic check for delayed browser voice hydration
        setTimeout(load, 500);
        setTimeout(load, 1500);
    }

    public setSpeaking(speaking: boolean): void {
        this.isSpeaking = speaking;
        if (!speaking) {
            this.clearKeepAlive();
        }
        if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange(speaking);
        }
    }

    public getSpeakingState(): boolean {
        return this.isSpeaking;
    }

    /**
     * Clean text of markdown, URLs, emojis, and special symbols for natural TTS speech
     */
    public sanitizeTextForSpeech(raw: string): string {
        if (!raw) return "";
        let text = raw;

        // Remove markdown headers, bold, italics, code blocks
        text = text.replace(/```[\s\S]*?```/g, " code block omitted. ");
        text = text.replace(/`([^`]+)`/g, "$1");
        text = text.replace(/[*#_~>]/g, "");
        text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
        text = text.replace(/https?:\/\/\S+/g, " link ");

        // Remove bullet prefixes and decorative symbols
        text = text.replace(/^[•\-\*]\s+/gm, "");
        text = text.replace(/[🔥⚡🧠✨💡🐉🎙️💻📱📄🧩🌐🤝🎉]/g, "");

        // Collapse multiple spaces & linebreaks into natural pauses
        text = text.replace(/\n+/g, ". ");
        text = text.replace(/\s{2,}/g, " ");

        return text.trim();
    }

    /**
     * Select best matching voice for the target language mode
     */
    private findBestVoice(isHindi: boolean): SpeechSynthesisVoice | null {
        if (!this.availableVoices || this.availableVoices.length === 0) {
            this.availableVoices = window.speechSynthesis.getVoices() || [];
        }

        const voices = this.availableVoices;
        if (!voices || voices.length === 0) return null;

        if (isHindi) {
            // 1. Exact Hindi Voice (Google / Microsoft Neural / Swara / Madhur / hi-IN)
            const hiVoice = voices.find(v =>
                v.lang.toLowerCase().startsWith("hi") ||
                v.name.toLowerCase().includes("hindi") ||
                v.name.toLowerCase().includes("swara") ||
                v.name.toLowerCase().includes("madhur") ||
                v.name.includes("हिन्दी")
            );
            if (hiVoice) return hiVoice;

            // 2. Indian English voice as secondary for Hinglish
            const inVoice = voices.find(v => v.lang.toLowerCase().includes("en-in") || v.name.toLowerCase().includes("india"));
            if (inVoice) return inVoice;
        } else {
            // 1. Natural / Edge / Indian English / US English
            const enInVoice = voices.find(v => v.lang.toLowerCase().includes("en-in") || v.name.toLowerCase().includes("neerja"));
            if (enInVoice) return enInVoice;

            const enVoice = voices.find(v =>
                v.name.toLowerCase().includes("natural") ||
                v.name.toLowerCase().includes("google") ||
                v.name.toLowerCase().includes("jenny") ||
                v.name.toLowerCase().includes("guy") ||
                v.name.toLowerCase().includes("samantha") ||
                v.lang.toLowerCase().startsWith("en")
            );
            if (enVoice) return enVoice;
        }

        // Fallback to default system voice
        return voices.find(v => v.default) || voices[0] || null;
    }

    /**
     * Speak text using Web Speech API with keepalive and audio fallback
     */
    public speak(text: string, lang: string = "en-US"): void {
        const cleanText = this.sanitizeTextForSpeech(text);
        if (!cleanText) return;

        this.stopSpeech();

        const isHindi = (
            lang === "hi" ||
            lang === "hi-IN" ||
            lang === "hindi_devanagari" ||
            lang === "hinglish" ||
            /[\u0900-\u097F]/.test(cleanText)
        );

        const targetLangCode = isHindi ? "hi-IN" : "en-US";

        if (!("speechSynthesis" in window)) {
            this.speakWithAudioFallback(cleanText, isHindi ? "hi" : "en");
            return;
        }

        try {
            // Unpause browser speech engine if blocked
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }

            // Create SpeechSynthesisUtterance
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = targetLangCode;
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            const bestVoice = this.findBestVoice(isHindi);
            if (bestVoice) {
                utterance.voice = bestVoice;
            }

            let started = false;

            utterance.onstart = () => {
                started = true;
                this.setSpeaking(true);
                this.startKeepAlive();
            };

            utterance.onend = () => {
                this.setSpeaking(false);
            };

            utterance.onerror = (err) => {
                console.warn("SpeechSynthesis error:", err);
                this.setSpeaking(false);
                if (!started) {
                    this.speakWithAudioFallback(cleanText, isHindi ? "hi" : "en");
                }
            };

            // Micro-delay workaround for Chromium speech cancel race condition
            setTimeout(() => {
                try {
                    window.speechSynthesis.speak(utterance);

                    // Timeout check if speech didn't start (browser autoplay restrictions)
                    setTimeout(() => {
                        if (!started && this.isSpeaking) {
                            console.warn("SpeechSynthesis did not start, falling back to audio stream.");
                            this.speakWithAudioFallback(cleanText, isHindi ? "hi" : "en");
                        }
                    }, 1200);
                } catch (speakErr) {
                    console.warn("speechSynthesis.speak error:", speakErr);
                    this.speakWithAudioFallback(cleanText, isHindi ? "hi" : "en");
                }
            }, 60);

        } catch (e) {
            console.warn("SpeechManager speak notice:", e);
            this.speakWithAudioFallback(cleanText, isHindi ? "hi" : "en");
        }
    }

    /**
     * Fallback Web Audio TTS for environments where SpeechSynthesis is restricted
     */
    private speakWithAudioFallback(text: string, langCode: string): void {
        try {
            if (this.fallbackAudio) {
                this.fallbackAudio.pause();
                this.fallbackAudio = null;
            }

            const shortText = text.slice(0, 160);
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(shortText)}`;

            const audio = new Audio(ttsUrl);
            this.fallbackAudio = audio;

            audio.onplay = () => this.setSpeaking(true);
            audio.onended = () => this.setSpeaking(false);
            audio.onerror = () => this.setSpeaking(false);

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((e) => {
                    console.warn("Audio TTS autoplay notice:", e);
                    this.setSpeaking(false);
                });
            }
        } catch (err) {
            console.warn("speakWithAudioFallback notice:", err);
            this.setSpeaking(false);
        }
    }

    /**
     * Chromium keepalive workaround for long utterances (>10 seconds)
     */
    private startKeepAlive(): void {
        this.clearKeepAlive();
        this.keepAliveTimer = setInterval(() => {
            if (!this.isSpeaking) {
                this.clearKeepAlive();
                return;
            }
            if ("speechSynthesis" in window) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
            }
        }, 8000);
    }

    private clearKeepAlive(): void {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    public stopSpeech(): void {
        this.setSpeaking(false);

        if ("speechSynthesis" in window) {
            try {
                window.speechSynthesis.cancel();
            } catch (e) {}
        }

        if (this.fallbackAudio) {
            try {
                this.fallbackAudio.pause();
                this.fallbackAudio = null;
            } catch (e) {}
        }

        if (window.eel && window.eel.stopSpeechOutput) {
            try {
                window.eel.stopSpeechOutput();
            } catch (e) {}
        }
    }

    public cancelAndReset(): void {
        this.stopSpeech();
        if (window.eel && window.eel.resetAssistantState) {
            try {
                window.eel.resetAssistantState();
            } catch (e) {}
        }
    }
}
