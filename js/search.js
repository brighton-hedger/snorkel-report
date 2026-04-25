const {
  REGIONS,
  fetchForecast,
  getDateKey,
  getDaylightScoreSeries,
  getDaylightAverageScore,
  getScoreColor,
  calculateRegionalScore
} = window.SnorkelShared;

const SEARCH_FORECAST_DAYS = 7;
const forecastCache = new Map();
let activeChart = null;

function buildSearchDateRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + SEARCH_FORECAST_DAYS - 1);
  return { start, end };
}

function formatLongDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function toSearchCanvasId(regionTitle, dateKey) {
  return `search-chart-${regionTitle.replace(/[^a-z0-9]+/gi, "")}-${dateKey.replace(/[^0-9]+/g, "")}`;
}

function buildTrendNotes(dayEntries) {
  const notes = { good: [], bad: [] };
  if (!dayEntries || dayEntries.length < 2) {
    return notes;
  }

  const start = dayEntries[0];
  const end = dayEntries[dayEntries.length - 1];
  const windDelta = (end.windSpeed ?? 0) - (start.windSpeed ?? 0);
  const waveDelta = (end.waveHeight ?? 0) - (start.waveHeight ?? 0);
  const currentDelta = (end.currentSpeed ?? 0) - (start.currentSpeed ?? 0);
  const cloudDelta = (end.clouds ?? 0) - (start.clouds ?? 0);
  const rainDelta = (end.rain ?? 0) - (start.rain ?? 0);
  const tideDelta = (end.tide ?? 0) - (start.tide ?? 0);

  if (windDelta >= 3) {
    notes.bad.push("Wind builds through the day, so surface chop may get worse later on.");
  } else if (windDelta <= -3) {
    notes.good.push("Wind eases through the day, which should help clean up the surface later on.");
  }

  if (waveDelta >= 0.75) {
    notes.bad.push("Wave energy builds through the day, which is part of why the score falls later on.");
  } else if (waveDelta <= -0.75) {
    notes.good.push("Wave height trends lower later in the day, which helps explain the improving score.");
  }

  if (currentDelta >= 0.4) {
    notes.bad.push("Current strength increases later in the day, which can make the region less comfortable.");
  } else if (currentDelta <= -0.4) {
    notes.good.push("Current strength eases later in the day, helping make the water more manageable.");
  }

  if (cloudDelta >= 20 || rainDelta > 0.03) {
    notes.bad.push("Clouds or rain increase later in the day, which can flatten light and reduce visibility.");
  } else if (cloudDelta <= -20 && rainDelta <= 0) {
    notes.good.push("Sky conditions improve later in the day, which should help with underwater light.");
  }

  if (tideDelta <= -0.8) {
    notes.bad.push("Tide drops noticeably through the day, which can mean less reef clearance later on.");
  } else if (tideDelta >= 0.8) {
    notes.good.push("Tide rises into a deeper window later in the day, which helps the reef feel a bit more forgiving.");
  }

  return notes;
}

