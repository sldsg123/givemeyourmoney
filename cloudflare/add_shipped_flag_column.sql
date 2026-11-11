ALTER TABLE member_submissions
ADD COLUMN shipped_flag INTEGER NOT NULL DEFAULT 0 CHECK (shipped_flag IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_member_submissions_shipping
ON member_submissions (address_confirmed, shipped_flag, id);
