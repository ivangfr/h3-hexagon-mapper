# H3 Hexagon Mapper

This project is a web tool that helps you see and interact with H3 hexagons on a map. You can add or remove hexagons, change their size, color, and transparency, manage partners with their own hexagonal zones, measure distances between points, and save or load everything as a JSON file.

![Screenshot](documentation/demo.gif)

## Online Tool

You can access the online tool [here](https://ivangfr.github.io/h3-hexagon-mapper).

## Libraries Used

- [Leaflet](https://github.com/Leaflet/Leaflet): A JavaScript library for interactive maps. License: [BSD 2-Clause "Simplified" License](https://github.com/Leaflet/Leaflet/blob/main/LICENSE)
- [H3-js](https://github.com/uber/h3-js): A JavaScript library for working with H3 hexagons. License: [Apache License 2.0](https://github.com/uber/h3-js/blob/master/LICENSE)
- [OpenStreetMap](https://www.openstreetmap.org/): Used for map tiles. License: [Open Data Commons Open Database License (ODbL)](https://www.openstreetmap.org/copyright)
- [Tailwind CSS](https://tailwindcss.com/): A utility-first CSS framework for rapid UI development. License: [MIT License](https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE)

## How to Use it

- **Add a Hexagon**: Click on the map to add a hexagon at the clicked location.
- **Remove a Hexagon**: Click on an existing hexagon to remove it. Ensure the resolution of the hexagon matches the resolution slider value.
- **Adjust Hexagon Resolution**: Use the resolution slider in the controls section to adjust the resolution of the hexagons.
- **Change Hexagon Color**: Use the color picker in the controls section to change the color of the hexagons.
- **Change Hexagon Opacity**: Use the opacity slider in the controls section to adjust the opacity of the hexagons.
- **Measurement Mode**: Click the "Start Measurement" button to enter measurement mode. Click once to set the starting point, then move the mouse to see a black dashed measurement line and distance in km displayed at the bottom-center. Click again to clear the measurement.
- **Save**: Click the "Save" button to download both hexagons and partners as a JSON file.
- **Load**: Click the "Load" button and select a JSON file to load hexagons and partners.

## Partner Management

Partners allow you to create and manage H3 hexagonal zones around specific locations:

- **Add Partner**: Click the "Add Partner" button to open the sidebar form. Enter a Partner ID, coordinates (latitude/longitude), H3 resolution, number of zones, and color. You can also enable a secondary H3 layer with different settings.
- **Edit Partner**: Click on any partner marker on the map to open the partner panel, then click "Edit Partner" to modify the partner's settings.
- **Delete Partner**: Click on a partner marker and use the "Delete Partner" button to remove it from the map.
- **Primary Zone Toggle**: Show/hide the primary H3 hexagonal zones for a selected partner.
- **Secondary Zone Toggle**: Show/hide the secondary H3 hexagonal zones for a selected partner (if configured).
- **Partner Statistics**: View the resolution, number of zones, and hexagon count for both primary and secondary zones.

## How to Run Locally

To run the project locally, follow these steps:

1. Clone the repository:
    ```sh
    git clone https://github.com/ivangfr/h3-hexagon-mapper.git
    ```
2. Navigate to the project directory:
    ```sh
    cd h3-hexagon-mapper
    ```
3. Open the `index.html` file in your web browser:
    ```sh
    open index.html
    ```

## Contributing

Contributions are welcome! If you have any ideas, suggestions, or bug reports, please open an issue or submit a pull request.

## License

This project is licensed under the BSD 3-Clause License. See the [LICENSE](LICENSE) file for details.