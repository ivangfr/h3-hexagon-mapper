// ==========================================
// MAP EVENT HANDLERS
// ==========================================

// Map click handler
map.on('click', function(e) {
    // Check if context menu is open - if so, just close it and don't create hexagon
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu.classList.contains('hidden')) {
        hideContextMenu();
        return;
    }
    
    // Handle delivery area mode clicks
    if (deliveryAreaMode) {
        handleDeliveryAreaClick(e);
        return;
    }
    
    // If cross marker is on the map, remove it and close sidebars
    if (contextMenuState.crossMarker) {
        removeCrossMarker();
        closeAllSidebars();
        return;
    }
    
    if (isMeasuring) {
        const { lat, lng } = e.latlng;
        
        if (measurementCompleted) {
            // Third click (or later) - clear previous measurement and start fresh
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
            measurementCompleted = false;
            
            // Set new start point
            measurementStart = { lat, lng };
            
            // Add a small filled circle marker at the start point
            measurementStartMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#ffffff',
                fillColor: '#000000',
                fillOpacity: 1,
                weight: 2,
                interactive: false
            }).addTo(map);
            
            // Reset the display
            const measurementDisplay = document.getElementById('measurement-display');
            measurementDisplay.textContent = '0.00 km';
        } else if (!measurementStart) {
            // First click - set measurement start point and add marker
            measurementStart = { lat, lng };
            
            // Add a small filled circle marker at the start point
            measurementStartMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#ffffff',
                fillColor: '#000000',
                fillOpacity: 1,
                weight: 2,
                interactive: false
            }).addTo(map);
        } else {
            // Second click - complete measurement, keep line visible
            measurementCompleted = true;
            
            // Finalize the line to the clicked point
            const endPoint = { lat, lng };
            const distance = calculateDistance(measurementStart, endPoint);
            
            // Remove existing temporary line
            if (measurementLine) {
                map.removeLayer(measurementLine);
            }
            
            // Create final measurement line (keep dashed)
            measurementLine = L.polyline([measurementStart, endPoint], {
                color: measurementLineColor,
                weight: 5,
                opacity: 0.8,
                dashArray: '5, 10',
                interactive: false
            }).addTo(map);
            
            // Add a small filled circle marker at the end point
            measurementEndMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#ffffff',
                fillColor: '#000000',
                fillOpacity: 1,
                weight: 2,
                interactive: false
            }).addTo(map);
            
            // Update measurement display with final distance
            const measurementDisplay = document.getElementById('measurement-display');
            measurementDisplay.textContent = `${distance.toFixed(2)} km`;
        }
        return;
    }
    
    // Only add standalone hexagons if enabled
    if (!standaloneHexagonsEnabled) {
        return;
    }
    
    const { lat, lng } = e.latlng;
    generateH3Grid(lat, lng, resolution, color, opacity, map);
});

const resolutionSlider = document.getElementById('resolution');
const resolutionValue = document.getElementById('resolution-value');
resolutionSlider.addEventListener('input', function() {
    resolution = parseInt(this.value);
    resolutionValue.textContent = resolution;
});

const colorPicker = document.getElementById('color-picker');
colorPicker.addEventListener('input', function() {
    color = this.value;
});

const opacitySlider = document.getElementById('opacity');
const opacityValue = document.getElementById('opacity-value');
opacitySlider.addEventListener('input', function() {
    opacity = parseFloat(this.value);
    opacityValue.textContent = opacity;
});

// Mousemove - cursor coordinates & measurement line
const cursorCoordinates = document.getElementById('cursor-coordinates');
const measurementDisplay = document.getElementById('measurement-display');
map.on('mousemove', function(e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);

    if (deliveryAreaMode) {
        // Handle delivery area drawing
        handleDeliveryAreaMouseMove(e);
    } else if (isMeasuring && measurementStart && !measurementCompleted) {
        // Update measurement line and show distance (only when not completed)
        const currentPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
        const distance = calculateDistance(measurementStart, currentPoint);

        // Remove existing line if it exists
        if (measurementLine) {
            map.removeLayer(measurementLine);
        }

        // Create new measurement line with selected color
        measurementLine = L.polyline([measurementStart, currentPoint], {
            color: measurementLineColor,
            weight: 5,
            opacity: 0.8,
            dashArray: '5, 10',
            interactive: false
        }).addTo(map);

        // Update measurement display with large numbers
        measurementDisplay.textContent = `${distance.toFixed(2)} km`;
    } else {
        cursorCoordinates.textContent = `Lat: ${lat}, Lon: ${lng}`;
    }
});

// Right-click handler
map.on('contextmenu', function(e) {
    e.originalEvent.preventDefault();
    
    // Disable context menu during measurement mode or delivery area mode
    if (isMeasuring || deliveryAreaMode) {
        return;
    }
    
    const { lat, lng } = e.latlng;
    const x = e.containerPoint.x;
    const y = e.containerPoint.y;
    showContextMenu(x, y, lat, lng);
});

// Long-press touch handler for mobile context menu
let longPressTimer = null;
let longPressStartPos = null;
const LONG_PRESS_DURATION = 500; // milliseconds
const LONG_PRESS_TOLERANCE = 10; // pixels

map.on('touchstart', function(e) {
    // Disable long-press during measurement mode or delivery area mode
    if (isMeasuring || deliveryAreaMode) {
        return;
    }
    
    if (e.originalEvent.touches && e.originalEvent.touches.length === 1) {
        const touch = e.originalEvent.touches[0];
        longPressStartPos = { x: touch.clientX, y: touch.clientY };
        
        longPressTimer = setTimeout(function() {
            // Calculate map container point from touch position
            const mapContainer = document.getElementById('map');
            const rect = mapContainer.getBoundingClientRect();
            const containerX = touch.clientX - rect.left;
            const containerY = touch.clientY - rect.top;
            
            // Get lat/lng from container point
            const latlng = map.containerPointToLatLng([containerX, containerY]);
            
            // Show context menu
            showContextMenu(containerX, containerY, latlng.lat, latlng.lng);
        }, LONG_PRESS_DURATION);
    }
});

map.on('touchend', function(e) {
    // Clear the long-press timer on touch end
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    longPressStartPos = null;
});

map.on('touchmove', function(e) {
    // Cancel long-press if finger moves too much
    if (longPressTimer && longPressStartPos && e.originalEvent.touches && e.originalEvent.touches.length === 1) {
        const touch = e.originalEvent.touches[0];
        const dx = touch.clientX - longPressStartPos.x;
        const dy = touch.clientY - longPressStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > LONG_PRESS_TOLERANCE) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            longPressStartPos = null;
        }
    }
});
