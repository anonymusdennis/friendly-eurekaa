// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (
        () => {

            window.TimeRecordingAI = {
                apiKey: null,
                conversationHistory: [],
                maxHistoryLength: 20,
                historicalContext: null,
                fileContext: null,
                fileContextName: null,
                historyLoaded: false,
                historyLoadingPromise: null,
                pendingFunctionCalls: [],
                pendingDeletion: null,
                aiNotes: [],
                discoveredModels: [],
                modelsLoaded: false,
                calendarHighlights: {},  // {dateKey: {color, label}}
                calendarNotes: {},       // {dateKey: {emoji, text}} — persisted in localStorage
                statusLog: [],           // [{timestamp, type, message}] for status popup

                // Get API base URL from config
                getApiBaseUrl: function () {
                    return TimeRecordingConfig.ai?.apiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
                },

                // Get current AI model endpoint — built dynamically from model name
                getEndpoint: function () {
                    const modelKey = TimeRecordingConfig.ai?.model || 'gemini-2.5-flash';
                    const discovered = this.discoveredModels.find(m => m.id === modelKey);
                    if (discovered) {
                        return `${this.getApiBaseUrl()}/${discovered.name}:generateContent`;
                    }
                    // Fallback: construct from model key
                    return `${this.getApiBaseUrl()}/models/${modelKey}:generateContent`;
                },

                // Get current model name for display
                getModelName: function () {
                    const modelKey = TimeRecordingConfig.ai?.model || 'gemini-2.5-flash';
                    const discovered = this.discoveredModels.find(m => m.id === modelKey);
                    if (discovered) return discovered.displayName;
                    const fallback = TimeRecordingConfig.ai?.fallbackModels || {};
                    return fallback[modelKey]?.name || modelKey;
                },

                // Get current model capabilities
                getModelCapabilities: function () {
                    const modelKey = TimeRecordingConfig.ai?.model || 'gemini-2.5-flash';
                    const discovered = this.discoveredModels.find(m => m.id === modelKey);
                    if (discovered) {
                        return {
                            supportsThinking: discovered.supportsThinking,
                            supportsFunctionCalling: discovered.supportsFunctionCalling,
                            maxOutputTokens: discovered.maxOutputTokens,
                            maxInputTokens: discovered.maxInputTokens
                        };
                    }
                    // Default capabilities for unknown models
                    return {
                        supportsThinking: false,
                        supportsFunctionCalling: true,
                        maxOutputTokens: 8192,
                        maxInputTokens: 1048576
                    };
                },

                // Discover available models via Gemini ListModels API
                listModels: async function () {
                    if (!this.apiKey) return;
                    try {
                        const response = await fetch(
                            `${this.getApiBaseUrl()}/models?key=${this.apiKey}`
                        );
                        if (!response.ok) {
                            throw new Error('ListModels failed: ' + response.status);
                        }
                        const data = await response.json();
                        if (!data.models || !Array.isArray(data.models)) {
                            throw new Error('Invalid ListModels response');
                        }

                        // Filter for models that support generateContent
                        const generateModels = data.models.filter(m =>
                            m.supportedGenerationMethods &&
                            m.supportedGenerationMethods.includes('generateContent')
                        );

                        // Map to our internal format
                        this.discoveredModels = generateModels.map(m => {
                            const id = m.name.replace('models/', '');
                            const isThinking = id.includes('thinking') ||
                                (m.description && m.description.toLowerCase().includes('thinking'));
                            return {
                                id: id,
                                name: m.name,
                                displayName: m.displayName || id,
                                description: m.description || '',
                                maxInputTokens: m.inputTokenLimit || 0,
                                maxOutputTokens: m.outputTokenLimit || 0,
                                supportsThinking: isThinking || id.includes('2.5'),
                                supportsFunctionCalling: true,
                                temperature: m.temperature,
                                topP: m.topP,
                                topK: m.topK
                            };
                        });

                        // Sort: gemini-2.5 models first, then by name
                        this.discoveredModels.sort((a, b) => {
                            const a25 = a.id.includes('2.5') ? 0 : 1;
                            const b25 = b.id.includes('2.5') ? 0 : 1;
                            if (a25 !== b25) return a25 - b25;
                            return a.displayName.localeCompare(b.displayName);
                        });

                        this.modelsLoaded = true;
                        TimeRecordingUtils.log('info', `Discovered ${this.discoveredModels.length} available models`);

                        // Validate current model exists in discovered list
                        const currentModel = TimeRecordingConfig.ai?.model || 'gemini-2.5-flash';
                        const modelExists = this.discoveredModels.some(m => m.id === currentModel);
                        if (!modelExists && this.discoveredModels.length > 0) {
                            // Find closest match or use first 2.5 model
                            const preferred = this.discoveredModels.find(m => m.id.includes('2.5-flash')) ||
                                            this.discoveredModels.find(m => m.id.includes('flash')) ||
                                            this.discoveredModels[0];
                            TimeRecordingConfig.ai.model = preferred.id;
                            TimeRecordingUtils.log('info', `Model ${currentModel} not available, switched to ${preferred.id}`);
                        }

                        // Update UI dropdown
                        this.updateModelDropdown();

                    } catch (error) {
                        TimeRecordingUtils.log('warning', 'Failed to discover models, using fallbacks: ' + error.message);
                        // Build discovered models from fallback config
                        const fallback = TimeRecordingConfig.ai?.fallbackModels || {};
                        this.discoveredModels = Object.entries(fallback).map(([id, info]) => ({
                            id: id,
                            name: 'models/' + id,
                            displayName: info.name || id,
                            description: info.description || '',
                            maxInputTokens: 1048576,
                            maxOutputTokens: 8192,
                            supportsThinking: id.includes('2.5'),
                            supportsFunctionCalling: true
                        }));
                        this.modelsLoaded = true;
                        this.updateModelDropdown();
                    }
                },

                // Update the model dropdown in the UI
                updateModelDropdown: function () {
                    const dropdown = document.getElementById('trAIModelSelect');
                    if (!dropdown) return;
                    const currentModel = TimeRecordingConfig.ai?.model || 'gemini-2.5-flash';
                    dropdown.innerHTML = '';
                    this.discoveredModels.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.id;
                        opt.textContent = m.displayName;
                        opt.title = m.description;
                        opt.style.color = '#333';
                        opt.style.background = 'white';
                        if (m.id === currentModel) opt.selected = true;
                        dropdown.appendChild(opt);
                    });
                },

                // Initialize AI module — load API key from storage
                init: async function (apiKey) {
                    // Load persisted calendar notes
                    this.loadCalendarNotes();
                    // Load persisted context files
                    this.loadContextFiles();
                    // If key passed directly, save it; otherwise load from storage
                    if (apiKey) {
                        this.apiKey = apiKey;
                        this.saveApiKey(apiKey);
                    } else {
                        this.apiKey = this.loadApiKey();
                    }
                    if (!this.apiKey) {
                        TimeRecordingUtils.log('warning', 'AI module initialized without API key');
                        return;
                    }
                    // Discover available models on init
                    await this.listModels();
                    // Restore selected model after models are loaded
                    this.restoreSelectedModel();
                },

                // Save API key to localStorage
                saveApiKey: function (key) {
                    TimeRecordingUtils.storage.save('ai_api_key', key);
                },

                // Load API key from localStorage
                loadApiKey: function () {
                    return TimeRecordingUtils.storage.load('ai_api_key', null);
                },

                // Remove API key from localStorage
                removeApiKey: function () {
                    TimeRecordingUtils.storage.remove('ai_api_key');
                    this.apiKey = null;
                    this.discoveredModels = [];
                    this.modelsLoaded = false;
                },

                // Prompt user for API key and store it
                promptForApiKey: async function () {
                    const key = prompt(
                        'Enter your Google Gemini API key:\n\n' +
                        'Get one free at: https://aistudio.google.com/apikey\n\n' +
                        'The key is stored locally in your browser and never sent anywhere except the Gemini API.'
                    );
                    if (key && key.trim()) {
                        this.apiKey = key.trim();
                        this.saveApiKey(this.apiKey);
                        this.addMessage('model', '\u{1F511} API key saved! Discovering available models...');
                        await this.listModels();
                        this.addMessage('model', '\u2705 Ready! Found **' + this.discoveredModels.length + '** models. Using **' + this.getModelName() + '**.');
                    } else {
                        this.addMessage('model', '\u274C No API key provided. AI features are disabled.\n\nClick \u{1F511} to set your API key.');
                    }
                },

                // Initialize chat interface
                initializeChat: function () {
                    if (!this.apiKey) {
                        this.addMessage('model', '\u{1F511} **API key not configured.** Click the \u{1F511} button above to enter your Gemini API key.\n\nGet a free key at: https://aistudio.google.com/apikey');
                        return;
                    }

                    // Try to restore previous chat session
                    if (this.loadChatHistory()) {
                        // Chat restored from previous session
                        if (this.contextFiles && this.contextFiles.length > 0) {
                            const names = this.contextFiles.map(f => f.name).join(', ');
                            // Don't add as persistent message, just show info
                            const container = document.getElementById('trAIChatMessages');
                            if (container) {
                                const infoDiv = document.createElement('div');
                                infoDiv.style.cssText = 'padding:6px 10px;background:#f0f4ff;border-radius:6px;font-size:11px;color:#667eea;margin-bottom:8px;';
                                infoDiv.textContent = '\u{1F4C2} Context files active: ' + names;
                                container.appendChild(infoDiv);
                                container.scrollTop = container.scrollHeight;
                            }
                        }
                        return;
                    }

                    if (this.conversationHistory.length === 0) {
                        this.addMessage('model', [
                            'Hello! I\'m your Time Recording AI Assistant (powered by **' + this.getModelName() + '**). Here\'s what I can do:\n',
                            '\u{1F4DD} **Record time** \u2014 Tell me what you did: "I refactored the auth module on Monday"',
                            '\u270F\uFE0F **Edit records** \u2014 "Change my Monday entry to 6 hours"',
                            '\u{1F5D1}\uFE0F **Delete records** \u2014 "Delete the admin entry from yesterday"',
                            '\u{1F50D} **Search & review** \u2014 "What did I work on last week?" or "Find all platform entries"',
                            '\u{1F9E0} **Smart thinking** \u2014 I plan my approach before acting on complex requests',
                            '\u{1F4CA} **Load history** \u2014 Click \u{1F4CA} to load past records so I understand your work patterns',
                            '\u{1F4CE} **Upload context** \u2014 Click \u{1F4CE} to upload a project/task reference file',
                            '\u{1F4CB} **Clipboard analysis** \u2014 Click \u{1F4CB} and I\'ll extract work from your clipboard',
                            '\u2696\uFE0F **Realistic hours** \u2014 Development ~7.5h + admin ~0.5h per day',
                            '\u{1F504} **Self-correcting** \u2014 I validate entries and auto-retry if something goes wrong',
                            '\u{1F527} **Switch model** \u2014 Use the dropdown or type "switch to pro"',
                            '\u{1F511} **API key** \u2014 Click \u{1F511} to manage your API key (stored locally)',
                            '\nJust describe what you worked on and I\'ll suggest accurate time entries!'
                        ].join('\n'));

                        // Proactive: check for missing days and offer to help
                        if (TimeRecordingConfig.ai?.enableProactiveSuggestions) {
                            this.offerProactiveSuggestions();
                        }
                    }
                },

                // Proactive: check for missing days and offer to help
                offerProactiveSuggestions: async function () {
                    try {
                        const monthData = TimeRecordingCalendar.monthData;
                        if (!monthData || !monthData.days) return;

                        const missingDays = monthData.days.filter(
                            d => d.isWorkDay && !d.isHoliday && !d.isFuture && d.totalHours === 0
                        );

                        if (missingDays.length > 0 && missingDays.length <= 10) {
                            const dates = missingDays.slice(0, 5).map(d =>
                                TimeRecordingUtils.formatDisplayDate(d.date) + ' (' + d.dayName + ')'
                            ).join(', ');
                            const more = missingDays.length > 5 ? ' and ' + (missingDays.length - 5) + ' more' : '';

                            setTimeout(() => {
                                this.addMessage('model', '\u{1F4A1} **Quick tip:** You have **' + missingDays.length + ' missing days** this month: ' + dates + more + '.\n\nTell me what you worked on and I\'ll fill them in! Or type "fill missing days" and I\'ll suggest entries based on your recent patterns.');
                            }, 2000);
                        }
                    } catch (e) {
                        // Silent fail
                    }
                },

                // Load historical records for AI context
                loadHistoricalRecords: async function (months) {
                    if (this.historyLoadingPromise) {
                        this.addMessage('model', '\u23F3 History is already being loaded, please wait...');
                        return this.historyLoadingPromise;
                    }

                    this.addMessage('model', '\u{1F4CA} Loading ' + months + ' months of historical records... This may take a moment.');
                    this.showTypingIndicator();

                    this.historyLoadingPromise = (async () => {
                        try {
                            const records = await TimeRecordingAPI.fetchHistoricalRecords(months);
                            this.historicalContext = TimeRecordingAPI.summarizeHistoricalRecords(records);
                            this.historyLoaded = true;
                            this.hideTypingIndicator();

                            if (this.historicalContext) {
                                const summary = this.historicalContext;
                                let msg = '\u2705 **History loaded!** ' + summary.totalRecords + ' records from ' + summary.periodStart + ' to ' + summary.periodEnd + ' (' + summary.totalHours + 'h total)\n\n';
                                msg += '**Top projects by hours:**\n';
                                summary.topProjects.slice(0, 8).forEach((p, i) => {
                                    msg += (i + 1) + '. ' + (p.projectDesc || p.projectId) + ' \u2014 ' + p.totalHours.toFixed(1) + 'h (' + p.count + ' entries, avg ' + p.avgHoursPerEntry + 'h)\n';
                                });
                                msg += '\nI now have deep context about your work patterns and can make much better suggestions!';
                                this.addMessage('model', msg);
                            } else {
                                this.addMessage('model', '\u26A0\uFE0F No historical records found for the specified period.');
                            }
                        } catch (error) {
                            this.hideTypingIndicator();
                            this.addMessage('model', '\u274C Failed to load history: ' + error.message);
                        } finally {
                            this.historyLoadingPromise = null;
                        }
                    })();

                    return this.historyLoadingPromise;
                },

                // Process uploaded file as context
                processFileUpload: function (content, filename) {
                    const maxLen = TimeRecordingConfig.ai?.maxFileContextLength || 100000;
                    if (content.length > maxLen) {
                        content = content.substring(0, maxLen);
                        this.addMessage('model', '\u26A0\uFE0F File was truncated to ' + maxLen + ' characters to fit context limits.');
                    }
                    this.addContextFile(filename, content);
                    this.addMessage('model', '\u{1F4CE} **File loaded:** "' + filename + '" (' + content.length + ' chars)\nThis context will be included in all future AI requests and persists between sessions.\nUse \u{1F4C2} to manage context files.');
                },

                // Process clipboard content
                processClipboardContent: async function (clipboardText) {
                    if (!clipboardText || !clipboardText.trim()) {
                        this.addMessage('model', '\u{1F4CB} Clipboard is empty. Please copy some text first.');
                        return;
                    }

                    const maxLen = TimeRecordingConfig.ai?.maxClipboardLength || 50000;
                    if (clipboardText.length > maxLen) {
                        clipboardText = clipboardText.substring(0, maxLen);
                    }

                    const clipboardPrompt = 'CLIPBOARD CONTENT ANALYSIS:\nThe user pasted clipboard content. Extract WHAT WORK was done, WHICH DAYS it relates to, and match to the best project/task using history and favorites.\nUse context clues and patterns to infer dates when possible.\n\nCLIPBOARD:\n---\n' + clipboardText + '\n---\n\nAnalyze and suggest time entries. Use your best judgment for dates and projects.';

                    await this.sendMessage(clipboardPrompt);
                },

                // Send message with enhanced context, function calling, and auto-retry
                sendMessage: async function (message) {
                    if (!this.apiKey) {
                        this.addMessage('user', message);
                        this.addMessage('model', 'Please configure the AI with an API key first.');
                        return;
                    }

                    // Check for model switch command (text-based)
                    const lowerMsg = message.toLowerCase().trim();
                    const switchMatch = lowerMsg.match(/^(?:switch to|use)\s+(.+)$/);
                    if (switchMatch) {
                        const searchTerm = switchMatch[1].trim();
                        const match = this.discoveredModels.find(m =>
                            m.id.toLowerCase().includes(searchTerm) ||
                            m.displayName.toLowerCase().includes(searchTerm)
                        );
                        if (match) {
                            this.switchModel(match.id);
                            return;
                        }
                        // Show available models if no match
                        const available = this.discoveredModels.map(m => m.displayName).join(', ');
                        this.addMessage('user', message);
                        this.addMessage('model', '\u274C No model matching "' + searchTerm + '". Available: ' + available);
                        return;
                    }

                    // Handle pending deletion confirmation
                    if (this.pendingDeletion) {
                        const pending = this.pendingDeletion;
                        this.pendingDeletion = null;

                        if (lowerMsg === 'yes, delete' || lowerMsg === 'yes delete' || lowerMsg === 'yes' || lowerMsg === 'confirm') {
                            this.addMessage('user', message);
                            try {
                                const deletePayload = { ...pending.record, Mode: 'D' };
                                const result = await TimeRecordingEdit.updateTimeRecord(deletePayload);
                                if (result) {
                                    TimeRecordingCalendar.refresh();
                                    this.addMessage('model', '\u2705 Record deleted successfully! (Counter: ' + pending.counter + ' on ' + pending.date + ')');
                                } else {
                                    this.addMessage('model', '\u274C Deletion may have failed \u2014 SAP returned no result. Please check the calendar.');
                                }
                            } catch (error) {
                                this.addMessage('model', '\u274C Failed to delete record: ' + error.message);
                            }
                            return;
                        } else {
                            this.addMessage('user', message);
                            this.addMessage('model', '\u274C Deletion cancelled.');
                            // Don't return — let the message flow to the AI as a normal message
                            if (lowerMsg === 'cancel' || lowerMsg === 'no') return;
                        }
                    }

                    this.addMessage('user', message);

                    const context = await this.prepareEnhancedContext();
                    this.showTypingIndicator();
                    this.logStatus('thinking', 'Processing: ' + message.substring(0, 80) + (message.length > 80 ? '...' : ''));

                    try {
                        const maxRetries = TimeRecordingConfig.ai?.maxRetries || 3;
                        const retryDelay = TimeRecordingConfig.ai?.retryDelayMs || 1500;
                        let lastError = null;

                        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                            try {
                                const result = await this.callGeminiWithFunctions(message, context, attempt > 1 ? lastError : null);

                                this.hideTypingIndicator();
                                this.logStatus('info', 'Response received');

                                // If the result was handled by function calling (askUser), don't process further
                                if (result === '__ASKED_USER__') return;

                                // If the result was handled by createTimeEntry (review dialog shown), don't process further
                                if (result === '__CREATED_ENTRIES__') return;

                                // If the result was handled by deleteExistingRecord (confirmation prompt shown), don't process further
                                if (result === '__PENDING_DELETION__') return;

                                this.processAIResponse(result);
                                return;

                            } catch (error) {
                                lastError = error.message;
                                TimeRecordingUtils.log('warning', 'AI attempt ' + attempt + '/' + maxRetries + ' failed: ' + error.message);

                                if (attempt < maxRetries) {
                                    await new Promise(r => setTimeout(r, retryDelay * attempt));
                                } else {
                                    throw error;
                                }
                            }
                        }
                    } catch (error) {
                        this.hideTypingIndicator();
                        this.logStatus('error', 'Failed: ' + error.message);
                        TimeRecordingUtils.log('error', 'AI request failed after retries', error);
                        this.addMessage('model', '\u274C Sorry, I encountered an error after multiple attempts. Error: ' + error.message + '\n\nPlease try again or rephrase your request.');
                    }
                },

                // Switch AI model
                switchModel: function (modelKey) {
                    const discovered = this.discoveredModels.find(m => m.id === modelKey);
                    if (discovered) {
                        TimeRecordingConfig.ai.model = modelKey;
                        const caps = [];
                        if (discovered.supportsThinking) caps.push('thinking');
                        if (discovered.supportsFunctionCalling) caps.push('function calling');
                        const capsStr = caps.length > 0 ? ' | Supports: ' + caps.join(', ') : '';
                        this.addMessage('model', '\u{1F504} Switched to **' + discovered.displayName + '**' + capsStr);
                        this.updateModelDropdown();
                    } else {
                        const available = this.discoveredModels.map(m => m.displayName).join(', ');
                        this.addMessage('model', '\u274C Unknown model: ' + modelKey + '. Available: ' + (available || 'none discovered'));
                    }
                }
            };

        }
    ).toString() + ')();';
    document.head.appendChild(el);
}
