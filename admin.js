const SUPABASE_URL = 'https://nhwcgfmgzhfxwifsqptb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2NnZm1nemhmeHdpZnNxcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDcwNjYsImV4cCI6MjA5MjEyMzA2Nn0.V0AKSJCti68Z_AzEnk0MsOJJVW6IXlAHOYN-f0ciqKc';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentTab = 'productos';
let currentImgUrl  = null;
let currentFotoUrl = null;

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
  // Si la URL contiene un token de recuperación, mostrar el formulario de nueva contraseña
  const urlHash   = window.location.hash;
  const urlSearch = window.location.search;
  const isRecovery = urlHash.includes('type=recovery') || urlSearch.includes('type=recovery');

  if (isRecovery) {
    showLogin();
    // Esperar el evento de Supabase para confirmar el token
    db.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') showPanel('recovery');
    });
    return;
  }

  // Flujo normal: detectar recovery si llega en cualquier momento (ej. otra pestaña)
  db.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      showLogin();
      showPanel('recovery');
    }
  });

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
  await db.auth.signOut();
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
  switchTab('productos');
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
  // config no necesita carga asíncrona
}

// ── PRODUCTOS ─────────────────────────────────────────
async function loadProductos() {
  const { data, error } = await db.from('productos').select('*').order('orden');
  const el = document.getElementById('list-productos');
  if (error || !data?.length) {
    el.innerHTML = '<p class="empty-msg">No hay productos aún. ¡Agregá el primero!</p>';
    return;
  }
  el.innerHTML = data.map(p => `
    <div class="list-item ${p.activo ? '' : 'inactive'}" id="item-${p.id}">
      <img class="list-thumb" src="${p.imagen_url || 'images/c2.jpg'}" alt="${p.nombre}"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2252%22 height=%2252%22><rect width=%2252%22 height=%2252%22 fill=%22%23f0e6ee%22/><text x=%2226%22 y=%2232%22 text-anchor=%22middle%22 font-size=%2220%22>🍓</text></svg>'">
      <div class="list-info">
        <div class="list-name">${p.nombre}</div>
        <div class="list-meta">${p.precio} · ${p.tema} · ${p.tag}</div>
      </div>
      <div class="list-actions">
        <label class="toggle-wrap" title="${p.activo ? 'Visible' : 'Oculto'}">
          <input type="checkbox" class="toggle" ${p.activo ? 'checked' : ''}
                 onchange="toggleActivo('productos','${p.id}',this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon" onclick="openEdit('productos','${p.id}')" title="Editar">✏️</button>
        <button class="btn-icon btn-danger" onclick="confirmDelete('productos','${p.id}','${p.nombre.replace(/'/g, "\\'")}')" title="Eliminar">🗑️</button>
      </div>
    </div>`).join('');
}

// ── TESTIMONIOS ───────────────────────────────────────
async function loadTestimonios() {
  const { data, error } = await db.from('testimonios').select('*').order('created_at', { ascending: false });
  const el = document.getElementById('list-testimonios');
  if (error || !data?.length) {
    el.innerHTML = '<p class="empty-msg">No hay testimonios aún. ¡Agregá el primero!</p>';
    return;
  }
  el.innerHTML = data.map(t => `
    <div class="list-item ${t.activo ? '' : 'inactive'}">
      ${t.foto_url
        ? `<img class="list-thumb" src="${t.foto_url}" alt="${t.nombre}" style="border-radius:50%;object-fit:cover;">`
        : `<div class="list-avatar">${t.nombre[0].toUpperCase()}</div>`}
      <div class="list-info">
        <div class="list-name">${t.nombre}${t.ciudad ? ' · ' + t.ciudad : ''}</div>
        <div class="list-meta">"${t.texto.substring(0, 70)}${t.texto.length > 70 ? '…' : ''}"</div>
      </div>
      <div class="list-actions">
        <label class="toggle-wrap">
          <input type="checkbox" class="toggle" ${t.activo ? 'checked' : ''}
                 onchange="toggleActivo('testimonios','${t.id}',this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon" onclick="openEdit('testimonios','${t.id}')" title="Editar">✏️</button>
        <button class="btn-icon btn-danger" onclick="confirmDelete('testimonios','${t.id}','${t.nombre.replace(/'/g, "\\'")}')" title="Eliminar">🗑️</button>

      </div>
    </div>`).join('');
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
               <span class="rank-name">${n}</span>
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
           <span class="rank-name">"${t}"</span>
           <span class="rank-count">${c} veces</span>
         </div>`).join('')}</div>
    </div>` : ''}
  `;
}

// ── MODAL EDIT / NEW ─────────────────────────────────
window.openNew  = (type) => openModal(type, null);
window.openEdit = async (type, id) => {
  const { data } = await db.from(type).select('*').eq('id', id).single();
  openModal(type, data);
};

function openModal(type, item) {
  currentImgUrl  = item?.imagen_url || null;
  currentFotoUrl = item?.foto_url   || null;

  document.getElementById('modal-title').textContent =
    type === 'productos'
      ? (item ? 'Editar desayuno' : 'Agregar desayuno')
      : (item ? 'Editar testimonio' : 'Agregar testimonio');

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
          <img id="img-preview" src="${p?.imagen_url || ''}" alt="Vista previa">
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
      <input type="text" id="f-nombre" value="${p?.nombre || ''}" placeholder="Ej: Desayuno Stitch Azul">
    </div>
    <div class="form-field">
      <label>Descripción (ingredientes y decoración)</label>
      <textarea id="f-desc" placeholder="Bandeja fibrofácil · taza · medialunas...">${p?.descripcion || ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Precio *</label>
        <input type="text" id="f-precio" value="${p?.precio || '$75.000'}" placeholder="$75.000">
      </div>
      <div class="form-field">
        <label>Etiqueta</label>
        <select id="f-tag">
          <option ${(!p || p.tag === '🎁 Estándar') ? 'selected' : ''}>🎁 Estándar</option>
          <option ${p?.tag === '✨ Con mini torta' ? 'selected' : ''}>✨ Con mini torta</option>
        </select>
      </div>
    </div>
    <div class="form-field">
      <label>Categoría</label>
      <select id="f-tema">
        <option ${(!p || p.tema === 'Cumpleaños adulto') ? 'selected' : ''}>Cumpleaños adulto</option>
        <option ${p?.tema === 'Cumpleaños infantil' ? 'selected' : ''}>Cumpleaños infantil</option>
      </select>
    </div>
    <div class="form-field form-check">
      <label>
        <input type="checkbox" id="f-activo" ${(!p || p.activo !== false) ? 'checked' : ''}>
        Visible en la tienda
      </label>
    </div>`;
}

