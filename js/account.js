// Account pages — profile.html, change-password.html, order-history.html all
// load this file. Each page has its own container id; whichever one exists on
// the current page gets initialized. All three require a signed-in session.

const GHANA_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Western North', 'Central',
  'Eastern', 'Volta', 'Oti', 'Northern', 'Savannah', 'North East',
  'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo',
];

function escapeHTMLAccount(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatGHSAccount(amount) {
  return `GH₵ ${Number(amount).toFixed(2)}`;
}

function signInPromptHTML() {
  return `
    <div style="text-align:center; padding:40px 20px;">
      <span class="route-tag blue">Sign in required</span>
      <h3 style="margin-top:16px;">You need to be signed in to view this page.</h3>
      <p style="margin-top:8px; color:var(--ink-soft);">Use the account icon in the navigation bar to sign in, then come back here.</p>
    </div>
  `;
}

async function requireUser(container) {
  const { data } = await window.supabaseClient.auth.getSession();
  if (!data?.session) {
    container.innerHTML = signInPromptHTML();
    return null;
  }
  const { data: userData } = await window.supabaseClient.auth.getUser();
  return userData?.user || null;
}

// ---------- PROFILE PAGE ----------
async function initProfilePage() {
  const container = document.getElementById('profile-page');
  if (!container) return;

  container.innerHTML = window.NxNxComponents?.loadingState
    ? window.NxNxComponents.loadingState('Loading your profile…')
    : '';

  const user = await requireUser(container);
  if (!user) return;

  const { data: profile } = await window.supabaseClient
    .from('profiles')
    .select('full_name, phone, region, town, gps_address')
    .eq('id', user.id)
    .maybeSingle();

  const p = profile || {};

  container.innerHTML = `
    <span class="route-tag blue">Your account</span>
    <h3 style="margin-top:16px;">Edit profile</h3>
    <p style="margin-top:6px; color:var(--ink-soft); font-size:0.92rem;">${escapeHTMLAccount(user.email)}</p>
    <form data-profile-form style="margin-top:24px; display:grid; gap:16px; max-width:480px;">
      <div>
        <label class="checkout-label">Full name</label>
        <input type="text" name="full_name" class="checkout-input" value="${escapeHTMLAccount(p.full_name || '')}">
      </div>
      <div>
        <label class="checkout-label">Phone number</label>
        <input type="tel" name="phone" class="checkout-input" value="${escapeHTMLAccount(p.phone || '')}">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
        <div>
          <label class="checkout-label">Region</label>
          <select name="region" class="checkout-input">
            <option value="">Select…</option>
            ${GHANA_REGIONS.map((r) => `<option value="${r}" ${p.region === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="checkout-label">Town</label>
          <input type="text" name="town" class="checkout-input" value="${escapeHTMLAccount(p.town || '')}">
        </div>
      </div>
      <div>
        <label class="checkout-label">GPS address</label>
        <input type="text" name="gps_address" class="checkout-input" value="${escapeHTMLAccount(p.gps_address || '')}">
      </div>
      <p data-profile-status style="font-size:0.85rem; display:none;"></p>
      <button type="submit" class="btn btn-dark" style="justify-self:start;">Save changes</button>
    </form>
  `;

  container.querySelector('[data-profile-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const status = form.querySelector('[data-profile-status]');
    const btn = form.querySelector('button[type="submit"]');

    function setStatus(msg, isError) {
      status.textContent = msg;
      status.style.display = 'block';
      status.style.color = isError ? '#B3261E' : 'var(--palm)';
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Saving…';

    const { error } = await window.supabaseClient.from('profiles').upsert({
      id: user.id,
      full_name: form.full_name.value.trim(),
      phone: form.phone.value.trim(),
      region: form.region.value,
      town: form.town.value.trim(),
      gps_address: form.gps_address.value.trim(),
      updated_at: new Date().toISOString(),
    });

    btn.disabled = false;
    btn.textContent = originalText;

    if (error) {
      console.error('Profile save error:', error);
      setStatus('Could not save your profile. Please try again.', true);
      return;
    }
    setStatus('Saved ✓', false);
  });
}

// ---------- CHANGE PASSWORD PAGE ----------
async function initChangePasswordPage() {
  const container = document.getElementById('change-password-page');
  if (!container) return;

  const user = await requireUser(container);
  if (!user) return;

  container.innerHTML = `
    <span class="route-tag blue">Your account</span>
    <h3 style="margin-top:16px;">Change password</h3>
    <form data-password-form style="margin-top:24px; display:grid; gap:16px; max-width:420px;">
      <div>
        <label class="checkout-label">New password</label>
        <input type="password" name="password" required minlength="6" class="checkout-input">
      </div>
      <div>
        <label class="checkout-label">Confirm new password</label>
        <input type="password" name="confirm" required minlength="6" class="checkout-input">
      </div>
      <p data-password-status style="font-size:0.85rem; display:none;"></p>
      <button type="submit" class="btn btn-dark" style="justify-self:start;">Update password</button>
    </form>
  `;

  container.querySelector('[data-password-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const status = form.querySelector('[data-password-status]');
    const btn = form.querySelector('button[type="submit"]');

    function setStatus(msg, isError) {
      status.textContent = msg;
      status.style.display = 'block';
      status.style.color = isError ? '#B3261E' : 'var(--palm)';
    }

    if (form.password.value !== form.confirm.value) {
      setStatus('Passwords don\u2019t match.', true);
      return;
    }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Updating…';

    const { error } = await window.supabaseClient.auth.updateUser({ password: form.password.value });

    btn.disabled = false;
    btn.textContent = originalText;

    if (error) {
      console.error('Password update error:', error);
      setStatus(error.message, true);
      return;
    }
    setStatus('Password updated ✓', false);
    form.reset();
  });
}

// ---------- ORDER HISTORY PAGE ----------
function orderStatusBadge(status) {
  const map = {
    paid: { label: 'Paid', bg: 'var(--marigold)', color: 'var(--ink)' },
    pending: { label: 'Pending', bg: 'var(--paper-2)', color: 'var(--ink-soft)' },
    failed: { label: 'Failed', bg: '#F8D6D3', color: '#B3261E' },
    cancelled: { label: 'Cancelled', bg: 'var(--paper-2)', color: 'var(--ink-soft)' },
  };
  const s = map[status] || map.pending;
  return `<span class="pill" style="background:${s.bg}; color:${s.color}; border-color:var(--ink);">${s.label}</span>`;
}

function orderCardHTML(order) {
  const items = order.items || [];
  const rows = items.map((item) => `
    <div class="bag-row" style="grid-template-columns:1fr auto; padding-bottom:10px;">
      <div>${escapeHTMLAccount(item.name)} ${item.size ? `(${escapeHTMLAccount(item.size)})` : ''} × ${item.quantity}</div>
      <div style="font-family:var(--font-mono);">${formatGHSAccount(item.line_total)}</div>
    </div>
  `).join('');

  return `
    <div class="board-card" style="margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
        <div>
          <div style="font-family:var(--font-mono); font-size:0.78rem; color:var(--ink-soft);">
            Order ${escapeHTMLAccount(order.id.slice(0, 8))} · ${new Date(order.created_at).toLocaleDateString()}
          </div>
          ${order.is_gift ? `<div style="font-family:var(--font-mono); font-size:0.78rem; margin-top:4px;">🎁 Gift for ${escapeHTMLAccount(order.recipient_name || '')}</div>` : ''}
        </div>
        ${orderStatusBadge(order.status)}
      </div>
      <div class="bag-rows" style="margin-top:16px;">${rows}</div>
      <div class="bag-summary">
        <span>Total</span>
        <span style="font-family:var(--font-display); font-size:1.4rem;">${formatGHSAccount(order.total_amount)}</span>
      </div>
      <div style="margin-top:10px; font-family:var(--font-mono); font-size:0.78rem; color:var(--ink-soft);">
        Delivering to: ${escapeHTMLAccount(order.town)}, ${escapeHTMLAccount(order.region)}
      </div>
    </div>
  `;
}

async function initOrderHistoryPage() {
  const container = document.getElementById('order-history-page');
  if (!container) return;

  container.innerHTML = window.NxNxComponents?.loadingState
    ? window.NxNxComponents.loadingState('Loading your orders…')
    : '';

  const user = await requireUser(container);
  if (!user) return;

  const { data: orders, error } = await window.supabaseClient
    .from('merch_orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Order history error:', error);
    container.innerHTML = `<p style="color:var(--ink-soft);">Couldn't load your orders right now.</p>`;
    return;
  }

  if (!orders || !orders.length) {
    container.innerHTML = `
      <span class="route-tag blue">Your account</span>
      <h3 style="margin-top:16px;">No orders yet.</h3>
      <p style="margin-top:8px; color:var(--ink-soft);">Once you buy something from the merch shop, it'll show up here.</p>
      <a href="merch.html" class="btn btn-dark" style="margin-top:22px; display:inline-flex;">Browse merch →</a>
    `;
    return;
  }

  container.innerHTML = `
    <span class="route-tag blue">Your account</span>
    <h3 style="margin-top:16px; margin-bottom:24px;">Order history</h3>
    ${orders.map(orderCardHTML).join('')}
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  function init() {
    initProfilePage();
    initChangePasswordPage();
    initOrderHistoryPage();
  }
  if (document.querySelector('[data-component="header"], [data-component="footer"]')) {
    document.addEventListener('components:loaded', init, { once: true });
  } else {
    init();
  }
});