// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
// Time Recording Calendar - Notification System Module
// Periodically asks the user what they're working on via desktop notifications.
// If they answer, the AI checks if the work is already recorded and extends or creates entries.
window.TimeRecordingNotify = {
    // State
    active: false,
    mainTimer: null,         // The main interval timer (every N minutes)
    reaskTimer: null,        // The re-ask timer (every M minutes after no answer)
    reaskCount: 0,           // How many re-asks have been sent this cycle
    pendingPrompt: false,    // Whether we're waiting for user response
    lastPromptTime: null,    // When the last prompt was shown
    lastActivity: null,      // Last recorded activity description
    permissionGranted: false,

    // Get config with defaults
    getConfig: function () {
        const cfg = TimeRecordingConfig.notifications || {};
        return {
            intervalMinutes: cfg.intervalMinutes || 30,
            reaskDelayMinutes: cfg.reaskDelayMinutes || 5,
            maxReasks: cfg.maxReasks || 5,
            enabled: cfg.enabled !== false,
            sound: cfg.sound || false
        };
    },

    // Initialize the notification system
    init: function () {
        this.loadState();
        this.requestPermission();
        TimeRecordingUtils.log('info', '[Notify] Notification system initialized');
    },

    // Request desktop notification permission
    requestPermission: function () {
        if (!('Notification' in window)) {
            TimeRecordingUtils.log('warning', '[Notify] Desktop notifications not supported');
            return;
        }
        if (Notification.permission === 'granted') {
            this.permissionGranted = true;
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                this.permissionGranted = (permission === 'granted');
                if (!this.permissionGranted) {
                    TimeRecordingUtils.log('warning', '[Notify] Notification permission denied');
                }
            });
        }
    },

    // Start the notification cycle
    start: function () {
        if (this.active) return;
        this.active = true;
        this.saveState();

        const cfg = this.getConfig();
        TimeRecordingUtils.log('info', `[Notify] Started — asking every ${cfg.intervalMinutes} min, re-ask after ${cfg.reaskDelayMinutes} min (max ${cfg.maxReasks} times)`);

        if (window.TimeRecordingAI) {
            TimeRecordingAI.logStatus('info', `🔔 Notifications ON — every ${cfg.intervalMinutes} min`);
        }

        // Start the main interval
        this.scheduleMainPrompt();
    },

    // Stop the notification cycle
    stop: function () {
        this.active = false;
        this.clearTimers();
        this.pendingPrompt = false;
        this.reaskCount = 0;
        this.saveState();
        TimeRecordingUtils.log('info', '[Notify] Stopped');

        if (window.TimeRecordingAI) {
            TimeRecordingAI.logStatus('info', '🔕 Notifications OFF');
        }
    },

    // Toggle on/off
    toggle: function () {
        if (this.active) {
            this.stop();
        } else {
            this.start();
        }
        return this.active;
    },

    // Clear all timers
    clearTimers: function () {
        if (this.mainTimer) {
            clearTimeout(this.mainTimer);
            this.mainTimer = null;
        }
        if (this.reaskTimer) {
            clearTimeout(this.reaskTimer);
            this.reaskTimer = null;
        }
    },

    // Schedule the next main prompt (every intervalMinutes)
    scheduleMainPrompt: function () {
        if (!this.active) return;
        this.clearTimers();
        const cfg = this.getConfig();
        const ms = cfg.intervalMinutes * 60 * 1000;

        this.mainTimer = setTimeout(() => {
            this.promptUser();
        }, ms);
    },

    // Schedule a re-ask (after reaskDelayMinutes)
    scheduleReask: function () {
        if (!this.active) return;
        const cfg = this.getConfig();

        if (this.reaskCount >= cfg.maxReasks) {
            // Give up for this cycle, wait for next main interval
            TimeRecordingUtils.log('info', `[Notify] Max re-asks (${cfg.maxReasks}) reached, waiting for next cycle`);
            if (window.TimeRecordingAI) {
                TimeRecordingAI.logStatus('info', `🔕 No answer after ${cfg.maxReasks} re-asks — waiting for next cycle`);
            }
            this.pendingPrompt = false;
            this.reaskCount = 0;
            this.scheduleMainPrompt();
            return;
        }

        const ms = cfg.reaskDelayMinutes * 60 * 1000;
        this.reaskTimer = setTimeout(() => {
            if (this.pendingPrompt) {
                this.reaskCount++;
                this.promptUser();
            }
        }, ms);
    },

    // Show the prompt to the user (desktop notification + in-app)
    promptUser: function () {
        if (!this.active) return;

        this.pendingPrompt = true;
        this.lastPromptTime = Date.now();

        const cfg = this.getConfig();
        const isReask = this.reaskCount > 0;
        const remaining = cfg.maxReasks - this.reaskCount;

        // Show desktop notification
        this.showDesktopNotification(isReask, remaining);

        // Show in-app notification
        this.showInAppPrompt(isReask, remaining);

        // Schedule re-ask in case user doesn't respond
        this.scheduleReask();
    },

    // Show a desktop notification
    showDesktopNotification: function (isReask, remaining) {
        if (!this.permissionGranted || !('Notification' in window)) {
            // Fallback: no desktop notification permission
            return;
        }

        const title = isReask
            ? `⏰ Reminder: What are you working on? (${remaining} left)`
            : '📋 What are you working on?';
        const body = isReask
            ? 'You haven\'t responded yet. Click to open the time recorder.'
            : 'Time to log your current activity. Click to open the time recorder.';

        try {
            const notification = new Notification(title, {
                body: body,
                icon: '📅',
                tag: 'time-recording-prompt', // Replace previous notification
                requireInteraction: true       // Stay until user interacts
            });

            notification.onclick = () => {
                window.focus();
                // Open the AI chat panel if not already open
                if (!TimeRecordingUI.aiChatOpen) {
                    document.getElementById('trToggleAI')?.click();
                }
                // Focus the input
                const input = document.getElementById('trAIInput');
                if (input) input.focus();
                notification.close();
            };
        } catch (e) {
            TimeRecordingUtils.log('warning', '[Notify] Failed to show desktop notification: ' + e.message);
        }
    },

    // Show an in-app prompt in the AI chat
    showInAppPrompt: function (isReask, remaining) {
        if (!window.TimeRecordingAI) return;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        let msg;
        if (isReask) {
            msg = `⏰ **Reminder** (${timeStr}) — What are you currently working on?\n\n_You haven't responded yet. ${remaining} reminder(s) left before I stop asking._\n\nType your answer below, or ignore to be asked again later.`;
        } else {
            msg = `🔔 **Time check** (${timeStr}) — What are you currently working on?\n\nDescribe your current task briefly (e.g. "Tower app refactoring" or "Meeting with team").\nI'll check if it's already recorded and update your timesheet accordingly.`;
        }

        TimeRecordingAI.addMessage('model', msg);

        // Open AI panel if not open
        if (!TimeRecordingUI.aiChatOpen) {
            const panel = document.getElementById('trAIPanel');
            if (panel) {
                panel.style.display = 'flex';
                TimeRecordingUI.aiChatOpen = true;
            }
        }

        // Scroll to bottom
        const chatContainer = document.getElementById('trAIChatContainer');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        TimeRecordingAI.logStatus('info', `🔔 Prompt shown (${isReask ? 'reminder #' + this.reaskCount : 'new cycle'})`);
    },

    // Called when the user sends a message in the AI chat
    // Returns true if the notification system handled it, false otherwise
    handleUserResponse: function (message) {
        if (!this.pendingPrompt || !this.active) return false;

        // User responded — reset re-ask state
        this.pendingPrompt = false;
        this.reaskCount = 0;
        if (this.reaskTimer) {
            clearTimeout(this.reaskTimer);
            this.reaskTimer = null;
        }

        this.lastActivity = message;
        this.saveState();

        // Process the response through AI to check/record
        this.processActivityResponse(message);

        // Schedule next main prompt
        this.scheduleMainPrompt();

        return true; // Notification system handled this message
    },

    // Process the user's activity response through the AI
    processActivityResponse: async function (activity) {
        if (!window.TimeRecordingAI || !TimeRecordingAI.apiKey) {
            TimeRecordingAI.addMessage('model', '✅ Noted: "' + activity + '". (Set up AI API key to auto-record entries.)');
            return;
        }

        // Build a special prompt for the AI that asks it to check existing records
        // and either extend an existing entry or create a new one
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        const prompt = `NOTIFICATION SYSTEM AUTO-CHECK:
The user was prompted at ${timeStr} about what they're working on. They answered:
"${activity}"

Today's date: ${todayStr}

Please do the following:
1. Call getRecordsForDate for today (${todayStr}) to see what's already recorded.
2. Check if the user's described activity matches any existing record (same project/description).
3. If a matching record exists AND its hours could be extended (total for day still ≤ 8h), suggest updating it with updateExistingRecord to extend the duration.
4. If no matching record exists, ask the user which project this belongs to using askUser, then create a new entry.
5. If today already has 8h recorded, just confirm that the day is already fully recorded.

Be concise in your response. This is an automated check — keep it brief and actionable.`;

        await TimeRecordingAI.sendMessage(prompt);
    },

    // --- Persistence ---
    saveState: function () {
        TimeRecordingUtils.storage.save('notify_state', {
            active: this.active,
            lastActivity: this.lastActivity,
            lastPromptTime: this.lastPromptTime
        });
    },

    loadState: function () {
        const state = TimeRecordingUtils.storage.load('notify_state', null);
        if (state) {
            this.lastActivity = state.lastActivity || null;
            this.lastPromptTime = state.lastPromptTime || null;
            // Restore active state — will be started by main if was active
            if (state.active) {
                this.active = false; // Will be started properly by start()
                this._wasActive = true;
            }
        }
    },

    // --- Settings Dialog ---
    showSettingsDialog: function () {
        const existing = document.getElementById('trNotifySettingsDialog');
        if (existing) existing.remove();

        const cfg = this.getConfig();

        const dialog = document.createElement('div');
        dialog.id = 'trNotifySettingsDialog';
        dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);z-index:10002;width:420px;display:flex;flex-direction:column;';

        dialog.innerHTML = `
            <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:15px;color:white;border-radius:12px 12px 0 0;">
                <h3 style="margin:0;">🔔 Notification Settings</h3>
                <p style="margin:5px 0 0;opacity:0.9;font-size:13px;">Configure how often you're asked about your work</p>
            </div>
            <div style="padding:20px;display:flex;flex-direction:column;gap:16px;">
                <div>
                    <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">Ask interval (minutes)</label>
                    <input id="trNotifyInterval" type="number" min="1" max="480" value="${cfg.intervalMinutes}" style="width:100%;padding:8px;border:1px solid #dee2e6;border-radius:4px;">
                    <div style="font-size:11px;color:#666;margin-top:2px;">How often to ask what you're working on</div>
                </div>
                <div>
                    <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">Re-ask delay (minutes)</label>
                    <input id="trNotifyReaskDelay" type="number" min="1" max="60" value="${cfg.reaskDelayMinutes}" style="width:100%;padding:8px;border:1px solid #dee2e6;border-radius:4px;">
                    <div style="font-size:11px;color:#666;margin-top:2px;">Wait time before re-asking if no answer</div>
                </div>
                <div>
                    <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">Max re-asks per cycle</label>
                    <input id="trNotifyMaxReasks" type="number" min="1" max="20" value="${cfg.maxReasks}" style="width:100%;padding:8px;border:1px solid #dee2e6;border-radius:4px;">
                    <div style="font-size:11px;color:#666;margin-top:2px;">How many times to re-ask before giving up until next cycle</div>
                </div>
                <div style="background:#f8f9fa;padding:12px;border-radius:6px;font-size:12px;color:#495057;">
                    <strong>Current status:</strong> ${this.active ? '🟢 Active' : '🔴 Inactive'}<br>
                    ${this.lastActivity ? '<strong>Last activity:</strong> ' + this.lastActivity : ''}
                    ${this.lastPromptTime ? '<br><strong>Last prompt:</strong> ' + new Date(this.lastPromptTime).toLocaleTimeString('de-DE') : ''}
                </div>
            </div>
            <div style="padding:15px;border-top:1px solid #dee2e6;display:flex;gap:10px;justify-content:flex-end;">
                <button id="trNotifySettingsSave" style="padding:8px 16px;background:#28a745;color:white;border:none;border-radius:6px;cursor:pointer;">Save</button>
                <button id="trNotifySettingsClose" style="padding:8px 16px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;">Cancel</button>
            </div>
        `;

        document.body.appendChild(dialog);

        document.getElementById('trNotifySettingsSave').onclick = () => {
            const interval = parseInt(document.getElementById('trNotifyInterval').value) || 30;
            const reask = parseInt(document.getElementById('trNotifyReaskDelay').value) || 5;
            const maxReasks = parseInt(document.getElementById('trNotifyMaxReasks').value) || 5;

            // Update config
            TimeRecordingConfig.notifications = TimeRecordingConfig.notifications || {};
            TimeRecordingConfig.notifications.intervalMinutes = Math.max(1, interval);
            TimeRecordingConfig.notifications.reaskDelayMinutes = Math.max(1, reask);
            TimeRecordingConfig.notifications.maxReasks = Math.max(1, maxReasks);

            // Persist settings
            TimeRecordingUtils.storage.save('notify_settings', {
                intervalMinutes: TimeRecordingConfig.notifications.intervalMinutes,
                reaskDelayMinutes: TimeRecordingConfig.notifications.reaskDelayMinutes,
                maxReasks: TimeRecordingConfig.notifications.maxReasks
            });

            // Restart cycle if active to apply new interval
            if (this.active) {
                this.stop();
                this.start();
            }

            if (window.TimeRecordingAI) {
                TimeRecordingAI.logStatus('info', `⚙️ Notification settings updated: ${interval}min / ${reask}min reask / ${maxReasks} max`);
            }

            dialog.remove();
        };

        document.getElementById('trNotifySettingsClose').onclick = () => dialog.remove();
    },

    // Load persisted settings into config
    loadSettings: function () {
        const saved = TimeRecordingUtils.storage.load('notify_settings', null);
        if (saved) {
            TimeRecordingConfig.notifications = TimeRecordingConfig.notifications || {};
            if (saved.intervalMinutes) TimeRecordingConfig.notifications.intervalMinutes = saved.intervalMinutes;
            if (saved.reaskDelayMinutes) TimeRecordingConfig.notifications.reaskDelayMinutes = saved.reaskDelayMinutes;
            if (saved.maxReasks) TimeRecordingConfig.notifications.maxReasks = saved.maxReasks;
        }
    }
};
    }).toString() + ')();';
    document.head.appendChild(el);
}
