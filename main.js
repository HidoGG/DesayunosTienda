const SUPABASE_URL = 'https://nhwcgfmgzhfxwifsqptb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2NnZm1nemhmeHdpZnNxcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDcwNjYsImV4cCI6MjA5MjEyMzA2Nn0.V0AKSJCti68Z_AzEnk0MsOJJVW6IXlAHOYN-f0ciqKc';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Analytics ────────────────────────────────────────
// Rate limiting en memoria: evita duplicados por clic accidental o búsqueda repetida.
// No protege contra abuso deliberado, pero es suficiente para mantener los stats limpios.
const _rl = new Map();
function _rlAllow(key, cooldownMs) {
  const now = Date.now();
  if (now - (_rl.get(key) ?? 0) < cooldownMs) return false;
  _rl.set(key, now);
  return true;
}

async function track(tipo, extra = {}) {
  if (tipo === 'page_view') {
    if (sessionStorage.getItem('_pv')) return;
    sessionStorage.setItem('_pv', '1');
  } else {
    const key      = tipo + ':' + (extra.producto_id || extra.termino_busqueda || '');
    const cooldown = tipo === 'wa_click' ? 30_000 : 60_000;
    if (!_rlAllow(key, cooldown)) return;
  }
  try {
    await db.from('eventos').insert({
      tipo,
      dispositivo: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      hora_dia: new Date().getHours(),
      ...extra
    });
  } catch (_) {}
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.card-cta');
  if (btn) track('wa_click', { producto_nombre: btn.dataset.nombre, producto_id: btn.dataset.id || null });
});

// ── Render card ───────────────────────────────────────
function cardHTML(p) {
  const publicoLabel   = (p.tema === 'Infantil' || p.tema === 'Cumpleaños infantil') ? 'Infantil' : 'Adulto';
  const tipoLabel      = p.tipo || 'Desayunos';
  const imagenAbsoluta = p.imagen_url?.startsWith('http') ? p.imagen_url : '';

  let waText = waMsgTemplate
    .replace(/{nombre}/g,    p.nombre)
    .replace(/{precio}/g,    p.precio)
    .replace(/{tipo}/g,      tipoLabel)
    .replace(/{categoria}/g, publicoLabel);

  if (imagenAbsoluta) {
    waText = waText.replace(/{imagen}/g, imagenAbsoluta);
  } else {
    waText = waText.split('\n').filter(l => !l.includes('{imagen}')).join('\n').trim();
  }

  const waMsg  = encodeURIComponent(waText);
  const waUrl  = `https://wa.me/${waPhone}?text=${waMsg}`;
  const infantil = publicoLabel === 'Infantil';
  const tipo     = tipoLabel;

  return `
    <article class="card" data-tipo="${escHTML(tipo)}">
      <div class="card-img-wrap">
        <img class="card-img"
             src="${escHTML(p.imagen_url || 'images/c2.jpg')}"
             alt="${escHTML(p.nombre)} · desayuno sorpresa en Neuquén · Las Santiagueñas"
             loading="lazy">
        <span class="card-badge ${infantil ? 'card-badge--infantil' : 'card-badge--adulto'}">
          ${infantil ? 'Infantil' : 'Adulto'}
        </span>
        <span class="card-badge card-badge--tema">${escHTML(tipo)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-nombre">${escHTML(p.nombre)}</h3>
        <div class="card-desc-wrap">
          <p class="card-desc">${escHTML(p.descripcion || '')}</p>
          <button class="card-read-more" aria-label="Expandir descripción">Seguir leyendo ▼</button>
        </div>
        <div class="card-footer">
          <span class="card-precio">${escHTML(p.precio)}</span>
          <span class="card-tag">${escHTML(p.tag)}</span>
        </div>
        <a href="${waUrl}" target="_blank" rel="noopener" class="card-cta"
           data-nombre="${escHTML(p.nombre)}" data-id="${escHTML(String(p.id ?? ''))}">
          Pedir este desayuno
        </a>
      </div>
    </article>`;
}

// ── Filtros y búsqueda ────────────────────────────────
let activeTipo    = 'Todos';
let waMsgTemplate = '¡Hola! Quiero realizar un pedido: Producto: {nombre}\n\nImagen del producto: {imagen}';
let waPhone       = '542995326695';

