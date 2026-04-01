/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
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
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 16px;">🤖 AI Assistant</h3>
                                <div style="display: flex; gap: 6px;">
                                    <button id="trAILoadHistory" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Load historical records for AI context">📊</button>
                                    <button id="trAIUploadFile" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Upload context file">📎</button>
                                    <button id="trAIManageCtx" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Manage context files">📂</button>
                                    <button id="trAIPasteClipboard" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Analyze clipboard content">📋</button>
                                    <button id="trAIApiKey" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Set/change API key">🔑</button>
                                    <button id="trAIStatusBtn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Open AI status/debug window">🔬</button>
                                </div>
                            </div>
                            <div style="padding: 6px 15px 0; display: flex; align-items: center; gap: 6px;">
                                <label style="color: rgba(255,255,255,0.8); font-size: 11px; white-space: nowrap;">Model:</label>
                                <select id="trAIModelSelect" style="flex: 1; background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 3px 6px; border-radius: 4px; font-size: 11px; cursor: pointer; max-width: 260px;">
                                    <option value="" style="color: #333; background: white;">Loading models...</option>
                                </select>
                            </div>
                        </div>
                        <input type="file" id="trAIFileInput" style="display: none;" accept=".txt,.csv,.json,.md,.log,.xml">
                        <div id="trAIChatContainer" style="flex: 1; overflow-y: auto; padding: 15px; max-height: 500px;">
                            <div id="trAIChatMessages" style="display: flex; flex-direction: column; gap: 10px;">
                                <!-- Chat messages will appear here -->
                            </div>
                        </div>
                        <div style="padding: 15px; border-top: 1px solid #dee2e6;">
                            <textarea id="trAIInput" placeholder="Describe what you worked on... e.g. 'I worked on the tower application refactoring on Monday'" style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #dee2e6; border-radius: 6px; resize: vertical;"></textarea>
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
                    
                    <!-- AI Status/Debug Popup -->
                    <div id="trAIStatusPopup" style="background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); width: 380px; max-height: 70vh; display: none; flex-direction: column; position: fixed; bottom: 20px; left: 20px; z-index: 10001;">
                        <div style="background: linear-gradient(135deg, #495057, #343a40); padding: 12px 15px; color: white; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; font-size: 14px;">🔬 AI Status &amp; Debug</h3>
                            <div style="display: flex; gap: 6px;">
                                <button id="trAIStatusClear" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;" title="Clear log">🗑️</button>
                                <button id="trAIStatusClose" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">✕</button>
                            </div>
                        </div>
                        <div id="trAIStatusLog" style="flex: 1; overflow-y: auto; padding: 10px; max-height: 50vh; font-size: 11px; font-family: monospace; background: #fafafa;">
                            <div style="color: #999; font-style: italic;">AI status log — function calls, thinking, and highlights will appear here.</div>
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
    <button id="trNotifyToggle" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;" title="Toggle work notifications (asks what you're working on)">🔕</button>
    <button id="trNotifySettings" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 10px;" title="Notification settings">⚙️</button>
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
    }


};
    }).toString() + ')();';
    document.head.appendChild(el);
}
