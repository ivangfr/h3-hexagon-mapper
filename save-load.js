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
                interactive: false
            }).addTo(map);

            // Get center coordinates from h3Index
            const cellCenter = h3.cellToLatLng(h3Index);
            standaloneHexagons[h3Index] = {
                polygon, 
                latitude: cellCenter[0], 
                longitude: cellCenter[1]
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
