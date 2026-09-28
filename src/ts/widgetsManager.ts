/* ================================================================
   DRACARYS AI — widgetsManager.ts
   Customizable Dashboard Widgets Manager
   ================================================================ */

import { WidgetData } from "./types";

export class WidgetsManager {
    private onDispatchCommand?: (cmd: string) => void;

    constructor(onDispatch?: (cmd: string) => void) {
        this.onDispatchCommand = onDispatch;
        this.bindEvents();
    }

    private bindEvents(): void {
        const drawer = document.getElementById("widgetsOffcanvas");
        if (drawer) {
            drawer.addEventListener("show.bs.offcanvas", () => this.refreshWidgets());
        }

        const btnRefresh = document.getElementById("btnRefreshWidgets");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", () => this.refreshWidgets());
        }

        // Quick Add Task from Widget
        const btnQuickTask = document.getElementById("btnWidgetAddTask");
        const inputQuickTask = document.getElementById("widgetInputTask") as HTMLInputElement;
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

        // Quick Add Note from Widget
        const btnQuickNote = document.getElementById("btnWidgetAddNote");
        const inputQuickNote = document.getElementById("widgetInputNote") as HTMLInputElement;
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

    public refreshWidgets(): void {
        if (!window.eel || !window.eel.getWidgetData) return;

        const refreshIcon = document.querySelector("#btnRefreshWidgets i");
        refreshIcon?.classList.add("spin-animation");

        window.eel.getWidgetData()((data: WidgetData) => {
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

    private renderWorldClock(clocks: Array<{ city: string; time: string; date: string }>): void {
        const container = document.getElementById("widgetWorldClockContainer");
        if (!container) return;

        if (clocks.length === 0) {
            container.innerHTML = `<span class="text-muted small">Clock data unavailable.</span>`;
            return;
        }

        container.innerHTML = clocks.map(c => `
            <div class="clock-chip">
                <span class="clock-city">${c.city}</span>
                <span class="clock-time">${c.time}</span>
            </div>
        `).join("");
    }

    private renderTelemetry(sys: any): void {
        if (!sys) return;
        const cpuEl = document.getElementById("widgetCpuVal");
        const ramEl = document.getElementById("widgetRamVal");
        const batEl = document.getElementById("widgetBatVal");

        if (cpuEl) cpuEl.textContent = `${sys.cpu}%`;
        if (ramEl) ramEl.textContent = `${sys.ram}%`;
        if (batEl) batEl.textContent = `${sys.battery}%${sys.plugged ? " ⚡" : ""}`;
    }

    private renderTasks(tasks: any[]): void {
        const container = document.getElementById("widgetTasksList");
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = `<div class="text-muted text-center p-2 small">No tasks pending.</div>`;
            return;
        }

        container.innerHTML = tasks.slice(0, 4).map(t => {
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

        container.querySelectorAll(".widget-task-check").forEach(chk => {
            chk.addEventListener("change", (e) => {
                const id = (e.target as HTMLElement).getAttribute("data-id");
                if (id && window.eel && window.eel.toggleTask) {
                    window.eel.toggleTask(id)(() => this.refreshWidgets());
                }
            });
        });
    }

    private renderNotes(notes: any[]): void {
        const container = document.getElementById("widgetNotesList");
        if (!container) return;

        if (!notes || notes.length === 0) {
            container.innerHTML = `<div class="text-muted text-center p-2 small">No saved notes.</div>`;
            return;
        }

        container.innerHTML = notes.slice(0, 3).map(n => `
            <div class="widget-note-card p-2 mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold small text-info">${n.title}</span>
                    <span class="badge bg-secondary" style="font-size:0.65rem;">${n.category}</span>
                </div>
                <div class="small text-muted text-truncate">${n.content}</div>
            </div>
        `).join("");
    }

    private renderCalendar(events: any[]): void {
        const container = document.getElementById("widgetCalendarList");
        if (!container) return;

        if (!events || events.length === 0) {
            container.innerHTML = `<div class="text-muted text-center p-2 small">No events scheduled.</div>`;
            return;
        }

        container.innerHTML = events.slice(0, 3).map(e => `
            <div class="widget-event-item p-2 mb-1 d-flex justify-content-between align-items-center">
                <div>
                    <div class="small fw-bold text-light">${e.title}</div>
                    <div class="text-muted" style="font-size:0.75rem;"><i class="bi bi-clock me-1"></i>${e.start_time}</div>
                </div>
                <span class="badge bg-primary" style="font-size:0.68rem;">Event</span>
            </div>
        `).join("");
    }
}
