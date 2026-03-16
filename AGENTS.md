# AGENTS.md — H3 Hexagon Mapper

Guidance for agentic coding assistants working in this repository.

---

## Project Overview

H3 Hexagon Mapper is a **pure vanilla JavaScript** single-page web application. There is
no build system, no package manager, no transpilation step, and no test framework. The
application consists of the following files:

| File | Purpose |
|---|---|
| `index.html` | Full HTML markup (~860 lines), CDN script/link tags, Tailwind config |
| `style.css` | Custom CSS overrides and animations (~480 lines) |
| `js/state.js` | Map initialisation and all global state variables/constants |
| `js/hexagons.js` | Standalone hexagon click and draw logic |
| `js/measurement.js` | Distance measurement mode |
| `js/map-events.js` | Leaflet map event listeners |
| `js/ui-controls.js` | Toolbar and controls UI event listeners |
| `js/save-load.js` | JSON save/load functionality |
| `js/partners.js` | Partner management functions |
| `js/partner-events.js` | Partner form and sidebar event listeners |
| `js/context-menu.js` | Right-click context menu, cross marker, geometry helpers |
| `js/customer-info.js` | Customer info sidebar and sidebar animation helpers |
| `js/delivery-area.js` | Delivery area drawing mode and its event listeners |

All library dependencies are loaded at runtime from CDN URLs embedded in `index.html`.

---

## Running the Application

There is no build step. Open `index.html` directly in a browser:

```sh
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Or serve it with any static file server:

```sh
python3 -m http.server 8080
# then visit http://localhost:8080
```

---

## Build / Lint / Test Commands

**There are none.** This project has no `package.json`, no Node.js toolchain, no linter,
no formatter, and no automated test suite. Verification is done manually in a browser.

- Do **not** add `npm`, `eslint`, `prettier`, `vitest`, or any other tooling unless
  explicitly requested by the user.
- Do **not** introduce ES module `import`/`export` syntax — all code runs as plain
  browser scripts loaded via multiple `<script>` tags in `index.html`.
- Do **not** introduce TypeScript, JSX, or any compile-time transformation.

---

## CDN Dependencies (do not install locally)

| Library | Global | Source in `index.html` |
|---|---|---|
| Leaflet | `L` | `unpkg.com/leaflet` |
| H3-js (Uber) | `h3` | `unpkg.com/h3-js` |
| Turf.js | `turf` | `unpkg.com/@turf/turf` |
| Tailwind CSS | — | `cdn.tailwindcss.com` (Play CDN) |
| Lucide Icons | `lucide` | `unpkg.com/lucide@latest` |

After injecting any HTML that contains `<i data-lucide="...">` tags, always call
`lucide.createIcons()` to render SVG icons.

---

## Code Style

### Language
- Plain **ES2020+ JavaScript** — no TypeScript, no JSDoc type annotations.
- Use `const` for stable references; `let` for mutable state. Never use `var`.
- Semicolons required. Single quotes preferred; backtick template literals for
  interpolated strings.
- 4-space indentation. Opening braces on the same line (K&R style).
- Trailing commas in multi-line object/array literals.

### No Imports
There are no `import` or `export` statements anywhere. All library APIs are accessed
as browser globals (`L`, `h3`, `turf`, `lucide`). New code must follow the same pattern.

### File Organisation
Each logical area of the application lives in its own `.js` file (see the table in
**Project Overview**). Every file begins with a `// ==========================================`
section banner. Some files contain multiple internal sections, each with their own banner.

`index.html` loads the scripts in this exact order — **do not change it**:

```html
<script src="js/state.js"></script>        <!-- must be first: defines all globals -->
<script src="js/hexagons.js"></script>
<script src="js/measurement.js"></script>
<script src="js/customer-info.js"></script>
<script src="js/context-menu.js"></script>
<script src="js/ui-controls.js"></script>
<script src="js/partners.js"></script>
<script src="js/delivery-area.js"></script>
<script src="js/save-load.js"></script>
<script src="js/map-events.js"></script>
<script src="js/partner-events.js"></script>
```

