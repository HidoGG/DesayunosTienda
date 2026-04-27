const SUPABASE_URL = 'https://nhwcgfmgzhfxwifsqptb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5od2NnZm1nemhmeHdpZnNxcHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDcwNjYsImV4cCI6MjA5MjEyMzA2Nn0.V0AKSJCti68Z_AzEnk0MsOJJVW6IXlAHOYN-f0ciqKc';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Analytics ────────────────────────────────────────
// Rate limiting via sessionStorage: persiste entre pestañas de la misma sesión,
// evitando duplicados cuando el usuario abre el catálogo en múltiples tabs.
function _rlAllow(key, cooldownMs) {
  const now = Date.now();
  const stored = parseInt(sessionStorage.getItem('_rl_' + key) || '0', 10);
  if (now - stored < cooldownMs) return false;
  sessionStorage.setItem('_rl_' + key, now);
  return true;
}

async function track(tipo, extra = {}) {
  const key      = tipo === 'page_view' ? '_pv' : tipo + ':' + (extra.producto_id || extra.termino_busqueda || '');
  const cooldown = tipo === 'page_view' ? Infinity : tipo === 'wa_click' ? 30_000 : 60_000;
  if (!_rlAllow(key, cooldown)) return;
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
  const temaRaw   = p.tema || 'Adulto';
  const temaLabel = temaRaw === 'Cumpleaños adulto'   ? 'Adulto'
                  : temaRaw === 'Cumpleaños infantil' ? 'Infantil'
                  : temaRaw;
  const tipoLabel      = p.tipo || 'Desayunos';
  const imagenAbsoluta = p.imagen_url
    ? (p.imagen_url.startsWith('http') ? p.imagen_url : `${location.origin}/${p.imagen_url}`)
    : '';
  const infantil       = /infantil/i.test(temaLabel);

  let waText = waMsgTemplate
    .replace(/{nombre}/g,    p.nombre)
    .replace(/{precio}/g,    p.precio)
    .replace(/{tipo}/g,      tipoLabel)
    .replace(/{categoria}/g, temaLabel);

  if (imagenAbsoluta) {
    waText = waText.replace(/{imagen}/g, imagenAbsoluta);
  } else {
    waText = waText.split('\n').filter(l => !l.includes('{imagen}')).join('\n').trim();
  }

  const waMsg  = encodeURIComponent(waText);
  const waUrl  = `https://wa.me/${waPhone}?text=${waMsg}`;

  return `
    <article class="card" data-tipo="${escHTML(tipoLabel)}" data-tema="${escHTML(temaLabel)}">
      <div class="card-img-wrap">
        <img class="card-img"
             src="${escHTML(p.imagen_url || 'images/desayuno-cumple-rosa-dorado-adulto.jpg')}"
             alt="${escHTML(p.nombre)} · desayuno sorpresa en Neuquén · Las Santiagueñas"
             loading="lazy"
             onerror="this.onerror=null;this.src='images/desayuno-cumple-rosa-dorado-adulto.jpg'">
        <span class="card-badge ${infantil ? 'card-badge--infantil' : 'card-badge--adulto'}">
          ${escHTML(temaLabel)}
        </span>
        <span class="card-badge card-badge--tema">${escHTML(tipoLabel)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-nombre">${escHTML(p.nombre)}</h3>
        ${p.narrativa ? `<p class="card-narrativa">${escHTML(p.narrativa)}</p>` : ''}
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
          Pedir por WhatsApp 💬
        </a>
      </div>
    </article>`;
}

// ── Filtros y búsqueda ────────────────────────────────
let activeTipo    = 'Todos';
let activeTema    = 'Todos';
let waMsgTemplate = '¡Hola! Quiero realizar un pedido: Producto: {nombre}\n\nImagen del producto: {imagen}';
let waPhone       = '542995326695';

