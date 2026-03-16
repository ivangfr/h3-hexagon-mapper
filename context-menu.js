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
    try {
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
    } catch (e) {
        return false;
    }
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
    // Pre-build Turf polygon objects once so they are not recreated per hexagon.
    const deliveryTurfPolygons = deliveryPolygons.map(polyObj => {
        const latlngs = polyObj.polygon.getLatLngs()[0];
        const polyCoords = latlngs.map(ll => [ll.lat, ll.lng]);
        return polyCoords;
    });

    function checkHexagonIntersection(hexagon) {
        const hexBoundary = h3.cellToBoundary(hexagon.h3Index);
        
        // Check if hexagon intersects with ANY delivery polygon's outer boundary
        const intersectsOuter = deliveryTurfPolygons.some(polyCoords => {
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
    // NOTE: This is a linear scan over all hexagons. Performance degrades as
    // the number of partners / standalone hexagons grows. Consider spatial
    // indexing (e.g. an H3 cell lookup) if large datasets become a concern.
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
// Hide context menu on document click (outside menu); close export dropdown too
document.addEventListener('click', function(e) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
    
    const dropdown = document.getElementById('delivery-area-export-dropdown');
    const exportBtn = document.getElementById('delivery-area-export-btn');
    if (!dropdown.contains(e.target) && !exportBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// Global Escape key handler — exits measurement mode or delivery area mode
document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    
    if (isMeasuring) {
        stopMeasurement();
    } else if (deliveryAreaMode) {
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
