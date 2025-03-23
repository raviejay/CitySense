// src/stores/mapStore.js
import { defineStore } from "pinia";
import { ref } from "vue";

export const useMapStore = defineStore("map", () => {
  const mapInstance = ref(null);

  const setMapInstance = (instance) => {
    mapInstance.value = instance;
  };

  return {
    mapInstance,
    setMapInstance,
  };
});
