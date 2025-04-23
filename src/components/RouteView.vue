<script setup>
import { ref, computed } from "vue";
import MapPreview from "@/components/MapPreview.vue";
import routesData from "@/data/routesData.json";
import tricycleData from "@/data/tricycleData.json";

// State for route selection
const selectedVehicleType = ref("puj"); // default to PUJ

// Dialog state
const dialogOpen = ref(false);
const selectedRouteName = ref(null);
const activeTab = ref("details");

// Combine and sort PUJ routes (R1-R14)
const pujRoutes = computed(() => {
  const keys = Object.keys(routesData).filter((key) => key.startsWith("r"));
  return keys
    .map((key) => ({ name: key.toUpperCase(), ...routesData[key] }))
    .sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ""));
      const numB = parseInt(b.name.replace(/\D/g, ""));
      return numA - numB;
    });
});

// Tricycle routes (no sorting necessary)
const tricycleRoutes = computed(() => {
  return Object.entries(tricycleData).map(([name, data]) => ({
    name,
    ...data,
  }));
});

// Displayed routes based on selected vehicle type
const displayedRoutes = computed(() => {
  return selectedVehicleType.value === "puj"
    ? pujRoutes.value
    : tricycleRoutes.value;
});

// Route selection
const showRouteDetails = (name) => {
  selectedRouteName.value = name;
  dialogOpen.value = true;
};

const closeDialog = () => {
  dialogOpen.value = false;
  selectedRouteName.value = null;
};

// Get details of selected route
const selectedRoute = computed(() => {
  if (!selectedRouteName.value) return null;
  if (selectedVehicleType.value === "puj") {
    const key = selectedRouteName.value.toLowerCase();
    return { name: selectedRouteName.value, ...routesData[key] };
  } else {
    return {
      name: selectedRouteName.value,
      ...tricycleData[selectedRouteName.value],
    };
  }
});
</script>

