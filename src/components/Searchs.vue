<script setup>
import { ref, watch, computed } from "vue";
import { butuanEstablishments } from "@/data/butuanEstablishment";
import { useRoutes } from "@/composables/useRoutes";
import { useMapStore } from "@/stores/mapStore";
import GoogleStreetView from "./GoogleStreetView.vue";

const mapStore = useMapStore();
const bestRoute = ref(null);
const loading = ref(false);
const routeOptions = ref([]);
const selectedRouteIndex = ref(0);
const googleMapsApiKey = "AIzaSyDXcJ66_US3pJQesji2iK7aIYHCW0gsEa4";
const { findBestRoute, formatRouteName } = useRoutes();
const expanded = ref(false);
const activeTab = ref("suggested");
const emit = defineEmits(["updateCoords"]);

// Search functionality
const searchQueryStart = ref("");
const searchQueryDestination = ref("");
const startSuggestions = ref([]);
const destinationSuggestions = ref([]);
const showStartSuggestions = ref(false);
const showDestinationSuggestions = ref(false);

// Track which field is active for map clicks
const activeInputField = ref(null); // 'start' or 'destination'

const props = defineProps({
  startCoords: String,
  destinationCoords: String,
});

const userStart = ref(props.startCoords);
const userDestination = ref(props.destinationCoords);

watch(
  [() => props.startCoords, () => props.destinationCoords],
  ([newStart, newDest]) => {
    if (newStart) {
      userStart.value = newStart;
      // Find establishment name if coordinates match
      const startEst = butuanEstablishments.find((est) => {
        const [lat, lng] = est.coords.split(",").map((c) => c.trim());
        return `${lng}, ${lat}` === newStart;
      });
      searchQueryStart.value = startEst
        ? startEst.name
        : formatPlaceName(newStart);
    }
    if (newDest) {
      userDestination.value = newDest;
      // Find establishment name if coordinates match
      const destEst = butuanEstablishments.find((est) => {
        const [lat, lng] = est.coords.split(",").map((c) => c.trim());
        return `${lng}, ${lat}` === newDest;
      });
      searchQueryDestination.value = destEst
        ? destEst.name
        : formatPlaceName(newDest);
    }
  }
);

// Watch for changes in search queries
watch(searchQueryStart, (newQuery) => {
  if (!newQuery) {
    userStart.value = "";
    emit("updateCoords", "", userDestination.value);
  }
});

watch(searchQueryDestination, (newQuery) => {
  if (!newQuery) {
    userDestination.value = "";
    emit("updateCoords", userStart.value, "");
  }
});

const searchEstablishments = (query, type) => {
  if (!query) {
    if (type === "start") {
      startSuggestions.value = [];
      showStartSuggestions.value = false;
    } else {
      destinationSuggestions.value = [];
      showDestinationSuggestions.value = false;
    }
    return;
  }

  const results = butuanEstablishments.filter((est) =>
    est.name.toLowerCase().includes(query.toLowerCase())
  );

  if (type === "start") {
    startSuggestions.value = results;
    showStartSuggestions.value = results.length > 0;
  } else {
    destinationSuggestions.value = results;
    showDestinationSuggestions.value = results.length > 0;
  }
};

const selectEstablishment = (est, type) => {
  const [lat, lng] = est.coords.split(",").map((coord) => coord.trim());
  const coords = `${lng}, ${lat}`;

  if (type === "start") {
    userStart.value = coords;
    searchQueryStart.value = est.name;
    showStartSuggestions.value = false;
    emit("updateCoords", coords, props.destinationCoords || "");
  } else {
    userDestination.value = coords;
    searchQueryDestination.value = est.name;
    showDestinationSuggestions.value = false;
    emit("updateCoords", props.startCoords || "", coords);
  }
  activeInputField.value = null; // Reset active field after selection
};

const clearInput = (type) => {
  if (type === "start") {
    userStart.value = "";
    searchQueryStart.value = "";
    emit("updateCoords", "", props.destinationCoords);
  } else {
    userDestination.value = "";
    searchQueryDestination.value = "";
    emit("updateCoords", props.startCoords, "");
  }
};