function buildConditionBreakdown(metrics, region, scoreDetails = [], dayEntries = []) {
  const good = [];
  const bad = [];

  if (region.protected) {
    good.push(`${region.title} gets some protection from its shoreline shape.`);
  }

  if (metrics.waveHeight <= 1.5) {
    good.push("Smaller waves should make entry and visibility friendlier.");
  } else if (metrics.waveHeight >= 4) {
    bad.push("Wave height is elevated, which can make entry and inside conditions rougher.");
  }

  if (metrics.swellHeight <= 1.75) {
    good.push("Lower swell is helping keep this region calmer.");
  } else if (metrics.swellHeight >= 2.5) {
    bad.push("Open-ocean swell is adding extra movement here.");
  }

  if (metrics.windSpeed <= 8) {
    good.push("Lighter wind should help keep the surface cleaner.");
  } else if (metrics.windSpeed >= 12) {
    bad.push("Stronger wind is likely adding chop on the surface.");
  }

  if (metrics.currentSpeed <= 0.5) {
    good.push("Currents look fairly manageable right now.");
  } else if (metrics.currentSpeed >= 1.2) {
    bad.push("Current strength is up, so drift and exits may be tougher.");
  }

  if ((metrics.clouds ?? 0) <= 35 && (metrics.rain ?? 0) <= 0.02) {
    good.push("Clearer weather should help with light and underwater visibility.");
  } else {
    if ((metrics.clouds ?? 0) >= 60) {
      bad.push("Cloud cover may flatten the light and make the water look murkier.");
    }
    if ((metrics.rain ?? 0) > 0.02) {
      bad.push("Rain could reduce visibility and make the surface less pleasant.");
    }
  }

  if (Number.isFinite(metrics.tide)) {
    if (metrics.tide >= 1 && metrics.tide <= 2.5) {
      good.push("Tide level is in a more comfortable middle range for reef depth.");
    } else if (metrics.tide < 0.5) {
      bad.push("Lower tide can mean less clearance over shallow reef and rock.");
    }
  }

  scoreDetails.forEach((detail) => {
    if (/Protected cove|Offshore or side-offshore winds|Current direction is manageable|Swell direction suits/i.test(detail)) {
      good.push(detail);
      return;
    }

    if (/Very large waves|Moderate waves|Some surf energy|Large swell|Moderate swell|Short swell period|Strong wind chop|Some wind chop|Onshore winds|Cross-shore breeze|Very windy|Breezy|Strong currents|Moderate currents|Noticeable current|Low tide|Heavy cloud cover|Partly cloudy|Rain expected|Light rain possible/i.test(detail)) {
      bad.push(detail);
    }
  });

  const trendNotes = buildTrendNotes(dayEntries);
  good.push(...trendNotes.good);
  bad.push(...trendNotes.bad);

  return {
    good: [...new Set(good)].slice(0, 4),
    bad: [...new Set(bad)].slice(0, 4)
  };
}

function initializeSearchForm() {
  const regionSelect = document.getElementById("search-region");
  const dateInput = document.getElementById("search-date");
  const submitButton = document.getElementById("search-submit");
  const { start, end } = buildSearchDateRange();

  if (!regionSelect || !dateInput || !submitButton) {
    return;
  }

  regionSelect.innerHTML = REGIONS.map(
    (region) => `<option value="${region.title}">${region.title} | ${region.shore} Shore</option>`
  ).join("");

  dateInput.value = getDateKey(start);
  dateInput.min = getDateKey(start);
  dateInput.max = getDateKey(end);

  submitButton.addEventListener("click", runSearch);
}

async function loadForecast(region) {
  if (!forecastCache.has(region.title)) {
    forecastCache.set(region.title, fetchForecast(region, { forecastDays: SEARCH_FORECAST_DAYS }));
  }

  return forecastCache.get(region.title);
}

function destroyActiveChart() {
  if (activeChart) {
    activeChart.destroy();
    activeChart = null;
  }
}

