// Initialize the map centered on a specific location (e.g., Berlin)
const map = L.map('map').setView([52.5200, 13.4050], 15);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Store generated hexagons and their polygons
const hexagons = {};
const markers = [];
const drawnLines = [];

// Default settings
let resolution = 9;
let color = '#0000ff';
let opacity = 0.3;

// Drawing settings
let isDrawing = false;
let currentLine = null;
let currentLinePoints = [];

// Measurement settings
let isMeasuring = false;
let measurementStart = null;
let measurementLine = null;

// Action stacks for undo and redo
let actionStack = [];
let redoStack = [];

function addAction(action) {
    actionStack.push(action);
    redoStack = []; // Clear redo stack on new action
    updateUndoButtonState();
    updateRedoButtonState();
}

function undoAction() {
    if (actionStack.length > 0) {
        const action = actionStack.pop();
        redoStack.push(action);
        if (action.type === 'addHexagon') {
            removeHexagon(action.data, false);
        } else if (action.type === 'removeHexagon') {
            addHexagon(action.data, false);
        } else if (action.type === 'addMarker') {
            removeMarker(action.data, false);
        } else if (action.type === 'removeMarker') {
            addMarker(action.data, false);
        } else if (action.type === 'drawLine') {
            if (drawnLines.length > 0) {
                const line = drawnLines.pop();
                map.removeLayer(line);
            }
        }
        updateUndoButtonState();
        updateRedoButtonState();
    }
}

function redoAction() {
    if (redoStack.length > 0) {
        const action = redoStack.pop();
        actionStack.push(action);
        if (action.type === 'addHexagon') {
            addHexagon(action.data, false);
        } else if (action.type === 'removeHexagon') {
            removeHexagon(action.data, false);
        } else if (action.type === 'addMarker') {
            addMarker(action.data, false);
        } else if (action.type === 'removeMarker') {
            removeMarker(action.data, false);
        } else if (action.type === 'drawLine') {
            const line = L.polyline(action.data.points, {
                color: color,
                weight: 8,
                opacity: 1.0
            }).addTo(map);
            drawnLines.push(line);
        }
        updateUndoButtonState();
        updateRedoButtonState();
    }
}

document.getElementById('undo-btn').addEventListener('click', undoAction);
document.getElementById('redo-btn').addEventListener('click', redoAction);

// Button state management functions
function updateUndoButtonState() {
    const undoBtn = document.getElementById('undo-btn');
    if (actionStack.length === 0) {
        undoBtn.disabled = true;
    } else {
        undoBtn.disabled = false;
    }
}

function updateRedoButtonState() {
    const redoBtn = document.getElementById('redo-btn');
    if (redoStack.length === 0) {
        redoBtn.disabled = true;
    } else {
        redoBtn.disabled = false;
    }
}

// Initialize button states
updateUndoButtonState();
updateRedoButtonState();



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
function addHexagon(hexagon, recordAction = true) {
    const { h3Index, latitude, longitude, resolution, color, opacity } = hexagon;
    const hexagonBoundary = h3.cellToBoundary(h3Index);
    const polygon = L.polygon(hexagonBoundary, {
        color: color,
        fillColor: color,
        fillOpacity: opacity,
        originalFillOpacity: opacity
    }).addTo(map);

    hexagons[h3Index] = { polygon, latitude, longitude };
    addHexagonToList(h3Index, color, opacity);

    if (recordAction) {
        addAction({ type: 'addHexagon', data: hexagon });
    }
}

// Function to remove a hexagon from the map
function removeHexagon(hexagon, recordAction = true) {
    const { h3Index } = hexagon;
    if (hexagons[h3Index]) {
        map.removeLayer(hexagons[h3Index].polygon);
        delete hexagons[h3Index];
        removeHexagonFromList(h3Index);

        if (recordAction) {
            addAction({ type: 'removeHexagon', data: hexagon });
        }
    }
}

