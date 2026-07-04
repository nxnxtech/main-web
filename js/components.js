(function () {
  const components = window.NxNxComponents || {};

  function normalizePath(value) {
    return (value || '').replace(/^\.\//, '').replace(/\/$/, '').split('/').pop() || 'index.html';
  }

  function replacePlaceholder(selector, template) {
    const placeholder = document.querySelector(selector);
    if (!placeholder) return null;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = template;
    const node = wrapper.firstElementChild;
    if (!node) return null;

    placeholder.parentNode.replaceChild(node, placeholder);
    return node;
  }

  function activateNav(node) {
    if (!node) return;

    const currentPage = normalizePath(window.location.pathname);

    node.querySelectorAll('[data-nav-link]').forEach((link) => {
      const linkPage = normalizePath(link.getAttribute('href') || '');
      if (linkPage === currentPage || (currentPage === 'index.html' && linkPage === 'index.html')) {
        link.classList.add('active');
      }
    });
  }

  function getPageName() {
    const pageName = document.body.dataset.pageName;
    if (pageName) return pageName;
    const title = document.title || '';
    return title.replace(/\s+—\s+NxNx Tech$/, '').trim() || 'Home';
  }

  function injectPageName() {
    const pageName = getPageName();
    const footerName = document.querySelector('[data-footer-page-name]');
    if (footerName) {
      footerName.textContent = pageName;
    }
  }

  function initBusinessCard() {
    const modalContainer = document.querySelector('.business-card-container');
    if (!modalContainer) return;

    const button = modalContainer.querySelector('.business-card-button');
    const modal = modalContainer.querySelector('.business-card-modal');
    const backdrop = modalContainer.querySelector('.business-card-backdrop');
    const closeBtn = modalContainer.querySelector('.business-card-close');

    if (!button || !modal) return;

    function openCard() {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    function closeCard() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    button.addEventListener('click', openCard);
    closeBtn?.addEventListener('click', closeCard);
    
    // Handle backdrop click with pointer events consideration
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        // Make sure click is directly on backdrop
        if (e.target === backdrop) {
          closeCard();
        }
      }, true); // Use capture phase
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeCard();
      }
    });
  }

  function initComponents() {
    const header = replacePlaceholder('[data-component="header"]', components.header || '');
    activateNav(header);

    replacePlaceholder('[data-component="footer"]', components.footer || '');
    replacePlaceholder('[data-component="business-card"]', components.businessCard || '');
    replacePlaceholder('[data-component="review-modal"]', components.reviewModal || '');
    replacePlaceholder('[data-component="product-modal"]', components.productModal || '');
    replacePlaceholder('[data-component="checkout-modal"]', components.checkoutModal || '');
    injectPageName();
    
    // Initialize business card after it's loaded
    setTimeout(() => initBusinessCard(), 0);
    
    document.dispatchEvent(new CustomEvent('components:loaded'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents, { once: true });
  } else {
    initComponents();
  }
})();