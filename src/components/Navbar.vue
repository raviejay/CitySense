<script setup>
import { ref } from "vue";
import RouteView from "@/components/RouteView.vue";
import SettingsView from "@/components/SettingsView.vue";
import Searchs from "./Searchs.vue";

const activeView = ref("search");

const emit = defineEmits(["updateCoords", "clearCoords", "setActiveField"]);

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
    <div v-if="activeView === 'search'">
      <Searchs
        :startCoords="startCoords"
        :destinationCoords="destinationCoords"
        @update-coords="(s, d) => emit('updateCoords', s, d)"
        @clear-coords="(type) => emit('clearCoords', type)"
        @set-active-field="(field) => emit('setActiveField', field)"
      />
    </div>
    <div v-if="activeView === 'route'">
      <RouteView />
    </div>
    <div v-if="activeView === 'settings'">
      <SettingsView />
    </div>

    <v-bottom-navigation
      v-model="activeView"
      app
      grow
      color="primary"
      class="bg-white"
    >
      <v-btn value="search" @click="setActiveView('search')">
        <v-icon color="#03045e">mdi-magnify</v-icon>
        <span>Search</span>
      </v-btn>

      <v-btn value="route" @click="setActiveView('route')">
        <v-icon color="#03045e">mdi-map-marker-path</v-icon>
        <span>Route</span>
      </v-btn>

      <v-btn value="settings" @click="setActiveView('settings')">
        <v-icon color="#03045e">mdi-cog</v-icon>
        <span>Settings</span>
      </v-btn>
    </v-bottom-navigation>
  </div>
</template>

<style scoped>
.v-bottom-navigation .v-btn--active {
  position: relative;
}

.v-bottom-navigation .v-btn--active::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 3px;
  background-color: #448aff;
}
</style>
