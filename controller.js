/* ================================================================
   DRACARYS AI — controller.js
   Python Eel <-> TypeScript Application Bridge
   ================================================================ */

var siriWaveTimeout = null;

// ===================== EEL EXPOSED FUNCTIONS =====================

function DisplayMessage(message) {
    if (!message) return true;
    try {
        var textEl = document.getElementById("siriMessageText");
        if (textEl) textEl.textContent = message;

        // Bridge to TypeScript AssistantApp if available
        if (window.assistantApp) {
            var m = message.toLowerCase();
            if (m.indexOf("listening") !== -1) {
                window.assistantApp.visualizer?.setState("listening", message);
            } else if (m.indexOf("recognizing") !== -1 || m.indexOf("thinking") !== -1 || m.indexOf("analyzing") !== -1) {
                window.assistantApp.visualizer?.setState("processing", message);
            } else {
                window.assistantApp.visualizer?.setState("speaking", "Speaking…");
            }
        }
    } catch (e) {
        console.warn("DisplayMessage notice:", e);
    }
    return true;
}

function ShowHood() {
    try {
        if (siriWaveTimeout) clearTimeout(siriWaveTimeout);
        siriWaveTimeout = null;

        if (window.assistantApp && window.assistantApp.restoreMainUI) {
            window.assistantApp.restoreMainUI();
        } else {
            var siri = document.getElementById("SiriWave");
            var oval = document.getElementById("Oval");
            if (siri) siri.hidden = true;
            if (oval) oval.hidden = false;
        }
    } catch (e) {
        console.warn("ShowHood notice:", e);
    }
    return true;
}

function SetSpeakingState(isSpeaking) {
    try {
        if (window.assistantApp) {
            if (isSpeaking) {
                window.assistantApp.visualizer?.setState("speaking", "Speaking…");
            } else {
                window.assistantApp.visualizer?.setState("idle", "Ready");
            }
        }
    } catch (e) {}
    return true;
}

function SetListeningState(isListening) {
    try {
        var micBtn = document.getElementById("MicBtn");
        var orb = document.getElementById("aiOrbContainer");
        var badge = document.getElementById("micLiveStatusBadge");

        if (isListening) {
            if (micBtn) micBtn.classList.add("is-listening");
            if (orb) orb.classList.add("is-listening");
            if (badge) badge.classList.remove("d-none");
            if (window.assistantApp && window.assistantApp.visualizer) {
                window.assistantApp.visualizer.setState("listening", "Listening…");
            }
        } else {
            if (micBtn) micBtn.classList.remove("is-listening");
            if (orb) orb.classList.remove("is-listening");
            if (badge) badge.classList.add("d-none");
            if (window.assistantApp && window.assistantApp.visualizer) {
                window.assistantApp.visualizer.setState("idle", "Ready");
            }
        }
    } catch (e) {}
    return true;
}

function startSpeechRecognition() {
    try {
        if (window.assistantApp && window.assistantApp.voiceEngine) {
            window.assistantApp.voiceEngine.startListening();
        } else {
            var micBtn = document.getElementById("MicBtn");
            if (micBtn) micBtn.click();
        }
    } catch (e) {}
    return true;
}

function stopSpeechRecognition() {
    try {
        if (window.assistantApp && window.assistantApp.voiceEngine) {
            window.assistantApp.voiceEngine.stopListening();
        }
        var micBtn = document.getElementById("MicBtn");
        if (micBtn) micBtn.classList.remove("is-listening");
        var orb = document.getElementById("aiOrbContainer");
        if (orb) orb.classList.remove("is-listening");
        var badge = document.getElementById("micLiveStatusBadge");
        if (badge) badge.classList.add("d-none");
    } catch (e) {}
    return true;
}

function ShowRecognizedText(text) {
    if (!text) return true;
    try {
        var textEl = document.getElementById("siriMessageText");
        if (textEl) textEl.textContent = text;
        if (window.assistantApp) {
            window.assistantApp.visualizer?.setState("processing", "Processing command…");
        }
    } catch (e) {}
    return true;
}

