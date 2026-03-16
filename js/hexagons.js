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
