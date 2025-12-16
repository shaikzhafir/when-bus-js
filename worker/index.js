export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return Response.json({
        name: "Cloudflare",
      });
    }

    if (url.pathname.startsWith("/getBusArrival")) {
      const busStopCode = url.searchParams.get("busStopCode");
      
      try {
        const busArrivalData = await getBusArrival(busStopCode, env.LTA_API_KEY);
        return Response.json({
          success: true,
          data: busArrivalData
        });
      } catch (error) {
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    return new Response(null, { status: 404 });
  },
};

async function getBusArrival(code, apiKey) {
  // Build URL with query parameters
  const apiUrl = new URL("https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival");
  apiUrl.searchParams.append("BusStopCode", code);

  // Make API request
  const response = await fetch(apiUrl.toString(), {
    method: "GET",
    headers: {
      "AccountKey": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  const busArrivalResp = JSON.parse(body);

  const result = [];

  // Process each service
  for (const svc of busArrivalResp.Services || []) {
    const info = {
      ServiceNo: svc.ServiceNo,
      Operator: svc.Operator,
      NextBuses: [],
      LoadStatus: [],
      IsWheelchair: false,
    };

    // Process arrival times and load status
    const buses = [
      {
        arrival: svc.NextBus?.EstimatedArrival,
        load: svc.NextBus?.Load,
        feature: svc.NextBus?.Feature,
      },
      {
        arrival: svc.NextBus2?.EstimatedArrival,
        load: svc.NextBus2?.Load,
        feature: svc.NextBus2?.Feature,
      },
      {
        arrival: svc.NextBus3?.EstimatedArrival,
        load: svc.NextBus3?.Load,
        feature: svc.NextBus3?.Feature,
      },
    ];

    for (const bus of buses) {
      if (bus.arrival) {
        try {
          const arrivalTime = new Date(bus.arrival);
          const now = new Date();
          const minutesToArrival = (arrivalTime - now) / 1000 / 60; // Convert ms to minutes
          
          info.NextBuses.push(Math.round(minutesToArrival).toString());
          info.LoadStatus.push(bus.load || "");
        } catch (error) {
          console.error("Error parsing arrival time:", error);
        }
      }
      
      if (bus.feature === "WAB") {
        info.IsWheelchair = true;
      }
    }

    result.push(info);
  }

  return result;
}
