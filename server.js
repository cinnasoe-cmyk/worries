require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const morgan = require('morgan');
const slugify = require('slugify');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'worries.sqlite');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.join(__dirname, 'db') }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function cleanUsername(input) {
  return slugify(String(input || ''), { lower: true, strict: true }).slice(0, 24);
}

function normalizeUrl(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getProfile(userId) {
  return db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
}

function getLinks(userId) {
  return db.prepare('SELECT * FROM links WHERE user_id = ? ORDER BY position ASC, id ASC').all(userId);
}

app.get('/', (req, res) => res.render('index', { title: 'worries' }));
app.get('/about', (req, res) => res.render('about', { title: 'about worries' }));
app.get('/pricing', (req, res) => res.render('pricing', { title: 'worries vip' }));

app.get('/register', (req, res) => res.render('register', { title: 'create account', error: null }));
app.post('/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const username = cleanUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!email || !username || password.length < 6) {
      return res.render('register', { title: 'create account', error: 'Use a real email, username, and a password with at least 6 characters.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const insert = db.prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)');
    const info = insert.run(email, username, passwordHash);
    db.prepare('INSERT INTO profiles (user_id, display_name, bio) VALUES (?, ?, ?)').run(info.lastInsertRowid, username, 'make your page yours.');

    req.session.user = { id: info.lastInsertRowid, email, username, is_vip: 0 };
    res.redirect('/dashboard');
  } catch (err) {
    const msg = String(err.message || '').includes('UNIQUE') ? 'That email or username is already taken.' : 'Something went wrong.';
    res.render('register', { title: 'create account', error: msg });
  }
});

app.get('/login', (req, res) => res.render('login', { title: 'login', error: null }));
app.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.render('login', { title: 'login', error: 'Wrong email or password.' });
  }

  req.session.user = { id: user.id, email: user.email, username: user.username, is_vip: user.is_vip };
  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  const profile = getProfile(req.session.user.id);
  const links = getLinks(req.session.user.id);
  res.render('dashboard', { title: 'dashboard', profile, links, saved: req.query.saved === '1' });
});

app.post('/dashboard/profile', requireAuth, (req, res) => {
  const vip = req.session.user.is_vip;
  const font = vip ? String(req.body.font_family || 'Inter').slice(0, 80) : 'Inter';
  const music = vip ? normalizeUrl(req.body.music_url) : '';

  db.prepare(`UPDATE profiles SET
    display_name = ?, bio = ?, pfp_url = ?, banner_url = ?, music_url = ?, discord_id = ?, discord_status = ?,
    font_family = ?, background_color = ?, text_color = ?, accent_color = ?, button_style = ?, show_views = ?
    WHERE user_id = ?`).run(
      String(req.body.display_name || '').slice(0, 60),
      String(req.body.bio || '').slice(0, 220),
      normalizeUrl(req.body.pfp_url),
      normalizeUrl(req.body.banner_url),
      music,
      String(req.body.discord_id || '').trim().slice(0, 40),
      String(req.body.discord_status || 'offline').slice(0, 20),
      font,
      String(req.body.background_color || '#050505').slice(0, 20),
      String(req.body.text_color || '#ffffff').slice(0, 20),
      String(req.body.accent_color || '#ffffff').slice(0, 20),
      String(req.body.button_style || 'glass').slice(0, 20),
      req.body.show_views ? 1 : 0,
      req.session.user.id
    );
  res.redirect('/dashboard?saved=1');
});

app.post('/dashboard/links/add', requireAuth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS total FROM links WHERE user_id = ?').get(req.session.user.id).total;
  if (!req.session.user.is_vip && count >= 5) return res.redirect('/pricing');

  db.prepare('INSERT INTO links (user_id, title, url, icon_url, position) VALUES (?, ?, ?, ?, ?)').run(
    req.session.user.id,
    String(req.body.title || 'new link').slice(0, 40),
    normalizeUrl(req.body.url),
    normalizeUrl(req.body.icon_url),
    count + 1
  );
  res.redirect('/dashboard?saved=1');
});

app.post('/dashboard/links/:id/update', requireAuth, (req, res) => {
  db.prepare('UPDATE links SET title = ?, url = ?, icon_url = ?, position = ?, is_visible = ? WHERE id = ? AND user_id = ?').run(
    String(req.body.title || '').slice(0, 40),
    normalizeUrl(req.body.url),
    normalizeUrl(req.body.icon_url),
    Number(req.body.position || 0),
    req.body.is_visible ? 1 : 0,
    req.params.id,
    req.session.user.id
  );
  res.redirect('/dashboard?saved=1');
});

app.post('/dashboard/links/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM links WHERE id = ? AND user_id = ?').run(req.params.id, req.session.user.id);
  res.redirect('/dashboard?saved=1');
});

// Demo VIP route. Replace this with Stripe/Coinbase Commerce/etc. later.
app.post('/vip/demo-upgrade', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET is_vip = 1 WHERE id = ?').run(req.session.user.id);
  req.session.user.is_vip = 1;
  res.redirect('/dashboard?saved=1');
});

app.get('/u/:username', (req, res) => {
  const username = cleanUsername(req.params.username);
  const user = getUserByUsername(username);
  if (!user) return res.status(404).render('error', { title: 'not found', message: 'That worries page does not exist.' });

  db.prepare('UPDATE profiles SET view_count = view_count + 1 WHERE user_id = ?').run(user.id);
  const profile = getProfile(user.id);
  const links = getLinks(user.id).filter(link => link.is_visible);
  res.render('profile', { title: `${profile.display_name || user.username} on worries`, user, profile, links });
});

app.use((req, res) => res.status(404).render('error', { title: 'not found', message: 'Page not found.' }));

app.listen(PORT, () => console.log(`worries running on http://localhost:${PORT}`));
