// ==========================================
// PARTNER MANAGEMENT
// ==========================================

/**
 * Adds a partner with hexagon zones to the map.
 */
function addPartnerToMap(partner) {
    const { partnerId, latitude, longitude, primaryH3Resolution, primaryNumZones, secondaryH3Resolution, secondaryNumZones, primaryColor: partnerPrimaryColor, secondaryColor, deliveryAreaContent, deliveryAreaColor } = partner;
    const actualPrimaryColor = partnerPrimaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;

    // Create partner object with elements structure
    const partnerObject = {
        partnerId,
        latitude,
        longitude,
        primaryH3Resolution,
        primaryNumZones,
        secondaryH3Resolution,
        secondaryNumZones,
        primaryColor: partnerPrimaryColor,
        secondaryColor,
        deliveryAreaContent,
        deliveryAreaColor,
        elements: {
            primaryHexagons: [],
            secondaryHexagons: [],
            deliveryAreaPolygons: []
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
    const centerCell = h3.latLngToCell(latitude, longitude, primaryH3Resolution);
    const disk = h3.gridDisk(centerCell, primaryNumZones - 1);
    disk.forEach(cell => {
        const boundary = h3.cellToBoundary(cell);
        const polygon = L.polygon(boundary, {
            color: actualPrimaryColor,
            fillColor: actualPrimaryColor,
            fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
            weight: PARTNER_CONSTANTS.DEFAULT_PRIMARY_HEXAGON_WEIGHT,
            interactive: false
        }).addTo(map);
        
        const hexagonObject = {
            h3Index: cell,
            polygon: polygon,
            center: { lat: latitude, lng: longitude },
            layerType: 'primary',
            h3Resolution: primaryH3Resolution,
            zoneNumber: h3.gridDistance(centerCell, cell)
        };
        partnerObject.elements.primaryHexagons.push(hexagonObject);
    });

    // Draw secondary hexagons if provided
    if (secondaryH3Resolution !== undefined && secondaryNumZones !== undefined) {
        const actualSecondaryColor = secondaryColor || actualPrimaryColor;
        const centerCell2 = h3.latLngToCell(latitude, longitude, secondaryH3Resolution);
        const disk2 = h3.gridDisk(centerCell2, secondaryNumZones - 1);
        disk2.forEach(cell => {
            const boundary = h3.cellToBoundary(cell);
            const polygon = L.polygon(boundary, {
                color: actualSecondaryColor,
                fillColor: actualSecondaryColor,
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                weight: PARTNER_CONSTANTS.DEFAULT_SECONDARY_HEXAGON_WEIGHT,
                interactive: false
            }).addTo(map);
            
            const hexagonObject = {
                h3Index: cell,
                polygon: polygon,
                center: { lat: latitude, lng: longitude },
                layerType: 'secondary',
                h3Resolution: secondaryH3Resolution,
                zoneNumber: h3.gridDistance(centerCell2, cell)
            };
            partnerObject.elements.secondaryHexagons.push(hexagonObject);
        });
    }

    // Draw delivery area polygon if provided
    if (deliveryAreaContent) {
        const actualDeliveryColor = deliveryAreaColor || actualPrimaryColor;
        const parsedContent = parsePolygonContent(deliveryAreaContent);
        
        // Normalize to array of polygon data (handles both single and multi)
        const polygonDataArray = parsedContent.type === 'single' 
            ? [parsedContent.coordinates] 
            : parsedContent.coordinates;
        
        polygonDataArray.forEach(polygonData => {
            const coords = polygonDataToLeafletCoords(polygonData);
            if (coords.length > 0 && coords[0].length > 0) {
                const polygon = L.polygon(coords, {
                    color: actualDeliveryColor,
                    fillColor: actualDeliveryColor,
                    fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                    weight: PARTNER_CONSTANTS.DEFAULT_DELIVERY_AREA_WEIGHT,
                    interactive: false
                }).addTo(map);
                
                partnerObject.elements.deliveryAreaPolygons.push({
                    polygon: polygon,
                    type: parsedContent.type,
                    holes: polygonData.holes || []
                });
            }
        });
    }

    // Store partner in the main structure
    partnersById[partnerId] = partnerObject;
    
    // Initialize limitDeliveryToPrimary to true (default: enabled)
    partnerObject.limitDeliveryToPrimary = true;
    
    // Compute hexagon intersections with delivery area
    computeHexagonIntersections(partnerObject);

    // Move map view to the partner's location
    map.setView([latitude, longitude], map.getZoom());
}

/**
 * Deletes a partner and all its hexagons from the map.
 */
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

    // Remove delivery area polygons from map
    if (partner.elements.deliveryAreaPolygons) {
        partner.elements.deliveryAreaPolygons.forEach(polyObj => {
            map.removeLayer(polyObj.polygon);
        });
    }

    // Remove marker from map
    if (partner.marker) {
        map.removeLayer(partner.marker);
    }

    // Remove partner from the data structure
    delete partnersById[partnerId];
}

/**
 * Updates a partner with new data.
 */
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
    // Remove delivery area polygons
    if (oldPartner.elements.deliveryAreaPolygons) {
        oldPartner.elements.deliveryAreaPolygons.forEach(polyObj => {
            map.removeLayer(polyObj.polygon);
        });
    }
    if (oldPartner.marker) {
        map.removeLayer(oldPartner.marker);
    }

    // Add the updated partner
    addPartnerToMap(newPartnerData);
}