When adding new code, place it inside the most appropriate existing file. Do not create
additional `.js` files unless explicitly asked.

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Functions | `camelCase`, verb-first | `generateH3Grid`, `toggleHexagonsVisibility` |
| Variables / state | `camelCase` | `currentPartnerId`, `isMeasuring` |
| Boolean variables | `is` / `has` prefix | `isMeasuring`, `hasDeliveryArea` |
| Constants (grouped) | `UPPER_SNAKE_CASE` object keys | `PARTNER_CONSTANTS.DEFAULT_OPACITY` |
| Scalar constants | `UPPER_SNAKE_CASE` | `LONG_PRESS_DURATION` |
| DOM element refs | descriptive `camelCase` | `resolutionSlider`, `measurementDisplay` |
| HTML element IDs | `kebab-case` | `partner-form-sidebar`, `cursor-coordinates` |
| CSS classes (custom) | `kebab-case` | `.cross-marker`, `.delivery-area-start-marker` |
| Data object properties | `camelCase` | `partner.primaryH3Resolution`, `hexagon.layerType` |

### Function Naming Patterns
- **Getters / finders**: `find…`, `get…`, `calculate…`, `compute…`, `parse…`
- **Mutators**: `add…`, `remove…`, `delete…`, `update…`, `toggle…`, `set…`
- **Visibility**: `show…`, `hide…`, `open…`, `close…`
- **Event helpers**: `on…` or descriptive verb phrases matching the action

---

## Error Handling

Follow these four patterns (in order of preference based on context):

1. **User-facing validation** — use `alert()` and `return false`:
   ```js
   if (typeof partner.latitude !== 'number') {
       alert("latitude must be a number between -90 and 90");
       return false;
   }
   ```

2. **Destructive action confirmation** — use `confirm()`:
   ```js
   const confirmed = confirm(`Are you sure you want to delete partner "${partnerId}"?`);
   if (!confirmed) return;
   ```

3. **Guard clauses** — return early when state is invalid:
   ```js
   function deletePartner(partnerId) {
       const partner = partnersById[partnerId];
       if (!partner) return;
       // ...
   }
   ```

4. **Geospatial helpers** — `try/catch` with silent fallback:
   ```js
   function isHexagonIntersectedByPolygon(hexBoundary, polyCoords) {
       try {
           return turf.booleanIntersects(turf.polygon([hexCoords]), turf.polygon([polyCoords]));
       } catch (e) {
           return false;
       }
   }
   ```

Do **not** use `console.error` or `throw` for user-visible errors. Reserve `try/catch`
for geospatial computations that may fail on degenerate geometry.

---

## State Management

All application state is stored in **module-level `let`/`const` variables** at the top
of `js/state.js`. There is no store, reducer, or reactive system.

```js
// Keyed object maps for O(1) lookup
const partnersById = {};        // { partnerId: { marker, elements, primaryColor, ... } }
const standaloneHexagons = {};  // { h3Index: { polygon, lat, lng } }

// Scalar flags
let isMeasuring = false;
let currentPartnerId = null;
let deliveryAreaMode = false;
```

When adding new state, declare it at module scope near related existing state variables.

---

## DOM Interaction

Use imperative DOM manipulation — no virtual DOM, no reactive bindings:

```js
// Show / hide
element.classList.remove('hidden');
element.classList.add('hidden');

// Sidebar animation (slide in/out via Tailwind transform classes)
function openSidebar(sidebarElement) {
    sidebarElement.classList.remove('translate-x-full');
    showDrawerOverlay();
}

// Dynamic HTML — build strings with template literals, inject via innerHTML
listContainer.innerHTML = items.map(item => `
    <div class="flex items-center gap-2">
        <span>${item.label}</span>
    </div>
`).join('');
lucide.createIcons();  // required after any innerHTML update with lucide icons
```

---

## Geospatial Coordinate Conventions

H3 and Leaflet use **`[lat, lng]`** order. Turf.js uses **`[lng, lat]`** (GeoJSON order).
Always convert explicitly when crossing library boundaries:

```js
// H3 boundary → Turf polygon
const turfCoords = h3Boundary.map(v => [v[1], v[0]]);   // swap [lat,lng] → [lng,lat]
turfCoords.push(turfCoords[0]);                           // close the ring
const turfPolygon = turf.polygon([turfCoords]);
```

---

## CSS Architecture

- **Tailwind utility classes** — used directly in `index.html` HTML for all layout,
  spacing, colour, and typography. The Tailwind Play CDN is configured with custom
  font families (`roboto`, `roboto-mono`) in `index.html`.
- **`style.css`** — custom overrides only. Use for: CSS animations/keyframes, custom
  form control styling (range sliders, colour pickers), map-specific selectors
  (`.leaflet-tile-pane`), and media queries for mobile breakpoints
  (`@media (max-width: 768px)` and `@media (hover: none) and (pointer: coarse)`).
- Do **not** add new `<style>` blocks to `index.html`. Put custom CSS in `style.css`.

---

## AI Assistant Configuration Files

There are no `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`
files in this repository.
