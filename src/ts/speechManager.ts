/* ================================================================
   DRACARYS AI — speechManager.ts
   Client-Side Neural Voice Synthesis & Speech Controller
   ================================================================ */

export class SpeechManager {
    private isSpeaking: boolean = false;
    private onSpeakingStateChange?: (speaking: boolean) => void;
    private availableVoices: SpeechSynthesisVoice[] = [];
    private preferredHindiVoiceName: string = "Swara";
    private preferredEnglishVoiceName: string = "Neerja";

    constructor(onStateChange?: (speaking: boolean) => void) {
        this.onSpeakingStateChange = onStateChange;
        this.initVoiceList();
    }

    private initVoiceList(): void {
        if (!("speechSynthesis" in window)) return;

        const loadVoices = () => {
            this.availableVoices = window.speechSynthesis.getVoices();
        };

        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    public setSpeaking(speaking: boolean): void {
        this.isSpeaking = speaking;
        if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange(speaking);
        }
    }

    public getSpeakingState(): boolean {
        return this.isSpeaking;
    }

    public setPreferredVoices(hindiVoice: string, englishVoice: string): void {
        if (hindiVoice) this.preferredHindiVoiceName = hindiVoice;
        if (englishVoice) this.preferredEnglishVoiceName = englishVoice;
    }

    private getBestVoice(isHindi: boolean): SpeechSynthesisVoice | null {
        if (!this.availableVoices || this.availableVoices.length === 0) {
            this.availableVoices = window.speechSynthesis.getVoices();
        }

        if (this.availableVoices.length === 0) return null;

        if (isHindi) {
            // 1. Try match preferred name
            let match = this.availableVoices.find(v => 
                v.name.toLowerCase().includes("swara") || 
                v.name.toLowerCase().includes("madhur") || 
                v.name.toLowerCase().includes("kalpana") || 
                v.name.toLowerCase().includes("hemant")
            );
            if (match) return match;

            // 2. Try match hi-IN / Hindi lang
            match = this.availableVoices.find(v => 
                v.lang.toLowerCase().startsWith("hi") || 
                v.name.toLowerCase().includes("hindi") ||
                v.name.toLowerCase().includes("हिन्दी")
            );
            if (match) return match;
        } else {
            // 1. Try Indian English / Neural English
            let match = this.availableVoices.find(v => 
                v.name.toLowerCase().includes("neerja") || 
                v.name.toLowerCase().includes("prabhat") || 
                v.name.toLowerCase().includes("natural") || 
                v.name.toLowerCase().includes("jenny") || 
                v.name.toLowerCase().includes("guy")
            );
            if (match) return match;

            // 2. Try English (Indian/US/UK)
            match = this.availableVoices.find(v => 
                v.lang.toLowerCase() === "en-in" || 
                v.lang.toLowerCase() === "en-us" || 
                v.lang.toLowerCase().startsWith("en")
            );
            if (match) return match;
        }

        return this.availableVoices[0] || null;
    }

    public speak(text: string, langMode: string = "en"): void {
        if (!text || !text.trim()) return;
        if (!("speechSynthesis" in window)) return;

        // Clean markdown, symbols, and formatting for clean speech
        const cleanText = text
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/```[\s\S]*?```/g, "")
            .replace(/[#*_~`>[\]()]/g, " ")
            .replace(/https?:\/\/\S+/g, "link")
            .replace(/\s+/g, " ")
            .trim();

        if (!cleanText) return;

        // Cancel previous speech session
        this.stopSpeech();

        // Resume engine in case browser suspended audio
        window.speechSynthesis.resume();

        const isHindi = (langMode === "hi" || langMode === "hi-IN" || langMode === "hindi_devanagari" || langMode === "hinglish");
        const voiceObj = this.getBestVoice(isHindi);

        // Split text into sentences to prevent long utterance cutoffs in Chrome
        const sentences = cleanText.match(/[^.!?।\n]+[.!?।\n]+/g) || [cleanText];

        let index = 0;
        const speakNextSentence = () => {
            if (index >= sentences.length) {
                this.setSpeaking(false);
                return;
            }

            const sentence = sentences[index++].trim();
            if (!sentence) {
                speakNextSentence();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(sentence);
            utterance.lang = isHindi ? "hi-IN" : "en-US";
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            if (voiceObj) {
                utterance.voice = voiceObj;
            }

            utterance.onstart = () => {
                this.setSpeaking(true);
            };

            utterance.onend = () => {
                speakNextSentence();
            };

            utterance.onerror = (e) => {
                if (e.error !== "canceled" && e.error !== "interrupted") {
                    console.warn("SpeechSynthesis error:", e.error);
                }
                this.setSpeaking(false);
            };

            window.speechSynthesis.speak(utterance);
        };

        speakNextSentence();
    }

    public stopSpeech(): void {
        this.isSpeaking = false;
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
        if (window.eel && window.eel.stopSpeechOutput) {
            try {
                window.eel.stopSpeechOutput();
            } catch (e) {
                console.warn("stopSpeechOutput notice:", e);
            }
        }
        if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange(false);
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
