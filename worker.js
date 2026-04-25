function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
}

function validateFeedback(body) {
  if (!body || typeof body !== "object") {
    return "Invalid request body.";
  }

  if (!body.regionTitle || typeof body.regionTitle !== "string") {
    return "Region is required.";
  }

  if (!body.observedAt || Number.isNaN(Date.parse(body.observedAt))) {
    return "Observed time is required.";
  }

  const observedScore = Number(body.observedScore);
  if (!Number.isFinite(observedScore) || observedScore < 1 || observedScore > 10) {
    return "Observed score must be between 1 and 10.";
  }

  if (!body.snapshot || typeof body.snapshot !== "object") {
    return "Live snapshot is required.";
  }

  if (body.snapshot.regionTitle !== body.regionTitle) {
    return "Snapshot region must match the selected region.";
  }

  return null;
}

async function handleFeedbackSubmit(request, env) {
  if (!env.FEEDBACK_DB) {
    return json(
      {
        error: "Feedback storage is not configured yet. Add a Cloudflare D1 binding named FEEDBACK_DB first."
      },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request must be valid JSON." }, { status: 400 });
  }

  const validationError = validateFeedback(body);
  if (validationError) {
    return json({ error: validationError }, { status: 400 });
  }

  const visibilityFt =
    body.visibilityFt === null || body.visibilityFt === undefined || body.visibilityFt === ""
      ? null
      : Number(body.visibilityFt);
  const notes = String(body.notes || "").trim().slice(0, 2000);
  const now = new Date().toISOString();

  await env.FEEDBACK_DB.prepare(
    `INSERT INTO feedback_submissions (
      region_title,
      shore,
      towns,
      station_id,
      observed_at,
      submitted_at,
      observed_score,
      algorithm_score,
      visibility_ft,
      captured_at,
      model_time,
      model_date_key,
      model_hour,
      wave_height,
      swell_height,
      swell_period,
      wind_wave_height,
      wind_wave_period,
      sea_temp,
      current_speed,
      current_dir,
      tide_height,
      wind_speed,
      wind_dir,
      cloud_cover,
      rain_inches,
      tide_summary,
      tide_is_rising,
      tide_current_level,
      algorithm_details_json,
      notes,
      snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.regionTitle,
      body.snapshot.shore || null,
      body.snapshot.towns || null,
      body.snapshot.stationId || null,
      body.observedAt,
      now,
      Number(body.observedScore),
      Number(body.snapshot.algorithmScore),
      Number.isFinite(visibilityFt) ? visibilityFt : null,
      body.snapshot.capturedAt || null,
      body.snapshot.metrics?.time || null,
      body.snapshot.metrics?.dateKey || null,
      Number.isFinite(Number(body.snapshot.metrics?.hour)) ? Number(body.snapshot.metrics.hour) : null,
      Number.isFinite(Number(body.snapshot.metrics?.waveHeight)) ? Number(body.snapshot.metrics.waveHeight) : null,
      Number.isFinite(Number(body.snapshot.metrics?.swellHeight)) ? Number(body.snapshot.metrics.swellHeight) : null,
      Number.isFinite(Number(body.snapshot.metrics?.swellPeriod)) ? Number(body.snapshot.metrics.swellPeriod) : null,
      Number.isFinite(Number(body.snapshot.metrics?.windWaveHeight)) ? Number(body.snapshot.metrics.windWaveHeight) : null,
      Number.isFinite(Number(body.snapshot.metrics?.windWavePeriod)) ? Number(body.snapshot.metrics.windWavePeriod) : null,
      Number.isFinite(Number(body.snapshot.metrics?.temp)) ? Number(body.snapshot.metrics.temp) : null,
      Number.isFinite(Number(body.snapshot.metrics?.currentSpeed)) ? Number(body.snapshot.metrics.currentSpeed) : null,
      Number.isFinite(Number(body.snapshot.metrics?.currentDir)) ? Number(body.snapshot.metrics.currentDir) : null,
      Number.isFinite(Number(body.snapshot.metrics?.tide)) ? Number(body.snapshot.metrics.tide) : null,
      Number.isFinite(Number(body.snapshot.metrics?.windSpeed)) ? Number(body.snapshot.metrics.windSpeed) : null,
      Number.isFinite(Number(body.snapshot.metrics?.windDir)) ? Number(body.snapshot.metrics.windDir) : null,
      Number.isFinite(Number(body.snapshot.metrics?.clouds)) ? Number(body.snapshot.metrics.clouds) : null,
      Number.isFinite(Number(body.snapshot.metrics?.rain)) ? Number(body.snapshot.metrics.rain) : null,
      body.snapshot.tide?.tideSummary || null,
      body.snapshot.tide?.isRising ? 1 : 0,
      Number.isFinite(Number(body.snapshot.tide?.currentLevel)) ? Number(body.snapshot.tide.currentLevel) : null,
      JSON.stringify(Array.isArray(body.snapshot.algorithmDetails) ? body.snapshot.algorithmDetails : []),
      notes || null,
      JSON.stringify(body.snapshot)
    )
    .run();

  return json({ ok: true, submittedAt: now }, { status: 201 });
}

async function handleFeedbackRecent(env) {
  if (!env.FEEDBACK_DB) {
    return json({ items: [], configured: false });
  }

  const result = await env.FEEDBACK_DB.prepare(
    `SELECT id, region_title, observed_at, submitted_at, observed_score, algorithm_score, visibility_ft, notes
     FROM feedback_submissions
     ORDER BY submitted_at DESC
     LIMIT 25`
  ).all();

  return json({ items: result.results || [], configured: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/feedback" && request.method === "POST") {
      return handleFeedbackSubmit(request, env);
    }

    if (url.pathname === "/api/feedback" && request.method === "GET") {
      return handleFeedbackRecent(env);
    }

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: "GET, POST, OPTIONS"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
