// ==========================================
// INITIALIZATION
// ==========================================

// Initialize Lucide Icons
lucide.createIcons();

// Initialize map centered on Berlin
const map = L.map('map', { zoomControl: false }).setView([52.5200, 13.4050], 15);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Apply grayscale filter to map on initial load (since grayscale toggle is checked by default)
document.getElementById('map').classList.add('map-grayscale');

// ==========================================
// STATE MANAGEMENT
// ==========================================

// Standalone hexagon state
const standaloneHexagons = {};

// Default hexagon settings
let resolution = 9;
let color = '#0000ff';
let opacity = 0.3;

// Standalone hexagons enabled state
let standaloneHexagonsEnabled = true;

// Measurement state
let isMeasuring = false;
let measurementStart = null;
let measurementLine = null;
let measurementStartMarker = null;
let measurementLineColor = '#555555';

// Grayscale state
let isGrayscale = true;

// Partner state
const partnersById = {};
let currentPartnerId = null;
let partnerIdCounter = 1;
let editMode = {
    isActive: false,
    partnerId: null
};

// Context menu state
let contextMenuState = {
    latitude: null,
    longitude: null,
    crossMarker: null
};

// Delivery area drawing state
let deliveryAreaMode = false;
let deliveryAreaPoints = [];
let deliveryAreaLines = [];
let deliveryAreaTempLine = null;
let deliveryAreaStartMarker = null;
let deliveryAreaVertexMarkers = [];
let deliveryAreaNearStartPoint = false;
let deliveryAreaHadCrossMarker = false;
let deliveryAreaCompletedPolygons = []; // Array to store all completed polygons for multi-polygon support
let pendingDeliveryAreaPolygons = []; // Array to store pending delivery area polygons (drawn but not yet saved to partner)

// Partner constants
const PARTNER_CONSTANTS = {
    DEFAULT_OPACITY: 0.1,
    INTERSECTION_OPACITY: 0.4,
    DEFAULT_PRIMARY_COLOR: '#0000ff',
    DEFAULT_PRIMARY_H3_RESOLUTION: 9,
    DEFAULT_PRIMARY_NUM_ZONES: 18,
    DEFAULT_SECONDARY_H3_RESOLUTION: 6,
    DEFAULT_SECONDARY_NUM_ZONES: 8,
    DEFAULT_STANDALONE_HEXAGON_WEIGHT: 2,
    DEFAULT_PRIMARY_HEXAGON_WEIGHT: 1,
    DEFAULT_SECONDARY_HEXAGON_WEIGHT: 2,
    DEFAULT_DELIVERY_AREA_WEIGHT: 3
};

// ==========================================
// HEXAGON MANAGEMENT
// ==========================================

/**
 * Generates and displays H3 grid cells at the clicked location.
 * Toggles hexagon existence - adds if not present, removes if already exists.
 */
function generateH3Grid(latitude, longitude, resolution, color, opacity, map) {
    const h3Index = h3.latLngToCell(latitude, longitude, resolution);
    
    if (standaloneHexagons[h3Index]) {
        removeHexagon(h3Index);
    } else {
        addHexagon({ h3Index, latitude, longitude, color, opacity });
    }
}

/**
 * Adds a hexagon polygon to the map.
 */
function addHexagon(hexagon) {
    const { h3Index, latitude, longitude, color, opacity } = hexagon;
    const hexagonBoundary = h3.cellToBoundary(h3Index);
    const polygon = L.polygon(hexagonBoundary, {
        color: color,
        fillColor: color,
        fillOpacity: opacity,
        originalFillOpacity: opacity,
        weight: PARTNER_CONSTANTS.DEFAULT_STANDALONE_HEXAGON_WEIGHT,
        interactive: false
    }).addTo(map);

    standaloneHexagons[h3Index] = { polygon, latitude, longitude };
}

/**
 * Removes a hexagon polygon from the map.
 */
function removeHexagon(h3Index) {
    if (standaloneHexagons[h3Index]) {
        map.removeLayer(standaloneHexagons[h3Index].polygon);
        delete standaloneHexagons[h3Index];
    }
}

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
    if (measurementLine) {
        map.removeLayer(measurementLine);
        measurementLine = null;
    }
    if (measurementStartMarker) {
        map.removeLayer(measurementStartMarker);
        measurementStartMarker = null;
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
        if (!measurementStart) {
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
            // Second click - complete measurement but stay in measurement mode
            // Clear the line and marker for the next measurement
            if (measurementLine) {
                map.removeLayer(measurementLine);
                measurementLine = null;
            }
            if (measurementStartMarker) {
                map.removeLayer(measurementStartMarker);
                measurementStartMarker = null;
            }
            measurementStart = null;
            
            // Reset the display
            const measurementDisplay = document.getElementById('measurement-display');
            measurementDisplay.textContent = '0.00 km';
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
    } else if (isMeasuring && measurementStart) {
        // Update measurement line and show distance
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
    
    // Disable context menu during measurement mode
    if (isMeasuring) {
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
    // Disable long-press during measurement mode
    if (isMeasuring) {
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
    
    if (toggleIcon) lucide.createIcons();
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
    
    lucide.createIcons();
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

// ==========================================
// SAVE/LOAD DATA
// ==========================================

/**
 * Saves all hexagons and partners to a JSON file.
 */
function saveData() {
    // Check if there's anything to save
    if (Object.keys(standaloneHexagons).length === 0 && Object.keys(partnersById).length === 0) {
        alert("No hexagons or partners to save.");
        return;
    }

    // Build standaloneHexagons array (compact format)
    const standaloneHexagonsData = Object.keys(standaloneHexagons).map(h3Index => {
        const { polygon } = standaloneHexagons[h3Index];
        return {
            h3Index,
            color: polygon.options.color,
            fillOpacity: polygon.options.fillOpacity
        };
    });

    // Build partners array (similar to h3-wkt-viewer format)
    const partnersData = Object.values(partnersById).map(partner => ({
        partnerId: partner.partnerId,
        latitude: partner.latitude,
        longitude: partner.longitude,
        primaryH3Resolution: partner.primaryH3Resolution,
        primaryNumZones: partner.primaryNumZones,
        secondaryH3Resolution: partner.secondaryH3Resolution,
        secondaryNumZones: partner.secondaryNumZones,
        primaryColor: partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR,
        secondaryColor: partner.secondaryColor,
        deliveryAreaContent: partner.deliveryAreaContent,
        deliveryAreaColor: partner.deliveryAreaColor
    }));

    // Create unified data structure
    const data = {
        type: "HexagonMapperData",
        version: "1.0",
        standaloneHexagons: standaloneHexagonsData,
        partners: partnersData
    };

    // Download as JSON file
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hexagon-mapper-data.json";
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Loads hexagons and partners from a JSON file.
 */
function loadData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            let data;
            try {
                data = JSON.parse(e.target.result);
            } catch (error) {
                alert("Invalid JSON format. Please select a valid JSON file.");
                return;
            }

            // Validate data structure
            if (!data || typeof data !== 'object') {
                alert("Invalid data structure. Please select a valid HexagonMapper data file.");
                event.target.value = '';
                return;
            }

            // Check for HexagonMapperData format
            if (data.type === "HexagonMapperData" && data.version) {
                loadHexagonMapperData(data);
            } else {
                alert("Unknown file format. Please select a valid HexagonMapper data file.");
            }

            // Reset the file input value to allow reloading the same file
            event.target.value = '';
        };
        reader.readAsText(file);
    }
}

/**
 * Updates partner counter based on existing partners (used after loading).
 */
function updatePartnerCounterFromPartners() {
    let maxNum = 0;
    Object.keys(partnersById).forEach(partnerId => {
        // Check if partnerId matches pattern "partner{number}"
        const match = partnerId.match(/^partner(\d+)$/);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) maxNum = num;
        }
    });
    partnerIdCounter = maxNum + 1;
}

/**
 * Loads HexagonMapperData format (new unified format).
 */
function loadHexagonMapperData(data) {
    // Close all sidebars and remove cross marker before loading new data
    closeAllSidebars();

    // Clear existing standaloneHexagons
    Object.keys(standaloneHexagons).forEach(h3Index => {
        map.removeLayer(standaloneHexagons[h3Index].polygon);
        delete standaloneHexagons[h3Index];
    });

    // Clear existing partners
    Object.keys(partnersById).forEach(partnerId => {
        deletePartner(partnerId);
    });

    // Load standaloneHexagons
    if (data.standaloneHexagons && Array.isArray(data.standaloneHexagons)) {
        data.standaloneHexagons.forEach(hexagonData => {
            const { h3Index, color, fillOpacity } = hexagonData;
            const hexagonBoundary = h3.cellToBoundary(h3Index);
            const polygon = L.polygon(hexagonBoundary, {
                color: color || '#0000ff',
                fillColor: color || '#0000ff',
                fillOpacity: fillOpacity || 0.3,
                originalFillOpacity: fillOpacity || 0.3,
                interactive: false
            }).addTo(map);

            // Get center coordinates from h3Index
            const cellToLatLng = h3.cellToLatLng(h3Index);
            standaloneHexagons[h3Index] = {
                polygon, 
                latitude: cellToLatLng.lat, 
                longitude: cellToLatLng.lng 
            };
        });
    }

    // Load partners
    if (data.partners && Array.isArray(data.partners)) {
        data.partners.forEach(partnerData => {
            addPartnerToMap(partnerData);
        });
        
        // Update counter to prevent ID conflicts
        updatePartnerCounterFromPartners();
    }
}

// Save/Load buttons
document.getElementById('save-btn').addEventListener('click', saveData);
document.getElementById('load-btn').addEventListener('click', function() {
    document.getElementById('load-file').click();
});
document.getElementById('load-file').addEventListener('change', loadData);

// ==========================================
// PARTNER MANAGEMENT
// ==========================================

/**
 * Adds a partner with hexagon zones to the map.
 */
function addPartnerToMap(partner) {
    const { partnerId, latitude, longitude, primaryH3Resolution, primaryNumZones, secondaryH3Resolution, secondaryNumZones, primaryColor: partnerPrimaryColor, secondaryColor, deliveryAreaContent, deliveryAreaColor } = partner;
    const actualPrimaryColor = partnerPrimaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;

    // Create partner object with elements structure
    const partnerObject = {
        partnerId,
        latitude,
        longitude,
        primaryH3Resolution,
        primaryNumZones,
        secondaryH3Resolution,
        secondaryNumZones,
        primaryColor: partnerPrimaryColor,
        secondaryColor,
        deliveryAreaContent,
        deliveryAreaColor,
        elements: {
            primaryHexagons: [],
            secondaryHexagons: [],
            deliveryAreaPolygons: []
        }
    };

    // Add marker
    const marker = L.marker([latitude, longitude]).addTo(map);
    partnerObject.marker = marker;
    
    // Add click event listener to show partner sidebar
    marker.on('click', function() {
        showPartnerSidebar(partnerId);
    });

    // Draw primary hexagons
    const centerCell = h3.latLngToCell(latitude, longitude, primaryH3Resolution);
    const disk = h3.gridDisk(centerCell, primaryNumZones - 1);
    disk.forEach(cell => {
        const boundary = h3.cellToBoundary(cell);
        const polygon = L.polygon(boundary, {
            color: actualPrimaryColor,
            fillColor: actualPrimaryColor,
            fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
            weight: PARTNER_CONSTANTS.DEFAULT_PRIMARY_HEXAGON_WEIGHT,
            interactive: false
        }).addTo(map);
        
        const hexagonObject = {
            h3Index: cell,
            polygon: polygon,
            center: { lat: latitude, lng: longitude },
            layerType: 'primary',
            h3Resolution: primaryH3Resolution,
            zoneNumber: h3.gridDistance(centerCell, cell)
        };
        partnerObject.elements.primaryHexagons.push(hexagonObject);
    });

    // Draw secondary hexagons if provided
    if (secondaryH3Resolution !== undefined && secondaryNumZones !== undefined) {
        const actualSecondaryColor = secondaryColor || actualPrimaryColor;
        const centerCell2 = h3.latLngToCell(latitude, longitude, secondaryH3Resolution);
        const disk2 = h3.gridDisk(centerCell2, secondaryNumZones - 1);
        disk2.forEach(cell => {
            const boundary = h3.cellToBoundary(cell);
            const polygon = L.polygon(boundary, {
                color: actualSecondaryColor,
                fillColor: actualSecondaryColor,
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                weight: PARTNER_CONSTANTS.DEFAULT_SECONDARY_HEXAGON_WEIGHT,
                interactive: false
            }).addTo(map);
            
            const hexagonObject = {
                h3Index: cell,
                polygon: polygon,
                center: { lat: latitude, lng: longitude },
                layerType: 'secondary',
                h3Resolution: secondaryH3Resolution,
                zoneNumber: h3.gridDistance(centerCell2, cell)
            };
            partnerObject.elements.secondaryHexagons.push(hexagonObject);
        });
    }

    // Draw delivery area polygon if provided
    if (deliveryAreaContent) {
        const actualDeliveryColor = deliveryAreaColor || actualPrimaryColor;
        const parsedContent = parsePolygonContent(deliveryAreaContent);
        
        // Normalize to array of polygon data (handles both single and multi)
        const polygonDataArray = parsedContent.type === 'single' 
            ? [parsedContent.coordinates] 
            : parsedContent.coordinates;
        
        polygonDataArray.forEach(polygonData => {
            const coords = polygonDataToLeafletCoords(polygonData);
            if (coords.length > 0 && coords[0].length > 0) {
                const polygon = L.polygon(coords, {
                    color: actualDeliveryColor,
                    fillColor: actualDeliveryColor,
                    fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                    weight: PARTNER_CONSTANTS.DEFAULT_DELIVERY_AREA_WEIGHT,
                    interactive: false
                }).addTo(map);
                
                partnerObject.elements.deliveryAreaPolygons.push({
                    polygon: polygon,
                    type: parsedContent.type,
                    holes: polygonData.holes || []
                });
            }
        });
    }

    // Store partner in the main structure
    partnersById[partnerId] = partnerObject;
    
    // Initialize limitDeliveryToPrimary to true (default: enabled)
    partnerObject.limitDeliveryToPrimary = true;
    
    // Compute hexagon intersections with delivery area
    computeHexagonIntersections(partnerObject);

    // Move map view to the partner's location
    map.setView([latitude, longitude], map.getZoom());
}

/**
 * Deletes a partner and all its hexagons from the map.
 */
