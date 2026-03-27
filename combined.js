// Time Recording Calendar - Enhanced AI Assistant Module
window.TimeRecordingAI = {
    apiKey: null,
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
    conversationHistory: [],
    maxHistoryLength: 20,

    // Available functions the AI can call
    availableFunctions: {
        getMissingDays: {
            description: "Get list of days missing time records",
            execute: async () => {
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
        },
        getRecordsForDate: {
            description: "Get time records for a specific date",
            execute: async (date) => {
                return await TimeRecordingAPI.fetchTimeRecords(new Date(date));
            }
        },
        getProjectDetails: {
            description: "Get details about a project",
            execute: async (projectId) => {
                return await TimeRecordingAPI.getProjectDetails(projectId);
            }
        },
        getMonthSummary: {
            description: "Get current month summary",
            execute: async () => {
                const monthData = TimeRecordingCalendar.monthData;
                return {
                    month: monthData.monthName,
                    totalHours: monthData.totalHours,
                    requiredHours: monthData.requiredHours,
                    completionRate: monthData.completionRate,
                    daysWithRecords: monthData.days.filter(d => d.totalHours > 0).length,
                    missingDays: monthData.days.filter(d => d.isWorkDay && !d.isHoliday && !d.isFuture && d.totalHours === 0).length
                };
            }
        },
        getFavorites: {
            description: "Get user's favorite projects",
            execute: async () => {
                return TimeRecordingAPI.getUserFavorites();
            }
        }
    },

    // Initialize AI module
    init: function (apiKey) {
        this.apiKey = apiKey;
        if (! apiKey) {
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
            this.addMessage('model', `Hello! I'm your Time Recording AI Assistant. I can:
- Record time entries for multiple days
- Analyze your time patterns
- Suggest time allocations
- Help with missing days

I have access to your calendar data and can help you quickly record your work time. Just describe what you worked on!`);
        }
    },

    // Send message to AI with enhanced context
    sendMessage: async function (message) {
        if (!this.apiKey) {
            this.addMessage('user', message);
            this.addMessage('model', 'Please configure the AI with an API key first.');
            return;
        }

        // Add user message to chat
        this.addMessage('user', message);

        // Check if message contains a function request
        const functionCall = await this.checkForFunctionCall(message);
        if (functionCall) {
            await this.executeFunctionCall(functionCall);
            return;
        }

        // Prepare enhanced context
        const context = await this.prepareEnhancedContext();

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await this.callGeminiAPI(message, context);
            this.hideTypingIndicator();

            // Process AI response
            this.processAIResponse(response);

        } catch (error) {
            this.hideTypingIndicator();
            TimeRecordingUtils.log('error', 'AI request failed', error);
            this.addMessage('model', 'Sorry, I encountered an error. Please try again. Error: ' + error.message);
        }
    },

    // Check if message requests a function call
    checkForFunctionCall: async function (message) {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('missing days') || lowerMessage.includes('which days')) {
            return 'getMissingDays';
        }
        if (lowerMessage.includes('month summary') || lowerMessage.includes('how many hours')) {
            return 'getMonthSummary';
        }
        if (lowerMessage.includes('show favorites') || lowerMessage.includes('list projects')) {
            return 'getFavorites';
        }

        return null;
    },

    // Execute function call
    executeFunctionCall: async function (functionName) {
        this.showTypingIndicator();

        try {
            const result = await this.availableFunctions[functionName].execute();
            this.hideTypingIndicator();

            // Format and display result
            let message = '';
            if (functionName === 'getMissingDays') {
                if (result.length === 0) {
                    message = '✅ Great! All working days have time records.';
                } else {
                    message = `📅 Days missing time records (${
                        result.length
                    } days):\n\n`;
                    message += result.map(d => `• ${
                        d.displayDate
                    } (${
                        d.dayName
                    })`).join('\n');
                    message += '\n\nWould you like me to help you record time for these days?';
                }
            } else if (functionName === 'getMonthSummary') {
                message = `📊 ${
                    result.month
                } Summary:\n`;
                message += `• Total Hours: ${
                    result.totalHours
                }h of ${
                    result.requiredHours
                }h (${
                    result.completionRate
                }%)\n`;
                message += `• Days with records: ${
                    result.daysWithRecords
                }\n`;
                message += `• Missing days: ${
                    result.missingDays
                }`;
            } else if (functionName === 'getFavorites') {
                message = `⭐ Your Favorite Projects:\n\n`;
                message += result.slice(0, 10).map((f, i) => `${
                    i + 1
                }. ${
                    f.Name
                }\n   Project: ${
                    f.AccProjDesc
                }\n   ID: ${
                    f.AccProjId
                }`).join('\n\n');
            }

            this.addMessage('model', message);

        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('model', `Error executing function: ${
                error.message
            }`);
        }
    },

    // Prepare enhanced context with chat history
    prepareEnhancedContext: async function () {
        const currentMonth = TimeRecordingCalendar.monthData;
        const favorites = TimeRecordingAPI.getUserFavorites();

        // Get selected days
        const selectedDays = Array.from(TimeRecordingUI.selectedDays || []);

        // Get missing days
        const missingDays = await this.availableFunctions.getMissingDays.execute();

        // Get recent chat history (last 10 exchanges)
        const recentHistory = this.conversationHistory.slice(-10).map(msg => ({
            role: msg.sender,
            parts: [
                {
                    text: msg.content.replace(/<[^>]*>/g, '') // Remove HTML tags
                }
            ]
        }));

        return {
            currentDate: new Date().toISOString().split('T')[0],
            selectedDays: selectedDays,
            missingDays: missingDays.map(d => d.date),
            favorites: favorites.map(f => ({
                guid: f.Guid,
                name: f.Name,
                projectId: f.AccProjId,
                projectDesc: f.AccProjDesc,
                taskId: f.AccTaskPspId,
                taskDesc: f.AccTaskPspDesc
            })),
            monthSummary: currentMonth ? {
                month: currentMonth.monthName,
                totalHours: currentMonth.totalHours,
                requiredHours: currentMonth.requiredHours,
                completionRate: currentMonth.completionRate
            } : null,
            chatHistory: recentHistory
        };
    },
    buildPromptForMeetings: function (message, context, meetings) {
        return `You are an intelligent Time Recording Assistant for SAP. You need to create time entries for meetings.

CRITICAL RULES FOR MEETING IMPORTS:
1. Use the EXACT meeting name in the description - DO NOT paraphrase or summarize
2. Use the EXACT duration specified for each meeting
3. If a PSP element (format: XXXX.XX.XXXX-XX-XX-XX) appears in the meeting title, use it as the accounting object
4. Each meeting gets its own time entry on the specific date it occurred
5. Preserve the original meeting information in the description

Current Context:
- Import period: ${
            context.importStartDate
        } to ${
            context.importEndDate
        }
- Available Projects: 
${
            context.favorites.map(f => `  - "${
                f.name
            }": ProjectID: ${
                f.projectId
            }, TaskID: ${
                f.taskId
            }`).join('\n')
        }

Meeting Data to Import:
${meetings}

Instructions:
1. Create one time entry per meeting
2. Match PSP elements from meeting titles to project IDs
3. If no PSP match, try to intelligently match based on meeting content
4. Use exact meeting duration (not rounded to 8 hours)
5. Include meeting time (e.g., "09:00-10:30") in description

Generate ONE JSON block with ALL meeting entries:
\`\`\`json
{
  "entries": [
    {
      "date": "YYYYMMDD",
      "projectId": "matched_project_id",
      "taskId": "matched_task_id", 
      "hours": exact_meeting_duration,
      "description": "EXACT meeting title (HH:MM-HH:MM)"
    }
  ]
}
\`\`\`
today is the ${
            context.currentDate
        }`;
    },
    // Build enhanced prompt
    buildPrompt: function (message, context) {
        return `You are an intelligent Time Recording Assistant for SAP. You help users efficiently record their work time, 
            and creatively generate unique time entries for each day => no repetitions / copy paste of texts
            also choose the correct project and task ids based on the context.

CRITICAL INSTRUCTION: Generate ONLY ONE JSON block per response. Combine all entries into a single JSON structure.

Current Context:
- Today: ${
            context.currentDate
        }
- Selected days: ${
            context.selectedDays.length > 0 ? context.selectedDays.join(', ') : 'none'
        }
- Missing time records: ${
            context.missingDays.length > 0 ? `${
                context.missingDays.length
            } days: ${
                context.missingDays.slice(0, 5).join(', ')
            }${
                context.missingDays.length > 5 ? '...' : ''
            }` : 'none'
        }
- Month completion: ${
            context.monthSummary ?. completionRate || 0
        }% (${
            context.monthSummary ?. totalHours || 0
        }h of ${
            context.monthSummary ?. requiredHours || 0
        }h)
- last weeks time recordings and texts:
${
            // get the times from the calender
            JSON.stringify(TimeRecordingCalendar.getTimes(-1)) || TimeRecordingCalendar.getTimes(-1).join('\n')
        }
- this weeks time recordings and texts:
${
            // get the times from the calender
            JSON.stringify(TimeRecordingCalendar.getTimes(0)) || TimeRecordingCalendar.getTimes(0).join('\n')
        }
- next weeks time recordings and texts:
${
            // get the times from the calender
            JSON.stringify(TimeRecordingCalendar.getTimes(1)) || TimeRecordingCalendar.getTimes(1).join('\n')
        }
User's preferred Projects (MUST use these exact IDs):
${
            context.favorites.map(f => `- "${
                f.name
            }": ${
                f.projectDesc
            } (ProjectID: ${
                f.projectId
            }, TaskID: ${
                f.taskId
            })`).join('\n')
        }



Instructions:
1. Understand the user's work description and context from chat history
2. Match activities to the EXACT ProjectID and TaskID from favorites
3. Generate ONE SINGLE JSON block with ALL entries
4. Default to 8 hours per day unless specified
5. Be intelligent - understand context, patterns, and user preferences
6. If user mentions multiple projects/tasks for the same day, split the hours appropriately

IMPORTANT: Output format (ONLY ONE JSON BLOCK):
\`\`\`json
{
  "entries": [
    {
      "AccountInd": recordData.accountInd || "10",//default 10 => makes our company money / billable hours, for things like admin use 90
      "date": "YYYYMMDD",
      "projectId": "exact_project_id",
      "taskId": "exact_task_id",
      "hours": 8.0,
      "description": "Clear description"
    }
  ]
}
\`\`\`
today is the ${
            context.currentDate
        }
Remember: ONLY ONE JSON block, even if creating entries for multiple days or projects.`;
    },

    // Call Gemini API
    callGeminiAPI: async function (message, context) {
        const prompt = this.buildPrompt(message, context);

        const requestBody = {

            system_instruction: {
                parts: {
                    text: prompt
                }
            },
            contents: [
                ... context.chatHistory, {
                    role: "user",
                    parts: [
                        {
                            text: "Current message: "
                        }, {
                            text: `Prompt: "${message}"`
                        }
                    ]
                }
            ],

            generationConfig: {
                temperature: 0.4, // this controls randomness of output 0 = deterministic 1 = random
                topK: 64,
                topP: 0.95,
                // t
                // lots of tokens
                maxOutputTokens: 1024 * 8,

                thinkingConfig: {
                    thinkingBudget: 1024 * 8,
                    // Turn off thinking:
                    // thinkingBudget: 0
                    // Turn on dynamic thinking:
                    // thinkingBudget: -1
                }
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_NONE"
                }, {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_NONE"
                }, {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_NONE"
                }, {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_NONE"
                }

            ]
        };

        const response = await fetch(`${
            this.apiEndpoint
        }?key=${
            this.apiKey
        }`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (! response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error ?. message || `API request failed: ${
                response.status
            }`);
        }

        const data = await response.json();

        if (! data.candidates || ! data.candidates[0] || ! data.candidates[0].content) {
            throw new Error('Invalid response from AI');
        }

        return data.candidates[0].content.parts[0].text;
    },

    // Process AI response with entry review
    processAIResponse: function (response) { // Check if response contains JSON
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);

        if (jsonMatch) {
            try {
                const jsonData = JSON.parse(jsonMatch[1]);

                // Add response message
                const textBefore = response.substring(0, response.indexOf('```json')).trim();
                const textAfter = response.substring(response.indexOf('```', response.indexOf('```json') + 7) + 3).trim();

                let message = '';
                if (textBefore) 
                    message += textBefore + '\n\n';
                


                if (textAfter) 
                    message += '\n' + textAfter;
                


                this.addMessage('model', message || 'Here are the suggested time entries:', jsonData);

                // Show entry review dialog
                if (jsonData.entries && jsonData.entries.length > 0) {
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

    // Show entry review dialog
    showEntryReviewDialog: function (entries) { // Create review dialog
        const dialog = document.createElement('div');
        dialog.id = 'trEntryReviewDialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 10001;
            width: 800px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;

        dialog.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; color: white; border-radius: 12px 12px 0 0;">
                <h3 style="margin: 0;">Review Time Entries</h3>
                <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Select entries to import or click to edit</p>
            </div>
            <div style="flex: 1; overflow-y: auto; padding: 20px;">
                <div id="trEntryList"></div>
            </div>
            <div style="padding: 20px; border-top: 1px solid #dee2e6; display: flex; gap: 10px; justify-content: space-between;">
                <div style="flex: 1;">
                    <input type="text" id="trEntryEditInput" placeholder="Ask AI to modify selected entries..." style="width: 100%; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px;">
                </div>
                <button id="trImportSelected" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer;">Import Selected</button>
                <button id="trCancelReview" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
            </div>
        `;

        document.body.appendChild(dialog);

        // Render entries
        const entryList = document.getElementById('trEntryList');
        entries.forEach((entry, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.style.cssText = `
                padding: 15px;
                margin-bottom: 10px;
                border: 2px solid #dee2e6;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            `;

            const dateFormatted = `${
                entry.date.substr(6, 2)
            }.${
                entry.date.substr(4, 2)
            }.${
                entry.date.substr(0, 4)
            }`;

            entryDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <input type="checkbox" checked data-index="${index}" style="width: 20px; height: 20px; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 5px;">📅 ${dateFormatted} - ${
                entry.hours
            }h</div>
                        <div style="color: #666; font-size: 14px; margin-bottom: 3px;">📁 ${
                entry.projectId
            } / ${
                entry.taskId
            }</div>
                        <div style="color: #333;">📝 ${
                entry.description
            }</div>
                    </div>
                </div>
            `;

            entryList.appendChild(entryDiv);

            // Click to edit
            entryDiv.onclick = (e) => {
                if (e.target.type !== 'checkbox') {
                    const input = document.getElementById('trEntryEditInput');
                    input.value = `Change entry ${
                        index + 1
                    } to: `;
                    input.focus();
                }
            };
        });

        // Event handlers
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

        document.getElementById('trCancelReview').onclick = () => {
            dialog.remove();
        };

        document.getElementById('trEntryEditInput').onkeypress = async (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                const message = e.target.value.trim();
                dialog.remove();
                await this.sendMessage(message);
            }
        };
    },

    // Import time entries
    importTimeEntries: async function (entries) {
        console.log('Importing time entries from AI:', entries);

        // Validate entries
        const validEntries = entries.filter(entry => {
            return entry.date && entry.projectId && entry.hours && entry.description;
        });

        if (validEntries.length === 0) {
            alert('No valid entries to import');
            return;
        }

        // Call the recording function
        const error = await TimeRecordingUI.recordTimeEntries(validEntries);
        //when error, => task ai to fix it 
        if (error) {
            
            this.sendMessage(`one or more Errors occured, please try again. Errors: ${error.map(err => 
                `${err.date}: ${err.error}`
            ).join('\n')}
            Entries: ${JSON.stringify(validEntries)}
            `);

            return;
        }
        this.addMessage('model', `✅ Successfully prepared ${
            validEntries.length
        } time ${
            validEntries.length === 1 ? 'entry' : 'entries'
        } for import`);
    },

    // Add message to chat
    addMessage: function (sender, content, data = null) {
        const container = document.getElementById('trAIChatMessages');
        if (! container) 
            return;
        


        const messageDiv = document.createElement('div');
        messageDiv.className = `tr-ai-message tr-ai-message-${sender}`;
        messageDiv.style.marginBottom = '10px';

        // Process content for display
        let displayContent = content;
        if (! displayContent.includes('<pre')) {
            displayContent = displayContent.replace(/\n/g, '<br>');
        }

        messageDiv.innerHTML = `
            <div style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">
                ${
            sender === 'user' ? '👤 You' : '🤖 AI Assistant'
        }
            </div>
            <div style="font-size: 13px; line-height: 1.5;">${displayContent}</div>
        `;

        container.appendChild(messageDiv);

        // Store in history
        this.conversationHistory.push({sender: sender, content: content, data: data, timestamp: new Date()});

        // Trim history if too long
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    },

    // Show typing indicator
    showTypingIndicator: function () {
        const container = document.getElementById('trAIChatMessages');
        if (! container) 
            return;
        


        const indicator = document.createElement('div');
        indicator.id = 'trAITypingIndicator';
        indicator.className = 'tr-ai-message tr-ai-message-assistant';
        indicator.style.marginBottom = '10px';
        indicator.innerHTML = '<div style="color: #666; font-style: italic;">🤖 AI is thinking...</div>';

        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
    },

    // Hide typing indicator
    hideTypingIndicator: function () {
        const indicator = document.getElementById('trAITypingIndicator');
        if (indicator) 
            indicator.remove();
        


    },

    // Clear chat history
    clearChat: function () {
        const container = document.getElementById('trAIChatMessages');
        if (container) {
            container.innerHTML = '';
        }
        this.conversationHistory = [];
        this.initializeChat();
    },

    // Export conversation
    exportConversation: function () {
        return this.conversationHistory;
    }
};
// Time Recording Calendar - API Service Module (UPDATED with real SAP API)
window.TimeRecordingAPI = {
    csrfToken: null,
    holidays: {},
    userFavorites: [],
    batchQueue: [],
    batchTimer: null,
    batchPromises: new Map(),
    API_BASE_URL: 'https://s018.fl.witglobal.net/sap/opu/odata/www/cats_cyd_srv',
    SAP_CLIENT: '001',
    
    // Initialize API service
    init: async function() {
        try {
            // Fetch CSRF token
            await this.fetchCSRFToken();
            
            // Load favorites directly since we're on s018
            await this.loadUserFavorites();
            
            // Use fallback holidays
            this.loadFallbackHolidays();
            
            return true;
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to initialize API service', error);
            throw error;
        }
    },
    
    // CSRF Token fetch (using your working implementation)
    fetchCSRFToken: async function() {
        console.log("Fetching CSRF token...");
        try {
            const response = await fetch(`${this.API_BASE_URL}/?sap-client=${this.SAP_CLIENT}`, {
                method: 'HEAD',
                headers: {
                    'X-CSRF-Token': 'Fetch',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch CSRF token. Status: ${response.status}`);
            }

            this.csrfToken = response.headers.get('x-csrf-token');
            if (!this.csrfToken) {
                throw new Error("CSRF token not found in response headers.");
            }
            console.log("✅ CSRF token obtained successfully:", this.csrfToken);
            return this.csrfToken;
        } catch (error) {
            console.error("❌ Error during CSRF token fetch:", error);
            throw error;
        }
    },
    
    // Helper to generate boundary
    generateBoundary: function(prefix) {
        const hex = () => Math.random().toString(16).substr(2, 4);
        return `${prefix}_${hex()}-${hex()}-${hex()}`;
    },
    
    // Parse batch response (your implementation)
    parseBatchResponse: function(rawResponse, contentTypeHeader) {
        const boundaryMatch = contentTypeHeader.match(/boundary=(.+)/);
        if (!boundaryMatch) {
            console.error("Could not find boundary in Content-Type header.");
            return [{ error: "Could not parse batch response: boundary missing." }];
        }
        const boundary = `--${boundaryMatch[1]}`;
        const parts = rawResponse.split(boundary).filter(part => part.trim() !== "" && part.trim() !== "--");
        
        return parts.map(part => {
            const jsonStartIndex = part.indexOf('{');
            if (jsonStartIndex === -1) {
                const changesetBoundaryMatch = part.match(/boundary=(changeset_.+)/);
                if(changesetBoundaryMatch) {
                    const changesetBoundary = `--${changesetBoundaryMatch[1]}`;
                    const changesetParts = part.split(changesetBoundary).filter(csPart => csPart.trim() !== "" && csPart.trim() !== "--");
                    return changesetParts.map(csPart => {
                        const csJsonIndex = csPart.indexOf('{');
                        if (csJsonIndex !== -1) {
                            const csJsonString = csPart.substring(csJsonIndex);
                            try { return JSON.parse(csJsonString); } catch(e) { /* ignore parse error */ }
                        }
                        return null;
                    }).filter(p => p);
                }
                return { error: "No JSON body found in this part." };
            }
            
            const jsonString = part.substring(jsonStartIndex);
            try {
                return JSON.parse(jsonString);
            } catch (e) {
                return { error: "Failed to parse JSON body", content: jsonString };
            }
        });
    },
    
    // Execute batch request (your implementation)
    executeBatchRequest: async function(getRequests = [], postRequest = null) {
        const batchBoundary = this.generateBoundary('batch');
        const CRLF = '\r\n';
        let body = '';

        // Handle GET requests
        getRequests.forEach(req => {
            body += `--${batchBoundary}${CRLF}`;
            body += `Content-Type: application/http${CRLF}`;
            body += `Content-Transfer-Encoding: binary${CRLF}`;
            body += `${CRLF}`;
            body += `GET ${req} HTTP/1.1${CRLF}`;
            body += `sap-cancel-on-close: true${CRLF}`;
            body += `sap-contextid-accept: header${CRLF}`;
            body += `Accept: application/json${CRLF}`;
            body += `Accept-Language: en${CRLF}`;
            body += `DataServiceVersion: 2.0${CRLF}`;
            body += `MaxDataServiceVersion: 2.0${CRLF}`;
            body += `X-Requested-With: XMLHttpRequest${CRLF}`;
            body += `${CRLF}`;
            body += `${CRLF}`;
        });
        
        // Handle POST request (changeset)
        if (postRequest) {
            const changesetBoundary = this.generateBoundary('changeset');
            body += `--${batchBoundary}${CRLF}`;
            body += `Content-Type: multipart/mixed; boundary=${changesetBoundary}${CRLF}${CRLF}`;
            
            body += `--${changesetBoundary}${CRLF}`;
            body += `Content-Type: application/http${CRLF}`;
            body += `Content-Transfer-Encoding: binary${CRLF}${CRLF}`;
            body += `POST ${postRequest.resource}?sap-client=${this.SAP_CLIENT} HTTP/1.1${CRLF}`;
            body += `sap-cancel-on-close: false${CRLF}`;
            body += `sap-contextid-accept: header${CRLF}`;
            body += `Accept: application/json${CRLF}`;
            body += `Accept-Language: en${CRLF}`;
            body += `DataServiceVersion: 2.0${CRLF}`;
            body += `MaxDataServiceVersion: 2.0${CRLF}`;
            body += `X-Requested-With: XMLHttpRequest${CRLF}`;
            body += `x-csrf-token: ${this.csrfToken}${CRLF}`;
            body += `Content-Type: application/json${CRLF}`;
            body += `Content-ID: id-${new Date().getTime()}-1${CRLF}`;
            const payloadString = JSON.stringify(postRequest.payload);
            body += `Content-Length: ${payloadString.length}${CRLF}${CRLF}`;
            body += `${payloadString}${CRLF}`;
            
            body += `--${changesetBoundary}--${CRLF}`;
        }

        if (getRequests.length > 0 || postRequest) {
            body += `--${batchBoundary}--${CRLF}`;
        }

        const response = await fetch(`${this.API_BASE_URL}/$batch?sap-client=${this.SAP_CLIENT}`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/mixed; boundary=${batchBoundary}`,
                'x-csrf-token': this.csrfToken,
            },
            credentials: 'include',
            body: body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server responded with an error:", errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        const rawData = await response.text();
        
        return this.parseBatchResponse(rawData, contentType);
    },
    
    // Load user favorites using the real API
    loadUserFavorites: async function() {
        const config = TimeRecordingConfig.sap;
        
        try {
            console.log("Loading favorites from SAP...");
            
            const requests = [
                `UserFavoritesSet?sap-client=${this.SAP_CLIENT}&$filter=Pernr%20eq%20%27${config.userPernr}%27%20`
            ];
            
            const response = await this.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results) {
                this.userFavorites = response[0].d.results;
                TimeRecordingUtils.log('info', `✅ Loaded ${this.userFavorites.length} favorites from SAP`);
                
                // Log first few favorites
                this.userFavorites.slice(0, 3).forEach((fav, idx) => {
                    TimeRecordingUtils.log('debug', `  ${idx + 1}. ${fav.Name} - ${fav.AccProjDesc}`);
                });
                
                return this.userFavorites;
            } else {
                TimeRecordingUtils.log('warning', 'No user favorites found');
                this.userFavorites = [];
                return [];
            }
            
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to load favorites:', error);
            this.userFavorites = [];
            return [];
        }
    },
    
    // Get user favorites
    getUserFavorites: function() {

        return this.userFavorites || [];
    },
    
    // CREATE TIME RECORD - The main function to record time
    
createTimeRecord: async function(recordData) {
    try {
        // Ensure we have a CSRF token
        if (!this.csrfToken) {
            await this.fetchCSRFToken();
        }
        
        const config = TimeRecordingConfig.sap;
        
        // FIX: Ensure hours is a number and format it properly
        const hours = typeof recordData.hours === 'string' ? parseFloat(recordData.hours) : recordData.hours;
        const formattedHours = hours.toFixed(2);
        
        // Build the payload
        const timeRecordPayload = {
            "Pernr": config.userPernr,
            "NavToTimeRecordS4": [{
                "Pernr": config.userPernr,
                "Mode": "N", // New entry
                "RecordDate": recordData.date, // Format: YYYYMMDD
                "Duration": formattedHours,  // Use the properly formatted hours
                "AccountInd": recordData.accountInd || "10",
                "Content": recordData.description,
                "AccProjId": recordData.projectId,
                "AccTaskPspId": recordData.taskId,
                "AccProjDesc": recordData.projectDesc || "",
                "AccTaskPspDesc": recordData.taskDesc || "",
                "AccountIndDesc": "",
                "AccProjGuid": "",
                "AccTaskGuid": "",
                "AccTaskId": "",
                "AccTaskDesc": "",
                "Counter": "",
                "AccTaskObjType": "",
                "TicketGuid": "",
                "StartTime": "PT00H00M",
                "EndTime": "PT00H00M",
                "ObjectId": "",
                "TicketDescription": "",
                "StandByTypeValue": "",
                "StandByCompValue": "",
                "RemainingWork": "0.00"
            }]
        };
        
        const postRequest = {
            resource: 'TimeRecordHdrSet',
            payload: timeRecordPayload
        };
        
        console.log("Creating time record:", timeRecordPayload);
        
        const response = await this.executeBatchRequest([], postRequest);
        
        if (response && response[0]) {
            TimeRecordingUtils.log('success', `✅ Time record created successfully`);
            return response[0];
        } else {
            throw new Error('Invalid response from server');
        }
        
    } catch (error) {
        TimeRecordingUtils.log('error', 'Failed to create time record:', error);
        throw error;
    }
},
    
    // CREATE MULTIPLE TIME RECORDS - THIS WAS MISSING!
    createMultipleTimeRecords: async function(records) {
        const results = [];
        const errors = [];
        
        TimeRecordingUtils.log('info', `Creating ${records.length} time records...`);
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            try {
                // Add delay between requests to avoid overwhelming the server
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                const result = await this.createTimeRecord(record);
                
                if(result.error && !result.content)
                {
                    errors.push({
                    success: false,
                    date: record.date,
                    error: JSON.stringify(result.error), // result
                });
                TimeRecordingUtils.log('error', `Record ${i + 1}/${records.length} failed:` + JSON.stringify(result.error));
                    continue;
                }
                results.push({
                    success: true,
                    date: record.date,
                    data: result
                });
                
                TimeRecordingUtils.log('info', `Record ${i + 1}/${records.length} created successfully`);
            } catch (error) {
                errors.push({
                    success: false,
                    date: record.date,
                    error: error.message
                });
                TimeRecordingUtils.log('error', `Record ${i + 1}/${records.length} failed:`, error);
            }
        }
        
        // Summary
        TimeRecordingUtils.log('info', `Completed: ${results.length} successful, ${errors.length} failed`);
        
        return {
            results,
            errors,
            summary: {
                total: records.length,
                successful: results.length,
                failed: errors.length
            }
        };
    },
    
    // Fetch time records for a specific date
    fetchTimeRecords: async function(date) {
        const config = TimeRecordingConfig.sap;
        const dateStr = TimeRecordingUtils.formatDate(date);
        
        try {
            const requests = [
                `TimeRecordS4Set?sap-client=${this.SAP_CLIENT}&$filter=Pernr%20eq%20%27${config.userPernr}%27%20and%20RecordDate%20eq%20%27${dateStr}%27`
            ];
            
            const response = await this.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results) {
                return response[0].d.results;
            }
            
            return [];
        } catch (error) {
            TimeRecordingUtils.log('error', `Failed to fetch records for ${dateStr}`, error);
            return [];
        }
    },
    
    // Get time records for a date range
    fetchTimeRecordsRange: async function(startDate, endDate) {
        const config = TimeRecordingConfig.sap;
        const startStr = TimeRecordingUtils.formatDate(startDate);
        const endStr = TimeRecordingUtils.formatDate(endDate);
        
        try {
            const requests = [
                `TimeRecordS4Set?sap-client=${this.SAP_CLIENT}&$filter=Pernr%20eq%20%27${config.userPernr}%27%20and%20RecordDate%20ge%20%27${startStr}%27%20and%20RecordDate%20le%20%27${endStr}%27`
            ];
            
            const response = await this.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results) {
                return response[0].d.results;
            }
            
            return [];
        } catch (error) {
            TimeRecordingUtils.log('error', `Failed to fetch records for range ${startStr} to ${endStr}`, error);
            return [];
        }
    },
    
    // Get project details
    getProjectDetails: async function(projectId) {
        try {
            const requests = [
                `ProjectSet?sap-client=${this.SAP_CLIENT}&$filter=ProjectId%20eq%20%27${projectId}%27`
            ];
            
            const response = await this.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results) {
                return response[0].d.results[0];
            }
            
            return null;
        } catch (error) {
            TimeRecordingUtils.log('error', `Failed to fetch project details for ${projectId}`, error);
            return null;
        }
    },
    
    // Fetch records for entire month (keep existing implementation)
    fetchMonthRecords: async function(year, month) {
        const days = TimeRecordingUtils.getWorkingDaysInMonth(year, month);
        
        TimeRecordingUtils.log('info', `Fetching time records for ${month + 1}/${year} (${days.length} working days)`);
        
        // Ensure we have CSRF token
        if (!this.csrfToken) {
            await this.fetchCSRFToken();
        }
        
        const records = {};
        
        // Fetch all days in smaller batches
        const batchSize = 5;
        for (let i = 0; i < days.length; i += batchSize) {
            const batch = days.slice(i, i + batchSize);
            
            const batchPromises = batch.map(day => {
                const dateKey = TimeRecordingUtils.formatDate(day);
                return this.fetchTimeRecords(day).then(data => {
                    records[dateKey] = data;
                }).catch(error => {
                    TimeRecordingUtils.log('error', `Failed to fetch ${dateKey}`, error);
                    records[dateKey] = [];
                });
            });
            
            await Promise.all(batchPromises);
            
            // Update progress
            const progress = Math.min(100, Math.round(((i + batchSize) / days.length) * 100));
            TimeRecordingUtils.log('info', `Progress: ${progress}%`);
        }
        
        // Calculate summary
        let totalHours = 0;
        let daysWithRecords = 0;
        
        for (const [dateKey, dayRecords] of Object.entries(records)) {
            if (dayRecords.length > 0) {
                daysWithRecords++;
                totalHours += dayRecords.reduce((sum, r) => sum + parseFloat(r.Duration || 0), 0);
            }
        }
        
        TimeRecordingUtils.log('info', `✅ Month summary: ${totalHours.toFixed(2)}h across ${daysWithRecords} days`);
        
        return records;
    },
    
    // Check budget for a task
    checkBudget: async function(accTaskPspId, duration) {
        try {
            const requests = [
                `CheckBudget?sap-client=${this.SAP_CLIENT}&AccTaskPspId=%27${accTaskPspId}%27&Duration=${duration}`
            ];
            
            const response = await this.executeBatchRequest(requests);
            return response[0];
        } catch (error) {
            TimeRecordingUtils.log('error', 'Budget check failed:', error);
            return null;
        }
    },
    
    // Fallback holidays
    loadFallbackHolidays: function() {
        this.holidays = {
            // 2025
            '2025-01-01': { name: 'Neujahr', date: '2025-01-01', isPublic: true },
            '2025-01-06': { name: 'Heilige Drei Könige', date: '2025-01-06', isPublic: true },
            '2025-04-18': { name: 'Karfreitag', date: '2025-04-18', isPublic: true },
            '2025-04-21': { name: 'Ostermontag', date: '2025-04-21', isPublic: true },
            '2025-05-01': { name: 'Tag der Arbeit', date: '2025-05-01', isPublic: true },
            '2025-05-29': { name: 'Christi Himmelfahrt', date: '2025-05-29', isPublic: true },
            '2025-06-09': { name: 'Pfingstmontag', date: '2025-06-09', isPublic: true },
            '2025-06-19': { name: 'Fronleichnam', date: '2025-06-19', isPublic: true },
            '2025-10-03': { name: 'Tag der Deutschen Einheit', date: '2025-10-03', isPublic: true },
            '2025-11-01': { name: 'Allerheiligen', date: '2025-11-01', isPublic: true },
            '2025-12-25': { name: '1. Weihnachtstag', date: '2025-12-25', isPublic: true },
            '2025-12-26': { name: '2. Weihnachtstag', date: '2025-12-26', isPublic: true }
        };
        
        TimeRecordingUtils.log('info', `Loaded ${Object.keys(this.holidays).length} fallback holidays`);
    },
    
    // Check if date is holiday
    isHoliday: function(date) {
        const dateStr = date.toISOString().split('T')[0];
        return !!this.holidays[dateStr];
    },
    
    // Get holiday info
    getHolidayInfo: function(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.holidays[dateStr] || null;
    }
};
// Time Recording Calendar - Calendar Core Module (UPDATED)

window.TimeRecordingCalendar = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    monthData: {},
    
    // Initialize calendar
    init: async function() {
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        
        await this.loadCurrentMonth();
        return true;
    },
    
    // Load data for current month
    loadCurrentMonth: async function() {
        const year = this.currentYear;
        const month = this.currentMonth;
        
        TimeRecordingUtils.log('info', `Loading calendar for ${month + 1}/${year}`);
        
        // Fetch time records
        const records = await TimeRecordingAPI.fetchMonthRecords(year, month);
        
        // Build month data
        this.monthData = this.buildMonthData(year, month, records);
        
        // Update UI
        if (window.TimeRecordingUI) {
            window.TimeRecordingUI.renderCalendar(this.monthData);
        }
        
        return this.monthData;
    },
    
    // Build month data structure (UPDATED to include all days)
    buildMonthData: function(year, month, records) {
        const data = {
            year: year,
            month: month,
            monthName: TimeRecordingUtils.formatMonth(new Date(year, month, 1)),
            days: [],
            totalHours: 0,
            requiredHours: 0,
            completionRate: 0
        };
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Start from the beginning of the week
        const startDate = new Date(firstDay);
        const firstDayOfWeek = startDate.getDay() || 7; // Convert Sunday (0) to 7
        startDate.setDate(startDate.getDate() - firstDayOfWeek + 1); // Start from Monday
        
        // End at the end of the week
        const endDate = new Date(lastDay);
        const lastDayOfWeek = endDate.getDay() || 7;
        if (lastDayOfWeek < 7) {
            endDate.setDate(endDate.getDate() + (7 - lastDayOfWeek));
        }
        
        // Build day data for ALL days (including weekends)
        const current = new Date(startDate);
        while (current <= endDate) {
            const dayData = this.buildDayData(current, records);
            data.days.push(dayData);
            
            // Count totals for current month only (excluding weekends)
            if (current.getMonth() === month && !dayData.isWeekend) {
                if (dayData.isWorkDay && !dayData.isHoliday && !dayData.isFuture) {
                    data.requiredHours += TimeRecordingConfig.calendar.dailyQuota;
                    data.totalHours += dayData.totalHours;
                }
            }
            
            current.setDate(current.getDate() + 1);
        }
        
        // Calculate completion rate
        if (data.requiredHours > 0) {
            data.completionRate = Math.round((data.totalHours / data.requiredHours) * 100);
        }
        
        return data;
    },
    
    // Build data for a single day (UPDATED)
    buildDayData: function(date, records) {
        const dateKey = TimeRecordingUtils.formatDate(date);
        const dayRecords = records[dateKey] || [];
        
        const dayData = {
            date: new Date(date),
            dateKey: dateKey,
            displayDate: date.getDate(),
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            isCurrentMonth: date.getMonth() === this.currentMonth,
            isWeekend: TimeRecordingUtils.isWeekend(date),
            isToday: TimeRecordingUtils.isToday(date),
            isFuture: TimeRecordingUtils.isFuture(date),
            isHoliday: TimeRecordingAPI.isHoliday(date),
            holidayInfo: TimeRecordingAPI.getHolidayInfo(date),
            isWorkDay: false,
            records: dayRecords,
            totalHours: 0,
            status: 'none',
            color: ''
        };
        
        // Determine if it's a work day (excluding weekends)
        dayData.isWorkDay = !dayData.isWeekend && dayData.isCurrentMonth;
        
        // Calculate total hours
        dayData.totalHours = TimeRecordingUtils.calculateTotalHours(dayRecords);
        
        // Determine status and color
        if (!dayData.isCurrentMonth) {
            dayData.status = 'other-month';
            dayData.color = TimeRecordingConfig.ui.colors.weekend;
        } else if (dayData.isWeekend) {
            dayData.status = 'weekend';
            dayData.color = TimeRecordingConfig.ui.colors.weekend;
        } else if (dayData.isHoliday) {
            dayData.status = 'holiday';
            dayData.color = TimeRecordingConfig.ui.colors.holiday;
        } else if (dayData.isFuture) {
            dayData.status = 'future';
            dayData.color = TimeRecordingConfig.ui.colors.future;
        } else if (dayData.totalHours >= TimeRecordingConfig.calendar.dailyQuota) {
            dayData.status = 'complete';
            dayData.color = TimeRecordingConfig.ui.colors.complete;
        } else if (dayData.totalHours > 0) {
            dayData.status = 'partial';
            dayData.color = TimeRecordingConfig.ui.colors.partial;
        } else {
            dayData.status = 'missing';
            dayData.color = TimeRecordingConfig.ui.colors.missing;
        }
        
        return dayData;
    },
    
    // Navigate to previous month
    previousMonth: async function() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        await this.loadCurrentMonth();
    },
    
    // Navigate to next month
    nextMonth: async function() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        await this.loadCurrentMonth();
    },
    
    // Navigate to today
    goToToday: async function() {
        const today = new Date();
        this.currentMonth = today.getMonth();
        this.currentYear = today.getFullYear();
        await this.loadCurrentMonth();
    },
    
    // Refresh current month
    refresh: async function() {
        TimeRecordingUtils.log('info', 'Refreshing calendar data...');
        await this.loadCurrentMonth();
    },
    
    // Get current month data
    getCurrentMonthData: function() {
        return this.monthData;
    },
    // based on the week number ( when 0 = current week , 1 = next week , -1 = last week )
    // return all recorded times of that week as an json array
    // use the calenders data and if not loaded then load more.
    getTimes(relativeWeek) {
        const weekNumber = TimeRecordingUtils.getWeekNumber(new Date()) + relativeWeek;
        const records = this.monthData.days.filter(record => {
            const recordWeekNumber = TimeRecordingUtils.getWeekNumber(new Date(record.date));
            return recordWeekNumber === weekNumber;
        });
        return JSON.stringify(records);
    },


};
// Time Recording Calendar - Configuration Module
window.TimeRecordingConfig = {
    // SAP Configuration
    sap: {
        baseUrl: 'https://s018.fl.witglobal.net',
        client: '001',
        service: '/sap/opu/odata/www/cats_cyd_srv',
        userPernr: '00224895', // Your personnel number
        language: 'EN'
    },
    
    // Calendar Configuration
    calendar: {
        weeklyQuota: 40, // hours per week
        dailyQuota: 8,   // hours per day (40/5)
        workDays: [1, 2, 3, 4, 5], // Monday to Friday
        monthsToLoad: 3, // Load current month + previous/next
    },
    
    // Holiday API Configuration
    holidays: {
        apiUrl: 'https://feiertage-api.de/api/',
        state: 'BW', // Baden-Württemberg
        year: new Date().getFullYear()
    },
    
    // UI Configuration
    ui: {
        colors: {
            complete: '#28a745',      // Green for complete days
            partial: '#ffc107',       // Yellow for partial days
            missing: '#dc3545',       // Red for missing days
            holiday: '#6c757d',       // Gray for holidays
            weekend: '#e9ecef',       // Light gray for weekends
            today: '#007bff',         // Blue for today
            future: '#f8f9fa'         // Very light for future days
        },
        animations: true,
        autoRefresh: 300000 // Refresh every 5 minutes
    }
};
// Time Recording Calendar - Drag & Drop Module
window.TimeRecordingDrag = {
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },
    savedLayouts: {},
    
    // Initialize drag and drop
    init: function() {
        // Load saved layouts
        this.loadLayouts();
        
        // Make main panels draggable
        this.makeDraggable(document.getElementById('trMainView'));
        this.makeDraggable(document.getElementById('trAIPanel'));
        this.makeDraggable(document.getElementById('trDayDetailsPanel'));
        
        // Add resize handles
        this.addResizeHandles();
        
        // Enable time entry drag between days
        this.enableTimeEntryDrag();
    },
    
    // Make element draggable
    makeDraggable: function(element) {
        if (!element) return;
        
        // Find or create drag handle
        let handle = element.querySelector('.tr-drag-handle');
        if (!handle) {
            // Use header as drag handle
            handle = element.querySelector('[style*="background: linear-gradient"]');
        }
        
        if (!handle) return;
        
        handle.style.cursor = 'move';
        
        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return; // Don't drag on buttons
            
            this.draggedElement = element;
            this.dragOffset.x = e.clientX - element.offsetLeft;
            this.dragOffset.y = e.clientY - element.offsetTop;
            
            // Bring to front
            element.style.zIndex = '10005';
            
            // Add dragging class
            element.classList.add('tr-dragging');
            
            // Prevent text selection
            e.preventDefault();
        });
    },
    
    // Global mouse events for dragging
    initGlobalDragEvents: function() {
        document.addEventListener('mousemove', (e) => {
            if (!this.draggedElement) return;
            
            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;
            
            // Keep within viewport
            const maxX = window.innerWidth - this.draggedElement.offsetWidth;
            const maxY = window.innerHeight - this.draggedElement.offsetHeight;
            
            this.draggedElement.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            this.draggedElement.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
            this.draggedElement.style.transform = 'none'; // Remove centering transform
            this.draggedElement.style.position = 'fixed';
        });
        
        document.addEventListener('mouseup', () => {
            if (this.draggedElement) {
                this.draggedElement.classList.remove('tr-dragging');
                
                // Save position
                this.saveLayout(this.draggedElement.id, {
                    left: this.draggedElement.style.left,
                    top: this.draggedElement.style.top
                });
                
                this.draggedElement = null;
            }
        });
    },
    
    // Enable drag and drop for time entries
    enableTimeEntryDrag: function() {
        // Make entry blobs draggable
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('tr-entry-blob')) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    date: e.target.dataset.date,
                    index: e.target.dataset.index
                }));
                
                // Visual feedback
                e.target.style.opacity = '0.5';
            }
        });
        
        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('tr-entry-blob')) {
                e.target.style.opacity = '1';
            }
        });
        
        // Make calendar days drop zones
        document.addEventListener('dragover', (e) => {
            if (e.target.closest('.tr-calendar-day')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const dayElement = e.target.closest('.tr-calendar-day');
                dayElement.classList.add('tr-drop-hover');
            }
        });
        
        document.addEventListener('dragleave', (e) => {
            if (e.target.closest('.tr-calendar-day')) {
                const dayElement = e.target.closest('.tr-calendar-day');
                dayElement.classList.remove('tr-drop-hover');
            }
        });
        
        document.addEventListener('drop', async (e) => {
            const dayElement = e.target.closest('.tr-calendar-day');
            if (!dayElement) return;
            
            e.preventDefault();
            dayElement.classList.remove('tr-drop-hover');
            
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const targetDate = dayElement.dataset.date;
            
            if (data.date === targetDate) return; // Same day
            
            // Confirm move
            if (confirm(`Move this time entry to ${TimeRecordingUtils.formatDisplayDate(new Date(targetDate.substr(0,4) + '-' + targetDate.substr(4,2) + '-' + targetDate.substr(6,2)))}?`)) {
                await this.moveTimeEntry(data.date, data.index, targetDate);
            }
        });
    },
    
    // Move time entry to different day
    moveTimeEntry: async function(fromDate, entryIndex, toDate) {
        try {
            // Get the original entry
            const records = await TimeRecordingAPI.fetchTimeRecords(new Date(fromDate.substr(0,4) + '-' + fromDate.substr(4,2) + '-' + fromDate.substr(6,2)));
            const entry = records[entryIndex];
            
            if (!entry) {
                alert('Entry not found');
                return;
            }
            
            // Delete from original date
            const deletePayload = {
                ...entry,
                Mode: 'D'
            };
            await TimeRecordingEdit.updateTimeRecord(deletePayload);
            
            // Create on new date
            const createPayload = {
                date: toDate,
                hours: parseFloat(entry.Duration),
                description: entry.Content,
                projectId: entry.AccProjId,
                taskId: entry.AccTaskPspId,
                accountInd: entry.AccountInd
            };
            await TimeRecordingAPI.createTimeRecord(createPayload);
            
            // Refresh calendar
            TimeRecordingCalendar.refresh();
            
            TimeRecordingUtils.log('success', 'Time entry moved successfully');
            
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to move time entry:', error);
            alert('Failed to move time entry: ' + error.message);
        }
    },
    
    // Add resize handles to panels
    addResizeHandles: function() {
        const panels = [
            document.getElementById('trMainView'),
            document.getElementById('trAIPanel'),
            document.getElementById('trDayDetailsPanel')
        ];
        
        panels.forEach(panel => {
            if (!panel) return;
            
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'tr-resize-handle';
            resizeHandle.style.cssText = `
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                cursor: se-resize;
                background: linear-gradient(135deg, transparent 50%, #667eea 50%);
            `;
            
            panel.appendChild(resizeHandle);
            
            let isResizing = false;
            let startX, startY, startWidth, startHeight;
            
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(window.getComputedStyle(panel).width, 10);
                startHeight = parseInt(window.getComputedStyle(panel).height, 10);
                
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const width = startWidth + e.clientX - startX;
                const height = startHeight + e.clientY - startY;
                
                panel.style.width = width + 'px';
                panel.style.height = height + 'px';
                panel.style.maxHeight = 'none';
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    this.saveLayout(panel.id, {
                        width: panel.style.width,
                        height: panel.style.height
                    });
                }
            });
        });
    },
    
    // Save layout to localStorage
    saveLayout: function(elementId, layout) {
        if (!elementId) return;
        
        const layouts = TimeRecordingUtils.storage.load('layouts', {});
        layouts[elementId] = {
            ...layouts[elementId],
            ...layout,
            timestamp: Date.now()
        };
        TimeRecordingUtils.storage.save('layouts', layouts);
    },
    
    // Load saved layouts
    loadLayouts: function() {
        const layouts = TimeRecordingUtils.storage.load('layouts', {});
        
        Object.keys(layouts).forEach(elementId => {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const layout = layouts[elementId];
            if (layout.left) element.style.left = layout.left;
            if (layout.top) element.style.top = layout.top;
            if (layout.width) element.style.width = layout.width;
            if (layout.height) element.style.height = layout.height;
            
            // Remove centering transform if position is saved
            if (layout.left || layout.top) {
                element.style.transform = 'none';
                element.style.position = 'fixed';
            }
        });
    },
    
    // Reset all layouts
    resetLayouts: function() {
        TimeRecordingUtils.storage.remove('layouts');
        location.reload();
    }
};

// Initialize drag events when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    TimeRecordingDrag.initGlobalDragEvents();
});
// Time Recording Calendar - Edit Module (FIXED)
window.TimeRecordingEdit = {
    currentRecord: null,
    editDialog: null,
    
    // Show edit dialog for a time record
    showEditDialog: async function(dateKey, counter) {
        // Fetch the specific record using filter instead of GET_ENTITY
        const record = await this.fetchSingleRecord(dateKey, counter);
        if (!record) {
            alert('Failed to load time record');
            return;
        }
        
        this.currentRecord = record;
        this.createEditDialog(record);
    },
    
    // Fetch single time record - FIXED to use filter
    fetchSingleRecord: async function(dateKey, counter) {
        try {
            const pernr = TimeRecordingConfig.sap.userPernr;
            
            // Use filter to get the specific record instead of GET_ENTITY
            const requests = [
                `TimeRecordS4Set?sap-client=${TimeRecordingAPI.SAP_CLIENT}&$filter=Pernr%20eq%20'${pernr}'%20and%20Counter%20eq%20'${counter}'`
            ];
            
            const response = await TimeRecordingAPI.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results && response[0].d.results.length > 0) {
                return response[0].d.results[0]; // Return the first (and should be only) result
            }
            
            // Fallback: try to get from day's records if counter filter doesn't work
            const dayRecords = await TimeRecordingAPI.fetchTimeRecords(
                new Date(dateKey.substr(0,4) + '-' + dateKey.substr(4,2) + '-' + dateKey.substr(6,2))
            );
            
            // Find the record with matching counter
            const record = dayRecords.find(r => r.Counter === counter);
            return record || null;
            
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to fetch record:', error);
            return null;
        }
    },
    
    // Create edit dialog
    createEditDialog: function(record) {
        // Remove existing dialog if present
        if (this.editDialog) {
            this.editDialog.remove();
        }
        
        const dialog = document.createElement('div');
        dialog.id = 'trEditDialog';
        dialog.className = 'tr-draggable';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 10003;
            width: 900px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
        `;
        
        dialog.innerHTML = `
            <div class="tr-drag-handle" style="background: linear-gradient(135deg, #28a745, #20c997); padding: 15px; color: white; border-radius: 12px 12px 0 0; cursor: move; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">✏️ Edit Time Record - ${this.formatDate(record.RecordDate)}</h3>
                <button onclick="window.TimeRecordingEdit.closeDialog()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">✕</button>
            </div>
            
            <div style="flex: 1; overflow-y: auto; padding: 20px;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <!-- Basic Information -->
                    <div style="grid-column: 1 / -1;">
                        <h4 style="margin: 0 0 15px 0; color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 5px;">Basic Information</h4>
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">Duration (Hours)</label>
                        <input type="number" id="trEditDuration" value="${record.Duration}" step="0.5" min="0.5" max="24" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">Account Indicator</label>
                        <select id="trEditAccountInd" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                            <option value="10" ${record.AccountInd === '10' ? 'selected' : ''}>10 - Billable</option>
                            <option value="90" ${record.AccountInd === '90' ? 'selected' : ''}>90 - Non-Billable</option>
                        </select>
                    </div>
                    
                    <div style="grid-column: 1 / -1;">
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">Description</label>
                        <textarea id="trEditContent" style="width: 100%; min-height: 80px; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">${record.Content || ''}</textarea>
                    </div>
                    
                    <!-- Project Information -->
                    <div style="grid-column: 1 / -1; margin-top: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 5px;">
                            Project Information
                            <button onclick="window.TimeRecordingEdit.showPSPSearch()" style="float: right; padding: 4px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🔍 Search PSP</button>
                        </h4>
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">Project ID</label>
                        <input type="text" id="trEditProjectId" value="${record.AccProjId || ''}" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">Project Description</label>
                        <input type="text" id="trEditProjectDesc" value="${record.AccProjDesc || ''}" readonly style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">PSP ID</label>
                        <input type="text" id="trEditPSPId" value="${record.AccTaskPspId || ''}" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">PSP Description</label>
                        <input type="text" id="trEditPSPDesc" value="${record.AccTaskPspDesc || ''}" readonly style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">
                    </div>
                    
                    <!-- Additional Fields -->
                    <div style="grid-column: 1 / -1; margin-top: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 5px;">Additional Information</h4>
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">JIRA Ticket ID</label>
                        <input type="text" id="trEditJiraId" value="${record.JiraTicketId || ''}" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">Meeting ID</label>
                        <input type="text" id="trEditMeetingId" value="${record.MeetingId || ''}" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">Start Time</label>
                        <input type="time" id="trEditStartTime" value="${this.parseTime(record.StartTime)}" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; font-weight: bold;">End Time</label>
                        <input type="time" id="trEditEndTime" value="${this.parseTime(record.EndTime)}" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <!-- Read-only Information -->
                    <div style="grid-column: 1 / -1; margin-top: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 5px;">System Information</h4>
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #6c757d;">Counter</label>
                        <input type="text" value="${record.Counter}" readonly style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #6c757d;">Status</label>
                        <input type="text" value="${record.Status} - ${this.getStatusText(record.Status)}" readonly style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #6c757d;">Company</label>
                        <input type="text" value="${record.CompanyCode} - ${record.OrgName}" readonly style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px; color: #6c757d;">Time Category</label>
                        <input type="text" value="${record.TimeCategory || 'VALUEADD'}" readonly style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">
                    </div>
                </div>
            </div>
            
            <div style="padding: 20px; border-top: 1px solid #dee2e6; display: flex; gap: 10px; justify-content: space-between;">
                <button onclick="window.TimeRecordingEdit.deleteRecord()" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">🗑️ Delete</button>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.TimeRecordingEdit.saveChanges()" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer;">💾 Save Changes</button>
                    <button onclick="window.TimeRecordingEdit.closeDialog()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        this.editDialog = dialog;
        
        // Make dialog draggable if module exists
        if (window.TimeRecordingDrag) {
            TimeRecordingDrag.makeDraggable(dialog);
        }
    },
    
    // Show PSP search dialog
    showPSPSearch: function() {
        const searchDialog = document.createElement('div');
        searchDialog.id = 'trPSPSearchDialog';
        searchDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 10004;
            width: 700px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;
        
        searchDialog.innerHTML = `
            <div style="background: linear-gradient(135deg, #007bff, #0056b3); padding: 15px; color: white; border-radius: 12px 12px 0 0;">
                <h3 style="margin: 0;">🔍 Search PSP Elements</h3>
            </div>
            
            <div style="padding: 20px;">
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px;">Partner Number</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="trSearchPartner" placeholder="Partner Number" style="flex: 1; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                            <button style="padding: 8px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer;">🔍</button>
                        </div>
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px;">Project ID</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="trSearchProjectId" placeholder="Project ID" style="flex: 1; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                            <button style="padding: 8px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer;">🔍</button>
                        </div>
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px;">Project Description</label>
                        <input type="text" id="trSearchProjectDesc" placeholder="Project Description" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px;">PSP ID</label>
                        <input type="text" id="trSearchPSPId" placeholder="PSP ID" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div>
                        <label style="display: block; font-size: 12px; margin-bottom: 5px;">PSP Description</label>
                        <input type="text" id="trSearchPSPDesc" placeholder="PSP Description" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                    </div>
                    
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button onclick="window.TimeRecordingEdit.performPSPSearch()" style="flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer;">Go</button>
                        <button onclick="window.TimeRecordingEdit.clearPSPSearch()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Clear</button>
                    </div>
                </div>
            </div>
            
            <div id="trPSPSearchResults" style="flex: 1; overflow-y: auto; padding: 0 20px 20px; max-height: 300px;">
                <!-- Results will be displayed here -->
            </div>
            
            <div style="padding: 15px; border-top: 1px solid #dee2e6; text-align: right;">
                <button onclick="document.getElementById('trPSPSearchDialog').remove()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
        `;
        
        document.body.appendChild(searchDialog);
    },
    
    // Perform PSP search
    performPSPSearch: async function() {
        const partnerId = document.getElementById('trSearchPartner').value;
        const projectId = document.getElementById('trSearchProjectId').value;
        const projectDesc = document.getElementById('trSearchProjectDesc').value;
        const pspId = document.getElementById('trSearchPSPId').value;
        const pspDesc = document.getElementById('trSearchPSPDesc').value;
        
        // Build search filters
        let filters = [];
        if (partnerId) filters.push(`PartnerNo eq '${partnerId}'`);
        if (projectId) filters.push(`substringof('${projectId}', AccProjId)`);
        if (projectDesc) filters.push(`substringof('${projectDesc}', AccProjDesc)`);
        if (pspId) filters.push(`substringof('${pspId}', AccTaskPspId)`);
        if (pspDesc) filters.push(`substringof('${pspDesc}', AccTaskPspDesc)`);
        
        if (filters.length === 0) {
            alert('Please enter at least one search criteria');
            return;
        }
        
        const resultsDiv = document.getElementById('trPSPSearchResults');
        resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px;">Searching...</div>';
        
        try {
            // Search using favorites as a base (you can extend this with actual search API)
            const favorites = TimeRecordingAPI.getUserFavorites();
            let results = favorites;
            
            // Apply filters locally for now (replace with actual API search)
            if (projectId) {
                results = results.filter(f => f.AccProjId.includes(projectId));
            }
            if (pspId) {
                results = results.filter(f => f.AccTaskPspId.includes(pspId));
            }
            
            // Display results
            if (results.length === 0) {
                resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No results found</div>';
            } else {
                let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
                results.forEach(result => {
                    html += `
                        <li style="padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s;"
                            onclick="window.TimeRecordingEdit.selectPSP('${result.AccProjId}', '${result.AccProjDesc}', '${result.AccTaskPspId}', '${result.AccTaskPspDesc}')"
                            onmouseover="this.style.background='#f0f4ff'" 
                            onmouseout="this.style.background='white'">
                            <div style="font-weight: bold; margin-bottom: 5px;">${result.AccProjId} - ${result.AccTaskPspId}</div>
                            <div style="font-size: 12px; color: #666;">${result.AccProjDesc}</div>
                            <div style="font-size: 12px; color: #666;">${result.AccTaskPspDesc}</div>
                        </li>
                    `;
                });
                html += '</ul>';
                resultsDiv.innerHTML = html;
            }
            
        } catch (error) {
            resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Search failed: ' + error.message + '</div>';
        }
    },
    
    // Clear PSP search
    clearPSPSearch: function() {
        document.getElementById('trSearchPartner').value = '';
        document.getElementById('trSearchProjectId').value = '';
        document.getElementById('trSearchProjectDesc').value = '';
        document.getElementById('trSearchPSPId').value = '';
        document.getElementById('trSearchPSPDesc').value = '';
        document.getElementById('trPSPSearchResults').innerHTML = '';
    },
    
    // Select PSP from search results
    selectPSP: function(projectId, projectDesc, pspId, pspDesc) {
        document.getElementById('trEditProjectId').value = projectId;
        document.getElementById('trEditProjectDesc').value = projectDesc;
        document.getElementById('trEditPSPId').value = pspId;
        document.getElementById('trEditPSPDesc').value = pspDesc;
        
        // Close search dialog
        const searchDialog = document.getElementById('trPSPSearchDialog');
        if (searchDialog) searchDialog.remove();
    },
    
    // Save changes to time record
    saveChanges: async function() {
        if (!this.currentRecord) return;
        
        // Get updated values
        const updatedRecord = {
            ...this.currentRecord,
            Duration: document.getElementById('trEditDuration').value,
            AccountInd: document.getElementById('trEditAccountInd').value,
            Content: document.getElementById('trEditContent').value,
            AccProjId: document.getElementById('trEditProjectId').value,
            AccTaskPspId: document.getElementById('trEditPSPId').value,
            JiraTicketId: document.getElementById('trEditJiraId').value,
            MeetingId: document.getElementById('trEditMeetingId').value,
            StartTime: this.formatTime(document.getElementById('trEditStartTime').value),
            EndTime: this.formatTime(document.getElementById('trEditEndTime').value)
        };
        
        // Update mode for editing
        updatedRecord.Mode = 'U';
        
        try {
            // Show loading
            const saveButton = event.target;
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
            
            // Send update request
            const result = await this.updateTimeRecord(updatedRecord);
            
            if (result) {
                TimeRecordingUtils.log('success', 'Time record updated successfully');
                this.closeDialog();
                
                // Refresh calendar
                TimeRecordingCalendar.refresh();
            } else {
                throw new Error('Update failed');
            }
            
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to save changes:', error);
            alert('Failed to save changes: ' + error.message);
            
            // Reset button
            const saveButton = event.target;
            saveButton.disabled = false;
            saveButton.textContent = '💾 Save Changes';
        }
    },
    
    // Update time record via API
    updateTimeRecord: async function(record) {
        const config = TimeRecordingConfig.sap;
        
        // Build update payload with all required fields
        const updatePayload = {
            "Pernr": config.userPernr,
            "NavToTimeRecordS4": [{
                "Pernr": config.userPernr,
                "Counter": record.Counter,
                "Mode": record.Mode, // U for update, D for delete
                "RecordDate": record.RecordDate,
                "Duration": record.Duration.toString(),
                "CompanyCode": record.CompanyCode || "",
                "PartnerNo": record.PartnerNo || "",
                "OrgName": record.OrgName || "",
                "Content": record.Content || "",
                "AccProjId": record.AccProjId || "",
                "AccProjDesc": record.AccProjDesc || "",
                "AccTaskPspId": record.AccTaskPspId || "",
                "AccTaskPspDesc": record.AccTaskPspDesc || "",
                "AccountInd": record.AccountInd || "10",
                "AccountIndDesc": record.AccountIndDesc || "",
                "AccProjGuid": record.AccProjGuid || "",
                "AccTaskGuid": record.AccTaskGuid || "",
                "AccTaskId": record.AccTaskId || "",
                "AccTaskDesc": record.AccTaskDesc || "",
                "AccTaskObjType": record.AccTaskObjType || "",
                "AbbrvCompName": record.AbbrvCompName || "",
                "StandBy": record.StandBy || "0.00",
                "StandByTypeDescription": record.StandByTypeDescription || "",
                "StandByComp": record.StandByComp || "0.00",
                "StandByCompDescription": record.StandByCompDescription || "",
                "Status": record.Status || "",
                "Reason": record.Reason || "",
                "ReasonText": record.ReasonText || "",
                "TicketGuid": record.TicketGuid || "",
                "ObjectId": record.ObjectId || "",
                "TicketDescription": record.TicketDescription || "",
                "StartTime": record.StartTime || "PT00H00M00S",
                "EndTime": record.EndTime || "PT00H00M00S",
                "StandByTypeValue": record.StandByTypeValue || "",
                "StandByCompValue": record.StandByCompValue || "",
                "TimeCategory": record.TimeCategory || "",
                "SuperiorGuid": record.SuperiorGuid || "",
                "SuperiorDescription": record.SuperiorDescription || "",
                "RemainingWork": record.RemainingWork || "0.00",
                "UserId": record.UserId || "",
                "JiraTicketId": record.JiraTicketId || "",
                "MeetingId": record.MeetingId || ""
            }]
        };
        
        const postRequest = {
            resource: 'TimeRecordHdrSet',
            payload: updatePayload
        };
        
        const response = await TimeRecordingAPI.executeBatchRequest([], postRequest);
        
        if (response && response[0]) {
            return response[0];
        }
        
        return null;
    },
    
    // Delete time record
    deleteRecord: async function() {
        if (!this.currentRecord) return;
        
        if (!confirm('Are you sure you want to delete this time record? This action cannot be undone.')) {
            return;
        }
        
        try {
            // Create delete record with all existing data and Mode = 'D'
            const deleteRecord = {
                ...this.currentRecord,
                Mode: 'D' // Delete mode
            };
            
            const result = await this.updateTimeRecord(deleteRecord);
            
            if (result) {
                TimeRecordingUtils.log('success', 'Time record deleted successfully');
                this.closeDialog();
                TimeRecordingCalendar.refresh();
            }
            
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to delete record:', error);
            alert('Failed to delete record: ' + error.message);
        }
    },
    
    // Close edit dialog
    closeDialog: function() {
        if (this.editDialog) {
            this.editDialog.remove();
            this.editDialog = null;
            this.currentRecord = null;
        }
    },
    
    // Helper functions
    formatDate: function(dateStr) {
        if (!dateStr) return '';
        const year = dateStr.substr(0, 4);
        const month = dateStr.substr(4, 2);
        const day = dateStr.substr(6, 2);
        return `${day}.${month}.${year}`;
    },
    
    parseTime: function(timeStr) {
        if (!timeStr || timeStr === 'PT00H00M00S') return '';
        const match = timeStr.match(/PT(\d+)H(\d+)M/);
        if (match) {
            const hours = match[1].padStart(2, '0');
            const minutes = match[2].padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return '';
    },
    
    formatTime: function(timeStr) {
        if (!timeStr) return 'PT00H00M00S';
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            return `PT${parts[0]}H${parts[1]}M00S`;
        }
        return 'PT00H00M00S';
    },
    
    getStatusText: function(status) {
        const statusMap = {
            '10': 'Draft',
            '20': 'Released',
            '30': 'Approved',
            '40': 'Rejected'
        };
        return statusMap[status] || 'Unknown';
    }
};
// Time Recording Calendar - ICS Import Module
window.TimeRecordingICS = {
    meetings: [],
    selectedMeetings: new Set(),
    importStartDate: null,
    importEndDate: null,
    
    // Parse ICS file content
    parseICS: function(icsContent) {
        const events = [];
        const lines = icsContent.split(/\r?\n/);
        let currentEvent = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Handle multi-line values (lines that start with space)
            if (line.startsWith(' ') && currentEvent && currentEvent.lastProperty) {
                currentEvent[currentEvent.lastProperty] += line.substr(1);
                continue;
            }
            
            if (line === 'BEGIN:VEVENT') {
                currentEvent = {};
            } else if (line === 'END:VEVENT' && currentEvent) {
                // Process the event
                const event = this.processEvent(currentEvent);
                if (event) events.push(event);
                currentEvent = null;
            } else if (currentEvent) {
                const colonIndex = line.indexOf(':');
                if (colonIndex > -1) {
                    const property = line.substring(0, colonIndex);
                    const value = line.substring(colonIndex + 1);
                    
                    // Handle properties with parameters (e.g., DTSTART;TZID=Europe/Berlin:20250120T090000)
                    const propParts = property.split(';');
                    const propName = propParts[0];
                    
                    currentEvent[propName] = value;
                    currentEvent.lastProperty = propName;
                }
            }
        }
        
        return events;
    },
    
    // Process a single event from ICS
    processEvent: function(rawEvent) {
        if (!rawEvent.SUMMARY || !rawEvent.DTSTART) return null;
        
        // Parse dates
        const startDate = this.parseICSDate(rawEvent.DTSTART);
        const endDate = rawEvent.DTEND ? this.parseICSDate(rawEvent.DTEND) : startDate;
        
        // Calculate duration in hours
        const duration = (endDate - startDate) / (1000 * 60 * 60);
        
        // Extract PSP element if present in the title
        const pspMatch = rawEvent.SUMMARY.match(/\b(\d{4}\.[A-Z]{2}\.\d{4}(?:-\d{2}){0,3})\b/);
        
        return {
            id: rawEvent.UID || Math.random().toString(36).substr(2, 9),
            title: rawEvent.SUMMARY,
            description: rawEvent.DESCRIPTION || '',
            location: rawEvent.LOCATION || '',
            startDate: startDate,
            endDate: endDate,
            duration: Math.round(duration * 10) / 10, // Round to 1 decimal
            dateKey: TimeRecordingUtils.formatDate(startDate),
            displayDate: TimeRecordingUtils.formatDisplayDate(startDate),
            startTime: startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            endTime: endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
            pspElement: pspMatch ? pspMatch[1] : null,
            organizer: rawEvent.ORGANIZER ? rawEvent.ORGANIZER.replace('mailto:', '') : '',
            attendees: this.parseAttendees(rawEvent),
            isRecurring: !!rawEvent.RRULE,
            selected: true // Default to selected
        };
    },
    
    // Parse ICS date format
    parseICSDate: function(dateStr) {
        // Handle different date formats
        // Format 1: YYYYMMDD
        // Format 2: YYYYMMDDTHHMMSS
        // Format 3: YYYYMMDDTHHMMSSZ (UTC)
        
        if (!dateStr) return null;
        
        // Remove any timezone suffix
        dateStr = dateStr.replace(/Z$/, '');
        
        if (dateStr.length === 8) {
            // All-day event
            const year = dateStr.substr(0, 4);
            const month = dateStr.substr(4, 2);
            const day = dateStr.substr(6, 2);
            return new Date(year, month - 1, day);
        } else if (dateStr.includes('T')) {
            // Date with time
            const parts = dateStr.split('T');
            const datePart = parts[0];
            const timePart = parts[1] || '000000';
            
            const year = datePart.substr(0, 4);
            const month = datePart.substr(4, 2);
            const day = datePart.substr(6, 2);
            const hour = timePart.substr(0, 2);
            const minute = timePart.substr(2, 2);
            const second = timePart.substr(4, 2) || '00';
            
            return new Date(year, month - 1, day, hour, minute, second);
        }
        
        return null;
    },
    
    // Parse attendees from ICS
    parseAttendees: function(rawEvent) {
        const attendees = [];
        for (const key in rawEvent) {
            if (key.startsWith('ATTENDEE')) {
                const email = rawEvent[key].replace('mailto:', '');
                attendees.push(email);
            }
        }
        return attendees;
    },
    
    // Show import dialog
    showImportDialog: function() {
        const dialog = document.createElement('div');
        dialog.id = 'trICSImportDialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 10002;
            width: 900px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
        `;
        
        dialog.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; color: white; border-radius: 12px 12px 0 0;">
                <h3 style="margin: 0;">📅 Import Calendar Meetings (ICS)</h3>
                <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Upload an ICS file to import your meetings</p>
            </div>
            
            <div style="padding: 20px;">
                <div style="border: 2px dashed #667eea; border-radius: 8px; padding: 30px; text-align: center; background: #f8f9fa;">
                    <input type="file" id="trICSFileInput" accept=".ics,.ical,.ifb,.icalendar" style="display: none;">
                    <label for="trICSFileInput" style="cursor: pointer;">
                        <div style="font-size: 48px; margin-bottom: 10px;">📤</div>
                        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">Click to upload ICS file</div>
                        <div style="font-size: 14px; color: #666;">or drag and drop here</div>
                    </label>
                </div>
                
                <div style="margin-top: 20px; display: none;" id="trDateRangeSelector">
                    <h4>Select Import Date Range:</h4>
                    <div style="display: flex; gap: 20px; align-items: center;">
                        <div>
                            <label style="display: block; font-size: 12px; margin-bottom: 5px;">From:</label>
                            <input type="date" id="trICSStartDate" style="padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; margin-bottom: 5px;">To:</label>
                            <input type="date" id="trICSEndDate" style="padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                        </div>
                        <button id="trICSFilterDates" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer;">Filter Meetings</button>
                    </div>
                </div>
            </div>
            
            <div id="trMeetingsList" style="flex: 1; overflow-y: auto; padding: 0 20px; max-height: 400px; display: none;">
                <!-- Meetings will be listed here -->
            </div>
            
            <div style="padding: 20px; border-top: 1px solid #dee2e6; display: flex; gap: 10px; justify-content: space-between;">
                <div style="font-size: 14px; color: #666;">
                    <span id="trMeetingCount">0</span> meetings selected
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="trSelectAllMeetings" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Select All</button>
                    <button id="trDeselectAllMeetings" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Deselect All</button>
                    <button id="trImportMeetings" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer;" disabled>Send to AI</button>
                    <button id="trCancelICSImport" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Set default date range to current month
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        document.getElementById('trICSStartDate').value = firstDay.toISOString().split('T')[0];
        document.getElementById('trICSEndDate').value = lastDay.toISOString().split('T')[0];
        
        this.attachImportHandlers();
    },
    
    // Attach event handlers for import dialog
    attachImportHandlers: function() {
        const fileInput = document.getElementById('trICSFileInput');
        const dialog = document.getElementById('trICSImportDialog');
        
        // File input handler
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const content = await this.readFile(file);
            const events = this.parseICS(content);
            
            if (events.length === 0) {
                alert('No events found in the ICS file');
                return;
            }
            
            this.meetings = events;
            document.getElementById('trDateRangeSelector').style.display = 'block';
            this.filterAndDisplayMeetings();
        };
        
        // Drag and drop
        const dropZone = dialog.querySelector('[for="trICSFileInput"]').parentElement;
        
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.style.background = '#e9ecef';
        };
        
        dropZone.ondragleave = (e) => {
            e.preventDefault();
            dropZone.style.background = '#f8f9fa';
        };
        
        dropZone.ondrop = async (e) => {
            e.preventDefault();
            dropZone.style.background = '#f8f9fa';
            
            const file = e.dataTransfer.files[0];
            if (file && file.name.match(/\.(ics|ical|ifb|icalendar)$/i)) {
                const content = await this.readFile(file);
                const events = this.parseICS(content);
                
                if (events.length === 0) {
                    alert('No events found in the ICS file');
                    return;
                }
                
                this.meetings = events;
                document.getElementById('trDateRangeSelector').style.display = 'block';
                this.filterAndDisplayMeetings();
            }
        };
        
        // Date filter
        document.getElementById('trICSFilterDates').onclick = () => {
            this.filterAndDisplayMeetings();
        };
        
        // Select/Deselect all
        document.getElementById('trSelectAllMeetings').onclick = () => {
            document.querySelectorAll('.tr-meeting-checkbox').forEach(cb => {
                cb.checked = true;
                this.selectedMeetings.add(cb.dataset.id);
            });
            this.updateMeetingCount();
        };
        
        document.getElementById('trDeselectAllMeetings').onclick = () => {
            document.querySelectorAll('.tr-meeting-checkbox').forEach(cb => {
                cb.checked = false;
            });
            this.selectedMeetings.clear();
            this.updateMeetingCount();
        };
        
        // Import button
        document.getElementById('trImportMeetings').onclick = () => {
            this.sendMeetingsToAI();
            dialog.remove();
        };
        
        // Cancel button
        document.getElementById('trCancelICSImport').onclick = () => {
            dialog.remove();
        };
    },
    
    // Filter and display meetings
    filterAndDisplayMeetings: function() {
        const startDate = new Date(document.getElementById('trICSStartDate').value);
        const endDate = new Date(document.getElementById('trICSEndDate').value);
        endDate.setHours(23, 59, 59); // Include entire end day
        
        this.importStartDate = startDate;
        this.importEndDate = endDate;
        
        // Filter meetings by date range
        const filteredMeetings = this.meetings.filter(meeting => {
            return meeting.startDate >= startDate && meeting.startDate <= endDate;
        });
        
        // Sort by date
        filteredMeetings.sort((a, b) => a.startDate - b.startDate);
        
        // Display meetings
        const listContainer = document.getElementById('trMeetingsList');
        listContainer.innerHTML = '';
        listContainer.style.display = 'block';
        
        if (filteredMeetings.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No meetings found in the selected date range</p>';
            document.getElementById('trImportMeetings').disabled = true;
            return;
        }
        
        // Group meetings by date
        const meetingsByDate = {};
        filteredMeetings.forEach(meeting => {
            if (!meetingsByDate[meeting.dateKey]) {
                meetingsByDate[meeting.dateKey] = [];
            }
            meetingsByDate[meeting.dateKey].push(meeting);
        });
        
        // Display grouped meetings
        Object.keys(meetingsByDate).sort().forEach(dateKey => {
            const dateHeader = document.createElement('div');
            dateHeader.style.cssText = 'font-weight: bold; margin: 15px 0 10px; padding: 5px; background: #f8f9fa; border-radius: 4px;';
            dateHeader.textContent = TimeRecordingUtils.formatDisplayDate(new Date(dateKey.substr(0,4) + '-' + dateKey.substr(4,2) + '-' + dateKey.substr(6,2)));
            listContainer.appendChild(dateHeader);
            
            meetingsByDate[dateKey].forEach(meeting => {
                const meetingDiv = document.createElement('div');
                meetingDiv.style.cssText = `
                    padding: 12px;
                    margin-bottom: 8px;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    background: white;
                    transition: all 0.2s;
                `;
                
                meetingDiv.innerHTML = `
                    <div style="display: flex; align-items: start; gap: 12px;">
                        <input type="checkbox" class="tr-meeting-checkbox" data-id="${meeting.id}" checked style="margin-top: 3px;">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; margin-bottom: 4px;">
                                ${meeting.title}
                                ${meeting.pspElement ? `<span style="color: #28a745; font-size: 12px; margin-left: 8px;">📎 PSP: ${meeting.pspElement}</span>` : ''}
                            </div>
                            <div style="font-size: 13px; color: #666;">
                                🕐 ${meeting.startTime} - ${meeting.endTime} (${meeting.duration}h)
                                ${meeting.location ? `📍 ${meeting.location}` : ''}
                            </div>
                            ${meeting.description ? `<div style="font-size: 12px; color: #999; margin-top: 4px;">📝 ${meeting.description.substring(0, 100)}${meeting.description.length > 100 ? '...' : ''}</div>` : ''}
                        </div>
                    </div>
                `;
                
                listContainer.appendChild(meetingDiv);
                
                // Add to selected meetings
                this.selectedMeetings.add(meeting.id);
                
                // Checkbox handler
                const checkbox = meetingDiv.querySelector('.tr-meeting-checkbox');
                checkbox.onchange = () => {
                    if (checkbox.checked) {
                        this.selectedMeetings.add(meeting.id);
                    } else {
                        this.selectedMeetings.delete(meeting.id);
                    }
                    this.updateMeetingCount();
                };
            });
        });
        
        document.getElementById('trImportMeetings').disabled = false;
        this.updateMeetingCount();
    },
    
    // Update meeting count
    updateMeetingCount: function() {
        document.getElementById('trMeetingCount').textContent = this.selectedMeetings.size;
        document.getElementById('trImportMeetings').disabled = this.selectedMeetings.size === 0;
    },
    
    // Read file content
    readFile: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    // Send meetings to AI
    
