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
      notes,
      snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
