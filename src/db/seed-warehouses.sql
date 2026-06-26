-- Seed warehouses: 12 CEDIS de Tracto Bull Store en Guadalajara
-- Solo inserta si la tabla esta vacia

INSERT INTO warehouses (name, address, lat, lng, phone)
SELECT * FROM (VALUES
    ('CEDIS Centro', 'Av. 16 de Septiembre 123, Centro, Guadalajara, JAL 44100', 20.6597, -103.3496, '3312345678'),
    ('CEDIS Zapopan Norte', 'Blvd. López Mateos 4567, Zapopan, JAL 45110', 20.7337, -103.4067, '3323456789'),
    ('CEDIS Tlaquepaque', 'Av. Tlaquepaque 890, Tlaquepaque, JAL 45590', 20.6413, -103.3155, '3334567890'),
    ('CEDIS Tonalá', 'Av. Tonalá 1234, Tonalá, JAL 45400', 20.6233, -103.2393, '3345678901'),
    ('CEDIS Santa Fe', 'Av. Patria 567, Santa Fe, Zapopan, JAL 45110', 20.7118, -103.3978, '3356789012'),
    ('CEDIS Providencia', 'Av. Vallarta 2345, Providencia, Guadalajara, JAL 44630', 20.6769, -103.3918, '3367890123'),
    ('CEDIS Chapalita', 'Av. Patria 1890, Chapalita, Zapopan, JAL 45110', 20.7068, -103.3926, '3378901234'),
    ('CEDIS Pericos', 'Av. Independencia 3456, Pericos, Guadalajara, JAL 45230', 20.6830, -103.3528, '3389012345'),
    ('CEDIS San Juan de Ocotán', 'Av. Ocotán 678, San Juan de Ocotán, Zapopan, JAL 45010', 20.7655, -103.4420, '3390123456'),
    ('CEDIS El Salto', 'Av. El Salto 901, El Salto, JAL 45600', 20.5233, -103.2653, '3301234567'),
    ('CEDIS Tlajomulco', 'Av. Tlajomulco 1234, Tlajomulco de Zúñiga, JAL 45650', 20.4710, -103.4450, '3314567890'),
    ('CEDIS Tesistán', 'Av. Tesistán 2567, Tesistán, Zapopan, JAL 45221', 20.7850, -103.4380, '3325678901')
) AS v(name, address, lat, lng, phone)
WHERE NOT EXISTS (SELECT 1 FROM warehouses LIMIT 1);
