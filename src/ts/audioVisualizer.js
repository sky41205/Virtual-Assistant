/* ================================================================
   DRACARYS AI — audioVisualizer.ts
   Dynamic Real-Time Audio & Harmonic Wave Visualizer
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
export class AudioVisualizer {
    constructor(canvasId) {
        this.canvas = null;
        this.ctx = null;
        this.animFrameId = null;
        this.currentState = AssistantState.IDLE;
        // Web Audio API for Mic input
        this.audioCtx = null;
        this.analyser = null;
        this.micStream = null;
        this.micDataArray = null;
        // Synthetic wave parameters
        this.phase = 0;
        this.baseColor = "#00d4ff";
        this.canvas = document.getElementById(canvasId);
        if (this.canvas) {
            this.ctx = this.canvas.getContext("2d");
            this.resizeCanvas();
            window.addEventListener("resize", () => this.resizeCanvas());
        }
        this.startRenderLoop();
    }
    resizeCanvas() {
        if (!this.canvas)
            return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width > 0 ? rect.width : 800;
        this.canvas.height = rect.height > 0 ? rect.height : 180;
    }
    setState(state, message) {
        this.currentState = state;
        this.updateBadge(state, message);
        switch (state) {
            case AssistantState.LISTENING:
                this.baseColor = "#00d4ff"; // Cyan
                this.connectMicrophone();
                break;
            case AssistantState.PROCESSING:
                this.baseColor = "#ffb703"; // Amber
                this.disconnectMicrophone();
                break;
            case AssistantState.SPEAKING:
                this.baseColor = "#00ff88"; // Emerald
                this.disconnectMicrophone();
                break;
            case AssistantState.ERROR:
                this.baseColor = "#ff3366"; // Crimson
                this.disconnectMicrophone();
                break;
            case AssistantState.IDLE:
            default:
                this.baseColor = "#4a90e2";
                this.disconnectMicrophone();
                break;
        }
    }
    updateBadge(state, message) {
        const badge = document.getElementById("visualizerStateBadge");
        const badgeText = document.getElementById("stateBadgeText");
        if (!badge || !badgeText)
            return;
        badge.className = "state-badge state-" + state;
        let label = "Ready";
        switch (state) {
            case AssistantState.LISTENING:
                label = message || "Listening…";
                break;
            case AssistantState.PROCESSING:
                label = message || "Processing…";
                break;
            case AssistantState.SPEAKING:
                label = message || "Speaking…";
                break;
            case AssistantState.ERROR:
                label = message || "Error";
                break;
            case AssistantState.IDLE:
            default:
                label = "Ready";
                break;
        }
        badgeText.textContent = label;
    }
    connectMicrophone() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
                    return;
                const stream = yield navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                this.micStream = stream;
                const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtxClass)
                    return;
                this.audioCtx = new AudioCtxClass();
                const source = this.audioCtx.createMediaStreamSource(stream);
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 256;
                this.analyser.smoothingTimeConstant = 0.8;
                source.connect(this.analyser);
                this.micDataArray = new Uint8Array(this.analyser.frequencyBinCount);
            }
            catch (e) {
                console.warn("Visualizer mic attach notice:", e);
                this.disconnectMicrophone();
            }
        });
    }
    disconnectMicrophone() {
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        if (this.audioCtx) {
            try {
                this.audioCtx.close();
            }
            catch (e) { }
            this.audioCtx = null;
        }
        this.analyser = null;
        this.micDataArray = null;
    }
    startRenderLoop() {
        const render = () => {
            this.draw();
            this.animFrameId = requestAnimationFrame(render);
        };
        render();
    }
    draw() {
        if (!this.canvas || !this.ctx)
            return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerY = height / 2;
        this.ctx.clearRect(0, 0, width, height);
        this.phase += 0.04;
        if (this.currentState === AssistantState.LISTENING && this.analyser && this.micDataArray) {
            // Render Live Mic Frequency Waves
            this.analyser.getByteFrequencyData(this.micDataArray);
            let sum = 0;
            for (let i = 0; i < this.micDataArray.length; i++) {
                sum += this.micDataArray[i];
            }
            const averageVolume = sum / this.micDataArray.length;
            const volumeNorm = Math.min(1.0, averageVolume / 80);
            this.drawHarmonicWaves(width, centerY, 30 + volumeNorm * 45, this.baseColor, 4);
        }
        else if (this.currentState === AssistantState.SPEAKING) {
            // Active synthetic speech wave
            const pulse = 0.7 + 0.3 * Math.sin(this.phase * 2);
            this.drawHarmonicWaves(width, centerY, 38 * pulse, this.baseColor, 3);
        }
        else if (this.currentState === AssistantState.PROCESSING) {
            // Smooth undulating orbital wave
            const pulse = 0.5 + 0.2 * Math.sin(this.phase * 1.5);
            this.drawHarmonicWaves(width, centerY, 22 * pulse, this.baseColor, 2);
        }
        else if (this.currentState === AssistantState.ERROR) {
            // Flatline with subtle jitter
            this.drawFlatline(width, centerY, this.baseColor);
        }
        else {
            // Idle gentle wave
            this.drawHarmonicWaves(width, centerY, 10, this.baseColor, 1);
        }
    }
    drawHarmonicWaves(width, centerY, amplitude, color, waveCount) {
        if (!this.ctx)
            return;
        for (let w = 0; w < waveCount; w++) {
            this.ctx.beginPath();
            const alpha = 0.25 + (0.75 * (w + 1)) / waveCount;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = w === waveCount - 1 ? 2.5 : 1.5;
            this.ctx.globalAlpha = alpha;
            const speedMultiplier = 1 + w * 0.3;
            const phaseShift = this.phase * speedMultiplier + (w * Math.PI) / 4;
            const waveAmp = amplitude * (1 - w * 0.2);
            for (let x = 0; x < width; x += 4) {
                // Windowing envelope (attenuate at left and right edges)
                const envelope = Math.sin((x / width) * Math.PI);
                const y = centerY + Math.sin((x / 60) + phaseShift) * waveAmp * envelope;
                if (x === 0) {
                    this.ctx.moveTo(x, y);
                }
                else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
        }
        this.ctx.globalAlpha = 1.0;
    }
    drawFlatline(width, centerY, color) {
        if (!this.ctx)
            return;
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.6;
        this.ctx.moveTo(0, centerY);
        for (let x = 0; x < width; x += 8) {
            const jitter = (Math.random() - 0.5) * 4;
            this.ctx.lineTo(x, centerY + jitter);
        }
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }
    destroy() {
        if (this.animFrameId)
            cancelAnimationFrame(this.animFrameId);
        this.disconnectMicrophone();
    }
}
