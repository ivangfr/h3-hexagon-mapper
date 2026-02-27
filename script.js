// Initialize the map centered on a specific location (e.g., Berlin)
const map = L.map('map').setView([52.5200, 13.4050], 15);

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
    isMeasuring = true;
    // Clean up any existing measurement line
    if (measurementLine) {
        map.removeLayer(measurementLine);
        measurementLine = null;
    }
    measurementStart = null;

    // Show drawing mode indicator and overlay
    document.getElementById('drawing-overlay').classList.remove('hidden');
    document.getElementById('drawing-mode-indicator').textContent = 'Measurement Mode Active';
    document.getElementById('drawing-mode-indicator').classList.remove('hidden');
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

    // Hide drawing mode indicator, overlay, and measurement display
    document.getElementById('drawing-overlay').classList.add('hidden');
    document.getElementById('drawing-mode-indicator').classList.add('hidden');
    document.getElementById('measurement-display').classList.add('hidden');
}

function calculateDistance(start, end) {
    const startLatLng = L.latLng(start.lat, start.lng);
    const endLatLng = L.latLng(end.lat, end.lng);
    return startLatLng.distanceTo(endLatLng) / 1000; // Convert meters to kilometers
}

// Add event listener to the map for click events
map.on('click', function(e) {
    if (isMeasuring) {
        const { lat, lng } = e.latlng;
        if (!measurementStart) {
            // First click - set measurement start point
            measurementStart = { lat, lng };
        } else {
            // Second click - clear measurement and reset button
            stopMeasurement();
            const measurementToggle = document.getElementById('measurement-toggle');
            measurementToggle.textContent = 'Start Measurement';
            measurementToggle.style.backgroundColor = '';
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
    const lat = e.latlng.lat.toFixed(4);
    const lng = e.latlng.lng.toFixed(4);

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

// Function to toggle help sidebar
function toggleHelpSidebar() {
    const sidebar = document.getElementById('help-sidebar');
    sidebar.style.display = (sidebar.style.display === 'block') ? 'none' : 'block';
}

// Add event listener to toggle the help sidebar
const helpSidebarToggle = document.getElementById('help-sidebar-toggle');
helpSidebarToggle.addEventListener('click', toggleHelpSidebar);

// Add event listener to toggle measurement mode
const measurementToggle = document.getElementById('measurement-toggle');
measurementToggle.addEventListener('click', function() {
    if (!isMeasuring) {
        startMeasurement();
        measurementToggle.textContent = 'Stop Measurement';
        measurementToggle.style.backgroundColor = '#16a34a';
    } else {
        stopMeasurement();
        measurementToggle.textContent = 'Start Measurement';
        measurementToggle.style.backgroundColor = '';
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

// Load HexagonMapperData format (new unified format)
function loadHexagonMapperData(data) {
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
let currentPopupPartnerId = null;
let editMode = {
    isActive: false,
    partnerId: null
};

// Partner constants
const PARTNER_CONSTANTS = {
    DEFAULT_OPACITY: 0.1,
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
    
    // Add click event listener to show popup
    marker.on('click', function() {
        showPartnerPopup(partnerId);
    });

    // Draw primary hexagons
    const centerCell = h3.latLngToCell(latitude, longitude, h3Resolution);
    const disk = h3.gridDisk(centerCell, numZones - 1);
    disk.forEach((cell, index) => {
        const boundary = h3.cellToBoundary(cell);
        const polygon = L.polygon(boundary, {
            color: actualColor,
            fillColor: actualColor,
            weight: 2,
            fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY
        }).addTo(map);
        
        const hexagonObject = {
            h3Index: cell,
            polygon: polygon,
            center: { lat: latitude, lng: longitude },
            layerType: 'primary',
            h3Resolution: h3Resolution,
            zoneNumber: index + 1
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
                weight: 2,
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY
            }).addTo(map);
            
            const hexagonObject = {
                h3Index: cell,
                polygon: polygon,
                center: { lat: latitude, lng: longitude },
                layerType: 'secondary',
                h3Resolution: h3Resolution2,
                zoneNumber: index + 1
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

// Show partner popup slide window
function showPartnerPopup(partnerId) {
    const partner = partnersById[partnerId];
    if (!partner) return;

    // Update slide window content
    document.getElementById('slide-partner-id').textContent = partnerId;

    // Update partner statistics table
    const tableBody = document.getElementById('partner-stats-table').querySelector('tbody');
    tableBody.innerHTML = '';

    const primaryCount = partner.elements.primaryHexagons.length;
    const secondaryCount = partner.elements.secondaryHexagons.length;

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

    // Set initial toggle states
    const primaryVisible = partner.elements.primaryHexagons.length > 0 && partner.elements.primaryHexagons[0].polygon.options.fillOpacity > 0;
    const secondaryVisible = partner.elements.secondaryHexagons.length > 0 && partner.elements.secondaryHexagons[0].polygon.options.fillOpacity > 0;
    const hasSecondaryHexagons = partner.elements.secondaryHexagons.length > 0;

    document.getElementById('toggle-primary-zone').checked = primaryVisible;
    document.getElementById('toggle-secondary-zone').checked = secondaryVisible;

    // Configure secondary toggle based on availability
    const secondaryToggle = document.getElementById('toggle-secondary-zone');
    const secondaryContainer = secondaryToggle.closest('.flex');

    if (hasSecondaryHexagons) {
        secondaryToggle.disabled = false;
        secondaryContainer.classList.remove('opacity-50', 'cursor-not-allowed');
        secondaryContainer.style.pointerEvents = 'auto';
    } else {
        secondaryToggle.disabled = true;
        secondaryContainer.classList.add('opacity-50', 'cursor-not-allowed');
        secondaryContainer.style.pointerEvents = 'none';
    }

    // Show slide window
    const slideWindow = document.getElementById('partner-slide-window');
    slideWindow.classList.remove('hidden');
    slideWindow.classList.remove('translate-x-full');

    currentPopupPartnerId = partnerId;
}

// Close partner popup slide window
function closePartnerPopup() {
    const slideWindow = document.getElementById('partner-slide-window');
    slideWindow.classList.add('translate-x-full');
    
    setTimeout(() => {
        slideWindow.classList.add('hidden');
    }, 300);
    
    currentPopupPartnerId = null;
}

// Reset sidebar form
function resetSidebarForm() {
    document.getElementById('add-partner-form').reset();
    document.getElementById('sidebar-resolution-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_RESOLUTION.toString();
    document.getElementById('sidebar-zones-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_NUMBER_ZONES.toString();
    document.getElementById('sidebar-resolution2-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_RESOLUTION.toString();
    document.getElementById('sidebar-zones2-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_NUMBER_ZONES.toString();
    document.getElementById('secondary-fields').classList.add('hidden');
    
    editMode.isActive = false;
    editMode.partnerId = null;
    
    document.querySelector('#add-partner-sidebar h2').textContent = 'Add Partner';
    const submitButton = document.querySelector('#add-partner-form button[type="submit"]');
    submitButton.textContent = 'Add';
}

// Open sidebar for editing a partner
function openSidebarForEdit(partner) {
    editMode.isActive = true;
    editMode.partnerId = partner.partnerId;

    document.querySelector('#add-partner-sidebar h2').textContent = 'Edit Partner';
    const submitButton = document.querySelector('#add-partner-form button[type="submit"]');
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
    if (partner.h3Resolution2 !== undefined && partner.numZones2 !== undefined) {
        document.getElementById('sidebar-enable-secondary').checked = true;
        document.getElementById('sidebar-h3Resolution2').value = partner.h3Resolution2;
        document.getElementById('sidebar-numZones2').value = partner.numZones2;
        document.getElementById('sidebar-color2').value = partner.color2 || partner.color || PARTNER_CONSTANTS.DEFAULT_COLOR;
        document.getElementById('sidebar-resolution2-value').textContent = partner.h3Resolution2.toString();
        document.getElementById('sidebar-zones2-value').textContent = partner.numZones2.toString();
    } else {
        document.getElementById('sidebar-enable-secondary').checked = false;
        document.getElementById('sidebar-color2').value = partner.color || PARTNER_CONSTANTS.DEFAULT_COLOR;
    }
    
    // Toggle secondary fields visibility
    const enableSecondary = document.getElementById('sidebar-enable-secondary').checked;
    if (enableSecondary) {
        document.getElementById('secondary-fields').classList.remove('hidden');
    } else {
        document.getElementById('secondary-fields').classList.add('hidden');
    }

    document.getElementById('add-partner-sidebar').classList.remove('hidden');
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

// Add Partner sidebar button
document.getElementById('add-partner-sidebar-btn').addEventListener('click', function() {
    closePartnerPopup();
    const sidebar = document.getElementById('add-partner-sidebar');
    if (sidebar.classList.contains('hidden')) {
        editMode.isActive = false;
        editMode.partnerId = null;
        document.querySelector('#add-partner-sidebar h2').textContent = 'Add Partner';
        const submitButton = document.querySelector('#add-partner-form button[type="submit"]');
        submitButton.textContent = 'Add';
        document.getElementById('add-partner-form').reset();
        document.getElementById('sidebar-resolution-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_RESOLUTION.toString();
        document.getElementById('sidebar-zones-value').textContent = PARTNER_CONSTANTS.DEFAULT_PRIMARY_NUMBER_ZONES.toString();
        document.getElementById('sidebar-resolution2-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_RESOLUTION.toString();
        document.getElementById('sidebar-zones2-value').textContent = PARTNER_CONSTANTS.DEFAULT_SECONDARY_NUMBER_ZONES.toString();
        document.getElementById('secondary-fields').classList.add('hidden');
        sidebar.classList.remove('hidden');
    } else {
        sidebar.classList.add('hidden');
    }
});

// Sidebar close button
document.getElementById('sidebar-close-btn').addEventListener('click', function() {
    document.getElementById('add-partner-sidebar').classList.add('hidden');
    resetSidebarForm();
});

// Sidebar cancel button
document.getElementById('sidebar-cancel-add').addEventListener('click', function() {
    document.getElementById('add-partner-sidebar').classList.add('hidden');
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

// Primary color change to sync secondary color
document.getElementById('sidebar-color').addEventListener('input', function() {
    if (document.getElementById('sidebar-enable-secondary').checked) {
        document.getElementById('sidebar-color2').value = this.value;
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
        // Add new partner
        addPartnerToMap(partner);
    }

    // Close sidebar and reset form
    document.getElementById('add-partner-sidebar').classList.add('hidden');
    resetSidebarForm();
});

// Partner slide window close button
document.getElementById('slide-close-btn').addEventListener('click', closePartnerPopup);

// Edit partner button
document.getElementById('edit-partner-btn').addEventListener('click', function() {
    const partnerId = currentPopupPartnerId;
    if (!partnerId) return;

    const partner = partnersById[partnerId];
    if (!partner) return;

    closePartnerPopup();
    openSidebarForEdit(partner);
});

// Delete partner button
document.getElementById('delete-partner-btn').addEventListener('click', function() {
    const partnerId = currentPopupPartnerId;
    if (!partnerId) return;

    const partner = partnersById[partnerId];
    if (!partner) return;

    const confirmed = confirm(`Are you sure you want to delete partner "${partnerId}"? This action cannot be undone.`);
    if (confirmed) {
        deletePartner(partnerId);
        closePartnerPopup();
    }
});

// Toggle primary zone
document.getElementById('toggle-primary-zone').addEventListener('change', function() {
    if (!currentPopupPartnerId) return;
    togglePrimaryHexagonsVisibility(currentPopupPartnerId, this.checked);
});

// Toggle secondary zone
document.getElementById('toggle-secondary-zone').addEventListener('change', function() {
    if (!currentPopupPartnerId) return;
    toggleSecondaryHexagonsVisibility(currentPopupPartnerId, this.checked);
});
