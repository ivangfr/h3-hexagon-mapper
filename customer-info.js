// ==========================================
// CUSTOMER INFO SIDEBAR
// ==========================================

/**
 * Finds partners arriving at a given location.
 * For partners with delivery area: only hexagons intersected by delivery area are included
 * For partners without delivery area: all hexagons at the location are included
 */
function findPartnersArrivingAtLocation(lat, lng) {
    // NOTE: Linear scan — same performance caveat as findHexagonsAtLocation.
    const arrivingPartners = {};
    
    // Check partner hexagons
    Object.keys(partnersById).forEach(partnerId => {
        const partner = partnersById[partnerId];
        const hasDeliveryArea = partner.elements.deliveryAreaPolygons && partner.elements.deliveryAreaPolygons.length > 0;
        
        // Check primary hexagons
        partner.elements.primaryHexagons.forEach(hexagon => {
            if (isPointInHexagon(lat, lng, hexagon.polygon)) {
                // If partner has delivery area, only include if hexagon is intersected
                if (hasDeliveryArea && !hexagon.isIntersectedByDelivery) {
                    return; // Skip this hexagon
                }
                
                if (!arrivingPartners[partnerId]) {
                    arrivingPartners[partnerId] = {
                        partnerId: partnerId,
                        primaryColor: partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR,
                        secondaryColor: partner.secondaryColor,
                        hasDeliveryArea: hasDeliveryArea,
                        hexagons: []
                    };
                }
                
                arrivingPartners[partnerId].hexagons.push({
                    h3Index: hexagon.h3Index,
                    resolution: hexagon.h3Resolution,
                    layerType: 'primary',
                    zoneNumber: hexagon.zoneNumber,
                    color: hexagon.polygon.options.color,
                    isIntersectedByDelivery: hexagon.isIntersectedByDelivery
                });
            }
        });
        
        // Check secondary hexagons
        partner.elements.secondaryHexagons.forEach(hexagon => {
            if (isPointInHexagon(lat, lng, hexagon.polygon)) {
                // If partner has delivery area, only include if hexagon is intersected
                if (hasDeliveryArea && !hexagon.isIntersectedByDelivery) {
                    return; // Skip this hexagon
                }
                
                if (!arrivingPartners[partnerId]) {
                    arrivingPartners[partnerId] = {
                        partnerId: partnerId,
                        primaryColor: partner.primaryColor || PARTNER_CONSTANTS.DEFAULT_PRIMARY_COLOR,
                        secondaryColor: partner.secondaryColor,
                        hasDeliveryArea: hasDeliveryArea,
                        hexagons: []
                    };
                }
                
                arrivingPartners[partnerId].hexagons.push({
                    h3Index: hexagon.h3Index,
                    resolution: hexagon.h3Resolution,
                    layerType: 'secondary',
                    zoneNumber: hexagon.zoneNumber,
                    color: hexagon.polygon.options.color,
                    isIntersectedByDelivery: hexagon.isIntersectedByDelivery
                });
            }
        });
    });
    
    // Convert to array
    return Object.values(arrivingPartners);
}

/**
 * Updates the customer info sidebar content with detected hexagons.
 */