function deletePartner(partnerId) {
    const partner = partnersById[partnerId];
    if (!partner) return;

    // Remove primary hexagons from map
    partner.elements.primaryHexagons.forEach(hexagon => {
        map.removeLayer(hexagon.polygon);
    });

    // Remove secondary hexagons from map
    partner.elements.secondaryHexagons.forEach(hexagon => {
        map.removeLayer(hexagon.polygon);
    });

    // Remove delivery area polygons from map
    if (partner.elements.deliveryAreaPolygons) {
        partner.elements.deliveryAreaPolygons.forEach(polyObj => {
            map.removeLayer(polyObj.polygon);
        });
    }

    // Remove marker from map
    if (partner.marker) {
        map.removeLayer(partner.marker);
    }

    // Remove partner from the data structure
    delete partnersById[partnerId];
}

/**
 * Updates a partner with new data.
 */
function updatePartner(oldPartnerId, newPartnerData) {
    const oldPartner = partnersById[oldPartnerId];
    if (!oldPartner) return;

    // If partner ID changed, remove the old entry
    if (oldPartnerId !== newPartnerData.partnerId) {
        delete partnersById[oldPartnerId];
    }

    // Remove old elements from map
    oldPartner.elements.primaryHexagons.forEach(hexagon => {
        map.removeLayer(hexagon.polygon);
    });
    oldPartner.elements.secondaryHexagons.forEach(hexagon => {
        map.removeLayer(hexagon.polygon);
    });
    // Remove delivery area polygons
    if (oldPartner.elements.deliveryAreaPolygons) {
        oldPartner.elements.deliveryAreaPolygons.forEach(polyObj => {
            map.removeLayer(polyObj.polygon);
        });
    }
    if (oldPartner.marker) {
        map.removeLayer(oldPartner.marker);
    }

    // Add the updated partner
    addPartnerToMap(newPartnerData);
}

/**
 * Toggles hexagons visibility for a partner's zone (primary or secondary).
 * @param {string} partnerId - The partner ID
 * @param {string} zoneType - 'primary' or 'secondary'
 * @param {boolean} visible - Whether to show or hide the hexagons
 */
function toggleHexagonsVisibility(partnerId, zoneType, visible) {
    const partner = partnersById[partnerId];
    if (!partner) return;
    
    const hexagonsKey = zoneType === 'primary' ? 'primaryHexagons' : 'secondaryHexagons';
    const hexagons = partner.elements[hexagonsKey];
    
    if (!hexagons || hexagons.length === 0) return;

    // Check if intersection highlight is active
    const intersectionToggle = document.getElementById('toggle-intersection-highlight');
    const intersectionActive = !intersectionToggle.disabled && intersectionToggle.checked;

    if (visible) {
        hexagons.forEach(hexagon => {
            // If intersection is active and hexagon is intersected, use intersection opacity
            const targetOpacity = (intersectionActive && hexagon.isIntersectedByDelivery) 
                ? PARTNER_CONSTANTS.INTERSECTION_OPACITY 
                : PARTNER_CONSTANTS.DEFAULT_OPACITY;
            hexagon.polygon.setStyle({
                fillOpacity: targetOpacity,
                opacity: 1
            });
        });
    } else {
        hexagons.forEach(hexagon => {
            hexagon.polygon.setStyle({
                fillOpacity: 0,
                opacity: 0
            });
        });
    }
}

/**
 * Toggles primary hexagons visibility for a partner.
 */
function togglePrimaryHexagonsVisibility(partnerId, visible) {
    toggleHexagonsVisibility(partnerId, 'primary', visible);
}

/**
 * Toggles secondary hexagons visibility for a partner.
 */
function toggleSecondaryHexagonsVisibility(partnerId, visible) {
    toggleHexagonsVisibility(partnerId, 'secondary', visible);
}

/**
 * Toggles delivery area visibility for a partner.
 */
function toggleDeliveryAreaVisibility(partnerId, visible) {
    const partner = partnersById[partnerId];
    if (!partner || !partner.elements.deliveryAreaPolygons || partner.elements.deliveryAreaPolygons.length === 0) return;

    partner.elements.deliveryAreaPolygons.forEach(polyObj => {
        if (visible) {
            polyObj.polygon.setStyle({
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                opacity: 1
            });
        } else {
            polyObj.polygon.setStyle({
                fillOpacity: 0,
                opacity: 0
            });
        }
    });
}

/**
 * Toggles intersection highlight for hexagons intersected by delivery area.
 * Only highlights hexagons that are currently visible.
 * @param {string} partnerId - The partner ID
 * @param {boolean} enabled - Whether to show highlighted opacity for intersected hexagons
 */
function toggleIntersectionHighlight(partnerId, enabled) {
    const partner = partnersById[partnerId];
    if (!partner) return;
    
    const hasDeliveryArea = partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
    if (!hasDeliveryArea) return;
    
    // Check if delivery area is visible
    const deliveryVisible = partner.elements.deliveryAreaPolygons[0].polygon.options.fillOpacity > 0;
    
    // When disabling, we don't need delivery area to be visible
    // We just need to reset hexagon opacity to default
    if (!enabled) {
        // Reset all visible intersected hexagons to default opacity
        partner.elements.primaryHexagons.forEach(hexagon => {
            if (hexagon.isIntersectedByDelivery) {
                const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
                if (isVisible) {
                    hexagon.polygon.setStyle({
                        fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY
                    });
                }
            }
        });
        
        partner.elements.secondaryHexagons.forEach(hexagon => {
            if (hexagon.isIntersectedByDelivery) {
                const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
                if (isVisible) {
                    hexagon.polygon.setStyle({
                        fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY
                    });
                }
            }
        });
        return;
    }
    
    // When enabling, delivery area must be visible
    if (!deliveryVisible) return;
    
    // Update primary hexagons - only highlight visible ones
    partner.elements.primaryHexagons.forEach(hexagon => {
        if (hexagon.isIntersectedByDelivery) {
            const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
            if (isVisible) {
                hexagon.polygon.setStyle({
                    fillOpacity: PARTNER_CONSTANTS.INTERSECTION_OPACITY
                });
            }
        }
    });
    
    // Update secondary hexagons - only highlight visible ones
    partner.elements.secondaryHexagons.forEach(hexagon => {
        if (hexagon.isIntersectedByDelivery) {
            const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
            if (isVisible) {
                hexagon.polygon.setStyle({
                    fillOpacity: PARTNER_CONSTANTS.INTERSECTION_OPACITY
                });
            }
        }
    });
}

/**
 * Updates the coverage bar display for delivery area intersection.
 * @param {string} zoneType - 'primary' or 'secondary'
 * @param {number} intersected - Number of intersected hexagons
 * @param {number} total - Total number of hexagons
 */
function updateCoverageBar(zoneType, intersected, total) {
    const percentage = total > 0 ? Math.round((intersected / total) * 100) : 0;
    
    const barId = zoneType === 'primary' ? 'primary-coverage-bar' : 'secondary-coverage-bar';
    const percentId = zoneType === 'primary' ? 'primary-coverage-percent' : 'secondary-coverage-percent';
    const containerId = zoneType === 'primary' ? 'primary-coverage-bar-container' : 'secondary-coverage-bar-container';
    
    const barElement = document.getElementById(barId);
    const percentElement = document.getElementById(percentId);
    const containerElement = document.getElementById(containerId);
    
    if (!barElement || !percentElement || !containerElement) return;
    
    // Update the bar width
    barElement.style.width = `${percentage}%`;
    
    // Update the percentage text
    percentElement.textContent = `${percentage}%`;
    
    // Show/hide container based on whether there's a delivery area
    // The container should always be visible when there's delivery area data
    containerElement.classList.remove('hidden');
}

/**
 * Updates the intersection highlight toggle state based on current conditions.
 * Toggle is enabled when: delivery area exists AND is visible AND (primary OR secondary is visible).
 * @param {string} partnerId - The partner ID
 */
function updateIntersectionToggleState(partnerId) {
    const partner = partnersById[partnerId];
    if (!partner) return;
    
    const intersectionToggle = document.getElementById('toggle-intersection-highlight');
    const intersectionContainer = intersectionToggle.closest('.zone-toggle') || intersectionToggle.parentElement;
    
    const hasDeliveryArea = partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
    const deliveryVisible = hasDeliveryArea && partner.elements.deliveryAreaPolygons[0].polygon.options.fillOpacity > 0;
    const primaryVisible = partner.elements.primaryHexagons.length > 0 && partner.elements.primaryHexagons[0].polygon.options.fillOpacity > 0;
    const secondaryVisible = partner.elements.secondaryHexagons.length > 0 && partner.elements.secondaryHexagons[0].polygon.options.fillOpacity > 0;
    const anyZoneVisible = primaryVisible || secondaryVisible;
    
    // Enable toggle only if delivery area exists, is visible, and at least one zone is visible
    const shouldBeEnabled = hasDeliveryArea && deliveryVisible && anyZoneVisible;
    
    if (shouldBeEnabled) {
        intersectionToggle.disabled = false;
        if (intersectionContainer) {
            intersectionContainer.classList.remove('opacity-50', 'cursor-not-allowed');
            intersectionContainer.style.pointerEvents = 'auto';
        }
    } else {
        intersectionToggle.disabled = true;
        if (intersectionContainer) {
            intersectionContainer.classList.add('opacity-50', 'cursor-not-allowed');
            intersectionContainer.style.pointerEvents = 'none';
        }
        // Also uncheck the toggle when disabling
        intersectionToggle.checked = false;
    }
}

/**
 * Converts a polygon data object (with outer and holes) to Leaflet-compatible coordinates.
 * Leaflet expects: [outerRing, hole1, hole2, ...] where each ring is [[lat, lng], ...]
 * @param {Object} polygonData - {outer: [[lat, lng], ...], holes: [[[lat, lng], ...], ...]}
 * @returns {Array} Leaflet-compatible coordinates array
 */
function polygonDataToLeafletCoords(polygonData) {
    if (!polygonData || !polygonData.outer || polygonData.outer.length === 0) {
        return [];
    }
    
    // If it's a simple array (legacy format), return as-is
    if (Array.isArray(polygonData) && polygonData.length > 0 && Array.isArray(polygonData[0])) {
        return polygonData;
    }
    
    // Start with outer ring
    const result = [polygonData.outer];
    
    // Add holes if present
    if (polygonData.holes && polygonData.holes.length > 0) {
        polygonData.holes.forEach(hole => {
            result.push(hole);
        });
    }
    
    return result;
}

/**
 * Parses polygon content (KML or WKT) and extracts coordinates.
 * Returns an object with:
 *   - type: 'single' or 'multi'
 *   - coordinates: for single polygon: {outer: [[lat, lng], ...], holes: [...]}
 *                  for multi-polygon: array of {outer, holes} objects
 */
function parsePolygonContent(content) {
    const trimmedContent = content.trim();
    
    // Detect format: KML has XML structure, WKT starts with POLYGON or MULTIPOLYGON
    if (trimmedContent.includes('<coordinates') || trimmedContent.includes('<Coordinates')) {
        // KML format - check if there are multiple placemarks
        const kmlMultiResult = parseKMLMultiPolygon(trimmedContent);
        if (kmlMultiResult.length > 1) {
            // Multiple placemarks found - return as multi-polygon
            return {
                type: 'multi',
                coordinates: kmlMultiResult
            };
        } else if (kmlMultiResult.length === 1) {
            // Single placemark - return as single polygon
            return {
                type: 'single',
                coordinates: kmlMultiResult[0]
            };
        }
        // Fallback to original parsing if no placemarks found
        return {
            type: 'single',
            coordinates: { outer: parseKMLCoordinates(trimmedContent), holes: [] }
        };
    } else if (trimmedContent.toUpperCase().startsWith('MULTIPOLYGON')) {
        // WKT MULTIPOLYGON format - returns array of simple coordinate arrays (no holes support for multipolygon yet)
        const result = parseWKTMultiPolygon(trimmedContent);
        return {
            type: 'multi',
            coordinates: result
        };
    } else if (trimmedContent.toUpperCase().startsWith('POLYGON')) {
        // WKT POLYGON format - returns {outer, holes}
        const result = parseWKTPolygon(trimmedContent);
        return {
            type: 'single',
            coordinates: result
        };
    }
    
    // Try to auto-detect by attempting parsers
    const kmlMultiResult = parseKMLMultiPolygon(trimmedContent);
    if (kmlMultiResult.length > 1) {
        return {
            type: 'multi',
            coordinates: kmlMultiResult
        };
    } else if (kmlMultiResult.length === 1) {
        return {
            type: 'single',
            coordinates: kmlMultiResult[0]
        };
    }
    
    const wktMultiResult = parseWKTMultiPolygon(trimmedContent);
    if (wktMultiResult.length > 0) {
        return {
            type: 'multi',
            coordinates: wktMultiResult
        };
    }
    
    return {
        type: 'single',
        coordinates: parseWKTPolygon(trimmedContent)
    };
}

/**
 * Parses KML coordinates string into array of [lat, lng] pairs.
 */
function parseKMLCoordsString(coordText) {
    const coordinates = [];
    const coordPairs = coordText.trim().split(/\s+/);
    coordPairs.forEach(pair => {
        const parts = pair.split(',');
        if (parts.length >= 2) {
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lon)) {
                coordinates.push([lat, lon]);
            }
        }
    });
    return coordinates;
}

/**
 * Parses KML content and extracts polygon coordinates from a single placemark.
 * Also detects innerBoundaryIs (holes) if present.
 */
function parseKMLCoordinates(kmlContent) {
    const coordinates = [];
    
    // Try to extract coordinates from KML <coordinates> tag (outer boundary)
    const coordMatch = kmlContent.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
    if (coordMatch) {
        const coords = parseKMLCoordsString(coordMatch[1]);
        coordinates.push(...coords);
    }
    
    return coordinates;
}

/**
 * Parses KML Polygon element with support for innerBoundaryIs (holes).
 * Returns {outer: coordinates, holes: [coordinates, ...]}
 */
function parseKMLPolygonWithHoles(polygonContent) {
    const result = { outer: [], holes: [] };
    
    // Extract outer boundary
    const outerMatch = polygonContent.match(/<outerBoundaryIs[^>]*>([\s\S]*?)<\/outerBoundaryIs>/i);
    if (outerMatch) {
        const coordMatch = outerMatch[1].match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
        if (coordMatch) {
            result.outer = parseKMLCoordsString(coordMatch[1]);
        }
    }
    
    // Extract inner boundaries (holes)
    const innerRegex = /<innerBoundaryIs[^>]*>([\s\S]*?)<\/innerBoundaryIs>/gi;
    let innerMatch;
    while ((innerMatch = innerRegex.exec(polygonContent)) !== null) {
        const coordMatch = innerMatch[1].match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
        if (coordMatch) {
            const holeCoords = parseKMLCoordsString(coordMatch[1]);
            if (holeCoords.length > 0) {
                result.holes.push(holeCoords);
            }
        }
    }
    
    return result;
}

