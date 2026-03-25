-- Users
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- User profile / preferences
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  display_name    TEXT,
  temp_unit       TEXT DEFAULT 'C',
  wind_unit       TEXT DEFAULT 'kn',
  kite_size_min   INTEGER,
  kite_size_max   INTEGER,
  home_region     TEXT,
  whatsapp_number TEXT,
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Spots master table
CREATE TABLE IF NOT EXISTS spots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  short_name  TEXT,
  slug        TEXT UNIQUE,
  region      TEXT,
  state_code  TEXT,
  lat         REAL,
  lon         REAL,
  depth_m     REAL,
  cam_url     TEXT,
  cam_live    INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Per-user favourites
CREATE TABLE IF NOT EXISTS user_favourites (
  user_id   TEXT REFERENCES users(id),
  spot_id   INTEGER REFERENCES spots(id),
  added_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, spot_id)
);

-- Forecast cache (replaces Redis)
CREATE TABLE IF NOT EXISTS forecast_cache (
  spot_id     INTEGER PRIMARY KEY REFERENCES spots(id),
  fetched_at  TEXT DEFAULT (datetime('now')),
  expires_at  TEXT,
  payload     TEXT
);

-- Kite session log
CREATE TABLE IF NOT EXISTS kite_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT REFERENCES users(id),
  spot_id    INTEGER REFERENCES spots(id),
  session_at TEXT,
  wind_kn    INTEGER,
  notes      TEXT
);

-- Seed initial spots
INSERT OR IGNORE INTO spots (name, short_name, slug, region, state_code, lat, lon)
VALUES
  -- North Carolina — Hatteras / OBX
  ('Salvo — Sound',              'Salvo',          'salvo',           'Hatteras, NC',       'nc', 35.5539, -75.4682),
  ('Canadian Hole',              'Canadian Hole',  'canadian',        'Hatteras, NC',       'nc', 35.5306, -75.4686),
  ('Buxton Kite Pt.',            'Buxton',         'buxton',          'Hatteras, NC',       'nc', 35.2697, -75.5175),
  ('Waves Soundside',            'Waves',          'waves-soundside', 'Waves, NC',          'nc', 35.5750, -75.4780),
  ('Kite Point (The Cove)',      'Kite Point',     'kite-point',      'Avon, NC',           'nc', 35.3540, -75.5080),
  -- North Carolina — other
  ("Jockey's Ridge Soundside",   "Jockey's Ridge", 'jockeys-ridge',   'Nags Head, NC',      'nc', 35.9638, -75.6582),
  ('Wrightsville Beach',         'Wrightsville',   'wrightsville',    'Wilmington, NC',     'nc', 34.2104, -77.7966),
  -- South Carolina
  ("Sullivan's Island Stn 28.5", "Sullivan's Is.", 'sullivans-island',"Sullivan's Is., SC", 'sc', 32.7651, -79.8451),
  ('Isle of Palms 3rd Ave',      'Isle of Palms',  'isle-of-palms',   'Isle of Palms, SC',  'sc', 32.7868, -79.7948),
  ('Folly Beach County Park',    'Folly Beach',    'folly-beach',     'Folly Beach, SC',    'sc', 32.6470, -79.9600),
  ('Hilton Head North Beach',    'Hilton Head',    'hilton-head',     'Hilton Head, SC',    'sc', 32.1436, -80.7453),
  -- Florida
  ('Miami Beach St. 25',         'Miami 25',       'miami25',         'Miami, FL',          'fl', 25.7797, -80.1300),
  ('Crandon Park Kite Beach',    'Crandon Park',   'crandon-park',    'Key Biscayne, FL',   'fl', 25.7095, -80.1547),
  ('Carlin Park',                'Carlin Park',    'carlin-park',     'Jupiter, FL',        'fl', 26.9292, -80.0728),
  ('The 520 Slick',              '520 Slick',      'slick-520',       'Cocoa Beach, FL',    'fl', 28.3600, -80.6750),
  ('Skyway Beach East',          'Skyway Beach',   'skyway-beach',    'St. Petersburg, FL',    'fl', 27.6195, -82.5783),
  -- Rio de Janeiro, Brazil
  ('Jardim de Alá',              'Jd. de Alá',     'jardim-de-ala',   'Leblon, Rio de Janeiro','rj',-22.9833, -43.2219),
  ('Praia do Pepê',              'Pepê',           'praia-do-pepe',   'Barra da Tijuca, RJ',   'rj',-23.0060, -43.3460),
  ('Posto 7 — K7',               'Posto 7',        'posto-7',         'Barra da Tijuca, RJ',   'rj',-23.0004, -43.3659),
  ('Praia da Macumba',           'Macumba',        'praia-da-macumba','Recreio, RJ',           'rj',-23.0185, -43.4470),
  ('Grumari',                    'Grumari',        'grumari',         'Guaratiba, RJ',         'rj',-23.0500, -43.5333),
  -- Rio Grande do Norte, Brazil
  ('Três Picos — S. M. Gostoso', 'Três Picos',    'tres-picos',      'S. M. do Gostoso, RN',  'rn',   -5.0983, -35.6462),
  ('Ilha do Fogo — Parrachos',   'Ilha do Fogo',  'ilha-do-fogo',    'Macau, RN',             'rn',   -5.0708, -36.4850),
  ('Galinhos',                   'Galinhos',      'galinhos',        'Galinhos, RN',          'rn',   -5.1000, -36.2537),
  -- Rio de Janeiro — other
  ('Búzios — Praia Rasa',        'Búzios',        'buzios',          'Búzios, RJ',            'rj',  -22.7419, -41.9244),
  ('Arraial do Cabo',            'Arraial',       'arraial-do-cabo', 'Arraial do Cabo, RJ',   'rj',  -22.9697, -42.0272),
  ('Lagoa de Araruama',          'Araruama',      'lagoa-araruama',  'Araruama, RJ',          'rj',  -22.8900, -42.3400),
  -- Santa Catarina, Brazil
  ('Ibiraquera — Lagoa',         'Ibiraquera',    'ibiraquera',      'Imbituba, SC',          'scbr',-28.2383, -48.7917),
  ('Garopaba — Praia do Ferrugem','Garopaba',     'garopaba',        'Garopaba, SC',          'scbr',-28.0433, -48.6200),
  -- Ceará, Brazil
  ('Jericoacoara',               'Jeri',          'jericoacoara',    'Jericoacoara, CE',      'ce',   -2.7974, -40.5128),
  ('Guajiru',                    'Guajiru',       'guajiru',         'Trairi, CE',            'ce',   -3.2733, -39.2783),
  ('Paracuru',                   'Paracuru',      'paracuru',        'Paracuru, CE',          'ce',   -3.4117, -39.0503),
  ('Barrinha',                   'Barrinha',      'barrinha',        'Paracuru, CE',          'ce',   -3.3833, -39.0667);