/**
 * Toggles hexagons visibility for a partner's zone (primary or secondary).
 * @param {string} partnerId - The partner ID
 * @param {string} zoneType - 'primary' or 'secondary'
 * @param {boolean} visible - Whether to show or hide the hexagons
 */
function toggleHexagonsVisibility(partnerId, zoneType, visible) {
    const partner = partnersById[partnerId];
    if (!partner) return;
    
    const hexagonsKey = zoneType === 'primary' ? 'primaryHexagons' : 'secondaryHexagons';
    const hexagons = partner.elements[hexagonsKey];
    
    if (!hexagons || hexagons.length === 0) return;

    // Check if intersection highlight is active
    const intersectionToggle = document.getElementById('toggle-intersection-highlight');
    const intersectionActive = !intersectionToggle.disabled && intersectionToggle.checked;

    if (visible) {
        hexagons.forEach(hexagon => {
            // If intersection is active and hexagon is intersected, use intersection opacity
            const targetOpacity = (intersectionActive && hexagon.isIntersectedByDelivery) 
                ? PARTNER_CONSTANTS.INTERSECTION_OPACITY 
                : PARTNER_CONSTANTS.DEFAULT_OPACITY;
            hexagon.polygon.setStyle({
                fillOpacity: targetOpacity,
                opacity: 1
            });
        });
    } else {
        hexagons.forEach(hexagon => {
            hexagon.polygon.setStyle({
                fillOpacity: 0,
                opacity: 0
            });
        });
    }
}

/**
 * Toggles primary hexagons visibility for a partner.
 */
function togglePrimaryHexagonsVisibility(partnerId, visible) {
    toggleHexagonsVisibility(partnerId, 'primary', visible);
}

/**
 * Toggles secondary hexagons visibility for a partner.
 */
function toggleSecondaryHexagonsVisibility(partnerId, visible) {
    toggleHexagonsVisibility(partnerId, 'secondary', visible);
}

/**
 * Toggles delivery area visibility for a partner.
 */
function toggleDeliveryAreaVisibility(partnerId, visible) {
    const partner = partnersById[partnerId];
    if (!partner || !partner.elements.deliveryAreaPolygons || partner.elements.deliveryAreaPolygons.length === 0) return;

    partner.elements.deliveryAreaPolygons.forEach(polyObj => {
        if (visible) {
            polyObj.polygon.setStyle({
                fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY,
                opacity: 1
            });
        } else {
            polyObj.polygon.setStyle({
                fillOpacity: 0,
                opacity: 0
            });
        }
    });
}

/**
 * Toggles intersection highlight for hexagons intersected by delivery area.
 * Only highlights hexagons that are currently visible.
 * @param {string} partnerId - The partner ID
 * @param {boolean} enabled - Whether to show highlighted opacity for intersected hexagons
 */
