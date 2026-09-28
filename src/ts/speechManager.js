/* ================================================================
   DRACARYS AI — speechManager.ts
   Client-Side Speech Cancellation & Overlap Prevention
   ================================================================ */
export class SpeechManager {
    constructor(onStateChange) {
        this.isSpeaking = false;
        this.onSpeakingStateChange = onStateChange;
    }
    setSpeaking(speaking) {
        this.isSpeaking = speaking;
        if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange(speaking);
        }
    }
    getSpeakingState() {
        return this.isSpeaking;
    }
    stopSpeech() {
        this.isSpeaking = false;
        if (window.eel && window.eel.stopSpeechOutput) {
            try {
                window.eel.stopSpeechOutput();
            }
            catch (e) {
                console.warn("stopSpeechOutput notice:", e);
            }
        }
        if (this.onSpeakingStateChange) {
            this.onSpeakingStateChange(false);
        }
    }
    cancelAndReset() {
        this.stopSpeech();
        if (window.eel && window.eel.resetAssistantState) {
            try {
                window.eel.resetAssistantState();
            }
            catch (e) {
                console.warn("resetAssistantState notice:", e);
            }
        }
    }
}
