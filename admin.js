const SUPABASE_URL = 'https://nhwcgfmgzhfxwifsqptb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2NnZm1nemhmeHdpZnNxcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDcwNjYsImV4cCI6MjA5MjEyMzA2Nn0.V0AKSJCti68Z_AzEnk0MsOJJVW6IXlAHOYN-f0ciqKc';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const MAX_IMG_MB   = 15;
const MAX_NOMBRE   = 120;
const PAGE_SIZE    = 20;

let currentTab    = 'productos';
let pgProductos   = 0;
let pgTestimonios = 0;
let _loggingOut   = false;
let currentImgUrl  = null;
let currentFotoUrl = null;
let configOpciones = { categoria: [], tipo_producto: [], etiqueta: [] };

async function loadConfig() {
  const { data } = await db.from('configuracion').select('*').order('orden');
  configOpciones = { categoria: [], tipo_producto: [], etiqueta: [] };
  (data || []).forEach(row => {
    if (!configOpciones[row.seccion]) configOpciones[row.seccion] = [];
    configOpciones[row.seccion].push(row);
  });
}

function selectOpts(seccion, valorActual, defecto) {
  const opts = configOpciones[seccion] || [];
  if (!opts.length) return `<option selected>${escHTML(valorActual || defecto)}</option>`;
  return opts.map(o => {
    const sel = o.valor === valorActual || (!valorActual && o.valor === defecto) ? 'selected' : '';
    return `<option ${sel}>${escHTML(o.valor)}</option>`;
  }).join('');
}

// ── MODALES PERSONALIZADOS ────────────────────────────
function showConfirm({ icon = '⚠️', msg, okLabel = 'Eliminar', okClass = '', onOk }) {
  const overlay  = document.getElementById('confirm-modal');
  const msgEl    = document.getElementById('confirm-msg');
  const iconEl   = document.getElementById('confirm-icon');
  const okBtn    = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');

  iconEl.textContent  = icon;
  msgEl.textContent   = msg;
  okBtn.textContent   = okLabel;
  okBtn.className     = 'btn-confirm-ok' + (okClass ? ' ' + okClass : '');
  overlay.classList.remove('hidden');

  function cleanup() {
    overlay.classList.add('hidden');
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
    overlay.removeEventListener('click', handleOverlay);
  }
  function handleOk()      { cleanup(); onOk(); }
  function handleCancel()  { cleanup(); }
  function handleOverlay(e){ if (e.target === overlay) cleanup(); }

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  overlay.addEventListener('click', handleOverlay);
}

function showAlert(msg, icon = 'ℹ️') {
  const cancelBtn = document.getElementById('confirm-cancel');
  cancelBtn.style.display = 'none';
  showConfirm({
    icon,
    msg,
    okLabel: 'Entendido',
    okClass: 'btn-ok-neutral',
    onOk: () => { cancelBtn.style.display = ''; }
  });
  // también restaurar si se cierra por overlay click
  const overlay = document.getElementById('confirm-modal');
  const restore = () => { cancelBtn.style.display = ''; };
  overlay.addEventListener('click', restore, { once: true });
}

// ── AUTH ─────────────────────────────────────────────
async function checkAuth() {
  const urlHash    = window.location.hash;
  const urlSearch  = window.location.search;
  const isRecovery = urlHash.includes('type=recovery') || urlSearch.includes('type=recovery');

  // Listener único para todos los cambios de estado de auth
  db.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      showLogin();
      showPanel('recovery');
      return;
    }
    // SIGNED_OUT inesperado = sesión vencida o revocada (no logout manual)
    if (event === 'SIGNED_OUT' && !_loggingOut) {
      showToast('Sesión vencida. Volvé a iniciar sesión.');
      showLogin();
    }
  });

  if (isRecovery) {
    showLogin();
    return;
  }

  const { data: { session } } = await db.auth.getSession();
  if (session) showDashboard();
  else showLogin();
}

// ── PANELES DE LOGIN ──────────────────────────────────
window.showPanel = (panel) => {
  ['login', 'forgot', 'recovery'].forEach(p => {
    document.getElementById(`panel-${p}`).classList.toggle('hidden', p !== panel);
  });
};

window.sendReset = async () => {
  const email  = document.getElementById('reset-email').value.trim();
  const okEl   = document.getElementById('reset-ok');
  const errEl  = document.getElementById('reset-error');
  const btn    = document.getElementById('btn-reset');
  okEl.textContent = ''; errEl.textContent = '';

  if (!email) { errEl.textContent = 'Ingresá tu email.'; return; }
  btn.textContent = 'Enviando…'; btn.disabled = true;

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://las-santiaguenas.vercel.app/admin.html'
  });

  btn.textContent = 'Enviar link de recuperación'; btn.disabled = false;
  if (error) { errEl.textContent = 'Error: ' + error.message; }
  else        { okEl.textContent = '✓ Link enviado. Revisá tu email (también spam).'; }
};

