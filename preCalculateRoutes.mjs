#!/usr/bin/env node

// preCalculateRoutes.js
import fs from "fs";
import Ors from "openrouteservice-js";
// Read and parse the JSON file
const routesData = JSON.parse(
  fs.readFileSync("./src/data/routesData.json", "utf-8")
);

// Use the same API key as your main application
const ORS_API_KEY = "5b3ce3597851110001cf62481cc8343cfad84cc5960086b346336c5e";
const orsDirections = new Ors.Directions({ api_key: ORS_API_KEY });

// Add a delay function to avoid rate limits
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function preCalculateRoutes() {
  console.log("Starting route pre-calculation...");
  const precalculatedRoutes = {};

  // Process routes one by one with a delay to avoid rate limiting
  for (const [routeName, route] of Object.entries(routesData)) {
    console.log(`Processing route ${routeName}...`);

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
      precalculatedRoutes[routeName] = {
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
      console.error(`Error calculating route ${routeName}:`, error.message);

      // Store the route with original coordinates as fallback
      precalculatedRoutes[routeName] = {
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

  // Save the precalculated routes to a JSON file
  const outputPath = "./src/data/precalculatedRoutes.json";
  fs.writeFileSync(outputPath, JSON.stringify(precalculatedRoutes, null, 2));

  console.log(`Pre-calculation complete! Routes saved to ${outputPath}`);
}

// Run the pre-calculation
preCalculateRoutes().catch((error) => {
  console.error("Fatal error during route pre-calculation:", error);
  process.exit(1);
});