/**
 * Parses KML content with multiple placemarks and extracts all polygon coordinates.
 * Returns an array of objects: {outer: coordinates, holes: [coordinates, ...]}
 * For backward compatibility, if no holes are detected, returns simple coordinate arrays.
 */
function parseKMLMultiPolygon(kmlContent) {
    const polygons = [];
    
    // Check if any polygon has innerBoundaryIs
    const hasInnerBoundaries = /<innerBoundaryIs/i.test(kmlContent);
    
    // Find all <Placemark> elements
    const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
    let match;
    
    while ((match = placemarkRegex.exec(kmlContent)) !== null) {
        const placemarkContent = match[1];
        
        // Check if this placemark has a Polygon with innerBoundaryIs
        const polygonMatch = placemarkContent.match(/<Polygon[^>]*>([\s\S]*?)<\/Polygon>/i);
        if (polygonMatch && hasInnerBoundaries) {
            const polygonData = parseKMLPolygonWithHoles(polygonMatch[1]);
            if (polygonData.outer.length > 0) {
                polygons.push(polygonData);
            }
        } else {
            // Simple polygon without holes
            const coords = parseKMLCoordinates(placemarkContent);
            if (coords.length > 0) {
                polygons.push({ outer: coords, holes: [] });
            }
        }
    }
    
    return polygons;
}

/**
 * Parses WKT POLYGON content and extracts coordinates including holes.
 * Returns {outer: coordinates, holes: [coordinates, ...]}
 */
function parseWKTPolygon(wktContent) {
    const result = { outer: [], holes: [] };
    
    // WKT POLYGON format: POLYGON((lon1 lat1, lon2 lat2, lon3 lat3, ...))
    // or with multiple rings: POLYGON((outer_ring),(inner_ring1),...)
    
    // Match the content inside POLYGON(...)
    const polygonMatch = wktContent.match(/POLYGON\s*\(\s*\(([\s\S]+)\)\s*\)/i);
    if (polygonMatch) {
        const ringContent = polygonMatch[1];
        
        // Handle multiple rings - split by "),(" pattern
        const rings = ringContent.split(/\)\s*,\s*\(/);
        
        // Parse each ring
        rings.forEach((ring, index) => {
            const coordinates = [];
            const coordPairs = ring.split(',');
            coordPairs.forEach(pair => {
                const trimmedPair = pair.trim();
                const parts = trimmedPair.split(/\s+/);
                if (parts.length >= 2) {
                    const lon = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        coordinates.push([lat, lon]);
                    }
                }
            });
            
            if (coordinates.length > 0) {
                if (index === 0) {
                    result.outer = coordinates;
                } else {
                    result.holes.push(coordinates);
                }
            }
        });
    }
    
    return result;
}

/**
 * Parses WKT MULTIPOLYGON content and extracts coordinates for all polygons.
 * Returns an array of coordinate arrays (one for each polygon).
 */
function parseWKTMultiPolygon(wktContent) {
    const polygons = [];
    
    // WKT MULTIPOLYGON format: MULTIPOLYGON(((lon1 lat1, lon2 lat2, ...)), ((lon3 lat3, lon4 lat4, ...)))
    // Each polygon can have multiple rings
    
    // Match the content inside MULTIPOLYGON(...)
    const multiPolygonMatch = wktContent.match(/MULTIPOLYGON\s*\(\s*([\s\S]+)\s*\)/i);
    if (multiPolygonMatch) {
        const content = multiPolygonMatch[1];
        
        // Split by )), ((  to get individual polygons
        // Use a more robust parsing approach
        let depth = 0;
        let currentPolygon = '';
        let inPolygon = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (char === '(') {
                depth++;
                if (depth === 2) {
                    inPolygon = true;
                    currentPolygon = '';
                    continue;
                }
            } else if (char === ')') {
                depth--;
                if (depth === 1 && inPolygon) {
                    // End of a polygon
                    inPolygon = false;
                    if (currentPolygon.trim()) {
                        const coords = parseWKTRing(currentPolygon);
                        if (coords.length > 0) {
                            polygons.push(coords);
                        }
                    }
                    continue;
                }
            }
            
            if (inPolygon) {
                currentPolygon += char;
            }
        }
    }
    
    return polygons;
}

/**
 * Parses a single WKT ring (list of coordinate pairs).
 */
function parseWKTRing(ringContent) {
    const coordinates = [];
    const coordPairs = ringContent.split(',');
    
    coordPairs.forEach(pair => {
        const trimmedPair = pair.trim();
        const parts = trimmedPair.split(/\s+/);
        if (parts.length >= 2) {
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lon)) {
                coordinates.push([lat, lon]);
            }
        }
    });
    
    return coordinates;
}

/**
 * Shows the partner info sidebar.
 */
function showPartnerSidebar(partnerId) {
    // Block partner marker clicks during measurement mode
    if (isMeasuring) {
        return;
    }

    const partner = partnersById[partnerId];
    if (!partner) return;

    // If the same partner is already being shown, do nothing
    if (currentPartnerId === partnerId) {
        return;
    }

    closeAllSidebars();
    updatePartnerSidebarContent(partner);
    const partnerInfoSidebar = document.getElementById('partner-info-sidebar');
    openSidebar(partnerInfoSidebar);
    currentPartnerId = partnerId;
}

/**
 * Updates the partner sidebar content with partner details.
 */
function updatePartnerSidebarContent(partner) {
    document.getElementById('slide-partner-id').textContent = partner.partnerId;

    const primaryCount = partner.elements.primaryHexagons.length;
    const secondaryCount = partner.elements.secondaryHexagons.length;
    const hasDeliveryArea = partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
    
    // Count intersected hexagons
    const primaryIntersected = partner.elements.primaryHexagons.filter(h => h.isIntersectedByDelivery).length;
    const secondaryIntersected = partner.elements.secondaryHexagons.filter(h => h.isIntersectedByDelivery).length;
    
    // Update Primary Zone Statistics
    document.getElementById('primary-resolution-stat').textContent = partner.primaryH3Resolution;
    document.getElementById('primary-hexagons-stat').textContent = primaryCount;
    document.getElementById('primary-intersected-stat').textContent = primaryIntersected > 0 ? `${primaryIntersected}` : '-';
    
    // Update primary coverage bar
    updateCoverageBar('primary', primaryIntersected, primaryCount);
    
    // Update Secondary Zone Statistics
    const secondaryStatsContainer = document.getElementById('secondary-stats-container');
    if (secondaryCount > 0) {
        secondaryStatsContainer.classList.remove('hidden');
        document.getElementById('secondary-resolution-stat').textContent = partner.secondaryH3Resolution;
        document.getElementById('secondary-hexagons-stat').textContent = secondaryCount;
        document.getElementById('secondary-intersected-stat').textContent = secondaryIntersected > 0 ? `${secondaryIntersected}` : '-';
        
        // Update secondary coverage bar
        updateCoverageBar('secondary', secondaryIntersected, secondaryCount);
    } else {
        secondaryStatsContainer.classList.add('hidden');
    }
    
    // Update Delivery Area Statistics
    const deliveryStatsContainer = document.getElementById('delivery-stats-container');
    if (hasDeliveryArea) {
        deliveryStatsContainer.classList.remove('hidden');
    } else {
        deliveryStatsContainer.classList.add('hidden');
    }

    // Set initial toggle states
    const primaryVisible = partner.elements.primaryHexagons.length > 0 && partner.elements.primaryHexagons[0].polygon.options.fillOpacity > 0;
    const secondaryVisible = partner.elements.secondaryHexagons.length > 0 && partner.elements.secondaryHexagons[0].polygon.options.fillOpacity > 0;
    const deliveryVisible = hasDeliveryArea && partner.elements.deliveryAreaPolygons[0].polygon.options.fillOpacity > 0;
    const hasSecondaryHexagons = partner.elements.secondaryHexagons.length > 0;

    document.getElementById('toggle-primary-zone').checked = primaryVisible;
    document.getElementById('toggle-secondary-zone').checked = secondaryVisible;
    document.getElementById('toggle-delivery-area').checked = deliveryVisible;

    // Show/hide Secondary Zone toggle based on availability
    const secondaryZoneContainer = document.getElementById('toggle-secondary-zone-container');
    if (hasSecondaryHexagons) {
        secondaryZoneContainer.classList.remove('hidden');
    } else {
        secondaryZoneContainer.classList.add('hidden');
    }

    // Show/hide Delivery Area toggle based on availability
    const deliveryAreaContainer = document.getElementById('toggle-delivery-area-container');
    if (hasDeliveryArea) {
        deliveryAreaContainer.classList.remove('hidden');
    } else {
        deliveryAreaContainer.classList.add('hidden');
    }

    // Show/hide Intersection Highlight toggle based on delivery area availability
    const intersectionHighlightContainer = document.getElementById('toggle-intersection-highlight-container');
    if (hasDeliveryArea) {
        intersectionHighlightContainer.classList.remove('hidden');
    } else {
        intersectionHighlightContainer.classList.add('hidden');
    }
    
    // Show/hide Limit Delivery to Primary toggle based on delivery area AND secondary hexagons availability
    const limitDeliveryContainer = document.getElementById('toggle-limit-delivery-container');
    if (hasDeliveryArea && hasSecondaryHexagons) {
        limitDeliveryContainer.classList.remove('hidden');
        // Set the toggle state from the partner's limitDeliveryToPrimary property
        document.getElementById('toggle-limit-delivery').checked = partner.limitDeliveryToPrimary !== false;
    } else {
        limitDeliveryContainer.classList.add('hidden');
    }
    
    // Initialize intersection highlight toggle state
    // Check if intersection highlight is currently active by checking hexagon opacity
    const primaryIntersectedHighlighted = partner.elements.primaryHexagons.some(hexagon => 
        hexagon.isIntersectedByDelivery && hexagon.polygon.options.fillOpacity === PARTNER_CONSTANTS.INTERSECTION_OPACITY
    );
    const secondaryIntersectedHighlighted = partner.elements.secondaryHexagons.some(hexagon => 
        hexagon.isIntersectedByDelivery && hexagon.polygon.options.fillOpacity === PARTNER_CONSTANTS.INTERSECTION_OPACITY
    );
    const intersectionCurrentlyActive = primaryIntersectedHighlighted || secondaryIntersectedHighlighted;
    
    document.getElementById('toggle-intersection-highlight').checked = intersectionCurrentlyActive;
    updateIntersectionToggleState(partner.partnerId);
    
    // Re-initialize Lucide icons for any new elements
    lucide.createIcons();
}

/**
 * Closes the partner info sidebar.
 */
function closePartnerSidebar() {
    const slideWindow = document.getElementById('partner-info-sidebar');
    closeSidebar(slideWindow);
    currentPartnerId = null;
}

/**
 * Resets the add/edit partner form to default values.
 * Also clears any pending delivery area polygons.
 */
