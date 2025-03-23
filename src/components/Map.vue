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
  const map = L.map(mapContainer.value).setView([8.9464, 125.4792], 14);
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