function applyFilters() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  let visible = 0;

  document.querySelectorAll('.card').forEach(card => {
    const matchTipo = activeTipo === 'Todos' || card.dataset.tipo === activeTipo;
    const matchTema = activeTema === 'Todos' || card.dataset.tema === activeTema;
    const matchQ    = !q || card.textContent.toLowerCase().includes(q);
    if (matchTipo && matchTema && matchQ) {
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
let carouselTimer  = null;
let resumeCarousel = () => {};

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

  // Dots indicadores
  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'carousel-dots';
  track.closest('.carousel-wrap').after(dotsWrap);

  function buildDots() {
    const count = Math.max(1, items().length - visible() + 1);
    dotsWrap.innerHTML = Array.from({ length: count }, (_, i) =>
      `<button class="carousel-dot${i === current ? ' active' : ''}" aria-label="Ir al testimonio ${i + 1}"></button>`
    ).join('');
    dotsWrap.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.addEventListener('click', () => goTo(i));
    });
  }

  function updateDots() {
    dotsWrap.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
    });
  }

  function goTo(idx) {
    const max = items().length - visible();
    if (max <= 0) return;
    current = Math.max(0, Math.min(idx, max));
    track.style.transform = `translateX(-${current * stepPx()}px)`;
    updateDots();
  }

  function next() {
    const max = items().length - visible();
    if (current >= max) {
      track.style.transform = `translateX(-${max * stepPx()}px)`;
      setTimeout(() => {
        track.style.transition = 'none';
        current = 0;
        track.style.transform = 'translateX(0)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          track.style.transition = '';
        }));
        updateDots();
      }, 750);
    } else {
      goTo(current + 1);
    }
  }

  buildDots();
  window.addEventListener('resize', buildDots);

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => next());

  const carouselWrap = document.querySelector('.carousel-wrap');
  if (carouselWrap) {
    carouselWrap.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    });
  }

  resumeCarousel = () => { if (!carouselTimer) carouselTimer = setInterval(next, 3800); };
  carouselTimer = setInterval(next, 3800);
  const wrap = document.querySelector('.testimonials-track-wrap');
  if (wrap) {
    wrap.addEventListener('mouseenter', () => { clearInterval(carouselTimer); carouselTimer = null; });
    wrap.addEventListener('mouseleave', resumeCarousel);
    wrap.addEventListener('focusin',    () => { clearInterval(carouselTimer); carouselTimer = null; });
    wrap.addEventListener('focusout',   resumeCarousel);
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
    clearInterval(carouselTimer);
    carouselTimer = null;
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    img.src = '';
    resumeCarousel();
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
    const phone = waPhone || '542995326695';
    const msg = encodeURIComponent('Hola! Quiero ver el catálogo de desayunos 🎀');
    grid.innerHTML = `
      <div class="catalog-fallback">
        <p>No pudimos cargar el catálogo en este momento.</p>
        <a href="https://wa.me/${phone}?text=${msg}" target="_blank" rel="noopener" class="card-cta">
          Ver desayunos por WhatsApp 💬
        </a>
      </div>`;
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

  // Filtros — cargar tipos de producto y categorías desde Supabase
  const [{ data: tiposConfig }, { data: temasConfig }] = await Promise.all([
    db.from('configuracion').select('*').eq('seccion', 'tipo_producto').order('orden'),
    db.from('configuracion').select('*').eq('seccion', 'categoria').order('orden'),
  ]);

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

  const filterTema = document.getElementById('filters-tema');
  if (temasConfig?.length && filterTema) {
    filterTema.innerHTML =
      `<button class="filter-btn active" data-tema="Todos">Todos</button>` +
      temasConfig.map(t => `<button class="filter-btn" data-tema="${escHTML(t.valor)}">${escHTML(t.valor)}</button>`).join('');
    filterTema.style.display = '';
    filterTema.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filterTema.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTema = btn.dataset.tema;
      applyFilters();
    });
  }

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