window.saveNewPassword = async () => {
  const pass    = document.getElementById('new-pass').value;
  const pass2   = document.getElementById('new-pass-confirm').value;
  const errEl   = document.getElementById('recovery-error');
  const okEl    = document.getElementById('recovery-ok');
  const btn     = document.getElementById('btn-new-pass');
  errEl.textContent = ''; okEl.textContent = '';

  if (pass.length < 8)    { errEl.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
  if (pass !== pass2)     { errEl.textContent = 'Las contraseñas no coinciden.'; return; }

  btn.textContent = 'Guardando…'; btn.disabled = true;
  const { error } = await db.auth.updateUser({ password: pass });
  btn.textContent = 'Guardar nueva contraseña'; btn.disabled = false;

  if (error) { errEl.textContent = 'Error: ' + error.message; }
  else {
    okEl.textContent = '✓ Contraseña actualizada. Iniciando sesión…';
    setTimeout(() => showDashboard(), 1500);
  }
};

async function login(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  showDashboard();
}

async function logout() {
  _loggingOut = true;
  await db.auth.signOut();
  _loggingOut = false;
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
  // Asegura que se muestre el panel de login por defecto (no forgot ni recovery)
  showPanel('login');
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadConfig().then(() => switchTab('productos'));
}

// ── TABS ──────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-content').forEach(s =>
    s.classList.toggle('hidden', s.id !== `tab-${tab}`)
  );
  if (tab === 'productos')   loadProductos();
  if (tab === 'testimonios') loadTestimonios();
  if (tab === 'stats')       loadStats();
  if (tab === 'config')      loadConfig().then(renderConfigTab);
}

// ── RENDER HELPERS ────────────────────────────────────
function productoItemHTML(p) {
  return `
    <div class="list-item ${p.activo ? '' : 'inactive'}" id="item-${p.id}">
      <img class="list-thumb" src="${escHTML(p.imagen_url || 'images/c2.jpg')}" alt="${escHTML(p.nombre)}"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2252%22 height=%2252%22><rect width=%2252%22 height=%2252%22 fill=%22%23f0e6ee%22/><text x=%2226%22 y=%2232%22 text-anchor=%22middle%22 font-size=%2220%22>🍓</text></svg>'">
      <div class="list-info">
        <div class="list-name">${escHTML(p.nombre)}</div>
        <div class="list-meta">${escHTML(p.precio)} · ${escHTML(p.tema ?? '')} · ${escHTML(p.tipo ?? 'Desayunos')} · ${escHTML(p.tag)}</div>
      </div>
      <div class="list-actions">
        <label class="toggle-wrap" title="${p.activo ? 'Visible' : 'Oculto'}">
          <input type="checkbox" class="toggle" ${p.activo ? 'checked' : ''}
                 onchange="toggleActivo('productos','${p.id}',this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon" onclick="openEdit('productos','${p.id}')" title="Editar">✏️</button>
        <button class="btn-icon btn-danger"
                data-del-type="productos" data-del-id="${p.id}" data-del-nombre="${escHTML(p.nombre)}"
                onclick="confirmDeleteFromBtn(this)" title="Eliminar">🗑️</button>
      </div>
    </div>`;
}

function testimonioItemHTML(t) {
  return `
    <div class="list-item ${t.activo ? '' : 'inactive'}">
      ${t.foto_url
        ? `<img class="list-thumb" src="${escHTML(t.foto_url)}" alt="${escHTML(t.nombre)}" style="border-radius:50%;object-fit:cover;">`
        : `<div class="list-avatar">${escHTML(t.nombre[0].toUpperCase())}</div>`}
      <div class="list-info">
        <div class="list-name">${escHTML(t.nombre)}${t.ciudad ? ' · ' + escHTML(t.ciudad) : ''}</div>
        <div class="list-meta">"${escHTML(t.texto.substring(0, 70))}${t.texto.length > 70 ? '…' : ''}"</div>
      </div>
      <div class="list-actions">
        <label class="toggle-wrap">
          <input type="checkbox" class="toggle" ${t.activo ? 'checked' : ''}
                 onchange="toggleActivo('testimonios','${t.id}',this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon" onclick="openEdit('testimonios','${t.id}')" title="Editar">✏️</button>
        <button class="btn-icon btn-danger"
                data-del-type="testimonios" data-del-id="${t.id}" data-del-nombre="${escHTML(t.nombre)}"
                onclick="confirmDeleteFromBtn(this)" title="Eliminar">🗑️</button>
      </div>
    </div>`;
}

