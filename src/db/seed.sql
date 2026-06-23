-- Seed Volta API
-- Categorías, Marcas y Productos

-- Categorías
INSERT INTO categories (id, name, icon) VALUES
  ('engine', 'Motor', 'settings'),
  ('brakes', 'Frenos', 'disc'),
  ('suspension', 'Suspensión', 'shield'),
  ('transmission', 'Transmisión', 'git-branch'),
  ('electrical', 'Eléctrico', 'zap'),
  ('filters', 'Filtros', 'droplet'),
  ('exhaust', 'Escape', 'wind');
ON CONFLICT (id) DO NOTHING;

-- Marcas
INSERT INTO brands (id, name, logo) VALUES
  ('meritor', 'Meritor', 'M'),
  ('fleetguard', 'Fleetguard', 'F'),
  ('delco', 'Delco Remy', 'DR'),
  ('wabco', 'WABCO', 'W'),
  ('bendix', 'Bendix', 'B'),
  ('eaton', 'Eaton', 'E'),
  ('cummins', 'Cummins', 'C'),
  ('borgwarner', 'BorgWarner', 'BW'),
  ('depo', 'Depo', 'D'),
  ('epcom', 'EPCOM', 'EP'),
  ('tractobull', 'Tractobull', 'TB');
ON CONFLICT (id) DO NOTHING;

-- Productos

INSERT INTO products (
    name,
    brand_id,
    category_id,
    price,
    image,
    available
) VALUES
(
    'Alternador 24V 100A',
    'delco',
    'electrical',
    1250,
    'https://resources.apymsa.com.mx/imagenes/FotosSpeed/0164700/01647003a.jpg',
    true
),
(
    'Pastillas de freno',
    'meritor',
    'brakes',
    45,
    'https://m.media-amazon.com/images/I/513ok64+jUL._AC_UF894,1000_QL80_.jpg',
    false
),
(
    'Filtro de aceite LF16015',
    'fleetguard',
    'filters',
    18.5,
    'https://m.media-amazon.com/images/I/41naFSo3jCL._AC_UF894,1000_QL80_.jpg',
    true
),
(
    'Faro delantero izquierdo',
    'depo',
    'electrical',
    120,
    'https://refaccionariamario.info/148404-large_default/faro-principal-cromado-liso-electrico-izquierdo-depo-para-derby-6n.jpg',
    true
),
(
    'Kit de suspensión neumática',
    'wabco',
    'suspension',
    850,
    'https://cdn.autodoc.de/thumb?id=18386697&m=0&n=2&lng=es&rev=94078028',
    true
),
(
    'Block de motor 6 cilindros',
    'cummins',
    'engine',
    4500,
    'https://m.media-amazon.com/images/I/41UAJ2715YL._AC_UF894,1000_QL80_.jpg',
    true
),
(
    'Turbo cargador T4',
    'borgwarner',
    'engine',
    2200,
    'https://m.media-amazon.com/images/I/719a52fjAZL._AC_UF894,1000_QL80_.jpg',
    true
),
(
    'Kit de inyectores diésel',
    'delco',
    'engine',
    680,
    'https://m.media-amazon.com/images/I/61bYvnseiKL._AC_UF894,1000_QL80_.jpg',
    true
),
(
    'Disco de embrague',
    'eaton',
    'transmission',
    320,
    'https://www.eaton.com/mdmfiles/PDM24897970/IS-VG-EATONEVERTOUGHSELFADJUSTCLUTCH-C/500x500_72dpi',
    true
),
(
    'Aceite de caja 75W-90',
    'eaton',
    'transmission',
    45,
    'https://www.eaton.com/content/dam/eaton/products/transmissions/lubricants/eaton-gear-lube-gallon-fe75w-90-rgb.jpg',
    true
),
(
    'Tambor de freno',
    'bendix',
    'brakes',
    175,
    'https://m.media-amazon.com/images/I/61hnb8IVr-L.jpg',
    true
),
(
    'Manguera de freno reforzada',
    'bendix',
    'brakes',
    32,
    'https://m.media-amazon.com/images/I/414ImvfUeaL._AC_UF894,1000_QL80_.jpg',
    true
),
(
    'Amortiguador neumático',
    'wabco',
    'suspension',
    290,
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTGHQUZEBwrRDOdi94GO9ckKwOiJl9IPdfbHQ&s',
    true
),
(
    'Filtro de aire CA1054',
    'fleetguard',
    'filters',
    42,
    'https://m.media-amazon.com/images/I/61WX-h+rEHL.jpg',
    true
),
(
    'Filtro de combustible FF5052',
    'fleetguard',
    'filters',
    28,
    'https://http2.mlstatic.com/D_NQ_NP_779447-MLM77494482826_072024-O.webp',
    true
),
(
    'Batería 12V 200Ah AGM',
    'epcom',
    'electrical',
    380,
    'https://solartechmo.com.mx/wp/wp-content/uploads/2024/01/PL200D12V2-h1.png',
    true
),
(
    'Marcha de arranque 24V',
    'delco',
    'electrical',
    420,
    'https://resources.apymsa.com.mx/imagenes/FotosSpeed/2800013/28000133a.jpg',
    true
),
(
    'Escape Cuello de Ganso Acero Inoxidable 409',
    'tractobull',
    'exhaust',
    895,
    'https://http2.mlstatic.com/D_NQ_NP_879511-MLM69358033980_052023-O.webp',
    true,
    'Cuello de ganso para sistema de escape fabricado en acero inoxidable 409. Alta resistencia a la corrosión y temperaturas elevadas.',
    20.00,
    NOW(),
    NOW()
);