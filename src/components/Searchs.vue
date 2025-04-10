<script setup>
import { ref, watch } from "vue";
import { useRoutes } from "@/composables/useRoutes";
import { useMapStore } from "@/stores/mapStore";
import KartaViewViewer from "./KartaView.vue"; // Import the new component
import MapillaryViewer from "./MapillaryView.vue";
import ImprovedMapillaryViewer from "./ImprovedMapillaryViewer.vue";

const mapStore = useMapStore(); // Access the store
const bestRoute = ref(null);
const loading = ref(false);
const routeOptions = ref([]);
const selectedRouteIndex = ref(0);

const { findBestRoute } = useRoutes();

// Props for start and destination coordinates
const props = defineProps({
  startCoords: String,
  destinationCoords: String,
});

// Reactive fields for displaying coordinates
const userStart = ref(props.startCoords);
const userDestination = ref(props.destinationCoords);

// Watch for changes in props to update fields dynamically
watch(
  () => props.startCoords,
  (newVal) => {
    userStart.value = newVal;
  }
);

watch(
  () => props.destinationCoords,
  (newVal) => {
    userDestination.value = newVal;
  }
);

// Add these to your reactive state variables in the setup script
const showStreetView = ref(false);
const streetViewCoords = ref(null);

// Add this function to handle opening the street view
const openMapillary = (coordinates) => {
  streetViewCoords.value = coordinates;
  showStreetView.value = true;
};

const startMarker = ref(null);
const endMarker = ref(null);
const allPolylines = ref([]);

const clearMapObjects = () => {
  console.log(
    "Clearing map objects. Polylines count:",
    allPolylines.value.length
  );

  if (startMarker.value) {
    startMarker.value.remove();
    startMarker.value = null;
  }
  if (endMarker.value) {
    endMarker.value.remove();
    endMarker.value = null;
  }

  // Remove polylines with explicit checking
  allPolylines.value.forEach((polyline, index) => {
    if (polyline && typeof polyline.remove === "function") {
      polyline.remove();
      console.log(`Removed polyline ${index}`);
    } else {
      console.warn(`Failed to remove polyline ${index}:`, polyline);
    }
  });

  // Also try to remove any polylines directly from the map as a fallback
  if (mapStore.mapInstance) {
    mapStore.mapInstance.eachLayer((layer) => {
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        mapStore.mapInstance.removeLayer(layer);
        console.log("Removed a polyline layer directly from map");
      }
    });
  }

  allPolylines.value = [];
};

const handleFindBestRoute = async () => {
  console.log(
    "Finding best route from:",
    userStart.value,
    "to:",
    userDestination.value
  );

  loading.value = true;
  try {
    clearMapObjects();

    const result = await findBestRoute(
      props.startCoords,
      props.destinationCoords,
      mapStore.mapInstance
    );

    if (result) {
      bestRoute.value = result;
      routeOptions.value = result.allOptions || [];
      selectedRouteIndex.value = 0;
      console.log("Best route found:", bestRoute.value);

      if (result.directRoute && result.directRoute.polyline) {
        allPolylines.value.push(result.directRoute.polyline);
      }

      createMarkers(
        result.directRoute.startCoords ||
          props.startCoords.split(",").map(Number),
        result.directRoute.endCoords ||
          props.destinationCoords.split(",").map(Number)
      );
    } else {
      bestRoute.value = null;
      routeOptions.value = [];
    }
  } catch (error) {
    console.error("Error finding the best route:", error);
    bestRoute.value = null;
  } finally {
    loading.value = false;
  }
};

// Get transportation icon based on mode
const getTransportIcon = (mode) => {
  switch (mode) {
    case "PUJ":
      return "mdi-bus";
    case "Tricycle":
      return "mdi-motorbike";
    case "Walk":
      return "mdi-walk";
    default:
      return "mdi-map-marker";
  }
};

// Format distance
const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${meters.toFixed(0)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

// Format time in minutes to readable format
const formatTime = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
};

// Modified createMarkers function
const createMarkers = (start, end) => {
  // Create new markers
  startMarker.value = L.marker([start[1], start[0]], {
    icon: L.divIcon({
      className: "start-marker",
      html: '<div style="background-color:#33cc33;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
      iconSize: [12, 12],
    }),
  })
    .addTo(mapStore.mapInstance)
    .bindTooltip("Start");

  endMarker.value = L.marker([end[1], end[0]], {
    icon: L.divIcon({
      className: "end-marker",
      html: '<div style="background-color:#ff3333;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
      iconSize: [12, 12],
    }),
  })
    .addTo(mapStore.mapInstance)
    .bindTooltip("Destination (Click for Street View)")
    .on("click", () => openMapillary(end));
};
</script>

