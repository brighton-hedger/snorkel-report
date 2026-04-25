const {
  REGIONS,
  fetchForecast,
  fetchTide,
  calculateRegionalScore,
  findBestSnorkelTime,
  getDaylightScoreSeries,
  getDaylightAverageScore,
  getScoreColor,
  toCardinal,
  getDateKey
} = window.SnorkelShared;

const DAY_FORECAST_DAYS = 3;
const WEEK_FORECAST_DAYS = 7;
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

const REGION_SLUGS = {
  "lanikai-kailua": "Lanikai/Kailua",
  waimanalo: "Waimanalo",
  waikiki: "Waikiki",
  "ala-moana": "Ala Moana",
  "hawaii-kai": "Hawaii Kai",
  haleiwa: "Haleiwa",
  "waimea-bay": "Waimea Bay",
  pupukea: "Pupukea",
  "ko-olina": "Ko Olina",
  "pokai-bay": "Pokai Bay",
  nanakuli: "Nanakuli",
  "kaneohe-bay": "Kaneohe Bay"
};

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
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
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
    notes.bad.push(`Wind is forecast to build through the day, so surface chop may get worse later on.`);
  } else if (windDelta <= -3) {
    notes.good.push(`Wind is forecast to ease through the day, which should help clean up the surface later on.`);
  }

  if (waveDelta >= 0.75) {
    notes.bad.push(`Wave energy is forecast to build through the day, which is part of why the score fades later on.`);
  } else if (waveDelta <= -0.75) {
    notes.good.push(`Wave height trends lower later in the day, which helps explain the improving score trend.`);
  }

  if (currentDelta >= 0.4) {
    notes.bad.push(`Current strength increases later in the day, which can make entries and exits less comfortable.`);
  } else if (currentDelta <= -0.4) {
    notes.good.push(`Current strength eases later in the day, which helps make the region more manageable.`);
  }

  if (cloudDelta >= 20 || rainDelta > 0.03) {
    notes.bad.push(`Clouds and rain increase later in the day, so light and visibility may be worse than earlier.`);
  } else if (cloudDelta <= -20 && rainDelta <= 0) {
    notes.good.push(`Sky conditions improve later in the day, which should help with light and underwater visibility.`);
  }

  if (tideDelta <= -0.8) {
    notes.bad.push(`Tide drops noticeably through the day, which can mean less reef clearance later on.`);
  } else if (tideDelta >= 0.8) {
    notes.good.push(`Tide rises into a deeper window later in the day, which can make the reef feel a bit more forgiving.`);
  }

  return notes;
}

