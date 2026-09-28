/* ================================================================
   DRACARYS AI — logsManager.ts
   Production Logging & Reliability Subsystem Controller:
   Live Log Streamer, Filter by Level, Diagnostics Health Tests,
   and Error Notification Toasts
   ================================================================ */

import { LogEntry, SystemHealthReport } from "./types";

export class LogsManager {
    private isAutoRefresh: boolean = true;
    private refreshInterval: any = null;
    private currentLevelFilter: string = "ALL";
    private searchQuery: string = "";
    private logsCache: LogEntry[] = [];

    constructor() {
        this.bindEvents();
    }

    private bindEvents(): void {
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
        logFilterBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget as HTMLElement;
                logFilterBtns.forEach(b => b.classList.remove("active"));
                target.classList.add("active");
                this.currentLevelFilter = target.getAttribute("data-level") || "ALL";
                this.renderLogs();
            });
        });

        const searchInput = document.getElementById("logSearchInput") as HTMLInputElement;
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
                    this.refreshInterval = setInterval(() => this.fetchLogs(), 3000);
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

    public open(): void {
        const el = document.getElementById("logsOffcanvas");
        if (el && window.bootstrap) {
            const inst = window.bootstrap.Offcanvas.getOrCreateInstance(el);
            inst.show();
        }
    }

    public fetchLogs(): void {
        if (!window.eel || !window.eel.getLiveLogs) return;
        window.eel.getLiveLogs(100, "ALL")((logs: LogEntry[]) => {
            this.logsCache = logs || [];
            this.renderLogs();
        });
    }

    public clearLogs(): void {
        if (!window.eel || !window.eel.clearLiveLogs) return;
        window.eel.clearLiveLogs()(() => {
            this.logsCache = [];
            this.renderLogs();
        });
    }

    public runDiagnostics(): void {
        const statusEl = document.getElementById("diagOverallBadge");
        if (statusEl) {
            statusEl.textContent = "Testing...";
            statusEl.className = "badge bg-warning text-dark";
        }

        if (!window.eel || !window.eel.getDiagnosticHealth) return;
        window.eel.getDiagnosticHealth()((report: SystemHealthReport) => {
            this.renderHealthReport(report);
        });
    }

    private renderHealthReport(report: SystemHealthReport): void {
        const overallBadge = document.getElementById("diagOverallBadge");
        if (overallBadge) {
            overallBadge.textContent = report.status || "HEALTHY";
            overallBadge.className = `badge ${report.status === 'HEALTHY' ? 'bg-success' : report.status === 'ATTENTION' ? 'bg-warning text-dark' : 'bg-danger'}`;
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

        container.innerHTML = items.map(item => {
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

    private renderLogs(): void {
        const container = document.getElementById("liveLogsContainer");
        const countBadge = document.getElementById("logsCountBadge");
        if (!container) return;

        let filtered = this.logsCache;

        // Level filter
        if (this.currentLevelFilter !== "ALL") {
            filtered = filtered.filter(l => l.level === this.currentLevelFilter);
        }

        // Search query
        if (this.searchQuery) {
            filtered = filtered.filter(l =>
                l.message.toLowerCase().includes(this.searchQuery) ||
                l.logger.toLowerCase().includes(this.searchQuery) ||
                (l.details && l.details.toLowerCase().includes(this.searchQuery))
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

        container.innerHTML = filtered.map(l => {
            let lvlClass = "log-info";
            if (l.level === "WARNING") lvlClass = "log-warning";
            if (l.level === "ERROR" || l.level === "CRITICAL") lvlClass = "log-error";
            if (l.level === "DEBUG") lvlClass = "log-debug";

            const detailsHtml = l.details
                ? `<pre class="log-details mt-1 p-1 rounded bg-black text-danger font-monospace small">${this.escapeHtml(l.details)}</pre>`
                : "";

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

    public showErrorToast(title: string, message: string, errorType: string = "general"): void {
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
            } catch (e) {}
        }, 6000);
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
