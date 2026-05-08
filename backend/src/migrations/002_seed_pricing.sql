-- ============================================================
-- DEFAULT APP SETTINGS
-- ============================================================

INSERT INTO app_settings (key, value) VALUES
  ('overhead_percent', '15'),
  ('profit_percent',   '35'),
  ('sales_tax_percent', '8.25')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- MATERIAL CATEGORIES
-- ============================================================

INSERT INTO material_categories (name, label) VALUES
  ('shingles',          'Field Shingles'),
  ('hip_ridge',         'Hip & Ridge Shingles'),
  ('starter',           'Starter Course'),
  ('underlayment',      'Underlayment'),
  ('ice_water_shield',  'Ice & Water Shield'),
  ('drip_edge',         'Drip Edge'),
  ('fasteners',         'Fasteners'),
  ('flashing',          'Flashing & Accessories'),
  ('ventilation',       'Ventilation')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SHINGLES (per SQ)
-- ============================================================

-- GAF
INSERT INTO materials (category_id, manufacturer, name, unit, unit_price, is_default) VALUES
  ((SELECT id FROM material_categories WHERE name='shingles'), 'GAF', 'Royal Sovereign',           'SQ', 114.00,   FALSE),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'GAF', 'Timberline Natural Shadow',  'SQ', 109.50,   FALSE),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'GAF', 'Timberline HDZ',             'SQ', 124.02,   TRUE),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'GAF', 'UHDZ Pro UltraMat',          'SQ', 135.00,   FALSE),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'GAF', 'Armorshield II',             'SQ', 145.02,   FALSE);

-- Tamko
INSERT INTO materials (category_id, manufacturer, name, unit, unit_price) VALUES
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Tamko', 'AR Elite',           'SQ', 108.00),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Tamko', 'Heritage',           'SQ', 110.25),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Tamko', 'Titan XT',           'SQ', 115.95),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Tamko', 'StormFight FLEX',    'SQ', 145.02),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Tamko', 'StormFighter IR',    'SQ', 145.02),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Tamko', 'Hailguard',          'SQ', 245.00);

-- Atlas
INSERT INTO materials (category_id, manufacturer, name, unit, unit_price) VALUES
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Atlas', 'Prolam',             'SQ', 107.25),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Atlas', 'Pinnacle Pristine',  'SQ', 114.57),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Atlas', 'Pinnacle Impact SG', 'SQ', 126.96),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Atlas', 'StormMaster Shake',  'SQ', 150.00);

-- Malarkey
INSERT INTO materials (category_id, manufacturer, name, unit, unit_price) VALUES
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Malarkey', 'Highlander',      'SQ', 121.65),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Malarkey', 'Vista AR',        'SQ', 132.12),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Malarkey', 'Legacy',          'SQ', 154.99),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Malarkey', 'Windsor 285 SG',  'SQ', 275.00);

-- IKO
INSERT INTO materials (category_id, manufacturer, name, unit, unit_price) VALUES
  ((SELECT id FROM material_categories WHERE name='shingles'), 'IKO', 'Marathon 25YR',        'SQ', 116.46),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'IKO', 'Cambridge',             'SQ', 109.50),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'IKO', 'Dynasty AR',            'SQ', 116.52),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'IKO', 'Nordic',                'SQ', 132.03),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'IKO', 'Royal Estate',          'SQ', 219.72),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'IKO', 'Armourshake',           'SQ', 272.60);

-- Owens Corning
INSERT INTO materials (category_id, manufacturer, name, unit, unit_price) VALUES
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Owens Corning', 'Supreme',               'SQ', 104.01),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Owens Corning', 'Oakridge',              'SQ', 113.04),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Owens Corning', 'TruDef Oakridge',       'SQ', 117.63),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Owens Corning', 'TruDef Duration',       'SQ', 122.10),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Owens Corning', 'TruDef Duration Storm', 'SQ', 136.02),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'Owens Corning', 'TruDef Dura Flex AR',   'SQ', 141.63);

-- CertainTeed
INSERT INTO materials (category_id, manufacturer, name, unit, unit_price) VALUES
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'CT AR XT25',           'SQ', 104.49),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'Landmark',              'SQ', 121.59),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'Patriot',               'SQ', 112.83),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'Landmark Pro AR',       'SQ', 140.73),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'Belmont IR AR',         'SQ', 226.96),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'ClimateFlex IR',        'SQ', 145.02),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'President IR AR',       'SQ', 264.55),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'AR President TL',       'SQ', 282.66),
  ((SELECT id FROM material_categories WHERE name='shingles'), 'CertainTeed', 'Grand Manor',           'SQ', 291.35);

-- ============================================================
-- HIP & RIDGE (per BD)
-- ============================================================

