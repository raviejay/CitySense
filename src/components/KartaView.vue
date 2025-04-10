<script setup>
import { ref, watch } from "vue";

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
   * Initial zoom level for KartaView (between 1-22)
   */
  zoom: {
    type: Number,
    default: 17,
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

// Computed property for the KartaView URL
const kartaViewUrl = ref("");

// Update the KartaView URL when coordinates change
watch(
  () => props.coordinates,
  (newCoords) => {
    if (newCoords && newCoords.length === 2) {
      // KartaView expects coordinates in lat,lon format but our app uses lon,lat
      const lat = newCoords[1];
      const lon = newCoords[0];
      kartaViewUrl.value = `https://kartaview.org/embed/@${lat},${lon},${props.zoom}z`;
    }
  },
  { immediate: true }
);

// Handle close button click
const handleClose = () => {
  showViewer.value = false;
  emit("close");
};
</script>

<template>
  <v-dialog v-model="showViewer" max-width="1000px" persistent>
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>Street View</span>
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
          :src="kartaViewUrl"
          width="100%"
          height="500px"
          frameborder="0"
          loading="lazy"
          allow="fullscreen"
          referrerpolicy="no-referrer-when-downgrade"
          class="kartaview-iframe"
        ></iframe>
      </v-card-text>

      <v-card-actions>
        <v-btn color="primary" block @click="handleClose">
          Close Street View
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.kartaview-iframe {
  border: none;
  border-radius: 0;
  display: block;
}
</style>