function AppendUserBubble(text, source, langMode) {
    if (!text) return true;
    try {
        if (window.assistantApp && window.assistantApp.conversationManager) {
            window.assistantApp.conversationManager.addUserMessage(text, source || "chat", undefined, true, langMode);
        } else if (window.appendUserCommand) {
            window.appendUserCommand(text, source || "chat", langMode);
        }
    } catch (e) {
        console.warn("AppendUserBubble error:", e);
    }
    return true;
}

function AppendAIBubble(text, card_type, card_data, status, langMode) {
    if (!text) return true;
    try {
        if (window.assistantApp && window.assistantApp.displayActiveResponse) {
            window.assistantApp.displayActiveResponse(text, undefined, langMode);
        }
        if (window.assistantApp && window.assistantApp.conversationManager) {
            window.assistantApp.conversationManager.addAssistantMessage(text, card_type || "none", card_data || {}, status || "SUCCESS", true, langMode);
        } else if (window.appendAssistantResponse) {
            window.appendAssistantResponse(text, card_type || "none", card_data || {}, status || "SUCCESS", langMode);
        }
    } catch (e) {
        console.warn("AppendAIBubble error:", e);
    }
    return true;
}

function ShowErrorNotification(title, message, errorType) {
    try {
        if (window.assistantApp && window.assistantApp.logsManager) {
            window.assistantApp.logsManager.showErrorToast(title, message, errorType);
        } else if (window.showErrorNotification) {
            window.showErrorNotification(title, message, errorType);
        }
    } catch (e) {
        console.warn("ShowErrorNotification error:", e);
    }
    return true;
}

function UpdateAssistantState(state, message) {
    try {
        if (window.assistantApp && window.assistantApp.visualizer) {
            window.assistantApp.visualizer.setState(state, message);
        }
        var badgeText = document.getElementById("stateBadgeText");
        if (badgeText && message) badgeText.textContent = message;
    } catch (e) {}
    return true;
}

function ShowSkillResult(card_type, card_data, confirmation_prompt, confirmation_action_id, display_text) {
    if (display_text) {
        DisplayMessage(display_text);
    }
    if (confirmation_prompt && confirmation_action_id && window.assistantApp && window.assistantApp.showConfirmationModal) {
        window.assistantApp.showConfirmationModal(confirmation_prompt, confirmation_action_id);
    }
    return true;
}

function toggleChatPanel(show) {
    var el = document.getElementById("historyOffcanvas");
    if (el && window.bootstrap) {
        var oc = bootstrap.Offcanvas.getOrCreateInstance(el);
        if (show) oc.show();
        else oc.hide();
    }
    return true;
}

