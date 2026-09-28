/* ================================================================
   DRACARYS AI — main.js
   Classic Clean Interface + Voice Recognition & Command Engine
   ================================================================ */

$(document).ready(function () {

    // 1. Textillate bouncy text on "Ask me anything"
    if ($.fn.textillate) {
        try {
            $('.text').textillate({
                loop: true,
                sync: true,
                in: {
                    effect: "bounceIn",
                },
                out: {
                    effect: "bounceOut",
                },
            });
        } catch (e) {
            console.warn("Textillate init notice:", e);
        }
    }

    // 2. SiriWave setup
    var siriWave = null;
    try {
        siriWave = new SiriWave({
            container: document.getElementById("siri-container"),
            width: 800,
            height: 200,
            style: "ios9",
            amplitude: 1,
            speed: 0.30,
            autostart: true
        });
    } catch (e) {
        console.warn("SiriWave init notice:", e);
    }

    // ============================================================
    // SCREEN TRANSITIONS
    // ============================================================
    function showSiriScreen(initialText) {
        $("#Oval").attr("hidden", true);
        $("#SiriWave").attr("hidden", false);
        if (initialText) {
            $("#siriMessageText").text(initialText);
        }
    }

    function restoreMainUI() {
        if (activeRecognition) {
            try { activeRecognition.abort(); } catch (e) {}
            activeRecognition = null;
        }
        $("#SiriWave").attr("hidden", true);
        $("#Oval").attr("hidden", false);
    }

    window.restoreMainUI = restoreMainUI;

    // Click SiriWave or press Esc to dismiss and return to Oval
    $("#SiriWave").click(function () {
        if (window.eel) eel.resetAssistantState();
        restoreMainUI();
    });

    $(document).keydown(function (e) {
        if (e.key === "Escape") {
            if (window.eel) eel.resetAssistantState();
            restoreMainUI();
        }
    });

    // ============================================================
    // COMMAND DISPATCH (Voice & Chat)
    // ============================================================
    function dispatchCommand(query, source) {
        if (!query || !query.trim()) return;
        var cleanQuery = query.trim();

        showSiriScreen(cleanQuery);
        if (window.eel) {
            eel.playClickSound();
            eel.allCommands(cleanQuery)();
        }
    }

    window.dispatchCommand = dispatchCommand;

    // ============================================================
    // TEXT CHAT INPUT
    // ============================================================
    function sendChatMessage() {
        var query = $("#chatbox").val().trim();
        if (!query) return;
        $("#chatbox").val("");
        dispatchCommand(query, "chat");
    }

    $("#chatbox").keyup(function (e) {
        if (e.which === 13) {
            sendChatMessage();
        }
    });

    // ============================================================
    // VOICE RECOGNITION (Web Speech API with Python Fallback)
    // ============================================================
    var SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    var activeRecognition = null;

    function startVoiceRecognition() {
        showSiriScreen("Listening... Speak now");

        if (!SpeechAPI) {
            // Browser doesn't support Web Speech -> Fallback to Python PyAudio takeCommand
            if (window.eel) {
                eel.playClickSound();
                eel.allCommands()();
            }
            return;
        }

        try {
            if (activeRecognition) {
                try { activeRecognition.abort(); } catch (e) {}
                activeRecognition = null;
            }

            var recognition = new SpeechAPI();
            activeRecognition = recognition;

            var lang = $("#settingSpeechLang").val() || "en-IN";
            recognition.lang = lang;
            recognition.interimResults = true;
            recognition.continuous = false;
            recognition.maxAlternatives = 1;

            var finalTranscript = "";
            var recognizedSomething = false;

            recognition.onstart = function () {
                $("#siriMessageText").text("Listening... Speak now");
            };

            recognition.onresult = function (event) {
                var interim = "";
                for (var i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript + " ";
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }
                var currentSpeech = (finalTranscript + interim).trim();
                if (currentSpeech) {
                    recognizedSomething = true;
                    $("#siriMessageText").text(currentSpeech);
                }
            };

            recognition.onerror = function (event) {
                console.warn("Speech recognition error:", event.error);
                if (event.error === "not-allowed" || event.error === "permission-denied") {
                    $("#siriMessageText").text("Microphone permission denied.");
                    setTimeout(restoreMainUI, 2200);
                } else if (event.error === "no-speech") {
                    $("#siriMessageText").text("No speech detected. Click mic to retry.");
                    setTimeout(restoreMainUI, 2000);
                } else if (event.error === "aborted") {
                    // User aborted
                } else {
                    // Network or system issue -> fallback to Python backend takeCommand
                    $("#siriMessageText").text("Listening via system mic...");
                    if (window.eel) {
                        eel.allCommands()();
                    }
                }
            };

            recognition.onend = function () {
                activeRecognition = null;
                var captured = finalTranscript.trim();
                if (captured) {
                    $("#siriMessageText").text(captured);
                    if (window.eel) {
                        eel.playClickSound();
                        eel.allCommands(captured)();
                    }
                } else if (!recognizedSomething) {
                    setTimeout(function () {
                        if ($("#siriMessageText").text().indexOf("Listening") !== -1) {
                            $("#siriMessageText").text("No speech detected.");
                            setTimeout(restoreMainUI, 1400);
                        }
                    }, 400);
                }
            };

            recognition.start();

        } catch (err) {
            console.warn("Could not start Web Speech, falling back to Python:", err);
            if (window.eel) {
                eel.playClickSound();
                eel.allCommands()();
            }
        }
    }

    $("#MicBtn").click(function () {
        if (window.eel) eel.playClickSound();
        startVoiceRecognition();
    });

    // ============================================================
    // THEMES
    // ============================================================
    var currentTheme = localStorage.getItem("assistant_theme") || "cyan";

    function applyTheme(t) {
        $("body").removeClass("theme-fire theme-cyan theme-purple theme-emerald theme-stealth");
        $("body").addClass("theme-" + t);
        $(".theme-btn").removeClass("active");
        $(".theme-btn[data-theme='" + t + "']").addClass("active");
        localStorage.setItem("assistant_theme", t);
        currentTheme = t;
    }

    window.applyAssistantTheme = applyTheme;
    applyTheme(currentTheme);

    $(".theme-btn").click(function () {
        applyTheme($(this).data("theme"));
    });

    // ============================================================
    // SETTINGS
    // ============================================================
    function loadSettings() {
        if (!window.eel) return;
        eel.getAssistantSettings()(function (s) {
            if (!s) return;
            if (s.name) {
                $("#settingAssistantName").val(s.name);
                $("#assistantDisplayTitle").text(s.name.toUpperCase());
                document.title = s.name.toUpperCase();
            }
            if (s.speech_lang) $("#settingSpeechLang").val(s.speech_lang);
            if (s.tts_hindi_voice) $("#settingHindiVoice").val(s.tts_hindi_voice);
            if (s.tts_english_voice) $("#settingEnglishVoice").val(s.tts_english_voice);
            if (s.theme) applyTheme(s.theme);
        });
    }

    loadSettings();

    $("#btnTestHindiVoice").click(function () {
        var v = $("#settingHindiVoice").val() || "hi-IN-SwaraNeural";
        if (window.eel) eel.testVoice(v, "hindi")();
    });

    $("#btnTestEnglishVoice").click(function () {
        var v = $("#settingEnglishVoice").val() || "en-IN-NeerjaNeural";
        if (window.eel) eel.testVoice(v, "english")();
    });

    $("#btnSaveSettings").click(function () {
        var name       = $("#settingAssistantName").val().trim() || "Dracarys";
        var speechLang = $("#settingSpeechLang").val() || "en-IN";
        var hindi      = $("#settingHindiVoice").val() || "hi-IN-SwaraNeural";
        var english    = $("#settingEnglishVoice").val() || "en-IN-NeerjaNeural";

        $("#assistantDisplayTitle").text(name.toUpperCase());
        document.title = name.toUpperCase();

        if (window.eel) {
            eel.saveAssistantSettings(name, 0, 170, 1.0, currentTheme, speechLang, hindi, english)(function () {
                var el = document.getElementById("settingsOffcanvas");
                if (el) {
                    var oc = bootstrap.Offcanvas.getInstance(el);
                    if (oc) oc.hide();
                }
            });
        }
    });

    $("#btnResetState").click(function () {
        if (window.eel) {
            eel.resetAssistantState()(function () {
                restoreMainUI();
                var el = document.getElementById("settingsOffcanvas");
                if (el) {
                    var oc = bootstrap.Offcanvas.getInstance(el);
                    if (oc) oc.hide();
                }
            });
        }
    });

    // ============================================================
    // HISTORY
    // ============================================================
    function escapeHtml(t) {
        return t ? $("<div>").text(t).html() : "";
    }

    function formatTimeAgo(ts) {
        if (!ts) return "Recent";
        try {
            var d = new Date(ts.replace(" ", "T") + "Z");
            if (isNaN(d)) return ts;
            var sec = Math.floor((new Date() - d) / 1000);
            if (sec < 60) return "Just now";
            var min = Math.floor(sec / 60); if (min < 60) return min + "m ago";
            var hr  = Math.floor(min / 60); if (hr < 24) return hr + "h ago";
            return d.toLocaleDateString();
        } catch (e) { return ts; }
    }

    function renderHistory() {
        if (!window.eel) return;
        eel.getCommandHistory(50)(function (history) {
            var $container = $("#historyListContainer").empty();
            var count = history ? history.length : 0;
            $("#historyCountBadge").text(count);

            if (!count) {
                $container.html('<div class="text-center text-muted p-4" style="font-size:0.85rem;">No tasks recorded yet.</div>');
                return;
            }

            history.forEach(function (item) {
                var isVoice = item.source === "voice";
                var badgeCls = isVoice ? "badge-voice" : "badge-chat";
                var iconCls  = isVoice ? "bi-mic-fill" : "bi-keyboard";
                var label    = isVoice ? "Voice" : "Chat";
                var respHtml = item.response
                    ? '<div class="history-resp"><i class="bi bi-arrow-return-right me-1"></i>' + escapeHtml(item.response) + '</div>'
                    : "";

                var html = '<div class="history-item" data-id="' + item.id + '">' +
                    '<div class="history-item-header">' +
                    '<span class="history-badge ' + badgeCls + '"><i class="bi ' + iconCls + ' me-1"></i>' + label + '</span>' +
                    '<span class="history-time">' + formatTimeAgo(item.timestamp) + '</span></div>' +
                    '<div class="history-cmd-text">' + escapeHtml(item.command) + '</div>' +
                    respHtml +
                    '<div class="history-actions">' +
                    '<button class="btn-history-action btn-rerun-cmd" data-cmd="' + escapeHtml(item.command) + '"><i class="bi bi-play-fill me-1"></i>Re-run</button>' +
                    '<button class="btn-history-action btn-copy-cmd" data-cmd="' + escapeHtml(item.command) + '"><i class="bi bi-clipboard me-1"></i>Copy</button>' +
                    '<button class="btn-history-action btn-del-cmd" data-id="' + item.id + '"><i class="bi bi-trash"></i></button>' +
                    '</div></div>';
                $container.append(html);
            });

            $(".btn-rerun-cmd").click(function () {
                var cmd = $(this).data("cmd");
                var el = document.getElementById("historyOffcanvas");
                if (el) {
                    var oc = bootstrap.Offcanvas.getInstance(el);
                    if (oc) oc.hide();
                }
                dispatchCommand(cmd, "chat");
            });

            $(".btn-copy-cmd").click(function () {
                $("#chatbox").val($(this).data("cmd")).focus();
                var el = document.getElementById("historyOffcanvas");
                if (el) {
                    var oc = bootstrap.Offcanvas.getInstance(el);
                    if (oc) oc.hide();
                }
            });

            $(".btn-del-cmd").click(function () {
                var id = $(this).data("id");
                if (window.eel) eel.deleteHistoryItem(id)(function () { renderHistory(); });
            });
        });
    }

    $("#btnClearHistory").click(function () {
        if (confirm("Clear all task and command history?")) {
            if (window.eel) eel.clearCommandHistory()(function () { renderHistory(); });
        }
    });

    $("#btnRefreshHistory").click(function () { renderHistory(); });

    var historyEl = document.getElementById("historyOffcanvas");
    if (historyEl) {
        historyEl.addEventListener("show.bs.offcanvas", function () { renderHistory(); });
    }

    var settingsEl = document.getElementById("settingsOffcanvas");
    if (settingsEl) {
        settingsEl.addEventListener("show.bs.offcanvas", function () { loadSettings(); });
    }

});