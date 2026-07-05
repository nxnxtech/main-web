// Fills in [data-free-delivery-threshold] with the current global free
// delivery threshold, wherever the free-delivery banner appears on a page.
// Per-location thresholds can differ (see delivery-info.html) — this banner
// only advertises the general/global figure and points to that page for
// specifics.
(function () {
  function formatGHS(amount) {
    return `GH₵${Number(amount).toFixed(0)}`;
  }

  function initFreeDeliveryBanner() {
    const els = document.querySelectorAll('[data-free-delivery-threshold]');
    if (!els.length) return;

    if (!window.supabaseClient) {
      console.error('Supabase client not found — check that supabase-config.js is loaded before free-delivery-banner.js.');
      return;
    }

    window.supabaseClient
      .from('delivery_settings')
      .select('free_threshold')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('Error loading free delivery threshold:', error);
          return;
        }
        const text = formatGHS(data.free_threshold);
        els.forEach((el) => { el.textContent = text; });
      });
  }

  document.addEventListener('DOMContentLoaded', initFreeDeliveryBanner);
})();