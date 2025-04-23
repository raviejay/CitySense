// src/stores/mapStore.js
import { defineStore } from "pinia";
import { ref } from "vue";
import L from "leaflet";

export const useMapStore = defineStore("map", () => {
  const mapInstance = ref(null);
  const currentMapStyle = ref("minimal"); // Default style

  const setMapInstance = (instance) => {
    mapInstance.value = instance;
  };

  const setMapStyle = (style) => {
    currentMapStyle.value = style;
    updateMapStyle();
  };

  const updateMapStyle = () => {
    if (!mapInstance.value) return;

    // Remove existing tile layers
    mapInstance.value.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapInstance.value.removeLayer(layer);
      }
    });

    const maptilerApiKey = "SBAyjg2QZffT0exJjurD";

    // Add the selected tile layer
    switch (currentMapStyle.value) {
      case "standard":
        // Default OpenStreetMap style
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }).addTo(mapInstance.value);
        break;

      case "minimal":
        // MapTiler Positron style
        L.tileLayer(
          `https://api.maptiler.com/maps/positron/{z}/{x}/{y}.png?key=${maptilerApiKey}`,
          {
            attribution:
              '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
            tileSize: 512,
            zoomOffset: -1,
          }
        ).addTo(mapInstance.value);
        break;

      case "satellite":
        // MapTiler Satellite style
        L.tileLayer(
          `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${maptilerApiKey}`,
          {
            attribution:
              '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
            tileSize: 512,
            zoomOffset: -1,
          }
        ).addTo(mapInstance.value);
        break;
    }
  };

  return {
    mapInstance,
    currentMapStyle,
    setMapInstance,
    setMapStyle,
    updateMapStyle,
  };
});
