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
        weight: PARTNER_CONSTANTS.DEFAULT_STANDALONE_HEXAGON_WEIGHT
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

    isMeasuring = true;
    // Clean up any existing measurement line
    if (measurementLine) {
        map.removeLayer(measurementLine);
        measurementLine = null;
    }
    measurementStart = null;

    // Show measurement mode indicator and overlay
    document.getElementById('measurement-overlay').classList.remove('hidden');
    document.getElementById('measurement-mode-indicator').textContent = 'Measurement Mode Active';
    document.getElementById('measurement-mode-indicator').classList.remove('hidden');
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
    measurementStart = null;

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
    
    // If cross marker is on the map, remove it and close sidebars
    if (contextMenuState.crossMarker) {
        removeCrossMarker();
        closeAllSidebars();
        return;
    }
    
    if (isMeasuring) {
        const { lat, lng } = e.latlng;
        if (!measurementStart) {
            // First click - set measurement start point
            measurementStart = { lat, lng };
        } else {
            // Second click - clear measurement and reset button
            stopMeasurement();
            const measurementToggle = document.getElementById('measurement-toggle');
            measurementToggle.innerHTML = '<i data-lucide="ruler" class="icon-btn"></i> Start Measurement';
            measurementToggle.style.backgroundColor = '';
            lucide.createIcons();
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

// Resolution slider
const resolutionSlider = document.getElementById('resolution');
const resolutionValue = document.getElementById('resolution-value');
resolutionSlider.addEventListener('input', function() {
    resolution = parseInt(this.value);
    resolutionValue.textContent = resolution;
});

// Color picker
const colorPicker = document.getElementById('color-picker');
colorPicker.addEventListener('input', function() {
    color = this.value;
});

// Opacity slider
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

    if (isMeasuring && measurementStart) {
        // Update measurement line and show distance
        const currentPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
        const distance = calculateDistance(measurementStart, currentPoint);

        // Remove existing line if it exists
        if (measurementLine) {
            map.removeLayer(measurementLine);
        }

        // Create new measurement line (black)
        measurementLine = L.polyline([measurementStart, currentPoint], {
            color: '#000000',
            weight: 10,
            opacity: 0.8,
            dashArray: '5, 15'
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

// Help sidebar toggle button
const helpSidebarToggle = document.getElementById('help-sidebar-toggle');
helpSidebarToggle.addEventListener('click', toggleHelpSidebar);

// Help sidebar close button
document.getElementById('help-close-btn').addEventListener('click', closeHelpSidebar);

// ==========================================
// TOOLBAR CONTROLS
// ==========================================

// Measurement toggle button
const measurementToggle = document.getElementById('measurement-toggle');
measurementToggle.addEventListener('click', function() {
    if (!isMeasuring) {
        startMeasurement();
        measurementToggle.innerHTML = '<i data-lucide="square" class="icon-btn"></i> Stop Measurement';
        measurementToggle.style.backgroundColor = '#16a34a';
        lucide.createIcons();
    } else {
        stopMeasurement();
        measurementToggle.innerHTML = '<i data-lucide="ruler" class="icon-btn"></i> Start Measurement';
        measurementToggle.style.backgroundColor = '';
        lucide.createIcons();
    }
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
                originalFillOpacity: fillOpacity || 0.3
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
            weight: PARTNER_CONSTANTS.DEFAULT_PRIMARY_HEXAGON_WEIGHT
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
                weight: PARTNER_CONSTANTS.DEFAULT_SECONDARY_HEXAGON_WEIGHT
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
        
        if (parsedContent.type === 'single' && parsedContent.coordinates.length > 0) {
            // Single polygon
            const polygon = L.polygon(parsedContent.coordinates, {
                color: actualDeliveryColor,
                fillColor: actualDeliveryColor,
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                weight: PARTNER_CONSTANTS.DEFAULT_DELIVERY_AREA_WEIGHT
            }).addTo(map);
            
            partnerObject.elements.deliveryAreaPolygons.push({
                polygon: polygon,
                type: 'single'
            });
        } else if (parsedContent.type === 'multi' && parsedContent.coordinates.length > 0) {
            // Multiple polygons (MULTIPOLYGON)
            parsedContent.coordinates.forEach(coords => {
                if (coords.length > 0) {
                    const polygon = L.polygon(coords, {
                        color: actualDeliveryColor,
                        fillColor: actualDeliveryColor,
                        fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                        weight: PARTNER_CONSTANTS.DEFAULT_DELIVERY_AREA_WEIGHT
                    }).addTo(map);
                    
                    partnerObject.elements.deliveryAreaPolygons.push({
                        polygon: polygon,
                        type: 'multi'
                    });
                }
            });
        }
    }

    // Store partner in the main structure
    partnersById[partnerId] = partnerObject;
    
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
 * Parses polygon content (KML or WKT) and extracts coordinates.
 * Returns an object with:
 *   - type: 'single' or 'multi'
 *   - coordinates: array of coordinates for single polygon, or array of coordinate arrays for multi-polygon
 */
function parsePolygonContent(content) {
    const trimmedContent = content.trim();
    
    // Detect format: KML has XML structure, WKT starts with POLYGON or MULTIPOLYGON
    if (trimmedContent.includes('<coordinates') || trimmedContent.includes('<Coordinates')) {
        // KML format - returns single polygon coordinates
        return {
            type: 'single',
            coordinates: parseKMLCoordinates(trimmedContent)
        };
    } else if (trimmedContent.toUpperCase().startsWith('MULTIPOLYGON')) {
        // WKT MULTIPOLYGON format
        return {
            type: 'multi',
            coordinates: parseWKTMultiPolygon(trimmedContent)
        };
    } else if (trimmedContent.toUpperCase().startsWith('POLYGON')) {
        // WKT POLYGON format
        return {
            type: 'single',
            coordinates: parseWKTPolygon(trimmedContent)
        };
    }
    
    // Try to auto-detect by attempting parsers
    const kmlResult = parseKMLCoordinates(trimmedContent);
    if (kmlResult.length > 0) {
        return {
            type: 'single',
            coordinates: kmlResult
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
 * Parses KML content and extracts polygon coordinates.
 */
function parseKMLCoordinates(kmlContent) {
    const coordinates = [];
    
    // Try to extract coordinates from KML <coordinates> tag
    const coordMatch = kmlContent.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
    if (coordMatch) {
        const coordText = coordMatch[1].trim();
        // KML coordinates are in format: lon,lat,alt lon,lat,alt ...
        const coordPairs = coordText.split(/\s+/);
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
    }
    
    return coordinates;
}

/**
 * Parses WKT POLYGON content and extracts coordinates.
 */
function parseWKTPolygon(wktContent) {
    const coordinates = [];
    
    // WKT POLYGON format: POLYGON((lon1 lat1, lon2 lat2, lon3 lat3, ...))
    // or with multiple rings: POLYGON((outer_ring),(inner_ring1),...)
    
    // Match the content inside POLYGON(...)
    const polygonMatch = wktContent.match(/POLYGON\s*\(\s*\(([\s\S]+)\)\s*\)/i);
    if (polygonMatch) {
        // Get the first (outer) ring
        let ringContent = polygonMatch[1];
        
        // Handle multiple rings - take only the first (outer) ring
        const rings = ringContent.split(/\)\s*,\s*\(/);
        if (rings.length > 0) {
            ringContent = rings[0];
        }
        
        // Parse coordinate pairs: lon1 lat1, lon2 lat2, ...
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
    }
    
    return coordinates;
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

    // Configure secondary toggle based on availability
    const secondaryToggle = document.getElementById('toggle-secondary-zone');
    const secondaryContainer = secondaryToggle.closest('.zone-toggle');

    if (hasSecondaryHexagons) {
        secondaryToggle.disabled = false;
        if (secondaryContainer) {
            secondaryContainer.classList.remove('opacity-50', 'cursor-not-allowed');
            secondaryContainer.style.pointerEvents = 'auto';
        }
    } else {
        secondaryToggle.disabled = true;
        if (secondaryContainer) {
            secondaryContainer.classList.add('opacity-50', 'cursor-not-allowed');
            secondaryContainer.style.pointerEvents = 'none';
        }
    }

    // Configure delivery area toggle based on availability
    const deliveryToggle = document.getElementById('toggle-delivery-area');
    const deliveryContainer = deliveryToggle.closest('.zone-toggle');

    if (hasDeliveryArea) {
        deliveryToggle.disabled = false;
        if (deliveryContainer) {
            deliveryContainer.classList.remove('opacity-50', 'cursor-not-allowed');
            deliveryContainer.style.pointerEvents = 'auto';
        }
    } else {
        deliveryToggle.disabled = true;
        if (deliveryContainer) {
            deliveryContainer.classList.add('opacity-50', 'cursor-not-allowed');
            deliveryContainer.style.pointerEvents = 'none';
        }
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
 */
function resetSidebarForm() {
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
        zIndexOffset: 1000
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
 * Checks if a point is inside a polygon using ray casting algorithm.
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Array} polygonCoords - Array of [lat, lng] coordinates
 * @returns {boolean} True if point is inside polygon
 */
function isPointInPolygon(lat, lng, polygonCoords) {
    const n = polygonCoords.length;
    let inside = false;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygonCoords[i][0];
        const yi = polygonCoords[i][1];
        const xj = polygonCoords[j][0];
        const yj = polygonCoords[j][1];
        
        if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

/**
 * Checks if a hexagon intersects with a delivery area polygon.
 * A hexagon is intersected if:
 * - Any of its boundary vertices is inside the delivery polygon, OR
 * - The delivery polygon has vertices inside the hexagon
 * @param {Array} hexagonBoundary - H3 hexagon boundary (array of [lat, lng])
 * @param {Array} deliveryPolygonCoords - Delivery polygon coordinates (array of [lat, lng])
 * @returns {boolean} True if hexagon intersects with delivery area
 */
function isHexagonIntersectedByPolygon(hexagonBoundary, deliveryPolygonCoords) {
    // Check if any hexagon vertex is inside the delivery polygon
    for (const vertex of hexagonBoundary) {
        if (isPointInPolygon(vertex[0], vertex[1], deliveryPolygonCoords)) {
            return true;
        }
    }
    
    // Check if any delivery polygon vertex is inside the hexagon
    for (const vertex of deliveryPolygonCoords) {
        if (isPointInPolygon(vertex[0], vertex[1], hexagonBoundary)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Computes intersection state for all hexagons of a partner.
 * Updates the isIntersectedByDelivery property on each hexagon.
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
    
    // Get all delivery polygon coordinates
    const allDeliveryCoords = [];
    deliveryPolygons.forEach(polyObj => {
        const latlngs = polyObj.polygon.getLatLngs()[0];
        latlngs.forEach(ll => {
            allDeliveryCoords.push([ll.lat, ll.lng]);
        });
    });
    
    // Check primary hexagons
    partnerObject.elements.primaryHexagons.forEach(hexagon => {
        const hexBoundary = h3.cellToBoundary(hexagon.h3Index);
        hexagon.isIntersectedByDelivery = isHexagonIntersectedByPolygon(hexBoundary, allDeliveryCoords);
    });
    
    // Check secondary hexagons
    partnerObject.elements.secondaryHexagons.forEach(hexagon => {
        const hexBoundary = h3.cellToBoundary(hexagon.h3Index);
        hexagon.isIntersectedByDelivery = isHexagonIntersectedByPolygon(hexBoundary, allDeliveryCoords);
    });
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
// CUSTOMER LOCATION SIDEBAR
// ==========================================

/**
 * Updates the customer location sidebar content with detected hexagons.
 */
function updateCustomerLocationSidebarContent(lat, lng) {
    const customerLocationCoords = document.getElementById('customer-location-coords');
    const customerLocationHexagonList = document.getElementById('customer-location-hexagon-list');
    const summaryHexagonCount = document.getElementById('summary-hexagon-count');
    const summaryPartnerCount = document.getElementById('summary-partner-count');
    
    // Place cross marker at customer location
    placeCrossMarker(lat, lng);
    
    // Update coordinates display
    customerLocationCoords.textContent = `Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)}`;
    
    // Find hexagons at location
    const detectedHexagons = findHexagonsAtLocation(lat, lng);
    
    // Update summary counts
    const uniquePartners = new Set();
    detectedHexagons.forEach(hex => {
        if (hex.partnerId) {
            uniquePartners.add(hex.partnerId);
        }
    });
    summaryHexagonCount.textContent = detectedHexagons.length;
    summaryPartnerCount.textContent = uniquePartners.size;
    
    // Update hexagon list
    customerLocationHexagonList.innerHTML = '';
    
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
                        <div class="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block mt-1">Res ${group.resolution}</div>
                    </div>
                </div>
                ${partnersHtml}
                ${standaloneHtml}
            `;
            
            customerLocationHexagonList.appendChild(hexagonCard);
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
        customerLocationHexagonList.appendChild(noHexagonsMsg);
        lucide.createIcons();
    }
}

/**
 * Shows the customer location sidebar with hexagon detection.
 */
function showCustomerLocationSidebar(lat, lng) {
    closeAllSidebars();
    updateCustomerLocationSidebarContent(lat, lng);
    const customerLocationSidebar = document.getElementById('customer-location-sidebar');
    openSidebar(customerLocationSidebar);
}

/**
 * Closes the customer location sidebar.
 */
function closeCustomerLocationSidebar() {
    const customerLocationSidebar = document.getElementById('customer-location-sidebar');
    closeSidebar(customerLocationSidebar);
    removeCrossMarker();
}

// Context menu - "Customer Location" button
document.getElementById('context-menu-customer-location').addEventListener('click', function() {
    hideContextMenu();
    if (contextMenuState.latitude !== null && contextMenuState.longitude !== null) {
        showCustomerLocationSidebar(contextMenuState.latitude, contextMenuState.longitude);
    }
});

// Customer location sidebar - close button
document.getElementById('customer-location-close-btn').addEventListener('click', closeCustomerLocationSidebar);

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
    const partnerInfoSidebar = document.getElementById('partner-info-sidebar');
    const customerLocationSidebar = document.getElementById('customer-location-sidebar');
    
    closeSidebar(helpSidebar);
    closeSidebar(partnerFormSidebar);
    closeSidebar(partnerInfoSidebar);
    closeSidebar(customerLocationSidebar);
    
    // Reset currentPartnerId when closing partner info sidebar
    currentPartnerId = null;
    
    // Remove cross marker when closing all sidebars
    removeCrossMarker();
}
