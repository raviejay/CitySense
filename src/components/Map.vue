<script setup>
import { ref, onMounted, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRoutes } from "@/composables/useRoutes";
import { useMapStore } from "@/stores/mapStore";

const props = defineProps({
  startCoords: String,
  destinationCoords: String,
  activeInputField: String,
});

const emit = defineEmits(["updateCoords"]);

const maptilerApiKey = "SBAyjg2QZffT0exJjurD";
const mapStore = useMapStore();
const mapContainer = ref(null);
const { loadRoutes } = useRoutes();

// Initialize the map
onMounted(() => {
  const southWest = L.latLng(8.8464, 125.3792);
  const northEast = L.latLng(9.0464, 125.5792);
  const bounds = L.latLngBounds(southWest, northEast);

  const map = L.map(mapContainer.value, {
    center: [8.946048723670792, 125.54603354770742],
    zoom: 14,
    maxBounds: bounds.pad(0.4),
    minZoom: 12,
    maxZoom: 18,
  });

  mapStore.setMapInstance(map);
  mapStore.updateMapStyle();
  loadRoutes(map);

  // Handle map clicks based on active input field
  map.on("click", (event) => {
    const { lat, lng } = event.latlng;
    const coords = `${lng}, ${lat}`;

    if (props.activeInputField === "start") {
      emit("updateCoords", coords, undefined, "start");
    } else if (props.activeInputField === "destination") {
      emit("updateCoords", undefined, coords, "destination");
    } else {
      // Default behavior when no field is active
      if (!props.startCoords) {
        emit("updateCoords", coords, undefined, "start");
      } else if (!props.destinationCoords) {
        emit("updateCoords", undefined, coords, "destination");
      } else {
        // Both fields have values - reset and start with start field
        emit("updateCoords", coords, "", "start");
      }
    }
  });
});

// // Watch for changes in coordinates to update markers
// watch(
//   () => [props.startCoords, props.destinationCoords],
//   ([newStart, newDest]) => {
//     // Clear existing markers
//     if (mapStore.startMarker) {
//       mapStore.startMarker.remove();
//     }
//     if (mapStore.endMarker) {
//       mapStore.endMarker.remove();
//     }

//     // Add new markers if coordinates exist
//     if (newStart) {
//       const [lng, lat] = newStart.split(",").map(Number);
//       mapStore.startMarker = L.marker([lat, lng], {
//         icon: L.divIcon({
//           className: "start-marker",
//           html: `<div style="color: #00B4D8; font-size: 24px;"><i class="mdi mdi-map-marker-radius"></i></div>`,
//           iconSize: [24, 24],
//           iconAnchor: [12, 24],
//         }),
//       })
//         .addTo(mapStore.mapInstance)
//         .bindTooltip("Start");
//     }

//     if (newDest) {
//       const [lng, lat] = newDest.split(",").map(Number);
//       mapStore.endMarker = L.marker([lat, lng], {
//         icon: L.divIcon({
//           className: "end-marker",
//           html: `<div style="color: #03045E; font-size: 24px;"><i class="mdi mdi-map-marker"></i></div>`,
//           iconSize: [26, 26],
//           iconAnchor: [12, 24],
//         }),
//       })
//         .addTo(mapStore.mapInstance)
//         .bindTooltip("Destination");
//     }
//   },
//   { immediate: true }
// );
</script>

<template>
  <div ref="mapContainer" style="height: 100%; width: 100%"></div>
</template>
