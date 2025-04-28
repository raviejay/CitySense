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

// PUJ Fare constants
const PUJ_BASE_FARE = 13.0; // Base fare for first 4km
const PUJ_BASE_DISTANCE = 4000; // Base distance in meters (4km)
const PUJ_ADDITIONAL_FARE_PER_KM = 1.8; // Additional fare per km

export function useRoutes() {
  const store = useRoutesStore();
  let currentDirectRoutePolyline = null;
  let currentRouteVisualization = null;

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
          { color: routeColor, weight: 4, opacity: 0.0 }
        ).addTo(mapInstance);
      } catch (error) {
        console.error(`Error loading route ${route.name}:`, error);
      }
    }

    // Save routes in Pinia store
    store.setRoutes(allRoutes);
    console.log("All routes loaded and saved in store:", store.getRoutes());
  };

  // Calculate PUJ fare based on distance
  const calculatePUJFare = (distanceInMeters) => {
    if (distanceInMeters <= PUJ_BASE_DISTANCE) {
      // If distance is within base distance (4km), return base fare
      return PUJ_BASE_FARE;
    } else {
      // Calculate additional distance beyond base in kilometers
      const additionalDistanceKm =
        (distanceInMeters - PUJ_BASE_DISTANCE) / 1000;
      // Calculate additional fare
      const additionalFare =
        Math.ceil(additionalDistanceKm) * PUJ_ADDITIONAL_FARE_PER_KM;
      // Return total fare (base + additional)
      return PUJ_BASE_FARE + additionalFare;
    }
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

  // Calculate distance along a route from one point to another
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

  // Find valid transfer points between routes
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

  // NEW A* PATHFINDING IMPLEMENTATION
  /**
   * A* (A-Star) Algorithm implementation for finding optimal public transport routes
   *
   * This algorithm finds the shortest path in a weighted graph, using a heuristic
   * to guide the search more efficiently. It's well-suited for transportation routing.
   *
   * Reference: Hart, P. E., Nilsson, N. J., & Raphael, B. (1968). A Formal Basis for the
   * Heuristic Determination of Minimum Cost Paths. IEEE Transactions on Systems Science
   * and Cybernetics, 4(2), 100-107.
   */
  const findBestRouteWithAStar = (startCoords, endCoords, mapInstance) => {
    console.log(
      "Finding best route using A* algorithm from:",
      startCoords,
      "to:",
      endCoords
    );

    //get all routes
    const allRoutes = store.getRoutes();

    // Build the transport graph
    const graph = buildTransportGraph(startCoords, endCoords, allRoutes);

    if (!graph.startNodes.length || !graph.endNodes.length) {
      console.error("No valid routes found near start or end points");
      return { bestRoute: null, allOptions: [] };
    }

    console.log(
      `Found ${graph.startNodes.length} start points and ${graph.endNodes.length} end points`
    );

    const possibleRoutes = [];

    for (const startNode of graph.startNodes) {
      for (const endNode of graph.endNodes) {
        const route = aStarSearch(graph, startNode, endNode, endCoords);
        if (route) {
          possibleRoutes.push(route);
        }
      }
    }

    // Sort routes by a combination of factors (same as before)
    possibleRoutes.sort((a, b) => {
      // First prioritize by number of transfers
      const aTransfers = a.steps.length - 1;
      const bTransfers = b.steps.length - 1;

      if (aTransfers !== bTransfers) {
        return aTransfers - bTransfers; // Prefer fewer transfers
      }

      // Create a composite score
      const getFareScore = (route) => route.totalFare / 16;
      const getDistanceScore = (route) => route.totalDistance / 5000;
      const getTransferScore = (route) => {
        if (route.transferDistances && route.transferDistances.length > 0) {
          return (
            route.transferDistances.reduce((sum, dist) => sum + dist, 0) /
            (MAX_TRANSFER_DISTANCE * route.transferDistances.length)
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
      console.log("Best routes found with A*:", bestRoute);
      visualizeRouteCombination(bestRoute, allRoutes, mapInstance);

      console.log(
        `Found ${possibleRoutes.length} possible routes using A*. Top options:`,
        bestRoutes
      );
    } else {
      console.log("No valid routes found with A*.");
    }

    return {
      bestRoute,
      allOptions: bestRoutes,
    };
  };

  /**
   * Builds a transportation network graph for A* algorithm
   * Nodes are points on routes, edges are connections between these points
   */
  const buildTransportGraph = (startCoords, endCoords, allRoutes) => {
    const graph = {
      nodes: [],
      edges: {},
      startNodes: [],
      endNodes: [],
    };

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

    // Create nodes for each route
    allRoutes.forEach((route) => {
      const useCoords = route.routedCoordinates || route.coordinates;

      // Create nodes for key points on each route (start, end, and some intermediate points)
      // We don't need a node for every coordinate to keep the graph manageable
      const samplingRate = Math.max(1, Math.floor(useCoords.length / 20)); // Sample ~10 points

      for (let i = 0; i < useCoords.length; i += samplingRate) {
        const nodeId = `${route.name}_${i}`;
        const point = useCoords[i];

        graph.nodes.push({
          id: nodeId,
          routeName: route.name,
          routeType: route.type,
          point: point,
          segmentIndex: i,
        });

        // Initialize empty adjacency list
        graph.edges[nodeId] = [];

        // If not the first node, connect to previous node on this route
        if (i > 0) {
          const prevNodeId = `${route.name}_${i - samplingRate}`;
          const distance = calculateDistanceAlongRoute(
            route,
            i - samplingRate,
            i
          );

          let fare;
          if (route.type === "PUJ") {
            fare = calculatePUJFare(distance);
          } else {
            fare = route.fare; // Fixed fare for tricycle
          }

          // Add edge in both directions (bidirectional graph)
          graph.edges[prevNodeId].push({
            to: nodeId,
            routeName: route.name,
            routeType: route.type,
            distance: distance,
            fare: fare,
            transferDistance: 0,
            isTransfer: false,
          });

          graph.edges[nodeId].push({
            to: prevNodeId,
            routeName: route.name,
            routeType: route.type,
            distance: distance,
            fare: fare,
            transferDistance: 0,
            isTransfer: false,
          });
        }
      }
    });

    // Add special nodes for start and end positions
    startRoutePoints.forEach((startPoint) => {
      const useCoords =
        startPoint.route.routedCoordinates || startPoint.route.coordinates;
      const nodeId = `start_${startPoint.route.name}_${startPoint.proximity.segmentIndex}`;
      const point = startPoint.proximity.point;

      graph.nodes.push({
        id: nodeId,
        routeName: startPoint.route.name,
        routeType: startPoint.route.type,
        point: point,
        segmentIndex: startPoint.proximity.segmentIndex,
        isStartPoint: true,
      });

      graph.edges[nodeId] = [];
      graph.startNodes.push(nodeId);

      // Connect to nearby nodes on the same route
      graph.nodes.forEach((node) => {
        if (
          node.routeName === startPoint.route.name &&
          !node.isStartPoint &&
          !node.isEndPoint
        ) {
          const distance = calculateDistanceAlongRoute(
            startPoint.route,
            startPoint.proximity.segmentIndex,
            node.segmentIndex
          );

          let fare;
          if (startPoint.route.type === "PUJ") {
            fare = calculatePUJFare(distance);
          } else {
            fare = startPoint.route.fare;
          }

          graph.edges[nodeId].push({
            to: node.id,
            routeName: startPoint.route.name,
            routeType: startPoint.route.type,
            distance: distance,
            fare: fare,
            transferDistance: 0,
            isTransfer: false,
          });
        }
      });
    });

    endRoutePoints.forEach((endPoint) => {
      const useCoords =
        endPoint.route.routedCoordinates || endPoint.route.coordinates;
      const nodeId = `end_${endPoint.route.name}_${endPoint.proximity.segmentIndex}`;
      const point = endPoint.proximity.point;

      graph.nodes.push({
        id: nodeId,
        routeName: endPoint.route.name,
        routeType: endPoint.route.type,
        point: point,
        segmentIndex: endPoint.proximity.segmentIndex,
        isEndPoint: true,
      });

      graph.edges[nodeId] = [];
      graph.endNodes.push(nodeId);

      // Connect from nearby nodes on the same route to this end node
      graph.nodes.forEach((node) => {
        if (
          node.routeName === endPoint.route.name &&
          !node.isStartPoint &&
          !node.isEndPoint
        ) {
          const distance = calculateDistanceAlongRoute(
            endPoint.route,
            node.segmentIndex,
            endPoint.proximity.segmentIndex
          );

          let fare;
          if (endPoint.route.type === "PUJ") {
            fare = calculatePUJFare(distance);
          } else {
            fare = endPoint.route.fare;
          }

          graph.edges[node.id].push({
            to: nodeId,
            routeName: endPoint.route.name,
            routeType: endPoint.route.type,
            distance: distance,
            fare: fare,
            transferDistance: 0,
            isTransfer: false,
          });
        }
      });
    });

    // Add transfer edges between different routes (where applicable)
    for (let i = 0; i < graph.nodes.length; i++) {
      const nodeA = graph.nodes[i];
      // Skip start and end nodes for transfers
      if (nodeA.isStartPoint || nodeA.isEndPoint) continue;

      for (let j = i + 1; j < graph.nodes.length; j++) {
        const nodeB = graph.nodes[j];
        // Skip nodes on the same route or start/end nodes
        if (
          nodeA.routeName === nodeB.routeName ||
          nodeB.isStartPoint ||
          nodeB.isEndPoint
        )
          continue;

        // Calculate transfer distance
        const transferDistance = calculateDistance(nodeA.point, nodeB.point);

        // Only add transfer if within maximum transfer distance
        if (transferDistance <= MAX_TRANSFER_DISTANCE) {
          // Add bidirectional transfer edges
          graph.edges[nodeA.id].push({
            to: nodeB.id,
            routeName: "transfer",
            routeType: "walking",
            distance: 0, // Route distance is 0, we track transfer distance separately
            fare: 0, // No fare for walking transfers
            transferDistance: transferDistance,
            isTransfer: true,
          });

          graph.edges[nodeB.id].push({
            to: nodeA.id,
            routeName: "transfer",
            routeType: "walking",
            distance: 0,
            fare: 0,
            transferDistance: transferDistance,
            isTransfer: true,
          });
        }
      }
    }

    return graph;
  };

  /**
   * A* search algorithm implementation
   * g(n) = cost from start to node n
   * h(n) = estimated cost from node n to goal
   * f(n) = g(n) + h(n)
   */
  const aStarSearch = (graph, startNodeId, endNodeId, endCoords) => {
    // Nodes we've seen but not fully explored
    const openSet = new Set([startNodeId]);

    // Nodes we've fully explored
    const closedSet = new Set();

    // For each node, which node it came from in the optimal path
    const cameFrom = {};

    // For each node, the cost of getting from the start node to that node
    const gScore = {};
    graph.nodes.forEach((node) => {
      gScore[node.id] = Infinity;
    });
    gScore[startNodeId] = 0;

    // For each node, the estimated total cost from start to goal through that node
    const fScore = {};
    graph.nodes.forEach((node) => {
      fScore[node.id] = Infinity;
    });

    // Set initial fScore for start node using heuristic
    const startNode = graph.nodes.find((node) => node.id === startNodeId);
    fScore[startNodeId] = heuristic(startNode.point, endCoords);

    // Track the edges used in the path
    const edgeUsed = {};

    // Maximum number of transfers allowed
    const MAX_TRANSFERS = 2;

    // Track number of transfers used to reach each node
    const transferCount = {};
    graph.nodes.forEach((node) => {
      transferCount[node.id] = 0;
    });

    // Main A* algorithm loop
    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
      let current = null;
      let lowestFScore = Infinity;

      for (const nodeId of openSet) {
        if (fScore[nodeId] < lowestFScore) {
          lowestFScore = fScore[nodeId];
          current = nodeId;
        }
      }

      // If we've reached our goal, reconstruct path
      if (current === endNodeId) {
        return reconstructRoute(graph, cameFrom, edgeUsed, current);
      }

      // Remove current node from openSet and add to closedSet
      openSet.delete(current);
      closedSet.add(current);

      // Check each neighboring node
      for (const edge of graph.edges[current]) {
        const neighbor = edge.to;

        // Skip if already evaluated
        if (closedSet.has(neighbor)) continue;

        // Skip if adding this edge would exceed maximum transfer count
        const currentTransfers = transferCount[current];
        const newTransfers = currentTransfers + (edge.isTransfer ? 1 : 0);
        if (newTransfers > MAX_TRANSFERS) continue;

        // Calculate tentative gScore
        // We use a weighted combination of distance, fare, and transfer penalties
        const distance = edge.distance;
        const fare = edge.fare;
        const transferDistance = edge.transferDistance;

        // Weight factors
        const DISTANCE_WEIGHT = 0.4;
        const FARE_WEIGHT = 0.3;
        const TRANSFER_WEIGHT = 0.3;
        const TRANSFER_PENALTY = 0.5;

        // Normalize scores
        const normalizedDistance = distance / 5000; // Normalized to 35000km
        const normalizedFare = fare / 16; // Normalized to 50 units
        const normalizedTransfer = transferDistance / MAX_TRANSFER_DISTANCE;

        const edgeCost =
          DISTANCE_WEIGHT * normalizedDistance +
          FARE_WEIGHT * normalizedFare +
          TRANSFER_WEIGHT * normalizedTransfer +
          (edge.isTransfer ? TRANSFER_PENALTY : 0);

        const tentativeGScore = gScore[current] + edgeCost;

        // If this path is better than any previous one, record it
        if (tentativeGScore < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          edgeUsed[neighbor] = edge;
          gScore[neighbor] = tentativeGScore;

          // Update transfer count
          transferCount[neighbor] = newTransfers;

          // Calculate fScore = gScore + heuristic
          const neighborNode = graph.nodes.find((node) => node.id === neighbor);
          fScore[neighbor] =
            gScore[neighbor] + heuristic(neighborNode.point, endCoords);

          // Add to openSet if not already there
          openSet.add(neighbor);
        }
      }
    }

    // No path found
    return null;
  };

  /**
   * Heuristic function for A* - estimates distance to goal
   * Using Haversine distance for geographical coordinates
   */
  const heuristic = (point, goalCoords) => {
    return calculateDistance(point, goalCoords) / 5000; // Normalize to 5km
  };

  /**
   * Reconstructs the route from A* result
   */
  const reconstructRoute = (graph, cameFrom, edgeUsed, endNodeId) => {
    // The full path from end to start (reversed)
    const path = [endNodeId];
    let current = endNodeId;

    // Steps array for the final route
    const steps = [];
    let totalDistance = 0;
    const transferDistances = [];

    // Reconstruct the path by following cameFrom
    while (cameFrom[current]) {
      const edge = edgeUsed[current];

      if (edge.isTransfer) {
        // Handle transfers
        transferDistances.push(edge.transferDistance);
      } else {
        // Handle regular route segments
        const fromNode = graph.nodes.find(
          (node) => node.id === cameFrom[current]
        );
        const toNode = graph.nodes.find((node) => node.id === current);

        // Check if we should add a new step or extend the current one
        const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;

        if (lastStep && lastStep.routeName === edge.routeName) {
          // Extend existing step - only add the incremental distance
          lastStep.end = toNode.point;
          lastStep.segmentEnd = toNode.segmentIndex;

          // Calculate the incremental fare for this segment
          const incrementalDistance = edge.distance;
          lastStep.distance += incrementalDistance;

          if (edge.routeType === "PUJ") {
            // For PUJ, we need to recalculate the total fare for the entire distance
            lastStep.fare = calculatePUJFare(lastStep.distance);
          }
          // For tricycles, fare remains the same when extending
        } else {
          // Add new step
          const stepFare =
            edge.routeType === "PUJ"
              ? calculatePUJFare(edge.distance)
              : edge.fare;

          const newStep = {
            mode: edge.routeType,
            routeName: edge.routeName,
            start: fromNode.point,
            end: toNode.point,
            segmentStart: fromNode.segmentIndex,
            segmentEnd: toNode.segmentIndex,
            distance: edge.distance,
            fare: stepFare,
            description:
              edge.routeType === "PUJ"
                ? "Public Utility Jeepney Route"
                : "Tricycle Route",
          };
          steps.push(newStep);
        }

        totalDistance += edge.distance;
      }

      path.push(cameFrom[current]);
      current = cameFrom[current];
    }

    // The path array goes from end to start, so we need to reverse it
    steps.reverse();

    // Calculate total fare by summing up all step fares
    // This ensures we don't double-count any fares
    const totalFare = steps.reduce((sum, step) => sum + step.fare, 0);

    // Extract step fares into a separate array if needed
    const stepFares = steps.map((step) => step.fare);

    // Determine route type based on number of steps
    let routeType;
    if (steps.length === 1) {
      routeType = "direct";
    } else if (steps.length === 2) {
      routeType = "combined";
    } else {
      routeType = "triple";
    }

    // Build the final route object
    return {
      type: routeType,
      steps: steps,
      stepFares: stepFares,
      totalDistance: totalDistance,
      totalFare: totalFare,
      transferDistances: transferDistances,
      transferPoints: getTransferPoints(steps, graph),
    };
  };

  /**
   * Extracts transfer points from the steps
   */
  const getTransferPoints = (steps, graph) => {
    if (steps.length < 2) return [];

    const transferPoints = [];

    for (let i = 0; i < steps.length - 1; i++) {
      const currentStep = steps[i];
      const nextStep = steps[i + 1];

      // Find the transfer point between these two steps
      const transferPoint = {
        point1: currentStep.end,
        point2: nextStep.start,
        distance: calculateDistance(currentStep.end, nextStep.start),
        index1: currentStep.segmentEnd,
        index2: nextStep.segmentStart,
      };

      transferPoints.push(transferPoint);
    }

    return transferPoints;
  };

  const formatRouteName = (route) => {
    if (!route) return "Unknown Route";

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
    if (!route || !route.steps || !Array.isArray(route.steps)) {
      console.error("Invalid route structure in calculateEstimatedTime", route);
      return 0; // Return default value if route is invalid
    }

    let totalMinutes = 0;

    route.steps.forEach((step, index) => {
      if (!step || typeof step.distance !== "number") {
        console.error("Invalid step in route", step);
        return; // Skip invalid steps
      }

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
        if (route.type === "combined" && index === 1 && route.transferPoint) {
          const walkingTimeMinutes = (route.transferPoint.distance || 0) / 80; // 80m per minute walking speed
          totalMinutes += walkingTimeMinutes;
        } else if (route.type === "triple" && route.transferDistances) {
          const walkingTimeMinutes =
            (route.transferDistances[index - 1] || 0) / 80;
          totalMinutes += walkingTimeMinutes;
        }
      }
    });

    return Math.round(totalMinutes);
  };

  // // Update the findBestRoute to use A* algorithm
  // const findBestRoute = async (start, destination, mapInstance) => {
  //   console.log("Finding best route from:", start, "to:", destination);

  //   const parseCoordinates = (coords) => {
  //     if (!coords) return null;
  //     const [lng, lat] = coords.split(",").map(Number);
  //     return isNaN(lat) || isNaN(lng) ? null : [lng, lat];
  //   };

  //   const startCoords = parseCoordinates(start);
  //   const endCoords = parseCoordinates(destination);

  //   if (!startCoords || !endCoords) {
  //     console.error("Invalid start or destination coordinates");
  //     return null;
  //   }

  //   // Use the A* algorithm for route finding
  //   const routeResult = findBestRouteWithAStar(
  //     startCoords,
  //     endCoords,
  //     mapInstance
  //   );

  //   if (!routeResult || !routeResult.bestRoute) {
  //     console.error("No valid route found");
  //     return null;
  //   }

  //   // Return the best route with additional information
  //   return {
  //     name: formatRouteName(routeResult.bestRoute),
  //     steps: routeResult.bestRoute.steps,
  //     totalDistance: Math.round(routeResult.bestRoute.totalDistance),
  //     totalFare: routeResult.bestRoute.totalFare,
  //     estimatedTime: calculateEstimatedTime(routeResult.bestRoute),
  //     routeType: routeResult.bestRoute.type,
  //     allOptions: routeResult.allOptions,
  //   };
  // };

  // Update the visualizeRouteCombination to handle A* results
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
        r.polyline.setStyle({ opacity: 0 });
      }
    });

    // Highlight the transportation segments
    route.steps.forEach((step) => {
      const routeObj = allRoutes.find((r) => r.name === step.routeName);
      if (routeObj && routeObj.polyline) {
        routeObj.polyline.setStyle({ opacity: 0, weight: 5 });

        // Highlight specific segment of the route being used
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
              opacity: 0,
            }).addTo(mapInstance);
          }
        }
      }
    });

    // // Add markers for transfer points
    // if (route.transferPoints && route.transferPoints.length > 0) {
    //   route.transferPoints.forEach((transferPoint, index) => {
    //     const fromRoute = route.steps[index].routeName;
    //     const toRoute = route.steps[index + 1].routeName;

    //     L.marker([transferPoint.point1[1], transferPoint.point1[0]], {
    //       icon: L.divIcon({
    //         className: "transfer-marker",
    //         html: '<div style="background-color:#ff6b6b;width:14px;height:14px;border-radius:50%;border:2px solid white;"></div>',
    //         iconSize: [14, 14],
    //       }),
    //     })
    //       .addTo(mapInstance)
    //       .bindTooltip(
    //         `Transfer ${index + 1}: ${fromRoute} → ${toRoute}<br>` +
    //           `Distance: ${Math.round(transferPoint.distance)}m`
    //       );
    //   });
    // }
  };

  // First, I'll add a function to get the driving route from OpenRouteService
  const getDrivingRoute = async (startCoords, endCoords) => {
    try {
      // Convert coordinates format for ORS API (from [lng, lat] to [lng, lat])
      const start = startCoords;
      const end = endCoords;

      // Request driving route from OpenRouteService
      const routeRequest = {
        coordinates: [start, end],
        profile: "driving-car",
        format: "geojson",
        preference: "shortest",
      };

      const routeData = await orsDirections.calculate(routeRequest);

      if (routeData && routeData.features && routeData.features.length > 0) {
        // Extract coordinates from the GeoJSON response
        const routeCoordinates = routeData.features[0].geometry.coordinates;
        return routeCoordinates;
      }

      return null;
    } catch (error) {
      console.error(
        "Error getting driving route from OpenRouteService:",
        error
      );
      return null;
    }
  };

  // Now, let's add a function to draw this route on the map
  const drawDirectRoute = async (startCoords, endCoords, mapInstance) => {
    if (!mapInstance || !startCoords || !endCoords) return null;

    console.log("Drawing direct route between:", startCoords, "and", endCoords);

    // Get route from OpenRouteService
    const routeCoordinates = await getDrivingRoute(startCoords, endCoords);

    if (!routeCoordinates) {
      console.error("Failed to get direct route coordinates");
      return null;
    }

    // Draw the route on the map
    const directRoutePolyline = L.polyline(
      routeCoordinates.map((coord) => [coord[1], coord[0]]),
      {
        color: "#448AFF",
        weight: 4,
        opacity: 1,
        dashArray: "5, 5",
      }
    ).addTo(mapInstance);

    return {
      polyline: directRoutePolyline,
      coordinates: routeCoordinates,
      startCoords,
      endCoords,
    };
  };

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

    // Draw the direct route first
    const directRoute = await drawDirectRoute(
      startCoords,
      endCoords,
      mapInstance
    );

    // Use the A* algorithm for route finding
    const routeResult = findBestRouteWithAStar(
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
      stepFares: routeResult.bestRoute.stepFares, // Add this line
      totalDistance: Math.round(routeResult.bestRoute.totalDistance),
      totalFare: routeResult.bestRoute.totalFare,
      estimatedTime: calculateEstimatedTime(routeResult.bestRoute),
      routeType: routeResult.bestRoute.type,
      allOptions: routeResult.allOptions,
      directRoute: {
        coordinates: directRoute ? directRoute.coordinates : null,
        distance:
          directRoute && directRoute.coordinates
            ? directRoute.coordinates.reduce((acc, coord, i, arr) => {
                if (i === 0) return acc;
                return acc + calculateDistance(arr[i - 1], coord);
              }, 0)
            : 0,
      },
    };
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

  return {
    loadRoutes,
    findBestRoute,
    findBestRouteWithAStar,
    drawDirectRoute,
    getDrivingRoute,
    formatRouteName,
    drawCalculatedRoute,
  };
}
