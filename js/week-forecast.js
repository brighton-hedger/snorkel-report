// ==================== ENHANCED WEEK FORECAST SCRIPT ====================
const {
  REGIONS,
  getDateKey,
  fetchForecast,
  getDaylightAverageScore,
  getScoreColor
} = window.SnorkelShared;

const WEEK_FORECAST_DAYS = 7;

async function buildTable() {
  const tbody = document.querySelector("#weekly-table tbody");
  const thead = document.getElementById("table-header");
  if (!tbody || !thead) return;

  const days = [...Array(WEEK_FORECAST_DAYS)].map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return {
      dateKey: getDateKey(date),
      label: date.toLocaleDateString("en-US", { weekday: "short" })
    };
  });

  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + (WEEK_FORECAST_DAYS - 1));
  const options = { month: "long", day: "numeric" };
  const weekRangeEl = document.getElementById("week-range");
  if (weekRangeEl) {
    weekRangeEl.textContent = `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}`;
  }

  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `<th>Region</th>${days.map((day) => `<th>${day.label}</th>`).join("")}`;
  thead.innerHTML = "";
  thead.appendChild(headerRow);
  tbody.innerHTML = "";

  for (const region of REGIONS) {
    const row = document.createElement("tr");
    row.innerHTML = `<td class="region">${region.title}</td>${days.map(() => "<td>--</td>").join("")}`;
    tbody.appendChild(row);

    try {
      const forecast = await fetchForecast(region, { forecastDays: WEEK_FORECAST_DAYS });

      days.forEach((day, dayIndex) => {
        const avg = getDaylightAverageScore(forecast.hourly, region, day.dateKey);
        const cell = row.children[dayIndex + 1];

        if (avg === null) {
          cell.textContent = "--";
          return;
        }

        const avgFixed = avg.toFixed(1);
        cell.textContent = `${avgFixed}/10`;
        cell.style.color = getScoreColor(parseFloat(avgFixed));
      });
    } catch (error) {
      console.error(`Error fetching data for ${region.title}:`, error);
    }
  }
}

function initializeWeekForecast() {
  buildTable().catch((error) => {
    console.error("Error building week forecast table:", error);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeWeekForecast);
} else {
  initializeWeekForecast();
}
