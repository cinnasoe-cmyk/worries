require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const morgan = require('morgan');
const slugify = require('slugify');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'db', 'data.json');
const DISCORD_API = 'https://discord.com/api/v10';
const UPLOAD_ROOT = path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

function emptyData() {
  return {
    nextUserId: 1,
    nextLinkId: 1,
    users: [],
    profiles: [],
    links: []
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_PATH)) return emptyData();
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    return { ...emptyData(), ...parsed };
  } catch (err) {
    console.error('Could not read data file. Starting with empty data.', err);
    return emptyData();
  }
}

let data = loadData();

function saveData() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
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

const uploadStorage = multer.diskStorage({
  destination(req, file, cb) {
    let folder = 'misc';
    if (file.fieldname === 'pfp_file' || file.fieldname === 'banner_file' || file.fieldname === 'icon_file') folder = 'images';
    if (file.fieldname === 'music_file') folder = 'audio';
    const dest = path.join(UPLOAD_ROOT, folder);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${safeName}${ext}`);
  }
});

function isAllowedUpload(file) {
  const imageTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
  const audioTypes = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave']);

  if (file.fieldname === 'music_file') return audioTypes.has(file.mimetype);
  return imageTypes.has(file.mimetype);
}

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!isAllowedUpload(file)) return cb(new Error('Invalid file type.'));
    cb(null, true);
  }
});

function fileUrl(file) {
  if (!file) return '';
  const rel = path.relative(path.join(__dirname, 'public'), file.path).split(path.sep).join('/');
  return `/${rel}`;
}


function cleanUsername(input) {
  return slugify(String(input || ''), { lower: true, strict: true }).slice(0, 24);
}

const RESERVED_SLUGS = new Set([
  '', 'u', 'auth', 'dashboard', 'login', 'logout', 'register', 'pricing', 'about',
  'vip', 'api', 'public', 'css', 'js', 'img', 'assets', 'admin', 'settings', 'help',
  'terms', 'privacy', 'favicon.ico', 'robots.txt'
]);

function isReservedSlug(username) {
  return RESERVED_SLUGS.has(cleanUsername(username));
}

function normalizeUrl(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

function boolNum(value) {
  return value ? 1 : 0;
}

function getUserByUsername(username) {
  return data.users.find(user => user.username === username);
}

function getUserByEmail(email) {
  return data.users.find(user => user.email === email);
}

function getProfile(userId) {
  return data.profiles.find(profile => profile.user_id === userId);
}

function getLinks(userId) {
  return data.links
    .filter(link => link.user_id === userId)
    .sort((a, b) => (a.position - b.position) || (a.id - b.id));
}

function createDefaultProfile(userId, username) {
  const profile = {
    user_id: userId,
    display_name: username,
    bio: 'make your page yours.',
    pfp_url: '',
    pfp_source: 'upload',
    banner_url: '',
    music_url: '',
    discord_id: '',
    discord_username: '',
    discord_global_name: '',
    discord_avatar_url: '',
    discord_connected_at: '',
    discord_status: 'offline',
    font_family: 'Inter',
    background_color: '#050505',
    text_color: '#ffffff',
    accent_color: '#ffffff',
    button_style: 'glass',
    show_views: 1,
    view_count: 0
  };
  data.profiles.push(profile);
  return profile;
}

function discordRedirectUri() {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  return `${baseUrl.replace(/\/$/, '')}/auth/discord/callback`;
}

function discordAvatarUrl(discordUser) {
  if (!discordUser.avatar) return '';
  const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}?size=128`;
}

function renderProfilePage(req, res, username) {
  username = cleanUsername(username);
  const user = getUserByUsername(username);
  if (!user) return res.status(404).render('error', { title: 'not found', message: 'That worries page does not exist.' });

  const profile = getProfile(user.id) || createDefaultProfile(user.id, user.username);
  profile.view_count = Number(profile.view_count || 0) + 1;
  saveData();

  const links = getLinks(user.id).filter(link => link.is_visible);
  res.render('profile', { title: `${profile.display_name || user.username} on worries`, user, profile, links });
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

    if (isReservedSlug(username)) {
      return res.render('register', { title: 'create account', error: 'That username is reserved. Choose another one.' });
    }

    if (getUserByEmail(email) || getUserByUsername(username)) {
      return res.render('register', { title: 'create account', error: 'That email or username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = {
      id: data.nextUserId++,
      email,
      username,
      password_hash: passwordHash,
      is_vip: 0,
      created_at: new Date().toISOString()
    };

    data.users.push(user);
    createDefaultProfile(user.id, username);
    saveData();

    req.session.user = { id: user.id, email, username, is_vip: 0 };
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('register', { title: 'create account', error: 'Something went wrong.' });
  }
});

app.get('/login', (req, res) => res.render('login', { title: 'login', error: null }));
app.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = getUserByEmail(email);

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
  const profile = getProfile(req.session.user.id) || createDefaultProfile(req.session.user.id, req.session.user.username);
  const links = getLinks(req.session.user.id);
  res.render('dashboard', { title: 'dashboard', profile, links, saved: req.query.saved === '1', error: req.query.error || '' });
});