<template>
  <div class="route-view-container mb-10">
    <!-- Routes Title -->
    <div class="route-header">
      <h1 class="header-text">Routes</h1>
    </div>

    <div class="vehicle-tabs-container">
      <div class="vehicle-tabs">
        <span
          class="tab-option"
          :class="{ 'active-tab': selectedVehicleType === 'puj' }"
          @click="selectedVehicleType = 'puj'"
        >
          PUJ
        </span>
        <span
          class="tab-option"
          :class="{ 'active-tab': selectedVehicleType === 'tricycle' }"
          @click="selectedVehicleType = 'tricycle'"
        >
          TRICYCLE
        </span>
      </div>
    </div>

    <!-- Display Routes -->
    <div class="routes-grid">
      <v-card
        v-for="route in displayedRoutes"
        :key="route.name"
        class="route-card"
        outlined
        elevation="4"
        @click="showRouteDetails(route.name)"
      >
        <v-card-title class="route-title">
          <v-icon left>{{
            selectedVehicleType === "puj" ? "mdi-bus" : "mdi-motorbike"
          }}</v-icon>
          {{ route.name }} -
          {{ selectedVehicleType === "puj" ? "PUJ" : "Tricycle" }}
        </v-card-title>
        <v-card-subtitle class="route-subtitle">
          <div class="description">
            {{ route.description || "No description available" }}
          </div>
          <div v-if="route.fare" class="fare">
            Minimum Fare: {{ route.fare }}
          </div>
        </v-card-subtitle>
      </v-card>
    </div>

    <!-- Dialog for route map -->
    <v-dialog
      v-model="dialogOpen"
      fullscreen
      transition="dialog-bottom-transition"
    >
      <v-card v-if="selectedRoute" class="route-dialog-card">
        <v-toolbar color="#00b4d8" dark flat>
          <!-- <v-btn icon @click="closeDialog" class="mr-2">
            <v-icon>mdi-arrow-left</v-icon>
          </v-btn> -->
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ selectedRoute.name }}
            <span class="text-subtitle-2 ml-2">{{
              selectedVehicleType === "puj" ? "PUJ" : "Tricycle"
            }}</span>
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon @click="closeDialog" aria-label="Close">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <div class="route-info-banner">
          <div class="route-origin-destination">
            <div class="route-point">
              <v-icon color="#00b4d8" size="20" class="mr-2"
                >mdi-map-marker-radius</v-icon
              >
              <span>{{ selectedRoute.startName || "Origin" }}</span>
            </div>
            <v-icon color="grey" size="20">mdi-transit-connection</v-icon>
            <div class="route-point">
              <v-icon color="#03045e" size="20" class="mr-2"
                >mdi-map-marker</v-icon
              >
              <span>{{ selectedRoute.endName || "Destination" }}</span>
            </div>
          </div>
        </div>

        <v-card-text class="ma-0 pa-0">
          <!-- Map Container -->
          <div class="map-container">
            <MapPreview
              v-if="selectedRoute && selectedRoute.waypoints"
              :coordinates="[
                [...selectedRoute.start],
                ...selectedRoute.waypoints,
                [...selectedRoute.end],
              ]"
            />
          </div>

          <!-- Route Details Section -->
          <!-- Replace the v-tabs with custom tabs -->
          <div class="route-details-container">
            <!-- Custom tabs similar to vehicle-tabs -->
            <div class="detail-tabs-container">
              <div class="detail-tabs">
                <span
                  class="tab-option"
                  :class="{ 'active-tab': activeTab === 'details' }"
                  @click="activeTab = 'details'"
                >
                  <v-icon class="mr-1" small>mdi-information-outline</v-icon>
                  Details
                </span>
                <span
                  class="tab-option"
                  :class="{ 'active-tab': activeTab === 'waypoints' }"
                  @click="activeTab = 'waypoints'"
                >
                  <v-icon class="mr-1" small>mdi-map-marker-path</v-icon>
                  Waypoints
                </span>
              </div>
            </div>

            <v-window v-model="activeTab" class="mt-3">
              <!-- Details Tab -->
              <v-window-item value="details">
                <div class="pa-4">
                  <h3
                    class="text-h6 font-weight-bold mb-3"
                    style="color: #03045e"
                  >
                    Route Information
                  </h3>
                  <p class="description mb-4">
                    {{
                      selectedRoute.description || "No description available."
                    }}
                  </p>

                  <v-divider class="my-4"></v-divider>

                  <div class="additional-info">
                    <div class="info-item">
                      <v-icon color="#03045e" class="mr-2">mdi-bus-stop</v-icon>
                      <span class="info-label">Vehicle Type:</span>
                      <span class="ccc">{{
                        selectedVehicleType === "puj"
                          ? "Public Utility Jeepney"
                          : "Tricycle"
                      }}</span>
                    </div>

                    <div class="info-item" v-if="selectedRoute.fare">
                      <v-icon color="#03045e" class="mr-2">mdi-cash</v-icon>
                      <span class="info-label">Minimum Fare:</span>
                      <span class="info-value">{{ selectedRoute.fare }}</span>
                    </div>
                  </div>
                </div>
              </v-window-item>

              <!-- Waypoints Tab -->
              <v-window-item value="waypoints">
                <!-- Content remains the same -->
                <div class="pa-4">
                  <h3 class="text-h6 font-weight-medium mb-3">Route Stops</h3>

                  <div class="waypoints-list">
                    <!-- Origin -->
                    <div class="waypoint-item origin">
                      <div class="waypoint-marker origin-marker">
                        <v-icon color="white" size="16"
                          >mdi-circle-small</v-icon
                        >
                      </div>
                      <div class="waypoint-line"></div>
                      <div class="waypoint-content">
                        <span class="waypoint-title">{{
                          selectedRoute.startName || "Origin"
                        }}</span>
                        <span class="waypoint-subtitle">Starting Point</span>
                      </div>
                    </div>

                    <!-- Waypoints -->
                    <div
                      v-for="(waypoint, index) in selectedRoute.waypointNames ||
                      []"
                      :key="index"
                      class="waypoint-item"
                    >
                      <div class="waypoint-marker">
                        <v-icon color="white" size="16"
                          >mdi-circle-small</v-icon
                        >
                      </div>
                      <div class="waypoint-line"></div>
                      <div class="waypoint-content">
                        <span class="waypoint-title">{{ waypoint }}</span>
                      </div>
                    </div>

                    <!-- Destination -->
                    <div class="waypoint-item destination">
                      <div class="waypoint-marker destination-marker">
                        <v-icon color="white" size="16"
                          >mdi-circle-small</v-icon
                        >
                      </div>
                      <div class="waypoint-content">
                        <span class="waypoint-title">{{
                          selectedRoute.endName || "Destination"
                        }}</span>
                        <span class="waypoint-subtitle">Final Stop</span>
                      </div>
                    </div>
                  </div>
                </div>
              </v-window-item>
            </v-window>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.route-view-container {
  width: 100vw;
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background-color: #f5f7fa;
}

.route-header {
  padding: 10px 0;
  margin-bottom: 10px;
}