function toggleIntersectionHighlight(partnerId, enabled) {
    const partner = partnersById[partnerId];
    if (!partner) return;
    
    const hasDeliveryArea = partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
    if (!hasDeliveryArea) return;
    
    // Check if delivery area is visible
    const deliveryVisible = partner.elements.deliveryAreaPolygons[0].polygon.options.fillOpacity > 0 || partner.elements.deliveryAreaPolygons[0].polygon.options.opacity > 0;
    
    // When disabling, we don't need delivery area to be visible
    // We just need to reset hexagon opacity to default
    if (!enabled) {
        // Reset all visible intersected hexagons to default opacity
        partner.elements.primaryHexagons.forEach(hexagon => {
            if (hexagon.isIntersectedByDelivery) {
                const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
                if (isVisible) {
                    hexagon.polygon.setStyle({
                        fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY
                    });
                }
            }
        });
        
        partner.elements.secondaryHexagons.forEach(hexagon => {
            if (hexagon.isIntersectedByDelivery) {
                const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
                if (isVisible) {
                    hexagon.polygon.setStyle({
                        fillOpacity: PARTNER_CONSTANTS.DEFAULT_OPACITY
                    });
                }
            }
        });
        return;
    }
    
    // When enabling, delivery area must be visible
    if (!deliveryVisible) return;
    
    // Update primary hexagons - only highlight visible ones
    partner.elements.primaryHexagons.forEach(hexagon => {
        if (hexagon.isIntersectedByDelivery) {
            const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
            if (isVisible) {
                hexagon.polygon.setStyle({
                    fillOpacity: PARTNER_CONSTANTS.INTERSECTION_OPACITY
                });
            }
        }
    });
    
    // Update secondary hexagons - only highlight visible ones
    partner.elements.secondaryHexagons.forEach(hexagon => {
        if (hexagon.isIntersectedByDelivery) {
            const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
            if (isVisible) {
                hexagon.polygon.setStyle({
                    fillOpacity: PARTNER_CONSTANTS.INTERSECTION_OPACITY
                });
            }
        }
    });
}

/**
 * Updates the coverage bar display for delivery area intersection.
 * @param {string} zoneType - 'primary' or 'secondary'
 * @param {number} intersected - Number of intersected hexagons
 * @param {number} total - Total number of hexagons
 */
function updateCoverageBar(zoneType, intersected, total) {
    const percentage = total > 0 ? Math.round((intersected / total) * 100) : 0;
    
    const barId = zoneType === 'primary' ? 'primary-coverage-bar' : 'secondary-coverage-bar';
    const percentId = zoneType === 'primary' ? 'primary-coverage-percent' : 'secondary-coverage-percent';
    const containerId = zoneType === 'primary' ? 'primary-coverage-bar-container' : 'secondary-coverage-bar-container';
    
    const barElement = document.getElementById(barId);
    const percentElement = document.getElementById(percentId);
    const containerElement = document.getElementById(containerId);
    
    if (!barElement || !percentElement || !containerElement) return;
    
    // Update the bar width
    barElement.style.width = `${percentage}%`;
    
    // Update the percentage text
    percentElement.textContent = `${percentage}%`;
    
    // Show/hide container based on whether there's a delivery area
    // The container should always be visible when there's delivery area data
    containerElement.classList.remove('hidden');
}

/**
 * Updates the intersection highlight toggle state based on current conditions.
 * Toggle is enabled when: delivery area exists AND is visible AND (primary OR secondary is visible).
 * @param {string} partnerId - The partner ID
 */
function updateIntersectionToggleState(partnerId) {
    const partner = partnersById[partnerId];
    if (!partner) return;
    
    const intersectionToggle = document.getElementById('toggle-intersection-highlight');
    const intersectionContainer = document.getElementById('toggle-intersection-highlight-container');
    
    const hasDeliveryArea = partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
    const deliveryVisible = hasDeliveryArea && (partner.elements.deliveryAreaPolygons[0].polygon.options.fillOpacity > 0 || partner.elements.deliveryAreaPolygons[0].polygon.options.opacity > 0);
    const primaryVisible = partner.elements.primaryHexagons.length > 0 && (partner.elements.primaryHexagons[0].polygon.options.fillOpacity > 0 || partner.elements.primaryHexagons[0].polygon.options.opacity > 0);
    const secondaryVisible = partner.elements.secondaryHexagons.length > 0 && (partner.elements.secondaryHexagons[0].polygon.options.fillOpacity > 0 || partner.elements.secondaryHexagons[0].polygon.options.opacity > 0);
    const anyZoneVisible = primaryVisible || secondaryVisible;
    
    // Enable toggle only if delivery area exists, is visible, and at least one zone is visible
    const shouldBeEnabled = hasDeliveryArea && deliveryVisible && anyZoneVisible;
    
    if (shouldBeEnabled) {
        intersectionToggle.disabled = false;
        if (intersectionContainer) {
            intersectionContainer.classList.remove('opacity-50', 'cursor-not-allowed');
            intersectionContainer.style.pointerEvents = 'auto';
        }
    } else {
        intersectionToggle.disabled = true;
        if (intersectionContainer) {
            intersectionContainer.classList.add('opacity-50', 'cursor-not-allowed');
            intersectionContainer.style.pointerEvents = 'none';
        }
        // Also uncheck the toggle when disabling
        intersectionToggle.checked = false;
    }
}