app.post('/dashboard/profile', requireAuth, upload.fields([
  { name: 'pfp_file', maxCount: 1 },
  { name: 'banner_file', maxCount: 1 },
  { name: 'music_file', maxCount: 1 }
]), (req, res) => {
  const profile = getProfile(req.session.user.id) || createDefaultProfile(req.session.user.id, req.session.user.username);
  const vip = req.session.user.is_vip;

  profile.display_name = String(req.body.display_name || '').slice(0, 60);
  profile.bio = String(req.body.bio || '').slice(0, 220);

  const pfpUpload = req.files?.pfp_file?.[0];
  const bannerUpload = req.files?.banner_file?.[0];
  const musicUpload = req.files?.music_file?.[0];

  const requestedPfpSource = String(req.body.pfp_source || 'upload');
  const canUseDiscordPfp = Boolean(profile.discord_id && profile.discord_avatar_url);

  if (pfpUpload) {
    profile.pfp_url = fileUrl(pfpUpload);
    profile.pfp_source = 'upload';
  }

  if (requestedPfpSource === 'discord' && canUseDiscordPfp) {
    profile.pfp_source = 'discord';
  } else if (requestedPfpSource === 'upload') {
    profile.pfp_source = 'upload';
  }

  if (profile.pfp_source === 'discord' && !canUseDiscordPfp) {
    profile.pfp_source = 'upload';
  }
  if (bannerUpload) profile.banner_url = fileUrl(bannerUpload);
  if (vip && musicUpload) profile.music_url = fileUrl(musicUpload);

  if (req.body.clear_pfp) {
    profile.pfp_url = '';
    if (profile.pfp_source !== 'discord') profile.pfp_source = 'upload';
  }
  if (req.body.clear_banner) profile.banner_url = '';
  if (vip && req.body.clear_music) profile.music_url = '';
  if (!vip) profile.music_url = '';

  profile.discord_status = String(req.body.discord_status || profile.discord_status || 'offline').slice(0, 20);
  profile.font_family = vip ? String(req.body.font_family || 'Inter').slice(0, 80) : 'Inter';
  profile.background_color = String(req.body.background_color || '#050505').slice(0, 20);
  profile.text_color = String(req.body.text_color || '#ffffff').slice(0, 20);
  profile.accent_color = String(req.body.accent_color || '#ffffff').slice(0, 20);
  profile.button_style = String(req.body.button_style || 'glass').slice(0, 20);
  profile.show_views = boolNum(req.body.show_views);

  saveData();
  res.redirect('/dashboard?saved=1');
});

app.get('/auth/discord', requireAuth, (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return res.redirect('/dashboard?error=discord_env_missing');
  }

  const state = crypto.randomBytes(24).toString('hex');
  req.session.discordOAuthState = state;

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: discordRedirectUri(),
    response_type: 'code',
    scope: 'identify',
    state
  });

  res.redirect(`${DISCORD_API}/oauth2/authorize?${params.toString()}`);
});

