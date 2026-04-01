// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (
        () => { // Time Recording Calendar - Calendar Core Module (UPDATED)

            window.TimeRecordingCalendar = {
                currentMonth: new Date().getMonth(),
                currentYear: new Date().getFullYear(),
                monthData: {},

                // Initialize calendar
                init: async function () {
                    this.currentMonth = new Date().getMonth();
                    this.currentYear = new Date().getFullYear();

                    await this.loadCurrentMonth();
                    return true;
                },

                // Load data for current month
                loadCurrentMonth: async function () {
                    const year = this.currentYear;
                    const month = this.currentMonth;

                    TimeRecordingUtils.log('info', `Loading calendar for ${
                        month + 1
                    }/${year}`);

                    // Fetch time records
                    const records = await TimeRecordingAPI.fetchMonthRecords(year, month);

                    // Build month data
                    this.monthData = this.buildMonthData(year, month, records);

                    // Update UI
                    if (window.TimeRecordingUI) {
                        window.TimeRecordingUI.renderCalendar(this.monthData);
                    }

                    return this.monthData;
                },

                // Build month data structure (UPDATED to include all days)
                // Get localStorage key for custom required hours
                getRequiredHoursKey: function (year, month) {
                    return 'required_hours_' + year + '_' + month;
                },

                // Get custom required hours for a month (or null if not set)
                getCustomRequiredHours: function (year, month) {
                    return TimeRecordingUtils.storage.load(this.getRequiredHoursKey(year, month), null);
                },

                // Save custom required hours for a month
                saveCustomRequiredHours: function (year, month, hours) {
                    TimeRecordingUtils.storage.save(this.getRequiredHoursKey(year, month), hours);
                },

                // Clear custom required hours for a month (revert to auto-calculated)
                clearCustomRequiredHours: function (year, month) {
                    TimeRecordingUtils.storage.remove(this.getRequiredHoursKey(year, month));
                },

                buildMonthData: function (year, month, records) {
                    const data = {
                        year: year,
                        month: month,
                        monthName: TimeRecordingUtils.formatMonth(new Date(year, month, 1)),
                        days: [],
                        totalHours: 0,
                        requiredHours: 0,
                        weekendHours: 0,
                        overtimeHours: 0,
                        completionRate: 0
                    };

                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);

                    // Start from the beginning of the week
                    const startDate = new Date(firstDay);
                    const firstDayOfWeek = startDate.getDay() || 7; // Convert Sunday (0) to 7
                    startDate.setDate(startDate.getDate() - firstDayOfWeek + 1);
                    // Start from Monday

                    // End at the end of the week
                    const endDate = new Date(lastDay);
                    const lastDayOfWeek = endDate.getDay() || 7;
                    if (lastDayOfWeek < 7) {
                        endDate.setDate(endDate.getDate() + (7 - lastDayOfWeek));
                    }

                    // Build day data for ALL days (including weekends)
                    const current = new Date(startDate);
                    while (current <= endDate) {
                        const dayData = this.buildDayData(current, records);
                        data.days.push(dayData);

                        // Count totals for current month only
                        if (current.getMonth() === month) {
                            if (dayData.isWeekend) {
                                // Track weekend hours as overtime
                                data.weekendHours += dayData.totalHours;
                            } else if (dayData.isWorkDay && ! dayData.isHoliday && ! dayData.isFuture) {
                                data.requiredHours += TimeRecordingConfig.calendar.dailyQuota;
                                data.totalHours += dayData.totalHours;
                            }
                        }

                        current.setDate(current.getDate() + 1);
                    }

                    // Apply custom required hours if set
                    const customHours = this.getCustomRequiredHours(year, month);
                    if (customHours !== null) {
                        data.requiredHours = customHours;
                    }

                    // Calculate overtime: weekend hours + any weekday hours beyond required
                    const weekdayOvertime = Math.max(0, data.totalHours - data.requiredHours);
                    data.overtimeHours = data.weekendHours + weekdayOvertime;

                    // Calculate completion rate (weekday hours vs required)
                    if (data.requiredHours > 0) {
                        data.completionRate = Math.round((data.totalHours / data.requiredHours) * 100);
                    }

                    return data;
                },

                // Build data for a single day (UPDATED)
                buildDayData: function (date, records) {
                    const dateKey = TimeRecordingUtils.formatDate(date);
                    const dayRecords = records[dateKey] || [];

                    const dayData = {
                        date: new Date(date),
                        dateKey: dateKey,
                        displayDate: date.getDate(),
                        dayName: date.toLocaleDateString('en-US', {weekday: 'short'}),
                        isCurrentMonth: date.getMonth() === this.currentMonth,
                        isWeekend: TimeRecordingUtils.isWeekend(date),
                        isToday: TimeRecordingUtils.isToday(date),
                        isFuture: TimeRecordingUtils.isFuture(date),
                        isHoliday: TimeRecordingAPI.isHoliday(date),
                        holidayInfo: TimeRecordingAPI.getHolidayInfo(date),
                        isWorkDay: false,
                        records: dayRecords,
                        totalHours: 0,
                        status: 'none',
                        color: ''
                    };

                    // Determine if it's a work day (excluding weekends)
                    dayData.isWorkDay = ! dayData.isWeekend && dayData.isCurrentMonth;

                    // Calculate total hours
                    dayData.totalHours = TimeRecordingUtils.calculateTotalHours(dayRecords);

                    // Determine status and color
                    if (! dayData.isCurrentMonth) {
                        dayData.status = 'other-month';
                        dayData.color = TimeRecordingConfig.ui.colors.weekend;
                    } else if (dayData.isWeekend) {
                        dayData.status = 'weekend';
                        dayData.color = TimeRecordingConfig.ui.colors.weekend;
                    } else if (dayData.isHoliday) {
                        dayData.status = 'holiday';
                        dayData.color = TimeRecordingConfig.ui.colors.holiday;
                    } else if (dayData.isFuture) {
                        dayData.status = 'future';
                        dayData.color = TimeRecordingConfig.ui.colors.future;
                    } else if (dayData.totalHours >= TimeRecordingConfig.calendar.dailyQuota) {
                        dayData.status = 'complete';
                        dayData.color = TimeRecordingConfig.ui.colors.complete;
                    } else if (dayData.totalHours > 0) {
                        dayData.status = 'partial';
                        dayData.color = TimeRecordingConfig.ui.colors.partial;
                    } else {
                        dayData.status = 'missing';
                        dayData.color = TimeRecordingConfig.ui.colors.missing;
                    }

                    return dayData;
                },

                // Navigate to previous month
                previousMonth: async function () {
                    this.currentMonth --;
                    if (this.currentMonth < 0) {
                        this.currentMonth = 11;
                        this.currentYear --;
                    }
                    await this.loadCurrentMonth();
                },

                // Navigate to next month
                nextMonth: async function () {
                    this.currentMonth ++;
                    if (this.currentMonth > 11) {
                        this.currentMonth = 0;
                        this.currentYear ++;
                    }
                    await this.loadCurrentMonth();
                },

                // Navigate to today
                goToToday: async function () {
                    const today = new Date();
                    this.currentMonth = today.getMonth();
                    this.currentYear = today.getFullYear();
                    await this.loadCurrentMonth();
                },

                // Refresh current month
                refresh: async function () {
                    TimeRecordingUtils.log('info', 'Refreshing calendar data...');
                    await this.loadCurrentMonth();
                },

                // Get current month data
                getCurrentMonthData: function () {
                    return this.monthData;
                },
                // based on the week number ( when 0 = current week , 1 = next week , -1 = last week )
                // return all recorded times of that week as an json array
                // use the calenders data and if not loaded then load more.
                getTimes(relativeWeek = 0, dateRange = null, surroundingWeeks = false) { // Helper: normalize a date input (string YYYYMMDD or Date)
                    const parseDate = (d) => {
                        if (d instanceof Date) 
                            return new Date(d);
                         // clone Date object
                        if (typeof d === "string") {
                            return new Date(d.slice(0, 4), // year
                                d.slice(4, 6) - 1, // month (0-based)
                                d.slice(6, 8) // day
                            );
                        }
                        throw new Error("Invalid date type; expected 'YYYYMMDD' string or Date");
                    };

                    // ------------------------------------------
                    // DATE RANGE MODE
                    // ------------------------------------------
                    if (Array.isArray(dateRange) && dateRange.length > 0) { // Parse first date
                        const start = parseDate(dateRange[0]);

                        // Parse second date, or use same if only one provided
                        const end = dateRange.length > 1 ? parseDate(dateRange[1]) : new Date(start);

                        // Expand by 1 week before & after if requested
                        if (surroundingWeeks) {
                            start.setDate(start.getDate() - 7);
                            end.setDate(end.getDate() + 7);
                        }

                        const records = this.monthData.days.filter(record => {
                            const d = new Date(record.date);
                            return d >= start && d <= end;
                        });

                        return JSON.stringify(records);
                    }

                    // ------------------------------------------
                    // RELATIVE WEEK MODE (default)
                    // ------------------------------------------
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + relativeWeek * 7);

                    const targetWeek = TimeRecordingUtils.getWeekNumber(targetDate);
                    const targetYear = targetDate.getFullYear();

                    const records = this.monthData.days.filter(record => {
                        const d = new Date(record.date);
                        return(TimeRecordingUtils.getWeekNumber(d) === targetWeek && d.getFullYear() === targetYear);
                    });

                    return JSON.stringify(records);
                }


            };
        }
    ).toString() + ')();';
    document.head.appendChild(el);
}
