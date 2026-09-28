/* ================================================================
   DRACARYS AI — documentUploader.ts
   Document Upload, Base64 Streaming, and Analysis Results Modal
   ================================================================ */
export class DocumentUploader {
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
                var _a;
                if (window.eel && window.eel.playClickSound)
                    window.eel.playClickSound();
                (_a = this.fileInput) === null || _a === void 0 ? void 0 : _a.click();
            });
            this.fileInput.addEventListener("change", (e) => this.handleFileSelected(e));
        }
        const btnCopySummary = document.getElementById("btnCopyDocSummary");
        if (btnCopySummary) {
            btnCopySummary.addEventListener("click", () => {
                var _a;
                const content = (_a = document.getElementById("docModalContent")) === null || _a === void 0 ? void 0 : _a.textContent;
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
    handleFileSelected(event) {
        var _a;
        const target = event.target;
        const file = (_a = target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        if (this.onAnalysisStart) {
            this.onAnalysisStart(file.name);
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
            var _a;
            const b64Data = (_a = evt.target) === null || _a === void 0 ? void 0 : _a.result;
            if (window.eel && window.eel.analyzeDocumentData) {
                window.eel.analyzeDocumentData(file.name, b64Data)((res) => {
                    this.showDocumentResult(res);
                    if (this.onAnalysisComplete) {
                        this.onAnalysisComplete(res);
                    }
                    if (this.fileInput)
                        this.fileInput.value = "";
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
        if (titleEl)
            titleEl.textContent = res.filename || "Document Analysis";
        if (sizeEl)
            sizeEl.textContent = res.size_kb ? `${res.size_kb} KB` : "";
        if (wordsEl)
            wordsEl.textContent = res.word_count ? `${res.word_count} words` : "";
        if (contentEl)
            contentEl.innerHTML = this.formatDocMarkdown(res.summary_text);
        const modalEl = document.getElementById("docAnalysisModal");
        if (modalEl && window.bootstrap) {
            const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
    }
    formatDocMarkdown(text) {
        if (!text)
            return "";
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
