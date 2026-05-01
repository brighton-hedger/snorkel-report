function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
}

const DOH_BROWN_WATER_SOURCE = "Hawaii DOH Clean Water Branch";
const ENV_WASTEWATER_SOURCE = "Honolulu ENV Wastewater Notices";
const DOH_CWB_EVENTS_URL = "https://eha-cloud.doh.hawaii.gov/cwb/api/events?page=1&count=200&format=json";
const ENV_WASTEWATER_POSTS_URL =
  "https://www.honolulu.gov/env/wp-json/wp/v2/posts?search=wastewater%20spill&per_page=10";
const SHORE_NAMES = ["North", "East", "South", "West"];
const MANUAL_IMPORT_TOKEN_HEADER = "x-import-token";
const IMPORT_WINDOW_HOURS = 72;
const IMPORT_REGION_CONFIGS = [
  {
    title: "Lanikai/Kailua",
    shore: "East",
    keywords: ["lanikai", "kailua beach", "kailua regional wastewater treatment plant", "kailua"]
  },
  {
    title: "Waimanalo",
    shore: "East",
    keywords: ["waimanalo", "makapuu", "makapuu beach", "makapu'u"]
  },
  {
    title: "Waikiki",
    shore: "South",
    keywords: ["waikiki", "kuhio beach", "fort de russy", "fort derussy", "ala wai canal", "ala wai"]
  },
  {
    title: "Ala Moana",
    shore: "South",
    keywords: ["ala moana", "magic island", "ala moana bowls", "kewalo"]
  },
  {
    title: "Hawaii Kai",
    shore: "South",
    keywords: ["hawaii kai", "hanauma", "sandy beach", "sandy's", "sandy beach park"]
  },
  {
    title: "Haleiwa",
    shore: "North",
    keywords: ["haleiwa", "alii beach", "haleiwa beach park", "mokuleia", "kahuku"]
  },
  {
    title: "Waimea Bay",
    shore: "North",
    keywords: ["waimea bay", "waimea beach", "backyards"]
  },
  {
    title: "Pupukea",
    shore: "North",
    keywords: ["pupukea", "shark's cove", "sharks cove", "three tables", "sunset beach"]
  },
  {
    title: "Ko Olina",
    shore: "West",
    keywords: ["ko olina", "paradise cove", "koolina", "lagoons"]
  },
  {
    title: "Pokai Bay",
    shore: "West",
    keywords: ["pokai bay", "waianae", "maili"]
  },
  {
    title: "Nanakuli",
    shore: "West",
    keywords: ["nanakuli", "makaha", "makua", "maili beach park", "makaha beach park", "kaena point", "ka'ena point"]
  },
  {
    title: "Kaneohe Bay",
    shore: "East",
    keywords: ["kaneohe bay", "kaneohe", "kahaluu", "heeia", "coconut island", "ahuimanu"]
  }
];
const SHORE_KEYWORDS = [
  {
    shore: "East",
    keywords: ["east shore", "windward oahu", "windward o'ahu", "windward"]
  },
  {
    shore: "South",
    keywords: ["south shore", "south facing shore", "south-facing shore"]
  },
  {
    shore: "North",
    keywords: ["north shore", "north facing shore", "north-facing shore"]
  },
  {
    shore: "West",
    keywords: ["west shore", "leeward oahu", "leeward o'ahu", "west facing shore", "west-facing shore"]
  }
];

const ROUTE_FILE_MAP = {
  "/": "/index.html",
  "/about": "/about.html",
  "/blog": "/blog.html",
  "/blog/read-the-score": "/blog-read-score.html",
  "/blog/tide-matters": "/blog-tide.html",
  "/blog/wind-swell-visibility": "/blog-wind-swell-visibility.html",
  "/day-forecast": "/day-forecast.html",
  "/detailed-reports": "/detailed-reports.html",
  "/feedback": "/feedback.html",
  "/haleiwa": "/haleiwa.html",
  "/hawaii-kai": "/hawaii-kai.html",
  "/kaneohe-bay": "/kaneohe-bay.html",
  "/ko-olina": "/ko-olina.html",
  "/lanikai-kailua": "/lanikai-kailua.html",
  "/live-report": "/live-report.html",
  "/map": "/map.html",
  "/nanakuli": "/nanakuli.html",
  "/pokai-bay": "/pokai-bay.html",
  "/pupukea": "/pupukea.html",
  "/search": "/search.html",
  "/waikiki": "/waikiki.html",
  "/waimanalo": "/waimanalo.html",
  "/waimea-bay": "/waimea-bay.html",
  "/week-forecast": "/week-forecast.html",
  "/ala-moana": "/ala-moana.html"
};