// ── PRODUCTOS ─────────────────────────────────────────
async function loadProductos(append = false) {
  const el = document.getElementById('list-productos');
  if (!append) {
    pgProductos = 0;
    el.innerHTML = '';
  } else {
    el.querySelector('.btn-load-more')?.remove();
  }

  const { data, error, count } = await db
    .from('productos')
    .select('*', { count: 'exact' })
    .order('orden')
    .order('id')
    .range(pgProductos, pgProductos + PAGE_SIZE - 1);

  if (error) {
    if (append) {
      showToast('Error al cargar más. Intentá de nuevo.');
      el.insertAdjacentHTML('beforeend',
        `<button class="btn-load-more" onclick="loadProductos(true)">Reintentar</button>`);
    } else {
      el.innerHTML = '<p class="empty-msg">Error al cargar productos. Recargá la página.</p>';
    }
    return;
  }

  if (!append && !data?.length) {
    el.innerHTML = '<p class="empty-msg">No hay productos aún. ¡Agregá el primero!</p>';
    return;
  }

  if (data?.length) {
    el.insertAdjacentHTML('beforeend', data.map(productoItemHTML).join(''));
    pgProductos += data.length;
  }

  if (count != null && count > pgProductos) {
    el.insertAdjacentHTML('beforeend',
      `<button class="btn-load-more" onclick="loadProductos(true)">Cargar más · ${count - pgProductos} restantes</button>`);
  }
}

// ── TESTIMONIOS ───────────────────────────────────────
async function loadTestimonios(append = false) {
  const el = document.getElementById('list-testimonios');
  if (!append) {
    pgTestimonios = 0;
    el.innerHTML = '';
  } else {
    el.querySelector('.btn-load-more')?.remove();
  }

  const { data, error, count } = await db
    .from('testimonios')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(pgTestimonios, pgTestimonios + PAGE_SIZE - 1);

  if (error) {
    if (append) {
      showToast('Error al cargar más. Intentá de nuevo.');
      el.insertAdjacentHTML('beforeend',
        `<button class="btn-load-more" onclick="loadTestimonios(true)">Reintentar</button>`);
    } else {
      el.innerHTML = '<p class="empty-msg">Error al cargar testimonios. Recargá la página.</p>';
    }
    return;
  }

  if (!append && !data?.length) {
    el.innerHTML = '<p class="empty-msg">No hay testimonios aún. ¡Agregá el primero!</p>';
    return;
  }

  if (data?.length) {
    el.insertAdjacentHTML('beforeend', data.map(testimonioItemHTML).join(''));
    pgTestimonios += data.length;
  }

  if (count != null && count > pgTestimonios) {
    el.insertAdjacentHTML('beforeend',
      `<button class="btn-load-more" onclick="loadTestimonios(true)">Cargar más · ${count - pgTestimonios} restantes</button>`);
  }
}