const onFocusInput = (type) => {
  activeInputField.value = type;
  if (type === "start") {
    showStartSuggestions.value = true;
    if (searchQueryStart.value) {
      searchEstablishments(searchQueryStart.value, "start");
    }
  } else {
    showDestinationSuggestions.value = true;
    if (searchQueryDestination.value) {
      searchEstablishments(searchQueryDestination.value, "destination");
    }
  }
};

const onBlurStartInput = () => {
  setTimeout(() => {
    if (!showStartSuggestions.value) return;
    showStartSuggestions.value = false;
    activeInputField.value = null;
  }, 300);
};

const onBlurDestinationInput = () => {
  setTimeout(() => {
    if (!showDestinationSuggestions.value) return;
    showDestinationSuggestions.value = false;
    activeInputField.value = null;
  }, 300);
};

// Street view functionality
const showStreetView = ref(false);
const streetViewCoords = ref(null);

const GoogleStreet = (coordinates) => {
  streetViewCoords.value = coordinates;
  showStreetView.value = true;
};

const startMarker = ref(null);
const endMarker = ref(null);
const allPolylines = ref([]);

const clearMapObjects = () => {
  if (startMarker.value) {
    startMarker.value.remove();
    startMarker.value = null;
  }
  if (endMarker.value) {
    endMarker.value.remove();
    endMarker.value = null;
  }

  allPolylines.value.forEach((polyline) => {
    if (polyline && typeof polyline.remove === "function") {
      polyline.remove();
    }
  });

  if (mapStore.mapInstance) {
    mapStore.mapInstance.eachLayer((layer) => {
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        mapStore.mapInstance.removeLayer(layer);
      }
    });
  }

  allPolylines.value = [];
};

