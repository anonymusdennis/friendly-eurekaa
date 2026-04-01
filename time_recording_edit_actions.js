// Time Recording Calendar - Edit Actions Module
var appcontent = document.querySelector("body");
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
Object.assign(window.TimeRecordingEdit, {
    // Perform PSP search with wildcard, text, and child search support
    performPSPSearch: function() {
        const globalQuery = document.getElementById('trSearchGlobal').value;
        const partnerId = document.getElementById('trSearchPartner').value;
        const projectId = document.getElementById('trSearchProjectId').value;
        const projectDesc = document.getElementById('trSearchProjectDesc').value;
        const pspId = document.getElementById('trSearchPSPId').value;
        const pspDesc = document.getElementById('trSearchPSPDesc').value;
        const childMode = document.getElementById('trSearchChildMode').checked;
        const parentPsp = document.getElementById('trSearchParentPsp').value;
        
        // Validate input
        const hasFilter = globalQuery || partnerId || projectId || projectDesc || pspId || pspDesc || (childMode && parentPsp);
        if (!hasFilter) {
            alert('Please enter at least one search criteria');
            return;
        }
        
        const resultsDiv = document.getElementById('trPSPSearchResults');
        const statusDiv = document.getElementById('trPSPSearchStatus');
        resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px;">🔄 Searching...</div>';
        statusDiv.innerHTML = '';
        
        try {
            // Use the API's searchPSPElements function
            const results = TimeRecordingAPI.searchPSPElements({
                query: globalQuery,
                pspId: pspId,
                projectId: projectId,
                partner: partnerId,
                description: pspDesc || projectDesc,
                parentPsp: parentPsp,
                childSearch: childMode
            });
            
            // Display results
            if (results.length === 0) {
                resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No results found. Try using wildcards: <code>*keyword*</code></div>';
                statusDiv.innerHTML = '';
            } else {
                const escapeHtml = (str) => (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                statusDiv.innerHTML = `Found <strong>${results.length}</strong> PSP element${results.length !== 1 ? 's' : ''}` +
                    (childMode && parentPsp ? ` (children of <code>${escapeHtml(parentPsp)}</code>)` : '');
                
                let html = '<div style="margin-top: 8px;">';
                results.forEach((result, index) => {
                    const rPspId = escapeHtml(result.pspId);
                    const rPspDesc = escapeHtml(result.pspDesc);
                    const rProjId = escapeHtml(result.projectId);
                    const rProjDesc = escapeHtml(result.projectDesc);
                    const rPartner = escapeHtml(result.partner || result.name);
                    
                    // Determine nesting level from PSP ID dashes for visual hierarchy
                    const dashes = (result.pspId || '').split('-').length - 1;
                    const indent = childMode ? Math.min(dashes, 4) * 12 : 0;
                    
                    html += `
                        <div data-psp-index="${index}" style="padding: 10px 10px 10px ${10 + indent}px; border: 1px solid #dee2e6; border-radius: 6px; margin-bottom: 6px; cursor: pointer; transition: all 0.15s; background: white;"
                            onmouseover="this.style.background='#e8f0fe'; this.style.borderColor='#007bff'" 
                            onmouseout="this.style.background='white'; this.style.borderColor='#dee2e6'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <div style="font-weight: bold; font-size: 13px; color: #0056b3;">${rPspId}</div>
                                    <div style="font-size: 12px; margin-top: 2px;">${rPspDesc}</div>
                                </div>
                                <div style="text-align: right; flex-shrink: 0; margin-left: 10px;">
                                    <div style="font-size: 11px; color: #28a745; font-weight: bold;">${rProjId}</div>
                                    <div style="font-size: 10px; color: #888;">${rProjDesc}</div>
                                </div>
                            </div>
                            ${rPartner ? '<div style="font-size: 10px; color: #999; margin-top: 4px;">👤 ' + rPartner + '</div>' : ''}
                        </div>
                    `;
                });
                html += '</div>';
                resultsDiv.innerHTML = html;
                
                // Attach click handlers
                resultsDiv.querySelectorAll('div[data-psp-index]').forEach(el => {
                    const idx = parseInt(el.dataset.pspIndex);
                    const r = results[idx];
                    el.addEventListener('click', () => {
                        window.TimeRecordingEdit.selectPSP(r.projectId, r.projectDesc, r.pspId, r.pspDesc);
                    });
                });
            }
            
        } catch (error) {
            resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">Search failed: ' + error.message + '</div>';
        }
    },
    
    // Clear PSP search
    clearPSPSearch: function() {
        document.getElementById('trSearchGlobal').value = '';
        document.getElementById('trSearchPartner').value = '';
        document.getElementById('trSearchProjectId').value = '';
        document.getElementById('trSearchProjectDesc').value = '';
        document.getElementById('trSearchPSPId').value = '';
        document.getElementById('trSearchPSPDesc').value = '';
        document.getElementById('trSearchChildMode').checked = false;
        document.getElementById('trSearchParentPsp').value = '';
        document.getElementById('trSearchParentPsp').disabled = true;
        document.getElementById('trPSPSearchResults').innerHTML = '';
        document.getElementById('trPSPSearchStatus').innerHTML = '';
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
        updatedRecord.Mode = 'M';
        
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
                "Mode": record.Mode, // M for modify, D for delete
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
                "StartTime": record.StartTime || "PT00H00M",
                "EndTime": record.EndTime || "PT00H00M",
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
        if (!timeStr || timeStr === 'PT00H00M00S' || timeStr === 'PT00H00M') return '';
        const match = timeStr.match(/PT(\d+)H(\d+)M/);
        if (match) {
            const hours = match[1].padStart(2, '0');
            const minutes = match[2].padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return '';
    },
    
    formatTime: function(timeStr) {
        if (!timeStr) return 'PT00H00M';
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            return `PT${parts[0]}H${parts[1]}M`;
        }
        return 'PT00H00M';
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
});
    }).toString() + ')();';
    document.head.appendChild(el);
}
