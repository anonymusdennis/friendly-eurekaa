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
                        if (m.id === currentModel) opt.selected = true;
                        dropdown.appendChild(opt);
                    });
                },

                // Native Gemini function declarations for tool calling
                getFunctionDeclarations: function () {
                    return [
                        {
                            name: "getMissingDays",
                            description: "Get working days missing time records in the currently displayed calendar month. Returns date keys, formatted display dates, and day names.",
                            parameters: { type: "object", properties: {}, required: [] }
                        },
                        {
                            name: "getRecordsForDate",
                            description: "Get all time records for a specific date. Returns project IDs, descriptions, hours, and details.",
                            parameters: {
                                type: "object",
                                properties: { date: { type: "string", description: "Date in YYYY-MM-DD format" } },
                                required: ["date"]
                            }
                        },
                        {
                            name: "getMonthSummary",
                            description: "Get a summary of the current month including total hours, required hours, completion rate, and missing days count.",
                            parameters: { type: "object", properties: {}, required: [] }
                        },
                        {
                            name: "getFavorites",
                            description: "Get the user's favorite projects/tasks list with project IDs, task IDs, names and descriptions.",
                            parameters: { type: "object", properties: {}, required: [] }
                        },
                        {
                            name: "getProjectDetails",
                            description: "Get detailed information about a specific project by its ID.",
                            parameters: {
                                type: "object",
                                properties: { projectId: { type: "string", description: "The project ID to look up" } },
                                required: ["projectId"]
                            }
                        },
                        {
                            name: "askUser",
                            description: "Ask the user a clarifying question when you are not confident about the project match, date, or hours. Use this INSTEAD of guessing. Include options you are considering.",
                            parameters: {
                                type: "object",
                                properties: {
                                    question: { type: "string", description: "The clarifying question to ask" },
                                    options: { type: "array", items: { type: "string" }, description: "Options the user can choose from" },
                                    context: { type: "string", description: "Why you are asking — what you are uncertain about" }
                                },
                                required: ["question"]
                            }
                        },
                        {
                            name: "updateExistingRecord",
                            description: "Update an existing time record. First call getRecordsForDate to find the record's Counter, then call this with the counter and fields to change. Only provide fields you want to modify — others are kept as-is.",
                            parameters: {
                                type: "object",
                                properties: {
                                    date: { type: "string", description: "Date of the record in YYYY-MM-DD format" },
                                    counter: { type: "string", description: "The Counter ID of the record to update (get this from getRecordsForDate)" },
                                    hours: { type: "number", description: "New duration in hours (optional — only if changing)" },
                                    description: { type: "string", description: "New description/content (optional — only if changing)" },
                                    projectId: { type: "string", description: "New project ID (optional — only if changing)" },
                                    taskId: { type: "string", description: "New task/PSP ID (optional — only if changing)" },
                                    accountInd: { type: "string", description: "New account indicator: '10' for billable, '90' for non-billable (optional)" }
                                },
                                required: ["date", "counter"]
                            }
                        },
                        {
                            name: "deleteExistingRecord",
                            description: "Delete an existing time record. First call getRecordsForDate to find the record's Counter, then call this. The user will be asked to confirm before deletion.",
                            parameters: {
                                type: "object",
                                properties: {
                                    date: { type: "string", description: "Date of the record in YYYY-MM-DD format" },
                                    counter: { type: "string", description: "The Counter ID of the record to delete (get this from getRecordsForDate)" },
                                    reason: { type: "string", description: "Brief reason for deletion (shown to user in confirmation)" }
                                },
                                required: ["date", "counter"]
                            }
                        },
                        {
                            name: "makeNotes",
                            description: "Use this to think step-by-step before taking action. Write down your reasoning, plan, or observations. This is your internal scratchpad — call it BEFORE making changes to organize your thoughts. Notes are stored for your reference during the conversation.",
                            parameters: {
                                type: "object",
                                properties: {
                                    thought: { type: "string", description: "Your reasoning, analysis, or observations about the user's request" },
                                    plan: { type: "array", items: { type: "string" }, description: "Ordered list of steps you plan to take next" }
                                },
                                required: ["thought"]
                            }
                        },
                        {
                            name: "getRecordsForDateRange",
                            description: "Get all time records for a range of dates at once. Useful for reviewing a week or multi-day period. Returns records grouped by date. Limited to 14 days max.",
                            parameters: {
                                type: "object",
                                properties: {
                                    startDate: { type: "string", description: "Start date in YYYY-MM-DD format" },
                                    endDate: { type: "string", description: "End date in YYYY-MM-DD format" }
                                },
                                required: ["startDate", "endDate"]
                            }
                        },
                        {
                            name: "searchRecords",
                            description: "Search time records across the current month by keyword, project ID, or account type. Searches up to 10 days with records. Returns matching records.",
                            parameters: {
                                type: "object",
                                properties: {
                                    keyword: { type: "string", description: "Search keyword to match in description or project name (case-insensitive)" },
                                    projectId: { type: "string", description: "Filter by exact project ID (optional)" },
                                    accountInd: { type: "string", description: "Filter by account indicator: '10' for billable, '90' for non-billable (optional)" }
                                },
                                required: []
                            }
                        }
                    ];
                },

                // Execute a function call from the AI
                executeFunctionByName: async function (name, args) {
                    switch (name) {
                        case 'getMissingDays': {
                            const monthData = TimeRecordingCalendar.monthData;
                            const missingDays = [];
                            if (monthData && monthData.days) {
                                monthData.days.forEach(day => {
                                    if (day.isWorkDay && !day.isHoliday && !day.isFuture && day.totalHours === 0) {
                                        missingDays.push({
                                            date: day.dateKey,
                                            displayDate: TimeRecordingUtils.formatDisplayDate(day.date),
                                            dayName: day.dayName
                                        });
                                    }
                                });
                            }
                            return missingDays;
                        }
                        case 'getRecordsForDate':
                            return await TimeRecordingAPI.fetchTimeRecords(new Date(args.date));
                        case 'getMonthSummary': {
                            const md = TimeRecordingCalendar.monthData;
                            return {
                                month: md.monthName,
                                totalHours: md.totalHours,
                                requiredHours: md.requiredHours,
                                completionRate: md.completionRate,
                                daysWithRecords: md.days.filter(d => d.totalHours > 0).length,
                                missingDays: md.days.filter(d => d.isWorkDay && !d.isHoliday && !d.isFuture && d.totalHours === 0).length
                            };
                        }
                        case 'getFavorites':
                            return TimeRecordingAPI.getUserFavorites();
                        case 'getProjectDetails':
                            return await TimeRecordingAPI.getProjectDetails(args.projectId);
                        case 'askUser':
                            return this.handleAskUser(args);
                        case 'updateExistingRecord':
                            return await this.handleUpdateRecord(args);
                        case 'deleteExistingRecord':
                            return await this.handleDeleteRecord(args);
                        case 'makeNotes':
                            return this.handleMakeNotes(args);
                        case 'getRecordsForDateRange':
                            return await this.handleGetRecordsForDateRange(args);
                        case 'searchRecords':
                            return await this.handleSearchRecords(args);
                        default:
                            return { error: 'Unknown function: ' + name };
                    }
                },

                // Handle the askUser callback — display question to user in chat
                handleAskUser: function (args) {
                    let msg = '\u{1F914} **I need your input:**\n\n' + args.question;
                    if (args.options && args.options.length > 0) {
                        msg += '\n\n**Options:**\n';
                        args.options.forEach((opt, i) => {
                            msg += (i + 1) + '. ' + opt + '\n';
                        });
                        msg += '\nPlease reply with your choice (number or description).';
                    }
                    if (args.context) {
                        msg += '\n\n_Context: ' + args.context + '_';
                    }
                    this.addMessage('model', msg);
                    return { status: 'waiting_for_user_response', question: args.question };
                },

                // Handle updating an existing time record
                handleUpdateRecord: async function (args) {
                    try {
                        // Fetch the existing record by date and counter
                        const dateKey = args.date.replace(/-/g, '');
                        const record = await TimeRecordingEdit.fetchSingleRecord(dateKey, args.counter);
                        if (!record) {
                            return { error: 'Record not found with counter ' + args.counter + ' on ' + args.date };
                        }

                        // Apply only the fields that were provided
                        const updatedRecord = { ...record, Mode: 'U' };
                        if (args.hours !== undefined) updatedRecord.Duration = args.hours.toString();
                        if (args.description !== undefined) updatedRecord.Content = args.description;
                        if (args.projectId !== undefined) updatedRecord.AccProjId = args.projectId;
                        if (args.taskId !== undefined) updatedRecord.AccTaskPspId = args.taskId;
                        if (args.accountInd !== undefined) updatedRecord.AccountInd = args.accountInd;

                        // Build a summary of changes for the user
                        const changes = [];
                        if (args.hours !== undefined) changes.push('hours: ' + record.Duration + ' \u2192 ' + args.hours);
                        if (args.description !== undefined) changes.push('description: "' + (record.Content || '').substring(0, 40) + '" \u2192 "' + args.description.substring(0, 40) + '"');
                        if (args.projectId !== undefined) changes.push('project: ' + record.AccProjId + ' \u2192 ' + args.projectId);
                        if (args.taskId !== undefined) changes.push('task: ' + record.AccTaskPspId + ' \u2192 ' + args.taskId);
                        if (args.accountInd !== undefined) changes.push('billable: ' + record.AccountInd + ' \u2192 ' + args.accountInd);

                        this.addMessage('model', '\u270F\uFE0F **Updating record** (Counter: ' + args.counter + ', Date: ' + args.date + '):\n' + changes.map(c => '\u2022 ' + c).join('\n'));

                        const result = await TimeRecordingEdit.updateTimeRecord(updatedRecord);
                        if (result) {
                            TimeRecordingCalendar.refresh();
                            this.addMessage('model', '\u2705 Record updated successfully!');
                            return { success: true, changes: changes };
                        } else {
                            return { error: 'SAP API returned no result — update may have failed' };
                        }
                    } catch (error) {
                        return { error: 'Failed to update record: ' + error.message };
                    }
                },

                // Handle deleting an existing time record
                handleDeleteRecord: async function (args) {
                    try {
                        const dateKey = args.date.replace(/-/g, '');
                        const record = await TimeRecordingEdit.fetchSingleRecord(dateKey, args.counter);
                        if (!record) {
                            return { error: 'Record not found with counter ' + args.counter + ' on ' + args.date };
                        }

                        // Show what will be deleted and ask for confirmation
                        const desc = record.Content || '(no description)';
                        const hours = record.Duration || '?';
                        const project = record.AccProjId || '(no project)';
                        const reason = args.reason || 'User requested deletion';

                        this.addMessage('model', '\u{1F5D1}\uFE0F **Delete request** for record on ' + args.date + ':\n\u2022 ' + hours + 'h \u2014 ' + project + '\n\u2022 "' + desc + '"\n\u2022 Reason: ' + reason + '\n\nType **"yes, delete"** to confirm or **"cancel"** to abort.');

                        // Store pending deletion for confirmation
                        this.pendingDeletion = { record: record, date: args.date, counter: args.counter };
                        return { status: 'waiting_for_deletion_confirmation', record: { date: args.date, counter: args.counter, hours: hours, description: desc } };
                    } catch (error) {
                        return { error: 'Failed to prepare deletion: ' + error.message };
                    }
                },

                // Handle makeNotes — AI's internal scratchpad for thinking
                handleMakeNotes: function (args) {
                    const note = {
                        thought: args.thought,
                        plan: args.plan || [],
                        timestamp: new Date().toISOString()
                    };
                    this.aiNotes.push(note);
                    TimeRecordingUtils.log('info', 'AI thinking:', args.thought);
                    if (args.plan && args.plan.length > 0) {
                        TimeRecordingUtils.log('info', 'AI plan:', args.plan.join(' → '));
                    }
                    return { status: 'noted', message: 'Notes recorded. Proceed with your plan.', previousNotes: this.aiNotes.length };
                },

                // Handle getRecordsForDateRange — fetch records for multiple dates
                handleGetRecordsForDateRange: async function (args) {
                    try {
                        const start = new Date(args.startDate);
                        const end = new Date(args.endDate);
                        const results = {};
                        const current = new Date(start);
                        let dayCount = 0;
                        const maxDays = 14; // Safety limit

                        while (current <= end && dayCount < maxDays) {
                            const dateStr = current.toISOString().split('T')[0];
                            try {
                                const records = await TimeRecordingAPI.fetchTimeRecords(new Date(current));
                                if (records && records.length > 0) {
                                    results[dateStr] = records;
                                }
                            } catch (e) {
                                results[dateStr] = { error: e.message };
                            }
                            current.setDate(current.getDate() + 1);
                            dayCount++;
                        }
                        return { daysQueried: dayCount, daysWithRecords: Object.keys(results).length, records: results };
                    } catch (error) {
                        return { error: 'Failed to fetch date range: ' + error.message };
                    }
                },

                // Handle searchRecords — search across month by keyword/project/type
                handleSearchRecords: async function (args) {
                    try {
                        const monthData = TimeRecordingCalendar.monthData;
                        if (!monthData || !monthData.days) {
                            return { error: 'No month data available' };
                        }

                        // Find days that have records
                        const daysWithRecords = monthData.days.filter(d => d.totalHours > 0);
                        const matches = [];
                        const maxDaysToFetch = 10; // Limit API calls
                        const daysToFetch = daysWithRecords.slice(0, maxDaysToFetch);

                        for (const day of daysToFetch) {
                            try {
                                const records = await TimeRecordingAPI.fetchTimeRecords(day.date);
                                if (!records) continue;

                                for (const rec of records) {
                                    let isMatch = false;

                                    if (args.keyword) {
                                        const kw = args.keyword.toLowerCase();
                                        isMatch = (rec.Content || '').toLowerCase().includes(kw) ||
                                                  (rec.AccProjId || '').toLowerCase().includes(kw) ||
                                                  (rec.AccProjDesc || '').toLowerCase().includes(kw) ||
                                                  (rec.AccTaskPspDesc || '').toLowerCase().includes(kw);
                                    }
                                    if (args.projectId) {
                                        isMatch = isMatch || rec.AccProjId === args.projectId;
                                    }
                                    if (args.accountInd) {
                                        isMatch = isMatch || rec.AccountInd === args.accountInd;
                                    }
                                    // If no filters provided, return all
                                    if (!args.keyword && !args.projectId && !args.accountInd) {
                                        isMatch = true;
                                    }

                                    if (isMatch) {
                                        matches.push({
                                            date: day.dateKey,
                                            dayName: day.dayName,
                                            counter: rec.Counter,
                                            hours: rec.Duration,
                                            project: rec.AccProjId,
                                            projectDesc: rec.AccProjDesc,
                                            task: rec.AccTaskPspId,
                                            description: rec.Content,
                                            accountInd: rec.AccountInd
                                        });
                                    }
                                }
                            } catch (e) {
                                // Skip days that fail
                            }
                        }

                        return {
                            totalMatches: matches.length,
                            daysSearched: daysToFetch.length,
                            totalDaysWithRecords: daysWithRecords.length,
                            records: matches
                        };
                    } catch (error) {
                        return { error: 'Search failed: ' + error.message };
                    }
                },

                // Initialize AI module
                init: async function (apiKey) {
                    this.apiKey = apiKey;
                    if (!apiKey) {
                        TimeRecordingUtils.log('warning', 'AI module initialized without API key');
                        return;
                    }
                    // Discover available models on init
                    await this.listModels();
                },

                // Initialize chat interface
                initializeChat: function () {
                    if (!this.apiKey) {
                        this.addMessage('model', 'AI Assistant is not configured. Please provide an API key using TimeRecordingAI.init("your-api-key")');
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
                            '\u{1F527} **Switch model** \u2014 Type "switch to pro" or "switch to flash"',
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
                    this.fileContext = content;
                    this.fileContextName = filename;
                    this.addMessage('model', '\u{1F4CE} **File loaded:** "' + filename + '" (' + content.length + ' chars)\nThis context will be included in all future AI requests to help match tasks and projects.');
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

                    const clipboardPrompt = 'CLIPBOARD CONTENT ANALYSIS:\nThe user pasted clipboard content. Extract WHAT WORK was done, WHICH DAYS it relates to, and match to the best project/task.\nIf dates are unclear, use the askUser function to ask.\n\nCLIPBOARD:\n---\n' + clipboardText + '\n---\n\nAnalyze and suggest time entries. If dates are unclear, call askUser to clarify.';

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

                    try {
                        const maxRetries = TimeRecordingConfig.ai?.maxRetries || 3;
                        const retryDelay = TimeRecordingConfig.ai?.retryDelayMs || 1500;
                        let lastError = null;

                        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                            try {
                                const result = await this.callGeminiWithFunctions(message, context, attempt > 1 ? lastError : null);

                                this.hideTypingIndicator();

                                // If the result was handled by function calling (askUser), don't process further
                                if (result === '__ASKED_USER__') return;

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
                        TimeRecordingUtils.log('error', 'AI request failed after retries', error);
                        this.addMessage('model', '\u274C Sorry, I encountered an error after multiple attempts. Error: ' + error.message + '\n\nPlease try again or rephrase your request.');
                    }
                },

                // Prepare enhanced context
                prepareEnhancedContext: async function () {
                    const currentMonth = TimeRecordingCalendar.monthData;
                    const favorites = TimeRecordingAPI.getUserFavorites();
                    const selectedDays = Array.from(TimeRecordingUI.selectedDays || []);

                    const missingDays = [];
                    if (currentMonth && currentMonth.days) {
                        currentMonth.days.forEach(day => {
                            if (day.isWorkDay && !day.isHoliday && !day.isFuture && day.totalHours === 0) {
                                missingDays.push(day.dateKey);
                            }
                        });
                    }

                    const recentHistory = this.conversationHistory.slice(-10).map(msg => ({
                        role: msg.sender,
                        parts: [{ text: msg.content.replace(/<[^>]*>/g, '') }]
                    }));

                    return {
                        currentDate: new Date().toISOString().split('T')[0],
                        selectedDays,
                        missingDays,
                        favorites: favorites.map(f => ({
                            guid: f.Guid, name: f.Name,
                            projectId: f.AccProjId, projectDesc: f.AccProjDesc,
                            taskId: f.AccTaskPspId, taskDesc: f.AccTaskPspDesc
                        })),
                        monthSummary: currentMonth ? {
                            month: currentMonth.monthName,
                            totalHours: currentMonth.totalHours,
                            requiredHours: currentMonth.requiredHours,
                            completionRate: currentMonth.completionRate
                        } : null,
                        chatHistory: recentHistory,
                        historicalContext: this.historicalContext,
                        fileContext: this.fileContext,
                        fileContextName: this.fileContextName,
                        historyLoaded: this.historyLoaded
                    };
                },

                // Build the system prompt
                buildSystemPrompt: function (context) {
                    let historyBlock = '';
                    if (context.historicalContext) {
                        const h = context.historicalContext;
                        const projectLines = h.topProjects.slice(0, 12).map((p, i) => {
                            const desc = p.projectDesc || p.projectId;
                            const sample = p.sampleDescriptions.length > 0 ? ` \u2014 e.g. "${p.sampleDescriptions[0]}"` : '';
                            return `${i + 1}. ${desc} (${p.taskId}) \u2014 ${p.totalHours.toFixed(0)}h / ${p.count} entries / AccountInd:${p.accountInd}${sample}`;
                        }).join('\n');
                        historyBlock = `\n\n## HISTORICAL WORK PATTERNS (${h.totalRecords} records, ${h.totalHours}h, ${h.periodStart}\u2013${h.periodEnd})\n${projectLines}`;
                    }

                    let fileBlock = '';
                    if (context.fileContext) {
                        fileBlock = `\n\n## USER CONTEXT FILE ("${context.fileContextName || 'unknown'}")\n${context.fileContext.substring(0, 20000)}`;
                    }

                    const selectedDaysStr = context.selectedDays.length > 0
                        ? context.selectedDays.join(', ') : 'none';
                    const missingDaysStr = context.missingDays.length > 0
                        ? `${context.missingDays.length}: ${context.missingDays.slice(0, 8).join(', ')}${context.missingDays.length > 8 ? '...' : ''}`
                        : 'none';
                    const selectedDaysData = context.selectedDays.length > 0
                        ? '\nSelected days data: ' + JSON.stringify(TimeRecordingCalendar.getTimes(0, context.selectedDays, true))
                        : '';
                    const projectList = context.favorites.map(f =>
                        `- "${f.name}": ${f.projectDesc} (ProjectID: ${f.projectId}, TaskID: ${f.taskId})`
                    ).join('\n');
                    const notesBlock = this.aiNotes.length > 0
                        ? `\n\n## YOUR PREVIOUS NOTES\n${this.aiNotes.slice(-5).map(n => '- ' + n.thought).join('\n')}`
                        : '';
                    const fence = '\`\`\`';

                    return `# ROLE
You are a precise, intelligent Time Recording Assistant for SAP CATS.
You help a SOFTWARE DEVELOPER record, edit, and manage their work time.

# THINKING PROCESS
Before taking ANY action on complex requests, THINK FIRST by calling \`makeNotes\`:
- Analyze what the user is asking
- List what information you need
- Plan which function calls to make and in what order
- Only THEN execute your plan

You have access to function calls that let you gather context and search data.
USE THEM PROACTIVELY \u2014 don't guess when you can look things up.

# CAPABILITIES
You can:
1. **Think** \u2014 call \`makeNotes\` to plan your approach before acting
2. **Create** new time entries (output JSON with entries array)
3. **Edit** existing records \u2014 call \`getRecordsForDate\` to find the Counter, then \`updateExistingRecord\`
4. **Delete** existing records \u2014 call \`getRecordsForDate\` to find the Counter, then \`deleteExistingRecord\`
5. **Query** data \u2014 \`getMissingDays\`, \`getMonthSummary\`, \`getRecordsForDate\`, \`getFavorites\`, \`getProjectDetails\`
6. **Search** \u2014 \`getRecordsForDateRange\` for multi-day lookups, \`searchRecords\` for keyword/project search
7. **Clarify** \u2014 \`askUser\` when uncertain

# FUNCTION CALLING STRATEGY
- Call \`makeNotes\` first to plan complex requests
- Call \`getRecordsForDate\` or \`getRecordsForDateRange\` to see existing data before making changes
- Call \`searchRecords\` to find records matching a keyword or project across the month
- Call \`getFavorites\` if you need to look up available projects
- Chain multiple function calls when needed \u2014 call one, get results, then call another

# EDITING WORKFLOW
When the user asks to edit or change an existing record:
1. First call \`getRecordsForDate\` to see what records exist on that date
2. Identify the correct record by matching description, project, or hours
3. If multiple records match, call \`askUser\` to clarify which one
4. Call \`updateExistingRecord\` with the Counter and only the fields to change

When the user asks to delete a record:
1. First call \`getRecordsForDate\` to find the Counter
2. Call \`deleteExistingRecord\` \u2014 the user will be asked to confirm before deletion happens

# REASONING PROCESS
For each user request:
1. **THINK** \u2014 Call \`makeNotes\` to plan your approach for complex requests
2. **GATHER** \u2014 Use function calls to get the data you need
3. **PARSE** \u2014 What did they do? When? For how long? Is this create, edit, or delete?
4. **MATCH** \u2014 Find the best project/task from favorites or history
5. **VERIFY** \u2014 If match confidence < 80%, call \`askUser\` to clarify instead of guessing
6. **DISTRIBUTE** \u2014 Apply realistic hours (see rules)
7. **VALIDATE** \u2014 Ensure each day totals 8.0h, descriptions are unique and specific

# TIME DISTRIBUTION RULES
- Development/billable work: 7.0\u20137.5h/day (AccountInd: "10") \u2014 THIS IS THE MAJORITY
- Admin/non-billable: MAX 0.5h/day (AccountInd: "90") \u2014 emails, standups, org tasks
- NEVER: 8h "reading emails", 8h "admin", same description for multiple days
- ALWAYS: Include ~0.5h admin entry per day unless user says otherwise

# DATE PARSING
Resolve natural language:
- "Monday" \u2192 most recent Monday
- "yesterday" \u2192 yesterday
- "last week" \u2192 last week's workdays
- "the 15th" \u2192 15th of current month
Output as YYYYMMDD.

# WHEN UNCERTAIN
Call \`askUser\` with options rather than guessing.
Example: "I'm not sure if this is Tower Application or Tower Platform. Which one?"

# CURRENT CONTEXT
- Today: ${context.currentDate}
- Selected days: ${selectedDaysStr}
- Missing days: ${missingDaysStr}
- Month: ${context.monthSummary?.completionRate || 0}% complete (${context.monthSummary?.totalHours || 0}h / ${context.monthSummary?.requiredHours || 0}h)

# RECENT RECORDINGS (for pattern matching)
Last week: ${JSON.stringify(TimeRecordingCalendar.getTimes(-1))}
This week: ${JSON.stringify(TimeRecordingCalendar.getTimes(0))}${selectedDaysData}${historyBlock}${fileBlock}${notesBlock}

# AVAILABLE PROJECTS (use EXACT IDs)
${projectList}

## Priority projects (use if they match the work description):
IN 2911.IN.0074-01 \u2014 Employee information, info nuggets
IN 2911.IN.0072-01..11 \u2014 Meetings Tower (Application/Compute/DataCenter/Delivery/EndUser/ITMgmt/Network/Output/Platform/Security/Storage)
IN 2911.IN.0073-01..11 \u2014 Idle Time Tower (same tower breakdown)
AD 2911.AD.0005-01 \u2014 Local Leadership tasks
AD 2911.AD.0006-01 \u2014 Local administrative work
TR 2911.TR.0004-01..11 \u2014 Training Tower (same tower breakdown)

# FEW-SHOT EXAMPLES

**User:** "I worked on the application deployment pipeline on Monday"
**Response:**
${fence}json
{"entries":[{"AccountInd":"10","date":"20260323","projectId":"...","taskId":"...","hours":7.5,"description":"Implemented CI/CD pipeline improvements for application deployment, configured staging environment"},{"AccountInd":"90","date":"20260323","projectId":"2911.AD.0006","taskId":"2911.AD.0006-01","hours":0.5,"description":"Daily standup, email triage, team coordination"}]}
${fence}

**User:** "Change my Monday entry from 7.5h to 6h and add a 1.5h meeting entry"
**Response:** First calls \`makeNotes\` to plan, then \`getRecordsForDate\` for Monday, then \`updateExistingRecord\` to change hours to 6, then outputs JSON for the new 1.5h meeting entry.

**User:** "Delete the admin entry from yesterday"
**Response:** Calls \`getRecordsForDate\` for yesterday, identifies the admin entry (AccountInd: "90"), calls \`deleteExistingRecord\` with its Counter.

**User:** "What did I work on last week?"
**Response:** Calls \`makeNotes\` to plan, then \`getRecordsForDateRange\` for last week, reviews the data, and provides a summary.

**User:** "Find all my platform entries this month"
**Response:** Calls \`searchRecords\` with keyword "platform", then summarizes the results.

# OUTPUT FORMAT
When suggesting NEW entries, output EXACTLY ONE JSON block:
${fence}json
{"entries":[{"AccountInd":"10","date":"YYYYMMDD","projectId":"exact_id","taskId":"exact_task_id","hours":7.5,"description":"Specific unique description"},{"AccountInd":"90","date":"YYYYMMDD","projectId":"2911.AD.0006","taskId":"2911.AD.0006-01","hours":0.5,"description":"Admin task description"}]}
${fence}
For edits and deletes, use \`updateExistingRecord\` and \`deleteExistingRecord\` directly \u2014 do NOT output JSON.

# RULES
- If user asks a question, answer it \u2014 do not generate entries unless asked
- Each day MUST total exactly 8.0 hours (for new entries)
- Each description must be UNIQUE and SPECIFIC
- NEVER guess project \u2014 call \`askUser\` when unsure
- Combine ALL new entries into ONE JSON block
- For edits: ALWAYS call \`getRecordsForDate\` first to get the Counter
- For deletes: ALWAYS call \`getRecordsForDate\` first to get the Counter
- THINK FIRST: For complex requests, call \`makeNotes\` to plan before acting
- GATHER DATA: Use \`searchRecords\` or \`getRecordsForDateRange\` to research before suggesting changes`;
                },

                // Build prompt for meeting imports
                buildPromptForMeetings: function (message, context, meetings) {
                    const projectList = context.favorites.map(f =>
                        `- "${f.name}": ProjectID: ${f.projectId}, TaskID: ${f.taskId}`
                    ).join('\n');
                    const fence = '\`\`\`';

                    return `You are a Time Recording Assistant. Create time entries for these meetings.

RULES:
1. Use EXACT meeting name in description
2. Use EXACT duration (not rounded to 8h)
3. If PSP element (format: XXXX.XX.XXXX-XX-XX) appears in title, use it as project
4. Each meeting = one entry on its specific date
5. Include meeting time (e.g., "09:00-10:30") in description

Available Projects:
${projectList}

Priority mappings:
IN 2911.IN.0072-01..11 = Meetings Tower
AD 2911.AD.0005-01 = Leadership
AD 2911.AD.0006-01 = Admin

Meeting Data:
${meetings}

Output ONE JSON block:
${fence}json
{"entries":[{"date":"YYYYMMDD","projectId":"id","taskId":"task_id","hours":1.5,"description":"EXACT meeting title (HH:MM-HH:MM)"}]}
${fence}
Today: ${context.currentDate}`;
                },

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
                        generationConfig: {
                            temperature: TimeRecordingConfig.ai?.temperature || 0.15,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 1024 * 8,
                            thinkingConfig: { thinkingBudget: 1024 * 8 }
                        },
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
                handleFunctionCallResponse: async function (functionCall, originalMessage, context, originalData) {
                    const name = functionCall.name;
                    const args = functionCall.args || {};
                    TimeRecordingUtils.log('info', 'AI called function: ' + name, args);

                    const result = await this.executeFunctionByName(name, args);

                    // If askUser, the message was already displayed
                    if (name === 'askUser') {
                        this.hideTypingIndicator();
                        return '__ASKED_USER__';
                    }

                    // Send function result back to Gemini
                    const functionResponseBody = {
                        system_instruction: { parts: { text: this.buildSystemPrompt(context) } },
                        contents: [
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
                        ],
                        generationConfig: {
                            temperature: TimeRecordingConfig.ai?.temperature || 0.15,
                            topK: 40, topP: 0.95,
                            maxOutputTokens: 1024 * 8,
                            thinkingConfig: { thinkingBudget: 1024 * 8 }
                        },
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
                        return await this.handleFunctionCallResponse(nextFunctionCall.functionCall, originalMessage, context, followUpData);
                    }

                    const textParts = followUpParts.filter(p => p.text !== undefined);
                    return textParts.length > 0 ? textParts[textParts.length - 1].text : 'I processed the data but have no additional response.';
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
                        const billableIcon = entry.AccountInd === '90' ? '\u{1F537}' : '\u{1F7E2}';

                        entryDiv.innerHTML = '<div style="display:flex;align-items:center;gap:15px;"><input type="checkbox" checked data-index="' + index + '" style="width:20px;height:20px;cursor:pointer;"><div style="flex:1;"><div style="font-weight:bold;margin-bottom:5px;">\u{1F4C5} ' + dateFormatted + ' \u2014 ' + entry.hours + 'h ' + billableIcon + '</div><div style="color:#666;font-size:14px;margin-bottom:3px;">\u{1F4C1} ' + entry.projectId + ' / ' + entry.taskId + '</div><div style="color:#333;">\u{1F4DD} ' + entry.description + '</div></div></div>';

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
                },

                // Add message to chat with markdown rendering
                addMessage: function (sender, content, data) {
                    data = data || null;
                    const container = document.getElementById('trAIChatMessages');
                    if (!container) return;

                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'tr-ai-message tr-ai-message-' + sender;
                    messageDiv.style.marginBottom = '10px';

                    let displayContent = content;
                    displayContent = displayContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                    displayContent = displayContent.replace(/_([^_]+)_/g, '<em>$1</em>');
                    if (!displayContent.includes('<pre')) {
                        displayContent = displayContent.replace(/\n/g, '<br>');
                    }

                    messageDiv.innerHTML = '<div style="font-size:11px;color:#666;margin-bottom:5px;font-weight:bold;">' + (sender === 'user' ? '\u{1F464} You' : '\u{1F916} AI (' + this.getModelName() + ')') + '</div><div style="font-size:13px;line-height:1.5;">' + displayContent + '</div>';

                    container.appendChild(messageDiv);

                    this.conversationHistory.push({ sender: sender, content: content, data: data, timestamp: new Date() });
                    if (this.conversationHistory.length > this.maxHistoryLength) {
                        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
                    }

                    container.scrollTop = container.scrollHeight;
                },

                showTypingIndicator: function () {
                    const container = document.getElementById('trAIChatMessages');
                    if (!container) return;
                    const indicator = document.createElement('div');
                    indicator.id = 'trAITypingIndicator';
                    indicator.className = 'tr-ai-message tr-ai-message-assistant';
                    indicator.style.marginBottom = '10px';
                    indicator.innerHTML = '<div style="color:#666;font-style:italic;">\u{1F916} AI is thinking (' + this.getModelName() + ')...</div>';
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
                    this.initializeChat();
                },

                exportConversation: function () {
                    return this.conversationHistory;
                }
            };

        }
    ).toString() + ')();';
    document.head.appendChild(el);
}