/**
 * Converts a polygon data object (with outer and holes) to Leaflet-compatible coordinates.
 * Leaflet expects: [outerRing, hole1, hole2, ...] where each ring is [[lat, lng], ...]
 * @param {Object} polygonData - {outer: [[lat, lng], ...], holes: [[[lat, lng], ...], ...]}
 * @returns {Array} Leaflet-compatible coordinates array
 */
function polygonDataToLeafletCoords(polygonData) {
    if (!polygonData || !polygonData.outer || polygonData.outer.length === 0) {
        return [];
    }
    
    // If it's a simple array (legacy format), return as-is
    if (Array.isArray(polygonData) && polygonData.length > 0 && Array.isArray(polygonData[0])) {
        return polygonData;
    }
    
    // Start with outer ring
    const result = [polygonData.outer];
    
    // Add holes if present
    if (polygonData.holes && polygonData.holes.length > 0) {
        polygonData.holes.forEach(hole => {
            result.push(hole);
        });
    }
    
    return result;
}

/**
 * Parses polygon content (KML or WKT) and extracts coordinates.
 * Returns an object with:
 *   - type: 'single' or 'multi'
 *   - coordinates: for single polygon: {outer: [[lat, lng], ...], holes: [...]}
 *                  for multi-polygon: array of {outer, holes} objects
 */
function parsePolygonContent(content) {
    const trimmedContent = content.trim();
    
    // Detect format: KML has XML structure, WKT starts with POLYGON or MULTIPOLYGON
    if (trimmedContent.includes('<coordinates') || trimmedContent.includes('<Coordinates')) {
        // KML format - check if there are multiple placemarks
        const kmlMultiResult = parseKMLMultiPolygon(trimmedContent);
        if (kmlMultiResult.length > 1) {
            // Multiple placemarks found - return as multi-polygon
            return {
                type: 'multi',
                coordinates: kmlMultiResult
            };
        } else if (kmlMultiResult.length === 1) {
            // Single placemark - return as single polygon
            return {
                type: 'single',
                coordinates: kmlMultiResult[0]
            };
        }
        // Fallback to original parsing if no placemarks found
        return {
            type: 'single',
            coordinates: { outer: parseKMLCoordinates(trimmedContent), holes: [] }
        };
    } else if (trimmedContent.toUpperCase().startsWith('MULTIPOLYGON')) {
        // WKT MULTIPOLYGON format - returns array of simple coordinate arrays (no holes support for multipolygon yet)
        const result = parseWKTMultiPolygon(trimmedContent);
        return {
            type: 'multi',
            coordinates: result
        };
    } else if (trimmedContent.toUpperCase().startsWith('POLYGON')) {
        // WKT POLYGON format - returns {outer, holes}
        const result = parseWKTPolygon(trimmedContent);
        return {
            type: 'single',
            coordinates: result
        };
    }
    
    // Try to auto-detect by attempting parsers
    const kmlMultiResult = parseKMLMultiPolygon(trimmedContent);
    if (kmlMultiResult.length > 1) {
        return {
            type: 'multi',
            coordinates: kmlMultiResult
        };
    } else if (kmlMultiResult.length === 1) {
        return {
            type: 'single',
            coordinates: kmlMultiResult[0]
        };
    }
    
    const wktMultiResult = parseWKTMultiPolygon(trimmedContent);
    if (wktMultiResult.length > 0) {
        return {
            type: 'multi',
            coordinates: wktMultiResult
        };
    }
    
    return {
        type: 'single',
        coordinates: parseWKTPolygon(trimmedContent)
    };
}

/**
 * Parses KML coordinates string into array of [lat, lng] pairs.
 */
function parseKMLCoordsString(coordText) {
    const coordinates = [];
    const coordPairs = coordText.trim().split(/\s+/);
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
    return coordinates;
}

/**
 * Parses KML content and extracts polygon coordinates from a single placemark.
 * Also detects innerBoundaryIs (holes) if present.
 */
function parseKMLCoordinates(kmlContent) {
    const coordinates = [];
    
    // Try to extract coordinates from KML <coordinates> tag (outer boundary)
    const coordMatch = kmlContent.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
    if (coordMatch) {
        const coords = parseKMLCoordsString(coordMatch[1]);
        coordinates.push(...coords);
    }
    
    return coordinates;
}

/**
 * Parses KML Polygon element with support for innerBoundaryIs (holes).
 * Returns {outer: coordinates, holes: [coordinates, ...]}
 */