// Function to add hexagon ID to the list
function addHexagonToList(h3Index, fillColor, fillOpacity) {
    const hexagonList = document.getElementById('hexagon-list');
    const listItem = document.createElement('li');
    listItem.id = h3Index;
    listItem.classList.add('hexagon-list-item');

    const colorSquare = document.createElement('div');
    colorSquare.className = 'hexagon-color';
    colorSquare.style.backgroundColor = fillColor;
    colorSquare.style.opacity = fillOpacity;

    const hexagonText = document.createElement('span');
    hexagonText.textContent = h3Index;

    listItem.appendChild(colorSquare);
    listItem.appendChild(hexagonText);

    listItem.addEventListener('mouseover', function() {
        hexagons[h3Index].polygon.setStyle({ fillOpacity: 1.0 });
    });

    listItem.addEventListener('mouseout', function() {
        const originalFillOpacity = hexagons[h3Index].polygon.options.originalFillOpacity;
        hexagons[h3Index].polygon.setStyle({ fillOpacity: originalFillOpacity });
    });

    listItem.addEventListener('click', function() {
        const hexagon = hexagons[h3Index];
        color = hexagon.polygon.options.color;
        opacity = hexagon.polygon.options.originalFillOpacity;
        document.getElementById('color-picker').value = color;
        document.getElementById('opacity').value = opacity;
        document.getElementById('opacity-value').textContent = opacity;
    });

    hexagonList.appendChild(listItem);
}

// Function to remove hexagon ID from the list
function removeHexagonFromList(h3Index) {
    const listItem = document.getElementById(h3Index);
    if (listItem) {
        listItem.remove();
    }
}

// Drawing functions
function startDrawing() {
    isDrawing = true;
    currentLinePoints = [];
    currentLine = null;
    
    // Show drawing mode indicator and overlay
    document.getElementById('drawing-overlay').classList.remove('hidden');
    document.getElementById('drawing-mode-indicator').classList.remove('hidden');
}

function stopDrawing() {
    isDrawing = false;
    currentLine = null;
    currentLinePoints = []
    
    // Hide drawing mode indicator and overlay
    document.getElementById('drawing-overlay').classList.add('hidden');
    document.getElementById('drawing-mode-indicator').classList.add('hidden');
}

function finalizeLine() {
    if (currentLinePoints.length > 1 && currentLine) {
        drawnLines.push(currentLine);
        const points = currentLinePoints.map(p => [p[0], p[1]]);
        addAction({ type: 'drawLine', data: { points: points } });
    }
    currentLinePoints = [];
    currentLine = null;
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
    if (isDrawing) {
        return; // Don't add hexagons while drawing
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
            measurementToggle.textContent = 'Start Measurement';
            measurementToggle.style.backgroundColor = '';
        }
        return;
    }
    if (markerPopup.style.display === 'block') {
        markerPopup.style.display = 'none';
    } else {
        const { lat, lng } = e.latlng;
        generateH3Grid(lat, lng, resolution, color, opacity, map);
    }
});

// Drawing mode: mouse down to start drawing
map.on('mousedown', function(e) {
    if (!isDrawing) return;
    const { lat, lng } = e.latlng;
    currentLinePoints = [[lat, lng]];
    currentLine = L.polyline([[lat, lng]], {
        color: color,
        weight: 8,
        opacity: 1.0
    }).addTo(map);
});

// Drawing mode: mouse move to draw
map.on('mousemove', function(e) {
    if (!isDrawing || !currentLine) return;
    const { lat, lng } = e.latlng;
    currentLinePoints.push([lat, lng]);
    currentLine.setLatLngs(currentLinePoints);
});

