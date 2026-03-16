// ==========================================
// MEASUREMENT FUNCTIONALITY
// ==========================================

/**
 * Activates measurement mode and shows UI indicators.
 */
function startMeasurement() {
    closeAllSidebars();
    
    // Collapse controls panel on mobile
    setControlsCollapsed(true);

    isMeasuring = true;
    // Clean up any existing measurement line and marker
    if (measurementLine) {
        map.removeLayer(measurementLine);
        measurementLine = null;
    }
    if (measurementStartMarker) {
        map.removeLayer(measurementStartMarker);
        measurementStartMarker = null;
    }
    measurementStart = null;

    // Disable all controls in the controls panel
    const controlsPanel = document.getElementById('controls');
    controlsPanel.classList.add('controls-disabled');
    
    // Disable all interactive elements within the controls panel
    const interactiveElements = controlsPanel.querySelectorAll('button, input, label');
    interactiveElements.forEach(el => {
        el.style.pointerEvents = 'none';
    });

    // Show measurement mode indicator and overlay
    document.getElementById('measurement-overlay').classList.remove('hidden');
    const measurementModeIndicator = document.getElementById('measurement-mode-indicator');
    measurementModeIndicator.classList.remove('hidden');
    const measurementDisplay = document.getElementById('measurement-display');
    measurementDisplay.textContent = '0.00 km';
    measurementDisplay.classList.remove('hidden');
}

/**
 * Deactivates measurement mode and hides UI indicators.
 */
function stopMeasurement() {
    isMeasuring = false;
    measurementCompleted = false;
    if (measurementLine) {
        map.removeLayer(measurementLine);
        measurementLine = null;
    }
    if (measurementStartMarker) {
        map.removeLayer(measurementStartMarker);
        measurementStartMarker = null;
    }
    if (measurementEndMarker) {
        map.removeLayer(measurementEndMarker);
        measurementEndMarker = null;
    }
    measurementStart = null;

    // Re-enable all controls in the controls panel
    const controlsPanel = document.getElementById('controls');
    controlsPanel.classList.remove('controls-disabled');
    
    // Expand controls panel on mobile
    setControlsCollapsed(false);
    
    // Re-enable all interactive elements within the controls panel
    const interactiveElements = controlsPanel.querySelectorAll('button, input, label');
    interactiveElements.forEach(el => {
        el.style.pointerEvents = 'auto';
    });

    // Hide measurement mode indicator, overlay, and measurement display
    document.getElementById('measurement-overlay').classList.add('hidden');
    document.getElementById('measurement-mode-indicator').classList.add('hidden');
    document.getElementById('measurement-display').classList.add('hidden');
}

/**
 * Calculates distance between two points in kilometers.
 */
function calculateDistance(start, end) {
    const startLatLng = L.latLng(start.lat, start.lng);
    const endLatLng = L.latLng(end.lat, end.lng);
    return startLatLng.distanceTo(endLatLng) / 1000; // Convert meters to kilometers
}