function parseKMLPolygonWithHoles(polygonContent) {
    const result = { outer: [], holes: [] };
    
    // Extract outer boundary
    const outerMatch = polygonContent.match(/<outerBoundaryIs[^>]*>([\s\S]*?)<\/outerBoundaryIs>/i);
    if (outerMatch) {
        const coordMatch = outerMatch[1].match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
        if (coordMatch) {
            result.outer = parseKMLCoordsString(coordMatch[1]);
        }
    }
    
    // Extract inner boundaries (holes)
    const innerRegex = /<innerBoundaryIs[^>]*>([\s\S]*?)<\/innerBoundaryIs>/gi;
    let innerMatch;
    while ((innerMatch = innerRegex.exec(polygonContent)) !== null) {
        const coordMatch = innerMatch[1].match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
        if (coordMatch) {
            const holeCoords = parseKMLCoordsString(coordMatch[1]);
            if (holeCoords.length > 0) {
                result.holes.push(holeCoords);
            }
        }
    }
    
    return result;
}

/**
 * Parses KML content with multiple placemarks and extracts all polygon coordinates.
 * Returns an array of objects: {outer: coordinates, holes: [coordinates, ...]}
 * For backward compatibility, if no holes are detected, returns simple coordinate arrays.
 */
function parseKMLMultiPolygon(kmlContent) {
    const polygons = [];
    
    // Check if any polygon has innerBoundaryIs
    const hasInnerBoundaries = /<innerBoundaryIs/i.test(kmlContent);
    
    // Find all <Placemark> elements
    const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
    let match;
    
    while ((match = placemarkRegex.exec(kmlContent)) !== null) {
        const placemarkContent = match[1];
        
        // Check if this placemark has a Polygon with innerBoundaryIs
        const polygonMatch = placemarkContent.match(/<Polygon[^>]*>([\s\S]*?)<\/Polygon>/i);
        if (polygonMatch && hasInnerBoundaries) {
            const polygonData = parseKMLPolygonWithHoles(polygonMatch[1]);
            if (polygonData.outer.length > 0) {
                polygons.push(polygonData);
            }
        } else {
            // Simple polygon without holes
            const coords = parseKMLCoordinates(placemarkContent);
            if (coords.length > 0) {
                polygons.push({ outer: coords, holes: [] });
            }
        }
    }
    
    return polygons;
}

/**
 * Parses WKT POLYGON content and extracts coordinates including holes.
 * Returns {outer: coordinates, holes: [coordinates, ...]}
 */
function parseWKTPolygon(wktContent) {
    const result = { outer: [], holes: [] };
    
    // WKT POLYGON format: POLYGON((lon1 lat1, lon2 lat2, lon3 lat3, ...))
    // or with multiple rings: POLYGON((outer_ring),(inner_ring1),...)
    
    // Match the content inside POLYGON(...)
    const polygonMatch = wktContent.match(/POLYGON\s*\(\s*\(([\s\S]+)\)\s*\)/i);
    if (polygonMatch) {
        const ringContent = polygonMatch[1];
        
        // Handle multiple rings - split by "),(" pattern
        const rings = ringContent.split(/\)\s*,\s*\(/);
        
        // Parse each ring
        rings.forEach((ring, index) => {
            const coordinates = [];
            const coordPairs = ring.split(',');
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
            
            if (coordinates.length > 0) {
                if (index === 0) {
                    result.outer = coordinates;
                } else {
                    result.holes.push(coordinates);
                }
            }
        });
    }
    
    return result;
}

/**
 * Parses WKT MULTIPOLYGON content and extracts coordinates for all polygons.
 * Returns an array of coordinate arrays (one for each polygon).
 */
function parseWKTMultiPolygon(wktContent) {
    const polygons = [];
    
    // WKT MULTIPOLYGON format: MULTIPOLYGON(((lon1 lat1, lon2 lat2, ...)), ((lon3 lat3, lon4 lat4, ...)))
    // Each polygon can have multiple rings
    
    // Match the content inside MULTIPOLYGON(...)
    const multiPolygonMatch = wktContent.match(/MULTIPOLYGON\s*\(\s*([\s\S]+)\s*\)/i);
    if (multiPolygonMatch) {
        const content = multiPolygonMatch[1];
        
        // Split by )), ((  to get individual polygons
        // Use a more robust parsing approach
        let depth = 0;
        let currentPolygon = '';
        let inPolygon = false;
        let polygonHasHoles = false;
        let anyHolesDetected = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (char === '(') {
                depth++;
                if (depth === 2) {
                    inPolygon = true;
                    currentPolygon = '';
                    polygonHasHoles = false;
                    continue;
                } else if (depth === 3 && inPolygon) {
                    // A second ring inside this polygon — it's a hole ring
                    polygonHasHoles = true;
                    anyHolesDetected = true;
                }
            } else if (char === ')') {
                depth--;
                if (depth === 1 && inPolygon) {
                    // End of a polygon
                    inPolygon = false;
                    if (currentPolygon.trim() && !polygonHasHoles) {
                        const coords = parseWKTRing(currentPolygon);
                        if (coords.length > 0) {
                            polygons.push(coords);
                        }
                    } else if (currentPolygon.trim() && polygonHasHoles) {
                        // Parse only the outer ring (everything before the first hole ',(')
                        const outerRingContent = currentPolygon.split(',(')[0];
                        const coords = parseWKTRing(outerRingContent);
                        if (coords.length > 0) {
                            polygons.push(coords);
                        }
                    }
                    continue;
                }
            }
            
            if (inPolygon) {
                currentPolygon += char;
            }
        }
        
        if (anyHolesDetected) {
            alert('Warning: The imported WKT contains polygon rings (holes). Hole rings are not supported and have been ignored — only the outer boundary of each polygon was imported.');
        }
    }
    
    return polygons;
}

