/* ================================================================
   DRACARYS AI — speechManager.ts
   Client-Side Speech Cancellation & Natural Speech Synthesis Engine
   ================================================================ */

export class SpeechManager {
    private isSpeaking: boolean = false;
    private onSpeakingStateChange?: (speaking: boolean) => void;
    private voices: SpeechSynthesisVoice[] = [];
    private keepAliveTimer: any = null;

    constructor(onStateChange?: (speaking: boolean) => void) {
        this.onSpeakingStateChange = onStateChange;
        this.initVoices();
    }

    private initVoices(): void {
        if (!("speechSynthesis" in window)) return;

        const loadVoices = () => {
            try {
                this.voices = window.speechSynthesis.getVoices() || [];
            } catch (e) {
                this.voices = [];
            }
        };

        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    public setSpeaking(speaking: boolean): void {
        this.isSpeaking = speaking;
        if (!speaking && this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
        if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange(speaking);
        }
    }

    public getSpeakingState(): boolean {
        return this.isSpeaking;
    }

    /**
     * Clean markdown, emojis, URLs, and code blocks for crisp speech delivery
     */
    private cleanTextForSpeech(text: string): string {
        if (!text) return "";
        return text
            // Remove markdown links [text](url) -> text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            // Remove code blocks
            .replace(/```[\s\S]*?```/g, "Code block omitted.")
            .replace(/`([^`]+)`/g, "$1")
            // Remove markdown bold/italic/headers
            .replace(/[*#_~`>]/g, "")
            // Remove emoji symbols for cleaner pronunciation
            .replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{27BF}]/gu, "")
            // Normalize spaces
            .replace(/\s+/g, " ")
            .trim();
    }

    public speak(text: string, lang: string = "en-US"): void {
        if (!text || !text.trim()) return;
        if (!("speechSynthesis" in window)) return;

        const spokenClean = this.cleanTextForSpeech(text);
        if (!spokenClean) return;

        try {
            // Cancel any ongoing utterance and unpause engine
            window.speechSynthesis.cancel();
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }

            const utterance = new SpeechSynthesisUtterance(spokenClean);
            const isHindi = (lang === "hi" || lang === "hi-IN" || lang === "hindi_devanagari" || lang === "hinglish");
            utterance.lang = isHindi ? "hi-IN" : "en-US";
            utterance.rate = isHindi ? 0.95 : 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Pick the best available voice with tiered priority
            if (this.voices.length === 0) {
                this.voices = window.speechSynthesis.getVoices() || [];
            }

            if (this.voices.length > 0) {
                if (isHindi) {
                    // Priority 1: High-fidelity Natural / Neural Hindi (Swara / Madhur)
                    let hiVoice = this.voices.find(v => (v.lang.includes("hi") || v.name.toLowerCase().includes("hindi")) && (v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online") || v.name.toLowerCase().includes("swara") || v.name.toLowerCase().includes("madhur")));
                    // Priority 2: Google हिन्दी
                    if (!hiVoice) hiVoice = this.voices.find(v => v.lang.toLowerCase().startsWith("hi") || v.name.includes("हिन्दी") || v.name.toLowerCase().includes("hindi"));
                    // Priority 3: Indian English voice as natural Hinglish fallback
                    if (!hiVoice) hiVoice = this.voices.find(v => v.lang === "en-IN" || v.name.toLowerCase().includes("india"));
                    if (hiVoice) utterance.voice = hiVoice;
                } else {
                    // Priority 1: Indian English Neural (Neerja / Prabhat)
                    let enVoice = this.voices.find(v => (v.lang === "en-IN" || v.name.toLowerCase().includes("india")) && (v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online") || v.name.toLowerCase().includes("neerja")));
                    // Priority 2: Google / US Natural
                    if (!enVoice) enVoice = this.voices.find(v => (v.lang === "en-US" || v.lang === "en-GB" || v.lang === "en-IN") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Jenny")));
                    // Priority 3: Any English
                    if (!enVoice) enVoice = this.voices.find(v => v.lang.startsWith("en"));
                    if (enVoice) utterance.voice = enVoice;
                }
            }

            utterance.onstart = () => {
                this.setSpeaking(true);
                // Chrome bug workaround for speech timeout on longer answers
                if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
                this.keepAliveTimer = setInterval(() => {
                    if (window.speechSynthesis.speaking) {
                        window.speechSynthesis.pause();
                        window.speechSynthesis.resume();
                    } else {
                        clearInterval(this.keepAliveTimer);
                        this.keepAliveTimer = null;
                    }
                }, 10000);
            };

            utterance.onend = () => {
                this.setSpeaking(false);
            };

            utterance.onerror = (e) => {
                console.warn("SpeechSynthesis utterance notice:", e);
                this.setSpeaking(false);
            };

            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.warn("SpeechSynthesis speak exception:", err);
            this.setSpeaking(false);
        }
    }

    public stopSpeech(): void {
        this.setSpeaking(false);
        if ("speechSynthesis" in window) {
            try {
                window.speechSynthesis.cancel();
            } catch (e) {}
        }
        if (window.eel && window.eel.stopSpeechOutput) {
            try {
                window.eel.stopSpeechOutput();
            } catch (e) {
                console.warn("stopSpeechOutput notice:", e);
            }
        }
    }

    public cancelAndReset(): void {
        this.stopSpeech();
        if (window.eel && window.eel.resetAssistantState) {
            try {
                window.eel.resetAssistantState();
            } catch (e) {
                console.warn("resetAssistantState notice:", e);
            }
        }
    }
}
