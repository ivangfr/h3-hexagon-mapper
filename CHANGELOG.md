# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-03-17

### Changed
- **JS File Organisation**: Moved all 11 JavaScript source files into a `js/` subdirectory. Updated `<script>` tag paths in `index.html` and file references in `AGENTS.md`. Zero logic changes — purely a structural reorganisation.

## [1.2.0] - 2026-03-16

### Changed
- **Codebase Split**: Monolithic `script.js` (~3,800 lines) split into 11 logically
  grouped files — `state.js`, `hexagons.js`, `measurement.js`, `map-events.js`,
  `ui-controls.js`, `save-load.js`, `partners.js`, `partner-events.js`,
  `context-menu.js`, `customer-info.js`, `delivery-area.js`. `index.html` updated to
  load them in order via `<script>` tags. Zero logic changes — purely a structural
  reorganisation.

### Removed
- `script.js` — replaced by the 11 files listed above.

## [1.1.0] - 2026-03-16

### Added
- **WKT Hole Detection Warning**: Alert shown when imported WKT contains polygon rings (holes); only the outer boundary of each polygon is imported

### Changed
- **Help Panel Layout**: Moved "Support the Project" card to the bottom of the Help panel, just above the copyright line
- **Delivery Area Mode Blocking**: Context menu and long-press are now disabled during delivery area drawing mode (previously only blocked during measurement mode)
- **Escape Key Handler**: Unified into a single global handler covering both measurement mode and delivery area mode (remove last point, remove last polygon with confirmation, or cancel)
- **`resetSidebarForm` Refactor**: Delegates all field and edit-mode reset logic to `setupAddPartnerForm`, removing duplicated code
- **`_teardownDeliveryAreaUI` Helper**: Extracted shared UI teardown logic from `exitDeliveryAreaMode` and `exportDeliveryArea` to eliminate duplication
- **Dropdown Close Handler**: Consolidated delivery area export dropdown close-on-outside-click into the existing global document click listener
- **Scoped `lucide.createIcons()` Calls**: All calls now scoped to specific DOM nodes instead of re-rendering the entire document
- **Visibility Checks**: Hexagon and delivery area polygon visibility now checks both `fillOpacity > 0` and `opacity > 0`, fixing edge cases where polygons were incorrectly treated as hidden
- **`intersectionContainer` Lookup**: Now resolved by element ID (`toggle-intersection-highlight-container`) instead of fragile DOM traversal
- **Delivery Area Turf Polygons**: Pre-built once per `computeHexagonIntersections` call instead of being recreated for each hexagon
- **Temporary Line Constants**: Delivery area temporary line now reuses `LINE_COLOR`, `LINE_WEIGHT`, and `LINE_OPACITY`; removed redundant `TEMP_LINE_*` constants
- **Controls Footer Selector**: Replaced fragile multi-class CSS selector with stable `.controls-footer` class for collapsed/mobile state
- **`h3.cellToLatLng` Access**: Result now accessed via array indices (`[0]`, `[1]`) instead of `.lat`/`.lng` properties

### Fixed
- **`isHexagonIntersectedByPolygon`**: Wrapped in `try/catch` for silent fallback on degenerate geometry
- **Delivery Area Export**: Polygon layers are no longer cleared prematurely on export

### Removed
- `originalFillOpacity` property from standalone hexagon Leaflet layer options

## [1.0.0] - 2026-03-12

### Added
- **Partner Management System**: Add, edit, and delete partners with custom H3 hexagonal zones
- **Primary and Secondary Zones**: Support for two-layer partner zone management
- **Delivery Areas**: Interactive polygon drawing mode for custom delivery boundaries with multi-polygon support
- **KML and WKT Support**: Import and export delivery areas in KML and WKT formats
- **Hole Detection**: Automatic detection of nested polygons (holes) in delivery areas
- **Hexagon Intersection Detection**: Calculate which hexagons intersect with delivery areas
- **Coverage Analysis**: Visual coverage bars showing intersection percentages for hexagons
- **Limit Delivery Toggle**: "Limit Delivery to Primary" option to prevent double-counting partners
- **Customer Info System**: Right-click context menu for querying locations on the map
- **Location Hexagon Lookup**: View all hexagons (standalone and partner-owned) at any location
- **Partner Arrival Detection**: See which partners are "arriving" at each queried location
- **Partner Marker Clustering**: Real-time clustering of partner markers on the map
- **Modern UI Design**: Gradient-based button styling with Lucide Icons
- **Mobile Responsive Controls**: Collapsible controls panel optimized for mobile devices
- **Responsive Sidebar Navigation**: Organized partner and delivery area management interface
- **Grayscale Map Toggle**: Optional grayscale map view for better visual focus
- **Real-time Coordinates**: Display cursor coordinates in real time
- **Mobile Viewport Optimization**: Added viewport meta tag for proper mobile display
- **Turf.js Integration**: Advanced geospatial operations for polygon intersection and containment detection
- **Enhanced Save/Load**: Import and export data as JSON format (supporting partner configurations)

### Changed
- **Data Format**: Migrated from GeoJSON to JSON format for enhanced partner support
- **UI Architecture**: Redesigned interface from hexagon list sidebar to partner-centric dashboard
- **Feature Focus**: Shifted from simple hexagon visualization to comprehensive delivery zone management
- **Map Interaction**: Replaced basic drawing and marker functionality with partner-oriented tools
- **License Year**: Updated to 2026

### Removed
- Hexagon list sidebar
- Satellite map layer option
- Basic drawing mode (replaced with delivery area polygon drawing)
- Limited marker functionality (replaced with partner marker system)

### Dependencies
- Added: `Turf.js 6.x` for geospatial operations (polygon intersection, containment detection)
- Added: `Lucide Icons` for modern icon system

## [0.0.1] - Previous Releases

### Features
- Interactive H3 hexagon visualization on a map
- Add, remove, and customize hexagons (size, color, transparency)
- Marker placement and management
- Measurement functionality for distances
- Visual feedback for application states
- Save and load hexagon configurations

### Removed
- Satellite layer option (removed in favor of street map focus)

---

## Guide for Future Releases

When creating a new release, follow this format:

```markdown
## [Version] - YYYY-MM-DD

### Added
- New features here

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in future versions

### Removed
- Features that have been removed

### Fixed
- Bug fixes

### Security
- Security-related changes
```