/**
 * Parses a single WKT ring (list of coordinate pairs).
 */
function parseWKTRing(ringContent) {
    const coordinates = [];
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
    
    return coordinates;
}

/**
 * Shows the partner info sidebar.
 */
function showPartnerSidebar(partnerId) {
    // Block partner marker clicks during measurement mode
    if (isMeasuring) {
        return;
    }

    const partner = partnersById[partnerId];
    if (!partner) return;

    // If the same partner is already being shown, do nothing
    if (currentPartnerId === partnerId) {
        return;
    }

    closeAllSidebars();
    updatePartnerSidebarContent(partner);
    const partnerInfoSidebar = document.getElementById('partner-info-sidebar');
    openSidebar(partnerInfoSidebar);
    currentPartnerId = partnerId;
}

/**
 * Updates the partner sidebar content with partner details.
 */
function updatePartnerSidebarContent(partner) {
    document.getElementById('slide-partner-id').textContent = partner.partnerId;

    const primaryCount = partner.elements.primaryHexagons.length;
    const secondaryCount = partner.elements.secondaryHexagons.length;
    const hasDeliveryArea = partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
    
    // Count intersected hexagons
    const primaryIntersected = partner.elements.primaryHexagons.filter(h => h.isIntersectedByDelivery).length;
    const secondaryIntersected = partner.elements.secondaryHexagons.filter(h => h.isIntersectedByDelivery).length;
    
    // Update Primary Zone Statistics
    document.getElementById('primary-resolution-stat').textContent = partner.primaryH3Resolution;
    document.getElementById('primary-zones-stat').textContent = partner.primaryNumZones;
    document.getElementById('primary-hexagons-stat').textContent = primaryCount;
    document.getElementById('primary-intersected-stat').textContent = primaryIntersected > 0 ? `${primaryIntersected}` : '-';
    
    // Update primary coverage bar
    updateCoverageBar('primary', primaryIntersected, primaryCount);
    
    // Update Secondary Zone Statistics
    const secondaryStatsContainer = document.getElementById('secondary-stats-container');
    if (secondaryCount > 0) {
        secondaryStatsContainer.classList.remove('hidden');
        document.getElementById('secondary-resolution-stat').textContent = partner.secondaryH3Resolution;
        document.getElementById('secondary-zones-stat').textContent = partner.secondaryNumZones;
        document.getElementById('secondary-hexagons-stat').textContent = secondaryCount;
        document.getElementById('secondary-intersected-stat').textContent = secondaryIntersected > 0 ? `${secondaryIntersected}` : '-';
        
        // Update secondary coverage bar
        updateCoverageBar('secondary', secondaryIntersected, secondaryCount);
    } else {
        secondaryStatsContainer.classList.add('hidden');
    }
    
    // Update Delivery Area Statistics
    const deliveryStatsContainer = document.getElementById('delivery-stats-container');
    if (hasDeliveryArea) {
        deliveryStatsContainer.classList.remove('hidden');
    } else {
        deliveryStatsContainer.classList.add('hidden');
    }

    // Set initial toggle states
    const primaryVisible = partner.elements.primaryHexagons.length > 0 && (partner.elements.primaryHexagons[0].polygon.options.fillOpacity > 0 || partner.elements.primaryHexagons[0].polygon.options.opacity > 0);
    const secondaryVisible = partner.elements.secondaryHexagons.length > 0 && (partner.elements.secondaryHexagons[0].polygon.options.fillOpacity > 0 || partner.elements.secondaryHexagons[0].polygon.options.opacity > 0);
    const deliveryVisible = hasDeliveryArea && (partner.elements.deliveryAreaPolygons[0].polygon.options.fillOpacity > 0 || partner.elements.deliveryAreaPolygons[0].polygon.options.opacity > 0);
    const hasSecondaryHexagons = partner.elements.secondaryHexagons.length > 0;

    document.getElementById('toggle-primary-zone').checked = primaryVisible;
    document.getElementById('toggle-secondary-zone').checked = secondaryVisible;
    document.getElementById('toggle-delivery-area').checked = deliveryVisible;

    // Show/hide Secondary Zone toggle based on availability
    const secondaryZoneContainer = document.getElementById('toggle-secondary-zone-container');
    if (hasSecondaryHexagons) {
        secondaryZoneContainer.classList.remove('hidden');
    } else {
        secondaryZoneContainer.classList.add('hidden');
    }

    // Show/hide Delivery Area toggle based on availability
    const deliveryAreaContainer = document.getElementById('toggle-delivery-area-container');
    if (hasDeliveryArea) {
        deliveryAreaContainer.classList.remove('hidden');
    } else {
        deliveryAreaContainer.classList.add('hidden');
    }

    // Show/hide Intersection Highlight toggle based on delivery area availability
    const intersectionHighlightContainer = document.getElementById('toggle-intersection-highlight-container');
    if (hasDeliveryArea) {
        intersectionHighlightContainer.classList.remove('hidden');
    } else {
        intersectionHighlightContainer.classList.add('hidden');
    }
    
    // Show/hide Limit Delivery to Primary toggle based on delivery area AND secondary hexagons availability
    const limitDeliveryContainer = document.getElementById('toggle-limit-delivery-container');
    if (hasDeliveryArea && hasSecondaryHexagons) {
        limitDeliveryContainer.classList.remove('hidden');
        // Set the toggle state from the partner's limitDeliveryToPrimary property
        document.getElementById('toggle-limit-delivery').checked = partner.limitDeliveryToPrimary !== false;
    } else {
        limitDeliveryContainer.classList.add('hidden');
    }
    
    // Initialize intersection highlight toggle state
    // Check if intersection highlight is currently active by checking hexagon opacity
    const primaryIntersectedHighlighted = partner.elements.primaryHexagons.some(hexagon => 
        hexagon.isIntersectedByDelivery && hexagon.polygon.options.fillOpacity === PARTNER_CONSTANTS.INTERSECTION_OPACITY
    );
    const secondaryIntersectedHighlighted = partner.elements.secondaryHexagons.some(hexagon => 
        hexagon.isIntersectedByDelivery && hexagon.polygon.options.fillOpacity === PARTNER_CONSTANTS.INTERSECTION_OPACITY
    );
    const intersectionCurrentlyActive = primaryIntersectedHighlighted || secondaryIntersectedHighlighted;
    
    document.getElementById('toggle-intersection-highlight').checked = intersectionCurrentlyActive;
    updateIntersectionToggleState(partner.partnerId);
    
    // Re-initialize Lucide icons for any new elements
    lucide.createIcons({ nodes: [document.getElementById('partner-info-sidebar')] });
}

