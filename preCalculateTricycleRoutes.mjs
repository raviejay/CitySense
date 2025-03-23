#!/usr/bin/env node

// preCalculateTricycleRoutes.js
import fs from "fs";
import Ors from "openrouteservice-js";

// Read and parse the JSON file
const tricycleData = JSON.parse(
  fs.readFileSync("./src/data/tricycleData.json", "utf-8")
);

// Use the same API key as your main application
const ORS_API_KEY = "5b3ce3597851110001cf62481cc8343cfad84cc5960086b346336c5e";
const orsDirections = new Ors.Directions({ api_key: ORS_API_KEY });

// Add a delay function to avoid rate limits
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function preCalculateTricycleRoutes() {
  console.log("Starting tricycle route pre-calculation...");
  const precalculatedTricycleRoutes = {};

  // Process routes one by one with a delay to avoid rate limiting
  for (const [routeName, route] of Object.entries(tricycleData)) {
    console.log(`Processing tricycle route ${routeName}...`);

    try {
      // Prepare coordinates as expected by ORS
      const coordinates = [route.start, ...route.waypoints, route.end];

      // Calculate the route using ORS
      const response = await orsDirections.calculate({
        coordinates: coordinates,
        profile: "driving-car",
        format: "geojson",
      });

      // Extract the routed coordinates and properties
      const routedCoords = response.features[0].geometry.coordinates;
      const distance = response.features[0].properties.segments[0].distance;
      const duration = response.features[0].properties.segments[0].duration;

      // Store in our results object
      precalculatedTricycleRoutes[routeName] = {
        name: routeName,
        originalCoordinates: coordinates,
        routedCoordinates: routedCoords,
        distance: distance,
        duration: duration,
        fare: route.fare,
        description: route.description,
      };

      // Add a delay to avoid hitting API rate limits
      await delay(1000);
    } catch (error) {
      console.error(
        `Error calculating tricycle route ${routeName}:`,
        error.message
      );

      // Store the route with original coordinates as fallback
      precalculatedTricycleRoutes[routeName] = {
        name: routeName,
        originalCoordinates: [route.start, ...route.waypoints, route.end],
        routedCoordinates: null, // No routed coordinates available
        error: error.message,
        fare: route.fare,
        description: route.description,
      };

      await delay(2000); // Longer delay after an error
    }
  }

  // Save the precalculated tricycle routes to a JSON file
  const outputPath = "./src/data/precalculatedTricycleRoutes.json";
  fs.writeFileSync(
    outputPath,
    JSON.stringify(precalculatedTricycleRoutes, null, 2)
  );

  console.log(
    `Tricycle route pre-calculation complete! Routes saved to ${outputPath}`
  );
}

// Run the pre-calculation
preCalculateTricycleRoutes().catch((error) => {
  console.error("Fatal error during tricycle route pre-calculation:", error);
  process.exit(1);
});
