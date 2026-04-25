const {
  REGIONS,
  fetchForecast,
  fetchTide,
  calculateRegionalScore,
  getScoreColor,
  toCardinal
} = window.SnorkelShared;

let currentSnapshot = null;

function formatNowForInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function createMetric(label, value) {
  return `
    <div class="feedback-metric">
      <strong>${label}</strong>
      <span>${value}</span>
    </div>
  `;
}

function renderSnapshot(snapshot) {
  const container = document.getElementById("feedback-snapshot");
  if (!container) return;

  if (!snapshot) {
    container.className = "feedback-snapshot-empty";
    container.textContent = "Choose a sub-region to load the current forecast snapshot.";
    return;
  }

  const scoreColor = getScoreColor(snapshot.algorithmScore);
  container.className = "feedback-snapshot";
  container.innerHTML = `
    <div class="feedback-snapshot-summary">
      <div>
        <h3>${snapshot.regionTitle}</h3>
        <p>${snapshot.towns}</p>
      </div>
      <div class="feedback-snapshot-score" style="color:${scoreColor}; border-color:${scoreColor};">
        ${snapshot.algorithmScore}/10
      </div>
    </div>
    <div class="feedback-metrics-grid">
      ${createMetric("Sea", Number.isFinite(snapshot.metrics.temp) ? `${snapshot.metrics.temp.toFixed(1)}°F` : "--")}
      ${createMetric("Wind", `${Number.isFinite(snapshot.metrics.windSpeed) ? snapshot.metrics.windSpeed.toFixed(1) : "--"} mph ${toCardinal(snapshot.metrics.windDir)}`)}
      ${createMetric("Waves", `${Number.isFinite(snapshot.metrics.waveHeight) ? snapshot.metrics.waveHeight.toFixed(1) : "--"} ft`)}
      ${createMetric("Current", `${Number.isFinite(snapshot.metrics.currentSpeed) ? snapshot.metrics.currentSpeed.toFixed(1) : "--"} mph ${toCardinal(snapshot.metrics.currentDir)}`)}
      ${createMetric("Weather", `${Math.round(snapshot.metrics.clouds ?? 0)}% cloud · ${Number.isFinite(snapshot.metrics.rain) ? snapshot.metrics.rain.toFixed(2) : "0.00"} in rain`)}
      ${createMetric("Tide", snapshot.tide?.tideSummary || "Unavailable")}
    </div>
    <div class="feedback-detail-list">
      <strong>Model details</strong>
      <ul>
        ${snapshot.algorithmDetails.length
          ? snapshot.algorithmDetails.map((detail) => `<li>${detail}</li>`).join("")
          : "<li>No model detail flags captured.</li>"}
      </ul>
    </div>
  `;
}

async function loadSnapshotForRegion(regionTitle) {
  const region = REGIONS.find((entry) => entry.title === regionTitle);
  if (!region) {
    currentSnapshot = null;
    renderSnapshot(null);
    return;
  }

  const status = document.getElementById("feedback-status");
  if (status) {
    status.textContent = "Loading live snapshot...";
    status.className = "feedback-status";
  }

  try {
    const [forecast, tide] = await Promise.all([
      fetchForecast(region, { forecastHours: 24 }),
      fetchTide(region.stationId)
    ]);
    const scoreResult = calculateRegionalScore(forecast.current, region, { includeDetails: true });

    currentSnapshot = {
      regionTitle: region.title,
      shore: region.shore,
      towns: region.towns,
      stationId: region.stationId,
      capturedAt: new Date().toISOString(),
      algorithmScore: scoreResult.score,
      algorithmDetails: scoreResult.details,
      metrics: forecast.current,
      tide
    };

    renderSnapshot(currentSnapshot);

    if (status) {
      status.textContent = "Live snapshot loaded.";
      status.className = "feedback-status feedback-status-success";
    }
  } catch (error) {
    console.error("Feedback snapshot error:", error);
    currentSnapshot = null;
    renderSnapshot(null);
    if (status) {
      status.textContent = "Could not load the live snapshot for that spot.";
      status.className = "feedback-status feedback-status-error";
    }
  }
}

function buildPayload(formData) {
  return {
    regionTitle: formData.get("region"),
    observedAt: formData.get("observedAt"),
    observedScore: Number(formData.get("observedScore")),
    visibilityFt: formData.get("visibilityFt") ? Number(formData.get("visibilityFt")) : null,
    notes: String(formData.get("notes") || "").trim(),
    snapshot: currentSnapshot
  };
}

async function submitFeedback(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = document.getElementById("feedback-submit");
  const status = document.getElementById("feedback-status");
  const formData = new FormData(form);

  if (!currentSnapshot || currentSnapshot.regionTitle !== formData.get("region")) {
    if (status) {
      status.textContent = "Please load the live snapshot for the selected spot before submitting.";
      status.className = "feedback-status feedback-status-error";
    }
    return;
  }

  submitButton.disabled = true;
  if (status) {
    status.textContent = "Submitting feedback...";
    status.className = "feedback-status";
  }

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildPayload(formData))
    });
    const rawText = await response.text();
    let result = {};

    if (rawText) {
      try {
        result = JSON.parse(rawText);
      } catch {
        result = {};
      }
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Feedback API not found. The Cloudflare Worker route is not active yet.");
      }

      throw new Error(result.error || `Submission failed (${response.status}).`);
    }

    form.reset();
    document.getElementById("feedback-observed-at").value = formatNowForInput();
    currentSnapshot = null;
    renderSnapshot(null);

    if (status) {
      status.textContent = "Feedback saved. Your field score is stored with the live model snapshot.";
      status.className = "feedback-status feedback-status-success";
    }
  } catch (error) {
    console.error("Feedback submit error:", error);
    if (status) {
      status.textContent = error.message || "Could not submit feedback.";
      status.className = "feedback-status feedback-status-error";
    }
  } finally {
    submitButton.disabled = false;
  }
}

function initializeFeedbackPage() {
  const regionSelect = document.getElementById("feedback-region");
  const observedAtInput = document.getElementById("feedback-observed-at");
  const refreshButton = document.getElementById("feedback-refresh");
  const form = document.getElementById("feedback-form");

  if (!regionSelect || !observedAtInput || !refreshButton || !form) {
    return;
  }

  observedAtInput.value = formatNowForInput();

  regionSelect.innerHTML = `
    <option value="">Choose a spot</option>
    ${REGIONS.map((region) => `<option value="${region.title}">${region.shore} Shore · ${region.title}</option>`).join("")}
  `;

  regionSelect.addEventListener("change", () => {
    loadSnapshotForRegion(regionSelect.value);
  });

  refreshButton.addEventListener("click", () => {
    loadSnapshotForRegion(regionSelect.value);
  });

  form.addEventListener("submit", submitFeedback);

  fetch("/api/feedback")
    .then(async (response) => {
      const rawText = await response.text();
      if (!rawText) {
        throw new Error("Empty response");
      }

      return JSON.parse(rawText);
    })
    .then((result) => {
      const status = document.getElementById("feedback-status");
      if (!status) {
        return;
      }

      if (result.configured === false) {
        status.textContent = "Feedback form is live, but Cloudflare D1 storage still needs to be configured.";
        status.className = "feedback-status feedback-status-error";
      }
    })
    .catch(() => {
      const status = document.getElementById("feedback-status");
      if (!status) {
        return;
      }

      status.textContent = "Feedback API is not active on this environment yet. The form UI works, but submissions need the Cloudflare Worker route.";
      status.className = "feedback-status feedback-status-error";
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeFeedbackPage);
} else {
  initializeFeedbackPage();
}
