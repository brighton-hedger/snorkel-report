const {
  REGIONS,
  getDateKey,
  fetchForecast,
  getDaylightAverageScore,
  getScoreColor
} = window.SnorkelShared;

const WEEK_FORECAST_DAYS = 7;
const SHORE_ORDER = ["East", "South", "North", "West"];

function buildWeekDays() {
  return [...Array(WEEK_FORECAST_DAYS)].map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return {
      dateKey: getDateKey(date),
      shortLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
      longLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    };
  });
}

function buildRegionGroups() {
  return SHORE_ORDER.map((shore) => ({
    shore,
    regions: REGIONS.filter((region) => region.shore === shore)
  })).filter((group) => group.regions.length);
}

function buildWeeklyTableMarkup(shore, rows, days) {
  return `
    <details class="shore-section weekly-region-group">
      <summary class="shore-summary">
        <div class="shore-summary-main">
          <div class="shore-summary-title">
            <p>${shore} Shore</p>
          </div>
          <div class="shore-arrow" aria-hidden="true"></div>
        </div>
      </summary>
      <div class="shore-details">
        <div class="weekly-table-shell">
        <table class="weekly-table">
          <thead>
            <tr>
              <th>Region</th>
              ${days.map((day) => `<th>${day.shortLabel}<span>${day.longLabel}</span></th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td class="region">${row.region.title}</td>
                ${row.scores.map((score) => {
                  if (score === null) {
                    return "<td>--</td>";
                  }

                  const fixedScore = score.toFixed(1);
                  return `<td style="color:${getScoreColor(score)};">${fixedScore}/10</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
        </div>
      </div>
    </details>
  `;
}

async function buildWeekForecast() {
  const container = document.getElementById("weekly-groups");
  if (!container) return;

  const days = buildWeekDays();
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + (WEEK_FORECAST_DAYS - 1));

  const weekRangeEl = document.getElementById("week-range");
  if (weekRangeEl) {
    weekRangeEl.textContent = `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }

  const forecastResults = await Promise.all(
    REGIONS.map(async (region) => {
      try {
        const forecast = await fetchForecast(region, { forecastDays: WEEK_FORECAST_DAYS });
        return {
          region,
          scores: days.map((day) => getDaylightAverageScore(forecast.hourly, region, day.dateKey))
        };
      } catch (error) {
        console.error(`Error fetching data for ${region.title}:`, error);
        return {
          region,
          scores: days.map(() => null)
        };
      }
    })
  );

  const groupedMarkup = buildRegionGroups().map((group) => {
    const rows = group.regions
      .map((region) => forecastResults.find((result) => result.region.title === region.title))
      .filter(Boolean);
    return buildWeeklyTableMarkup(group.shore, rows, days);
  });

  container.innerHTML = groupedMarkup.join("");
}

function initializeWeekForecast() {
  buildWeekForecast().catch((error) => {
    console.error("Error building week forecast tables:", error);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeWeekForecast);
} else {
  initializeWeekForecast();
}
