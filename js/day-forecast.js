// ==================== ENHANCED DAY FORECAST SCRIPT ====================
const {
  REGIONS,
  getDateKey,
  fetchForecast,
  getDaylightScoreSeries
} = window.SnorkelShared;

const DAY_FORECAST_DAYS = 3;

async function fetchSnorkelData(region, dayOffset = 0) {
  const forecast = await fetchForecast(region, { forecastDays: DAY_FORECAST_DAYS });
  const targetDate = new Date();
  targetDate.setHours(0, 0, 0, 0);
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const targetDateKey = getDateKey(targetDate);

  return getDaylightScoreSeries(forecast.hourly, region, targetDateKey).map((entry) => ({
    time: new Date(entry.time).toLocaleTimeString([], { hour: "numeric", hour12: true }),
    score: entry.score
  }));
}

async function drawDaySection(dayOffset) {
  const container = document.getElementById("scroll-days");
  if (!container) return;

  const section = document.createElement("div");
  section.className = "day-section";
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  const dateStr = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  section.innerHTML = `<h2>${dateStr}</h2><div class="chart-wrapper" id="charts-day${dayOffset}"></div>`;
  container.appendChild(section);

  for (const region of REGIONS) {
    const data = await fetchSnorkelData(region, dayOffset);
    const chartSection = document.createElement("div");
    chartSection.className = "chart-container";
    const canvasId = `chart-${region.title.replace(/\s/g, "")}-d${dayOffset}`;
    chartSection.innerHTML = `<h3>${region.title}</h3><canvas id="${canvasId}" width="500" height="400"></canvas>`;
    section.querySelector(".chart-wrapper").appendChild(chartSection);

    new Chart(document.getElementById(canvasId), {
      type: "line",
      data: {
        labels: data.map((point) => point.time),
        datasets: [
          {
            label: region.title,
            data: data.map((point) => point.score),
            borderColor: "#2aa198",
            backgroundColor: "rgba(42, 161, 152, 0.2)",
            fill: true,
            tension: 0.4,
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
            ticks: { font: { size: 15 } },
            title: { display: true, text: "Score" }
          },
          x: {
            ticks: {
              maxTicksLimit: 12,
              callback(value, index) {
                return index % 3 === 0 ? this.getLabelForValue(value) : "";
              },
              font: { size: 15 }
            }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}

function getDaySections() {
  return Array.from(document.querySelectorAll(".day-section"));
}

function setActiveDay(dayIndex) {
  const tabs = Array.from(document.querySelectorAll(".day-tab"));
  const prevButton = document.getElementById("day-prev");
  const nextButton = document.getElementById("day-next");

  tabs.forEach((tab, index) => {
    const isActive = index === dayIndex;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });

  if (prevButton) prevButton.disabled = dayIndex <= 0;
  if (nextButton) nextButton.disabled = dayIndex >= tabs.length - 1;
}

function scrollToDay(dayIndex) {
  const sections = getDaySections();
  const container = document.getElementById("scroll-days");
  const target = sections[dayIndex];
  if (!container || !target) return;

  container.scrollTo({
    left: target.offsetLeft,
    behavior: "smooth"
  });

  setActiveDay(dayIndex);
}

function getCurrentVisibleDayIndex(container, sections) {
  const scrollCenter = container.scrollLeft + container.clientWidth / 2;
  let closestIndex = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;

  sections.forEach((section, index) => {
    const sectionCenter = section.offsetLeft + section.offsetWidth / 2;
    const distance = Math.abs(sectionCenter - scrollCenter);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function setupDayNavigation() {
  const container = document.getElementById("scroll-days");
  const tabsContainer = document.getElementById("day-tabs");
  const prevButton = document.getElementById("day-prev");
  const nextButton = document.getElementById("day-next");
  const sections = getDaySections();

  if (!container || !tabsContainer || !prevButton || !nextButton || !sections.length) return;

  tabsContainer.innerHTML = "";

  sections.forEach((section, index) => {
    const label = section.dataset.dayLabel || `Day ${index + 1}`;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "day-tab";
    tab.id = `day-tab-${index}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", section.id);
    tab.setAttribute("aria-selected", "false");
    tab.textContent = label;
    tab.addEventListener("click", () => scrollToDay(index));
    tabsContainer.appendChild(tab);
  });

  prevButton.addEventListener("click", () => {
    const currentIndex = getCurrentVisibleDayIndex(container, sections);
    scrollToDay(Math.max(0, currentIndex - 1));
  });

  nextButton.addEventListener("click", () => {
    const currentIndex = getCurrentVisibleDayIndex(container, sections);
    scrollToDay(Math.min(sections.length - 1, currentIndex + 1));
  });

  let ticking = false;
  container.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      setActiveDay(getCurrentVisibleDayIndex(container, sections));
      ticking = false;
    });
  });

  setActiveDay(0);
}

function initializeDayForecast() {
  const forecastDateEl = document.getElementById("forecast-date");
  if (forecastDateEl) {
    forecastDateEl.textContent = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  Promise.all([...Array(DAY_FORECAST_DAYS)].map((_, index) => drawDaySection(index)))
    .then(() => {
      const sections = getDaySections();
      sections.forEach((section, index) => {
        section.id = `day-section-${index}`;
        const heading = section.querySelector("h2");
        section.dataset.dayLabel = heading ? heading.textContent : `Day ${index + 1}`;
      });
      setupDayNavigation();
    })
    .catch((error) => {
      console.error("Error loading day forecast:", error);
      const errorMessage = document.getElementById("error-message");
      if (errorMessage) {
        errorMessage.textContent = "Error loading day forecast. Please try again later.";
        errorMessage.style.display = "block";
      }
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDayForecast);
} else {
  initializeDayForecast();
}
