<script setup>
import { ref, onMounted, defineEmits } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRoutes } from "@/composables/useRoutes";
import { useMapStore } from "@/stores/mapStore";

const mapStore = useMapStore();
const mapContainer = ref(null);
const clickCount = ref(0);
const startCoords = ref("");
const destinationCoords = ref("");
const emit = defineEmits(["updateCoords"]);

const { loadRoutes } = useRoutes();

// Initialize the map
onMounted(() => {
  // Define Butuan City boundaries (southwest and northeast corners)
  // Added some padding to make sure the entire city is visible
  const southWest = L.latLng(8.8464, 125.3792);
  const northEast = L.latLng(9.0464, 125.5792);
  const bounds = L.latLngBounds(southWest, northEast);

  // Create map with restrictions
  const map = L.map(mapContainer.value, {
    center: [8.946048723670792, 125.54603354770742],
    zoom: 14,
    maxBounds: bounds.pad(0.4), // Add padding to bounds to allow dragging to edges
    minZoom: 12, // Restrict zooming out beyond this level
    maxZoom: 18, // Optional: restrict maximum zoom in level
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Store map in Pinia
  mapStore.setMapInstance(map);

  loadRoutes(map);
  map.on("click", onMapClick);
});

// Handle map clicks to set start/destination
const onMapClick = (event) => {
  const { lat, lng } = event.latlng;
  if (clickCount.value === 0) {
    startCoords.value = `${lng}, ${lat}`;
  } else {
    destinationCoords.value = `${lng}, ${lat}`;
  }
  clickCount.value = (clickCount.value + 1) % 2;

  // Send updated coordinates to the parent
  emit("updateCoords", startCoords.value, destinationCoords.value);
};
</script>

<template>
  <div ref="mapContainer" style="height: 100%; width: 100%"></div>
</template>
