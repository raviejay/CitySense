<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import logo from "@/assets/img/logos.png";

const progressValue = ref(0);
const bufferValue = ref(0);
const iconPosition = ref("0%");
const router = useRouter();

onMounted(() => {
  let position = 0;
  const interval = setInterval(() => {
    if (position < 100) {
      position += 1;
      progressValue.value = position;
      bufferValue.value = position;
      iconPosition.value = `${position}%`;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        router.push("/home");
      }, 5000);
    }
  }, 30);
});
</script>

<template>
  <v-app dark>
    <v-main>
      <v-container fluid class="bg-blue-grey-darken-4 full-height pa-0 ma-0">
        <v-row
          align-content="center"
          class="fill-height pa-0 ma-0"
          justify="center"
        >
          <v-col class="text-center pa-0 m-0" cols="12">
            <v-img :src="logo" alt="Logo" contain height="200"></v-img>
          </v-col>
          <v-col
            cols="6"
            class="text-center pa-0 m-0"
            style="position: relative; display: flex; justify-content: center"
          >
            <div style="position: relative; width: 50%">
              <v-progress-linear
                color="blue-accent-2"
                height="4"
                :model-value="progressValue"
                :buffer-value="bufferValue"
                rounded
                style="width: 100%; transition: all 1s ease"
              ></v-progress-linear>
              <v-icon
                class="location-icon"
                color="blue-accent-2"
                :style="{ left: iconPosition }"
                >mdi-map-marker</v-icon
              >
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.full-height {
  height: 100%; /* Ensure full viewport height */
  width: 100vw; /* Ensure full viewport width */
}

.location-icon {
  position: absolute;
  top: -20px;
  transform: translateX(-50%);
  font-size: 24px;
  transition: left 1s ease;
}
</style>
