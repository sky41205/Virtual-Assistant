/* ================================================================
   DRACARYS AI — domainManager.ts
   Domain Mode Controller for Academic, Workplace, and Personal Needs
   ================================================================ */

export type DomainMode = "academic" | "workplace" | "personal";

export interface DomainChip {
    id: string;
    label: string;
    icon: string;
    prompt: string;
    action: "run" | "populate";
    description?: string;
}

export class DomainManager {
    private currentMode: DomainMode = "academic";
    private onExecuteCommand: (query: string) => void;
    private onPopulateChatbox: (prompt: string) => void;

    private domainChips: Record<DomainMode, DomainChip[]> = {
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

    constructor(
        onExecuteCommand: (query: string) => void,
        onPopulateChatbox: (prompt: string) => void
    ) {
        this.onExecuteCommand = onExecuteCommand;
        this.onPopulateChatbox = onPopulateChatbox;

        this.loadSavedMode();
        this.bindTabButtons();
        this.renderChips();
    }

    private loadSavedMode(): void {
        try {
            const saved = localStorage.getItem("sophia_domain_mode") as DomainMode;
            if (saved && (saved === "academic" || saved === "workplace" || saved === "personal")) {
                this.currentMode = saved;
            }
        } catch (e) {
            console.warn("Could not load saved domain mode:", e);
        }
    }

    private bindTabButtons(): void {
        const tabs = document.querySelectorAll(".domain-tab-btn");
        tabs.forEach((btn) => {
            btn.addEventListener("click", () => {
                const domain = btn.getAttribute("data-domain") as DomainMode;
                if (domain && domain !== this.currentMode) {
                    this.setDomainMode(domain);
                }
            });
        });
    }

    public setDomainMode(mode: DomainMode): void {
        this.currentMode = mode;
        try {
            localStorage.setItem("sophia_domain_mode", mode);
        } catch (e) {}

        // Update active tab buttons
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

    public getDomainMode(): DomainMode {
        return this.currentMode;
    }

    private renderChips(): void {
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
}
