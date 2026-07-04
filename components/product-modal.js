(function () {
  window.NxNxComponents = window.NxNxComponents || {};

  window.NxNxComponents.productModal = `
    <div class="product-modal" data-product-modal>
      <div class="product-backdrop" data-product-backdrop></div>
      <div class="product-dialog">
        <button type="button" class="review-close" data-product-close aria-label="Close product">
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="product-dialog-grid">
          <div class="product-gallery">
            <div class="product-hero-wrap">
              <img data-product-hero alt="" class="product-hero">
              <span class="pill product-badge" data-product-badge></span>
            </div>
            <div class="product-thumbs" data-product-thumbs></div>
          </div>
          <div class="product-info">
            <span class="pill" data-product-category></span>
            <h3 style="margin-top:14px;" data-product-name></h3>
            <p style="margin-top:8px; color:var(--ink-soft); font-size:0.95rem;" data-product-description></p>
            <div style="margin-top:16px; display:flex; align-items:baseline; gap:10px;">
              <span style="font-family:var(--font-display); font-size:2rem;" data-product-price></span>
              <span style="font-family:var(--font-mono); font-size:0.85rem; color:var(--ink-soft); text-decoration:line-through;" data-product-original-price></span>
            </div>
            <div data-product-sizes-wrap style="margin-top:20px;">
              <label style="font-family:var(--font-mono); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em;">Size</label>
              <div class="product-size-row" data-product-sizes></div>
            </div>
            <div style="margin-top:20px;">
              <label style="font-family:var(--font-mono); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em;">Quantity</label>
              <div class="product-qty-row">
                <button type="button" data-product-qty-minus aria-label="Decrease quantity">−</button>
                <span data-product-qty>1</span>
                <button type="button" data-product-qty-plus aria-label="Increase quantity">+</button>
              </div>
            </div>
            <p data-product-status style="font-size:0.85rem; margin-top:14px; display:none;"></p>
            <div style="margin-top:22px; display:flex; gap:12px; flex-wrap:wrap;">
              <button type="button" class="btn btn-dark" data-product-add>Add to bag</button>
              <button type="button" class="btn btn-outline" data-product-view-bag>View bag →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  function formatGHS(amount) {
    return `GH₵ ${amount.toFixed(2)}`;
  }

  function initProductModal() {
    const modal = document.querySelector('[data-product-modal]');
    if (!modal) return;

    const backdrop = modal.querySelector('[data-product-backdrop]');
    const closeBtn = modal.querySelector('[data-product-close]');
    const hero = modal.querySelector('[data-product-hero]');
    const badge = modal.querySelector('[data-product-badge]');
    const thumbs = modal.querySelector('[data-product-thumbs]');
    const category = modal.querySelector('[data-product-category]');
    const name = modal.querySelector('[data-product-name]');
    const description = modal.querySelector('[data-product-description]');
    const price = modal.querySelector('[data-product-price]');
    const originalPrice = modal.querySelector('[data-product-original-price]');
    const sizesWrap = modal.querySelector('[data-product-sizes-wrap]');
    const sizesRow = modal.querySelector('[data-product-sizes]');
    const qtyEl = modal.querySelector('[data-product-qty]');
    const qtyMinus = modal.querySelector('[data-product-qty-minus]');
    const qtyPlus = modal.querySelector('[data-product-qty-plus]');
    const status = modal.querySelector('[data-product-status]');
    const addBtn = modal.querySelector('[data-product-add]');
    const viewBagBtn = modal.querySelector('[data-product-view-bag]');

    let currentProduct = null;
    let variants = [];
    let selectedVariant = null;
    let quantity = 1;

    function setStatus(message, isError) {
      if (!message) {
        status.style.display = 'none';
        return;
      }
      status.textContent = message;
      status.style.display = 'block';
      status.style.color = isError ? '#B3261E' : 'var(--palm)';
    }

    function discountedPrice(basePrice) {
      return currentProduct.discount_percent
        ? basePrice * (1 - currentProduct.discount_percent / 100)
        : basePrice;
    }

    function updatePriceDisplay() {
      if (!selectedVariant) {
        price.textContent = '—';
        originalPrice.textContent = '';
        return;
      }
      price.textContent = formatGHS(discountedPrice(selectedVariant.price));
      originalPrice.textContent = currentProduct.discount_percent ? formatGHS(selectedVariant.price) : '';
    }

    function updateQtyAndAddState() {
      const soldOut = !selectedVariant || selectedVariant.stock === 0;
      qtyEl.textContent = String(quantity);
      addBtn.disabled = soldOut;
      addBtn.textContent = soldOut ? 'Sold out' : 'Add to bag';
    }

    function selectVariant(variant, buttonEl) {
      selectedVariant = variant;
      quantity = 1;
      updatePriceDisplay();
      updateQtyAndAddState();
      setStatus('');
      if (buttonEl) {
        sizesRow.querySelectorAll('.product-size-btn').forEach((b) => b.classList.toggle('is-selected', b === buttonEl));
      }
    }

    function openModal(product) {
      currentProduct = product;
      variants = (product.variants || []).slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      selectedVariant = null;
      quantity = 1;
      setStatus('');

      const images = product.images && product.images.length ? product.images : [];
      hero.src = images[0] || '';
      hero.alt = product.name;

      thumbs.innerHTML = '';
      images.forEach((img, i) => {
        const t = document.createElement('img');
        t.src = img;
        t.alt = '';
        t.className = i === 0 ? 'is-active' : '';
        t.addEventListener('click', () => {
          hero.src = img;
          thumbs.querySelectorAll('img').forEach((el) => el.classList.toggle('is-active', el === t));
        });
        thumbs.appendChild(t);
      });
      if (images.length < 2) thumbs.style.display = 'none'; else thumbs.style.display = 'flex';

      const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
      if (totalStock === 0) {
        badge.textContent = 'Sold out';
        badge.style.display = 'inline-block';
        badge.style.background = 'var(--ink)';
        badge.style.color = 'var(--paper)';
      } else if (product.discount_percent > 0) {
        badge.textContent = `-${product.discount_percent}%`;
        badge.style.display = 'inline-block';
        badge.style.background = 'var(--marigold)';
        badge.style.color = 'var(--ink)';
      } else {
        badge.style.display = 'none';
      }

      category.textContent = product.category || '';
      name.textContent = product.name;
      description.textContent = product.description || '';

      const hasRealSizes = variants.length > 1 || (variants.length === 1 && variants[0].size);

      if (hasRealSizes) {
        sizesWrap.style.display = 'block';
        sizesRow.innerHTML = '';
        variants.forEach((variant) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'product-size-btn';
          btn.textContent = variant.size || 'One size';
          if (variant.stock === 0) {
            btn.disabled = true;
            btn.classList.add('is-unavailable');
            btn.title = 'Sold out in this size';
          }
          btn.addEventListener('click', () => selectVariant(variant, btn));
          sizesRow.appendChild(btn);
        });
        updatePriceDisplay(); // shows '—' until a size is picked
      } else {
        // Single, sizeless variant (e.g. a mug) — auto-select it, no picker shown.
        sizesWrap.style.display = 'none';
        selectVariant(variants[0] || null, null);
      }

      updateQtyAndAddState();

      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    qtyMinus.addEventListener('click', () => {
      quantity = Math.max(1, quantity - 1);
      qtyEl.textContent = String(quantity);
    });

    qtyPlus.addEventListener('click', () => {
      const max = selectedVariant?.stock ?? 99;
      quantity = Math.min(max, quantity + 1);
      qtyEl.textContent = String(quantity);
    });

    addBtn.addEventListener('click', () => {
      if (!currentProduct) return;

      if (!selectedVariant) {
        setStatus('Please select a size.', true);
        return;
      }
      if (selectedVariant.stock === 0) {
        setStatus('That size is sold out.', true);
        return;
      }

      addToCart({
        variant_id: selectedVariant.id,
        product_id: currentProduct.id,
        name: currentProduct.name,
        image: (currentProduct.images && currentProduct.images[0]) || '',
        price: selectedVariant.price,
        discount_percent: currentProduct.discount_percent || 0,
        size: selectedVariant.size,
        quantity,
        stock: selectedVariant.stock,
      });

      setStatus('Added to your bag ✓', false);
      addBtn.textContent = 'Added ✓';
      setTimeout(() => {
        if (addBtn) addBtn.textContent = 'Add to bag';
      }, 1400);
    });

    viewBagBtn.addEventListener('click', () => {
      closeModal();
      window.openCheckoutModal?.('bag');
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    }, true);
    closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    window.openProductModal = openModal;
  }

  document.addEventListener('components:loaded', () => setTimeout(initProductModal, 0), { once: true });
})();