function applyFilters() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  let visible = 0;

  document.querySelectorAll('.card').forEach(card => {
    const matchTema = activeTipo === 'Todos' || card.dataset.tipo === activeTipo;
    const matchQ    = !q || card.textContent.toLowerCase().includes(q);
    if (matchTema && matchQ) {
      card.classList.remove('hidden-card');
      visible++;
    } else {
      card.classList.add('hidden-card');
    }
  });

  document.getElementById('no-results').classList.toggle('hidden', visible > 0);
}

// ── "Seguir leyendo" ──────────────────────────────────
function initReadMore() {
  // Ocultar el botón cuando el texto no está cortado
  document.querySelectorAll('.card-desc').forEach(desc => {
    const btn = desc.nextElementSibling;
    if (!btn) return;
    if (desc.scrollHeight <= desc.clientHeight + 2) {
      btn.style.display = 'none';
    }
  });
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.card-read-more');
  if (!btn) return;
  const desc = btn.previousElementSibling;
  const expanded = desc.classList.toggle('expanded');
  btn.textContent = expanded ? 'Ver menos ▲' : 'Seguir leyendo ▼';
});

// ── IntersectionObserver (animación) ─────────────────
function setupAnimations() {
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const cards = [...document.querySelectorAll('.card:not(.visible)')];
      const idx   = cards.indexOf(entry.target);
      setTimeout(() => entry.target.classList.add('visible'), (idx % 4) * 80);
      cardObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.card').forEach(c => cardObserver.observe(c));

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.style.opacity    = '1';
      entry.target.style.transform  = 'translateY(0)';
      fadeObserver.unobserve(entry.target);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.step, .badge').forEach((el, i) => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(20px)';
    el.style.transition = `opacity 0.5s ease ${i * 0.07}s, transform 0.5s ease ${i * 0.07}s`;
    fadeObserver.observe(el);
  });
}

// ── Carrusel testimonios ──────────────────────────────
function initCarousel() {
  const track   = document.getElementById('testimonials-grid');
  const prevBtn = document.querySelector('.carousel-btn--prev');
  const nextBtn = document.querySelector('.carousel-btn--next');
  if (!track || !prevBtn || !nextBtn || !track.querySelector('.testimonial')) return;

  let current = 0;

  function visible() {
    return window.innerWidth > 768 ? 3 : window.innerWidth > 480 ? 2 : 1;
  }

  function items() { return track.querySelectorAll('.testimonial'); }

  function stepPx() {
    const item = items()[0];
    return item.offsetWidth + 24;
  }

  function goTo(idx) {
    const max = items().length - visible();
    if (max <= 0) return;
    current = Math.max(0, Math.min(idx, max));
    track.style.transform = `translateX(-${current * stepPx()}px)`;
  }

  function next() {
    const max = items().length - visible();
    if (current >= max) {
      // loop suave: desliza hasta el final y vuelve sin que se note
      track.style.transform = `translateX(-${max * stepPx()}px)`;
      setTimeout(() => {
        track.style.transition = 'none';
        current = 0;
        track.style.transform = 'translateX(0)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          track.style.transition = '';
        }));
      }, 750);
    } else {
      goTo(current + 1);
    }
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => next());

  const carouselWrap = document.querySelector('.carousel-wrap');
  if (carouselWrap) {
    carouselWrap.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    });
  }

  let timer = setInterval(next, 3800);
  const wrap = document.querySelector('.testimonials-track-wrap');
  if (wrap) {
    wrap.addEventListener('mouseenter', () => clearInterval(timer));
    wrap.addEventListener('mouseleave', () => { timer = setInterval(next, 3800); });
    wrap.addEventListener('focusin',    () => clearInterval(timer));
    wrap.addEventListener('focusout',   () => { timer = setInterval(next, 3800); });
  }
}

