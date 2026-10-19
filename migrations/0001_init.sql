-- Signatures. Only the minimum needed to run the petition is stored:
--   * no IP addresses, no user agents;
--   * the e-mail address is stored in plain text ONLY if the signer asked for updates,
--     otherwise only a salted hash is kept to prevent duplicate signatures;
--   * deletion codes are stored as salted hashes, never in plain text.
CREATE TABLE IF NOT EXISTS signatures (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  country       TEXT    NOT NULL,           -- ISO 3166-1 alpha-2, or "XX" for other
  email         TEXT,                       -- only when wants_updates = 1
  email_hash    TEXT    UNIQUE,             -- NULL when no e-mail was given
  wants_updates INTEGER NOT NULL DEFAULT 0,
  lang          TEXT    NOT NULL,
  verified      INTEGER NOT NULL DEFAULT 0, -- 1 = passed Turnstile; only these are counted
  delete_hash   TEXT    NOT NULL UNIQUE,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_signatures_country ON signatures (country);
CREATE INDEX IF NOT EXISTS idx_signatures_verified ON signatures (verified);

-- Cheap, constant-time counter (avoids COUNT(*) on every page view).
CREATE TABLE IF NOT EXISTS stats (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

INSERT OR IGNORE INTO stats (key, value) VALUES ('verified_count', 0);
