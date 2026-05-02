const {
  fetchForecast,
  fetchTide,
  toCardinal,
  getDateKey
} = window.SnorkelShared;

const DONOVAN_REGION = {
  title: "Waikiki / Mamala Bay",
  lat: 21.2744,
  lng: -157.8269,
  stationId: "1612340"
};

const FULL_DAY_FORECAST_DAYS = 2;
const TIDE_DEFAULT_Y_MIN = -1;
const TIDE_DEFAULT_Y_MAX = 2.5;
const activeCharts = [];
const ICONS = {
  wind: "assets/wind_emoji.svg",
  waves: "assets/wave_emoji.svg",
  swell: "assets/swell_emoji.svg",
  current: "assets/current_emoji.svg",
  weatherSun: "assets/sun_emoji.svg",
  weatherCloud: "assets/cloud_emoji.svg",
  weatherRain: "assets/rain_emoji.svg",
  tide: "assets/tide_emoji.svg"
};

function formatReportDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatClock(dateLike) {
  const date = new Date(dateLike);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatAxisHourLabel(dateLike) {
  const date = new Date(dateLike);
  const hour = date.getHours();
  const minute = date.getMinutes();

  if (minute !== 0) {
    return "";
  }

  if (hour === 6) {
    return "6 AM";
  }

  if (hour === 12) {
    return "12 PM";
  }

  if (hour === 18) {
    return "6 PM";
  }

  return "";
}

function formatDirectionalHourLabel(dateLike) {
  const date = new Date(dateLike);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric"
  });
}

function normalizeDirection(deg) {
  if (!Number.isFinite(deg)) {
    return 0;
  }

  return ((deg % 360) + 360) % 360;
}

function getResponsiveTideAspectRatio() {
  return window.innerWidth <= 768 ? 1.55 : 3.4;
}

