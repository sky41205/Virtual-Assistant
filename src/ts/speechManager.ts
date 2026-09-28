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

    public stopSpeech(): void {
        this.isSpeaking = false;
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
