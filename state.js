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
let measurementEndMarker = null;
let measurementLineColor = '#555555';
let measurementCompleted = false;

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
