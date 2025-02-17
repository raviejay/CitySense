// src/stores/routesStore.js
import { defineStore } from "pinia";
import { ref } from "vue";

export const useRoutesStore = defineStore("routes", () => {
  const drawnRoutes = ref([]);

  const setRoutes = (routes) => {
    drawnRoutes.value = routes;
  };

  const getRoutes = () => drawnRoutes.value;

  return { drawnRoutes, setRoutes, getRoutes };
});