// ── ESTADÍSTICAS ──────────────────────────────────────
async function loadStats() {
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const since7  = new Date(Date.now() -  7 * 864e5).toISOString();
  const today   = new Date().toISOString().split('T')[0];

  const { data: ev } = await db.from('eventos').select('*').gte('created_at', since30);

  if (!ev) {
    document.getElementById('stats-content').innerHTML =
      '<p class="empty-msg">No se pudieron cargar las estadísticas.</p>';
    return;
  }

  const views = ev.filter(e => e.tipo === 'page_view');
  const wa    = ev.filter(e => e.tipo === 'wa_click');

  const viewsHoy = views.filter(e => e.created_at.startsWith(today)).length;
  const views7d  = views.filter(e => e.created_at >= since7).length;
  const waHoy    = wa.filter(e => e.created_at.startsWith(today)).length;
  const wa7d     = wa.filter(e => e.created_at >= since7).length;

  // Top productos por WA clicks
  const waProd = {};
  wa.forEach(e => { if (e.producto_nombre) waProd[e.producto_nombre] = (waProd[e.producto_nombre] || 0) + 1; });
  const topProds = Object.entries(waProd).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Distribución por hora
  const horas = Array(24).fill(0);
  views.filter(e => e.created_at >= since7).forEach(e => { if (e.hora_dia != null) horas[e.hora_dia]++; });
  const maxH = Math.max(...horas, 1);

  // Dispositivos
  const mob  = views.filter(e => e.dispositivo === 'mobile').length;
  const desk = views.filter(e => e.dispositivo === 'desktop').length;
  const tot  = mob + desk || 1;

  // Top búsquedas
  const searches = ev.filter(e => e.tipo === 'search' && e.termino_busqueda);
  const terminos = {};
  searches.forEach(e => { terminos[e.termino_busqueda] = (terminos[e.termino_busqueda] || 0) + 1; });
  const topTerms = Object.entries(terminos).sort((a, b) => b[1] - a[1]).slice(0, 5);

  document.getElementById('stats-content').innerHTML = `
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-number">${viewsHoy}</div>
        <div class="stat-label">Visitas hoy</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${views7d}</div>
        <div class="stat-label">Visitas últimos 7 días</div>
      </div>
      <div class="stat-card stat-card--wa">
        <div class="stat-number">${waHoy}</div>
        <div class="stat-label">Clics WhatsApp hoy</div>
      </div>
      <div class="stat-card stat-card--wa">
        <div class="stat-number">${wa7d}</div>
        <div class="stat-label">Clics WhatsApp 7 días</div>
      </div>
    </div>

    <div class="stats-section">
      <h3>Productos más consultados <span class="period">(últimos 30 días)</span></h3>
      ${topProds.length
        ? `<div class="ranking">${topProds.map(([n, c], i) =>
            `<div class="rank-item">
               <span class="rank-num">#${i + 1}</span>
               <span class="rank-name">${escHTML(n)}</span>
               <span class="rank-count">${c} consultas</span>
             </div>`).join('')}</div>`
        : '<p class="empty-msg">Todavía no hay datos. ¡Compartí la página para empezar a recibir visitas!</p>'}
    </div>

    <div class="stats-section">
      <h3>Horario pico de visitas <span class="period">(últimos 7 días)</span></h3>
      <div class="hour-chart">
        ${horas.map((c, h) => `
          <div class="hour-bar-wrap" title="${h}:00 hs — ${c} visitas">
            <div class="hour-bar" style="height:${Math.round((c / maxH) * 100)}%"></div>
            <div class="hour-label">${h % 6 === 0 ? h + 'h' : ''}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="stats-section">
      <h3>Dispositivos <span class="period">(últimos 30 días)</span></h3>
      <div class="device-split">
        <div class="device-item">
          <div class="device-pct">${Math.round(mob / tot * 100)}%</div>
          <div class="device-bar" style="width:${Math.round(mob / tot * 100)}%"></div>
          <div class="device-label">📱 Celular</div>
        </div>
        <div class="device-item">
          <div class="device-pct">${Math.round(desk / tot * 100)}%</div>
          <div class="device-bar" style="width:${Math.round(desk / tot * 100)}%"></div>
          <div class="device-label">💻 Computadora</div>
        </div>
      </div>
    </div>

    ${topTerms.length ? `
    <div class="stats-section">
      <h3>Búsquedas más frecuentes <span class="period">(últimos 30 días)</span></h3>
      <div class="ranking">${topTerms.map(([t, c], i) =>
        `<div class="rank-item">
           <span class="rank-num">#${i + 1}</span>
           <span class="rank-name">"${escHTML(t)}"</span>
           <span class="rank-count">${c} veces</span>
         </div>`).join('')}</div>
    </div>` : ''}
  `;
}

// ── MODAL EDIT / NEW ─────────────────────────────────
window.openNew  = async (type) => {
  if (type === 'productos') {
    const { data } = await db.from('productos')
      .select('orden').order('orden', { ascending: false }).limit(1).maybeSingle();
    openModal(type, { orden: (data?.orden ?? 0) + 1 });
  } else {
    openModal(type, null);
  }
};
window.openEdit = async (type, id) => {
  const { data } = await db.from(type).select('*').eq('id', id).single();
  openModal(type, data);
};

function openModal(type, item) {
  currentImgUrl  = item?.imagen_url || null;
  currentFotoUrl = item?.foto_url   || null;

  document.getElementById('modal-title').textContent =
    type === 'productos'
      ? (item?.id ? 'Editar desayuno'   : 'Agregar desayuno')
      : (item?.id ? 'Editar testimonio' : 'Agregar testimonio');

  document.getElementById('modal-body').innerHTML =
    type === 'productos' ? formProducto(item) : formTestimonio(item);

  document.getElementById('modal-save').onclick = () => guardar(type, item?.id || null);
  document.getElementById('modal').classList.remove('hidden');
}

function formProducto(p) {
  return `
    <div class="form-field">
      <label>Foto del desayuno</label>
      <div class="img-upload-area">
        <div class="img-preview-wrap" id="preview-wrap" ${p?.imagen_url ? '' : 'style="display:none"'}>
          <img id="img-preview" src="${escHTML(p?.imagen_url || '')}" alt="Vista previa">
        </div>
        <div class="no-img-placeholder" id="no-img" ${p?.imagen_url ? 'style="display:none"' : ''}>
          <span>📷</span>Todavía no hay foto
        </div>
        <label class="btn-upload">
          ${p?.imagen_url ? '🔄 Cambiar foto' : '📷 Subir foto'}
          <input type="file" id="img-file" accept="image/*" style="display:none"
                 onchange="previewImg(this)">
        </label>
      </div>
    </div>
    <div class="form-field">
      <label>Nombre del desayuno *</label>
      <input type="text" id="f-nombre" value="${escHTML(p?.nombre || '')}" placeholder="Ej: Desayuno Stitch Azul">
    </div>
    <div class="form-field">
      <label>Descripción (ingredientes y decoración)</label>
      <textarea id="f-desc" placeholder="Bandeja fibrofácil · taza · medialunas...">${escHTML(p?.descripcion || '')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Precio *</label>
        <input type="text" id="f-precio" value="${escHTML(p?.precio || '$75.000')}" placeholder="$75.000">
      </div>
      <div class="form-field">
        <label>Etiqueta</label>
        <select id="f-tag">${selectOpts('etiqueta', p?.tag, '🎁 Estándar')}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Categoría</label>
        <select id="f-tema">${selectOpts('categoria',
          p?.tema === 'Cumpleaños adulto' ? 'Adulto' : p?.tema === 'Cumpleaños infantil' ? 'Infantil' : p?.tema,
          'Adulto')}</select>
      </div>
      <div class="form-field">
        <label>Tipo de producto</label>
        <select id="f-tipo">${selectOpts('tipo_producto', p?.tipo, 'Desayunos')}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Orden en el catálogo</label>
        <input type="number" id="f-orden" value="${p?.orden ?? ''}" min="0" placeholder="Autocompletado">
      </div>
      <div class="form-field form-check">
        <label>
          <input type="checkbox" id="f-activo" ${(!p || p.activo !== false) ? 'checked' : ''}>
          Visible en la tienda
        </label>
      </div>
    </div>`;
}

function formTestimonio(t) {
  return `
    <div class="form-row">
      <div class="form-field">
        <label>Nombre *</label>
        <input type="text" id="f-nombre" value="${escHTML(t?.nombre || '')}" placeholder="Valentina M.">
      </div>
      <div class="form-field">
        <label>Ciudad</label>
        <input type="text" id="f-ciudad" value="${escHTML(t?.ciudad || '')}" placeholder="Plottier">
      </div>
    </div>
    <div class="form-field">
      <label>Comentario *</label>
      <textarea id="f-texto" placeholder="El desayuno fue increíble...">${escHTML(t?.texto || '')}</textarea>
    </div>
    <div class="form-field">
      <label>Foto del cliente (opcional)</label>
      <div class="img-upload-area">
        <div class="img-preview-wrap" id="preview-wrap-t" ${t?.foto_url ? '' : 'style="display:none"'}>
          <img id="img-preview-t" src="${escHTML(t?.foto_url || '')}" alt="Vista previa"
               style="width:80px;height:80px;object-fit:cover;border-radius:50%;margin:0 auto 8px;">
        </div>
        <div class="no-img-placeholder" id="no-img-t" ${t?.foto_url ? 'style="display:none"' : ''}>
          <span>📸</span>Sin foto
        </div>
        <label class="btn-upload">
          ${t?.foto_url ? '🔄 Cambiar foto' : '📸 Subir foto'}
          <input type="file" id="img-file-t" accept="image/*" style="display:none"
                 onchange="previewImgT(this)">
        </label>
      </div>
    </div>
    <div class="form-field form-check">
      <label>
        <input type="checkbox" id="f-activo" ${(!t || t.activo !== false) ? 'checked' : ''}>
        Visible en la tienda
      </label>
    </div>`;
}

// Preview de imagen seleccionada (producto)
window.previewImg = (input) => {
  if (!input.files?.[0]) return;
  if (input.files[0].size > MAX_IMG_MB * 1024 * 1024) {
    showAlert(`La imagen pesa ${(input.files[0].size / 1024 / 1024).toFixed(1)} MB. El máximo es ${MAX_IMG_MB} MB. Usá una imagen más pequeña o comprimila antes de subirla.`, '⚠️');
    input.value = '';
    return;
  }
  const url = URL.createObjectURL(input.files[0]);
  document.getElementById('img-preview').src = url;
  document.getElementById('preview-wrap').style.display = '';
  document.getElementById('no-img').style.display = 'none';
};

// Preview de foto de testimonio
window.previewImgT = (input) => {
  if (!input.files?.[0]) return;
  if (input.files[0].size > MAX_IMG_MB * 1024 * 1024) {
    showAlert(`La imagen pesa ${(input.files[0].size / 1024 / 1024).toFixed(1)} MB. El máximo es ${MAX_IMG_MB} MB. Usá una imagen más pequeña o comprimila antes de subirla.`, '⚠️');
    input.value = '';
    return;
  }
  const url = URL.createObjectURL(input.files[0]);
  document.getElementById('img-preview-t').src = url;
  document.getElementById('preview-wrap-t').style.display = '';
  document.getElementById('no-img-t').style.display = 'none';
};

// Comprimir imagen antes de subir
function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = e => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const MAX = 900;
        const scale = Math.min(1, MAX / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, 'image/jpeg', 0.83);
      };
    };
  });
}

// ── GUARDAR ───────────────────────────────────────────
async function guardar(type, id) {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.textContent = 'Guardando…';
  saveBtn.disabled = true;

  try {
    let payload = {};

    if (type === 'productos') {
      const nombre = document.getElementById('f-nombre').value.trim();
      const precio = document.getElementById('f-precio').value.trim();
      if (!nombre)                   { showAlert('El nombre es obligatorio.', '⚠️'); return; }
      if (nombre.length > MAX_NOMBRE){ showAlert(`El nombre no puede superar ${MAX_NOMBRE} caracteres.`, '⚠️'); return; }
      if (!precio)                   { showAlert('El precio es obligatorio.', '⚠️'); return; }

      // Subir imagen si se seleccionó una nueva
      let imagen_url = currentImgUrl;
      const fileInput = document.getElementById('img-file');
      if (fileInput?.files?.[0]) {
        if (fileInput.files[0].size > MAX_IMG_MB * 1024 * 1024) {
          showAlert(`La imagen es demasiado grande. El máximo es ${MAX_IMG_MB} MB.`, '⚠️'); return;
        }
        const blob = await compressImage(fileInput.files[0]);
        const filename = `${Date.now()}.jpg`;
        const { error: upErr } = await db.storage
          .from('desayunos')
          .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = db.storage.from('desayunos').getPublicUrl(filename);
        imagen_url = publicUrl;
      }

      payload = {
        nombre,
        descripcion: document.getElementById('f-desc').value.trim(),
        precio,
        tag:         document.getElementById('f-tag').value,
        tema:        document.getElementById('f-tema').value,
        tipo:        document.getElementById('f-tipo').value,
        activo:      document.getElementById('f-activo').checked,
        orden:       parseInt(document.getElementById('f-orden').value, 10) || 0,
        imagen_url
      };
    } else {
      const nombre = document.getElementById('f-nombre').value.trim();
      const texto  = document.getElementById('f-texto').value.trim();
      if (!nombre)                   { showAlert('El nombre es obligatorio.', '⚠️'); return; }
      if (nombre.length > MAX_NOMBRE){ showAlert(`El nombre no puede superar ${MAX_NOMBRE} caracteres.`, '⚠️'); return; }
      if (!texto)                    { showAlert('El comentario es obligatorio.', '⚠️'); return; }

      // Subir foto de testimonio si se seleccionó una nueva
      let foto_url = currentFotoUrl;
      const fotoInput = document.getElementById('img-file-t');
      if (fotoInput?.files?.[0]) {
        if (fotoInput.files[0].size > MAX_IMG_MB * 1024 * 1024) {
          showAlert(`La imagen es demasiado grande. El máximo es ${MAX_IMG_MB} MB.`, '⚠️'); return;
        }
        const blob = await compressImage(fotoInput.files[0]);
        const filename = `testimonios/${Date.now()}.jpg`;
        const { error: upErr } = await db.storage
          .from('desayunos')
          .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = db.storage.from('desayunos').getPublicUrl(filename);
        foto_url = publicUrl;
      }

      payload = {
        nombre,
        ciudad: document.getElementById('f-ciudad').value.trim(),
        texto,
        foto_url,
        activo: document.getElementById('f-activo').checked
      };
    }

    const { error } = id
      ? await db.from(type).update(payload).eq('id', id)
      : await db.from(type).insert(payload);

    if (error) throw error;

    closeModal();
    if (type === 'productos')   loadProductos();
    else                        loadTestimonios();
    showToast('¡Guardado con éxito! ✓');

  } catch (err) {
    showAlert('Error al guardar: ' + err.message, '❌');
  } finally {
    saveBtn.textContent = 'Guardar';
    saveBtn.disabled = false;
  }
}

// ── HELPERS ───────────────────────────────────────────
window.toggleActivo = async (table, id, value) => {
  await db.from(table).update({ activo: value }).eq('id', id);
  showToast(value ? 'Activado ✓' : 'Ocultado');
};

window.confirmDeleteFromBtn = (btn) => {
  confirmDelete(btn.dataset.delType, btn.dataset.delId, btn.dataset.delNombre);
};

window.confirmDelete = (type, id, nombre) => {
  const label = type === 'productos'
    ? `el desayuno "${nombre}"`
    : `el testimonio de "${nombre}"`;
  showConfirm({
    icon: '🗑️',
    msg: `¿Estás seguro de que querés eliminar ${label}?\nEsta acción no se puede deshacer.`,
    okLabel: 'Eliminar',
    onOk: () => borrar(type, id)
  });
};

async function borrar(type, id) {
  const { error } = await db.from(type).delete().eq('id', id);
  if (error) { showAlert('Error: ' + error.message, '❌'); return; }
  if (type === 'productos')   loadProductos();
  else                        loadTestimonios();
  showToast('Eliminado ✓');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  currentImgUrl = null;
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── CONFIGURACIÓN DE OPCIONES ─────────────────────────
async function renderConfigTab() {
  const container = document.getElementById('config-opciones');

  // Cargar campos de configuración de una sola query
  const { data: cfgRows } = await db.from('configuracion')
    .select('seccion, valor')
    .in('seccion', ['mensaje_wa', 'telefono', 'horario']);
  const cfgMap = Object.fromEntries((cfgRows || []).map(r => [r.seccion, r.valor]));

  const templateActual = cfgMap.mensaje_wa || '¡Hola! Quiero realizar un pedido: Producto: {nombre}\n\nImagen del producto: {imagen}';
  const telefonoActual = cfgMap.telefono   || '';
  const horarioActual  = cfgMap.horario    || '';

  const secciones = [
    { key: 'categoria',     titulo: '🏷️ Categorías',        desc: 'Opciones del selector "Categoría" al agregar productos (ej: Adulto, Infantil).' },
    { key: 'tipo_producto', titulo: '📦 Tipos de producto',  desc: 'Opciones del selector "Tipo de producto" y los filtros del catálogo.' },
    { key: 'etiqueta',      titulo: '✨ Etiquetas',           desc: 'Opciones del selector "Etiqueta" al agregar productos.' },
  ];

  const contactoHtml = `
    <div class="config-section">
      <h3>📞 Teléfono de contacto</h3>
      <p>Se usa en los links de WhatsApp del catálogo y en los datos de negocio del sitio. Incluí el código de país sin espacios (ej: <strong>+542995326695</strong>).</p>
      <div class="form-field" style="display:flex;gap:8px;align-items:center;">
        <input type="tel" id="cfg-telefono" value="${escHTML(telefonoActual)}" placeholder="+542995326695" style="flex:1;">
        <button class="btn-add" onclick="guardarTelefono()">Guardar</button>
      </div>
    </div>
    <div class="config-section">
      <h3>🕐 Horario de atención</h3>
      <p>Se usa en los datos de negocio del sitio (Schema.org). Formato Schema.org: <strong>Mo-Su 08:00-20:00</strong> (días en inglés abreviados, separados por espacio).</p>
      <div class="form-field" style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="cfg-horario" value="${escHTML(horarioActual)}" placeholder="Mo-Su 08:00-20:00" style="flex:1;">
        <button class="btn-add" onclick="guardarHorario()">Guardar</button>
      </div>
    </div>`;

  const waMsgHtml = `
    <div class="config-section">
      <h3>💬 Mensaje de WhatsApp</h3>
      <p>Editá el texto que recibe el cliente al hacer clic en "Pedir". Variables disponibles: <strong>{nombre}</strong>, <strong>{precio}</strong>, <strong>{tipo}</strong>, <strong>{categoria}</strong>, <strong>{imagen}</strong> (si el producto tiene foto).</p>
      <div class="form-field">
        <textarea id="cfg-wa-template" rows="5" style="width:100%;padding:10px 13px;border:1.5px solid var(--gray-2);border-radius:var(--radius);font-size:0.88rem;font-family:var(--font);resize:vertical;outline:none;">${escHTML(templateActual)}</textarea>
      </div>
      <button class="btn-add" onclick="guardarMensajeWA()">Guardar mensaje</button>
    </div>`;

  container.innerHTML = contactoHtml + waMsgHtml + secciones.map(s => `
    <div class="config-section">
      <h3>${s.titulo}</h3>
      <p>${s.desc}</p>
      <div class="config-list" id="config-list-${s.key}">
        ${(configOpciones[s.key] || []).length
          ? (configOpciones[s.key] || []).map(o => `
              <div class="config-item" id="config-item-${o.id}">
                <span>${escHTML(o.valor)}</span>
                <button class="btn-icon btn-danger" onclick="deleteOpcion('${o.id}','${s.key}')" title="Eliminar">🗑️</button>
              </div>`).join('')
          : '<p style="color:var(--gray-3);font-size:0.82rem;padding:4px 0;">Sin opciones aún.</p>'}
      </div>
      <div class="config-add">
        <input type="text" id="config-input-${s.key}" placeholder="Nueva opción...">
        <button class="btn-add" onclick="addOpcion('${s.key}')">+ Agregar</button>
      </div>
    </div>`).join('');
}

window.addOpcion = async (seccion) => {
  const input = document.getElementById(`config-input-${seccion}`);
  const valor = input.value.trim();
  if (!valor) { showAlert('Ingresá un nombre para la opción.', '⚠️'); return; }
  const orden = (configOpciones[seccion] || []).length + 1;
  const { data, error } = await db.from('configuracion').insert({ seccion, valor, orden }).select().single();
  if (error) { showAlert('Error al guardar: ' + error.message, '❌'); return; }
  if (!configOpciones[seccion]) configOpciones[seccion] = [];
  configOpciones[seccion].push(data);
  input.value = '';
  renderConfigTab();
  showToast('Opción agregada ✓');
};

window.deleteOpcion = (id, seccion) => {
  showConfirm({
    icon: '🗑️',
    msg: '¿Eliminar esta opción?\nLos productos que la tengan asignada no se verán afectados.',
    okLabel: 'Eliminar',
    onOk: async () => {
      const { error } = await db.from('configuracion').delete().eq('id', id);
      if (error) { showAlert('Error: ' + error.message, '❌'); return; }
      configOpciones[seccion] = (configOpciones[seccion] || []).filter(o => String(o.id) !== String(id));
      renderConfigTab();
      showToast('Opción eliminada ✓');
    }
  });
};

async function guardarConfigSingle(seccion, valor, toastMsg) {
  if (!valor) { showAlert('El campo no puede estar vacío.', '⚠️'); return; }
  const { data: existing } = await db.from('configuracion').select('id').eq('seccion', seccion).maybeSingle();
  const { error } = existing
    ? await db.from('configuracion').update({ valor }).eq('id', existing.id)
    : await db.from('configuracion').insert({ seccion, valor, orden: 0 });
  if (error) { showAlert('Error al guardar: ' + error.message, '❌'); return; }
  showToast(toastMsg);
}

window.guardarMensajeWA = () => {
  const valor = document.getElementById('cfg-wa-template').value.trim();
  guardarConfigSingle('mensaje_wa', valor, 'Mensaje guardado ✓');
};

window.guardarTelefono = () => {
  const valor = document.getElementById('cfg-telefono').value.trim();
  if (valor && valor.replace(/\D/g, '').length < 10) {
    showAlert('El número parece incompleto. Incluí el código de país sin espacios (ej: +542995326695).', '⚠️');
    return;
  }
  guardarConfigSingle('telefono', valor, 'Teléfono guardado ✓');
};

window.guardarHorario = () => {
  const valor = document.getElementById('cfg-horario').value.trim();
  const diaOk  = /^(Mo|Tu|We|Th|Fr|Sa|Su)/.test(valor);
  const horaOk = /\d{2}:\d{2}-\d{2}:\d{2}/.test(valor);
  if (valor && (!diaOk || !horaOk)) {
    showAlert('El formato debe seguir Schema.org: días en inglés abreviados y rango horario (ej: Mo-Su 08:00-20:00).', '⚠️');
    return;
  }
  guardarConfigSingle('horario', valor, 'Horario guardado ✓');
};

// ── CONFIGURACIÓN ─────────────────────────────────────
window.changeMyPassword = async () => {
  const pass  = document.getElementById('cfg-new-pass').value;
  const pass2 = document.getElementById('cfg-new-pass2').value;
  const btn   = document.querySelector('[onclick="changeMyPassword()"]');

  if (pass.length < 6) { showAlert('La contraseña debe tener al menos 6 caracteres.', '⚠️'); return; }
  if (pass !== pass2)  { showAlert('Las contraseñas no coinciden. Verificá que sean iguales.', '⚠️'); return; }

  btn.textContent = 'Guardando…';
  btn.disabled = true;

  const { error } = await db.auth.updateUser({ password: pass });

  btn.textContent = 'Guardar contraseña';
  btn.disabled = false;

  if (error) {
    showAlert('Error al cambiar contraseña:\n' + error.message, '❌');
  } else {
    document.getElementById('cfg-new-pass').value  = '';
    document.getElementById('cfg-new-pass2').value = '';
    showAlert('✓ Contraseña actualizada correctamente.', '✅');
  }
};

let _credsEmail = '', _credsPass = '';

window.addAdminUser = async () => {
  const email  = document.getElementById('cfg-admin-email').value.trim();
  const pass   = document.getElementById('cfg-admin-pass').value;
  const btn    = document.querySelector('[onclick="addAdminUser()"]');

  // Validaciones con modal de alerta
  if (!email)          { showAlert('Ingresá el email del nuevo admin.', '⚠️'); return; }
  if (pass.length < 6) { showAlert('La contraseña debe tener al menos 6 caracteres.', '⚠️'); return; }

  // Estado de carga
  btn.textContent = 'Creando…';
  btn.disabled = true;

  const { data, error } = await db.auth.signUp({ email, password: pass });

  btn.textContent = 'Crear administrador';
  btn.disabled = false;

  if (error) {
    showAlert('No se pudo crear el admin:\n' + error.message, '❌');
    return;
  }

  // Limpiar campos
  document.getElementById('cfg-admin-email').value = '';
  document.getElementById('cfg-admin-pass').value  = '';

  // Mostrar credenciales para compartir
  _credsEmail = email;
  _credsPass  = pass;
  document.getElementById('creds-email').textContent = email;
  document.getElementById('creds-pass').textContent  = pass;
  document.getElementById('creds-modal').classList.remove('hidden');
};

window.closeCredsModal = () => {
  document.getElementById('creds-modal').classList.add('hidden');
};

window.copyCredsToClipboard = async () => {
  const text =
    `Panel: https://las-santiaguenas.vercel.app/admin.html\n` +
    `Email: ${_credsEmail}\n` +
    `Contraseña: ${_credsPass}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Credenciales copiadas al portapapeles ✓');
  } catch (_) {
    showAlert('No se pudo copiar automáticamente. Anotá las credenciales antes de cerrar esta ventana.', '⚠️');
  }
};

// ── EVENT LISTENERS ───────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('login-error');
  btn.textContent = 'Ingresando…';
  btn.disabled = true;
  err.textContent = '';
  try {
    await login(
      document.getElementById('login-email').value,
      document.getElementById('login-password').value
    );
  } catch {
    err.textContent = 'Email o contraseña incorrectos. Intentá de nuevo.';
  } finally {
    btn.textContent = 'Iniciar sesión';
    btn.disabled = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', logout);

document.querySelectorAll('.tab-btn').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab))
);

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ── START ─────────────────────────────────────────────
checkAuth();
