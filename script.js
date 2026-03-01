// Initialize Lucide Icons
lucide.createIcons();

// Initialize the map centered on a specific location (e.g., Berlin)
const map = L.map('map', { zoomControl: false }).setView([52.5200, 13.4050], 15);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Store generated hexagons and their polygons
const hexagons = {};

// Default settings
let resolution = 9;
let color = '#0000ff';
let opacity = 0.3;

// Measurement settings
let isMeasuring = false;
let measurementStart = null;
let measurementLine = null;

// Grayscale settings
let isGrayscale = false;

// Function to generate and display H3 grid cells
function generateH3Grid(latitude, longitude, resolution, color, opacity, map) {
    const h3Index = h3.latLngToCell(latitude, longitude, resolution);
    console.log(`Generating H3 grid for index: ${h3Index}`);
    
    if (hexagons[h3Index]) {
        console.log(`Removing hexagon with index: ${h3Index}`);
        removeHexagon({ h3Index, latitude, longitude, resolution, color, opacity });
    } else {
        console.log(`Adding hexagon with index: ${h3Index}`);
        addHexagon({ h3Index, latitude, longitude, resolution, color, opacity });
    }
}

// Function to add a hexagon to the map
function addHexagon(hexagon) {
    const { h3Index, latitude, longitude, resolution, color, opacity } = hexagon;
    const hexagonBoundary = h3.cellToBoundary(h3Index);
    const polygon = L.polygon(hexagonBoundary, {
        color: color,
        fillColor: color,
        fillOpacity: opacity,
        originalFillOpacity: opacity
    }).addTo(map);

    hexagons[h3Index] = { polygon, latitude, longitude };
}

// Function to remove a hexagon from the map
function removeHexagon(hexagon) {
    const { h3Index } = hexagon;
    if (hexagons[h3Index]) {
        map.removeLayer(hexagons[h3Index].polygon);
        delete hexagons[h3Index];
    }
}

// Measurement functions
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

function calculateDistance(start, end) {
    const startLatLng = L.latLng(start.lat, start.lng);
    const endLatLng = L.latLng(end.lat, end.lng);
    return startLatLng.distanceTo(endLatLng) / 1000; // Convert meters to kilometers
}

// Add event listener to the map for click events
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
    const { lat, lng } = e.latlng;
    generateH3Grid(lat, lng, resolution, color, opacity, map);
});

// Add event listener to the resolution slider
const resolutionSlider = document.getElementById('resolution');
const resolutionValue = document.getElementById('resolution-value');
resolutionSlider.addEventListener('input', function() {
    resolution = parseInt(this.value);
    resolutionValue.textContent = resolution;
});

// Add event listener to the color picker
const colorPicker = document.getElementById('color-picker');
colorPicker.addEventListener('input', function() {
    color = this.value;
});

// Add event listener to the opacity slider
const opacitySlider = document.getElementById('opacity');
const opacityValue = document.getElementById('opacity-value');
opacitySlider.addEventListener('input', function() {
    opacity = parseFloat(this.value);
    opacityValue.textContent = opacity;
});

// Add event listener to show cursor coordinates
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
            weight: 5,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(map);

        // Update measurement display with large numbers
        measurementDisplay.textContent = `${distance.toFixed(2)} km`;
    } else {
        cursorCoordinates.textContent = `Lat: ${lat}, Lon: ${lng}`;
    }
});

// Function to close help sidebar
function closeHelpSidebar() {
    const helpSidebar = document.getElementById('help-sidebar');
    closeSidebar(helpSidebar);
    if (currentOpenSidebar === SIDEBAR_TYPES.HELP) {
        currentOpenSidebar = null;
    }
    // Remove cross marker when closing help sidebar
    removeCrossMarker();
}

// Function to open help sidebar (closes other sidebars first)
function openHelpSidebar() {
    const helpSidebar = document.getElementById('help-sidebar');
    
    // If another sidebar is open, use switch animation
    if (currentOpenSidebar && currentOpenSidebar !== SIDEBAR_TYPES.HELP) {
        switchToSidebar(helpSidebar, SIDEBAR_TYPES.HELP);
    } else {
        // Just open help sidebar with animation
        openSidebar(helpSidebar);
        currentOpenSidebar = SIDEBAR_TYPES.HELP;
    }
}

// Function to toggle help sidebar
function toggleHelpSidebar() {
    const sidebar = document.getElementById('help-sidebar');
    if (sidebar.classList.contains('sidebar-closed') || sidebar.classList.contains('hidden')) {
        openHelpSidebar();
    } else {
        closeHelpSidebar();
    }
}

// Add event listener to toggle the help sidebar
const helpSidebarToggle = document.getElementById('help-sidebar-toggle');
helpSidebarToggle.addEventListener('click', toggleHelpSidebar);

// Add event listener for help close button
document.getElementById('help-close-btn').addEventListener('click', closeHelpSidebar);

// Add event listener to toggle measurement mode
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

// Add event listener to toggle grayscale mode
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

