// ==========================================
// PARTNER EVENT LISTENERS
// ==========================================

// Partner form sidebar - close button
document.getElementById('sidebar-close-btn').addEventListener('click', function() {
    removeCrossMarker();
    const sidebar = document.getElementById('partner-form-sidebar');
    closeSidebar(sidebar);
    resetSidebarForm();
});

// Partner form sidebar - cancel button
document.getElementById('sidebar-cancel-add').addEventListener('click', function() {
    removeCrossMarker();
    const sidebar = document.getElementById('partner-form-sidebar');
    closeSidebar(sidebar);
    resetSidebarForm();
});

// Add partner sidebar - primary resolution slider
document.getElementById('sidebar-primary-h3Resolution').addEventListener('input', function() {
    document.getElementById('sidebar-primary-resolution-value').textContent = this.value;
});

// Add partner sidebar - primary zones slider
document.getElementById('sidebar-primary-numZones').addEventListener('input', function() {
    document.getElementById('sidebar-primary-zones-value').textContent = this.value;
});

// Add partner sidebar - secondary resolution slider
document.getElementById('sidebar-secondary-h3Resolution').addEventListener('input', function() {
    document.getElementById('sidebar-secondary-resolution-value').textContent = this.value;
});

// Add partner sidebar - secondary zones slider
document.getElementById('sidebar-secondary-numZones').addEventListener('input', function() {
    document.getElementById('sidebar-secondary-zones-value').textContent = this.value;
});

// Add partner sidebar - enable secondary checkbox
document.getElementById('sidebar-enable-secondary').addEventListener('change', function() {
    if (this.checked) {
        document.getElementById('secondary-fields').classList.remove('hidden');
    } else {
        document.getElementById('secondary-fields').classList.add('hidden');
    }
});

// Add partner sidebar - primary color sync to secondary
document.getElementById('sidebar-primary-color').addEventListener('input', function() {
    if (document.getElementById('sidebar-same-color').checked) {
        document.getElementById('sidebar-secondary-color').value = this.value;
    }
});

// Add partner sidebar - same color checkbox
document.getElementById('sidebar-same-color').addEventListener('change', function() {
    if (this.checked) {
        // Sync secondary color with primary and disable the color picker
        document.getElementById('sidebar-secondary-color').value = document.getElementById('sidebar-primary-color').value;
        document.getElementById('sidebar-secondary-color').disabled = true;
    } else {
        // Enable the secondary color picker for independent selection
        document.getElementById('sidebar-secondary-color').disabled = false;
    }
});

// Add partner sidebar - enable delivery area checkbox
document.getElementById('sidebar-enable-delivery-area').addEventListener('change', function() {
    if (this.checked) {
        document.getElementById('delivery-area-fields').classList.remove('hidden');
        // Uncheck "Same as primary" and set color to black
        document.getElementById('sidebar-same-color-delivery').checked = false;
        document.getElementById('sidebar-delivery-color').value = '#000000';
        document.getElementById('sidebar-delivery-color').disabled = false;
    } else {
        document.getElementById('delivery-area-fields').classList.add('hidden');
    }
});

// Add partner sidebar - primary color sync to delivery
document.getElementById('sidebar-primary-color').addEventListener('input', function() {
    if (document.getElementById('sidebar-same-color-delivery').checked) {
        document.getElementById('sidebar-delivery-color').value = this.value;
    }
});

// Add partner sidebar - same color for delivery checkbox
document.getElementById('sidebar-same-color-delivery').addEventListener('change', function() {
    if (this.checked) {
        // Sync delivery color with primary and disable the color picker
        document.getElementById('sidebar-delivery-color').value = document.getElementById('sidebar-primary-color').value;
        document.getElementById('sidebar-delivery-color').disabled = true;
    } else {
        // Enable the delivery color picker for independent selection
        document.getElementById('sidebar-delivery-color').disabled = false;
    }
});

// Partner form - submit
document.getElementById('partner-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const partnerId = document.getElementById('sidebar-partnerId').value.trim();
    const latitude = parseFloat(document.getElementById('sidebar-latitude').value);
    const longitude = parseFloat(document.getElementById('sidebar-longitude').value);
    const primaryH3Resolution = parseInt(document.getElementById('sidebar-primary-h3Resolution').value);
    const primaryNumZones = parseInt(document.getElementById('sidebar-primary-numZones').value);
    const primaryColor = document.getElementById('sidebar-primary-color').value;

    const enableSecondary = document.getElementById('sidebar-enable-secondary').checked;
    const secondaryH3Resolution = enableSecondary ? parseInt(document.getElementById('sidebar-secondary-h3Resolution').value) : undefined;
    const secondaryNumZones = enableSecondary ? parseInt(document.getElementById('sidebar-secondary-numZones').value) : undefined;
    const secondaryColor = enableSecondary ? document.getElementById('sidebar-secondary-color').value : undefined;

    // Delivery area data
    const enableDeliveryArea = document.getElementById('sidebar-enable-delivery-area').checked;
    let deliveryAreaContent = undefined;
    let deliveryAreaColor = undefined;
    
    if (enableDeliveryArea) {
        deliveryAreaContent = document.getElementById('sidebar-polygon-content').value.trim();
        if (!deliveryAreaContent) {
            alert("Please provide polygon content (KML or WKT) for the delivery area, or disable the delivery area option.");
            return;
        }
        deliveryAreaColor = document.getElementById('sidebar-delivery-color').value;
    }

    const partner = { 
        partnerId, 
        latitude, 
        longitude, 
        primaryH3Resolution, 
        primaryNumZones, 
        secondaryH3Resolution, 
        secondaryNumZones, 
        primaryColor, 
        secondaryColor,
        deliveryAreaContent,
        deliveryAreaColor
    };

    if (!validatePartner(partner)) {
        return;
    }

    if (editMode.isActive) {
        // Update existing partner
        updatePartner(editMode.partnerId, partner);
    } else {
        // Check if partner ID already exists
        if (partnersById[partnerId]) {
            alert(`Partner with ID "${partnerId}" already exists. Please use a different ID.`);
            return;
        }
        // Check if a partner already exists at this location
        const existingPartnerAtLocation = Object.values(partnersById).find(p => 
            p.latitude === latitude && p.longitude === longitude
        );
        if (existingPartnerAtLocation) {
            alert(`Partner "${existingPartnerAtLocation.partnerId}" already exists at this location (Lat: ${latitude}, Lon: ${longitude}).`);
            return;
        }
        // Add new partner
        addPartnerToMap(partner);
        // Increment counter after successful add
        partnerIdCounter++;
    }

    // Remove cross marker, close sidebar and reset form
    removeCrossMarker();
    const sidebar = document.getElementById('partner-form-sidebar');
    closeSidebar(sidebar);
    resetSidebarForm();
});

