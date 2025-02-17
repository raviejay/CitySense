import { ref } from "vue";
import Ors from "openrouteservice-js";
import routesData from "@/data/routesData.json";
import L from "leaflet";
import { useRoutesStore } from "@/stores/routeStore";

const ORS_API_KEY = "5b3ce3597851110001cf62489cfc14e709f446268359f1fe73a6dc38";
const orsDirections = new Ors.Directions({ api_key: ORS_API_KEY });

export function useRoutes() {
  const store = useRoutesStore();

  const loadRoutes = async (mapInstance) => {
    if (!mapInstance) return;

    const drawnRoutes = Object.entries(routesData).map(([name, route]) => ({
      name,
      coordinates: [route.start, ...route.waypoints, route.end],
      polyline: null,
      orsDistance: Infinity,
    }));

    for (const route of drawnRoutes) {
      try {
        const response = await orsDirections.calculate({
          coordinates: route.coordinates,
          profile: "driving-car",
          format: "geojson",
        });

        const routedCoords = response.features[0].geometry.coordinates;
        route.orsDistance =
          response.features[0].properties.segments[0].distance;

        route.polyline = L.polyline(
          routedCoords.map((coord) => [coord[1], coord[0]]),
          { color: "blue", weight: 4, opacity: 0.5 }
        ).addTo(mapInstance);
      } catch (error) {
        console.error(`Error loading route ${route.name}:`, error);
      }
    }

    // Save routes in Pinia store
    store.setRoutes(drawnRoutes);
    console.log("Routes loaded and saved in store:", store.getRoutes());
  };

  const findBestRoute = async (start, destination) => {
    console.log("Start:", start, "Destination:", destination);

    const parseCoordinates = (coords) => {
      if (!coords) return null;
      const [lng, lat] = coords.split(",").map(Number);
      return isNaN(lat) || isNaN(lng) ? null : [lng, lat];
    };

    const startCoords = parseCoordinates(start);
    const endCoords = parseCoordinates(destination);

    if (!startCoords || !endCoords) {
      console.error("Invalid start or destination coordinates");
      return;
    }

    const drawnRoutes = store.getRoutes();
    console.log("Stored routes:", drawnRoutes);

    let minDistance = Infinity;
    let bestRoute = null;

    for (const route of drawnRoutes) {
      try {
        const orsCoordinates = [startCoords, ...route.coordinates, endCoords];

        const response = await orsDirections.calculate({
          coordinates: orsCoordinates,
          profile: "driving-car",
          format: "geojson",
        });

        const routeDistance =
          response.features[0].properties.segments[0].distance;

        if (routeDistance < minDistance) {
          minDistance = routeDistance;
          bestRoute = route;
        }
      } catch (error) {
        console.error(`Error processing route ${route.name}:`, error);
      }

      return bestRoute;
    }

    // Highlight the best route
    drawnRoutes.forEach((route) => route.polyline.setStyle({ opacity: 0.2 }));
    if (bestRoute) {
      bestRoute.polyline.setStyle({ opacity: 1 });
      console.log("Best Route:", bestRoute);
    } else {
      console.log("No valid route found.");
    }
  };
  const drawCalculatedRoute = async (mapInstance, coordinates) => {
    if (!mapInstance || !coordinates || coordinates.length === 0) return;

    try {
      const response = await orsDirections.calculate({
        coordinates: coordinates,
        profile: "driving-car",
        format: "geojson",
      });

      const routedCoords = response.features[0].geometry.coordinates;
      const latlngs = routedCoords.map((coord) => [coord[1], coord[0]]);

      const polyline = L.polyline(latlngs, {
        color: "blue",
        weight: 4,
        opacity: 0.5,
      }).addTo(mapInstance);
      mapInstance.fitBounds(polyline.getBounds());

      return polyline;
    } catch (error) {
      console.error("Error calculating route:", error);
    }
  };

  return { loadRoutes, findBestRoute, drawCalculatedRoute };
}
