/* ================================================================
   DRACARYS AI — conversationManager.ts
   Interactive Command & Response Feed, Message Rendering,
   Rich Cards (Weather, System, Tasks, Notes, Media), and UI Controls
   ================================================================ */

import { ConversationMessage } from "./types";

export function detectClientLanguage(text: string): { mode: "english" | "hindi_devanagari" | "hinglish"; label: string } {
    if (!text || !text.trim()) return { mode: "english", label: "English" };
    if (/[\u0900-\u097F]/.test(text)) {
        return { mode: "hindi_devanagari", label: "हिंदी (देवनागरी)" };
    }
    const lower = text.toLowerCase();
    const hinglishMarkers = [
        "kya", "hai", "hain", "kaise", "kaisa", "kaisi", "karo", "karna", "kariye",
        "batao", "bataiye", "mujhe", "mera", "meri", "mere", "aaj", "kal", "namaste",
        "shukriya", "dhanyawad", "dhanyavad", "haan", "nahin", "nahi", "theek", "thik",
        "accha", "achha", "achhi", "chalo", "kholo", "bajao", "laga", "do", "sunao",
        "sunaiye", "aap", "aapka", "aapki", "aapke", "tum", "tumhara", "tumhari",
        "hum", "hoga", "hogi", "honge", "raha", "rahi", "rahe", "kuch", "kuchh",
        "bahut", "zara", "thoda", "ruk", "ruko", "bolo", "baat", "sab", "sabko",
        "kaam", "samay", "waqt", "din", "raat", "subah", "shaam", "dost", "main",
        "mai", "hoon", "hun", "bhi", "kyun", "kyu", "kaun", "kab", "kahan", "aur"
    ];
    const tokens = lower.match(/[a-zA-Z]+/g) || [];
    const matches = tokens.filter(t => hinglishMarkers.includes(t));
    if ((tokens.length <= 3 && matches.length >= 1) || matches.length >= 2 || (tokens.length > 0 && matches.length / tokens.length >= 0.25)) {
        return { mode: "hinglish", label: "Hinglish (हिंदी)" };
    }
    return { mode: "english", label: "English" };
}

export class ConversationManager {
    private container: HTMLElement | null = null;
    private messages: ConversationMessage[] = [];
    private isThinking: boolean = false;
    private filterMode: "all" | "voice" | "chat" | "actions" = "all";
    private onRerunCommand?: (cmd: string) => void;

    constructor(onRerun?: (cmd: string) => void) {
        this.onRerunCommand = onRerun;
        this.container = document.getElementById("conversationFeedList");
        this.bindEvents();
        this.loadInitialHistory();
    }

