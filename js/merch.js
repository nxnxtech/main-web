function productTotalStock(product) {
  return (product.variants || []).reduce((sum, v) => sum + v.stock, 0);
}

function productPriceRange(product) {
  const prices = (product.variants || []).map((v) => v.price);
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function renderMerchBadges(product) {
  const totalStock = productTotalStock(product);
  const badges = [];

  if (totalStock === 0) {
    badges.push(`<span class="merch-badge merch-badge-soldout">Sold out</span>`);
  } else {
    if (product.discount_percent > 0) {
      badges.push(`<span class="merch-badge merch-badge-discount">-${product.discount_percent}%</span>`);
    }
    if (totalStock < 5) {
      badges.push(`<span class="merch-badge merch-badge-low">Only ${totalStock} left</span>`);
    }
  }
  return badges.join('');
}

function merchCardHTML(product) {
  const { min, max } = productPriceRange(product);
  const discountedMin = product.discount_percent ? min * (1 - product.discount_percent / 100) : min;
  const soldOut = productTotalStock(product) === 0;
  const isRange = max > min;

  return `
    <div class="merch-card ${soldOut ? 'is-soldout' : ''}" data-merch-card="${product.id}">
      <div class="merch-card-image-wrap">
        <img src="${(product.images && product.images[0]) || ''}" alt="${product.name}" class="merch-card-image">
        ${renderMerchBadges(product)}
      </div>
      <div class="merch-card-body">
        <div class="merch-card-name">${product.name}</div>
        <div class="merch-card-price">
          ${isRange ? `From GH₵ ${discountedMin.toFixed(2)}` : `GH₵ ${discountedMin.toFixed(2)}`}
          ${product.discount_percent ? `<span class="merch-card-original">${isRange ? `GH₵ ${min.toFixed(2)}–${max.toFixed(2)}` : `GH₵ ${min.toFixed(2)}`}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function loadMerchInto(grid, options) {
  if (!grid) return;
  const opts = options || {};

  if (!window.supabaseClient) {
    console.error('Supabase client not found — check that supabase-config.js is loaded before merch.js.');
    return;
  }

  if (window.NxNxComponents?.loadingState) {
    grid.innerHTML = window.NxNxComponents.loadingState(opts.loadingLabel || 'Loading merch…', { fullWidth: true });
  }

  let query = window.supabaseClient
    .from('merch_products')
    .select('*, variants:merch_product_variants(*)')
    .order('display_order', { ascending: true });
  if (opts.limit) query = query.limit(opts.limit);

  query.then(({ data, error }) => {
    if (error) {
      console.error('Error loading merch:', error);
      grid.innerHTML = `<p style="grid-column:1 / -1; color:var(--ink-soft);">Merch couldn't be loaded right now.</p>`;
      return;
    }

    const products = data || [];
    if (!products.length) {
      grid.innerHTML = `<p style="grid-column:1 / -1; color:var(--ink-soft);">New merch is on the way — check back soon.</p>`;
      return;
    }

    grid.innerHTML = products.map(merchCardHTML).join('');

    grid.querySelectorAll('[data-merch-card]').forEach((card) => {
      card.addEventListener('click', () => {
        const product = products.find((p) => p.id === card.dataset.merchCard);
        if (product) window.openProductModal?.(product);
      });
    });
  });
}

function initMerchGrid() {
  loadMerchInto(document.getElementById('merch-grid'));
  loadMerchInto(document.getElementById('merch-grid-home'), { limit: 4, loadingLabel: 'Loading merch…' });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-component="header"], [data-component="footer"]')) {
    document.addEventListener('components:loaded', initMerchGrid, { once: true });
  } else {
    initMerchGrid();
  }
});