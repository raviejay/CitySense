<script setup>
import { onMounted, ref, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRoutes } from "@/composables/useRoutes";

const props = defineProps({
  coordinates: {
    type: Array,
    required: true,
  },
});

const { drawCalculatedRoute } = useRoutes();
const mapContainer = ref(null);
const mapInstance = ref(null);
const routePolyline = ref(null);
const startMarker = ref(null);
const endMarker = ref(null);

// Custom icons for markers
const createCustomIcon = (color) => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="background-color:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);display:flex;justify-content:center;align-items:center;">
        <div style="width:8px;height:8px;background-color:white;border-radius:50%;"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Clear existing markers and polyline
const clearMap = () => {
  if (startMarker.value) {
    mapInstance.value.removeLayer(startMarker.value);
    startMarker.value = null;
  }
  if (endMarker.value) {
    mapInstance.value.removeLayer(endMarker.value);
    endMarker.value = null;
  }
  if (routePolyline.value) {
    mapInstance.value.removeLayer(routePolyline.value);
    routePolyline.value = null;
  }
};

// Draw the route with markers
const drawRoute = async () => {
  if (!mapInstance.value || !props.coordinates.length) return;

  clearMap();

  // Draw the route
  routePolyline.value = await drawCalculatedRoute(
    mapInstance.value,
    props.coordinates
  );

  // Add start and end markers
  if (props.coordinates.length > 0) {
    const startCoords = props.coordinates[0];
    const endCoords = props.coordinates[props.coordinates.length - 1];

    // Start marker (blue)
    startMarker.value = L.marker([startCoords[1], startCoords[0]], {
      icon: createCustomIcon("#00b4d8"),
    })
      .addTo(mapInstance.value)
      .bindTooltip("Start Point", { permanent: false, direction: "top" });

    // End marker (red)
    endMarker.value = L.marker([endCoords[1], endCoords[0]], {
      icon: createCustomIcon("#e63946"),
    })
      .addTo(mapInstance.value)
      .bindTooltip("End Point", { permanent: false, direction: "top" });

    // Fit bounds to show entire route with padding
    const bounds = L.latLngBounds(
      props.coordinates.map((coord) => [coord[1], coord[0]])
    );
    mapInstance.value.fitBounds(bounds, { padding: [50, 50] });
  }
};

// Initialize map
onMounted(async () => {
  if (!mapContainer.value || !props.coordinates.length) return;

  const firstCoord = props.coordinates[0];
  mapInstance.value = L.map(mapContainer.value).setView(
    [firstCoord[1], firstCoord[0]],
    13
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(mapInstance.value);

  await drawRoute();
});

// Watch for coordinates changes
watch(
  () => props.coordinates,
  async () => {
    if (mapInstance.value) {
      await drawRoute();
    }
  },
  { deep: true }
);
</script>

<template>
  <div ref="mapContainer" class="map-preview-container"></div>
</template>

<style scoped>
.map-preview-container {
  height: 100%;
  width: 100%;
}

/* Style for custom markers */
:deep(.custom-marker) {
  transition: transform 0.2s;
}

:deep(.custom-marker:hover) {
  transform: scale(1.2);
}
</style>