function updateCustomerInfoSidebarContent(lat, lng) {
    const customerInfoCoords = document.getElementById('customer-info-coords');
    const customerInfoHexagonList = document.getElementById('customer-info-hexagon-list');
    const customerInfoPartnerList = document.getElementById('customer-info-partner-list');
    const summaryHexagonCount = document.getElementById('summary-hexagon-count');
    const summaryPartnerCount = document.getElementById('summary-partner-count');
    
    // Place cross marker at customer info location
    placeCrossMarker(lat, lng);
    
    // Update coordinates display
    customerInfoCoords.textContent = `Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)}`;
    
    // Find hexagons at location
    const detectedHexagons = findHexagonsAtLocation(lat, lng);
    
    // Find partners arriving at location
    const arrivingPartners = findPartnersArrivingAtLocation(lat, lng);
    
    // Update summary counts based on partners ARRIVING at the location
    const arrivingHexagonCount = arrivingPartners.reduce((sum, p) => sum + p.hexagons.length, 0);
    summaryHexagonCount.textContent = arrivingHexagonCount;
    summaryPartnerCount.textContent = arrivingPartners.length;
    
    // Update partners arriving at location list
    customerInfoPartnerList.innerHTML = '';
    
    if (arrivingPartners.length > 0) {
        arrivingPartners.forEach(partner => {
            const partnerCard = document.createElement('div');
            partnerCard.className = 'bg-gray-50 rounded-xl p-4 border border-gray-200';
            
            // Build hexagons list HTML
            let hexagonsHtml = partner.hexagons.map(hex => {
                return `<div class="mt-2 pl-3 py-1.5 border-l-4 rounded-r bg-white" style="border-left-color: ${hex.color};">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-[11px] font-semibold text-gray-700">${hex.layerType}, zone ${hex.zoneNumber}</span>
                        <span class="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">H3 Res ${hex.resolution}</span>
                        <span class="text-[10px] text-gray-400 font-mono">${hex.h3Index}</span>
                    </div>
                </div>`;
            }).join('');
            
            // Delivery area indicator
            const deliveryIndicator = partner.hasDeliveryArea 
                ? '<span class="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Has delivery area</span>'
                : '<span class="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">No delivery area</span>';
            
            partnerCard.innerHTML = `
                <div class="flex items-center gap-3">
                    <i data-lucide="store" class="w-5 h-5 flex-shrink-0" style="color: ${partner.primaryColor};"></i>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-semibold text-gray-900">${partner.partnerId}</span>
                            ${deliveryIndicator}
                        </div>
                        <div class="text-[11px] text-gray-500 mt-1">${partner.hexagons.length} hexagon${partner.hexagons.length !== 1 ? 's' : ''} at this location</div>
                    </div>
                </div>
                ${hexagonsHtml}
            `;
            
            customerInfoPartnerList.appendChild(partnerCard);
        });
        
        // Initialize Lucide icons for the new content
        lucide.createIcons({ nodes: [customerInfoPartnerList] });
    } else {
        // No partners arriving
        const noPartnersMsg = document.createElement('div');
        noPartnersMsg.className = 'text-center py-8 text-gray-400';
        noPartnersMsg.innerHTML = `
            <i data-lucide="store" class="w-12 h-12 mx-auto mb-3 text-gray-300"></i>
            <p class="text-sm">No partners arriving at this location</p>
        `;
        customerInfoPartnerList.appendChild(noPartnersMsg);
        lucide.createIcons();
    }
    
    // Update hexagon list
    customerInfoHexagonList.innerHTML = '';
    
    if (detectedHexagons.length > 0) {
        // Group hexagons by H3 index
        const groupedHexagons = {};
        detectedHexagons.forEach(hexagon => {
            if (!groupedHexagons[hexagon.h3Index]) {
                groupedHexagons[hexagon.h3Index] = {
                    h3Index: hexagon.h3Index,
                    resolution: hexagon.resolution,
                    color: hexagon.color,
                    partners: [],
                    isStandalone: false
                };
            }
            
            if (hexagon.source === 'standalone') {
                groupedHexagons[hexagon.h3Index].isStandalone = true;
            } else {
                groupedHexagons[hexagon.h3Index].partners.push({
                    partnerId: hexagon.partnerId,
                    layerType: hexagon.layerType,
                    zoneNumber: hexagon.zoneNumber,
                    color: hexagon.color
                });
            }
        });
        
        // Convert to array and sort by resolution (highest first)
        const groupedArray = Object.values(groupedHexagons).sort((a, b) => b.resolution - a.resolution);
        
        groupedArray.forEach(group => {
            const hexagonCard = document.createElement('div');
            hexagonCard.className = 'bg-gray-50 rounded-xl p-4 border border-gray-200';
            hexagonCard.dataset.h3Index = group.h3Index;
            
            // Build partners list HTML - separate div for each partner with their color
            let partnersHtml = '';
            if (group.partners.length > 0) {
                partnersHtml = group.partners.map(p => {
                    return `<div class="mt-3 pl-3 py-2 border-l-4 rounded-r bg-white" style="border-left-color: ${p.color};">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-[13px] font-semibold text-gray-900">${p.partnerId}</span>
                            <span class="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">${p.layerType}, zone ${p.zoneNumber}</span>
                        </div>
                    </div>`;
                }).join('');
            }
            
            // Build standalone indicator
            let standaloneHtml = '';
            if (group.isStandalone && group.partners.length === 0) {
                standaloneHtml = '<div class="mt-3 pl-3 py-2 border-l-4 border-l-gray-400 rounded-r bg-gray-100"><div class="text-[13px] text-gray-500 italic">Standalone hexagon</div></div>';
            } else if (group.isStandalone) {
                standaloneHtml = '<div class="mt-2 pl-3 py-1 border-l-4 border-l-gray-400 rounded-r bg-gray-100"><div class="text-xs text-gray-500 italic">Also: standalone</div></div>';
            }
            
            hexagonCard.innerHTML = `
                <div class="flex items-center gap-3">
                    <i data-lucide="hexagon" class="w-5 h-5 flex-shrink-0" style="color: ${group.color};"></i>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-mono text-gray-900 break-all">${group.h3Index}</div>
                        <div class="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block mt-1">H3 Res ${group.resolution}</div>
                    </div>
                </div>
                ${partnersHtml}
                ${standaloneHtml}
            `;
            
            customerInfoHexagonList.appendChild(hexagonCard);
        });
        
        // Initialize Lucide icons for the new content
        lucide.createIcons({ nodes: [customerInfoHexagonList] });
    } else {
        // No hexagons found
        const noHexagonsMsg = document.createElement('div');
        noHexagonsMsg.className = 'text-center py-8 text-gray-400';
        noHexagonsMsg.innerHTML = `
            <i data-lucide="hexagon" class="w-12 h-12 mx-auto mb-3 text-gray-300"></i>
            <p class="text-sm">No hexagons at this location</p>
        `;
        customerInfoHexagonList.appendChild(noHexagonsMsg);
        lucide.createIcons();
    }
}

