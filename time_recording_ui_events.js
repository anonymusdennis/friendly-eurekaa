/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// Time Recording Calendar - UI Events Module
var appcontent = document.querySelector("body");
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
    Object.assign(window.TimeRecordingUI, {
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

    });
    }).toString() + ')();';
    document.head.appendChild(el);
}
