import { ref } from "vue";
import Ors from "openrouteservice-js";
import L from "leaflet";
import { useRoutesStore } from "@/stores/routeStore";
import precalculatedRoutes from "@/data/precalculatedRoutes.json";
import precalculatedTricycleRoutes from "@/data/precalculatedTricycleRoutes.json";

const ORS_API_KEY = "5b3ce3597851110001cf62489cfc14e709f446268359f1fe73a6dc38";
const orsDirections = new Ors.Directions({ api_key: ORS_API_KEY });

// Maximum transfer distance between routes in meters (300m)
const MAX_TRANSFER_DISTANCE = 300;

export function useRoutes() {
  const store = useRoutesStore();

  const loadRoutes = async (mapInstance) => {
    if (!mapInstance) return;

    // Load PUJ routes from precalculated data
    const drawnRoutes = Object.entries(precalculatedRoutes).map(
      ([name, route]) => ({
        name,
        type: "PUJ",
        coordinates: route.originalCoordinates,
        routedCoordinates: route.routedCoordinates,
        polyline: null,
        orsDistance: route.distance,
        fare: route.fare,
        description: route.description,
      })
    );

    // Load tricycle routes from precalculated data
    const tricycleRoutes = Object.entries(precalculatedTricycleRoutes).map(
      ([name, route]) => ({
        name,
        type: "Tricycle",
        coordinates: route.originalCoordinates,
        routedCoordinates: route.routedCoordinates,
        polyline: null,
        orsDistance: route.distance,
        fare: route.fare,
        description: route.description,
      })
    );

    // Combine all routes
    const allRoutes = [...drawnRoutes, ...tricycleRoutes];

    // Draw all routes on map
    for (const route of allRoutes) {
      try {
        const routeColor = route.type === "PUJ" ? "blue" : "orange";

        // Use precalculated routed coordinates if available
        const coordsToUse = route.routedCoordinates || route.coordinates;

        route.polyline = L.polyline(
          coordsToUse.map((coord) => [coord[1], coord[0]]),
          { color: routeColor, weight: 4, opacity: 0.5 }
        ).addTo(mapInstance);
      } catch (error) {
        console.error(`Error loading route ${route.name}:`, error);
      }
    }

    // Save routes in Pinia store
    store.setRoutes(allRoutes);
    console.log("All routes loaded and saved in store:", store.getRoutes());
  };

  const calculateDistance = (point1, point2) => {
    const [x1, y1] = point1;
    const [x2, y2] = point2;
    // Convert to meters (approximate for this latitude)
    const lat1 = y1;
    const lon1 = x1;
    const lat2 = y2;
    const lon2 = x2;

    // Haversine formula
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  };

  const getClosestPointOnSegment = (point, segmentStart, segmentEnd) => {
    const [x, y] = point;
    const [x1, y1] = segmentStart;
    const [x2, y2] = segmentEnd;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    return [xx, yy];
  };

  const findNearestPointOnRoute = (point, routeCoordinates) => {
    let nearestPoint = null;
    let minDistance = Infinity;
    let segmentIndex = -1;

    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const segmentStart = routeCoordinates[i];
      const segmentEnd = routeCoordinates[i + 1];
      const closestPointOnSegment = getClosestPointOnSegment(
        point,
        segmentStart,
        segmentEnd
      );
      const distance = calculateDistance(point, closestPointOnSegment);

      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = closestPointOnSegment;
        segmentIndex = i;
      }
    }

    return { point: nearestPoint, distance: minDistance, segmentIndex };
  };

  // Enhanced method to compute distance along a route from one point to another
  const calculateDistanceAlongRoute = (route, startIndex, endIndex) => {
    const useCoords = route.routedCoordinates || route.coordinates;
    let totalDistance = 0;

    // Make sure indices are valid
    const validStartIndex = Math.max(
      0,
      Math.min(startIndex, useCoords.length - 1)
    );
    const validEndIndex = Math.max(0, Math.min(endIndex, useCoords.length - 1));

    // Ensure we're going in the correct direction
    const start = Math.min(validStartIndex, validEndIndex);
    const end = Math.max(validStartIndex, validEndIndex);

    // Calculate distance along route segments
    for (let i = start; i < end; i++) {
      totalDistance += calculateDistance(useCoords[i], useCoords[i + 1]);
    }

    return totalDistance;
  };

  // Enhanced method to find valid transfer points between routes
  const findTransferPoints = (route1, route2, maxResults = 3) => {
    const transferCandidates = [];
    const coords1 = route1.routedCoordinates || route1.coordinates;
    const coords2 = route2.routedCoordinates || route2.coordinates;

    // Sample points along the routes (not checking all points to improve performance)
    const samplingRate = Math.max(1, Math.floor(coords1.length / 20)); // Sample ~20 points on route1

    for (let i = 0; i < coords1.length; i += samplingRate) {
      const point1 = coords1[i];

      // Find closest point on route2
      const {
        point: point2,
        distance,
        segmentIndex,
      } = findNearestPointOnRoute(point1, coords2);

      if (distance <= MAX_TRANSFER_DISTANCE) {
        // Calculate positions along each route (percentage)
        const position1 = i / (coords1.length - 1);
        const position2 = segmentIndex / (coords2.length - 1);

        transferCandidates.push({
          point1,
          point2,
          distance,
          position1,
          position2,
          index1: i,
          index2: segmentIndex,
        });
      }
    }

    // Sort by transfer distance
    transferCandidates.sort((a, b) => a.distance - b.distance);

    // Filter candidates to ensure they're well-distributed along the routes
    const filteredCandidates = [];
    const positionThreshold = 0.15; // Minimum position difference (15% of route)

    for (const candidate of transferCandidates) {
      // Only add if this transfer point is sufficiently different from already selected ones
      const isDifferentEnough = filteredCandidates.every(
        (existing) =>
          Math.abs(existing.position1 - candidate.position1) >
            positionThreshold ||
          Math.abs(existing.position2 - candidate.position2) > positionThreshold
      );

      if (isDifferentEnough) {
        filteredCandidates.push(candidate);
        if (filteredCandidates.length >= maxResults) break;
      }
    }

    return filteredCandidates;
  };

  // Improved algorithm for finding best route combinations
  const findBestRouteCombination = (startCoords, endCoords, mapInstance) => {
    console.log(
      "Finding best route combination from:",
      startCoords,
      "to:",
      endCoords
    );

    const allRoutes = store.getRoutes();
    const possibleRoutes = [];

    // Find nearest points on all routes for start and end
    const startRoutePoints = allRoutes
      .map((route) => {
        const proximity = findNearestPointOnRoute(
          startCoords,
          route.routedCoordinates || route.coordinates
        );
        return {
          route,
          proximity,
        };
      })
      .filter((item) => item.proximity.distance <= MAX_TRANSFER_DISTANCE);

    const endRoutePoints = allRoutes
      .map((route) => {
        const proximity = findNearestPointOnRoute(
          endCoords,
          route.routedCoordinates || route.coordinates
        );
        return {
          route,
          proximity,
        };
      })
      .filter((item) => item.proximity.distance <= MAX_TRANSFER_DISTANCE);

    console.log(
      `Found ${startRoutePoints.length} possible start routes and ${endRoutePoints.length} possible end routes`
    );

    // OPTION 1: Direct single route (if start and end are on the same route)
    startRoutePoints.forEach((startPoint) => {
      endRoutePoints.forEach((endPoint) => {
        if (startPoint.route.name === endPoint.route.name) {
          const useCoords =
            startPoint.route.routedCoordinates || startPoint.route.coordinates;

          // Calculate actual distance along route between start and end points
          const distanceAlongRoute = calculateDistanceAlongRoute(
            startPoint.route,
            startPoint.proximity.segmentIndex,
            endPoint.proximity.segmentIndex
          );

          // Calculate percentage of total route distance
          const routePercentage =
            distanceAlongRoute / startPoint.route.orsDistance;

          // Calculate prorated fare based on distance traveled
          const proratedFare = Math.max(
            startPoint.route.fare * 0.5, // Minimum fare is 50% of full fare
            startPoint.route.fare * routePercentage
          );

          possibleRoutes.push({
            type: "direct",
            steps: [
              {
                mode: startPoint.route.type,
                routeName: startPoint.route.name,
                start: startPoint.proximity.point,
                end: endPoint.proximity.point,
                segmentStart: startPoint.proximity.segmentIndex,
                segmentEnd: endPoint.proximity.segmentIndex,
                distance: distanceAlongRoute,
                fare: Math.round(proratedFare),
                description: startPoint.route.description,
              },
            ],
            totalDistance: distanceAlongRoute,
            totalFare: Math.round(proratedFare),
          });
        }
      });
    });

    // OPTION 2: Two-route combinations (with transfer)
    startRoutePoints.forEach((startPoint) => {
      endRoutePoints.forEach((endPoint) => {
        // Skip if same route (already handled in Option 1)
        if (startPoint.route.name === endPoint.route.name) return;

        // Find potential transfer points between these routes
        const transferPoints = findTransferPoints(
          startPoint.route,
          endPoint.route
        );

        if (transferPoints.length > 0) {
          transferPoints.forEach((transferPoint) => {
            // Calculate distance along first route
            const distance1 = calculateDistanceAlongRoute(
              startPoint.route,
              startPoint.proximity.segmentIndex,
              transferPoint.index1
            );

            // Calculate distance along second route
            const distance2 = calculateDistanceAlongRoute(
              endPoint.route,
              transferPoint.index2,
              endPoint.proximity.segmentIndex
            );

            // Calculate prorated fares
            const fare1 = Math.max(
              startPoint.route.fare * 0.5,
              startPoint.route.fare * (distance1 / startPoint.route.orsDistance)
            );

            const fare2 = Math.max(
              endPoint.route.fare * 0.5,
              endPoint.route.fare * (distance2 / endPoint.route.orsDistance)
            );

            possibleRoutes.push({
              type: "combined",
              steps: [
                {
                  mode: startPoint.route.type,
                  routeName: startPoint.route.name,
                  start: startPoint.proximity.point,
                  end: transferPoint.point1,
                  segmentStart: startPoint.proximity.segmentIndex,
                  segmentEnd: transferPoint.index1,
                  distance: distance1,
                  fare: Math.round(fare1),
                  description: startPoint.route.description,
                },
                {
                  mode: endPoint.route.type,
                  routeName: endPoint.route.name,
                  start: transferPoint.point2,
                  end: endPoint.proximity.point,
                  segmentStart: transferPoint.index2,
                  segmentEnd: endPoint.proximity.segmentIndex,
                  distance: distance2,
                  fare: Math.round(fare2),
                  description: endPoint.route.description,
                },
              ],
              totalDistance: distance1 + distance2 + transferPoint.distance,
              totalFare: Math.round(fare1 + fare2),
              transferPoint,
              transferDistance: transferPoint.distance,
            });
          });
        }
      });
    });

    // OPTION 3: Three routes (with 2 transfers)
    // Only try this if we have very few options so far
    if (possibleRoutes.length < 3) {
      allRoutes.forEach((middleRoute) => {
        startRoutePoints.forEach((startPoint) => {
          // Skip if middle route is the same as start route
          if (middleRoute.name === startPoint.route.name) return;

          // Find transfer points from start route to middle route
          const transferPoints1 = findTransferPoints(
            startPoint.route,
            middleRoute
          );

          if (transferPoints1.length > 0) {
            endRoutePoints.forEach((endPoint) => {
              // Skip if middle route is the same as end route or start route is the same as end route
              if (
                middleRoute.name === endPoint.route.name ||
                startPoint.route.name === endPoint.route.name
              )
                return;

              // Find transfer points from middle route to end route
              const transferPoints2 = findTransferPoints(
                middleRoute,
                endPoint.route
              );

              if (transferPoints2.length > 0) {
                // Try all reasonable combinations of transfer points
                transferPoints1.slice(0, 1).forEach((transfer1) => {
                  transferPoints2.slice(0, 1).forEach((transfer2) => {
                    // Skip if transfer2 is before transfer1 on middle route (wrong direction)
                    if (transfer2.index1 < transfer1.index2) return;

                    // Calculate distances along each route segment
                    const distance1 = calculateDistanceAlongRoute(
                      startPoint.route,
                      startPoint.proximity.segmentIndex,
                      transfer1.index1
                    );

                    const distance2 = calculateDistanceAlongRoute(
                      middleRoute,
                      transfer1.index2,
                      transfer2.index1
                    );

                    const distance3 = calculateDistanceAlongRoute(
                      endPoint.route,
                      transfer2.index2,
                      endPoint.proximity.segmentIndex
                    );

                    // Calculate prorated fares
                    const fare1 = Math.max(
                      startPoint.route.fare * 0.5,
                      startPoint.route.fare *
                        (distance1 / startPoint.route.orsDistance)
                    );

                    const fare2 = Math.max(
                      middleRoute.fare * 0.5,
                      middleRoute.fare * (distance2 / middleRoute.orsDistance)
                    );

                    const fare3 = Math.max(
                      endPoint.route.fare * 0.5,
                      endPoint.route.fare *
                        (distance3 / endPoint.route.orsDistance)
                    );

                    possibleRoutes.push({
                      type: "triple",
                      steps: [
                        {
                          mode: startPoint.route.type,
                          routeName: startPoint.route.name,
                          start: startPoint.proximity.point,
                          end: transfer1.point1,
                          segmentStart: startPoint.proximity.segmentIndex,
                          segmentEnd: transfer1.index1,
                          distance: distance1,
                          fare: Math.round(fare1),
                          description: startPoint.route.description,
                        },
                        {
                          mode: middleRoute.type,
                          routeName: middleRoute.name,
                          start: transfer1.point2,
                          end: transfer2.point1,
                          segmentStart: transfer1.index2,
                          segmentEnd: transfer2.index1,
                          distance: distance2,
                          fare: Math.round(fare2),
                          description: middleRoute.description,
                        },
                        {
                          mode: endPoint.route.type,
                          routeName: endPoint.route.name,
                          start: transfer2.point2,
                          end: endPoint.proximity.point,
                          segmentStart: transfer2.index2,
                          segmentEnd: endPoint.proximity.segmentIndex,
                          distance: distance3,
                          fare: Math.round(fare3),
                          description: endPoint.route.description,
                        },
                      ],
                      totalDistance:
                        distance1 +
                        distance2 +
                        distance3 +
                        transfer1.distance +
                        transfer2.distance,
                      totalFare: Math.round(fare1 + fare2 + fare3),
                      transferPoints: [transfer1, transfer2],
                      transferDistances: [
                        transfer1.distance,
                        transfer2.distance,
                      ],
                    });
                  });
                });
              }
            });
          }
        });
      });
    }

    // Sort routes by a combination of factors
    possibleRoutes.sort((a, b) => {
      // First prioritize by number of transfers
      const aTransfers =
        a.type === "direct" ? 0 : a.type === "combined" ? 1 : 2;
      const bTransfers =
        b.type === "direct" ? 0 : b.type === "combined" ? 1 : 2;

      if (aTransfers !== bTransfers) {
        return aTransfers - bTransfers; // Prefer fewer transfers
      }

      // Create a composite score that considers:
      // - Fare (30% weight)
      // - Distance (40% weight)
      // - Transfer distance if applicable (30% weight)

      const getFareScore = (route) => route.totalFare / 50; // Normalize fare (assuming max ~50)
      const getDistanceScore = (route) => route.totalDistance / 5000; // Normalize distance (assuming max ~5km)

      // For transfer distance, use actual transfer distance or 0 for direct routes
      const getTransferScore = (route) => {
        if (route.type === "direct") return 0;
        if (route.type === "combined")
          return route.transferDistance / MAX_TRANSFER_DISTANCE;
        if (route.type === "triple") {
          return (
            (route.transferDistances[0] + route.transferDistances[1]) /
            (MAX_TRANSFER_DISTANCE * 2)
          );
        }
        return 0;
      };

      const aScore =
        0.3 * getFareScore(a) +
        0.4 * getDistanceScore(a) +
        0.3 * getTransferScore(a);
      const bScore =
        0.3 * getFareScore(b) +
        0.4 * getDistanceScore(b) +
        0.3 * getTransferScore(b);

      return aScore - bScore;
    });

    // Select the best routes
    const bestRoutes = possibleRoutes.slice(
      0,
      Math.min(3, possibleRoutes.length)
    );
    const bestRoute = bestRoutes.length > 0 ? bestRoutes[0] : null;

    if (bestRoute) {
      console.log("Best route found:", bestRoute);
      visualizeRouteCombination(bestRoute, allRoutes, mapInstance);

      // Log all options for debugging
      console.log(
        `Found ${possibleRoutes.length} possible routes. Top options:`,
        bestRoutes
      );
    } else {
      console.log("No valid routes found.");
    }

    return {
      bestRoute,
      allOptions: bestRoutes,
    };
  };

  // Visualize the selected route combination on the map
  const visualizeRouteCombination = (route, allRoutes, mapInstance) => {
    if (!mapInstance) return;

    // Clear any existing markers or highlighted routes
    mapInstance.eachLayer((layer) => {
      if (
        layer instanceof L.Marker &&
        layer.options.icon &&
        layer.options.icon.options.className === "transfer-marker"
      ) {
        mapInstance.removeLayer(layer);
      }
    });

    // Reset all route styles
    allRoutes.forEach((r) => {
      if (r.polyline) {
        r.polyline.setStyle({ opacity: 0.2 });
      }
    });

    // Highlight the transportation segments
    route.steps.forEach((step) => {
      const routeObj = allRoutes.find((r) => r.name === step.routeName);
      if (routeObj && routeObj.polyline) {
        routeObj.polyline.setStyle({ opacity: 1, weight: 5 });

        // Optional: Highlight specific segment of the route being used
        if (step.segmentStart !== undefined && step.segmentEnd !== undefined) {
          const useCoords = routeObj.routedCoordinates || routeObj.coordinates;
          const segmentCoords = useCoords
            .slice(
              Math.min(step.segmentStart, step.segmentEnd),
              Math.max(step.segmentStart, step.segmentEnd) + 1
            )
            .map((coord) => [coord[1], coord[0]]);

          if (segmentCoords.length > 1) {
            L.polyline(segmentCoords, {
              color: routeObj.type === "PUJ" ? "#0055ff" : "#ff6600",
              weight: 6,
              opacity: 1,
            }).addTo(mapInstance);
          }
        }
      }
    });

    // Add markers for transfer points
    if (route.type === "combined" && route.transferPoint) {
      // For two-route combination
      L.marker([route.transferPoint.point1[1], route.transferPoint.point1[0]], {
        icon: L.divIcon({
          className: "transfer-marker",
          html: '<div style="background-color:#ff6b6b;width:14px;height:14px;border-radius:50%;border:2px solid white;"></div>',
          iconSize: [14, 14],
        }),
      })
        .addTo(mapInstance)
        .bindTooltip(
          `Transfer: ${route.steps[0].routeName} → ${route.steps[1].routeName}<br>` +
            `Distance: ${Math.round(route.transferPoint.distance)}m`
        );
    } else if (route.type === "triple" && route.transferPoints) {
      // For three-route combination
      route.transferPoints.forEach((tp, idx) => {
        const fromRoute = route.steps[idx].routeName;
        const toRoute = route.steps[idx + 1].routeName;

        L.marker([tp.point1[1], tp.point1[0]], {
          icon: L.divIcon({
            className: "transfer-marker",
            html: '<div style="background-color:#ff6b6b;width:14px;height:14px;border-radius:50%;border:2px solid white;"></div>',
            iconSize: [14, 14],
          }),
        })
          .addTo(mapInstance)
          .bindTooltip(
            `Transfer ${idx + 1}: ${fromRoute} → ${toRoute}<br>` +
              `Distance: ${Math.round(tp.distance)}m`
          );
      });
    }
  };

  const formatRouteName = (route) => {
    if (route.type === "direct") {
      return `${route.steps[0].routeName} (${route.steps[0].mode})`;
    }

    if (route.type === "combined") {
      return `${route.steps[0].routeName} → ${route.steps[1].routeName}`;
    }

    if (route.type === "triple") {
      return `${route.steps[0].routeName} → ${route.steps[1].routeName} → ${route.steps[2].routeName}`;
    }

    return "Custom Route";
  };

  // Calculate estimated travel time
  const calculateEstimatedTime = (route) => {
    let totalMinutes = 0;

    route.steps.forEach((step, index) => {
      // For PUJ and Tricycle, estimate based on distance
      // PUJ average speed: 20 km/h (333 meters/min)
      // Tricycle average speed: 15 km/h (250 meters/min)
      const speedMetersPerMinute = step.mode === "PUJ" ? 333 : 250;
      totalMinutes += step.distance / speedMetersPerMinute;

      // Add transfer time (waiting time) for all legs except the first
      if (index > 0) {
        // Waiting time depends on transport type
        const waitingTime = step.mode === "PUJ" ? 5 : 3;
        totalMinutes += waitingTime;

        // Add walking time for transfers based on transfer distance
        if (route.type === "combined" && index === 1) {
          const walkingTimeMinutes = route.transferPoint.distance / 80; // 80m per minute walking speed
          totalMinutes += walkingTimeMinutes;
        } else if (route.type === "triple") {
          const walkingTimeMinutes = route.transferDistances[index - 1] / 80;
          totalMinutes += walkingTimeMinutes;
        }
      }
    });

    return Math.round(totalMinutes);
  };

  // Update the findBestRoute to use our improved approach
  const findBestRoute = async (start, destination, mapInstance) => {
    console.log("Finding best route from:", start, "to:", destination);

    const parseCoordinates = (coords) => {
      if (!coords) return null;
      const [lng, lat] = coords.split(",").map(Number);
      return isNaN(lat) || isNaN(lng) ? null : [lng, lat];
    };

    const startCoords = parseCoordinates(start);
    const endCoords = parseCoordinates(destination);

    if (!startCoords || !endCoords) {
      console.error("Invalid start or destination coordinates");
      return null;
    }

    // Use the improved route combination function
    const routeResult = findBestRouteCombination(
      startCoords,
      endCoords,
      mapInstance
    );

    if (!routeResult || !routeResult.bestRoute) {
      console.error("No valid route found");
      return null;
    }

    // Return the best route with additional information
    return {
      name: formatRouteName(routeResult.bestRoute),
      steps: routeResult.bestRoute.steps,
      totalDistance: Math.round(routeResult.bestRoute.totalDistance),
      totalFare: routeResult.bestRoute.totalFare,
      estimatedTime: calculateEstimatedTime(routeResult.bestRoute),
      routeType: routeResult.bestRoute.type,
      allOptions: routeResult.allOptions,
    };
  };

  return {
    loadRoutes,
    findBestRoute,
    findBestRouteCombination,
  };
}