/**
 * Shows the customer info sidebar with hexagon detection.
 */
function showCustomerInfoSidebar(lat, lng) {
    closeAllSidebars();
    updateCustomerInfoSidebarContent(lat, lng);
    const customerInfoSidebar = document.getElementById('customer-info-sidebar');
    openSidebar(customerInfoSidebar);
}

/**
 * Closes the customer info sidebar.
 */
function closeCustomerInfoSidebar() {
    const customerInfoSidebar = document.getElementById('customer-info-sidebar');
    closeSidebar(customerInfoSidebar);
    removeCrossMarker();
}

// Context menu - "Customer Info" button
document.getElementById('context-menu-customer-info').addEventListener('click', function() {
    hideContextMenu();
    if (contextMenuState.latitude !== null && contextMenuState.longitude !== null) {
        showCustomerInfoSidebar(contextMenuState.latitude, contextMenuState.longitude);
    }
});

// Customer info sidebar - close button
document.getElementById('customer-info-close-btn').addEventListener('click', closeCustomerInfoSidebar);

// Drawer overlay - click to close all sidebars
document.getElementById('drawer-overlay').addEventListener('click', closeAllSidebars);

// ==========================================
// SIDEBAR ANIMATION HELPERS
// ==========================================

/**
 * Closes a sidebar with slide-out animation.
 */
function closeSidebar(sidebarElement) {
    // For right-side drawers, add translate-x-full to slide out
    sidebarElement.classList.add('translate-x-full');
    // Hide overlay
    hideDrawerOverlay();
}

/**
 * Opens a sidebar with slide-in animation.
 */
function openSidebar(sidebarElement) {
    // Remove translate-x-full to slide in
    sidebarElement.classList.remove('translate-x-full');
    // Show overlay
    showDrawerOverlay();
}

/**
 * Shows the drawer overlay.
 */
function showDrawerOverlay() {
    const overlay = document.getElementById('drawer-overlay');
    overlay.classList.remove('opacity-0', 'pointer-events-none');
}

/**
 * Hides the drawer overlay.
 */
function hideDrawerOverlay() {
    const overlay = document.getElementById('drawer-overlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
}

/**
 * Closes all sidebars and removes cross marker.
 */
function closeAllSidebars() {
    const helpSidebar = document.getElementById('help-sidebar');
    const partnerFormSidebar = document.getElementById('partner-form-sidebar');
    const customerInfoSidebar = document.getElementById('customer-info-sidebar');
    const partnerInfoSidebar = document.getElementById('partner-info-sidebar');
    
    closeSidebar(helpSidebar);
    closeSidebar(partnerFormSidebar);
    closeSidebar(customerInfoSidebar);
    closeSidebar(partnerInfoSidebar);
    
    // Reset currentPartnerId when closing partner info sidebar
    currentPartnerId = null;
    
    // Remove cross marker when closing all sidebars
    removeCrossMarker();
}
