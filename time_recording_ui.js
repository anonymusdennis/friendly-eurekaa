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
                                <div id="trRequiredHoursBtn" style="cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s;" title="Click to edit required hours">Required: <strong id="trRequiredHours">0</strong>h</div>
                                <div>Recorded: <strong id="trRecordedHours">0</strong>h</div>
                                <div id="trOvertimeDisplay" style="display: none;">Overtime: <strong id="trOvertimeHours" style="color: #007bff;">0</strong>h</div>
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
        


        if (dayData.isWeekend) {
            div.classList.add('tr-day-weekend');
            // If there are records on a weekend, make it more visible
            if (dayData.totalHours > 0) {
                div.style.opacity = '1';
                div.style.background = '#e3f2fd';
            }
        }


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
        } else if (dayData.isWeekend && dayData.totalHours > 0) {
            // Show weekend hours as overtime
            content += `<div class="tr-calendar-day-hours" style="color: #007bff;" title="Weekend overtime">⏰ ${
                dayData.totalHours
            }h</div>`;

            // Add entry blobs for weekend records
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
                    }"
                                     style="background: #007bff;"></div>`;
                });
            }
            content += `</div>`;
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

            document.getElementById('trEditDay').onclick = () => {
                if (dayData.records && dayData.records.length > 0) {
                    TimeRecordingEdit.showEditDialog(dayData.dateKey, dayData.records[0].Counter);
                } else {
                    alert('No records to edit for this day.');
                }
            };

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

        // Required hours editor popup
        document.getElementById('trRequiredHoursBtn').onclick = (e) => {
            this.showRequiredHoursPopup(e);
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
                        const msg = input.value;
                        input.value = '';
                        // Notification system takes precedence when a prompt is
                        // pending — it processes the response via AI to check/record
                        // existing entries, then resumes the normal notification cycle.
                        if (window.TimeRecordingNotify && TimeRecordingNotify.handleUserResponse(msg)) {
                            return;
                        }
                        TimeRecordingAI.sendMessage(msg);
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

        // Load History button
        if (document.getElementById('trAILoadHistory')) {
            document.getElementById('trAILoadHistory').onclick = () => {
                if (window.TimeRecordingAI) {
                    const defaultMonths = TimeRecordingConfig.ai?.defaultHistoryMonths || 12;
                    const months = prompt(`How many months of historical records should I load?\n(More months = better context but slower loading)`, defaultMonths);
                    if (months && !isNaN(parseInt(months))) {
                        TimeRecordingAI.loadHistoricalRecords(parseInt(months));
                    }
                }
            };
        }

        // Upload File button
        if (document.getElementById('trAIUploadFile')) {
            document.getElementById('trAIUploadFile').onclick = () => {
                document.getElementById('trAIFileInput')?.click();
            };
        }

        // Manage Context button
        if (document.getElementById('trAIManageCtx')) {
            document.getElementById('trAIManageCtx').onclick = () => {
                if (window.TimeRecordingAI) {
                    TimeRecordingAI.showManageContextDialog();
                }
            };
        }

        // File input change handler
        if (document.getElementById('trAIFileInput')) {
            document.getElementById('trAIFileInput').onchange = (e) => {
                const file = e.target.files[0];
                if (file && window.TimeRecordingAI) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        TimeRecordingAI.processFileUpload(evt.target.result, file.name);
                    };
                    reader.onerror = () => {
                        TimeRecordingAI.addMessage('model', '❌ Failed to read file. Please try again.');
                    };
                    reader.readAsText(file);
                }
                // Reset so the same file can be uploaded again
                e.target.value = '';
            };
        }

        // Paste Clipboard button
        if (document.getElementById('trAIPasteClipboard')) {
            document.getElementById('trAIPasteClipboard').onclick = async () => {
                if (window.TimeRecordingAI) {
                    try {
                        const clipboardText = await navigator.clipboard.readText();
                        if (clipboardText && clipboardText.trim()) {
                            TimeRecordingAI.processClipboardContent(clipboardText);
                        } else {
                            TimeRecordingAI.addMessage('model', '📋 Clipboard is empty. Copy some text first and try again.');
                        }
                    } catch (err) {
                        // Fallback: prompt user to paste manually
                        const manualPaste = prompt('Could not access clipboard directly. Please paste your clipboard content here:');
                        if (manualPaste && manualPaste.trim()) {
                            TimeRecordingAI.processClipboardContent(manualPaste);
                        }
                    }
                }
            };
        }

        // Model dropdown
        if (document.getElementById('trAIModelSelect')) {
            document.getElementById('trAIModelSelect').onchange = (e) => {
                if (window.TimeRecordingAI && e.target.value) {
                    TimeRecordingAI.switchModel(e.target.value);
                    TimeRecordingAI.saveSelectedModel();
                }
            };
        }

        // API Key button
        if (document.getElementById('trAIApiKey')) {
            document.getElementById('trAIApiKey').onclick = () => {
                if (window.TimeRecordingAI) {
                    TimeRecordingAI.promptForApiKey();
                }
            };
        }

        // AI Status popup toggle
        if (document.getElementById('trAIStatusBtn')) {
            document.getElementById('trAIStatusBtn').onclick = () => {
                const popup = document.getElementById('trAIStatusPopup');
                if (popup) {
                    popup.style.display = popup.style.display === 'flex' ? 'none' : 'flex';
                }
            };
        }
        if (document.getElementById('trAIStatusClose')) {
            document.getElementById('trAIStatusClose').onclick = () => {
                const popup = document.getElementById('trAIStatusPopup');
                if (popup) popup.style.display = 'none';
            };
        }
        if (document.getElementById('trAIStatusClear')) {
            document.getElementById('trAIStatusClear').onclick = () => {
                const log = document.getElementById('trAIStatusLog');
                if (log) log.innerHTML = '<div style="color: #999; font-style: italic;">Log cleared.</div>';
                if (window.TimeRecordingAI) TimeRecordingAI.statusLog = [];
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

        // Notification system handlers
        if (document.getElementById('trNotifyToggle')) {
            document.getElementById('trNotifyToggle').onclick = () => {
                if (window.TimeRecordingNotify) {
                    const isActive = TimeRecordingNotify.toggle();
                    const btn = document.getElementById('trNotifyToggle');
                    btn.textContent = isActive ? '🔔' : '🔕';
                    btn.title = isActive
                        ? 'Notifications active — click to stop'
                        : 'Toggle work notifications (asks what you\'re working on)';
                }
            };
        }
        if (document.getElementById('trNotifySettings')) {
            document.getElementById('trNotifySettings').onclick = () => {
                if (window.TimeRecordingNotify) {
                    TimeRecordingNotify.showSettingsDialog();
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
                        errors.push(`Entry ${index + 1}: missing date`);
                    else if (!/^\d{8}$/.test(entry.date))
                        errors.push(`Entry ${index + 1}: invalid date format (expected YYYYMMDD)`);

                    if (!entry.projectId) 
                        errors.push(`Entry ${index + 1}: missing projectId`);

                    if (!entry.taskId) 
                        errors.push(`Entry ${index + 1}: missing taskId`);

                    if (!entry.hours) 
                        errors.push(`Entry ${index + 1}: missing hours`);
                    else if (isNaN(parseFloat(entry.hours)) || parseFloat(entry.hours) <= 0 || parseFloat(entry.hours) > 24)
                        errors.push(`Entry ${index + 1}: hours must be greater than 0 and at most 24`);

                    if (!entry.description) 
                        errors.push(`Entry ${index + 1}: missing description`);
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

        // Show overtime if any weekend hours or excess weekday hours
        const overtimeDisplay = document.getElementById('trOvertimeDisplay');
        const overtimeHours = document.getElementById('trOvertimeHours');
        if (overtimeDisplay && overtimeHours) {
            if (monthData.overtimeHours > 0) {
                overtimeDisplay.style.display = '';
                overtimeHours.textContent = monthData.overtimeHours.toFixed(2);
            } else {
                overtimeDisplay.style.display = 'none';
            }
        }

        // Indicate if custom required hours are set
        const requiredBtn = document.getElementById('trRequiredHoursBtn');
        if (requiredBtn) {
            const customHours = TimeRecordingCalendar.getCustomRequiredHours(monthData.year, monthData.month);
            requiredBtn.title = customHours !== null
                ? 'Custom required hours set — click to edit'
                : 'Click to edit required hours';
            requiredBtn.style.background = customHours !== null ? '#e3f2fd' : '';
        }

        const rateElement = document.getElementById('trCompletionRate');
        if (monthData.completionRate >= 100) {
            rateElement.style.color = TimeRecordingConfig.ui.colors.complete;
        } else if (monthData.completionRate >= 80) {
            rateElement.style.color = TimeRecordingConfig.ui.colors.partial;
        } else {
            rateElement.style.color = TimeRecordingConfig.ui.colors.missing;
        }

        TimeRecordingUtils.log('info', 'Calendar rendered successfully');

        // Re-apply AI calendar overlays (highlights + persistent notes)
        if (window.TimeRecordingAI) {
            setTimeout(() => TimeRecordingAI.reapplyCalendarOverlays(), 50);
        }
    },

    // Show popup to edit required hours for the current month
    showRequiredHoursPopup: function (event) {
        // Remove existing popup if any
        const existing = document.getElementById('trRequiredHoursPopup');
        if (existing) {
            existing.remove();
            return;
        }

        const monthData = TimeRecordingCalendar.monthData;
        const year = monthData.year;
        const month = monthData.month;
        const currentRequired = monthData.requiredHours;
        const customHours = TimeRecordingCalendar.getCustomRequiredHours(year, month);
        const dailyQuota = TimeRecordingConfig.calendar.dailyQuota;

        const popup = document.createElement('div');
        popup.id = 'trRequiredHoursPopup';
        popup.style.cssText = 'position: fixed; z-index: 100001; background: white; border: 1px solid #dee2e6; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 16px; min-width: 260px;';

        // Position near the button
        const btnRect = event.currentTarget.getBoundingClientRect();
        popup.style.top = (btnRect.bottom + 8) + 'px';
        popup.style.left = btnRect.left + 'px';

        popup.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 12px; font-size: 14px;">
                Edit Required Hours
                <span style="font-size: 11px; color: #6c757d; display: block;">
                    ${monthData.monthName}${customHours !== null ? ' (custom)' : ''}
                </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <button id="trReqMinus8" style="padding: 6px 12px; border: 1px solid #dee2e6; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px;">-${dailyQuota}h</button>
                <input id="trReqHoursInput" type="number" value="${currentRequired}" min="0" max="744" step="1"
                    style="width: 70px; padding: 6px 8px; border: 1px solid #dee2e6; border-radius: 4px; text-align: center; font-size: 16px; font-weight: 600;" /><!-- max 744 = 31 days × 24h -->
                <span style="font-size: 14px;">h</span>
                <button id="trReqPlus8" style="padding: 6px 12px; border: 1px solid #dee2e6; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px;">+${dailyQuota}h</button>
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="trReqSave" style="flex: 1; padding: 6px 12px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer; font-size: 13px;">Save</button>
                <button id="trReqReset" style="flex: 1; padding: 6px 12px; border: 1px solid #dee2e6; background: white; border-radius: 4px; cursor: pointer; font-size: 13px;"${customHours === null ? ' disabled title="Already using auto-calculated hours"' : ''}>Reset to Auto</button>
            </div>
            <div style="font-size: 11px; color: #6c757d; margin-top: 8px;">
                Adjust for holidays, part-time, etc.
            </div>
        `;

        document.body.appendChild(popup);

        // Ensure popup stays within viewport
        const popupRect = popup.getBoundingClientRect();
        if (popupRect.right > window.innerWidth) {
            popup.style.left = (window.innerWidth - popupRect.width - 8) + 'px';
        }
        if (popupRect.bottom > window.innerHeight) {
            popup.style.top = (btnRect.top - popupRect.height - 8) + 'px';
        }

        const input = document.getElementById('trReqHoursInput');

        document.getElementById('trReqMinus8').onclick = () => {
            const val = parseFloat(input.value) || 0;
            input.value = Math.max(0, val - dailyQuota);
        };

        document.getElementById('trReqPlus8').onclick = () => {
            const val = parseFloat(input.value) || 0;
            input.value = val + dailyQuota;
        };

        document.getElementById('trReqSave').onclick = () => {
            const val = parseFloat(input.value);
            if (isNaN(val) || val < 0) {
                input.style.borderColor = '#dc3545';
                return;
            }
            TimeRecordingCalendar.saveCustomRequiredHours(year, month, val);
            popup.remove();
            TimeRecordingCalendar.loadCurrentMonth();
        };

        document.getElementById('trReqReset').onclick = () => {
            TimeRecordingCalendar.clearCustomRequiredHours(year, month);
            popup.remove();
            TimeRecordingCalendar.loadCurrentMonth();
        };

        // Close popup when clicking outside
        const closeHandler = (e) => {
            if (!popup.contains(e.target) && !event.currentTarget.contains(e.target)) {
                popup.remove();
                document.removeEventListener('mousedown', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
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
                    accountInd: entry?.accountInd || entry?.AccountInd || '10', // Default to billable
                    jiraTicketId: entry.jiraTicketId || '',
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
    }).toString() + ')();';
    document.head.appendChild(el);
}
