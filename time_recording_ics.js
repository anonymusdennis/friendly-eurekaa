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
};
    }).toString() + ')();';
    document.head.appendChild(el);
}
