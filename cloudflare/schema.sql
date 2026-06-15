CREATE TABLE IF NOT EXISTS member_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  member_type TEXT NOT NULL,
  member_type_label TEXT NOT NULL,
  name TEXT NOT NULL,
  wechat_id TEXT NOT NULL,
  adults INTEGER NOT NULL,
  junior INTEGER NOT NULL,
  member_names TEXT NOT NULL,
  has_info_change TEXT,
  official_registration_complete TEXT,
  member_gift_needed TEXT NOT NULL DEFAULT '',
  shipping_address TEXT NOT NULL,
  paid TEXT NOT NULL DEFAULT '否',
  notes TEXT,
  page_url TEXT,
  user_agent TEXT,
  submitted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_submissions_created_at
ON member_submissions (created_at);
