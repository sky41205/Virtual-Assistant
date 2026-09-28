/* ================================================================
   DRACARYS AI — documentUploader.ts
   Document Upload, Base64 Streaming, and Analysis Results Modal
   ================================================================ */

import { DocumentAnalysisResult } from "./types";

export class DocumentUploader {
    private fileInput: HTMLInputElement | null = null;
    private onAnalysisStart?: (filename: string) => void;
    private onAnalysisComplete?: (result: DocumentAnalysisResult) => void;

    constructor(
        onStart?: (filename: string) => void,
        onComplete?: (result: DocumentAnalysisResult) => void
    ) {
        this.onAnalysisStart = onStart;
        this.onAnalysisComplete = onComplete;
        this.bindEvents();
    }

    private bindEvents(): void {
        const uploadBtn = document.getElementById("UploadBtn");
        this.fileInput = document.getElementById("docFileInput") as HTMLInputElement;

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
                        setTimeout(() => { btnCopySummary.innerHTML = originalHtml; }, 2000);
                    });
                }
            });
        }
    }

    private handleFileSelected(event: Event): void {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        if (this.onAnalysisStart) {
            this.onAnalysisStart(file.name);
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            const b64Data = evt.target?.result as string;
            if (window.eel && window.eel.analyzeDocumentData) {
                window.eel.analyzeDocumentData(file.name, b64Data)((res: DocumentAnalysisResult) => {
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

    public showDocumentResult(res: DocumentAnalysisResult): void {
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

    private formatDocMarkdown(text: string): string {
        if (!text) return "";
        let html = text
            .replace(/### (.*?)\n/g, '<h3>$1</h3>')
            .replace(/## (.*?)\n/g, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\* (.*?)$/gm, '<li>$1</li>')
            .replace(/^- (.*?)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '<p></p>')
            .replace(/\n/g, '<br>');

        html = html.replace(/(<li>.*?<\/li>)+/g, (match) => `<ul>${match}</ul>`);
        return html;
    }
}
