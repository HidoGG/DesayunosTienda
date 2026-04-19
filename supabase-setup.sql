-- ================================================================
-- Las Santiagueñas · Setup completo de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ================================================================

-- 1. TABLA PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  precio      text NOT NULL DEFAULT '$75.000',
  tema        text NOT NULL DEFAULT 'Cumpleaños adulto',
  tag         text DEFAULT '🎁 Estándar',
  imagen_url  text,
  activo      boolean DEFAULT true,
  orden       integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- 2. TABLA TESTIMONIOS
CREATE TABLE IF NOT EXISTS testimonios (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text NOT NULL,
  ciudad     text,
  texto      text NOT NULL,
  foto_url   text,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Migración: agregar foto_url si la tabla ya existe
ALTER TABLE testimonios ADD COLUMN IF NOT EXISTS foto_url text;

-- 3. TABLA EVENTOS (analytics)
CREATE TABLE IF NOT EXISTS eventos (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo             text NOT NULL,
  producto_id      uuid REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre  text,
  dispositivo      text,
  hora_dia         integer,
  termino_busqueda text,
  created_at       timestamptz DEFAULT now()
);

-- 4. ROW LEVEL SECURITY
ALTER TABLE productos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonios ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos     ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACCESO

-- Productos: público lee activos; admin lee todo y modifica
CREATE POLICY "prod_anon_read"   ON productos FOR SELECT TO anon         USING (activo = true);
CREATE POLICY "prod_auth_read"   ON productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_auth_insert" ON productos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prod_auth_update" ON productos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prod_auth_delete" ON productos FOR DELETE TO authenticated USING (true);

-- Testimonios: mismo esquema
CREATE POLICY "test_anon_read"   ON testimonios FOR SELECT TO anon         USING (activo = true);
CREATE POLICY "test_auth_read"   ON testimonios FOR SELECT TO authenticated USING (true);
CREATE POLICY "test_auth_insert" ON testimonios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "test_auth_update" ON testimonios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "test_auth_delete" ON testimonios FOR DELETE TO authenticated USING (true);

-- Eventos: cualquiera puede insertar (tracking); solo admin lee
CREATE POLICY "ev_anon_insert" ON eventos FOR INSERT WITH CHECK (true);
CREATE POLICY "ev_auth_read"   ON eventos FOR SELECT TO authenticated USING (true);

-- 6. STORAGE BUCKET (fotos de desayunos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('desayunos', 'desayunos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "storage_public_read"   ON storage.objects FOR SELECT                USING (bucket_id = 'desayunos');
CREATE POLICY "storage_auth_insert"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'desayunos');
CREATE POLICY "storage_auth_update"   ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'desayunos') WITH CHECK (bucket_id = 'desayunos');
CREATE POLICY "storage_auth_delete"   ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'desayunos');

-- 7. PRODUCTOS INICIALES
INSERT INTO productos (nombre, descripcion, precio, tema, tag, imagen_url, orden) VALUES
(
  'Desayuno Stitch Azul',
  'Bandeja fibrofácil · taza · medialunas · cookies de vainilla · sandwich jamón y queso · yogurt con cereal · frutillas · jugo en botella · infusiones · stickers y decoración temática Stitch · arreglo con globos azules, lila y rosa · tarjeta personalizada',
  '$75.000', 'Cumpleaños infantil', '🎁 Estándar', 'images/c2.jpg', 1
),
(
  'Stitch con Globo Gigante',
  'Bandeja fibrofácil · chocolatada · snacks · vaso decorado · globo gigante Stitch helio · arreglo con globos azules y cromados · tarjeta dedicatoria',
  '$85.000', 'Cumpleaños infantil', '✨ Con mini torta', 'images/c3.jpg', 2
),
(
  'Desayuno Negro & Dorado',
  'Bandeja fibrofácil · sándwich de jamón y queso · frutillas · jugo de naranja · palta y huevo · tostadas y queso crema · infusiones · taza · arreglo con globos negro, blanco y dorado + globo burbuja con estrellas · fotos y tarjeta',
  '$75.000', 'Cumpleaños adulto', '🎁 Estándar', 'images/c4.jpg', 3
),
(
  'Desayuno Temático Niña',
  'Bandeja fibrofácil · chocolatada · yogurt con cereal · snacks y golosinas · vasito con globo · decoración temática · arreglo con globos lila, rosa y plateado · globo número · tarjeta dedicatoria',
  '$75.000', 'Cumpleaños infantil', '🎁 Estándar', 'images/c5.jpg', 4
),
(
  'Desayuno Stitch Rosa',
  'Bandeja fibrofácil personalizada · tostadas · scone de queso · frutillas con kiwi · yogurt granola · raspaditas corazón · sandwich jamón y queso · vasito Stitch · globo foil Stitch & Angel · arreglo con globos violeta, azul y salmón · tarjeta',
  '$75.000', 'Cumpleaños infantil', '🎁 Estándar', 'images/c8.jpg', 5
),
(
  'Desayuno Violeta & Dorado',
  'Bandeja fibrofácil · sándwich · taza · infusiones · jugo de naranja · bombones · cupcake · frutillas · sandwich primavera · arreglo con globos violeta, rosa y dorado + globo burbuja con mariposas · fotos y tarjeta',
  '$75.000', 'Cumpleaños adulto', '🎁 Estándar', 'images/c11.jpg', 6
),
(
  'Desayuno Stitch Premium',
  'Bandeja fibrofácil personalizada · mini torta decorada · vasito con sprinkles · gomitas · jugo · tarjetón con dedicatoria · stickers Stitch · yogurt · arreglo con globos rosa, dorado y cromado · globo burbuja',
  '$85.000', 'Cumpleaños infantil', '✨ Con mini torta', 'images/c12.jpg', 7
),
(
  'Desayuno Boca Juniors',
  'Bandeja fibrofácil · sándwich de jamón y queso · mini torta blanca · chipa · taza · infusiones · jugo de naranja · cartelería Boca Juniors · arreglo globos azul y dorado · fotos y tarjeta',
  '$75.000', 'Cumpleaños adulto', '🎁 Estándar', 'images/c13.jpg', 8
),
(
  'Desayuno Día de Mamá',
  'Bandeja fibrofácil · taza · sándwich primavera · yogurt con granola · frutas de estación · barrita de cereal · cookies · frutos secos · infusiones · arreglo floral especial · tarjeta dedicatoria',
  '$75.000', 'Cumpleaños adulto', '🎁 Estándar', 'images/c19.jpg', 9
),
(
  'Cumple Rosa & Dorado',
  'Bandeja fibrofácil · taza · mini torta rosa · medialunas · yogurt con fruta y granola · galletitas cookies · muffin · jugo de naranja · infusiones · frutillas · arreglo con globos rosa y dorado · tarjeta',
  '$85.000', 'Cumpleaños adulto', '✨ Con mini torta', 'images/c20.jpg', 10
);

-- 8. TESTIMONIOS INICIALES
INSERT INTO testimonios (nombre, ciudad, texto) VALUES
('Valentina M.', 'Plottier', 'Me sorprendió la calidad de todo. El desayuno llegó impecable, perfectamente decorado y la comida riquísima. ¡Mi mamá lloró de la emoción!'),
('Romina G.', 'Neuquén', 'Pedí el Stitch para el cumple de mi hija y fue un éxito total. Respondieron rápido, coordinaron todo por WhatsApp y llegó a tiempo. ¡Gracias!'),
('Sofía R.', 'Plottier', 'Hermoso todo. La presentación, el arreglo de globos, la comida. Ya pedí tres veces y siempre queda perfecto. Son las mejores del Neuquén.');
