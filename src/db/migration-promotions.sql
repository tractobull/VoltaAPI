
-- 1. Seed demo promotions
-- Info slide (cashback)
INSERT INTO promotions (type, eyebrow, title, subtitle, link, icon, sort_order)
VALUES ('info', 'CASHBACK', 'Gana 5% en cada compra', 'Acumula puntos Volta en tractopartes', '/cashback', 'dollar-sign', 100);

INSERT INTO promotions (type, eyebrow, title, subtitle, link, image, sort_order)
VALUES ('image', '', '', '', '/search?q=aceites&ai=true', 'https://minio.api.codevbox.com/api/v1/buckets/codevbox/objects/download?preview=true&prefix=promo.png&version_id=null', 90);

INSERT INTO promotions (type, eyebrow, title, subtitle, link, image, sort_order)
VALUES ('image', '', '', '', '/product/4e29ba29-11d4-48d8-b818-76e70c2f6777', 'https://minio.api.codevbox.com/api/v1/buckets/codevbox/objects/download?preview=true&prefix=promo2.png&version_id=null', 95);

INSERT INTO promotions (type, eyebrow, title, subtitle, link, image, sort_order)
VALUES ('image', '', '', '', '/product/4283990b-4d22-48b1-abcf-19110fc8e9c6', 'https://minio.api.codevbox.com/api/v1/buckets/codevbox/objects/download?preview=true&prefix=promo3.png&version_id=null', 100);

-- Product slides (will use product_id to pull data dynamically)
-- These reference existing products - adjust IDs if needed
INSERT INTO promotions (type, eyebrow, title, subtitle, link, product_id, sort_order)
VALUES 
  ('product', '20% OFF', 'Kit de Inyectores 6NZ', 'Bosch · Original', '/product/4e29ba29-11d4-48d8-b818-76e70c2f6777', '4e29ba29-11d4-48d8-b818-76e70c2f6777', 50),
  ('product', '30% OFF', 'Kit de Suspensión Premium', 'VoltaParts · Garantía 12 meses', '/product/28acd6a2-7ca2-4ec1-afdf-a88284fd5258', '28acd6a2-7ca2-4ec1-afdf-a88284fd5258', 40),
  ('product', '15% OFF', 'Turbo Cargador Series 60', 'Detroit Diesel · OEM', '/product/7d2432c1-35b0-4dc4-8fc7-5cef60411d7a', '7d2432c1-35b0-4dc4-8fc7-5cef60411d7a', 30);
