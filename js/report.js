// ==================== ENHANCED REPORT SCRIPT ====================
const {
  REGIONS,
  fetchForecast,
  fetchTide,
  calculateRegionalScore,
  findBestSnorkelTime,
  getScoreColor,
  toCardinal
} = window.SnorkelShared;

const SHORE_ORDER = ["East", "South", "North", "West"];

function getSafeMetrics(metrics) {
  return {
    waveHeight: metrics?.waveHeight ?? 0,
    swellHeight: metrics?.swellHeight ?? 0,
    swellPeriod: metrics?.swellPeriod ?? 0,
    windWaveHeight: metrics?.windWaveHeight ?? 0,
    windWavePeriod: metrics?.windWavePeriod ?? 0,
    temp: metrics?.temp ?? null,
    currentSpeed: metrics?.currentSpeed ?? 0,
    currentDir: metrics?.currentDir ?? 0,
    tide: metrics?.tide ?? 0,
    windSpeed: metrics?.windSpeed ?? 0,
    windDir: metrics?.windDir ?? 0,
    clouds: metrics?.clouds ?? 0,
    rain: metrics?.rain ?? 0
  };
}

function formatClock(value) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildConditionChips(metrics, tideData, bestTime, bestScore) {
  const chips = [];

  if (Number.isFinite(metrics.windSpeed)) {
    chips.push({
      emoji: "💨",
      label: "Wind",
      value: `${metrics.windSpeed.toFixed(0)} mph ${toCardinal(metrics.windDir)}`
    });
  }

  if (Number.isFinite(metrics.waveHeight)) {
    chips.push({
      emoji: "🌊",
      label: "Waves",
      value: `${metrics.waveHeight.toFixed(1)} ft`
    });
  }

  if (Number.isFinite(metrics.temp)) {
    chips.push({
      emoji: "🌡️",
      label: "Sea",
      value: `${metrics.temp.toFixed(0)}F`
    });
  }

  if (Number.isFinite(metrics.currentSpeed)) {
    chips.push({
      emoji: "🧭",
      label: "Current",
      value: `${metrics.currentSpeed.toFixed(1)} mph ${toCardinal(metrics.currentDir)}`
    });
  }

  chips.push({
    emoji: metrics.clouds > 60 ? "☁️" : "☀️",
    label: "Sky",
    value: `${Math.round(metrics.clouds)}% cloud`
  });

  if (Number.isFinite(metrics.rain) && metrics.rain > 0.01) {
    chips.push({
      emoji: "🌦️",
      label: "Rain",
      value: `${metrics.rain.toFixed(2)} in`
    });
  }

  chips.push({
    emoji: "⏱️",
    label: "Best window",
    value: `${bestTime} · ${bestScore}/10`
  });

  if (tideData?.tideSummary) {
    chips.push({
      emoji: tideData.isRising ? "📈" : "📉",
      label: "Tide",
      value: tideData.isRising ? "Rising" : "Falling"
    });
  }

  return chips.slice(0, 6);
}

function buildTideChart(tideData) {
  const points = (tideData?.predictions || []).map((point) => ({
    ...point,
    date: new Date(point.time)
  }));

  if (points.length < 2) {
    return `<div class="tide-fallback">${tideData?.tideSummary || "Tide data unavailable"}</div>`;
  }

  const startTime = points[0].date.getTime();
  const endTime = points[points.length - 1].date.getTime();
  const duration = Math.max(endTime - startTime, 1);
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.max(maxValue - minValue, 0.25);
  const width = 280;
  const height = 96;
  const padX = 14;
  const padY = 12;

  const xAt = (time) => padX + ((time - startTime) / duration) * (width - padX * 2);
  const yAt = (value) => height - padY - ((value - minValue) / valueRange) * (height - padY * 2);

  const samples = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    const leftTime = left.date.getTime();
    const rightTime = right.date.getTime();
    const segmentDuration = Math.max(rightTime - leftTime, 1);
    const segmentSteps = 20;

    for (let step = 0; step <= segmentSteps; step += 1) {
      const t = step / segmentSteps;
      const eased = (1 - Math.cos(Math.PI * t)) / 2;
      const interpolatedTime = leftTime + segmentDuration * t;
      const interpolatedValue = left.value + (right.value - left.value) * eased;
      samples.push(`${xAt(interpolatedTime).toFixed(1)},${yAt(interpolatedValue).toFixed(1)}`);
    }
  }

  const markers = points
    .map((point) => {
      const x = xAt(point.date.getTime());
      const y = yAt(point.value);
      const anchor = point.type === "H" ? "start" : "end";
      const dx = point.type === "H" ? 8 : -8;
      const dy = point.type === "H" ? -10 : 16;
      const valueLabel = `${point.value.toFixed(1)} ft`;
      const timeLabel = formatClock(point.time);

      return `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="tide-point tide-point-${point.type === "H" ? "high" : "low"}"></circle>
        <text x="${(x + dx).toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${anchor}" class="tide-label-value">${valueLabel}</text>
        <text x="${(x + dx).toFixed(1)}" y="${(y + dy + 12).toFixed(1)}" text-anchor="${anchor}" class="tide-label-time">${timeLabel}</text>
      `;
    })
    .join("");

  return `
    <div class="tide-chart-card">
      <div class="tide-chart-heading">
        <span>🌙 Tide</span>
        <span>${tideData?.isRising ? "Rising" : "Falling"}</span>
      </div>
      <svg class="tide-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Daily tide chart">
        <path d="M ${samples.join(" L ")}" class="tide-curve"></path>
        ${markers}
      </svg>
    </div>
  `;
}

