// ==========================================
// HELP SIDEBAR
// ==========================================

/**
 * Closes the help sidebar and removes cross marker.
 */
function closeHelpSidebar() {
    const helpSidebar = document.getElementById('help-sidebar');
    closeSidebar(helpSidebar);
    // Remove cross marker when closing help sidebar
    removeCrossMarker();
}

/**
 * Opens the help sidebar (closes other sidebars first).
 */
function openHelpSidebar() {
    closeAllSidebars();
    const helpSidebar = document.getElementById('help-sidebar');
    openSidebar(helpSidebar);
}

/**
 * Toggles the help sidebar visibility.
 */
function toggleHelpSidebar() {
    const sidebar = document.getElementById('help-sidebar');
    if (sidebar.classList.contains('translate-x-full')) {
        openHelpSidebar();
    } else {
        closeHelpSidebar();
    }
}

const helpSidebarToggle = document.getElementById('help-sidebar-toggle');
helpSidebarToggle.addEventListener('click', toggleHelpSidebar);

document.getElementById('help-close-btn').addEventListener('click', closeHelpSidebar);

// ==========================================
// CONTROLS TOGGLE (MOBILE)
// ==========================================

/**
 * Sets the controls panel collapsed state and updates the toggle icon.
 * Used for programmatic control of the panel (e.g., when entering/exiting modes).
 * @param {boolean} collapsed - Whether to collapse the controls panel
 */
function setControlsCollapsed(collapsed) {
    const controls = document.getElementById('controls');
    const toggleBtn = document.getElementById('controls-toggle');
    const toggleIcon = toggleBtn ? toggleBtn.querySelector('svg') : null;
    
    if (collapsed) {
        controls.classList.add('controls-collapsed');
        if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'chevron-up');
    } else {
        controls.classList.remove('controls-collapsed');
        if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'chevron-down');
    }
    
    if (toggleIcon) lucide.createIcons({ nodes: [toggleBtn] });
}

// Controls toggle button - collapse/expand controls panel on mobile
document.getElementById('controls-toggle').addEventListener('click', function() {
    const controls = document.getElementById('controls');
    const toggleIcon = this.querySelector('svg');
    
    controls.classList.toggle('controls-collapsed');
    
    if (controls.classList.contains('controls-collapsed')) {
        toggleIcon.setAttribute('data-lucide', 'chevron-up');
    } else {
        toggleIcon.setAttribute('data-lucide', 'chevron-down');
    }
    
    lucide.createIcons({ nodes: [this] });
});

// ==========================================
// TOOLBAR CONTROLS
// ==========================================

// Measurement toggle button - one-way entry into measurement mode
const measurementToggle = document.getElementById('measurement-toggle');
measurementToggle.addEventListener('click', function() {
    if (!isMeasuring) {
        startMeasurement();
    }
});

// Stop measurement button in the indicator
document.getElementById('stop-measurement-btn').addEventListener('click', function() {
    if (isMeasuring) {
        stopMeasurement();
    }
});

// Measurement color picker
document.getElementById('measurement-color-picker').addEventListener('input', function() {
    measurementLineColor = this.value;
});

// Grayscale toggle
const grayscaleToggle = document.getElementById('grayscale-toggle');
grayscaleToggle.addEventListener('change', function() {
    isGrayscale = this.checked;
    const mapElement = document.getElementById('map');
    
    if (isGrayscale) {
        mapElement.classList.add('map-grayscale');
    } else {
        mapElement.classList.remove('map-grayscale');
    }
});

// Standalone hexagons toggle
const standaloneToggle = document.getElementById('standalone-hexagons-toggle');
const standaloneSettings = document.getElementById('standalone-hexagon-settings');

standaloneToggle.addEventListener('change', function() {
    standaloneHexagonsEnabled = this.checked;
    
    // Show/hide settings container based on toggle state
    if (this.checked) {
        standaloneSettings.classList.remove('hidden');
    } else {
        standaloneSettings.classList.add('hidden');
    }
});
