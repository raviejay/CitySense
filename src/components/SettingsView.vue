<script setup>
import { ref, watch } from "vue";
import { useMapStore } from "@/stores/mapStore";

const mapStore = useMapStore();

const themeOptions = [
  { value: "light", label: "Light", icon: "mdi-weather-sunny" },
  { value: "dark", label: "Dark", icon: "mdi-weather-night" },
];

const mapStyleOptions = [
  { value: "standard", label: "Standard", icon: "mdi-map" },
  { value: "minimal", label: "Minimal", icon: "mdi-map-outline" },
  { value: "satellite", label: "Satellite", icon: "mdi-satellite-variant" },
];

const currentTheme = ref("light");
const currentMapStyle = ref(mapStore.currentMapStyle);

// Watch for changes to map style and update the store
watch(currentMapStyle, (newStyle) => {
  mapStore.setMapStyle(newStyle);
});
</script>

<template>
  <div class="settings-page">
    <!-- Header -->
    <div class="settings-header">
      <v-icon color="#2196F3" size="large">mdi-cog</v-icon>
      <h1>Settings</h1>
    </div>

    <!-- Appearance Section -->
    <div class="settings-card">
      <div class="section-header">
        <v-icon color="#2196F3">mdi-palette</v-icon>
        <h2>Appearance</h2>
      </div>

      <div class="setting-option">
        <div class="option-label">
          <v-icon color="#2196F3">mdi-brightness-6</v-icon>
          <span>Theme</span>
        </div>
        <v-radio-group v-model="currentTheme" color="#2196F3">
          <div class="theme-options">
            <v-radio
              v-for="theme in themeOptions"
              :key="theme.value"
              :value="theme.value"
            >
              <template v-slot:label>
                <div class="theme-option">
                  <v-icon :color="theme.color || '#2196F3'">{{
                    theme.icon
                  }}</v-icon>
                  <span>{{ theme.label }}</span>
                </div>
              </template>
            </v-radio>
          </div>
        </v-radio-group>
      </div>

      <div class="setting-option">
        <div class="option-label">
          <v-icon color="#2196F3">mdi-map</v-icon>
          <span>Map Style</span>
        </div>
        <v-select
          v-model="currentMapStyle"
          :items="mapStyleOptions"
          item-title="label"
          item-value="value"
          variant="outlined"
          density="compact"
          color="#2196F3"
          :menu-props="{ maxHeight: '200' }"
        >
          <template v-slot:item="{ props, item }">
            <v-list-item v-bind="props">
              <template v-slot:prepend>
                <v-icon :icon="item.icon" color="#2196F3"></v-icon>
              </template>
            </v-list-item>
          </template>
        </v-select>
      </div>
    </div>

    <!-- About Us Section -->
    <div class="settings-card">
      <div class="section-header">
        <v-icon color="#2196F3">mdi-information</v-icon>
        <h2>About Us</h2>
      </div>

      <div class="about-content">
        <p>
          CitySense is a transportation app helps you navigate the city with
          ease, providing accurate routes and fare information for PUJs and
          tricycles.
        </p>

        <div class="app-info">
          <div class="info-item">
            <v-icon color="#2196F3">mdi-flag</v-icon>
            <span>Version 1.0.0</span>
          </div>
          <div class="info-item">
            <v-icon color="#2196F3">mdi-calendar</v-icon>
            <span>© 2025 CitySense</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Contact Us Section -->
    <div class="settings-card">
      <div class="section-header">
        <v-icon color="#2196F3">mdi-email</v-icon>
        <h2>Contact Us</h2>
      </div>

      <div class="contact-methods">
        <v-btn
          variant="outlined"
          color="#2196F3"
          prepend-icon="mdi-email"
          class="contact-btn"
        >
          Email Support
        </v-btn>

        <v-btn
          variant="outlined"
          color="#2196F3"
          prepend-icon="mdi-facebook"
          class="contact-btn"
        >
          Facebook
        </v-btn>

        <v-btn
          variant="outlined"
          color="#2196F3"
          prepend-icon="mdi-phone"
          class="contact-btn"
        >
          Call Support
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  color: #333;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 30px;
  padding-top: 20px;
}

.settings-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #2196f3;
}

.settings-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(33, 150, 243, 0.2);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.section-header h2 {
  font-size: 20px;
  font-weight: 500;
  color: #2196f3;
}

.setting-option {
  margin-bottom: 24px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-weight: 500;
  color: #2196f3;
}

.theme-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.about-content {
  line-height: 1.6;
  color: #555;
}

.app-info {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2196f3;
}

.contact-methods {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contact-btn {
  text-transform: none;
  letter-spacing: normal;
  border-color: #2196f3;
}
</style>
