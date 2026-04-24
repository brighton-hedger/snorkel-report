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

const generateSummary = (scoreResult, metrics, tideInfo, isRising) => {
  const bullets = [];

  (scoreResult.details || []).forEach((detail) => {
    if (!bullets.includes(detail)) {
      bullets.push(detail);
    }
  });

  if (metrics.clouds > 60) bullets.push("Clouds reducing visibility");
  if (metrics.windSpeed > 10) bullets.push("Breezy surface conditions");
  if (metrics.rain > 0.05) bullets.push("Light rain possible");
  if (tideInfo) bullets.push(isRising ? "Rising tide improving conditions" : "Falling tide may reduce visibility");
  if (Number.isFinite(metrics.temp)) bullets.push(`Sea temp: ${metrics.temp.toFixed(1)}F`);
  if (Number.isFinite(metrics.currentSpeed)) bullets.push(`Currents: ${metrics.currentSpeed.toFixed(1)} mph, ${toCardinal(metrics.currentDir)}`);
  if (Number.isFinite(metrics.windSpeed)) bullets.push(`Wind: ${metrics.windSpeed.toFixed(1)} mph, ${toCardinal(metrics.windDir)}`);
  if (tideInfo) bullets.push(`Tide: ${tideInfo}`);

  return bullets;
};

function buildSpotCard(result, sharedSummaryItems) {
  const { region, score, summary, bestTime, bestScore } = result;
  const filtered = summary.filter((item) => !sharedSummaryItems.includes(item));
  const scoreColor = getScoreColor(score);
  const protectedBadge = region.protected
    ? '<span style="background:#2aa198;color:white;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:8px;">Protected</span>'
    : "";

  return `
    <div class="snorkel-card">
      <div class="snorkel-header">
        <h3>${region.title}${protectedBadge}</h3>
        <div class="snorkel-score" style="color:${scoreColor};">${score}/10</div>
      </div>
      <div class="region-towns">${region.towns}</div>
      <div class="best-time">Next Best Time: ${bestTime} (${bestScore}/10)</div>
      <div class="snorkel-summary"><ul>${filtered.map((item) => `<li>${item}</li>`).join("")}</ul></div>
    </div>
  `;
}

function buildShoreSection(shoreName, shoreResults, sharedSummaryItems, isOpenByDefault = false) {
  const average = Math.round((shoreResults.reduce((sum, result) => sum + result.score, 0) / shoreResults.length) * 10) / 10;
  const color = getScoreColor(average);
  const topSpot = [...shoreResults].sort((a, b) => b.score - a.score)[0];
  const shoreSharedCounts = {};

  shoreResults.flatMap((result) => result.summary).forEach((item) => {
    shoreSharedCounts[item] = (shoreSharedCounts[item] || 0) + 1;
  });

  const shoreHighlights = Object.entries(shoreSharedCounts)
    .filter(([, count]) => count >= Math.max(2, Math.ceil(shoreResults.length * 0.5)))
    .map(([item]) => item)
    .slice(0, 3);

  return `
    <details class="shore-section"${isOpenByDefault ? " open" : ""}>
      <summary class="shore-summary">
        <div class="shore-summary-main">
          <div class="shore-summary-title">
            <h3>${shoreName} Shore</h3>
            <p>${shoreResults.length} spots${topSpot ? `, best now: ${topSpot.region.title}` : ""}</p>
          </div>
          <div class="shore-summary-meta">
            <div class="shore-score" style="color:${color};">${average}/10</div>
            <div class="shore-summary-label">Regional average</div>
          </div>
        </div>
        <div class="shore-highlights">${shoreHighlights.map((item) => `<span>${item}</span>`).join("")}</div>
      </summary>
      <div class="shore-details">
        <div class="snorkel-group-grid">
          ${shoreResults.map((result) => buildSpotCard(result, sharedSummaryItems)).join("")}
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
    REGIONS.map((region) =>
      Promise.all([fetchForecast(region, { forecastHours: 24 }), fetchTide(region.stationId)]).then(([forecast, tideData]) => {
        const scoreResult = calculateRegionalScore(forecast.current, region, { includeDetails: true });
        const summary = generateSummary(scoreResult, forecast.current, tideData.tideSummary, tideData.isRising);
        const best = findBestSnorkelTime(forecast.hourly, region);

        return {
          region,
          score: scoreResult.score,
          summary,
          bestTime: best.time,
          bestScore: best.score
        };
      })
    )
  )
    .then((results) => {
      const allSummaries = results.map((result) => result.summary);
      const allScores = results.map((result) => result.score);
      const counts = {};

      allSummaries.flat().forEach((item) => {
        counts[item] = (counts[item] || 0) + 1;
      });

      const threshold = Math.ceil(REGIONS.length * 0.4);
      const shared = Object.entries(counts)
        .filter(([, count]) => count >= threshold)
        .map(([item]) => item);

      const average = Math.round((allScores.reduce((sum, value) => sum + value, 0) / allScores.length) * 10) / 10;
      const color = getScoreColor(average);

      const islandSummary = document.getElementById("island-summary");
      if (islandSummary) {
        islandSummary.innerHTML = `
          <div class="island-header">
            <h3 style="margin-right: 6px;">Island-Wide (${REGIONS.length} regions)</h3>
            <div class="snorkel-score" style="color:${color}; margin-left: 6px;">${average}/10</div>
          </div>
          <div class="island-conditions"><ul>${shared.map((item) => `<li>${item}</li>`).join("")}</ul></div>
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

      container.innerHTML = groupedResults
        .map((group, index) => buildShoreSection(group.shore, group.results, shared, index === 0))
        .join("");
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
