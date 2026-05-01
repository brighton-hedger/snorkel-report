CREATE TABLE IF NOT EXISTS feedback_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_title TEXT NOT NULL,
  shore TEXT,
  towns TEXT,
  station_id TEXT,
  observed_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  observed_score REAL NOT NULL,
  algorithm_score REAL NOT NULL,
  visibility_ft REAL,
  captured_at TEXT,
  model_time TEXT,
  model_date_key TEXT,
  model_hour INTEGER,
  wave_height REAL,
  swell_height REAL,
  swell_period REAL,
  wind_wave_height REAL,
  wind_wave_period REAL,
  sea_temp REAL,
  current_speed REAL,
  current_dir REAL,
  tide_height REAL,
  wind_speed REAL,
  wind_dir REAL,
  cloud_cover REAL,
  rain_inches REAL,
  tide_summary TEXT,
  tide_is_rising INTEGER,
  tide_current_level REAL,
  algorithm_details_json TEXT,
  notes TEXT,
  snapshot_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_submitted_at
ON feedback_submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_region_title
ON feedback_submissions (region_title);

CREATE TABLE IF NOT EXISTS water_quality_advisories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advisory_type TEXT NOT NULL DEFAULT 'brown_water',
  status TEXT NOT NULL DEFAULT 'active',
  region_title TEXT,
  shore TEXT,
  headline TEXT NOT NULL,
  details TEXT,
  cause TEXT,
  source_name TEXT,
  source_url TEXT,
  issued_at TEXT,
  starts_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (region_title IS NOT NULL OR shore IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_water_quality_advisories_active_window
ON water_quality_advisories (advisory_type, status, starts_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_water_quality_advisories_region
ON water_quality_advisories (region_title);

CREATE INDEX IF NOT EXISTS idx_water_quality_advisories_shore
ON water_quality_advisories (shore);

CREATE INDEX IF NOT EXISTS idx_water_quality_advisories_source_name
ON water_quality_advisories (source_name);