/**
 * Closes the partner info sidebar.
 */
function closePartnerSidebar() {
    const slideWindow = document.getElementById('partner-info-sidebar');
    closeSidebar(slideWindow);
    currentPartnerId = null;
}

/**
 * Resets the add/edit partner form to default values.
 * Also clears any pending delivery area polygons.
 */
function resetSidebarForm() {
    // Clear pending delivery area polygons
    clearPendingDeliveryAreaPolygons();
    
    // Delegate all field reset + editMode reset to setupAddPartnerForm
    setupAddPartnerForm();
}

/**
 * Opens the sidebar for editing an existing partner.
 */
function openSidebarForEdit(partner) {
    editMode.isActive = true;
    editMode.partnerId = partner.partnerId;

    document.getElementById('partner-form-title').textContent = 'Edit Partner';
    const submitButton = document.getElementById('partner-submit-btn');
    submitButton.textContent = 'Update';

    // Pre-fill form fields
    document.getElementById('sidebar-partnerId').value = partner.partnerId;
    document.getElementById('sidebar-latitude').value = partner.latitude;
    document.getElementById('sidebar-longitude').value = partner.longitude;
    document.getElementById('sidebar-primary-h3Resolution').value = partner.primaryH3Resolution;
    document.getElementById('sidebar-primary-numZones').value = partner.primaryNumZones;
    document.getElementById('sidebar-primary-color').value = partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;

    document.getElementById('sidebar-primary-resolution-value').textContent = partner.primaryH3Resolution.toString();
    document.getElementById('sidebar-primary-zones-value').textContent = partner.primaryNumZones.toString();

    // Handle secondary fields
    const primaryColor = partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR;
    if (partner.secondaryH3Resolution !== undefined && partner.secondaryNumZones !== undefined) {
        document.getElementById('sidebar-enable-secondary').checked = true;
        document.getElementById('secondary-fields').classList.remove('hidden');
        document.getElementById('sidebar-secondary-h3Resolution').value = partner.secondaryH3Resolution;
        document.getElementById('sidebar-secondary-numZones').value = partner.secondaryNumZones;
        document.getElementById('sidebar-secondary-resolution-value').textContent = partner.secondaryH3Resolution.toString();
        document.getElementById('sidebar-secondary-zones-value').textContent = partner.secondaryNumZones.toString();
        
        // Check if secondary color is different from primary
        const secondaryColor = partner.secondaryColor || primaryColor;
        const colorsAreSame = secondaryColor.toLowerCase() === primaryColor.toLowerCase();
        document.getElementById('sidebar-same-color').checked = colorsAreSame;
        document.getElementById('sidebar-secondary-color').value = secondaryColor;
        document.getElementById('sidebar-secondary-color').disabled = colorsAreSame;
    } else {
        document.getElementById('sidebar-enable-secondary').checked = false;
        document.getElementById('secondary-fields').classList.add('hidden');
        document.getElementById('sidebar-secondary-color').value = primaryColor;
        document.getElementById('sidebar-same-color').checked = true;
        document.getElementById('sidebar-secondary-color').disabled = true;
    }

    // Handle delivery area fields
    // Check if delivery area content exists (polygon rendered on map)
    const hasDeliveryArea = partner.deliveryAreaContent && partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
    
    if (hasDeliveryArea) {
        // Delivery area is enabled and rendered
        document.getElementById('sidebar-enable-delivery-area').checked = true;
        document.getElementById('delivery-area-fields').classList.remove('hidden');
        document.getElementById('sidebar-polygon-content').value = partner.deliveryAreaContent || '';
        
        // Handle delivery color
        const deliveryColor = partner.deliveryAreaColor || primaryColor;
        const deliveryColorSame = !partner.deliveryAreaColor || partner.deliveryAreaColor.toLowerCase() === primaryColor.toLowerCase();
        document.getElementById('sidebar-same-color-delivery').checked = deliveryColorSame;
        document.getElementById('sidebar-delivery-color').value = deliveryColor;
        document.getElementById('sidebar-delivery-color').disabled = deliveryColorSame;
    } else {
        // No delivery area (disabled or never defined)
        document.getElementById('sidebar-enable-delivery-area').checked = false;
        document.getElementById('delivery-area-fields').classList.add('hidden');
        document.getElementById('sidebar-same-color-delivery').checked = true;
        document.getElementById('sidebar-delivery-color').value = primaryColor;
        document.getElementById('sidebar-delivery-color').disabled = true;
        document.getElementById('sidebar-polygon-content').value = '';
    }

    // Open sidebar with animation
    const sidebar = document.getElementById('partner-form-sidebar');
    openSidebar(sidebar);
}

