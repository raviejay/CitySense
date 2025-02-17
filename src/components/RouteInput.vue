<script setup>
import { ref } from "vue";
import { useRoutes } from "@/composables/useRoutes";

const props = defineProps(["startCoords", "destinationCoords"]);
const { findBestRoute } = useRoutes(); // Use composable inside this component

// Call `findBestRoute` directly from this component
const findRoute = () => {
  if (!props.startCoords || !props.destinationCoords) {
    console.error("Start and destination must be selected.");
    return;
  }
  findBestRoute(props.startCoords, props.destinationCoords);
  console.error("NAh click.");
};
</script>

<template>
  <v-container>
    <v-text-field
      label="Start Location (lng,lat)"
      v-model="props.startCoords"
      readonly
    ></v-text-field>
    <v-text-field
      label="Destination Location (lng,lat)"
      v-model="props.destinationCoords"
      readonly
    ></v-text-field>
    <v-btn @click="findRoute" color="primary">Find Best Route</v-btn>
  </v-container>
</template>
