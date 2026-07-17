// TrotroTech Solutions - shared behaviour

function initSiteBehaviors() {
  if (document.documentElement.dataset.siteBehaviorsInitialized === 'true') return;
  document.documentElement.dataset.siteBehaviorsInitialized = 'true';

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
  let revealIO;
  function observeReveal(elements) {
    const els = elements instanceof Element ? [elements] : Array.from(elements);
    if (!els.length) return;

    if ('IntersectionObserver' in window) {
      if (!revealIO) {
        revealIO = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              revealIO.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15 });
      }
      els.forEach(el => revealIO.observe(el));
    } else {
      els.forEach(el => el.classList.add('in'));
    }
  }

  observeReveal(document.querySelectorAll('.reveal'));

  /* load testimonials from Supabase and initialize slider */
  const testimonialsContainer = document.querySelector('[data-testimonials-container]');
  const dotsContainer = document.querySelector('[data-dots-container]');

  function renderTestimonials(comments) {
    testimonialsContainer.innerHTML = '';

    if (!comments.length) {
      testimonialsContainer.innerHTML = `<p style="color:var(--ink-soft);">Be the first to leave a review.</p>`;
      return;
    }

    comments.forEach((comment, index) => {
      const slide = document.createElement('div');
      slide.setAttribute('data-slide', '');
      slide.className = `testimonial-slide ${index === 0 ? 'is-active' : ''}`;
      slide.innerHTML = `
        <p style="font-family:var(--font-display); font-size:1.7rem; line-height:1.25;">"${escapeHTML(comment.comment)}"</p>
        <p style="margin-top:18px; font-family:var(--font-mono); font-size:0.85rem; color:var(--ink-soft);">- ${escapeHTML(comment.name)}${comment.company ? `, ${escapeHTML(comment.company)}` : ''}</p>
      `;
      testimonialsContainer.appendChild(slide);
    });

    // Create dots
    comments.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.setAttribute('data-dot', '');
      dot.className = `carousel-dot ${index === 0 ? 'is-active' : ''}`;
      dot.setAttribute('aria-label', `Show testimonial ${index + 1}`);
      dotsContainer.appendChild(dot);
    });

    // Initialize slider after slides are created
    const slider = document.querySelector('[data-testimonial-slider]');
    if (slider) {
      const slides = slider.querySelectorAll('[data-slide]');
      const dots = document.querySelectorAll('[data-dot]');
      let idx = 0;
      let autoplayInterval;

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
        autoplayInterval = setInterval(() => show((idx + 1) % slides.length), 6500);
      }
    }
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  if (testimonialsContainer && dotsContainer) {
    if (!window.supabaseClient) {
      console.error('Supabase client not found - check that supabase-config.js is loaded before main.js.');
    } else {
      if (window.NxNxComponents?.loadingState) {
        testimonialsContainer.innerHTML = window.NxNxComponents.loadingState('Loading reviews…');
      }
      window.supabaseClient
        .from('comments')
        .select('name, comment, company, website')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error('Error loading comments:', error);
            testimonialsContainer.innerHTML = `<p style="color:var(--ink-soft);">Reviews couldn't be loaded right now.</p>`;
            return;
          }
          renderTestimonials(data || []);
        });
    }
  }

  /* load projects from Supabase */
  const projectsGrid = document.getElementById('projects-grid');
  if (projectsGrid) {
    if (!window.supabaseClient) {
      console.error('Supabase client not found - check that supabase-config.js is loaded before main.js.');
    } else {
      if (window.NxNxComponents?.loadingState) {
        projectsGrid.innerHTML = window.NxNxComponents.loadingState('Loading projects…', { fullWidth: true });
      }
      window.supabaseClient
        .from('projects')
        .select('*')
        .order('display_order', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.error('Error loading projects:', error);
            projectsGrid.innerHTML = `<p style="grid-column:1 / -1; color:var(--ink-soft);">Projects couldn't be loaded right now.</p>`;
            return;
          }

          projectsGrid.innerHTML = '';

          (data || []).forEach((project) => {
            let cardHTML;

            if (project.is_main_featured) {
              // Main featured card with images
              const imagesHTML = project.images
                ? project.images.map((img, idx) => `<img src="${img}" alt="" class="app-image-${idx === 0 ? 'work' : 'work-2'}">`).join('')
                : '';

              const linkAttr = project.is_external
                ? `target="_blank" rel="noopener"`
                : '';

              cardHTML = `
                <a href="${project.link}" class="board-card reveal" style="grid-column:1 / -1; display:inline-grid; grid-template-columns:1.1fr 1fr; gap:0; padding:0; text-decoration:none; color:inherit; width:100%;" ${linkAttr}>
                  <div style="padding:40px;">
                    <span class="pill" style="background:var(--marigold); border-color:var(--ink);">${project.type}</span>
                    <h3 style="margin-top:18px; font-size:2.2rem;">${project.title}</h3>
                    <p style="margin-top:12px; color:var(--ink-soft);">Client: ${project.client}. ${project.description}</p>
                    <span class="btn btn-dark btn-sm" style="margin-top:22px;">${project.link_text}</span>
                  </div>
                  <div class="app-image-area">
                    ${imagesHTML}
                  </div>
                </a>
              `;
            } else {
              // Regular board card
              cardHTML = `
                <div class="board-card">
                  <span class="num">${project.num}</span>
                  <span class="pill">${project.type}</span>
                  <h3 style="margin-top:14px;">${project.title}</h3>
                  <p>${project.description}</p>
                  ${project.link ? `<a href="${project.link}" target="_blank" rel="noopener"><span class="btn btn-dark btn-sm" style="margin-top:22px;">${project.link_text}</span></a>` : ''}
                </div>
              `;
            }

            const cardElement = document.createElement('div');
            cardElement.innerHTML = cardHTML;
            const card = cardElement.firstElementChild;
            projectsGrid.appendChild(card);

            if (card.classList.contains('reveal')) {
              observeReveal(card);
            }
          });
        });
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

      if (projectType == "") {

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

      const subject = `New project inquiry from ${name}${projectType ? ' - ' + projectType : ''}`;
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
          status.textContent = `Your email app should now be open with this message addressed to ${to} - just hit send.`;
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

  /* date today for version */
  const dateEl = document.querySelector('[data-date]');
  if (dateEl) {
    const today = new Date();
    const formattedDate = `v${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
    dateEl.textContent = formattedDate;
  }

}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('[data-component="header"], [data-component="footer"]')) {
    document.addEventListener('components:loaded', initSiteBehaviors, { once: true });
  } else {
    initSiteBehaviors();
  }
});