// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
// Time Recording Calendar - Configuration Module
window.TimeRecordingConfig = {
    // SAP Configuration
    sap: {
        baseUrl: 'https://s018.fl.witglobal.net',
        client: '001',
        service: '/sap/opu/odata/www/cats_cyd_srv',
        userPernr: '00224895', // Your personnel number
        language: 'EN'
    },
    
    // Calendar Configuration
    calendar: {
        weeklyQuota: 40, // hours per week
        dailyQuota: 8,   // hours per day (40/5)
        workDays: [1, 2, 3, 4, 5], // Monday to Friday
        monthsToLoad: 3, // Load current month + previous/next
    },
    
    // Holiday API Configuration
    holidays: {
        apiUrl: 'https://feiertage-api.de/api/',
        state: 'BW', // Baden-Württemberg
        year: new Date().getFullYear()
    },
    
    // AI Configuration
    ai: {
        defaultHistoryMonths: 12,     // Default months of history to load
        maxNonBillableHoursPerDay: 0.5, // Admin/non-billable max ~30 min/day
        typicalBillableHoursPerDay: 7.5, // Typical development/billable hours
        maxClipboardLength: 50000,    // Max clipboard text length to process
        maxFileContextLength: 100000, // Max file context length
    },

    // UI Configuration
    ui: {
        colors: {
            complete: '#28a745',      // Green for complete days
            partial: '#ffc107',       // Yellow for partial days
            missing: '#dc3545',       // Red for missing days
            holiday: '#6c757d',       // Gray for holidays
            weekend: '#e9ecef',       // Light gray for weekends
            today: '#007bff',         // Blue for today
            future: '#f8f9fa'         // Very light for future days
        },
        animations: true,
        autoRefresh: 300000 // Refresh every 5 minutes
    }
};    }).toString() + ')();';
    document.head.appendChild(el);
}
