const {
  REGIONS,
  fetchForecast,
  fetchTide,
  fetchActiveAdvisories,
  calculateRegionalScore,
  findBestSnorkelTime,
  getScoreColor,
  toCardinal,
  getRegionAdvisories,
  escapeHtml
} = window.SnorkelShared;

const SHORE_ORDER = ["East", "South", "North", "West"];
const TIDE_CHART_WIDTH = 320;
const TIDE_CHART_HEIGHT = 210;
const TIDE_CHART_PAD_X = 18;
const TIDE_CHART_PAD_TOP = 42;
const TIDE_CHART_PAD_BOTTOM = 48;
const DAYLIGHT_START_HOUR = 6;
const DAYLIGHT_END_HOUR = 18;
const NO_BETTER_TIME_LABEL = "Best right now";
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
const REGION_ORDER_INDEX = new Map(REGIONS.map((region, index) => [region.title, index]));

function formatAdvisoryTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function buildBrownWaterWarningsMarkup(advisories, compact = false) {
  if (!advisories?.length) {
    return "";
  }

  return `
    <div class="water-quality-warning-list${compact ? " water-quality-warning-list-compact" : ""}">
      ${advisories.map((advisory) => {
        const cause = advisory.cause ? escapeHtml(advisory.cause.replace(/_/g, " ")) : "Brown water";
        const headline = escapeHtml(advisory.headline || "Brown water advisory");
        const timing = advisory.expires_at
          ? `Active through ${escapeHtml(formatAdvisoryTime(advisory.expires_at))}`
          : advisory.issued_at
            ? `Posted ${escapeHtml(formatAdvisoryTime(advisory.issued_at))}`
            : "";
        const source = advisory.source_url
          ? `<a href="${escapeHtml(advisory.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(advisory.source_name || "Source")}</a>`
          : advisory.source_name
            ? `<span>${escapeHtml(advisory.source_name)}</span>`
            : "";
        const meta = [timing, source].filter(Boolean).join(" | ");

        return `
          <section class="water-quality-warning${compact ? " water-quality-warning-compact" : ""}">
            <div class="water-quality-warning-head">
              <strong>Brown Water Advisory</strong>
              <span>${cause}</span>
            </div>
            <p>${headline}</p>
            ${meta ? `<div class="water-quality-warning-meta">${meta}</div>` : ""}
          </section>
        `;
      }).join("")}
    </div>
  `;
}

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function estimateLabelWidth(text, perChar, base) {
  return text.length * perChar + base;
}

function boxesOverlap(boxA, boxB, gap = 10) {
  return !(
    boxA.right + gap <= boxB.left ||
    boxB.right + gap <= boxA.left ||
    boxA.bottom + gap <= boxB.top ||
    boxB.bottom + gap <= boxA.top
  );
}

function boxHitsCurve(box, samplePoints) {
  return samplePoints.some(
    (point) =>
      point.x >= box.left - 10 &&
      point.x <= box.right + 10 &&
      point.y >= box.top - 10 &&
      point.y <= box.bottom + 10
  );
}

function getCurveSlice(box, samplePoints) {
  return samplePoints.filter((point) => point.x >= box.left - 6 && point.x <= box.right + 6);
}

function getLocalCurveStats(box, samplePoints) {
  const localCurve = getCurveSlice(box, samplePoints);
  if (!localCurve.length) {
    return null;
  }

  return {
    minY: Math.min(...localCurve.map((point) => point.y)),
    maxY: Math.max(...localCurve.map((point) => point.y))
  };
}

function getWeatherChip(metrics) {
  if (Number.isFinite(metrics.rain) && metrics.rain > 0.01) {
    return {
      icon: ICONS.weatherRain,
      label: "Weather",
      value: `${metrics.rain.toFixed(2)} in of rain`
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
    value: `${Math.round(metrics.clouds)}% cloud cover`
  };
}

function findBestDisplayTime(hourlyData, region) {
  return findBestSnorkelTime(hourlyData || [], region);
}

function buildConditionChips(metrics, tideData, bestTime, bestScore) {
  const chips = [];

  if (Number.isFinite(metrics.windSpeed)) {
    chips.push({
      icon: ICONS.wind,
      label: "Wind",
      value: `${metrics.windSpeed.toFixed(0)} mph ${toCardinal(metrics.windDir)}`
    });
  }

  if (Number.isFinite(metrics.waveHeight)) {
    chips.push({
      icon: ICONS.waves,
      label: "Waves",
      value: `${metrics.waveHeight.toFixed(1)} ft`
    });
  }

  if (Number.isFinite(metrics.temp)) {
    chips.push({
      icon: ICONS.sea,
      label: "Sea",
      value: `${metrics.temp.toFixed(0)}&deg;F`
    });
  }

  if (Number.isFinite(metrics.currentSpeed)) {
    chips.push({
      icon: ICONS.current,
      label: "Current",
      value: `${metrics.currentSpeed.toFixed(1)} mph ${toCardinal(metrics.currentDir)}`
    });
  }

  chips.push(getWeatherChip(metrics));

  if (Number.isFinite(metrics.swellHeight)) {
    const swellParts = [`${metrics.swellHeight.toFixed(1)} ft`];
    if (Number.isFinite(metrics.swellPeriod) && metrics.swellPeriod > 0) {
      swellParts.push(`${metrics.swellPeriod.toFixed(0)}s`);
    }

    chips.push({
      icon: ICONS.swell,
      label: "Swell",
      value: swellParts.join(" &middot; ")
    });
  }

  chips.push({
    icon: ICONS.bestWindow,
    label: "Next best time",
    value: bestTime === NO_BETTER_TIME_LABEL ? bestTime : `${bestTime} &middot; ${bestScore}/10`
  });

  if (tideData?.tideSummary && chips.length < 6) {
    chips.push({
      icon: ICONS.tide,
      label: "Tide",
      value: tideData.isRising ? "Rising" : "Falling"
    });
  }

  return chips.filter((chip) => chip.label !== "Next best time").slice(0, 6);
}

function buildConditionBreakdown(metrics, region, tideData, scoreDetails = []) {
  const good = [];
  const bad = [];
  const tideLevels = (tideData?.predictions || [])
    .map((point) => Number(point.value))
    .filter((value) => Number.isFinite(value));
  const tideSwing = tideLevels.length ? Math.max(...tideLevels) - Math.min(...tideLevels) : null;
  const lowestTide = tideLevels.length ? Math.min(...tideLevels) : null;

  if (region.protected) {
    good.push(`${region.title} gets some protection from its cove and shoreline shape.`);
  }

  if (metrics.waveHeight <= 1.5) {
    good.push(`Small waves near ${region.title} should make entry and visibility friendlier.`);
  } else if (metrics.waveHeight >= 4) {
    bad.push(`Wave height is elevated here, which can make entry and inside conditions rougher.`);
  }

  if (metrics.swellHeight <= 1.75) {
    good.push(`Lower swell is helping keep this sub-region calmer.`);
  } else if (metrics.swellHeight >= 2.5) {
    bad.push(`Open-ocean swell is adding extra movement in this area.`);
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

  if (metrics.clouds <= 20 && metrics.rain <= 0.01) {
    good.push(`Clearer, sunnier weather should help with light and underwater visibility.`);
  } else if (metrics.clouds <= 35 && metrics.rain <= 0.02) {
    good.push(`Fairly clear weather should help keep visibility better than a cloudy day.`);
  } else {
    if (metrics.clouds >= 80) {
      bad.push(`Very cloudy skies can flatten the light and make snorkeling look murkier.`);
    } else if (metrics.clouds >= 60) {
      bad.push(`Cloud cover may flatten the light and make the water look murkier.`);
    }

    if (metrics.rain > 0.1) {
      bad.push(`Rainy conditions are a negative here because runoff and lower light can hurt visibility.`);
    } else if (metrics.rain > 0.02) {
      bad.push(`Rain could reduce visibility and make the surface less pleasant.`);
    }
  }

  if (Number.isFinite(metrics.tide)) {
    if (metrics.tide >= 1 && metrics.tide <= 2.5) {
      good.push(`Tide level is in a more comfortable middle range for reef depth.`);
    } else if (metrics.tide < 0) {
      bad.push(`Extremely low tide can mean less clearance over shallow reef and rock.`);
    } else if (metrics.tide < 0.5) {
      bad.push(`Lower tide can mean less clearance over shallow reef and rock.`);
    }
  }

  if (Number.isFinite(tideSwing) && tideSwing <= 1.5) {
    good.push(`A smaller tide swing today should make reef depth a bit steadier.`);
  } else if (Number.isFinite(tideSwing) && tideSwing >= 3.5) {
    bad.push(`A large tide swing today can make reef depth and entry conditions less consistent.`);
  }

  if (Number.isFinite(lowestTide) && lowestTide < 0) {
    bad.push(`The day reaches an extremely low tide, which is tougher for shallow snorkeling spots.`);
  }

  if (tideData?.tideSummary && Number.isFinite(tideSwing) && tideSwing < 3.5) {
    good.push(`Tide is currently ${tideData.isRising ? "rising" : "falling"}, without an unusually large swing.`);
  } else if (tideData?.tideSummary) {
    bad.push(`Tide is currently ${tideData.isRising ? "rising" : "falling"}, and the larger swing can make conditions change faster.`);
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

  return {
    good: [...new Set(good)].slice(0, 4),
    bad: [...new Set(bad)].slice(0, 4)
  };
}

function buildTideChart(tideData) {
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
    return `<div class="tide-fallback">${tideData?.tideSummary || "Tide data unavailable"}</div>`;
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
    const left = clamp(x - width / 2, 6, TIDE_CHART_WIDTH - width - 6);
    const top =
      side === "top"
        ? clamp(y - height - gap, 6, TIDE_CHART_HEIGHT - height - 6)
        : clamp(y + gap, 6, TIDE_CHART_HEIGHT - height - 6);

    return {
      left,
      top,
      right: left + width,
      bottom: top + height
    };
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
      const pointClass = isHigh ? "tide-point-high" : "tide-point-low";
      const bubbleClass = isHigh ? "tide-label-box tide-label-box-high" : "tide-label-box tide-label-box-low";
      const valueClass = isHigh ? "tide-label-value tide-label-value-high" : "tide-label-value tide-label-value-low";
      const timeClass = isHigh ? "tide-label-time tide-label-time-high" : "tide-label-time tide-label-time-low";
      const box = buildBubbleBox(x, y, width, height, isHigh ? "top" : "bottom");

      return `
        <g class="tide-marker-group" tabindex="0" aria-label="${isHigh ? "High tide" : "Low tide"} ${valueText} at ${timeText}">
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" class="tide-hit-area"></circle>
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.4" class="tide-point ${pointClass}"></circle>
          <g class="tide-hover-bubble">
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
          <g class="tide-now-group">
            <circle cx="${nowMarker.x.toFixed(1)}" cy="${nowMarker.y.toFixed(1)}" r="5.2" class="tide-point tide-point-now"></circle>
            <rect x="${box.left.toFixed(1)}" y="${box.top.toFixed(1)}" width="${boxWidth}" height="${boxHeight}" rx="10" class="tide-now-badge"></rect>
            <text x="${(box.left + boxWidth / 2).toFixed(1)}" y="${(box.top + 13).toFixed(1)}" text-anchor="middle" class="tide-now-text">Now</text>
          </g>
        `;
      })()
    : "";

  const curvePath = samplePoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" L ");

  return `
    <div class="tide-chart-card">
      <div class="tide-chart-heading">
        <span><img src="${ICONS.tide}" alt="" class="chip-icon chip-icon-inline">Tide</span>
        <span>${tideData?.isRising ? "Rising" : "Falling"}</span>
      </div>
      <svg class="tide-chart" viewBox="0 0 ${TIDE_CHART_WIDTH} ${TIDE_CHART_HEIGHT}" preserveAspectRatio="none" aria-label="Daily tide chart">
        <path d="M ${curvePath}" class="tide-curve"></path>
        ${hoverMarkers}
        ${nowMarkup}
      </svg>
    </div>
  `;
}

function buildSpotCard(result) {
  const { region, score, bestTime, bestScore, metrics, tideData, conditionBreakdown, advisories } = result;
  const scoreColor = getScoreColor(score);
  const bestScoreColor = getScoreColor(bestScore);
  const protectedBadge = region.protected ? '<span class="protected-badge">Protected</span>' : "";
  const chips = buildConditionChips(metrics, tideData, bestTime, bestScore);
  const warningMarkup = buildBrownWaterWarningsMarkup(advisories, true);
  const goodList = (conditionBreakdown?.good?.length
    ? conditionBreakdown.good
    : ["A few signals are neutral right now, so this spot is not getting major help from the conditions."])
    .map((item) => `<li>${item}</li>`)
    .join("");
  const badList = (conditionBreakdown?.bad?.length
    ? conditionBreakdown.bad
    : ["There are no major red flags standing out for this sub-region at the moment."])
    .map((item) => `<li>${item}</li>`)
    .join("");

  return `
    <article class="spot-card" tabindex="0" role="button" aria-pressed="false" aria-label="Flip ${region.title} conditions card">
      <div class="spot-card-inner">
        <div class="spot-card-face spot-card-front">
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
          <div class="best-window-banner">
            <div class="best-window-banner-head">
              <span><img src="${ICONS.bestWindow}" alt="" class="chip-icon"></span>
              <strong>Next best time</strong>
            </div>
            <em>${
              bestTime === NO_BETTER_TIME_LABEL
                ? bestTime
                : `${bestTime} &middot; <span style="color:${bestScoreColor};">${bestScore}/10</span>`
            }</em>
          </div>
          ${warningMarkup}
          <div class="condition-chip-row">
            ${chips
              .map(
                (chip) => `
                  <div class="condition-chip">
                    <div class="condition-chip-head">
                      <span><img src="${chip.icon}" alt="" class="chip-icon"></span>
                      <strong>${chip.label}</strong>
                    </div>
                    <em>${chip.value}</em>
                  </div>
                `
              )
              .join("")}
          </div>
          ${buildTideChart(tideData)}
          <div class="spot-card-hint">Tap for what is helping and hurting conditions</div>
        </div>
        <div class="spot-card-face spot-card-back">
          <div class="spot-card-back-top">
            <div>
              <div class="spot-card-heading">
                <h3>${region.title}</h3>
                ${protectedBadge}
              </div>
              <div class="region-towns">${region.towns}</div>
            </div>
            <div class="spot-score-pill" style="color:${scoreColor}; border-color:${scoreColor};">${score}/10</div>
          </div>
          <div class="condition-breakdown">
            ${warningMarkup}
            <section class="condition-breakdown-panel condition-breakdown-good">
              <h4>What is making snorkeling conditions good</h4>
              <ul>${goodList}</ul>
            </section>
            <section class="condition-breakdown-panel condition-breakdown-bad">
              <h4>What is making snorkeling conditions bad</h4>
              <ul>${badList}</ul>
            </section>
          </div>
          <div class="spot-card-hint">Tap again to go back to the emoji and tide view</div>
        </div>
      </div>
    </article>
  `;
}

function buildShoreSection(shoreName, shoreResults) {
  const average =
    Math.round((shoreResults.reduce((sum, result) => sum + result.score, 0) / shoreResults.length) * 10) / 10;
  const color = getScoreColor(average);
  const bestNow = [...shoreResults].sort((a, b) => b.score - a.score)[0];
  const gridClass = shoreResults.length >= 3 ? "snorkel-group-grid grid-three" : "snorkel-group-grid grid-two";

  return `
    <details class="shore-section">
      <summary class="shore-summary">
        <div class="shore-summary-main">
          <div class="shore-summary-title">
            <p>${shoreName} Shore</p>
            <h3 style="color:${color};">${average}/10</h3>
            <span>${bestNow ? `Best now: ${bestNow.region.title}` : `${shoreResults.length} spots`}</span>
          </div>
          <div class="shore-arrow" aria-hidden="true"></div>
        </div>
      </summary>
      <div class="shore-details">
        <div class="${gridClass}">
          ${shoreResults.map((result) => buildSpotCard(result)).join("")}
        </div>
      </div>
    </details>
  `;
}

function buildFallbackResult(region) {
  return {
    region,
    score: 0,
    bestTime: "N/A",
    bestScore: 0,
    metrics: getSafeMetrics(null),
    tideData: { tideSummary: null, isRising: false, predictions: [], currentLevel: null },
    conditionBreakdown: { good: [], bad: [] },
    advisories: []
  };
}

async function loadRegionResult(region, advisories) {
  try {
    const [forecast, tideData] = await Promise.all([
      fetchForecast(region, { forecastHours: 24 }),
      fetchTide(region.stationId)
    ]);
    const safeMetrics = getSafeMetrics(forecast.current);
    const scoreResult = calculateRegionalScore(safeMetrics, region, { includeDetails: true });
    const best = findBestDisplayTime(forecast.hourly || [], region);

    return {
      region,
      score: scoreResult.score,
      bestTime: best.time,
      bestScore: best.score,
      metrics: safeMetrics,
      tideData,
      conditionBreakdown: buildConditionBreakdown(safeMetrics, region, tideData, scoreResult.details),
      advisories: getRegionAdvisories(advisories, region)
    };
  } catch (error) {
    console.error(`Error loading region ${region.title}:`, error);
    return buildFallbackResult(region);
  }
}

function renderIslandSummary(results) {
  const islandSummary = document.getElementById("island-summary");
  if (!islandSummary) return;

  const average =
    Math.round((results.reduce((sum, result) => sum + result.score, 0) / Math.max(results.length, 1)) * 10) / 10;
  const color = getScoreColor(average);

  islandSummary.innerHTML = `
    <div class="island-header island-header-minimal">
      <h3>Island-Wide</h3>
      <div class="snorkel-score" style="color:${color};">${average}/10</div>
    </div>
  `;
  islandSummary.style.display = "block";
}

function renderShoreSections(results) {
  const container = document.getElementById("snorkel-container");
  if (!container) return;

  const loadingEl = document.getElementById("loading");
  if (loadingEl) {
    loadingEl.remove();
  }

  const groupedResults = SHORE_ORDER.map((shore) => ({
    shore,
    results: results
      .filter((result) => result.region.shore === shore)
      .sort((left, right) => (REGION_ORDER_INDEX.get(left.region.title) ?? 0) - (REGION_ORDER_INDEX.get(right.region.title) ?? 0))
  })).filter((group) => group.results.length > 0);

  container.innerHTML = groupedResults.map((group) => buildShoreSection(group.shore, group.results)).join("");
  initializeSpotCardFlips(container);
}

function getCompletedShoreResults(resultMap) {
  return SHORE_ORDER.flatMap((shore) => {
    const shoreRegions = REGIONS.filter((region) => region.shore === shore);
    const isComplete = shoreRegions.every((region) => resultMap.has(region.title));
    if (!isComplete) {
      return [];
    }

    return shoreRegions
      .map((region) => resultMap.get(region.title))
      .filter(Boolean);
  });
}

function initializeSpotCardFlips(container) {
  const spotCards = container.querySelectorAll(".spot-card");

  const toggleCard = (card) => {
    const isFlipped = card.classList.toggle("is-flipped");
    card.setAttribute("aria-pressed", String(isFlipped));
  };

  spotCards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest(".tide-marker-group")) {
        return;
      }

      toggleCard(card);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleCard(card);
    });
  });
}

function renderError(error) {
  console.error("Error loading report:", error);
  const container = document.getElementById("snorkel-container");
  if (!container) return;
  container.innerHTML = '<p class="error-message" style="display:block;">Error loading snorkel report. Please try again later.</p>';
}

async function initializeReport() {
  const reportDateEl = document.getElementById("report-date");
  if (reportDateEl) {
    reportDateEl.textContent = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  try {
    const advisories = await fetchActiveAdvisories();
    const resultMap = new Map();

    await Promise.all(
      REGIONS.map(async (region) => {
        const result = await loadRegionResult(region, advisories);
        resultMap.set(region.title, result);

        const orderedResults = getCompletedShoreResults(resultMap);
        if (!orderedResults.length) {
          return;
        }

        renderIslandSummary(orderedResults);
        renderShoreSections(orderedResults);
      })
    );

    if (!resultMap.size) {
      throw new Error("No snorkel results were available.");
    }

    renderShoreSections(
      REGIONS.map((entry) => resultMap.get(entry.title)).filter(Boolean)
    );
  } catch (error) {
    renderError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeReport);
} else {
  initializeReport();
}
