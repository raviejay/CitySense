import { ref } from "vue";
import Ors from "openrouteservice-js";
import L from "leaflet";
import { useRoutesStore } from "@/stores/routeStore";
import precalculatedRoutes from "@/data/precalculatedRoutes.json";
import precalculatedTricycleRoutes from "@/data/precalculatedTricycleRoutes.json";

// Constants
const ORS_API_KEY = "5b3ce3597851110001cf62489cfc14e709f446268359f1fe73a6dc38";
const MAX_TRANSFER_DISTANCE = 300; // meters
const PUJ_BASE_FARE = 13.0; // Base fare for first 4km
const PUJ_BASE_DISTANCE = 4000; // meters (4km)
const PUJ_ADDITIONAL_FARE_PER_KM = 1.75; // Additional fare per km

// Initialize ORS client
const orsDirections = new Ors.Directions({ api_key: ORS_API_KEY });

export function useRoutes() {
  const store = useRoutesStore();

  // Helper functions
  const calculateDistance = (point1, point2) => {
    // Haversine formula implementation
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;
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

  const calculatePUJFare = (distanceInMeters) => {
    if (distanceInMeters <= PUJ_BASE_DISTANCE) {
      return PUJ_BASE_FARE;
    }
    const additionalDistanceKm = (distanceInMeters - PUJ_BASE_DISTANCE) / 1000;
    const additionalFare =
      Math.ceil(additionalDistanceKm) * PUJ_ADDITIONAL_FARE_PER_KM;
    return PUJ_BASE_FARE + additionalFare;
  };

  // Route Loading Functions
  const loadRouteData = (routeData, type) => {
    return Object.entries(routeData).map(([name, route]) => ({
      name,
      type,
      coordinates: route.originalCoordinates,
      routedCoordinates: route.routedCoordinates,
      polyline: null,
      orsDistance: route.distance,
      fare: route.fare,
      description: route.description,
    }));
  };

  const drawRouteOnMap = (route, mapInstance) => {
    try {
      const routeColor = route.type === "PUJ" ? "blue" : "orange";
      const coordsToUse = route.routedCoordinates || route.coordinates;

      route.polyline = L.polyline(
        coordsToUse.map((coord) => [coord[1], coord[0]]),
        { color: routeColor, weight: 4, opacity: 0.5 }
      ).addTo(mapInstance);

      return true;
    } catch (error) {
      console.error(`Error loading route ${route.name}:`, error);
      return false;
    }
  };

  const loadRoutes = async (mapInstance) => {
    if (!mapInstance) return;

    const drawnRoutes = loadRouteData(precalculatedRoutes, "PUJ");
    const tricycleRoutes = loadRouteData(
      precalculatedTricycleRoutes,
      "Tricycle"
    );
    const allRoutes = [...drawnRoutes, ...tricycleRoutes];

    allRoutes.forEach((route) => drawRouteOnMap(route, mapInstance));
    store.setRoutes(allRoutes);
    console.log("All routes loaded and saved in store:", store.getRoutes());
  };

  // Geometry Functions
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
    const param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;

    if (param < 0) {
      [xx, yy] = [x1, y1];
    } else if (param > 1) {
      [xx, yy] = [x2, y2];
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
      const closestPoint = getClosestPointOnSegment(
        point,
        segmentStart,
        segmentEnd
      );
      const distance = calculateDistance(point, closestPoint);

      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = closestPoint;
        segmentIndex = i;
      }
    }

    return { point: nearestPoint, distance: minDistance, segmentIndex };
  };

  const calculateDistanceAlongRoute = (route, startIndex, endIndex) => {
    const useCoords = route.routedCoordinates || route.coordinates;
    const validStart = Math.max(0, Math.min(startIndex, useCoords.length - 1));
    const validEnd = Math.max(0, Math.min(endIndex, useCoords.length - 1));
    const [start, end] = [
      Math.min(validStart, validEnd),
      Math.max(validStart, validEnd),
    ];

    let totalDistance = 0;
    for (let i = start; i < end; i++) {
      totalDistance += calculateDistance(useCoords[i], useCoords[i + 1]);
    }
    return totalDistance;
  };

  // Graph Construction and A* Algorithm
  const buildTransportGraph = (startCoords, endCoords, allRoutes) => {
    const graph = { nodes: [], edges: {}, startNodes: [], endNodes: [] };

    // Helper functions for graph construction
    const createRouteNodes = (route) => {
      const useCoords = route.routedCoordinates || route.coordinates;
      const samplingRate = Math.max(1, Math.floor(useCoords.length / 20));

      for (let i = 0; i < useCoords.length; i += samplingRate) {
        const nodeId = `${route.name}_${i}`;
        graph.nodes.push({
          id: nodeId,
          routeName: route.name,
          routeType: route.type,
          point: useCoords[i],
          segmentIndex: i,
        });
        graph.edges[nodeId] = [];

        // Connect to previous node if exists
        if (i > 0) {
          const prevNodeId = `${route.name}_${i - samplingRate}`;
          const distance = calculateDistanceAlongRoute(
            route,
            i - samplingRate,
            i
          );
          const fare =
            route.type === "PUJ" ? calculatePUJFare(distance) : route.fare;

          // Bidirectional connection
          [prevNodeId, nodeId].forEach((from, idx) => {
            const to = idx === 0 ? nodeId : prevNodeId;
            graph.edges[from].push({
              to,
              routeName: route.name,
              routeType: route.type,
              distance,
              fare,
              transferDistance: 0,
              isTransfer: false,
            });
          });
        }
      }
    };

    const addSpecialNodes = (coords, route, isStart) => {
      const proximity = findNearestPointOnRoute(
        coords,
        route.routedCoordinates || route.coordinates
      );
      if (proximity.distance > MAX_TRANSFER_DISTANCE) return null;

      const nodeType = isStart ? "start" : "end";
      const nodeId = `${nodeType}_${route.name}_${proximity.segmentIndex}`;

      graph.nodes.push({
        id: nodeId,
        routeName: route.name,
        routeType: route.type,
        point: proximity.point,
        segmentIndex: proximity.segmentIndex,
        isStartPoint: isStart,
        isEndPoint: !isStart,
      });

      graph.edges[nodeId] = [];
      isStart ? graph.startNodes.push(nodeId) : graph.endNodes.push(nodeId);

      // Connect to nearby nodes on same route
      graph.nodes.forEach((node) => {
        if (
          node.routeName === route.name &&
          !node.isStartPoint &&
          !node.isEndPoint
        ) {
          const distance = calculateDistanceAlongRoute(
            route,
            isStart ? proximity.segmentIndex : node.segmentIndex,
            isStart ? node.segmentIndex : proximity.segmentIndex
          );

          const fare =
            route.type === "PUJ" ? calculatePUJFare(distance) : route.fare;
          const edge = {
            to: isStart ? node.id : nodeId,
            routeName: route.name,
            routeType: route.type,
            distance,
            fare,
            transferDistance: 0,
            isTransfer: false,
          };

          graph.edges[isStart ? nodeId : node.id].push(edge);
        }
      });

      return nodeId;
    };

    const addTransferEdges = () => {
      for (let i = 0; i < graph.nodes.length; i++) {
        const nodeA = graph.nodes[i];
        if (nodeA.isStartPoint || nodeA.isEndPoint) continue;

        for (let j = i + 1; j < graph.nodes.length; j++) {
          const nodeB = graph.nodes[j];
          if (
            nodeA.routeName === nodeB.routeName ||
            nodeB.isStartPoint ||
            nodeB.isEndPoint
          )
            continue;

          const transferDistance = calculateDistance(nodeA.point, nodeB.point);
          if (transferDistance <= MAX_TRANSFER_DISTANCE) {
            [nodeA.id, nodeB.id].forEach((from, idx) => {
              const to = idx === 0 ? nodeB.id : nodeA.id;
              graph.edges[from].push({
                to,
                routeName: "transfer",
                routeType: "walking",
                distance: 0,
                fare: 0,
                transferDistance,
                isTransfer: true,
              });
            });
          }
        }
      }
    };

    // Build the graph
    allRoutes.forEach(createRouteNodes);

    // Add start and end nodes
    allRoutes.forEach((route) => {
      addSpecialNodes(startCoords, route, true);
      addSpecialNodes(endCoords, route, false);
    });

    addTransferEdges();
    return graph;
  };

  const aStarSearch = (graph, startNodeId, endNodeId, endCoords) => {
    const openSet = new Set([startNodeId]);
    const closedSet = new Set();
    const cameFrom = {};
    const gScore = {};
    const fScore = {};
    const transferCount = {};
    const edgeUsed = {};

    // Initialize scores
    graph.nodes.forEach((node) => {
      gScore[node.id] = Infinity;
      fScore[node.id] = Infinity;
      transferCount[node.id] = 0;
    });

    gScore[startNodeId] = 0;
    fScore[startNodeId] = heuristic(
      graph.nodes.find((n) => n.id === startNodeId).point,
      endCoords
    );

    // A* main loop
    while (openSet.size > 0) {
      const current = [...openSet].reduce((a, b) =>
        fScore[a] < fScore[b] ? a : b
      );

      if (current === endNodeId) {
        return reconstructRoute(graph, cameFrom, edgeUsed, current);
      }

      openSet.delete(current);
      closedSet.add(current);

      for (const edge of graph.edges[current]) {
        const neighbor = edge.to;
        if (closedSet.has(neighbor)) continue;

        const currentTransfers = transferCount[current];
        const newTransfers = currentTransfers + (edge.isTransfer ? 1 : 0);
        if (newTransfers > 2) continue; // Max 2 transfers

        // Calculate edge cost with weighted factors
        const edgeCost = calculateEdgeCost(edge);

        const tentativeGScore = gScore[current] + edgeCost;
        if (tentativeGScore < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          edgeUsed[neighbor] = edge;
          gScore[neighbor] = tentativeGScore;
          transferCount[neighbor] = newTransfers;
          fScore[neighbor] =
            tentativeGScore +
            heuristic(
              graph.nodes.find((n) => n.id === neighbor).point,
              endCoords
            );
          openSet.add(neighbor);
        }
      }
    }
    return null;
  };

  const calculateEdgeCost = (edge) => {
    // Weight factors
    const DISTANCE_WEIGHT = 0.4;
    const FARE_WEIGHT = 0.3;
    const TRANSFER_WEIGHT = 0.3;
    const TRANSFER_PENALTY = 0.5;

    // Normalized values
    const normalizedDistance = edge.distance / 5000;
    const normalizedFare = edge.fare / 50;
    const normalizedTransfer = edge.transferDistance / MAX_TRANSFER_DISTANCE;

    return (
      DISTANCE_WEIGHT * normalizedDistance +
      FARE_WEIGHT * normalizedFare +
      TRANSFER_WEIGHT * normalizedTransfer +
      (edge.isTransfer ? TRANSFER_PENALTY : 0)
    );
  };

  const heuristic = (point, goalCoords) => {
    return calculateDistance(point, goalCoords) / 5000; // Normalized to 5km
  };

  const reconstructRoute = (graph, cameFrom, edgeUsed, endNodeId) => {
    const path = [endNodeId];
    let current = endNodeId;
    const steps = [];
    let totalDistance = 0;
    let totalFare = 0;
    const transferDistances = [];

    while (cameFrom[current]) {
      const edge = edgeUsed[current];

      if (edge.isTransfer) {
        transferDistances.push(edge.transferDistance);
      } else {
        const fromNode = graph.nodes.find((n) => n.id === cameFrom[current]);
        const toNode = graph.nodes.find((n) => n.id === current);
        const lastStep = steps[steps.length - 1];

        if (lastStep && lastStep.routeName === edge.routeName) {
          // Extend existing step
          lastStep.end = toNode.point;
          lastStep.segmentEnd = toNode.segmentIndex;
          lastStep.distance += edge.distance;

          if (edge.routeType === "PUJ") {
            lastStep.fare = calculatePUJFare(lastStep.distance);
          }
        } else {
          // Add new step
          const stepFare =
            edge.routeType === "PUJ"
              ? calculatePUJFare(edge.distance)
              : edge.fare;

          steps.push({
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
          });

          totalFare += stepFare;
        }
        totalDistance += edge.distance;
      }

      path.push(cameFrom[current]);
      current = cameFrom[current];
    }

    steps.reverse();

    if (steps.length === 1 && steps[0].mode === "PUJ") {
      totalFare = steps[0].fare;
    }

    const routeType =
      steps.length === 1
        ? "direct"
        : steps.length === 2
        ? "combined"
        : "triple";

    return {
      type: routeType,
      steps,
      totalDistance,
      totalFare,
      transferDistances,
      transferPoints: getTransferPoints(steps, graph),
    };
  };

  const getTransferPoints = (steps, graph) => {
    if (steps.length < 2) return [];
    return steps.slice(0, -1).map((step, i) => ({
      point1: step.end,
      point2: steps[i + 1].start,
      distance: calculateDistance(step.end, steps[i + 1].start),
      index1: step.segmentEnd,
      index2: steps[i + 1].segmentStart,
    }));
  };

  // Route Presentation Functions
  const formatRouteName = (route) => {
    if (!route) return "Unknown Route";
    if (route.type === "direct")
      return `${route.steps[0].routeName} (${route.steps[0].mode})`;

    const routeNames = route.steps.map((step) => step.routeName);
    return routeNames.join(" → ");
  };

  const calculateEstimatedTime = (route) => {
    if (!route?.steps) return 0;

    let totalMinutes = 0;
    const SPEEDS = { PUJ: 333, Tricycle: 250 }; // meters per minute

    route.steps.forEach((step, index) => {
      if (!step?.distance) return;

      // Travel time
      totalMinutes +=
        step.distance / SPEEDS[step.mode === "PUJ" ? "PUJ" : "Tricycle"];

      // Transfer time (waiting + walking)
      if (index > 0) {
        totalMinutes += step.mode === "PUJ" ? 5 : 3; // Waiting time
        if (route.transferDistances?.[index - 1]) {
          totalMinutes += route.transferDistances[index - 1] / 80; // Walking time
        }
      }
    });

    return Math.round(totalMinutes);
  };

  const findBestRouteWithAStar = (startCoords, endCoords, mapInstance) => {
    const allRoutes = store.getRoutes();
    const graph = buildTransportGraph(startCoords, endCoords, allRoutes);

    if (!graph.startNodes.length || !graph.endNodes.length) {
      console.error("No valid routes found near start or end points");
      return { bestRoute: null, allOptions: [] };
    }

    // Find all possible routes
    const possibleRoutes = [];
    graph.startNodes.forEach((startNode) => {
      graph.endNodes.forEach((endNode) => {
        const route = aStarSearch(graph, startNode, endNode, endCoords);
        if (route) possibleRoutes.push(route);
      });
    });

    // Sort routes by quality
    possibleRoutes.sort((a, b) => {
      const aTransfers = a.steps.length - 1;
      const bTransfers = b.steps.length - 1;
      if (aTransfers !== bTransfers) return aTransfers - bTransfers;

      const score = (route) =>
        0.3 * (route.totalFare / 50) +
        0.4 * (route.totalDistance / 5000) +
        0.3 *
          ((route.transferDistances?.reduce((sum, dist) => sum + dist, 0) ||
            0) /
            (MAX_TRANSFER_DISTANCE * (route.transferDistances?.length || 1)));

      return score(a) - score(b);
    });

    const bestRoutes = possibleRoutes.slice(0, 3);
    const bestRoute = bestRoutes[0] || null;

    if (bestRoute) {
      visualizeRouteCombination(bestRoute, allRoutes, mapInstance);
    }

    return { bestRoute, allOptions: bestRoutes };
  };

  const visualizeRouteCombination = (route, allRoutes, mapInstance) => {
    if (!mapInstance) return;

    // Clear previous highlights
    mapInstance.eachLayer((layer) => {
      if (
        layer instanceof L.Marker &&
        layer.options.icon?.options.className === "transfer-marker"
      ) {
        mapInstance.removeLayer(layer);
      }
    });

    // Reset all route styles
    allRoutes.forEach((r) => r.polyline?.setStyle({ opacity: 0.2 }));

    // Highlight used routes
    route.steps.forEach((step) => {
      const routeObj = allRoutes.find((r) => r.name === step.routeName);
      if (!routeObj?.polyline) return;

      routeObj.polyline.setStyle({ opacity: 1, weight: 5 });

      // Highlight specific segment
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
    });

    // Add transfer markers
    route.transferPoints?.forEach((transferPoint, index) => {
      const fromRoute = route.steps[index].routeName;
      const toRoute = route.steps[index + 1].routeName;

      L.marker([transferPoint.point1[1], transferPoint.point1[0]], {
        icon: L.divIcon({
          className: "transfer-marker",
          html: '<div style="background-color:#ff6b6b;width:14px;height:14px;border-radius:50%;border:2px solid white;"></div>',
          iconSize: [14, 14],
        }),
      })
        .addTo(mapInstance)
        .bindTooltip(
          `Transfer ${index + 1}: ${fromRoute} → ${toRoute}<br>` +
            `Distance: ${Math.round(transferPoint.distance)}m`
        );
    });
  };

  const findBestRoute = async (start, destination, mapInstance) => {
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

    const routeResult = findBestRouteWithAStar(
      startCoords,
      endCoords,
      mapInstance
    );
    if (!routeResult?.bestRoute) {
      console.error("No valid route found");
      return null;
    }

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
    findBestRouteWithAStar,
  };
}