// Partner info sidebar - close button
document.getElementById('slide-close-btn').addEventListener('click', closePartnerSidebar);

// Partner info sidebar - edit button
document.getElementById('edit-partner-btn').addEventListener('click', function() {
    const partnerId = currentPartnerId;
    if (!partnerId) return;

    const partner = partnersById[partnerId];
    if (!partner) return;

    closePartnerSidebar();
    openSidebarForEdit(partner);
});

// Partner info sidebar - delete button
document.getElementById('delete-partner-btn').addEventListener('click', function() {
    const partnerId = currentPartnerId;
    if (!partnerId) return;

    const partner = partnersById[partnerId];
    if (!partner) return;

    const confirmed = confirm(`Are you sure you want to delete partner "${partnerId}"? This action cannot be undone.`);
    if (confirmed) {
        deletePartner(partnerId);
        closePartnerSidebar();
    }
});

// Partner info sidebar - toggle primary zone
document.getElementById('toggle-primary-zone').addEventListener('change', function() {
    if (!currentPartnerId) return;
    togglePrimaryHexagonsVisibility(currentPartnerId, this.checked);
    updateIntersectionToggleState(currentPartnerId);
});

// Partner info sidebar - toggle secondary zone
document.getElementById('toggle-secondary-zone').addEventListener('change', function() {
    if (!currentPartnerId) return;
    toggleSecondaryHexagonsVisibility(currentPartnerId, this.checked);
    updateIntersectionToggleState(currentPartnerId);
});

// Partner info sidebar - toggle delivery area
document.getElementById('toggle-delivery-area').addEventListener('change', function() {
    if (!currentPartnerId) return;
    toggleDeliveryAreaVisibility(currentPartnerId, this.checked);
    // Turn off intersection highlight when delivery area is hidden
    if (!this.checked) {
        toggleIntersectionHighlight(currentPartnerId, false);
    }
    updateIntersectionToggleState(currentPartnerId);
});

// Partner info sidebar - toggle intersection highlight
document.getElementById('toggle-intersection-highlight').addEventListener('change', function() {
    if (!currentPartnerId) return;
    toggleIntersectionHighlight(currentPartnerId, this.checked);
});

// Partner info sidebar - toggle limit delivery to primary
document.getElementById('toggle-limit-delivery').addEventListener('change', function() {
    if (!currentPartnerId) return;
    const partner = partnersById[currentPartnerId];
    if (!partner) return;
    
    // Update the partner's limitDeliveryToPrimary state
    partner.limitDeliveryToPrimary = this.checked;
    
    // Recompute intersections with the new setting
    computeHexagonIntersections(partner);
    
    // Check if intersection highlight is active
    const intersectionToggle = document.getElementById('toggle-intersection-highlight');
    const intersectionActive = intersectionToggle.checked && !intersectionToggle.disabled;
    
    // Directly update hexagon opacities on the map (keep highlight toggle state)
    // For primary hexagons
    partner.elements.primaryHexagons.forEach(hexagon => {
        const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
        if (isVisible) {
            const targetOpacity = (intersectionActive && hexagon.isIntersectedByDelivery) 
                ? PARTNER_CONSTANTS.INTERSECTION_OPACITY 
                : PARTNER_CONSTANTS.DEFAULT_OPACITY;
            hexagon.polygon.setStyle({
                fillOpacity: targetOpacity
            });
        }
    });
    
    // For secondary hexagons
    partner.elements.secondaryHexagons.forEach(hexagon => {
        const isVisible = hexagon.polygon.options.fillOpacity > 0 || hexagon.polygon.options.opacity > 0;
        if (isVisible) {
            const targetOpacity = (intersectionActive && hexagon.isIntersectedByDelivery) 
                ? PARTNER_CONSTANTS.INTERSECTION_OPACITY 
                : PARTNER_CONSTANTS.DEFAULT_OPACITY;
            hexagon.polygon.setStyle({
                fillOpacity: targetOpacity
            });
        }
    });
    
    // Update the statistics display
    updatePartnerSidebarContent(partner);
});
