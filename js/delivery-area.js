// ==========================================
// DELIVERY AREA DRAWING MODE
// ==========================================

const DELIVERY_AREA_CONSTANTS = {
    LINE_COLOR: '#15489a',
    LINE_WEIGHT: 4,
    LINE_OPACITY: 0.8,
    TEMP_LINE_DASH_ARRAY: '8, 8',
    POLYGON_FILL_COLOR: '#15489a',
    SNAP_TOLERANCE_PIXELS: 20
};

/**
 * Creates a start point marker icon for delivery area drawing.
 */
function createDeliveryAreaStartIcon(isNearStart = false) {
    const scale = isNearStart ? 'scale(1.3)' : 'scale(1)';
    return L.divIcon({
        className: 'delivery-area-start-marker',
        html: `<div class="delivery-area-start-marker-icon ${isNearStart ? 'near-start' : ''}" style="transform: ${scale};"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

/**
 * Creates a vertex marker icon for delivery area polygon points.
 */
function createDeliveryAreaVertexIcon() {
    return L.divIcon({
        className: 'delivery-area-vertex-marker',
        html: '<div class="delivery-area-vertex-marker"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
}

/**
 * Activates delivery area drawing mode.
 */
function startDeliveryAreaMode() {
    // Remember if there was a cross marker before starting
    deliveryAreaHadCrossMarker = !!contextMenuState.crossMarker;
    
    // Clear any existing pending delivery area polygons from previous sessions
    clearPendingDeliveryAreaPolygons();
    
    // Hide the partner form sidebar
    const partnerFormSidebar = document.getElementById('partner-form-sidebar');
    closeSidebar(partnerFormSidebar);
    
    // Collapse controls panel on mobile
    setControlsCollapsed(true);
    
    // Initialize drawing state
    deliveryAreaMode = true;
    deliveryAreaPoints = [];
    deliveryAreaLines = [];
    deliveryAreaTempLine = null;
    deliveryAreaStartMarker = null;
    deliveryAreaVertexMarkers = [];
    deliveryAreaNearStartPoint = false;
    
    // Disable all controls in the controls panel
    const controlsPanel = document.getElementById('controls');
    controlsPanel.classList.add('controls-disabled');
    
    // Disable all interactive elements within the controls panel
    const interactiveElements = controlsPanel.querySelectorAll('button, input, label');
    interactiveElements.forEach(el => {
        el.style.pointerEvents = 'none';
    });
    
    // Disable partner marker clicks
    Object.values(partnersById).forEach(partner => {
        if (partner.marker) {
            partner.marker.off('click');
        }
    });
    
    // Show measurement overlay (for dimming effect)
    document.getElementById('measurement-overlay').classList.remove('hidden');
    
    // Show delivery area mode indicator
    const indicator = document.getElementById('delivery-area-mode-indicator');
    indicator.classList.remove('hidden');
    
    // Re-initialize Lucide icons for the indicator
    lucide.createIcons({ nodes: [indicator] });
}

/**
 * Exits delivery area drawing mode and cleans up.
 */
/**
 * Shared UI teardown for delivery area mode — called by both exitDeliveryAreaMode
 * and exportDeliveryArea (which must NOT clear the polygon layers themselves).
 */
function _teardownDeliveryAreaUI() {
    // Re-enable all controls in the controls panel
    const controlsPanel = document.getElementById('controls');
    controlsPanel.classList.remove('controls-disabled');
    
    // Expand controls panel on mobile
    setControlsCollapsed(false);
    
    // Re-enable all interactive elements within the controls panel
    const interactiveElements = controlsPanel.querySelectorAll('button, input, label');
    interactiveElements.forEach(el => {
        el.style.pointerEvents = 'auto';
    });
    
    // Re-enable partner marker clicks
    Object.values(partnersById).forEach(partner => {
        if (partner.marker) {
            partner.marker.on('click', function() {
                showPartnerSidebar(partner.partnerId);
            });
        }
    });
    
    // Hide measurement overlay
    document.getElementById('measurement-overlay').classList.add('hidden');
    
    // Hide delivery area mode indicator
    document.getElementById('delivery-area-mode-indicator').classList.add('hidden');
    
    // Hide export dropdown
    document.getElementById('delivery-area-export-dropdown').classList.add('hidden');
    
    // Remove pulse animation from Export button
    document.getElementById('delivery-area-export-btn').classList.remove('animate-pulse-custom');
}

function exitDeliveryAreaMode() {
    deliveryAreaMode = false;
    
    // Clear all drawing elements
    clearDeliveryAreaDrawing();
    
    _teardownDeliveryAreaUI();
}

/**
 * Clears all delivery area drawing elements from the map.
 */
function clearDeliveryAreaDrawing() {
    // Clear temporary line
    if (deliveryAreaTempLine) {
        map.removeLayer(deliveryAreaTempLine);
        deliveryAreaTempLine = null;
    }
    
    // Clear all lines
    deliveryAreaLines.forEach(line => {
        map.removeLayer(line);
    });
    deliveryAreaLines = [];
    
    // Clear start marker
    if (deliveryAreaStartMarker) {
        map.removeLayer(deliveryAreaStartMarker);
        deliveryAreaStartMarker = null;
    }
    
    // Clear vertex markers
    deliveryAreaVertexMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    deliveryAreaVertexMarkers = [];
    
    // Clear all completed polygons (multi-polygon support)
    deliveryAreaCompletedPolygons.forEach(polyObj => {
        if (polyObj.layer) {
            map.removeLayer(polyObj.layer);
        }
        if (polyObj.closingLine) {
            map.removeLayer(polyObj.closingLine);
        }
    });
    deliveryAreaCompletedPolygons = [];
    
    // Clear points
    deliveryAreaPoints = [];
    deliveryAreaNearStartPoint = false;
}

/**
 * Removes the last point from the delivery area drawing.
 * Allows users to undo mistakes while drawing.
 */
function removeLastDeliveryAreaPoint() {
    if (deliveryAreaPoints.length === 0) return;
    
    // Remove the last point
    deliveryAreaPoints.pop();
    
    // Reset near start point indicator
    deliveryAreaNearStartPoint = false;
    if (deliveryAreaStartMarker) {
        deliveryAreaStartMarker.setIcon(createDeliveryAreaStartIcon(false));
    }
    
    // If no points left, remove the start marker
    if (deliveryAreaPoints.length === 0) {
        if (deliveryAreaStartMarker) {
            map.removeLayer(deliveryAreaStartMarker);
            deliveryAreaStartMarker = null;
        }
        // Clear temporary line if exists
        if (deliveryAreaTempLine) {
            map.removeLayer(deliveryAreaTempLine);
            deliveryAreaTempLine = null;
        }
        return;
    }
    
    // If only one point left, remove the last vertex marker and last line
    if (deliveryAreaPoints.length === 1) {
        // Remove the last vertex marker
        if (deliveryAreaVertexMarkers.length > 0) {
            const lastVertexMarker = deliveryAreaVertexMarkers.pop();
            map.removeLayer(lastVertexMarker);
        }
        
        // Remove the last line
        if (deliveryAreaLines.length > 0) {
            const lastLine = deliveryAreaLines.pop();
            map.removeLayer(lastLine);
        }
        
        // Clear temporary line
        if (deliveryAreaTempLine) {
            map.removeLayer(deliveryAreaTempLine);
            deliveryAreaTempLine = null;
        }
        return;
    }
    
    // For 2+ points remaining: remove last vertex marker and last line
    if (deliveryAreaVertexMarkers.length > 0) {
        const lastVertexMarker = deliveryAreaVertexMarkers.pop();
        map.removeLayer(lastVertexMarker);
    }
    
    if (deliveryAreaLines.length > 0) {
        const lastLine = deliveryAreaLines.pop();
        map.removeLayer(lastLine);
    }
    
    // Update temporary line to connect to the new last point
    // (The temporary line will be updated on the next mouse move event)
    if (deliveryAreaTempLine) {
        map.removeLayer(deliveryAreaTempLine);
        deliveryAreaTempLine = null;
    }
}

/**
 * Cancels delivery area mode and returns to partner form.
 */
function cancelDeliveryAreaMode() {
    exitDeliveryAreaMode();
    
    // Restore cross marker if it was there before
    if (deliveryAreaHadCrossMarker) {
        const lat = parseFloat(document.getElementById('sidebar-latitude').value);
        const lng = parseFloat(document.getElementById('sidebar-longitude').value);
        if (!isNaN(lat) && !isNaN(lng)) {
            placeCrossMarker(lat, lng);
        }
    }
    
    // Show the partner form sidebar again
    const partnerFormSidebar = document.getElementById('partner-form-sidebar');
    openSidebar(partnerFormSidebar);
}

/**
 * Handles click events during delivery area drawing mode.
 */
function handleDeliveryAreaClick(e) {
    if (!deliveryAreaMode) return;
    
    const { lat, lng } = e.latlng;
    
    // Check if we're near the start point and have at least 3 points (minimum for polygon)
    if (deliveryAreaPoints.length >= 3 && deliveryAreaNearStartPoint) {
        // Close the polygon
        finishDeliveryAreaPolygon();
        return;
    }
    
    // Add new point
    deliveryAreaPoints.push({ lat, lng });
    
    // If this is the first point, add start marker
    if (deliveryAreaPoints.length === 1) {
        deliveryAreaStartMarker = L.marker([lat, lng], {
            icon: createDeliveryAreaStartIcon(false),
            zIndexOffset: 1000,
            interactive: false
        }).addTo(map);
    } else {
        // Add vertex marker for subsequent points
        const vertexMarker = L.marker([lat, lng], {
            icon: createDeliveryAreaVertexIcon(),
            zIndexOffset: 999,
            interactive: false
        }).addTo(map);
        deliveryAreaVertexMarkers.push(vertexMarker);
        
        // Draw line from previous point to new point
        const prevPoint = deliveryAreaPoints[deliveryAreaPoints.length - 2];
        const line = L.polyline([[prevPoint.lat, prevPoint.lng], [lat, lng]], {
            color: DELIVERY_AREA_CONSTANTS.LINE_COLOR,
            weight: DELIVERY_AREA_CONSTANTS.LINE_WEIGHT,
            opacity: DELIVERY_AREA_CONSTANTS.LINE_OPACITY,
            interactive: false
        }).addTo(map);
        deliveryAreaLines.push(line);
    }
}

/**
 * Handles mouse move events during delivery area drawing mode.
 */
function handleDeliveryAreaMouseMove(e) {
    if (!deliveryAreaMode || deliveryAreaPoints.length === 0) return;
    
    const { lat, lng } = e.latlng;
    const lastPoint = deliveryAreaPoints[deliveryAreaPoints.length - 1];
    
    // Remove existing temporary line
    if (deliveryAreaTempLine) {
        map.removeLayer(deliveryAreaTempLine);
    }
    
    // Create new temporary line from last point to cursor
    deliveryAreaTempLine = L.polyline([[lastPoint.lat, lastPoint.lng], [lat, lng]], {
        color: DELIVERY_AREA_CONSTANTS.LINE_COLOR,
        weight: DELIVERY_AREA_CONSTANTS.LINE_WEIGHT,
        opacity: DELIVERY_AREA_CONSTANTS.LINE_OPACITY,
        dashArray: DELIVERY_AREA_CONSTANTS.TEMP_LINE_DASH_ARRAY,
        interactive: false
    }).addTo(map);
    
    // Check if cursor is near the start point (for closing the polygon)
    if (deliveryAreaPoints.length >= 3) {
        const startPoint = deliveryAreaPoints[0];
        const startLatLng = L.latLng(startPoint.lat, startPoint.lng);
        const currentLatLng = L.latLng(lat, lng);
        
        // Calculate pixel distance to start point
        const startPointPixels = map.latLngToContainerPoint(startLatLng);
        const currentPointPixels = map.latLngToContainerPoint(currentLatLng);
        const pixelDistance = Math.sqrt(
            Math.pow(startPointPixels.x - currentPointPixels.x, 2) +
            Math.pow(startPointPixels.y - currentPointPixels.y, 2)
        );
        
        // Check if within snap tolerance
        const wasNearStart = deliveryAreaNearStartPoint;
        deliveryAreaNearStartPoint = pixelDistance <= DELIVERY_AREA_CONSTANTS.SNAP_TOLERANCE_PIXELS;
        
        // Update start marker appearance if near state changed
        if (wasNearStart !== deliveryAreaNearStartPoint && deliveryAreaStartMarker) {
            deliveryAreaStartMarker.setIcon(createDeliveryAreaStartIcon(deliveryAreaNearStartPoint));
        }
    }
}

/**
 * Finishes the delivery area polygon and continues drawing mode for multi-polygon support.
 */
function finishDeliveryAreaPolygon() {
    // Store the current polygon points before clearing
    const completedPoints = [...deliveryAreaPoints];
    
    // Create polygon outline only (no fill)
    const polygonCoords = completedPoints.map(p => [p.lat, p.lng]);
    const completedPolygon = L.polygon(polygonCoords, {
        color: DELIVERY_AREA_CONSTANTS.LINE_COLOR,
        fillColor: DELIVERY_AREA_CONSTANTS.POLYGON_FILL_COLOR,
        fillOpacity: 0, // No fill
        weight: DELIVERY_AREA_CONSTANTS.LINE_WEIGHT,
        interactive: false
    }).addTo(map);
    
    // Store the completed polygon (points + layer) for multi-polygon support
    deliveryAreaCompletedPolygons.push({
        points: completedPoints,
        layer: completedPolygon
    });
    
    // Remove temporary line
    if (deliveryAreaTempLine) {
        map.removeLayer(deliveryAreaTempLine);
        deliveryAreaTempLine = null;
    }
    
    // Draw closing line from last point to start point
    const lastPoint = completedPoints[completedPoints.length - 1];
    const startPoint = completedPoints[0];
    const closingLine = L.polyline([[lastPoint.lat, lastPoint.lng], [startPoint.lat, startPoint.lng]], {
        color: DELIVERY_AREA_CONSTANTS.LINE_COLOR,
        weight: DELIVERY_AREA_CONSTANTS.LINE_WEIGHT,
        opacity: DELIVERY_AREA_CONSTANTS.LINE_OPACITY,
        interactive: false
    }).addTo(map);
    
    // Store closing line with the polygon (for cleanup later)
    deliveryAreaCompletedPolygons[deliveryAreaCompletedPolygons.length - 1].closingLine = closingLine;
    
    // Clear current drawing state but keep drawing mode active
    // Clear all lines
    deliveryAreaLines.forEach(line => {
        map.removeLayer(line);
    });
    deliveryAreaLines = [];
    
    // Clear start marker
    if (deliveryAreaStartMarker) {
        map.removeLayer(deliveryAreaStartMarker);
        deliveryAreaStartMarker = null;
    }
    
    // Clear vertex markers
    deliveryAreaVertexMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    deliveryAreaVertexMarkers = [];
    
    // Clear points for new polygon
    deliveryAreaPoints = [];
    deliveryAreaNearStartPoint = false;
    
    // Keep drawing mode active for multi-polygon support
    // User can immediately start drawing another polygon or save
    
    // Add pulse animation to Export button
    const exportBtn = document.getElementById('delivery-area-export-btn');
    exportBtn.classList.add('animate-pulse-custom');
}

/**
 * Checks if one polygon is contained within another using Turf.js.
 * @param {Array} innerPoints - Array of {lat, lng} points for the potential inner polygon
 * @param {Array} outerPoints - Array of {lat, lng} points for the potential outer polygon
 * @returns {boolean} True if innerPoints polygon is inside outerPoints polygon
 */
function isPolygonInsidePolygon(innerPoints, outerPoints) {
    // Convert to Turf.js format [lng, lat]
    const innerCoords = innerPoints.map(p => [p.lng, p.lat]);
    innerCoords.push(innerCoords[0]); // Close the ring
    
    const outerCoords = outerPoints.map(p => [p.lng, p.lat]);
    outerCoords.push(outerCoords[0]); // Close the ring
    
    try {
        const innerPolygon = turf.polygon([innerCoords]);
        const outerPolygon = turf.polygon([outerCoords]);
        
        // Check if all vertices of inner are inside outer
        return turf.booleanWithin(innerPolygon, outerPolygon);
    } catch (e) {
        return false;
    }
}

/**
 * Groups polygons by containment relationship.
 * Returns an array of groups, each containing {outer, holes: []}
 * @param {Array} polygonsArray - Array of polygon point arrays
 * @returns {Array} Array of polygon groups with outer and holes
 */
function groupPolygonsByContainment(polygonsArray) {
    if (polygonsArray.length === 0) return [];
    if (polygonsArray.length === 1) {
        return [{ outer: polygonsArray[0], holes: [] }];
    }
    
    // Build containment graph
    const containment = {}; // polygon index -> array of indices it contains
    const containedBy = {}; // polygon index -> index that contains it (or -1 if none)
    
    polygonsArray.forEach((_, i) => {
        containment[i] = [];
        containedBy[i] = -1;
    });
    
    // Check all pairs for containment
    for (let i = 0; i < polygonsArray.length; i++) {
        for (let j = 0; j < polygonsArray.length; j++) {
            if (i !== j) {
                if (isPolygonInsidePolygon(polygonsArray[j], polygonsArray[i])) {
                    // polygon j is inside polygon i
                    containment[i].push(j);
                }
            }
        }
    }
    
    // For each polygon, find its direct container (the smallest polygon that contains it)
    for (let i = 0; i < polygonsArray.length; i++) {
        let smallestContainer = -1;
        let smallestArea = Infinity;
        
        for (let j = 0; j < polygonsArray.length; j++) {
            if (i !== j && containment[j].includes(i)) {
                // j contains i, check if it's smaller than current smallest
                const area = calculatePolygonArea(polygonsArray[j]);
                if (area < smallestArea) {
                    smallestArea = area;
                    smallestContainer = j;
                }
            }
        }
        containedBy[i] = smallestContainer;
    }
    
    // Build groups: outer polygons (not contained by any other) with their direct holes
    const groups = [];
    const processed = new Set();
    
    for (let i = 0; i < polygonsArray.length; i++) {
        if (containedBy[i] === -1) {
            // This is an outer polygon
            const holes = containment[i]
                .filter(j => containedBy[j] === i) // direct children only
                .map(j => polygonsArray[j]);
            
            groups.push({
                outer: polygonsArray[i],
                holes: holes
            });
            processed.add(i);
        }
    }
    
    return groups;
}

/**
 * Calculates the approximate area of a polygon.
 * @param {Array} points - Array of {lat, lng} points
 * @returns {number} Approximate area (square degrees)
 */
function calculatePolygonArea(points) {
    if (points.length < 3) return 0;
    
    // Convert to Turf.js format and calculate area
    const coords = points.map(p => [p.lng, p.lat]);
    coords.push(coords[0]); // Close the ring
    
    try {
        const polygon = turf.polygon([coords]);
        return turf.area(polygon);
    } catch (e) {
        return 0;
    }
}

/**
 * Converts a polygon group (outer + holes) to WKT POLYGON format.
 */
function polygonGroupToWKT(group) {
    const { outer, holes } = group;
    
    // Outer ring
    const outerCoords = outer.map(p => `${p.lng} ${p.lat}`);
    outerCoords.push(`${outer[0].lng} ${outer[0].lat}`);
    
    // Inner rings (holes)
    const innerRings = holes.map(hole => {
        const coords = hole.map(p => `${p.lng} ${p.lat}`);
        coords.push(`${hole[0].lng} ${hole[0].lat}`);
        return `(${coords.join(', ')})`;
    });
    
    const allRings = [`(${outerCoords.join(', ')})`, ...innerRings];
    return `POLYGON(${allRings.join(', ')})`;
}

/**
 * Converts a single polygon's coordinates to WKT format.
 */
function polygonToWKT(points) {
    if (points.length < 3) return '';
    
    // WKT format: POLYGON((lon1 lat1, lon2 lat2, ..., lon1 lat1))
    const coords = points.map(p => `${p.lng} ${p.lat}`);
    // Close the polygon by repeating the first point
    coords.push(`${points[0].lng} ${points[0].lat}`);
    
    return `POLYGON((${coords.join(', ')}))`;
}

/**
 * Converts multiple polygons to WKT format with automatic hole detection.
 */
function multiPolygonToWKT(polygonsArray) {
    if (polygonsArray.length === 0) return '';
    if (polygonsArray.length === 1) {
        return polygonToWKT(polygonsArray[0]);
    }
    
    // Group polygons by containment (detect holes)
    const groups = groupPolygonsByContainment(polygonsArray);
    
    // If single group with holes, output as single POLYGON
    if (groups.length === 1) {
        return polygonGroupToWKT(groups[0]);
    }
    
    // Multiple groups - output as MULTIPOLYGON
    const polygonStrings = groups.map(group => {
        const { outer, holes } = group;
        
        // Outer ring
        const outerCoords = outer.map(p => `${p.lng} ${p.lat}`);
        outerCoords.push(`${outer[0].lng} ${outer[0].lat}`);
        
        // Inner rings (holes)
        const innerRings = holes.map(hole => {
            const coords = hole.map(p => `${p.lng} ${p.lat}`);
            coords.push(`${hole[0].lng} ${hole[0].lat}`);
            return `(${coords.join(', ')})`;
        });
        
        const allRings = [`(${outerCoords.join(', ')})`, ...innerRings];
        return `(${allRings.join(', ')})`;
    });
    
    return `MULTIPOLYGON(${polygonStrings.join(', ')})`;
}

/**
 * Converts a polygon group (outer + holes) to KML format with innerBoundaryIs.
 */
function polygonGroupToKML(group, name = 'Delivery Area') {
    const { outer, holes } = group;
    
    // Outer boundary coordinates
    const outerCoords = outer.map(p => `${p.lng},${p.lat},0`);
    outerCoords.push(`${outer[0].lng},${outer[0].lat},0`);
    
    // Build inner boundaries (holes)
    let innerBoundariesXml = '';
    if (holes && holes.length > 0) {
        innerBoundariesXml = holes.map(hole => {
            const holeCoords = hole.map(p => `${p.lng},${p.lat},0`);
            holeCoords.push(`${hole[0].lng},${hole[0].lat},0`);
            return `        <innerBoundaryIs>
          <LinearRing>
            <coordinates>${holeCoords.join(' ')}</coordinates>
          </LinearRing>
        </innerBoundaryIs>`;
        }).join('\n');
    }
    
    return `    <Placemark>
      <name>${name}</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${outerCoords.join(' ')}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
${innerBoundariesXml}
      </Polygon>
    </Placemark>`;
}

/**
 * Converts a single polygon's coordinates to KML format.
 */
function polygonToKML(points) {
    if (points.length < 3) return '';
    
    // KML format: coordinates are lon,lat,alt (altitude is optional)
    // Close the polygon by repeating the first point
    const coords = points.map(p => `${p.lng},${p.lat},0`);
    coords.push(`${points[0].lng},${points[0].lat},0`);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Delivery Area</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coords.join(' ')}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
}

/**
 * Converts multiple polygons to KML format with automatic hole detection.
 */
function multiPolygonToKML(polygonsArray) {
    if (polygonsArray.length === 0) return '';
    if (polygonsArray.length === 1) {
        return polygonToKML(polygonsArray[0]);
    }
    
    // Group polygons by containment (detect holes)
    const groups = groupPolygonsByContainment(polygonsArray);
    
    // Build placemarks for each group
    const placemarks = groups.map((group, index) => {
        const name = groups.length === 1 ? 'Delivery Area' : `Delivery Area ${index + 1}`;
        return polygonGroupToKML(group, name);
    }).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
${placemarks}
  </Document>
</kml>`;
}

/**
 * Removes the last completed polygon from the delivery area.
 * Used for undo functionality in multi-polygon mode.
 */
function removeLastCompletedPolygon() {
    if (deliveryAreaCompletedPolygons.length === 0) return;
    
    const lastPolygon = deliveryAreaCompletedPolygons.pop();
    
    // Remove the polygon layer from map
    if (lastPolygon.layer) {
        map.removeLayer(lastPolygon.layer);
    }
    
    // Remove the closing line from map
    if (lastPolygon.closingLine) {
        map.removeLayer(lastPolygon.closingLine);
    }
    
    // If no more completed polygons, remove pulse animation from Save button
    if (deliveryAreaCompletedPolygons.length === 0) {
        const exportBtn = document.getElementById('delivery-area-export-btn');
        exportBtn.classList.remove('animate-pulse-custom');
    }
}

/**
 * Clears all pending delivery area polygons from the map.
 * Called when the user cancels partner creation or successfully creates a partner.
 */
function clearPendingDeliveryAreaPolygons() {
    pendingDeliveryAreaPolygons.forEach(polyObj => {
        if (polyObj.layer) {
            map.removeLayer(polyObj.layer);
        }
        if (polyObj.closingLine) {
            map.removeLayer(polyObj.closingLine);
        }
    });
    pendingDeliveryAreaPolygons = [];
}

/**
 * Saves the delivery area in the specified format.
 * Handles both single and multi-polygon cases.
 * Keeps the drawn polygons visible as pending polygons.
 */
function exportDeliveryArea(format) {
    // Combine completed polygons with current drawing (if any)
    const allPolygons = [...deliveryAreaCompletedPolygons.map(p => p.points)];
    
    // Add current drawing if it has enough points
    if (deliveryAreaPoints.length >= 3) {
        allPolygons.push([...deliveryAreaPoints]);
    }
    
    // Check if we have any valid polygons
    if (allPolygons.length === 0) {
        alert('Please draw at least one polygon with 3 or more points before saving.');
        return;
    }
    
    let content = '';
    if (format === 'wkt') {
        content = multiPolygonToWKT(allPolygons);
    } else if (format === 'kml') {
        content = multiPolygonToKML(allPolygons);
    }
    
    // Update the textarea
    document.getElementById('sidebar-polygon-content').value = content;
    
    // Transfer completed polygons to pending polygons (keep them visible on map)
    // First clear any existing pending polygons
    clearPendingDeliveryAreaPolygons();
    
    // Move the completed polygons to pending state
    pendingDeliveryAreaPolygons = [...deliveryAreaCompletedPolygons];
    
    // Clear the drawing state arrays (but don't remove the layers since they're now pending)
    deliveryAreaCompletedPolygons = [];
    
    // Exit delivery area mode (without clearing the now-pending polygons)
    deliveryAreaMode = false;
    
    _teardownDeliveryAreaUI();
    
    // Clear drawing state
    deliveryAreaPoints = [];
    deliveryAreaLines = [];
    deliveryAreaTempLine = null;
    deliveryAreaStartMarker = null;
    deliveryAreaVertexMarkers = [];
    deliveryAreaNearStartPoint = false;
    
    // Restore cross marker if it was there before
    if (deliveryAreaHadCrossMarker) {
        const lat = parseFloat(document.getElementById('sidebar-latitude').value);
        const lng = parseFloat(document.getElementById('sidebar-longitude').value);
        if (!isNaN(lat) && !isNaN(lng)) {
            placeCrossMarker(lat, lng);
        }
    }
    
    // Show the partner form sidebar
    const partnerFormSidebar = document.getElementById('partner-form-sidebar');
    openSidebar(partnerFormSidebar);
}

// ==========================================
// DELIVERY AREA EVENT LISTENERS
// ==========================================

// Draw delivery area button
document.getElementById('draw-delivery-area-btn').addEventListener('click', function() {
    startDeliveryAreaMode();
});

// Export dropdown toggle
document.getElementById('delivery-area-export-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('delivery-area-export-dropdown');
    dropdown.classList.toggle('hidden');
});

// Export as WKT
document.getElementById('delivery-area-export-wkt').addEventListener('click', function() {
    document.getElementById('delivery-area-export-dropdown').classList.add('hidden');
    exportDeliveryArea('wkt');
});

// Export as KML
document.getElementById('delivery-area-export-kml').addEventListener('click', function() {
    document.getElementById('delivery-area-export-dropdown').classList.add('hidden');
    exportDeliveryArea('kml');
});

// Cancel button
document.getElementById('delivery-area-cancel-btn').addEventListener('click', function() {
    cancelDeliveryAreaMode();
});