function directionToArrow(deg) {
  if (!Number.isFinite(deg)) {
    return "•";
  }

  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return arrows[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function formatRange(min, max, digits = 1, unit = "") {
  if (!Number.isFinite(min) && !Number.isFinite(max)) {
    return "--";
  }

  if (!Number.isFinite(min)) {
    return `${max.toFixed(digits)}${unit}`;
  }

  if (!Number.isFinite(max)) {
    return `${min.toFixed(digits)}${unit}`;
  }

  if (Math.abs(max - min) < 0.05) {
    return `${max.toFixed(digits)}${unit}`;
  }

  return `${min.toFixed(digits)} to ${max.toFixed(digits)}${unit}`;
}

function getMinMax(entries, key) {
  const values = entries
    .map((entry) => Number(entry[key]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return { min: null, max: null };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

function getAdaptiveMax(entries, key, baseMax, step) {
  const values = entries
    .map((entry) => Number(entry[key]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return baseMax;
  }

  const maxValue = Math.max(...values);
  if (maxValue <= baseMax) {
    return baseMax;
  }

  return Math.ceil(maxValue / step) * step;
}

function buildDirectionSamples(entries, directionKey, speedKey) {
  const samples = entries
    .filter((entry) => Number.isFinite(entry[directionKey]) && Number.isFinite(entry[speedKey]))
    .filter((entry) => [6, 9, 12, 15, 18, 21].includes(entry.hour))
    .map((entry) => ({
      label: formatDirectionalHourLabel(entry.time),
      direction: Number(entry[directionKey]),
      speed: Number(entry[speedKey])
    }));

  return samples.length ? samples : entries
    .filter((entry) => Number.isFinite(entry[directionKey]) && Number.isFinite(entry[speedKey]))
    .slice(0, 6)
    .map((entry) => ({
      label: formatDirectionalHourLabel(entry.time),
      direction: Number(entry[directionKey]),
      speed: Number(entry[speedKey])
    }));
}

function createMetricCard(label, value, subtext) {
  return `
    <article class="donovan-metric-card">
      <strong>${label}</strong>
      <span>${value}</span>
      <p>${subtext}</p>
    </article>
  `;
}

function getWeatherRangeChip(clouds, rain) {
  if (Number.isFinite(rain.max) && rain.max > 0.01) {
    return {
      icon: ICONS.weatherRain,
      label: "Weather",
      value: Number.isFinite(rain.max) && rain.max > 0.05
        ? `Up to ${rain.max.toFixed(2)} in rain`
        : `Light rain possible`
    };
  }

  if (Number.isFinite(clouds.max) && clouds.max > 60) {
    return {
      icon: ICONS.weatherCloud,
      label: "Weather",
      value: `${formatRange(clouds.min, clouds.max, 0, "%")} clouds`
    };
  }

  return {
    icon: ICONS.weatherSun,
    label: "Weather",
    value: `${formatRange(clouds.min, clouds.max, 0, "%")} clouds`
  };
}

function destroyCharts() {
  while (activeCharts.length) {
    const chart = activeCharts.pop();
    chart.destroy();
  }
}

function renderTimeSeriesChart(canvasId, points, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: points.map((point) => point.label),
      datasets: [
        {
          data: points.map((point) => point.value),
          borderColor: config.color,
          backgroundColor: `${config.color}22`,
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: config.aspectRatio || 1.55,
      scales: {
        y: {
          min: config.yMin,
          max: config.yMax,
          title: {
            display: true,
            text: config.yTitle
          },
          ticks: {
            font: { size: 12 },
            stepSize: config.yStepSize,
            callback(value) {
              return config.tickLabel(value);
            }
          }
        },
        x: {
          grid: {
            drawTicks: false,
            color(context) {
              const axisLabel = points[context.index]?.axisLabel;
              return axisLabel ? "rgba(42, 161, 152, 0.14)" : "rgba(0, 0, 0, 0)";
            },
            lineWidth(context) {
              return points[context.index]?.axisLabel ? 1 : 0;
            }
          },
          border: {
            display: false
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            padding: 8,
            font: { size: 12 },
            callback(value, index) {
              return points[index]?.axisLabel || "";
            }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title(items) {
              return items[0]?.label || "";
            },
            label(context) {
              const value = typeof context.parsed?.y === "number" ? context.parsed.y : null;
              return value === null ? "--" : config.tooltipLabel(value);
            }
          }
        }
      }
    }
  });

  activeCharts.push(chart);
}

function renderSummary(entries, tideData) {
  const summaryEl = document.getElementById("donovan-summary");
  if (!summaryEl) {
    return;
  }

  const wave = getMinMax(entries, "waveHeight");
  const swell = getMinMax(entries, "swellHeight");
  const wind = getMinMax(entries, "windSpeed");
  const current = getMinMax(entries, "currentSpeed");
  const rain = getMinMax(entries, "rain");
  const clouds = getMinMax(entries, "clouds");
  const swellPeriod = getMinMax(entries, "swellPeriod");
  const weatherChip = getWeatherRangeChip(clouds, rain);

  summaryEl.innerHTML = `
    <div class="condition-chip-row donovan-summary-chip-row">
      <div class="condition-chip">
        <div class="condition-chip-head">
          <span><img src="${ICONS.waves}" alt="" class="chip-icon"></span>
          <strong>Wave</strong>
        </div>
        <em>${formatRange(wave.min, wave.max, 1, " ft")}</em>
      </div>
      <div class="condition-chip">
        <div class="condition-chip-head">
          <span><img src="${ICONS.swell}" alt="" class="chip-icon"></span>
          <strong>Swell</strong>
        </div>
        <em>${formatRange(swell.min, swell.max, 1, " ft")} &middot; ${formatRange(swellPeriod.min, swellPeriod.max, 0, "s")}</em>
      </div>
      <div class="condition-chip">
        <div class="condition-chip-head">
          <span><img src="${ICONS.wind}" alt="" class="chip-icon"></span>
          <strong>Wind</strong>
        </div>
        <em>${formatRange(wind.min, wind.max, 0, " mph")}</em>
      </div>
      <div class="condition-chip">
        <div class="condition-chip-head">
          <span><img src="${ICONS.current}" alt="" class="chip-icon"></span>
          <strong>Current</strong>
        </div>
        <em>${formatRange(current.min, current.max, 1, " mph")}</em>
      </div>
      <div class="condition-chip">
        <div class="condition-chip-head">
          <span><img src="${weatherChip.icon}" alt="" class="chip-icon"></span>
          <strong>${weatherChip.label}</strong>
        </div>
        <em>${weatherChip.value}</em>
      </div>
      <div class="condition-chip">
        <div class="condition-chip-head">
          <span><img src="${ICONS.tide}" alt="" class="chip-icon"></span>
          <strong>Tide</strong>
        </div>
        <em>${tideData?.tideSummary || "Unavailable"}</em>
      </div>
    </div>
  `;
}

function renderTideSection(tideData) {
  const summaryEl = document.getElementById("donovan-tide-summary");
  if (!summaryEl) {
    return;
  }

  summaryEl.innerHTML = `<p>${tideData?.tideSummary || "Tide data unavailable right now."}</p>`;

  const tidePoints = (tideData?.curvePredictions?.length ? tideData.curvePredictions : tideData?.predictions || [])
    .map((point) => ({
      label: formatClock(point.time),
      axisLabel: formatAxisHourLabel(point.time),
      value: Number(point.value)
    }))
    .filter((point) => Number.isFinite(point.value));

  if (!tidePoints.length) {
    return;
  }

  const tideValues = tidePoints.map((point) => point.value);
  const minValue = Math.min(...tideValues);
  const maxValue = Math.max(...tideValues);
  const yMin = Math.min(TIDE_DEFAULT_Y_MIN, Math.floor(minValue * 2) / 2);
  const yMax = Math.max(TIDE_DEFAULT_Y_MAX, Math.ceil(maxValue * 2) / 2);

  renderTimeSeriesChart("donovan-tide-canvas", tidePoints, {
    color: "#3e94d1",
    aspectRatio: getResponsiveTideAspectRatio(),
    yMin,
    yMax,
    yStepSize: 0.5,
    yTitle: "Tide (ft)",
    tickLabel: (value) => `${Number(value).toFixed(1)}'`,
    tooltipLabel: (value) => `${value.toFixed(1)} ft`
  });
}

function renderChartCards(entries) {
  const container = document.getElementById("donovan-charts-grid");
  if (!container) {
    return;
  }

  const chartConfigs = [
    {
      key: "waveHeight",
      title: "Wave Height",
      subtitle: "Combined sea state through the day",
      color: "#2f6fb6",
      directionKey: "waveDir",
      yMin: 0,
      yMax: getAdaptiveMax(entries, "waveHeight", 6, 1),
      yTitle: "Wave Height (ft)",
      tickLabel: (value) => `${Number(value).toFixed(0)} ft`,
      tooltipLabel: (value) => `${value.toFixed(1)} ft`
    },
    {
      key: "swellHeight",
      title: "Swell Height",
      subtitle: "Primary swell through the day",
      color: "#2aa198",
      directionKey: "swellDir",
      yMin: 0,
      yMax: getAdaptiveMax(entries, "swellHeight", 4, 0.5),
      yTitle: "Swell Height (ft)",
      tickLabel: (value) => `${Number(value).toFixed(1)} ft`,
      tooltipLabel: (value) => `${value.toFixed(1)} ft`
    },
    {
      key: "windSpeed",
      title: "Wind Speed",
      subtitle: "Wind trend through the day",
      color: "#d97a27",
      directionKey: "windDir",
      yMin: 0,
      yMax: getAdaptiveMax(entries, "windSpeed", 30, 5),
      yTitle: "Wind Speed (mph)",
      tickLabel: (value) => `${Number(value).toFixed(0)} mph`,
      tooltipLabel: (value) => `${value.toFixed(0)} mph`
    },
    {
      key: "currentSpeed",
      title: "Current Speed",
      subtitle: "Surface current trend through the day",
      color: "#7b61c9",
      directionKey: "currentDir",
      yMin: 0,
      yMax: getAdaptiveMax(entries, "currentSpeed", 1, 0.25),
      yTitle: "Current Speed (mph)",
      tickLabel: (value) => `${Number(value).toFixed(1)} mph`,
      tooltipLabel: (value) => `${value.toFixed(1)} mph`
    },
    {
      key: "clouds",
      title: "Cloud Cover",
      subtitle: "Sky cover through the day",
      color: "#5d7d8a",
      yMin: 0,
      yMax: getAdaptiveMax(entries, "clouds", 100, 10),
      yTitle: "Cloud Cover (%)",
      tickLabel: (value) => `${Number(value).toFixed(0)}%`,
      tooltipLabel: (value) => `${value.toFixed(0)}%`
    },
    {
      key: "rain",
      title: "Rain",
      subtitle: "Precipitation forecast through the day",
      color: "#3e94d1",
      yMin: 0,
      yMax: getAdaptiveMax(entries, "rain", 0.1, 0.05),
      yTitle: "Rain (in)",
      tickLabel: (value) => `${Number(value).toFixed(2)}`,
      tooltipLabel: (value) => `${value.toFixed(2)} in`
    }
  ];

  container.innerHTML = chartConfigs.map((config, index) => `
    <section class="region-day-chart-panel donovan-chart-panel">
      <div class="region-day-chart-label donovan-chart-label">
        <strong>${config.title}</strong>
        <span>${config.subtitle}</span>
      </div>
      <canvas id="donovan-chart-${index}" width="520" height="300"></canvas>
      ${
        config.directionKey
          ? `<div id="donovan-direction-${index}" class="donovan-direction-strip"></div>`
          : ""
      }
    </section>
  `).join("");

  chartConfigs.forEach((config, index) => {
    const points = entries
      .filter((entry) => Number.isFinite(entry[config.key]))
      .map((entry) => ({
        label: formatClock(entry.time),
        axisLabel: formatAxisHourLabel(entry.time),
        value: Number(entry[config.key])
      }));

    renderTimeSeriesChart(`donovan-chart-${index}`, points, config);

    if (config.directionKey) {
      const directionEl = document.getElementById(`donovan-direction-${index}`);
      if (directionEl) {
        const samples = buildDirectionSamples(entries, config.directionKey, config.key);
        directionEl.innerHTML = samples.map((sample) => `
          <div class="donovan-direction-chip">
            <strong>${sample.label}</strong>
            <span class="donovan-direction-arrow" style="transform: rotate(${normalizeDirection(sample.direction)}deg);"></span>
            <em>${toCardinal(sample.direction)}</em>
          </div>
        `).join("");
      }
    }
  });
}

function renderError(message) {
  const errorEl = document.getElementById("donovan-error");
  if (!errorEl) {
    return;
  }

  errorEl.textContent = message;
  errorEl.style.display = "block";
}

async function initializeDonovanCheck() {
  const reportDateEl = document.getElementById("donovan-report-date");
  if (reportDateEl) {
    reportDateEl.textContent = formatReportDate(new Date());
  }

  destroyCharts();

  try {
    const [forecast, tideData] = await Promise.all([
      fetchForecast(DONOVAN_REGION, { forecastDays: FULL_DAY_FORECAST_DAYS }),
      fetchTide(DONOVAN_REGION.stationId)
    ]);

    const todayKey = getDateKey(new Date());
    const todayEntries = (forecast.hourly || []).filter((entry) => entry.dateKey === todayKey);
    if (!todayEntries.length) {
      throw new Error("There is not enough forecast data loaded for today's conditions.");
    }

    renderSummary(todayEntries, tideData);
    renderTideSection(tideData);
    renderChartCards(todayEntries);
  } catch (error) {
    console.error("Donovan condition check error:", error);
    renderError("Could not load today's Waikiki and Mamala Bay conditions right now. Please try again in a moment.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDonovanCheck);
} else {
  initializeDonovanCheck();
}
