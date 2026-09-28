/* ================================================================
   DRACARYS AI — types.ts
   TypeScript Type Definitions, Enums, and Global Interfaces
   ================================================================ */

export enum AssistantState {
    IDLE = "idle",
    LISTENING = "listening",
    PROCESSING = "processing",
    SPEAKING = "speaking",
    ERROR = "error"
}

export interface VoiceSettings {
    name: string;
    speech_lang: string;
    tts_hindi_voice: string;
    tts_english_voice: string;
    rate: number;
    volume: number;
    theme: string;
}

export interface ShortcutConfig {
    mic: string;
    quickActions: string;
    dashboard: string;
    mute: string;
    history: string;
    settings: string;
    upload: string;
}

export interface UIPreferences {
    theme_mode: "dark" | "light";
    accent_color: string;
    font_size: "small" | "medium" | "large" | "xl";
    reduced_motion: boolean;
    widgets_pinned: string[];
    shortcuts?: Partial<ShortcutConfig>;
}

export interface HistoryItem {
    id: number;
    command: string;
    response?: string;
    source: "voice" | "chat";
    timestamp: string;
}

export interface TaskItem {
    id: number;
    title: string;
    completed: number;
    priority?: "high" | "medium" | "low";
    due_date?: string;
    category?: string;
    created_at?: string;
}

export interface NoteItem {
    id: number;
    title: string;
    content: string;
    category: string;
    created_at?: string;
}

export interface CalendarEventItem {
    id: number;
    title: string;
    start_time: string;
    end_time?: string;
    location?: string;
    status?: string;
}

export interface SystemInfoPayload {
    os: {
        name: string;
        release: string;
        summary: string;
        architecture: string;
        build: string;
    };
    cpu: {
        usage_percent: number;
        physical_cores: number;
        logical_cores: number;
        frequency_mhz: number;
    };
    memory: {
        total_gb: number;
        used_gb: number;
        free_gb: number;
        usage_percent: number;
    };
    disk: {
        drive: string;
        total_gb: number;
        used_gb: number;
        free_gb: number;
        usage_percent: number;
    };
    network: {
        online: boolean;
        latency_ms: number;
        adapter_type: string;
        status: string;
    };
    battery: {
        percent: number;
        plugged: boolean;
    };
}

export interface AuditLogEntry {
    id: number;
    timestamp: string;
    action_type: string;
    target: string;
    status: string;
    details: string;
    user_confirmed: number;
}

export interface QuickActionItem {
    id: string;
    title: string;
    category: "General" | "Apps" | "Websites" | "Automation" | "System";
    icon: string;
    shortcut?: string;
    action: () => void;
}

export interface WidgetData {
    system: {
        status: string;
        time: string;
        date: string;
        timezone: string;
        cpu: number;
        ram: number;
        battery: number;
        plugged: boolean;
    };
    world_clocks: Array<{ city: string; time: string; date: string }>;
    tasks: {
        total: number;
        completed: number;
        pending: number;
        tasks: TaskItem[];
    };
    notes: NoteItem[];
    calendar: CalendarEventItem[];
}

export interface DocumentAnalysisResult {
    success: boolean;
    filename: string;
    summary_text: string;
    size_kb?: number;
    word_count?: number;
    spoken_summary?: string;
    error?: string;
}

export interface SkillResultPayload {
    card_type?: string;
    card_data?: any;
    confirmation_prompt?: string;
    confirmation_action_id?: string;
    display_text?: string;
}

export interface LogEntry {
    timestamp: string;
    time: string;
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    logger: string;
    message: string;
    details?: string;
}

export interface SubsystemHealth {
    status: "ONLINE" | "CONFIGURED" | "WARNING" | "ERROR" | "OFFLINE" | "FALLBACK";
    message: string;
    provider?: string;
    default?: string;
    mixer_ready?: boolean;
}

export interface SystemHealthReport {
    status: "HEALTHY" | "ATTENTION" | "DEGRADED";
    timestamp: string;
    subsystems: {
        microphone?: SubsystemHealth;
        speech_output?: SubsystemHealth;
        database?: SubsystemHealth;
        network?: SubsystemHealth;
        nlp_ai?: SubsystemHealth;
        [key: string]: SubsystemHealth | undefined;
    };
}

export interface ConversationMessage {
    id: string;
    sender: "user" | "assistant";
    text: string;
    source?: "voice" | "chat";
    timestamp: string;
    status?: "SUCCESS" | "ERROR" | "ACTION" | "PENDING";
    cardType?: string;
    cardData?: any;
    displayText?: string;
    langMode?: "english" | "hindi_devanagari" | "hinglish";
}

declare global {
    interface Window {
        eel: any;
        SiriWave: any;
        bootstrap: any;
        $: any;
        jQuery: any;
        assistantApp?: any;
        applyAssistantTheme?: (theme: string) => void;
        dispatchCommand?: (query: string, source: "voice" | "chat") => void;
        restoreMainUI?: () => void;
        openQuickActions?: () => void;
        openDashboard?: () => void;
        openSettingsPanel?: () => void;
        openLogsPanel?: () => void;
        appendUserCommand?: (query: string, source: string) => void;
        appendAssistantResponse?: (text: string, cardType: string, cardData: any, status: string) => void;
        showErrorNotification?: (title: string, message: string, errorType: string) => void;
    }
}