.header-text {
  color: #2196f3;
  font-size: 2.5rem;
  font-weight: bold;
  margin: 0;
}

.vehicle-tabs-container {
  margin: 20px 0 30px;
  color: #00b4d8;
}

.vehicle-tabs {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 4px;
}

.tab-option {
  position: relative;
  padding: 8px 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 15px;
  color: #616161;
  transition: all 0.2s ease;
}

.tab-option:hover {
  color: #00b4d8;
}

.active-tab {
  color: #00b4d8;
  font-weight: 600;
}

.active-tab::after {
  content: "";
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #00b4d8;
  border-radius: 2px;
}

/* Optional: Very subtle background for active tab */
.active-tab {
  background-color: rgba(0, 180, 216, 0.05);
}

.routes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  width: 100%;
}

.route-card {
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  transition: all 0.2s ease;
  cursor: pointer;
  height: 100%;
}

.route-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  border-color: #00b4d8;
}

.route-title {
  font-weight: bold;
  color: #2196f3;
  text-transform: uppercase;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  padding: 16px;
}

.route-subtitle {
  font-size: 0.95rem;
  color: #424242;
  padding: 0 16px 16px;
}

.description {
  margin-bottom: 8px;
  color: #616161;
}

.fare {
  font-weight: bold;
  color: #00b4d8;
  font-size: 1rem;
}

.dialog-content {
  padding: 20px;
}

.map-container {
  height: 60vh;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .routes-grid {
    grid-template-columns: 1fr;
  }

  .header-text {
    font-size: 1.5rem;
  }

  .tab-option {
    padding: 10px 16px;
    font-size: 13px;
  }
}

.route-dialog-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 0;
}

.route-info-banner {
  background-color: #f5f7fa;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e0e0e0;
}

.route-origin-destination {
  display: flex;
  flex-direction: column;
}

.route-point {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.route-arrow {
  margin-left: 9px;
}

.route-meta {
  display: flex;
  gap: 16px;
}

.route-meta-item {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #424242;
}

.map-container {
  position: relative;
  height: 40vh;
  width: 100%;
  overflow: hidden;
}

.map-overlay-controls {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;
}

.route-details-container {
  flex: 1;
  overflow-y: auto;
  background-color: white;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.info-label {
  font-weight: 500;
  color: #2196f3;
  margin-right: 8px;
}

.info-value {
  color: #212121;
}

.waypoints-list {
  position: relative;
}

.waypoint-item {
  display: flex;
  margin-bottom: 24px;
  position: relative;
}

.waypoint-marker {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #757575;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2;
}

.origin-marker {
  background-color: #00b4d8;
}

.destination-marker {
  background-color: #03045e;
}

.waypoint-line {
  position: absolute;
  left: 12px;
  top: 24px;
  width: 2px;
  height: calc(100% + 24px);
  background-color: #e0e0e0;
  z-index: 1;
}

.waypoint-item.destination .waypoint-line {
  display: none;
}

.waypoint-content {
  margin-left: 16px;
  display: flex;
  flex-direction: column;
}

.waypoint-title {
  font-weight: 500;
  color: #212121;
}

.waypoint-subtitle {
  font-size: 12px;
  color: #757575;
}

.route-actions {
  padding: 16px;
  background-color: white;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

@media (max-width: 768px) {
  .route-info-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .route-meta {
    margin-top: 16px;
    width: 100%;
    justify-content: space-between;
  }

  .map-container {
    height: 35vh;
  }

  .v-tab:not(:last-child) {
    margin-right: 12px;
  }
}

/* Add these styles to your <style scoped> section */
.detail-tabs-container {
  margin: 16px 0;
}

.detail-tabs {
  display: flex;
  justify-content: space-around; /* This distributes space evenly */
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 4px;
  width: 100%;
}

.detail-tabs .tab-option {
  position: relative;
  padding: 8px 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 15px;
  color: #616161;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

.detail-tabs .tab-option:hover {
  color: #00b4d8;
}

.detail-tabs .active-tab {
  color: #00b4d8;
  font-weight: 600;
  background-color: rgba(0, 180, 216, 0.05);
}

.detail-tabs .active-tab::after {
  content: "";
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #00b4d8;
  border-radius: 2px;
}

/* Add mobile responsiveness */
@media (max-width: 768px) {
  .detail-tabs {
    gap: 16px;
  }

  .detail-tabs .tab-option {
    padding: 8px 12px;
    font-size: 14px;
  }
}
</style>
