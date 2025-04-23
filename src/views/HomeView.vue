<script setup>
import { ref } from "vue";
import Map from "@/components/Map.vue";
import Navbar from "@/components/Navbar.vue";

// Centralized state for coordinates
const startCoords = ref("");
const destinationCoords = ref("");
const activeInputField = ref(null); // Track which input field is active

// Update coordinates from any source
const updateCoords = (newStart, newDestination, sourceField = null) => {
  if (newStart !== undefined) {
    startCoords.value = newStart;
  }
  if (newDestination !== undefined) {
    destinationCoords.value = newDestination;
  }
  if (sourceField) {
    activeInputField.value = sourceField;
  }
};

// Clear specific coordinate
const clearCoords = (type) => {
  if (type === "start") {
    startCoords.value = "";
  } else {
    destinationCoords.value = "";
  }
};

// Set active input field for map clicks
const setActiveInputField = (field) => {
  activeInputField.value = field;
};
</script>

<template>
  <Map
    @update-coords="updateCoords"
    :startCoords="startCoords"
    :destinationCoords="destinationCoords"
    :activeInputField="activeInputField"
  />
  <Navbar
    :startCoords="startCoords"
    :destinationCoords="destinationCoords"
    @update-coords="updateCoords"
    @clear-coords="clearCoords"
    @set-active-field="setActiveInputField"
  />
</template>