function renderChart(canvasId, label, points) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  destroyActiveChart();

  activeChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: points.map((point) => point.time),
      datasets: [
        {
          label,
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
      aspectRatio: 1.6,
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          title: { display: true, text: "Score" }
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

function renderSearchMessage(title, message) {
  const resultsEl = document.getElementById("search-results");
  if (!resultsEl) {
    return;
  }

  destroyActiveChart();
  resultsEl.style.display = "block";
  resultsEl.innerHTML = `
    <div class="search-message">
      <h2>${title}</h2>
      <p>${message}</p>
    </div>
  `;
}

async function runSearch() {
  const regionSelect = document.getElementById("search-region");
  const dateInput = document.getElementById("search-date");
  const resultsEl = document.getElementById("search-results");
  const { start, end } = buildSearchDateRange();

  if (!regionSelect || !dateInput || !resultsEl) {
    return;
  }

  const region = REGIONS.find((entry) => entry.title === regionSelect.value);
  const selectedDate = new Date(`${dateInput.value}T00:00:00`);

  if (!region || Number.isNaN(selectedDate.getTime())) {
    renderSearchMessage("Pick a region and date", "Choose both fields to load a forecast graph.");
    return;
  }

  if (selectedDate < start || selectedDate > end) {
    renderSearchMessage(
      "That date is outside the current forecast window",
      `Right now this tool can show day graphs from ${formatLongDate(start)} through ${formatLongDate(end)}. Pick a date in that range and the graph will appear here.`
    );
    return;
  }

  resultsEl.style.display = "block";
  resultsEl.innerHTML = `
    <div class="search-message">
      <h2>Loading ${region.title}</h2>
      <p>Pulling the forecast graph for ${formatLongDate(selectedDate)}.</p>
    </div>
  `;

  try {
    const forecast = await loadForecast(region);
    const selectedDateKey = getDateKey(selectedDate);
    const points = getDaylightScoreSeries(forecast.hourly || [], region, selectedDateKey).map((entry) => ({
      time: new Date(entry.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      score: entry.score
    }));
    const averageScore = getDaylightAverageScore(forecast.hourly || [], region, selectedDateKey);
    const rawDayEntries = (forecast.hourly || []).filter((entry) => entry.dateKey === selectedDateKey);
    const middayEntry =
      rawDayEntries.find((entry) => entry.hour === 12) ||
      rawDayEntries.find((entry) => entry.hour === 11) ||
      rawDayEntries.find((entry) => entry.hour === 13) ||
      rawDayEntries[Math.floor(rawDayEntries.length / 2)] ||
      null;
    const scoreMarkup =
      averageScore === null
        ? ""
        : `<div class="search-result-score" style="color:${getScoreColor(averageScore)}; border-color:${getScoreColor(averageScore)};">${averageScore.toFixed(1)}/10</div>`;

    if (!points.length) {
      renderSearchMessage(
        "No daylight forecast data for that day",
        `There is not enough daylight forecast data loaded for ${region.title} on ${formatLongDate(selectedDate)} yet. Try another day within the current forecast range.`
      );
      return;
    }

    const canvasId = toSearchCanvasId(region.title, selectedDateKey);
    const scoreDetails = middayEntry
      ? calculateRegionalScore(middayEntry, region, { includeDetails: true }).details
      : [];
    const daylightEntries = rawDayEntries.filter((entry) => entry.hour >= 6 && entry.hour < 18);
    const breakdown = buildConditionBreakdown(middayEntry || {}, region, scoreDetails, daylightEntries);
    resultsEl.innerHTML = `
      <div class="search-result-meta">
        <div>
          <h2>${region.title}</h2>
          <p>${region.towns} | ${formatLongDate(selectedDate)}</p>
        </div>
        ${scoreMarkup}
      </div>
      <div class="search-results-layout">
        <div class="region-day-chart-panel search-chart-panel">
          <div class="region-day-chart-label">
            <strong>Day graph</strong>
            <span>Daylight snorkel score trend for this region</span>
          </div>
          <canvas id="${canvasId}" width="560" height="320"></canvas>
        </div>
        <div class="condition-breakdown search-breakdown">
          <section class="condition-breakdown-panel condition-breakdown-good">
            <h4>What is helping</h4>
            <ul>${(breakdown.good.length ? breakdown.good : ["No major helping factors are standing out right now."]).map((item) => `<li>${item}</li>`).join("")}</ul>
          </section>
          <section class="condition-breakdown-panel condition-breakdown-bad">
            <h4>What is hurting</h4>
            <ul>${(breakdown.bad.length ? breakdown.bad : ["No major warning flags are dominating the forecast right now."]).map((item) => `<li>${item}</li>`).join("")}</ul>
          </section>
        </div>
      </div>
    `;

    renderChart(canvasId, `${region.title} day graph`, points);
  } catch (error) {
    console.error("Search page error:", error);
    renderSearchMessage(
      "Could not load that forecast",
      "Something went wrong while pulling the region forecast. Please try again in a moment."
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSearchForm);
} else {
  initializeSearchForm();
}
