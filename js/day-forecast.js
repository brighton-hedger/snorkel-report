const {
  REGIONS,
  getDateKey,
  fetchForecast,
  getDaylightScoreSeries
} = window.SnorkelShared;

const DAY_FORECAST_DAYS = 3;
const SHORE_ORDER = ["East", "South", "North", "West"];

function buildDayDescriptors() {
  return [...Array(DAY_FORECAST_DAYS)].map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return {
      index,
      dateKey: getDateKey(date),
      shortLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
      fullLabel: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    };
  });
}

function toCanvasId(regionTitle, dayIndex) {
  return `chart-${regionTitle.replace(/[^a-z0-9]+/gi, "")}-d${dayIndex}`;
}

function buildRegionGroups() {
  return SHORE_ORDER.map((shore) => ({
    shore,
    regions: REGIONS.filter((region) => region.shore === shore)
  })).filter((group) => group.regions.length);
}

async function fetchRegionForecast(region) {
  try {
    const forecast = await fetchForecast(region, { forecastDays: DAY_FORECAST_DAYS });
    const days = buildDayDescriptors().map((day) => ({
      ...day,
      points: getDaylightScoreSeries(forecast.hourly, region, day.dateKey).map((entry) => ({
        time: new Date(entry.time).toLocaleTimeString([], { hour: "numeric", hour12: true }),
        score: entry.score
      }))
    }));

    return {
      region,
      days
    };
  } catch (error) {
    console.error(`Error fetching day forecast for ${region.title}:`, error);
    return {
      region,
      days: buildDayDescriptors().map((day) => ({
        ...day,
        points: []
      }))
    };
  }
}

function renderDayChart(canvasId, regionTitle, dayLabel, points) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  new Chart(canvas, {
    type: "line",
    data: {
      labels: points.map((point) => point.time),
      datasets: [
        {
          label: `${regionTitle} ${dayLabel}`,
          data: points.map((point) => point.score),
          borderColor: "#2aa198",
          backgroundColor: "rgba(42, 161, 152, 0.18)",
          fill: true,
          tension: 0.35,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.25,
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          ticks: { font: { size: 13 } },
          title: { display: true, text: "Score" }
        },
        x: {
          ticks: {
            maxTicksLimit: 8,
            callback(value, index) {
              return index % 2 === 0 ? this.getLabelForValue(value) : "";
            },
            font: { size: 12 }
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
              const value = typeof context.parsed?.y === "number" ? context.parsed.y.toFixed(1) : "--";
              return `${value}/10`;
            }
          }
        }
      }
    }
  });
}

function buildRegionCardMarkup(regionOrResult) {
  if (!regionOrResult?.days) {
    return `
      <div class="region-day-card">
        <div class="region-day-card-head">
          <div>
            <h3>${regionOrResult.title}</h3>
            <p>${regionOrResult.towns}</p>
          </div>
          <div class="forecast-summary-actions">
            <span class="forecast-summary-label">Loading...</span>
          </div>
        </div>
      </div>
    `;
  }

  const regionResult = regionOrResult;
  return `
    <details class="region-day-card region-subregion-dropdown">
      <summary class="region-day-card-head">
        <div>
          <h3>${regionResult.region.title}</h3>
          <p>${regionResult.region.towns}</p>
        </div>
        <div class="forecast-summary-actions">
          <span class="forecast-summary-label">View charts</span>
          <div class="shore-arrow" aria-hidden="true"></div>
        </div>
      </summary>
      <div class="region-day-chart-grid">
        ${regionResult.days.map((day) => `
          <section class="region-day-chart-panel">
            <div class="region-day-chart-label">
              <strong>${day.shortLabel}</strong>
              <span>${day.fullLabel}</span>
            </div>
            ${
              day.points.length
                ? `<canvas id="${toCanvasId(regionResult.region.title, day.index)}" width="420" height="320"></canvas>`
                : '<div class="chart-empty-state">No daylight data available.</div>'
            }
          </section>
        `).join("")}
      </div>
    </details>
  `;
}

function renderGroupedDayForecast(resultMap) {
  const container = document.getElementById("day-region-groups");
  if (!container) return;

  const groupedResults = buildRegionGroups().map((group) => ({
    shore: group.shore,
    regions: group.regions,
    results: group.regions.map((region) => resultMap.get(region.title) || null)
  }));

  container.innerHTML = groupedResults.map((group) => `
    <details class="shore-section region-forecast-group">
      <summary class="shore-summary">
        <div class="shore-summary-main">
          <div class="shore-summary-title">
            <p>${group.shore} Shore</p>
          </div>
          <div class="forecast-summary-actions">
            <span class="forecast-summary-label">View charts</span>
            <div class="shore-arrow" aria-hidden="true"></div>
          </div>
        </div>
      </summary>
      <div class="shore-details">
        <div class="region-day-card-list">
          ${group.regions.map((region, index) => buildRegionCardMarkup(group.results[index] || region)).join("")}
        </div>
      </div>
    </details>
  `).join("");

  groupedResults.forEach((group) => {
    group.results.forEach((result) => {
      if (!result) {
        return;
      }
      result.days.forEach((day) => {
        if (!day.points.length) {
          return;
        }

        renderDayChart(
          toCanvasId(result.region.title, day.index),
          result.region.title,
          day.shortLabel,
          day.points
        );
      });
    });
  });
}

async function initializeDayForecast() {
  const forecastDateEl = document.getElementById("forecast-date");
  if (forecastDateEl) {
    forecastDateEl.textContent = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  try {
    const resultMap = new Map();
    renderGroupedDayForecast(resultMap);

    await Promise.all(
      REGIONS.map(async (region) => {
        const result = await fetchRegionForecast(region);
        resultMap.set(region.title, result);
        renderGroupedDayForecast(resultMap);
      })
    );
  } catch (error) {
    console.error("Error loading day forecast:", error);
    const errorMessage = document.getElementById("error-message");
    if (errorMessage) {
      errorMessage.textContent = "Error loading day forecast. Please try again later.";
      errorMessage.style.display = "block";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDayForecast);
} else {
  initializeDayForecast();
}
