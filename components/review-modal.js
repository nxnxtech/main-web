
(function () {
  window.NxNxComponents = window.NxNxComponents || {};

  window.NxNxComponents.reviewModal = `
    <div class="review-modal" data-review-modal>
      <div class="review-backdrop" data-review-backdrop></div>
      <div class="review-dialog">
        <button type="button" class="review-close" data-review-close aria-label="Close review form">
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <span class="route-tag blue">Word on the road</span>
        <h3 style="margin-top:16px;">Tell us how it went.</h3>
        <p style="margin-top:8px; color:var(--ink-soft); font-size:0.95rem;">Your review is checked before it goes live, so it won't appear right away.</p>
        <form data-review-form style="margin-top:24px; display:grid; gap:16px;">
          <div>
            <label for="review-name" style="font-family:var(--font-mono); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em;">Name *</label>
            <input id="review-name" name="name" type="text" required style="width:100%; margin-top:6px; padding:11px 13px; border:2px solid var(--ink); border-radius:var(--radius); font-family:var(--font-body); font-size:0.95rem;">
          </div>
          <div>
            <label for="review-company" style="font-family:var(--font-mono); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em;">Role &amp; company</label>
            <input id="review-company" name="company" type="text" placeholder="e.g. CEO, The Outback Hotel" style="width:100%; margin-top:6px; padding:11px 13px; border:2px solid var(--ink); border-radius:var(--radius); font-family:var(--font-body); font-size:0.95rem;">
          </div>
          <div>
            <label for="review-website" style="font-family:var(--font-mono); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em;">Company website</label>
            <input id="review-website" name="website" type="url" placeholder="https://" style="width:100%; margin-top:6px; padding:11px 13px; border:2px solid var(--ink); border-radius:var(--radius); font-family:var(--font-body); font-size:0.95rem;">
          </div>
          <div>
            <label for="review-comment" style="font-family:var(--font-mono); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em;">Your review *</label>
            <textarea id="review-comment" name="comment" rows="4" required style="width:100%; margin-top:6px; padding:11px 13px; border:2px solid var(--ink); border-radius:var(--radius); font-family:var(--font-body); font-size:0.95rem; resize:vertical;"></textarea>
          </div>
          <p data-review-status style="font-size:0.85rem; display:none;"></p>
          <button type="submit" class="btn btn-dark" style="justify-self:start;">Submit review</button>
        </form>
      </div>
    </div>
  `;

  function initReviewModal() {
    const modal = document.querySelector('[data-review-modal]');
    const openBtn = document.querySelector('[data-review-open]');
    if (!modal || !openBtn) return; // page has no trigger and/or no injected modal — nothing to wire up

    const closeBtn = modal.querySelector('[data-review-close]');
    const backdrop = modal.querySelector('[data-review-backdrop]');
    const form = modal.querySelector('[data-review-form]');

    function openModal() {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    openBtn.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);

    // Backdrop click, capture phase, only when the click lands directly on the backdrop
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const status = form.querySelector('[data-review-status]');
      const btn = form.querySelector('button[type="submit"]');
      const get = (field) => {
        const el = form.querySelector(`[name="${field}"]`);
        return el ? el.value.trim() : '';
      };

      const name = get('name');
      const comment = get('comment');
      const company = get('company');
      const website = get('website');

      function setStatus(message, isError) {
        if (!status) return;
        status.textContent = message;
        status.classList.add('is-visible');
        status.classList.toggle('is-error', !!isError);
      }

      if (!name || !comment) {
        setStatus('Please add your name and a comment before sending.', true);
        return;
      }

      if (!window.supabaseClient) {
        setStatus('Reviews are temporarily unavailable — please try again later.', true);
        return;
      }

      if (btn) {
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Sending…';
      }

      const { error } = await window.supabaseClient
        .from('comments')
        .insert([{ name, comment, company: company || null, website: website || null }]);

      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText;
      }

      if (error) {
        console.error('Error submitting review:', error);
        setStatus('Something went wrong on our end — please try again in a moment.', true);
        return;
      }

      form.reset();
      setStatus("Thanks! We'll review your comment and add it to the road soon.", false);
      setTimeout(closeModal, 2200);
    });
  }

  // The modal's markup is injected by components.js (which listens for its own
  // DOMContentLoaded/readyState and then dispatches 'components:loaded'), so wait
  // for that event before looking for [data-review-modal] in the DOM.
  document.addEventListener('components:loaded', () => setTimeout(initReviewModal, 0), { once: true });
})();