// Function to save hexagons and partners to JSON
function saveData() {
    // Check if there's anything to save
    if (Object.keys(hexagons).length === 0 && Object.keys(partnersById).length === 0) {
        alert("No hexagons or partners to save.");
        return;
    }

    // Build hexagons array (compact format)
    const hexagonsData = Object.keys(hexagons).map(h3Index => {
        const { polygon } = hexagons[h3Index];
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
        h3Resolution: partner.h3Resolution,
        numZones: partner.numZones,
        h3Resolution2: partner.h3Resolution2,
        numZones2: partner.numZones2,
        color: partner.color || PARTNER_CONSTANTS.DEFAULT_COLOR,
        color2: partner.color2
    }));

    // Create unified data structure
    const data = {
        type: "HexagonMapperData",
        version: "1.0",
        timestamp: new Date().toISOString(),
        hexagons: hexagonsData,
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

// Function to load hexagons and partners from JSON
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

// Update partner counter based on existing partners (used after loading)
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

// Load HexagonMapperData format (new unified format)
function loadHexagonMapperData(data) {
    // Close all sidebars and remove cross marker before loading new data
    closeAllSidebars();

    // Clear existing hexagons
    Object.keys(hexagons).forEach(h3Index => {
        map.removeLayer(hexagons[h3Index].polygon);
        delete hexagons[h3Index];
    });

    // Clear existing partners
    Object.keys(partnersById).forEach(partnerId => {
        deletePartner(partnerId);
    });

    // Load hexagons
    if (data.hexagons && Array.isArray(data.hexagons)) {
        data.hexagons.forEach(hexagonData => {
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
            hexagons[h3Index] = { 
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

// Add event listeners for save and load buttons
document.getElementById('save-btn').addEventListener('click', saveData);
document.getElementById('load-btn').addEventListener('click', function() {
    document.getElementById('load-file').click();
});
document.getElementById('load-file').addEventListener('change', loadData);

// ==========================================
// PARTNER MANAGEMENT
// ==========================================

// Partner state
const partnersById = {};
let currentPartnerId = null;
let partnerIdCounter = 1;
let editMode = {
    isActive: false,
    partnerId: null
};

// Partner constants
const PARTNER_CONSTANTS = {
    DEFAULT_OPACITY: 0.2,
    DEFAULT_COLOR: '#0000ff',
    DEFAULT_PRIMARY_RESOLUTION: 9,
    DEFAULT_PRIMARY_NUMBER_ZONES: 18,
    DEFAULT_SECONDARY_RESOLUTION: 6,
    DEFAULT_SECONDARY_NUMBER_ZONES: 8
};

// Add a partner to the map
function addPartnerToMap(partner) {
    const { partnerId, latitude, longitude, h3Resolution, numZones, h3Resolution2, numZones2, color: partnerColor, color2 } = partner;
    const actualColor = partnerColor || PARTNER_CONSTANTS.DEFAULT_COLOR;

    // Create partner object with elements structure
    const partnerObject = {
        partnerId,
        latitude,
        longitude,
        h3Resolution,
        numZones,
        h3Resolution2,
        numZones2,
        color: partnerColor,
        color2,
        elements: {
            primaryHexagons: [],
            secondaryHexagons: []
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
    const centerCell = h3.latLngToCell(latitude, longitude, h3Resolution);
    const disk = h3.gridDisk(centerCell, numZones - 1);
    disk.forEach((cell, index) => {
        const boundary = h3.cellToBoundary(cell);
        const polygon = L.polygon(boundary, {
            color: actualColor,
            fillColor: actualColor,
            fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY
        }).addTo(map);
        
        const hexagonObject = {
            h3Index: cell,
            polygon: polygon,
            center: { lat: latitude, lng: longitude },
            layerType: 'primary',
            h3Resolution: h3Resolution,
            zoneNumber: h3.gridDistance(centerCell, cell)
        };
        partnerObject.elements.primaryHexagons.push(hexagonObject);
    });

    // Draw secondary hexagons if provided
    if (h3Resolution2 !== undefined && numZones2 !== undefined) {
        const actualColor2 = color2 || actualColor;
        const centerCell2 = h3.latLngToCell(latitude, longitude, h3Resolution2);
        const disk2 = h3.gridDisk(centerCell2, numZones2 - 1);
        disk2.forEach((cell, index) => {
            const boundary = h3.cellToBoundary(cell);
            const polygon = L.polygon(boundary, {
                color: actualColor2,
                fillColor: actualColor2,
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY
            }).addTo(map);
            
            const hexagonObject = {
                h3Index: cell,
                polygon: polygon,
                center: { lat: latitude, lng: longitude },
                layerType: 'secondary',
                h3Resolution: h3Resolution2,
                zoneNumber: h3.gridDistance(centerCell2, cell)
            };
            partnerObject.elements.secondaryHexagons.push(hexagonObject);
        });
    }

    // Store partner in the main structure
    partnersById[partnerId] = partnerObject;

    // Move map view to the partner's location
    map.setView([latitude, longitude], map.getZoom());
}

// Delete a partner from the map
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

    // Remove marker from map
    if (partner.marker) {
        map.removeLayer(partner.marker);
    }

    // Remove partner from the data structure
    delete partnersById[partnerId];
}

// Update a partner with new data
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
    if (oldPartner.marker) {
        map.removeLayer(oldPartner.marker);
    }

    // Add the updated partner
    addPartnerToMap(newPartnerData);
}

// Toggle primary hexagons visibility for a partner
function togglePrimaryHexagonsVisibility(partnerId, visible) {
    const partner = partnersById[partnerId];
    if (!partner || partner.elements.primaryHexagons.length === 0) return;

    if (visible) {
        partner.elements.primaryHexagons.forEach(hexagon => {
            hexagon.polygon.setStyle({
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                opacity: 1
            });
        });
    } else {
        partner.elements.primaryHexagons.forEach(hexagon => {
            hexagon.polygon.setStyle({
                fillOpacity: 0,
                opacity: 0
            });
        });
    }
}

// Toggle secondary hexagons visibility for a partner
function toggleSecondaryHexagonsVisibility(partnerId, visible) {
    const partner = partnersById[partnerId];
    if (!partner || partner.elements.secondaryHexagons.length === 0) return;

    if (visible) {
        partner.elements.secondaryHexagons.forEach(hexagon => {
            hexagon.polygon.setStyle({
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                opacity: 1
            });
        });
    } else {
        partner.elements.secondaryHexagons.forEach(hexagon => {
            hexagon.polygon.setStyle({
                fillOpacity: 0,
                opacity: 0
            });
        });
    }
}

// Toggle delivery area visibility for a partner
function toggleDeliveryAreaVisibility(partnerId, visible) {
    const partner = partnersById[partnerId];
    if (!partner || !partner.elements.deliveryAreaPolygon) return;

    if (visible) {
        partner.elements.deliveryAreaPolygon.setStyle({
            fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
            opacity: 1
        });
    } else {
        partner.elements.deliveryAreaPolygon.setStyle({
            fillOpacity: 0,
            opacity: 0
        });
    }
}

// Parse polygon content (KML or WKT) and extract coordinates
function parsePolygonContent(content) {
    const trimmedContent = content.trim();
    
    // Detect format: KML has XML structure, WKT starts with POLYGON
    if (trimmedContent.includes('<coordinates') || trimmedContent.includes('<Coordinates')) {
        return parseKMLCoordinates(trimmedContent);
    } else if (trimmedContent.toUpperCase().startsWith('POLYGON')) {
        return parseWKTPolygon(trimmedContent);
    }
    
    // Try to auto-detect by attempting both parsers
    const kmlResult = parseKMLCoordinates(trimmedContent);
    if (kmlResult.length > 0) {
        return kmlResult;
    }
    
    return parseWKTPolygon(trimmedContent);
}

// Parse KML content and extract polygon coordinates
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

// Parse WKT POLYGON content and extract coordinates
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

// Show partner sidebar
function showPartnerSidebar(partnerId) {
    const partner = partnersById[partnerId];
    if (!partner) return;

    const partnerSidebar = document.getElementById('partner-sidebar');

    // If the same partner is already being shown, do nothing
    if (currentOpenSidebar === SIDEBAR_TYPES.PARTNER && currentPartnerId === partnerId) {
        return;
    }

    // Close partner sidebar first if it's open (with animation)
    if (currentOpenSidebar === SIDEBAR_TYPES.PARTNER) {
        closeSidebar(partnerSidebar);
        // Wait for close animation, then open with new content
        setTimeout(() => {
            updatePartnerSidebarContent(partner);
            openSidebar(partnerSidebar);
            currentPartnerId = partnerId;
        }, 200);
    } else if (currentOpenSidebar && currentOpenSidebar !== SIDEBAR_TYPES.PARTNER) {
        // Another sidebar is open, close all and open partner sidebar
        closeAllSidebars();
        setTimeout(() => {
            updatePartnerSidebarContent(partner);
            openSidebar(partnerSidebar);
            currentOpenSidebar = SIDEBAR_TYPES.PARTNER;
            currentPartnerId = partnerId;
        }, 200);
    } else {
        // No sidebar open, just open partner sidebar with animation
        updatePartnerSidebarContent(partner);
        openSidebar(partnerSidebar);
        currentOpenSidebar = SIDEBAR_TYPES.PARTNER;
        currentPartnerId = partnerId;
    }
}

// Update partner sidebar content
function updatePartnerSidebarContent(partner) {
    document.getElementById('slide-partner-id').textContent = partner.partnerId;

    // Update partner statistics table
    const tableBody = document.getElementById('partner-stats-table').querySelector('tbody');
    tableBody.innerHTML = '';

    const primaryCount = partner.elements.primaryHexagons.length;
    const secondaryCount = partner.elements.secondaryHexagons.length;
    const hasDeliveryArea = partner.elements.deliveryAreaPolygon !== undefined;

    // Primary zone row
    const primaryRow = document.createElement('tr');
    primaryRow.innerHTML = `
        <td class="py-1 pr-2 font-medium text-gray-700">Primary</td>
        <td class="py-1 text-gray-600">Resolution: ${partner.h3Resolution}<br>Zones: ${partner.numZones} (${primaryCount} hexagons)</td>
    `;
    tableBody.appendChild(primaryRow);

    // Secondary zone row (if exists)
    if (secondaryCount > 0 && partner.numZones2 !== undefined) {
        const secondaryRow = document.createElement('tr');
        secondaryRow.innerHTML = `
            <td class="py-1 pr-2 font-medium text-gray-700">Secondary</td>
            <td class="py-1 text-gray-600">Resolution: ${partner.h3Resolution2}<br>Zones: ${partner.numZones2} (${secondaryCount} hexagons)</td>
        `;
        tableBody.appendChild(secondaryRow);
    }

    // Delivery area row (if exists)
    if (hasDeliveryArea) {
        const deliveryRow = document.createElement('tr');
        deliveryRow.innerHTML = `
            <td class="py-1 pr-2 font-medium text-gray-700">Delivery Area</td>
            <td class="py-1 text-gray-600">Custom polygon defined</td>
        `;
        tableBody.appendChild(deliveryRow);
    }

    // Set initial toggle states
    const primaryVisible = partner.elements.primaryHexagons.length > 0 && partner.elements.primaryHexagons[0].polygon.options.fillOpacity > 0;
    const secondaryVisible = partner.elements.secondaryHexagons.length > 0 && partner.elements.secondaryHexagons[0].polygon.options.fillOpacity > 0;
    const deliveryVisible = hasDeliveryArea && partner.elements.deliveryAreaPolygon.options.fillOpacity > 0;
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
}

// Close partner sidebar
function closePartnerSidebar() {
    const slideWindow = document.getElementById('partner-sidebar');
    closeSidebar(slideWindow);
    if (currentOpenSidebar === SIDEBAR_TYPES.PARTNER) {
        currentOpenSidebar = null;
    }
    currentPartnerId = null;
}

// Reset sidebar form
function resetSidebarForm() {
    document.getElementById('add-partner-form').reset();
    document.getElementById('sidebar-partnerId').value = `partner${partnerIdCounter}`;
    document.getElementById('sidebar-resolution-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_RESOLUTION.toString();
    document.getElementById('sidebar-zones-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_NUMBER_ZONES.toString();
    document.getElementById('sidebar-resolution2-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_RESOLUTION.toString();
    document.getElementById('sidebar-zones2-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_NUMBER_ZONES.toString();
    document.getElementById('secondary-fields').classList.add('hidden');
    document.getElementById('sidebar-same-color').checked = true;
    document.getElementById('sidebar-color2').disabled = true;
    
    // Reset delivery area fields
    document.getElementById('sidebar-enable-delivery-area').checked = false;
    document.getElementById('delivery-area-fields').classList.add('hidden');
    document.getElementById('sidebar-same-color-delivery').checked = true;
    document.getElementById('sidebar-delivery-color').disabled = true;
    // Set delivery color to match primary color
    const primaryColor = document.getElementById('sidebar-color').value || PARTNER_CONSTANTS.DEFAULT_COLOR;
    document.getElementById('sidebar-delivery-color').value = primaryColor;
    // Clear polygon textarea
    document.getElementById('sidebar-polygon-content').value = '';
    
    editMode.isActive = false;
    editMode.partnerId = null;
    
    document.getElementById('partner-sidebar-title').textContent = 'Add Partner';
    const submitButton = document.getElementById('partner-submit-btn');
    submitButton.textContent = 'Add';
}

// Open sidebar for editing a partner
function openSidebarForEdit(partner) {
    editMode.isActive = true;
    editMode.partnerId = partner.partnerId;

    document.getElementById('partner-sidebar-title').textContent = 'Edit Partner';
    const submitButton = document.getElementById('partner-submit-btn');
    submitButton.textContent = 'Update';

    // Pre-fill form fields
    document.getElementById('sidebar-partnerId').value = partner.partnerId;
    document.getElementById('sidebar-latitude').value = partner.latitude;
    document.getElementById('sidebar-longitude').value = partner.longitude;
    document.getElementById('sidebar-h3Resolution').value = partner.h3Resolution;
    document.getElementById('sidebar-numZones').value = partner.numZones;
    document.getElementById('sidebar-color').value = partner.color || PARTNER_CONSTANTS.DEFAULT_COLOR;

    document.getElementById('sidebar-resolution-value').textContent = partner.h3Resolution.toString();
    document.getElementById('sidebar-zones-value').textContent = partner.numZones.toString();

    // Handle secondary fields
    const primaryColor = partner.color || PARTNER_CONSTANTS.DEFAULT_COLOR;
    if (partner.h3Resolution2 !== undefined && partner.numZones2 !== undefined) {
        document.getElementById('sidebar-enable-secondary').checked = true;
        document.getElementById('secondary-fields').classList.remove('hidden');
        document.getElementById('sidebar-h3Resolution2').value = partner.h3Resolution2;
        document.getElementById('sidebar-numZones2').value = partner.numZones2;
        document.getElementById('sidebar-resolution2-value').textContent = partner.h3Resolution2.toString();
        document.getElementById('sidebar-zones2-value').textContent = partner.numZones2.toString();
        
        // Check if secondary color is different from primary
        const secondaryColor = partner.color2 || primaryColor;
        const colorsAreSame = secondaryColor.toLowerCase() === primaryColor.toLowerCase();
        document.getElementById('sidebar-same-color').checked = colorsAreSame;
        document.getElementById('sidebar-color2').value = secondaryColor;
        document.getElementById('sidebar-color2').disabled = colorsAreSame;
    } else {
        document.getElementById('sidebar-enable-secondary').checked = false;
        document.getElementById('secondary-fields').classList.add('hidden');
        document.getElementById('sidebar-color2').value = primaryColor;
        document.getElementById('sidebar-same-color').checked = true;
        document.getElementById('sidebar-color2').disabled = true;
    }

    // Open sidebar with animation
    const sidebar = document.getElementById('add-partner-sidebar');
    openSidebar(sidebar);
    currentOpenSidebar = SIDEBAR_TYPES.ADD_PARTNER;
}

// Validate partner data
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
    if (typeof partner.h3Resolution !== 'number' || !Number.isInteger(partner.h3Resolution) || partner.h3Resolution < 0 || partner.h3Resolution > 15) {
        alert("h3Resolution must be an integer between 0 and 15");
        return false;
    }
    if (typeof partner.numZones !== 'number' || !Number.isInteger(partner.numZones) || partner.numZones < 1 || partner.numZones > 50) {
        alert("numZones must be an integer between 1 and 50");
        return false;
    }
    if (partner.h3Resolution2 !== undefined && (typeof partner.h3Resolution2 !== 'number' || !Number.isInteger(partner.h3Resolution2) || partner.h3Resolution2 < 0 || partner.h3Resolution2 > 15)) {
        alert("h3Resolution2 must be an integer between 0 and 15 if provided");
        return false;
    }
    if (partner.numZones2 !== undefined && (typeof partner.numZones2 !== 'number' || !Number.isInteger(partner.numZones2) || partner.numZones2 < 1 || partner.numZones2 > 50)) {
        alert("numZones2 must be an integer between 1 and 50 if provided");
        return false;
    }
    return true;
}

// ==========================================
// PARTNER EVENT LISTENERS
// ==========================================

// Sidebar close button
document.getElementById('sidebar-close-btn').addEventListener('click', function() {
    const sidebar = document.getElementById('add-partner-sidebar');
    closeSidebar(sidebar);
    if (currentOpenSidebar === SIDEBAR_TYPES.ADD_PARTNER) {
        currentOpenSidebar = null;
    }
    resetSidebarForm();
});

// Sidebar cancel button
document.getElementById('sidebar-cancel-add').addEventListener('click', function() {
    const sidebar = document.getElementById('add-partner-sidebar');
    closeSidebar(sidebar);
    if (currentOpenSidebar === SIDEBAR_TYPES.ADD_PARTNER) {
        currentOpenSidebar = null;
    }
    resetSidebarForm();
});

// Sidebar resolution slider
document.getElementById('sidebar-h3Resolution').addEventListener('input', function() {
    document.getElementById('sidebar-resolution-value').textContent = this.value;
});

// Sidebar zones slider
document.getElementById('sidebar-numZones').addEventListener('input', function() {
    document.getElementById('sidebar-zones-value').textContent = this.value;
});

// Sidebar resolution2 slider
document.getElementById('sidebar-h3Resolution2').addEventListener('input', function() {
    document.getElementById('sidebar-resolution2-value').textContent = this.value;
});

// Sidebar zones2 slider
document.getElementById('sidebar-numZones2').addEventListener('input', function() {
    document.getElementById('sidebar-zones2-value').textContent = this.value;
});

// Enable secondary checkbox
document.getElementById('sidebar-enable-secondary').addEventListener('change', function() {
    if (this.checked) {
        document.getElementById('secondary-fields').classList.remove('hidden');
    } else {
        document.getElementById('secondary-fields').classList.add('hidden');
    }
});

// Primary color change to sync secondary color (only if same color checkbox is checked)
document.getElementById('sidebar-color').addEventListener('input', function() {
    if (document.getElementById('sidebar-same-color').checked) {
        document.getElementById('sidebar-color2').value = this.value;
    }
});

// Same color as primary checkbox
document.getElementById('sidebar-same-color').addEventListener('change', function() {
    if (this.checked) {
        // Sync secondary color with primary and disable the color picker
        document.getElementById('sidebar-color2').value = document.getElementById('sidebar-color').value;
        document.getElementById('sidebar-color2').disabled = true;
    } else {
        // Enable the secondary color picker for independent selection
        document.getElementById('sidebar-color2').disabled = false;
    }
});

// Enable delivery area checkbox
document.getElementById('sidebar-enable-delivery-area').addEventListener('change', function() {
    if (this.checked) {
        document.getElementById('delivery-area-fields').classList.remove('hidden');
    } else {
        document.getElementById('delivery-area-fields').classList.add('hidden');
    }
});

// Primary color change to sync delivery area color (only if same color checkbox is checked)
document.getElementById('sidebar-color').addEventListener('input', function() {
    if (document.getElementById('sidebar-same-color-delivery').checked) {
        document.getElementById('sidebar-delivery-color').value = this.value;
    }
});

// Same color as primary for delivery area checkbox
document.getElementById('sidebar-same-color-delivery').addEventListener('change', function() {
    if (this.checked) {
        // Sync delivery color with primary and disable the color picker
        document.getElementById('sidebar-delivery-color').value = document.getElementById('sidebar-color').value;
        document.getElementById('sidebar-delivery-color').disabled = true;
    } else {
        // Enable the delivery color picker for independent selection
        document.getElementById('sidebar-delivery-color').disabled = false;
    }
});

// Add/Edit partner form submission
document.getElementById('add-partner-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const partnerId = document.getElementById('sidebar-partnerId').value.trim();
    const latitude = parseFloat(document.getElementById('sidebar-latitude').value);
    const longitude = parseFloat(document.getElementById('sidebar-longitude').value);
    const h3Resolution = parseInt(document.getElementById('sidebar-h3Resolution').value);
    const numZones = parseInt(document.getElementById('sidebar-numZones').value);
    const color = document.getElementById('sidebar-color').value;

    const enableSecondary = document.getElementById('sidebar-enable-secondary').checked;
    const h3Resolution2 = enableSecondary ? parseInt(document.getElementById('sidebar-h3Resolution2').value) : undefined;
    const numZones2 = enableSecondary ? parseInt(document.getElementById('sidebar-numZones2').value) : undefined;
    const color2 = enableSecondary ? document.getElementById('sidebar-color2').value : undefined;

    // Validate delivery area polygon content
    const enableDeliveryArea = document.getElementById('sidebar-enable-delivery-area').checked;
    if (enableDeliveryArea) {
        const polygonContent = document.getElementById('sidebar-polygon-content').value.trim();
        if (!polygonContent) {
            alert("Please provide polygon content (KML or WKT) for the delivery area, or disable the delivery area option.");
            return;
        }
    }

    const partner = { partnerId, latitude, longitude, h3Resolution, numZones, h3Resolution2, numZones2, color, color2 };

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

    // Close sidebar and reset form
    const sidebar = document.getElementById('add-partner-sidebar');
    closeSidebar(sidebar);
    if (currentOpenSidebar === SIDEBAR_TYPES.ADD_PARTNER) {
        currentOpenSidebar = null;
    }
    resetSidebarForm();
});

// Partner sidebar close button
document.getElementById('slide-close-btn').addEventListener('click', closePartnerSidebar);

// Edit partner button
document.getElementById('edit-partner-btn').addEventListener('click', function() {
    const partnerId = currentPartnerId;
    if (!partnerId) return;

    const partner = partnersById[partnerId];
    if (!partner) return;

    closePartnerSidebar();
    openSidebarForEdit(partner);
});

// Delete partner button
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

// Toggle primary zone
document.getElementById('toggle-primary-zone').addEventListener('change', function() {
    if (!currentPartnerId) return;
    togglePrimaryHexagonsVisibility(currentPartnerId, this.checked);
});

// Toggle secondary zone
document.getElementById('toggle-secondary-zone').addEventListener('change', function() {
    if (!currentPartnerId) return;
    toggleSecondaryHexagonsVisibility(currentPartnerId, this.checked);
});

// Toggle delivery area
document.getElementById('toggle-delivery-area').addEventListener('change', function() {
    if (!currentPartnerId) return;
    toggleDeliveryAreaVisibility(currentPartnerId, this.checked);
});

// ==========================================
// RIGHT-CLICK CONTEXT MENU
// ==========================================

// Context menu state
let contextMenuState = {
    latitude: null,
    longitude: null,
    crossMarker: null
};

// Create cross marker icon
function createCrossMarkerIcon() {
    return L.divIcon({
        className: 'cross-marker',
        html: '<div class="cross-marker-icon"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

// Place cross marker on map
function placeCrossMarker(lat, lng) {
    removeCrossMarker();
    contextMenuState.crossMarker = L.marker([lat, lng], {
        icon: createCrossMarkerIcon(),
        zIndexOffset: 1000
    }).addTo(map);
}

// Remove cross marker from map
function removeCrossMarker() {
    if (contextMenuState.crossMarker) {
        map.removeLayer(contextMenuState.crossMarker);
        contextMenuState.crossMarker = null;
    }
}

// Check if a point is inside a hexagon polygon
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

// Find all hexagons at a given location
function findHexagonsAtLocation(lat, lng) {
    const detectedHexagons = [];
    
    // Check standalone hexagons
    Object.keys(hexagons).forEach(h3Index => {
        const hexagonData = hexagons[h3Index];
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

// Show context menu
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

// Hide context menu
function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.classList.add('hidden');
}

// Helper function to setup add partner form with coordinates
function setupAddPartnerForm(lat, lng) {
    // Reset form and set edit mode to false
    editMode.isActive = false;
    editMode.partnerId = null;
    document.getElementById('partner-sidebar-title').textContent = 'Add Partner';
    const submitButton = document.getElementById('partner-submit-btn');
    submitButton.textContent = 'Add';
    
    // Pre-fill coordinates
    document.getElementById('sidebar-partnerId').value = `partner${partnerIdCounter}`;
    document.getElementById('sidebar-latitude').value = lat.toFixed(6);
    document.getElementById('sidebar-longitude').value = lng.toFixed(6);
    document.getElementById('sidebar-h3Resolution').value = PARTNER_CONSTANTS.DEFAULT_PRIMARY_RESOLUTION;
    document.getElementById('sidebar-numZones').value = PARTNER_CONSTANTS.DEFAULT_PRIMARY_NUMBER_ZONES;
    document.getElementById('sidebar-color').value = PARTNER_CONSTANTS.DEFAULT_COLOR;
    document.getElementById('sidebar-resolution-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_RESOLUTION.toString();
    document.getElementById('sidebar-zones-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_NUMBER_ZONES.toString();
    document.getElementById('sidebar-enable-secondary').checked = false;
    document.getElementById('secondary-fields').classList.add('hidden');
    document.getElementById('sidebar-h3Resolution2').value = PARTNER_CONSTANTS.DEFAULT_SECONDARY_RESOLUTION;
    document.getElementById('sidebar-numZones2').value = PARTNER_CONSTANTS.DEFAULT_SECONDARY_NUMBER_ZONES;
    document.getElementById('sidebar-color2').value = PARTNER_CONSTANTS.DEFAULT_COLOR;
    document.getElementById('sidebar-resolution2-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_RESOLUTION.toString();
    document.getElementById('sidebar-zones2-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_NUMBER_ZONES.toString();
    document.getElementById('sidebar-same-color').checked = true;
    document.getElementById('sidebar-color2').disabled = true;
    
    // Reset delivery area fields
    document.getElementById('sidebar-enable-delivery-area').checked = false;
    document.getElementById('delivery-area-fields').classList.add('hidden');
    document.getElementById('sidebar-same-color-delivery').checked = true;
    document.getElementById('sidebar-delivery-color').disabled = true;
    document.getElementById('sidebar-delivery-color').value = PARTNER_CONSTANTS.DEFAULT_COLOR;
    document.getElementById('sidebar-polygon-content').value = '';
}

// Open partner sidebar with coordinates filled
function openPartnerSidebarWithCoords(lat, lng) {
    const sidebar = document.getElementById('add-partner-sidebar');

    // If the same sidebar (add-partner) is already open
    if (currentOpenSidebar === SIDEBAR_TYPES.ADD_PARTNER) {
        closeSidebar(sidebar);
        setTimeout(() => {
            setupAddPartnerForm(lat, lng);
            placeCrossMarker(lat, lng);
            openSidebar(sidebar);
        }, 200);
    } else if (currentOpenSidebar) {
        // Another sidebar is open, use switch animation
        switchToSidebar(sidebar, SIDEBAR_TYPES.ADD_PARTNER);
        setTimeout(() => {
            setupAddPartnerForm(lat, lng);
            placeCrossMarker(lat, lng);
        }, 200);
    } else {
        // No sidebar open, just open with animation
        setupAddPartnerForm(lat, lng);
        placeCrossMarker(lat, lng);
        openSidebar(sidebar);
        currentOpenSidebar = SIDEBAR_TYPES.ADD_PARTNER;
    }
}

// Right-click event handler
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

// Hide context menu on map click
map.on('click', function(e) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu.classList.contains('hidden')) {
        hideContextMenu();
        return;
    }
});

// Hide context menu on document click (outside menu)
document.addEventListener('click', function(e) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// Context menu "Add Partner Here" button
document.getElementById('context-menu-add-partner').addEventListener('click', function() {
    hideContextMenu();
    if (contextMenuState.latitude !== null && contextMenuState.longitude !== null) {
        openPartnerSidebarWithCoords(contextMenuState.latitude, contextMenuState.longitude);
    }
});

// Remove cross marker when partner form is submitted or cancelled
document.getElementById('add-partner-form').addEventListener('submit', function() {
    removeCrossMarker();
});

document.getElementById('sidebar-cancel-add').addEventListener('click', function() {
    removeCrossMarker();
});

document.getElementById('sidebar-close-btn').addEventListener('click', function() {
    removeCrossMarker();
});

// ==========================================
// CUSTOMER LOCATION SIDEBAR
// ==========================================

// Update customer location sidebar content
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
            hexagonCard.className = 'hexagon-card';
            hexagonCard.dataset.h3Index = group.h3Index;
            
            // Build partners list HTML - separate div for each partner with their color
            let partnersHtml = '';
            if (group.partners.length > 0) {
                partnersHtml = group.partners.map(p => {
                    return `<div class="partner-info" style="border-left-color: ${p.color};">
                        <div class="partner-info-line">
                            <span class="partner-badge">${p.partnerId} <span class="zone-badge">${p.layerType}, zone ${p.zoneNumber}</span></span>
                        </div>
                    </div>`;
                }).join('');
            }
            
            // Build standalone indicator
            let standaloneHtml = '';
            if (group.isStandalone && group.partners.length === 0) {
                standaloneHtml = '<div class="partner-info standalone"><div class="partner-info-line standalone">Standalone hexagon</div></div>';
            } else if (group.isStandalone) {
                standaloneHtml = '<div class="partner-info standalone" style="margin-top: 8px;"><div class="partner-info-line standalone">Also: standalone</div></div>';
            }
            
            hexagonCard.innerHTML = `
                <div class="hexagon-card-header">
                    <i data-lucide="hexagon" class="w-5 h-5" style="color: ${group.color};"></i>
                    <div class="hexagon-info">
                        <div class="h3-index">${group.h3Index}</div>
                        <div class="resolution-badge">Res ${group.resolution}</div>
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
        noHexagonsMsg.className = 'no-hexagons-msg';
        noHexagonsMsg.innerHTML = `
            <i data-lucide="hexagon" class="w-12 h-12 mx-auto" style="color: #d1d5db; display: block;"></i>
            <p>No hexagons at this location</p>
        `;
        customerLocationHexagonList.appendChild(noHexagonsMsg);
        lucide.createIcons();
    }
}

// Show customer location sidebar
function showCustomerLocationSidebar(lat, lng) {
    const customerLocationSidebar = document.getElementById('customer-location-sidebar');

    // Close customer location sidebar first if it's open (with animation)
    if (currentOpenSidebar === SIDEBAR_TYPES.CUSTOMER_LOCATION) {
        closeSidebar(customerLocationSidebar);
        // Wait for close animation to complete (200ms matches CSS transition duration)
        setTimeout(() => {
            updateCustomerLocationSidebarContent(lat, lng);
            openSidebar(customerLocationSidebar);
        }, 200);
    } else if (currentOpenSidebar && currentOpenSidebar !== SIDEBAR_TYPES.CUSTOMER_LOCATION) {
        // Another sidebar is open, use switch animation
        switchToSidebar(customerLocationSidebar, SIDEBAR_TYPES.CUSTOMER_LOCATION);
        // Update content after switch animation starts
        setTimeout(() => {
            updateCustomerLocationSidebarContent(lat, lng);
        }, 200);
    } else {
        // No sidebar open, just update content and open with animation
        updateCustomerLocationSidebarContent(lat, lng);
        openSidebar(customerLocationSidebar);
        currentOpenSidebar = SIDEBAR_TYPES.CUSTOMER_LOCATION;
    }
}

// Close customer location sidebar
function closeCustomerLocationSidebar() {
    const customerLocationSidebar = document.getElementById('customer-location-sidebar');
    closeSidebar(customerLocationSidebar);
    if (currentOpenSidebar === SIDEBAR_TYPES.CUSTOMER_LOCATION) {
        currentOpenSidebar = null;
    }
    removeCrossMarker();
}

// Context menu "Customer Location" button
document.getElementById('context-menu-customer-location').addEventListener('click', function() {
    hideContextMenu();
    if (contextMenuState.latitude !== null && contextMenuState.longitude !== null) {
        showCustomerLocationSidebar(contextMenuState.latitude, contextMenuState.longitude);
    }
});

// Customer location sidebar close button
document.getElementById('customer-location-close-btn').addEventListener('click', closeCustomerLocationSidebar);

// ==========================================
// SIDEBAR ANIMATION HELPERS
// ==========================================

// Track current open sidebar type for animation decisions
let currentOpenSidebar = null; // 'help', 'add-partner', 'partner', or null

// Sidebar type constants
const SIDEBAR_TYPES = {
    HELP: 'help',
    ADD_PARTNER: 'add-partner',
    PARTNER: 'partner',
    CUSTOMER_LOCATION: 'customer-location'
};

// Helper function to close a sidebar with animation
function closeSidebar(sidebarElement) {
    sidebarElement.classList.add('sidebar-closed');
    // Remove hidden class after animation completes (for accessibility)
    setTimeout(() => {
        if (sidebarElement.classList.contains('sidebar-closed')) {
            sidebarElement.classList.add('hidden');
        }
    }, 200);
}

// Helper function to open a sidebar with animation
function openSidebar(sidebarElement) {
    // Remove hidden first if present
    sidebarElement.classList.remove('hidden');
    // Force reflow to ensure hidden removal takes effect
    sidebarElement.offsetHeight;
    // Then remove closed class to trigger animation
    sidebarElement.classList.remove('sidebar-closed');
}

// Helper function to close all sidebars
function closeAllSidebars() {
    const helpSidebar = document.getElementById('help-sidebar');
    const addPartnerSidebar = document.getElementById('add-partner-sidebar');
    const partnerSidebar = document.getElementById('partner-sidebar');
    const customerLocationSidebar = document.getElementById('customer-location-sidebar');
    
    closeSidebar(helpSidebar);
    closeSidebar(addPartnerSidebar);
    closeSidebar(partnerSidebar);
    closeSidebar(customerLocationSidebar);
    currentOpenSidebar = null;
    
    // Remove cross marker when closing all sidebars
    removeCrossMarker();
}

// Helper function to switch between sidebars with slide+fade animation
function switchToSidebar(sidebarElement, sidebarType) {
    const helpSidebar = document.getElementById('help-sidebar');
    const addPartnerSidebar = document.getElementById('add-partner-sidebar');
    const partnerSidebar = document.getElementById('partner-sidebar');
    const customerLocationSidebar = document.getElementById('customer-location-sidebar');
    
    // Remove cross marker when switching sidebars
    removeCrossMarker();
    
    // Close current sidebar first and ensure hidden is added after animation
    let closingSidebar = null;
    if (currentOpenSidebar === SIDEBAR_TYPES.HELP) {
        closingSidebar = helpSidebar;
    } else if (currentOpenSidebar === SIDEBAR_TYPES.ADD_PARTNER) {
        closingSidebar = addPartnerSidebar;
    } else if (currentOpenSidebar === SIDEBAR_TYPES.PARTNER) {
        closingSidebar = partnerSidebar;
    } else if (currentOpenSidebar === SIDEBAR_TYPES.CUSTOMER_LOCATION) {
        closingSidebar = customerLocationSidebar;
    }
    
    if (closingSidebar) {
        closingSidebar.classList.add('sidebar-closed');
        // Add hidden class after animation completes to fully remove from rendering
        setTimeout(() => {
            if (closingSidebar.classList.contains('sidebar-closed')) {
                closingSidebar.classList.add('hidden');
            }
        }, 200);
    }
    
    // Wait for close animation to complete before opening new sidebar
    setTimeout(() => {
        sidebarElement.classList.remove('hidden');
        sidebarElement.offsetHeight; // Force reflow
        sidebarElement.classList.remove('sidebar-closed');
        currentOpenSidebar = sidebarType;
    }, 200);
}
