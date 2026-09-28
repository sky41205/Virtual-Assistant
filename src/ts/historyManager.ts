/* ================================================================
   DRACARYS AI — historyManager.ts
   Command & Task History Drawer Manager with Re-run, Copy, Delete
   ================================================================ */

import { HistoryItem } from "./types";

export class HistoryManager {
    private onRerunCommand?: (cmd: string) => void;

    constructor(onRerun?: (cmd: string) => void) {
        this.onRerunCommand = onRerun;
        this.bindEvents();
    }

    private bindEvents(): void {
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

    public loadHistory(): void {
        if (window.eel && window.eel.getCommandHistory) {
            window.eel.getCommandHistory(50)((history: HistoryItem[]) => {
                this.renderHistory(history || []);
            });
        } else {
            try {
                const localData = localStorage.getItem("dracarys_command_history");
                const items: HistoryItem[] = localData ? JSON.parse(localData) : [];
                this.renderHistory(items);
            } catch {
                this.renderHistory([]);
            }
        }
    }

    public recordTask(command: string, response: string = "", source: "voice" | "chat" = "chat"): void {
        if (!command || !command.trim()) return;
        try {
            const localData = localStorage.getItem("dracarys_command_history");
            const items: HistoryItem[] = localData ? JSON.parse(localData) : [];
            const newItem: HistoryItem = {
                id: Date.now(),
                command: command.trim(),
                response: response.trim(),
                source: source,
                timestamp: new Date().toISOString()
            };
            items.unshift(newItem);
            if (items.length > 50) items.length = 50;
            localStorage.setItem("dracarys_command_history", JSON.stringify(items));
            this.renderHistory(items);
        } catch (e) {
            console.warn("recordTask notice:", e);
        }
    }

    private renderHistory(items: HistoryItem[]): void {
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
        items.forEach(item => {
            const isVoice = item.source === "voice";
            const badgeCls = isVoice ? "badge-voice" : "badge-chat";
            const iconCls = isVoice ? "bi-mic-fill" : "bi-keyboard";
            const label = isVoice ? "Voice" : "Chat";

            const respHtml = item.response
                ? `<div class="history-resp"><i class="bi bi-arrow-return-right me-1"></i>${this.escapeHtml(item.response)}</div>`
                : "";

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
                const chatbox = document.getElementById("chatbox") as HTMLInputElement;
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

    private clearAll(): void {
        if (!confirm("Are you sure you want to clear all command and task history?")) return;
        if (window.eel && window.eel.clearCommandHistory) {
            window.eel.clearCommandHistory()(() => this.loadHistory());
        }
    }

    private closeDrawer(): void {
        const el = document.getElementById("historyOffcanvas");
        if (el && window.bootstrap) {
            const inst = window.bootstrap.Offcanvas.getInstance(el);
            if (inst) inst.hide();
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    private formatTimeAgo(ts: string): string {
        if (!ts) return "Recent";
        try {
            const d = new Date(ts.replace(" ", "T") + "Z");
            if (isNaN(d.getTime())) return ts;
            const sec = Math.floor((Date.now() - d.getTime()) / 1000);
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
}