function buildConditionBreakdown(metrics, region, tideData, scoreDetails = [], dayEntries = []) {
  const good = [];
  const bad = [];
  const tideLevels = (tideData?.predictions || [])
    .map((point) => Number(point.value))
    .filter((value) => Number.isFinite(value));
  const tideSwing = tideLevels.length ? Math.max(...tideLevels) - Math.min(...tideLevels) : null;

  if (region.protected) {
    good.push(`${region.title} gets some protection from its cove and shoreline shape.`);
  }

  if (metrics.waveHeight <= 1.5) {
    good.push(`Smaller waves should make entry and visibility friendlier.`);
  } else if (metrics.waveHeight >= 4) {
    bad.push(`Wave height is elevated, which can make entry and inside conditions rougher.`);
  }

  if (metrics.swellHeight <= 1.75) {
    good.push(`Lower swell is helping keep this sub-region calmer.`);
  } else if (metrics.swellHeight >= 2.5) {
    bad.push(`Open-ocean swell is adding extra movement here.`);
  }

  if (metrics.windSpeed <= 8) {
    good.push(`Lighter wind should help keep the surface cleaner.`);
  } else if (metrics.windSpeed >= 12) {
    bad.push(`Stronger wind is likely adding chop on the surface.`);
  }

  if (metrics.currentSpeed <= 0.5) {
    good.push(`Currents look fairly manageable right now.`);
  } else if (metrics.currentSpeed >= 1.2) {
    bad.push(`Current strength is up, so drift and exits may be tougher.`);
  }

  if (metrics.clouds <= 35 && metrics.rain <= 0.02) {
    good.push(`Clearer weather should help with light and underwater visibility.`);
  } else {
    if (metrics.clouds >= 60) {
      bad.push(`Cloud cover may flatten the light and make the water look murkier.`);
    }

    if (metrics.rain > 0.02) {
      bad.push(`Rain could reduce visibility and make the surface less pleasant.`);
    }
  }

  if (Number.isFinite(metrics.tide)) {
    if (metrics.tide >= 1 && metrics.tide <= 2.5) {
      good.push(`Tide level is in a more comfortable middle range for reef depth.`);
    } else if (metrics.tide < 0.5) {
      bad.push(`Lower tide can mean less clearance over shallow reef and rock.`);
    }
  }

  if (Number.isFinite(tideSwing) && tideSwing >= 3.5) {
    bad.push(`A large tide swing today can make reef depth and entry conditions less consistent.`);
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

function getWeatherChip(metrics) {
  if (Number.isFinite(metrics.rain) && metrics.rain > 0.01) {
    return {
      icon: ICONS.weatherRain,
      label: "Weather",
      value: `${metrics.rain.toFixed(2)} in rain`
    };
  }

  if ((metrics.clouds ?? 0) > 60) {
    return {
      icon: ICONS.weatherCloud,
      label: "Weather",
      value: `${Math.round(metrics.clouds)}% cloud cover`
    };
  }

  return {
    icon: ICONS.weatherSun,
    label: "Weather",
    value: `${Math.round(metrics.clouds ?? 0)}% cloud cover`
  };
}

function createMetricMarkup(icon, label, value) {
  return `
    <div class="region-metric-card">
      <div class="region-metric-head">
        <img src="${icon}" alt="" class="map-chip-icon">
        <strong>${label}</strong>
      </div>
      <span>${value}</span>
    </div>
  `;
}

function buildCurrentMetricsMarkup(metrics, tideData, bestTime) {
  const weatherChip = getWeatherChip(metrics);
  const bestScoreColor = getScoreColor(bestTime.score);
  return [
    createMetricMarkup(ICONS.bestWindow, "Next best time", `${bestTime.time} | <strong style="color:${bestScoreColor};">${bestTime.score}/10</strong>`),
    createMetricMarkup(ICONS.sea, "Sea", Number.isFinite(metrics.temp) ? `${metrics.temp.toFixed(1)}&deg;F` : "--"),
    createMetricMarkup(ICONS.wind, "Wind", `${Number.isFinite(metrics.windSpeed) ? metrics.windSpeed.toFixed(1) : "--"} mph ${toCardinal(metrics.windDir)}`),
    createMetricMarkup(ICONS.waves, "Waves", `${Number.isFinite(metrics.waveHeight) ? metrics.waveHeight.toFixed(1) : "--"} ft`),
    createMetricMarkup(ICONS.current, "Current", `${Number.isFinite(metrics.currentSpeed) ? metrics.currentSpeed.toFixed(1) : "--"} mph ${toCardinal(metrics.currentDir)}`),
    createMetricMarkup(weatherChip.icon, weatherChip.label, weatherChip.value),
    createMetricMarkup(ICONS.swell, "Swell", `${Number.isFinite(metrics.swellHeight) ? metrics.swellHeight.toFixed(1) : "--"} ft | ${Number.isFinite(metrics.swellPeriod) ? metrics.swellPeriod.toFixed(0) : "--"}s`),
    createMetricMarkup(ICONS.tide, "Tide", tideData?.tideSummary || "Unavailable")
  ].join("");
}

function buildDayDescriptors(count) {
  return [...Array(count)].map((_, index) => {
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
  return `region-page-chart-${regionTitle.replace(/[^a-z0-9]+/gi, "")}-d${dayIndex}`;
}

function renderDayChart(canvasId, label, points) {
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

function buildNarrative(region, metrics, bestTime, daySeries, breakdown) {
  if (!daySeries.length) {
    return `
      <p>${region.title} does not have enough daylight forecast data loaded right now to build a daily trend summary.</p>
    `;
  }

  const start = daySeries[0];
  const end = daySeries[daySeries.length - 1];
  const best = daySeries.reduce((currentBest, point) => (point.score > currentBest.score ? point : currentBest), daySeries[0]);
  const delta = end.score - start.score;
  const positives = breakdown.good.length ? breakdown.good[0] : "A few of the local signals are helping keep this region workable.";
  const negatives = breakdown.bad.length ? breakdown.bad[0] : "There are no major red flags dominating the forecast right now.";
  const currentScore = calculateRegionalScore(metrics, region);
  const scoreColor = getScoreColor(currentScore);
  const startColor = getScoreColor(start.score);
  const endColor = getScoreColor(end.score);
  const peakColor = getScoreColor(best.score);
  const trendDriver =
    delta >= 1
      ? (breakdown.good[1] || breakdown.good[0] || "A few forecast signals improve later in the day.")
      : delta <= -1
        ? (breakdown.bad[1] || breakdown.bad[0] || "A few forecast signals get less favorable later in the day.")
        : "";
  let trendSentence = "Conditions look fairly steady through the daylight window.";

  if (delta >= 1) {
    trendSentence = `Conditions look likely to improve through the day, rising from about <strong style="color:${startColor};">${start.score.toFixed(1)}/10</strong> early to <strong style="color:${endColor};">${end.score.toFixed(1)}/10</strong> later on.`;
  } else if (delta <= -1) {
    trendSentence = `Conditions look likely to fade through the day, dropping from about <strong style="color:${startColor};">${start.score.toFixed(1)}/10</strong> early to <strong style="color:${endColor};">${end.score.toFixed(1)}/10</strong> later on.`;
  } else {
    trendSentence = `Conditions look fairly steady through the daylight window, holding around <strong style="color:${startColor};">${start.score.toFixed(1)}/10</strong> to <strong style="color:${endColor};">${end.score.toFixed(1)}/10</strong>.`;
  }

  return `
    <p>${region.title} is currently scoring <strong style="color:${scoreColor};">${currentScore.toFixed(1)}/10</strong>. ${positives} ${negatives}</p>
    <p>${trendSentence}${trendDriver ? ` ${trendDriver}` : ""} The best daylight window currently looks to be around <strong>${bestTime.time}</strong>, with a peak score near <strong style="color:${peakColor};">${best.score.toFixed(1)}/10</strong>.</p>
  `;
}

function buildWeekTableMarkup(scores, region) {
  const days = buildDayDescriptors(WEEK_FORECAST_DAYS).map((day, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return {
      shortLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
      longLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: scores[index]
    };
  });

  return `
    <div class="weekly-table-shell">
      <table class="weekly-table region-weekly-table">
        <thead>
          <tr>
            <th>Region</th>
            ${days.map((day) => `<th>${day.shortLabel}<span>${day.longLabel}</span></th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="region">${region.title}</td>
            ${days
              .map((day) => {
                if (day.score === null) {
                  return "<td>--</td>";
                }
                return `<td style="color:${getScoreColor(day.score)};">${day.score.toFixed(1)}/10</td>`;
              })
              .join("")}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

async function loadRegionPage() {
  const slug = document.body.dataset.regionSlug;
  const regionTitle = REGION_SLUGS[slug];
  const region = REGIONS.find((entry) => entry.title === regionTitle);
  const errorEl = document.getElementById("region-report-error");
  const contentEl = document.getElementById("region-report-content");

  if (!region || !contentEl) {
    if (errorEl) {
      errorEl.textContent = "Could not find that detailed report.";
      errorEl.style.display = "block";
    }
    return;
  }

  try {
    const [forecast, tideData] = await Promise.all([
      fetchForecast(region, { forecastDays: WEEK_FORECAST_DAYS }),
      fetchTide(region.stationId)
    ]);

    const metrics = getSafeMetrics(forecast.current);
    const scoreResult = calculateRegionalScore(metrics, region, { includeDetails: true });
    const bestTime = findBestSnorkelTime(forecast.hourly || [], region);
    const todayRawEntries = (forecast.hourly || []).filter((entry) => {
      const dateKey = getDateKey(new Date());
      return entry.dateKey === dateKey && entry.hour >= 6 && entry.hour < 18;
    });
    const breakdown = buildConditionBreakdown(metrics, region, tideData, scoreResult.details, todayRawEntries);
    const dayDescriptors = buildDayDescriptors(DAY_FORECAST_DAYS);
    const threeDaySeries = dayDescriptors.map((day) => ({
      ...day,
      points: getDaylightScoreSeries(forecast.hourly || [], region, day.dateKey).map((entry) => ({
        time: new Date(entry.time).toLocaleTimeString([], { hour: "numeric", hour12: true }),
        score: entry.score
      }))
    }));
    const todaySeries = getDaylightScoreSeries(forecast.hourly || [], region, getDateKey(new Date())).map((entry) => ({
      time: entry.time,
      score: entry.score
    }));
    const weekScores = buildDayDescriptors(WEEK_FORECAST_DAYS).map((day) =>
      getDaylightAverageScore(forecast.hourly || [], region, day.dateKey)
    );

    const scoreColor = getScoreColor(scoreResult.score);
    document.title = `${region.title} Snorkel Report | Oahu Detailed Report`;

    const summaryHtml = buildNarrative(region, metrics, bestTime, todaySeries, breakdown);

    contentEl.innerHTML = `
      <section class="content-hero region-report-hero">
        <p class="content-eyebrow">Detailed Report</p>
        <h1>${region.title}</h1>
        <p>${region.towns} | ${region.shore} Shore</p>
        <div class="region-report-score" style="color:${scoreColor}; border-color:${scoreColor};">${scoreResult.score}/10</div>
      </section>

      <section class="content-card">
        <h2>Live Conditions</h2>
        <div class="region-metrics-grid">
          ${buildCurrentMetricsMarkup(metrics, tideData, bestTime)}
        </div>
      </section>

      <section class="content-card">
        <h2>Conditions Summary</h2>
        <div class="region-summary-copy">
          ${summaryHtml}
        </div>
        <div class="condition-breakdown region-summary-breakdown">
          <section class="condition-breakdown-panel condition-breakdown-good">
            <h4>What is helping</h4>
            <ul>${(breakdown.good.length ? breakdown.good : ["No major helping factors are standing out right now."]).map((item) => `<li>${item}</li>`).join("")}</ul>
          </section>
          <section class="condition-breakdown-panel condition-breakdown-bad">
            <h4>What is hurting</h4>
            <ul>${(breakdown.bad.length ? breakdown.bad : ["No major warning flags are dominating the forecast right now."]).map((item) => `<li>${item}</li>`).join("")}</ul>
          </section>
        </div>
      </section>

      <section class="content-card">
        <h2>3 Day Graphs</h2>
        <div class="region-day-chart-grid standalone-region-charts">
          ${threeDaySeries.map((day) => `
            <section class="region-day-chart-panel">
              <div class="region-day-chart-label">
                <strong>${day.shortLabel}</strong>
                <span>${day.fullLabel}</span>
              </div>
              ${
                day.points.length
                  ? `<canvas id="${toCanvasId(region.title, day.index)}" width="420" height="320"></canvas>`
                  : '<div class="chart-empty-state">No daylight data available.</div>'
              }
            </section>
          `).join("")}
        </div>
      </section>

      <section class="content-card">
        <h2>7 Day Outlook</h2>
        ${buildWeekTableMarkup(weekScores, region)}
      </section>
    `;

    threeDaySeries.forEach((day) => {
      if (day.points.length) {
        renderDayChart(toCanvasId(region.title, day.index), `${region.title} ${day.shortLabel}`, day.points);
      }
    });
  } catch (error) {
    console.error("Region page error:", error);
    if (errorEl) {
      errorEl.textContent = "Could not load this detailed report right now. Please try again later.";
      errorEl.style.display = "block";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadRegionPage);
} else {
  loadRegionPage();
}
