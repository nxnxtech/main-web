function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatGHS(amount) {
  return `GH₵ ${Number(amount).toFixed(2)}`;
}

function deliveryZoneRowHTML(zone, settings) {
  // A zone's own thresholds win if set; otherwise it uses the site-wide
  // ones from delivery_settings - same fallback rule create-checkout and
  // the checkout modal use, so this page never disagrees with what
  // shoppers actually get charged.
  const freeAt = zone.free_threshold ?? settings?.free_threshold ?? null;
  const halfAt = zone.half_off_threshold ?? settings?.half_off_threshold ?? null;
  const halfPercent = zone.half_off_percent ?? settings?.half_off_percent ?? null;

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; padding:14px 0; border-bottom:1px solid var(--ink-soft); border-bottom-style:dashed; opacity:0.95;">
      <div>
        <div style="font-weight:700;">${escapeHTML(zone.town)}</div>
        <div style="font-family:var(--font-mono); font-size:0.8rem; color:var(--ink-soft); margin-top:2px;">${formatGHS(zone.fee)} delivery fee</div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
        ${halfAt != null && halfPercent ? `
          <span class="pill" style="border-color:var(--ink-soft); font-size:0.75rem;">${halfPercent}% off at ${formatGHS(halfAt)}+</span>
        ` : ''}
        ${freeAt != null ? `
          <span class="pill" style="background:var(--marigold); font-size:0.75rem;">Free at ${formatGHS(freeAt)}+</span>
        ` : ''}
      </div>
    </div>
  `;
}

function renderDeliveryZones(zones, settings, emptyMessage) {
  const container = document.getElementById('delivery-zones-table');
  if (!container) return;

  if (!zones.length) {
    container.innerHTML = `<p style="color:var(--ink-soft);">${emptyMessage}</p>`;
    return;
  }

  const byRegion = {};
  zones.forEach((zone) => {
    if (!byRegion[zone.region]) byRegion[zone.region] = [];
    byRegion[zone.region].push(zone);
  });

  container.innerHTML = Object.keys(byRegion).sort().map((region) => `
    <div style="margin-top:36px;">
      <span class="pill">${escapeHTML(region)}</span>
      <div style="margin-top:10px;">
        ${byRegion[region].map((zone) => deliveryZoneRowHTML(zone, settings)).join('')}
      </div>
    </div>
  `).join('');
}

function initDeliveryInfoPage() {
  const container = document.getElementById('delivery-zones-table');
  if (!container) return;

  if (!window.supabaseClient) {
    console.error('Supabase client not found - check that supabase-config.js is loaded before delivery-info.js.');
    return;
  }

  if (window.NxNxComponents?.loadingState) {
    container.innerHTML = window.NxNxComponents.loadingState('Loading delivery areas…', { fullWidth: true });
  }

  let allZones = [];
  let settings = null;

  const searchForm = document.querySelector('[data-delivery-search-form]');
  const searchInput = document.querySelector('[data-delivery-search-input]');
  const searchStatus = document.querySelector('[data-delivery-search-status]');

  function applySearch() {
    const query = (searchInput?.value || '').trim().toLowerCase();

    if (!query) {
      if (searchStatus) searchStatus.style.display = 'none';
      renderDeliveryZones(allZones, settings, "Delivery areas aren't set up yet - please check back soon, or collect in person.");
      return;
    }

    const matches = allZones.filter((zone) =>
      zone.town.toLowerCase().includes(query) || zone.region.toLowerCase().includes(query)
    );

    if (searchStatus) {
      searchStatus.style.display = 'block';
      searchStatus.textContent = matches.length
        ? `${matches.length} location${matches.length === 1 ? '' : 's'} matching "${searchInput.value.trim()}"`
        : `No locations matching "${searchInput.value.trim()}".`;
    }

    renderDeliveryZones(matches, settings, 'No matching delivery areas. Try a different search, or check the spelling of your town.');
  }

  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    applySearch();
  });
  // Live filtering as they type feels better than requiring the button -
  // the button/submit is still there for anyone who prefers it (or hits Enter).
  searchInput?.addEventListener('input', applySearch);

  Promise.all([
    window.supabaseClient
      .from('delivery_zones')
      .select('region, town, fee, free_threshold, half_off_threshold, half_off_percent')
      .eq('is_active', true)
      .order('region', { ascending: true })
      .order('display_order', { ascending: true }),
    window.supabaseClient
      .from('delivery_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle(),
  ]).then(([zonesRes, settingsRes]) => {
    if (zonesRes.error) {
      console.error('Error loading delivery zones:', zonesRes.error);
      container.innerHTML = `<p style="color:var(--ink-soft);">Couldn't load delivery info right now - please try again shortly.</p>`;
      return;
    }
    allZones = zonesRes.data || [];
    settings = settingsRes.data || null;
    renderDeliveryZones(allZones, settings, "Delivery areas aren't set up yet - please check back soon, or collect in person.");
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-component="header"], [data-component="footer"]')) {
    document.addEventListener('components:loaded', initDeliveryInfoPage, { once: true });
  } else {
    initDeliveryInfoPage();
  }
});