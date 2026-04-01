// Time Recording Calendar - AI Chat Module
var appcontent = document.querySelector("body");
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (
        () => {
            Object.assign(window.TimeRecordingAI, {
                // Main API call with native function calling support
                callGeminiWithFunctions: async function (message, context, previousError) {
                    const systemPrompt = this.buildSystemPrompt(context);
                    const useFunctionCalling = TimeRecordingConfig.ai?.enableFunctionCalling !== false;

                    const userParts = [{ text: message }];
                    if (previousError) {
                        userParts.push({ text: '\n[RETRY \u2014 Previous attempt failed: ' + previousError + '. Please fix and try again.]' });
                    }

                    const requestBody = {
                        system_instruction: { parts: { text: systemPrompt } },
                        contents: [
                            ...context.chatHistory,
                            { role: "user", parts: userParts }
                        ],
                        generationConfig: this.buildGenerationConfig(),
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                        ]
                    };

                    if (useFunctionCalling) {
                        requestBody.tools = [{ functionDeclarations: this.getFunctionDeclarations() }];
                    }

                    const response = await fetch(
                        this.getEndpoint() + '?key=' + this.apiKey,
                        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }
                    );

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error?.message || 'API request failed: ' + response.status);
                    }

                    const data = await response.json();

                    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                        throw new Error('Invalid response from AI');
                    }

                    const parts = data.candidates[0].content.parts || [];

                    // Check for function calls
                    const functionCallPart = parts.find(p => p.functionCall);
                    if (functionCallPart) {
                        return await this.handleFunctionCallResponse(functionCallPart.functionCall, message, context, data);
                    }

                    // Extract text from last text part (skip thinking parts)
                    const textParts = parts.filter(p => p.text !== undefined);
                    if (textParts.length === 0) {
                        throw new Error('No text in AI response');
                    }

                    return textParts[textParts.length - 1].text;
                },

                // Handle function call responses from Gemini (supports chaining)
                handleFunctionCallResponse: async function (functionCall, originalMessage, context, originalData, _depth) {
                    const depth = _depth || 0;
                    const maxAutoContinue = 3;
                    const name = functionCall.name;
                    const args = functionCall.args || {};
                    TimeRecordingUtils.log('info', 'AI called function: ' + name, args);
                    this.logStatus('function', name + '(' + Object.keys(args).join(', ') + ')');

                    const result = await this.executeFunctionByName(name, args);

                    // If askUser, the message was already displayed
                    if (name === 'askUser') {
                        this.hideTypingIndicator();
                        return '__ASKED_USER__';
                    }

                    // If createTimeEntry, the review dialog was shown — stop the chain
                    if (name === 'createTimeEntry') {
                        this.hideTypingIndicator();
                        return '__CREATED_ENTRIES__';
                    }

                    // If deleteExistingRecord, the confirmation prompt was shown — stop the chain and wait for user
                    if (name === 'deleteExistingRecord') {
                        this.hideTypingIndicator();
                        return '__PENDING_DELETION__';
                    }

                    // Send function result back to Gemini
                    const contents = [
                        ...context.chatHistory,
                        { role: "user", parts: [{ text: originalMessage }] },
                        originalData.candidates[0].content,
                        {
                            role: "user",
                            parts: [{
                                functionResponse: {
                                    name: name,
                                    response: { result: JSON.stringify(result) }
                                }
                            }]
                        }
                    ];

                    const functionResponseBody = {
                        system_instruction: { parts: { text: this.buildSystemPrompt(context) } },
                        contents: contents,
                        generationConfig: this.buildGenerationConfig(),
                        safetySettings: [
                            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                        ],
                        tools: [{ functionDeclarations: this.getFunctionDeclarations() }]
                    };

                    const followUpResponse = await fetch(
                        this.getEndpoint() + '?key=' + this.apiKey,
                        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(functionResponseBody) }
                    );

                    if (!followUpResponse.ok) {
                        const errorData = await followUpResponse.json().catch(() => ({}));
                        throw new Error(errorData.error?.message || 'Follow-up API request failed: ' + followUpResponse.status);
                    }

                    const followUpData = await followUpResponse.json();
                    const followUpParts = followUpData.candidates?.[0]?.content?.parts || [];

                    // Check for another function call (chained calls)
                    const nextFunctionCall = followUpParts.find(p => p.functionCall);
                    if (nextFunctionCall) {
                        return await this.handleFunctionCallResponse(nextFunctionCall.functionCall, originalMessage, context, followUpData, depth);
                    }

                    const textParts = followUpParts.filter(p => p.text !== undefined);
                    if (textParts.length > 0) {
                        return textParts[textParts.length - 1].text;
                    }

                    // No text response — auto-continue by nudging the AI to keep going
                    if (depth < maxAutoContinue) {
                        TimeRecordingUtils.log('info', 'AI returned no text after function call, auto-continuing (attempt ' + (depth + 1) + '/' + maxAutoContinue + ')');
                        this.logStatus('thinking', 'No text response, nudging AI to continue (' + (depth + 1) + '/' + maxAutoContinue + ')...');

                        // Add the AI's empty response and a nudge to continue
                        const nudgeContents = [
                            ...contents
                        ];
                        if (followUpData.candidates?.[0]?.content) {
                            nudgeContents.push(followUpData.candidates[0].content);
                        }
                        nudgeContents.push({
                            role: "user",
                            parts: [{ text: "You processed the function data but didn't provide a response. Please continue and provide your complete response to the user based on the data you received." }]
                        });

                        const nudgeBody = {
                            system_instruction: { parts: { text: this.buildSystemPrompt(context) } },
                            contents: nudgeContents,
                            generationConfig: this.buildGenerationConfig(),
                            safetySettings: [
                                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                            ],
                            tools: [{ functionDeclarations: this.getFunctionDeclarations() }]
                        };

                        const nudgeResponse = await fetch(
                            this.getEndpoint() + '?key=' + this.apiKey,
                            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nudgeBody) }
                        );

                        if (nudgeResponse.ok) {
                            const nudgeData = await nudgeResponse.json();
                            const nudgeParts = nudgeData.candidates?.[0]?.content?.parts || [];

                            // Check for function call in nudge response
                            const nudgeFunctionCall = nudgeParts.find(p => p.functionCall);
                            if (nudgeFunctionCall) {
                                return await this.handleFunctionCallResponse(nudgeFunctionCall.functionCall, originalMessage, context, nudgeData, depth + 1);
                            }

                            const nudgeTextParts = nudgeParts.filter(p => p.text !== undefined);
                            if (nudgeTextParts.length > 0) {
                                return nudgeTextParts[nudgeTextParts.length - 1].text;
                            }
                        }

                        // Recurse with incremented depth if still no response
                        return await this.handleFunctionCallResponse(functionCall, originalMessage, context, originalData, depth + 1);
                    }

                    // Exhausted auto-continue attempts — return a more helpful fallback
                    TimeRecordingUtils.log('warning', 'AI returned no text after ' + maxAutoContinue + ' auto-continue attempts');
                    return 'I processed the data from ' + name + ' but the AI did not generate a text response after ' + maxAutoContinue + ' attempts. Please try asking your question again or rephrase it.';
                },

                // Process AI response with self-validation
                processAIResponse: function (response) {
                    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

                    if (jsonMatch) {
                        try {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            const textBefore = response.substring(0, response.indexOf('```json')).trim();
                            const textAfter = response.substring(response.indexOf('```', response.indexOf('```json') + 7) + 3).trim();

                            let message = '';
                            if (textBefore) message += textBefore + '\n\n';
                            if (textAfter) message += '\n' + textAfter;

                            this.addMessage('model', message || 'Here are the suggested time entries:', jsonData);

                            if (jsonData.entries && jsonData.entries.length > 0) {
                                // Self-validation
                                if (TimeRecordingConfig.ai?.enableSelfValidation !== false) {
                                    const warnings = this.validateEntries(jsonData.entries);
                                    if (warnings.length > 0) {
                                        this.addMessage('model', '\u26A0\uFE0F **Validation warnings:**\n' + warnings.join('\n') + '\n\nYou can still import \u2014 or ask me to fix these.');
                                    }
                                }
                                this.showEntryReviewDialog(jsonData.entries);
                            }
                        } catch (error) {
                            TimeRecordingUtils.log('error', 'Failed to parse JSON from AI response', error);
                            this.addMessage('model', response);
                        }
                    } else {
                        this.addMessage('model', response);
                    }
                },

                // Self-validate entries before import
                validateEntries: function (entries) {
                    const warnings = [];
                    const favorites = TimeRecordingAPI.getUserFavorites();
                    const favProjectIds = new Set(favorites.map(f => f.AccProjId));

                    // Group by date
                    const byDate = {};
                    entries.forEach(e => {
                        if (!byDate[e.date]) byDate[e.date] = [];
                        byDate[e.date].push(e);
                    });

                    for (const date of Object.keys(byDate)) {
                        const dayEntries = byDate[date];
                        const totalHours = dayEntries.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);

                        if (Math.abs(totalHours - 8.0) > 0.01) {
                            warnings.push('\u2022 ' + date + ': Total hours = ' + totalHours.toFixed(2) + 'h (expected 8.0h)');
                        }

                        dayEntries.forEach(e => {
                            if (e.AccountInd === '90' && parseFloat(e.hours) > 1.0) {
                                warnings.push('\u2022 ' + date + ': Non-billable entry "' + e.description + '" has ' + e.hours + 'h (max recommended: 0.5h)');
                            }
                        });
                    }

                    // Check project IDs
                    entries.forEach(e => {
                        if (e.projectId && !favProjectIds.has(e.projectId)) {
                            const knownPrefixes = ['2911.IN.', '2911.AD.', '2911.TR.'];
                            const isKnown = knownPrefixes.some(p => e.projectId.startsWith(p));
                            if (!isKnown) {
                                warnings.push('\u2022 Unknown project ID: ' + e.projectId + ' (not in favorites)');
                            }
                        }
                    });

                    // Check for duplicate descriptions
                    const seen = new Set();
                    entries.forEach(e => {
                        const d = (e.description || '').toLowerCase().trim();
                        if (d && seen.has(d)) {
                            warnings.push('\u2022 Duplicate description: "' + e.description + '"');
                        }
                        seen.add(d);
                    });

                    return warnings;
                },

                // Show entry review dialog
                showEntryReviewDialog: function (entries) {
                    const existing = document.getElementById('trEntryReviewDialog');
                    if (existing) existing.remove();

                    const dialog = document.createElement('div');
                    dialog.id = 'trEntryReviewDialog';
                    dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10001;width:800px;max-height:80vh;display:flex;flex-direction:column;';

                    dialog.innerHTML = '<div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:20px;color:white;border-radius:12px 12px 0 0;"><h3 style="margin:0;">Review Time Entries</h3><p style="margin:5px 0 0;opacity:0.9;font-size:14px;">\u2705 Select entries to import \u2022 \u270F\uFE0F Click to edit \u2022 \u{1F916} Use input to ask AI changes</p></div><div style="flex:1;overflow-y:auto;padding:20px;"><div id="trEntryList"></div></div><div style="padding:20px;border-top:1px solid #dee2e6;display:flex;gap:10px;justify-content:space-between;"><div style="flex:1;"><input type="text" id="trEntryEditInput" placeholder="Ask AI to modify entries... e.g. \'change project to Platform\'" style="width:100%;padding:10px;border:1px solid #dee2e6;border-radius:6px;"></div><button id="trImportSelected" style="padding:10px 20px;background:#28a745;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">\u2705 Import Selected</button><button id="trCancelReview" style="padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;">Cancel</button></div>';

                    document.body.appendChild(dialog);

                    const entryList = document.getElementById('trEntryList');
                    entries.forEach((entry, index) => {
                        const entryDiv = document.createElement('div');
                        entryDiv.style.cssText = 'padding:15px;margin-bottom:10px;border:2px solid #dee2e6;border-radius:8px;cursor:pointer;transition:all 0.2s;';

                        const dateFormatted = entry.date.substr(6, 2) + '.' + entry.date.substr(4, 2) + '.' + entry.date.substr(0, 4);
                        const acctInd = entry.accountInd || entry.AccountInd || '10';
                        const billableIcon = acctInd === '90' ? '\u{1F537}' : '\u{1F7E2}';
                        const ticketLine = entry.jiraTicketId ? '<div style="color:#0052CC;font-size:13px;margin-bottom:3px;">\u{1F3AB} Jira: ' + entry.jiraTicketId + '</div>' : '';

                        entryDiv.innerHTML = '<div style="display:flex;align-items:center;gap:15px;"><input type="checkbox" checked data-index="' + index + '" style="width:20px;height:20px;cursor:pointer;"><div style="flex:1;"><div style="font-weight:bold;margin-bottom:5px;">\u{1F4C5} ' + dateFormatted + ' \u2014 ' + entry.hours + 'h ' + billableIcon + '</div><div style="color:#666;font-size:14px;margin-bottom:3px;">\u{1F4C1} ' + entry.projectId + ' / ' + entry.taskId + '</div>' + ticketLine + '<div style="color:#333;">\u{1F4DD} ' + entry.description + '</div></div></div>';

                        entryList.appendChild(entryDiv);

                        entryDiv.onclick = (e) => {
                            if (e.target.type !== 'checkbox') {
                                const input = document.getElementById('trEntryEditInput');
                                input.value = 'Change entry ' + (index + 1) + ' (' + dateFormatted + '): ';
                                input.focus();
                            }
                        };
                    });

                    document.getElementById('trImportSelected').onclick = () => {
                        const selected = [];
                        document.querySelectorAll('#trEntryList input[type="checkbox"]:checked').forEach(cb => {
                            selected.push(entries[parseInt(cb.dataset.index)]);
                        });
                        if (selected.length > 0) {
                            this.importTimeEntries(selected);
                            dialog.remove();
                        } else {
                            alert('Please select at least one entry to import');
                        }
                    };

                    document.getElementById('trCancelReview').onclick = () => dialog.remove();

                    document.getElementById('trEntryEditInput').onkeypress = async (e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                            const msg = e.target.value.trim();
                            dialog.remove();
                            await this.sendMessage(msg);
                        }
                    };
                },

                // Import time entries with smart error recovery
                importTimeEntries: async function (entries) {
                    console.log('Importing time entries from AI:', entries);

                    const validEntries = entries.filter(entry =>
                        entry.date && entry.projectId && entry.hours && entry.description
                    );

                    if (validEntries.length === 0) {
                        alert('No valid entries to import');
                        return;
                    }

                    const error = await TimeRecordingUI.recordTimeEntries(validEntries);

                    if (error) {
                        this.addMessage('model', '\u26A0\uFE0F Some entries failed. Asking AI to auto-correct...');
                        this.sendMessage('Errors occurred during import. Please fix and regenerate ONLY the failed entries:\n\nErrors:\n' + error.map(err => err.date + ': ' + err.error).join('\n') + '\n\nOriginal entries:\n' + JSON.stringify(validEntries, null, 2) + '\n\nFix the issues and output corrected entries.');
                        return;
                    }

                    this.addMessage('model', '\u2705 Successfully imported ' + validEntries.length + ' time ' + (validEntries.length === 1 ? 'entry' : 'entries') + '! Calendar is refreshing...');
                },

                // Add message to chat with markdown rendering
                addMessage: function (sender, content, data) {
                    data = data || null;
                    const container = document.getElementById('trAIChatMessages');
                    if (!container) return;

                    const modelName = this.getModelName();
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'tr-ai-message tr-ai-message-' + sender;
                    messageDiv.style.marginBottom = '10px';

                    let displayContent = content;
                    displayContent = displayContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                    displayContent = displayContent.replace(/_([^_]+)_/g, '<em>$1</em>');
                    if (!displayContent.includes('<pre')) {
                        displayContent = displayContent.replace(/\n/g, '<br>');
                    }

                    messageDiv.innerHTML = '<div style="font-size:11px;color:#666;margin-bottom:5px;font-weight:bold;">' + (sender === 'user' ? '\u{1F464} You' : '\u{1F916} ' + modelName) + '</div><div style="font-size:13px;line-height:1.5;">' + displayContent + '</div>';

                    container.appendChild(messageDiv);

                    this.conversationHistory.push({ sender: sender, content: content, data: data, timestamp: new Date(), modelName: modelName });
                    if (this.conversationHistory.length > this.maxHistoryLength) {
                        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
                    }
                    this.saveChatHistory();

                    container.scrollTop = container.scrollHeight;
                },

                showTypingIndicator: function () {
                    const container = document.getElementById('trAIChatMessages');
                    if (!container) return;
                    const indicator = document.createElement('div');
                    indicator.id = 'trAITypingIndicator';
                    indicator.className = 'tr-ai-message tr-ai-message-assistant';
                    indicator.style.marginBottom = '10px';
                    indicator.innerHTML = '<div style="color:#666;font-style:italic;">\u{1F916} ' + this.getModelName() + ' is thinking...</div>';
                    container.appendChild(indicator);
                    container.scrollTop = container.scrollHeight;
                },

                hideTypingIndicator: function () {
                    const indicator = document.getElementById('trAITypingIndicator');
                    if (indicator) indicator.remove();
                },

                clearChat: function () {
                    const container = document.getElementById('trAIChatMessages');
                    if (container) container.innerHTML = '';
                    this.conversationHistory = [];
                    this.saveChatHistory();
                    this.initializeChat();
                },

                exportConversation: function () {
                    return this.conversationHistory;
                },

                // --- Persistence: Chat History ---
                saveChatHistory: function () {
                    try {
                        const toSave = this.conversationHistory.map(msg => ({
                            sender: msg.sender,
                            content: msg.content,
                            timestamp: msg.timestamp
                        }));
                        TimeRecordingUtils.storage.save('ai_chat_history', toSave);
                    } catch (e) {
                        TimeRecordingUtils.log('warning', 'Failed to save chat history', e);
                    }
                },

                loadChatHistory: function () {
                    try {
                        const saved = TimeRecordingUtils.storage.load('ai_chat_history', []);
                        if (saved && saved.length > 0) {
                            this.conversationHistory = saved;
                            const container = document.getElementById('trAIChatMessages');
                            if (container) {
                                saved.forEach(msg => {
                                    const messageDiv = document.createElement('div');
                                    messageDiv.className = 'tr-ai-message tr-ai-message-' + msg.sender;
                                    messageDiv.style.marginBottom = '10px';
                                    let displayContent = msg.content;
                                    displayContent = displayContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                                    displayContent = displayContent.replace(/_([^_]+)_/g, '<em>$1</em>');
                                    if (!displayContent.includes('<pre')) {
                                        displayContent = displayContent.replace(/\n/g, '<br>');
                                    }
                                    const safeModelName = (msg.modelName || 'AI').replace(/[<>&"']/g, '');
                                    const label = msg.sender === 'user' ? '\u{1F464} You' : '\u{1F916} ' + safeModelName;
                                    messageDiv.innerHTML = '<div style="font-size:11px;color:#666;margin-bottom:5px;font-weight:bold;">' + label + '</div><div style="font-size:13px;line-height:1.5;">' + displayContent + '</div>';
                                    container.appendChild(messageDiv);
                                });
                                container.scrollTop = container.scrollHeight;
                            }
                            return true;
                        }
                    } catch (e) {
                        TimeRecordingUtils.log('warning', 'Failed to load chat history', e);
                    }
                    return false;
                },

                // --- Persistence: Context Files ---
                saveContextFiles: function () {
                    try {
                        const files = this.contextFiles || [];
                        TimeRecordingUtils.storage.save('ai_context_files', files);
                    } catch (e) {
                        TimeRecordingUtils.log('warning', 'Failed to save context files', e);
                    }
                },

                loadContextFiles: function () {
                    try {
                        const saved = TimeRecordingUtils.storage.load('ai_context_files', []);
                        if (saved && saved.length > 0) {
                            this.contextFiles = saved;
                            // Set the active context from first file for backward compatibility
                            this.fileContext = saved.map(f => f.content).join('\n\n---\n\n');
                            this.fileContextName = saved.map(f => f.name).join(', ');
                            return true;
                        }
                    } catch (e) {
                        TimeRecordingUtils.log('warning', 'Failed to load context files', e);
                    }
                    this.contextFiles = [];
                    return false;
                },

                addContextFile: function (name, content) {
                    if (!this.contextFiles) this.contextFiles = [];
                    // Replace if same name exists
                    this.contextFiles = this.contextFiles.filter(f => f.name !== name);
                    this.contextFiles.push({ name: name, content: content, addedAt: new Date().toISOString(), size: content.length });
                    this.fileContext = this.contextFiles.map(f => f.content).join('\n\n---\n\n');
                    this.fileContextName = this.contextFiles.map(f => f.name).join(', ');
                    this.saveContextFiles();
                },

                removeContextFile: function (name) {
                    if (!this.contextFiles) return;
                    this.contextFiles = this.contextFiles.filter(f => f.name !== name);
                    if (this.contextFiles.length > 0) {
                        this.fileContext = this.contextFiles.map(f => f.content).join('\n\n---\n\n');
                        this.fileContextName = this.contextFiles.map(f => f.name).join(', ');
                    } else {
                        this.fileContext = null;
                        this.fileContextName = null;
                    }
                    this.saveContextFiles();
                },

                // --- Persistence: Selected Model ---
                saveSelectedModel: function () {
                    try {
                        const select = document.getElementById('trAIModelSelect');
                        if (select && select.value) {
                            TimeRecordingUtils.storage.save('ai_selected_model', select.value);
                        }
                    } catch (e) {
                        TimeRecordingUtils.log('warning', 'Failed to save selected model', e);
                    }
                },

                loadSelectedModel: function () {
                    try {
                        return TimeRecordingUtils.storage.load('ai_selected_model', null);
                    } catch (e) {
                        return null;
                    }
                },

                restoreSelectedModel: function () {
                    const saved = this.loadSelectedModel();
                    if (saved) {
                        const select = document.getElementById('trAIModelSelect');
                        if (select) {
                            // Try to select the saved model
                            for (let i = 0; i < select.options.length; i++) {
                                if (select.options[i].value === saved) {
                                    select.value = saved;
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                },

                // --- Manage Context Dialog ---
                showManageContextDialog: function () {
                    const existing = document.getElementById('trManageContextDialog');
                    if (existing) existing.remove();

                    const files = this.contextFiles || [];

                    const dialog = document.createElement('div');
                    dialog.id = 'trManageContextDialog';
                    dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10001;width:500px;max-height:70vh;display:flex;flex-direction:column;';

                    let fileListHtml = '';
                    if (files.length === 0) {
                        fileListHtml = '<div style="color:#999;text-align:center;padding:20px;">No context files loaded.<br>Use \u{1F4CE} to upload files.</div>';
                    } else {
                        files.forEach((file, index) => {
                            const sizeStr = file.size > 1024 ? (file.size / 1024).toFixed(1) + ' KB' : file.size + ' B';
                            const addedStr = file.addedAt ? new Date(file.addedAt).toLocaleDateString() : 'unknown';
                            fileListHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid #dee2e6;border-radius:6px;margin-bottom:8px;">' +
                                '<div style="flex:1;">' +
                                '<div style="font-weight:bold;">\u{1F4C4} ' + file.name + '</div>' +
                                '<div style="font-size:12px;color:#666;">' + sizeStr + ' \u2022 Added: ' + addedStr + '</div>' +
                                '</div>' +
                                '<button data-ctx-index="' + index + '" class="trCtxRemoveBtn" style="background:#dc3545;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">\u{1F5D1}\uFE0F Remove</button>' +
                                '</div>';
                        });
                    }

                    dialog.innerHTML = '<div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:15px;color:white;border-radius:12px 12px 0 0;">' +
                        '<h3 style="margin:0;">\u{1F4C2} Manage Context Files</h3>' +
                        '<p style="margin:5px 0 0;opacity:0.9;font-size:13px;">' + files.length + ' file(s) loaded \u2022 Files persist between sessions</p>' +
                        '</div>' +
                        '<div style="flex:1;overflow-y:auto;padding:15px;" id="trCtxFileList">' + fileListHtml + '</div>' +
                        '<div style="padding:15px;border-top:1px solid #dee2e6;display:flex;gap:10px;justify-content:flex-end;">' +
                        '<button id="trCtxAddFile" style="padding:8px 16px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;">\u{1F4CE} Add File</button>' +
                        '<button id="trCtxClose" style="padding:8px 16px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;">Close</button>' +
                        '</div>';

                    document.body.appendChild(dialog);

                    // Wire up remove buttons
                    dialog.querySelectorAll('.trCtxRemoveBtn').forEach(btn => {
                        btn.onclick = () => {
                            const idx = parseInt(btn.dataset.ctxIndex);
                            const file = this.contextFiles[idx];
                            if (file) {
                                this.removeContextFile(file.name);
                                this.addMessage('model', '\u{1F5D1}\uFE0F Context file "' + file.name + '" removed.');
                                dialog.remove();
                                this.showManageContextDialog(); // Refresh
                            }
                        };
                    });

                    document.getElementById('trCtxAddFile').onclick = () => {
                        dialog.remove();
                        document.getElementById('trAIFileInput').click();
                    };

                    document.getElementById('trCtxClose').onclick = () => dialog.remove();
                }
            });
        }
    ).toString() + ')();';
    document.head.appendChild(el);
}
