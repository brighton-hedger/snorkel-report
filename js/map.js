const { REGIONS, fetchForecast, fetchTide, calculateRegionalScore, findBestSnorkelTime, getScoreColor, toCardinal } = window.SnorkelShared;

const TIDE_CHART_WIDTH = 320;
const TIDE_CHART_HEIGHT = 210;
const TIDE_CHART_PAD_X = 18;
const TIDE_CHART_PAD_TOP = 42;
const TIDE_CHART_PAD_BOTTOM = 48;

const ICONS = {
  wind: "assets/wind_emoji.svg",
  waves: "assets/wave_emoji.svg",
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
      icon: ICONS.waves,
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
        <img src="${ICONS.tide}" alt="" class="map-chip-icon">
        <strong>Tide</strong>
      </div>
      <div class="map-tide-summary-body">
        <span class="map-tide-trend">${trend}</span>
        <span class="map-tide-summary-text">${detail}</span>
      </div>
    </div>
  `;
}

function buildTideChartDisclosure(region, tideData) {
  return `
    <details class="map-tide-disclosure">
      <summary class="map-tide-toggle">Show tide chart</summary>
      <div class="map-tide-disclosure-body">
        ${buildMapTideChart(region, tideData)}
      </div>
    </details>
  `;
}

function buildMapTideChart(region, tideData) {
  const allPoints = (tideData?.predictions || [])
    .map((point) => ({
      date: new Date(point.time),
      value: Number(point.value),
      type: point.type || null
    }))
    .filter((point) => Number.isFinite(point.value) && !Number.isNaN(point.date.getTime()))
    .sort((left, right) => left.date - right.date);
  const curveSeries = (tideData?.curvePredictions?.length ? tideData.curvePredictions : tideData?.predictions || [])
    .map((point) => ({
      date: new Date(point.time),
      value: Number(point.value),
      type: point.type || null
    }))
    .filter((point) => Number.isFinite(point.value) && !Number.isNaN(point.date.getTime()))
    .sort((left, right) => left.date - right.date);

  if (allPoints.length < 2 || curveSeries.length < 2) {
    return `<div class="map-tide-fallback">${tideData?.tideSummary || "Tide data unavailable"}</div>`;
  }

  const dayStart = new Date(curveSeries[0].date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(curveSeries[0].date);
  dayEnd.setHours(23, 59, 0, 0);
  const firstPointTime = curveSeries[0].date.getTime();
  const lastPointTime = curveSeries[curveSeries.length - 1].date.getTime();
  const startTime = Math.min(dayStart.getTime(), firstPointTime);
  const endTime = Math.max(dayEnd.getTime(), lastPointTime);
  const duration = Math.max(endTime - startTime, 1);
  const labeledPoints = allPoints.filter((point) => point.type === "H" || point.type === "L");
  const values = curveSeries.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.max(maxValue - minValue, 0.5);

  const xAt = (time) =>
    TIDE_CHART_PAD_X + ((time - startTime) / duration) * (TIDE_CHART_WIDTH - TIDE_CHART_PAD_X * 2);
  const yAt = (value) =>
    TIDE_CHART_HEIGHT -
    TIDE_CHART_PAD_BOTTOM -
    ((value - minValue) / valueRange) * (TIDE_CHART_HEIGHT - TIDE_CHART_PAD_TOP - TIDE_CHART_PAD_BOTTOM);

  const samplePoints = [];
  for (let i = 0; i < curveSeries.length - 1; i += 1) {
    const left = curveSeries[i];
    const right = curveSeries[i + 1];
    const leftTime = left.date.getTime();
    const rightTime = right.date.getTime();
    const segmentDuration = Math.max(rightTime - leftTime, 1);

    for (let step = 0; step <= 20; step += 1) {
      const t = step / 20;
      const eased = (1 - Math.cos(Math.PI * t)) / 2;
      const time = leftTime + segmentDuration * t;
      const value = left.value + (right.value - left.value) * eased;
      samplePoints.push({
        x: xAt(time),
        y: yAt(value)
      });
    }
  }

  let nowMarker = null;
  const nowTime = Date.now();
  if (nowTime > startTime && nowTime < endTime) {
    for (let i = 0; i < curveSeries.length - 1; i += 1) {
      const left = curveSeries[i];
      const right = curveSeries[i + 1];
      const leftTime = left.date.getTime();
      const rightTime = right.date.getTime();
      if (nowTime >= leftTime && nowTime <= rightTime) {
        const t = (nowTime - leftTime) / Math.max(rightTime - leftTime, 1);
        const eased = (1 - Math.cos(Math.PI * t)) / 2;
        nowMarker = {
          x: xAt(nowTime),
          y: yAt(left.value + (right.value - left.value) * eased)
        };
        break;
      }
    }
  }

  function buildBubbleBox(x, y, width, height, side, gap = 10) {
    const left = Math.min(Math.max(x - width / 2, 6), TIDE_CHART_WIDTH - width - 6);
    const top =
      side === "top"
        ? Math.min(Math.max(y - height - gap, 6), TIDE_CHART_HEIGHT - height - 6)
        : Math.min(Math.max(y + gap, 6), TIDE_CHART_HEIGHT - height - 6);

    return { left, top };
  }

  const hoverMarkers = labeledPoints
    .map((point) => {
      const x = xAt(point.date.getTime());
      const y = yAt(point.value);
      const valueText = `${point.value.toFixed(1)} ft`;
      const timeText = formatClock(point.date);
      const width = Math.max(estimateLabelWidth(valueText, 7, 16), estimateLabelWidth(timeText, 6, 16));
      const height = 34;
      const isHigh = point.type === "H";
      const bubbleClass = isHigh ? "map-tide-label-box map-tide-label-box-high" : "map-tide-label-box map-tide-label-box-low";
      const valueClass = isHigh ? "map-tide-label-value map-tide-label-value-high" : "map-tide-label-value map-tide-label-value-low";
      const timeClass = isHigh ? "map-tide-label-time map-tide-label-time-high" : "map-tide-label-time map-tide-label-time-low";
      const pointClass = isHigh ? "map-tide-point-high" : "map-tide-point-low";
      const box = buildBubbleBox(x, y, width, height, isHigh ? "top" : "bottom");

      return `
        <g class="map-tide-marker-group" tabindex="0" aria-label="${isHigh ? "High tide" : "Low tide"} ${valueText} at ${timeText}">
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" class="map-tide-hit-area"></circle>
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.4" class="map-tide-point ${pointClass}"></circle>
          <g class="map-tide-hover-bubble">
            <rect x="${box.left.toFixed(1)}" y="${box.top.toFixed(1)}" width="${width.toFixed(1)}" height="${height}" rx="10" class="${bubbleClass}"></rect>
            <text x="${(box.left + width / 2).toFixed(1)}" y="${(box.top + 14).toFixed(1)}" text-anchor="middle" class="${valueClass}">${valueText}</text>
            <text x="${(box.left + width / 2).toFixed(1)}" y="${(box.top + 26).toFixed(1)}" text-anchor="middle" class="${timeClass}">${timeText}</text>
          </g>
        </g>
      `;
    })
    .join("");

  const nowMarkup = nowMarker
    ? (() => {
        const boxWidth = 52;
        const boxHeight = 20;
        const side = nowMarker.y > TIDE_CHART_HEIGHT * 0.56 ? "top" : "bottom";
        const box = buildBubbleBox(nowMarker.x, nowMarker.y, boxWidth, boxHeight, side, 10);
        return `
          <g class="map-tide-now-group">
            <circle cx="${nowMarker.x.toFixed(1)}" cy="${nowMarker.y.toFixed(1)}" r="5.2" class="map-tide-point map-tide-point-now"></circle>
            <rect x="${box.left.toFixed(1)}" y="${box.top.toFixed(1)}" width="${boxWidth}" height="${boxHeight}" rx="10" class="map-tide-now-badge"></rect>
            <text x="${(box.left + boxWidth / 2).toFixed(1)}" y="${(box.top + 13).toFixed(1)}" text-anchor="middle" class="map-tide-now-text">Now</text>
          </g>
        `;
      })()
    : "";

  const curvePath = samplePoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" L ");

  return `
    <div class="map-tide-chart-card">
      <div class="map-tide-chart-heading">
        <span><img src="${ICONS.tide}" alt="" class="map-chip-icon map-chip-icon-inline">Tide</span>
        <span>${region.title}</span>
      </div>
      <svg class="map-tide-chart" viewBox="0 0 ${TIDE_CHART_WIDTH} ${TIDE_CHART_HEIGHT}" preserveAspectRatio="none" aria-label="Daily tide chart">
        <path d="M ${curvePath}" class="map-tide-curve"></path>
        ${hoverMarkers}
        ${nowMarkup}
      </svg>
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
      L.DomEvent.disableClickPropagation(popupContent);
    }

    popupEl.querySelectorAll(".map-tide-disclosure").forEach((details) => {
      details.addEventListener("toggle", () => {
        window.requestAnimationFrame(() => {
          event.popup.update();
        });
      });
    });
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
            ${buildTideChartDisclosure(region, tideData)}
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
