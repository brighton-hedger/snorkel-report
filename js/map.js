// ==================== ENHANCED MAP SCRIPT ====================
const { REGIONS, fetchForecast, calculateRegionalScore, getScoreColor, toCardinal } = window.SnorkelShared;

function initializeMap() {
  const map = L.map("map").setView([21.4389, -157.9561], 10);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri"
  }).addTo(map);

  const createMarkerIcon = (score) => {
    const color = getScoreColor(score);
    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
        background: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">${score}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  };

  Promise.all(
    REGIONS.map(async (region) => {
      try {
        const forecast = await fetchForecast(region, { forecastHours: 24 });
        const score = calculateRegionalScore(forecast.current, region);
        return { region, score, data: forecast.current };
      } catch (error) {
        console.error(`Error fetching data for ${region.title}:`, error);
        return { region, score: 0, data: null };
      }
    })
  )
    .then((results) => {
      results.forEach(({ region, score, data }) => {
        const color = getScoreColor(score);
        const popupContent = `
          <div class="region-popup">
            <h3>${region.title}</h3>
            <div class="towns">${region.towns}</div>
            <div class="score" style="color:${color}">${score}/10</div>
            <div class="conditions">
              ${
                data
                  ? `
                <div>Sea: ${Number.isFinite(data.temp) ? data.temp.toFixed(1) : "--"}F</div>
                <div>Wind: ${Number.isFinite(data.windSpeed) ? data.windSpeed.toFixed(1) : "--"} mph ${toCardinal(data.windDir)}</div>
                <div>Waves: ${Number.isFinite(data.waveHeight) ? data.waveHeight.toFixed(1) : "--"} ft</div>
                <div>Swell: ${Number.isFinite(data.swellHeight) ? data.swellHeight.toFixed(1) : "--"} ft @ ${Number.isFinite(data.swellPeriod) ? data.swellPeriod.toFixed(0) : "--"}s</div>
                <div>Current: ${Number.isFinite(data.currentSpeed) ? data.currentSpeed.toFixed(1) : "--"} mph ${toCardinal(data.currentDir)}</div>
              `
                  : "Conditions unavailable"
              }
            </div>
          </div>
        `;

        L.marker([region.lat, region.lng], { icon: createMarkerIcon(score) }).bindPopup(popupContent).addTo(map);
      });
    })
    .catch((error) => {
      console.error("Error loading map data:", error);
    });

  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function onAdd() {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">Snorkel Score</div>
      <div class="legend-item">
        <div class="legend-color" style="background: #1eaa5a;"></div>
        <span>8-10 (Great)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #e6a800;"></div>
        <span>5-7 (Fair)</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #cc3300;"></div>
        <span>1-4 (Poor)</span>
      </div>
    `;
    return div;
  };
  legend.addTo(map);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMap);
} else {
  initializeMap();
}