// ── Lightbox ──────────────────────────────────────────
function initLightbox() {
  const overlay = document.createElement('div');
  overlay.id = 'lightbox';
  overlay.innerHTML =
    '<button class="lightbox-close" aria-label="Cerrar">&times;</button>' +
    '<img class="lightbox-img" src="" alt="">';
  document.body.appendChild(overlay);

  const img        = overlay.querySelector('.lightbox-img');
  const closeBtn   = overlay.querySelector('.lightbox-close');
  let   _trigger   = null;

  function open(src, alt, triggerEl) {
    img.src = src;
    img.alt = alt;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    _trigger = triggerEl || null;
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    img.src = '';
    if (_trigger) { _trigger.focus(); _trigger = null; }
  }

  document.addEventListener('click', e => {
    const cardImg = e.target.closest('.card-img');
    if (cardImg) open(cardImg.src, cardImg.alt, cardImg);
  });

  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.closest('.lightbox-close')) close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
}

// ── Init ──────────────────────────────────────────────
async function init() {
  track('page_view');
  initLightbox();

  // Cargar configuración inicial: mensaje WA + datos para JSON-LD (teléfono, horario)
  const { data: configRows } = await db.from('configuracion')
    .select('seccion, valor')
    .in('seccion', ['mensaje_wa', 'telefono', 'horario']);
  const configMap = Object.fromEntries((configRows || []).map(r => [r.seccion, r.valor]));

  if (configMap.mensaje_wa) waMsgTemplate = configMap.mensaje_wa;
  if (configMap.telefono) { const t = configMap.telefono.replace(/\D/g, ''); if (t) waPhone = t; }

  // Actualizar JSON-LD con valores editables desde el admin
  const ldScript = document.querySelector('script[type="application/ld+json"]');
  if (ldScript && (configMap.telefono || configMap.horario)) {
    try {
      const ld = JSON.parse(ldScript.textContent);
      if (configMap.telefono) ld.telephone    = configMap.telefono;
      if (configMap.horario)  ld.openingHours = configMap.horario;
      ldScript.textContent = JSON.stringify(ld);
    } catch (_) {}
  }

  // Unificar todos los links wa.me del HTML estático con el teléfono desde configuración
  if (waPhone) {
    document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
      a.href = a.href.replace(/wa\.me\/\d+/, `wa.me/${waPhone}`);
    });
  }

  // Cargar productos
  const { data: productos, error } = await db
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });

  const grid = document.getElementById('grid');
  if (error || !productos?.length) {
    document.querySelectorAll('.card-skeleton').forEach(s => s.remove());
    setupAnimations();
    initReadMore();
  } else {
    grid.innerHTML = productos.map(cardHTML).join('');
    setupAnimations();
    initReadMore();
  }

  // Cargar testimonios
  const { data: testimonios } = await db
    .from('testimonios')
    .select('*')
    .eq('activo', true)
    .order('created_at', { ascending: false });

  const tGrid = document.getElementById('testimonials-grid');
  if (testimonios?.length) {
    tGrid.innerHTML = testimonios.map(t => `
      <div class="testimonial">
        ${t.foto_url
          ? `<img class="testimonial-photo" src="${escHTML(t.foto_url)}" alt="${escHTML(t.nombre)}">`
          : `<div class="testimonial-avatar">${escHTML(t.nombre[0].toUpperCase())}</div>`}
        <div class="stars">★★★★★</div>
        <p>"${escHTML(t.texto)}"</p>
        <cite>— ${escHTML(t.nombre)}${t.ciudad ? ', ' + escHTML(t.ciudad) : ''}</cite>
      </div>`).join('');
    initCarousel();
  }

  // Filtros — cargar opciones desde Supabase y renderizar botones
  const { data: tiposConfig } = await db.from('configuracion')
    .select('*').eq('seccion', 'tipo_producto').order('orden');
  const filterBar = document.getElementById('filters');
  if (tiposConfig?.length) {
    filterBar.innerHTML =
      `<button class="filter-btn active" data-tipo="Todos">Todos</button>` +
      tiposConfig.map(t => `<button class="filter-btn" data-tipo="${escHTML(t.valor)}">${escHTML(t.valor)}</button>`).join('');
  }
  filterBar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTipo = btn.dataset.tipo;
    applyFilters();
  });

  // Búsqueda
  let searchTimer;
  document.getElementById('search').addEventListener('input', e => {
    applyFilters();
    clearTimeout(searchTimer);
    if (e.target.value.length > 2) {
      searchTimer = setTimeout(
        () => track('search', { termino_busqueda: e.target.value.trim() }),
        1200
      );
    }
  });
}

init();