sendMeetingsToAI: function() {
    const selectedMeetingData = this.meetings.filter(m => this.selectedMeetings.has(m.id));
    
    if (selectedMeetingData.length === 0) return;
    
    // Format meetings for AI
    const meetingInfo = selectedMeetingData.map(meeting => {
        return `Date: ${meeting.displayDate}
Meeting: "${meeting.title}"
Time: ${meeting.startTime} - ${meeting.endTime} (${meeting.duration} hours)
${meeting.pspElement ? `PSP Element: ${meeting.pspElement}` : ''}
${meeting.location ? `Location: ${meeting.location}` : ''}
${meeting.description ? `Description: ${meeting.description.substring(0, 200)}` : ''}`;
    }).join('\n\n');
    
    // Build AI prompt - FIX: Remove the template literal bug
    const aiPrompt = `I attended the following meetings. Please create time entries for them:

${meetingInfo}

IMPORTANT RULES:
1. Use the EXACT meeting name in the time entry description
2. Record the EXACT duration from each meeting
3. If the meeting title contains a PSP element ID (format: XXXX.XX.XXXX), use that as the accounting object
4. Each meeting should be a separate time entry on its specific date
5. Keep the original meeting name in the description for reference

Please generate time entries for all these meetings.`;
    
    // Send to AI
    if (window.TimeRecordingAI) {
        // Show AI panel if hidden
        const aiPanel = document.getElementById('trAIPanel');
        if (aiPanel && aiPanel.style.display === 'none') {
            document.getElementById('trToggleAI').click();
        }
        
        // Send message
        TimeRecordingAI.sendMessage(aiPrompt);
    }
},
    
    // Mark calendar dates that have meetings
    markCalendarDates: function() {
        if (!this.importStartDate || !this.importEndDate) return;
        
        // Highlight the import range on the calendar
        const allDays = document.querySelectorAll('.tr-calendar-day');
        
        allDays.forEach(dayElement => {
            const dateKey = dayElement.dataset.date;
            if (!dateKey) return;
            
            const year = dateKey.substr(0, 4);
            const month = dateKey.substr(4, 2);
            const day = dateKey.substr(6, 2);
            const date = new Date(year, month - 1, day);
            
            if (date >= this.importStartDate && date <= this.importEndDate) {
                // Add visual indicator for import range
                if (!dayElement.querySelector('.tr-import-marker')) {
                    const marker = document.createElement('div');
                    marker.className = 'tr-import-marker';
                    marker.style.cssText = `
                        position: absolute;
                        top: 2px;
                        right: 2px;
                        width: 8px;
                        height: 8px;
                        background: #667eea;
                        border-radius: 50%;
                        animation: pulse 2s infinite;
                    `;
                    marker.title = 'Import date range';
                    dayElement.style.position = 'relative';
                    dayElement.appendChild(marker);
                }
            }
        });
    }
};

