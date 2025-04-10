<script setup>
import { ref, watch, computed } from "vue";

const props = defineProps({
  /**
   * Coordinates in [longitude, latitude] format
   */
  coordinates: {
    type: Array,
    default: () => null,
  },
  /**
   * Controls whether the street view is visible
   */
  visible: {
    type: Boolean,
    default: false,
  },
  /**
   * Initial zoom level for Mapillary (between 1-20)
   */
  zoom: {
    type: Number,
    default: 14,
  },
});

const emit = defineEmits(["close", "update:visible"]);

// Internal state to handle the dialog
const showViewer = ref(props.visible);

// Watch for external visibility changes
watch(
  () => props.visible,
  (newValue) => {
    showViewer.value = newValue;
  }
);

// Watch for internal visibility changes
watch(showViewer, (newValue) => {
  emit("update:visible", newValue);
});

// Computed property for the Mapillary URL
const mapillaryUrl = computed(() => {
  if (!props.coordinates || props.coordinates.length !== 2) return "";

  // Mapillary expects coordinates in lat,lon format but our app uses lon,lat
  const lat = props.coordinates[1];
  const lon = props.coordinates[0];

  // Construct the Mapillary URL
  return `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=${props.zoom}`;
});

// Handle close button click
const handleClose = () => {
  showViewer.value = false;
  emit("close");
};

// Handle "Open in new tab" button click
const openInNewTab = () => {
  if (mapillaryUrl.value) {
    window.open(mapillaryUrl.value, "_blank");
  }
};
</script>

<template>
  <v-dialog v-model="showViewer" max-width="1000px" persistent>
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>Mapillary Street View</span>
        <v-btn icon="mdi-close" variant="text" @click="handleClose"></v-btn>
      </v-card-title>

      <v-card-text class="pa-0">
        <div
          v-if="!coordinates || coordinates.length !== 2"
          class="pa-4 text-center"
        >
          No coordinates available for street view.
        </div>
        <iframe
          v-else
          :src="mapillaryUrl"
          width="100%"
          height="500px"
          frameborder="0"
          loading="lazy"
          allow="fullscreen"
          referrerpolicy="no-referrer-when-downgrade"
          class="mapillary-iframe"
        ></iframe>
      </v-card-text>

      <v-card-actions>
        <v-row>
          <v-col cols="6">
            <v-btn color="primary" block @click="handleClose">
              Close Street View
            </v-btn>
          </v-col>
          <v-col cols="6">
            <v-btn
              color="secondary"
              block
              @click="openInNewTab"
              :disabled="!mapillaryUrl"
            >
              Open in New Tab
            </v-btn>
          </v-col>
        </v-row>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.mapillary-iframe {
  border: none;
  border-radius: 0;
  display: block;
}
</style>