    private bindEvents(): void {
        const btnClearFeed = document.getElementById("btnClearFeed");
        if (btnClearFeed) {
            btnClearFeed.addEventListener("click", () => this.clearFeed());
        }

        const btnToggleView = document.getElementById("btnToggleFeedView");
        if (btnToggleView) {
            btnToggleView.addEventListener("click", () => this.toggleFeedVisibility());
        }

        const filterTabs = document.querySelectorAll(".feed-filter-btn");
        filterTabs.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLElement;
                filterTabs.forEach(b => b.classList.remove("active"));
                target.classList.add("active");
                const filter = target.getAttribute("data-filter") as "all" | "voice" | "chat" | "actions";
                this.setFilter(filter || "all");
            });
        });
    }

    public loadInitialHistory(): void {
        if (!window.eel || !window.eel.getCommandHistory) return;
        window.eel.getCommandHistory(10)((history: any[]) => {
            if (history && history.length > 0) {
                // Populate from previous history reversed (chronological order)
                const items = [...history].reverse();
                items.forEach(h => {
                    this.addUserMessage(h.command, h.source || "chat", h.timestamp, false);
                    if (h.response) {
                        this.addAssistantMessage(h.response, "info", {}, "SUCCESS", false);
                    }
                });
                this.render();
            }
        });
    }

    public addUserMessage(
        text: string,
        source: "voice" | "chat" = "chat",
        timestamp?: string,
        autoRender = true,
        langMode?: "english" | "hindi_devanagari" | "hinglish"
    ): void {
        this.removeThinkingIndicator();
        const mode = langMode || detectClientLanguage(text).mode;
        const msg: ConversationMessage = {
            id: "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
            sender: "user",
            text: text,
            source: source,
            timestamp: timestamp || this.getCurrentTime(),
            status: "SUCCESS",
            langMode: mode
        };
        this.messages.push(msg);
        this.showThinkingIndicator();
        if (autoRender) this.render();
    }

    public addAssistantMessage(
        text: string,
        cardType: string = "none",
        cardData: any = {},
        status: "SUCCESS" | "ERROR" | "ACTION" = "SUCCESS",
        autoRender = true,
        langMode?: "english" | "hindi_devanagari" | "hinglish"
    ): void {
        this.removeThinkingIndicator();
        const mode = langMode || detectClientLanguage(text).mode;
        const msg: ConversationMessage = {
            id: "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
            sender: "assistant",
            text: text,
            timestamp: this.getCurrentTime(),
            status: status,
            cardType: cardType,
            cardData: cardData,
            langMode: mode
        };
        this.messages.push(msg);
        if (autoRender) this.render();
    }

    public showThinkingIndicator(): void {
        this.isThinking = true;
        this.updateThinkingDOM();
    }

    public removeThinkingIndicator(): void {
        this.isThinking = false;
        this.updateThinkingDOM();
    }

    private updateThinkingDOM(): void {
        const thinkingEl = document.getElementById("feedThinkingIndicator");
        if (!thinkingEl) return;
        thinkingEl.style.display = this.isThinking ? "flex" : "none";
        if (this.isThinking) {
            this.scrollToBottom();
        }
    }

    public setFilter(mode: "all" | "voice" | "chat" | "actions"): void {
        this.filterMode = mode;
        this.render();
    }

    public clearFeed(): void {
        this.messages = [];
        this.isThinking = false;
        this.render();
    }

    public toggleFeedVisibility(): void {
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

    private render(): void {
        if (!this.container) {
            this.container = document.getElementById("conversationFeedList");
        }
        if (!this.container) return;

        let filtered = this.messages;
        if (this.filterMode === "voice") {
            filtered = this.messages.filter(m => m.source === "voice" || (m.sender === "assistant" && this.isReplyToVoice(m)));
        } else if (this.filterMode === "chat") {
            filtered = this.messages.filter(m => m.source === "chat" || (m.sender === "assistant" && !this.isReplyToVoice(m)));
        } else if (this.filterMode === "actions") {
            filtered = this.messages.filter(m => m.cardType && m.cardType !== "none" && m.cardType !== "chat_response");
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
        filtered.forEach(msg => {
            const cardEl = msg.sender === "user" ? this.buildUserCard(msg) : this.buildAssistantCard(msg);
            this.container?.appendChild(cardEl);
        });

        this.updateThinkingDOM();
        this.scrollToBottom();
    }

    private isReplyToVoice(assistantMsg: ConversationMessage): boolean {
        const idx = this.messages.indexOf(assistantMsg);
        if (idx > 0 && this.messages[idx - 1].sender === "user") {
            return this.messages[idx - 1].source === "voice";
        }
        return false;
    }

    private buildUserCard(msg: ConversationMessage): HTMLElement {
        const card = document.createElement("div");
        card.className = "feed-bubble-row feed-user-row animate__animated animate__fadeInUp animate__faster";
        const isVoice = msg.source === "voice";

        let langBadge = "";
        if (msg.langMode === "hindi_devanagari") {
            langBadge = `<span class="feed-lang-badge lang-hi-deva"><i class="bi bi-translate me-1"></i>हिंदी (देवनागरी)</span>`;
        } else if (msg.langMode === "hinglish") {
            langBadge = `<span class="feed-lang-badge lang-hinglish"><i class="bi bi-translate me-1"></i>Hinglish (हिंदी)</span>`;
        } else {
            langBadge = `<span class="feed-lang-badge lang-en"><i class="bi bi-translate me-1"></i>English</span>`;
        }

        card.innerHTML = `
            <div class="feed-bubble feed-user-bubble">
                <div class="feed-bubble-header">
                    <div class="d-flex align-items-center gap-1 flex-wrap">
                        <span class="feed-badge ${isVoice ? 'badge-voice' : 'badge-chat'}">
                            <i class="bi ${isVoice ? 'bi-mic-fill' : 'bi-keyboard'} me-1"></i>${isVoice ? 'Voice' : 'Text'}
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

    private buildAssistantCard(msg: ConversationMessage): HTMLElement {
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
            langBadge = `<span class="feed-lang-badge lang-hi-deva"><i class="bi bi-patch-check-fill me-1"></i>हिंदी उत्तर</span>`;
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
                const voice = (msg.langMode === "hindi_devanagari" || msg.langMode === "hinglish")
                    ? "hi-IN-SwaraNeural"
                    : "en-IN-NeerjaNeural";
                const langType = (msg.langMode === "hindi_devanagari" || msg.langMode === "hinglish") ? "hindi" : "english";
                window.eel.testVoice(voice, langType);
            }
        });

        card.querySelector(".btn-copy-text")?.addEventListener("click", (e) => {
            navigator.clipboard.writeText(msg.text).then(() => {
                const btn = e.currentTarget as HTMLElement;
                btn.innerHTML = `<i class="bi bi-check me-1"></i>Copied!`;
                setTimeout(() => {
                    btn.innerHTML = `<i class="bi bi-clipboard me-1"></i>Copy`;
                }, 1800);
            });
        });

        return card;
    }

    private renderRichCard(cardType?: string, data?: any): string {
        if (!cardType || cardType === "none" || !data) return "";

        // 1. WEATHER CARD
        if (cardType === "weather" && data.temp_c !== undefined) {
            const forecastPills = (data.forecast || []).map((f: string) => `<span class="badge bg-dark text-info p-1 px-2 border border-secondary border-opacity-25">${this.escapeHtml(f)}</span>`).join(" ");
            return `
                <div class="feed-rich-card card-weather mt-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="card-location"><i class="bi bi-geo-alt me-1 text-danger"></i>${this.escapeHtml(data.location || 'Local Area')}</div>
                            <div class="card-condition text-muted small">${this.escapeHtml(data.condition || 'Clear')}</div>
                        </div>
                        <div class="card-temp fw-bold text-info" style="font-size: 1.8rem;">${data.temp_c}°C</div>
                    </div>
                    <div class="card-meta d-flex gap-3 text-muted small mt-2 pt-2 border-top border-secondary border-opacity-25">
                        <span><i class="bi bi-droplet me-1"></i>Humidity: ${data.humidity}%</span>
                        <span><i class="bi bi-wind me-1"></i>Wind: ${data.wind_kmph} km/h</span>
                        <span><i class="bi bi-thermometer-half me-1"></i>Feels like: ${data.feels_like}°C</span>
                    </div>
                    ${forecastPills ? `<div class="d-flex flex-wrap gap-1 mt-2">${forecastPills}</div>` : ''}
                </div>
            `;
        }

        // 2. SYSTEM TELEMETRY CARD
        if (cardType === "system_info" && data.cpu) {
            return `
                <div class="feed-rich-card card-system mt-2">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold small text-info"><i class="bi bi-cpu me-1"></i>System Performance Status</span>
                        <span class="badge bg-success small">${data.network?.status || 'Online'}</span>
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

        // 3. ACTION RESULT CARD
        if (cardType === "action_result") {
            return `
                <div class="feed-rich-card card-action mt-2 p-2 px-3 rounded bg-dark border border-info border-opacity-25">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="small text-light"><i class="bi bi-check2-circle text-info me-2"></i>Action: <strong>${this.escapeHtml(data.action || 'Execute')}</strong></span>
                        <span class="badge bg-primary small">${this.escapeHtml(data.status || 'SUCCESS')}</span>
                    </div>
                </div>
            `;
        }

        // 4. DOCUMENT SUMMARY CARD
        if (cardType === "document_summary") {
            return `
                <div class="feed-rich-card card-document mt-2 p-3 rounded bg-dark border border-secondary border-opacity-50">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <i class="bi bi-file-earmark-text text-info fs-5"></i>
                        <span class="fw-bold text-light">${this.escapeHtml(data.filename || 'Document')}</span>
                    </div>
                    <div class="text-muted small">${this.escapeHtml((data.summary_text || '').substring(0, 180))}...</div>
                </div>
            `;
        }

        // 5. ERROR CARD
        if (cardType === "error") {
            return `
                <div class="feed-rich-card card-error mt-2 p-2 px-3 rounded bg-danger bg-opacity-10 border border-danger border-opacity-50 text-danger small">
                    <i class="bi bi-bug me-1"></i>${this.escapeHtml(data.error || 'Execution glitch detected.')}
                </div>
            `;
        }

        // 6. DOMAIN SPECIFIC CARDS (Academic, Workplace, Personal)
        if (data.domain === "academic" || cardType.startsWith("academic_")) {
            const topic = data.topic || data.style || data.expression || (cardType === "academic_pomodoro" ? "Study Session" : "Academic Task");
            const domainIcon = cardType === "academic_pomodoro" ? "bi-hourglass-split" : (cardType === "academic_math" ? "bi-calculator-fill" : "bi-mortarboard-fill");
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
            const domainIcon = cardType === "workplace_email" ? "bi-envelope-paper-fill" : (cardType === "workplace_code" ? "bi-code-slash" : "bi-briefcase-fill");
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
            const domainIcon = cardType === "personal_expense" ? "bi-wallet2" : (cardType === "personal_wellness" ? "bi-droplet-fill" : "bi-house-heart-fill");
            const totalText = data.total ? `Total: ₹${data.total.toFixed(2)}` : (data.amount ? `₹${data.amount.toFixed(2)} (${data.category})` : "Active");
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

    private formatAssistantText(text: string): string {
        if (!text) return "";
        let formatted = this.escapeHtml(text);
        // Replace bold **text**
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Replace bullet points
        formatted = formatted.replace(/\n• (.*?)/g, '<br>&bull; $1');
        formatted = formatted.replace(/\n- (.*?)/g, '<br>&bull; $1');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    private scrollToBottom(): void {
        if (this.container) {
            this.container.scrollTop = this.container.scrollHeight;
        }
    }

    private getCurrentTime(): string {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    private escapeHtml(str: string): string {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
