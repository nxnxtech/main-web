// TrotroTech Solutions — shared behaviour

document.addEventListener('DOMContentLoaded', () => {

  /* mobile nav toggle */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }

  /* scroll reveal */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* testimonial slider */
  const slider = document.querySelector('[data-testimonial-slider]');
  if (slider) {
    const slides = slider.querySelectorAll('[data-slide]');
    const dots = slider.querySelectorAll('[data-dot]');
    let idx = 0;
    const show = (i) => {
      slides.forEach((s, n) => s.classList.toggle('is-active', n === i));
      dots.forEach((d, n) => d.classList.toggle('is-active', n === i));
      idx = i;
    };
    dots.forEach((d, n) => d.addEventListener('click', () => show(n)));
    const next = slider.querySelector('[data-next]');
    const prev = slider.querySelector('[data-prev]');
    if (next) next.addEventListener('click', () => show((idx + 1) % slides.length));
    if (prev) prev.addEventListener('click', () => show((idx - 1 + slides.length) % slides.length));
    if (slides.length > 1) {
      setInterval(() => show((idx + 1) % slides.length), 6500);
    }
  }

  /* contact / cta forms — front-end only demo handling */
  document.querySelectorAll('form[data-demo-form]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = form.querySelector('[data-form-status]');
      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      setTimeout(() => {
        if (status) {
          status.textContent = "Message received — we'll reply within one business day.";
          status.classList.add('is-visible');
        }
        if (btn) { btn.disabled = false; btn.dataset.originalText && (btn.textContent = btn.dataset.originalText); }
        form.reset();
      }, 700);
      if (btn && !btn.dataset.originalText) btn.dataset.originalText = 'Send message';
    });
  });

  /* logo marquee duplication for seamless loop */
  document.querySelectorAll('[data-marquee]').forEach(track => {
    track.innerHTML += track.innerHTML;
  });

  /* year in footer */
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

});