// Drawing mode: mouse up to finish the stroke
map.on('mouseup', function() {
    if (!isDrawing || !currentLine) return;
    finalizeLine();
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

// Function to toggle sidebars
function toggleSidebar(sidebarId) {
    const sidebars = ['hexagon-sidebar', 'help-sidebar'];
    sidebars.forEach(function(id) {
        const sidebar = document.getElementById(id);
        if (id === sidebarId) {
            sidebar.style.display = (sidebar.style.display === 'block') ? 'none' : 'block';
        } else {
            sidebar.style.display = 'none';
        }
    });
}

// Add event listener to toggle the hexagon sidebar
const sidebarToggle = document.getElementById('hexagon-sidebar-toggle');
sidebarToggle.addEventListener('click', function() {
    toggleSidebar('hexagon-sidebar');
});

// Add event listener to toggle the help sidebar
const helpSidebarToggle = document.getElementById('help-sidebar-toggle');
helpSidebarToggle.addEventListener('click', function() {
    toggleSidebar('help-sidebar');
});

// Add event listener to toggle drawing mode
const drawToggle = document.getElementById('draw-toggle');
drawToggle.addEventListener('click', function() {
    if (!isDrawing) {
        startDrawing();
        drawToggle.textContent = 'Stop Drawing';
        drawToggle.style.backgroundColor = '#16a34a';
        map.dragging.disable();
    } else {
        stopDrawing();
        drawToggle.textContent = 'Start Drawing';
        drawToggle.style.backgroundColor = '';
        map.dragging.enable();
    }
});

// Add event listener to toggle measurement mode
const measurementToggle = document.getElementById('measurement-toggle');
measurementToggle.addEventListener('click', function() {
    if (!isMeasuring) {
        // Stop drawing mode if active
        if (isDrawing) {
            stopDrawing();
            drawToggle.textContent = 'Start Drawing';
            drawToggle.style.backgroundColor = '';
            map.dragging.enable();
        }
        startMeasurement();
        measurementToggle.textContent = 'Stop Measurement';
        measurementToggle.style.backgroundColor = '#16a34a';
    } else {
        stopMeasurement();
        measurementToggle.textContent = 'Start Measurement';
        measurementToggle.style.backgroundColor = '';
    }
});

// Add event listener for right-click to open the popup
const markerPopup = document.getElementById('marker-popup');
const markerNameInput = document.getElementById('marker-name');
const addMarkerBtn = document.getElementById('add-marker-btn');
const cancelMarkerBtn = document.getElementById('cancel-marker-btn');
let currentLatLng;

// Add event listener to open the marker popup on right-click
map.on('contextmenu', function(e) {
    currentLatLng = e.latlng;
    markerPopup.style.display = 'block';
    markerPopup.style.left = `${e.containerPoint.x}px`;
    markerPopup.style.top = `${e.containerPoint.y}px`;
    markerNameInput.value = '';
    markerNameInput.focus();
});

// Add event listener to add marker on clicking OK
addMarkerBtn.addEventListener('click', function() {
    const markerName = markerNameInput.value;
    if (markerName) {
        const marker = L.marker(currentLatLng).addTo(map)
            .bindPopup(markerName)
            .openPopup();
        markers.push(marker);

        addAction({ type: 'addMarker', data: { id: marker._leaflet_id, lat: currentLatLng.lat, lng: currentLatLng.lng, name: markerName } });

        marker.on('contextmenu', function() {
            removeMarker({ id: marker._leaflet_id, lat: currentLatLng.lat, lng: currentLatLng.lng, name: markerName });
        });

        markerPopup.style.display = 'none';
    }
});

// Add event listener to add marker on pressing Enter
markerNameInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addMarkerBtn.click();
    }
});

// Add event listener to cancel adding marker
cancelMarkerBtn.addEventListener('click', function() {
    markerPopup.style.display = 'none';
});

// Function to add a marker to the map
function addMarker(marker, recordAction = true) {
    const { id, lat, lng, name } = marker;
    const markerLayer = L.marker([lat, lng]).addTo(map)
        .bindPopup(name)
        .openPopup();
    markers.push(markerLayer);

    marker.id = markerLayer._leaflet_id;

    if (recordAction) {
        addAction({ type: 'addMarker', data: marker });
    }

    markerLayer.on('contextmenu', function() {
        removeMarker(marker);
    });
}

// Function to remove a marker from the map
function removeMarker(marker, recordAction = true) {
    const { id } = marker;
    const markerLayer = markers.find(m => m._leaflet_id === id);
    if (markerLayer) {
        map.removeLayer(markerLayer);
        const index = markers.indexOf(markerLayer);
        if (index >= 0) {
            markers.splice(index, 1);
        }

        if (recordAction) {
            addAction({ type: 'removeMarker', data: marker });
        }
    }
}

