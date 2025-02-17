<script setup>
import { ref, watch } from "vue";
import { useRoutes } from "@/composables/useRoutes";

const bestRoute = ref(null); // Store the best route

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

const handleFindBestRoute = async () => {
  console.log(
    "Finding best route from:",
    userStart.value,
    "to:",
    userDestination.value
  );

  try {
    bestRoute.value = await findBestRoute(
      props.startCoords,
      props.destinationCoords
    );
    console.log("Best route found:", bestRoute.value);
  } catch (error) {
    console.error("Error finding the best route:", error);
  }
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
    <v-btn @click="handleFindBestRoute" color="primary">Find Best Route</v-btn>

    <v-card class="pa-4 mt-4">
      <div>Best Route: {{ bestRoute?.name || "No route found" }}</div>
      <!-- Flex container for icons and the line -->
      <div class="route-line d-flex align-center mt-4">
        <v-icon size="36">mdi-truck</v-icon>
        <div class="line"></div>
        <v-icon size="36">mdi-map-marker</v-icon>
      </div>
    </v-card>
  </v-container>
</template>

<style scoped>
/* Flex container already set via d-flex and align-center classes */
.line {
  height: 2px;
  background-color: black;
  width: 100px; /* Adjust this value to make the line shorter or longer */
  /* The line will automatically touch the icons if no extra margin is added */
}
</style>
