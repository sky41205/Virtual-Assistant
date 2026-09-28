"use strict";
(() => {
  // src/ts/audioVisualizer.ts
  var AudioVisualizer = class {
    // Vibrant electric cyan
    constructor(canvasId = "audioVisualizerCanvas") {
      this.canvas = null;
      this.ctx = null;
      this.animFrameId = null;
      this.currentState = "idle" /* IDLE */;
      // Web Audio API for Mic input
      this.audioCtx = null;
      this.analyser = null;
      this.micStream = null;
      this.micDataArray = null;
      // Synthetic wave parameters
      this.phase = 0;
      this.baseColor = "#00e5ff";
      this.canvas = document.getElementById(canvasId);
      if (this.canvas) {
        this.ctx = this.canvas.getContext("2d");
        this.resizeCanvas();
        window.addEventListener("resize", () => this.resizeCanvas());
      }
      this.startRenderLoop();
    }
    resizeCanvas() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width > 0 ? rect.width : 280;
      this.canvas.height = rect.height > 0 ? rect.height : 90;
    }
    setState(state, message) {
      this.currentState = state;
      this.updateBadge(state, message);
      switch (state) {
        case "listening" /* LISTENING */:
          this.baseColor = "#00e5ff";
          this.connectMicrophone();
          break;
        case "processing" /* PROCESSING */:
          this.baseColor = "#ffb703";
          this.disconnectMicrophone();
          break;
        case "speaking" /* SPEAKING */:
          this.baseColor = "#00ff88";
          this.disconnectMicrophone();
          break;
        case "error" /* ERROR */:
          this.baseColor = "#ff3366";
          this.disconnectMicrophone();
          break;
        case "idle" /* IDLE */:
        default:
          this.baseColor = "#00e5ff";
          this.disconnectMicrophone();
          break;
      }
    }
    updateBadge(state, message) {
      const badge = document.getElementById("visualizerStateBadge");
      const badgeText = document.getElementById("stateBadgeText");
      if (!badge || !badgeText) return;
      badge.className = "state-badge state-" + state;
      let label = "Ready";
      switch (state) {
        case "listening" /* LISTENING */:
          label = message || "Listening\u2026";
          break;
        case "processing" /* PROCESSING */:
          label = message || "Thinking\u2026";
          break;
        case "speaking" /* SPEAKING */:
          label = message || "Speaking\u2026";
          break;
        case "error" /* ERROR */:
          label = message || "Error";
          break;
        case "idle" /* IDLE */:
        default:
          label = "Ready";
          break;
      }
      badgeText.textContent = label;
    }
    async connectMicrophone() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.micStream = stream;
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
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
    disconnectMicrophone() {
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
        this.micStream = null;
      }
      if (this.audioCtx) {
        try {
          this.audioCtx.close();
        } catch (e) {
        }
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
      if (!this.canvas || !this.ctx) return;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const centerY = height / 2;
      this.ctx.clearRect(0, 0, width, height);
      this.phase += 0.045;
      if (this.currentState === "listening" /* LISTENING */ && this.analyser && this.micDataArray) {
        this.analyser.getByteFrequencyData(this.micDataArray);
        let sum = 0;
        for (let i = 0; i < this.micDataArray.length; i++) {
          sum += this.micDataArray[i];
        }
        const averageVolume = sum / this.micDataArray.length;
        const volumeNorm = Math.min(1, averageVolume / 65);
        this.drawCyanSineWave(width, centerY, 14 + volumeNorm * 26, this.baseColor, 4, 1.4);
      } else if (this.currentState === "speaking" /* SPEAKING */) {
        const pulse = 0.75 + 0.25 * Math.sin(this.phase * 2.2);
        this.drawCyanSineWave(width, centerY, 18 * pulse, this.baseColor, 4, 1.2);
      } else if (this.currentState === "processing" /* PROCESSING */) {
        const pulse = 0.6 + 0.25 * Math.sin(this.phase * 1.8);
        this.drawCyanSineWave(width, centerY, 12 * pulse, this.baseColor, 3, 0.9);
      } else if (this.currentState === "error" /* ERROR */) {
        this.drawFlatline(width, centerY, this.baseColor);
      } else {
        const pulse = 0.85 + 0.15 * Math.sin(this.phase * 0.8);
        this.drawCyanSineWave(width, centerY, 7.5 * pulse, this.baseColor, 3, 0.7);
      }
    }
    drawCyanSineWave(width, centerY, amplitude, color, waveCount, speedScale) {
      if (!this.ctx) return;
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
        const alpha = 0.4 + 0.6 * (w + 1) / waveCount;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = w === waveCount - 1 ? 2.4 : 1.4;
        this.ctx.globalAlpha = alpha;
        const speedMultiplier = (1 + w * 0.35) * speedScale;
        const phaseShift = this.phase * speedMultiplier + w * Math.PI / 3;
        const waveAmp = amplitude * (1 - w * 0.18);
        const frequency = 45 - w * 5;
        for (let x = 0; x <= width; x += 3) {
          const normX = x / width;
          const envelope = Math.sin(normX * Math.PI);
          const y = centerY + Math.sin(x / frequency + phaseShift) * waveAmp * envelope;
          if (x === 0) {
            this.ctx.moveTo(x, y);
          } else {
            this.ctx.lineTo(x, y);
          }
        }
        this.ctx.stroke();
      }
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;
    }
    drawFlatline(width, centerY, color) {
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
      this.ctx.globalAlpha = 1;
    }
    destroy() {
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.disconnectMicrophone();
    }
  };

  // src/ts/voiceEngine.ts
  var VoiceEngine = class {
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
    async startListening(preferredLang) {
      if (this.isListening) {
        this.stopListening();
      }
      const lang = preferredLang || document.getElementById("settingSpeechLang")?.value || "en-IN";
      if (!this.SpeechAPI) {
        console.warn("Web Speech API not supported in this browser. Falling back to Python SpeechRecognition.");
        this.callbacks.onStateChange("listening" /* LISTENING */, "Listening via system microphone\u2026");
        if (window.eel && window.eel.allCommands) {
          window.eel.playClickSound();
          window.eel.allCommands()();
        }
        return;
      }
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch (permErr) {
        console.warn("Browser getUserMedia failed, falling back to Python speech recognition:", permErr);
        if (window.eel && window.eel.allCommands) {
          this.callbacks.onStateChange("listening" /* LISTENING */, "Listening via microphone\u2026");
          window.eel.allCommands()();
          return;
        }
        this.callbacks.onError("permission-denied", "Microphone access blocked. You can type in the box below.");
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
          this.callbacks.onStateChange("listening" /* LISTENING */, "Listening\u2026 Speak clearly now");
        };
        this.recognition.onresult = (event) => {
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
        this.recognition.onerror = (event) => {
          this.isListening = false;
          console.warn("VoiceEngine error:", event.error);
          let errorTitle = "Speech recognition error";
          switch (event.error) {
            case "not-allowed":
            case "permission-denied":
              if (window.eel && window.eel.allCommands) {
                console.warn("Web Speech denied, fallback to Python backend takeCommand.");
                this.callbacks.onStateChange("listening" /* LISTENING */, "Listening via microphone\u2026");
                window.eel.allCommands()();
                return;
              }
              errorTitle = "Microphone access blocked. Click 'Type Instead' to enter text.";
              break;
            case "no-speech":
              errorTitle = "No speech detected. Speak again or type below.";
              break;
            case "audio-capture":
              if (window.eel && window.eel.allCommands) {
                this.callbacks.onStateChange("listening" /* LISTENING */, "Listening via microphone\u2026");
                window.eel.allCommands()();
                return;
              }
              errorTitle = "Microphone not ready. Type below to ask.";
              break;
            case "network":
              errorTitle = "Network connection error during voice recognition.";
              break;
            case "aborted":
              return;
            // User explicitly cancelled
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
          } else if (!capturedAny) {
            this.callbacks.onError("no-speech", "No speech detected. Please try again.");
          }
        };
        this.recognition.start();
      } catch (err) {
        console.warn("Recognition start exception, falling back to Python:", err);
        this.callbacks.onStateChange("listening" /* LISTENING */, "Listening via system microphone\u2026");
        if (window.eel && window.eel.allCommands) {
          window.eel.playClickSound();
          window.eel.allCommands()();
        }
      }
    }
    stopListening() {
      this.isListening = false;
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch (e) {
        }
        this.recognition = null;
      }
    }
    getListeningState() {
      return this.isListening;
    }
  };

  // src/ts/speechManager.ts
  var SpeechManager = class {
    constructor(onStateChange) {
      this.isSpeaking = false;
      this.availableVoices = [];
      this.keepAliveTimer = null;
      this.fallbackAudio = null;
      this.voicesLoaded = false;
      this.onSpeakingStateChange = onStateChange;
      this.initVoices();
    }
    initVoices() {
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
      setTimeout(load, 500);
      setTimeout(load, 1500);
    }
    setSpeaking(speaking) {
      this.isSpeaking = speaking;
      if (!speaking) {
        this.clearKeepAlive();
      }
      if (this.onSpeakingStateChange) {
        this.onSpeakingStateChange(speaking);
      }
    }
    getSpeakingState() {
      return this.isSpeaking;
    }
    /**
     * Clean text of markdown, URLs, emojis, and special symbols for natural TTS speech
     */
    sanitizeTextForSpeech(raw) {
      if (!raw) return "";
      let text = raw;
      text = text.replace(/```[\s\S]*?```/g, " code block omitted. ");
      text = text.replace(/`([^`]+)`/g, "$1");
      text = text.replace(/[*#_~>]/g, "");
      text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
      text = text.replace(/https?:\/\/\S+/g, " link ");
      text = text.replace(/^[•\-\*]\s+/gm, "");
      text = text.replace(/[🔥⚡🧠✨💡🐉🎙️💻📱📄🧩🌐🤝🎉]/g, "");
      text = text.replace(/\n+/g, ". ");
      text = text.replace(/\s{2,}/g, " ");
      return text.trim();
    }
    /**
     * Select best matching voice for the target language mode
     */
    findBestVoice(isHindi) {
      if (!this.availableVoices || this.availableVoices.length === 0) {
        this.availableVoices = window.speechSynthesis.getVoices() || [];
      }
      const voices = this.availableVoices;
      if (!voices || voices.length === 0) return null;
      if (isHindi) {
        const hiVoice = voices.find(
          (v) => v.lang.toLowerCase().startsWith("hi") || v.name.toLowerCase().includes("hindi") || v.name.toLowerCase().includes("swara") || v.name.toLowerCase().includes("madhur") || v.name.includes("\u0939\u093F\u0928\u094D\u0926\u0940")
        );
        if (hiVoice) return hiVoice;
        const inVoice = voices.find((v) => v.lang.toLowerCase().includes("en-in") || v.name.toLowerCase().includes("india"));
        if (inVoice) return inVoice;
      } else {
        const enInVoice = voices.find((v) => v.lang.toLowerCase().includes("en-in") || v.name.toLowerCase().includes("neerja"));
        if (enInVoice) return enInVoice;
        const enVoice = voices.find(
          (v) => v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("google") || v.name.toLowerCase().includes("jenny") || v.name.toLowerCase().includes("guy") || v.name.toLowerCase().includes("samantha") || v.lang.toLowerCase().startsWith("en")
        );
        if (enVoice) return enVoice;
      }
      return voices.find((v) => v.default) || voices[0] || null;
    }
    /**
     * Speak text using Web Speech API with keepalive and audio fallback
     */
    speak(text, lang = "en-US") {
      const cleanText = this.sanitizeTextForSpeech(text);
      if (!cleanText) return;
      this.stopSpeech();
      const isHindi = lang === "hi" || lang === "hi-IN" || lang === "hindi_devanagari" || lang === "hinglish" || /[\u0900-\u097F]/.test(cleanText);
      const targetLangCode = isHindi ? "hi-IN" : "en-US";
      if (!("speechSynthesis" in window)) {
        this.speakWithAudioFallback(cleanText, isHindi ? "hi" : "en");
        return;
      }
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = targetLangCode;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
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
        setTimeout(() => {
          try {
            window.speechSynthesis.speak(utterance);
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
    speakWithAudioFallback(text, langCode) {
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
        if (playPromise !== void 0) {
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
    startKeepAlive() {
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
      }, 8e3);
    }
    clearKeepAlive() {
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
    }
    stopSpeech() {
      this.setSpeaking(false);
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
        }
      }
      if (this.fallbackAudio) {
        try {
          this.fallbackAudio.pause();
          this.fallbackAudio = null;
        } catch (e) {
        }
      }
      if (window.eel && window.eel.stopSpeechOutput) {
        try {
          window.eel.stopSpeechOutput();
        } catch (e) {
        }
      }
    }
    cancelAndReset() {
      this.stopSpeech();
      if (window.eel && window.eel.resetAssistantState) {
        try {
          window.eel.resetAssistantState();
        } catch (e) {
        }
      }
    }
  };

  // src/ts/historyManager.ts
  var HistoryManager = class {
    constructor(onRerun) {
      this.onRerunCommand = onRerun;
      this.bindEvents();
    }
    bindEvents() {
      const btnClear = document.getElementById("btnClearHistory");
      if (btnClear) {
        btnClear.addEventListener("click", () => this.clearAll());
      }
      const btnRefresh = document.getElementById("btnRefreshHistory");
      if (btnRefresh) {
        btnRefresh.addEventListener("click", () => this.loadHistory());
      }
      const historyDrawer = document.getElementById("historyOffcanvas");
      if (historyDrawer) {
        historyDrawer.addEventListener("show.bs.offcanvas", () => this.loadHistory());
      }
    }
    loadHistory() {
      if (!window.eel || !window.eel.getCommandHistory) return;
      window.eel.getCommandHistory(50)((history) => {
        this.renderHistory(history || []);
      });
    }
    renderHistory(items) {
      const container = document.getElementById("historyListContainer");
      const countBadge = document.getElementById("historyCountBadge");
      if (!container) return;
      if (countBadge) countBadge.textContent = items.length.toString();
      if (items.length === 0) {
        container.innerHTML = `
                <div class="text-center text-muted p-4" style="font-size:0.85rem;">
                    <i class="bi bi-clock-history d-block mb-2" style="font-size:1.5rem; opacity:0.4;"></i>
                    No tasks or commands recorded yet.
                </div>
            `;
        return;
      }
      container.innerHTML = "";
      items.forEach((item) => {
        const isVoice = item.source === "voice";
        const badgeCls = isVoice ? "badge-voice" : "badge-chat";
        const iconCls = isVoice ? "bi-mic-fill" : "bi-keyboard";
        const label = isVoice ? "Voice" : "Chat";
        const respHtml = item.response ? `<div class="history-resp"><i class="bi bi-arrow-return-right me-1"></i>${this.escapeHtml(item.response)}</div>` : "";
        const el = document.createElement("div");
        el.className = "history-item";
        el.setAttribute("data-id", item.id.toString());
        el.innerHTML = `
                <div class="history-item-header">
                    <span class="history-badge ${badgeCls}"><i class="bi ${iconCls} me-1"></i>${label}</span>
                    <span class="history-time">${this.formatTimeAgo(item.timestamp)}</span>
                </div>
                <div class="history-cmd-text">${this.escapeHtml(item.command)}</div>
                ${respHtml}
                <div class="history-actions">
                    <button class="btn-history-action btn-rerun-cmd" title="Re-run this command">
                        <i class="bi bi-play-fill me-1"></i>Re-run
                    </button>
                    <button class="btn-history-action btn-copy-cmd" title="Copy text to chatbox">
                        <i class="bi bi-clipboard me-1"></i>Copy
                    </button>
                    <button class="btn-history-action btn-del-cmd" title="Delete from history">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
        el.querySelector(".btn-rerun-cmd")?.addEventListener("click", () => {
          this.closeDrawer();
          if (this.onRerunCommand) {
            this.onRerunCommand(item.command);
          }
        });
        el.querySelector(".btn-copy-cmd")?.addEventListener("click", () => {
          const chatbox = document.getElementById("chatbox");
          if (chatbox) {
            chatbox.value = item.command;
            chatbox.focus();
          }
          this.closeDrawer();
        });
        el.querySelector(".btn-del-cmd")?.addEventListener("click", () => {
          if (window.eel && window.eel.deleteHistoryItem) {
            window.eel.deleteHistoryItem(item.id)(() => this.loadHistory());
          }
        });
        container.appendChild(el);
      });
    }
    clearAll() {
      if (!confirm("Are you sure you want to clear all command and task history?")) return;
      if (window.eel && window.eel.clearCommandHistory) {
        window.eel.clearCommandHistory()(() => this.loadHistory());
      }
    }
    closeDrawer() {
      const el = document.getElementById("historyOffcanvas");
      if (el && window.bootstrap) {
        const inst = window.bootstrap.Offcanvas.getInstance(el);
        if (inst) inst.hide();
      }
    }
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
    formatTimeAgo(ts) {
      if (!ts) return "Recent";
      try {
        const d = /* @__PURE__ */ new Date(ts.replace(" ", "T") + "Z");
        if (isNaN(d.getTime())) return ts;
        const sec = Math.floor((Date.now() - d.getTime()) / 1e3);
        if (sec < 60) return "Just now";
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        return d.toLocaleDateString();
      } catch (e) {
        return ts;
      }
    }
  };

  // src/ts/voiceSettings.ts
  var VoiceSettingsManager = class {
    constructor() {
      this.currentTheme = "cyan";
      this.currentTheme = localStorage.getItem("assistant_theme") || "cyan";
      this.applyTheme(this.currentTheme);
      this.bindEvents();
      this.loadSettings();
    }
    bindEvents() {
      const btnSave = document.getElementById("btnSaveSettings");
      if (btnSave) {
        btnSave.addEventListener("click", () => this.saveSettings());
      }
      const btnTestHindi = document.getElementById("btnTestHindiVoice");
      if (btnTestHindi) {
        btnTestHindi.addEventListener("click", () => {
          const voice = document.getElementById("settingHindiVoice")?.value || "hi-IN-SwaraNeural";
          if (window.eel && window.eel.testVoice) {
            window.eel.testVoice(voice, "hindi")();
          } else if (window.assistantApp && window.assistantApp.speechManager) {
            window.assistantApp.speechManager.speak("\u0928\u092E\u0938\u094D\u0924\u0947! \u092E\u0948\u0902 \u0921\u094D\u0930\u0947\u0915\u0947\u0930\u093F\u0938 \u090F\u0906\u0908 \u0939\u0942\u0901\u0964 \u0906\u092A\u0915\u0940 \u0939\u093F\u0902\u0926\u0940 \u0935\u0949\u092F\u0938 \u0938\u092B\u0932\u0924\u093E\u092A\u0942\u0930\u094D\u0935\u0915 \u0915\u093E\u092E \u0915\u0930 \u0930\u0939\u0940 \u0939\u0948\u0964", "hi-IN");
          }
        });
      }
      const btnTestEnglish = document.getElementById("btnTestEnglishVoice");
      if (btnTestEnglish) {
        btnTestEnglish.addEventListener("click", () => {
          const voice = document.getElementById("settingEnglishVoice")?.value || "en-IN-NeerjaNeural";
          if (window.eel && window.eel.testVoice) {
            window.eel.testVoice(voice, "english")();
          } else if (window.assistantApp && window.assistantApp.speechManager) {
            window.assistantApp.speechManager.speak("Hello! I am Dracarys AI. Your English neural voice is online and speaking clearly.", "en-US");
          }
        });
      }
      const btnResetState = document.getElementById("btnResetState");
      if (btnResetState) {
        btnResetState.addEventListener("click", () => {
          if (window.eel && window.eel.resetAssistantState) {
            window.eel.resetAssistantState()(() => {
              this.closeDrawer();
              if (window.restoreMainUI) window.restoreMainUI();
            });
          }
        });
      }
      document.querySelectorAll(".theme-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const theme = target.getAttribute("data-theme");
          if (theme) this.applyTheme(theme);
        });
      });
      const settingsDrawer = document.getElementById("settingsOffcanvas");
      if (settingsDrawer) {
        settingsDrawer.addEventListener("show.bs.offcanvas", () => this.loadSettings());
      }
    }
    applyTheme(theme) {
      document.body.classList.remove("theme-fire", "theme-cyan", "theme-purple", "theme-emerald", "theme-stealth");
      document.body.classList.add("theme-" + theme);
      document.querySelectorAll(".theme-btn").forEach((b) => {
        if (b.getAttribute("data-theme") === theme) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });
      localStorage.setItem("assistant_theme", theme);
      this.currentTheme = theme;
    }
    loadSettings() {
      if (!window.eel || !window.eel.getAssistantSettings) return;
      window.eel.getAssistantSettings()((s) => {
        if (!s) return;
        const nameInput = document.getElementById("settingAssistantName");
        const titleEl = document.getElementById("assistantDisplayTitle");
        if (s.name) {
          if (nameInput) nameInput.value = s.name;
          if (titleEl) titleEl.textContent = s.name.toUpperCase();
          document.title = s.name.toUpperCase();
        }
        const langSelect = document.getElementById("settingSpeechLang");
        if (langSelect && s.speech_lang) langSelect.value = s.speech_lang;
        const hindiSelect = document.getElementById("settingHindiVoice");
        if (hindiSelect && s.tts_hindi_voice) hindiSelect.value = s.tts_hindi_voice;
        const engSelect = document.getElementById("settingEnglishVoice");
        if (engSelect && s.tts_english_voice) engSelect.value = s.tts_english_voice;
        if (s.theme) this.applyTheme(s.theme);
      });
    }
    saveSettings() {
      const name = document.getElementById("settingAssistantName")?.value.trim() || "Dracarys";
      const speechLang = document.getElementById("settingSpeechLang")?.value || "en-IN";
      const hindiVoice = document.getElementById("settingHindiVoice")?.value || "hi-IN-SwaraNeural";
      const engVoice = document.getElementById("settingEnglishVoice")?.value || "en-IN-NeerjaNeural";
      const titleEl = document.getElementById("assistantDisplayTitle");
      if (titleEl) titleEl.textContent = name.toUpperCase();
      document.title = name.toUpperCase();
      if (window.eel && window.eel.saveAssistantSettings) {
        window.eel.saveAssistantSettings(
          name,
          0,
          170,
          1,
          this.currentTheme,
          speechLang,
          hindiVoice,
          engVoice
        )(() => {
          this.closeDrawer();
        });
      }
    }
    closeDrawer() {
      const el = document.getElementById("settingsOffcanvas");
      if (el && window.bootstrap) {
        const inst = window.bootstrap.Offcanvas.getInstance(el);
        if (inst) inst.hide();
      }
    }
  };

  // src/ts/documentUploader.ts
  var DocumentUploader = class {
    constructor(onStart, onComplete) {
      this.fileInput = null;
      this.onAnalysisStart = onStart;
      this.onAnalysisComplete = onComplete;
      this.bindEvents();
    }
    bindEvents() {
      const uploadBtn = document.getElementById("UploadBtn");
      this.fileInput = document.getElementById("docFileInput");
      if (uploadBtn && this.fileInput) {
        uploadBtn.addEventListener("click", () => {
          if (window.eel && window.eel.playClickSound) window.eel.playClickSound();
          this.fileInput?.click();
        });
        this.fileInput.addEventListener("change", (e) => this.handleFileSelected(e));
      }
      const btnCopySummary = document.getElementById("btnCopyDocSummary");
      if (btnCopySummary) {
        btnCopySummary.addEventListener("click", () => {
          const content = document.getElementById("docModalContent")?.textContent;
          if (content && navigator.clipboard) {
            navigator.clipboard.writeText(content).then(() => {
              const originalHtml = btnCopySummary.innerHTML;
              btnCopySummary.innerHTML = '<i class="bi bi-check2 me-1"></i> Copied!';
              setTimeout(() => {
                btnCopySummary.innerHTML = originalHtml;
              }, 2e3);
            });
          }
        });
      }
    }
    handleFileSelected(event) {
      const target = event.target;
      const file = target.files?.[0];
      if (!file) return;
      if (this.onAnalysisStart) {
        this.onAnalysisStart(file.name);
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const b64Data = evt.target?.result;
        if (window.eel && window.eel.analyzeDocumentData) {
          window.eel.analyzeDocumentData(file.name, b64Data)((res) => {
            this.showDocumentResult(res);
            if (this.onAnalysisComplete) {
              this.onAnalysisComplete(res);
            }
            if (this.fileInput) this.fileInput.value = "";
          });
        }
      };
      reader.readAsDataURL(file);
    }
    showDocumentResult(res) {
      if (!res || !res.success) {
        alert("Could not analyze document: " + (res ? res.error || "Unknown error" : "No response"));
        return;
      }
      const titleEl = document.getElementById("docModalFilename");
      const sizeEl = document.getElementById("docModalSize");
      const wordsEl = document.getElementById("docModalWords");
      const contentEl = document.getElementById("docModalContent");
      if (titleEl) titleEl.textContent = res.filename || "Document Analysis";
      if (sizeEl) sizeEl.textContent = res.size_kb ? `${res.size_kb} KB` : "";
      if (wordsEl) wordsEl.textContent = res.word_count ? `${res.word_count} words` : "";
      if (contentEl) contentEl.innerHTML = this.formatDocMarkdown(res.summary_text);
      const modalEl = document.getElementById("docAnalysisModal");
      if (modalEl && window.bootstrap) {
        const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    }
    formatDocMarkdown(text) {
      if (!text) return "";
      let html = text.replace(/### (.*?)\n/g, "<h3>$1</h3>").replace(/## (.*?)\n/g, "<h3>$1</h3>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/^\* (.*?)$/gm, "<li>$1</li>").replace(/^- (.*?)$/gm, "<li>$1</li>").replace(/\n\n/g, "<p></p>").replace(/\n/g, "<br>");
      html = html.replace(/(<li>.*?<\/li>)+/g, (match) => `<ul>${match}</ul>`);
      return html;
    }
  };

  // src/ts/uiCustomizer.ts
  var BG_PRESETS = [
    { id: "none", label: "None", url: "" },
    { id: "nebula", label: "Nebula", url: "assets/bg/nebula.jpg" },
    { id: "aurora", label: "Aurora", url: "assets/bg/aurora.jpg" },
    { id: "space", label: "Space", url: "assets/bg/space.jpg" },
    { id: "forest", label: "Forest", url: "assets/bg/forest.jpg" },
    { id: "abstract", label: "Abstract", url: "assets/bg/abstract.jpg" }
  ];
  var UICustomizer = class {
    constructor() {
      this.prefs = {
        theme_mode: "dark",
        accent_color: "cyan",
        font_size: "medium",
        reduced_motion: false,
        widgets_pinned: ["clock", "weather", "tasks", "notes", "calendar", "telemetry"],
        bgImage: ""
      };
      this.loadPreferences();
      this.bindEvents();
      this.setupKeyboardShortcuts();
    }
    bindEvents() {
      const modeToggle = document.getElementById("toggleThemeMode");
      if (modeToggle) {
        modeToggle.addEventListener("change", () => {
          this.prefs.theme_mode = modeToggle.checked ? "light" : "dark";
          this.applyPreferences();
          this.savePreferences();
        });
      }
      document.querySelectorAll(".accent-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const accent = target.getAttribute("data-accent");
          if (accent) {
            this.prefs.accent_color = accent;
            this.applyPreferences();
            this.savePreferences();
          }
        });
      });
      document.querySelectorAll(".font-size-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const size = target.getAttribute("data-size");
          if (size) {
            this.prefs.font_size = size;
            this.applyPreferences();
            this.savePreferences();
          }
        });
      });
      const motionToggle = document.getElementById("toggleReducedMotion");
      if (motionToggle) {
        motionToggle.addEventListener("change", () => {
          this.prefs.reduced_motion = motionToggle.checked;
          this.applyPreferences();
          this.savePreferences();
        });
      }
      document.querySelectorAll(".bg-preset-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          const presetId = target.getAttribute("data-bg");
          const preset = BG_PRESETS.find((p) => p.id === presetId);
          if (preset !== void 0) {
            this.prefs.bgImage = preset.url;
            this.applyBackground(this.prefs.bgImage);
            this.savePreferences();
            document.querySelectorAll(".bg-preset-btn").forEach((b) => b.classList.remove("active"));
            target.classList.add("active");
          }
        });
      });
      const bgUploadInput = document.getElementById("bgImageUploadInput");
      if (bgUploadInput) {
        bgUploadInput.addEventListener("change", () => {
          const file = bgUploadInput.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result;
            if (dataUrl) {
              this.prefs.bgImage = dataUrl;
              this.applyBackground(dataUrl);
              localStorage.setItem("assistant_ui_prefs", JSON.stringify(this.prefs));
              document.querySelectorAll(".bg-preset-btn").forEach((b) => b.classList.remove("active"));
            }
          };
          reader.readAsDataURL(file);
        });
      }
    }
    /** Apply a background image (URL or data URL) or clear it if empty. */
    applyBackground(imageUrl) {
      const body = document.body;
      if (imageUrl) {
        body.style.setProperty("--custom-bg-image", `url('${imageUrl}')`);
        body.classList.add("has-custom-bg");
      } else {
        body.style.removeProperty("--custom-bg-image");
        body.classList.remove("has-custom-bg");
      }
      document.querySelectorAll(".bg-preset-btn").forEach((btn) => {
        const presetId = btn.getAttribute("data-bg");
        const preset = BG_PRESETS.find((p) => p.id === presetId);
        if (preset && preset.url === imageUrl) {
          btn.classList.add("active");
        } else if (presetId === "none" && !imageUrl) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }
    setupKeyboardShortcuts() {
      document.addEventListener("keydown", (e) => {
        const activeTag = (document.activeElement?.tagName || "").toLowerCase();
        const isInputActive = activeTag === "input" || activeTag === "textarea";
        if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
          e.preventDefault();
          const micBtn = document.getElementById("MicBtn");
          micBtn?.click();
          this.announce("Microphone toggled via shortcut.");
          return;
        }
        if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
          e.preventDefault();
          this.toggleDrawer("widgetsOffcanvas");
          this.announce("Dashboard widgets toggled.");
          return;
        }
        if (e.ctrlKey && (e.key === "h" || e.key === "H")) {
          e.preventDefault();
          this.toggleDrawer("historyOffcanvas");
          this.announce("Task history drawer toggled.");
          return;
        }
        if (e.ctrlKey && e.key === ",") {
          e.preventDefault();
          this.toggleDrawer("settingsOffcanvas");
          this.announce("Settings drawer toggled.");
          return;
        }
        if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
          e.preventDefault();
          const uploadBtn = document.getElementById("UploadBtn");
          uploadBtn?.click();
          this.announce("Document upload file picker opened.");
          return;
        }
        if (e.key === "/" && !isInputActive) {
          e.preventDefault();
          const chatbox = document.getElementById("chatbox");
          chatbox?.focus();
        }
      });
    }
    toggleDrawer(drawerId) {
      const el = document.getElementById(drawerId);
      if (el && window.bootstrap) {
        const inst = window.bootstrap.Offcanvas.getOrCreateInstance(el);
        inst.toggle();
      }
    }
    applyPreferences() {
      const body = document.body;
      if (this.prefs.theme_mode === "light") {
        body.classList.add("mode-light");
        body.classList.remove("mode-dark");
      } else {
        body.classList.add("mode-dark");
        body.classList.remove("mode-light");
      }
      const modeToggle = document.getElementById("toggleThemeMode");
      if (modeToggle) modeToggle.checked = this.prefs.theme_mode === "light";
      body.classList.remove(
        "theme-cyan",
        "theme-fire",
        "theme-emerald",
        "theme-purple",
        "theme-crimson",
        "theme-blue",
        "theme-amber",
        "theme-stealth"
      );
      body.classList.add("theme-" + this.prefs.accent_color);
      document.querySelectorAll(".accent-btn").forEach((b) => {
        if (b.getAttribute("data-accent") === this.prefs.accent_color) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });
      document.documentElement.setAttribute("data-font-size", this.prefs.font_size);
      document.querySelectorAll(".font-size-btn").forEach((b) => {
        if (b.getAttribute("data-size") === this.prefs.font_size) {
          b.classList.add("active");
        } else {
          b.classList.remove("active");
        }
      });
      if (this.prefs.reduced_motion) {
        body.classList.add("reduced-motion");
      } else {
        body.classList.remove("reduced-motion");
      }
      const motionToggle = document.getElementById("toggleReducedMotion");
      if (motionToggle) motionToggle.checked = this.prefs.reduced_motion;
      this.applyBackground(this.prefs.bgImage || "");
    }
    loadPreferences() {
      const saved = localStorage.getItem("assistant_ui_prefs");
      if (saved) {
        try {
          this.prefs = { ...this.prefs, ...JSON.parse(saved) };
          this.applyPreferences();
        } catch (e) {
        }
      }
      if (window.eel && window.eel.getUIPreferences) {
        window.eel.getUIPreferences()((dbPrefs) => {
          if (dbPrefs) {
            this.prefs = { ...this.prefs, ...dbPrefs };
            this.applyPreferences();
          }
        });
      }
    }
    savePreferences() {
      localStorage.setItem("assistant_ui_prefs", JSON.stringify(this.prefs));
      if (window.eel && window.eel.saveUIPreferences) {
        window.eel.saveUIPreferences(
          this.prefs.theme_mode,
          this.prefs.accent_color,
          this.prefs.font_size,
          this.prefs.reduced_motion,
          this.prefs.widgets_pinned
        )();
      }
    }
    announce(message) {
      const sr = document.getElementById("srAnnouncer");
      if (sr) {
        sr.textContent = message;
      }
    }
    getPreferences() {
      return this.prefs;
    }
  };

  // src/ts/widgetsManager.ts
  var WidgetsManager = class {
    constructor(onDispatch) {
      this.onDispatchCommand = onDispatch;
      this.bindEvents();
    }
    bindEvents() {
      const drawer = document.getElementById("widgetsOffcanvas");
      if (drawer) {
        drawer.addEventListener("show.bs.offcanvas", () => this.refreshWidgets());
      }
      const btnRefresh = document.getElementById("btnRefreshWidgets");
      if (btnRefresh) {
        btnRefresh.addEventListener("click", () => this.refreshWidgets());
      }
      const btnQuickTask = document.getElementById("btnWidgetAddTask");
      const inputQuickTask = document.getElementById("widgetInputTask");
      if (btnQuickTask && inputQuickTask) {
        btnQuickTask.addEventListener("click", () => {
          const val = inputQuickTask.value.trim();
          if (!val) return;
          inputQuickTask.value = "";
          if (window.eel && window.eel.addTask) {
            window.eel.addTask(val)(() => this.refreshWidgets());
          }
        });
        inputQuickTask.addEventListener("keyup", (e) => {
          if (e.key === "Enter") btnQuickTask.click();
        });
      }
      const btnQuickNote = document.getElementById("btnWidgetAddNote");
      const inputQuickNote = document.getElementById("widgetInputNote");
      if (btnQuickNote && inputQuickNote) {
        btnQuickNote.addEventListener("click", () => {
          const val = inputQuickNote.value.trim();
          if (!val) return;
          inputQuickNote.value = "";
          if (window.eel && window.eel.addNote) {
            window.eel.addNote(val.slice(0, 24), val, "general")(() => this.refreshWidgets());
          }
        });
        inputQuickNote.addEventListener("keyup", (e) => {
          if (e.key === "Enter") btnQuickNote.click();
        });
      }
    }
    refreshWidgets() {
      if (!window.eel || !window.eel.getWidgetData) return;
      const refreshIcon = document.querySelector("#btnRefreshWidgets i");
      refreshIcon?.classList.add("spin-animation");
      window.eel.getWidgetData()((data) => {
        if (data) {
          this.renderWorldClock(data.world_clocks || []);
          this.renderTelemetry(data.system);
          this.renderTasks(data.tasks?.tasks || []);
          this.renderNotes(data.notes || []);
          this.renderCalendar(data.calendar || []);
        }
        setTimeout(() => refreshIcon?.classList.remove("spin-animation"), 600);
      });
    }
    renderWorldClock(clocks) {
      const container = document.getElementById("widgetWorldClockContainer");
      if (!container) return;
      if (clocks.length === 0) {
        container.innerHTML = `<span class="text-muted small">Clock data unavailable.</span>`;
        return;
      }
      container.innerHTML = clocks.map((c) => `
            <div class="clock-chip">
                <span class="clock-city">${c.city}</span>
                <span class="clock-time">${c.time}</span>
            </div>
        `).join("");
    }
    renderTelemetry(sys) {
      if (!sys) return;
      const cpuEl = document.getElementById("widgetCpuVal");
      const ramEl = document.getElementById("widgetRamVal");
      const batEl = document.getElementById("widgetBatVal");
      if (cpuEl) cpuEl.textContent = `${sys.cpu}%`;
      if (ramEl) ramEl.textContent = `${sys.ram}%`;
      if (batEl) batEl.textContent = `${sys.battery}%${sys.plugged ? " \u26A1" : ""}`;
    }
    renderTasks(tasks) {
      const container = document.getElementById("widgetTasksList");
      if (!container) return;
      if (!tasks || tasks.length === 0) {
        container.innerHTML = `<div class="text-muted text-center p-2 small">No tasks pending.</div>`;
        return;
      }
      container.innerHTML = tasks.slice(0, 4).map((t) => {
        const isDone = !!t.completed;
        const prio = (t.priority || "medium").toLowerCase();
        const prioCls = prio === "high" ? "prio-high" : prio === "low" ? "prio-low" : "prio-med";
        return `
                <div class="widget-task-item d-flex align-items-center justify-content-between p-2 mb-1">
                    <div class="d-flex align-items-center gap-2">
                        <input type="checkbox" class="widget-task-check" data-id="${t.id}" ${isDone ? "checked" : ""}>
                        <span class="small ${isDone ? "text-decoration-line-through text-muted" : ""}">${t.title}</span>
                    </div>
                    <span class="badge-priority ${prioCls}">${prio}</span>
                </div>
            `;
      }).join("");
      container.querySelectorAll(".widget-task-check").forEach((chk) => {
        chk.addEventListener("change", (e) => {
          const id = e.target.getAttribute("data-id");
          if (id && window.eel && window.eel.toggleTask) {
            window.eel.toggleTask(id)(() => this.refreshWidgets());
          }
        });
      });
    }
    renderNotes(notes) {
      const container = document.getElementById("widgetNotesList");
      if (!container) return;
      if (!notes || notes.length === 0) {
        container.innerHTML = `<div class="text-muted text-center p-2 small">No saved notes.</div>`;
        return;
      }
      container.innerHTML = notes.slice(0, 3).map((n) => `
            <div class="widget-note-card p-2 mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold small text-info">${n.title}</span>
                    <span class="badge bg-secondary" style="font-size:0.65rem;">${n.category}</span>
                </div>
                <div class="small text-muted text-truncate">${n.content}</div>
            </div>
        `).join("");
    }
    renderCalendar(events) {
      const container = document.getElementById("widgetCalendarList");
      if (!container) return;
      if (!events || events.length === 0) {
        container.innerHTML = `<div class="text-muted text-center p-2 small">No events scheduled.</div>`;
        return;
      }
      container.innerHTML = events.slice(0, 3).map((e) => `
            <div class="widget-event-item p-2 mb-1 d-flex justify-content-between align-items-center">
                <div>
                    <div class="small fw-bold text-light">${e.title}</div>
                    <div class="text-muted" style="font-size:0.75rem;"><i class="bi bi-clock me-1"></i>${e.start_time}</div>
                </div>
                <span class="badge bg-primary" style="font-size:0.68rem;">Event</span>
            </div>
        `).join("");
    }
  };

  // src/ts/shortcutManager.ts
  var ShortcutManager = class {
    constructor(callbacks) {
      this.shortcuts = {
        mic: "Ctrl+M",
        quickActions: "Ctrl+K",
        dashboard: "Ctrl+W",
        mute: "Escape",
        history: "Ctrl+H",
        settings: "Ctrl+,",
        upload: "Ctrl+U"
      };
      this.callbacks = callbacks;
      this.loadShortcuts();
      this.bindGlobalKeyboardEvents();
      this.bindSettingsForm();
    }
    loadShortcuts() {
      try {
        const saved = localStorage.getItem("sophia_shortcuts");
        if (saved) {
          const parsed = JSON.parse(saved);
          this.shortcuts = { ...this.shortcuts, ...parsed };
        }
      } catch (e) {
        console.warn("ShortcutManager load error:", e);
      }
    }
    saveShortcuts(newShortcuts) {
      this.shortcuts = { ...this.shortcuts, ...newShortcuts };
      try {
        localStorage.setItem("sophia_shortcuts", JSON.stringify(this.shortcuts));
        if (window.eel && window.eel.saveUIPreferences) {
          window.eel.saveUIPreferences(
            void 0,
            void 0,
            void 0,
            void 0,
            void 0
          );
        }
      } catch (e) {
      }
    }
    getShortcuts() {
      return { ...this.shortcuts };
    }
    bindGlobalKeyboardEvents() {
      document.addEventListener("keydown", (e) => {
        const activeEl = document.activeElement;
        const activeTag = (activeEl?.tagName || "").toLowerCase();
        const isInputActive = activeTag === "input" || activeTag === "textarea" || activeEl?.isContentEditable;
        if (e.key === "Escape" || e.ctrlKey && e.code === "Space") {
          this.callbacks.onMuteSpeech();
          return;
        }
        if (e.ctrlKey && e.shiftKey && (e.key === "a" || e.key === "A") || e.altKey && (e.key === "a" || e.key === "A")) {
          e.preventDefault();
          this.callbacks.onFocusAssistant();
          this.callbacks.onAnnounce("Focused assistant input field.");
          return;
        }
        if (e.ctrlKey && (e.key === "k" || e.key === "K" || e.key === "/")) {
          e.preventDefault();
          this.callbacks.onOpenQuickActions();
          this.callbacks.onAnnounce("Quick actions menu opened.");
          return;
        }
        if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
          e.preventDefault();
          this.callbacks.onToggleMic();
          this.callbacks.onAnnounce("Microphone toggled via shortcut.");
          return;
        }
        if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
          e.preventDefault();
          this.callbacks.onToggleDashboard();
          this.callbacks.onAnnounce("Dashboard widgets toggled.");
          return;
        }
        if (e.ctrlKey && (e.key === "h" || e.key === "H")) {
          e.preventDefault();
          this.callbacks.onToggleHistory();
          this.callbacks.onAnnounce("Task history toggled.");
          return;
        }
        if (e.ctrlKey && e.key === ",") {
          e.preventDefault();
          this.callbacks.onOpenSettings();
          this.callbacks.onAnnounce("Settings panel toggled.");
          return;
        }
        if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
          e.preventDefault();
          if (this.callbacks.onOpenLogs) {
            this.callbacks.onOpenLogs();
            this.callbacks.onAnnounce("System logs and diagnostics opened.");
          }
          return;
        }
        if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
          e.preventDefault();
          this.callbacks.onOpenUpload();
          this.callbacks.onAnnounce("Upload picker opened.");
          return;
        }
        if (e.key === "/" && !isInputActive) {
          e.preventDefault();
          this.callbacks.onFocusAssistant();
        }
      });
    }
    bindSettingsForm() {
    }
  };

  // src/ts/quickActions.ts
  var QuickActionsManager = class {
    constructor(onExecuteCommand) {
      this.items = [];
      this.activeIndex = 0;
      this.onExecuteCommand = onExecuteCommand;
      this.modalElement = document.getElementById("quickActionsModal");
      this.searchInput = document.getElementById("quickActionSearch");
      this.listContainer = document.getElementById("quickActionsList");
      this.initDefaultActions();
      this.bindEvents();
    }
    initDefaultActions() {
      this.items = [
        // General Controls
        {
          id: "toggle_mic",
          title: "Toggle Voice Microphone",
          category: "General",
          icon: "bi-mic-fill",
          shortcut: "Ctrl+M",
          action: () => document.getElementById("MicBtn")?.click()
        },
        {
          id: "dashboard",
          title: "Open Dashboard Widgets Drawer",
          category: "General",
          icon: "bi-grid-fill",
          shortcut: "Ctrl+W",
          action: () => document.getElementById("WidgetsBtn")?.click()
        },
        {
          id: "history",
          title: "View Task & Command History",
          category: "General",
          icon: "bi-clock-history",
          shortcut: "Ctrl+H",
          action: () => document.getElementById("ChatBtn")?.click()
        },
        {
          id: "mute",
          title: "Mute Speech Playback",
          category: "General",
          icon: "bi-volume-mute-fill",
          shortcut: "Esc",
          action: () => {
            if (window.assistantApp && window.assistantApp.cancelAllAndDismiss) {
              window.assistantApp.cancelAllAndDismiss();
            }
          }
        },
        {
          id: "settings",
          title: "Voice & UI Customization Settings",
          category: "General",
          icon: "bi-gear-fill",
          shortcut: "Ctrl+,",
          action: () => document.getElementById("SettingsBtn")?.click()
        },
        // Safe Automation Workflows
        {
          id: "wf_briefing",
          title: "Run Daily Morning Briefing",
          category: "Automation",
          icon: "bi-brightness-high-fill",
          action: () => this.onExecuteCommand("daily briefing")
        },
        {
          id: "wf_work",
          title: "Activate Focused Work Mode",
          category: "Automation",
          icon: "bi-briefcase-fill",
          action: () => this.onExecuteCommand("work mode")
        },
        {
          id: "wf_study",
          title: "Start Interactive Study Session",
          category: "Automation",
          icon: "bi-mortarboard-fill",
          action: () => this.onExecuteCommand("study session")
        },
        {
          id: "wf_health",
          title: "Run System Health Diagnostics",
          category: "Automation",
          icon: "bi-heart-pulse-fill",
          action: () => this.onExecuteCommand("system health check")
        },
        {
          id: "wf_wrap",
          title: "Wrap Up Session & Clean Slate (Confirmation)",
          category: "Automation",
          icon: "bi-moon-stars-fill",
          action: () => this.onExecuteCommand("wrap up session")
        },
        // Academic Specialists
        {
          id: "acad_feynman",
          title: "Feynman Concept Explainer (ELI5)",
          category: "Academic",
          icon: "bi-lightbulb-fill",
          action: () => this.onExecuteCommand("explain simply quantum entanglement")
        },
        {
          id: "acad_paper",
          title: "Academic Research Paper Summarizer",
          category: "Academic",
          icon: "bi-file-earmark-medical-fill",
          action: () => this.onExecuteCommand("summarize paper on deep learning")
        },
        {
          id: "acad_citation",
          title: "Format Academic Citation (APA / IEEE / MLA)",
          category: "Academic",
          icon: "bi-quote",
          action: () => this.onExecuteCommand("cite this in APA style")
        },
        {
          id: "acad_quiz",
          title: "Active Recall Revision Quiz",
          category: "Academic",
          icon: "bi-patch-question-fill",
          action: () => this.onExecuteCommand("quiz me on general science")
        },
        {
          id: "acad_math",
          title: "Step-by-Step Math & Equation Solver",
          category: "Academic",
          icon: "bi-calculator-fill",
          action: () => this.onExecuteCommand("solve math 3x^2 - 12x + 9 = 0")
        },
        {
          id: "acad_pomodoro",
          title: "Start 25-Min Pomodoro Study Session",
          category: "Academic",
          icon: "bi-hourglass-split",
          action: () => this.onExecuteCommand("start pomodoro")
        },
        // Workplace & Professional
        {
          id: "work_email",
          title: "Draft Executive Workplace Email",
          category: "Workplace",
          icon: "bi-envelope-paper-fill",
          action: () => this.onExecuteCommand("draft email requesting project update")
        },
        {
          id: "work_meeting",
          title: "Meeting Minutes & Action Items",
          category: "Workplace",
          icon: "bi-journal-check",
          action: () => this.onExecuteCommand("meeting minutes from sprint planning")
        },
        {
          id: "work_standup",
          title: "Generate Agile Daily Standup Report",
          category: "Workplace",
          icon: "bi-person-badge-fill",
          action: () => this.onExecuteCommand("daily standup report")
        },
        {
          id: "work_code",
          title: "Technical Code Review & Bug Explainer",
          category: "Workplace",
          icon: "bi-code-slash",
          action: () => this.onExecuteCommand("debug code and explain fix")
        },
        {
          id: "work_wbs",
          title: "Project Breakdown & Agile Milestones",
          category: "Workplace",
          icon: "bi-diagram-3-fill",
          action: () => this.onExecuteCommand("project breakdown for cloud migration")
        },
        // Personal & Daily Life
        {
          id: "pers_expense_log",
          title: "Log Expense to Personal Budget",
          category: "Personal",
          icon: "bi-credit-card-2-front-fill",
          action: () => this.onExecuteCommand("log expense 250 for lunch")
        },
        {
          id: "pers_expense_show",
          title: "View Recent Expenses & Total",
          category: "Personal",
          icon: "bi-wallet2",
          action: () => this.onExecuteCommand("show expenses")
        },
        {
          id: "pers_routine",
          title: "Plan Balanced Daily Routine",
          category: "Personal",
          icon: "bi-sun-fill",
          action: () => this.onExecuteCommand("plan my day for high focus")
        },
        {
          id: "pers_wellness",
          title: "Wellness, Hydration & Posture Break",
          category: "Personal",
          icon: "bi-droplet-fill",
          action: () => this.onExecuteCommand("water reminder")
        },
        // System Information
        {
          id: "sys_info",
          title: "Check Full System Hardware Specs",
          category: "System",
          icon: "bi-display",
          action: () => this.onExecuteCommand("system info")
        },
        {
          id: "sys_cpu",
          title: "Check CPU Utilization",
          category: "System",
          icon: "bi-cpu-fill",
          action: () => this.onExecuteCommand("cpu usage")
        },
        {
          id: "sys_ram",
          title: "Check Memory (RAM) Free & Load",
          category: "System",
          icon: "bi-memory",
          action: () => this.onExecuteCommand("ram usage")
        },
        {
          id: "sys_disk",
          title: "Check Disk Space on Primary Drive",
          category: "System",
          icon: "bi-hdd-fill",
          action: () => this.onExecuteCommand("disk usage")
        },
        {
          id: "sys_net",
          title: "Test Network Connection & Latency",
          category: "System",
          icon: "bi-wifi",
          action: () => this.onExecuteCommand("network status")
        },
        {
          id: "audit_logs",
          title: "View Security Action Audit Logs",
          category: "System",
          icon: "bi-shield-check",
          action: () => this.onExecuteCommand("show audit logs")
        },
        // Allowlisted Desktop Applications
        {
          id: "app_calc",
          title: "Launch Calculator",
          category: "Apps",
          icon: "bi-calculator",
          action: () => this.onExecuteCommand("open calculator")
        },
        {
          id: "app_notepad",
          title: "Launch Notepad Text Editor",
          category: "Apps",
          icon: "bi-file-earmark-text",
          action: () => this.onExecuteCommand("open notepad")
        },
        {
          id: "app_paint",
          title: "Launch Paint",
          category: "Apps",
          icon: "bi-palette-fill",
          action: () => this.onExecuteCommand("open paint")
        },
        {
          id: "app_explorer",
          title: "Launch File Explorer",
          category: "Apps",
          icon: "bi-folder-fill",
          action: () => this.onExecuteCommand("open explorer")
        },
        {
          id: "app_settings",
          title: "Launch Windows Settings",
          category: "Apps",
          icon: "bi-sliders",
          action: () => this.onExecuteCommand("open settings")
        },
        // Approved Websites
        {
          id: "web_github",
          title: "Open GitHub (Approved)",
          category: "Websites",
          icon: "bi-github",
          action: () => this.onExecuteCommand("open github")
        },
        {
          id: "web_google",
          title: "Open Google (Approved)",
          category: "Websites",
          icon: "bi-google",
          action: () => this.onExecuteCommand("open google")
        },
        {
          id: "web_youtube",
          title: "Open YouTube (Approved)",
          category: "Websites",
          icon: "bi-youtube",
          action: () => this.onExecuteCommand("open youtube")
        },
        {
          id: "web_chatgpt",
          title: "Open ChatGPT (Approved)",
          category: "Websites",
          icon: "bi-chat-dots-fill",
          action: () => this.onExecuteCommand("open chatgpt")
        }
      ];
    }
    bindEvents() {
      const quickBtn = document.getElementById("QuickActionsBtn");
      if (quickBtn) {
        quickBtn.addEventListener("click", () => this.open());
      }
      if (this.searchInput) {
        this.searchInput.addEventListener("input", () => {
          this.renderFilteredList(this.searchInput?.value.trim().toLowerCase() || "");
        });
        this.searchInput.addEventListener("keydown", (e) => {
          const rendered = this.listContainer?.querySelectorAll(".quick-action-item");
          if (!rendered || rendered.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            this.activeIndex = (this.activeIndex + 1) % rendered.length;
            this.highlightActiveItem(rendered);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            this.activeIndex = (this.activeIndex - 1 + rendered.length) % rendered.length;
            this.highlightActiveItem(rendered);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const activeItem = rendered[this.activeIndex];
            if (activeItem) {
              activeItem.click();
            }
          }
        });
      }
    }
    open() {
      this.renderFilteredList("");
      if (this.modalElement && window.bootstrap) {
        const inst = window.bootstrap.Modal.getOrCreateInstance(this.modalElement);
        inst.show();
        setTimeout(() => {
          this.searchInput?.focus();
        }, 300);
      }
    }
    close() {
      if (this.modalElement && window.bootstrap) {
        const inst = window.bootstrap.Modal.getOrCreateInstance(this.modalElement);
        inst.hide();
      }
    }
    renderFilteredList(query) {
      if (!this.listContainer) return;
      this.listContainer.innerHTML = "";
      const filtered = query ? this.items.filter((it) => it.title.toLowerCase().includes(query) || it.category.toLowerCase().includes(query)) : this.items;
      if (filtered.length === 0) {
        this.listContainer.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-search fs-3 d-block mb-2"></i>
                    No quick actions match "<strong>${escapeHtml(query)}</strong>"
                </div>
            `;
        return;
      }
      this.activeIndex = 0;
      filtered.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = `quick-action-item d-flex align-items-center justify-content-between p-2 px-3 rounded mb-1 ${idx === 0 ? "active" : ""}`;
        row.setAttribute("data-index", idx.toString());
        row.innerHTML = `
                <div class="d-flex align-items-center gap-3">
                    <span class="quick-action-icon rounded-circle d-flex align-items-center justify-content-center">
                        <i class="bi ${item.icon}"></i>
                    </span>
                    <div>
                        <div class="quick-action-title fw-semibold">${escapeHtml(item.title)}</div>
                        <small class="text-muted">${escapeHtml(item.category)}</small>
                    </div>
                </div>
                ${item.shortcut ? `<span class="badge bg-secondary opacity-75 font-monospace">${item.shortcut}</span>` : ""}
            `;
        row.addEventListener("click", () => {
          this.close();
          setTimeout(() => item.action(), 150);
        });
        this.listContainer?.appendChild(row);
      });
    }
    highlightActiveItem(elements) {
      elements.forEach((el, idx) => {
        if (idx === this.activeIndex) {
          el.classList.add("active");
          el.scrollIntoView({ block: "nearest" });
        } else {
          el.classList.remove("active");
        }
      });
    }
  };
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // src/ts/conversationManager.ts
  function detectClientLanguage(text) {
    if (!text || !text.trim()) return { mode: "english", label: "English" };
    if (/[\u0900-\u097F]/.test(text)) {
      return { mode: "hindi_devanagari", label: "\u0939\u093F\u0902\u0926\u0940 (\u0926\u0947\u0935\u0928\u093E\u0917\u0930\u0940)" };
    }
    const lower = text.toLowerCase();
    const hinglishMarkers = [
      "kya",
      "hai",
      "hain",
      "kaise",
      "kaisa",
      "kaisi",
      "karo",
      "karna",
      "kariye",
      "batao",
      "bataiye",
      "mujhe",
      "mera",
      "meri",
      "mere",
      "aaj",
      "kal",
      "namaste",
      "shukriya",
      "dhanyawad",
      "dhanyavad",
      "haan",
      "nahin",
      "nahi",
      "theek",
      "thik",
      "accha",
      "achha",
      "achhi",
      "chalo",
      "kholo",
      "bajao",
      "laga",
      "do",
      "sunao",
      "sunaiye",
      "aap",
      "aapka",
      "aapki",
      "aapke",
      "tum",
      "tumhara",
      "tumhari",
      "hum",
      "hoga",
      "hogi",
      "honge",
      "raha",
      "rahi",
      "rahe",
      "kuch",
      "kuchh",
      "bahut",
      "zara",
      "thoda",
      "ruk",
      "ruko",
      "bolo",
      "baat",
      "sab",
      "sabko",
      "kaam",
      "samay",
      "waqt",
      "din",
      "raat",
      "subah",
      "shaam",
      "dost",
      "main",
      "mai",
      "hoon",
      "hun",
      "bhi",
      "kyun",
      "kyu",
      "kaun",
      "kab",
      "kahan",
      "aur"
    ];
    const tokens = lower.match(/[a-zA-Z]+/g) || [];
    const matches = tokens.filter((t) => hinglishMarkers.includes(t));
    if (tokens.length <= 3 && matches.length >= 1 || matches.length >= 2 || tokens.length > 0 && matches.length / tokens.length >= 0.25) {
      return { mode: "hinglish", label: "Hinglish (\u0939\u093F\u0902\u0926\u0940)" };
    }
    return { mode: "english", label: "English" };
  }
  var ConversationManager = class {
    constructor(onRerun) {
      this.container = null;
      this.messages = [];
      this.isThinking = false;
      this.filterMode = "all";
      this.onRerunCommand = onRerun;
      this.container = document.getElementById("conversationFeedList");
      this.bindEvents();
      this.loadInitialHistory();
    }
    bindEvents() {
      const btnClearFeed = document.getElementById("btnClearFeed");
      if (btnClearFeed) {
        btnClearFeed.addEventListener("click", () => this.clearFeed());
      }
      const btnToggleView = document.getElementById("btnToggleFeedView");
      if (btnToggleView) {
        btnToggleView.addEventListener("click", () => this.toggleFeedVisibility());
      }
      const filterTabs = document.querySelectorAll(".feed-filter-btn");
      filterTabs.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          filterTabs.forEach((b) => b.classList.remove("active"));
          target.classList.add("active");
          const filter = target.getAttribute("data-filter");
          this.setFilter(filter || "all");
        });
      });
    }
    loadInitialHistory() {
      if (!window.eel || !window.eel.getCommandHistory) return;
      window.eel.getCommandHistory(10)((history) => {
        if (history && history.length > 0) {
          const items = [...history].reverse();
          items.forEach((h) => {
            this.addUserMessage(h.command, h.source || "chat", h.timestamp, false);
            if (h.response) {
              this.addAssistantMessage(h.response, "info", {}, "SUCCESS", false);
            }
          });
          this.render();
        }
      });
    }
    addUserMessage(text, source = "chat", timestamp, autoRender = true, langMode) {
      this.removeThinkingIndicator();
      const mode = langMode || detectClientLanguage(text).mode;
      const msg = {
        id: "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        sender: "user",
        text,
        source,
        timestamp: timestamp || this.getCurrentTime(),
        status: "SUCCESS",
        langMode: mode
      };
      this.messages.push(msg);
      this.showThinkingIndicator();
      if (autoRender) this.render();
    }
    addAssistantMessage(text, cardType = "none", cardData = {}, status = "SUCCESS", autoRender = true, langMode) {
      this.removeThinkingIndicator();
      const mode = langMode || detectClientLanguage(text).mode;
      const msg = {
        id: "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        sender: "assistant",
        text,
        timestamp: this.getCurrentTime(),
        status,
        cardType,
        cardData,
        langMode: mode
      };
      this.messages.push(msg);
      if (autoRender) this.render();
    }
    showThinkingIndicator() {
      this.isThinking = true;
      this.updateThinkingDOM();
    }
    removeThinkingIndicator() {
      this.isThinking = false;
      this.updateThinkingDOM();
    }
    updateThinkingDOM() {
      const thinkingEl = document.getElementById("feedThinkingIndicator");
      if (!thinkingEl) return;
      thinkingEl.style.display = this.isThinking ? "flex" : "none";
      if (this.isThinking) {
        this.scrollToBottom();
      }
    }
    setFilter(mode) {
      this.filterMode = mode;
      this.render();
    }
    clearFeed() {
      this.messages = [];
      this.isThinking = false;
      this.render();
    }
    toggleFeedVisibility() {
      const feedWrapper = document.getElementById("conversationStreamWrapper");
      const ovalSection = document.getElementById("Oval");
      if (!feedWrapper) return;
      const isCollapsed = feedWrapper.classList.contains("feed-collapsed");
      if (isCollapsed) {
        feedWrapper.classList.remove("feed-collapsed");
        ovalSection?.classList.add("with-feed-expanded");
      } else {
        feedWrapper.classList.add("feed-collapsed");
        ovalSection?.classList.remove("with-feed-expanded");
      }
    }
    render() {
      if (!this.container) {
        this.container = document.getElementById("conversationFeedList");
      }
      if (!this.container) return;
      let filtered = this.messages;
      if (this.filterMode === "voice") {
        filtered = this.messages.filter((m) => m.source === "voice" || m.sender === "assistant" && this.isReplyToVoice(m));
      } else if (this.filterMode === "chat") {
        filtered = this.messages.filter((m) => m.source === "chat" || m.sender === "assistant" && !this.isReplyToVoice(m));
      } else if (this.filterMode === "actions") {
        filtered = this.messages.filter((m) => m.cardType && m.cardType !== "none" && m.cardType !== "chat_response");
      }
      if (filtered.length === 0) {
        this.container.innerHTML = `
                <div class="feed-empty-state">
                    <i class="bi bi-chat-square-dots d-block mb-2" style="font-size: 2rem; opacity: 0.35;"></i>
                    <p class="mb-0 text-muted" style="font-size: 0.85rem;">Commands and responses will appear here in real time.</p>
                    <span class="small text-muted opacity-75">Speak via mic or type a query below</span>
                </div>
            `;
        this.updateThinkingDOM();
        return;
      }
      this.container.innerHTML = "";
      filtered.forEach((msg) => {
        const cardEl = msg.sender === "user" ? this.buildUserCard(msg) : this.buildAssistantCard(msg);
        this.container?.appendChild(cardEl);
      });
      this.updateThinkingDOM();
      this.scrollToBottom();
    }
    isReplyToVoice(assistantMsg) {
      const idx = this.messages.indexOf(assistantMsg);
      if (idx > 0 && this.messages[idx - 1].sender === "user") {
        return this.messages[idx - 1].source === "voice";
      }
      return false;
    }
    buildUserCard(msg) {
      const card = document.createElement("div");
      card.className = "feed-bubble-row feed-user-row animate__animated animate__fadeInUp animate__faster";
      const isVoice = msg.source === "voice";
      let langBadge = "";
      if (msg.langMode === "hindi_devanagari") {
        langBadge = `<span class="feed-lang-badge lang-hi-deva"><i class="bi bi-translate me-1"></i>\u0939\u093F\u0902\u0926\u0940 (\u0926\u0947\u0935\u0928\u093E\u0917\u0930\u0940)</span>`;
      } else if (msg.langMode === "hinglish") {
        langBadge = `<span class="feed-lang-badge lang-hinglish"><i class="bi bi-translate me-1"></i>Hinglish (\u0939\u093F\u0902\u0926\u0940)</span>`;
      } else {
        langBadge = `<span class="feed-lang-badge lang-en"><i class="bi bi-translate me-1"></i>English</span>`;
      }
      card.innerHTML = `
            <div class="feed-bubble feed-user-bubble">
                <div class="feed-bubble-header">
                    <div class="d-flex align-items-center gap-1 flex-wrap">
                        <span class="feed-badge ${isVoice ? "badge-voice" : "badge-chat"}">
                            <i class="bi ${isVoice ? "bi-mic-fill" : "bi-keyboard"} me-1"></i>${isVoice ? "Voice" : "Text"}
                        </span>
                        ${langBadge}
                    </div>
                    <span class="feed-time">${msg.timestamp}</span>
                </div>
                <div class="feed-text">${this.escapeHtml(msg.text)}</div>
            </div>
            <div class="feed-avatar feed-user-avatar" title="You">
                <i class="bi bi-person-fill"></i>
            </div>
        `;
      return card;
    }
    buildAssistantCard(msg) {
      const card = document.createElement("div");
      card.className = "feed-bubble-row feed-assistant-row animate__animated animate__fadeInUp animate__faster";
      let statusBadge = "";
      if (msg.status === "ERROR") {
        statusBadge = `<span class="feed-status-badge badge-error"><i class="bi bi-exclamation-triangle-fill me-1"></i>Error</span>`;
      } else if (msg.status === "ACTION") {
        statusBadge = `<span class="feed-status-badge badge-action"><i class="bi bi-lightning-charge-fill me-1"></i>Action Executed</span>`;
      } else {
        statusBadge = `<span class="feed-status-badge badge-success"><i class="bi bi-check-circle-fill me-1"></i>Answered</span>`;
      }
      let langBadge = "";
      if (msg.langMode === "hindi_devanagari") {
        langBadge = `<span class="feed-lang-badge lang-hi-deva"><i class="bi bi-patch-check-fill me-1"></i>\u0939\u093F\u0902\u0926\u0940 \u0909\u0924\u094D\u0924\u0930</span>`;
      } else if (msg.langMode === "hinglish") {
        langBadge = `<span class="feed-lang-badge lang-hinglish"><i class="bi bi-patch-check-fill me-1"></i>Hinglish Response</span>`;
      } else {
        langBadge = `<span class="feed-lang-badge lang-en"><i class="bi bi-patch-check-fill me-1"></i>English Response</span>`;
      }
      const richCardHtml = this.renderRichCard(msg.cardType, msg.cardData);
      card.innerHTML = `
            <div class="feed-avatar feed-assistant-avatar" title="Assistant">
                <i class="bi bi-cpu-fill"></i>
            </div>
            <div class="feed-bubble feed-assistant-bubble">
                <div class="feed-bubble-header">
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <span class="assistant-name fw-bold" style="font-size: 0.8rem; color: var(--accent-color, #00d4ff);">Dracarys</span>
                        ${statusBadge}
                        ${langBadge}
                    </div>
                    <span class="feed-time">${msg.timestamp}</span>
                </div>
                <div class="feed-text">${this.formatAssistantText(msg.text)}</div>
                ${richCardHtml}
                <div class="feed-bubble-actions">
                    <button class="btn-feed-action btn-replay-speech" title="Listen to response">
                        <i class="bi bi-volume-up me-1"></i>Listen
                    </button>
                    <button class="btn-feed-action btn-copy-text" title="Copy response to clipboard">
                        <i class="bi bi-clipboard me-1"></i>Copy
                    </button>
                </div>
            </div>
        `;
      card.querySelector(".btn-replay-speech")?.addEventListener("click", () => {
        if (window.eel && window.eel.testVoice) {
          const voice = msg.langMode === "hindi_devanagari" || msg.langMode === "hinglish" ? "hi-IN-SwaraNeural" : "en-IN-NeerjaNeural";
          const langType = msg.langMode === "hindi_devanagari" || msg.langMode === "hinglish" ? "hindi" : "english";
          window.eel.testVoice(voice, langType);
        }
      });
      card.querySelector(".btn-copy-text")?.addEventListener("click", (e) => {
        navigator.clipboard.writeText(msg.text).then(() => {
          const btn = e.currentTarget;
          btn.innerHTML = `<i class="bi bi-check me-1"></i>Copied!`;
          setTimeout(() => {
            btn.innerHTML = `<i class="bi bi-clipboard me-1"></i>Copy`;
          }, 1800);
        });
      });
      return card;
    }
    renderRichCard(cardType, data) {
      if (!cardType || cardType === "none" || !data) return "";
      if (cardType === "weather" && data.temp_c !== void 0) {
        const forecastPills = (data.forecast || []).map((f) => `<span class="badge bg-dark text-info p-1 px-2 border border-secondary border-opacity-25">${this.escapeHtml(f)}</span>`).join(" ");
        return `
                <div class="feed-rich-card card-weather mt-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="card-location"><i class="bi bi-geo-alt me-1 text-danger"></i>${this.escapeHtml(data.location || "Local Area")}</div>
                            <div class="card-condition text-muted small">${this.escapeHtml(data.condition || "Clear")}</div>
                        </div>
                        <div class="card-temp fw-bold text-info" style="font-size: 1.8rem;">${data.temp_c}\xB0C</div>
                    </div>
                    <div class="card-meta d-flex gap-3 text-muted small mt-2 pt-2 border-top border-secondary border-opacity-25">
                        <span><i class="bi bi-droplet me-1"></i>Humidity: ${data.humidity}%</span>
                        <span><i class="bi bi-wind me-1"></i>Wind: ${data.wind_kmph} km/h</span>
                        <span><i class="bi bi-thermometer-half me-1"></i>Feels like: ${data.feels_like}\xB0C</span>
                    </div>
                    ${forecastPills ? `<div class="d-flex flex-wrap gap-1 mt-2">${forecastPills}</div>` : ""}
                </div>
            `;
      }
      if (cardType === "system_info" && data.cpu) {
        return `
                <div class="feed-rich-card card-system mt-2">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold small text-info"><i class="bi bi-cpu me-1"></i>System Performance Status</span>
                        <span class="badge bg-success small">${data.network?.status || "Online"}</span>
                    </div>
                    <div class="row g-2 text-center">
                        <div class="col-4">
                            <div class="stat-box p-2 rounded bg-dark border border-secondary border-opacity-25">
                                <div class="small text-muted">CPU Load</div>
                                <div class="fw-bold text-info fs-6">${data.cpu.usage_percent}%</div>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="stat-box p-2 rounded bg-dark border border-secondary border-opacity-25">
                                <div class="small text-muted">RAM Used</div>
                                <div class="fw-bold text-warning fs-6">${data.memory.usage_percent}%</div>
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="stat-box p-2 rounded bg-dark border border-secondary border-opacity-25">
                                <div class="small text-muted">Battery</div>
                                <div class="fw-bold text-success fs-6">${data.battery.percent}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
      }
      if (cardType === "action_result") {
        return `
                <div class="feed-rich-card card-action mt-2 p-2 px-3 rounded bg-dark border border-info border-opacity-25">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="small text-light"><i class="bi bi-check2-circle text-info me-2"></i>Action: <strong>${this.escapeHtml(data.action || "Execute")}</strong></span>
                        <span class="badge bg-primary small">${this.escapeHtml(data.status || "SUCCESS")}</span>
                    </div>
                </div>
            `;
      }
      if (cardType === "document_summary") {
        return `
                <div class="feed-rich-card card-document mt-2 p-3 rounded bg-dark border border-secondary border-opacity-50">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <i class="bi bi-file-earmark-text text-info fs-5"></i>
                        <span class="fw-bold text-light">${this.escapeHtml(data.filename || "Document")}</span>
                    </div>
                    <div class="text-muted small">${this.escapeHtml((data.summary_text || "").substring(0, 180))}...</div>
                </div>
            `;
      }
      if (cardType === "error") {
        return `
                <div class="feed-rich-card card-error mt-2 p-2 px-3 rounded bg-danger bg-opacity-10 border border-danger border-opacity-50 text-danger small">
                    <i class="bi bi-bug me-1"></i>${this.escapeHtml(data.error || "Execution glitch detected.")}
                </div>
            `;
      }
      if (data.domain === "academic" || cardType.startsWith("academic_")) {
        const topic = data.topic || data.style || data.expression || (cardType === "academic_pomodoro" ? "Study Session" : "Academic Task");
        const domainIcon = cardType === "academic_pomodoro" ? "bi-hourglass-split" : cardType === "academic_math" ? "bi-calculator-fill" : "bi-mortarboard-fill";
        return `
                <div class="feed-rich-card card-domain-academic mt-2 p-2 px-3 rounded bg-dark border border-info border-opacity-30">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-info bg-opacity-25 text-info font-monospace small"><i class="bi ${domainIcon} me-1"></i>Academic</span>
                        <span class="text-muted small">${this.escapeHtml(topic)}</span>
                    </div>
                    ${data.duration ? `<div class="small text-info fw-bold"><i class="bi bi-clock me-1"></i>${data.duration} Minutes Focus Interval</div>` : ""}
                </div>
            `;
      }
      if (data.domain === "workplace" || cardType.startsWith("workplace_")) {
        const domainIcon = cardType === "workplace_email" ? "bi-envelope-paper-fill" : cardType === "workplace_code" ? "bi-code-slash" : "bi-briefcase-fill";
        return `
                <div class="feed-rich-card card-domain-workplace mt-2 p-2 px-3 rounded bg-dark border border-warning border-opacity-30">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-warning bg-opacity-25 text-warning font-monospace small"><i class="bi ${domainIcon} me-1"></i>Workplace</span>
                        <span class="text-muted small font-monospace">Ready</span>
                    </div>
                </div>
            `;
      }
      if (data.domain === "personal" || cardType.startsWith("personal_")) {
        const domainIcon = cardType === "personal_expense" ? "bi-wallet2" : cardType === "personal_wellness" ? "bi-droplet-fill" : "bi-house-heart-fill";
        const totalText = data.total ? `Total: \u20B9${data.total.toFixed(2)}` : data.amount ? `\u20B9${data.amount.toFixed(2)} (${data.category})` : "Active";
        return `
                <div class="feed-rich-card card-domain-personal mt-2 p-2 px-3 rounded bg-dark border border-success border-opacity-30">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-success bg-opacity-25 text-success font-monospace small"><i class="bi ${domainIcon} me-1"></i>Personal</span>
                        <span class="text-success small fw-bold font-monospace">${this.escapeHtml(totalText)}</span>
                    </div>
                </div>
            `;
      }
      return "";
    }
    formatAssistantText(text) {
      if (!text) return "";
      let formatted = this.escapeHtml(text);
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      formatted = formatted.replace(/\n• (.*?)/g, "<br>&bull; $1");
      formatted = formatted.replace(/\n- (.*?)/g, "<br>&bull; $1");
      formatted = formatted.replace(/\n/g, "<br>");
      return formatted;
    }
    scrollToBottom() {
      if (this.container) {
        this.container.scrollTop = this.container.scrollHeight;
      }
    }
    getCurrentTime() {
      const now = /* @__PURE__ */ new Date();
      return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    escapeHtml(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
  };

  // src/ts/logsManager.ts
  var LogsManager = class {
    constructor() {
      this.isAutoRefresh = true;
      this.refreshInterval = null;
      this.currentLevelFilter = "ALL";
      this.searchQuery = "";
      this.logsCache = [];
      this.bindEvents();
    }
    bindEvents() {
      const btnLogs = document.getElementById("LogsBtn");
      if (btnLogs) {
        btnLogs.addEventListener("click", () => this.open());
      }
      const btnRefreshLogs = document.getElementById("btnRefreshLogs");
      if (btnRefreshLogs) {
        btnRefreshLogs.addEventListener("click", () => this.fetchLogs());
      }
      const btnClearLogs = document.getElementById("btnClearLogs");
      if (btnClearLogs) {
        btnClearLogs.addEventListener("click", () => this.clearLogs());
      }
      const btnRunDiagnostics = document.getElementById("btnRunDiagnostics");
      if (btnRunDiagnostics) {
        btnRunDiagnostics.addEventListener("click", () => this.runDiagnostics());
      }
      const logFilterBtns = document.querySelectorAll(".log-level-filter-btn");
      logFilterBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const target = e.currentTarget;
          logFilterBtns.forEach((b) => b.classList.remove("active"));
          target.classList.add("active");
          this.currentLevelFilter = target.getAttribute("data-level") || "ALL";
          this.renderLogs();
        });
      });
      const searchInput = document.getElementById("logSearchInput");
      if (searchInput) {
        searchInput.addEventListener("input", () => {
          this.searchQuery = searchInput.value.toLowerCase().trim();
          this.renderLogs();
        });
      }
      const logsOffcanvas = document.getElementById("logsOffcanvas");
      if (logsOffcanvas) {
        logsOffcanvas.addEventListener("show.bs.offcanvas", () => {
          this.fetchLogs();
          this.runDiagnostics();
          if (this.isAutoRefresh && !this.refreshInterval) {
            this.refreshInterval = setInterval(() => this.fetchLogs(), 3e3);
          }
        });
        logsOffcanvas.addEventListener("hide.bs.offcanvas", () => {
          if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
          }
        });
      }
    }
    open() {
      const el = document.getElementById("logsOffcanvas");
      if (el && window.bootstrap) {
        const inst = window.bootstrap.Offcanvas.getOrCreateInstance(el);
        inst.show();
      }
    }
    fetchLogs() {
      if (!window.eel || !window.eel.getLiveLogs) return;
      window.eel.getLiveLogs(100, "ALL")((logs) => {
        this.logsCache = logs || [];
        this.renderLogs();
      });
    }
    clearLogs() {
      if (!window.eel || !window.eel.clearLiveLogs) return;
      window.eel.clearLiveLogs()(() => {
        this.logsCache = [];
        this.renderLogs();
      });
    }
    runDiagnostics() {
      const statusEl = document.getElementById("diagOverallBadge");
      if (statusEl) {
        statusEl.textContent = "Testing...";
        statusEl.className = "badge bg-warning text-dark";
      }
      if (!window.eel || !window.eel.getDiagnosticHealth) return;
      window.eel.getDiagnosticHealth()((report) => {
        this.renderHealthReport(report);
      });
    }
    renderHealthReport(report) {
      const overallBadge = document.getElementById("diagOverallBadge");
      if (overallBadge) {
        overallBadge.textContent = report.status || "HEALTHY";
        overallBadge.className = `badge ${report.status === "HEALTHY" ? "bg-success" : report.status === "ATTENTION" ? "bg-warning text-dark" : "bg-danger"}`;
      }
      const container = document.getElementById("diagSubsystemsList");
      if (!container) return;
      const subs = report.subsystems || {};
      const items = [
        { key: "microphone", label: "Microphone Input", icon: "bi-mic" },
        { key: "speech_output", label: "Neural TTS Audio", icon: "bi-volume-up" },
        { key: "nlp_ai", label: "NLP & AI Model", icon: "bi-cpu" },
        { key: "database", label: "SQLite Database", icon: "bi-database" },
        { key: "network", label: "Network Connectivity", icon: "bi-wifi" }
      ];
      container.innerHTML = items.map((item) => {
        const info = subs[item.key] || { status: "ONLINE", message: "Normal" };
        let badgeClass = "bg-success";
        if (info.status === "WARNING" || info.status === "ATTENTION" || info.status === "FALLBACK") badgeClass = "bg-warning text-dark";
        if (info.status === "ERROR" || info.status === "OFFLINE") badgeClass = "bg-danger";
        return `
                <div class="diag-item d-flex justify-content-between align-items-center p-2 mb-2 rounded bg-dark border border-secondary border-opacity-25">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi ${item.icon} text-info"></i>
                        <div>
                            <div class="small fw-bold text-light">${item.label}</div>
                            <div class="text-muted" style="font-size: 0.72rem;">${this.escapeHtml(info.message)}</div>
                        </div>
                    </div>
                    <span class="badge ${badgeClass} small">${info.status}</span>
                </div>
            `;
      }).join("");
    }
    renderLogs() {
      const container = document.getElementById("liveLogsContainer");
      const countBadge = document.getElementById("logsCountBadge");
      if (!container) return;
      let filtered = this.logsCache;
      if (this.currentLevelFilter !== "ALL") {
        filtered = filtered.filter((l) => l.level === this.currentLevelFilter);
      }
      if (this.searchQuery) {
        filtered = filtered.filter(
          (l) => l.message.toLowerCase().includes(this.searchQuery) || l.logger.toLowerCase().includes(this.searchQuery) || l.details && l.details.toLowerCase().includes(this.searchQuery)
        );
      }
      if (countBadge) countBadge.textContent = filtered.length.toString();
      if (filtered.length === 0) {
        container.innerHTML = `
                <div class="text-center text-muted p-4 small">
                    <i class="bi bi-file-text d-block mb-1 fs-4 opacity-50"></i>
                    No log records match current filter.
                </div>
            `;
        return;
      }
      container.innerHTML = filtered.map((l) => {
        let lvlClass = "log-info";
        if (l.level === "WARNING") lvlClass = "log-warning";
        if (l.level === "ERROR" || l.level === "CRITICAL") lvlClass = "log-error";
        if (l.level === "DEBUG") lvlClass = "log-debug";
        const detailsHtml = l.details ? `<pre class="log-details mt-1 p-1 rounded bg-black text-danger font-monospace small">${this.escapeHtml(l.details)}</pre>` : "";
        return `
                <div class="log-row p-1 px-2 border-bottom border-secondary border-opacity-10 font-monospace small">
                    <span class="text-muted">${l.time || l.timestamp?.substring(11, 19)}</span>
                    <span class="log-badge ${lvlClass} ms-1 me-1">[${l.level}]</span>
                    <span class="text-info">[${this.escapeHtml(l.logger)}]</span>
                    <span class="text-light ms-1">${this.escapeHtml(l.message)}</span>
                    ${detailsHtml}
                </div>
            `;
      }).join("");
      container.scrollTop = container.scrollHeight;
    }
    showErrorToast(title, message, errorType = "general") {
      const container = document.getElementById("errorToastContainer");
      if (!container) return;
      const toastEl = document.createElement("div");
      toastEl.className = "alert alert-danger alert-dismissible fade show shadow-lg border-danger animate__animated animate__shakeX";
      toastEl.style.cssText = "background: rgba(35, 10, 15, 0.95); backdrop-filter: blur(15px); border-radius: 12px; color: #ffb3b8; max-width: 400px; margin-bottom: 10px;";
      toastEl.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-exclamation-octagon-fill fs-5 text-danger"></i>
                <div class="flex-grow-1">
                    <strong class="d-block text-light" style="font-size: 0.9rem;">${this.escapeHtml(title)}</strong>
                    <div style="font-size: 0.8rem; line-height: 1.3;">${this.escapeHtml(message)}</div>
                </div>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
            </div>
        `;
      container.appendChild(toastEl);
      setTimeout(() => {
        try {
          toastEl.classList.remove("show");
          setTimeout(() => toastEl.remove(), 400);
        } catch (e) {
        }
      }, 6e3);
    }
    escapeHtml(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
  };

  // src/ts/domainManager.ts
  var DomainManager = class {
    constructor(onExecuteCommand, onPopulateChatbox) {
      this.currentMode = "academic";
      this.domainChips = {
        academic: [
          {
            id: "feynman",
            label: "Feynman Explainer",
            icon: "bi-lightbulb-fill",
            prompt: "explain simply quantum computing",
            action: "populate",
            description: "Simple real-world analogy and high-yield takeaways"
          },
          {
            id: "paper_sum",
            label: "Paper Summary",
            icon: "bi-file-earmark-medical-fill",
            prompt: "summarize paper on transformer models",
            action: "populate",
            description: "Methodology, findings, and research significance"
          },
          {
            id: "citation",
            label: "Citation Formatter",
            icon: "bi-quote",
            prompt: "cite this in APA style: Attention Is All You Need, Vaswani et al., 2017",
            action: "populate",
            description: "Format in APA 7th, IEEE, or MLA styles"
          },
          {
            id: "quiz",
            label: "Active Recall Quiz",
            icon: "bi-patch-question-fill",
            prompt: "quiz me on machine learning basics",
            action: "populate",
            description: "3-question revision quiz with explanations"
          },
          {
            id: "math",
            label: "Math Solver",
            icon: "bi-calculator-fill",
            prompt: "solve math 2x^2 + 5x - 3 = 0",
            action: "populate",
            description: "Step-by-step mathematical proof and solution"
          },
          {
            id: "pomodoro",
            label: "Pomodoro 25m",
            icon: "bi-hourglass-split",
            prompt: "start pomodoro",
            action: "run",
            description: "25-minute uninterrupted study timer"
          }
        ],
        workplace: [
          {
            id: "email",
            label: "Draft Email",
            icon: "bi-envelope-paper-fill",
            prompt: "draft email requesting project timeline extension",
            action: "populate",
            description: "Executive corporate email with call-to-action"
          },
          {
            id: "meeting",
            label: "Meeting Minutes",
            icon: "bi-journal-check",
            prompt: "meeting minutes from sprint planning: discussed Q3 goals, assigned login page to Alex by Friday",
            action: "populate",
            description: "Action items, owners, and decisions"
          },
          {
            id: "standup",
            label: "Daily Standup",
            icon: "bi-person-badge-fill",
            prompt: "daily standup update for today",
            action: "populate",
            description: "Completed yesterday, deck for today, blockers"
          },
          {
            id: "code_rev",
            label: "Code Review & Debug",
            icon: "bi-code-slash",
            prompt: "debug code: def calc_avg(arr): return sum(arr)/len(arr) if arr else 0",
            action: "populate",
            description: "Production code fixes and explanations"
          },
          {
            id: "wbs",
            label: "Project Roadmap",
            icon: "bi-diagram-3-fill",
            prompt: "project breakdown for customer analytics dashboard",
            action: "populate",
            description: "Agile milestones and phase deliverables"
          }
        ],
        personal: [
          {
            id: "log_exp",
            label: "Log Expense",
            icon: "bi-credit-card-2-front-fill",
            prompt: "log expense 250 for lunch",
            action: "populate",
            description: "Save expense to SQLite budget database"
          },
          {
            id: "show_exp",
            label: "Show Expenses",
            icon: "bi-wallet2",
            prompt: "show expenses",
            action: "run",
            description: "Review recent expenditures and total"
          },
          {
            id: "plan_day",
            label: "Plan My Day",
            icon: "bi-sun-fill",
            prompt: "plan my day for high focus and well-being",
            action: "populate",
            description: "Balanced morning, focus, and wind-down blocks"
          },
          {
            id: "wellness",
            label: "Water & Posture",
            icon: "bi-droplet-fill",
            prompt: "water reminder",
            action: "run",
            description: "Hydration check and 20-20-20 eye rest"
          },
          {
            id: "weather",
            label: "Live Weather",
            icon: "bi-cloud-sun-fill",
            prompt: "weather in Mumbai",
            action: "run",
            description: "Current temperature and forecast"
          }
        ]
      };
      this.onExecuteCommand = onExecuteCommand;
      this.onPopulateChatbox = onPopulateChatbox;
      this.loadSavedMode();
      this.bindTabButtons();
      this.renderChips();
    }
    loadSavedMode() {
      try {
        const saved = localStorage.getItem("sophia_domain_mode");
        if (saved && (saved === "academic" || saved === "workplace" || saved === "personal")) {
          this.currentMode = saved;
        }
      } catch (e) {
        console.warn("Could not load saved domain mode:", e);
      }
    }
    bindTabButtons() {
      const tabs = document.querySelectorAll(".domain-tab-btn");
      tabs.forEach((btn) => {
        btn.addEventListener("click", () => {
          const domain = btn.getAttribute("data-domain");
          if (domain && domain !== this.currentMode) {
            this.setDomainMode(domain);
          }
        });
      });
    }
    setDomainMode(mode) {
      this.currentMode = mode;
      try {
        localStorage.setItem("sophia_domain_mode", mode);
      } catch (e) {
      }
      const tabs = document.querySelectorAll(".domain-tab-btn");
      tabs.forEach((btn) => {
        const domain = btn.getAttribute("data-domain");
        if (domain === mode) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      this.renderChips();
    }
    getDomainMode() {
      return this.currentMode;
    }
    renderChips() {
      const container = document.getElementById("domainChipsContainer");
      if (!container) return;
      container.innerHTML = "";
      const chips = this.domainChips[this.currentMode] || [];
      chips.forEach((chip) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "domain-chip-btn d-inline-flex align-items-center gap-1";
        btn.title = chip.description || chip.label;
        btn.innerHTML = `<i class="bi ${chip.icon} me-1"></i><span>${chip.label}</span>`;
        btn.addEventListener("click", () => {
          if (chip.action === "run") {
            this.onExecuteCommand(chip.prompt);
          } else {
            this.onPopulateChatbox(chip.prompt);
          }
        });
        container.appendChild(btn);
      });
    }
  };

  // src/ts/dragonBackground.ts
  var THEME_PALETTES = {
    cyan: {
      scaleColor: 333870,
      membraneColor: 54527,
      hornColor: 3718648,
      eyeColor: 65535,
      fireColor: 61695,
      lightColor: 54527
    },
    blue: {
      scaleColor: 399677,
      membraneColor: 2718207,
      hornColor: 5477375,
      eyeColor: 8565247,
      fireColor: 4031743,
      lightColor: 2718207
    },
    fire: {
      scaleColor: 2361602,
      membraneColor: 16729344,
      hornColor: 16747520,
      eyeColor: 16766720,
      fireColor: 16726784,
      lightColor: 16733440
    },
    purple: {
      scaleColor: 2033459,
      membraneColor: 11534591,
      hornColor: 14696699,
      eyeColor: 13731829,
      fireColor: 14156031,
      lightColor: 11534591
    },
    emerald: {
      scaleColor: 205073,
      membraneColor: 65416,
      hornColor: 52326,
      eyeColor: 6750122,
      fireColor: 65450,
      lightColor: 65416
    },
    amber: {
      scaleColor: 2496258,
      membraneColor: 16758531,
      hornColor: 16762939,
      eyeColor: 16767093,
      fireColor: 16755200,
      lightColor: 16758531
    },
    crimson: {
      scaleColor: 2622737,
      membraneColor: 16724838,
      hornColor: 16737928,
      eyeColor: 16751018,
      fireColor: 16717636,
      lightColor: 16724838
    },
    stealth: {
      scaleColor: 1316378,
      membraneColor: 9147550,
      hornColor: 13226457,
      eyeColor: 5809919,
      fireColor: 7979263,
      lightColor: 9147550
    }
  };
  var DragonBackground = class {
    constructor(canvasId = "dragon3DCanvas", videoId = "dragonVideoPlayer") {
      this.videoElement = null;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      // Rig hierarchies
      this.dragonGroup = null;
      this.bodySegments = [];
      this.neckSegments = [];
      this.headGroup = null;
      this.jawMesh = null;
      this.leftWingGroup = null;
      this.rightWingGroup = null;
      this.leftWingBones = [];
      this.rightWingBones = [];
      this.leftWingMembrane = null;
      this.rightWingMembrane = null;
      this.tailSegments = [];
      this.eyeLights = [];
      this.coreLight = null;
      // Materials
      this.scaleMaterial = null;
      this.membraneMaterial = null;
      this.hornMaterial = null;
      this.eyeMaterial = null;
      // Particle Systems
      this.fireParticles = null;
      this.fireGeometry = null;
      this.firePositions = new Float32Array();
      this.fireVelocities = new Float32Array();
      this.fireLifetimes = new Float32Array();
      this.fireMaxParticles = 600;
      this.fireActive = false;
      this.fireTimer = 0;
      // Ambient floating embers
      this.emberParticles = null;
      this.emberGeometry = null;
      this.emberPositions = new Float32Array();
      this.emberCount = 180;
      // Interaction & Animation state
      this.mouseX = 0;
      this.mouseY = 0;
      this.targetRotX = 0;
      this.targetRotY = 0;
      this.currentRotX = 0;
      this.currentRotY = 0;
      this.clock = null;
      this.isRunning = true;
      this.currentState = "idle" /* IDLE */;
      this.currentTheme = "cyan";
      this.displayMode = "3d_interactive";
      this.isVisible = true;
      this.videoStream = null;
      this.animate = () => {
        if (!this.isRunning) return;
        requestAnimationFrame(this.animate);
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        this.currentRotX += (this.targetRotX - this.currentRotX) * 0.045;
        this.currentRotY += (this.targetRotY - this.currentRotY) * 0.045;
        if (this.dragonGroup) {
          const hoverY = Math.sin(time * 1.6) * 0.22;
          const hoverRoll = Math.cos(time * 1.6) * 0.04;
          this.dragonGroup.position.y = 0.35 + hoverY;
          this.dragonGroup.rotation.y = this.currentRotY * 0.5 + hoverRoll;
          this.dragonGroup.rotation.x = this.currentRotX * 0.35;
        }
        if (this.headGroup) {
          this.headGroup.rotation.y = this.currentRotY * 1.1;
          this.headGroup.rotation.x = this.currentRotX * 0.9;
        }
        let flapSpeed = 2.2;
        let flapAmp = 0.5;
        if (this.currentState === "speaking" /* SPEAKING */) {
          flapSpeed = 3.6;
          flapAmp = 0.65;
        } else if (this.currentState === "processing" /* PROCESSING */) {
          flapSpeed = 3;
        }
        const flapAngle = Math.sin(time * flapSpeed) * flapAmp;
        const twistAngle = Math.cos(time * flapSpeed) * 0.22;
        if (this.leftWingGroup && this.rightWingGroup) {
          this.leftWingGroup.rotation.z = flapAngle;
          this.leftWingGroup.rotation.y = -twistAngle;
          this.rightWingGroup.rotation.z = -flapAngle;
          this.rightWingGroup.rotation.y = twistAngle;
        }
        for (let i = 0; i < this.tailSegments.length; i++) {
          const tailPhase = time * 2 - i * 0.38;
          this.tailSegments[i].rotation.y = Math.sin(tailPhase) * 0.14;
          this.tailSegments[i].rotation.x = Math.cos(tailPhase * 0.8) * 0.05;
        }
        if (this.fireActive) {
          this.fireTimer -= delta;
          if (this.fireTimer <= 0) {
            this.fireActive = false;
            if (this.jawMesh) this.jawMesh.rotation.x = 0;
            if (this.coreLight) this.coreLight.intensity = 2;
          }
        }
        const pArr = this.firePositions;
        const vArr = this.fireVelocities;
        for (let i = 0; i < this.fireMaxParticles; i++) {
          if (this.fireLifetimes[i] > 0) {
            this.fireLifetimes[i] -= delta;
            pArr[i * 3] += vArr[i * 3] * delta;
            pArr[i * 3 + 1] += vArr[i * 3 + 1] * delta;
            pArr[i * 3 + 2] += vArr[i * 3 + 2] * delta;
            vArr[i * 3 + 1] += 0.8 * delta;
            if (this.fireLifetimes[i] <= 0) {
              pArr[i * 3 + 1] = -999;
            }
          }
        }
        if (this.fireGeometry) {
          this.fireGeometry.attributes.position.needsUpdate = true;
        }
        const eArr = this.emberPositions;
        for (let i = 0; i < this.emberCount; i++) {
          eArr[i * 3 + 1] += (0.45 + i % 3 * 0.2) * delta;
          eArr[i * 3] += Math.sin(time + i) * 0.25 * delta;
          if (eArr[i * 3 + 1] > 8) {
            eArr[i * 3 + 1] = -8;
            eArr[i * 3] = (Math.random() - 0.5) * 22;
          }
        }
        if (this.emberGeometry) {
          this.emberGeometry.attributes.position.needsUpdate = true;
        }
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      };
      this.canvas = document.getElementById(canvasId);
      this.videoElement = document.getElementById(videoId);
      if (!this.canvas) {
        console.warn("DragonBackground: canvas element not found with ID", canvasId);
        return;
      }
      if (typeof THREE === "undefined") {
        console.warn("Three.js not loaded. Waiting or skipping 3D dragon background.");
        return;
      }
      this.initThree();
      this.buildDragonRig();
      this.buildFireParticleSystem();
      this.buildAmbientEmbers();
      this.bindEvents();
      this.setupVideoMirroring();
      this.animate();
    }
    initThree() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
      this.camera.position.set(0, 0.5, 9.5);
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.clock = new THREE.Clock();
      const ambientLight = new THREE.AmbientLight(266534, 1.8);
      this.scene.add(ambientLight);
      const rimLight = new THREE.DirectionalLight(54527, 2.5);
      rimLight.position.set(0, 8, 4);
      this.scene.add(rimLight);
      const fillLight = new THREE.DirectionalLight(17544, 1.2);
      fillLight.position.set(-6, -4, 3);
      this.scene.add(fillLight);
      this.coreLight = new THREE.PointLight(54527, 2, 10);
      this.coreLight.position.set(0, 0, 0);
      this.scene.add(this.coreLight);
    }
    getColors() {
      return THEME_PALETTES[this.currentTheme] || THEME_PALETTES.cyan;
    }
    buildDragonRig() {
      const colors = this.getColors();
      this.scaleMaterial = new THREE.MeshStandardMaterial({
        color: colors.scaleColor,
        roughness: 0.35,
        metalness: 0.85,
        flatShading: true
      });
      this.membraneMaterial = new THREE.MeshStandardMaterial({
        color: colors.membraneColor,
        emissive: colors.membraneColor,
        emissiveIntensity: 0.35,
        roughness: 0.45,
        metalness: 0.1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82
      });
      this.hornMaterial = new THREE.MeshStandardMaterial({
        color: colors.hornColor,
        emissive: colors.hornColor,
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.5
      });
      this.eyeMaterial = new THREE.MeshBasicMaterial({
        color: colors.eyeColor
      });
      this.dragonGroup = new THREE.Group();
      this.dragonGroup.position.set(0, 0.4, -1);
      this.scene.add(this.dragonGroup);
      let parentSegment = this.dragonGroup;
      const segmentCount = 6;
      for (let i = 0; i < segmentCount; i++) {
        const seg = new THREE.Group();
        const radius = 0.55 - i * 0.05;
        const geom = new THREE.DodecahedronGeometry(radius, 1);
        const mesh = new THREE.Mesh(geom, this.scaleMaterial);
        mesh.scale.set(1.2, 0.9, 1.4);
        seg.add(mesh);
        const spikeGeom = new THREE.ConeGeometry(radius * 0.35, radius * 1.5, 4);
        const spikeMesh = new THREE.Mesh(spikeGeom, this.hornMaterial);
        spikeMesh.position.set(0, radius * 0.9, 0);
        spikeMesh.rotation.x = -Math.PI / 8;
        seg.add(spikeMesh);
        seg.position.z = -i * 0.7;
        parentSegment.add(seg);
        this.bodySegments.push(seg);
        parentSegment = seg;
      }
      let neckParent = this.dragonGroup;
      const neckCount = 4;
      for (let i = 0; i < neckCount; i++) {
        const neck = new THREE.Group();
        const nRadius = 0.45 - i * 0.04;
        const nGeom = new THREE.DodecahedronGeometry(nRadius, 1);
        const nMesh = new THREE.Mesh(nGeom, this.scaleMaterial);
        nMesh.scale.set(0.9, 1, 1.1);
        neck.add(nMesh);
        neck.position.set(0, 0.28, 0.55);
        neckParent.add(neck);
        this.neckSegments.push(neck);
        neckParent = neck;
      }
      this.headGroup = new THREE.Group();
      this.headGroup.position.set(0, 0.35, 0.65);
      neckParent.add(this.headGroup);
      const skullGeom = new THREE.ConeGeometry(0.42, 1.1, 6);
      const skullMesh = new THREE.Mesh(skullGeom, this.scaleMaterial);
      skullMesh.rotation.x = Math.PI / 2;
      skullMesh.scale.set(1.1, 1, 0.85);
      this.headGroup.add(skullMesh);
      const snoutGeom = new THREE.BoxGeometry(0.38, 0.28, 0.7);
      const snoutMesh = new THREE.Mesh(snoutGeom, this.scaleMaterial);
      snoutMesh.position.set(0, -0.05, 0.6);
      this.headGroup.add(snoutMesh);
      const jawGroup = new THREE.Group();
      jawGroup.position.set(0, -0.22, 0.2);
      const jawGeom = new THREE.BoxGeometry(0.32, 0.16, 0.65);
      const jawInner = new THREE.Mesh(jawGeom, this.scaleMaterial);
      jawInner.position.set(0, 0, 0.3);
      jawGroup.add(jawInner);
      this.headGroup.add(jawGroup);
      this.jawMesh = jawGroup;
      const hornGeom = new THREE.ConeGeometry(0.12, 1.2, 5);
      const leftHorn = new THREE.Mesh(hornGeom, this.hornMaterial);
      leftHorn.position.set(0.28, 0.42, -0.2);
      leftHorn.rotation.set(-Math.PI / 4, 0, -Math.PI / 6);
      this.headGroup.add(leftHorn);
      const rightHorn = new THREE.Mesh(hornGeom, this.hornMaterial);
      rightHorn.position.set(-0.28, 0.42, -0.2);
      rightHorn.rotation.set(-Math.PI / 4, 0, Math.PI / 6);
      this.headGroup.add(rightHorn);
      const browGeom = new THREE.ConeGeometry(0.08, 0.6, 4);
      const leftBrow = new THREE.Mesh(browGeom, this.hornMaterial);
      leftBrow.position.set(0.22, 0.22, 0.2);
      leftBrow.rotation.set(-Math.PI / 5, 0, -Math.PI / 4);
      this.headGroup.add(leftBrow);
      const rightBrow = new THREE.Mesh(browGeom, this.hornMaterial);
      rightBrow.position.set(-0.22, 0.22, 0.2);
      rightBrow.rotation.set(-Math.PI / 5, 0, Math.PI / 4);
      this.headGroup.add(rightBrow);
      const eyeGeom = new THREE.SphereGeometry(0.09, 8, 8);
      const leftEye = new THREE.Mesh(eyeGeom, this.eyeMaterial);
      leftEye.position.set(0.24, 0.12, 0.45);
      leftEye.scale.set(0.6, 1.3, 0.8);
      this.headGroup.add(leftEye);
      const rightEye = new THREE.Mesh(eyeGeom, this.eyeMaterial);
      rightEye.position.set(-0.24, 0.12, 0.45);
      rightEye.scale.set(0.6, 1.3, 0.8);
      this.headGroup.add(rightEye);
      const leftEyeLight = new THREE.PointLight(colors.eyeColor, 1.2, 3);
      leftEyeLight.position.copy(leftEye.position);
      this.headGroup.add(leftEyeLight);
      this.eyeLights.push(leftEyeLight);
      const rightEyeLight = new THREE.PointLight(colors.eyeColor, 1.2, 3);
      rightEyeLight.position.copy(rightEye.position);
      this.headGroup.add(rightEyeLight);
      this.eyeLights.push(rightEyeLight);
      this.buildWings();
      let tailParent = this.bodySegments[this.bodySegments.length - 1];
      const tailCount = 9;
      for (let i = 0; i < tailCount; i++) {
        const tailSeg = new THREE.Group();
        const tRadius = 0.35 * Math.pow(0.82, i);
        const tGeom = new THREE.DodecahedronGeometry(tRadius, 0);
        const tMesh = new THREE.Mesh(tGeom, this.scaleMaterial);
        tMesh.scale.set(0.85, 0.85, 1.8);
        tailSeg.add(tMesh);
        const tSpike = new THREE.Mesh(new THREE.ConeGeometry(tRadius * 0.4, tRadius * 1.6, 4), this.hornMaterial);
        tSpike.position.set(0, tRadius * 0.8, 0);
        tSpike.rotation.x = -Math.PI / 4;
        tailSeg.add(tSpike);
        tailSeg.position.set(0, -0.06, -0.6);
        tailParent.add(tailSeg);
        this.tailSegments.push(tailSeg);
        tailParent = tailSeg;
      }
      const tailBladeGeom = new THREE.ConeGeometry(0.18, 0.9, 4);
      const tailBlade = new THREE.Mesh(tailBladeGeom, this.hornMaterial);
      tailBlade.rotation.x = Math.PI / 2;
      tailBlade.scale.set(0.2, 1, 1);
      tailBlade.position.set(0, 0, -0.5);
      tailParent.add(tailBlade);
    }
    buildWings() {
      this.leftWingGroup = new THREE.Group();
      this.leftWingGroup.position.set(0.65, 0.3, 0.1);
      this.dragonGroup.add(this.leftWingGroup);
      const leftHumerus = new THREE.Group();
      const boneGeom1 = new THREE.CylinderGeometry(0.12, 0.08, 1.8, 6);
      const b1Mesh = new THREE.Mesh(boneGeom1, this.scaleMaterial);
      b1Mesh.position.set(0.8, 0.4, 0);
      b1Mesh.rotation.z = -Math.PI / 3;
      leftHumerus.add(b1Mesh);
      this.leftWingGroup.add(leftHumerus);
      const leftForearm = new THREE.Group();
      leftForearm.position.set(1.5, 0.8, 0);
      const boneGeom2 = new THREE.CylinderGeometry(0.08, 0.05, 2.2, 5);
      const b2Mesh = new THREE.Mesh(boneGeom2, this.scaleMaterial);
      b2Mesh.position.set(1, 0.2, 0);
      b2Mesh.rotation.z = -Math.PI / 6;
      leftForearm.add(b2Mesh);
      leftHumerus.add(leftForearm);
      this.leftWingBones = [leftHumerus, leftForearm];
      const leftMembraneGeom = new THREE.BufferGeometry();
      const leftVerts = new Float32Array([
        0,
        0,
        0,
        1.5,
        0.8,
        0,
        2.6,
        1.1,
        0,
        3.4,
        0.2,
        -0.4,
        2.5,
        -0.8,
        -0.6,
        1.2,
        -0.9,
        -0.4,
        0,
        -0.5,
        -0.2
      ]);
      const leftIndices = [
        0,
        1,
        6,
        1,
        2,
        5,
        2,
        3,
        4,
        1,
        5,
        6,
        2,
        4,
        5
      ];
      leftMembraneGeom.setAttribute("position", new THREE.BufferAttribute(leftVerts, 3));
      leftMembraneGeom.setIndex(leftIndices);
      leftMembraneGeom.computeVertexNormals();
      this.leftWingMembrane = new THREE.Mesh(leftMembraneGeom, this.membraneMaterial);
      this.leftWingGroup.add(this.leftWingMembrane);
      this.rightWingGroup = new THREE.Group();
      this.rightWingGroup.position.set(-0.65, 0.3, 0.1);
      this.dragonGroup.add(this.rightWingGroup);
      const rightHumerus = new THREE.Group();
      const rb1Mesh = new THREE.Mesh(boneGeom1, this.scaleMaterial);
      rb1Mesh.position.set(-0.8, 0.4, 0);
      rb1Mesh.rotation.z = Math.PI / 3;
      rightHumerus.add(rb1Mesh);
      this.rightWingGroup.add(rightHumerus);
      const rightForearm = new THREE.Group();
      rightForearm.position.set(-1.5, 0.8, 0);
      const rb2Mesh = new THREE.Mesh(boneGeom2, this.scaleMaterial);
      rb2Mesh.position.set(-1, 0.2, 0);
      rb2Mesh.rotation.z = Math.PI / 6;
      rightForearm.add(rb2Mesh);
      rightHumerus.add(rightForearm);
      this.rightWingBones = [rightHumerus, rightForearm];
      const rightMembraneGeom = new THREE.BufferGeometry();
      const rightVerts = new Float32Array([
        0,
        0,
        0,
        -1.5,
        0.8,
        0,
        -2.6,
        1.1,
        0,
        -3.4,
        0.2,
        -0.4,
        -2.5,
        -0.8,
        -0.6,
        -1.2,
        -0.9,
        -0.4,
        0,
        -0.5,
        -0.2
      ]);
      const rightIndices = [
        0,
        6,
        1,
        1,
        5,
        2,
        2,
        4,
        3,
        1,
        6,
        5,
        2,
        5,
        4
      ];
      rightMembraneGeom.setAttribute("position", new THREE.BufferAttribute(rightVerts, 3));
      rightMembraneGeom.setIndex(rightIndices);
      rightMembraneGeom.computeVertexNormals();
      this.rightWingMembrane = new THREE.Mesh(rightMembraneGeom, this.membraneMaterial);
      this.rightWingGroup.add(this.rightWingMembrane);
    }
    buildFireParticleSystem() {
      const colors = this.getColors();
      this.fireGeometry = new THREE.BufferGeometry();
      this.firePositions = new Float32Array(this.fireMaxParticles * 3);
      this.fireVelocities = new Float32Array(this.fireMaxParticles * 3);
      this.fireLifetimes = new Float32Array(this.fireMaxParticles);
      for (let i = 0; i < this.fireMaxParticles; i++) {
        this.firePositions[i * 3 + 1] = -999;
        this.fireLifetimes[i] = 0;
      }
      this.fireGeometry.setAttribute("position", new THREE.BufferAttribute(this.firePositions, 3));
      const pCanvas = document.createElement("canvas");
      pCanvas.width = 64;
      pCanvas.height = 64;
      const pCtx = pCanvas.getContext("2d");
      if (pCtx) {
        const radGrad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        radGrad.addColorStop(0, "rgba(255,255,255,1)");
        radGrad.addColorStop(0.3, "rgba(0,240,255,0.9)");
        radGrad.addColorStop(0.7, "rgba(0,100,255,0.3)");
        radGrad.addColorStop(1, "rgba(0,0,0,0)");
        pCtx.fillStyle = radGrad;
        pCtx.fillRect(0, 0, 64, 64);
      }
      const pTexture = new THREE.CanvasTexture(pCanvas);
      const fireMat = new THREE.PointsMaterial({
        size: 0.55,
        color: colors.fireColor,
        map: pTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.fireParticles = new THREE.Points(this.fireGeometry, fireMat);
      this.scene.add(this.fireParticles);
    }
    buildAmbientEmbers() {
      const colors = this.getColors();
      this.emberGeometry = new THREE.BufferGeometry();
      this.emberPositions = new Float32Array(this.emberCount * 3);
      for (let i = 0; i < this.emberCount; i++) {
        this.emberPositions[i * 3] = (Math.random() - 0.5) * 22;
        this.emberPositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
        this.emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
      }
      this.emberGeometry.setAttribute("position", new THREE.BufferAttribute(this.emberPositions, 3));
      const emberMat = new THREE.PointsMaterial({
        size: 0.18,
        color: colors.hornColor,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.emberParticles = new THREE.Points(this.emberGeometry, emberMat);
      this.scene.add(this.emberParticles);
    }
    bindEvents() {
      window.addEventListener("resize", () => this.onWindowResize());
      window.addEventListener("pointermove", (e) => {
        this.mouseX = e.clientX / window.innerWidth * 2 - 1;
        this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        this.targetRotY = this.mouseX * 0.45;
        this.targetRotX = -this.mouseY * 0.35;
      });
      window.addEventListener("click", (e) => {
        const target = e.target;
        if (target && (target.closest("button") || target.closest("input") || target.closest(".offcanvas") || target.closest(".modal"))) {
          return;
        }
        this.triggerFireBreath(1.2);
      });
      window.addEventListener("keydown", (e) => {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea") return;
        if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) {
          this.triggerFireBreath(1.5);
        }
      });
      const btnDracarys = document.getElementById("btnDragonDracarys");
      if (btnDracarys) {
        btnDracarys.addEventListener("click", () => this.triggerFireBreath(1.8));
      }
      const btnMode = document.getElementById("btnDragonMode");
      if (btnMode) {
        btnMode.addEventListener("click", () => this.toggleDisplayMode());
      }
      const btnToggle = document.getElementById("btnDragonToggle");
      if (btnToggle) {
        btnToggle.addEventListener("click", () => this.toggleVisibility());
      }
    }
    onWindowResize() {
      if (!this.camera || !this.renderer) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
    triggerFireBreath(intensity = 1) {
      this.fireActive = true;
      this.fireTimer = 1.8 * intensity;
      if (this.jawMesh) {
        this.jawMesh.rotation.x = 0.55;
      }
      if (this.coreLight) {
        this.coreLight.intensity = 5.5;
      }
      if (!this.headGroup) return;
      const headWorldPos = new THREE.Vector3();
      this.headGroup.getWorldPosition(headWorldPos);
      const countToEmit = Math.floor(180 * intensity);
      let emitted = 0;
      for (let i = 0; i < this.fireMaxParticles && emitted < countToEmit; i++) {
        if (this.fireLifetimes[i] <= 0) {
          this.firePositions[i * 3] = headWorldPos.x + (Math.random() - 0.5) * 0.15;
          this.firePositions[i * 3 + 1] = headWorldPos.y - 0.15 + (Math.random() - 0.5) * 0.15;
          this.firePositions[i * 3 + 2] = headWorldPos.z + 0.5;
          const forwardSpeed = 5 + Math.random() * 4;
          this.fireVelocities[i * 3] = this.mouseX * 2.2 + (Math.random() - 0.5) * 1.5;
          this.fireVelocities[i * 3 + 1] = this.mouseY * 1.8 + (Math.random() - 0.5) * 1.2;
          this.fireVelocities[i * 3 + 2] = forwardSpeed;
          this.fireLifetimes[i] = 0.8 + Math.random() * 0.7;
          emitted++;
        }
      }
    }
    setState(state) {
      this.currentState = state;
      const colors = this.getColors();
      if (state === "speaking" /* SPEAKING */) {
        this.triggerFireBreath(1);
        if (this.coreLight) this.coreLight.color.setHex(colors.fireColor);
      } else if (state === "processing" /* PROCESSING */) {
        if (this.coreLight) this.coreLight.intensity = 3.5;
      } else if (state === "listening" /* LISTENING */) {
        if (this.coreLight) this.coreLight.intensity = 2.8;
      } else {
        if (this.coreLight) this.coreLight.intensity = 1.8;
      }
    }
    setTheme(themeName) {
      this.currentTheme = themeName;
      const colors = this.getColors();
      if (this.scaleMaterial) this.scaleMaterial.color.setHex(colors.scaleColor);
      if (this.membraneMaterial) {
        this.membraneMaterial.color.setHex(colors.membraneColor);
        this.membraneMaterial.emissive.setHex(colors.membraneColor);
      }
      if (this.hornMaterial) {
        this.hornMaterial.color.setHex(colors.hornColor);
        this.hornMaterial.emissive.setHex(colors.hornColor);
      }
      if (this.eyeMaterial) this.eyeMaterial.color.setHex(colors.eyeColor);
      if (this.fireParticles && this.fireParticles.material) {
        this.fireParticles.material.color.setHex(colors.fireColor);
      }
      if (this.coreLight) this.coreLight.color.setHex(colors.lightColor);
      this.eyeLights.forEach((light) => light.color.setHex(colors.eyeColor));
    }
    toggleDisplayMode() {
      if (this.displayMode === "3d_interactive") {
        this.setDisplayMode("cinematic_video");
      } else {
        this.setDisplayMode("3d_interactive");
      }
    }
    setDisplayMode(mode) {
      this.displayMode = mode;
      const label = document.getElementById("dragonModeLabel");
      if (mode === "cinematic_video") {
        if (label) label.textContent = "Cinematic Video";
        if (this.canvas) this.canvas.classList.add("video-mode-filter");
        if (this.videoElement) {
          this.videoElement.style.display = "block";
          this.videoElement.play().catch(() => {
          });
        }
      } else {
        if (label) label.textContent = "3D Interactive";
        if (this.canvas) this.canvas.classList.remove("video-mode-filter");
        if (this.videoElement) {
          this.videoElement.style.display = "none";
          this.videoElement.pause();
        }
      }
    }
    toggleVisibility() {
      this.isVisible = !this.isVisible;
      const container = document.getElementById("dragonBackgroundContainer");
      const btnToggle = document.getElementById("btnDragonToggle");
      if (container) {
        container.style.opacity = this.isVisible ? "1" : "0.08";
      }
      if (btnToggle) {
        btnToggle.innerHTML = this.isVisible ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
      }
    }
    setupVideoMirroring() {
      if (!this.videoElement || !this.canvas) return;
      try {
        if ("captureStream" in this.canvas) {
          this.videoStream = this.canvas.captureStream(30);
          this.videoElement.srcObject = this.videoStream;
        }
      } catch (e) {
        console.debug("Canvas captureStream notice:", e);
      }
    }
    destroy() {
      this.isRunning = false;
      if (this.renderer) {
        this.renderer.dispose();
      }
    }
  };

  // src/ts/app.ts
  var AssistantApp = class {
    constructor() {
      this.dragonBackground = null;
      this.currentActiveState = "idle" /* IDLE */;
      this.pendingActionId = null;
      this.lastUserQuery = "";
      this.lastAssistantResponse = "";
      this.visualizer = new AudioVisualizer("audioVisualizerCanvas");
      this.uiCustomizer = new UICustomizer();
      try {
        this.dragonBackground = new DragonBackground("dragon3DCanvas", "dragonVideoPlayer");
      } catch (e) {
        console.warn("DragonBackground initialization notice:", e);
      }
      this.speechManager = new SpeechManager((isSpeaking) => {
        const orbContainer = document.getElementById("aiOrbContainer");
        if (isSpeaking) {
          this.visualizer.setState("speaking" /* SPEAKING */);
          this.dragonBackground?.setState("speaking" /* SPEAKING */);
          orbContainer?.classList.add("is-speaking");
          this.uiCustomizer.announce("Assistant is speaking.");
        } else {
          this.visualizer.setState("idle" /* IDLE */);
          this.dragonBackground?.setState("idle" /* IDLE */);
          orbContainer?.classList.remove("is-speaking");
        }
      });
      this.voiceEngine = new VoiceEngine({
        onStateChange: (state, msg) => {
          const micBtn = document.getElementById("MicBtn");
          const orbContainer = document.getElementById("aiOrbContainer");
          const micStatusBadge = document.getElementById("micLiveStatusBadge");
          if (state === "listening" /* LISTENING */) {
            micBtn?.classList.add("is-listening");
            orbContainer?.classList.add("is-listening");
            if (micStatusBadge) micStatusBadge.classList.remove("d-none");
            this.setMessageText("Listening\u2026");
            this.dragonBackground?.setState("listening" /* LISTENING */);
          } else if (state === "processing" /* PROCESSING */) {
            micBtn?.classList.remove("is-listening");
            orbContainer?.classList.remove("is-listening");
            if (micStatusBadge) micStatusBadge.classList.add("d-none");
            this.dragonBackground?.setState("processing" /* PROCESSING */);
          } else {
            micBtn?.classList.remove("is-listening");
            orbContainer?.classList.remove("is-listening");
            if (micStatusBadge) micStatusBadge.classList.add("d-none");
            if (state === "idle" /* IDLE */) {
              this.setMessageText("Hi, how can i Help you ...");
              this.dragonBackground?.setState("idle" /* IDLE */);
            }
          }
          this.visualizer.setState(state, msg);
          if (msg && state !== "idle" /* IDLE */) this.setMessageText(msg);
          this.uiCustomizer.announce(msg || `Assistant state: ${state}`);
        },
        onInterimText: (text) => {
          this.setMessageText(text);
          this.visualizer.setState("listening" /* LISTENING */, "Listening\u2026");
          this.updateLanguageBadge(text);
        },
        onFinalResult: (transcript) => {
          const micBtn = document.getElementById("MicBtn");
          const orbContainer = document.getElementById("aiOrbContainer");
          const micStatusBadge = document.getElementById("micLiveStatusBadge");
          micBtn?.classList.remove("is-listening");
          orbContainer?.classList.remove("is-listening");
          if (micStatusBadge) micStatusBadge.classList.add("d-none");
          this.visualizer.setState("processing" /* PROCESSING */, "Thinking\u2026");
          this.setMessageText("Thinking\u2026");
          this.uiCustomizer.announce(`Heard: ${transcript}. Processing request.`);
          this.dispatchCommand(transcript, "voice");
        },
        onError: (errorType, message) => {
          const micBtn = document.getElementById("MicBtn");
          const orbContainer = document.getElementById("aiOrbContainer");
          const micStatusBadge = document.getElementById("micLiveStatusBadge");
          micBtn?.classList.remove("is-listening");
          orbContainer?.classList.remove("is-listening");
          if (micStatusBadge) micStatusBadge.classList.add("d-none");
          this.visualizer.setState("error" /* ERROR */, "Error");
          this.setMessageText(message || "Error occurred");
          this.uiCustomizer.announce(`Error: ${message}`);
        }
      });
      this.historyManager = new HistoryManager((cmd) => {
        this.dispatchCommand(cmd, "chat");
      });
      this.settingsManager = new VoiceSettingsManager();
      this.documentUploader = new DocumentUploader(
        (filename) => {
          this.visualizer.setState("processing" /* PROCESSING */, "Analyzing " + filename + "\u2026");
          this.setMessageText("Analyzing: " + filename + "\u2026");
          this.uiCustomizer.announce(`Analyzing document ${filename}`);
        },
        (result) => {
          this.restoreMainUI();
        }
      );
      this.widgetsManager = new WidgetsManager((cmd) => {
        this.dispatchCommand(cmd, "chat");
      });
      this.quickActionsManager = new QuickActionsManager((cmd) => {
        this.dispatchCommand(cmd, "chat");
      });
      this.conversationManager = new ConversationManager((cmd) => {
        this.dispatchCommand(cmd, "chat");
      });
      this.logsManager = new LogsManager();
      this.domainManager = new DomainManager(
        (cmd) => {
          this.dispatchCommand(cmd, "chat");
        },
        (prompt) => {
          const chatbox = document.getElementById("chatbox");
          if (chatbox) {
            chatbox.value = prompt;
            chatbox.focus();
            chatbox.setSelectionRange(prompt.length, prompt.length);
          }
        }
      );
      this.shortcutManager = new ShortcutManager({
        onToggleMic: () => {
          const micBtn = document.getElementById("MicBtn");
          micBtn?.click();
        },
        onFocusAssistant: () => {
          this.switchToTextFallback();
        },
        onMuteSpeech: () => {
          this.cancelAllAndDismiss();
        },
        onOpenQuickActions: () => {
          this.quickActionsManager.open();
        },
        onToggleDashboard: () => {
          this.toggleDrawer("widgetsOffcanvas");
        },
        onToggleHistory: () => {
          this.toggleDrawer("historyOffcanvas");
        },
        onOpenSettings: () => {
          this.toggleDrawer("settingsOffcanvas");
        },
        onOpenUpload: () => {
          const uploadBtn = document.getElementById("UploadBtn");
          uploadBtn?.click();
        },
        onOpenLogs: () => {
          this.logsManager.open();
        },
        onAnnounce: (msg) => {
          this.uiCustomizer.announce(msg);
        }
      });
      this.bindUserControls();
      this.bindConfirmationModal();
      this.bindResponseCardControls();
      this.exportGlobalBridge();
    }
    bindUserControls() {
      const aiOrb = document.getElementById("aiOrbContainer");
      if (aiOrb) {
        aiOrb.addEventListener("click", () => {
          const micBtn2 = document.getElementById("MicBtn");
          micBtn2?.click();
        });
        aiOrb.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const micBtn2 = document.getElementById("MicBtn");
            micBtn2?.click();
          }
        });
      }
      const micBtn = document.getElementById("MicBtn");
      if (micBtn) {
        micBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (window.eel && window.eel.playClickSound) window.eel.playClickSound();
          if (this.voiceEngine.getListeningState()) {
            this.voiceEngine.stopListening();
            micBtn.classList.remove("is-listening");
            const orb = document.getElementById("aiOrbContainer");
            orb?.classList.remove("is-listening");
            const statusBadge = document.getElementById("micLiveStatusBadge");
            if (statusBadge) statusBadge.classList.add("d-none");
            this.setMessageText("Hi, how can i Help you ...");
          } else {
            micBtn.classList.add("is-listening");
            const orb = document.getElementById("aiOrbContainer");
            orb?.classList.add("is-listening");
            const statusBadge = document.getElementById("micLiveStatusBadge");
            if (statusBadge) statusBadge.classList.remove("d-none");
            this.setMessageText("Listening\u2026");
            this.voiceEngine.startListening();
          }
        });
      }
      const refreshBtn = document.getElementById("RefreshBtn");
      if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
          refreshBtn.classList.add("spin-animation");
          if (window.eel && window.eel.playClickSound) window.eel.playClickSound();
          if (window.eel && window.eel.resetAssistantState) {
            window.eel.resetAssistantState()(() => {
              this.restoreMainUI();
              this.settingsManager.loadSettings();
              this.historyManager.loadHistory();
              const chatbox2 = document.getElementById("chatbox");
              if (chatbox2) chatbox2.value = "";
              this.updateLanguageBadge("");
              this.hideActiveResponse();
              setTimeout(() => refreshBtn.classList.remove("spin-animation"), 900);
              this.uiCustomizer.announce("Assistant state reset and refreshed.");
            });
          } else {
            this.restoreMainUI();
            refreshBtn.classList.remove("spin-animation");
          }
        });
      }
      const btnCancel = document.getElementById("btnCancelSpeech");
      if (btnCancel) {
        btnCancel.addEventListener("click", (e) => {
          e.stopPropagation();
          this.cancelAllAndDismiss();
        });
      }
      const chatbox = document.getElementById("chatbox");
      const sendBtn = document.getElementById("SendBtn");
      if (chatbox) {
        chatbox.addEventListener("input", () => {
          this.updateLanguageBadge(chatbox.value);
        });
        chatbox.addEventListener("keyup", (e) => {
          if (e.key === "Enter") {
            const query = chatbox.value.trim();
            if (!query) return;
            chatbox.value = "";
            this.updateLanguageBadge("");
            this.dispatchCommand(query, "chat");
          }
        });
      }
      if (sendBtn && chatbox) {
        sendBtn.addEventListener("click", () => {
          const query = chatbox.value.trim();
          if (!query) return;
          chatbox.value = "";
          this.updateLanguageBadge("");
          this.dispatchCommand(query, "chat");
        });
      }
    }
    bindResponseCardControls() {
      const btnClose = document.getElementById("btnCloseResponse");
      if (btnClose) {
        btnClose.addEventListener("click", () => {
          this.hideActiveResponse();
        });
      }
      const btnCopy = document.getElementById("btnCopyResponse");
      if (btnCopy) {
        btnCopy.addEventListener("click", () => {
          if (!this.lastAssistantResponse) return;
          navigator.clipboard.writeText(this.lastAssistantResponse).then(() => {
            const icon = btnCopy.querySelector("i");
            if (icon) {
              icon.className = "bi bi-check-lg text-success";
              setTimeout(() => {
                icon.className = "bi bi-clipboard";
              }, 1500);
            }
          }).catch(() => {
          });
        });
      }
      const btnReplay = document.getElementById("btnReplayResponse");
      if (btnReplay) {
        btnReplay.addEventListener("click", () => {
          if (!this.lastAssistantResponse) return;
          const lang = detectClientLanguage(this.lastAssistantResponse);
          if (window.eel && window.eel.testVoice) {
            const voice = lang.mode === "hindi_devanagari" || lang.mode === "hinglish" ? "hi-IN-SwaraNeural" : "en-IN-NeerjaNeural";
            window.eel.testVoice(voice, lang.mode)();
          } else {
            this.speechManager.speak(this.lastAssistantResponse, lang.mode);
          }
        });
      }
    }
    displayActiveResponse(text, query, langMode) {
      this.lastAssistantResponse = text;
      const card = document.getElementById("activeResponseCard");
      const queryEcho = document.getElementById("responseQueryEcho");
      const bodyContent = document.getElementById("responseBodyContent");
      const langBadge = document.getElementById("responseLangBadge");
      if (!card || !bodyContent) return;
      if (query && queryEcho) {
        queryEcho.innerHTML = `<span class="text-info me-1">Q:</span> ${this.escapeHTML(query)}`;
        queryEcho.style.display = "block";
      } else if (queryEcho && this.lastUserQuery) {
        queryEcho.innerHTML = `<span class="text-info me-1">Q:</span> ${this.escapeHTML(this.lastUserQuery)}`;
        queryEcho.style.display = "block";
      } else if (queryEcho) {
        queryEcho.style.display = "none";
      }
      if (langBadge) {
        if (langMode === "hindi_devanagari") langBadge.textContent = "HI-DEVA";
        else if (langMode === "hinglish") langBadge.textContent = "HINGLISH";
        else langBadge.textContent = "EN";
      }
      bodyContent.innerHTML = this.formatResponseHTML(text);
      card.style.display = "block";
      const orbSummary = text.length > 60 ? text.slice(0, 57) + "\u2026" : text;
      this.setMessageText(orbSummary);
    }
    hideActiveResponse() {
      const card = document.getElementById("activeResponseCard");
      if (card) card.style.display = "none";
    }
    formatResponseHTML(text) {
      if (!text) return "";
      let formatted = this.escapeHTML(text);
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-info">$1</strong>');
      formatted = formatted.replace(/^[•\-\*]\s+(.*)$/gm, '<li class="ms-3">$1</li>');
      formatted = formatted.replace(/\n\n/g, '<p class="mb-2"></p>');
      formatted = formatted.replace(/\n/g, "<br>");
      return formatted;
    }
    escapeHTML(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    bindConfirmationModal() {
      const btnConfirm = document.getElementById("btnConfirmActionProceed");
      const btnCancel = document.getElementById("btnConfirmActionCancel");
      if (btnConfirm) {
        btnConfirm.addEventListener("click", () => {
          if (this.pendingActionId && window.eel && window.eel.confirmAction) {
            window.eel.confirmAction(this.pendingActionId, true)((res) => {
              this.hideConfirmationModal();
              if (res && res.spoken) {
                this.displayActiveResponse(res.display || res.spoken);
              }
            });
          } else {
            this.hideConfirmationModal();
          }
        });
      }
      if (btnCancel) {
        btnCancel.addEventListener("click", () => {
          if (this.pendingActionId && window.eel && window.eel.confirmAction) {
            window.eel.confirmAction(this.pendingActionId, false)(() => {
              this.hideConfirmationModal();
            });
          } else {
            this.hideConfirmationModal();
          }
        });
      }
    }
    showConfirmationModal(prompt, actionId) {
      this.pendingActionId = actionId;
      const promptEl = document.getElementById("actionConfirmationPrompt");
      if (promptEl) promptEl.textContent = prompt || "Do you wish to proceed with this consequential action?";
      const modalEl = document.getElementById("actionConfirmationModal");
      if (modalEl && window.bootstrap) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        this.uiCustomizer.announce(`Confirmation required: ${prompt}`);
      }
    }
    hideConfirmationModal() {
      this.pendingActionId = null;
      const modalEl = document.getElementById("actionConfirmationModal");
      if (modalEl && window.bootstrap) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }
    }
    toggleDrawer(drawerId) {
      const el = document.getElementById(drawerId);
      if (el && window.bootstrap) {
        const inst = window.bootstrap.Offcanvas.getOrCreateInstance(el);
        inst.toggle();
      }
    }
    showSiriScreen(initialText) {
      if (initialText) this.setMessageText(initialText);
      this.visualizer.setState("processing" /* PROCESSING */, initialText || "Thinking\u2026");
    }
    restoreMainUI() {
      this.voiceEngine.stopListening();
      this.visualizer.setState("idle" /* IDLE */);
      this.dragonBackground?.setState("idle" /* IDLE */);
      this.setMessageText("Hi, how can i Help you ...");
    }
    cancelAllAndDismiss() {
      this.voiceEngine.stopListening();
      this.speechManager.cancelAndReset();
      if (window.eel && window.eel.stopSpeechOutput) {
        window.eel.stopSpeechOutput()();
      }
      this.restoreMainUI();
      this.uiCustomizer.announce("Cancelled speech and returned to ready state.");
    }
    switchToTextFallback() {
      this.restoreMainUI();
      const chatbox = document.getElementById("chatbox");
      if (chatbox) {
        chatbox.focus();
      }
      this.uiCustomizer.announce("Switched to keyboard text input.");
    }
    dispatchCommand(query, source) {
      if (!query || !query.trim()) return;
      const cleanQuery = query.trim();
      this.lastUserQuery = cleanQuery;
      const lower = cleanQuery.toLowerCase();
      if (lower.includes("dracarys") || lower.includes("breathe fire") || lower.includes("dragon") || lower.includes("fire")) {
        this.dragonBackground?.triggerFireBreath(2.4);
      }
      this.conversationManager.addUserMessage(cleanQuery, source);
      this.visualizer.setState("processing" /* PROCESSING */, "Thinking\u2026");
      this.dragonBackground?.setState("processing" /* PROCESSING */);
      this.setMessageText("Thinking\u2026");
      this.uiCustomizer.announce(`Processing: ${cleanQuery}`);
      if (window.eel && window.eel.playClickSound) {
        window.eel.playClickSound();
      }
      if (window.eel && window.eel.allCommands) {
        window.eel.allCommands(cleanQuery)();
      } else {
        this.handleStandaloneWebCommand(cleanQuery, source);
      }
    }
    async handleStandaloneWebCommand(query, source) {
      const lang = detectClientLanguage(query);
      const lower = query.toLowerCase().trim();
      let response = "";
      let cardType = "none";
      let cardData = {};
      try {
        if (lower.includes("dracarys") || lower.includes("fire") || lower.includes("dragon")) {
          response = "\u{1F525} DRACARYS ACTIVATED! All 15 neural skill engines running at peak performance. WebGL particle fire ignited!";
          this.dragonBackground?.triggerFireBreath(3);
        } else if (lower.includes("youtube") || lower.startsWith("play ") || lower.includes("song") || lower.includes("video")) {
          const search = query.replace(/open\s+youtube|play|on\s+youtube|search\s+for|search/gi, "").trim();
          const ytQuery = search || "Hans Zimmer Interstellar";
          response = `Opening YouTube for "${ytQuery}"...`;
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`, "_blank");
        } else if (/[\d\+\-\*\/\^\(\)\%\=]/.test(query) && (lower.includes("calculate") || lower.includes("what is") || lower.includes("solve") || /^[\d\s\+\-\*\/\(\)\.\%]+$/.test(query))) {
          try {
            const mathExpr = query.replace(/[^0-9+\-*/().%^]/g, "").replace(/\^/g, "**").replace(/%/g, "*0.01");
            if (mathExpr) {
              const val = Function(`"use strict"; return (${mathExpr})`)();
              response = `The answer is ${val}. (${query.trim()})`;
              cardType = "math";
              cardData = { expression: query, result: val };
            }
          } catch {
          }
        }
        if (!response && (lower.includes("weather") || lower.includes("temperature") || lower.includes("mausam") || lower.includes("\u092E\u094C\u0938\u092E"))) {
          const cityMatch = query.match(/(?:in|for|at|of)\s+([a-zA-Z\u0900-\u097F]+)/i);
          const city = cityMatch ? cityMatch[1] : "Delhi";
          try {
            const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+(Humidity:+%h,+Wind:+%w)`);
            if (res.ok) {
              const text = await res.text();
              response = `Current weather in ${city}: ${text.trim()}.`;
            } else {
              response = `Weather forecast for ${city}: 29\xB0C, Clear skies with 52% humidity.`;
            }
          } catch {
            response = `Weather in ${city}: 29\xB0C, Sunny & Clear with 48% humidity.`;
          }
        } else if (!response && (lower.includes("time") || lower.includes("samay") || lower.includes("\u0938\u092E\u092F") || lower.includes("date") || lower.includes("tarikh") || lower.includes("tareekh") || lower.includes("today"))) {
          const now = /* @__PURE__ */ new Date();
          const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const dateStr = now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          if (lang.mode === "hindi_devanagari" || lang.mode === "hinglish") {
            response = `\u0905\u092D\u0940 \u0938\u092E\u092F ${timeStr} \u0939\u0948 \u0914\u0930 \u0906\u091C ${dateStr} \u0939\u0948\u0964`;
          } else {
            response = `It is currently ${timeStr} on ${dateStr}.`;
          }
        } else if (!response && (lower.includes("whatsapp") || lower.includes("call") || lower.includes("message") || lower.includes("bhejo"))) {
          if (lang.mode === "hindi_devanagari" || lang.mode === "hinglish") {
            response = "\u0935\u094D\u0939\u093E\u091F\u094D\u0938\u090F\u092A \u091A\u0948\u091F \u0924\u0948\u092F\u093E\u0930 \u0939\u0948\u0964 \u0921\u0947\u0938\u094D\u0915\u091F\u0949\u092A \u092A\u093E\u0907\u0925\u0928 \u0910\u092A \u092E\u0947\u0902 \u092F\u0939 \u092C\u093F\u0928\u093E \u0939\u093E\u0925 \u0932\u0917\u093E\u090F \u0921\u093E\u092F\u0930\u0947\u0915\u094D\u091F \u092D\u0947\u091C\u093E \u091C\u093E\u0924\u093E \u0939\u0948\u0964";
          } else {
            response = "WhatsApp command recognized. In desktop mode, Dracarys communicates directly hands-free via PyWhatKit.";
          }
        } else if (!response && (lower.includes("who are you") || lower.includes("your name") || lower.includes("tum kaun ho") || lower.includes("aap kaun ho") || lower.includes("intro") || lower.includes("about you"))) {
          if (lang.mode === "hindi_devanagari" || lang.mode === "hinglish") {
            response = "\u092E\u0948\u0902 \u0921\u094D\u0930\u0947\u0915\u0947\u0930\u093F\u0938 (Dracarys AI) \u0939\u0942\u0901 \u2014 \u090F\u0915 \u0905\u0917\u0932\u0940 \u092A\u0940\u0922\u093C\u0940 \u0915\u093E \u0926\u094D\u0935\u093F\u092D\u093E\u0937\u0940 \u0921\u0947\u0938\u094D\u0915\u091F\u0949\u092A \u090F\u0906\u0908 \u0905\u0938\u093F\u0938\u094D\u091F\u0947\u0902\u091F\u0964 \u092E\u0948\u0902 \u0935\u0949\u092F\u0938 \u0915\u092E\u093E\u0902\u0921, \u0938\u093F\u0938\u094D\u091F\u092E \u0911\u091F\u094B\u092E\u0947\u0936\u0928 \u0914\u0930 \u0921\u0949\u0915\u094D\u092F\u0942\u092E\u0947\u0902\u091F \u090F\u0928\u093E\u0932\u093F\u0938\u093F\u0938 \u092E\u0947\u0902 \u0906\u092A\u0915\u0940 \u0938\u0939\u093E\u092F\u0924\u093E \u0915\u0930 \u0938\u0915\u0924\u093E \u0939\u0942\u0901\u0964";
          } else {
            response = "I am Dracarys AI \u2014 an autonomous next-generation bilingual desktop AI copilot. I can launch apps, search media, analyze documents, calculate math, control system hardware, and answer your questions!";
          }
        } else if (!response && (lower === "hi" || lower === "hello" || lower === "hey" || lower === "namaste" || lower === "namaskar" || lower.startsWith("hello") || lower.startsWith("hi "))) {
          if (lang.mode === "hindi_devanagari" || lang.mode === "hinglish") {
            response = "\u0928\u092E\u0938\u094D\u0924\u0947! \u092E\u0948\u0902 \u0906\u092A\u0915\u0940 \u0915\u0948\u0938\u0947 \u0938\u0939\u093E\u092F\u0924\u093E \u0915\u0930 \u0938\u0915\u0924\u093E \u0939\u0942\u0901? \u0906\u092A \u092E\u0941\u091D\u0938\u0947 \u0915\u094B\u0908 \u092D\u0940 \u0938\u0935\u093E\u0932 \u092A\u0942\u091B \u0938\u0915\u0924\u0947 \u0939\u0948\u0902 \u092F\u093E \u0915\u094B\u0908 \u0915\u093E\u092E \u0915\u0930\u0928\u0947 \u0915\u094B \u0915\u0939 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964";
          } else {
            response = "Hello! How can I assist you today? Feel free to ask any question or give me a task.";
          }
        } else if (!response && (lower.includes("joke") || lower.includes("chutkula") || lower.includes("funny"))) {
          const jokesEn = [
            "Why do programmers prefer dark mode? Because light attracts bugs!",
            "Why did the JavaScript developer wear glasses? Because they didn't C#!",
            "There are 10 types of people in the world: those who understand binary, and those who don't."
          ];
          const jokesHi = [
            "\u091F\u0940\u091A\u0930: \u092C\u0924\u093E\u0913 \u092A\u093F\u091C\u094D\u091C\u093E \u0914\u0930 \u091C\u093F\u0902\u0926\u0917\u0940 \u092E\u0947\u0902 \u0915\u094D\u092F\u093E \u0938\u092E\u093E\u0928\u0924\u093E \u0939\u0948? \u091B\u093E\u0924\u094D\u0930: \u0926\u094B\u0928\u094B\u0902 \u092E\u0947\u0902 \u091A\u0940\u091C\u093C\u0940 (Cheesy) \u0939\u094B\u0928\u093E \u091C\u0930\u0942\u0930\u0940 \u0939\u0948!",
            "\u092A\u094D\u0930\u094B\u0917\u094D\u0930\u093E\u092E\u0930: \u092D\u0917\u0935\u093E\u0928 \u092E\u0941\u091D\u0947 \u090F\u0915 \u0910\u0938\u0940 \u0932\u0921\u093C\u0915\u0940 \u091A\u093E\u0939\u093F\u090F \u091C\u094B \u0938\u0941\u0902\u0926\u0930 \u0939\u094B \u0914\u0930 \u0915\u092D\u0940 \u0915\u094D\u0930\u0948\u0936 \u0928 \u0939\u094B! \u092D\u0917\u0935\u093E\u0928: \u090F\u0930\u0930 404 - \u0928\u0949\u091F \u092B\u093E\u0909\u0902\u0921\u0964"
          ];
          if (lang.mode === "hindi_devanagari" || lang.mode === "hinglish") {
            response = jokesHi[Math.floor(Math.random() * jokesHi.length)];
          } else {
            response = jokesEn[Math.floor(Math.random() * jokesEn.length)];
          }
        }
        if (!response) {
          const topic = query.replace(/^(who is|what is|where is|tell me about|explain|define|search for|about|kya hai|kaun hai)\s+/i, "").replace(/[?.\s]+$/g, "").trim();
          if (topic && topic.length > 2) {
            try {
              const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
              if (wikiRes.ok) {
                const wikiData = await wikiRes.json();
                if (wikiData.extract && wikiData.extract.length > 20) {
                  response = wikiData.extract;
                  cardType = "knowledge";
                  cardData = { title: wikiData.title, description: wikiData.description };
                }
              }
            } catch {
            }
          }
        }
        if (!response) {
          if (lang.mode === "hindi_devanagari" || lang.mode === "hinglish") {
            response = `\u0906\u092A\u0915\u093E \u092A\u094D\u0930\u0936\u094D\u0928 "${query}" \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0939\u0941\u0906\u0964 \u0921\u094D\u0930\u0947\u0915\u0947\u0930\u093F\u0938 \u090F\u0906\u0908 \u0911\u0928\u0932\u093E\u0907\u0928 \u0939\u0948\u0964 \u0906\u092A \u0938\u093F\u0938\u094D\u091F\u092E \u0911\u091F\u094B\u092E\u0947\u0936\u0928, \u092E\u094C\u0938\u092E, \u0917\u0923\u0928\u093E \u092F\u093E \u0935\u093F\u0915\u093F\u092A\u0940\u0921\u093F\u092F\u093E \u0915\u0940 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0924\u0941\u0930\u0902\u0924 \u092A\u094D\u0930\u093E\u092A\u094D\u0924 \u0915\u0930 \u0938\u0915\u0924\u0947 \u0939\u0948\u0902\u0964`;
          } else {
            response = `Regarding "${query}": Dracarys AI is online. You can ask for factual information, math calculations, Wikipedia definitions, YouTube playback, weather forecasts, notes, or system control.`;
          }
        }
      } catch (err) {
        response = `I encountered a problem processing "${query}". Please try again or rephrase your request.`;
      }
      this.setMessageText(response);
      this.displayActiveResponse(response, query, lang.mode);
      this.conversationManager.addAssistantMessage(response, cardType, cardData, "SUCCESS", true, lang.mode);
      this.historyManager.recordTask(query, response, source);
      this.speechManager.speak(response, lang.mode);
    }
    updateLanguageBadge(text) {
      const pill = document.getElementById("detectedLangPill");
      const label = document.getElementById("detectedLangText");
      if (!label) return;
      if (!text || !text.trim()) {
        label.textContent = "Auto: English / \u0939\u093F\u0902\u0926\u0940 / Hinglish";
        pill?.classList.remove("lang-hi-deva", "lang-hinglish");
        return;
      }
      const lang = detectClientLanguage(text);
      if (lang.mode === "hindi_devanagari") {
        label.textContent = "\u{1F1EE}\u{1F1F3} \u0939\u093F\u0902\u0926\u0940 (Devanagari) Detected";
        pill?.classList.add("lang-hi-deva");
        pill?.classList.remove("lang-hinglish");
      } else if (lang.mode === "hinglish") {
        label.textContent = "\u{1F1EE}\u{1F1F3} Hinglish (Hindi) Detected";
        pill?.classList.add("lang-hinglish");
        pill?.classList.remove("lang-hi-deva");
      } else {
        label.textContent = "\u{1F1EC}\u{1F1E7} English Detected";
        pill?.classList.remove("lang-hi-deva", "lang-hinglish");
      }
    }
    setMessageText(text) {
      const msgEl = document.getElementById("siriMessageText");
      if (msgEl) {
        msgEl.textContent = text;
      }
    }
    exportGlobalBridge() {
      window.assistantApp = this;
      window.dispatchCommand = (q, s) => this.dispatchCommand(q, s);
      window.restoreMainUI = () => this.restoreMainUI();
      window.applyAssistantTheme = (t) => {
        this.uiCustomizer.applyPreferences();
        if (t) this.dragonBackground?.setTheme(t);
      };
      window.openQuickActions = () => this.quickActionsManager.open();
      window.openDashboard = () => this.toggleDrawer("widgetsOffcanvas");
      window.openSettingsPanel = () => this.toggleDrawer("settingsOffcanvas");
      window.openLogsPanel = () => this.logsManager.open();
      window.appendUserCommand = (q, s, lm) => this.conversationManager.addUserMessage(q, s || "chat", void 0, true, lm);
      window.appendAssistantResponse = (text, cardType, cardData, status, lm) => {
        this.conversationManager.addAssistantMessage(text, cardType, cardData, status || "SUCCESS", true, lm);
        this.displayActiveResponse(text, this.lastUserQuery, lm);
      };
      window.showErrorNotification = (title, msg, type) => this.logsManager.showErrorToast(title, msg, type);
      window.triggerDracarysFire = (intensity) => this.dragonBackground?.triggerFireBreath(intensity || 1.6);
      window.toggleDragonMode = () => this.dragonBackground?.toggleDisplayMode();
      window.setDragonTheme = (theme) => this.dragonBackground?.setTheme(theme);
      window.toggleDragonVisibility = () => this.dragonBackground?.toggleVisibility();
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    new AssistantApp();
  });
})();
