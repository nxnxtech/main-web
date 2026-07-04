(function () {
  window.NxNxComponents = window.NxNxComponents || {};

  window.NxNxComponents.cartBag = `
    <button type="button" class="cart-bag-button" data-cart-bag-button aria-label="View bag" style="display:none;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 8h12l-1.2 11a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8Z" stroke="currentColor" stroke-width="1.6"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.6"/></svg>
      <span class="cart-bag-count" data-cart-bag-count>0</span>
    </button>
  `;

  function initCartBag() {
    let mount = document.querySelector('[data-component="cart-bag"]');

    if (mount) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = window.NxNxComponents.cartBag;
      mount.replaceWith(wrapper.firstElementChild);
    } else {
      // Fallback: no header slot found, float it near the top-right instead.
      const wrapper = document.createElement('div');
      wrapper.innerHTML = window.NxNxComponents.cartBag;
      const btn = wrapper.firstElementChild;
      btn.classList.add('cart-bag-floating');
      document.body.appendChild(btn);
    }

    const button = document.querySelector('[data-cart-bag-button]');
    const countEl = document.querySelector('[data-cart-bag-count]');
    if (!button) return;

    function refresh() {
      const count = cartCount();
      countEl.textContent = String(count);
      countEl.style.display = count > 0 ? 'inline-flex' : 'none';
      button.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    button.addEventListener('click', () => window.openCheckoutModal?.('bag'));
    document.addEventListener('cart:updated', refresh);

    refresh();
  }

  document.addEventListener('components:loaded', () => setTimeout(initCartBag, 0), { once: true });
})();