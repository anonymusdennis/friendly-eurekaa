// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
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
};    }).toString() + ')();';
    document.head.appendChild(el);
}