// Function to save hexagons and markers to GeoJSON
function saveGeoJSON() {
    const geoJson = {
        type: "FeatureCollection",
        timestamp: new Date().toISOString(),
        features: [
            ...Object.keys(hexagons).map(h3Index => {
                const { polygon, latitude, longitude } = hexagons[h3Index];
                return {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [polygon.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat])]
                    },
                    properties: {
                        h3Index,
                        color: polygon.options.color,
                        fillColor: polygon.options.fillColor,
                        fillOpacity: polygon.options.fillOpacity,
                        latitude,
                        longitude
                    }
                };
            }),
            ...drawnLines.map((line, index) => {
                const coordinates = line.getLatLngs().map(latlng => [latlng.lng, latlng.lat]);
                return {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: coordinates
                    },
                    properties: {
                        type: "drawnLine",
                        lineIndex: index,
                        color: line.options.color,
                        weight: line.options.weight
                    }
                };
            }),
            ...markers.map(marker => {
                const { lat, lng } = marker.getLatLng();
                return {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    properties: {
                        name: marker.getPopup().getContent()
                    }
                };
            })
        ]
    };

    const blob = new Blob([JSON.stringify(geoJson)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hexagons.geojson";
    a.click();
    URL.revokeObjectURL(url);
}

// Function to load hexagons and markers from GeoJSON
function loadGeoJSON(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            let geoJson;
            try {
                geoJson = JSON.parse(e.target.result);
            } catch (error) {
                alert("Invalid GeoJSON format. Please select a valid GeoJSON file.");
                return;
            }

            // Clear existing hexagons
            Object.keys(hexagons).forEach(h3Index => {
                map.removeLayer(hexagons[h3Index].polygon);
                removeHexagonFromList(h3Index);
                delete hexagons[h3Index];
            });

            // Clear existing drawn lines
            drawnLines.forEach(line => map.removeLayer(line));
            drawnLines.length = 0;

            // Clear existing markers
            markers.forEach(marker => map.removeLayer(marker));
            markers.length = 0;

            // Clear action stacks
            actionStack = [];
            redoStack = [];

            // Load new hexagons, lines and markers
            geoJson.features.forEach(feature => {
                if (feature.geometry.type === "Polygon") {
                    const { h3Index, color, fillColor, fillOpacity, latitude, longitude } = feature.properties;
                    const hexagonBoundary = h3.cellToBoundary(h3Index);
                    const polygon = L.polygon(hexagonBoundary, {
                        color,
                        fillColor,
                        fillOpacity,
                        originalFillOpacity: fillOpacity
                    }).addTo(map);

                    hexagons[h3Index] = { polygon, latitude, longitude };
                    addHexagonToList(h3Index, color, opacity);
                } else if (feature.geometry.type === "LineString") {
                    if (feature.properties.type === "drawnLine") {
                        const coordinates = feature.geometry.coordinates;
                        const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
                        const line = L.polyline(latLngs, {
                            color: feature.properties.color,
                            weight: feature.properties.weight
                        }).addTo(map);
                        drawnLines.push(line);
                    }
                } else if (feature.geometry.type === "Point") {
                    const [lng, lat] = feature.geometry.coordinates;
                    const marker = L.marker([lat, lng]).addTo(map)
                        .bindPopup(feature.properties.name)
                        .openPopup();
                    markers.push(marker);

                    marker.on('contextmenu', function() {
                        map.removeLayer(marker);
                        const index = markers.indexOf(marker);
                        if (index >= 0) {
                            markers.splice(index, 1);
                        }
                    });
                }
            });
            // Reset the file input value to allow reloading the same file
            event.target.value = '';
        };
        reader.readAsText(file);
    }
}

// Add event listeners for save and load buttons
document.getElementById('save-btn').addEventListener('click', saveGeoJSON);
document.getElementById('load-btn').addEventListener('click', function() {
    document.getElementById('load-file').click();
});
document.getElementById('load-file').addEventListener('change', loadGeoJSON);