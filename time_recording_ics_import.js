// Time Recording Calendar - ICS Import Handlers Module
var appcontent = document.querySelector("body");
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
Object.assign(window.TimeRecordingICS, {
    
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
});

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
