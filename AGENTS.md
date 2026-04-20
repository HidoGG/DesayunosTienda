# Protocolo Operativo — DesayunosTienda (v1.0)

Objetivo: Asegurar que cada cambio en la web mejore la conversión de ventas y mantenga el panel de administración (`admin.html`) seguro y funcional.

---

## 1. Estructura de Roles

| Rol | Responsabilidad principal |
|-----|--------------------------|
| **UX Planner** | Claridad y conversión. Define si el cambio facilita que el cliente compre. Asegura textos cálidos y profesionales. |
| **Dev Executor** | Implementa cambios en `main.js`, `style.css`, `admin.js` o `admin.html`. Mantiene velocidad de carga y compatibilidad móvil. |
| **Security & Data Reviewer** | Verifica acceso seguro a `admin.html` y que `supabase-setup.sql` no pierda pedidos existentes al modificarse. |

---

## 2. Skills Mandatorios

- **UX/UI Conversacional:** Mensajes cálidos y profesionales. Horarios legibles (mapeo `Mo-Su` → `Lunes-Domingo` invisible para el usuario, visible para Google).
- **Supabase/SQL Integrity:** Antes de cada migración, validar que no haya pérdida de pedidos o productos existentes.
- **Mobile First:** Todo cambio visual se valida primero en ≤ 390px. La mayoría de pedidos llegan por celular.

---

## 3. Invariantes del Proyecto (Reglas de Oro)

1. **Privacidad de Admin:** El link a `admin.html` NUNCA aparece en `index.html` ni en el footer público. Acceso solo por URL directa.
2. **Formato de Datos:** Metadatos técnicos (días `Mo-Su`, schema.org) se mantienen en inglés para SEO; la UI los muestra siempre en español.
3. **Simplicidad:** No agregar librerías externas pesadas. El proyecto debe cargar instantáneamente en redes 4G/5G.

---

## 4. Handoff Estructurado

Al cerrar cada tarea, entregar:

```json
{
  "task_id": "DT-XXXX",
  "component": "admin | tienda | database",
  "ux_impact": "Cómo mejora la experiencia del cliente",
  "files_updated": ["archivo1", "archivo2"],
  "security_check": "Validación de acceso a admin verificada",
  "next_step": "Próxima acción recomendada"
}
```

---

## 5. Checklist de Seguridad (admin.html)

- [ ] El endpoint de Supabase usado en el admin requiere rol `authenticated` (no `anon`).
- [ ] Las claves de service role NUNCA se exponen en el frontend.
- [ ] Las rutas de admin no están linkeadas desde ninguna página pública.
- [ ] Las operaciones destructivas (DELETE de productos/pedidos) tienen confirmación explícita en la UI.

---

*Última revisión: 20 de abril 2026*
