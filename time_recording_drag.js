// Time Recording Calendar - Enhanced AI Assistant Module
var appcontent = document.querySelector("body"); // browser
if (appcontent) {
    var el = document.createElement("script")
    el.innerHTML = '(' + (() => {
// Time Recording Calendar - Drag & Drop Module
window.TimeRecordingDrag = {
    draggedElement: null,
    dragOffset: { x: 0, y: 0 },
    savedLayouts: {},
    
    // Initialize drag and drop
    init: function() {
        // Load saved layouts
        this.loadLayouts();
        
        // Initialize global mouse event handlers for dragging
        this.initGlobalDragEvents();
        
        // Make main panels draggable
        this.makeDraggable(document.getElementById('trMainView'));
        this.makeDraggable(document.getElementById('trAIPanel'));
        this.makeDraggable(document.getElementById('trDayDetailsPanel'));
        
        // Add resize handles
        this.addResizeHandles();
        
        // Enable time entry drag between days
        this.enableTimeEntryDrag();
    },
    
    // Make element draggable
    makeDraggable: function(element) {
        if (!element) return;
        
        // Find or create drag handle
        let handle = element.querySelector('.tr-drag-handle');
        if (!handle) {
            // Use header as drag handle
            handle = element.querySelector('[style*="background: linear-gradient"]');
        }
        
        if (!handle) return;
        
        handle.style.cursor = 'move';
        
        handle.addEventListener('mousedown', (e) => {
            // Don't drag on interactive elements (buttons, dropdowns, inputs)
            const tag = e.target.tagName;
            if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'OPTION' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'LABEL') return;
            
            this.draggedElement = element;
            this.dragOffset.x = e.clientX - element.offsetLeft;
            this.dragOffset.y = e.clientY - element.offsetTop;
            
            // Bring to front
            element.style.zIndex = '10005';
            
            // Add dragging class
            element.classList.add('tr-dragging');
            
            // Prevent text selection
            e.preventDefault();
        });
    },
    
    // Global mouse events for dragging
    initGlobalDragEvents: function() {
        document.addEventListener('mousemove', (e) => {
            if (!this.draggedElement) return;
            
            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;
            
            // Keep within viewport
            const maxX = window.innerWidth - this.draggedElement.offsetWidth;
            const maxY = window.innerHeight - this.draggedElement.offsetHeight;
            
            this.draggedElement.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            this.draggedElement.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
            this.draggedElement.style.transform = 'none'; // Remove centering transform
            this.draggedElement.style.position = 'fixed';
        });
        
        document.addEventListener('mouseup', () => {
            if (this.draggedElement) {
                this.draggedElement.classList.remove('tr-dragging');
                
                // Save position
                this.saveLayout(this.draggedElement.id, {
                    left: this.draggedElement.style.left,
                    top: this.draggedElement.style.top
                });
                
                this.draggedElement = null;
            }
        });
    },
    
    // Enable drag and drop for time entries
    enableTimeEntryDrag: function() {
        // Make entry blobs draggable
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('tr-entry-blob')) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    date: e.target.dataset.date,
                    index: e.target.dataset.index
                }));
                
                // Visual feedback
                e.target.style.opacity = '0.5';
            }
        });
        
        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('tr-entry-blob')) {
                e.target.style.opacity = '1';
            }
        });
        
        // Make calendar days drop zones
        document.addEventListener('dragover', (e) => {
            if (e.target.closest('.tr-calendar-day')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const dayElement = e.target.closest('.tr-calendar-day');
                dayElement.classList.add('tr-drop-hover');
            }
        });
        
        document.addEventListener('dragleave', (e) => {
            if (e.target.closest('.tr-calendar-day')) {
                const dayElement = e.target.closest('.tr-calendar-day');
                dayElement.classList.remove('tr-drop-hover');
            }
        });
        
        document.addEventListener('drop', async (e) => {
            const dayElement = e.target.closest('.tr-calendar-day');
            if (!dayElement) return;
            
            e.preventDefault();
            dayElement.classList.remove('tr-drop-hover');
            
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const targetDate = dayElement.dataset.date;
            
            if (data.date === targetDate) return; // Same day
            
            // Confirm move
            if (confirm(`Move this time entry to ${TimeRecordingUtils.formatDisplayDate(new Date(targetDate.substr(0,4) + '-' + targetDate.substr(4,2) + '-' + targetDate.substr(6,2)))}?`)) {
                await this.moveTimeEntry(data.date, data.index, targetDate);
            }
        });
    },
    
    // Move time entry to different day
    moveTimeEntry: async function(fromDate, entryIndex, toDate) {
        try {
            // Get the original entry
            const records = await TimeRecordingAPI.fetchTimeRecords(new Date(fromDate.substr(0,4) + '-' + fromDate.substr(4,2) + '-' + fromDate.substr(6,2)));
            const entry = records[entryIndex];
            
            if (!entry) {
                alert('Entry not found');
                return;
            }
            
            // Delete from original date
            const deletePayload = {
                ...entry,
                Mode: 'D'
            };
            await TimeRecordingEdit.updateTimeRecord(deletePayload);
            
            // Create on new date
            const createPayload = {
                date: toDate,
                hours: parseFloat(entry.Duration),
                description: entry.Content,
                projectId: entry.AccProjId,
                taskId: entry.AccTaskPspId,
                accountInd: entry.AccountInd
            };
            await TimeRecordingAPI.createTimeRecord(createPayload);
            
            // Refresh calendar
            TimeRecordingCalendar.refresh();
            
            TimeRecordingUtils.log('success', 'Time entry moved successfully');
            
        } catch (error) {
            TimeRecordingUtils.log('error', 'Failed to move time entry:', error);
            alert('Failed to move time entry: ' + error.message);
        }
    },
    
    // Add resize handles to panels
    addResizeHandles: function() {
        const panels = [
            document.getElementById('trMainView'),
            document.getElementById('trAIPanel'),
            document.getElementById('trDayDetailsPanel')
        ];
        
        panels.forEach(panel => {
            if (!panel) return;
            
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'tr-resize-handle';
            resizeHandle.style.cssText = `
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                cursor: se-resize;
                background: linear-gradient(135deg, transparent 50%, #667eea 50%);
            `;
            
            panel.appendChild(resizeHandle);
            
            let isResizing = false;
            let startX, startY, startWidth, startHeight;
            
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(window.getComputedStyle(panel).width, 10);
                startHeight = parseInt(window.getComputedStyle(panel).height, 10);
                
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const width = startWidth + e.clientX - startX;
                const height = startHeight + e.clientY - startY;
                
                panel.style.width = width + 'px';
                panel.style.height = height + 'px';
                panel.style.maxHeight = 'none';
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    this.saveLayout(panel.id, {
                        width: panel.style.width,
                        height: panel.style.height
                    });
                }
            });
        });
    },
    
    // Save layout to localStorage
    saveLayout: function(elementId, layout) {
        if (!elementId) return;
        
        const layouts = TimeRecordingUtils.storage.load('layouts', {});
        layouts[elementId] = {
            ...layouts[elementId],
            ...layout,
            timestamp: Date.now()
        };
        TimeRecordingUtils.storage.save('layouts', layouts);
    },
    
    // Load saved layouts
    loadLayouts: function() {
        const layouts = TimeRecordingUtils.storage.load('layouts', {});
        
        Object.keys(layouts).forEach(elementId => {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const layout = layouts[elementId];
            if (layout.left) element.style.left = layout.left;
            if (layout.top) element.style.top = layout.top;
            if (layout.width) element.style.width = layout.width;
            if (layout.height) element.style.height = layout.height;
            
            // Remove centering transform if position is saved
            if (layout.left || layout.top) {
                element.style.transform = 'none';
                element.style.position = 'fixed';
            }
        });
    },
    
    // Reset all layouts
    resetLayouts: function() {
        TimeRecordingUtils.storage.remove('layouts');
        location.reload();
    }
};    }).toString() + ')();';
    document.head.appendChild(el);
}