INSERT INTO materials (category_id, manufacturer, name, unit, unit_price, lf_per_unit) VALUES
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'GAF',          'Z-Ridge 33LF',             'BD', 87.75,  33),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'GAF',          'Seal-A-Ridge 25LF',        'BD', 75.00,  25),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'GAF',          'Timbertex 20LF',           'BD', 82.00,  20),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'GAF',          'TimberCrest 10" 20LF',     'BD', 120.55, 20),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'GAF',          'Weatherblocker 100LF',     'BD', 110.00, 100),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Tamko',        'Proline 33.3LF',           'BD', 76.60,  33.3),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Tamko',        'AR H&R 33.3LF',            'BD', 76.60,  33.3),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Atlas',        'Pro-Cut Scotch 31LF',      'BD', 82.50,  31),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Atlas',        'HI Profile 20LF',          'BD', 105.50, 20),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Atlas',        'ProLam ARS 31LF',          'BD', 82.50,  31),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Atlas',        'StormMaster 33LF',         'BD', 82.50,  33),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Malarkey',     'EZ Ridge XT',              'BD', 125.00, 33),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Malarkey',     'Ridgeflex 227 31LF',       'BD', 92.00,  31),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'IKO',          'AR H&R 33LF',              'BD', 77.50,  33),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'IKO',          'Ultra HP 20LF',            'BD', 110.00, 20),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Owens Corning','Proedge AR 33LF',          'BD', 84.75,  33),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Owens Corning','Rizeridge AR 33LF',        'BD', 94.53,  33),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Owens Corning','Duraridge 20LF',           'BD', 103.45, 20),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'Owens Corning','ImpactRidge AR',           'BD', 113.50, 33),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'CertainTeed',  'Cedar Crest IR',           'BD', 95.25,  20),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'CertainTeed',  'Cedar Crest 20L',          'BD', 95.25,  20),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'CertainTeed',  'Shangle Ridge 10LF',       'BD', 97.75,  10),
  ((SELECT id FROM material_categories WHERE name='hip_ridge'), 'CertainTeed',  'Shadow ClimateFlex AR H&R','BD', 108.00, 33);

-- ============================================================
-- STARTER (per BD)
-- ============================================================

INSERT INTO materials (category_id, manufacturer, name, unit, unit_price, lf_per_unit, is_default) VALUES
  ((SELECT id FROM material_categories WHERE name='starter'), 'GAF',          'Pro-Start 120LF',           'BD', 64.50,  120, TRUE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'Tamko',        '10" Starter 100LF',         'BD', 66.50,  100, FALSE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'Atlas',        'Pro-Cut 140LF',             'BD', 75.25,  140, FALSE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'Malarkey',     'Smart Start 114.9LF',       'BD', 80.80,  114.9, FALSE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'Malarkey',     'Windsor Starter 70LF',      'BD', 160.00, 70,  FALSE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'IKO',          'Leading Edge 118LF',        'BD', 67.50,  118, FALSE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'Owens Corning','Starter Strip 105LF',       'BD', 64.00,  105, FALSE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'CertainTeed',  'SwiftStart 116LF',          'BD', 68.00,  116, FALSE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'CertainTeed',  'President Starter 36LF',    'BD', 116.65, 36,  FALSE),
  ((SELECT id FROM material_categories WHERE name='starter'), 'CertainTeed',  '10" HP Starter 102LF',      'BD', 131.40, 102, FALSE);

-- ============================================================
-- UNDERLAYMENT (per RL)
-- ============================================================

INSERT INTO materials (category_id, manufacturer, name, unit, unit_price, coverage_sq, is_default) VALUES
  ((SELECT id FROM material_categories WHERE name='underlayment'), NULL,           '15# Felt 4SQ',             'RL', 33.13,   4,   FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Tarco',        'MS300 2SQ',                'RL', 93.16,   2,   FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'ABC',          'Pro Guard 10SQ',           'RL', 99.90,   10,  TRUE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Rhinoroof',    'Gran 2SQ',                 'RL', 106.93,  2,   FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), NULL,           'Maxfelt XT 10SQ',          'RL', 99.90,   10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), NULL,           'Maxfelt NC 10SQ',          'RL', 99.90,   10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), NULL,           'Maxfelt 30 10SQ',          'RL', 117.60,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Atlas',        'Summit 60 10SQ',           'RL', 114.02,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Atlas',        'Summit 180 10SQ',          'RL', 151.74,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Atlas',        'Weathermaster 200',        'RL', 130.15,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'CertainTeed',  'Roofrunner 10SQ',          'RL', 130.43,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'GAF',          'Feltbuster 10SQ',          'RL', 136.74,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'GAF',          'Tigerpaw 10SQ',            'RL', 281.52,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'IKO',          'Stormshield I&W',          'RL', 137.11,  2,   FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Malarkey',     'Secure Start Lite 10SQ',   'RL', 112.39,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Owens Corning','Proarmor 10SQ',            'RL', 137.40,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Owens Corning','Deck Defense 10SQ',        'RL', 263.90,  10,  FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Owens Corning','Weatherlock 2SQ',          'RL', 151.63,  2,   FALSE),
  ((SELECT id FROM material_categories WHERE name='underlayment'), 'Polyglass',    'Polystick MTS 2SQ',        'RL', 144.50,  2,   FALSE);

