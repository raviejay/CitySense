<script setup>
import { ref } from "vue";
import Map from "@/components/Map.vue";
import RouteInput from "@/components/RouteInput.vue";
import { useRoutes } from "@/composables/useRoutes";
import LogoPage from "@/components/LogoPage.vue";
import Navbar from "@/components/Navbar.vue";

const start = ref("");
const destination = ref("");

// Update input fields when the map is clicked
const updateCoords = (newStart, newDestination) => {
  start.value = newStart;
  destination.value = newDestination;
};
</script>

<template>
  <Map @updateCoords="updateCoords" />
  <Navbar :startCoords="start" :destinationCoords="destination" />
</template>
