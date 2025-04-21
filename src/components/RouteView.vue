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
    <v-dialog v-model="dialogOpen" max-width="600" fullscreen>
      <v-card v-if="selectedRoute">
        <v-toolbar color="primary" dark>
          <v-toolbar-title> {{ selectedRoute.name }} Details </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon @click="closeDialog">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <div class="dialog-content">
            <p class="description">{{ selectedRoute.description }}</p>
            <p v-if="selectedRoute.fare" class="fare">
              <strong>Minimum Fare:</strong> {{ selectedRoute.fare }}
            </p>
            <p>
              <strong>Vehicle Type:</strong>
              {{ selectedVehicleType === "puj" ? "PUJ" : "Tricycle" }}
            </p>

            <!-- Only show MapPreview inside the dialog -->
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
  color: #2196f3;
}

.active-tab {
  color: #2196f3;
  font-weight: 600;
}

.active-tab::after {
  content: "";
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #2196f3;
  border-radius: 2px;
}

/* Optional: Very subtle background for active tab */
.active-tab {
  background-color: rgba(33, 150, 243, 0.05);
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
  border-color: #2196f3;
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
  color: #1976d2;
  font-size: 1rem;
}

.dialog-content {
  padding: 20px;
}

.map-container {
  height: 60vh;
  margin-top: 20px;
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
</style>
