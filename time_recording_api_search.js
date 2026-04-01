// Time Recording Calendar - API Search & Historical Data Module
var appcontent = document.querySelector("body");
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
        Object.assign(window.TimeRecordingAPI, {
    // Search PSP elements across user favorites with advanced filtering
    // Supports: wildcard (*, ?), text search, and child search
    searchPSPElements: function(options) {
        const favorites = this.getUserFavorites();
        if (!favorites || favorites.length === 0) {
            return [];
        }

        const query = (options.query || '').trim();
        const pspId = (options.pspId || '').trim();
        const projectId = (options.projectId || '').trim();
        const partner = (options.partner || '').trim();
        const description = (options.description || '').trim();
        const parentPsp = (options.parentPsp || '').trim();
        const childSearch = !!options.childSearch;

        // Convert wildcard pattern to RegExp (supports * and ?)
        function wildcardToRegex(pattern) {
            if (!pattern) return null;
            const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
            const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
            try {
                return new RegExp('^' + regexStr + '$', 'i');
            } catch (e) {
                return null;
            }
        }

        // Check if a string matches a filter (supports wildcard or substring)
        function matchesFilter(value, filter) {
            if (!filter) return true;
            if (!value) return false;
            // If filter contains wildcard characters, use regex matching
            if (filter.includes('*') || filter.includes('?')) {
                const regex = wildcardToRegex(filter);
                return regex ? regex.test(value) : false;
            }
            // Otherwise, case-insensitive substring match
            return value.toLowerCase().includes(filter.toLowerCase());
        }

        let results = favorites;

        // Child search: find all PSP elements that are children of the given parent
        if (childSearch && parentPsp) {
            const parentLower = parentPsp.toLowerCase();
            results = results.filter(f => {
                const taskId = (f.AccTaskPspId || '').toLowerCase();
                // A child starts with the parent ID followed by a dash and more segments
                return taskId.startsWith(parentLower + '-') ||
                       taskId === parentLower;
            });
            // If no other filters, return child results directly
            if (!query && !pspId && !projectId && !partner && !description) {
                return results.map(f => ({
                    pspId: f.AccTaskPspId,
                    pspDesc: f.AccTaskPspDesc || f.Name || '',
                    projectId: f.AccProjId,
                    projectDesc: f.AccProjDesc || '',
                    partner: f.PartnerNo || f.Partner || '',
                    name: f.Name || ''
                }));
            }
        }

        // Global text search (searches across all fields)
        if (query) {
            const isWildcard = query.includes('*') || query.includes('?');
            if (isWildcard) {
                const regex = wildcardToRegex(query);
                if (regex) {
                    results = results.filter(f =>
                        regex.test(f.AccTaskPspId || '') ||
                        regex.test(f.AccTaskPspDesc || '') ||
                        regex.test(f.AccProjId || '') ||
                        regex.test(f.AccProjDesc || '') ||
                        regex.test(f.Name || '') ||
                        regex.test(f.PartnerNo || '') ||
                        regex.test(f.Partner || '')
                    );
                }
            } else {
                const lowerQuery = query.toLowerCase();
                results = results.filter(f =>
                    (f.AccTaskPspId || '').toLowerCase().includes(lowerQuery) ||
                    (f.AccTaskPspDesc || '').toLowerCase().includes(lowerQuery) ||
                    (f.AccProjId || '').toLowerCase().includes(lowerQuery) ||
                    (f.AccProjDesc || '').toLowerCase().includes(lowerQuery) ||
                    (f.Name || '').toLowerCase().includes(lowerQuery) ||
                    (f.PartnerNo || '').toLowerCase().includes(lowerQuery) ||
                    (f.Partner || '').toLowerCase().includes(lowerQuery)
                );
            }
        }

        // Field-specific filters with wildcard support
        if (pspId) {
            results = results.filter(f => matchesFilter(f.AccTaskPspId, pspId));
        }
        if (projectId) {
            results = results.filter(f => matchesFilter(f.AccProjId, projectId));
        }
        if (partner) {
            results = results.filter(f =>
                matchesFilter(f.PartnerNo, partner) ||
                matchesFilter(f.Partner, partner) ||
                matchesFilter(f.Name, partner)
            );
        }
        if (description) {
            results = results.filter(f =>
                matchesFilter(f.AccTaskPspDesc, description) ||
                matchesFilter(f.AccProjDesc, description)
            );
        }

        // Map to clean output format
        return results.map(f => ({
            pspId: f.AccTaskPspId,
            pspDesc: f.AccTaskPspDesc || f.Name || '',
            projectId: f.AccProjId,
            projectDesc: f.AccProjDesc || '',
            partner: f.PartnerNo || f.Partner || '',
            name: f.Name || ''
        }));
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
    // Reuses fetchMonthRecords (the same per-day approach the calendar uses)
    fetchHistoricalRecords: async function(months) {
        const now = new Date();
        
        TimeRecordingUtils.log('info', `Loading ${months} months of historical records using monthly fetch...`);
        
        try {
            const allRecords = [];
            
            // Walk backwards month by month, waiting for each to finish
            for (let i = 0; i < months; i++) {
                const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const year = targetDate.getFullYear();
                const month = targetDate.getMonth();
                const label = `${month + 1}/${year}`;
                
                try {
                    TimeRecordingUtils.log('info', `  Fetching month ${i + 1}/${months}: ${label}...`);
                    const monthRecords = await this.fetchMonthRecords(year, month);
                    
                    // Flatten the {dateKey: [records]} map into a flat array
                    let monthCount = 0;
                    for (const dayRecords of Object.values(monthRecords)) {
                        if (dayRecords && dayRecords.length > 0) {
                            allRecords.push(...dayRecords);
                            monthCount += dayRecords.length;
                        }
                    }
                    TimeRecordingUtils.log('info', `  Month ${label}: ${monthCount} records`);
                } catch (monthError) {
                    TimeRecordingUtils.log('warning', `  Month ${label} failed: ${monthError.message}`);
                }
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
});    }).toString() + ')();';
    document.head.appendChild(el);
}
