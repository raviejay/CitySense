<script setup>
import { ref } from "vue";
import SearchView from "@/components/SearchView.vue";
import RouteView from "@/components/RouteView.vue";
import SettingsView from "@/components/SettingsView.vue";
import Searchs from "./Searchs.vue";

const activeView = ref("search"); // Default to Search

defineProps({
  startCoords: String,
  destinationCoords: String,
});

const setActiveView = (view) => {
  activeView.value = view;
};
</script>

<template>
  <div>
    <!-- Dynamic Content -->
    <div v-if="activeView === 'search'">
      <Searchs
        :startCoords="startCoords"
        :destinationCoords="destinationCoords"
      />
    </div>
    <div v-if="activeView === 'route'">
      <RouteView />
    </div>
    <div v-if="activeView === 'settings'">
      <SettingsView />
    </div>

    <!-- Bottom Navigation -->
    <v-bottom-navigation
      v-model="activeView"
      app
      grow
      color="primary"
      class="bg-white"
    >
      <v-btn value="search" @click="setActiveView('search')">
        <v-icon>mdi-magnify</v-icon>
        <span>Search</span>
      </v-btn>

      <v-btn value="route" @click="setActiveView('route')">
        <v-icon>mdi-map-marker-path</v-icon>
        <span>Route</span>
      </v-btn>

      <v-btn value="settings" @click="setActiveView('settings')">
        <v-icon>mdi-cog</v-icon>
        <span>Settings</span>
      </v-btn>
    </v-bottom-navigation>
  </div>
</template>

<style scoped>
/* Custom style for the active button */
.v-bottom-navigation .v-btn--active {
  position: relative;
}

.v-bottom-navigation .v-btn--active::before {
  content: "";
  position: absolute;
  top: 0; /* Position the line above the icon */
  left: 50%; /* Center the line */
  transform: translateX(-50%); /* Center the line */
  width: 60%; /* Width of the line */
  height: 3px; /* Height of the line */
  background-color: #448aff; /* Color of the line */
}
</style>
