CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_vip INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY,
  display_name TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  pfp_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  music_url TEXT DEFAULT '',
  discord_id TEXT DEFAULT '',
  discord_status TEXT DEFAULT 'offline',
  font_family TEXT DEFAULT 'Inter',
  background_color TEXT DEFAULT '#050505',
  text_color TEXT DEFAULT '#ffffff',
  accent_color TEXT DEFAULT '#ffffff',
  button_style TEXT DEFAULT 'glass',
  show_views INTEGER DEFAULT 1,
  view_count INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