const FILE_ROUTE_MAP = Object.fromEntries(
  Object.entries(ROUTE_FILE_MAP).map(([route, file]) => [file, route])
);

function injectSeoScript(html) {
  if (html.includes('/js/seo.js')) {
    return html;
  }

  return html.replace("</body>", '  <script src="/js/seo.js"></script>\n</body>');
}

function withPath(url, pathname) {
  const nextUrl = new URL(url.toString());
  nextUrl.pathname = pathname;
  return nextUrl;
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "...",
    lt: "<",
    mdash: "-",
    nbsp: " ",
    ndash: "-",
    quot: '"',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"'
  };

  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalizedEntity = String(entity).toLowerCase();
    if (normalizedEntity.startsWith("#x")) {
      const codePoint = Number.parseInt(normalizedEntity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (normalizedEntity.startsWith("#")) {
      const codePoint = Number.parseInt(normalizedEntity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[normalizedEntity] ?? match;
  });
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function trimText(value, maxLength = 1200) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseWordpressDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(/z$/i.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function targetKey(target) {
  return target.regionTitle ? `region:${target.regionTitle}` : `shore:${target.shore}`;
}

function expandToShoreTargets(shore) {
  if (!SHORE_NAMES.includes(shore)) {
    return [];
  }

  return [{ regionTitle: null, shore }];
}

function resolveAdvisoryTargets(text, options = {}) {
  const normalizedText = normalizeText(text);
  const { allowIslandWide = false } = options;

  if (!normalizedText) {
    return [];
  }

  if (allowIslandWide && normalizedText.includes("island wide")) {
    return SHORE_NAMES.flatMap((shore) => expandToShoreTargets(shore));
  }

  const matchedRegions = IMPORT_REGION_CONFIGS.filter((region) =>
    region.keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)))
  );
  const matchedRegionTitles = dedupe(matchedRegions.map((region) => region.title));
  const matchedShores = dedupe(
    SHORE_KEYWORDS.filter((entry) =>
      entry.keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)))
    ).map((entry) => entry.shore)
  );

  if (matchedRegionTitles.length > 1) {
    const shores = dedupe(
      matchedRegionTitles
        .map((title) => IMPORT_REGION_CONFIGS.find((region) => region.title === title)?.shore)
        .filter(Boolean)
    );

    if (
      shores.length === 1 &&
      /( to | through | from | between | stretch | coastline | coast | shoreline )/.test(normalizedText)
    ) {
      return expandToShoreTargets(shores[0]);
    }

    return matchedRegionTitles.map((regionTitle) => ({ regionTitle, shore: null }));
  }

  if (matchedRegionTitles.length === 1) {
    return [{ regionTitle: matchedRegionTitles[0], shore: null }];
  }

  if (matchedShores.length) {
    return matchedShores.flatMap((shore) => expandToShoreTargets(shore));
  }

  return [];
}

async function fetchJsonFromSource(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.json();
}

function buildAdvisoryRows(baseRecord, targets) {
  return targets.map((target) => ({
    ...baseRecord,
    region_title: target.regionTitle || null,
    shore: target.regionTitle ? null : target.shore || null,
    _targetKey: targetKey(target)
  }));
}

async function importDohBrownWaterRows(nowIso) {
  const payload = await fetchJsonFromSource(DOH_CWB_EVENTS_URL);
  const events = Array.isArray(payload?.list) ? payload.list : [];
  const openOahuBrownWaterEvents = events.filter((event) => {
    const islandName = normalizeText(event?.island?.cleanName || event?.island?.name);
    return (
      normalizeText(event?.type) === "brown water advisory" &&
      normalizeText(event?.status) === "open" &&
      islandName === "oahu"
    );
  });

  return openOahuBrownWaterEvents.flatMap((event) => {
    const sourceUrl = `https://eha-cloud.doh.hawaii.gov/cwb#!/event/${event.id}/details/view`;
    const advisoryText = [event.title, event.locationName, event.description].filter(Boolean).join(" ");
    const targets = resolveAdvisoryTargets(advisoryText, { allowIslandWide: Boolean(event.isIslandWide) });
    if (!targets.length) {
      return [];
    }

    return buildAdvisoryRows(
      {
        advisory_type: "brown_water",
        status: "active",
        headline: trimText(stripHtml(event.title || "Brown water advisory"), 220),
        details: trimText(stripHtml(event.description || ""), 1600),
        cause: trimText(stripHtml(event.cause || "Brown water advisory"), 160),
        source_name: DOH_BROWN_WATER_SOURCE,
        source_url: sourceUrl,
        issued_at: event.postedDate || event.createdOn || null,
        starts_at: event.postedDate || event.createdOn || null,
        expires_at: event.closedDate || null,
        created_at: nowIso,
        updated_at: nowIso
      },
      targets
    );
  });
}

