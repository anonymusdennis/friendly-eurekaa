// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
// Time Recording Calendar - Utilities Module
window.TimeRecordingUtils = {
    // Date formatting utilities
    formatDate: function(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    },
    
    formatDisplayDate: function(date) {
        const d = new Date(date);
        return d.toLocaleDateString('de-DE', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    },
    
    formatMonth: function(date) {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    },
    
    // Get all working days in a month
    getWorkingDaysInMonth: function(year, month) {
        const days = [];
        const date = new Date(year, month, 1);
        
        while (date.getMonth() === month) {
            const dayOfWeek = date.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                days.push(new Date(date));
            }
            date.setDate(date.getDate() + 1);
        }
        
        return days;
    },
    
    // Check if date is weekend
    isWeekend: function(date) {
        const day = date.getDay();
        return day === 0 || day === 6;
    },
    
    // Check if date is today
    isToday: function(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    },
    
    // Check if date is in the future
    isFuture: function(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date > today;
    },
    
    // Parse SAP duration format (e.g., "8.00" to 8)
    parseDuration: function(duration) {
        return parseFloat(duration) || 0;
    },
    
    // Calculate total hours from records
    calculateTotalHours: function(records) {
        return records.reduce((total, record) => {
            return total + this.parseDuration(record.Duration);
        }, 0);
    },
    
    // Generate unique ID
    generateId: function() {
        return Math.random().toString(16).substr(2, 8) + '-' +
               Math.random().toString(16).substr(2, 4) + '-' +
               Math.random().toString(16).substr(2, 4);
    },
    
    // Storage utilities
    storage: {
        save: function(key, data) {
            try {
                localStorage.setItem(`time_recording_${key}`, JSON.stringify(data));
                return true;
            } catch (e) {
                console.error('Failed to save to storage:', e);
                return false;
            }
        },
        
        load: function(key, defaultValue = null) {
            try {
                const data = localStorage.getItem(`time_recording_${key}`);
                return data ? JSON.parse(data) : defaultValue;
            } catch (e) {
                console.error('Failed to load from storage:', e);
                return defaultValue;
            }
        },
        
        remove: function(key) {
            try {
                localStorage.removeItem(`time_recording_${key}`);
                return true;
            } catch (e) {
                console.error('Failed to remove from storage:', e);
                return false;
            }
        }
    },
    
    // Logging utility
    log: function(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[TimeRecording] [${timestamp}] [${level.toUpperCase()}]`;
        
        if (data) {
            console[level === 'error' ? 'error' : 'log'](`${prefix} ${message}`, data);
        } else {
            console[level === 'error' ? 'error' : 'log'](`${prefix} ${message}`);
        }
        
        // Also update UI log if available
        if (window.TimeRecordingUI && window.TimeRecordingUI.updateLog) {
            window.TimeRecordingUI.updateLog(level, message);
        }
    },
    getWeekNumber: function(date) {
        const oneJan = new Date(date.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((date - oneJan) / 86400000);
        const result = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
        return result;
    }
};
    }).toString() + ')();';
    document.head.appendChild(el);
}