function resetSidebarForm() {
    // Clear pending delivery area polygons
    clearPendingDeliveryAreaPolygons();
    
    document.getElementById('partner-form').reset();
    document.getElementById('sidebar-partnerId').value = `partner${partnerIdCounter}`;
    document.getElementById('sidebar-primary-resolution-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_H3_RESOLUTION.toString();
    document.getElementById('sidebar-primary-zones-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_NUM_ZONES.toString();
    document.getElementById('sidebar-secondary-resolution-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_H3_RESOLUTION.toString();
    document.getElementById('sidebar-secondary-zones-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_NUM_ZONES.toString();
    document.getElementById('secondary-fields').classList.add('hidden');
    document.getElementById('sidebar-same-color').checked = true;
    document.getElementById('sidebar-secondary-color').disabled = true;
    
    // Reset delivery area fields
    document.getElementById('sidebar-enable-delivery-area').checked = false;
    document.getElementById('delivery-area-fields').classList.add('hidden');
    document.getElementById('sidebar-same-color-delivery').checked = true;
    document.getElementById('sidebar-delivery-color').disabled = true;
    // Set delivery color to match primary color
    const primaryColor = document.getElementById('sidebar-primary-color').value || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;
    document.getElementById('sidebar-delivery-color').value = primaryColor;
    // Clear polygon textarea
    document.getElementById('sidebar-polygon-content').value = '';
    
    editMode.isActive = false;
    editMode.partnerId = null;
    
    document.getElementById('partner-form-title').textContent = 'Add Partner';
    const submitButton = document.getElementById('partner-submit-btn');
    submitButton.textContent = 'Add';
}

/**
 * Opens the sidebar for editing an existing partner.
 */
function openSidebarForEdit(partner) {
    editMode.isActive = true;
    editMode.partnerId = partner.partnerId;

    document.getElementById('partner-form-title').textContent = 'Edit Partner';
    const submitButton = document.getElementById('partner-submit-btn');
    submitButton.textContent = 'Update';

    // Pre-fill form fields
    document.getElementById('sidebar-partnerId').value = partner.partnerId;
    document.getElementById('sidebar-latitude').value = partner.latitude;
    document.getElementById('sidebar-longitude').value = partner.longitude;
    document.getElementById('sidebar-primary-h3Resolution').value = partner.primaryH3Resolution;
    document.getElementById('sidebar-primary-numZones').value = partner.primaryNumZones;
    document.getElementById('sidebar-primary-color').value = partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;

    document.getElementById('sidebar-primary-resolution-value').textContent = partner.primaryH3Resolution.toString();
    document.getElementById('sidebar-primary-zones-value').textContent = partner.primaryNumZones.toString();

    // Handle secondary fields
    const primaryColor = partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;
    if (partner.secondaryH3Resolution !== undefined && partner.secondaryNumZones !== undefined) {
        document.getElementById('sidebar-enable-secondary').checked = true;
        document.getElementById('secondary-fields').classList.remove('hidden');
        document.getElementById('sidebar-secondary-h3Resolution').value = partner.secondaryH3Resolution;
        document.getElementById('sidebar-secondary-numZones').value = partner.secondaryNumZones;
        document.getElementById('sidebar-secondary-resolution-value').textContent = partner.secondaryH3Resolution.toString();
        document.getElementById('sidebar-secondary-zones-value').textContent = partner.secondaryNumZones.toString();
        
        // Check if secondary color is different from primary
        const secondaryColor = partner.secondaryColor || primaryColor;
        const colorsAreSame = secondaryColor.toLowerCase() === primaryColor.toLowerCase();
        document.getElementById('sidebar-same-color').checked = colorsAreSame;
        document.getElementById('sidebar-secondary-color').value = secondaryColor;
        document.getElementById('sidebar-secondary-color').disabled = colorsAreSame;
    } else {
        document.getElementById('sidebar-enable-secondary').checked = false;
        document.getElementById('secondary-fields').classList.add('hidden');
        document.getElementById('sidebar-secondary-color').value = primaryColor;
        document.getElementById('sidebar-same-color').checked = true;
        document.getElementById('sidebar-secondary-color').disabled = true;
    }

    // Handle delivery area fields
    // Check if delivery area content exists (polygon rendered on map)
    const hasDeliveryArea = partner.deliveryAreaContent && partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
    
    if (hasDeliveryArea) {
        // Delivery area is enabled and rendered
        document.getElementById('sidebar-enable-delivery-area').checked = true;
        document.getElementById('delivery-area-fields').classList.remove('hidden');
        document.getElementById('sidebar-polygon-content').value = partner.deliveryAreaContent || '';
        
        // Handle delivery color
        const deliveryColor = partner.deliveryAreaColor || primaryColor;
        const deliveryColorSame = !partner.deliveryAreaColor || partner.deliveryAreaColor.toLowerCase() === primaryColor.toLowerCase();
        document.getElementById('sidebar-same-color-delivery').checked = deliveryColorSame;
        document.getElementById('sidebar-delivery-color').value = deliveryColor;
        document.getElementById('sidebar-delivery-color').disabled = deliveryColorSame;
    } else {
        // No delivery area (disabled or never defined)
        document.getElementById('sidebar-enable-delivery-area').checked = false;
        document.getElementById('delivery-area-fields').classList.add('hidden');
        document.getElementById('sidebar-same-color-delivery').checked = true;
        document.getElementById('sidebar-delivery-color').value = primaryColor;
        document.getElementById('sidebar-delivery-color').disabled = true;
        document.getElementById('sidebar-polygon-content').value = '';
    }

    // Open sidebar with animation
    const sidebar = document.getElementById('partner-form-sidebar');
    openSidebar(sidebar);
}

/**
 * Validates partner data before saving.
 */
function validatePartner(partner) {
    if (!partner || typeof partner !== 'object') {
        alert("Partner must be an object");
        return false;
    }
    if (typeof partner.partnerId !== 'string' || partner.partnerId.trim() === '') {
        alert("partnerId must be a non-empty string");
        return false;
    }
    if (typeof partner.latitude !== 'number' || isNaN(partner.latitude) || partner.latitude < -90 || partner.latitude > 90) {
        alert("latitude must be a number between -90 and 90");
        return false;
    }
    if (typeof partner.longitude !== 'number' || isNaN(partner.longitude) || partner.longitude < -180 || partner.longitude > 180) {
        alert("longitude must be a number between -180 and 180");
        return false;
    }
    if (typeof partner.primaryH3Resolution !== 'number' || !Number.isInteger(partner.primaryH3Resolution) || partner.primaryH3Resolution < 0 || partner.primaryH3Resolution > 15) {
        alert("primaryH3Resolution must be an integer between 0 and 15");
        return false;
    }
    if (typeof partner.primaryNumZones !== 'number' || !Number.isInteger(partner.primaryNumZones) || partner.primaryNumZones < 1 || partner.primaryNumZones > 50) {
        alert("primaryNumZones must be an integer between 1 and 50");
        return false;
    }
    if (partner.secondaryH3Resolution !== undefined && (typeof partner.secondaryH3Resolution !== 'number' || !Number.isInteger(partner.secondaryH3Resolution) || partner.secondaryH3Resolution < 0 || partner.secondaryH3Resolution > 15)) {
        alert("secondaryH3Resolution must be an integer between 0 and 15 if provided");
        return false;
    }
    if (partner.secondaryNumZones !== undefined && (typeof partner.secondaryNumZones !== 'number' || !Number.isInteger(partner.secondaryNumZones) || partner.secondaryNumZones < 1 || partner.secondaryNumZones > 50)) {
        alert("secondaryNumZones must be an integer between 1 and 50 if provided");
        return false;
    }
    return true;
}

// ==========================================
// PARTNER EVENT LISTENERS
// ==========================================

// Partner form sidebar - close button
document.getElementById('sidebar-close-btn').addEventListener('click', function() {
    removeCrossMarker();
    const sidebar = document.getElementById('partner-form-sidebar');
    closeSidebar(sidebar);
    resetSidebarForm();
});

// Partner form sidebar - cancel button
document.getElementById('sidebar-cancel-add').addEventListener('click', function() {
    removeCrossMarker();
    const sidebar = document.getElementById('partner-form-sidebar');
    closeSidebar(sidebar);
    resetSidebarForm();
});

// Add partner sidebar - primary resolution slider
document.getElementById('sidebar-primary-h3Resolution').addEventListener('input', function() {
    document.getElementById('sidebar-primary-resolution-value').textContent = this.value;
});

// Add partner sidebar - primary zones slider
document.getElementById('sidebar-primary-numZones').addEventListener('input', function() {
    document.getElementById('sidebar-primary-zones-value').textContent = this.value;
});

// Add partner sidebar - secondary resolution slider
document.getElementById('sidebar-secondary-h3Resolution').addEventListener('input', function() {
    document.getElementById('sidebar-secondary-resolution-value').textContent = this.value;
});

// Add partner sidebar - secondary zones slider
document.getElementById('sidebar-secondary-numZones').addEventListener('input', function() {
    document.getElementById('sidebar-secondary-zones-value').textContent = this.value;
});

// Add partner sidebar - enable secondary checkbox
document.getElementById('sidebar-enable-secondary').addEventListener('change', function() {
    if (this.checked) {
        document.getElementById('secondary-fields').classList.remove('hidden');
    } else {
        document.getElementById('secondary-fields').classList.add('hidden');
    }
});

// Add partner sidebar - primary color sync to secondary
document.getElementById('sidebar-primary-color').addEventListener('input', function() {
    if (document.getElementById('sidebar-same-color').checked) {
        document.getElementById('sidebar-secondary-color').value = this.value;
    }
});

// Add partner sidebar - same color checkbox
document.getElementById('sidebar-same-color').addEventListener('change', function() {
    if (this.checked) {
        // Sync secondary color with primary and disable the color picker
        document.getElementById('sidebar-secondary-color').value = document.getElementById('sidebar-primary-color').value;
        document.getElementById('sidebar-secondary-color').disabled = true;
    } else {
        // Enable the secondary color picker for independent selection
        document.getElementById('sidebar-secondary-color').disabled = false;
    }
});

// Add partner sidebar - enable delivery area checkbox
document.getElementById('sidebar-enable-delivery-area').addEventListener('change', function() {
    if (this.checked) {
        document.getElementById('delivery-area-fields').classList.remove('hidden');
        // Uncheck "Same as primary" and set color to black
        document.getElementById('sidebar-same-color-delivery').checked = false;
        document.getElementById('sidebar-delivery-color').value = '#000000';
        document.getElementById('sidebar-delivery-color').disabled = false;
    } else {
        document.getElementById('delivery-area-fields').classList.add('hidden');
    }
});

// Add partner sidebar - primary color sync to delivery
document.getElementById('sidebar-primary-color').addEventListener('input', function() {
    if (document.getElementById('sidebar-same-color-delivery').checked) {
        document.getElementById('sidebar-delivery-color').value = this.value;
    }
});

// Add partner sidebar - same color for delivery checkbox
document.getElementById('sidebar-same-color-delivery').addEventListener('change', function() {
    if (this.checked) {
        // Sync delivery color with primary and disable the color picker
        document.getElementById('sidebar-delivery-color').value = document.getElementById('sidebar-primary-color').value;
        document.getElementById('sidebar-delivery-color').disabled = true;
    } else {
        // Enable the delivery color picker for independent selection
        document.getElementById('sidebar-delivery-color').disabled = false;
    }
});

// Partner form - submit
document.getElementById('partner-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const partnerId = document.getElementById('sidebar-partnerId').value.trim();
    const latitude = parseFloat(document.getElementById('sidebar-latitude').value);
    const longitude = parseFloat(document.getElementById('sidebar-longitude').value);
    const primaryH3Resolution = parseInt(document.getElementById('sidebar-primary-h3Resolution').value);
    const primaryNumZones = parseInt(document.getElementById('sidebar-primary-numZones').value);
    const primaryColor = document.getElementById('sidebar-primary-color').value;

    const enableSecondary = document.getElementById('sidebar-enable-secondary').checked;
    const secondaryH3Resolution = enableSecondary ? parseInt(document.getElementById('sidebar-secondary-h3Resolution').value) : undefined;
    const secondaryNumZones = enableSecondary ? parseInt(document.getElementById('sidebar-secondary-numZones').value) : undefined;
    const secondaryColor = enableSecondary ? document.getElementById('sidebar-secondary-color').value : undefined;

    // Delivery area data
    const enableDeliveryArea = document.getElementById('sidebar-enable-delivery-area').checked;
    let deliveryAreaContent = undefined;
    let deliveryAreaColor = undefined;
    
    if (enableDeliveryArea) {
        deliveryAreaContent = document.getElementById('sidebar-polygon-content').value.trim();
        if (!deliveryAreaContent) {
            alert("Please provide polygon content (KML or WKT) for the delivery area, or disable the delivery area option.");
            return;
        }
        deliveryAreaColor = document.getElementById('sidebar-delivery-color').value;
    }

    const partner = { 
        partnerId, 
        latitude, 
        longitude, 
        primaryH3Resolution, 
        primaryNumZones, 
        secondaryH3Resolution, 
        secondaryNumZones, 
        primaryColor, 
        secondaryColor,
        deliveryAreaContent,
        deliveryAreaColor
    };

    if (!validatePartner(partner)) {
        return;
    }

    if (editMode.isActive) {
        // Update existing partner
        updatePartner(editMode.partnerId, partner);
    } else {
        // Check if partner ID already exists
        if (partnersById[partnerId]) {
            alert(`Partner with ID "${partnerId}" already exists. Please use a different ID.`);
            return;
        }
        // Check if a partner already exists at this location
        const existingPartnerAtLocation = Object.values(partnersById).find(p => 
            p.latitude === latitude && p.longitude === longitude
        );
        if (existingPartnerAtLocation) {
            alert(`Partner "${existingPartnerAtLocation.partnerId}" already exists at this location (Lat: ${latitude}, Lon: ${longitude}).`);
            return;
        }
        // Add new partner
        addPartnerToMap(partner);
        // Increment counter after successful add
        partnerIdCounter++;
    }

    // Remove cross marker, close sidebar and reset form
    removeCrossMarker();
    const sidebar = document.getElementById('partner-form-sidebar');
    closeSidebar(sidebar);
    resetSidebarForm();
});

// Partner info sidebar - close button
document.getElementById('slide-close-btn').addEventListener('click', closePartnerSidebar);

// Partner info sidebar - edit button
document.getElementById('edit-partner-btn').addEventListener('click', function() {
    const partnerId = currentPartnerId;
    if (!partnerId) return;

    const partner = partnersById[partnerId];
    if (!partner) return;

    closePartnerSidebar();
    openSidebarForEdit(partner);
});

// Partner info sidebar - delete button
document.getElementById('delete-partner-btn').addEventListener('click', function() {
    const partnerId = currentPartnerId;
    if (!partnerId) return;

    const partner = partnersById[partnerId];
    if (!partner) return;

    const confirmed = confirm(`Are you sure you want to delete partner "${partnerId}"? This action cannot be undone.`);
    if (confirmed) {
        deletePartner(partnerId);
        closePartnerSidebar();
    }
});

// Partner info sidebar - toggle primary zone
document.getElementById('toggle-primary-zone').addEventListener('change', function() {
    if (!currentPartnerId) return;
    togglePrimaryHexagonsVisibility(currentPartnerId, this.checked);
    updateIntersectionToggleState(currentPartnerId);
});

// Partner info sidebar - toggle secondary zone
document.getElementById('toggle-secondary-zone').addEventListener('change', function() {
    if (!currentPartnerId) return;
    toggleSecondaryHexagonsVisibility(currentPartnerId, this.checked);
    updateIntersectionToggleState(currentPartnerId);
});

// Partner info sidebar - toggle delivery area
document.getElementById('toggle-delivery-area').addEventListener('change', function() {
    if (!currentPartnerId) return;
    toggleDeliveryAreaVisibility(currentPartnerId, this.checked);
    // Turn off intersection highlight when delivery area is hidden
    if (!this.checked) {
        toggleIntersectionHighlight(currentPartnerId, false);
    }
    updateIntersectionToggleState(currentPartnerId);
});

// Partner info sidebar - toggle intersection highlight
document.getElementById('toggle-intersection-highlight').addEventListener('change', function() {
    if (!currentPartnerId) return;
    toggleIntersectionHighlight(currentPartnerId, this.checked);
});

// Partner info sidebar - toggle limit delivery to primary
document.getElementById('toggle-limit-delivery').addEventListener('change', function() {
    if (!currentPartnerId) return;
    const partner = partnersById[currentPartnerId];
    if (!partner) return;
    
    // Update the partner's limitDeliveryToPrimary state
    partner.limitDeliveryToPrimary = this.checked;
    
    // Recompute intersections with the new setting
    computeHexagonIntersections(partner);
    
    // Check if intersection highlight is active
    const intersectionToggle = document.getElementById('toggle-intersection-highlight');
    const intersectionActive = intersectionToggle.checked && !intersectionToggle.disabled;
    
    // Directly update hexagon opacities on the map (keep highlight toggle state)
    // For primary hexagons
    partner.elements.primaryHexagons.forEach(hexagon => {
        const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
        if (isVisible) {
            const targetOpacity = (intersectionActive && hexagon.isIntersectedByDelivery) 
                ? PARTNER_CONSTANTS.INTERSECTION_OPACITY 
                : PARTNER_CONSTANTS.DEFAULT_OPACITY;
            hexagon.polygon.setStyle({
                fillOpacity: targetOpacity
            });
        }
    });
    
    // For secondary hexagons
    partner.elements.secondaryHexagons.forEach(hexagon => {
        const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
        if (isVisible) {
            const targetOpacity = (intersectionActive && hexagon.isIntersectedByDelivery) 
                ? PARTNER_CONSTANTS.INTERSECTION_OPACITY 
                : PARTNER_CONSTANTS.DEFAULT_OPACITY;
            hexagon.polygon.setStyle({
                fillOpacity: targetOpacity
            });
        }
    });
    
    // Update the statistics display
    updatePartnerSidebarContent(partner);
});

// ==========================================
// RIGHT-CLICK CONTEXT MENU
// ==========================================

/**
 * Creates a cross marker icon for location indicators.
 */
function createCrossMarkerIcon() {
    return L.divIcon({
        className: 'cross-marker',
        html: '<div class="cross-marker-icon"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

/**
 * Places a cross marker on the map at the specified coordinates.
 */
function placeCrossMarker(lat, lng) {
    removeCrossMarker();
    contextMenuState.crossMarker = L.marker([lat, lng], {
        icon: createCrossMarkerIcon(),
        zIndexOffset: 1000,
        interactive: false
    }).addTo(map);
}

/**
 * Removes the cross marker from the map.
 */
function removeCrossMarker() {
    if (contextMenuState.crossMarker) {
        map.removeLayer(contextMenuState.crossMarker);
        contextMenuState.crossMarker = null;
    }
}

/**
 * Checks if a point is inside a hexagon polygon using ray casting algorithm.
 */
function isPointInHexagon(lat, lng, hexagonPolygon) {
    const point = L.latLng(lat, lng);
    const bounds = hexagonPolygon.getBounds();
    
    // Quick bounds check
    if (!bounds.contains(point)) {
        return false;
    }
    
    // Detailed point-in-polygon check using ray casting
    const latlngs = hexagonPolygon.getLatLngs()[0];
    const n = latlngs.length;
    let inside = false;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = latlngs[i].lat;
        const yi = latlngs[i].lng;
        const xj = latlngs[j].lat;
        const yj = latlngs[j].lng;
        
        if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

/**
 * Checks if a point is inside a polygon using Turf.js.
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Array} polygonCoords - Array of [lat, lng] coordinates
 * @returns {boolean} True if point is inside polygon
 */
function isPointInPolygon(lat, lng, polygonCoords) {
    // Turf.js uses [lng, lat] format, so we need to convert
    const point = turf.point([lng, lat]);
    
    // Convert [lat, lng] coordinates to [lng, lat] for Turf.js
    const coords = polygonCoords.map(v => [v[1], v[0]]);
    // Close the ring (Turf.js requires closed rings)
    coords.push(coords[0]);
    
    const polygon = turf.polygon([coords]);
    return turf.booleanPointInPolygon(point, polygon);
}

/**
 * Checks if a hexagon intersects with a delivery area polygon using Turf.js.
 * Uses proper geospatial intersection detection that catches all cases:
 * - Vertex containment (any vertex of A inside B)
 * - Edge crossings (edges of A and B crossing)
 * - Partial overlap without vertex containment
 * - Full containment (A inside B or B inside A)
 * @param {Array} hexagonBoundary - H3 hexagon boundary (array of [lat, lng])
 * @param {Array} deliveryPolygonCoords - Delivery polygon coordinates (array of [lat, lng])
 * @returns {boolean} True if hexagon intersects with delivery area
 */
function isHexagonIntersectedByPolygon(hexagonBoundary, deliveryPolygonCoords) {
    // Turf.js uses [lng, lat] format, so we need to convert
    // Convert hexagon boundary from [lat, lng] to [lng, lat]
    const hexagonCoords = hexagonBoundary.map(v => [v[1], v[0]]);
    // Close the ring (Turf.js requires closed rings)
    hexagonCoords.push(hexagonCoords[0]);
    
    // Convert delivery polygon from [lat, lng] to [lng, lat]
    const deliveryCoords = deliveryPolygonCoords.map(v => [v[1], v[0]]);
    // Close the ring
    deliveryCoords.push(deliveryCoords[0]);
    
    // Create Turf.js polygons
    const hexagon = turf.polygon([hexagonCoords]);
    const deliveryArea = turf.polygon([deliveryCoords]);
    
    // Check for intersection or containment
    // intersects() catches: edge crossings, partial overlaps, vertex containment
    // contains() catches: one polygon fully inside the other (either direction)
    return turf.booleanIntersects(hexagon, deliveryArea) || 
           turf.booleanContains(deliveryArea, hexagon) ||
           turf.booleanContains(hexagon, deliveryArea);
}

/**
 * Checks if a hexagon is completely inside a polygon (e.g., a hole) using Turf.js.
 * This is used to exclude hexagons that fall within holes in delivery areas.
 * @param {Array} hexagonBoundary - H3 hexagon boundary (array of [lat, lng])
 * @param {Array} polygonCoords - Polygon coordinates (array of [lat, lng])
 * @returns {boolean} True if hexagon is completely inside the polygon
 */
function isHexagonCompletelyInsidePolygon(hexagonBoundary, polygonCoords) {
    // Convert hexagon boundary to Turf.js format [lng, lat]
    const hexagonCoords = hexagonBoundary.map(v => [v[1], v[0]]);
    hexagonCoords.push(hexagonCoords[0]); // Close the ring
    
    // Convert polygon from [lat, lng] to [lng, lat]
    const polyCoords = polygonCoords.map(v => [v[1], v[0]]);
    polyCoords.push(polyCoords[0]); // Close the ring
    
    try {
        const hexagon = turf.polygon([hexagonCoords]);
        const polygon = turf.polygon([polyCoords]);
        
        // Check if hexagon is completely within the polygon (hole)
        return turf.booleanWithin(hexagon, polygon);
    } catch (e) {
        return false;
    }
}

/**
 * Checks if the entire delivery area is inside the primary zone using Turf.js.
 * This is used to skip secondary zone intersection computation when
 * the delivery area is completely contained within the primary zone.
 * @param {Array} deliveryCoords - Array of [lat, lng] coordinates for all delivery polygon vertices
 * @param {Array} primaryHexagons - Array of primary hexagon objects
 * @returns {boolean} True if all delivery vertices are inside at least one primary hexagon
 */
function isDeliveryAreaInsidePrimaryZone(deliveryCoords, primaryHexagons) {
    if (!deliveryCoords || deliveryCoords.length === 0 || !primaryHexagons || primaryHexagons.length === 0) {
        return false;
    }
    
    // Build a multi-polygon from all primary hexagons for efficient batch checking
    const hexagonPolygons = primaryHexagons.map(hexagon => {
        const boundary = h3.cellToBoundary(hexagon.h3Index);
        // Convert [lat, lng] to [lng, lat] for Turf.js and close the ring
        const coords = boundary.map(v => [v[1], v[0]]);
        coords.push(coords[0]);
        return coords;
    });
    
    // Create a multi-polygon from all primary hexagons
    // Each hexagon is a single-ring polygon, so wrap each in an array for Turf.js format
    const primaryMultiPolygon = turf.multiPolygon(hexagonPolygons.map(p => [p]));
    
    // Check if all delivery vertices are inside the primary zone using Turf.js
    for (const vertex of deliveryCoords) {
        const [lat, lng] = vertex;
        // Turf.js uses [lng, lat] format
        const point = turf.point([lng, lat]);
        
        if (!turf.booleanPointInPolygon(point, primaryMultiPolygon)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Computes intersection state for all hexagons of a partner.
 * Updates the isIntersectedByDelivery property on each hexagon.
 * Takes into account holes in delivery polygons - hexagons inside holes
 * are marked as NOT intersected.
 * When limitDeliveryToPrimary is enabled AND the delivery area is 
 * completely inside the primary zone, secondary hexagons are marked 
 * as NOT intersected (optimization to avoid double-counting).
 * @param {Object} partnerObject - The partner object with elements
 */
function computeHexagonIntersections(partnerObject) {
    const deliveryPolygons = partnerObject.elements.deliveryAreaPolygons;
    
    // If no delivery area, mark all hexagons as not intersected
    if (!deliveryPolygons || deliveryPolygons.length === 0) {
        partnerObject.elements.primaryHexagons.forEach(hexagon => {
            hexagon.isIntersectedByDelivery = false;
        });
        partnerObject.elements.secondaryHexagons.forEach(hexagon => {
            hexagon.isIntersectedByDelivery = false;
        });
        return;
    }
    
    // Helper function to check if a hexagon intersects with delivery area (excluding holes)
    function checkHexagonIntersection(hexagon) {
        const hexBoundary = h3.cellToBoundary(hexagon.h3Index);
        
        // Check if hexagon intersects with ANY delivery polygon's outer boundary
        const intersectsOuter = deliveryPolygons.some(polyObj => {
            const latlngs = polyObj.polygon.getLatLngs()[0];
            const polyCoords = latlngs.map(ll => [ll.lat, ll.lng]);
            return isHexagonIntersectedByPolygon(hexBoundary, polyCoords);
        });
        
        // If not intersecting outer boundary, not intersected
        if (!intersectsOuter) return false;
        
        // Check if hexagon is completely inside ANY hole
        // If so, it should NOT be marked as intersected
        const insideHole = deliveryPolygons.some(polyObj => {
            const holes = polyObj.holes || [];
            return holes.some(hole => {
                return isHexagonCompletelyInsidePolygon(hexBoundary, hole);
            });
        });
        
        return !insideHole;
    }
    
    // Check primary hexagons
    partnerObject.elements.primaryHexagons.forEach(hexagon => {
        hexagon.isIntersectedByDelivery = checkHexagonIntersection(hexagon);
    });
    
    // Check if we should skip secondary intersection when delivery is inside primary
    // This is controlled by the limitDeliveryToPrimary toggle (default: true)
    const shouldLimitToPrimary = partnerObject.limitDeliveryToPrimary !== false; // Default to true if not set
    
    // Get all delivery polygon coordinates for checking if inside primary zone
    const allDeliveryCoords = [];
    deliveryPolygons.forEach(polyObj => {
        const latlngs = polyObj.polygon.getLatLngs()[0];
        latlngs.forEach(ll => {
            allDeliveryCoords.push([ll.lat, ll.lng]);
        });
    });
    
    // Check if delivery area is completely inside the primary zone
    const deliveryInsidePrimary = isDeliveryAreaInsidePrimaryZone(allDeliveryCoords, partnerObject.elements.primaryHexagons);
    
    // Check secondary hexagons - skip if limitDeliveryToPrimary is enabled AND delivery area is entirely inside primary zone
    if (shouldLimitToPrimary && deliveryInsidePrimary) {
        // Delivery area is completely inside primary zone and limit is enabled, 
        // so secondary hexagons are not intersected
        partnerObject.elements.secondaryHexagons.forEach(hexagon => {
            hexagon.isIntersectedByDelivery = false;
        });
    } else {
        // Either limit is disabled, or delivery area extends outside primary zone
        // Compute intersections normally
        partnerObject.elements.secondaryHexagons.forEach(hexagon => {
            hexagon.isIntersectedByDelivery = checkHexagonIntersection(hexagon);
        });
    }
}

/**
 * Finds all hexagons (standalone and partner) at a given location.
 */
function findHexagonsAtLocation(lat, lng) {
    const detectedHexagons = [];
    
    // Check standaloneHexagons
    Object.keys(standaloneHexagons).forEach(h3Index => {
        const hexagonData = standaloneHexagons[h3Index];
        if (isPointInHexagon(lat, lng, hexagonData.polygon)) {
            detectedHexagons.push({
                h3Index: h3Index,
                resolution: h3.getResolution(h3Index),
                source: 'standalone',
                color: hexagonData.polygon.options.color,
                zoneNumber: null
            });
        }
    });
    
    // Check partner hexagons
    Object.keys(partnersById).forEach(partnerId => {
        const partner = partnersById[partnerId];
        
        // Check primary hexagons
        partner.elements.primaryHexagons.forEach(hexagon => {
            if (isPointInHexagon(lat, lng, hexagon.polygon)) {
                detectedHexagons.push({
                    h3Index: hexagon.h3Index,
                    resolution: hexagon.h3Resolution,
                    partnerId: partnerId,
                    layerType: 'primary',
                    color: hexagon.polygon.options.color,
                    zoneNumber: hexagon.zoneNumber
                });
            }
        });
        
        // Check secondary hexagons
        partner.elements.secondaryHexagons.forEach(hexagon => {
            if (isPointInHexagon(lat, lng, hexagon.polygon)) {
                detectedHexagons.push({
                    h3Index: hexagon.h3Index,
                    resolution: hexagon.h3Resolution,
                    partnerId: partnerId,
                    layerType: 'secondary',
                    color: hexagon.polygon.options.color,
                    zoneNumber: hexagon.zoneNumber
                });
            }
        });
    });
    
    // Sort by resolution (highest first)
    detectedHexagons.sort((a, b) => b.resolution - a.resolution);
    
    return detectedHexagons;
}

/**
 * Displays the context menu at the specified position.
 */
function showContextMenu(x, y, lat, lng) {
    const contextMenu = document.getElementById('context-menu');
    const contextMenuHeader = document.getElementById('context-menu-header');
    const contextMenuCoords = document.getElementById('context-menu-coords');
    
    // Store coordinates
    contextMenuState.latitude = lat;
    contextMenuState.longitude = lng;
    
    // Update coordinates display
    contextMenuCoords.textContent = `Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)}`;
    contextMenuHeader.classList.remove('hidden');
    
    // Position the menu
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.remove('hidden');
    
    // Adjust position if menu goes off screen
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (menuRect.right > viewportWidth) {
        contextMenu.style.left = `${x - menuRect.width}px`;
    }
    if (menuRect.bottom > viewportHeight) {
        contextMenu.style.top = `${y - menuRect.height}px`;
    }
}

/**
 * Hides the context menu.
 */
function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.classList.add('hidden');
}

/**
 * Sets up the add partner form with optional pre-filled coordinates.
 * @param {number} [lat] - Optional latitude to pre-fill
 * @param {number} [lng] - Optional longitude to pre-fill
 */
function setupAddPartnerForm(lat, lng) {
    // Reset form and set edit mode to false
    editMode.isActive = false;
    editMode.partnerId = null;
    document.getElementById('partner-form-title').textContent = 'Add Partner';
    const submitButton = document.getElementById('partner-submit-btn');
    submitButton.textContent = 'Add';
    
    // Pre-fill coordinates only if provided
    document.getElementById('sidebar-partnerId').value = `partner${partnerIdCounter}`;
    if (lat !== undefined && lng !== undefined) {
        document.getElementById('sidebar-latitude').value = lat.toFixed(6);
        document.getElementById('sidebar-longitude').value = lng.toFixed(6);
    } else {
        document.getElementById('sidebar-latitude').value = '';
        document.getElementById('sidebar-longitude').value = '';
    }
    document.getElementById('sidebar-primary-h3Resolution').value = PARTNER_CONSTANTS.DEFAULT_PRIMARY_H3_RESOLUTION;
    document.getElementById('sidebar-primary-numZones').value = PARTNER_CONSTANTS.DEFAULT_PRIMARY_NUM_ZONES;
    document.getElementById('sidebar-primary-color').value = PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;
    document.getElementById('sidebar-primary-resolution-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_H3_RESOLUTION.toString();
    document.getElementById('sidebar-primary-zones-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_NUM_ZONES.toString();
    document.getElementById('sidebar-enable-secondary').checked = false;
    document.getElementById('secondary-fields').classList.add('hidden');
    document.getElementById('sidebar-secondary-h3Resolution').value = PARTNER_CONSTANTS.DEFAULT_SECONDARY_H3_RESOLUTION;
    document.getElementById('sidebar-secondary-numZones').value = PARTNER_CONSTANTS.DEFAULT_SECONDARY_NUM_ZONES;
    document.getElementById('sidebar-secondary-color').value = PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;
    document.getElementById('sidebar-secondary-resolution-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_H3_RESOLUTION.toString();
    document.getElementById('sidebar-secondary-zones-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_NUM_ZONES.toString();
    document.getElementById('sidebar-same-color').checked = true;
    document.getElementById('sidebar-secondary-color').disabled = true;
    
    // Reset delivery area fields
    document.getElementById('sidebar-enable-delivery-area').checked = false;
    document.getElementById('delivery-area-fields').classList.add('hidden');
    document.getElementById('sidebar-same-color-delivery').checked = true;
    document.getElementById('sidebar-delivery-color').disabled = true;
    document.getElementById('sidebar-delivery-color').value = PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;
    document.getElementById('sidebar-polygon-content').value = '';
}

/**
 * Opens the add partner sidebar with coordinates pre-filled.
 */
function openPartnerSidebarWithCoords(lat, lng) {
    closeAllSidebars();
    setupAddPartnerForm(lat, lng);
    placeCrossMarker(lat, lng);
    const sidebar = document.getElementById('partner-form-sidebar');
    openSidebar(sidebar);
}

/**
 * Opens the add partner sidebar with empty coordinates (for Tools button).
 */
function openPartnerSidebar() {
    closeAllSidebars();
    setupAddPartnerForm();
    const sidebar = document.getElementById('partner-form-sidebar');
    openSidebar(sidebar);
}

// Hide context menu on document click (outside menu)
document.addEventListener('click', function(e) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// Escape key handler - exit measurement mode
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isMeasuring) {
        stopMeasurement();
        const measurementToggle = document.getElementById('measurement-toggle');
        measurementToggle.innerHTML = '<i data-lucide="ruler" class="icon-btn"></i> Start Measurement';
        measurementToggle.style.backgroundColor = '';
        lucide.createIcons();
    }
});

// Context menu - "Add Partner Here" button
document.getElementById('context-menu-add-partner').addEventListener('click', function() {
    hideContextMenu();
    if (contextMenuState.latitude !== null && contextMenuState.longitude !== null) {
        openPartnerSidebarWithCoords(contextMenuState.latitude, contextMenuState.longitude);
    }
});

// Tools - "Add Partner" button
document.getElementById('tools-add-partner').addEventListener('click', function() {
    openPartnerSidebar();
});

// ==========================================
// CUSTOMER INFO SIDEBAR
// ==========================================

/**
 * Finds partners arriving at a given location.
 * For partners with delivery area: only hexagons intersected by delivery area are included
 * For partners without delivery area: all hexagons at the location are included
 */
function findPartnersArrivingAtLocation(lat, lng) {
    const arrivingPartners = {};
    
    // Check partner hexagons
    Object.keys(partnersById).forEach(partnerId => {
        const partner = partnersById[partnerId];
        const hasDeliveryArea = partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
        
        // Check primary hexagons
        partner.elements.primaryHexagons.forEach(hexagon => {
            if (isPointInHexagon(lat, lng, hexagon.polygon)) {
                // If partner has delivery area, only include if hexagon is intersected
                if (hasDeliveryArea && !hexagon.isIntersectedByDelivery) {
                    return; // Skip this hexagon
                }
                
                if (!arrivingPartners[partnerId]) {
                    arrivingPartners[partnerId] = {
                        partnerId: partnerId,
                        primaryColor: partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR,
                        secondaryColor: partner.secondaryColor,
                        hasDeliveryArea: hasDeliveryArea,
                        hexagons: []
                    };
                }
                
                arrivingPartners[partnerId].hexagons.push({
                    h3Index: hexagon.h3Index,
                    resolution: hexagon.h3Resolution,
                    layerType: 'primary',
                    zoneNumber: hexagon.zoneNumber,
                    color: hexagon.polygon.options.color,
                    isIntersectedByDelivery: hexagon.isIntersectedByDelivery
                });
            }
        });
        
        // Check secondary hexagons
        partner.elements.secondaryHexagons.forEach(hexagon => {
            if (isPointInHexagon(lat, lng, hexagon.polygon)) {
                // If partner has delivery area, only include if hexagon is intersected
                if (hasDeliveryArea && !hexagon.isIntersectedByDelivery) {
                    return; // Skip this hexagon
                }
                
                if (!arrivingPartners[partnerId]) {
                    arrivingPartners[partnerId] = {
                        partnerId: partnerId,
                        primaryColor: partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR,
                        secondaryColor: partner.secondaryColor,
                        hasDeliveryArea: hasDeliveryArea,
                        hexagons: []
                    };
                }
                
                arrivingPartners[partnerId].hexagons.push({
                    h3Index: hexagon.h3Index,
                    resolution: hexagon.h3Resolution,
                    layerType: 'secondary',
                    zoneNumber: hexagon.zoneNumber,
                    color: hexagon.polygon.options.color,
                    isIntersectedByDelivery: hexagon.isIntersectedByDelivery
                });
            }
        });
    });
    
    // Convert to array
    return Object.values(arrivingPartners);
}

/**
 * Updates the customer info sidebar content with detected hexagons.
 */
function updateCustomerInfoSidebarContent(lat, lng) {
    const customerInfoCoords = document.getElementById('customer-info-coords');
    const customerInfoHexagonList = document.getElementById('customer-info-hexagon-list');
    const customerInfoPartnerList = document.getElementById('customer-info-partner-list');
    const summaryHexagonCount = document.getElementById('summary-hexagon-count');
    const summaryPartnerCount = document.getElementById('summary-partner-count');
    
    // Place cross marker at customer info location
    placeCrossMarker(lat, lng);
    
    // Update coordinates display
    customerInfoCoords.textContent = `Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)}`;
    
    // Find hexagons at location
    const detectedHexagons = findHexagonsAtLocation(lat, lng);
    
    // Find partners arriving at location
    const arrivingPartners = findPartnersArrivingAtLocation(lat, lng);
    
    // Update summary counts based on partners ARRIVING at the location
    const arrivingHexagonCount = arrivingPartners.reduce((sum, p) => sum + p.hexagons.length, 0);
    summaryHexagonCount.textContent = arrivingHexagonCount;
    summaryPartnerCount.textContent = arrivingPartners.length;
    
    // Update partners arriving at location list
    customerInfoPartnerList.innerHTML = '';
    
    if (arrivingPartners.length > 0) {
        arrivingPartners.forEach(partner => {
            const partnerCard = document.createElement('div');
            partnerCard.className = 'bg-gray-50 rounded-xl p-4 border border-gray-200';
            
            // Build hexagons list HTML
            let hexagonsHtml = partner.hexagons.map(hex => {
                return `<div class="mt-2 pl-3 py-1.5 border-l-4 rounded-r bg-white" style="border-left-color: ${hex.color};">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-[11px] font-semibold text-gray-700">${hex.layerType}, zone ${hex.zoneNumber}</span>
                        <span class="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">H3 Res ${hex.resolution}</span>
                        <span class="text-[10px] text-gray-400 font-mono">${hex.h3Index}</span>
                    </div>
                </div>`;
            }).join('');
            
            // Delivery area indicator
            const deliveryIndicator = partner.hasDeliveryArea 
                ? '<span class="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Has delivery area</span>'
                : '<span class="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">No delivery area</span>';
            
            partnerCard.innerHTML = `
                <div class="flex items-center gap-3">
                    <i data-lucide="store" class="w-5 h-5 flex-shrink-0" style="color: ${partner.primaryColor};"></i>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-semibold text-gray-900">${partner.partnerId}</span>
                            ${deliveryIndicator}
                        </div>
                        <div class="text-[11px] text-gray-500 mt-1">${partner.hexagons.length} hexagon${partner.hexagons.length !== 1 ? 's' : ''} at this location</div>
                    </div>
                </div>
                ${hexagonsHtml}
            `;
            
            customerInfoPartnerList.appendChild(partnerCard);
        });
        
        // Initialize Lucide icons for the new content
        lucide.createIcons();
    } else {
        // No partners arriving
        const noPartnersMsg = document.createElement('div');
        noPartnersMsg.className = 'text-center py-8 text-gray-400';
        noPartnersMsg.innerHTML = `
            <i data-lucide="store" class="w-12 h-12 mx-auto mb-3 text-gray-300"></i>
            <p class="text-sm">No partners arriving at this location</p>
        `;
        customerInfoPartnerList.appendChild(noPartnersMsg);
        lucide.createIcons();
    }
    
    // Update hexagon list
    customerInfoHexagonList.innerHTML = '';
    
    if (detectedHexagons.length > 0) {
        // Group hexagons by H3 index
        const groupedHexagons = {};
        detectedHexagons.forEach(hexagon => {
            if (!groupedHexagons[hexagon.h3Index]) {
                groupedHexagons[hexagon.h3Index] = {
                    h3Index: hexagon.h3Index,
                    resolution: hexagon.resolution,
                    color: hexagon.color,
                    partners: [],
                    isStandalone: false
                };
            }
            
            if (hexagon.source === 'standalone') {
                groupedHexagons[hexagon.h3Index].isStandalone = true;
            } else {
                groupedHexagons[hexagon.h3Index].partners.push({
                    partnerId: hexagon.partnerId,
                    layerType: hexagon.layerType,
                    zoneNumber: hexagon.zoneNumber,
                    color: hexagon.color
                });
            }
        });
        
        // Convert to array and sort by resolution (highest first)
        const groupedArray = Object.values(groupedHexagons).sort((a, b) => b.resolution - a.resolution);
        
        groupedArray.forEach(group => {
            const hexagonCard = document.createElement('div');
            hexagonCard.className = 'bg-gray-50 rounded-xl p-4 border border-gray-200';
            hexagonCard.dataset.h3Index = group.h3Index;
            
            // Build partners list HTML - separate div for each partner with their color
            let partnersHtml = '';
            if (group.partners.length > 0) {
                partnersHtml = group.partners.map(p => {
                    return `<div class="mt-3 pl-3 py-2 border-l-4 rounded-r bg-white" style="border-left-color: ${p.color};">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-[13px] font-semibold text-gray-900">${p.partnerId}</span>
                            <span class="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">${p.layerType}, zone ${p.zoneNumber}</span>
                        </div>
                    </div>`;
                }).join('');
            }
            
            // Build standalone indicator
            let standaloneHtml = '';
            if (group.isStandalone && group.partners.length === 0) {
                standaloneHtml = '<div class="mt-3 pl-3 py-2 border-l-4 border-l-gray-400 rounded-r bg-gray-100"><div class="text-[13px] text-gray-500 italic">Standalone hexagon</div></div>';
            } else if (group.isStandalone) {
                standaloneHtml = '<div class="mt-2 pl-3 py-1 border-l-4 border-l-gray-400 rounded-r bg-gray-100"><div class="text-xs text-gray-500 italic">Also: standalone</div></div>';
            }
            
            hexagonCard.innerHTML = `
                <div class="flex items-center gap-3">
                    <i data-lucide="hexagon" class="w-5 h-5 flex-shrink-0" style="color: ${group.color};"></i>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-mono text-gray-900 break-all">${group.h3Index}</div>
                        <div class="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block mt-1">H3 Res ${group.resolution}</div>
                    </div>
                </div>
                ${partnersHtml}
                ${standaloneHtml}
            `;
            
            customerInfoHexagonList.appendChild(hexagonCard);
        });
        
        // Initialize Lucide icons for the new content
        lucide.createIcons();
    } else {
        // No hexagons found
        const noHexagonsMsg = document.createElement('div');
        noHexagonsMsg.className = 'text-center py-8 text-gray-400';
        noHexagonsMsg.innerHTML = `
            <i data-lucide="hexagon" class="w-12 h-12 mx-auto mb-3 text-gray-300"></i>
            <p class="text-sm">No hexagons at this location</p>
        `;
        customerInfoHexagonList.appendChild(noHexagonsMsg);
        lucide.createIcons();
    }
}

/**
 * Shows the customer info sidebar with hexagon detection.
 */
function showCustomerInfoSidebar(lat, lng) {
    closeAllSidebars();
    updateCustomerInfoSidebarContent(lat, lng);
    const customerInfoSidebar = document.getElementById('customer-info-sidebar');
    openSidebar(customerInfoSidebar);
}

/**
 * Closes the customer info sidebar.
 */
function closeCustomerInfoSidebar() {
    const customerInfoSidebar = document.getElementById('customer-info-sidebar');
    closeSidebar(customerInfoSidebar);
    removeCrossMarker();
}

// Context menu - "Customer Info" button
document.getElementById('context-menu-customer-info').addEventListener('click', function() {
    hideContextMenu();
    if (contextMenuState.latitude !== null && contextMenuState.longitude !== null) {
        showCustomerInfoSidebar(contextMenuState.latitude, contextMenuState.longitude);
    }
});

// Customer info sidebar - close button
document.getElementById('customer-info-close-btn').addEventListener('click', closeCustomerInfoSidebar);

// Drawer overlay - click to close all sidebars
document.getElementById('drawer-overlay').addEventListener('click', closeAllSidebars);

// ==========================================
// SIDEBAR ANIMATION HELPERS
// ==========================================

/**
 * Closes a sidebar with slide-out animation.
 */
function closeSidebar(sidebarElement) {
    // For right-side drawers, add translate-x-full to slide out
    sidebarElement.classList.add('translate-x-full');
    // Hide overlay
    hideDrawerOverlay();
}

/**
 * Opens a sidebar with slide-in animation.
 */
function openSidebar(sidebarElement) {
    // Remove translate-x-full to slide in
    sidebarElement.classList.remove('translate-x-full');
    // Show overlay
    showDrawerOverlay();
}

/**
 * Shows the drawer overlay.
 */
function showDrawerOverlay() {
    const overlay = document.getElementById('drawer-overlay');
    overlay.classList.remove('opacity-0', 'pointer-events-none');
}

/**
 * Hides the drawer overlay.
 */
function hideDrawerOverlay() {
    const overlay = document.getElementById('drawer-overlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
}

/**
 * Closes all sidebars and removes cross marker.
 */
function closeAllSidebars() {
    const helpSidebar = document.getElementById('help-sidebar');
    const partnerFormSidebar = document.getElementById('partner-form-sidebar');
    const customerInfoSidebar = document.getElementById('customer-info-sidebar');
    const partnerInfoSidebar = document.getElementById('partner-info-sidebar');
    
    closeSidebar(helpSidebar);
    closeSidebar(partnerFormSidebar);
    closeSidebar(customerInfoSidebar);
    closeSidebar(partnerInfoSidebar);
    
    // Reset currentPartnerId when closing partner info sidebar
    currentPartnerId = null;
    
    // Remove cross marker when closing all sidebars
    removeCrossMarker();
}

// ==========================================
// DELIVERY AREA DRAWING MODE
// ==========================================

const DELIVERY_AREA_CONSTANTS = {
    LINE_COLOR: '#15489a',
    LINE_WEIGHT: 4,
    LINE_OPACITY: 0.8,
    TEMP_LINE_COLOR: '#15489a',
    TEMP_LINE_WEIGHT: 4,
    TEMP_LINE_OPACITY: 0.8,
    TEMP_LINE_DASH_ARRAY: '8, 8',
    POLYGON_FILL_COLOR: '#15489a',
    SNAP_TOLERANCE_PIXELS: 20
};

/**
 * Creates a start point marker icon for delivery area drawing.
 */
function createDeliveryAreaStartIcon(isNearStart = false) {
    const scale = isNearStart ? 'scale(1.3)' : 'scale(1)';
    return L.divIcon({
        className: 'delivery-area-start-marker',
        html: `<div class="delivery-area-start-marker-icon ${isNearStart ? 'near-start' : ''}" style="transform: ${scale};"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

/**
 * Creates a vertex marker icon for delivery area polygon points.
 */
function createDeliveryAreaVertexIcon() {
    return L.divIcon({
        className: 'delivery-area-vertex-marker',
        html: '<div class="delivery-area-vertex-marker"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
}

/**
 * Activates delivery area drawing mode.
 */
function startDeliveryAreaMode() {
    // Remember if there was a cross marker before starting
    deliveryAreaHadCrossMarker = !!contextMenuState.crossMarker;
    
    // Clear any existing pending delivery area polygons from previous sessions
    clearPendingDeliveryAreaPolygons();
    
    // Hide the partner form sidebar
    const partnerFormSidebar = document.getElementById('partner-form-sidebar');
    closeSidebar(partnerFormSidebar);
    
    // Collapse controls panel on mobile
    setControlsCollapsed(true);
    
    // Initialize drawing state
    deliveryAreaMode = true;
    deliveryAreaPoints = [];
    deliveryAreaLines = [];
    deliveryAreaTempLine = null;
    deliveryAreaStartMarker = null;
    deliveryAreaVertexMarkers = [];
    deliveryAreaNearStartPoint = false;
    
    // Disable all controls in the controls panel
    const controlsPanel = document.getElementById('controls');
    controlsPanel.classList.add('controls-disabled');
    
    // Disable all interactive elements within the controls panel
    const interactiveElements = controlsPanel.querySelectorAll('button, input, label');
    interactiveElements.forEach(el => {
        el.style.pointerEvents = 'none';
    });
    
    // Disable partner marker clicks
    Object.values(partnersById).forEach(partner => {
        if (partner.marker) {
            partner.marker.off('click');
        }
    });
    
    // Show measurement overlay (for dimming effect)
    document.getElementById('measurement-overlay').classList.remove('hidden');
    
    // Show delivery area mode indicator
    const indicator = document.getElementById('delivery-area-mode-indicator');
    indicator.classList.remove('hidden');
    
    // Re-initialize Lucide icons for the indicator
    lucide.createIcons();
}

/**
 * Exits delivery area drawing mode and cleans up.
 */
function exitDeliveryAreaMode() {
    deliveryAreaMode = false;
    
    // Clear all drawing elements
    clearDeliveryAreaDrawing();
    
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
    
    // Re-enable partner marker clicks
    Object.values(partnersById).forEach(partner => {
        if (partner.marker) {
            partner.marker.on('click', function() {
                showPartnerSidebar(partner.partnerId);
            });
        }
    });
    
    // Hide measurement overlay
    document.getElementById('measurement-overlay').classList.add('hidden');
    
    // Hide delivery area mode indicator
    const indicator = document.getElementById('delivery-area-mode-indicator');
    indicator.classList.add('hidden');
    
    // Hide export dropdown
    document.getElementById('delivery-area-export-dropdown').classList.add('hidden');
    
    // Remove pulse animation from Export button
    const exportBtn = document.getElementById('delivery-area-export-btn');
    exportBtn.classList.remove('animate-pulse-custom');
}

/**
 * Clears all delivery area drawing elements from the map.
 */
function clearDeliveryAreaDrawing() {
    // Clear temporary line
    if (deliveryAreaTempLine) {
        map.removeLayer(deliveryAreaTempLine);
        deliveryAreaTempLine = null;
    }
    
    // Clear all lines
    deliveryAreaLines.forEach(line => {
        map.removeLayer(line);
    });
    deliveryAreaLines = [];
    
    // Clear start marker
    if (deliveryAreaStartMarker) {
        map.removeLayer(deliveryAreaStartMarker);
        deliveryAreaStartMarker = null;
    }
    
    // Clear vertex markers
    deliveryAreaVertexMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    deliveryAreaVertexMarkers = [];
    
    // Clear all completed polygons (multi-polygon support)
    deliveryAreaCompletedPolygons.forEach(polyObj => {
        if (polyObj.layer) {
            map.removeLayer(polyObj.layer);
        }
        if (polyObj.closingLine) {
            map.removeLayer(polyObj.closingLine);
        }
    });
    deliveryAreaCompletedPolygons = [];
    
    // Clear points
    deliveryAreaPoints = [];
    deliveryAreaNearStartPoint = false;
}

/**
 * Removes the last point from the delivery area drawing.
 * Allows users to undo mistakes while drawing.
 */
function removeLastDeliveryAreaPoint() {
    if (deliveryAreaPoints.length === 0) return;
    
    // Remove the last point
    deliveryAreaPoints.pop();
    
    // Reset near start point indicator
    deliveryAreaNearStartPoint = false;
    if (deliveryAreaStartMarker) {
        deliveryAreaStartMarker.setIcon(createDeliveryAreaStartIcon(false));
    }
    
    // If no points left, remove the start marker
    if (deliveryAreaPoints.length === 0) {
        if (deliveryAreaStartMarker) {
            map.removeLayer(deliveryAreaStartMarker);
            deliveryAreaStartMarker = null;
        }
        // Clear temporary line if exists
        if (deliveryAreaTempLine) {
            map.removeLayer(deliveryAreaTempLine);
            deliveryAreaTempLine = null;
        }
        return;
    }
    
    // If only one point left, remove the last vertex marker and last line
    if (deliveryAreaPoints.length === 1) {
        // Remove the last vertex marker
        if (deliveryAreaVertexMarkers.length > 0) {
            const lastVertexMarker = deliveryAreaVertexMarkers.pop();
            map.removeLayer(lastVertexMarker);
        }
        
        // Remove the last line
        if (deliveryAreaLines.length > 0) {
            const lastLine = deliveryAreaLines.pop();
            map.removeLayer(lastLine);
        }
        
        // Clear temporary line
        if (deliveryAreaTempLine) {
            map.removeLayer(deliveryAreaTempLine);
            deliveryAreaTempLine = null;
        }
        return;
    }
    
    // For 2+ points remaining: remove last vertex marker and last line
    if (deliveryAreaVertexMarkers.length > 0) {
        const lastVertexMarker = deliveryAreaVertexMarkers.pop();
        map.removeLayer(lastVertexMarker);
    }
    
    if (deliveryAreaLines.length > 0) {
        const lastLine = deliveryAreaLines.pop();
        map.removeLayer(lastLine);
    }
    
    // Update temporary line to connect to the new last point
    // (The temporary line will be updated on the next mouse move event)
    if (deliveryAreaTempLine) {
        map.removeLayer(deliveryAreaTempLine);
        deliveryAreaTempLine = null;
    }
}

/**
 * Cancels delivery area mode and returns to partner form.
 */
function cancelDeliveryAreaMode() {
    exitDeliveryAreaMode();
    
    // Restore cross marker if it was there before
    if (deliveryAreaHadCrossMarker) {
        const lat = parseFloat(document.getElementById('sidebar-latitude').value);
        const lng = parseFloat(document.getElementById('sidebar-longitude').value);
        if (!isNaN(lat) && !isNaN(lng)) {
            placeCrossMarker(lat, lng);
        }
    }
    
    // Show the partner form sidebar again
    const partnerFormSidebar = document.getElementById('partner-form-sidebar');
    openSidebar(partnerFormSidebar);
}

/**
 * Handles click events during delivery area drawing mode.
 */
function handleDeliveryAreaClick(e) {
    if (!deliveryAreaMode) return;
    
    const { lat, lng } = e.latlng;
    
    // Check if we're near the start point and have at least 3 points (minimum for polygon)
    if (deliveryAreaPoints.length >= 3 && deliveryAreaNearStartPoint) {
        // Close the polygon
        finishDeliveryAreaPolygon();
        return;
    }
    
    // Add new point
    deliveryAreaPoints.push({ lat, lng });
    
    // If this is the first point, add start marker
    if (deliveryAreaPoints.length === 1) {
        deliveryAreaStartMarker = L.marker([lat, lng], {
            icon: createDeliveryAreaStartIcon(false),
            zIndexOffset: 1000,
            interactive: false
        }).addTo(map);
    } else {
        // Add vertex marker for subsequent points
        const vertexMarker = L.marker([lat, lng], {
            icon: createDeliveryAreaVertexIcon(),
            zIndexOffset: 999,
            interactive: false
        }).addTo(map);
        deliveryAreaVertexMarkers.push(vertexMarker);
        
        // Draw line from previous point to new point
        const prevPoint = deliveryAreaPoints[deliveryAreaPoints.length - 2];
        const line = L.polyline([[prevPoint.lat, prevPoint.lng], [lat, lng]], {
            color: DELIVERY_AREA_CONSTANTS.LINE_COLOR,
            weight: DELIVERY_AREA_CONSTANTS.LINE_WEIGHT,
            opacity: DELIVERY_AREA_CONSTANTS.LINE_OPACITY,
            interactive: false
        }).addTo(map);
        deliveryAreaLines.push(line);
    }
}

/**
 * Handles mouse move events during delivery area drawing mode.
 */
function handleDeliveryAreaMouseMove(e) {
    if (!deliveryAreaMode || deliveryAreaPoints.length === 0) return;
    
    const { lat, lng } = e.latlng;
    const lastPoint = deliveryAreaPoints[deliveryAreaPoints.length - 1];
    
    // Remove existing temporary line
    if (deliveryAreaTempLine) {
        map.removeLayer(deliveryAreaTempLine);
    }
    
    // Create new temporary line from last point to cursor
    deliveryAreaTempLine = L.polyline([[lastPoint.lat, lastPoint.lng], [lat, lng]], {
        color: DELIVERY_AREA_CONSTANTS.TEMP_LINE_COLOR,
        weight: DELIVERY_AREA_CONSTANTS.TEMP_LINE_WEIGHT,
        opacity: DELIVERY_AREA_CONSTANTS.TEMP_LINE_OPACITY,
        dashArray: DELIVERY_AREA_CONSTANTS.TEMP_LINE_DASH_ARRAY,
        interactive: false
    }).addTo(map);
    
    // Check if cursor is near the start point (for closing the polygon)
    if (deliveryAreaPoints.length >= 3) {
        const startPoint = deliveryAreaPoints[0];
        const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
        const currentLatLng = L.latLng(lat, lng);
        
        // Calculate pixel distance to start point
        const startPointPixels = map.latLngToContainerPoint(startLatLng);
        const currentPointPixels = map.latLngToContainerPoint(currentLatLng);
        const pixelDistance = Math.sqrt(
            Math.pow(startPointPixels.x - currentPointPixels.x, 2) +
            Math.pow(startPointPixels.y - currentPointPixels.y, 2)
        );
        
        // Check if within snap tolerance
        const wasNearStart = deliveryAreaNearStartPoint;
        deliveryAreaNearStartPoint = pixelDistance <= DELIVERY_AREA_CONSTANTS.SNAP_TOLERANCE_PIXELS;
        
        // Update start marker appearance if near state changed
        if (wasNearStart !== deliveryAreaNearStartPoint && deliveryAreaStartMarker) {
            deliveryAreaStartMarker.setIcon(createDeliveryAreaStartIcon(deliveryAreaNearStartPoint));
        }
    }
}

/**
 * Finishes the delivery area polygon and continues drawing mode for multi-polygon support.
 */
function finishDeliveryAreaPolygon() {
    // Store the current polygon points before clearing
    const completedPoints = [...deliveryAreaPoints];
    
    // Create polygon outline only (no fill)
    const polygonCoords = completedPoints.map(p => [p.lat, p.lng]);
    const completedPolygon = L.polygon(polygonCoords, {
        color: DELIVERY_AREA_CONSTANTS.LINE_COLOR,
        fillColor: DELIVERY_AREA_CONSTANTS.POLYGON_FILL_COLOR,
        fillOpacity: 0, // No fill
        weight: DELIVERY_AREA_CONSTANTS.LINE_WEIGHT,
        interactive: false
    }).addTo(map);
    
    // Store the completed polygon (points + layer) for multi-polygon support
    deliveryAreaCompletedPolygons.push({
        points: completedPoints,
        layer: completedPolygon
    });
    
    // Remove temporary line
    if (deliveryAreaTempLine) {
        map.removeLayer(deliveryAreaTempLine);
        deliveryAreaTempLine = null;
    }
    
    // Draw closing line from last point to start point
    const lastPoint = completedPoints[completedPoints.length - 1];
    const startPoint = completedPoints[0];
    const closingLine = L.polyline([[lastPoint.lat, lastPoint.lng], [startPoint.lat, startPoint.lng]], {
        color: DELIVERY_AREA_CONSTANTS.LINE_COLOR,
        weight: DELIVERY_AREA_CONSTANTS.LINE_WEIGHT,
        opacity: DELIVERY_AREA_CONSTANTS.LINE_OPACITY,
        interactive: false
    }).addTo(map);
    
    // Store closing line with the polygon (for cleanup later)
    deliveryAreaCompletedPolygons[deliveryAreaCompletedPolygons.length - 1].closingLine = closingLine;
    
    // Clear current drawing state but keep drawing mode active
    // Clear all lines
    deliveryAreaLines.forEach(line => {
        map.removeLayer(line);
    });
    deliveryAreaLines = [];
    
    // Clear start marker
    if (deliveryAreaStartMarker) {
        map.removeLayer(deliveryAreaStartMarker);
        deliveryAreaStartMarker = null;
    }
    
    // Clear vertex markers
    deliveryAreaVertexMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    deliveryAreaVertexMarkers = [];
    
    // Clear points for new polygon
    deliveryAreaPoints = [];
    deliveryAreaNearStartPoint = false;
    
    // Keep drawing mode active for multi-polygon support
    // User can immediately start drawing another polygon or save
    
    // Add pulse animation to Export button
    const exportBtn = document.getElementById('delivery-area-export-btn');
    exportBtn.classList.add('animate-pulse-custom');
}

/**
 * Checks if one polygon is contained within another using Turf.js.
 * @param {Array} innerPoints - Array of {lat, lng} points for the potential inner polygon
 * @param {Array} outerPoints - Array of {lat, lng} points for the potential outer polygon
 * @returns {boolean} True if innerPoints polygon is inside outerPoints polygon
 */
function isPolygonInsidePolygon(innerPoints, outerPoints) {
    // Convert to Turf.js format [lng, lat]
    const innerCoords = innerPoints.map(p => [p.lng, p.lat]);
    innerCoords.push(innerCoords[0]); // Close the ring
    
    const outerCoords = outerPoints.map(p => [p.lng, p.lat]);
    outerCoords.push(outerCoords[0]); // Close the ring
    
    try {
        const innerPolygon = turf.polygon([innerCoords]);
        const outerPolygon = turf.polygon([outerCoords]);
        
        // Check if all vertices of inner are inside outer
        return turf.booleanWithin(innerPolygon, outerPolygon);
    } catch (e) {
        return false;
    }
}

/**
 * Groups polygons by containment relationship.
 * Returns an array of groups, each containing {outer, holes: []}
 * @param {Array} polygonsArray - Array of polygon point arrays
 * @returns {Array} Array of polygon groups with outer and holes
 */
function groupPolygonsByContainment(polygonsArray) {
    if (polygonsArray.length === 0) return [];
    if (polygonsArray.length === 1) {
        return [{ outer: polygonsArray[0], holes: [] }];
    }
    
    // Build containment graph
    const containment = {}; // polygon index -> array of indices it contains
    const containedBy = {}; // polygon index -> index that contains it (or -1 if none)
    
    polygonsArray.forEach((_, i) => {
        containment[i] = [];
        containedBy[i] = -1;
    });
    
    // Check all pairs for containment
    for (let i = 0; i < polygonsArray.length; i++) {
        for (let j = 0; j < polygonsArray.length; j++) {
            if (i !== j) {
                if (isPolygonInsidePolygon(polygonsArray[j], polygonsArray[i])) {
                    // polygon j is inside polygon i
                    containment[i].push(j);
                }
            }
        }
    }
    
    // For each polygon, find its direct container (the smallest polygon that contains it)
    for (let i = 0; i < polygonsArray.length; i++) {
        let smallestContainer = -1;
        let smallestArea = Infinity;
        
        for (let j = 0; j < polygonsArray.length; j++) {
            if (i !== j && containment[j].includes(i)) {
                // j contains i, check if it's smaller than current smallest
                const area = calculatePolygonArea(polygonsArray[j]);
                if (area < smallestArea) {
                    smallestArea = area;
                    smallestContainer = j;
                }
            }
        }
        containedBy[i] = smallestContainer;
    }
    
    // Build groups: outer polygons (not contained by any other) with their direct holes
    const groups = [];
    const processed = new Set();
    
    for (let i = 0; i < polygonsArray.length; i++) {
        if (containedBy[i] === -1) {
            // This is an outer polygon
            const holes = containment[i]
                .filter(j => containedBy[j] === i) // direct children only
                .map(j => polygonsArray[j]);
            
            groups.push({
                outer: polygonsArray[i],
                holes: holes
            });
            processed.add(i);
        }
    }
    
    return groups;
}

/**
 * Calculates the approximate area of a polygon.
 * @param {Array} points - Array of {lat, lng} points
 * @returns {number} Approximate area (square degrees)
 */
function calculatePolygonArea(points) {
    if (points.length < 3) return 0;
    
    // Convert to Turf.js format and calculate area
    const coords = points.map(p => [p.lng, p.lat]);
    coords.push(coords[0]); // Close the ring
    
    try {
        const polygon = turf.polygon([coords]);
        return turf.area(polygon);
    } catch (e) {
        return 0;
    }
}

/**
 * Converts a polygon group (outer + holes) to WKT POLYGON format.
 */
function polygonGroupToWKT(group) {
    const { outer, holes } = group;
    
    // Outer ring
    const outerCoords = outer.map(p => `${p.lng} ${p.lat}`);
    outerCoords.push(`${outer[0].lng} ${outer[0].lat}`);
    
    // Inner rings (holes)
    const innerRings = holes.map(hole => {
        const coords = hole.map(p => `${p.lng} ${p.lat}`);
        coords.push(`${hole[0].lng} ${hole[0].lat}`);
        return `(${coords.join(', ')})`;
    });
    
    const allRings = [`(${outerCoords.join(', ')})`, ...innerRings];
    return `POLYGON(${allRings.join(', ')})`;
}

/**
 * Converts a single polygon's coordinates to WKT format.
 */
function polygonToWKT(points) {
    if (points.length < 3) return '';
    
    // WKT format: POLYGON((lon1 lat1, lon2 lat2, ..., lon1 lat1))
    const coords = points.map(p => `${p.lng} ${p.lat}`);
    // Close the polygon by repeating the first point
    coords.push(`${points[0].lng} ${points[0].lat}`);
    
    return `POLYGON((${coords.join(', ')}))`;
}

/**
 * Converts multiple polygons to WKT format with automatic hole detection.
 */
function multiPolygonToWKT(polygonsArray) {
    if (polygonsArray.length === 0) return '';
    if (polygonsArray.length === 1) {
        return polygonToWKT(polygonsArray[0]);
    }
    
    // Group polygons by containment (detect holes)
    const groups = groupPolygonsByContainment(polygonsArray);
    
    // If single group with holes, output as single POLYGON
    if (groups.length === 1) {
        return polygonGroupToWKT(groups[0]);
    }
    
    // Multiple groups - output as MULTIPOLYGON
    const polygonStrings = groups.map(group => {
        const { outer, holes } = group;
        
        // Outer ring
        const outerCoords = outer.map(p => `${p.lng} ${p.lat}`);
        outerCoords.push(`${outer[0].lng} ${outer[0].lat}`);
        
        // Inner rings (holes)
        const innerRings = holes.map(hole => {
            const coords = hole.map(p => `${p.lng} ${p.lat}`);
            coords.push(`${hole[0].lng} ${hole[0].lat}`);
            return `(${coords.join(', ')})`;
        });
        
        const allRings = [`(${outerCoords.join(', ')})`, ...innerRings];
        return `(${allRings.join(', ')})`;
    });
    
    return `MULTIPOLYGON(${polygonStrings.join(', ')})`;
}

/**
 * Converts a polygon group (outer + holes) to KML format with innerBoundaryIs.
 */
function polygonGroupToKML(group, name = 'Delivery Area') {
    const { outer, holes } = group;
    
    // Outer boundary coordinates
    const outerCoords = outer.map(p => `${p.lng},${p.lat},0`);
    outerCoords.push(`${outer[0].lng},${outer[0].lat},0`);
    
    // Build inner boundaries (holes)
    let innerBoundariesXml = '';
    if (holes && holes.length > 0) {
        innerBoundariesXml = holes.map(hole => {
            const holeCoords = hole.map(p => `${p.lng},${p.lat},0`);
            holeCoords.push(`${hole[0].lng},${hole[0].lat},0`);
            return `        <innerBoundaryIs>
          <LinearRing>
            <coordinates>${holeCoords.join(' ')}</coordinates>
          </LinearRing>
        </innerBoundaryIs>`;
        }).join('\n');
    }
    
    return `    <Placemark>
      <name>${name}</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${outerCoords.join(' ')}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
${innerBoundariesXml}
      </Polygon>
    </Placemark>`;
}

/**
 * Converts a single polygon's coordinates to KML format.
 */
function polygonToKML(points) {
    if (points.length < 3) return '';
    
    // KML format: coordinates are lon,lat,alt (altitude is optional)
    // Close the polygon by repeating the first point
    const coords = points.map(p => `${p.lng},${p.lat},0`);
    coords.push(`${points[0].lng},${points[0].lat},0`);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Delivery Area</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coords.join(' ')}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
}

/**
 * Converts multiple polygons to KML format with automatic hole detection.
 */
function multiPolygonToKML(polygonsArray) {
    if (polygonsArray.length === 0) return '';
    if (polygonsArray.length === 1) {
        return polygonToKML(polygonsArray[0]);
    }
    
    // Group polygons by containment (detect holes)
    const groups = groupPolygonsByContainment(polygonsArray);
    
    // Build placemarks for each group
    const placemarks = groups.map((group, index) => {
        const name = groups.length === 1 ? 'Delivery Area' : `Delivery Area ${index + 1}`;
        return polygonGroupToKML(group, name);
    }).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
${placemarks}
  </Document>
</kml>`;
}

/**
 * Removes the last completed polygon from the delivery area.
 * Used for undo functionality in multi-polygon mode.
 */
function removeLastCompletedPolygon() {
    if (deliveryAreaCompletedPolygons.length === 0) return;
    
    const lastPolygon = deliveryAreaCompletedPolygons.pop();
    
    // Remove the polygon layer from map
    if (lastPolygon.layer) {
        map.removeLayer(lastPolygon.layer);
    }
    
    // Remove the closing line from map
    if (lastPolygon.closingLine) {
        map.removeLayer(lastPolygon.closingLine);
    }
    
    // If no more completed polygons, remove pulse animation from Save button
    if (deliveryAreaCompletedPolygons.length === 0) {
        const exportBtn = document.getElementById('delivery-area-export-btn');
        exportBtn.classList.remove('animate-pulse-custom');
    }
}

/**
 * Clears all pending delivery area polygons from the map.
 * Called when the user cancels partner creation or successfully creates a partner.
 */
function clearPendingDeliveryAreaPolygons() {
    pendingDeliveryAreaPolygons.forEach(polyObj => {
        if (polyObj.layer) {
            map.removeLayer(polyObj.layer);
        }
        if (polyObj.closingLine) {
            map.removeLayer(polyObj.closingLine);
        }
    });
    pendingDeliveryAreaPolygons = [];
}

/**
 * Saves the delivery area in the specified format.
 * Handles both single and multi-polygon cases.
 * Keeps the drawn polygons visible as pending polygons.
 */
function exportDeliveryArea(format) {
    // Combine completed polygons with current drawing (if any)
    const allPolygons = [...deliveryAreaCompletedPolygons.map(p => p.points)];
    
    // Add current drawing if it has enough points
    if (deliveryAreaPoints.length >= 3) {
        allPolygons.push([...deliveryAreaPoints]);
    }
    
    // Check if we have any valid polygons
    if (allPolygons.length === 0) {
        alert('Please draw at least one polygon with 3 or more points before saving.');
        return;
    }
    
    let content = '';
    if (format === 'wkt') {
        content = multiPolygonToWKT(allPolygons);
    } else if (format === 'kml') {
        content = multiPolygonToKML(allPolygons);
    }
    
    // Update the textarea
    document.getElementById('sidebar-polygon-content').value = content;
    
    // Transfer completed polygons to pending polygons (keep them visible on map)
    // First clear any existing pending polygons
    clearPendingDeliveryAreaPolygons();
    
    // Move the completed polygons to pending state
    pendingDeliveryAreaPolygons = [...deliveryAreaCompletedPolygons];
    
    // Clear the drawing state arrays (but don't remove the layers since they're now pending)
    deliveryAreaCompletedPolygons = [];
    
    // Exit delivery area mode (without clearing the now-pending polygons)
    deliveryAreaMode = false;
    
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
    
    // Re-enable partner marker clicks
    Object.values(partnersById).forEach(partner => {
        if (partner.marker) {
            partner.marker.on('click', function() {
                showPartnerSidebar(partner.partnerId);
            });
        }
    });
    
    // Hide measurement overlay
    document.getElementById('measurement-overlay').classList.add('hidden');
    
    // Hide delivery area mode indicator
    const indicator = document.getElementById('delivery-area-mode-indicator');
    indicator.classList.add('hidden');
    
    // Hide export dropdown
    document.getElementById('delivery-area-export-dropdown').classList.add('hidden');
    
    // Remove pulse animation from Export button
    const exportBtn = document.getElementById('delivery-area-export-btn');
    exportBtn.classList.remove('animate-pulse-custom');
    
    // Clear drawing state
    deliveryAreaPoints = [];
    deliveryAreaLines = [];
    deliveryAreaTempLine = null;
    deliveryAreaStartMarker = null;
    deliveryAreaVertexMarkers = [];
    deliveryAreaNearStartPoint = false;
    
    // Restore cross marker if it was there before
    if (deliveryAreaHadCrossMarker) {
        const lat = parseFloat(document.getElementById('sidebar-latitude').value);
        const lng = parseFloat(document.getElementById('sidebar-longitude').value);
        if (!isNaN(lat) && !isNaN(lng)) {
            placeCrossMarker(lat, lng);
        }
    }
    
    // Show the partner form sidebar
    const partnerFormSidebar = document.getElementById('partner-form-sidebar');
    openSidebar(partnerFormSidebar);
}

// ==========================================
// DELIVERY AREA EVENT LISTENERS
// ==========================================

// Draw delivery area button
document.getElementById('draw-delivery-area-btn').addEventListener('click', function() {
    startDeliveryAreaMode();
});

// Export dropdown toggle
document.getElementById('delivery-area-export-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('delivery-area-export-dropdown');
    dropdown.classList.toggle('hidden');
});

// Export as WKT
document.getElementById('delivery-area-export-wkt').addEventListener('click', function() {
    document.getElementById('delivery-area-export-dropdown').classList.add('hidden');
    exportDeliveryArea('wkt');
});

// Export as KML
document.getElementById('delivery-area-export-kml').addEventListener('click', function() {
    document.getElementById('delivery-area-export-dropdown').classList.add('hidden');
    exportDeliveryArea('kml');
});

// Cancel button
document.getElementById('delivery-area-cancel-btn').addEventListener('click', function() {
    cancelDeliveryAreaMode();
});

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('delivery-area-export-dropdown');
    const exportBtn = document.getElementById('delivery-area-export-btn');
    if (!dropdown.contains(e.target) && !exportBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// Escape key handler for delivery area mode
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && deliveryAreaMode) {
        if (deliveryAreaPoints.length > 0) {
            // Remove last point and continue drawing
            removeLastDeliveryAreaPoint();
        } else if (deliveryAreaCompletedPolygons.length > 0) {
            // No current points but has completed polygons - ask for confirmation before removing
            const confirmed = confirm('Remove the last completed polygon?');
            if (confirmed) {
                removeLastCompletedPolygon();
            }
        } else {
            // No points and no completed polygons, cancel the whole mode
            cancelDeliveryAreaMode();
        }
    }
});
