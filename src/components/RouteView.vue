<script setup>
import { ref, computed } from "vue";
import MapPreview from "@/components/MapPreview.vue";
import { useRoutesStore } from "@/stores/routeStore";
import routesData from "@/data/routesData.json";

// Use store to get the route names (not the full data)
const store = useRoutesStore();
const routes = computed(() => store.getRoutes());

// Track which route is expanded by name
const expandedRoute = ref(null);

// Toggle the route expansion on click
const toggleExpand = (routeName) => {
  expandedRoute.value = expandedRoute.value === routeName ? null : routeName;
};

// Fetch the full route data from routesData based on the route name
const getRouteDetails = (routeName) => {
  return routesData[routeName] || {};
};
</script>

<template>
  <v-container fluid>
    <v-row>
      <!-- Loop through each route -->
      <v-col cols="12" v-for="route in routes" :key="route.name">
        <v-card
          class="mb-4"
          outlined
          @click="toggleExpand(route.name)"
          style="cursor: pointer"
        >
          <!-- Card header: Route Name -->
          <v-card-title>{{ route.name }}</v-card-title>

          <!-- Subtitle: Description and Fare from routesData -->
          <v-card-subtitle>
            {{
              getRouteDetails(route.name).description ||
              "No description available"
            }}
            <span v-if="getRouteDetails(route.name).fare">
              - Fare: {{ getRouteDetails(route.name).fare }}
            </span>
          </v-card-subtitle>

          <!-- Expanded Content: Show details and map preview -->
          <v-expand-transition>
            <div v-if="expandedRoute === route.name">
              <v-divider></v-divider>
              <v-card-text>
                <p>
                  <strong>Distance:</strong>
                  {{
                    getRouteDetails(route.name).orsDistance?.toFixed(2)
                  }}
                  meters
                </p>
                <!-- Map Preview using the coordinates from the store -->
                <MapPreview :coordinates="route.coordinates" />
              </v-card-text>
            </div>
          </v-expand-transition>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
/* Customize styling as needed */
</style>
