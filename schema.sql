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
  notes TEXT,
  snapshot_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_submitted_at
ON feedback_submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_region_title
ON feedback_submissions (region_title);