function openDashboard() {
    if (window.openDashboard) {
        window.openDashboard();
    } else {
        var el = document.getElementById("widgetsOffcanvas");
        if (el && window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(el).show();
    }
    return true;
}

function openQuickActions() {
    if (window.openQuickActions) {
        window.openQuickActions();
    } else {
        var el = document.getElementById("quickActionsModal");
        if (el && window.bootstrap) bootstrap.Modal.getOrCreateInstance(el).show();
    }
    return true;
}

function setAssistantTheme(theme) {
    if (window.applyAssistantTheme) {
        window.applyAssistantTheme(theme);
    }
    return true;
}

function openSettingsPanel() {
    var el = document.getElementById("settingsOffcanvas");
    if (el && window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(el).show();
    return true;
}

function setAssistantState(state, message) {
    if (window.assistantApp && window.assistantApp.visualizer) {
        window.assistantApp.visualizer.setState(state, message);
    }
    return true;
}

function ShowDocumentResult(filename, summaryText, sizeKb, wordCount) {
    try {
        if (siriWaveTimeout) clearTimeout(siriWaveTimeout);
        ShowHood();

        var titleEl = document.getElementById("docModalFilename");
        var sizeEl = document.getElementById("docModalSize");
        var wordsEl = document.getElementById("docModalWords");
        var contentEl = document.getElementById("docModalContent");

        if (titleEl) titleEl.textContent = filename || "Document Analysis";
        if (sizeEl) sizeEl.textContent = sizeKb ? sizeKb + " KB" : "";
        if (wordsEl) wordsEl.textContent = wordCount ? wordCount + " words" : "";
        if (contentEl) contentEl.innerHTML = formatDocMarkdown(summaryText);

        var modalEl = document.getElementById('docAnalysisModal');
        if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } catch (e) {
        console.warn("ShowDocumentResult notice:", e);
    }
    return true;
}

// ── STREAMING TOKEN RECEIVER ──────────────────────────────────────────────────
// Called by Python during Gemini streaming to show tokens in real-time
var _streamBuffer = "";
var _streamCard = null;
var _streamBodyEl = null;
var _streamFlushTimer = null;

function StreamToken(token) {
    try {
        if (!token) return true;

        _streamBuffer += token;

        // Show live streaming text in the orb immediately
        var textEl = document.getElementById("siriMessageText");
        if (textEl) textEl.textContent = _streamBuffer;

        // Open / update the response card in streaming mode
        var card = document.getElementById("activeResponseCard");
        var bodyEl = document.getElementById("responseBodyContent");
        if (card && bodyEl) {
            card.style.display = "block";
            // Mark as streaming
            if (!card.classList.contains("is-streaming")) {
                card.classList.add("is-streaming");
                bodyEl.innerHTML = "";
            }
            bodyEl.innerHTML = _escapeHTMLSimple(_streamBuffer) + '<span class="stream-cursor">▍</span>';
            bodyEl.scrollTop = bodyEl.scrollHeight;
        }

        // Debounce finalizing — 800ms after last token
        if (_streamFlushTimer) clearTimeout(_streamFlushTimer);
        _streamFlushTimer = setTimeout(function () {
            _finalizeStream();
        }, 800);

    } catch (e) {}
    return true;
}

function _escapeHTMLSimple(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
}

function _finalizeStream() {
    try {
        var card = document.getElementById("activeResponseCard");
        var bodyEl = document.getElementById("responseBodyContent");
        if (card) card.classList.remove("is-streaming");
        if (bodyEl && _streamBuffer) {
            bodyEl.innerHTML = _escapeHTMLSimple(_streamBuffer);
        }
        _streamBuffer = "";
        _streamFlushTimer = null;
    } catch (e) {}
}
// ── END STREAMING ────────────────────────────────────────────────────────────

// Expose all functions to Eel globally
if (window.eel) {
    eel.expose(setAssistantState);
    eel.expose(UpdateAssistantState);
    eel.expose(DisplayMessage);
    eel.expose(ShowHood);
    eel.expose(SetSpeakingState);
    eel.expose(SetListeningState);
    eel.expose(ShowRecognizedText);
    eel.expose(AppendUserBubble);
    eel.expose(AppendAIBubble);
    eel.expose(ShowErrorNotification);
    eel.expose(ShowSkillResult);
    eel.expose(toggleChatPanel);
    eel.expose(openDashboard);
    eel.expose(openQuickActions);
    eel.expose(openLogsPanel);
    eel.expose(setAssistantTheme);
    eel.expose(openSettingsPanel);
    eel.expose(ShowDocumentResult);
    eel.expose(StreamToken);
    eel.expose(startSpeechRecognition);
    eel.expose(stopSpeechRecognition);
}

function formatDocMarkdown(text) {
    if (!text) return "";
    var html = text
        .replace(/### (.*?)\n/g, '<h3>$1</h3>')
        .replace(/## (.*?)\n/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^\* (.*?)$/gm, '<li>$1</li>')
        .replace(/^- (.*?)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '<p></p>')
        .replace(/\n/g, '<br>');

    html = html.replace(/(<li>.*?<\/li>)+/g, function (match) {
        return '<ul>' + match + '</ul>';
    });
    return html;
}