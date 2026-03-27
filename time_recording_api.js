// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
// Time Recording Calendar - API Service Module (UPDATED with real SAP API)
window.TimeRecordingAPI = {
    csrfToken: null,
    holidays: {},
    userFavorites: [],
    batchQueue: [],
    batchTimer: null,
    batchPromises: new Map(),
    API_BASE_URL: 'https://s018.fl.witglobal.net/sap/opu/odata/www/cats_cyd_srv',
    SAP_CLIENT: '001',
    
    // Initialize API service
    init: async function() {
        try {
            // Fetch CSRF token
            await this.fetchCSRFToken();
            
            // Load favorites directly since we're on s018
            await this.loadUserFavorites();
            
            // Use fallback holidays
            this.loadFallbackHolidays();
            
            return true;
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to initialize API service', error);
            throw error;
        }
    },
    
    // CSRF Token fetch (using your working implementation)
    fetchCSRFToken: async function() {
        console.log("Fetching CSRF token...");
        try {
            const response = await fetch(`${this.API_BASE_URL}/?sap-client=${this.SAP_CLIENT}`, {
                method: 'HEAD',
                headers: {
                    'X-CSRF-Token': 'Fetch',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch CSRF token. Status: ${response.status}`);
            }

            this.csrfToken = response.headers.get('x-csrf-token');
            if (!this.csrfToken) {
                throw new Error("CSRF token not found in response headers.");
            }
            console.log("✅ CSRF token obtained successfully:", this.csrfToken);
            return this.csrfToken;
        } catch (error) {
            console.error("❌ Error during CSRF token fetch:", error);
            throw error;
        }
    },
    
    // Helper to generate boundary
    generateBoundary: function(prefix) {
        const hex = () => Math.random().toString(16).substr(2, 4);
        return `${prefix}_${hex()}-${hex()}-${hex()}`;
    },
    
    // Parse batch response (your implementation)
    parseBatchResponse: function(rawResponse, contentTypeHeader) {
        const boundaryMatch = contentTypeHeader.match(/boundary=(.+)/);
        if (!boundaryMatch) {
            console.error("Could not find boundary in Content-Type header.");
            return [{ error: "Could not parse batch response: boundary missing." }];
        }
        const boundary = `--${boundaryMatch[1]}`;
        const parts = rawResponse.split(boundary).filter(part => part.trim() !== "" && part.trim() !== "--");
        
        return parts.map(part => {
            const jsonStartIndex = part.indexOf('{');
            if (jsonStartIndex === -1) {
                const changesetBoundaryMatch = part.match(/boundary=(changeset_.+)/);
                if(changesetBoundaryMatch) {
                    const changesetBoundary = `--${changesetBoundaryMatch[1]}`;
                    const changesetParts = part.split(changesetBoundary).filter(csPart => csPart.trim() !== "" && csPart.trim() !== "--");
                    return changesetParts.map(csPart => {
                        const csJsonIndex = csPart.indexOf('{');
                        if (csJsonIndex !== -1) {
                            const csJsonString = csPart.substring(csJsonIndex);
                            try { return JSON.parse(csJsonString); } catch(e) { /* ignore parse error */ }
                        }
                        return null;
                    }).filter(p => p);
                }
                return { error: "No JSON body found in this part." };
            }
            
            const jsonString = part.substring(jsonStartIndex);
            try {
                return JSON.parse(jsonString);
            } catch (e) {
                return { error: "Failed to parse JSON body", content: jsonString };
            }
        });
    },
    
    // Execute batch request (your implementation)
    executeBatchRequest: async function(getRequests = [], postRequest = null) {
        const batchBoundary = this.generateBoundary('batch');
        const CRLF = '\r\n';
        let body = '';

        // Handle GET requests
        getRequests.forEach(req => {
            body += `--${batchBoundary}${CRLF}`;
            body += `Content-Type: application/http${CRLF}`;
            body += `Content-Transfer-Encoding: binary${CRLF}`;
            body += `${CRLF}`;
            body += `GET ${req} HTTP/1.1${CRLF}`;
            body += `sap-cancel-on-close: true${CRLF}`;
            body += `sap-contextid-accept: header${CRLF}`;
            body += `Accept: application/json${CRLF}`;
            body += `Accept-Language: en${CRLF}`;
            body += `DataServiceVersion: 2.0${CRLF}`;
            body += `MaxDataServiceVersion: 2.0${CRLF}`;
            body += `X-Requested-With: XMLHttpRequest${CRLF}`;
            body += `${CRLF}`;
            body += `${CRLF}`;
        });
        
        // Handle POST request (changeset)
        if (postRequest) {
            const changesetBoundary = this.generateBoundary('changeset');
            body += `--${batchBoundary}${CRLF}`;
            body += `Content-Type: multipart/mixed; boundary=${changesetBoundary}${CRLF}${CRLF}`;
            
            body += `--${changesetBoundary}${CRLF}`;
            body += `Content-Type: application/http${CRLF}`;
            body += `Content-Transfer-Encoding: binary${CRLF}${CRLF}`;
            body += `POST ${postRequest.resource}?sap-client=${this.SAP_CLIENT} HTTP/1.1${CRLF}`;
            body += `sap-cancel-on-close: false${CRLF}`;
            body += `sap-contextid-accept: header${CRLF}`;
            body += `Accept: application/json${CRLF}`;
            body += `Accept-Language: en${CRLF}`;
            body += `DataServiceVersion: 2.0${CRLF}`;
            body += `MaxDataServiceVersion: 2.0${CRLF}`;
            body += `X-Requested-With: XMLHttpRequest${CRLF}`;
            body += `x-csrf-token: ${this.csrfToken}${CRLF}`;
            body += `Content-Type: application/json${CRLF}`;
            body += `Content-ID: id-${new Date().getTime()}-1${CRLF}`;
            const payloadString = JSON.stringify(postRequest.payload);
            body += `Content-Length: ${payloadString.length}${CRLF}${CRLF}`;
            body += `${payloadString}${CRLF}`;
            
            body += `--${changesetBoundary}--${CRLF}`;
        }

        if (getRequests.length > 0 || postRequest) {
            body += `--${batchBoundary}--${CRLF}`;
        }

        const response = await fetch(`${this.API_BASE_URL}/$batch?sap-client=${this.SAP_CLIENT}`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/mixed; boundary=${batchBoundary}`,
                'x-csrf-token': this.csrfToken,
            },
            credentials: 'include',
            body: body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server responded with an error:", errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        const rawData = await response.text();
        
        return this.parseBatchResponse(rawData, contentType);
    },
    
    // Load user favorites using the real API
    loadUserFavorites: async function() {
        const config = TimeRecordingConfig.sap;
        
        try {
            console.log("Loading favorites from SAP...");
            
            const requests = [
                `UserFavoritesSet?sap-client=${this.SAP_CLIENT}&$filter=Pernr%20eq%20%27${config.userPernr}%27%20`
            ];
            
            const response = await this.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results) {
                this.userFavorites = response[0].d.results;
                TimeRecordingUtils.log('info', `✅ Loaded ${this.userFavorites.length} favorites from SAP`);
                
                // Log first few favorites
                this.userFavorites.slice(0, 3).forEach((fav, idx) => {
                    TimeRecordingUtils.log('debug', `  ${idx + 1}. ${fav.Name} - ${fav.AccProjDesc}`);
                });
                
                return this.userFavorites;
            } else {
                TimeRecordingUtils.log('warning', 'No user favorites found');
                this.userFavorites = [];
                return [];
            }
            
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to load favorites:', error);
            this.userFavorites = [];
            return [];
        }
    },
    
    // Get user favorites
    getUserFavorites: function() {

        return this.userFavorites || [];
    },
    
    // CREATE TIME RECORD - The main function to record time
    
createTimeRecord: async function(recordData) {
    try {
        // Ensure we have a CSRF token
        if (!this.csrfToken) {
            await this.fetchCSRFToken();
        }
        
        const config = TimeRecordingConfig.sap;
        
        // FIX: Ensure hours is a number and format it properly
        const hours = typeof recordData.hours === 'string' ? parseFloat(recordData.hours) : recordData.hours;
        const formattedHours = hours.toFixed(2);
        
        // Build the payload
        const timeRecordPayload = {
            "Pernr": config.userPernr,
            "NavToTimeRecordS4": [{
                "Pernr": config.userPernr,
                "Mode": "N", // New entry
                "RecordDate": recordData.date, // Format: YYYYMMDD
                "Duration": formattedHours,  // Use the properly formatted hours
                "AccountInd": recordData.accountInd || "10",
                "Content": recordData.description,
                "AccProjId": recordData.projectId,
                "AccTaskPspId": recordData.taskId,
                "AccProjDesc": recordData.projectDesc || "",
                "AccTaskPspDesc": recordData.taskDesc || "",
                "AccountIndDesc": "",
                "AccProjGuid": "",
                "AccTaskGuid": "",
                "AccTaskId": "",
                "AccTaskDesc": "",
                "Counter": "",
                "AccTaskObjType": "",
                "TicketGuid": "",
                "StartTime": "PT00H00M",
                "EndTime": "PT00H00M",
                "ObjectId": "",
                "TicketDescription": "",
                "StandByTypeValue": "",
                "StandByCompValue": "",
                "RemainingWork": "0.00"
            }]
        };
        
        const postRequest = {
            resource: 'TimeRecordHdrSet',
            payload: timeRecordPayload
        };
        
        console.log("Creating time record:", timeRecordPayload);
        
        const response = await this.executeBatchRequest([], postRequest);
        
        if (response && response[0]) {
            TimeRecordingUtils.log('success', `✅ Time record created successfully`);
            return response[0];
        } else {
            throw new Error('Invalid response from server');
        }
        
    } catch (error) {
        TimeRecordingUtils.log('error', 'Failed to create time record:', error);
        throw error;
    }
},
    
    // CREATE MULTIPLE TIME RECORDS - THIS WAS MISSING!
    createMultipleTimeRecords: async function(records) {
        const results = [];
        const errors = [];
        
        TimeRecordingUtils.log('info', `Creating ${records.length} time records...`);
        
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            try {
                // Add delay between requests to avoid overwhelming the server
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                const result = await this.createTimeRecord(record);
                
                if(result.error && !result.content)
                {
                    errors.push({
                    success: false,
                    date: record.date,
                    error: JSON.stringify(result.error), // result
                });
                TimeRecordingUtils.log('error', `Record ${i + 1}/${records.length} failed:` + JSON.stringify(result.error));
                    continue;
                }
                results.push({
                    success: true,
                    date: record.date,
                    data: result
                });
                
                TimeRecordingUtils.log('info', `Record ${i + 1}/${records.length} created successfully`);
            } catch (error) {
                errors.push({
                    success: false,
                    date: record.date,
                    error: error.message
                });
                TimeRecordingUtils.log('error', `Record ${i + 1}/${records.length} failed:`, error);
            }
        }
        
        // Summary
        TimeRecordingUtils.log('info', `Completed: ${results.length} successful, ${errors.length} failed`);
        
        return {
            results,
            errors,
            summary: {
                total: records.length,
                successful: results.length,
                failed: errors.length
            }
        };
    },
    
    // Fetch time records for a specific date
    fetchTimeRecords: async function(date) {
        const config = TimeRecordingConfig.sap;
        const dateStr = TimeRecordingUtils.formatDate(date);
        
        try {
            const requests = [
                `TimeRecordS4Set?sap-client=${this.SAP_CLIENT}&$filter=Pernr%20eq%20%27${config.userPernr}%27%20and%20RecordDate%20eq%20%27${dateStr}%27`
            ];
            
            const response = await this.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results) {
                return response[0].d.results;
            }
            
            return [];
        } catch (error) {
            TimeRecordingUtils.log('error', `Failed to fetch records for ${dateStr}`, error);
            return [];
        }
    },
    
    // Get time records for a date range
    fetchTimeRecordsRange: async function(startDate, endDate) {
        const config = TimeRecordingConfig.sap;
        const startStr = TimeRecordingUtils.formatDate(startDate);
        const endStr = TimeRecordingUtils.formatDate(endDate);
        
        try {
            const requests = [
                `TimeRecordS4Set?sap-client=${this.SAP_CLIENT}&$filter=Pernr%20eq%20%27${config.userPernr}%27%20and%20RecordDate%20ge%20%27${startStr}%27%20and%20RecordDate%20le%20%27${endStr}%27`
            ];
            
            const response = await this.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results) {
                return response[0].d.results;
            }
            
            return [];
        } catch (error) {
            TimeRecordingUtils.log('error', `Failed to fetch records for range ${startStr} to ${endStr}`, error);
            return [];
        }
    },
    
    // Get project details
    getProjectDetails: async function(projectId) {
        try {
            const requests = [
                `ProjectSet?sap-client=${this.SAP_CLIENT}&$filter=ProjectId%20eq%20%27${projectId}%27`
            ];
            
            const response = await this.executeBatchRequest(requests);
            
            if (response && response[0]?.d?.results) {
                return response[0].d.results[0];
            }
            
            return null;
        } catch (error) {
            TimeRecordingUtils.log('error', `Failed to fetch project details for ${projectId}`, error);
            return null;
        }
    },
    
    // Fetch records for entire month (keep existing implementation)
    fetchMonthRecords: async function(year, month) {
        const days = TimeRecordingUtils.getWorkingDaysInMonth(year, month);
        
        TimeRecordingUtils.log('info', `Fetching time records for ${month + 1}/${year} (${days.length} working days)`);
        
        // Ensure we have CSRF token
        if (!this.csrfToken) {
            await this.fetchCSRFToken();
        }
        
        const records = {};
        
        // Fetch all days in smaller batches
        const batchSize = 5;
        for (let i = 0; i < days.length; i += batchSize) {
            const batch = days.slice(i, i + batchSize);
            
            const batchPromises = batch.map(day => {
                const dateKey = TimeRecordingUtils.formatDate(day);
                return this.fetchTimeRecords(day).then(data => {
                    records[dateKey] = data;
                }).catch(error => {
                    TimeRecordingUtils.log('error', `Failed to fetch ${dateKey}`, error);
                    records[dateKey] = [];
                });
            });
            
            await Promise.all(batchPromises);
            
            // Update progress
            const progress = Math.min(100, Math.round(((i + batchSize) / days.length) * 100));
            TimeRecordingUtils.log('info', `Progress: ${progress}%`);
        }
        
        // Calculate summary
        let totalHours = 0;
        let daysWithRecords = 0;
        
        for (const [dateKey, dayRecords] of Object.entries(records)) {
            if (dayRecords.length > 0) {
                daysWithRecords++;
                totalHours += dayRecords.reduce((sum, r) => sum + parseFloat(r.Duration || 0), 0);
            }
        }
        
        TimeRecordingUtils.log('info', `✅ Month summary: ${totalHours.toFixed(2)}h across ${daysWithRecords} days`);
        
        return records;
    },
    
    // Check budget for a task
    checkBudget: async function(accTaskPspId, duration) {
        try {
            const requests = [
                `CheckBudget?sap-client=${this.SAP_CLIENT}&AccTaskPspId=%27${accTaskPspId}%27&Duration=${duration}`
            ];
            
            const response = await this.executeBatchRequest(requests);
            return response[0];
        } catch (error) {
            TimeRecordingUtils.log('error', 'Budget check failed:', error);
            return null;
        }
    },
    
    // Fallback holidays
    loadFallbackHolidays: function() {
        this.holidays = {
            // 2025
            '2025-01-01': { name: 'Neujahr', date: '2025-01-01', isPublic: true },
            '2025-01-06': { name: 'Heilige Drei Könige', date: '2025-01-06', isPublic: true },
            '2025-04-18': { name: 'Karfreitag', date: '2025-04-18', isPublic: true },
            '2025-04-21': { name: 'Ostermontag', date: '2025-04-21', isPublic: true },
            '2025-05-01': { name: 'Tag der Arbeit', date: '2025-05-01', isPublic: true },
            '2025-05-29': { name: 'Christi Himmelfahrt', date: '2025-05-29', isPublic: true },
            '2025-06-09': { name: 'Pfingstmontag', date: '2025-06-09', isPublic: true },
            '2025-06-19': { name: 'Fronleichnam', date: '2025-06-19', isPublic: true },
            '2025-10-03': { name: 'Tag der Deutschen Einheit', date: '2025-10-03', isPublic: true },
            '2025-11-01': { name: 'Allerheiligen', date: '2025-11-01', isPublic: true },
            '2025-12-25': { name: '1. Weihnachtstag', date: '2025-12-25', isPublic: true },
            '2025-12-26': { name: '2. Weihnachtstag', date: '2025-12-26', isPublic: true }
        };
        
        TimeRecordingUtils.log('info', `Loaded ${Object.keys(this.holidays).length} fallback holidays`);
    },
    
    // Check if date is holiday
    isHoliday: function(date) {
        const dateStr = date.toISOString().split('T')[0];
        return !!this.holidays[dateStr];
    },
    
    // Get holiday info
    getHolidayInfo: function(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.holidays[dateStr] || null;
    },

    // Fetch historical records for N months (for AI context)
    fetchHistoricalRecords: async function(months) {
        const config = TimeRecordingConfig.sap;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        
        const startStr = TimeRecordingUtils.formatDate(startDate);
        const endStr = TimeRecordingUtils.formatDate(endDate);
        
        TimeRecordingUtils.log('info', `Loading ${months} months of historical records (${startStr} to ${endStr})...`);
        
        try {
            // Fetch in monthly batches to avoid overwhelming the server
            const allRecords = [];
            const current = new Date(startDate);
            
            while (current < endDate) {
                const batchEnd = new Date(current);
                batchEnd.setMonth(batchEnd.getMonth() + 1);
                if (batchEnd > endDate) batchEnd.setTime(endDate.getTime());
                
                const batchStartStr = TimeRecordingUtils.formatDate(current);
                const batchEndStr = TimeRecordingUtils.formatDate(batchEnd);
                
                const requests = [
                    `TimeRecordS4Set?sap-client=${this.SAP_CLIENT}&$filter=Pernr%20eq%20%27${config.userPernr}%27%20and%20RecordDate%20ge%20%27${batchStartStr}%27%20and%20RecordDate%20le%20%27${batchEndStr}%27`
                ];
                
                const response = await this.executeBatchRequest(requests);
                
                if (response && response[0]?.d?.results) {
                    allRecords.push(...response[0].d.results);
                }
                
                current.setMonth(current.getMonth() + 1);
                
                // Small delay between batches
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            TimeRecordingUtils.log('info', `✅ Loaded ${allRecords.length} historical records over ${months} months`);
            return allRecords;
            
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to fetch historical records:', error);
            return [];
        }
    },

    // Summarize historical records for AI context (reduce token usage)
    summarizeHistoricalRecords: function(records) {
        if (!records || records.length === 0) return null;
        
        const projectHours = {};
        const monthlyBreakdown = {};
        const descriptions = {};
        
        records.forEach(record => {
            const hours = parseFloat(record.Duration) || 0;
            const projKey = `${record.AccProjId || 'unknown'}|${record.AccTaskPspId || ''}`;
            const month = record.RecordDate ? record.RecordDate.substring(0, 6) : 'unknown';
            const desc = record.Content || '';
            
            // Aggregate hours per project
            if (!projectHours[projKey]) {
                projectHours[projKey] = { 
                    totalHours: 0, 
                    count: 0, 
                    projectId: record.AccProjId,
                    taskId: record.AccTaskPspId,
                    projectDesc: record.AccProjDesc || '',
                    taskDesc: record.AccTaskPspDesc || '',
                    accountInd: record.AccountInd || '10'
                };
            }
            projectHours[projKey].totalHours += hours;
            projectHours[projKey].count += 1;
            
            // Monthly breakdown
            if (!monthlyBreakdown[month]) {
                monthlyBreakdown[month] = { totalHours: 0, entries: 0 };
            }
            monthlyBreakdown[month].totalHours += hours;
            monthlyBreakdown[month].entries += 1;
            
            // Collect unique description patterns per project
            if (desc && desc.length > 3) {
                if (!descriptions[projKey]) descriptions[projKey] = new Set();
                if (descriptions[projKey].size < 5) {
                    descriptions[projKey].add(desc.substring(0, 100));
                }
            }
        });
        
        // Sort projects by total hours
        const topProjects = Object.entries(projectHours)
            .sort((a, b) => b[1].totalHours - a[1].totalHours)
            .slice(0, 20)
            .map(([key, data]) => ({
                ...data,
                avgHoursPerEntry: (data.totalHours / data.count).toFixed(2),
                sampleDescriptions: descriptions[key] ? Array.from(descriptions[key]) : []
            }));
        
        return {
            totalRecords: records.length,
            periodStart: records.reduce((min, r) => r.RecordDate < min ? r.RecordDate : min, records[0].RecordDate),
            periodEnd: records.reduce((max, r) => r.RecordDate > max ? r.RecordDate : max, records[0].RecordDate),
            topProjects: topProjects,
            monthlyBreakdown: monthlyBreakdown,
            totalHours: Object.values(projectHours).reduce((sum, p) => sum + p.totalHours, 0).toFixed(1)
        };
    }
};    }).toString() + ')();';
    document.head.appendChild(el);
}
