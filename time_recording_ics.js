// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
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
document.head.appendChild(style);    }).toString() + ')();';
    document.head.appendChild(el);
}