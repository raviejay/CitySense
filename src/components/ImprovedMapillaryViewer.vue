<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";

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
   * Initial zoom level (0-2 for Mapillary viewer)
   */
  zoom: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["close", "update:visible"]);

// Internal state to handle the dialog
const showViewer = ref(props.visible);
const viewerContainer = ref(null);
let mapillaryViewer = null;

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

// Watch for coordinates changes to update the viewer
watch(
  () => props.coordinates,
  (newCoords) => {
    if (
      newCoords &&
      newCoords.length === 2 &&
      mapillaryViewer &&
      showViewer.value
    ) {
      updateViewerLocation(newCoords);
    }
  }
);

// Watch for dialog visibility to initialize or clean up the viewer
watch(showViewer, (newValue) => {
  if (newValue && props.coordinates && props.coordinates.length === 2) {
    // Wait for the dialog to be visible in the DOM
    setTimeout(() => {
      initializeViewer();
    }, 300);
  } else if (!newValue && mapillaryViewer) {
    // Clean up the viewer when the dialog is closed
    mapillaryViewer = null;
  }
});

// Initialize the Mapillary viewer
const initializeViewer = async () => {
  if (!viewerContainer.value || !props.coordinates) return;

  // Only initialize if we don't already have a viewer
  if (!mapillaryViewer) {
    try {
      // Load the Mapillary API dynamically
      if (!window.mapillary) {
        await loadMapillaryAPI();
      }

      // Create the viewer
      mapillaryViewer = new window.mapillary.Viewer({
        container: viewerContainer.value,
        accessToken: "MLY|7711969938845347|24f04300e9a9714d5e9ca7cc86421215", // Public demo token
        component: { cover: false },
      });

      // Add event listener for when the viewer is ready
      mapillaryViewer.on("load", () => {
        updateViewerLocation(props.coordinates);
      });
    } catch (error) {
      console.error("Failed to initialize Mapillary viewer:", error);
    }
  } else {
    updateViewerLocation(props.coordinates);
  }
};

// Update the viewer's location
const updateViewerLocation = (coordinates) => {
  if (!mapillaryViewer) return;

  // Mapillary expects lat, lon but our app uses lon, lat
  const lat = coordinates[1];
  const lon = coordinates[0];

  // Move to the closest image to these coordinates
  mapillaryViewer.moveTo("closeTo", { lat, lon }).catch((error) => {
    console.error("Failed to move to location:", error);
  });
};

// Load the Mapillary API script
const loadMapillaryAPI = () => {
  return new Promise((resolve, reject) => {
    if (window.mapillary) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/mapillary-js@4.1.0/dist/mapillary.min.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);

    // Also load the CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/mapillary-js@4.1.0/dist/mapillary.min.css";
    document.head.appendChild(link);
  });
};

// Handle close button click
const handleClose = () => {
  showViewer.value = false;
  emit("close");
};

// Open in Mapillary website
const openInMapillary = () => {
  if (props.coordinates && props.coordinates.length === 2) {
    const lat = props.coordinates[1];
    const lon = props.coordinates[0];
    window.open(
      `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=17`,
      "_blank"
    );
  }
};

// Clean up on component unmount
onUnmounted(() => {
  if (mapillaryViewer) {
    mapillaryViewer = null;
  }
});
</script>

<template>
  <v-dialog v-model="showViewer" max-width="1000px" persistent>
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>Street View (Mapillary)</span>
        <v-btn icon="mdi-close" variant="text" @click="handleClose"></v-btn>
      </v-card-title>

      <v-card-text class="pa-0">
        <div
          v-if="!coordinates || coordinates.length !== 2"
          class="pa-4 text-center"
        >
          No coordinates available for street view.
        </div>
        <div v-else>
          <div ref="viewerContainer" class="mapillary-viewer"></div>
          <div
            v-if="viewerContainer && !mapillaryViewer"
            class="loading-overlay"
          >
            <v-progress-circular
              indeterminate
              color="primary"
            ></v-progress-circular>
            <div class="mt-2">Loading street view...</div>
          </div>
        </div>
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
              @click="openInMapillary"
              :disabled="!coordinates || coordinates.length !== 2"
            >
              Open in Mapillary
            </v-btn>
          </v-col>
        </v-row>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.mapillary-viewer {
  width: 100%;
  height: 500px;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.7);
  z-index: 10;
}
</style>
