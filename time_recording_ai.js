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

                // Get current AI model endpoint from config
                getEndpoint: function () {
                    const model = TimeRecordingConfig.ai?.model || 'gemini-2.5-flash';
                    const models = TimeRecordingConfig.ai?.availableModels || {};
                    return models[model]?.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
                },

                // Get current model name for display
                getModelName: function () {
                    const model = TimeRecordingConfig.ai?.model || 'gemini-2.5-flash';
                    const models = TimeRecordingConfig.ai?.availableModels || {};
                    return models[model]?.name || 'Gemini 2.5 Flash';
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

                // Initialize AI module
                init: function (apiKey) {
                    this.apiKey = apiKey;
                    if (!apiKey) {
                        TimeRecordingUtils.log('warning', 'AI module initialized without API key');
                    }
                },

                // Initialize chat interface
                initializeChat: function () {
                    if (!this.apiKey) {
                        this.addMessage('model', 'AI Assistant is not configured. Please provide an API key using TimeRecordingAI.init("your-api-key")');
                        return;
                    }

                    if (this.conversationHistory.length === 0) {
                        this.addMessage('model', 'Hello! I\'m your Time Recording AI Assistant (powered by **' + this.getModelName() + '**). Here\'s what I can do:\n\n\u{1F4DD} **Record time** \u2014 Tell me what you did: "I refactored the auth module on Monday"\n\u{1F50D} **Smart matching** \u2014 I\'ll find the best project/task and ASK you if I\'m unsure\n\u{1F4CA} **Load history** \u2014 Click \u{1F4CA} to load past records so I understand your work patterns\n\u{1F4CE} **Upload context** \u2014 Click \u{1F4CE} to upload a project/task reference file\n\u{1F4CB} **Clipboard analysis** \u2014 Click \u{1F4CB} and I\'ll extract work from your clipboard\n\u2696\uFE0F **Realistic hours** \u2014 Development ~7.5h + admin ~0.5h per day\n\u{1F504} **Self-correcting** \u2014 I validate entries and auto-retry if something goes wrong\n\u{1F527} **Switch model** \u2014 Type "switch to pro" or "switch to flash"\n\nJust describe what you worked on and I\'ll suggest accurate time entries!');

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

                    // Check for model switch command
                    const lowerMsg = message.toLowerCase().trim();
                    if (lowerMsg === 'switch to pro' || lowerMsg === 'use pro') {
                        this.switchModel('gemini-2.5-pro');
                        return;
                    }
                    if (lowerMsg === 'switch to flash' || lowerMsg === 'use flash') {
                        this.switchModel('gemini-2.5-flash');
                        return;
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
                        historyBlock = '\n\n## HISTORICAL WORK PATTERNS (' + h.totalRecords + ' records, ' + h.totalHours + 'h, ' + h.periodStart + '\u2013' + h.periodEnd + ')\n' +
                            h.topProjects.slice(0, 12).map((p, i) =>
                                (i+1) + '. ' + (p.projectDesc || p.projectId) + ' (' + p.taskId + ') \u2014 ' + p.totalHours.toFixed(0) + 'h / ' + p.count + ' entries / AccountInd:' + p.accountInd + (p.sampleDescriptions.length > 0 ? ' \u2014 e.g. "' + p.sampleDescriptions[0] + '"' : '')
                            ).join('\n');
                    }

                    let fileBlock = '';
                    if (context.fileContext) {
                        fileBlock = '\n\n## USER CONTEXT FILE ("' + (context.fileContextName || 'unknown') + '")\n' + context.fileContext.substring(0, 20000);
                    }

                    return '# ROLE\nYou are a precise, intelligent Time Recording Assistant for SAP CATS. You help a SOFTWARE DEVELOPER record accurate work time.\n\n# REASONING PROCESS\nFor each user request, follow these steps:\n1. **PARSE** \u2014 What did they do? When? For how long?\n2. **MATCH** \u2014 Find the best project/task from their favorites or history\n3. **VERIFY** \u2014 If match confidence < 80%, call `askUser` to clarify instead of guessing\n4. **DISTRIBUTE** \u2014 Apply realistic hours (see rules)\n5. **VALIDATE** \u2014 Ensure each day totals 8.0h, descriptions are unique and specific\n\n# TIME DISTRIBUTION RULES\n- Development/billable work: 7.0\u20137.5h/day (AccountInd: "10") \u2014 THIS IS THE MAJORITY\n- Admin/non-billable: MAX 0.5h/day (AccountInd: "90") \u2014 emails, standups, org tasks\n- NEVER: 8h "reading emails", 8h "admin", same description for multiple days\n- ALWAYS: Include ~0.5h admin entry per day unless user says otherwise\n\n# DATE PARSING\nResolve natural language: "Monday" \u2192 most recent Monday, "yesterday" \u2192 yesterday, "last week" \u2192 last week\'s workdays, "the 15th" \u2192 15th of current month. Output as YYYYMMDD.\n\n# WHEN UNCERTAIN\nCall `askUser` with options rather than guessing. Example: "I\'m not sure if this is Tower Application or Tower Platform. Which one?"\n\n# CURRENT CONTEXT\n- Today: ' + context.currentDate + '\n- Selected days: ' + (context.selectedDays.length > 0 ? context.selectedDays.join(', ') : 'none') + '\n- Missing days: ' + (context.missingDays.length > 0 ? context.missingDays.length + ': ' + context.missingDays.slice(0, 8).join(', ') + (context.missingDays.length > 8 ? '...' : '') : 'none') + '\n- Month: ' + (context.monthSummary?.completionRate || 0) + '% complete (' + (context.monthSummary?.totalHours || 0) + 'h / ' + (context.monthSummary?.requiredHours || 0) + 'h)\n\n# RECENT RECORDINGS (for pattern matching)\nLast week: ' + JSON.stringify(TimeRecordingCalendar.getTimes(-1)) + '\nThis week: ' + JSON.stringify(TimeRecordingCalendar.getTimes(0)) + '\n' + (context.selectedDays.length > 0 ? 'Selected days data: ' + JSON.stringify(TimeRecordingCalendar.getTimes(0, context.selectedDays, true)) : '') + historyBlock + fileBlock + '\n\n# AVAILABLE PROJECTS (use EXACT IDs)\n' + context.favorites.map(f => '- "' + f.name + '": ' + f.projectDesc + ' (ProjectID: ' + f.projectId + ', TaskID: ' + f.taskId + ')').join('\n') + '\n\n## Priority projects (use if they match the work description):\nIN 2911.IN.0074-01 \u2014 Employee information, info nuggets\nIN 2911.IN.0072-01..11 \u2014 Meetings Tower (Application/Compute/DataCenter/Delivery/EndUser/ITMgmt/Network/Output/Platform/Security/Storage)\nIN 2911.IN.0073-01..11 \u2014 Idle Time Tower (same tower breakdown)\nAD 2911.AD.0005-01 \u2014 Local Leadership tasks\nAD 2911.AD.0006-01 \u2014 Local administrative work\nTR 2911.TR.0004-01..11 \u2014 Training Tower (same tower breakdown)\n\n# FEW-SHOT EXAMPLES\n\n**User:** "I worked on the application deployment pipeline on Monday"\n**Response:**\n```json\n{"entries":[{"AccountInd":"10","date":"20260323","projectId":"...","taskId":"...","hours":7.5,"description":"Implemented CI/CD pipeline improvements for application deployment, configured staging environment"},{"AccountInd":"90","date":"20260323","projectId":"2911.AD.0006","taskId":"2911.AD.0006-01","hours":0.5,"description":"Daily standup, email triage, team coordination"}]}\n```\n\n**User:** "Fill my missing days with platform work"\n**Response:** Generates unique entries for each missing day, varying descriptions like "Platform API endpoint optimization", "Platform monitoring dashboard updates", etc.\n\n# OUTPUT FORMAT\nWhen suggesting entries, output EXACTLY ONE JSON block:\n```json\n{"entries":[{"AccountInd":"10","date":"YYYYMMDD","projectId":"exact_id","taskId":"exact_task_id","hours":7.5,"description":"Specific unique description"},{"AccountInd":"90","date":"YYYYMMDD","projectId":"2911.AD.0006","taskId":"2911.AD.0006-01","hours":0.5,"description":"Admin task description"}]}\n```\n\n# RULES\n- If user asks a question, answer it \u2014 do not generate entries unless asked\n- Each day MUST total exactly 8.0 hours\n- Each description must be UNIQUE and SPECIFIC\n- NEVER guess project \u2014 call `askUser` when unsure\n- Combine ALL entries into ONE JSON block';
                },

                // Build prompt for meeting imports
                buildPromptForMeetings: function (message, context, meetings) {
                    return 'You are a Time Recording Assistant. Create time entries for these meetings.\n\nRULES:\n1. Use EXACT meeting name in description\n2. Use EXACT duration (not rounded to 8h)\n3. If PSP element (format: XXXX.XX.XXXX-XX-XX) appears in title, use it as project\n4. Each meeting = one entry on its specific date\n5. Include meeting time (e.g., "09:00-10:30") in description\n\nAvailable Projects:\n' + context.favorites.map(f => '- "' + f.name + '": ProjectID: ' + f.projectId + ', TaskID: ' + f.taskId).join('\n') + '\n\nPriority mappings: IN 2911.IN.0072-01..11 = Meetings Tower, AD 2911.AD.0005-01 = Leadership, AD 2911.AD.0006-01 = Admin\n\nMeeting Data:\n' + meetings + '\n\nOutput ONE JSON block:\n```json\n{"entries":[{"date":"YYYYMMDD","projectId":"id","taskId":"task_id","hours":1.5,"description":"EXACT meeting title (HH:MM-HH:MM)"}]}\n```\nToday: ' + context.currentDate;
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
                    const models = TimeRecordingConfig.ai?.availableModels || {};
                    if (models[modelKey]) {
                        TimeRecordingConfig.ai.model = modelKey;
                        this.addMessage('model', '\u{1F504} Switched to **' + models[modelKey].name + '** (' + models[modelKey].description + ')');
                    } else {
                        this.addMessage('model', '\u274C Unknown model: ' + modelKey + '. Available: ' + Object.keys(models).join(', '));
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
