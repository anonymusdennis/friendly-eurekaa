// Time Recording Calendar - AI Functions Module
var appcontent = document.querySelector("body");
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (
        () => {
            Object.assign(window.TimeRecordingAI, {
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
                            description: "Ask the user a question ONLY as a last resort — when you have exhausted all available data (history, favorites, patterns, context files) and still cannot make a confident decision. Do NOT ask for simple confirmations or obvious matches.",
                            parameters: {
                                type: "object",
                                properties: {
                                    question: { type: "string", description: "The clarifying question to ask" },
                                    options: { type: "array", items: { type: "string" }, description: "Options the user can choose from" },
                                    context: { type: "string", description: "What data you already checked and why you still can't decide" }
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
                                    accountInd: { type: "string", description: "New account indicator: '10' for billable, '90' for non-billable (optional)" },
                                    jiraTicketId: { type: "string", description: "Jira ticket ID to set or update (optional — e.g. '#250001276')" }
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
                        },
                        {
                            name: "highlightDay",
                            description: "Visually highlight a calendar day with a colored border and optional label. Use this to show the user which day you are currently working on or to draw attention to specific dates. The highlight is temporary and will be cleared on refresh.",
                            parameters: {
                                type: "object",
                                properties: {
                                    date: { type: "string", description: "Date in YYYY-MM-DD format" },
                                    color: { type: "string", description: "CSS color for the highlight border (e.g. '#667eea', '#28a745', '#ff6b6b'). Default: '#667eea' (purple)" },
                                    label: { type: "string", description: "Short label to show on the day (e.g. '🔍 checking', '✅ done', '📝 editing')" }
                                },
                                required: ["date"]
                            }
                        },
                        {
                            name: "clearHighlights",
                            description: "Remove all AI visual highlights from the calendar. Call this when you are done working on a set of days.",
                            parameters: { type: "object", properties: {}, required: [] }
                        },
                        {
                            name: "addCalendarNote",
                            description: "Add a persistent client-side note to a calendar day, displayed like a holiday. Notes are stored locally and survive page refreshes. Use for reminders, markers, or custom annotations the user wants to see on the calendar.",
                            parameters: {
                                type: "object",
                                properties: {
                                    date: { type: "string", description: "Date in YYYY-MM-DD format" },
                                    emoji: { type: "string", description: "Emoji to display (e.g. '📌', '⭐', '🎯', '🔔'). Default: '📌'" },
                                    text: { type: "string", description: "Short text to display on the calendar day (max ~30 chars)" }
                                },
                                required: ["date", "text"]
                            }
                        },
                        {
                            name: "removeCalendarNote",
                            description: "Remove a persistent client-side note from a calendar day.",
                            parameters: {
                                type: "object",
                                properties: {
                                    date: { type: "string", description: "Date in YYYY-MM-DD format" }
                                },
                                required: ["date"]
                            }
                        },
                        {
                            name: "searchPSP",
                            description: "Search for PSP (Project Structure Plan) elements across the user's favorites. Supports wildcard patterns (* for any characters, ? for single character), text search across all fields, and child search to find sub-elements of a parent PSP. Use this when the user asks to find a project, look up a PSP, or needs to identify the correct task/PSP element for time recording.",
                            parameters: {
                                type: "object",
                                properties: {
                                    query: { type: "string", description: "Global search text — searches across PSP ID, description, project ID, project description, and partner name. Supports wildcards (* and ?). Examples: 'Platform', '2911.IN.0072*', '*Rufbereitschaft*'" },
                                    pspId: { type: "string", description: "Filter by PSP ID specifically. Supports wildcards. Examples: '2911.IN.0076-*', '2911.IN.00??-01'" },
                                    projectId: { type: "string", description: "Filter by Project ID. Supports wildcards. Examples: 'WG2911', 'WG*'" },
                                    partner: { type: "string", description: "Filter by partner/company name. Supports wildcards. Examples: 'Würth IT*', '*Adolf*'" },
                                    description: { type: "string", description: "Filter by PSP or project description. Supports wildcards. Examples: '*Consulting*', '*Tower*'" },
                                    parentPsp: { type: "string", description: "Parent PSP ID for child search. When childSearch is true, finds all sub-elements. Example: '2911.IN.0076' finds 2911.IN.0076-01, -02, etc." },
                                    childSearch: { type: "boolean", description: "Set to true to find all children/sub-elements of the parentPsp. Default: false" }
                                },
                                required: []
                            }
                        },
                        {
                            name: "createTimeEntry",
                            description: "Create new time entries for the user. Shows a review dialog where the user can approve, edit, or reject entries before they are saved. Use this when you have determined the correct project, task, hours, and description for one or more days.",
                            parameters: {
                                type: "object",
                                properties: {
                                    entries: {
                                        type: "array",
                                        description: "Array of time entry objects to create",
                                        items: {
                                            type: "object",
                                            properties: {
                                                date: { type: "string", description: "Date in YYYYMMDD format (e.g. '20260206')" },
                                                projectId: { type: "string", description: "Project ID (e.g. '2911.UM.0074')" },
                                                taskId: { type: "string", description: "Task/PSP element ID (e.g. '2911.UM.0074-07-07-02')" },
                                                hours: { type: "number", description: "Duration in hours (e.g. 7.5)" },
                                                description: { type: "string", description: "Description of the work done" },
                                                accountInd: { type: "string", description: "Account indicator: '10' for billable, '90' for non-billable. Default: '10'" },
                                                jiraTicketId: { type: "string", description: "Jira ticket ID if mentioned or referenced by the user (e.g. '#250001276'). Include when user mentions a ticket number." }
                                            },
                                            required: ["date", "projectId", "taskId", "hours", "description"]
                                        }
                                    }
                                },
                                required: ["entries"]
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
                        case 'highlightDay':
                            return this.handleHighlightDay(args);
                        case 'clearHighlights':
                            return this.handleClearHighlights();
                        case 'addCalendarNote':
                            return this.handleAddCalendarNote(args);
                        case 'removeCalendarNote':
                            return this.handleRemoveCalendarNote(args);
                        case 'searchPSP':
                            return this.handleSearchPSP(args);
                        case 'createTimeEntry':
                            return this.handleCreateTimeEntry(args);
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

                // Handle createTimeEntry — show the review dialog for AI-proposed entries
                handleCreateTimeEntry: function (args) {
                    const entries = args.entries;
                    if (!entries || entries.length === 0) {
                        this.addMessage('model', '\u274C No entries provided to create.');
                        return { error: 'No entries provided' };
                    }

                    // Validate and show in chat
                    this.addMessage('model', '\u{1F4DD} Here are **' + entries.length + '** suggested time entries for your review:', { entries });

                    // Run self-validation
                    if (TimeRecordingConfig.ai?.enableSelfValidation !== false) {
                        const warnings = this.validateEntries(entries);
                        if (warnings.length > 0) {
                            this.addMessage('model', '\u26A0\uFE0F **Validation warnings:**\n' + warnings.join('\n') + '\n\nYou can still import \u2014 or ask me to fix these.');
                        }
                    }

                    // Show the review/import popup
                    this.showEntryReviewDialog(entries);

                    return { status: 'review_dialog_shown', entryCount: entries.length };
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
                        const updatedRecord = { ...record, Mode: 'M' };
                        if (args.hours !== undefined) updatedRecord.Duration = args.hours.toString();
                        if (args.description !== undefined) updatedRecord.Content = args.description;
                        if (args.projectId !== undefined) updatedRecord.AccProjId = args.projectId;
                        if (args.taskId !== undefined) updatedRecord.AccTaskPspId = args.taskId;
                        if (args.accountInd !== undefined) updatedRecord.AccountInd = args.accountInd;
                        if (args.jiraTicketId !== undefined) updatedRecord.JiraTicketId = args.jiraTicketId;

                        // Build a summary of changes for the user
                        const changes = [];
                        if (args.hours !== undefined) changes.push('hours: ' + record.Duration + ' \u2192 ' + args.hours);
                        if (args.description !== undefined) changes.push('description: "' + (record.Content || '').substring(0, 40) + '" \u2192 "' + args.description.substring(0, 40) + '"');
                        if (args.projectId !== undefined) changes.push('project: ' + record.AccProjId + ' \u2192 ' + args.projectId);
                        if (args.taskId !== undefined) changes.push('task: ' + record.AccTaskPspId + ' \u2192 ' + args.taskId);
                        if (args.accountInd !== undefined) changes.push('billable: ' + record.AccountInd + ' \u2192 ' + args.accountInd);
                        if (args.jiraTicketId !== undefined) changes.push('jiraTicketId: ' + (record.JiraTicketId || '(none)') + ' \u2192 ' + args.jiraTicketId);

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

                // Handle searchPSP — search PSP elements with wildcard, text, and child search
                handleSearchPSP: function (args) {
                    try {
                        const results = TimeRecordingAPI.searchPSPElements({
                            query: args.query,
                            pspId: args.pspId,
                            projectId: args.projectId,
                            partner: args.partner,
                            description: args.description,
                            parentPsp: args.parentPsp,
                            childSearch: args.childSearch || false
                        });

                        if (results.length === 0) {
                            return {
                                totalResults: 0,
                                message: 'No PSP elements found matching your criteria. Try broader wildcards (e.g. *keyword*) or check spelling.',
                                results: []
                            };
                        }

                        // Cap results to avoid overwhelming the AI context
                        const maxResults = 50;
                        const truncated = results.length > maxResults;
                        const returnResults = results.slice(0, maxResults);

                        return {
                            totalResults: results.length,
                            showing: returnResults.length,
                            truncated: truncated,
                            childSearch: args.childSearch || false,
                            parentPsp: args.parentPsp || null,
                            results: returnResults
                        };
                    } catch (error) {
                        return { error: 'PSP search failed: ' + error.message };
                    }
                },

                // ─── Calendar Visual Overlay Handlers ─────────────────────────

                handleHighlightDay: function (args) {
                    const dateKey = args.date.replace(/-/g, '');
                    const color = args.color || '#667eea';
                    const label = args.label || '';
                    this.calendarHighlights[dateKey] = { color, label };
                    this.applyHighlight(dateKey, color, label);
                    this.logStatus('highlight', 'Highlighted ' + args.date + (label ? ' — ' + label : ''));
                    return { status: 'ok', date: args.date, color, label };
                },

                handleClearHighlights: function () {
                    const count = Object.keys(this.calendarHighlights).length;
                    for (const dateKey of Object.keys(this.calendarHighlights)) {
                        this.removeHighlight(dateKey);
                    }
                    this.calendarHighlights = {};
                    this.logStatus('highlight', 'Cleared ' + count + ' highlights');
                    return { status: 'ok', cleared: count };
                },

                handleAddCalendarNote: function (args) {
                    const dateKey = args.date.replace(/-/g, '');
                    const emoji = args.emoji || '\u{1F4CC}';
                    const text = (args.text || '').substring(0, 40);
                    this.calendarNotes[dateKey] = { emoji, text };
                    this.saveCalendarNotes();
                    this.applyCalendarNote(dateKey, emoji, text);
                    this.logStatus('note', 'Added note to ' + args.date + ': ' + emoji + ' ' + text);
                    return { status: 'ok', date: args.date, emoji, text };
                },

                handleRemoveCalendarNote: function (args) {
                    const dateKey = args.date.replace(/-/g, '');
                    if (this.calendarNotes[dateKey]) {
                        delete this.calendarNotes[dateKey];
                        this.saveCalendarNotes();
                        this.removeCalendarNoteElement(dateKey);
                        this.logStatus('note', 'Removed note from ' + args.date);
                        return { status: 'ok', removed: args.date };
                    }
                    return { status: 'ok', message: 'No note found on ' + args.date };
                },

                // Apply a visual highlight to a calendar day cell
                applyHighlight: function (dateKey, color, label) {
                    const cell = document.querySelector('.tr-calendar-day[data-date="' + dateKey + '"]');
                    if (!cell) return;
                    cell.style.boxShadow = 'inset 0 0 0 3px ' + color;
                    cell.style.transition = 'box-shadow 0.3s ease';
                    // Add or update label overlay
                    let overlay = cell.querySelector('.tr-ai-highlight-label');
                    if (label) {
                        if (!overlay) {
                            overlay = document.createElement('div');
                            overlay.className = 'tr-ai-highlight-label';
                            overlay.style.cssText = 'position:absolute;top:2px;right:2px;font-size:10px;background:' + color + ';color:white;padding:1px 4px;border-radius:3px;z-index:5;white-space:nowrap;pointer-events:none;';
                            cell.style.position = 'relative';
                            cell.appendChild(overlay);
                        }
                        overlay.textContent = label;
                        overlay.style.background = color;
                    } else if (overlay) {
                        overlay.remove();
                    }
                },

                // Remove a highlight from a calendar day cell
                removeHighlight: function (dateKey) {
                    const cell = document.querySelector('.tr-calendar-day[data-date="' + dateKey + '"]');
                    if (!cell) return;
                    cell.style.boxShadow = '';
                    const overlay = cell.querySelector('.tr-ai-highlight-label');
                    if (overlay) overlay.remove();
                },

                // Apply a persistent calendar note to a day cell
                applyCalendarNote: function (dateKey, emoji, text) {
                    const cell = document.querySelector('.tr-calendar-day[data-date="' + dateKey + '"]');
                    if (!cell) return;
                    // Remove existing note if present
                    this.removeCalendarNoteElement(dateKey);
                    const noteEl = document.createElement('div');
                    noteEl.className = 'tr-ai-calendar-note';
                    noteEl.style.cssText = 'font-size:10px;color:#764ba2;text-align:center;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                    noteEl.textContent = emoji + ' ' + text;
                    cell.appendChild(noteEl);
                },

                // Remove a calendar note element from a day cell
                removeCalendarNoteElement: function (dateKey) {
                    const cell = document.querySelector('.tr-calendar-day[data-date="' + dateKey + '"]');
                    if (!cell) return;
                    const existing = cell.querySelector('.tr-ai-calendar-note');
                    if (existing) existing.remove();
                },

                // Save calendar notes to localStorage
                saveCalendarNotes: function () {
                    TimeRecordingUtils.storage.save('ai_calendar_notes', JSON.stringify(this.calendarNotes));
                },

                // Load calendar notes from localStorage
                loadCalendarNotes: function () {
                    try {
                        const raw = TimeRecordingUtils.storage.load('ai_calendar_notes', '{}');
                        this.calendarNotes = JSON.parse(raw);
                    } catch (e) {
                        this.calendarNotes = {};
                    }
                },

                // Re-apply all highlights and notes after calendar render
                reapplyCalendarOverlays: function () {
                    for (const [dateKey, h] of Object.entries(this.calendarHighlights)) {
                        this.applyHighlight(dateKey, h.color, h.label);
                    }
                    for (const [dateKey, n] of Object.entries(this.calendarNotes)) {
                        this.applyCalendarNote(dateKey, n.emoji, n.text);
                    }
                },

                // ─── Status Log for Debug Popup ─────────────────────────

                logStatus: function (type, message) {
                    const entry = { timestamp: new Date().toISOString(), type, message };
                    this.statusLog.push(entry);
                    if (this.statusLog.length > 200) this.statusLog.shift();
                    this.updateStatusPopup(entry);
                },

                // Update the status popup window if it's open
                updateStatusPopup: function (entry) {
                    const container = document.getElementById('trAIStatusLog');
                    if (!container) return;
                    const line = document.createElement('div');
                    line.style.cssText = 'padding:3px 0;border-bottom:1px solid #f0f0f0;font-size:11px;font-family:monospace;';
                    const time = entry.timestamp.substring(11, 19);
                    const typeColors = { highlight: '#667eea', note: '#764ba2', function: '#28a745', thinking: '#ffc107', error: '#dc3545', info: '#6c757d' };
                    const color = typeColors[entry.type] || '#333';
                    line.innerHTML = '<span style="color:#999;">' + time + '</span> <span style="color:' + color + ';font-weight:bold;">[' + entry.type + ']</span> ' + entry.message.replace(/</g, '&lt;');
                    container.appendChild(line);
                    container.scrollTop = container.scrollHeight;
                }

                // ─── End Calendar Visual / Status Methods ─────────────────
            });
        }
    ).toString() + ')();';
    document.head.appendChild(el);
}
