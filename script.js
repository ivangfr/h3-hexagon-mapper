// Initialize the map centered on a specific location (e.g., Berlin)
const map = L.map('map').setView([52.5200, 13.4050], 15);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Store generated hexagons and their polygons
const hexagons = {};
const markers = [];

// Default settings
let resolution = 9;
let color = '#0000ff';
let opacity = 0.3;

// Action stacks for undo and redo
let actionStack = [];
let redoStack = [];

function addAction(action) {
    actionStack.push(action);
    redoStack = []; // Clear redo stack on new action
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
        }
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
        }
    }
}

document.getElementById('undo-btn').addEventListener('click', undoAction);
document.getElementById('redo-btn').addEventListener('click', redoAction);

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

// Add event listener to the map for click events
map.on('click', function(e) {
    if (markerPopup.style.display === 'block') {
        markerPopup.style.display = 'none';
    } else {
        const { lat, lng } = e.latlng;
        generateH3Grid(lat, lng, resolution, color, opacity, map);
    }
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
map.on('mousemove', function(e) {
    const lat = e.latlng.lat.toFixed(4);
    const lng = e.latlng.lng.toFixed(4);
    cursorCoordinates.textContent = `Lat: ${lat}, Lon: ${lng}`;
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

            // Clear existing markers
            markers.forEach(marker => map.removeLayer(marker));
            markers.length = 0;

            // Clear action stacks
            actionStack = [];
            redoStack = [];

            // Load new hexagons and markers
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