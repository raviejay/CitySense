<script setup>
import { onMounted, ref } from "vue";
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
let mapInstance = null;

onMounted(async () => {
  if (!mapContainer.value || !props.coordinates.length) return;

  const firstCoord = props.coordinates[0];
  mapInstance = L.map(mapContainer.value).setView(
    [firstCoord[1], firstCoord[0]],
    13
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(mapInstance);

  await drawCalculatedRoute(mapInstance, props.coordinates);
});
</script>

<template>
  <div ref="mapContainer" style="height: 200px; width: 100%"></div>
</template>
