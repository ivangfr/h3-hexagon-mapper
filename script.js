// Initialize the map centered on a specific location (e.g., Berlin)
const map = L.map('map').setView([52.5200, 13.4050], 15);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Store generated hexagons and their polygons
const hexagons = {};

// Function to generate and display H3 grid cells
function generateH3Grid(latitude, longitude, resolution, color, opacity, map) {
    const h3Index = h3.latLngToCell(latitude, longitude, resolution);
    console.log(`Generating H3 grid for index: ${h3Index}`);
    
    if (hexagons[h3Index]) {
        console.log(`Removing hexagon with index: ${h3Index}`);
        map.removeLayer(hexagons[h3Index].polygon);
        delete hexagons[h3Index];
        removeHexagonFromList(h3Index);
    } else {
        console.log(`Adding hexagon with index: ${h3Index}`);
        const hexagonBoundary = h3.cellToBoundary(h3Index);
        const polygon = L.polygon(hexagonBoundary, {
            color: color,
            fillColor: color,
            fillOpacity: opacity
        }).addTo(map);

        hexagons[h3Index] = { polygon, latitude, longitude };
        addHexagonToList(h3Index);
    }
}

// Function to add hexagon ID to the list
function addHexagonToList(h3Index) {
    const hexagonList = document.getElementById('hexagon-list');
    const listItem = document.createElement('li');
    listItem.textContent = h3Index;
    listItem.id = h3Index;
    listItem.classList.add('hexagon-list-item'); // Add class

    listItem.addEventListener('mouseover', function() {
        hexagons[h3Index].polygon.setStyle({ fillOpacity: 0.6 });
    });

    listItem.addEventListener('mouseout', function() {
        hexagons[h3Index].polygon.setStyle({ fillOpacity: opacity });
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

let resolution = 9; // Default resolution
let color = '#0000ff'; // Default color
let opacity = 0.3; // Default opacity

// Add event listener to the map for click events
map.on('click', function(e) {
    // Close the marker popup if it is open
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
    var sidebars = ['hexagon-sidebar', 'help-sidebar'];
    sidebars.forEach(function(id) {
        var sidebar = document.getElementById(id);
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
const markers = [];

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

        marker.on('contextmenu', function() {
            map.removeLayer(marker);
        });

        markerPopup.style.display = 'none';
    }
});

// Add event listener to cancel adding marker
cancelMarkerBtn.addEventListener('click', function() {
    markerPopup.style.display = 'none';
});