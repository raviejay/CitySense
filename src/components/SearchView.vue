<script setup>
import { ref, defineProps, defineEmits } from "vue";

const props = defineProps(["userStart", "userDestination"]);
const emit = defineEmits([
  "update-start",
  "update-destination",
  "find-best-route",
]);

const startLocation = ref(props.userStart);
const destinationLocation = ref(props.userDestination);
</script>

<template>
  <v-container class="search-container">
    <v-text-field
      label="Start Location (lng,lat)"
      v-model="startLocation"
      readonly
    ></v-text-field>
    <v-text-field
      label="Destination Location (lng,lat)"
      v-model="destinationLocation"
      readonly
    ></v-text-field>
    <v-btn @click="$emit('find-best-route')" color="primary"
      >Find Best Route</v-btn
    >
  </v-container>
</template>

<style scoped>
.search-container {
  position: absolute;
  bottom: 60px; /* Above the navbar */
  left: 0;
  width: 100%;
  background: white;
  padding: 16px;
  z-index: 2; /* Ensure it's above the map */
}
</style>
