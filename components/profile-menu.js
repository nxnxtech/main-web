// Profile Menu component
// Self-contained, same pattern as cart-bag.js: mounts into a header-provided
// slot if present ([data-component="profile-menu"] inside header.js's
// template), otherwise floats near the cart bag. Only visible when signed in.
//
// IDEAL INTEGRATION: add <div data-component="profile-menu"></div> right next
// to <div data-component="cart-bag"></div> inside your header.js template.

(function () {
  window.NxNxComponents = window.NxNxComponents || {};

  window.NxNxComponents.profileMenu = `
    <div class="profile-menu" data-profile-menu style="display:none;">
      <button type="button" class="profile-menu-button" data-profile-button aria-label="Account menu">
        <span data-profile-initial>A</span>
      </button>
      <div class="profile-dropdown" data-profile-dropdown>
        <a href="profile.html">Edit profile</a>
        <a href="change-password.html">Change password</a>
        <a href="order-history.html">Order history</a>
        <button type="button" data-sign-out>Sign out</button>
      </div>
    </div>
  `;

  function initProfileMenu() {
    let mount = document.querySelector('[data-component="profile-menu"]');
    let wrapper = document.createElement('div');
    wrapper.innerHTML = window.NxNxComponents.profileMenu;
    const el = wrapper.firstElementChild;

    if (mount) {
      mount.replaceWith(el);
    } else {
      el.classList.add('profile-menu-floating');
      document.body.appendChild(el);
    }

    const button = el.querySelector('[data-profile-button]');
    const initialEl = el.querySelector('[data-profile-initial]');
    const dropdown = el.querySelector('[data-profile-dropdown]');
    const signOutBtn = el.querySelector('[data-sign-out]');

    function toggleDropdown(open) {
      dropdown.classList.toggle('is-open', open ?? !dropdown.classList.contains('is-open'));
    }

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });
    document.addEventListener('click', () => toggleDropdown(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleDropdown(false); });

    signOutBtn.addEventListener('click', async () => {
      await window.supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });

    async function refresh() {
      const { data } = await window.supabaseClient.auth.getSession();
      const session = data?.session;
      el.style.display = session ? 'inline-block' : 'none';
      if (!session) return;

      const { data: userData } = await window.supabaseClient.auth.getUser();
      const user = userData?.user;
      let label = (user?.email || 'A').charAt(0).toUpperCase();

      const { data: profile } = await window.supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.full_name) label = profile.full_name.trim().charAt(0).toUpperCase();

      initialEl.textContent = label;
    }

    refresh();
    window.supabaseClient.auth.onAuthStateChange(() => refresh());
  }

  document.addEventListener('components:loaded', () => setTimeout(initProfileMenu, 0), { once: true });
})();