function shouldSkipEnvWastewaterPost(text) {
  return /posting of signs and sampling has been waived/i.test(text);
}

function getEnvWastewaterCause(text) {
  if (/heavy rain|rainfall|kona low|storm/i.test(text)) {
    return "Wastewater spill after heavy rain";
  }

  return "Wastewater spill";
}

async function importEnvWastewaterRows(nowIso) {
  const payload = await fetchJsonFromSource(ENV_WASTEWATER_POSTS_URL);
  const posts = Array.isArray(payload) ? payload : [];
  const now = new Date(nowIso);

  return posts.flatMap((post) => {
    const headline = stripHtml(post?.title?.rendered || "");
    const details = stripHtml(post?.content?.rendered || post?.excerpt?.rendered || "");
    const combinedText = `${headline}\n${details}`.trim();
    if (!combinedText || shouldSkipEnvWastewaterPost(combinedText)) {
      return [];
    }

    const startsAtDate = parseWordpressDate(post?.date_gmt || post?.modified_gmt || post?.date || post?.modified);
    if (!startsAtDate) {
      return [];
    }

    const expiresAtDate = addHours(startsAtDate, IMPORT_WINDOW_HOURS);
    if (expiresAtDate <= now) {
      return [];
    }

    const targets = resolveAdvisoryTargets(combinedText);
    if (!targets.length) {
      return [];
    }

    return buildAdvisoryRows(
      {
        advisory_type: "brown_water",
        status: "active",
        headline: trimText(headline || "Wastewater spill notice", 220),
        details: trimText(details, 1600),
        cause: getEnvWastewaterCause(combinedText),
        source_name: ENV_WASTEWATER_SOURCE,
        source_url: post?.link || null,
        issued_at: startsAtDate.toISOString(),
        starts_at: startsAtDate.toISOString(),
        expires_at: expiresAtDate.toISOString(),
        created_at: nowIso,
        updated_at: nowIso
      },
      targets
    );
  });
}

