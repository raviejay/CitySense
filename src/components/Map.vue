<script setup>
import { ref, onMounted, defineEmits } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRoutes } from "@/composables/useRoutes";
import { useMapStore } from "@/stores/mapStore";

const maptilerApiKey = "SBAyjg2QZffT0exJjurD"; // ✅ Replace with your actual API key

const mapStore = useMapStore();
const mapContainer = ref(null);
const clickCount = ref(0);
const startCoords = ref("");
const destinationCoords = ref("");
const emit = defineEmits(["updateCoords"]);

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

  // ✅ Use Positron style from MapTiler
  L.tileLayer(
    `https://api.maptiler.com/maps/positron/{z}/{x}/{y}.png?key=${maptilerApiKey}`,
    {
      attribution:
        '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
      tileSize: 512,
      zoomOffset: -1,
    }
  ).addTo(map);

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
  emit("updateCoords", startCoords.value, destinationCoords.value);
};
</script>

<template>
  <div ref="mapContainer" style="height: 100%; width: 100%"></div>
</template>
