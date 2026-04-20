# Roadmap técnico — Las Santiagueñas

Este archivo reúne mejoras técnicas identificadas pero no urgentes.
Revisarlo cuando el proyecto escale, entre nuevos colaboradores, o antes de una campaña grande.

---

## ✅ Ya resuelto

| Mejora | Fecha |
|--------|-------|
| `og:url`, `og:image`, `og:image:width/height`, `theme-color` en `<head>` | abril 2026 |
| Nav móvil: el header ya no desaparece en ≤768px, muestra iconos de Instagram y WhatsApp | abril 2026 |
| XSS en tarjetas dinámicas: `escHTML()` + `data-*` + listener delegado | abril 2026 |
| Header centrado con grid `1fr auto 1fr`, backdrop-filter blur | abril 2026 |
| Tarjetas en columna en ≤600px (imagen arriba, descripción completa) | abril 2026 |
| Botón WhatsApp con `min-height: 44px` en todos los breakpoints | abril 2026 |

> **Pendiente de og:image:** cuando exista un `og-preview.jpg` dedicado (1200×630 real),
> actualizar la URL en el `<head>` y alinear los metadatos de dimensiones.

---

## 1. Una sola fuente de verdad para el catálogo

**Problema:** `index.html` tiene 10 tarjetas con precios y descripciones hardcodeadas.
`main.js` las reemplaza cuando Supabase responde. Si un precio cambia en la DB pero no en el HTML,
una clienta sin buena señal puede ver el precio viejo.

**Cuándo atacarlo:** Antes de la primera vez que cambies un precio en producción.

**Cómo resolverlo (opción simple):**
Reemplazar las tarjetas estáticas por 3 skeletons anónimos.
En el fallback de main.js, mostrar un mensaje directo con link a WhatsApp en lugar del catálogo estático.
Así hay una sola fuente de verdad: Supabase.

---

## ~~2. XSS en tarjetas dinámicas~~ ✅ Resuelto (abril 2026)

~~`cardHTML()` interpolaba campos de la DB directo al HTML.~~
Se agregó `escHTML()`, se escapan todos los campos, y el `onclick` fue reemplazado
por `data-nombre` / `data-id` + listener delegado en `document`.

---

## 3. Política de eventos abierta (analytics)

**Problema:** La tabla `eventos` permite INSERT a cualquier anónimo sin límite.
Con tráfico alto o un bot, puede llenarse de filas basura y encarecer el plan de Supabase.

**Cuándo atacarlo:** Cuando superes ~500 visitas/día o notes crecimiento anormal en la tabla.

**Cómo resolverlo:**
- Edge Function con rate limit por IP (Supabase tiene soporte nativo).
- O: throttle en el cliente (ya hay cierto control en el debounce de búsqueda).
- O: muestreo — trackear 1 de cada 5 page_views en vez de todos.

---

## 4. Campo `orden` en el panel admin

**Problema:** La DB tiene columna `orden` para ordenar los productos,
pero el formulario del admin no expone ese campo. Los productos nuevos
quedan con `orden = 0` y su posición en el catálogo es impredecible.

**Cuándo atacarlo:** Cuando agregues un producto nuevo y quieras controlar su posición.

**Cómo resolverlo:**
Agregar un input numérico `orden` en el formulario de admin, o botones "subir / bajar"
en la lista de productos que intercambien los valores de orden de dos filas.

---

## 5. Variables de entorno / configuración centralizada

**Problema:** `SUPABASE_URL` y `SUPABASE_KEY` están hardcodeadas en `main.js`.
La clave anon es pública por diseño (correcta para RLS), pero si cambia hay que editar el JS a mano.

**Cuándo atacarlo:** Si incorporás un proceso de build (Vite, Parcel, etc.) o un CI/CD.

**Cómo resolverlo:**
Mover a `.env` y leer con `import.meta.env.VITE_SUPABASE_URL` en un bundler.
Agregar `.env` a `.gitignore`. Documentar en README qué variables son necesarias.

---

## 6. README del proyecto

**Problema:** No hay documentación de cómo levantar el proyecto localmente,
qué SQL correr, ni qué variables configurar. Si alguien nuevo toca el código,
tarda horas en entender el setup.

**Cuándo atacarlo:** Antes de incorporar un colaborador o diseñador.

**Contenido mínimo:**
- Estructura de archivos
- Cómo ejecutar `supabase-setup.sql`
- Variables necesarias (URL + anon key)
- Cómo deployar en Vercel

---

## 7. Accesibilidad básica

**Problema:** El carrusel de testimonios no es navegable con teclado.
Los botones de filtro y el carrusel no tienen foco visible adecuado.

**Cuándo atacarlo:** Si el negocio apunta a un público más amplio o requiere cumplir WCAG.

**Qué hacer:**
- Agregar `tabindex` y manejo de flechas del teclado en el carrusel.
- Asegurar que todos los botones interactivos tengan `:focus-visible` con buen contraste.
- Revisar ratio de contraste del texto sobre el fondo crema (especialmente `--text-muted`).

---

---

## 8. Mejoras de Seguridad en Panel Admin

**Contexto:** El panel `admin.html` es el punto más sensible del proyecto. Cualquier brecha expone precios, pedidos y datos de clientes.

**Estado actual:** Acceso por URL directa sin autenticación a nivel de ruta; la seguridad recae en Supabase RLS.

**Mejoras recomendadas (por prioridad):**

### 8a. Confirmación de sesión al cargar admin.html
Verificar que `supabase.auth.getSession()` retorne una sesión válida antes de renderizar cualquier contenido. Redirigir a login si no hay sesión activa.

### 8b. Rate limit en operaciones de escritura del admin
Agregar control de intentos fallidos de login (máx. 5 intentos / 15 min) para prevenir fuerza bruta.

### 8c. Auditoría de acciones críticas
Registrar en una tabla `audit_log` (solo INSERT, nunca DELETE/UPDATE) las acciones: crear producto, eliminar producto, cambiar precio. Columnas: `accion`, `usuario_id`, `datos_previos`, `created_at`.

### 8d. Headers de seguridad en Vercel
Agregar en `vercel.json`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`

**Cuándo atacarlo:** Antes de dar acceso a otro colaborador o de escalar el volumen de pedidos.

---

*Última revisión: 20 de abril 2026*