/**
 * Validates partner data before saving.
 */
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
    if (typeof partner.primaryH3Resolution !== 'number' || !Number.isInteger(partner.primaryH3Resolution) || partner.primaryH3Resolution < 0 || partner.primaryH3Resolution > 15) {
        alert("primaryH3Resolution must be an integer between 0 and 15");
        return false;
    }
    if (typeof partner.primaryNumZones !== 'number' || !Number.isInteger(partner.primaryNumZones) || partner.primaryNumZones < 1 || partner.primaryNumZones > 50) {
        alert("primaryNumZones must be an integer between 1 and 50");
        return false;
    }
    if (partner.secondaryH3Resolution !== undefined && (typeof partner.secondaryH3Resolution !== 'number' || !Number.isInteger(partner.secondaryH3Resolution) || partner.secondaryH3Resolution < 0 || partner.secondaryH3Resolution > 15)) {
        alert("secondaryH3Resolution must be an integer between 0 and 15 if provided");
        return false;
    }
    if (partner.secondaryNumZones !== undefined && (typeof partner.secondaryNumZones !== 'number' || !Number.isInteger(partner.secondaryNumZones) || partner.secondaryNumZones < 1 || partner.secondaryNumZones > 50)) {
        alert("secondaryNumZones must be an integer between 1 and 50 if provided");
        return false;
    }
    return true;
}