<template>
  <v-container class="mb-12">
    <v-text-field
      label="Start Location (lng,lat)"
      v-model="userStart"
      readonly
    ></v-text-field>
    <v-text-field
      label="Destination Location (lng,lat)"
      v-model="userDestination"
      readonly
    ></v-text-field>
    <v-btn @click="handleFindBestRoute" color="primary" :loading="loading">
      Find Best Route
    </v-btn>

    <v-card v-if="bestRoute" class="pa-4 mt-4">
      <v-card-title class="d-flex justify-space-between align-center">
        <div>{{ bestRoute.name }}</div>
        <v-chip color="primary">₱{{ bestRoute.totalFare }}</v-chip>
      </v-card-title>

      <v-card-subtitle>
        {{ formatDistance(bestRoute.totalDistance) }} •
        {{ formatTime(bestRoute.estimatedTime) }}
      </v-card-subtitle>

      <v-divider class="my-3"></v-divider>

      <!-- Route steps -->
      <div class="route-steps">
        <template v-for="(step, index) in bestRoute.steps" :key="index">
          <!-- Show transfer step if not first step -->
          <div
            v-if="
              index > 0 &&
              bestRoute.transferPoints &&
              bestRoute.transferPoints[index - 1]
            "
            class="step transfer-step"
          >
            <div class="step-icon">
              <v-icon color="green">mdi-walk</v-icon>
            </div>
            <div class="step-content">
              <div class="step-header">
                <strong>Walk</strong>
                <span class="ml-auto">
                  {{
                    formatDistance(bestRoute.transferPoints[index - 1].distance)
                  }}
                </span>
              </div>
              <div class="step-details">
                Transfer between routes (about
                {{
                  Math.round(bestRoute.transferPoints[index - 1].distance / 80)
                }}
                min walk)
              </div>
            </div>
          </div>

          <!-- Transportation step -->
          <div class="step">
            <div class="step-icon">
              <v-icon :color="step.mode === 'Walk' ? 'green' : 'primary'">
                {{ getTransportIcon(step.mode) }}
              </v-icon>
            </div>
            <div class="step-content">
              <div class="step-header">
                <strong>{{ step.mode }}</strong>
                <span v-if="step.routeName" class="ml-2"
                  >({{ step.routeName }})</span
                >
                <span class="ml-auto">{{ formatDistance(step.distance) }}</span>
              </div>
              <div class="step-details">
                {{
                  step.description ||
                  `Take ${step.mode} for about ${Math.round(
                    step.distance / (step.mode === "PUJ" ? 333 : 250)
                  )} minutes`
                }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <v-divider class="my-3"></v-divider>

      <v-card-actions>
        <v-row>
          <v-col cols="6">
            <div class="text-caption">Total Distance</div>
            <div class="text-body-1">
              {{ formatDistance(bestRoute.totalDistance) }}
            </div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption">Total Fare</div>
            <div class="text-body-1">₱{{ bestRoute.totalFare }}</div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption">Est. Travel Time</div>
            <div class="text-body-1">
              {{ formatTime(bestRoute.estimatedTime) }}
            </div>
          </v-col>
        </v-row>
      </v-card-actions>
    </v-card>

    <v-card
      v-else-if="loading"
      class="pa-4 mt-4 d-flex justify-center align-center"
    >
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
      <span class="ml-3">Finding best routes...</span>
    </v-card>

    <v-card v-else class="pa-4 mt-4">
      <div class="text-center">
        No route found. Click 'Find Best Route' to search for routes.
      </div>
    </v-card>
    <ImprovedMapillaryViewer
      v-model:visible="showStreetView"
      :coordinates="streetViewCoords"
      @close="showStreetView = false"
    />
  </v-container>
</template>

<style scoped>
.route-steps {
  padding: 8px 0;
}

.step {
  display: flex;
  padding: 8px 0;
}

.step-icon {
  margin-right: 16px;
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.step-content {
  flex: 1;
}

.step-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.step-details {
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.875rem;
}

.line {
  height: 2px;
  background-color: black;
  width: 100px;
}
</style>
