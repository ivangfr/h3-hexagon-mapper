# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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