// Add ICS import button to the UI
// Add this to the header buttons in getHTML():
`<button id="trImportICS" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;" title="Import ICS Calendar">📥</button>`

// Add event handler in attachEventHandlers():
document.getElementById('trImportICS').onclick = () => {
    TimeRecordingICS.showImportDialog();
};

// Add pulse animation to styles
const style = document.createElement('style');
style.textContent += `
    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(102, 126, 234, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(102, 126, 234, 0);
        }
    }
`;
document.head.appendChild(style);
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// Time Recording Calendar - UI Module (ENHANCED with Excel-like selection)
window.TimeRecordingUI = {
    container: null,
    minimized: false,
    selectedDays: new Set(),
    aiChatOpen: false,
    selectionStart: null,
    isSelecting: false,
    dayDetailsPanel: null,

    // Create the main UI
    create: function () { // Remove existing UI if present
        if (document.getElementById('timeRecordingContainer')) {
            document.getElementById('timeRecordingContainer').remove();
        }

        this.container = document.createElement('div');
        this.container.id = 'timeRecordingContainer';
        this.container.innerHTML = this.getHTML();
        document.body.appendChild(this.container);

        this.attachEventHandlers();
        this.addStyles();

        TimeRecordingUtils.log('info', 'UI created successfully');
    },

    // Get HTML structure (ENHANCED)
    getHTML: function () {
        return `
            <div id="timeRecordingApp" style="position: fixed; top: 20px; right: 20px; z-index: 10000; transition: all 0.3s ease;">
                <!-- Minimized View -->
                <div id="trMinimized" style="display: none; background: linear-gradient(135deg, #667eea, #764ba2); padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); cursor: pointer; color: white; font-weight: bold;">
                    📅 Time Recording
                </div>
                
                <!-- Main Container with AI Chat -->
                <div id="trMainContainer" style="display: flex; gap: 10px;">
                    <!-- AI Chat Panel -->
                    <div id="trAIPanel" style="background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); width: 400px; max-height: 90vh; display: none; flex-direction: column;">
                        <div style="background: linear-gradient(135deg, #764ba2, #667eea); padding: 15px; color: white; border-radius: 12px 12px 0 0;">
                            <h3 style="margin: 0; font-size: 16px;">🤖 AI Assistant</h3>
                        </div>
                        <div id="trAIChatContainer" style="flex: 1; overflow-y: auto; padding: 15px; max-height: 500px;">
                            <div id="trAIChatMessages" style="display: flex; flex-direction: column; gap: 10px;">
                                <!-- Chat messages will appear here -->
                            </div>
                        </div>
                        <div style="padding: 15px; border-top: 1px solid #dee2e6;">
                            <textarea id="trAIInput" placeholder="Describe what you worked on..." style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; resize: vertical;"></textarea>
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                                <button id="trAISend" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">Send</button>
                                <button id="trAIClear" style="padding: 10px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">Clear</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Day Details Panel -->
                    <div id="trDayDetailsPanel" style="background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); width: 350px; max-height: 90vh; display: none; flex-direction: column;">
                        <div style="background: linear-gradient(135deg, #28a745, #20c997); padding: 15px; color: white; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; font-size: 16px;">📝 Day Details</h3>
                            <button id="trCloseDayDetails" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">✕</button>
                        </div>
                        <div id="trDayDetailsContent" style="flex: 1; overflow-y: auto; padding: 15px;">
                            <!-- Day details will appear here -->
                        </div>
                        <div id="trDayDetailsActions" style="padding: 15px; border-top: 1px solid #dee2e6; display: none;">
                            <button id="trEditDay" style="width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 10px;">Edit Records</button>
                            <button id="trAddToSelection" style="width: 100%; padding: 10px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">Add to Selection</button>
                        </div>
                    </div>
                    
                    <!-- Main View -->
                    <div id="trMainView" style="background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); width: 1100px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 20px; color: white; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h2 style="margin: 0; font-size: 20px;">📅 Time Recording Calendar</h2>
                                <p style="margin: 5px 0 0; opacity: 0.9; font-size: 12px;">Click and drag to select multiple days • Click entries to view details</p>
                            </div>
                            <div style="display: flex; gap: 10px;">
    <button id="trImportICS" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;" title="Import Calendar (ICS)">📥</button>
    <button id="trToggleAI" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;" title="Toggle AI Assistant">🤖</button>
    <button id="trToggleDetails" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;" title="Toggle Day Details">📝</button>
    <button id="trRefreshBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;">🔄</button>
    <button id="trMinimizeBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;">_</button>
    <button id="trCloseBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;">✕</button>
</div>
                        </div>
                        
                        <!-- Quick Entry Panel -->
                        <div id="trQuickEntry" style="padding: 15px; background: #f0f4ff; border-bottom: 2px solid #667eea;">
                        <div style="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 10px;">
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 12px; margin-bottom: 5px;">Project/Task</label>
                                <select id="trQuickProject" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                                    <option value="">Select from favorites...</option>
                                </select>
                            </div>
                            <div style="width: 100px;">
                                <label style="display: block; font-size: 12px; margin-bottom: 5px;">Hours</label>
                                <input id="trQuickHours" type="number" step="0.5" min="0.5" max="24" value="8" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 12px; margin-bottom: 5px;">Description</label>
                                <input id="trQuickDescription" type="text" placeholder="What did you work on?" style="width: 100%; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px;">
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button id="trApplySelected" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Apply to selected days">Apply to Selected</button>
                                <button id="trClearSelection" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Clear</button>
                            </div>
                        </div>

                        <!-- JSON Import Section -->
                        <div style="border-top: 1px solid #dee2e6; padding-top: 10px; margin-top: 10px;">
                            <div style="display: flex; gap: 10px; align-items: flex-end;">
                                <div style="flex: 1;">
                                    <label style="display: block; font-size: 12px; margin-bottom: 5px;">📋 Import JSON Data</label>
                                    <textarea id="trJSONImport" placeholder='Paste JSON data here, e.g., {"entries": [{"date": "20250919", "projectId": "...", "taskId": "...", "hours": 8, "description": "..."}]}' style="width: 100%; height: 60px; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; font-family: monospace; font-size: 11px;"></textarea>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button id="trImportJSON" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Import JSON</button>
                                    <button id="trValidateJSON" style="padding: 8px 16px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">Validate</button>
                                </div>
                            </div>
                        </div>

                        <div id="trSelectedDaysInfo" style="margin-top: 10px; font-size: 12px; color: #666;">
                            <span id="trSelectedCount">0</span> days selected | 
                            <span style="color: #007bff; cursor: pointer;" onclick="TimeRecordingUI.selectMissingDays()">Select all missing days</span> | 
                            <span style="color: #dc3545; cursor: pointer;" onclick="TimeRecordingUI.selectWeekdays()">Select weekdays</span>
                        </div>
                    </div>
                        
                        <!-- Navigation -->
                        <div style="padding: 15px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button id="trPrevMonth" style="padding: 6px 12px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer;">◀</button>
                                <h3 id="trCurrentMonth" style="margin: 0; font-size: 18px; min-width: 150px; text-align: center;">Loading...</h3>
                                <button id="trNextMonth" style="padding: 6px 12px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer;">▶</button>
                                <button id="trToday" style="padding: 6px 12px; border: 1px solid #007bff; background: #007bff; color: white; border-radius: 4px; cursor: pointer; margin-left: 10px;">Today</button>
                            </div>
                            <div id="trStats" style="display: flex; gap: 20px; font-size: 13px;">
                                <div>Required: <strong id="trRequiredHours">0</strong>h</div>
                                <div>Recorded: <strong id="trRecordedHours">0</strong>h</div>
                                <div>Completion: <strong id="trCompletionRate">0</strong>%</div>
                            </div>
                        </div>
                        
                        <!-- Legend -->
                        <div style="padding: 10px 15px; background: white; border-bottom: 1px solid #dee2e6; display: flex; gap: 20px; font-size: 12px;">
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <div style="width: 16px; height: 16px; background: ${
            TimeRecordingConfig.ui.colors.complete
        }; border-radius: 3px;"></div>
                                <span>Complete (8h+)</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <div style="width: 16px; height: 16px; background: ${
            TimeRecordingConfig.ui.colors.partial
        }; border-radius: 3px;"></div>
                                <span>Partial</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <div style="width: 16px; height: 16px; background: ${
            TimeRecordingConfig.ui.colors.missing
        }; border-radius: 3px;"></div>
                                <span>Missing</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <div style="width: 16px; height: 16px; background: ${
            TimeRecordingConfig.ui.colors.holiday
        }; border-radius: 3px;"></div>
                                <span>Holiday</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <div style="width: 16px; height: 16px; border: 2px solid #667eea; border-radius: 3px;"></div>
                                <span>Selected</span>
                            </div>
                        </div>
                        
                        <!-- Calendar Grid -->
                        <div id="trCalendarContainer" style="flex: 1; overflow-y: auto; padding: 15px; user-select: none;">
                            <div id="trCalendarGrid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">
                                <!-- Calendar will be rendered here with weekends -->
                            </div>
                        </div>
                        
                        <!-- Footer -->
                        <div id="trFooter" style="padding: 10px 15px; background: #f8f9fa; border-top: 1px solid #dee2e6; font-size: 11px; color: #6c757d;">
                            <div id="trStatusMessage">Ready</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Add styles (ENHANCED)
    addStyles: function () {
        const style = document.createElement('style');
        style.textContent = `
            .tr-calendar-day {
                min-height: 90px;
                border: 2px solid #dee2e6;
                border-radius: 6px;
                padding: 8px;
                background: white;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                overflow: visible;
                user-select: none;
            }
            
            .tr-calendar-day:hover:not(.tr-day-weekend) {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 10;
            }
            
            .tr-calendar-day-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
                font-size: 12px;
            }
            
            .tr-calendar-day-number {
                font-weight: bold;
                font-size: 14px;
            }
            
            .tr-calendar-day-hours {
                font-size: 16px;
                font-weight: bold;
                text-align: center;
                margin: 8px 0 4px 0;
            }
            
            .tr-calendar-day-entries {
                display: flex;
                flex-wrap: wrap;
                gap: 3px;
                margin-top: 4px;
                min-height: 20px;
            }
            
            .tr-entry-blob {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #667eea;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            }
            
            .tr-entry-blob:hover {
                transform: scale(1.5);
                z-index: 100;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }
            
            .tr-entry-blob[data-hours="8"] {
                background: #28a745;
            }
            
            .tr-entry-blob[data-hours="4"] {
                background: #ffc107;
            }
            
            .tr-entry-blob[data-hours="2"], .tr-entry-blob[data-hours="1"] {
                background: #dc3545;
            }
            
            .tr-calendar-weekday-header {
                text-align: center;
                font-weight: bold;
                font-size: 12px;
                padding: 10px;
                color: #495057;
                border-bottom: 2px solid #dee2e6;
                background: #f8f9fa;
            }
            
            .tr-day-today {
                border: 2px solid ${
            TimeRecordingConfig.ui.colors.today
        } !important;
                box-shadow: 0 0 0 1px ${
            TimeRecordingConfig.ui.colors.today
        };
            }
            
            .tr-day-other-month {
                opacity: 0.3;
            }
            
            .tr-day-weekend {
                background: ${
            TimeRecordingConfig.ui.colors.weekend
        } !important;
                opacity: 0.5;
                cursor: default !important;
            }
            
            .tr-day-selected {
                border: 2px solid #667eea !important;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)) !important;
                box-shadow: 0 0 0 1px #667eea;
            }
            
            .tr-day-selecting {
                border: 2px dashed #667eea !important;
                background: rgba(102, 126, 234, 0.05) !important;
            }
            
            .tr-tooltip {
                position: absolute;
                background: #333;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                z-index: 10000;
                pointer-events: none;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            
            .tr-day-detail-entry {
                padding: 10px;
                background: #f8f9fa;
                border-radius: 6px;
                margin-bottom: 10px;
                cursor: pointer;
                transition: all 0.2s;
                border: 2px solid transparent;
            }
            
            .tr-day-detail-entry:hover {
                background: #e9ecef;
                border-color: #667eea;
            }
            
            .tr-day-detail-entry-selected {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
                border-color: #667eea;
            }
            
            .tr-ai-message {
                padding: 10px;
                border-radius: 8px;
                margin-bottom: 10px;
                max-width: 90%;
            }
            
            .tr-ai-message-user {
                background: #f0f4ff;
                align-self: flex-end;
                margin-left: auto;
            }
            
            .tr-ai-message-assistant {
                background: #f8f9fa;
                align-self: flex-start;
            }
            
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            #trMainView {
                animation: slideIn 0.3s ease;
            }
            
            .tr-selection-box {
                position: fixed;
                border: 2px dashed #667eea;
                background: rgba(102, 126, 234, 0.1);
                pointer-events: none;
                z-index: 9999;
            }
        `;
        document.head.appendChild(style);
    },

    // Create day element (ENHANCED with entry blobs)
    createDayElement: function (dayData) {
        const div = document.createElement('div');
        div.className = 'tr-calendar-day';
        div.dataset.date = dayData.dateKey;

        // Add special classes
        if (dayData.isToday) 
            div.classList.add('tr-day-today');
        


        if (! dayData.isCurrentMonth) 
            div.classList.add('tr-day-other-month');
        


        if (dayData.isWeekend) 
            div.classList.add('tr-day-weekend');
        


        // Make selectable
        const isSelectable = ! dayData.isWeekend && ! dayData.isHoliday && ! dayData.isFuture && dayData.isCurrentMonth;
        if (isSelectable) {
            div.classList.add('tr-day-selectable');
        }

        // Set background color based on status
        if (! dayData.isWeekend) {
            div.style.background = dayData.color;
        }

        // Build content
        let content = `
            <div class="tr-calendar-day-header">
                <span class="tr-calendar-day-number">${
            dayData.displayDate
        }</span>
                <span>${
            dayData.dayName
        }</span>
            </div>
        `;

        if (dayData.isHoliday) {
            content += `<div style="font-size: 11px; color: #6c757d; text-align: center; margin: 5px 0;">🎉 ${
                dayData.holidayInfo.name
            }</div>`;
        } else if (dayData.isWorkDay && ! dayData.isFuture && ! dayData.isWeekend) {
            content += `<div class="tr-calendar-day-hours">${
                dayData.totalHours
            }h</div>`;

            // Add entry blobs
            content += `<div class="tr-calendar-day-entries" id="entries-${
                dayData.dateKey
            }">`;
            if (dayData.records && dayData.records.length > 0) {
                dayData.records.forEach((record, index) => {
                    const hours = parseFloat(record.Duration);
                    const title = `${
                        record.Duration
                    }h: ${
                        record.Content || 'No description'
                    }`;
                    content += `<div class="tr-entry-blob" 
                                     data-index="${index}" 
                                     data-date="${
                        dayData.dateKey
                    }"
                                     data-hours="${
                        Math.round(hours)
                    }"
                                     title="${
                        title.replace(/"/g, '&quot;')
                    }"></div>`;
                });
            }
            content += `</div>`;
        }

        div.innerHTML = content;

        // Add mouse events for Excel-like selection
        if (isSelectable) {
            div.addEventListener('mousedown', (e) => this.startSelection(e, dayData));
            div.addEventListener('mouseenter', (e) => this.continueSelection(e, dayData));
            div.addEventListener('mouseup', (e) => this.endSelection(e, dayData));
        }

        // Add click handler for entry blobs
        const entryBlobs = div.querySelectorAll('.tr-entry-blob');
        entryBlobs.forEach(blob => {
            blob.draggable = true;
            // Add edit button on hover
            blob.addEventListener('mouseenter', (e) => {
                const editBtn = document.createElement('span');
                editBtn.className = 'tr-edit-btn';
                editBtn.innerHTML = '✏️';
                editBtn.style.cssText = `
            position: absolute;
            top: -5px;
            right: -5px;
            background: white;
            border: 1px solid #667eea;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 100;
        `;
                editBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    const record = dayData.records[parseInt(blob.dataset.index)];
                    TimeRecordingEdit.showEditDialog(dayData.dateKey, record.Counter);
                };
                blob.appendChild(editBtn);
            });

            blob.addEventListener('mouseleave', () => {
                const editBtn = blob.querySelector('.tr-edit-btn');
                if (editBtn) 
                    editBtn.remove();
                

            });
            blob.addEventListener('click', (e) => {
                e.stopPropagation();
                const recordIndex = parseInt(blob.dataset.index);
                this.showRecordDetails(dayData, recordIndex);
            });
        });

        // Add double-click to show day details
        if (! dayData.isWeekend) {
            div.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.showDayDetailsPanel(dayData);
            });
        }

        return div;
    },

    // Excel-like selection methods
    startSelection: function (e, dayData) {
        if (e.shiftKey) { // Shift-click for range selection
            this.selectRange(dayData);
        } else if (e.ctrlKey || e.metaKey) { // Ctrl/Cmd-click for toggle selection
            this.toggleDaySelection(dayData);
        } else { // Start new selection
            if (! e.target.classList.contains('tr-entry-blob')) {
                this.clearSelection();
                this.selectionStart = dayData.dateKey;
                this.isSelecting = true;
                this.selectDay(dayData);
            }
        }
    },

    continueSelection: function (e, dayData) {
        if (this.isSelecting && this.selectionStart) { // Clear previous selection
            document.querySelectorAll('.tr-day-selecting').forEach(el => {
                el.classList.remove('tr-day-selecting');
            });

            // Select range from start to current
            this.selectRangeBetween(this.selectionStart, dayData.dateKey);
        }
    },

    endSelection: function (e, dayData) {
        if (this.isSelecting) {
            this.isSelecting = false;
            // Convert selecting to selected
            document.querySelectorAll('.tr-day-selecting').forEach(el => {
                el.classList.remove('tr-day-selecting');
                el.classList.add('tr-day-selected');
                const date = el.dataset.date;
                if (date) 
                    this.selectedDays.add(date);
                


            });
            this.updateSelectedDaysCount();
        }
    },

    selectDay: function (dayData) {
        const element = document.querySelector(`.tr-calendar-day[data-date="${
            dayData.dateKey
        }"]`);
        if (element && ! element.classList.contains('tr-day-weekend')) {
            element.classList.add('tr-day-selected');
            this.selectedDays.add(dayData.dateKey);
        }
    },

    toggleDaySelection: function (dayData) {
        const element = document.querySelector(`.tr-calendar-day[data-date="${
            dayData.dateKey
        }"]`);
        if (element && ! element.classList.contains('tr-day-weekend')) {
            if (this.selectedDays.has(dayData.dateKey)) {
                element.classList.remove('tr-day-selected');
                this.selectedDays.delete(dayData.dateKey);
            } else {
                element.classList.add('tr-day-selected');
                this.selectedDays.add(dayData.dateKey);
            }
            this.updateSelectedDaysCount();
        }
    },

    selectRangeBetween: function (startDate, endDate) {
        const allDays = document.querySelectorAll('.tr-calendar-day:not(.tr-day-weekend)');
        let inRange = false;

        allDays.forEach(day => {
            const date = day.dataset.date;
            if (date === startDate || date === endDate) {
                inRange = ! inRange;
                day.classList.add('tr-day-selecting');
                if (date === startDate && date === endDate) 
                    inRange = false;
                


            } else if (inRange) {
                day.classList.add('tr-day-selecting');
            }
        });
    },

    clearSelection: function () {
        document.querySelectorAll('.tr-day-selected, .tr-day-selecting').forEach(el => {
            el.classList.remove('tr-day-selected', 'tr-day-selecting');
        });
        this.selectedDays.clear();
        this.updateSelectedDaysCount();
    },

    updateSelectedDaysCount: function () {
        document.getElementById('trSelectedCount').textContent = this.selectedDays.size;
    },

    // Show day details panel
    showDayDetailsPanel: function (dayData) {
        const panel = document.getElementById('trDayDetailsPanel');
        const content = document.getElementById('trDayDetailsContent');

        panel.style.display = 'flex';

        let html = `
            <h4 style="margin: 0 0 15px 0;">${
            TimeRecordingUtils.formatDisplayDate(dayData.date)
        }</h4>
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <span>Total Hours: <strong>${
            dayData.totalHours
        }h</strong></span>
                <span>Status: <strong style="color: ${
            dayData.color
        }">${
            dayData.status
        }</strong></span>
            </div>
        `;

        if (dayData.records && dayData.records.length > 0) {
            html += '<h5 style="margin: 15px 0 10px 0;">Time Entries:</h5>';
            dayData.records.forEach((record, index) => {
                html += `
                    <div class="tr-day-detail-entry" data-index="${index}">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <strong>${
                    record.Duration
                }h</strong>
                            <span style="font-size: 11px; color: #666;">${
                    record.Counter
                }</span>
                        </div>
                        <div style="font-size: 12px; margin-bottom: 5px;">${
                    record.Content || 'No description'
                }</div>
                        <div style="font-size: 11px; color: #666;">
                            ${
                    record.AccProjDesc || ''
                }<br>
                            ${
                    record.AccTaskPspDesc || ''
                }
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<p style="text-align: center; color: #666; margin: 30px 0;">No time entries for this day</p>';
        } content.innerHTML = html;

        // Show actions if it's a workday
        const actions = document.getElementById('trDayDetailsActions');
        if (dayData.isWorkDay && ! dayData.isHoliday && ! dayData.isFuture) {
            actions.style.display = 'block';

            document.getElementById('trAddToSelection').onclick = () => {
                this.selectDay(dayData);
                this.updateSelectedDaysCount();
            };
        } else {
            actions.style.display = 'none';
        }
    },

    // Show record details
    showRecordDetails: function (dayData, recordIndex) {
        const record = dayData.records[recordIndex];
        if (! record) 
            return;
        


        this.showDayDetailsPanel(dayData);

        // Highlight the specific record
        setTimeout(() => {
            const entries = document.querySelectorAll('.tr-day-detail-entry');
            if (entries[recordIndex]) {
                entries[recordIndex].scrollIntoView({behavior: 'smooth', block: 'center'});
                entries[recordIndex].classList.add('tr-day-detail-entry-selected');
            }
        }, 100);
    },

    // Helper methods for selection
    selectMissingDays: function () {
        this.clearSelection();
        const monthData = TimeRecordingCalendar.monthData;
        if (monthData && monthData.days) {
            monthData.days.forEach(day => {
                if (day.isWorkDay && !day.isHoliday && !day.isFuture && day.totalHours === 0) {
                    this.selectDay(day);
                }
            });
        }
        this.updateSelectedDaysCount();
    },

    selectWeekdays: function () {
        this.clearSelection();
        const monthData = TimeRecordingCalendar.monthData;
        if (monthData && monthData.days) {
            monthData.days.forEach(day => {
                if (day.isWorkDay && !day.isHoliday && !day.isFuture && day.isCurrentMonth) {
                    this.selectDay(day);
                }
            });
        }
        this.updateSelectedDaysCount();
    },

    // Attach event handlers (UPDATED)
    attachEventHandlers: function () { // Prevent text selection while dragging
        document.addEventListener('selectstart', (e) => {
            if (this.isSelecting) {
                e.preventDefault();
            }
        });
        document.getElementById('trImportICS').onclick = () => {
            TimeRecordingICS.showImportDialog();
        };
        // Global mouseup to end selection
        document.addEventListener('mouseup', () => {
            if (this.isSelecting) {
                this.isSelecting = false;
                this.endSelection();
            }
        });
        const resetLayoutBtn = document.createElement('button');
        resetLayoutBtn.textContent = '🔄 Reset Layout';
        resetLayoutBtn.onclick = () => {
            if (confirm('Reset all panel positions to default?')) {
                TimeRecordingDrag.resetLayouts();
            }
        };
        document.getElementById('trFooter').appendChild(resetLayoutBtn);
        // Minimize/maximize
        document.getElementById('trMinimizeBtn').onclick = () => {
            document.getElementById('trMainContainer').style.display = 'none';
            document.getElementById('trMinimized').style.display = 'block';
            this.minimized = true;
        };

        document.getElementById('trMinimized').onclick = () => {
            document.getElementById('trMainContainer').style.display = 'flex';
            document.getElementById('trMinimized').style.display = 'none';
            this.minimized = false;
        };

        // Close
        document.getElementById('trCloseBtn').onclick = () => {
            if (confirm('Close Time Recording Calendar?')) {
                this.container.remove();
            }
        };

        // Toggle panels
        document.getElementById('trToggleAI').onclick = () => {
            const panel = document.getElementById('trAIPanel');
            this.aiChatOpen = !this.aiChatOpen;
            panel.style.display = this.aiChatOpen ? 'flex' : 'none';

            if (this.aiChatOpen && window.TimeRecordingAI) {
                TimeRecordingAI.initializeChat();
            }
        };

        document.getElementById('trToggleDetails').onclick = () => {
            const panel = document.getElementById('trDayDetailsPanel');
            panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        };

        document.getElementById('trCloseDayDetails').onclick = () => {
            document.getElementById('trDayDetailsPanel').style.display = 'none';
        };

        // Navigation
        document.getElementById('trPrevMonth').onclick = () => {
            TimeRecordingCalendar.previousMonth();
        };

        document.getElementById('trNextMonth').onclick = () => {
            TimeRecordingCalendar.nextMonth();
        };

        document.getElementById('trToday').onclick = () => {
            TimeRecordingCalendar.goToToday();
        };

        document.getElementById('trRefreshBtn').onclick = () => {
            TimeRecordingCalendar.refresh();
        };

        // Quick entry handlers
        document.getElementById('trApplySelected').onclick = () => {
            this.applyTimeToSelectedDays();
        };

        document.getElementById('trClearSelection').onclick = () => {
            this.clearSelection();
        };

        // AI chat handlers
        if (document.getElementById('trAISend')) {
            document.getElementById('trAISend').onclick = () => {
                if (window.TimeRecordingAI) {
                    const input = document.getElementById('trAIInput');
                    if (input.value.trim()) {
                        TimeRecordingAI.sendMessage(input.value);
                        input.value = '';
                    }
                }
            };
        }

        if (document.getElementById('trAIClear')) {
            document.getElementById('trAIClear').onclick = () => {
                if (window.TimeRecordingAI) {
                    TimeRecordingAI.clearChat();
                }
            };
        }

        // Enter key in AI input
        if (document.getElementById('trAIInput')) {
            document.getElementById('trAIInput').onkeypress = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    document.getElementById('trAISend').click();
                }
            };
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'a' && !e.shiftKey) {
                    e.preventDefault();
                    this.selectWeekdays();
                } else if (e.key === 'd') {
                    e.preventDefault();
                    this.clearSelection();
                }
            }
        });
        document.getElementById('trImportJSON').onclick = () => {
            const jsonText = document.getElementById('trJSONImport').value.trim();
            if (! jsonText) {
                alert('Please paste JSON data first');
                return;
            }

            try {
                const data = JSON.parse(jsonText);
                if (! data.entries || !Array.isArray(data.entries)) {
                    alert('Invalid JSON format. Expected {"entries": [...]}');
                    return;
                }

                // Show review dialog
                TimeRecordingAI.showEntryReviewDialog(data.entries);

            } catch (error) {
                alert('Invalid JSON: ' + error.message);
            }
        };

        document.getElementById('trValidateJSON').onclick = () => {
            const jsonText = document.getElementById('trJSONImport').value.trim();
            if (! jsonText) {
                alert('Please paste JSON data first');
                return;
            }

            try {
                const data = JSON.parse(jsonText);
                if (! data.entries || !Array.isArray(data.entries)) {
                    alert('❌ Invalid format. Expected {"entries": [...]}');
                    return;
                }

                // Validate each entry
                const errors = [];
                data.entries.forEach((entry, index) => {
                    if (!entry.date) 
                        errors.push(`Entry ${
                            index + 1
                        }: missing date`);
                    


                    if (!entry.projectId) 
                        errors.push(`Entry ${
                            index + 1
                        }: missing projectId`);
                    


                    if (!entry.taskId) 
                        errors.push(`Entry ${
                            index + 1
                        }: missing taskId`);
                    


                    if (!entry.hours) 
                        errors.push(`Entry ${
                            index + 1
                        }: missing hours`);
                    


                    if (!entry.description) 
                        errors.push(`Entry ${
                            index + 1
                        }: missing description`);
                    


                });

                if (errors.length > 0) {
                    alert('❌ Validation errors:\n\n' + errors.join('\n'));
                } else {
                    alert('✅ JSON is valid! ' + data.entries.length + ' entries ready to import.');
                }

            } catch (error) {
                alert('❌ Invalid JSON: ' + error.message);
            }
        };
    },

    // Other existing methods remain the same...
    renderCalendar: function (monthData) {
        const grid = document.getElementById('trCalendarGrid');
        if (! grid) 
            return;
        


        grid.innerHTML = '';

        // Add weekday headers
        const weekdays = [
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat',
            'Sun'
        ];
        weekdays.forEach(day => {
            const header = document.createElement('div');
            header.className = 'tr-calendar-weekday-header';
            if (day === 'Sat' || day === 'Sun') {
                header.style.color = '#adb5bd';
                header.style.background = '#f1f3f5';
            }
            header.textContent = day;
            grid.appendChild(header);
        });

        // Add days
        monthData.days.forEach(dayData => {
            const dayElement = this.createDayElement(dayData);
            grid.appendChild(dayElement);
        });

        // Populate favorites dropdown
        this.populateFavoritesDropdown();

        // Update month name and stats
        document.getElementById('trCurrentMonth').textContent = monthData.monthName;
        document.getElementById('trRequiredHours').textContent = monthData.requiredHours;
        document.getElementById('trRecordedHours').textContent = monthData.totalHours.toFixed(2);
        document.getElementById('trCompletionRate').textContent = monthData.completionRate;

        const rateElement = document.getElementById('trCompletionRate');
        if (monthData.completionRate >= 100) {
            rateElement.style.color = TimeRecordingConfig.ui.colors.complete;
        } else if (monthData.completionRate >= 80) {
            rateElement.style.color = TimeRecordingConfig.ui.colors.partial;
        } else {
            rateElement.style.color = TimeRecordingConfig.ui.colors.missing;
        }

        TimeRecordingUtils.log('info', 'Calendar rendered successfully');
    },

    // Rest of the existing methods...
    populateFavoritesDropdown: function () {
        const dropdown = document.getElementById('trQuickProject');
        if (! dropdown) 
            return;
        


        dropdown.innerHTML = '<option value="">Select from favorites...</option>';

        const favorites = TimeRecordingAPI.getUserFavorites();
        favorites.forEach(fav => {
            const option = document.createElement('option');
            option.value = JSON.stringify({guid: fav.Guid, projectId: fav.AccProjId, taskId: fav.AccTaskPspId, name: fav.Name});
            option.textContent = `${
                fav.Name
            } - ${
                fav.AccProjDesc
            }`;
            dropdown.appendChild(option);
        });
    },

    // Add this to the time_recording_ui.js file - updating the recordTimeEntries method

    // Record time entries using the real SAP API

    recordTimeEntries: async function (entries) {
        console.log('Recording time entries:', entries);
        TimeRecordingUtils.log('info', `Recording ${
            entries.length
        } time entries...`);

        // Show loading indicator
        this.updateLog('info', `Recording ${
            entries.length
        } time entries...`);

        try { // Get favorite details for project/task descriptions
            const favorites = TimeRecordingAPI.getUserFavorites();

            // Transform entries to the format needed by the API
            const apiRecords = entries.map(entry => { // Find the favorite to get descriptions
                const favorite = favorites.find(fav => fav.AccProjId === entry.projectId && fav.AccTaskPspId === entry.taskId);

                // FIX: Ensure hours is a number
                const hours = typeof entry.hours === 'string' ? parseFloat(entry.hours) : entry.hours;

                return {
                    date: entry.date,
                    hours: hours, // Pass as number, will be formatted in createTimeRecord
                    description: entry.description,
                    projectId: entry.projectId,
                    taskId: entry.taskId,
                    projectDesc: favorite ?. AccProjDesc || '',
                    taskDesc: favorite ?. AccTaskPspDesc || '',
                    accountInd: entry ?. AccountInd || '10', // Default to billable
                };
            });

            // Create the time records
            const result = await TimeRecordingAPI.createMultipleTimeRecords(apiRecords);

            // Show results
            if (result.errors.length === 0) {
                this.updateLog('success', `✅ All ${
                    result.summary.successful
                } entries recorded successfully!`);

                // Refresh the calendar to show the new entries
                setTimeout(() => {
                    TimeRecordingCalendar.refresh();
                }, 1000);

            } else {
                this.updateLog('warning', `⚠️ Recorded ${
                    result.summary.successful
                } of ${
                    result.summary.total
                } entries. ${
                    result.summary.failed
                } failed.`);

                // Show error details
                const errorMessage = result.errors.map(err => `${
                    err.date
                }: ${
                    err.error
                }`).join('\n');

                alert(`Some entries failed:\n\n${errorMessage}`);
                return result.errors;
            }

            // Clear selection after recording
            this.clearSelection();

        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to record time entries:', error);
            this.updateLog('error', `❌ Failed to record entries: ${
                error.message
            }`);
            alert(`Failed to record time entries:\n${
                error.message
            }`);
        }
    },

    // Also update the applyTimeToSelectedDays method to show confirmation
    applyTimeToSelectedDays: async function () {
        const projectSelect = document.getElementById('trQuickProject');
        const hoursInput = document.getElementById('trQuickHours');
        const descriptionInput = document.getElementById('trQuickDescription');

        if (! projectSelect.value) {
            alert('Please select a project/task');
            return;
        }

        if (! descriptionInput.value.trim()) {
            alert('Please enter a description');
            return;
        }

        if (this.selectedDays.size === 0) {
            alert('Please select at least one day');
            return;
        }

        const project = JSON.parse(projectSelect.value);
        const hours = parseFloat(hoursInput.value);
        const description = descriptionInput.value.trim();

        // Create preview of what will be recorded
        const selectedDaysArray = Array.from(this.selectedDays);
        const preview = selectedDaysArray.slice(0, 5).map(dateKey => {
            const year = dateKey.substr(0, 4);
            const month = dateKey.substr(4, 2);
            const day = dateKey.substr(6, 2);
            return `  ${day}.${month}.${year}: ${hours}h - ${description}`;
        }).join('\n');

        const moreText = selectedDaysArray.length > 5 ? `\n  ... and ${
            selectedDaysArray.length - 5
        } more days` : '';

        // Confirm with user
        const confirmed = confirm(`You are about to record the following time entries:\n\n` + `Project: ${
            project.name
        }\n` + `Hours per day: ${hours}\n` + `Description: ${description}\n\n` + `Days:\n${preview}${moreText}\n\n` + `Total: ${
            selectedDaysArray.length
        } entries × ${hours}h = ${
            selectedDaysArray.length * hours
        }h\n\n` + `Continue?`);

        if (! confirmed) 
            return;
        


        // Create time entry objects
        const entries = selectedDaysArray.map(dateKey => ({
            date: dateKey,
            projectId: project.projectId,
            taskId: project.taskId,
            hours: hours,
            description: description,
            favoriteGuid: project.guid
        }));

        // Call the recording function with real API
        await this.recordTimeEntries(entries);
    },
    updateLog: function (level, message) {
        const statusElement = document.getElementById('trStatusMessage');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = level === 'error' ? '#dc3545' : '#6c757d';
        }
    }


};
// Time Recording Calendar - Utilities Module
window.TimeRecordingUtils = {
    // Date formatting utilities
    formatDate: function(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    },
    
    formatDisplayDate: function(date) {
        const d = new Date(date);
        return d.toLocaleDateString('de-DE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    },
    
    formatMonth: function(date) {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    },
    
    // Get all working days in a month
    getWorkingDaysInMonth: function(year, month) {
        const days = [];
        const date = new Date(year, month, 1);
        
        while (date.getMonth() === month) {
            const dayOfWeek = date.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                days.push(new Date(date));
            }
            date.setDate(date.getDate() + 1);
        }
        
        return days;
    },
    
    // Check if date is weekend
    isWeekend: function(date) {
        const day = date.getDay();
        return day === 0 || day === 6;
    },
    
    // Check if date is today
    isToday: function(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    },
    
    // Check if date is in the future
    isFuture: function(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date > today;
    },
    
    // Parse SAP duration format (e.g., "8.00" to 8)
    parseDuration: function(duration) {
        return parseFloat(duration) || 0;
    },
    
    // Calculate total hours from records
    calculateTotalHours: function(records) {
        return records.reduce((total, record) => {
            return total + this.parseDuration(record.Duration);
        }, 0);
    },
    
    // Generate unique ID
    generateId: function() {
        return Math.random().toString(16).substr(2, 8) + '-' +
               Math.random().toString(16).substr(2, 4) + '-' +
               Math.random().toString(16).substr(2, 4);
    },
    
    // Storage utilities
    storage: {
        save: function(key, data) {
            try {
                localStorage.setItem(`time_recording_${key}`, JSON.stringify(data));
                return true;
            } catch (e) {
                console.error('Failed to save to storage:', e);
                return false;
            }
        },
        
        load: function(key, defaultValue = null) {
            try {
                const data = localStorage.getItem(`time_recording_${key}`);
                return data ? JSON.parse(data) : defaultValue;
            } catch (e) {
                console.error('Failed to load from storage:', e);
                return defaultValue;
            }
        },
        
        remove: function(key) {
            try {
                localStorage.removeItem(`time_recording_${key}`);
                return true;
            } catch (e) {
                console.error('Failed to remove from storage:', e);
                return false;
            }
        }
    },
    
    // Logging utility
    log: function(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[TimeRecording] [${timestamp}] [${level.toUpperCase()}]`;
        
        if (data) {
            console[level === 'error' ? 'error' : 'log'](`${prefix} ${message}`, data);
        } else {
            console[level === 'error' ? 'error' : 'log'](`${prefix} ${message}`);
        }
        
        // Also update UI log if available
        if (window.TimeRecordingUI && window.TimeRecordingUI.updateLog) {
            window.TimeRecordingUI.updateLog(level, message);
        }
    },
    getWeekNumber: function(date) {
        const oneJan = new Date(date.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((date - oneJan) / 86400000);
        const result = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
        return result;
    }
};
// Time Recording Calendar - Main Application
(async function () {
    'use strict';

    console.log('[TimeRecording] Initializing Time Recording Calendar...');

    // Check dependencies
    const requiredModules = [
        'TimeRecordingConfig',
        'TimeRecordingUtils',
        'TimeRecordingAPI',
        'TimeRecordingCalendar',
        'TimeRecordingUI',
        'TimeRecordingICS',
        'TimeRecordingAI',
        'TimeRecordingEdit',
        'TimeRecordingDrag'
    ];

    for (const module of requiredModules) {
        if (!window[module]) {
            console.error(`[TimeRecording] Missing required module: ${module}`);
            alert(`Time Recording Calendar: Missing module ${module}. Please load all required files.`);
            return;
        }
    }
    TimeRecordingAI.init('AIzaSyCL-Erm69uT_MkRcFl9z3PbzUlpVfzo8S4');
    // Initialize application
    async function initialize() {
        try { // Create UI first
            TimeRecordingUI.create();
            TimeRecordingDrag.init();
            TimeRecordingUtils.log('info', 'Starting initialization...');

            // Initialize API service
            const apiInitialized = await TimeRecordingAPI.init();
            if (! apiInitialized) {
                throw new Error('Failed to initialize API service');
            }

            // Initialize calendar
            const calendarInitialized = await TimeRecordingCalendar.init();
            if (! calendarInitialized) {
                throw new Error('Failed to initialize calendar');
            }

            TimeRecordingUtils.log('success', 'Time Recording Calendar ready!');

            // Set up auto-refresh if configured
            if (TimeRecordingConfig.ui.autoRefresh > 0) {
                setInterval(() => {
                    if (!TimeRecordingUI.minimized) {
                        TimeRecordingCalendar.refresh();
                    }
                }, TimeRecordingConfig.ui.autoRefresh);
            }

        } catch (error) {
            TimeRecordingUtils.log('error', 'Initialization failed', error);
            alert('Failed to initialize Time Recording Calendar. Check console for details.');
        }
    }

    // Start initialization
    initialize();
})();
