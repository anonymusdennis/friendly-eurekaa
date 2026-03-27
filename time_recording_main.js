// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
// Time Recording Calendar - Main Application
(async function () {
    'use strict';

    console.log('[TimeRecording] Initializing Time Recording Calendar...');

    // Check dependencies
    const requiredModules = [
        'TimeRecordingConfig',
        'TimeRecordingUtils',
        'TimeRecordingAPI',
        'TimeRecordingCalendar',
        'TimeRecordingUI',
        'TimeRecordingICS',
        'TimeRecordingAI',
        'TimeRecordingEdit',
        'TimeRecordingDrag'
    ];

    for (const module of requiredModules) {
        if (!window[module]) {
            console.error(`[TimeRecording] Missing required module: ${module}`);
            alert(`Time Recording Calendar: Missing module ${module}. Please load all required files.`);
            return;
        }
    }
    TimeRecordingAI.init();//load api key from storage
    // Initialize application
    async function initialize() {
        try { // Create UI first
            TimeRecordingUI.create();
            TimeRecordingDrag.init();
            TimeRecordingUtils.log('info', 'Starting initialization...');

            // Initialize API service
            const apiInitialized = await TimeRecordingAPI.init();
            if (! apiInitialized) {
                throw new Error('Failed to initialize API service');
            }

            // Initialize calendar
            const calendarInitialized = await TimeRecordingCalendar.init();
            if (! calendarInitialized) {
                throw new Error('Failed to initialize calendar');
            }

            TimeRecordingUtils.log('success', 'Time Recording Calendar ready!');

            // Set up auto-refresh if configured
            if (TimeRecordingConfig.ui.autoRefresh > 0) {
                setInterval(() => {
                    if (!TimeRecordingUI.minimized) {
                        TimeRecordingCalendar.refresh();
                    }
                }, TimeRecordingConfig.ui.autoRefresh);
            }

        } catch (error) {
            TimeRecordingUtils.log('error', 'Initialization failed', error);
            alert('Failed to initialize Time Recording Calendar. Check console for details.');
        }
    }

    // Start initialization
    initialize();
})();
    }).toString() + ')();';
    document.head.appendChild(el);
}
