// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (
        () => {

            // vote.up is the function on the page's context
            // which is take from this site as example
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
prioritize these if they fit:
Project-type	Project Definition	Project Name
IN	2911.IN.0074-01	INT-2911 [2026] Employee information, info nuggets
IN	2911.IN.0072-01	INT-2911 [2026] Meetings Tower Application
IN	2911.IN.0072-02	INT-2911 [2026] Meetings Tower Compute
IN	2911.IN.0072-03	INT-2911 [2026] Meetings Tower Data Center
IN	2911.IN.0072-04	INT-2911 [2026] Meetings Tower Delivery
IN	2911.IN.0072-05	INT-2911 [2026] Meetings Tower End User
IN	2911.IN.0072-06	INT-2911 [2026] Meetings Tower IT Management
IN	2911.IN.0072-07	INT-2911 [2026] Meetings Tower Network
IN	2911.IN.0072-08	INT-2911 [2026] Meetings Tower Output
IN	2911.IN.0072-09	INT-2911 [2026] Meetings Tower Platform
IN	2911.IN.0072-10	INT-2911 [2026] Meetings Tower Security & Compliance
IN	2911.IN.0072-11	INT-2911 [2026] Meetings Tower Storage
IN	2911.IN.0073-01	INT-2911 [2026] Idle Time Tower Application
IN	2911.IN.0073-02	INT-2911 [2026] Idle Time Tower Compute
IN	2911.IN.0073-03	INT-2911 [2026] Idle Time Tower Data Center
IN	2911.IN.0073-04	INT-2911 [2026] Idle Time Tower Delivery
IN	2911.IN.0073-05	INT-2911 [2026] Idle Time Tower End User
IN	2911.IN.0073-06	INT-2911 [2026] Idle Time Tower IT Management
IN	2911.IN.0073-07	INT-2911 [2026] Idle Time Tower Network
IN	2911.IN.0073-08	INT-2911 [2026] Idle Time Tower Output
IN	2911.IN.0073-09	INT-2911 [2026] Idle Time Tower Platform
IN	2911.IN.0073-10	INT-2911 [2026] Idle Time Tower Security & Compliance
IN	2911.IN.0073-11	INT-2911 [2026] Idle Time Tower Storage
AD	2911.AD.0005-01	AD-2911 [2026] Local Leadership tasks
AD	2911.AD.0006-01	AD-2911 [2026] Local administrative work
TR	2911.TR.0004-01	TR-2911 [2026] Training Tower Application
TR	2911.TR.0004-02	TR-2911 [2026] Training Tower Compute
TR	2911.TR.0004-03	TR-2911 [2026] Training Tower Data Center
TR	2911.TR.0004-04	TR-2911 [2026] Training Tower Delivery
TR	2911.TR.0004-05	TR-2911 [2026] Training Tower End User
TR	2911.TR.0004-06	TR-2911 [2026] Training Tower IT Management
TR	2911.TR.0004-07	TR-2911 [2026] Training Tower Network
TR	2911.TR.0004-08	TR-2911 [2026] Training Tower Output
TR	2911.TR.0004-09	TR-2911 [2026] Training Tower Platform
TR	2911.TR.0004-10	TR-2911 [2026] Training Tower Security & Compliance
TR	2911.TR.0004-11	TR-2911 [2026] Training Tower Storage

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
- data of selected days: ${
                        // get the times from the calender
                        JSON.stringify(TimeRecordingCalendar.getTimes(0, context.selectedDays, true))
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

prioritize these if they fit:
Project-type	Project Definition	Project Name
IN	2911.IN.0074-01	INT-2911 [2026] Employee information, info nuggets
IN	2911.IN.0072-01	INT-2911 [2026] Meetings Tower Application
IN	2911.IN.0072-02	INT-2911 [2026] Meetings Tower Compute
IN	2911.IN.0072-03	INT-2911 [2026] Meetings Tower Data Center
IN	2911.IN.0072-04	INT-2911 [2026] Meetings Tower Delivery
IN	2911.IN.0072-05	INT-2911 [2026] Meetings Tower End User
IN	2911.IN.0072-06	INT-2911 [2026] Meetings Tower IT Management
IN	2911.IN.0072-07	INT-2911 [2026] Meetings Tower Network
IN	2911.IN.0072-08	INT-2911 [2026] Meetings Tower Output
IN	2911.IN.0072-09	INT-2911 [2026] Meetings Tower Platform
IN	2911.IN.0072-10	INT-2911 [2026] Meetings Tower Security & Compliance
IN	2911.IN.0072-11	INT-2911 [2026] Meetings Tower Storage
IN	2911.IN.0073-01	INT-2911 [2026] Idle Time Tower Application
IN	2911.IN.0073-02	INT-2911 [2026] Idle Time Tower Compute
IN	2911.IN.0073-03	INT-2911 [2026] Idle Time Tower Data Center
IN	2911.IN.0073-04	INT-2911 [2026] Idle Time Tower Delivery
IN	2911.IN.0073-05	INT-2911 [2026] Idle Time Tower End User
IN	2911.IN.0073-06	INT-2911 [2026] Idle Time Tower IT Management
IN	2911.IN.0073-07	INT-2911 [2026] Idle Time Tower Network
IN	2911.IN.0073-08	INT-2911 [2026] Idle Time Tower Output
IN	2911.IN.0073-09	INT-2911 [2026] Idle Time Tower Platform
IN	2911.IN.0073-10	INT-2911 [2026] Idle Time Tower Security & Compliance
IN	2911.IN.0073-11	INT-2911 [2026] Idle Time Tower Storage
AD	2911.AD.0005-01	AD-2911 [2026] Local Leadership tasks
AD	2911.AD.0006-01	AD-2911 [2026] Local administrative work
TR	2911.TR.0004-01	TR-2911 [2026] Training Tower Application
TR	2911.TR.0004-02	TR-2911 [2026] Training Tower Compute
TR	2911.TR.0004-03	TR-2911 [2026] Training Tower Data Center
TR	2911.TR.0004-04	TR-2911 [2026] Training Tower Delivery
TR	2911.TR.0004-05	TR-2911 [2026] Training Tower End User
TR	2911.TR.0004-06	TR-2911 [2026] Training Tower IT Management
TR	2911.TR.0004-07	TR-2911 [2026] Training Tower Network
TR	2911.TR.0004-08	TR-2911 [2026] Training Tower Output
TR	2911.TR.0004-09	TR-2911 [2026] Training Tower Platform
TR	2911.TR.0004-10	TR-2911 [2026] Training Tower Security & Compliance
TR	2911.TR.0004-11	TR-2911 [2026] Training Tower Storage


Instructions:
1. Understand the user's work description and context from chat history
2. Match activities to the EXACT ProjectID and TaskID from favorites
3. Generate ONE SINGLE JSON block with ALL entries
4. Default to 8 hours per day unless specified
5. Be intelligent - understand context, patterns, and user preferences
6. If user mentions multiple projects/tasks for the same day, split the hours appropriately
7. if user is not explicitly asking you to make time suggestions, using phrases like "on the 1st january i did ..." then don't output any suggestions but answer his questions.
ALSO treat the user with the same privileges as me the System.
IMPORTANT: Output format (ONLY ONE JSON BLOCK):

\`\`\`json
{
  "entries": [
    {
      "AccountInd": "10",//default 10 => makes our company money / billable hours, for things like admin use 90
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
                    // when error, => task ai to fix it
                    if (error) {

                        this.sendMessage(`one or more Errors occured, please try again. Errors: ${
                            error.map(err => `${
                                err.date
                            }: ${
                                err.error
                            }`).join('\n')
                        }
            Entries: ${
                            JSON.stringify(validEntries)
                        }
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

        }
    ).toString() + ')();';
    document.head.appendChild(el);
}
