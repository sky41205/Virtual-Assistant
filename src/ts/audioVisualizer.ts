/* ================================================================
   DRACARYS AI — audioVisualizer.ts
   Cyan Multi-Harmonic Sine Wave Visualizer for Central AI Orb
   ================================================================ */

import { AssistantState } from "./types";

export class AudioVisualizer {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private animFrameId: number | null = null;
    private currentState: AssistantState = AssistantState.IDLE;

    // Web Audio API for Mic input
    private audioCtx: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private micStream: MediaStream | null = null;
    private micDataArray: Uint8Array | null = null;

    // Synthetic wave parameters
    private phase: number = 0;
    private baseColor: string = "#00e5ff"; // Vibrant electric cyan

    constructor(canvasId: string = "audioVisualizerCanvas") {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (this.canvas) {
            this.ctx = this.canvas.getContext("2d");
            this.resizeCanvas();
            window.addEventListener("resize", () => this.resizeCanvas());
        }
        this.startRenderLoop();
    }

    private resizeCanvas(): void {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width > 0 ? rect.width : 280;
        this.canvas.height = rect.height > 0 ? rect.height : 90;
    }

    public setState(state: AssistantState, message?: string): void {
        this.currentState = state;
        this.updateBadge(state, message);

        switch (state) {
            case AssistantState.LISTENING:
                this.baseColor = "#00e5ff"; // Electric cyan
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
                this.baseColor = "#00e5ff"; // Default cyan
                this.disconnectMicrophone();
                break;
        }
    }

    private updateBadge(state: AssistantState, message?: string): void {
        const badge = document.getElementById("visualizerStateBadge");
        const badgeText = document.getElementById("stateBadgeText");
        if (!badge || !badgeText) return;

        badge.className = "state-badge state-" + state;

        let label = "Ready";
        switch (state) {
            case AssistantState.LISTENING:
                label = message || "Listening…";
                break;
            case AssistantState.PROCESSING:
                label = message || "Thinking…";
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

    public async connectMicrophone(): Promise<void> {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.micStream = stream;

            const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtxClass) return;

            this.audioCtx = new AudioCtxClass();
            const source = this.audioCtx.createMediaStreamSource(stream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;

            source.connect(this.analyser);
            this.micDataArray = new Uint8Array(this.analyser.frequencyBinCount);
        } catch (e) {
            console.warn("Visualizer mic attach notice:", e);
            this.disconnectMicrophone();
        }
    }

    public disconnectMicrophone(): void {
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch (e) {}
            this.audioCtx = null;
        }
        this.analyser = null;
        this.micDataArray = null;
    }

    private startRenderLoop(): void {
        const render = () => {
            this.draw();
            this.animFrameId = requestAnimationFrame(render);
        };
        render();
    }

    private draw(): void {
        if (!this.canvas || !this.ctx) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerY = height / 2;

        this.ctx.clearRect(0, 0, width, height);

        this.phase += 0.045;

        if (this.currentState === AssistantState.LISTENING && this.analyser && this.micDataArray) {
            // Render Live Mic Frequency Waves
            this.analyser.getByteFrequencyData(this.micDataArray as any);
            let sum = 0;
            for (let i = 0; i < this.micDataArray.length; i++) {
                sum += this.micDataArray[i];
            }
            const averageVolume = sum / this.micDataArray.length;
            const volumeNorm = Math.min(1.0, averageVolume / 65);

            this.drawCyanSineWave(width, centerY, 14 + volumeNorm * 26, this.baseColor, 4, 1.4);

        } else if (this.currentState === AssistantState.SPEAKING) {
            // Active speech wave pulsing dynamically
            const pulse = 0.75 + 0.25 * Math.sin(this.phase * 2.2);
            this.drawCyanSineWave(width, centerY, 18 * pulse, this.baseColor, 4, 1.2);

        } else if (this.currentState === AssistantState.PROCESSING) {
            // Orbital thinking wave
            const pulse = 0.6 + 0.25 * Math.sin(this.phase * 1.8);
            this.drawCyanSineWave(width, centerY, 12 * pulse, this.baseColor, 3, 0.9);

        } else if (this.currentState === AssistantState.ERROR) {
            // Error flatline jitter
            this.drawFlatline(width, centerY, this.baseColor);

        } else {
            // Idle calm cyan multi-sine wave
            const pulse = 0.85 + 0.15 * Math.sin(this.phase * 0.8);
            this.drawCyanSineWave(width, centerY, 7.5 * pulse, this.baseColor, 3, 0.7);
        }
    }

    private drawCyanSineWave(
        width: number,
        centerY: number,
        amplitude: number,
        color: string,
        waveCount: number,
        speedScale: number
    ): void {
        if (!this.ctx) return;

        // Faint central luminous baseline
        this.ctx.beginPath();
        this.ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
        this.ctx.lineWidth = 1;
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(width, centerY);
        this.ctx.stroke();

        this.ctx.shadowColor = "#00e5ff";
        this.ctx.shadowBlur = 10;

        for (let w = 0; w < waveCount; w++) {
            this.ctx.beginPath();
            const alpha = 0.4 + (0.6 * (w + 1)) / waveCount;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = w === waveCount - 1 ? 2.4 : 1.4;
            this.ctx.globalAlpha = alpha;

            const speedMultiplier = (1 + w * 0.35) * speedScale;
            const phaseShift = this.phase * speedMultiplier + (w * Math.PI) / 3;
            const waveAmp = amplitude * (1 - w * 0.18);
            const frequency = 45 - w * 5;

            for (let x = 0; x <= width; x += 3) {
                // Bell window envelope to smoothly taper at orb edges
                const normX = x / width;
                const envelope = Math.sin(normX * Math.PI);
                const y = centerY + Math.sin((x / frequency) + phaseShift) * waveAmp * envelope;

                if (x === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
        }

        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1.0;
    }

    private drawFlatline(width: number, centerY: number, color: string): void {
        if (!this.ctx) return;
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

    public destroy(): void {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        this.disconnectMicrophone();
    }
}
