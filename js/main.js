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

  document.querySelectorAll('form[data-demo-form]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const to = form.dataset.emailTo || 'nxnxtech@gmail.com';
      const get = (field) => {
        const el = form.querySelector(`[name="${field}"]`);
        return el ? el.value.trim() : '';
      };

      const name = get('name');
      const email = get('email');
      const projectType = get('project_type');
      const message = get('message');

      const status = form.querySelector('[data-form-status]');
      const inputBox = form.querySelector('#project-type', '#name', '#email', '#message');
      const btn = form.querySelector('button[type="submit"]');
      if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;

      if (projectType || email || name || message == "") {

        if (status) {
          inputBox.classList.add('error');
          status.textContent = 'Please select a project type before sending.';
          status.classList.add('is-visible');
        }
        return;
      }

      if (!name || !email || !message) {
        if (status) {
          status.textContent = 'Please fill in your name, email and message before sending.';
          status.classList.add('is-visible');
        }
        return;
      }

      const subject = `New project inquiry from ${name}${projectType ? ' — ' + projectType : ''}`;
      const bodyLines = [
        `Name: ${name}`,
        `Email: ${email}`,
        projectType ? `Project type: ${projectType}` : null,
        '',
        'Message:',
        message
      ].filter(Boolean);
      const body = bodyLines.join('\n');

      const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      btn.disabled = true;
      btn.textContent = 'Opening email…';

      window.location.href = mailtoUrl;

      setTimeout(() => {
        if (status) {
          status.textContent = `Your email app should now be open with this message addressed to ${to} — just hit send.`;
          status.classList.add('is-visible');
        }
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText;
        form.reset();
      }, 500);
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