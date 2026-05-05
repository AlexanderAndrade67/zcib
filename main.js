// ========= ROTADOR DE FRASES (Hero) =========
  const HERO_PHRASES = [
    "Venta y arriendo de inmuebles con asesoría experta y resultados reales.",
    "Publicamos su inmueble, filtramos clientes y cerramos más rápido.",
    "Arriende con respaldo legal y gestione su patrimonio sin complicaciones.",
    "Compre o venda su inmueble con acompañamiento profesional de principio a fin."
  ];
  (function rotateHeroPhrase(){
    const el = document.getElementById('hero-rotator');
    if(!el || HERO_PHRASES.length < 2) return;
    let i = 0;
    const DURATION = 3500, FADE = 400;
    setInterval(()=>{
      el.classList.remove('show');         // fade out
      setTimeout(()=>{
        i = (i + 1) % HERO_PHRASES.length;
        el.textContent = HERO_PHRASES[i];  // nuevo texto
        el.classList.add('show');          // fade in
      }, FADE);
    }, DURATION);
  })();

  // ========= CONFIG: Noticias (actualización automática) =========
  const NEWS_FALLBACK_ITEMS = [
    {
      title: "Panorama de vivienda y arriendos en Colombia 2026",
      source: "Sector inmobiliario",
      url: "https://www.minvivienda.gov.co/",
      date: "2026-01-15",
      tags: ["Vivienda", "Arriendos", "Colombia"]
    },
    {
      title: "Indicadores para compra y venta de inmuebles en 2026",
      source: "Mercado inmobiliario",
      url: "https://www.fincaraiz.com.co/",
      date: "2026-01-10",
      tags: ["Venta", "Mercado", "Inversión"]
    },
    {
      title: "Actualizaciones en propiedad horizontal y administración",
      source: "Normativa",
      url: "https://www.supernotariado.gov.co/",
      date: "2026-01-05",
      tags: ["Propiedad Horizontal", "Normatividad"]
    }
  ];
  const NEWS_RSS_SOURCES = [
    { source: "Google News", url: "https://news.google.com/rss/search?q=inmobiliario+colombia&hl=es-419&gl=CO&ceid=CO:es-419" },
    { source: "Google News", url: "https://news.google.com/rss/search?q=arriendos+medellin&hl=es-419&gl=CO&ceid=CO:es-419" },
    { source: "Google News", url: "https://news.google.com/rss/search?q=propiedad+horizontal+colombia&hl=es-419&gl=CO&ceid=CO:es-419" }
  ];

  // ========= Servicio de datos: login para subida de fotos =========
  const SUPABASE_URL = "https://cbplebkmxrkaafqdhiyi.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DZCceNTENY4ViP17-eZrGg_bdMElZ9X";
  const SUPABASE_BUCKET = "inmuebles-fotos";
  const SUPABASE_FORMS_BUCKET = "formularios-zci";
  const SITE_FONT_CONFIG_PREFIX = "__site_font_config__";
  const SITE_THEME_CONFIG_PREFIX = "__site_theme_config__";
  const SITE_THEME_CONFIG_LATEST_FILE = `${SITE_THEME_CONFIG_PREFIX}_latest.json`;
  const SITE_THEME_CACHE_KEY = "__zci_site_theme_cache_v1__";
  const FONT_OPTIONS = {
    playfair: '"Playfair Display", serif',
    manrope: '"Manrope", sans-serif',
    georgia: 'Georgia, serif',
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  };
  const THEME_DEFAULTS = {
    bg: '#f2eee4',
    surface: '#ffffff',
    brand: '#102a43',
    accent: '#c4a15a',
    heroImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80',
    whatsappNumber: '3135715662',
    menuPhone: '3135715662',
    pseLink: ''
  };
  const FALLBACK_PROPERTY_IMG = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80";
  const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const inmueblesListEl = document.getElementById('inmuebles-lista');
  const defaultInmueblesMarkup = inmueblesListEl?.innerHTML || '';
  const propertyDetailContentEl = document.getElementById('property-detail-content');
  const modalDetalleInmuebleEl = document.getElementById('modalDetalleInmueble');
  const modalDetalleInmuebleTitleEl = document.getElementById('modalDetalleInmuebleLabel');
  const modalDetalleWhatsappEl = document.getElementById('property-detail-whatsapp-link');
  const inmueblesCacheById = new Map();
  let modalDetalleInmuebleInstance = null;
  let currentWhatsappNumber = THEME_DEFAULTS.whatsappNumber;

  function showAdminSuccessModal(title, message){
    const modalEl = document.getElementById('adminSuccessModal');
    if (!modalEl || !window.bootstrap) return;
    const titleEl = document.getElementById('adminSuccessModalLabel');
    const messageEl = document.getElementById('adminSuccessModalMessage');
    if (titleEl){
      titleEl.innerHTML = `<i class="fa-solid fa-circle-check text-success me-2"></i>${escapeHtml(title || 'Proceso completado')}`;
    }
    if (messageEl){
      messageEl.textContent = message || 'Los cambios se guardaron correctamente.';
    }
    window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  async function getSessionWithRetry(retries = 2){
    if (!supabaseClient) return { session: null, error: new Error('Cliente no disponible') };
    let data = null;
    let error = null;
    try{
      const response = await supabaseClient.auth.getSession();
      data = response?.data || null;
      error = response?.error || null;
    } catch (caught){
      error = caught instanceof Error ? caught : new Error(String(caught || 'Error de sesión'));
    }
    if (error){
      const message = String(error.message || '');
      const isTransientLock = /aborterror|lock broken/i.test(message);
      if (isTransientLock && retries > 0){
        await new Promise((resolve) => window.setTimeout(resolve, 220));
        return getSessionWithRetry(retries - 1);
      }
      return { session: null, error };
    }
    return { session: data?.session || null, error: null };
  }

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const text = String(reason?.message || reason || '');
    if (/aborterror|lock broken by another request/i.test(text)){
      event.preventDefault();
    }
  });

  (function setupAdminAccessGate(){
    const gateEl = document.getElementById('admin-auth-gate');
    const protectedEl = document.getElementById('admin-protected-content');
    const formEl = document.getElementById('admin-access-login-form');
    const emailEl = document.getElementById('admin-access-email');
    const passwordEl = document.getElementById('admin-access-password');
    const statusEl = document.getElementById('admin-auth-status');
    const sessionUserEl = document.getElementById('admin-session-user');
    const globalLogoutBtn = document.getElementById('admin-global-logout');
    if (!gateEl || !protectedEl || !supabaseClient) return;

    function setAdminStatus(message, level){
      if (!statusEl) return;
      statusEl.className = `alert alert-${level || 'secondary'} py-2 mb-3`;
      statusEl.textContent = message;
    }

    function setAdminAccess(session){
      const hasSession = Boolean(session?.user);
      gateEl.classList.toggle('d-none', hasSession);
      protectedEl.classList.toggle('d-none', !hasSession);
      sessionUserEl?.classList.toggle('d-none', !hasSession);
      globalLogoutBtn?.classList.toggle('d-none', !hasSession);
      if (sessionUserEl){
        sessionUserEl.textContent = hasSession ? `Sesión: ${session.user.email || 'usuario autenticado'}` : '';
      }
      if (!hasSession){
        setAdminStatus('Ingresa tus credenciales para habilitar el panel.', 'secondary');
      }
    }

    async function refreshAdminAccess(){
      const { session, error } = await getSessionWithRetry();
      if (error){
        setAdminAccess(null);
        const message = String(error.message || '');
        if (/aborterror|lock broken/i.test(message)){
          setAdminStatus('Sincronizando sesión de administración...', 'secondary');
        } else {
          setAdminStatus(`Error de sesión: ${message}`, 'danger');
        }
        return null;
      }
      setAdminAccess(session);
      return session;
    }

    formEl?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!formEl.checkValidity()){
        formEl.classList.add('was-validated');
        return;
      }
      setAdminStatus('Iniciando sesión...', 'info');
      const email = String(emailEl?.value || '').trim();
      const password = String(passwordEl?.value || '');
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error){
        setAdminStatus(`No fue posible iniciar sesión: ${error.message}`, 'danger');
        return;
      }
      formEl.reset();
      formEl.classList.remove('was-validated');
      await refreshAdminAccess();
    });

    globalLogoutBtn?.addEventListener('click', async () => {
      const { error } = await supabaseClient.auth.signOut();
      if (error){
        setAdminStatus(`No fue posible cerrar sesión: ${error.message}`, 'danger');
        return;
      }
      await refreshAdminAccess();
      setAdminStatus('Sesión cerrada.', 'secondary');
    });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      setAdminAccess(session);
    });

    refreshAdminAccess();
  })();

  function escapeHtml(value){
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function extensionFromFileName(name){
    const ext = String(name || '').split('.').pop();
    return ext && ext !== name ? ext.toLowerCase() : '';
  }

  function sanitizeFileToken(value){
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function normalizePhoneNumber(value){
    const digits = String(value || '').replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.startsWith('57') && digits.length >= 12) return digits.slice(2);
    return digits;
  }

  function formatPhoneDisplay(value){
    const digits = normalizePhoneNumber(value);
    if (digits.length === 10){
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return digits || String(value || '').trim();
  }

  function buildWhatsappUrl(value, text = ''){
    const digits = normalizePhoneNumber(value) || THEME_DEFAULTS.whatsappNumber;
    const waNumber = digits.startsWith('57') ? digits : `57${digits}`;
    const suffix = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${waNumber}${suffix}`;
  }

  function buildPropertyWhatsappUrl(inmueble){
    const code = inmueble?.codigo ? `Código ${inmueble.codigo}` : 'el inmueble publicado';
    const title = inmueble?.titulo ? ` - ${inmueble.titulo}` : '';
    const business = inmueble?.tipo_negocio === 'arriendo' ? 'arriendo' : 'venta';
    const message = `Hola, quiero solicitar información sobre ${code}${title} para ${business}.`;
    return buildWhatsappUrl(currentWhatsappNumber, message);
  }

  function normalizeOptionalUrl(value){
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  }

  function applyContactConfig(config = {}){
    const whatsappNumber = normalizePhoneNumber(config.whatsappNumber) || THEME_DEFAULTS.whatsappNumber;
    const menuPhone = normalizePhoneNumber(config.menuPhone) || whatsappNumber;
    const pseLink = normalizeOptionalUrl(config.pseLink);
    currentWhatsappNumber = whatsappNumber;

    document.querySelectorAll('#cms-whatsapp-link').forEach((link) => {
      link.href = buildWhatsappUrl(whatsappNumber);
    });

    document.querySelectorAll('#cms-phone-link').forEach((link) => {
      link.href = buildWhatsappUrl(whatsappNumber);
      const icon = link.querySelector('i')?.outerHTML || '<i class="fas fa-phone-alt"></i>';
      link.innerHTML = `${icon} ${formatPhoneDisplay(menuPhone)}`;
    });

    document.querySelectorAll('[data-zci-whatsapp]').forEach((link) => {
      const message = link.getAttribute('data-whatsapp-message') || '';
      link.href = buildWhatsappUrl(whatsappNumber, message);
    });

    document.querySelectorAll('#cms-footer-line').forEach((line) => {
      line.textContent = `Dirección: Calle 50 #54-25, Medellín, Antioquia · Tel: ${formatPhoneDisplay(menuPhone)}`;
    });

    document.querySelectorAll('#cms-pse-link').forEach((link) => {
      if (pseLink){
        link.href = pseLink;
        link.classList.remove('d-none');
      } else {
        link.href = '#';
        link.classList.add('d-none');
      }
    });

    return { whatsappNumber, menuPhone, pseLink };
  }

  function isFontConfigFile(name){
    return String(name || '').startsWith(SITE_FONT_CONFIG_PREFIX);
  }

  function isThemeConfigFile(name){
    return String(name || '').startsWith(SITE_THEME_CONFIG_PREFIX);
  }

  function isSystemConfigFile(name){
    return isFontConfigFile(name) || isThemeConfigFile(name);
  }

  function isPublicFormFile(name){
    if (!name || isSystemConfigFile(name)) return false;
    return ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'ppt', 'pptx', 'txt'].includes(extensionFromFileName(name));
  }

  function applyTypographyConfig(config){
    const headingKey = config?.heading && FONT_OPTIONS[config.heading] ? config.heading : 'playfair';
    const bodyKey = config?.body && FONT_OPTIONS[config.body] ? config.body : 'manrope';
    document.documentElement.style.setProperty('--font-heading', FONT_OPTIONS[headingKey]);
    document.documentElement.style.setProperty('--font-body', FONT_OPTIONS[bodyKey]);
    return { headingKey, bodyKey };
  }

  function applyThemeConfig(config){
    const bg = config?.bg || THEME_DEFAULTS.bg;
    const surface = config?.surface || THEME_DEFAULTS.surface;
    const brand = config?.brand || THEME_DEFAULTS.brand;
    const accent = config?.accent || THEME_DEFAULTS.accent;
    const heroImage = config?.heroImage || THEME_DEFAULTS.heroImage;
    const root = document.documentElement;
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--bg-soft', bg);
    root.style.setProperty('--surface', surface);
    root.style.setProperty('--surface-soft', surface);
    root.style.setProperty('--brand', brand);
    root.style.setProperty('--brand-deep', brand);
    root.style.setProperty('--accent', accent);
    if (/^https?:\/\//i.test(heroImage)){
      root.style.setProperty('--hero-bg-image', `url("${heroImage}")`);
    } else {
      root.style.removeProperty('--hero-bg-image');
    }
    const contact = applyContactConfig(config);
    return { bg, surface, brand, accent, heroImage, ...contact };
  }

  function normalizeThemeConfig(config){
    if (!config || typeof config !== 'object') return null;
    return {
      bg: String(config.bg || THEME_DEFAULTS.bg),
      surface: String(config.surface || THEME_DEFAULTS.surface),
      brand: String(config.brand || THEME_DEFAULTS.brand),
      accent: String(config.accent || THEME_DEFAULTS.accent),
      heroImage: String(config.heroImage || THEME_DEFAULTS.heroImage),
      whatsappNumber: normalizePhoneNumber(config.whatsappNumber) || THEME_DEFAULTS.whatsappNumber,
      menuPhone: normalizePhoneNumber(config.menuPhone) || normalizePhoneNumber(config.whatsappNumber) || THEME_DEFAULTS.menuPhone,
      pseLink: normalizeOptionalUrl(config.pseLink)
    };
  }

  function readCachedThemeConfig(){
    try {
      const raw = localStorage.getItem(SITE_THEME_CACHE_KEY);
      if (!raw) return null;
      return normalizeThemeConfig(JSON.parse(raw));
    } catch (_err){
      return null;
    }
  }

  function cacheThemeConfig(config){
    const normalized = normalizeThemeConfig(config);
    if (!normalized) return;
    try {
      localStorage.setItem(SITE_THEME_CACHE_KEY, JSON.stringify(normalized));
    } catch (_err){
      // ignore localStorage errors
    }
  }

  (function applyThemeFromCacheEarly(){
    const cached = readCachedThemeConfig();
    if (cached){
      applyThemeConfig(cached);
    }
  })();

  function formatCOP(value){
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(numberValue);
  }

  function getPrimaryPhotoUrl(fotos){
    const ordered = normalizeFotos(fotos);
    if (!ordered.length) return FALLBACK_PROPERTY_IMG;
    const mainPhoto = ordered.find((f) => f?.es_principal && f?.url_publica);
    return mainPhoto?.url_publica || ordered[0]?.url_publica || FALLBACK_PROPERTY_IMG;
  }

  function normalizeFotos(fotos){
    return (Array.isArray(fotos) ? fotos : [])
      .map((f) => {
        if (f?.url_publica) return f;
        if (f?.storage_path){
          const { data } = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(f.storage_path);
          return { ...f, url_publica: data?.publicUrl || '' };
        }
        return f;
      })
      .filter((f) => f?.url_publica)
      .sort((a, b) => {
        if (a.es_principal === b.es_principal){
          return String(b.created_at || '').localeCompare(String(a.created_at || ''));
        }
        return a.es_principal ? -1 : 1;
      });
  }

  async function hydratePropertyPhotos(properties){
    const rows = Array.isArray(properties) ? properties : [];
    const ids = rows.map((item) => item?.id).filter(Boolean);
    if (!ids.length) return rows;

    const needsDirectLookup = rows.some((item) => !Array.isArray(item.inmueble_fotos) || !item.inmueble_fotos.length);
    if (!needsDirectLookup) return rows;

    const { data: fotos, error } = await supabaseClient
      .from('inmueble_fotos')
      .select('inmueble_id, storage_path, url_publica, es_principal, created_at')
      .in('inmueble_id', ids)
      .order('created_at', { ascending: true });

    if (error || !Array.isArray(fotos)) return rows;

    const photosByProperty = new Map();
    fotos.forEach((foto) => {
      const list = photosByProperty.get(foto.inmueble_id) || [];
      list.push(foto);
      photosByProperty.set(foto.inmueble_id, list);
    });

    return rows.map((item) => ({
      ...item,
      inmueble_fotos: Array.isArray(item.inmueble_fotos) && item.inmueble_fotos.length
        ? item.inmueble_fotos
        : (photosByProperty.get(item.id) || [])
    }));
  }

  function renderPropertyDetailModal(inmuebleId){
    const inmueble = inmueblesCacheById.get(inmuebleId);
    if (!inmueble || !propertyDetailContentEl || !modalDetalleInmuebleEl) return;

    const fotos = normalizeFotos(inmueble.inmueble_fotos);
    const title = escapeHtml(inmueble.titulo || 'Inmueble');
    const code = escapeHtml(inmueble.codigo || 'Sin código');
    const negocio = inmueble.tipo_negocio === 'arriendo' ? 'Arriendo' : 'Venta';
    const type = escapeHtml(inmueble.tipo_inmueble || 'No especificado');
    const zone = escapeHtml([inmueble.zona, inmueble.ciudad].filter(Boolean).join(', ') || 'Ubicación no registrada');
    const areaText = inmueble.area_m2 ? `${Number(inmueble.area_m2)} m²` : 'No especificado';
    const habText = Number.isFinite(Number(inmueble.habitaciones)) ? `${inmueble.habitaciones} hab` : 'No especificado';
    const banosText = Number.isFinite(Number(inmueble.banos)) ? `${inmueble.banos} baños` : 'No especificado';
    const priceText = `${formatCOP(inmueble.precio)}${inmueble.tipo_negocio === 'arriendo' ? ' / mes' : ''}`;
    const descripcion = escapeHtml(inmueble.descripcion || 'Sin descripción adicional.');
    const whatsappHref = buildPropertyWhatsappUrl(inmueble);
    const carouselId = `property-detail-carousel-${inmuebleId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const carouselItems = (fotos.length ? fotos : [{ url_publica: FALLBACK_PROPERTY_IMG }]).map((foto, idx) => `
      <div class="carousel-item ${idx === 0 ? 'active' : ''}">
        <img src="${escapeHtml(foto.url_publica)}" alt="${title} - Foto ${idx + 1}">
      </div>
    `).join('');

    const carouselControls = fotos.length > 1 ? `
      <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Anterior</span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true"></span>
        <span class="visually-hidden">Siguiente</span>
      </button>
    ` : '';

    propertyDetailContentEl.innerHTML = `
      <div class="row g-4">
        <div class="col-lg-7">
          <div id="${carouselId}" class="carousel slide property-detail-carousel" data-bs-ride="false">
            <div class="carousel-inner">${carouselItems}</div>
            ${carouselControls}
          </div>
          <div class="small text-muted mt-2">${fotos.length || 1} foto(s) disponible(s)</div>
        </div>
        <div class="col-lg-5">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <span class="badge text-bg-dark">${negocio}</span>
            <span class="text-muted small">Cod. ${code}</span>
          </div>
          <h4 class="mb-1">${title}</h4>
          <p class="text-muted mb-3"><i class="fa-solid fa-location-dot me-1"></i>${zone}</p>
          <div class="detail-meta-grid mb-3">
            <span><i class="fa-solid fa-house me-1"></i>${type}</span>
            <span><i class="fa-solid fa-ruler-combined me-1"></i>${escapeHtml(areaText)}</span>
            <span><i class="fa-solid fa-bed me-1"></i>${escapeHtml(habText)}</span>
            <span><i class="fa-solid fa-bath me-1"></i>${escapeHtml(banosText)}</span>
          </div>
          <div class="h4 fw-bold mb-3" style="color: var(--brand);">${escapeHtml(priceText)}</div>
          <h6 class="mb-1">Descripción</h6>
          <p class="mb-0 text-muted">${descripcion}</p>
          <a href="${escapeHtml(whatsappHref)}" class="btn btn-primary mt-3" target="_blank" rel="noopener noreferrer">
            <i class="fab fa-whatsapp me-1"></i>Solicitar información
          </a>
        </div>
      </div>
    `;

    modalDetalleInmuebleTitleEl && (modalDetalleInmuebleTitleEl.textContent = inmueble.titulo || 'Detalle de inmueble');
    if (modalDetalleWhatsappEl){
      modalDetalleWhatsappEl.href = whatsappHref;
    }
    if (!modalDetalleInmuebleInstance){
      modalDetalleInmuebleInstance = bootstrap.Modal.getOrCreateInstance(modalDetalleInmuebleEl);
    }
    modalDetalleInmuebleInstance.show();
  }

  async function loadInmueblesFromSupabase(){
    if (!inmueblesListEl || !supabaseClient) return;
    const hasDetailModal = Boolean(propertyDetailContentEl && modalDetalleInmuebleEl);

    const { data, error } = await supabaseClient
      .from('inmuebles')
      .select(`
        id,
        codigo,
        titulo,
        tipo_negocio,
        tipo_inmueble,
        ciudad,
        zona,
        area_m2,
        habitaciones,
        banos,
        precio,
        descripcion,
        created_at,
        inmueble_fotos(storage_path, url_publica, es_principal, created_at)
      `)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(9);

    if (error){
      if (!inmueblesListEl.innerHTML.trim()) inmueblesListEl.innerHTML = defaultInmueblesMarkup;
      return;
    }

    if (!data?.length){
      inmueblesListEl.innerHTML = defaultInmueblesMarkup;
      return;
    }

    const hydratedData = await hydratePropertyPhotos(data);
    inmueblesCacheById.clear();
    hydratedData.forEach((item) => inmueblesCacheById.set(item.id, item));
    inmueblesListEl.innerHTML = hydratedData.map((inmueble) => {
      const isRent = inmueble.tipo_negocio === 'arriendo';
      const badgeLabel = isRent ? 'ARRIENDO' : 'VENTA';
      const badgeClass = isRent ? 'rent' : 'sale';
      const priceSuffix = isRent ? ' / mes' : '';
      const zone = [inmueble.zona, inmueble.ciudad].filter(Boolean).join(', ') || 'Ubicación no registrada';
      const areaText = inmueble.area_m2 ? `${Number(inmueble.area_m2)} m²` : 'N/D';
      const habText = Number.isFinite(Number(inmueble.habitaciones)) ? `${inmueble.habitaciones} hab` : 'N/D';
      const banosText = Number.isFinite(Number(inmueble.banos)) ? `${inmueble.banos} baños` : 'N/D';
      const photoUrl = getPrimaryPhotoUrl(inmueble.inmueble_fotos);
      const totalPhotos = normalizeFotos(inmueble.inmueble_fotos).length || 1;
      const code = escapeHtml(inmueble.codigo || 'Sin código');
      const title = escapeHtml(inmueble.titulo || 'Inmueble');
      const whatsappHref = buildPropertyWhatsappUrl(inmueble);

      return `
        <div class="col-md-6 col-lg-4">
          <article class="property-card">
            <img class="property-thumb" src="${escapeHtml(photoUrl)}" alt="${title}">
            <div class="property-body">
              <div class="property-head">
                <span class="property-type ${badgeClass}">${badgeLabel}</span>
                <span class="property-code">Cod. ${code}</span>
              </div>
              <h3 class="property-title">${title}</h3>
              <p class="property-zone"><i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(zone)}</p>
              <div class="property-meta">
                <span>${escapeHtml(areaText)}</span>
                <span>${escapeHtml(habText)}</span>
                <span>${escapeHtml(banosText)}</span>
              </div>
              <div class="property-price">${escapeHtml(formatCOP(inmueble.precio))}${priceSuffix}</div>
              <div class="small text-muted mb-2">${totalPhotos} foto(s)</div>
              <div class="property-actions">
                ${hasDetailModal ? `<button type="button" class="btn-property btn-ghost js-ver-detalle-inmueble" data-inmueble-id="${escapeHtml(inmueble.id)}">Ver detalle completo</button>` : '<a href="inmuebles.html" class="btn-property btn-ghost">Ver detalle completo</a>'}
                <a href="${escapeHtml(whatsappHref)}" class="btn-property" target="_blank" rel="noopener noreferrer">Solicitar Información</a>
              </div>
            </div>
          </article>
        </div>
      `;
    }).join('');
  }

  inmueblesListEl?.addEventListener('click', (event) => {
    const button = event.target.closest('.js-ver-detalle-inmueble');
    if (!button) return;
    const inmuebleId = button.getAttribute('data-inmueble-id');
    if (!inmuebleId) return;
    renderPropertyDetailModal(inmuebleId);
  });

  (function setupSupabaseForms(){
    const modalEl = document.getElementById('modalFormularios');
    if (!modalEl) return;

    const statusEl = document.getElementById('forms-status-alert');
    const formsListEl = document.getElementById('forms-list');
    const authPanel = document.getElementById('forms-auth-panel');
    const uploadPanel = document.getElementById('forms-upload-panel');
    const loginForm = document.getElementById('forms-login-form');
    const uploadForm = document.getElementById('forms-upload-form');
    const logoutBtn = document.getElementById('forms-logout-btn');
    const userEmailEl = document.getElementById('forms-user-email');
    const fileNameInput = document.getElementById('forms-file-name');
    const fileInput = document.getElementById('forms-file-input');

    function setFormsStatus(message, level){
      if (!statusEl) return;
      statusEl.className = `alert alert-${level || 'info'} mb-0`;
      statusEl.textContent = message;
    }

    function sanitizeFilePart(value){
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');
    }

    function extensionFromName(name){
      return extensionFromFileName(name) || 'pdf';
    }

    function prettyFormName(fileName){
      const base = String(fileName || '')
        .replace(/^\d+-/, '')
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      return base ? base.replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase()) : 'Formulario';
    }

    function formatFormDate(isoDate){
      if (!isoDate) return '';
      const d = new Date(isoDate);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-CO', { year:'numeric', month:'short', day:'2-digit' });
    }

    function setFormsAuthPanels(session){
      const hasSession = Boolean(session?.user);
      authPanel?.classList.toggle('d-none', hasSession);
      uploadPanel?.classList.toggle('d-none', !hasSession);
      userEmailEl && (userEmailEl.textContent = hasSession ? (session.user.email || 'usuario autenticado') : '');
    }

    async function refreshFormsSession(){
      if (!supabaseClient){
        setFormsStatus('No se pudo cargar el servicio de archivos.', 'danger');
        return null;
      }
      const { session, error } = await getSessionWithRetry();
      if (error){
        const message = String(error.message || '');
        if (/aborterror|lock broken/i.test(message)){
          setFormsStatus('Sincronizando sesión...', 'secondary');
        } else {
          setFormsStatus(`Error verificando sesión: ${message}`, 'danger');
        }
        return null;
      }
      setFormsAuthPanels(session);
      return session;
    }

    async function loadFormsList(retries = 1){
      if (!supabaseClient || !formsListEl) return;
      const session = await refreshFormsSession();
      const hasSession = Boolean(session?.user);
      setFormsStatus('Cargando formularios...', 'info');
      const { data, error } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .list('formularios', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

      if (error){
        const message = String(error.message || '');
        const isTransientLock = /aborterror|lock broken/i.test(message);
        if (isTransientLock && retries > 0){
          await new Promise((resolve) => window.setTimeout(resolve, 220));
          return loadFormsList(retries - 1);
        }
        if (isTransientLock){
          setFormsStatus('Sincronizando formularios...', 'secondary');
          formsListEl.innerHTML = '<li class="list-group-item text-muted">Sincronizando formularios, intenta de nuevo en un momento.</li>';
          return;
        }
        setFormsStatus(`No se pudieron cargar los formularios: ${message}`, 'warning');
        formsListEl.innerHTML = '<li class="list-group-item text-muted">Aún no hay formularios disponibles.</li>';
        return;
      }

      const files = (Array.isArray(data) ? data : []).filter((item) => isPublicFormFile(item?.name));
      if (!files.length){
        setFormsStatus('No hay formularios cargados todavía.', 'secondary');
        formsListEl.innerHTML = '<li class="list-group-item text-muted">Aún no hay formularios disponibles.</li>';
        return;
      }

      formsListEl.innerHTML = files.map((file) => {
        const path = `formularios/${file.name}`;
        const { data: urlData } = supabaseClient.storage.from(SUPABASE_FORMS_BUCKET).getPublicUrl(path);
        const publicUrl = urlData?.publicUrl || '#';
        const displayName = escapeHtml(prettyFormName(file.name));
        const fileDate = formatFormDate(file.created_at);
        const ext = escapeHtml(extensionFromName(file.name).toUpperCase());
        return `
          <li class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <div class="fw-semibold">${displayName}</div>
              <small class="text-muted">${ext}${fileDate ? ` · ${fileDate}` : ''}</small>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <a class="btn btn-sm btn-primary" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener" download>
                <i class="fa-solid fa-download me-1"></i>Descargar
              </a>
              ${hasSession ? `
                <button type="button" class="btn btn-sm btn-outline-secondary js-rename-form" data-form-name="${escapeHtml(file.name)}">
                  <i class="fa-solid fa-pen me-1"></i>Renombrar
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger js-delete-form" data-form-path="${escapeHtml(path)}">
                  <i class="fa-solid fa-trash me-1"></i>Eliminar
                </button>
              ` : ''}
            </div>
          </li>
        `;
      }).join('');

      setFormsStatus(`Se encontraron ${files.length} formulario(s).`, 'success');
    }

    modalEl.addEventListener('show.bs.modal', () => {
      refreshFormsSession()
        .then(() => loadFormsList())
        .catch((_err) => {
          setFormsStatus('No fue posible abrir el gestor en este momento.', 'warning');
        });
    });

    loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!supabaseClient) return;
      if (!loginForm.checkValidity()){
        loginForm.classList.add('was-validated');
        return;
      }
      setFormsStatus('Iniciando sesión...', 'info');
      const email = document.getElementById('forms-email')?.value.trim() || '';
      const password = document.getElementById('forms-password')?.value || '';
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error){
        setFormsStatus(`No fue posible iniciar sesión: ${error.message}`, 'danger');
        return;
      }
      loginForm.reset();
      loginForm.classList.remove('was-validated');
      await refreshFormsSession();
      setFormsStatus('Sesión iniciada. Ya puedes subir formularios.', 'success');
    });

    logoutBtn?.addEventListener('click', async () => {
      if (!supabaseClient) return;
      const { error } = await supabaseClient.auth.signOut();
      if (error){
        setFormsStatus(`No fue posible cerrar sesión: ${error.message}`, 'danger');
        return;
      }
      await refreshFormsSession();
      setFormsStatus('Sesión cerrada.', 'secondary');
    });

    uploadForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!supabaseClient) return;
      if (!uploadForm.checkValidity()){
        uploadForm.classList.add('was-validated');
        return;
      }
      const session = await refreshFormsSession();
      if (!session?.user){
        setFormsStatus('Debes iniciar sesión para subir formularios.', 'warning');
        return;
      }
      const displayName = String(fileNameInput?.value || '').trim();
      const file = fileInput?.files?.[0];
      if (!displayName || !file){
        setFormsStatus('Ingresa nombre y selecciona archivo.', 'warning');
        return;
      }

      const cleanName = sanitizeFilePart(displayName) || 'formulario';
      const ext = extensionFromName(file.name);
      const path = `formularios/${Date.now()}-${cleanName}.${ext}`;

      setFormsStatus('Subiendo formulario...', 'info');
      const { error } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });

      if (error){
        setFormsStatus(`No se pudo subir el formulario: ${error.message}`, 'danger');
        return;
      }

      setFormsStatus('Formulario subido correctamente.', 'success');
      showAdminSuccessModal('Formulario guardado', 'El formulario quedó disponible correctamente.');
      uploadForm.reset();
      uploadForm.classList.remove('was-validated');
      await loadFormsList();
    });

    formsListEl?.addEventListener('click', async (event) => {
      const renameBtn = event.target.closest('.js-rename-form');
      const deleteBtn = event.target.closest('.js-delete-form');
      if (!renameBtn && !deleteBtn) return;

      const session = await refreshFormsSession();
      if (!session?.user){
        setFormsStatus('Debes iniciar sesión para administrar formularios.', 'warning');
        return;
      }

      if (renameBtn){
        const currentName = String(renameBtn.getAttribute('data-form-name') || '');
        if (!currentName) return;
        const suggested = prettyFormName(currentName);
        const newDisplayName = window.prompt('Nuevo nombre del formulario:', suggested);
        if (newDisplayName === null) return;

        const cleanName = sanitizeFilePart(newDisplayName);
        if (!cleanName){
          setFormsStatus('El nombre ingresado no es válido.', 'warning');
          return;
        }

        const ext = extensionFromName(currentName);
        const newFileName = `${Date.now()}-${cleanName}.${ext}`;
        const fromPath = `formularios/${currentName}`;
        const toPath = `formularios/${newFileName}`;

        if (fromPath === toPath){
          setFormsStatus('El formulario ya tiene ese nombre.', 'secondary');
          return;
        }

        setFormsStatus('Renombrando formulario...', 'info');
        const { error } = await supabaseClient.storage.from(SUPABASE_FORMS_BUCKET).move(fromPath, toPath);
        if (error){
          setFormsStatus(`No se pudo renombrar: ${error.message}`, 'danger');
          return;
        }
        setFormsStatus('Formulario renombrado correctamente.', 'success');
        showAdminSuccessModal('Formulario actualizado', 'El nombre del formulario se actualizó correctamente.');
        await loadFormsList();
        return;
      }

      if (deleteBtn){
        const path = String(deleteBtn.getAttribute('data-form-path') || '');
        if (!path) return;
        const ok = window.confirm('¿Seguro que deseas eliminar este formulario? Esta acción no se puede deshacer.');
        if (!ok) return;

        setFormsStatus('Eliminando formulario...', 'info');
        const { error } = await supabaseClient.storage.from(SUPABASE_FORMS_BUCKET).remove([path]);
        if (error){
          setFormsStatus(`No se pudo eliminar: ${error.message}`, 'danger');
          return;
        }
        setFormsStatus('Formulario eliminado correctamente.', 'success');
        showAdminSuccessModal('Formulario eliminado', 'El formulario fue eliminado correctamente.');
        await loadFormsList();
      }
    });

    supabaseClient?.auth.onAuthStateChange((_event, session) => {
      setFormsAuthPanels(session);
    });
  })();

  (function setupPublicFormsList(){
    const listEl = document.getElementById('public-forms-list');
    const statusEl = document.getElementById('public-forms-status');
    const countEl = document.getElementById('public-forms-count');
    if (!listEl || !supabaseClient) return;

    function setPublicFormsStatus(message, level){
      if (statusEl) statusEl.textContent = message;
      if (!countEl) return;
      if (level === 'error'){
        countEl.className = 'badge bg-danger-subtle text-danger-emphasis';
      } else {
        countEl.className = 'badge bg-light text-dark';
      }
    }

    function extensionFromName(name){
      return extensionFromFileName(name) || 'pdf';
    }

    function prettyName(fileName){
      const base = String(fileName || '')
        .replace(/^\d+-/, '')
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      return base || 'Formulario';
    }

    function formatDate(isoDate){
      if (!isoDate) return '';
      const d = new Date(isoDate);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
    }

    async function loadPublicForms(){
      setPublicFormsStatus('Actualizando...', 'info');
      listEl.innerHTML = '<div class="col-12"><div class="form-card text-center text-muted">Cargando formularios...</div></div>';
      const { data, error } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .list('formularios', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

      if (error){
        setPublicFormsStatus('No fue posible cargar formularios.', 'error');
        listEl.innerHTML = `<div class="col-12"><div class="form-card text-center text-muted">No se pudieron cargar formularios: ${escapeHtml(error.message)}</div></div>`;
        countEl && (countEl.textContent = '0 formularios');
        return;
      }

      const files = (Array.isArray(data) ? data : []).filter((item) => isPublicFormFile(item?.name));
      if (!files.length){
        setPublicFormsStatus('Sin formularios publicados.', 'info');
        listEl.innerHTML = '<div class="col-12"><div class="form-card text-center text-muted">Aún no hay formularios disponibles.</div></div>';
        countEl && (countEl.textContent = '0 formularios');
        return;
      }

      countEl && (countEl.textContent = `${files.length} formularios`);
      setPublicFormsStatus(`Actualizado: ${new Date().toLocaleString('es-CO')}`, 'ok');
      listEl.innerHTML = files.map((file) => {
        const path = `formularios/${file.name}`;
        const { data: urlData } = supabaseClient.storage.from(SUPABASE_FORMS_BUCKET).getPublicUrl(path);
        const publicUrl = urlData?.publicUrl || '#';
        const name = escapeHtml(prettyName(file.name));
        const ext = escapeHtml(extensionFromName(file.name).toUpperCase());
        const date = formatDate(file.created_at);
        return `
          <div class="col-sm-6 col-lg-3">
            <article class="form-card">
              <div class="form-card-icon"><i class="fa-regular fa-file-lines"></i></div>
              <h3 class="form-card-title">${name}</h3>
              <p class="form-card-meta">${ext}${date ? ` · ${date}` : ''}</p>
              <a class="btn btn-sm btn-primary w-100" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener" download>
                <i class="fa-solid fa-download me-1"></i>Descargar
              </a>
            </article>
          </div>
        `;
      }).join('');
    }

    loadPublicForms();
  })();

  (function setupSiteThemeFromSupabase(){
    if (!supabaseClient) return;
    const bgInput = document.getElementById('theme-bg-color');
    const surfaceInput = document.getElementById('theme-surface-color');
    const brandInput = document.getElementById('theme-brand-color');
    const accentInput = document.getElementById('theme-accent-color');
    const heroImageInput = document.getElementById('theme-hero-image');
    const whatsappNumberInput = document.getElementById('theme-whatsapp-number');
    const menuPhoneInput = document.getElementById('theme-menu-phone');
    const pseLinkInput = document.getElementById('theme-pse-link');
    const heroFileInput = document.getElementById('theme-hero-file');
    const uploadHeroBtn = document.getElementById('upload-theme-hero-btn');
    const saveBtn = document.getElementById('save-theme-config-btn');
    const saveContactBtn = document.getElementById('save-contact-config-btn');
    const statusEl = document.getElementById('theme-config-status');

    function setThemeStatus(message, level){
      if (!statusEl) return;
      statusEl.className = `alert alert-${level || 'secondary'} py-2 mb-3`;
      statusEl.textContent = message;
    }

    async function downloadThemeConfig(path){
      const { data: fileBlob, error: downloadError } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .download(path);
      if (downloadError || !fileBlob) return null;

      try {
        const parsed = JSON.parse(await fileBlob.text());
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_err){
        return null;
      }
    }

    async function loadLatestThemeConfig(){
      const latestConfig = await downloadThemeConfig(`formularios/${SITE_THEME_CONFIG_LATEST_FILE}`);
      if (latestConfig){
        return latestConfig;
      }

      const { data, error } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .list('formularios', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
      if (error || !Array.isArray(data)) return null;

      const configFile = data.find((item) => isThemeConfigFile(item?.name));
      if (!configFile?.name) return null;
      return downloadThemeConfig(`formularios/${configFile.name}`);
    }

    async function applyStoredTheme(){
      const cached = readCachedThemeConfig();
      if (cached){
        applyThemeConfig(cached);
      }

      const config = await loadLatestThemeConfig();
      const themeToApply = normalizeThemeConfig(config) || cached || THEME_DEFAULTS;
      const applied = applyThemeConfig(themeToApply);
      if (config){
        cacheThemeConfig(config);
      }
      if (bgInput) bgInput.value = applied.bg;
      if (surfaceInput) surfaceInput.value = applied.surface;
      if (brandInput) brandInput.value = applied.brand;
      if (accentInput) accentInput.value = applied.accent;
      if (heroImageInput) heroImageInput.value = applied.heroImage;
      if (whatsappNumberInput) whatsappNumberInput.value = applied.whatsappNumber;
      if (menuPhoneInput) menuPhoneInput.value = applied.menuPhone;
      if (pseLinkInput) pseLinkInput.value = applied.pseLink;
      if (statusEl){
        if (config){
          setThemeStatus('Diseño visual cargado correctamente.', 'success');
        } else if (cached){
          setThemeStatus('Diseño visual cargado desde caché local.', 'secondary');
        } else {
          setThemeStatus('Usando diseño visual predeterminado.', 'secondary');
        }
      }
    }

    function refreshAdminPreview(){
      const previewFrame = document.getElementById('admin-preview');
      try {
        previewFrame?.contentWindow?.location?.reload();
      } catch (_err){
        // ignore iframe refresh errors
      }
    }

    async function saveThemeConfigPayload(payload){
      setThemeStatus('Guardando diseño visual...', 'info');
      const fileName = `${SITE_THEME_CONFIG_PREFIX}_${Date.now()}.json`;
      const path = `formularios/${fileName}`;
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const { error } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .upload(path, blob, { upsert: false, contentType: 'application/json' });

      if (error){
        setThemeStatus(`No se pudo guardar: ${error.message}`, 'danger');
        return false;
      }

      applyThemeConfig(payload);
      cacheThemeConfig(payload);
      await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .upload(`formularios/${SITE_THEME_CONFIG_LATEST_FILE}`, blob, { upsert: true, contentType: 'application/json' });
      setThemeStatus('Diseño visual actualizado.', 'success');
      showAdminSuccessModal('Configuración guardada', 'Los cambios del sitio se guardaron correctamente.');
      refreshAdminPreview();
      return true;
    }

    async function saveCurrentThemeConfig(){
      if (!bgInput || !surfaceInput || !brandInput || !accentInput || !heroImageInput) return;
      const { session, error: sessionError } = await getSessionWithRetry();
      if (sessionError || !session?.user){
        setThemeStatus('Debes iniciar sesión para guardar el diseño.', 'warning');
        return;
      }

      const payload = {
        bg: bgInput.value || THEME_DEFAULTS.bg,
        surface: surfaceInput.value || THEME_DEFAULTS.surface,
        brand: brandInput.value || THEME_DEFAULTS.brand,
        accent: accentInput.value || THEME_DEFAULTS.accent,
        heroImage: heroImageInput.value.trim() || THEME_DEFAULTS.heroImage,
        whatsappNumber: normalizePhoneNumber(whatsappNumberInput?.value) || THEME_DEFAULTS.whatsappNumber,
        menuPhone: normalizePhoneNumber(menuPhoneInput?.value) || normalizePhoneNumber(whatsappNumberInput?.value) || THEME_DEFAULTS.menuPhone,
        pseLink: normalizeOptionalUrl(pseLinkInput?.value),
        updated_at: new Date().toISOString(),
        updated_by: session.user.email || session.user.id
      };

      const ok = await saveThemeConfigPayload(payload);
      if (!ok){
        return;
      }
    }

    saveBtn?.addEventListener('click', saveCurrentThemeConfig);
    saveContactBtn?.addEventListener('click', saveCurrentThemeConfig);

    uploadHeroBtn?.addEventListener('click', async () => {
      const file = heroFileInput?.files?.[0];
      if (!file){
        setThemeStatus('Selecciona una imagen para subir.', 'warning');
        return;
      }
      if (!String(file.type || '').startsWith('image/')){
        setThemeStatus('El archivo debe ser una imagen.', 'warning');
        return;
      }

      const { session, error: sessionError } = await getSessionWithRetry();
      if (sessionError || !session?.user){
        setThemeStatus('Debes iniciar sesión para subir la imagen.', 'warning');
        return;
      }

      const cleanBaseName = sanitizeFileToken(file.name.replace(/\.[^/.]+$/, '')) || 'portada';
      const ext = extensionFromFileName(file.name) || 'jpg';
      const path = `formularios/hero-${Date.now()}-${cleanBaseName}.${ext}`;

      setThemeStatus('Subiendo imagen de portada...', 'info');
      const { error } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });

      if (error){
        setThemeStatus(`No se pudo subir la imagen: ${error.message}`, 'danger');
        return;
      }

      const { data: urlData } = supabaseClient.storage.from(SUPABASE_FORMS_BUCKET).getPublicUrl(path);
      const publicUrl = urlData?.publicUrl || '';
      if (!publicUrl){
        setThemeStatus('Se subió la imagen, pero no se pudo generar la URL pública.', 'warning');
        return;
      }

      if (heroImageInput) heroImageInput.value = publicUrl;
      applyThemeConfig({
        bg: bgInput?.value || THEME_DEFAULTS.bg,
        surface: surfaceInput?.value || THEME_DEFAULTS.surface,
        brand: brandInput?.value || THEME_DEFAULTS.brand,
        accent: accentInput?.value || THEME_DEFAULTS.accent,
        heroImage: publicUrl,
        whatsappNumber: normalizePhoneNumber(whatsappNumberInput?.value) || THEME_DEFAULTS.whatsappNumber,
        menuPhone: normalizePhoneNumber(menuPhoneInput?.value) || normalizePhoneNumber(whatsappNumberInput?.value) || THEME_DEFAULTS.menuPhone,
        pseLink: normalizeOptionalUrl(pseLinkInput?.value)
      });

      const payload = {
        bg: bgInput?.value || THEME_DEFAULTS.bg,
        surface: surfaceInput?.value || THEME_DEFAULTS.surface,
        brand: brandInput?.value || THEME_DEFAULTS.brand,
        accent: accentInput?.value || THEME_DEFAULTS.accent,
        heroImage: publicUrl,
        whatsappNumber: normalizePhoneNumber(whatsappNumberInput?.value) || THEME_DEFAULTS.whatsappNumber,
        menuPhone: normalizePhoneNumber(menuPhoneInput?.value) || normalizePhoneNumber(whatsappNumberInput?.value) || THEME_DEFAULTS.menuPhone,
        pseLink: normalizeOptionalUrl(pseLinkInput?.value),
        updated_at: new Date().toISOString(),
        updated_by: session.user.email || session.user.id
      };
      const saved = await saveThemeConfigPayload(payload);
      if (saved && heroFileInput){
        heroFileInput.value = '';
      }
    });

    [bgInput, surfaceInput, brandInput, accentInput, heroImageInput, whatsappNumberInput, menuPhoneInput, pseLinkInput].forEach((el) => {
      el?.addEventListener('input', () => {
        applyThemeConfig({
          bg: bgInput?.value || THEME_DEFAULTS.bg,
          surface: surfaceInput?.value || THEME_DEFAULTS.surface,
          brand: brandInput?.value || THEME_DEFAULTS.brand,
          accent: accentInput?.value || THEME_DEFAULTS.accent,
          heroImage: heroImageInput?.value?.trim() || THEME_DEFAULTS.heroImage,
          whatsappNumber: normalizePhoneNumber(whatsappNumberInput?.value) || THEME_DEFAULTS.whatsappNumber,
          menuPhone: normalizePhoneNumber(menuPhoneInput?.value) || normalizePhoneNumber(whatsappNumberInput?.value) || THEME_DEFAULTS.menuPhone,
          pseLink: normalizeOptionalUrl(pseLinkInput?.value)
        });
      });
    });

    applyStoredTheme();
  })();

  (function setupSiteTypographyFromSupabase(){
    if (!supabaseClient) return;
    const headingSelect = document.getElementById('font-heading-select');
    const bodySelect = document.getElementById('font-body-select');
    const saveBtn = document.getElementById('save-font-config-btn');
    const statusEl = document.getElementById('font-config-status');

    function setFontStatus(message, level){
      if (!statusEl) return;
      statusEl.className = `alert alert-${level || 'secondary'} py-2 mb-3`;
      statusEl.textContent = message;
    }

    async function loadLatestFontConfig(){
      const { data, error } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .list('formularios', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
      if (error || !Array.isArray(data)) return null;

      const configFile = data.find((item) => isFontConfigFile(item?.name));
      if (!configFile?.name) return null;

      const { data: fileBlob, error: downloadError } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .download(`formularios/${configFile.name}`);
      if (downloadError || !fileBlob) return null;

      try {
        const parsed = JSON.parse(await fileBlob.text());
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_err){
        return null;
      }
    }

    async function applyStoredTypography(){
      const config = await loadLatestFontConfig();
      const applied = applyTypographyConfig(config || {});
      if (headingSelect) headingSelect.value = applied.headingKey;
      if (bodySelect) bodySelect.value = applied.bodyKey;
      if (statusEl){
        if (config){
          setFontStatus(`Fuente activa: títulos ${applied.headingKey}, contenido ${applied.bodyKey}.`, 'success');
        } else {
          setFontStatus('Usando tipografía predeterminada.', 'secondary');
        }
      }
    }

    saveBtn?.addEventListener('click', async () => {
      if (!headingSelect || !bodySelect) return;
      const heading = headingSelect.value;
      const body = bodySelect.value;
      if (!FONT_OPTIONS[heading] || !FONT_OPTIONS[body]){
        setFontStatus('Selección de fuente inválida.', 'warning');
        return;
      }

      const { session, error: sessionError } = await getSessionWithRetry();
      if (sessionError || !session?.user){
        setFontStatus('Debes iniciar sesión para guardar la tipografía.', 'warning');
        return;
      }

      setFontStatus('Guardando tipografía...', 'info');
      const payload = {
        heading,
        body,
        updated_at: new Date().toISOString(),
        updated_by: session.user.email || session.user.id
      };
      const fileName = `${SITE_FONT_CONFIG_PREFIX}_${Date.now()}.json`;
      const path = `formularios/${fileName}`;
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

      const { error } = await supabaseClient.storage
        .from(SUPABASE_FORMS_BUCKET)
        .upload(path, blob, { upsert: false, contentType: 'application/json' });

      if (error){
        setFontStatus(`No se pudo guardar: ${error.message}`, 'danger');
        return;
      }

      applyTypographyConfig(payload);
      setFontStatus('Tipografía actualizada correctamente.', 'success');
      showAdminSuccessModal('Tipografía guardada', 'La tipografía del sitio se actualizó correctamente.');
    });

    applyStoredTypography();
  })();

  (function setupSupabaseUpload(){
    const modalEl = document.getElementById('modalSubirFotosInmueble');
    if (!modalEl) return;
    const PROPERTY_FORM_HISTORY_KEY = 'zci_property_form_history_v1';

    const statusEl = document.getElementById('supabase-upload-status');
    const authPanel = document.getElementById('supabase-auth-panel');
    const uploaderPanel = document.getElementById('supabase-uploader-panel');
    const loginForm = document.getElementById('supabase-login-form');
    const uploadForm = document.getElementById('supabase-upload-form');
    const userEmailEl = document.getElementById('supabase-user-email');
    const logoutBtn = document.getElementById('supabase-logout-btn');
    const fillLastBtn = document.getElementById('supabase-fill-last-btn');
    const suggestTitleBtn = document.getElementById('supabase-suggest-title-btn');
    const typeInput = document.getElementById('supabase-property-type');
    const cityInput = document.getElementById('supabase-property-city');
    const zoneInput = document.getElementById('supabase-property-zone');
    const titleInput = document.getElementById('supabase-property-title');
    const businessInput = document.getElementById('supabase-property-business');
    const areaInput = document.getElementById('supabase-property-area');
    const bedroomsInput = document.getElementById('supabase-property-bedrooms');
    const bathroomsInput = document.getElementById('supabase-property-bathrooms');
    const priceInput = document.getElementById('supabase-property-price');
    const descriptionInput = document.getElementById('supabase-property-description');
    const photoFilesInput = document.getElementById('supabase-photo-files');
    const activeInput = document.getElementById('supabase-property-active');
    const editPropertyIdInput = document.getElementById('supabase-edit-property-id');
    const savePropertyBtn = document.getElementById('supabase-save-property-btn');
    const newPropertyBtn = document.getElementById('supabase-new-property-btn');
    const propertiesAdminListEl = document.getElementById('supabase-properties-admin-list');
    const livePreviewEl = document.getElementById('supabase-property-live-preview');
    const pricePreview = document.getElementById('supabase-price-preview');
    const codeInput = document.getElementById('supabase-property-code');
    const codeHint = document.getElementById('supabase-code-hint');
    let adminProperties = [];
    let previewImageUrl = '';
    let refreshSessionInFlight = null;
    let adminPropertiesLoadSeq = 0;

    function clearPreviewImageUrl(){
      if (previewImageUrl){
        URL.revokeObjectURL(previewImageUrl);
        previewImageUrl = '';
      }
    }

    function normalizeHistory(data){
      const base = { types: [], cities: [], zones: [], titles: [], lastForm: null };
      if (!data || typeof data !== 'object') return base;
      return {
        types: Array.isArray(data.types) ? data.types : [],
        cities: Array.isArray(data.cities) ? data.cities : [],
        zones: Array.isArray(data.zones) ? data.zones : [],
        titles: Array.isArray(data.titles) ? data.titles : [],
        lastForm: data.lastForm && typeof data.lastForm === 'object' ? data.lastForm : null
      };
    }

    function getFormHistory(){
      try{
        return normalizeHistory(JSON.parse(localStorage.getItem(PROPERTY_FORM_HISTORY_KEY) || '{}'));
      } catch (_err){
        return normalizeHistory(null);
      }
    }

    function saveFormHistory(history){
      try{
        localStorage.setItem(PROPERTY_FORM_HISTORY_KEY, JSON.stringify(normalizeHistory(history)));
      } catch (_err){
        // ignore localStorage errors
      }
    }

    function appendUnique(items, value, max = 20){
      const clean = String(value || '').trim();
      if (!clean) return items;
      const lower = clean.toLowerCase();
      const without = (Array.isArray(items) ? items : []).filter((item) => String(item).trim().toLowerCase() !== lower);
      return [clean, ...without].slice(0, max);
    }

    function syncDatalist(datalistId, values){
      const datalist = document.getElementById(datalistId);
      if (!datalist) return;
      const existingValues = Array.from(datalist.querySelectorAll('option')).map((o) => o.value);
      const merged = Array.from(new Set([...existingValues, ...(Array.isArray(values) ? values : [])])).filter(Boolean).slice(0, 30);
      datalist.innerHTML = merged.map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
    }

    function capitalizeWords(text){
      return String(text || '')
        .toLowerCase()
        .replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase());
    }

    function buildSuggestedTitle(){
      const tipo = capitalizeWords(typeInput?.value || '').trim();
      const zona = capitalizeWords(zoneInput?.value || '').trim();
      const ciudad = capitalizeWords(cityInput?.value || '').trim();
      const negocio = businessInput?.value === 'arriendo' ? 'en Arriendo' : (businessInput?.value === 'venta' ? 'en Venta' : '');
      const lugar = zona || ciudad;
      if (tipo && lugar && negocio) return `${tipo} ${negocio} en ${lugar}`;
      if (tipo && lugar) return `${tipo} en ${lugar}`;
      if (tipo && negocio) return `${tipo} ${negocio}`;
      return '';
    }

    function updatePricePreview(){
      if (!pricePreview) return;
      const value = Number(priceInput?.value || 0);
      const formatted = Number.isFinite(value) && value > 0 ? formatCOP(value) : '$0';
      pricePreview.textContent = `Formato: ${formatted}`;
    }

    function getCurrentEditingProperty(){
      const id = String(editPropertyIdInput?.value || '').trim();
      if (!id) return null;
      return adminProperties.find((item) => item.id === id) || null;
    }

    function renderLivePreview(){
      if (!livePreviewEl) return;
      const title = (titleInput?.value || '').trim() || 'Título del inmueble';
      const code = (codeInput?.value || '').trim().toUpperCase() || '---';
      const businessValue = businessInput?.value || '';
      const badgeLabel = businessValue === 'arriendo' ? 'ARRIENDO' : (businessValue === 'venta' ? 'VENTA' : 'SIN DEFINIR');
      const badgeClass = businessValue === 'arriendo' ? 'rent' : 'sale';
      const type = (typeInput?.value || '').trim() || 'Tipo';
      const city = (cityInput?.value || '').trim();
      const zone = (zoneInput?.value || '').trim();
      const zoneLabel = [zone, city].filter(Boolean).join(', ') || 'Ubicación';
      const areaText = areaInput?.value ? `${areaInput.value} m²` : 'N/D';
      const bedroomsText = bedroomsInput?.value ? `${bedroomsInput.value} hab` : 'N/D';
      const bathroomsText = bathroomsInput?.value ? `${bathroomsInput.value} baños` : 'N/D';
      const priceText = priceInput?.value ? formatCOP(priceInput.value) : '$0';
      const description = (descriptionInput?.value || '').trim() || 'Agrega una descripción para mostrarla aquí.';
      const isVisible = activeInput?.checked !== false;
      const editingProperty = getCurrentEditingProperty();
      const currentPhotoUrl = previewImageUrl || getPrimaryPhotoUrl(editingProperty?.inmueble_fotos);

      livePreviewEl.innerHTML = `
        <article class="property-card mb-2">
          <img class="property-thumb" src="${escapeHtml(currentPhotoUrl)}" alt="${escapeHtml(title)}">
          <div class="property-body">
            <div class="property-head">
              <span class="property-type ${badgeClass}">${badgeLabel}</span>
              <span class="property-code">Cod. ${escapeHtml(code)}</span>
            </div>
            <h3 class="property-title">${escapeHtml(title)}</h3>
            <p class="property-zone"><i class="fa-solid fa-location-dot me-1"></i>${escapeHtml(zoneLabel)}</p>
            <div class="property-meta">
              <span>${escapeHtml(type)}</span>
              <span>${escapeHtml(areaText)}</span>
              <span>${escapeHtml(bedroomsText)}</span>
              <span>${escapeHtml(bathroomsText)}</span>
            </div>
            <div class="property-price">${escapeHtml(priceText)}${businessValue === 'arriendo' ? ' / mes' : ''}</div>
            <div class="small ${isVisible ? 'text-success' : 'text-warning'}">
              ${isVisible ? 'Visible en el sitio público' : 'Oculto en el sitio público'}
            </div>
            <p class="small text-muted mb-0 mt-2">${escapeHtml(description)}</p>
          </div>
        </article>
      `;
    }

    function applyHistorySuggestions(){
      const history = getFormHistory();
      syncDatalist('property-type-suggestions', history.types);
      syncDatalist('property-city-suggestions', history.cities);
      syncDatalist('property-zone-suggestions', history.zones);
    }

    function extractNumericCode(code){
      const digits = String(code || '').replace(/\D+/g, '');
      return digits ? Number(digits) : null;
    }

    async function getNextConsecutiveCode(){
      if (!supabaseClient) return null;
      const { data, error } = await supabaseClient
        .from('inmuebles')
        .select('codigo')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error || !Array.isArray(data)) return null;
      const maxFound = data.reduce((max, row) => {
        const n = extractNumericCode(row?.codigo);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
      return String((maxFound || 0) + 1);
    }

    async function suggestNextConsecutiveCode(force = false){
      if (!codeInput) return;
      if (editPropertyIdInput?.value && !force) return;
      const hasManualValue = codeInput.value.trim().length > 0;
      if (hasManualValue && !force) return;
      const nextCode = await getNextConsecutiveCode();
      if (!nextCode) return;
      codeInput.value = nextCode;
      codeHint && (codeHint.textContent = `Consecutivo sugerido: ${nextCode}`);
      renderLivePreview();
    }

    function fillFromLastForm(){
      const history = getFormHistory();
      const last = history.lastForm;
      if (!last){
        setStatus('Aún no hay datos previos para autollenar.', 'warning');
        return;
      }
      titleInput && (titleInput.value = last.titulo || '');
      businessInput && (businessInput.value = last.tipo_negocio || '');
      typeInput && (typeInput.value = last.tipo_inmueble || '');
      cityInput && (cityInput.value = last.ciudad || '');
      zoneInput && (zoneInput.value = last.zona || '');
      areaInput && (areaInput.value = last.area_m2 || '');
      bedroomsInput && (bedroomsInput.value = last.habitaciones || '');
      bathroomsInput && (bathroomsInput.value = last.banos || '');
      priceInput && (priceInput.value = last.precio || '');
      descriptionInput && (descriptionInput.value = last.descripcion || '');
      updatePricePreview();
      renderLivePreview();
      setStatus('Formulario autollenado con el último inmueble.', 'info');
    }

    function setSaveButtonMode(isEditing){
      if (savePropertyBtn){
        savePropertyBtn.textContent = isEditing ? 'Actualizar inmueble' : 'Guardar inmueble';
      }
      if (photoFilesInput){
        photoFilesInput.required = !isEditing;
      }
      codeHint && (codeHint.textContent = isEditing ? 'Editando inmueble existente.' : 'Se asigna automaticamente por consecutivo.');
    }

    function resetPropertyForm(){
      clearPreviewImageUrl();
      uploadForm?.reset();
      if (photoFilesInput) photoFilesInput.value = '';
      uploadForm?.classList.remove('was-validated');
      if (editPropertyIdInput) editPropertyIdInput.value = '';
      if (activeInput) activeInput.checked = true;
      updatePricePreview();
      setSaveButtonMode(false);
      renderLivePreview();
      suggestNextConsecutiveCode(true);
    }

    function fillPropertyForm(inmueble){
      if (!inmueble) return;
      clearPreviewImageUrl();
      if (photoFilesInput) photoFilesInput.value = '';
      if (editPropertyIdInput) editPropertyIdInput.value = inmueble.id || '';
      codeInput && (codeInput.value = inmueble.codigo || '');
      titleInput && (titleInput.value = inmueble.titulo || '');
      businessInput && (businessInput.value = inmueble.tipo_negocio || '');
      typeInput && (typeInput.value = inmueble.tipo_inmueble || '');
      cityInput && (cityInput.value = inmueble.ciudad || '');
      zoneInput && (zoneInput.value = inmueble.zona || '');
      areaInput && (areaInput.value = Number.isFinite(Number(inmueble.area_m2)) ? inmueble.area_m2 : '');
      bedroomsInput && (bedroomsInput.value = Number.isFinite(Number(inmueble.habitaciones)) ? inmueble.habitaciones : '');
      bathroomsInput && (bathroomsInput.value = Number.isFinite(Number(inmueble.banos)) ? inmueble.banos : '');
      priceInput && (priceInput.value = Number.isFinite(Number(inmueble.precio)) ? inmueble.precio : '');
      descriptionInput && (descriptionInput.value = inmueble.descripcion || '');
      activeInput && (activeInput.checked = inmueble.activo !== false);
      updatePricePreview();
      setSaveButtonMode(true);
      renderLivePreview();
      setStatus(`Editando inmueble ${inmueble.codigo || inmueble.id}.`, 'info');
    }

    function renderAdminPropertyList(){
      if (!propertiesAdminListEl) return;
      if (!adminProperties.length){
        propertiesAdminListEl.innerHTML = '<div class="list-group-item text-muted">No hay inmuebles registrados.</div>';
        return;
      }
      propertiesAdminListEl.innerHTML = adminProperties.map((item) => {
        const zone = [item.zona, item.ciudad].filter(Boolean).join(', ') || 'Ubicación no registrada';
        const activeText = item.activo === false ? 'Oculto' : 'Visible';
        const activeClass = item.activo === false ? 'text-warning' : 'text-success';
        return `
          <div class="list-group-item d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold">${escapeHtml(item.titulo || 'Sin título')}</div>
              <div class="small text-muted">Cod. ${escapeHtml(item.codigo || '---')} · ${escapeHtml(zone)} · ${escapeHtml(formatCOP(item.precio || 0))}</div>
              <div class="small ${activeClass}">${activeText}</div>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-outline-primary btn-sm" data-action="edit-property" data-id="${escapeHtml(item.id)}">Editar</button>
              <button type="button" class="btn btn-outline-secondary btn-sm" data-action="toggle-property" data-id="${escapeHtml(item.id)}" data-active="${item.activo === false ? '0' : '1'}">
                ${item.activo === false ? 'Mostrar' : 'Ocultar'}
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm" data-action="delete-property" data-id="${escapeHtml(item.id)}">Eliminar</button>
            </div>
          </div>
        `;
      }).join('');
    }

    async function loadAdminProperties(retries = 1){
      if (!supabaseClient || !propertiesAdminListEl) return;
      const seq = ++adminPropertiesLoadSeq;
      const { data, error } = await supabaseClient
        .from('inmuebles')
        .select(`
          id,
          codigo,
          titulo,
          tipo_negocio,
          tipo_inmueble,
          ciudad,
          zona,
          area_m2,
          habitaciones,
          banos,
          precio,
          descripcion,
          activo,
          created_at,
          inmueble_fotos(storage_path, url_publica, es_principal, created_at)
        `)
        .order('created_at', { ascending: false })
        .limit(120);
      if (error){
        const message = String(error.message || '');
        const isTransientLock = /aborterror|lock broken/i.test(message);
        if (isTransientLock && retries > 0){
          await new Promise((resolve) => window.setTimeout(resolve, 220));
          return loadAdminProperties(retries - 1);
        }
        if (isTransientLock){
          propertiesAdminListEl.innerHTML = '<div class="list-group-item text-muted">Sincronizando inmuebles, vuelve a intentar en un momento.</div>';
          return;
        }
        propertiesAdminListEl.innerHTML = `<div class="list-group-item text-danger">No se pudieron cargar inmuebles: ${escapeHtml(message)}</div>`;
        return;
      }
      if (seq !== adminPropertiesLoadSeq) return;
      adminProperties = await hydratePropertyPhotos(Array.isArray(data) ? data : []);
      renderAdminPropertyList();
      renderLivePreview();
    }

    fillLastBtn?.addEventListener('click', fillFromLastForm);
    newPropertyBtn?.addEventListener('click', () => {
      resetPropertyForm();
      setStatus('Formulario listo para crear un nuevo inmueble.', 'info');
    });
    suggestTitleBtn?.addEventListener('click', () => {
      const suggestion = buildSuggestedTitle();
      if (!suggestion){
        setStatus('Completa tipo, ciudad o zona para sugerir el título.', 'warning');
        return;
      }
      if (titleInput) titleInput.value = suggestion;
      renderLivePreview();
      setStatus('Título sugerido aplicado.', 'info');
    });
    [codeInput, titleInput, typeInput, cityInput, zoneInput, businessInput, areaInput, bedroomsInput, bathroomsInput, descriptionInput].forEach((input) => {
      input?.addEventListener('input', () => {
        if (!titleInput?.value.trim()) {
          const suggestion = buildSuggestedTitle();
          if (suggestion && titleInput) titleInput.placeholder = suggestion;
        }
        renderLivePreview();
      });
    });
    [businessInput, activeInput].forEach((input) => {
      input?.addEventListener('change', renderLivePreview);
    });
    priceInput?.addEventListener('input', () => {
      updatePricePreview();
      renderLivePreview();
    });
    photoFilesInput?.addEventListener('change', () => {
      clearPreviewImageUrl();
      const firstFile = photoFilesInput.files?.[0];
      if (firstFile){
        previewImageUrl = URL.createObjectURL(firstFile);
      }
      renderLivePreview();
    });
    codeInput?.addEventListener('focus', () => {
      suggestNextConsecutiveCode(false);
    });
    applyHistorySuggestions();
    updatePricePreview();
    setSaveButtonMode(false);
    renderLivePreview();

    function setStatus(message, level){
      if (!statusEl) return;
      statusEl.className = `alert alert-${level || 'info'} mb-3`;
      statusEl.textContent = message;
    }

    function sanitizePathPart(value){
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');
    }

    function setPanels(session){
      const hasSession = Boolean(session?.user);
      authPanel?.classList.toggle('d-none', hasSession);
      uploaderPanel?.classList.toggle('d-none', !hasSession);

      if (hasSession){
        userEmailEl.textContent = session.user.email || 'usuario autenticado';
        setStatus('Sesión activa. Ya puedes crear y editar inmuebles.', 'success');
      } else {
        userEmailEl.textContent = '';
        setStatus('Para subir fotos debes iniciar sesión.', 'warning');
      }
    }

    async function refreshSession(){
      if (refreshSessionInFlight) return refreshSessionInFlight;
      refreshSessionInFlight = (async () => {
      if (!supabaseClient){
        setStatus('No se pudo cargar el servicio de datos. Revisa la conexión del sitio.', 'danger');
        return null;
      }
      const { session, error } = await getSessionWithRetry();
      if (error){
        const message = String(error.message || '');
        if (/aborterror|lock broken/i.test(message)){
          setStatus('Sincronizando sesión de administración...', 'secondary');
        } else {
          setStatus(`Error verificando sesión: ${message}`, 'danger');
        }
        return null;
      }
      setPanels(session);
      applyHistorySuggestions();
      if (session?.user){
        await suggestNextConsecutiveCode(false);
        await loadAdminProperties();
      }
      return session;
      })();
      try{
        return await refreshSessionInFlight;
      } finally {
        refreshSessionInFlight = null;
      }
    }

    modalEl.addEventListener('show.bs.modal', () => {
      refreshSession().catch((_err) => {
        setStatus('No fue posible sincronizar la sesión en este momento.', 'warning');
      });
    });

    loginForm?.addEventListener('submit', async (event)=>{
      event.preventDefault();
      if (!supabaseClient) return;
      if (!loginForm.checkValidity()){
        loginForm.classList.add('was-validated');
        return;
      }

      setStatus('Iniciando sesión...', 'info');
      const email = document.getElementById('supabase-email')?.value.trim() || '';
      const password = document.getElementById('supabase-password')?.value || '';
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error){
        setStatus(`No fue posible iniciar sesión: ${error.message}`, 'danger');
        return;
      }

      loginForm.reset();
      loginForm.classList.remove('was-validated');
      await refreshSession();
    });

    logoutBtn?.addEventListener('click', async ()=>{
      if (!supabaseClient) return;
      const { error } = await supabaseClient.auth.signOut();
      if (error){
        setStatus(`No fue posible cerrar sesión: ${error.message}`, 'danger');
        return;
      }
      resetPropertyForm();
      await refreshSession();
    });

    async function deletePropertyWithPhotos(propertyId){
      const selected = adminProperties.find((item) => item.id === propertyId);
      const label = selected?.codigo || selected?.titulo || propertyId;
      const confirmed = window.confirm(`¿Seguro que deseas eliminar el inmueble ${label}? También se eliminarán sus fotos. Esta acción no se puede deshacer.`);
      if (!confirmed) return;

      setStatus(`Eliminando inmueble ${label}...`, 'info');

      const { data: fotoRows, error: photosLoadError } = await supabaseClient
        .from('inmueble_fotos')
        .select('storage_path')
        .eq('inmueble_id', propertyId);
      if (photosLoadError){
        setStatus(`No se pudieron consultar las fotos del inmueble: ${photosLoadError.message}`, 'danger');
        return;
      }

      const storagePaths = Array.from(new Set((fotoRows || []).map((foto) => foto?.storage_path).filter(Boolean)));
      if (storagePaths.length){
        const { error: storageDeleteError } = await supabaseClient.storage
          .from(SUPABASE_BUCKET)
          .remove(storagePaths);
        if (storageDeleteError){
          setStatus(`No se pudieron eliminar las fotos: ${storageDeleteError.message}`, 'danger');
          return;
        }
      }

      const { error: photosDeleteError } = await supabaseClient
        .from('inmueble_fotos')
        .delete()
        .eq('inmueble_id', propertyId);
      if (photosDeleteError){
        setStatus(`No se pudieron eliminar los registros de fotos: ${photosDeleteError.message}`, 'danger');
        return;
      }

      const { data: deletedRows, error: propertyDeleteError } = await supabaseClient
        .from('inmuebles')
        .delete()
        .eq('id', propertyId)
        .select('id');
      if (propertyDeleteError){
        setStatus(`No se pudo eliminar el inmueble: ${propertyDeleteError.message}`, 'danger');
        return;
      }
      if (!Array.isArray(deletedRows) || !deletedRows.length){
        setStatus('No se eliminó el inmueble. Revisa permisos de eliminación del usuario admin.', 'warning');
        return;
      }

      if (editPropertyIdInput?.value === propertyId){
        resetPropertyForm();
      }
      setStatus(`Inmueble ${label} eliminado correctamente.`, 'success');
      showAdminSuccessModal('Inmueble eliminado', `El inmueble ${label} fue eliminado correctamente.`);
      await loadAdminProperties();
      await loadInmueblesFromSupabase();
    }

    propertiesAdminListEl?.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || !supabaseClient) return;
      const propertyId = button.getAttribute('data-id');
      if (!propertyId) return;
      const action = button.getAttribute('data-action');
      const session = await refreshSession();
      if (!session?.user) return;

      if (action === 'edit-property'){
        const selected = adminProperties.find((item) => item.id === propertyId);
        if (!selected){
          setStatus('No se encontró el inmueble para editar.', 'warning');
          return;
        }
        fillPropertyForm(selected);
        return;
      }

      if (action === 'toggle-property'){
        const currentActive = button.getAttribute('data-active') === '1';
        const nextActive = !currentActive;
        const { data: toggledRows, error } = await supabaseClient
          .from('inmuebles')
          .update({ activo: nextActive })
          .eq('id', propertyId)
          .select('id, activo');
        if (error){
          setStatus(`No se pudo actualizar visibilidad: ${error.message}`, 'danger');
          return;
        }
        if (!Array.isArray(toggledRows) || !toggledRows.length){
          setStatus('No se aplicó el cambio de visibilidad. Revisa permisos de edición del usuario.', 'warning');
          return;
        }
        setStatus(nextActive ? 'Inmueble visible en el sitio público.' : 'Inmueble oculto del sitio público.', 'success');
        showAdminSuccessModal('Visibilidad actualizada', nextActive ? 'El inmueble ya está visible en el sitio.' : 'El inmueble quedó oculto del sitio.');
        await loadAdminProperties();
        await loadInmueblesFromSupabase();
        return;
      }

      if (action === 'delete-property'){
        await deletePropertyWithPhotos(propertyId);
      }
    });

    uploadForm?.addEventListener('submit', async (event)=>{
      event.preventDefault();
      if (!supabaseClient) return;
      if (!uploadForm.checkValidity()){
        uploadForm.classList.add('was-validated');
        return;
      }

      const session = await refreshSession();
      if (!session?.user) return;

      const propertyCodeRaw = document.getElementById('supabase-property-code')?.value || '';
      const propertyCode = sanitizePathPart(propertyCodeRaw);
      const propertyCodeLabel = String(propertyCodeRaw || '').trim().toUpperCase();
      const editingId = String(editPropertyIdInput?.value || '').trim();
      const isEditing = Boolean(editingId);
      const propertyTitle = document.getElementById('supabase-property-title')?.value.trim() || '';
      const propertyBusiness = document.getElementById('supabase-property-business')?.value || '';
      const propertyType = document.getElementById('supabase-property-type')?.value.trim() || '';
      const propertyCity = document.getElementById('supabase-property-city')?.value.trim() || '';
      const propertyZone = document.getElementById('supabase-property-zone')?.value.trim() || null;
      const propertyArea = document.getElementById('supabase-property-area')?.value;
      const propertyBedrooms = document.getElementById('supabase-property-bedrooms')?.value;
      const propertyBathrooms = document.getElementById('supabase-property-bathrooms')?.value;
      const propertyPrice = document.getElementById('supabase-property-price')?.value;
      const propertyDescription = document.getElementById('supabase-property-description')?.value.trim() || null;
      const files = Array.from(document.getElementById('supabase-photo-files')?.files || []);
      const isActive = activeInput?.checked !== false;
      if (!propertyCode){
        setStatus('Ingresa un código de inmueble válido.', 'warning');
        return;
      }
      if (!propertyCodeLabel || !propertyTitle || !propertyBusiness || !propertyType || !propertyCity || !propertyPrice){
        setStatus('Completa los datos obligatorios del inmueble.', 'warning');
        return;
      }
      if (!files.length && !isEditing){
        setStatus('Selecciona al menos una imagen para subir.', 'warning');
        return;
      }

      const payload = {
        codigo: propertyCodeLabel,
        titulo: propertyTitle,
        tipo_negocio: propertyBusiness,
        tipo_inmueble: propertyType,
        ciudad: propertyCity,
        zona: propertyZone,
        area_m2: propertyArea ? Number(propertyArea) : null,
        habitaciones: propertyBedrooms ? Number(propertyBedrooms) : null,
        banos: propertyBathrooms ? Number(propertyBathrooms) : null,
        precio: Number(propertyPrice),
        descripcion: propertyDescription,
        activo: isActive
      };

      let inmuebleRow = null;
      if (isEditing){
        setStatus('Actualizando inmueble...', 'info');
        const { data: updatedRows, error } = await supabaseClient
          .from('inmuebles')
          .update(payload)
          .eq('id', editingId)
          .select('id, codigo');
        if (error){
          if ((error.message || '').toLowerCase().includes('duplicate key value')){
            setStatus('Ese código ya existe. Cambia el código y vuelve a intentar.', 'warning');
            return;
          }
          setStatus(`No se pudo actualizar el inmueble: ${error.message}`, 'danger');
          return;
        }
        const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : null;
        if (!updatedRow){
          setStatus('No se guardaron cambios. Tu usuario no tiene permiso de actualización sobre este inmueble.', 'warning');
          return;
        }
        inmuebleRow = updatedRow;
      } else {
        setStatus('Guardando datos del inmueble...', 'info');
        const { data, error } = await supabaseClient
          .from('inmuebles')
          .insert({
            ...payload,
            created_by: session.user.id
          })
          .select('id, codigo')
          .single();
        if (error){
          if ((error.message || '').toLowerCase().includes('duplicate key value')){
            await suggestNextConsecutiveCode(true);
            setStatus('El código ya existe. Asigné el siguiente consecutivo, revisa y vuelve a guardar.', 'warning');
            return;
          }
          setStatus(`No se pudo guardar el inmueble: ${error.message}`, 'danger');
          return;
        }
        inmuebleRow = data;
      }

      if (!files.length){
        const successText = isEditing
          ? `Inmueble ${inmuebleRow.codigo} actualizado correctamente.`
          : `Inmueble ${inmuebleRow.codigo} creado correctamente.`;
        setStatus(successText, 'success');
        showAdminSuccessModal(isEditing ? 'Inmueble actualizado' : 'Inmueble guardado', successText);
      } else {
        setStatus(`Subiendo ${files.length} archivo(s)...`, 'info');
        const uploadedUrls = [];
        const fotoRows = [];
        const baseTimestamp = Date.now();
        const existing = adminProperties.find((item) => item.id === inmuebleRow.id);
        const hasExistingPhotos = normalizeFotos(existing?.inmueble_fotos).length > 0;
        const replaceMainPhoto = isEditing && files.length > 0;

        if (replaceMainPhoto){
          const { error: clearMainError } = await supabaseClient
            .from('inmueble_fotos')
            .update({ es_principal: false })
            .eq('inmueble_id', inmuebleRow.id)
            .eq('es_principal', true);
          if (clearMainError){
            setStatus(`No se pudo actualizar la foto principal: ${clearMainError.message}`, 'danger');
            return;
          }
        }

        for (const [idx, file] of files.entries()){
          const cleanFileName = sanitizePathPart(file.name.replace(/\.[^/.]+$/, '')) || 'foto';
          const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `inmuebles/${propertyCode}/${session.user.id}/${baseTimestamp}-${idx + 1}-${cleanFileName}.${extension}`;

          const { error } = await supabaseClient.storage
            .from(SUPABASE_BUCKET)
            .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });

          if (error){
            setStatus(`Error subiendo "${file.name}": ${error.message}`, 'danger');
            return;
          }

          const { data } = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
          if (data?.publicUrl){
            uploadedUrls.push(data.publicUrl);
            fotoRows.push({
              inmueble_id: inmuebleRow.id,
              storage_path: path,
              url_publica: data.publicUrl,
              es_principal: replaceMainPhoto ? idx === 0 : (!hasExistingPhotos && idx === 0),
              created_by: session.user.id
            });
          }
        }

        if (fotoRows.length){
          const { error: fotosError } = await supabaseClient.from('inmueble_fotos').insert(fotoRows);
          if (fotosError){
            setStatus(`Fotos subidas, pero no se pudieron vincular al inmueble: ${fotosError.message}`, 'warning');
            return;
          }
        }

        const successText = isEditing
          ? `Inmueble ${inmuebleRow.codigo} actualizado y ${uploadedUrls.length} imagen(es) agregada(s).`
          : `Inmueble ${inmuebleRow.codigo} creado con ${uploadedUrls.length} imagen(es).`;
        setStatus(successText, 'success');
        showAdminSuccessModal(isEditing ? 'Inmueble actualizado' : 'Inmueble guardado', successText);
      }

      const history = getFormHistory();
      history.types = appendUnique(history.types, propertyType);
      history.cities = appendUnique(history.cities, propertyCity);
      history.zones = appendUnique(history.zones, propertyZone);
      history.titles = appendUnique(history.titles, propertyTitle);
      history.lastForm = {
        titulo: propertyTitle,
        tipo_negocio: propertyBusiness,
        tipo_inmueble: propertyType,
        ciudad: propertyCity,
        zona: propertyZone || '',
        area_m2: propertyArea || '',
        habitaciones: propertyBedrooms || '',
        banos: propertyBathrooms || '',
        precio: propertyPrice || '',
        descripcion: propertyDescription || ''
      };
      saveFormHistory(history);
      applyHistorySuggestions();

      if (isEditing){
        await loadAdminProperties();
        await loadInmueblesFromSupabase();
        const updatedProperty = adminProperties.find((item) => item.id === editingId) || null;
        if (updatedProperty){
          fillPropertyForm(updatedProperty);
        } else {
          resetPropertyForm();
        }
      } else {
        resetPropertyForm();
        await loadAdminProperties();
        await loadInmueblesFromSupabase();
      }
    });

    modalEl.addEventListener('hidden.bs.modal', () => {
      clearPreviewImageUrl();
    });

    supabaseClient?.auth.onAuthStateChange((_event, session) => {
      setPanels(session);
      if (session?.user){
        loadAdminProperties().catch((_err) => {
          setStatus('No fue posible actualizar el listado de inmuebles.', 'warning');
        });
      }
    });
  })();

  document.addEventListener('DOMContentLoaded', () => {
    loadInmueblesFromSupabase();
  });

  // ========= Noticias: render siempre visible + actualización automática =========
  (function setupNews(){
    const list = document.getElementById('news-list');
    const count = document.getElementById('news-count');
    const search = document.getElementById('news-search');
    const tagsWrap = document.getElementById('news-tags');
    const lastUpdate = document.getElementById('news-last-update');
    if (!list || !count) return;

    let allItems = [...NEWS_FALLBACK_ITEMS];
    let activeTag = null;

    function fmtDate(iso){
      if(!iso) return '';
      const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
      return d.toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'2-digit'});
    }

    function inferTags(title){
      const t = (title || '').toLowerCase();
      const tags = [];
      if (/(arriendo|arrendamiento|canon)/.test(t)) tags.push('Arriendos');
      if (/(venta|comprar|precio)/.test(t)) tags.push('Venta');
      if (/(vivienda|casa|apartamento|inmueble)/.test(t)) tags.push('Vivienda');
      if (/(medell[ií]n|antioquia)/.test(t)) tags.push('Medellín');
      if (/(norma|ley|decreto|propiedad horizontal)/.test(t)) tags.push('Normatividad');
      return tags.length ? tags : ['Mercado'];
    }

    function safeUrl(url){
      try{
        const u = new URL(url, window.location.origin);
        return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '#';
      } catch (_err){
        return '#';
      }
    }

    async function fetchNewsFromRss(){
      const proxy = 'https://api.allorigins.win/raw?url=';
      const requests = NEWS_RSS_SOURCES.map(async (src) => {
        try{
          const response = await fetch(`${proxy}${encodeURIComponent(src.url)}`, { cache: 'no-store' });
          if (!response.ok) return [];
          const xmlText = await response.text();
          const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
          const items = Array.from(doc.querySelectorAll('item')).slice(0, 8);
          return items.map((item) => {
            const title = item.querySelector('title')?.textContent?.trim() || '';
            const link = item.querySelector('link')?.textContent?.trim() || '#';
            const pubDateRaw = item.querySelector('pubDate')?.textContent?.trim() || '';
            const sourceLabel = item.querySelector('source')?.textContent?.trim() || src.source;
            const dt = pubDateRaw ? new Date(pubDateRaw) : null;
            const dateIso = dt && !Number.isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : '';
            return { title, url: link, source: sourceLabel, date: dateIso, tags: inferTags(title) };
          }).filter((n) => n.title && n.url && n.url !== '#');
        } catch (_err){
          return [];
        }
      });

      const results = (await Promise.all(requests)).flat();
      const unique = new Map();
      results.forEach((item) => {
        const key = `${item.url}|${item.title}`.toLowerCase();
        if (!unique.has(key)) unique.set(key, item);
      });
      return Array.from(unique.values())
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 18);
    }

    function renderTags(items){
      if(!tagsWrap) return;
      const allTags = Array.from(new Set(items.flatMap(n => n.tags || []))).sort();
      tagsWrap.innerHTML = '';
      const any = document.createElement('button');
      any.className = 'btn btn-sm btn-light rounded-pill';
      any.textContent = 'Todas';
      if(!activeTag) any.classList.add('active');
      any.onclick = ()=>{ activeTag = null; apply(); };
      tagsWrap.appendChild(any);

      allTags.forEach((t) => {
        const b = document.createElement('button');
        b.className = 'btn btn-sm btn-light rounded-pill';
        b.textContent = t;
        if(activeTag===t) b.classList.add('active');
        b.onclick = ()=>{ activeTag = (activeTag===t ? null : t); apply(); };
        tagsWrap.appendChild(b);
      });
    }

    function renderList(items){
      list.innerHTML = '';
      if(!items.length){
        list.innerHTML = '<li class="list-group-item text-center text-muted">No hay resultados.</li>';
        count.textContent = '0 noticias';
        return;
      }
      items
        .sort((a,b)=> (b.date||'').localeCompare(a.date||''))
        .forEach((n)=>{
          const url = safeUrl(n.url || '#');
          const title = escapeHtml(n.title || 'Sin título');
          const source = escapeHtml(n.source || 'Fuente');
          const li = document.createElement('li');
          li.className = 'list-group-item';
          li.innerHTML = `
            <a class="d-flex align-items-center gap-2 text-decoration-none" href="${url}" target="_blank" rel="noopener">
              <i class="fa-regular fa-newspaper"></i>
              <div class="flex-grow-1">
                <div class="fw-semibold">${title}</div>
                <div class="text-muted small">${source} · <time datetime="${n.date||''}">${fmtDate(n.date||'')}</time></div>
                ${(n.tags||[]).map(t=>`<span class="badge bg-light text-dark me-1">${t}</span>`).join('')}
              </div>
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>`;
          list.appendChild(li);
        });
      count.textContent = `${items.length} noticias`;
    }

    function apply(){
      const q = (search?.value || '').toLowerCase().trim();
      const items = allItems.filter((n)=>{
        const inText = [n.title,n.source,(n.tags||[]).join(' ')].join(' ').toLowerCase().includes(q);
        const inTag = !activeTag || (n.tags||[]).includes(activeTag);
        return inText && inTag;
      });
      renderTags(allItems);
      renderList(items);
    }

    async function refreshNews(){
      lastUpdate && (lastUpdate.textContent = 'Actualizando titulares...');
      const remoteItems = await fetchNewsFromRss();
      if (remoteItems.length){
        allItems = remoteItems;
        lastUpdate && (lastUpdate.textContent = `Actualizado: ${new Date().toLocaleString('es-CO')}`);
      } else {
        allItems = [...NEWS_FALLBACK_ITEMS];
        lastUpdate && (lastUpdate.textContent = `Mostrando respaldo local (${new Date().toLocaleDateString('es-CO')})`);
      }
      apply();
    }

    search?.addEventListener('input', apply);
    apply();
    refreshNews();
    setInterval(refreshNews, 30 * 60 * 1000);
  })();

  // ========= Navbar "active" por sección =========
  document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('.navbar .nav-link');
    const ids = Array.from(links).map(a => a.getAttribute('href')).filter(h=>h && h.startsWith('#'));
    const sections = ids.map(id => document.querySelector(id)).filter(Boolean);
    const menuCollapseEl = document.getElementById('menu');

    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('#')) return;
        const targetSection = document.querySelector(href);
        if (!targetSection) return;

        event.preventDefault();
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const navOffset = document.querySelector('.navbar')?.offsetHeight || 88;
        const targetTop = Math.max(0, targetSection.getBoundingClientRect().top + window.scrollY - navOffset - 12);

        document.body.classList.add('menu-transitioning');
        links.forEach((a) => a.classList.remove('active'));
        link.classList.add('active');
        sections.forEach((sec) => sec.classList.remove('section-focus'));
        targetSection.classList.add('section-focus');

        window.scrollTo({
          top: targetTop,
          behavior: reducedMotion ? 'auto' : 'smooth'
        });

        if (window.history?.replaceState){
          window.history.replaceState(null, '', href);
        }

        if (menuCollapseEl?.classList.contains('show') && window.bootstrap){
          bootstrap.Collapse.getOrCreateInstance(menuCollapseEl).hide();
        }

        window.setTimeout(() => document.body.classList.remove('menu-transitioning'), 520);
        window.setTimeout(() => targetSection.classList.remove('section-focus'), 900);
      });
    });

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const id = '#' + entry.target.id;
        const link = document.querySelector('.navbar .nav-link[href="'+id+'"]');
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(a => a.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });

    sections.forEach(sec => obs.observe(sec));

    // barra inferior fija: abrir formularios
    document.getElementById('quick-open-formularios')?.addEventListener('click', () => {
      const modalEl = document.getElementById('modalFormularios');
      if (!modalEl) return;
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    });

    const aboutModalEl = document.getElementById('modalNosotros');
    if (aboutModalEl){
      const aboutContent = {
        historia: {
          title: 'Nuestra historia',
          icon: 'fa-solid fa-landmark',
          body: `
            <p>Un gran empresario, con una mezcla de perseverancia y una ética de trabajo imparable, siempre tuvo un sueño: construir un futuro mejor para su familia y aportar socialmente en la generación de empleo.</p>
            <p>Con este sueño en mente comenzó a invertir en el sector inmobiliario, comprando su primera propiedad y reinvirtiendo las ganancias en nuevas propiedades. Cada éxito lo acercaba más a su sueño.</p>
            <p class="mb-0">Fue así como, ladrillo a ladrillo, se construyó un conjunto de activos inmobiliarios, sin perder nunca de vista sus humildes raíces. En el año 2014 decide fundar ZONA CENTRO INMOBILIARIA, una empresa que refleja sus valores de honestidad, dedicación y excelencia.</p>
          `
        },
        mision: {
          title: 'Misión',
          icon: 'fa-solid fa-shield-heart',
          body: `
            <p class="mb-0">Ser guardianes confiables del patrimonio de nuestros propietarios, esforzándonos por proteger y aumentar el valor de las inversiones de nuestros clientes, proporcionando servicios inmobiliarios de excelencia basados en la integridad, la transparencia y la dedicación. Entendemos que cada propiedad es más que un inmueble: es una parte esencial del legado de nuestros clientes y una fuente de seguridad y prosperidad para sus familias.</p>
          `
        },
        vision: {
          title: 'Visión',
          icon: 'fa-solid fa-chart-line',
          body: `
            <p class="mb-0">Convertirnos en la gestora líder de activos inmobiliarios, reconocida por nuestra excelencia operativa, innovación constante y compromiso con la satisfacción del cliente. Buscamos transformar el mercado inmobiliario mediante prácticas sostenibles y tecnología de vanguardia, proporcionando soluciones integrales que superen las expectativas de nuestros clientes y socios.</p>
          `
        },
        valores: {
          title: 'Valores',
          icon: 'fa-solid fa-gem',
          body: `
            <div class="about-list">
              <p><strong>Honestidad:</strong> obramos con transparencia, orientación moral y conducta ejemplar dentro y fuera de la empresa.</p>
              <p><strong>Responsabilidad:</strong> asumimos las consecuencias de nuestras acciones y contribuimos al logro de los objetivos empresariales.</p>
              <p><strong>Laboriosidad:</strong> usamos el trabajo como fuerza transformadora para alcanzar productividad y desarrollo.</p>
              <p><strong>Solidaridad:</strong> fomentamos compañerismo, amistad y trabajo conjunto para cumplir nuestra misión.</p>
              <p><strong>Confianza:</strong> brindamos información ágil, veraz, creíble, exacta y oportuna.</p>
              <p><strong>Orden:</strong> organizamos procesos, recursos e información para mantener un ambiente cómodo y eficiente.</p>
              <p class="mb-0"><strong>Transparencia:</strong> actuamos con claridad para que los clientes conozcan las reglas de juego antes de cada negocio.</p>
            </div>
          `
        },
        pilares: {
          title: 'Pilares de la organización',
          icon: 'fa-solid fa-building-columns',
          body: `
            <div class="about-list">
              <p><strong>Pasión por la excelencia:</strong> buscamos superar expectativas mediante calidad y mejora continua.</p>
              <p><strong>Innovación:</strong> adoptamos tecnologías, desarrollamos servicios y mejoramos procesos para crear experiencias eficientes.</p>
              <p><strong>Pasión por el aprendizaje:</strong> promovemos el desarrollo personal y profesional de nuestros colaboradores.</p>
              <p class="mb-0"><strong>Resiliencia:</strong> enfrentamos desafíos con determinación, adaptabilidad y soluciones creativas.</p>
            </div>
          `
        }
      };

      aboutModalEl.addEventListener('show.bs.modal', (event) => {
        const key = event.relatedTarget?.getAttribute('data-about-key') || 'historia';
        const item = aboutContent[key] || aboutContent.historia;
        const titleEl = document.getElementById('modalNosotrosLabel');
        const bodyEl = document.getElementById('modalNosotrosBody');
        const iconEl = document.getElementById('modalNosotrosIcon');
        if (titleEl) titleEl.textContent = item.title;
        if (bodyEl) bodyEl.innerHTML = item.body;
        if (iconEl) iconEl.innerHTML = `<i class="${item.icon}"></i>`;
      });
    }

    // animaciones suaves por bloques
    const revealTargets = document.querySelectorAll(
      '.banner .container > *, .icon-card, #inmuebles .property-card, #inmuebles .service-item, #noticias .list-group-item, #nosotros .card, #nosotros .about-card, #contacto .card, .modal .card, footer .container > *'
    );
    revealTargets.forEach((el, idx) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${Math.min((idx % 6) * 70, 350)}ms`;
    });
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach((el) => revealObserver.observe(el));
  });

  // ========= Transición suave entre páginas =========
  (function setupPageTransitions(){
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!link) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;
      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      let destination;
      try{
        destination = new URL(href, window.location.href);
      } catch (_err){
        return;
      }
      if (destination.origin !== window.location.origin) return;
      const samePageHash = destination.pathname === window.location.pathname && destination.hash;
      if (samePageHash) return;
      if (!destination.pathname.endsWith('.html')) return;
      event.preventDefault();
      document.body.classList.add('page-leaving');
      window.setTimeout(() => {
        window.location.href = destination.href;
      }, 170);
    });
  })();

  // ========= Validación + envío a WhatsApp (Contacto y PQRSF) =========
  (function formsWhatsApp(){
    function show(el){ el?.classList.remove('d-none'); }
    function hide(el){ el?.classList.add('d-none'); }

    // Contacto
    const f1 = document.getElementById('form-contacto');
    const ok1 = document.getElementById('msg-ok');
    const er1 = document.getElementById('msg-error');
    f1?.addEventListener('submit', (e)=>{
      e.preventDefault(); e.stopPropagation();
      if (!f1.checkValidity()){ f1.classList.add('was-validated'); return; }
      if (document.getElementById('website')?.value.trim()!=='') return;

      const nombre = document.getElementById('nombre').value.trim();
      const email  = document.getElementById('email').value.trim();
      const tel    = document.getElementById('telefono').value.trim();
      const msg    = document.getElementById('mensaje').value.trim();

      const texto = `Contacto ZCI:\n- Nombre: ${nombre}\n- Correo: ${email}\n- Tel: ${tel}\n- Mensaje: ${msg}`;
      const url = buildWhatsappUrl(currentWhatsappNumber, texto);
      window.open(url, '_blank', 'noopener');
      hide(er1); show(ok1);
      f1.reset(); f1.classList.remove('was-validated');
    });

    // PQRSF
    const f2 = document.getElementById('form-pqr');
    const ok2 = document.getElementById('pqr-ok');
    const er2 = document.getElementById('pqr-error');
    const pqrModalEl = document.getElementById('modalPqrsfRegistrada');
    const pqrConfirmDetailEl = document.getElementById('pqr-confirm-detail');
    const pqrWhatsappLinkEl = document.getElementById('pqr-whatsapp-link');
    f2?.addEventListener('submit', async (e)=>{
      e.preventDefault(); e.stopPropagation();
      if (!f2.checkValidity()){ f2.classList.add('was-validated'); return; }
      if (document.getElementById('pqr-website')?.value.trim()!=='') return;
      hide(ok2); hide(er2);

      const tipo   = document.getElementById('pqr-tipo').value;
      const nombre = document.getElementById('pqr-nombre').value.trim();
      const doc    = document.getElementById('pqr-doc').value.trim();
      const email  = document.getElementById('pqr-email').value.trim();
      const tel    = document.getElementById('pqr-tel').value.trim();
      const canal  = document.getElementById('pqr-canal').value;
      const asunto = document.getElementById('pqr-asunto').value.trim();
      const desc   = document.getElementById('pqr-desc').value.trim();
      const submitBtn = f2.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn?.textContent;

      if (submitBtn){
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }

      const pqrsfPayload = {
        tipo,
        canal,
        nombre,
        documento: doc,
        correo: email,
        telefono: tel,
        asunto,
        descripcion: desc,
        acepta_tratamiento: document.getElementById('pqr-habeas')?.checked === true,
        origen: 'web',
        user_agent: navigator.userAgent || null
      };

      const texto = `PQRSF ZCI:
- Tipo: ${tipo}
- Nombre: ${nombre}
- Doc: ${doc}
- Correo: ${email}
- Tel: ${tel}
- Canal: ${canal}
- Asunto: ${asunto}
- Descripción: ${desc}`;

      try {
        if (!supabaseClient){
          throw new Error('No se pudo enviar la solicitud en este momento.');
        }

        const { data, error } = await supabaseClient
          .from('pqrsf_solicitudes')
          .insert(pqrsfPayload)
          .select('id, created_at')
          .single();

        if (error) throw error;

        const url = buildWhatsappUrl(currentWhatsappNumber, texto);
        if (pqrWhatsappLinkEl) pqrWhatsappLinkEl.href = url;
        if (pqrConfirmDetailEl){
          const code = data?.id ? String(data.id).slice(0, 8).toUpperCase() : '';
          pqrConfirmDetailEl.textContent = code
            ? `Radicado temporal: ${code}. Tu solicitud quedó guardada correctamente.`
            : 'Tu solicitud quedó guardada correctamente.';
        }
        if (pqrModalEl && window.bootstrap){
          bootstrap.Modal.getOrCreateInstance(pqrModalEl).show();
        }
        show(ok2);
        f2.reset(); f2.classList.remove('was-validated');
      } catch (error) {
        if (er2){
          er2.textContent = `No fue posible guardar la PQRSF: ${error.message || error}`;
        }
        show(er2);
      } finally {
        if (submitBtn){
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText || 'Enviar PQRSF';
        }
      }
    });
  })();

  // ========= Footer: anio actual =========
  (function setFooterYear(){
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  })();



