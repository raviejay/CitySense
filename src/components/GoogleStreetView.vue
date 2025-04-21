<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  coordinates: {
    type: Array,
    default: () => null,
  },
  visible: {
    type: Boolean,
    default: false,
  },
  zoom: {
    type: Number,
    default: 17,
  },
  apiKey: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["close", "update:visible"]);

const showViewer = ref(props.visible);
const streetViewUrl = ref("");
const isLoading = ref(true);
const hasError = ref(false);

watch(
  () => props.visible,
  (newValue) => {
    showViewer.value = newValue;
    if (newValue) {
      hasError.value = false;
      isLoading.value = true;
    }
  }
);

watch(showViewer, (newValue) => {
  emit("update:visible", newValue);
});

watch(
  () => props.coordinates,
  (newCoords) => {
    if (newCoords && newCoords.length === 2) {
      hasError.value = false;
      isLoading.value = true;

      const lon = parseFloat(newCoords[0]);
      const lat = parseFloat(newCoords[1]);

      if (!isNaN(lon) && !isNaN(lat)) {
        streetViewUrl.value = `https://www.google.com/maps/embed/v1/streetview?key=${props.apiKey}&location=${lat},${lon}&heading=0&pitch=0&fov=90`;
      } else {
        hasError.value = true;
      }
    } else {
      hasError.value = true;
    }
  },
  { immediate: true }
);

const handleClose = () => {
  showViewer.value = false;
  emit("close");
};

const handleIframeLoad = () => {
  isLoading.value = false;
};

const handleIframeError = () => {
  isLoading.value = false;
  hasError.value = true;
};
</script>

<template>
  <v-dialog v-model="showViewer" fullscreen persistent>
    <v-card class="d-flex flex-column" style="height: 100vh">
      <v-card-title class="d-flex justify-space-between align-center pa-4">
        <span class="text-h5">Street View</span>
        <v-btn icon="mdi-close" variant="text" @click="handleClose"></v-btn>
      </v-card-title>

      <v-card-text class="pa-0 position-relative flex-grow-1">
        <div
          v-if="isLoading"
          class="d-flex flex-column justify-center align-center"
          style="height: 100%"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="64"
          ></v-progress-circular>
          <div class="mt-4 text-h6">Loading street view...</div>
        </div>

        <div
          v-if="hasError || !coordinates || coordinates.length !== 2"
          class="d-flex justify-center align-center"
          style="height: 100%"
        >
          <v-alert type="error" variant="tonal" class="ma-4">
            Unable to load street view for these coordinates. The location might
            not have street view coverage.
          </v-alert>
        </div>

        <iframe
          v-if="coordinates && coordinates.length === 2 && !hasError"
          :src="streetViewUrl"
          width="100%"
          height="100%"
          frameborder="0"
          loading="lazy"
          @load="handleIframeLoad"
          @error="handleIframeError"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
          class="streetview-iframe"
        ></iframe>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-btn color="primary" block size="large" @click="handleClose">
          Close Street View
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.streetview-iframe {
  border: none;
  border-radius: 0;
  display: block;
  min-height: 100%;
}
.position-relative {
  position: relative;
}
</style>
