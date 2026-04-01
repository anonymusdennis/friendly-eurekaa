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
            width: 780px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
        `;
        
        searchDialog.innerHTML = `
            <div style="background: linear-gradient(135deg, #007bff, #0056b3); padding: 15px; color: white; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">🔍 Search PSP Elements</h3>
                <span style="font-size: 11px; opacity: 0.85;">Supports wildcards: * (any) and ? (single char)</span>
            </div>
            
            <div style="padding: 20px;">
                <!-- Global text search -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; font-weight: bold; margin-bottom: 5px;">🔎 Quick Search (all fields)</label>
                    <input type="text" id="trSearchGlobal" placeholder="Type to search across all fields... (e.g. 'Platform' or '2911.IN.0072*')" style="width: 100%; padding: 10px; border: 2px solid #007bff; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <details style="margin-bottom: 10px;">
                    <summary style="cursor: pointer; font-size: 12px; color: #666; padding: 5px 0;">⚙️ Advanced Filters</summary>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                        <div>
                            <label style="display: block; font-size: 11px; margin-bottom: 3px; color: #555;">Partner Name</label>
                            <input type="text" id="trSearchPartner" placeholder="e.g. Würth IT*" style="width: 100%; padding: 7px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 11px; margin-bottom: 3px; color: #555;">Project ID</label>
                            <input type="text" id="trSearchProjectId" placeholder="e.g. WG2911 or WG*" style="width: 100%; padding: 7px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 11px; margin-bottom: 3px; color: #555;">Project Description</label>
                            <input type="text" id="trSearchProjectDesc" placeholder="e.g. *Consulting*" style="width: 100%; padding: 7px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 11px; margin-bottom: 3px; color: #555;">PSP ID</label>
                            <input type="text" id="trSearchPSPId" placeholder="e.g. 2911.IN.0076-*" style="width: 100%; padding: 7px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                        </div>
                        <div style="grid-column: 1 / -1;">
                            <label style="display: block; font-size: 11px; margin-bottom: 3px; color: #555;">PSP Description</label>
                            <input type="text" id="trSearchPSPDesc" placeholder="e.g. *Rufbereitschaft*" style="width: 100%; padding: 7px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                        </div>
                    </div>
                </details>
                
                <!-- Child search -->
                <div style="margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                        <input type="checkbox" id="trSearchChildMode" style="cursor: pointer;">
                        <strong>👶 Child Search</strong> — Find all sub-elements of a parent PSP
                    </label>
                    <input type="text" id="trSearchParentPsp" placeholder="Parent PSP ID (e.g. 2911.IN.0076 → finds -01, -02, -03...)" style="width: 100%; padding: 7px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; margin-top: 8px; box-sizing: border-box;" disabled>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button onclick="window.TimeRecordingEdit.performPSPSearch()" style="flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🔍 Search</button>
                    <button onclick="window.TimeRecordingEdit.clearPSPSearch()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Clear</button>
                </div>
            </div>
            
            <div id="trPSPSearchStatus" style="padding: 0 20px; font-size: 11px; color: #666;"></div>
            <div id="trPSPSearchResults" style="flex: 1; overflow-y: auto; padding: 0 20px 20px; max-height: 350px;">
                <!-- Results will be displayed here -->
            </div>
            
            <div style="padding: 15px; border-top: 1px solid #dee2e6; text-align: right;">
                <button onclick="document.getElementById('trPSPSearchDialog').remove()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
            </div>
        `;
        
        document.body.appendChild(searchDialog);
        
        // Toggle child search input
        const childCheckbox = document.getElementById('trSearchChildMode');
        const parentInput = document.getElementById('trSearchParentPsp');
        childCheckbox.addEventListener('change', function() {
            parentInput.disabled = !this.checked;
            if (this.checked) parentInput.focus();
        });
        
        // Enter key triggers search
        const searchInputs = searchDialog.querySelectorAll('input[type="text"]');
        searchInputs.forEach(input => {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') window.TimeRecordingEdit.performPSPSearch();
            });
        });
        
        // Focus the global search input
        document.getElementById('trSearchGlobal').focus();
    }
};    }).toString() + ')();';
    document.head.appendChild(el);
}
