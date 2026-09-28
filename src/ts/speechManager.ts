/* ================================================================
   DRACARYS AI — speechManager.ts
   Client-Side Speech Cancellation & Overlap Prevention
   ================================================================ */

export class SpeechManager {
    private isSpeaking: boolean = false;
    private onSpeakingStateChange?: (speaking: boolean) => void;

    constructor(onStateChange?: (speaking: boolean) => void) {
        this.onSpeakingStateChange = onStateChange;
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

    public speak(text: string, lang: string = "en-US"): void {
        if (!text || !text.trim()) return;
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = (lang === "hi" || lang === "hi-IN" || lang === "hindi_devanagari" || lang === "hinglish") ? "hi-IN" : "en-US";
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.onstart = () => this.setSpeaking(true);
            utterance.onend = () => this.setSpeaking(false);
            utterance.onerror = () => this.setSpeaking(false);
            window.speechSynthesis.speak(utterance);
        }
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