function insertAdvisoryStatement(env, advisory) {
  return env.FEEDBACK_DB.prepare(
    `INSERT INTO water_quality_advisories (
      advisory_type,
      status,
      region_title,
      shore,
      headline,
      details,
      cause,
      source_name,
      source_url,
      issued_at,
      starts_at,
      expires_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    advisory.advisory_type,
    advisory.status,
    advisory.region_title,
    advisory.shore,
    advisory.headline,
    advisory.details,
    advisory.cause,
    advisory.source_name,
    advisory.source_url,
    advisory.issued_at,
    advisory.starts_at,
    advisory.expires_at,
    advisory.created_at,
    advisory.updated_at
  );
}

async function syncImportedAdvisories(env) {
  if (!env.FEEDBACK_DB) {
    return {
      ok: false,
      skipped: true,
      reason: "FEEDBACK_DB binding is not configured."
    };
  }

  const nowIso = new Date().toISOString();
  const sourceJobs = [
    {
      sourceName: DOH_BROWN_WATER_SOURCE,
      load: () => importDohBrownWaterRows(nowIso)
    },
    {
      sourceName: ENV_WASTEWATER_SOURCE,
      load: () => importEnvWastewaterRows(nowIso)
    }
  ];
  const settled = await Promise.allSettled(sourceJobs.map((job) => job.load()));
  const successfulImports = [];
  const failedImports = [];

  settled.forEach((result, index) => {
    const sourceName = sourceJobs[index].sourceName;
    if (result.status === "fulfilled") {
      successfulImports.push({
        sourceName,
        rows: Array.isArray(result.value) ? result.value : []
      });
      return;
    }

    failedImports.push({
      sourceName,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason)
    });
  });

  if (!successfulImports.length) {
    throw new Error(
      failedImports.length
        ? failedImports.map((entry) => `${entry.sourceName}: ${entry.error}`).join("; ")
        : "No advisory sources were available."
    );
  }

  const statements = [];
  successfulImports.forEach((entry) => {
    statements.push(
      env.FEEDBACK_DB.prepare("DELETE FROM water_quality_advisories WHERE source_name = ?").bind(entry.sourceName)
    );
    entry.rows.forEach((row) => {
      statements.push(insertAdvisoryStatement(env, row));
    });
  });

  if (statements.length) {
    await env.FEEDBACK_DB.batch(statements);
  }

  return {
    ok: failedImports.length === 0,
    importedCount: successfulImports.reduce((sum, entry) => sum + entry.rows.length, 0),
    sources: successfulImports.map((entry) => ({
      sourceName: entry.sourceName,
      count: entry.rows.length,
      targets: dedupe(entry.rows.map((row) => row._targetKey)).length
    })),
    failedSources: failedImports
  };
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

async function handleAdvisoriesGet(env, url) {
  if (!env.FEEDBACK_DB) {
    return json({ items: [], configured: false });
  }

  const advisoryType = String(url.searchParams.get("type") || "brown_water").trim().toLowerCase();
  const regionTitle = String(url.searchParams.get("regionTitle") || "").trim();
  const shore = String(url.searchParams.get("shore") || "").trim();
  const now = new Date().toISOString();

  const whereClauses = [
    "advisory_type = ?",
    "status = 'active'",
    "(starts_at IS NULL OR starts_at <= ?)",
    "(expires_at IS NULL OR expires_at >= ?)"
  ];
  const bindings = [advisoryType, now, now];

  if (regionTitle && shore) {
    whereClauses.push("(region_title = ? OR (region_title IS NULL AND shore = ?))");
    bindings.push(regionTitle, shore);
  } else if (regionTitle) {
    whereClauses.push("region_title = ?");
    bindings.push(regionTitle);
  } else if (shore) {
    whereClauses.push("shore = ?");
    bindings.push(shore);
  }

  try {
    const result = await env.FEEDBACK_DB.prepare(
      `SELECT
        id,
        advisory_type,
        status,
        region_title,
        shore,
        headline,
        details,
        cause,
        source_name,
        source_url,
        issued_at,
        starts_at,
        expires_at,
        created_at,
        updated_at
       FROM water_quality_advisories
       WHERE ${whereClauses.join("\n       AND ")}
       ORDER BY COALESCE(expires_at, '9999-12-31T23:59:59.999Z') ASC,
                COALESCE(issued_at, created_at) DESC`
    ).bind(...bindings).all();
    return json({ items: result.results || [], configured: true });
  } catch (error) {
    console.error("Advisory query failed:", error);
    return json({ items: [], configured: false });
  }
}

async function handleAdvisoriesImport(request, env, url) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  if (!env.ADVISORY_IMPORT_TOKEN) {
    return json(
      {
        error: "Manual advisory import is disabled. Set ADVISORY_IMPORT_TOKEN to enable it."
      },
      { status: 503 }
    );
  }

  const providedToken =
    request.headers.get(MANUAL_IMPORT_TOKEN_HEADER) || url.searchParams.get("token") || "";
  if (providedToken !== env.ADVISORY_IMPORT_TOKEN) {
    return json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const result = await syncImportedAdvisories(env);
    return json(result);
  } catch (error) {
    console.error("Manual advisory import failed:", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
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

  try {
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
  } catch (error) {
    return json(
      {
        error: `Database insert failed: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    );
  }

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
    const pathname = normalizePathname(url.pathname);

    if (pathname !== url.pathname) {
      return Response.redirect(withPath(url, pathname).toString(), 301);
    }

    if (pathname === "/api/feedback" && request.method === "POST") {
      return handleFeedbackSubmit(request, env);
    }

    if (pathname === "/api/feedback" && request.method === "GET") {
      return handleFeedbackRecent(env);
    }

    if (pathname === "/api/advisories" && request.method === "GET") {
      return handleAdvisoriesGet(env, url);
    }

    if (pathname === "/api/advisories/import") {
      return handleAdvisoriesImport(request, env, url);
    }

    if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: {
          Allow: "GET, POST, OPTIONS"
        }
      });
    }

    const redirectPath = FILE_ROUTE_MAP[pathname];
    if (redirectPath) {
      return Response.redirect(withPath(url, redirectPath).toString(), 301);
    }

    const assetPath = ROUTE_FILE_MAP[pathname];
    const assetRequest = assetPath
      ? new Request(withPath(url, assetPath), request)
      : request;

    const response = await env.ASSETS.fetch(assetRequest);
    const contentType = response.headers.get("Content-Type") || "";

    if (!contentType.includes("text/html")) {
      return response;
    }

    const html = injectSeoScript(await response.text());
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      syncImportedAdvisories(env).catch((error) => {
        console.error("Scheduled advisory import failed:", error);
      })
    );
  }
};