const handleFindBestRoute = async () => {
  loading.value = true;
  try {
    clearMapObjects();

    const result = await findBestRoute(
      userStart.value,
      userDestination.value,
      mapStore.mapInstance
    );

    if (result) {
      bestRoute.value = result;
      routeOptions.value = result.allOptions || [];
      selectedRouteIndex.value = 0;
      expanded.value = true;

      if (result.directRoute && result.directRoute.polyline) {
        allPolylines.value.push(result.directRoute.polyline);
      }

      createMarkers(
        result.directRoute.startCoords ||
          (userStart.value ? userStart.value.split(",").map(Number) : [0, 0]),
        result.directRoute.endCoords ||
          (userDestination.value
            ? userDestination.value.split(",").map(Number)
            : [0, 0])
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

const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${meters.toFixed(0)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

const formatTime = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
};

const formatPlaceName = (coords) => {
  if (!coords) return "Selected location";
  return coords
    .split(",")
    .map((n) => parseFloat(n).toFixed(5))
    .join(", ");
};

const createMarkers = (start, end) => {
  startMarker.value = L.marker([start[1], start[0]], {
    icon: L.divIcon({
      className: "start-marker",
      html: '<div style="background-color:#00B4D8;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
      iconSize: [12, 12],
    }),
  })
    .addTo(mapStore.mapInstance)
    .bindTooltip("Start");

  endMarker.value = L.marker([end[1], end[0]], {
    icon: L.divIcon({
      className: "end-marker",
      html: '<div style="background-color:#03045E;width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>',
      iconSize: [12, 12],
    }),
  })
    .addTo(mapStore.mapInstance)
    .bindTooltip("Destination (Click for Street View)")
    .on("click", () => GoogleStreet(end));
};

const panelHeight = computed(() => {
  if (!expanded.value) {
    return "auto";
  }
  return bestRoute.value ? "70vh" : "auto";
});

const toggleExpanded = () => {
  expanded.value = !expanded.value;
};

const changeTab = (tab) => {
  activeTab.value = tab;
};

const alternativeRoute = computed(() => {
  if (!bestRoute.value) return null;
  return {
    ...bestRoute.value,
    name: "Tricycle Route",
    mode: "Tricycle",
    totalFare: (bestRoute.value.totalFare * 1.5).toFixed(0),
    totalDistance: bestRoute.value.totalDistance * 0.9,
    estimatedTime: bestRoute.value.estimatedTime * 0.75,
    routeName: "Direct",
  };
});

const currentRoute = computed(() => {
  if (activeTab.value === "suggested") {
    return bestRoute.value;
  } else {
    return alternativeRoute.value;
  }
});
</script>

<template>
  <v-sheet
    class="route-search-panel mb-10"
    :class="{ 'panel-expanded': expanded }"
    :style="{ maxHeight: panelHeight }"
    rounded="t-lg"
    elevation="10"
  >
    <div class="drag-handle" @click="toggleExpanded">
      <div class="handle-bar"></div>
    </div>

    <v-container class="pa-4 pt-0">
      <v-sheet class="location-inputs mb-4" rounded elevation="1">
        <v-row no-gutters class="p-2">
          <v-col
            cols="1"
            class="d-flex flex-column justify-space-between align-center py-2"
          >
            <v-icon color="#00B4D8" size="small">mdi-circle</v-icon>
            <v-divider vertical class="mx-auto my-1"></v-divider>
            <v-icon color="#00B4D8" size="small">mdi-transit-connection</v-icon>
            <v-divider vertical class="mx-auto my-1"></v-divider>
            <v-icon color="#03045E">mdi-map-marker</v-icon>
          </v-col>
          <v-col>
            <!-- Start Location Input -->
            <div class="position-relative search-container">
              <v-text-field
                variant="plain"
                density="compact"
                hide-details
                class="location-input"
                placeholder="Choose starting point or click map"
                v-model="searchQueryStart"
                @input="searchEstablishments(searchQueryStart, 'start')"
                @focus="onFocusInput('start')"
                @blur="onBlurStartInput"
              >
                <template v-slot:append-inner>
                  <v-icon
                    v-if="searchQueryStart"
                    size="small"
                    color="#03045E"
                    @click="clearInput('start')"
                  >
                    mdi-close-circle
                  </v-icon>
                </template>
              </v-text-field>

              <v-list
                v-if="showStartSuggestions && startSuggestions.length > 0"
                class="suggestions-list start-suggestions"
                density="compact"
                elevation="4"
                rounded
              >
                <v-list-item
                  v-for="est in startSuggestions"
                  :key="est.name"
                  @click="selectEstablishment(est, 'start')"
                  @mousedown.prevent
                  class="suggestion-item"
                >
                  <v-list-item-title>{{ est.name }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </div>

            <v-divider class="my-3"></v-divider>

            <!-- Destination Input -->
            <div class="position-relative search-container">
              <v-text-field
                variant="plain"
                density="compact"
                hide-details
                class="location-input"
                placeholder="Choose destination or click map"
                v-model="searchQueryDestination"
                @input="
                  searchEstablishments(searchQueryDestination, 'destination')
                "
                @focus="onFocusInput('destination')"
                @blur="onBlurDestinationInput"
              >
                <template v-slot:append-inner>
                  <v-icon
                    v-if="searchQueryDestination"
                    size="small"
                    color="#03045E"
                    @click="clearInput('destination')"
                  >
                    mdi-close-circle
                  </v-icon>
                </template>
              </v-text-field>

              <v-list
                v-if="
                  showDestinationSuggestions &&
                  destinationSuggestions.length > 0
                "
                class="suggestions-list destination-suggestions"
                density="compact"
                elevation="4"
                rounded
              >
                <v-list-item
                  v-for="est in destinationSuggestions"
                  :key="est.name"
                  @click="selectEstablishment(est, 'destination')"
                  @mousedown.prevent
                  class="suggestion-item"
                >
                  <v-list-item-title>{{ est.name }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </div>
          </v-col>
        </v-row>
      </v-sheet>

      <!-- Find route button - adjusted margin to maintain proper spacing -->
      <v-btn
        block
        :color="'#00B4D8'"
        :loading="loading"
        class="find-route-btn mb-4"
        @click="handleFindBestRoute"
        rounded="lg"
      >
        <v-icon start>mdi-routes</v-icon>
        Find route
      </v-btn>

      <!-- Small route type tabs -->
      <div v-if="bestRoute" class="route-tabs-container mb-4">
        <div class="route-tabs">
          <span
            class="tab-option"
            :class="{ 'active-tab': activeTab === 'suggested' }"
            @click="changeTab('suggested')"
            style="color: #03045e"
          >
            Suggested route
          </span>
          <span
            class="tab-option"
            :class="{ 'active-tab': activeTab === 'alternative' }"
            @click="changeTab('alternative')"
            style="color: #03045e"
          >
            Alternative route
          </span>
        </div>
      </div>

      <v-sheet
        v-if="bestRoute && activeTab === 'suggested'"
        class="route-result"
        rounded
      >
        <v-list density="compact" class="route-list pa-0">
          <!-- Main route option -->

          <v-list-item :active="true" active-color="#00B4D8">
            <template v-slot:prepend>
              <v-avatar color="#CAF0EF" class="mr-2">
                <v-icon color="#03045E">mdi-transit-connection-variant</v-icon>
              </v-avatar>
            </template>

            <v-list-item-title
              class="d-flex align-center justify-space-between"
            >
              <span class="font-weight-medium">{{ bestRoute.name }}</span>
              <span class="font-weight-bold"> ₱{{ bestRoute.totalFare }} </span>
            </v-list-item-title>

            <v-list-item-subtitle class="d-flex justify-space-between">
              <span
                >{{ formatDistance(bestRoute.totalDistance) }} • Suggested
                Route</span
              >
              <span class="text-caption">{{
                formatTime(bestRoute.estimatedTime)
              }}</span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <!-- Route details when expanded -->
        <div v-if="expanded" class="route-details pa-4 mt-2">
          <v-text class="text-h10 font-weight-bold mb-2" style="color: #03045e">
            Route Details
          </v-text>

          <!-- Route steps -->
          <div class="route-steps">
            <template v-for="(step, index) in bestRoute.steps" :key="index">
              <!-- Transportation step -->
              <div class="step">
                <div class="step-icon">
                  <v-avatar size="32" color="#CAF0EF">
                    <v-icon
                      :color="step.mode === 'Walk' ? '#007786' : '#03045E'"
                    >
                      {{ getTransportIcon(step.mode) }}
                    </v-icon>
                  </v-avatar>
                </div>
                <div class="step-content">
                  <div class="step-header">
                    <strong style="color: #00b4d8">{{ step.mode }}</strong>
                    <span
                      v-if="step.routeName"
                      class="ml-2"
                      style="color: #00b4d8"
                      >({{ step.routeName }})</span
                    >
                    <span
                      class="ml-auto"
                      style="color: #00b4d8; font-weight: 500"
                    >
                      ₱{{ step.fare.toFixed(2) }}
                    </span>
                  </div>
                  <div class="step-details">
                    <span>
                      {{
                        step.description ||
                        `Take ${step.mode} for about ${Math.round(
                          step.distance / (step.mode === "PUJ" ? 333 : 250)
                        )} minutes`
                      }}
                    </span>
                    <span class="ml-auto" style="color: #00b4d8">
                      • ({{ formatDistance(step.distance) }})</span
                    >
                  </div>
                </div>
              </div>
            </template>
          </div>

          <v-divider class="my-3"></v-divider>

          <v-row class="route-summary">
            <!-- Total Distance - left align -->
            <v-col cols="4" class="d-flex flex-column">
              <v-text class="text-caption mb-1" style="color: #03045e">
                Total Distance
              </v-text>
              <v-text
                class="text-body-1 font-weight-medium"
                style="color: #00b4d8"
              >
                {{ formatDistance(bestRoute.totalDistance) }}
              </v-text>
            </v-col>

            <!-- Total Fare - center align -->
            <v-col cols="4" class="d-flex flex-column align-center">
              <v-text
                class="text-caption mb-1 text-center"
                style="color: #03045e"
              >
                Total Fare
              </v-text>
              <v-text
                class="text-body-1 font-weight-medium text-center"
                style="color: #00b4d8"
              >
                ₱{{ bestRoute.totalFare }}
              </v-text>
            </v-col>

            <!-- Est. Travel Time - right align -->
            <v-col cols="4" class="d-flex flex-column align-end">
              <v-text
                class="text-caption mb-1 text-right"
                style="color: #03045e"
              >
                Est. Travel Times
              </v-text>
              <v-text
                class="text-body-1 font-weight-medium text-right"
                style="color: #00b4d8"
              >
                {{ formatTime(bestRoute.estimatedTime) }}
              </v-text>
            </v-col>
          </v-row>
        </div>
      </v-sheet>

      <!-- Alternative route result -->
      <v-sheet
        v-if="bestRoute && activeTab === 'alternative'"
        class="route-result"
        rounded
      >
        <v-list density="compact" class="route-list pa-0">
          <template
            v-for="(route, index) in routeOptions.slice(1)"
            :key="index"
          >
            <v-text
              class="text-h10 font-weight-bold mb-2"
              style="color: #03045e"
            >
              Option {{ index + 1 }}
            </v-text>
            <v-list-item :active="true" active-color="#00B4D8">
              <template v-slot:prepend>
                <v-avatar color="#CAF0EF" class="mr-2">
                  <v-icon color="#03045E"
                    >mdi-transit-connection-variant</v-icon
                  >
                </v-avatar>
              </template>

              <v-list-item-title
                class="d-flex align-center justify-space-between"
              >
                <span class="font-weight-medium">{{
                  formatRouteName(route)
                }}</span>
                <span class="font-weight-bold"> ₱{{ route.totalFare }} </span>
              </v-list-item-title>

              <v-list-item-subtitle class="d-flex justify-space-between">
                <span
                  >{{ formatDistance(route.totalDistance) }} • Alternative
                  Route</span
                >
              </v-list-item-subtitle>
            </v-list-item>

            <!-- Route details when expanded -->
            <div v-if="expanded" class="route-details pa-4 mt-2">
              <div
                class="text-h10 font-weight-bold mb-2"
                style="color: #03045e"
              >
                Route Details
              </div>

              <!-- Route steps -->
              <div class="route-steps">
                <template
                  v-for="(step, stepIndex) in route.steps"
                  :key="stepIndex"
                >
                  <!-- Transportation step -->
                  <div class="step">
                    <div class="step-icon">
                      <v-avatar size="32" color="#CAF0EF">
                        <v-icon
                          :color="step.mode === 'Walk' ? '#007786' : '#03045E'"
                        >
                          {{ getTransportIcon(step.mode) }}
                        </v-icon>
                      </v-avatar>
                    </div>
                    <div class="step-content">
                      <div class="step-header">
                        <strong style="color: #00b4d8">{{ step.mode }}</strong>
                        <span
                          v-if="step.routeName"
                          class="ml-2"
                          style="color: #00b4d8"
                          >({{ step.routeName }})</span
                        >
                        <span
                          class="ml-auto"
                          style="color: #00b4d8; font-weight: 500"
                        >
                          ₱{{
                            step.fare?.toFixed(2) ||
                            stepFares[stepIndex]?.toFixed(2)
                          }}
                        </span>
                      </div>
                      <div class="step-details">
                        <span>
                          {{
                            step.description ||
                            `Take ${step.mode} for about ${Math.round(
                              step.distance / (step.mode === "PUJ" ? 333 : 250)
                            )} minutes`
                          }}
                        </span>
                        <span class="ml-auto" style="color: #00b4d8">
                          • ({{ formatDistance(step.distance) }})</span
                        >
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <v-divider class="my-3"></v-divider>

              <!-- <v-row class="route-summary">
               
                <v-col cols="4" class="d-flex flex-column">
                  <v-text class="text-caption mb-1" style="color: #03045e">
                    Total Distance
                  </v-text>
                  <v-text
                    class="text-body-1 font-weight-medium"
                    style="color: #00b4d8"
                  >
                    {{ formatDistance(route.totalDistance) }}
                  </v-text>
                </v-col>

                Total Fare - center align 
                <v-col cols="4" class="d-flex flex-column align-center">
                  <v-text
                    class="text-caption mb-1 text-center"
                    style="color: #03045e"
                  >
                    Total Fare
                  </v-text>
                  <v-text
                    class="text-body-1 font-weight-medium text-center"
                    style="color: #00b4d8"
                  >
                    ₱{{ route.totalFare }}
                  </v-text>
                </v-col>

                Est. Travel Time - right align
                <v-col cols="4" class="d-flex flex-column align-end">
                  <v-text
                    class="text-caption mb-1 text-right"
                    style="color: #03045e"
                  >
                    Est. Travel Times
                  </v-text>
                  <v-text
                    class="text-body-1 font-weight-medium text-right"
                    style="color: #00b4d8"
                  >
                    {{ formatTime(route.estimatedTime) }}
                  </v-text>
                </v-col> 
              </v-row> -->
            </div>
          </template>
        </v-list>
      </v-sheet>
    </v-container>

    <!-- Street View Component -->
    <GoogleStreetView
      v-model:visible="showStreetView"
      :coordinates="streetViewCoords"
      :api-key="googleMapsApiKey"
      @close="showStreetView = false"
    />
  </v-sheet>
</template>

<style scoped>
.route-search-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: #f5f7fa;
  border-top-left-radius: 20px !important;
  border-top-right-radius: 20px !important;
  overflow-y: auto;
  transition: max-height 0.3s ease;
}

.panel-expanded {
  bottom: 0;
  max-height: 70vh !important;
}

.drag-handle {
  width: 100%;
  height: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background-color: #e0e0e0;
  border-radius: 4px;
}

.location-inputs {
  border-radius: 12px;
  overflow: hidden;
  background-color: white;
}

.location-input :deep(.v-field__input) {
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: 14px;
}

.find-route-btn {
  font-weight: bold;
  text-transform: none;
  letter-spacing: 0;
  height: 48px;
}

.route-tabs-container {
  display: flex;
  padding-left: 4px;
}

.route-tabs {
  display: inline-flex;
  font-size: 12px;
}

.tab-option {
  margin-right: 16px;
  color: #666;
  cursor: pointer;
  padding: 4px 0;
  font-size: 12px;
}

.active-tab {
  color: #00b4d8;
  font-weight: 500;
  border-bottom: 2px solid #00b4d8;
}

.route-result {
  background-color: white;
}

.route-list :deep(.v-list-item) {
  min-height: 64px;
}

.route-steps {
  padding: 8px 0;
}

.step {
  display: flex;
  padding: 12px 0;
}

.step-icon {
  margin-right: 16px;
  display: flex;
  align-items: flex-start;
}

.step-content {
  flex: 1;
  position: relative;
}

.step:not(:last-child) .step-content::after {
  content: "";
  position: absolute;
  top: 32px;
  left: -24px;
  width: 2px;
  height: calc(100% - 16px);
  background-color: #e0e0e0;
}

.step-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  color: #03045e;
}

/* CSS continued from previous code */
.step-details {
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.875rem;
}

.route-summary {
  padding: 8px 0;
}

/* Improved suggestion list styles */
.search-container {
  position: relative;
  width: 100%;
}

.suggestions-list {
  position: absolute;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  z-index: 9999; /* Higher z-index to ensure visibility */
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  margin-top: 4px;
  left: 0;
}

.destination-suggestions {
  top: 100%; /* Position directly below the input */
}

.start-suggestions {
  top: 100%; /* Position directly below the input */
}

.suggestion-item {
  cursor: pointer;
  padding: 8px 16px;
  transition: background-color 0.2s;
  min-height: 40px !important;
}

.suggestion-item:hover {
  background-color: #f5f5f5;
}

/* Make sure the suggestion list appears above other elements */
.route-search-panel {
  overflow: visible !important; /* Allow suggestions to overflow */
}

.location-inputs {
  overflow: visible !important; /* Allow suggestions to overflow */
  z-index: 1001;
  position: relative;
}

/* Enhanced visibility for text fields */
.v-text-field {
  position: relative;
  z-index: 1;
}
</style>
