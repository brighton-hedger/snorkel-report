// ==================== SHARED SNORKEL DATA + SCORING ====================
(function attachSnorkelShared(global) {
  const REGION_CONFIGS = [
    {
      title: "Lanikai/Kailua",
      towns: "(Lanikai Beach, Kailua Beach)",
      lat: 21.3931,
      lng: -157.7154,
      protected: true,
      shore: "East",
      stationId: "1612480",
      shelterDirections: ["N", "NE", "E"],
      preferredSwellDirections: ["S", "SW", "W"],
      coastFacing: "E",
      curvatureFactor: 0.8,
      currentExposure: 0.65
    },
    {
      title: "Waimanalo",
      towns: "(Waimanalo Beach, Makapuu)",
      lat: 21.3275,
      lng: -157.6635,
      protected: true,
      shore: "East",
      stationId: "1612480",
      shelterDirections: ["NE", "E"],
      preferredSwellDirections: ["S", "SW"],
      coastFacing: "ESE",
      curvatureFactor: 0.55,
      currentExposure: 0.75
    },
    {
      title: "Waikiki",
      towns: "(Kuhio Beach, Fort DeRussy)",
      lat: 21.2744,
      lng: -157.8269,
      protected: false,
      shore: "South",
      stationId: "1612340",
      shelterDirections: [],
      preferredSwellDirections: ["W", "NW"],
      coastFacing: "S",
      curvatureFactor: 0.35,
      currentExposure: 0.7
    },
    {
      title: "Ala Moana",
      towns: "(Ala Moana Bowls, Magic Island)",
      lat: 21.2857,
      lng: -157.8490,
      protected: true,
      shore: "South",
      stationId: "1612340",
      shelterDirections: ["S", "SW"],
      preferredSwellDirections: ["W", "NW"],
      coastFacing: "SSW",
      curvatureFactor: 0.75,
      currentExposure: 0.6
    },
    {
      title: "Hawaii Kai",
      towns: "(Hanauma Bay, Sandy Beach)",
      lat: 21.2767,
      lng: -157.6930,
      protected: true,
      shore: "South",
      stationId: "1612340",
      shelterDirections: ["E", "SE"],
      preferredSwellDirections: ["S", "SW"],
      coastFacing: "SE",
      curvatureFactor: 0.85,
      currentExposure: 0.55
    },
    {
      title: "Haleiwa",
      towns: "(Haleiwa Beach Park, Alii Beach)",
      lat: 21.6028,
      lng: -158.1053,
      protected: false,
      shore: "North",
      stationId: "1612401",
      shelterDirections: [],
      preferredSwellDirections: ["W", "NW"],
      coastFacing: "N",
      curvatureFactor: 0.25,
      currentExposure: 0.95
    },
    {
      title: "Waimea Bay",
      towns: "(Waimea Beach, Backyards)",
      lat: 21.6414,
      lng: -158.0635,
      protected: false,
      shore: "North",
      stationId: "1612401",
      shelterDirections: [],
      preferredSwellDirections: ["W", "NW"],
      coastFacing: "NNW",
      curvatureFactor: 0.2,
      currentExposure: 1
    },
    {
      title: "Pupukea",
      towns: "(Shark's Cove, Three Tables)",
      lat: 21.6549,
      lng: -158.0512,
      protected: false,
      shore: "North",
      stationId: "1612401",
      shelterDirections: [],
      preferredSwellDirections: ["W", "NW"],
      coastFacing: "N",
      curvatureFactor: 0.4,
      currentExposure: 0.9
    },
    {
      title: "Ko Olina",
      towns: "(Ko Olina Lagoons, Paradise Cove)",
      lat: 21.3387,
      lng: -158.1254,
      protected: true,
      shore: "West",
      stationId: "1612401",
      shelterDirections: ["S", "SW", "W"],
      preferredSwellDirections: ["W", "NW"],
      coastFacing: "W",
      curvatureFactor: 0.95,
      currentExposure: 0.4
    },
    {
      title: "Pokai Bay",
      towns: "(Pokai Bay Beach, Ewa Beach)",
      lat: 21.4437,
      lng: -158.1899,
      protected: true,
      shore: "West",
      stationId: "1612401",
      shelterDirections: ["S", "SW", "W"],
      preferredSwellDirections: ["W", "NW"],
      coastFacing: "W",
      curvatureFactor: 0.9,
      currentExposure: 0.35
    },
    {
      title: "Nanakuli",
      towns: "(Nanakuli Beach, Makaha)",
      lat: 21.3814,
      lng: -158.1469,
      protected: true,
      shore: "West",
      stationId: "1612401",
      shelterDirections: ["SW", "W"],
      preferredSwellDirections: ["W"],
      coastFacing: "WSW",
      curvatureFactor: 0.65,
      currentExposure: 0.55
    },
    {
      title: "Kaneohe Bay",
      towns: "(Kahaluu, Heeia, Coconut Island)",
      lat: 21.4360,
      lng: -157.7900,
      protected: true,
      shore: "East",
      stationId: "1612480",
      shelterDirections: ["E", "SE", "S"],
      preferredSwellDirections: ["S", "SW"],
      coastFacing: "NE",
      curvatureFactor: 0.95,
      currentExposure: 0.35
    }
  ];

  const DAYLIGHT_START_HOUR = 6;
  const DAYLIGHT_END_HOUR = 18;
  const DIRECTION_DEGREES = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeAngle(deg) {
    return ((deg % 360) + 360) % 360;
  }

  function angleDistance(a, b) {
    const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
    return diff > 180 ? 360 - diff : diff;
  }

  function directionToDegrees(direction) {
    return DIRECTION_DEGREES[direction] ?? 0;
  }

  function toCardinal(deg) {
    if (!Number.isFinite(deg)) return "N/A";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(normalizeAngle(deg) / 45) % 8];
  }

  function getScoreColor(score) {
    if (score >= 7.5) return "#1eaa5a";
    if (score >= 4.5) return "#e6a800";
    return "#cc3300";
  }

  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getCurrentHourIndex(times) {
    const now = new Date();
    const nextIndex = times.findIndex((time) => new Date(time) > now);
    if (nextIndex === -1) {
      return Math.max(times.length - 1, 0);
    }

    return Math.max(nextIndex - 1, 0);
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildForecastUrls(region, options = {}) {
    const { forecastHours, forecastDays } = options;
    const rangeParam = forecastDays
      ? `forecast_days=${forecastDays}`
      : `forecast_hours=${forecastHours || 24}`;

    const marineUrl =
      `https://marine-api.open-meteo.com/v1/marine?latitude=${region.lat}&longitude=${region.lng}` +
      `&hourly=wave_height,swell_wave_height,swell_wave_period,wind_wave_height,wind_wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,sea_level_height_msl` +
      `&${rangeParam}&timezone=auto&length_unit=imperial&wind_speed_unit=mph&temperature_unit=fahrenheit`;

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lng}` +
      `&hourly=wind_speed_10m,wind_direction_10m,cloud_cover,precipitation` +
      `&${rangeParam}&timezone=auto&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch`;

    return { marineUrl, weatherUrl };
  }

  async function fetchForecast(region, options = {}) {
    const { marineUrl, weatherUrl } = buildForecastUrls(region, options);
    const [marineData, weatherData] = await Promise.all([fetchJson(marineUrl), fetchJson(weatherUrl)]);
    const times = marineData?.hourly?.time || [];
    const currentHourIndex = getCurrentHourIndex(times);

    const hourly = times.map((time, index) => ({
      time,
      dateKey: getDateKey(new Date(time)),
      hour: new Date(time).getHours(),
      waveHeight: marineData.hourly.wave_height?.[index] ?? 0,
      swellHeight: marineData.hourly.swell_wave_height?.[index] ?? 0,
      swellPeriod: marineData.hourly.swell_wave_period?.[index] ?? 0,
      windWaveHeight: marineData.hourly.wind_wave_height?.[index] ?? 0,
      windWavePeriod: marineData.hourly.wind_wave_period?.[index] ?? 0,
      temp: marineData.hourly.sea_surface_temperature?.[index] ?? null,
      currentSpeed: marineData.hourly.ocean_current_velocity?.[index] ?? 0,
      currentDir: marineData.hourly.ocean_current_direction?.[index] ?? 0,
      tide: marineData.hourly.sea_level_height_msl?.[index] ?? 0,
      windSpeed: weatherData.hourly.wind_speed_10m?.[index] ?? 0,
      windDir: weatherData.hourly.wind_direction_10m?.[index] ?? 0,
      clouds: weatherData.hourly.cloud_cover?.[index] ?? 0,
      rain: weatherData.hourly.precipitation?.[index] ?? 0
    }));

    return {
      hourly,
      current: hourly[currentHourIndex] || hourly[hourly.length - 1] || null
    };
  }

  async function fetchTide(stationId) {
    const hiloUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station=${stationId}&product=predictions&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&format=json`;
    const curveUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=today&station=${stationId}&product=predictions&datum=MLLW&interval=6&units=english&time_zone=lst_ldt&format=json`;

    try {
      const [hiloData, curveData] = await Promise.all([fetchJson(hiloUrl), fetchJson(curveUrl)]);
      const predictions = Array.isArray(hiloData.predictions) ? hiloData.predictions : [];
      const curvePredictions = Array.isArray(curveData.predictions) ? curveData.predictions : [];
      const now = new Date();
      const future = predictions.filter((point) => new Date(point.t) > now);
      const past = predictions.filter((point) => new Date(point.t) <= now);
      const current = past[past.length - 1];
      const next = future[0];
      const normalizedPredictions = predictions
        .map((point) => ({
          time: point.t,
          value: parseFloat(point.v),
          type: point.type || null
        }))
        .filter((point) => Number.isFinite(point.value));
      const normalizedCurvePredictions = curvePredictions
        .map((point) => ({
          time: point.t,
          value: parseFloat(point.v),
          type: null
        }))
        .filter((point) => Number.isFinite(point.value));

      if (!current || !next) {
        return {
          tideSummary: null,
          isRising: false,
          predictions: normalizedPredictions,
          curvePredictions: normalizedCurvePredictions,
          currentLevel: null
        };
      }

      const currentValue = parseFloat(current.v);
      const nextValue = parseFloat(next.v);
      if (!Number.isFinite(currentValue) || !Number.isFinite(nextValue)) {
        return {
          tideSummary: null,
          isRising: false,
          predictions: normalizedPredictions,
          curvePredictions: normalizedCurvePredictions,
          currentLevel: null
        };
      }

      const isRising = nextValue > currentValue;
      const direction = next.type === "H" ? "up" : "down";
      return {
        tideSummary: `${currentValue.toFixed(1)} ft now, ${direction} to ${nextValue.toFixed(1)} ft @ ${new Date(next.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        isRising,
        predictions: normalizedPredictions,
        curvePredictions: normalizedCurvePredictions,
        currentLevel: currentValue
      };
    } catch (error) {
      console.error("Tide error:", error);
      return { tideSummary: null, isRising: false, predictions: [], curvePredictions: [], currentLevel: null };
    }
  }

  async function fetchActiveAdvisories(type = "brown_water") {
    try {
      const data = await fetchJson(`/api/advisories?type=${encodeURIComponent(type)}`);
      return Array.isArray(data?.items) ? data.items : [];
    } catch (error) {
      console.error("Advisory error:", error);
      return [];
    }
  }

  function getRegionAdvisories(advisories, region) {
    if (!Array.isArray(advisories) || !region) {
      return [];
    }

    return advisories.filter((advisory) => {
      if (advisory.region_title && advisory.region_title === region.title) {
        return true;
      }

      return !advisory.region_title && advisory.shore && advisory.shore === region.shore;
    });
  }

  function scoreDirectionalShelter(flowDegrees, shelteredDirections, curvatureFactor) {
    if (!shelteredDirections?.length) return 0;
    const shelterAngles = shelteredDirections.map(directionToDegrees);
    const bestDistance = Math.min(...shelterAngles.map((angle) => angleDistance(flowDegrees, angle)));
    const shelterStrength = 1 - clamp(bestDistance / 90, 0, 1);
    return shelterStrength * (0.4 + curvatureFactor * 0.8);
  }

  function scorePreferredSwell(flowDegrees, preferredDirections) {
    if (!preferredDirections?.length) return 0;
    const swellAngles = preferredDirections.map(directionToDegrees);
    const bestDistance = Math.min(...swellAngles.map((angle) => angleDistance(flowDegrees, angle)));
    return 1 - clamp(bestDistance / 120, 0, 1);
  }

  function calculateRegionalScore(metrics, region, options = {}) {
    const { includeDetails = false } = options;
    const details = [];
    let score = 8.2;
    let bonusBudget = 0;
    const coastFacingDegrees = directionToDegrees(region.coastFacing || "N");
    const windDirDegrees = normalizeAngle(metrics.windDir ?? 0);
    const currentDirDegrees = normalizeAngle(metrics.currentDir ?? 0);

    if (metrics.waveHeight > 6) {
      score -= 2.5;
      details.push("Very large waves");
    } else if (metrics.waveHeight > 4) {
      score -= 1.6;
      details.push("Moderate waves");
    } else if (metrics.waveHeight > 2.5) {
      score -= 0.7;
      details.push("Some surf energy");
    } else if (metrics.waveHeight < 1.5) {
      score += 0.2;
      bonusBudget += 0.2;
    }

    if (metrics.swellHeight > 4) {
      score -= 2.3;
      details.push("Large swell");
    } else if (metrics.swellHeight > 2.5) {
      score -= 1.3;
      details.push("Moderate swell");
    } else if (metrics.swellHeight > 1.75) {
      score -= 0.5;
    }

    if (metrics.swellPeriod < 6) {
      score -= 1.2;
      details.push("Short swell period (choppy)");
    } else if (metrics.swellPeriod > 10) {
      score += 0.15;
      bonusBudget += 0.15;
      details.push("Long-period swell");
    }

    if (metrics.windWaveHeight > 3) {
      score -= 2.2;
      details.push("Strong wind chop");
    } else if (metrics.windWaveHeight > 1.5) {
      score -= 1.4;
      details.push("Some wind chop");
    } else if (metrics.windWaveHeight > 0.8) {
      score -= 0.6;
    }

    const windOnshoreDistance = angleDistance(windDirDegrees, coastFacingDegrees);
    const windShelter = scoreDirectionalShelter(windDirDegrees, region.shelterDirections, region.curvatureFactor ?? 0.5);
    if (metrics.windSpeed > 5) {
      if (windOnshoreDistance <= 60) {
        const penalty = (1 - windShelter) * (metrics.windSpeed > 15 ? 1.9 : 1.35);
        score -= penalty;
        details.push(windShelter > 0.45 ? "Partially sheltered from onshore wind" : "Onshore winds");
      } else if (windOnshoreDistance >= 120) {
        const bonus = 0.1 + ((region.curvatureFactor ?? 0.5) * 0.15);
        score += bonus;
        bonusBudget += bonus;
        details.push("Offshore or side-offshore winds");
      } else {
        const crossPenalty = Math.max(0.25, 0.8 - windShelter * 0.4);
        score -= crossPenalty;
        details.push("Cross-shore breeze");
      }
    }

    if (metrics.windSpeed > 20) {
      score -= 1.3;
      details.push("Very windy");
    } else if (metrics.windSpeed > 12) {
      score -= 0.8;
      details.push("Breezy");
    } else if (metrics.windSpeed > 8) {
      score -= 0.35;
    }

    const currentOnshoreDistance = angleDistance(currentDirDegrees, coastFacingDegrees);
    const currentShelter = scoreDirectionalShelter(currentDirDegrees, region.shelterDirections, region.curvatureFactor ?? 0.5);
    const currentExposure = region.currentExposure ?? 0.75;
    if (metrics.currentSpeed > 2.0) {
      score -= 1.7 * currentExposure * (1.15 - currentShelter * 0.25);
      details.push("Strong currents");
    } else if (metrics.currentSpeed > 1.2) {
      score -= 1.0 * currentExposure * (1.1 - currentShelter * 0.2);
      details.push("Moderate currents");
    } else if (metrics.currentSpeed > 0.7) {
      score -= 0.45 * currentExposure;
      details.push("Noticeable current");
    } else if (metrics.currentSpeed < 0.5) {
      score += 0.15;
      bonusBudget += 0.15;
    }

    if (metrics.currentSpeed > 0.8) {
      if (currentOnshoreDistance <= 60 && currentShelter < 0.45) {
        score -= 0.8;
        details.push("Current pushing into shore");
      } else if (currentOnshoreDistance >= 120 || currentShelter > 0.55) {
        score += 0.05;
        bonusBudget += 0.05;
        details.push("Current direction is manageable");
      }
    }

    if (metrics.tide < 0) {
      score -= 1;
      details.push("Low tide (less depth)");
    } else if (metrics.tide > 2) {
      score += 0.15;
      bonusBudget += 0.15;
    }

    if (metrics.clouds > 80) {
      score -= 1.2;
      details.push("Heavy cloud cover");
    } else if (metrics.clouds > 60) {
      score -= 0.7;
      details.push("Partly cloudy");
    } else if (metrics.clouds < 30) {
      score += 0.1;
      bonusBudget += 0.1;
    }

    if (metrics.rain > 0.1) {
      score -= 1.2;
      details.push("Rain expected");
    } else if (metrics.rain > 0.02) {
      score -= 0.7;
      details.push("Light rain possible");
    }

    const swellFit = scorePreferredSwell(directionToDegrees(region.coastFacing || "N"), region.preferredSwellDirections);
    if (swellFit > 0.65 && metrics.swellHeight <= 3.5) {
      score += 0.15;
      bonusBudget += 0.15;
      details.push("Swell direction suits this shoreline");
    }

    if (region.protected) {
      const protectionBonus = 0.15 + (region.curvatureFactor ?? 0.5) * 0.15;
      score += protectionBonus;
      bonusBudget += protectionBonus;
      details.push("Protected cove");
    }

    const maxBonus = 0.9;
    if (bonusBudget > maxBonus) {
      score -= bonusBudget - maxBonus;
    }

    if (
      metrics.waveHeight > 2.5 ||
      metrics.swellHeight > 2.5 ||
      metrics.windSpeed > 10 ||
      metrics.windWaveHeight > 1.25 ||
      metrics.currentSpeed > 0.8 ||
      metrics.clouds > 50 ||
      metrics.rain > 0.02
    ) {
      score = Math.min(score, 8.9);
    }

    if (
      metrics.waveHeight > 1.75 ||
      metrics.swellHeight > 2 ||
      metrics.windSpeed > 7 ||
      metrics.currentSpeed > 0.6 ||
      metrics.clouds > 35
    ) {
      score = Math.min(score, 9.4);
    }

    const roundedScore = Math.max(1, Math.min(Math.round(score * 10) / 10, 10));
    return includeDetails ? { score: roundedScore, details } : roundedScore;
  }

  function findBestSnorkelTime(hourlyData, region) {
    const now = new Date();
    const nowTime = now.getTime();
    const pastEntries = hourlyData.filter((entry) => new Date(entry.time).getTime() <= nowTime);
    const currentEntry = pastEntries[pastEntries.length - 1] || hourlyData[0] || null;
    const currentScore = currentEntry ? calculateRegionalScore(currentEntry, region) : 0;
    const activeDateKey = currentEntry?.dateKey || null;
    let best = { score: -1, time: null };

    hourlyData.forEach((entry) => {
      const time = new Date(entry.time);
      const hour = time.getHours();
      if (
        time > now &&
        hour >= DAYLIGHT_START_HOUR &&
        hour < DAYLIGHT_END_HOUR &&
        (!activeDateKey || entry.dateKey === activeDateKey)
      ) {
        const score = calculateRegionalScore(entry, region);
        if (score > best.score) {
          best = { score, time };
        }
      }
    });

    if (best.time && best.score > currentScore) {
      return {
        time: best.time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        score: best.score
      };
    }

    return {
      time: "Best right now",
      score: currentScore
    };
  }

  function getDaylightScoreSeries(hourlyData, region, dateKey) {
    return hourlyData
      .filter((entry) => entry.dateKey === dateKey && entry.hour >= DAYLIGHT_START_HOUR && entry.hour <= DAYLIGHT_END_HOUR)
      .map((entry) => ({
        time: entry.time,
        dateKey: entry.dateKey,
        hour: entry.hour,
        score: calculateRegionalScore(entry, region)
      }));
  }

  function getDaylightAverageScore(hourlyData, region, dateKey) {
    const scores = getDaylightScoreSeries(hourlyData, region, dateKey).map((entry) => entry.score);
    return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
  }

  function getRegionByTitle(title) {
    return REGION_CONFIGS.find((region) => region.title === title) || null;
  }

  global.SnorkelShared = {
    REGIONS: REGION_CONFIGS,
    DAYLIGHT_START_HOUR,
    DAYLIGHT_END_HOUR,
    clamp,
    toCardinal,
    getScoreColor,
    getDateKey,
    fetchJson,
    fetchForecast,
    fetchTide,
    fetchActiveAdvisories,
    calculateRegionalScore,
    findBestSnorkelTime,
    getDaylightScoreSeries,
    getDaylightAverageScore,
    getRegionByTitle,
    getRegionAdvisories,
    escapeHtml
  };
})(window);
