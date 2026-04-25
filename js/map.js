const { REGIONS, fetchForecast, fetchTide, calculateRegionalScore, findBestSnorkelTime, getScoreColor, toCardinal } = window.SnorkelShared;

const TIDE_CHART_WIDTH = 320;
const TIDE_CHART_HEIGHT = 210;
const TIDE_CHART_PAD_X = 18;
const TIDE_CHART_PAD_TOP = 42;
const TIDE_CHART_PAD_BOTTOM = 48;

const ICONS = {
  wind: "assets/wind_emoji.svg",
  waves: "assets/wave_emoji.svg",
  swell: "assets/swell_emoji.svg",
  sea: "assets/water_temp_emoji.svg",
  current: "assets/current_emoji.svg",
  weatherSun: "assets/sun_emoji.svg",
  weatherCloud: "assets/cloud_emoji.svg",
  weatherRain: "assets/rain_emoji.svg",
  bestWindow: "assets/best_time_emoji.svg",
  tide: "assets/tide_emoji.svg"
};

function formatClock(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function estimateLabelWidth(text, perChar, base) {
  return text.length * perChar + base;
}

function toSafeId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildWeatherCard(data) {
  if (Number.isFinite(data.rain) && data.rain > 0.01) {
    return {
      icon: ICONS.weatherRain,
      label: "Weather",
      value: `${data.rain.toFixed(2)} in of rain`
    };
  }

  if ((data.clouds ?? 0) > 60) {
    return {
      icon: ICONS.weatherCloud,
      label: "Weather",
      value: `${Math.round(data.clouds)}% cloud cover`
    };
  }

  return {
    icon: ICONS.weatherSun,
    label: "Weather",
    value: `${Math.round(data.clouds ?? 0)}% cloud cover`
  };
}

function buildConditionCards(data) {
  if (!data) {
    return '<div class="map-popup-unavailable">Conditions unavailable</div>';
  }

  const weather = buildWeatherCard(data);
  const cards = [
    {
      icon: ICONS.sea,
      label: "Sea",
      value: `${Number.isFinite(data.temp) ? data.temp.toFixed(1) : "--"}°F`
    },
    {
      icon: ICONS.wind,
      label: "Wind",
      value: `${Number.isFinite(data.windSpeed) ? data.windSpeed.toFixed(1) : "--"} mph ${toCardinal(data.windDir)}`
    },
    {
      icon: ICONS.waves,
      label: "Waves",
      value: `${Number.isFinite(data.waveHeight) ? data.waveHeight.toFixed(1) : "--"} ft`
    },
    {
      icon: ICONS.current,
      label: "Current",
      value: `${Number.isFinite(data.currentSpeed) ? data.currentSpeed.toFixed(1) : "--"} mph ${toCardinal(data.currentDir)}`
    },
    weather,
    {
      icon: ICONS.swell,
      label: "Swell",
      value: `${Number.isFinite(data.swellHeight) ? data.swellHeight.toFixed(1) : "--"} ft${Number.isFinite(data.swellPeriod) && data.swellPeriod > 0 ? ` · ${data.swellPeriod.toFixed(0)}s` : ""}`
    }
  ];

  return cards
    .map(
      (card) => `
        <div class="map-condition-chip">
          <div class="map-condition-head">
            <img src="${card.icon}" alt="" class="map-chip-icon">
            <strong>${card.label}</strong>
          </div>
          <span>${card.value}</span>
        </div>
      `
    )
    .join("");
}

function buildBestTimeBanner(best) {
  const color = getScoreColor(best?.score ?? 0);
  return `
    <div class="map-best-window-banner">
      <div class="map-best-window-head">
        <img src="${ICONS.bestWindow}" alt="" class="map-chip-icon">
        <strong>Next best time</strong>
      </div>
      <span>${best?.time || "N/A"} · <em style="color:${color};">${best?.score ?? 0}/10</em></span>
    </div>
  `;
}

function buildTideSummary(tideData) {
  if (!tideData) {
    return '<div class="map-popup-unavailable">Tide data unavailable</div>';
  }

  const trend = tideData.isRising ? "Rising" : "Falling";
  const detail = tideData.tideSummary || "Tide data unavailable";

  return `
    <div class="map-tide-summary">
      <div class="map-tide-summary-head">
        <div class="map-tide-summary-label">
          <img src="${ICONS.tide}" alt="" class="map-chip-icon">
          <strong>Tide</strong>
        </div>
        <span class="map-tide-trend">${trend}</span>
      </div>
      <div class="map-tide-summary-body">
        <span class="map-tide-summary-text">${detail}</span>
      </div>
    </div>
  `;
}

function bindPopupToggles(map) {
  map.on("popupopen", (event) => {
    const popupEl = event.popup.getElement();
    if (!popupEl) {
      return;
    }

    const popupContent = popupEl.querySelector(".leaflet-popup-content");
    if (popupContent) {
      L.DomEvent.disableScrollPropagation(popupContent);
    }
  });
}

function initializeMap() {
  const map = L.map("map").setView([21.4389, -157.9561], 10);

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri"
  }).addTo(map);

  bindPopupToggles(map);

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
        const [forecast, tideData] = await Promise.all([
          fetchForecast(region, { forecastHours: 24 }),
          fetchTide(region.stationId)
        ]);
        const score = calculateRegionalScore(forecast.current, region);
        const best = findBestSnorkelTime(forecast.hourly || [], region);
        return { region, score, data: forecast.current, tideData, best };
      } catch (error) {
        console.error(`Error fetching data for ${region.title}:`, error);
        return { region, score: 0, data: null, tideData: null, best: { time: "N/A", score: 0 } };
      }
    })
  )
    .then((results) => {
      results.forEach(({ region, score, data, tideData, best }) => {
        const color = getScoreColor(score);
        const popupContent = `
          <div class="region-popup">
            <div class="map-popup-top">
              <div>
                <h3>${region.title}</h3>
                <div class="towns">${region.towns}</div>
              </div>
              <div class="score" style="color:${color}; border-color:${color};">${score}/10</div>
            </div>
            ${buildBestTimeBanner(best)}
            <div class="map-popup-grid">
              ${buildConditionCards(data)}
            </div>
            ${buildTideSummary(tideData)}
          </div>
        `;

        L.marker([region.lat, region.lng], { icon: createMarkerIcon(score) })
          .bindPopup(popupContent, {
            maxWidth: 435,
            minWidth: 0
          })
          .addTo(map);
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
