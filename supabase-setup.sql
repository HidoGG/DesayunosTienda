-- ================================================================
-- Las Santiagueñas · Setup completo de base de datos
-- Idempotente: se puede volver a ejecutar sin errores
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ================================================================

-- 1. TABLA PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  precio      text NOT NULL DEFAULT '$75.000',
  tema        text NOT NULL DEFAULT 'Cumpleaños adulto',
  tipo        text NOT NULL DEFAULT 'Desayunos',
  tag         text DEFAULT '🎁 Estándar',
  imagen_url  text,
  activo      boolean DEFAULT true,
  orden       integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Migraciones para DBs existentes
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo      text NOT NULL DEFAULT 'Desayunos';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS narrativa text;

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

ALTER TABLE testimonios ADD COLUMN IF NOT EXISTS foto_url text;

-- 3. TABLA CONFIGURACION
-- Almacena: opciones de dropdowns (categoria, tipo_producto, etiqueta),
-- plantilla de mensaje WA, teléfono y horario para JSON-LD dinámico.
CREATE TABLE IF NOT EXISTS configuracion (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  seccion    text NOT NULL,
  valor      text NOT NULL,
  orden      integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Índice único: garantiza una sola fila por (seccion, valor); protege maybeSingle() y ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS configuracion_seccion_valor_idx ON configuracion (seccion, valor);

-- 4. TABLA EVENTOS (analytics)
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

-- 5. TABLA AUDIT LOG
-- Registro inmutable de acciones críticas del admin.
-- Solo INSERT permitido (nunca UPDATE/DELETE): es el historial de cambios.
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  accion      text NOT NULL,             -- 'crear_producto' | 'editar_producto' | 'borrar_producto' | 'borrar_testimonio'
  entidad_id  uuid,                      -- id del producto/testimonio afectado
  datos       jsonb,                     -- snapshot del payload antes/después
  usuario_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- 6. ROW LEVEL SECURITY
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log    ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS (DROP IF EXISTS para idempotencia)

-- Productos: público lee activos; admin lee todo y modifica
DROP POLICY IF EXISTS "prod_anon_read"   ON productos;
DROP POLICY IF EXISTS "prod_auth_read"   ON productos;
DROP POLICY IF EXISTS "prod_auth_insert" ON productos;
DROP POLICY IF EXISTS "prod_auth_update" ON productos;
DROP POLICY IF EXISTS "prod_auth_delete" ON productos;
CREATE POLICY "prod_anon_read"   ON productos FOR SELECT TO anon         USING (activo = true);
CREATE POLICY "prod_auth_read"   ON productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_auth_insert" ON productos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prod_auth_update" ON productos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prod_auth_delete" ON productos FOR DELETE TO authenticated USING (true);

-- Testimonios: mismo esquema
DROP POLICY IF EXISTS "test_anon_read"   ON testimonios;
DROP POLICY IF EXISTS "test_auth_read"   ON testimonios;
DROP POLICY IF EXISTS "test_auth_insert" ON testimonios;
DROP POLICY IF EXISTS "test_auth_update" ON testimonios;
DROP POLICY IF EXISTS "test_auth_delete" ON testimonios;
CREATE POLICY "test_anon_read"   ON testimonios FOR SELECT TO anon         USING (activo = true);
CREATE POLICY "test_auth_read"   ON testimonios FOR SELECT TO authenticated USING (true);
CREATE POLICY "test_auth_insert" ON testimonios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "test_auth_update" ON testimonios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "test_auth_delete" ON testimonios FOR DELETE TO authenticated USING (true);

-- Configuracion: lectura pública (necesaria para filtros y mensaje WA en el catálogo);
-- escritura solo admin
DROP POLICY IF EXISTS "cfg_anon_read" ON configuracion;
DROP POLICY IF EXISTS "cfg_auth_all"  ON configuracion;
CREATE POLICY "cfg_anon_read" ON configuracion FOR SELECT TO anon         USING (true);
CREATE POLICY "cfg_auth_all"  ON configuracion FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- Audit log: solo admin puede insertar y leer; nadie puede modificar ni borrar
DROP POLICY IF EXISTS "audit_auth_insert" ON audit_log;
DROP POLICY IF EXISTS "audit_auth_read"   ON audit_log;
CREATE POLICY "audit_auth_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_auth_read"   ON audit_log FOR SELECT TO authenticated USING (true);

-- Eventos: cualquiera puede insertar (tracking anónimo); solo admin lee
-- ADVERTENCIA: INSERT sin límite permite spam. Mitigar con throttle en el cliente (main.js)
-- o con una Supabase Edge Function de rate limit por IP cuando superes ~500 visitas/día.
DROP POLICY IF EXISTS "ev_anon_insert" ON eventos;
DROP POLICY IF EXISTS "ev_auth_read"   ON eventos;
CREATE POLICY "ev_anon_insert" ON eventos FOR INSERT WITH CHECK (true);
CREATE POLICY "ev_auth_read"   ON eventos FOR SELECT TO authenticated USING (true);

-- 7. STORAGE BUCKET (fotos de desayunos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('desayunos', 'desayunos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_delete" ON storage.objects;
CREATE POLICY "storage_public_read" ON storage.objects FOR SELECT                USING (bucket_id = 'desayunos');
CREATE POLICY "storage_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'desayunos');
CREATE POLICY "storage_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'desayunos') WITH CHECK (bucket_id = 'desayunos');
CREATE POLICY "storage_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'desayunos');

-- 8. SEEDS — PRODUCTOS INICIALES
-- Solo inserta si la tabla está vacía (setup nuevo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM productos LIMIT 1) THEN
    INSERT INTO productos (nombre, descripcion, precio, tema, tipo, tag, imagen_url, orden) VALUES
    (
      'Desayuno Stitch Azul',
      'Bandeja fibrofácil · taza · medialunas · cookies de vainilla · sandwich jamón y queso · yogurt con cereal · frutillas · jugo en botella · infusiones · stickers y decoración temática Stitch · arreglo con globos azules, lila y rosa · tarjeta personalizada',
      '$75.000', 'Cumpleaños infantil', 'Desayunos', '🎁 Estándar', 'images/desayuno-stitch-azul-infantil-neuquen.jpg', 1
    ),
    (
      'Stitch con Globo Gigante',
      'Bandeja fibrofácil · chocolatada · snacks · vaso decorado · globo gigante Stitch helio · arreglo con globos azules y cromados · tarjeta dedicatoria',
      '$85.000', 'Cumpleaños infantil', 'Desayunos', '✨ Con mini torta', 'images/desayuno-stitch-globo-gigante-cumpleanos.jpg', 2
    ),
    (
      'Desayuno Negro & Dorado',
      'Bandeja fibrofácil · sándwich de jamón y queso · frutillas · jugo de naranja · palta y huevo · tostadas y queso crema · infusiones · taza · arreglo con globos negro, blanco y dorado + globo burbuja con estrellas · fotos y tarjeta',
      '$75.000', 'Cumpleaños adulto', 'Desayunos', '🎁 Estándar', 'images/desayuno-negro-dorado-adulto-neuquen.jpg', 3
    ),
    (
      'Desayuno Temático Niña',
      'Bandeja fibrofácil · chocolatada · yogurt con cereal · snacks y golosinas · vasito con globo · decoración temática · arreglo con globos lila, rosa y plateado · globo número · tarjeta dedicatoria',
      '$75.000', 'Cumpleaños infantil', 'Desayunos', '🎁 Estándar', 'images/desayuno-tematico-nina-infantil-plottier.jpg', 4
    ),
    (
      'Desayuno Stitch Rosa',
      'Bandeja fibrofácil personalizada · tostadas · scone de queso · frutillas con kiwi · yogurt granola · raspaditas corazón · sandwich jamón y queso · vasito Stitch · globo foil Stitch & Angel · arreglo con globos violeta, azul y salmón · tarjeta',
      '$75.000', 'Cumpleaños infantil', 'Desayunos', '🎁 Estándar', 'images/desayuno-stitch-rosa-infantil-neuquen.jpg', 5
    ),
    (
      'Desayuno Violeta & Dorado',
      'Bandeja fibrofácil · sándwich · taza · infusiones · jugo de naranja · bombones · cupcake · frutillas · sandwich primavera · arreglo con globos violeta, rosa y dorado + globo burbuja con mariposas · fotos y tarjeta',
      '$75.000', 'Cumpleaños adulto', 'Desayunos', '🎁 Estándar', 'images/desayuno-violeta-dorado-adulto-neuquen.jpg', 6
    ),
    (
      'Desayuno Stitch Premium',
      'Bandeja fibrofácil personalizada · mini torta decorada · vasito con sprinkles · gomitas · jugo · tarjetón con dedicatoria · stickers Stitch · yogurt · arreglo con globos rosa, dorado y cromado · globo burbuja',
      '$85.000', 'Cumpleaños infantil', 'Desayunos', '✨ Con mini torta', 'images/desayuno-stitch-premium-infantil-neuquen.jpg', 7
    ),
    (
      'Desayuno Boca Juniors',
      'Bandeja fibrofácil · sándwich de jamón y queso · mini torta blanca · chipa · taza · infusiones · jugo de naranja · cartelería Boca Juniors · arreglo globos azul y dorado · fotos y tarjeta',
      '$75.000', 'Cumpleaños adulto', 'Desayunos', '🎁 Estándar', 'images/desayuno-boca-juniors-adulto-plottier.jpg', 8
    ),
    (
      'Desayuno Día de Mamá',
      'Bandeja fibrofácil · taza · sándwich primavera · yogurt con granola · frutas de estación · barrita de cereal · cookies · frutos secos · infusiones · arreglo floral especial · tarjeta dedicatoria',
      '$75.000', 'Cumpleaños adulto', 'Desayunos', '🎁 Estándar', 'images/desayuno-dia-mama-neuquen-plottier.jpg', 9
    ),
    (
      'Cumple Rosa & Dorado',
      'Bandeja fibrofácil · taza · mini torta rosa · medialunas · yogurt con fruta y granola · galletitas cookies · muffin · jugo de naranja · infusiones · frutillas · arreglo con globos rosa y dorado · tarjeta',
      '$85.000', 'Cumpleaños adulto', 'Desayunos', '✨ Con mini torta', 'images/desayuno-cumple-rosa-dorado-adulto.jpg', 10
    );
  END IF;
END
$$;

-- 9. SEEDS — TESTIMONIOS INICIALES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM testimonios LIMIT 1) THEN
    INSERT INTO testimonios (nombre, ciudad, texto) VALUES
    ('Valentina M.', 'Plottier', 'Me sorprendió la calidad de todo. El desayuno llegó impecable, perfectamente decorado y la comida riquísima. ¡Mi mamá lloró de la emoción!'),
    ('Romina G.',    'Neuquén',  'Pedí el Stitch para el cumple de mi hija y fue un éxito total. Respondieron rápido, coordinaron todo por WhatsApp y llegó a tiempo. ¡Gracias!'),
    ('Sofía R.',     'Plottier', 'Hermoso todo. La presentación, el arreglo de globos, la comida. Ya pedí tres veces y siempre queda perfecto. Son las mejores del Neuquén.');
  END IF;
END
$$;

-- 10. SEEDS — CONFIGURACION
-- Usa WHERE NOT EXISTS por sección/valor para ser seguro en re-ejecuciones

-- Categorías de producto (se guardan en productos.tema)
INSERT INTO configuracion (seccion, valor, orden)
SELECT v.seccion, v.valor, v.orden
FROM (VALUES
  ('categoria', 'Cumpleaños adulto',   1),
  ('categoria', 'Cumpleaños infantil', 2)
) AS v(seccion, valor, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM configuracion c WHERE c.seccion = v.seccion AND c.valor = v.valor
);

-- Tipos de producto (generan los filtros del catálogo; se guardan en productos.tipo)
INSERT INTO configuracion (seccion, valor, orden)
SELECT v.seccion, v.valor, v.orden
FROM (VALUES
  ('tipo_producto', 'Desayunos',       1),
  ('tipo_producto', 'Box de regalo',   2),
  ('tipo_producto', 'Brunch grupales', 3)
) AS v(seccion, valor, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM configuracion c WHERE c.seccion = v.seccion AND c.valor = v.valor
);

-- Etiquetas
INSERT INTO configuracion (seccion, valor, orden)
SELECT v.seccion, v.valor, v.orden
FROM (VALUES
  ('etiqueta', '🎁 Estándar',      1),
  ('etiqueta', '✨ Con mini torta', 2)
) AS v(seccion, valor, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM configuracion c WHERE c.seccion = v.seccion AND c.valor = v.valor
);

-- Plantilla de mensaje WhatsApp (una sola por cuenta)
INSERT INTO configuracion (seccion, valor, orden)
SELECT 'mensaje_wa',
  '¡Hola! Quiero realizar un pedido 🎀' || E'\n\n' ||
  'Producto: {nombre}' || E'\n' ||
  'Precio: {precio}' || E'\n' ||
  'Tipo: {tipo}' || E'\n' ||
  'Categoría: {categoria}' || E'\n\n' ||
  'Imagen del producto: {imagen}',
  0
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE seccion = 'mensaje_wa');

-- Teléfono de contacto (usado en JSON-LD dinámico)
INSERT INTO configuracion (seccion, valor, orden)
SELECT 'telefono', '+542995326695', 0
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE seccion = 'telefono');

-- Horario de atención (formato Schema.org, usado en JSON-LD dinámico)
INSERT INTO configuracion (seccion, valor, orden)
SELECT 'horario', 'Mo-Su 08:00-20:00', 0
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE seccion = 'horario');