function formTestimonio(t) {
  return `
    <div class="form-row">
      <div class="form-field">
        <label>Nombre *</label>
        <input type="text" id="f-nombre" value="${t?.nombre || ''}" placeholder="Valentina M.">
      </div>
      <div class="form-field">
        <label>Ciudad</label>
        <input type="text" id="f-ciudad" value="${t?.ciudad || ''}" placeholder="Plottier">
      </div>
    </div>
    <div class="form-field">
      <label>Comentario *</label>
      <textarea id="f-texto" placeholder="El desayuno fue increíble...">${t?.texto || ''}</textarea>
    </div>
    <div class="form-field">
      <label>Foto del cliente (opcional)</label>
      <div class="img-upload-area">
        <div class="img-preview-wrap" id="preview-wrap-t" ${t?.foto_url ? '' : 'style="display:none"'}>
          <img id="img-preview-t" src="${t?.foto_url || ''}" alt="Vista previa"
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
  const url = URL.createObjectURL(input.files[0]);
  document.getElementById('img-preview').src = url;
  document.getElementById('preview-wrap').style.display = '';
  document.getElementById('no-img').style.display = 'none';
};

// Preview de foto de testimonio
window.previewImgT = (input) => {
  if (!input.files?.[0]) return;
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
      if (!nombre) { showAlert('El nombre es obligatorio.', '⚠️'); return; }

      // Subir imagen si se seleccionó una nueva
      let imagen_url = currentImgUrl;
      const fileInput = document.getElementById('img-file');
      if (fileInput?.files?.[0]) {
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
        precio:      document.getElementById('f-precio').value.trim(),
        tag:         document.getElementById('f-tag').value,
        tema:        document.getElementById('f-tema').value,
        activo:      document.getElementById('f-activo').checked,
        imagen_url
      };
    } else {
      const nombre = document.getElementById('f-nombre').value.trim();
      const texto  = document.getElementById('f-texto').value.trim();
      if (!nombre || !texto) { showAlert('Nombre y comentario son obligatorios.', '⚠️'); return; }

      // Subir foto de testimonio si se seleccionó una nueva
      let foto_url = currentFotoUrl;
      const fotoInput = document.getElementById('img-file-t');
      if (fotoInput?.files?.[0]) {
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

window.shareCredsWA = () => {
  const msg = encodeURIComponent(
    `Hola! Acá están tus credenciales para el panel admin de Las Santiagueñas:\n\n` +
    `🌐 Panel: https://las-santiaguenas.vercel.app/admin.html\n` +
    `📧 Email: ${_credsEmail}\n` +
    `🔑 Contraseña: ${_credsPass}\n\n` +
    `Podés cambiar la contraseña desde el panel en ⚙️ Configuración.`
  );
  window.open(`https://wa.me/?text=${msg}`, '_blank');
};

window.shareCredsMail = () => {
  const subject = encodeURIComponent('Acceso al Panel Admin · Las Santiagueñas');
  const body = encodeURIComponent(
    `Hola!\n\nAcá están tus credenciales para el panel de administración:\n\n` +
    `Panel: https://las-santiaguenas.vercel.app/admin.html\n` +
    `Email: ${_credsEmail}\n` +
    `Contraseña: ${_credsPass}\n\n` +
    `Podés cambiar tu contraseña desde el panel en la sección ⚙️ Configuración.\n\n` +
    `Las Santiagueñas`
  );
  window.open(`mailto:${_credsEmail}?subject=${subject}&body=${body}`, '_blank');
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
