# Las Santiagueñas · Tienda de Desayunos

Catálogo público con pedidos por WhatsApp + panel de administración. Stack: HTML/CSS/JS vanilla, Supabase (base de datos y storage), Vercel (deploy).

---

## Requisitos

- Cuenta en [Supabase](https://supabase.com) (plan free alcanza)
- Cuenta en [Vercel](https://vercel.com) (plan free alcanza)
- Node.js (solo para el script de build local, opcional)

---

## Setup de base de datos

1. Creá un proyecto nuevo en Supabase
2. Copiá tu **Project URL** y tu **anon key** (Settings → API)
3. Abrí el archivo `supabase-setup.sql` y ejecutalo en Supabase Dashboard → SQL Editor → New query → Run

El script crea todas las tablas, políticas RLS, el bucket de imágenes y los datos de ejemplo. Es idempotente: se puede volver a ejecutar sin errores.

---

## Credenciales en el código

Las claves de Supabase están hardcodeadas en dos archivos. Actualizalas antes de hacer deploy:

**`main.js`** (líneas 1–2) y **`admin.js`** (líneas 1–2):
```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_KEY = 'TU-ANON-KEY';
```

> Para mayor seguridad en el futuro, estas constantes pueden moverse a variables de entorno inyectadas en build.

---

## Deploy en Vercel

1. Conectá el repositorio desde el dashboard de Vercel
2. El `vercel.json` ya tiene la configuración de headers de caché y seguridad
3. El build command es `node build.js` (solo actualiza la versión del Service Worker)
4. Output directory: `.` (raíz del proyecto)

No se requieren variables de entorno en Vercel mientras las claves estén hardcodeadas en el JS.

---

## Acceso al panel admin

La URL del panel **no está linkeada públicamente** en el sitio. Accedé directamente:

```
https://TU-DOMINIO.vercel.app/admin.html
```

El primer admin se crea desde Supabase Dashboard → Authentication → Users → Invite user. Los admins adicionales se crean desde el propio panel en ⚙️ Configuración.

---

## Estructura de archivos

```
├── index.html        # Catálogo público
├── admin.html        # Panel de administración
├── main.js           # Lógica del catálogo (filtros, WA, analytics)
├── admin.js          # Lógica del admin (CRUD, stats, config)
├── shared.js         # Función escHTML compartida
├── style.css         # Estilos del catálogo público
├── sw.js             # Service Worker (PWA, Network-First)
├── build.js          # Bump de versión del SW
├── vercel.json       # Headers de caché y seguridad
├── supabase-setup.sql # Setup completo de DB (idempotente)
└── images/           # Imágenes locales de productos
```

---

## Tabla `configuracion`

Almacena opciones editables desde el panel sin tocar código:

| seccion | descripción |
|---------|-------------|
| `categoria` | Opciones del selector Categoría (ej: Adulto, Infantil) |
| `tipo_producto` | Opciones del selector Tipo y filtros del catálogo |
| `etiqueta` | Opciones del selector Etiqueta |
| `mensaje_wa` | Plantilla del mensaje de WhatsApp al pedir |
| `telefono` | Número de contacto (código de país incluido, ej: +542995326695) |
| `horario` | Horario de atención en formato Schema.org (ej: Mo-Su 08:00-20:00) |

---

## Tabla `audit_log`

Registro inmutable de acciones críticas del admin. RLS: solo `authenticated` puede insertar y leer; nadie puede modificar ni borrar filas existentes.

| accion | cuándo se registra |
|--------|--------------------|
| `crear_producto` | Al guardar un producto nuevo desde el modal |
| `editar_producto` | Al guardar cambios sobre un producto existente |
| `borrar_producto` | Al confirmar la eliminación de un producto (incluye snapshot) |
| `borrar_testimonio` | Al eliminar un testimonio (incluye snapshot) |

Consultarla desde Supabase Dashboard → Table Editor → `audit_log`.

---

## Columna `narrativa` en productos

Campo de texto opcional que aparece en itálica rosa en la tarjeta del catálogo, encima de la descripción técnica de ingredientes. Sirve para agregar una frase emocional orientada a ventas de regalo.

Ejemplo: *"Despertá a tu mamá con un desayuno lleno de amor"*

Se edita desde el panel admin en el formulario de cada producto.

---

## Seguridad

- **Auth splash:** `admin.html` muestra pantalla de carga mientras verifica la sesión — el dashboard nunca es visible sin login.
- **Rate limit de login:** 5 intentos fallidos bloquean el formulario 15 minutos (localStorage).
- **Headers HTTP:** CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` en `vercel.json`.
- **Link al admin:** no aparece en ninguna página pública. Acceso solo por URL directa.