-- ============================================================
-- ICE & WATER SHIELD (per RL)
-- ============================================================

INSERT INTO materials (category_id, manufacturer, name, unit, unit_price, coverage_sq, lf_per_unit, is_default) VALUES
  ((SELECT id FROM material_categories WHERE name='ice_water_shield'), 'GAF', 'StormGuard 2SQ/RL', 'RL', 136.50, 2, 66, TRUE);

-- ============================================================
-- DRIP EDGE (per PC, 10 LF each)
-- ============================================================

INSERT INTO materials (category_id, manufacturer, name, unit, unit_price, lf_per_unit, is_default) VALUES
  ((SELECT id FROM material_categories WHERE name='drip_edge'), NULL, 'Drip Edge 1.5x1.5 Painted', 'PC', 7.675,  10, TRUE),
  ((SELECT id FROM material_categories WHERE name='drip_edge'), NULL, 'Drip Edge 2x2 Painted',      'PC', 9.95,   10, FALSE);

-- ============================================================
-- FASTENERS
-- ============================================================

INSERT INTO materials (category_id, manufacturer, name, unit, unit_price) VALUES
  ((SELECT id FROM material_categories WHERE name='fasteners'), NULL, 'Plastic Cap 1" 2M',   'BX', 19.75),
  ((SELECT id FROM material_categories WHERE name='fasteners'), NULL, 'Coil Nail 1-1/4" EG', 'BX', 54.00),
  ((SELECT id FROM material_categories WHERE name='fasteners'), NULL, 'Nail 1-1/4" EG 50#',  'BX', 85.74),
  ((SELECT id FROM material_categories WHERE name='fasteners'), NULL, '8D Sinker 50#',        'BX', 135.63);

-- ============================================================
-- FLASHING & ACCESSORIES
-- ============================================================

INSERT INTO materials (category_id, manufacturer, name, unit, unit_price, lf_per_unit) VALUES
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, 'Step Shingle 4x4 8"',       'BD', 70.48,  NULL),
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, 'Galv Roll Valley 20"x50''', 'RL', 80.00,  50),
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, '1.5" Bullet Boot',          'PC', 33.10,  NULL),
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, '2" Bullet Boot',            'PC', 39.25,  NULL),
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, '3" Bullet Boot',            'PC', 45.15,  NULL),
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, '8" Roof Jack',              'PC', 53.05,  NULL),
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, '1.5" Lead Flash',           'PC', 21.40,  NULL),
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, '2" Lead Flash',             'PC', 22.55,  NULL),
  ((SELECT id FROM material_categories WHERE name='flashing'), NULL, '3" Lead Flash',             'PC', 31.05,  NULL);

-- ============================================================
-- VENTILATION
-- ============================================================

INSERT INTO materials (category_id, manufacturer, name, unit, unit_price) VALUES
  ((SELECT id FROM material_categories WHERE name='ventilation'), 'Lomanco',      'Low Profile 550',      'PC', 21.43),
  ((SELECT id FROM material_categories WHERE name='ventilation'), NULL,           'Slant Back 750',       'PC', 21.55),
  ((SELECT id FROM material_categories WHERE name='ventilation'), 'Lomanco',      '135 Static',           'PC', 76.40),
  ((SELECT id FROM material_categories WHERE name='ventilation'), 'Lomanco',      '2000 Power',           'EA', 187.10),
  ((SELECT id FROM material_categories WHERE name='ventilation'), NULL,           'Turbine 12"',          'PC', 89.00),
  ((SELECT id FROM material_categories WHERE name='ventilation'), 'Lomanco',      '14" Turbine',          'PC', 101.75),
  ((SELECT id FROM material_categories WHERE name='ventilation'), 'GAF',          'Cobra Rigid 3 12"',    'PC', 18.83),
  ((SELECT id FROM material_categories WHERE name='ventilation'), 'Owens Corning','Ventsure 12"x4''',     'PC', 21.35),
  ((SELECT id FROM material_categories WHERE name='ventilation'), NULL,           'Ross 65',              'PC', 11.10),
  ((SELECT id FROM material_categories WHERE name='ventilation'), NULL,           'Ross 150',             'PC', 42.85);