app.get('/auth/discord/callback', requireAuth, async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    if (!code || !state || state !== req.session.discordOAuthState) {
      return res.redirect('/dashboard?error=discord_state');
    }

    delete req.session.discordOAuthState;

    const tokenBody = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: discordRedirectUri()
    });

    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody
    });

    if (!tokenResponse.ok) throw new Error(`Discord token failed: ${tokenResponse.status}`);
    const tokenData = await tokenResponse.json();

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userResponse.ok) throw new Error(`Discord user failed: ${userResponse.status}`);
    const discordUser = await userResponse.json();

    const profile = getProfile(req.session.user.id) || createDefaultProfile(req.session.user.id, req.session.user.username);
    profile.discord_id = discordUser.id;
    profile.discord_username = discordUser.username || '';
    profile.discord_global_name = discordUser.global_name || '';
    profile.discord_avatar_url = discordAvatarUrl(discordUser);
    profile.discord_connected_at = new Date().toISOString();
    profile.discord_status = 'connected';

    saveData();
    res.redirect('/dashboard?saved=1');
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard?error=discord_connect_failed');
  }
});

app.post('/dashboard/discord/disconnect', requireAuth, (req, res) => {
  const profile = getProfile(req.session.user.id) || createDefaultProfile(req.session.user.id, req.session.user.username);
  profile.discord_id = '';
  profile.discord_username = '';
  profile.discord_global_name = '';
  profile.discord_avatar_url = '';
  profile.discord_connected_at = '';
  profile.discord_status = 'offline';
  if (profile.pfp_source === 'discord') profile.pfp_source = 'upload';
  saveData();
  res.redirect('/dashboard?saved=1');
});

app.post('/dashboard/links/add', requireAuth, upload.single('icon_file'), (req, res) => {
  const links = getLinks(req.session.user.id);
  if (!req.session.user.is_vip && links.length >= 5) return res.redirect('/pricing');

  data.links.push({
    id: data.nextLinkId++,
    user_id: req.session.user.id,
    title: String(req.body.title || 'new link').slice(0, 40),
    url: normalizeUrl(req.body.url),
    icon_url: req.file ? fileUrl(req.file) : '',
    position: links.length + 1,
    is_visible: 1,
    created_at: new Date().toISOString()
  });

  saveData();
  res.redirect('/dashboard?saved=1');
});

app.post('/dashboard/links/:id/update', requireAuth, upload.single('icon_file'), (req, res) => {
  const linkId = Number(req.params.id);
  const link = data.links.find(item => item.id === linkId && item.user_id === req.session.user.id);

  if (link) {
    link.title = String(req.body.title || '').slice(0, 40);
    link.url = normalizeUrl(req.body.url);
    if (req.file) link.icon_url = fileUrl(req.file);
    if (req.body.clear_icon) link.icon_url = '';
    link.position = Number(req.body.position || 0);
    link.is_visible = boolNum(req.body.is_visible);
    saveData();
  }

  res.redirect('/dashboard?saved=1');
});

app.post('/dashboard/links/:id/delete', requireAuth, (req, res) => {
  const linkId = Number(req.params.id);
  data.links = data.links.filter(item => !(item.id === linkId && item.user_id === req.session.user.id));
  saveData();
  res.redirect('/dashboard?saved=1');
});

// Demo VIP route. Replace this with Stripe, Coinbase Commerce, PayPal, etc. later.
app.post('/vip/demo-upgrade', requireAuth, (req, res) => {
  const user = data.users.find(item => item.id === req.session.user.id);
  if (user) {
    user.is_vip = 1;
    req.session.user.is_vip = 1;
    saveData();
  }
  res.redirect('/dashboard?saved=1');
});

// Old /u/name links still work, but now they redirect to /name.
app.get('/u/:username', (req, res) => {
  const username = cleanUsername(req.params.username);
  res.redirect(301, `/${username}`);
});

// Clean profile URLs: worries.uk/emo instead of worries.uk/u/emo.
// Keep this near the bottom so it does not steal routes like /dashboard or /pricing.
app.get('/:username', (req, res, next) => {
  const username = cleanUsername(req.params.username);
  if (isReservedSlug(username)) return next();
  return renderProfilePage(req, res, username);
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.message === 'Invalid file type.' || err.code === 'LIMIT_FILE_SIZE') {
    return res.redirect('/dashboard?error=upload_failed');
  }
  next(err);
});

app.use((req, res) => res.status(404).render('error', { title: 'not found', message: 'Page not found.' }));

app.listen(PORT, () => console.log(`worries running on http://localhost:${PORT}`));
