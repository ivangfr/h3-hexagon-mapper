# H3 Hexagon Mapper

This project is a web tool that helps you see and interact with H3 hexagons on a map. You can add or remove hexagons, change their size, color, and transparency, add or remove markers, and save or load everything as a GeoJSON file.

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
- **Add a Marker**: Right-click on the map to open a popup where you can enter a marker name and add it to the map.
- **Remove a Marker**: Right-click on an existing marker to remove it.
- **Adjust Hexagon Resolution**: Use the resolution slider in the controls section to adjust the resolution of the hexagons.
- **Change Hexagon Color**: Use the color picker in the controls section to change the color of the hexagons.
- **Change Hexagon Opacity**: Use the opacity slider in the controls section to adjust the opacity of the hexagons.
- **Free Drwaing**: Click the "Start Drawing" button to enter free drawing mode. Click on the map to draw. Click the "Stop Drawing" button to exit free drawing mode.
- **Save Hexagons and Markers**: Click the "Save" button to download the current hexagons and markers as a GeoJSON file.
- **Load Hexagons and Markers**: Click the "Load" button and select a GeoJSON file to load hexagons and markers from the file.

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