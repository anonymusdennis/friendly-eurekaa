/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// Time Recording Calendar - UI Selection Module
var appcontent = document.querySelector("body");
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
    Object.assign(window.TimeRecordingUI, {
    // Excel-like selection methods
    startSelection: function (e, dayData) {
        if (e.shiftKey) { // Shift-click for range selection
            this.selectRange(dayData);
        } else if (e.ctrlKey || e.metaKey) { // Ctrl/Cmd-click for toggle selection
            this.toggleDaySelection(dayData);
        } else { // Start new selection
            if (! e.target.classList.contains('tr-entry-blob')) {
                this.clearSelection();
                this.selectionStart = dayData.dateKey;
                this.isSelecting = true;
                this.selectDay(dayData);
            }
        }
    },

    continueSelection: function (e, dayData) {
        if (this.isSelecting && this.selectionStart) { // Clear previous selection
            document.querySelectorAll('.tr-day-selecting').forEach(el => {
                el.classList.remove('tr-day-selecting');
            });

            // Select range from start to current
            this.selectRangeBetween(this.selectionStart, dayData.dateKey);
        }
    },

    endSelection: function (e, dayData) {
        if (this.isSelecting) {
            this.isSelecting = false;
            // Convert selecting to selected
            document.querySelectorAll('.tr-day-selecting').forEach(el => {
                el.classList.remove('tr-day-selecting');
                el.classList.add('tr-day-selected');
                const date = el.dataset.date;
                if (date) 
                    this.selectedDays.add(date);
                


            });
            this.updateSelectedDaysCount();
        }
    },

    selectDay: function (dayData) {
        const element = document.querySelector(`.tr-calendar-day[data-date="${
            dayData.dateKey
        }"]`);
        if (element && ! element.classList.contains('tr-day-weekend')) {
            element.classList.add('tr-day-selected');
            this.selectedDays.add(dayData.dateKey);
        }
    },

    toggleDaySelection: function (dayData) {
        const element = document.querySelector(`.tr-calendar-day[data-date="${
            dayData.dateKey
        }"]`);
        if (element && ! element.classList.contains('tr-day-weekend')) {
            if (this.selectedDays.has(dayData.dateKey)) {
                element.classList.remove('tr-day-selected');
                this.selectedDays.delete(dayData.dateKey);
            } else {
                element.classList.add('tr-day-selected');
                this.selectedDays.add(dayData.dateKey);
            }
            this.updateSelectedDaysCount();
        }
    },

    selectRangeBetween: function (startDate, endDate) {
        const allDays = document.querySelectorAll('.tr-calendar-day:not(.tr-day-weekend)');
        let inRange = false;

        allDays.forEach(day => {
            const date = day.dataset.date;
            if (date === startDate || date === endDate) {
                inRange = ! inRange;
                day.classList.add('tr-day-selecting');
                if (date === startDate && date === endDate) 
                    inRange = false;
                


            } else if (inRange) {
                day.classList.add('tr-day-selecting');
            }
        });
    },

    clearSelection: function () {
        document.querySelectorAll('.tr-day-selected, .tr-day-selecting').forEach(el => {
            el.classList.remove('tr-day-selected', 'tr-day-selecting');
        });
        this.selectedDays.clear();
        this.updateSelectedDaysCount();
    },

    updateSelectedDaysCount: function () {
        document.getElementById('trSelectedCount').textContent = this.selectedDays.size;
    },

    // Show day details panel
    showDayDetailsPanel: function (dayData) {
        const panel = document.getElementById('trDayDetailsPanel');
        const content = document.getElementById('trDayDetailsContent');

        panel.style.display = 'flex';

        let html = `
            <h4 style="margin: 0 0 15px 0;">${
            TimeRecordingUtils.formatDisplayDate(dayData.date)
        }</h4>
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <span>Total Hours: <strong>${
            dayData.totalHours
        }h</strong></span>
                <span>Status: <strong style="color: ${
            dayData.color
        }">${
            dayData.status
        }</strong></span>
            </div>
        `;

        if (dayData.records && dayData.records.length > 0) {
            html += '<h5 style="margin: 15px 0 10px 0;">Time Entries:</h5>';
            dayData.records.forEach((record, index) => {
                html += `
                    <div class="tr-day-detail-entry" data-index="${index}">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <strong>${
                    record.Duration
                }h</strong>
                            <span style="font-size: 11px; color: #666;">${
                    record.Counter
                }</span>
                        </div>
                        <div style="font-size: 12px; margin-bottom: 5px;">${
                    record.Content || 'No description'
                }</div>
                        <div style="font-size: 11px; color: #666;">
                            ${
                    record.AccProjDesc || ''
                }<br>
                            ${
                    record.AccTaskPspDesc || ''
                }
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<p style="text-align: center; color: #666; margin: 30px 0;">No time entries for this day</p>';
        } content.innerHTML = html;

        // Show actions if it's a workday
        const actions = document.getElementById('trDayDetailsActions');
        if (dayData.isWorkDay && ! dayData.isHoliday && ! dayData.isFuture) {
            actions.style.display = 'block';

            document.getElementById('trEditDay').onclick = () => {
                if (dayData.records && dayData.records.length > 0) {
                    TimeRecordingEdit.showEditDialog(dayData.dateKey, dayData.records[0].Counter);
                } else {
                    alert('No records to edit for this day.');
                }
            };

            document.getElementById('trAddToSelection').onclick = () => {
                this.selectDay(dayData);
                this.updateSelectedDaysCount();
            };
        } else {
            actions.style.display = 'none';
        }
    },

    // Show record details
    showRecordDetails: function (dayData, recordIndex) {
        const record = dayData.records[recordIndex];
        if (! record) 
            return;
        


        this.showDayDetailsPanel(dayData);

        // Highlight the specific record
        setTimeout(() => {
            const entries = document.querySelectorAll('.tr-day-detail-entry');
            if (entries[recordIndex]) {
                entries[recordIndex].scrollIntoView({behavior: 'smooth', block: 'center'});
                entries[recordIndex].classList.add('tr-day-detail-entry-selected');
            }
        }, 100);
    },

    // Helper methods for selection
    selectMissingDays: function () {
        this.clearSelection();
        const monthData = TimeRecordingCalendar.monthData;
        if (monthData && monthData.days) {
            monthData.days.forEach(day => {
                if (day.isWorkDay && !day.isHoliday && !day.isFuture && day.totalHours === 0) {
                    this.selectDay(day);
                }
            });
        }
        this.updateSelectedDaysCount();
    },

    selectWeekdays: function () {
        this.clearSelection();
        const monthData = TimeRecordingCalendar.monthData;
        if (monthData && monthData.days) {
            monthData.days.forEach(day => {
                if (day.isWorkDay && !day.isHoliday && !day.isFuture && day.isCurrentMonth) {
                    this.selectDay(day);
                }
            });
        }
        this.updateSelectedDaysCount();
    }

    });
    }).toString() + ')();';
    document.head.appendChild(el);
}
