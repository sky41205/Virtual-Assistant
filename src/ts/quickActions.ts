/* ================================================================
   DRACARYS AI — quickActions.ts
   Quick Actions Palette: Fast Keyboard-Searchable Action Launcher
   ================================================================ */

import { QuickActionItem } from "./types";

export class QuickActionsManager {
    private modalElement: HTMLElement | null;
    private searchInput: HTMLInputElement | null;
    private listContainer: HTMLElement | null;
    private items: QuickActionItem[] = [];
    private activeIndex: number = 0;
    private onExecuteCommand: (query: string) => void;

    constructor(onExecuteCommand: (query: string) => void) {
        this.onExecuteCommand = onExecuteCommand;
        this.modalElement = document.getElementById("quickActionsModal");
        this.searchInput = document.getElementById("quickActionSearch") as HTMLInputElement;
        this.listContainer = document.getElementById("quickActionsList");

        this.initDefaultActions();
        this.bindEvents();
    }

    private initDefaultActions(): void {
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

    private bindEvents(): void {
        const quickBtn = document.getElementById("QuickActionsBtn");
        if (quickBtn) {
            quickBtn.addEventListener("click", () => this.open());
        }

        if (this.searchInput) {
            this.searchInput.addEventListener("input", () => {
                this.renderFilteredList(this.searchInput?.value.trim().toLowerCase() || "");
            });

            this.searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
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
                    const activeItem = rendered[this.activeIndex] as HTMLElement;
                    if (activeItem) {
                        activeItem.click();
                    }
                }
            });
        }
    }

    public open(): void {
        this.renderFilteredList("");
        if (this.modalElement && window.bootstrap) {
            const inst = window.bootstrap.Modal.getOrCreateInstance(this.modalElement);
            inst.show();
            setTimeout(() => {
                this.searchInput?.focus();
            }, 300);
        }
    }

    public close(): void {
        if (this.modalElement && window.bootstrap) {
            const inst = window.bootstrap.Modal.getOrCreateInstance(this.modalElement);
            inst.hide();
        }
    }

    private renderFilteredList(query: string): void {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = "";

        const filtered = query
            ? this.items.filter(it => it.title.toLowerCase().includes(query) || it.category.toLowerCase().includes(query))
            : this.items;

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

    private highlightActiveItem(elements: NodeListOf<Element>): void {
        elements.forEach((el, idx) => {
            if (idx === this.activeIndex) {
                el.classList.add("active");
                el.scrollIntoView({ block: "nearest" });
            } else {
                el.classList.remove("active");
            }
        });
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