function buildSpotCard(result) {
  const { region, score, bestTime, bestScore, metrics, tideData } = result;
  const scoreColor = getScoreColor(score);
  const protectedBadge = region.protected ? '<span class="protected-badge">Protected</span>' : "";
  const chips = buildConditionChips(metrics, tideData, bestTime, bestScore);

  return `
    <article class="spot-card">
      <div class="spot-card-top">
        <div>
          <div class="spot-card-heading">
            <h3>${region.title}</h3>
            ${protectedBadge}
          </div>
          <div class="region-towns">${region.towns}</div>
        </div>
        <div class="spot-score-pill" style="color:${scoreColor}; border-color:${scoreColor};">${score}/10</div>
      </div>
      <div class="condition-chip-row">
        ${chips.map((chip) => `<div class="condition-chip"><span>${chip.emoji}</span><strong>${chip.label}</strong><em>${chip.value}</em></div>`).join("")}
      </div>
      ${buildTideChart(tideData)}
    </article>
  `;
}

function buildShoreSection(shoreName, shoreResults) {
  const average = Math.round((shoreResults.reduce((sum, result) => sum + result.score, 0) / shoreResults.length) * 10) / 10;
  const color = getScoreColor(average);
  const bestNow = [...shoreResults].sort((a, b) => b.score - a.score)[0];

  return `
    <details class="shore-section">
      <summary class="shore-summary">
        <div class="shore-arrow" aria-hidden="true"></div>
        <div class="shore-summary-title">
          <p>${shoreName} Shore</p>
          <h3>${average}/10</h3>
          <span>${bestNow ? `Best now: ${bestNow.region.title}` : `${shoreResults.length} spots`}</span>
        </div>
      </summary>
      <div class="shore-details">
        <div class="shore-expanded-header">
          <div>
            <p>${shoreName} Shore</p>
            <h3>Regional Average <span style="color:${color};">${average}/10</span></h3>
          </div>
          <div class="shore-expanded-meta">${shoreResults.length} spots · tap arrow to collapse</div>
        </div>
        <div class="snorkel-group-grid">
          ${shoreResults.map((result) => buildSpotCard(result)).join("")}
        </div>
      </div>
    </details>
  `;
}

function initializeReport() {
  const reportDateEl = document.getElementById("report-date");
  if (reportDateEl) {
    reportDateEl.textContent = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  Promise.all(
    REGIONS.map(async (region) => {
      try {
        const [forecast, tideData] = await Promise.all([
          fetchForecast(region, { forecastHours: 24 }),
          fetchTide(region.stationId)
        ]);
        const safeMetrics = getSafeMetrics(forecast.current);
        const scoreResult = calculateRegionalScore(safeMetrics, region, { includeDetails: true });
        const best = findBestSnorkelTime(forecast.hourly || [], region);

        return {
          region,
          score: scoreResult.score,
          bestTime: best.time,
          bestScore: best.score,
          metrics: safeMetrics,
          tideData
        };
      } catch (error) {
        console.error(`Error loading region ${region.title}:`, error);
        return {
          region,
          score: 0,
          bestTime: "N/A",
          bestScore: 0,
          metrics: getSafeMetrics(null),
          tideData: { tideSummary: null, isRising: false, predictions: [], currentLevel: null }
        };
      }
    })
  )
    .then((results) => {
      if (!results.length) {
        throw new Error("No snorkel results were available.");
      }

      const allScores = results.map((result) => result.score);
      const average = Math.round((allScores.reduce((sum, value) => sum + value, 0) / allScores.length) * 10) / 10;
      const color = getScoreColor(average);

      const islandSummary = document.getElementById("island-summary");
      if (islandSummary) {
        islandSummary.innerHTML = `
          <div class="island-header island-header-minimal">
            <h3>Island-Wide</h3>
            <div class="snorkel-score" style="color:${color};">${average}/10</div>
          </div>
        `;
        islandSummary.style.display = "block";
      }

      const container = document.getElementById("snorkel-container");
      if (!container) return;

      const loadingEl = document.getElementById("loading");
      if (loadingEl) loadingEl.remove();

      const groupedResults = SHORE_ORDER.map((shore) => ({
        shore,
        results: results.filter((result) => result.region.shore === shore)
      })).filter((group) => group.results.length > 0);

      container.innerHTML = groupedResults.map((group) => buildShoreSection(group.shore, group.results)).join("");
    })
    .catch((error) => {
      console.error("Error loading report:", error);
      const container = document.getElementById("snorkel-container");
      if (container) {
        container.innerHTML = '<p class="error-message" style="display:block;">Error loading snorkel report. Please try again later.</p>';
      }
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeReport);
} else {
  initializeReport();
}
