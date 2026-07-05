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
      <p style="margin-top:8px; color:var(--ink-soft);">You can only sign in if you're making a purchase.</p>
      <a href="../pages/merch.html" style="margin-top:16px;" class="btn btn-dark shop-all-btn">Merch →</a>

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
        <input type="text" name="full_name" placeholder="e.g., Nana Nketia" class="checkout-input" value="${escapeHTMLAccount(p.full_name || '')}">
      </div>
      <div>
        <label class="checkout-label">Phone number</label>
        <input type="tel" name="phone" placeholder="e.g., 020XXXXX11" class="checkout-input" value="${escapeHTMLAccount(p.phone || '')}">
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
          <input type="text" name="town" placeholder="e.g., Ablorh Adjei" class="checkout-input" value="${escapeHTMLAccount(p.town || '')}">
        </div>
      </div>
      <div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <label class="checkout-label">GPS address</label>
        <a href="https://www.ghanapostgps.com/map/" target="_blank" style="font-size:0.85rem; text-decoration: underline; color:var(--ink-soft); margin-bottom:4px; display:inline-block;">Don't know your GPS address?</a>
     </div>
        <input type="text" name="gps_address" class="checkout-input" placeholder="e.g., GE-065-1075" value="${escapeHTMLAccount(p.gps_address || '')}">
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
const COMPANY_EMAIL = 'nxnxtech@gmail.com';
const COMPANY_WHATSAPP = '233209156811'; // +233 20 915 6811, no leading '+' for wa.me

const ISSUE_TYPES = [
  { value: 'payment_failed', label: "Payment didn't go through" },
  { value: 'charged_no_confirmation', label: "I was charged but didn't get a confirmation" },
  { value: 'wrong_items', label: 'Wrong or missing items' },
  { value: 'delivery_issue', label: 'Delivery issue' },
  { value: 'other', label: 'Other (describe below)' },
];

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

function issueReportFormHTML(order) {
  return `
    <div data-report-form style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid var(--paper-2);">
      <label class="checkout-label">What's the issue?</label>
      <select data-issue-type class="checkout-input">
        ${ISSUE_TYPES.map((t) => `<option value="${t.value}">${escapeHTMLAccount(t.label)}</option>`).join('')}
      </select>
      <div data-issue-custom-wrap style="display:none; margin-top:10px;">
        <label class="checkout-label">Describe the issue</label>
        <input type="text" data-issue-custom class="checkout-input" placeholder="Type your own issue…">
      </div>
      <div style="margin-top:10px;">
        <label class="checkout-label">Anything else we should know?</label>
        <textarea data-issue-explanation class="checkout-input" rows="3" placeholder="Explain what happened…"></textarea>
      </div>
      <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
        <button type="button" class="btn btn-dark" data-send-email>Email us</button>
        <button type="button" class="btn btn-outline" data-send-whatsapp>WhatsApp us</button>
      </div>
      <p style="font-size:0.78rem; color:var(--ink-soft); margin-top:8px;">This opens your own email or WhatsApp app with the details filled in — nothing is sent automatically.</p>
    </div>
  `;
}

function orderCardHTML(order) {
  const items = order.items || [];
  const rows = items.map((item) => `
    <div class="bag-row" style="grid-template-columns:1fr auto; padding-bottom:10px;">
      <div>${escapeHTMLAccount(item.name)} ${item.size ? `(${escapeHTMLAccount(item.size)})` : ''} × ${item.quantity}</div>
      <div style="font-family:var(--font-mono);">${formatGHSAccount(item.line_total)}</div>
    </div>
  `).join('');

  const cartTotal = (Number(order.subtotal) || 0) - (Number(order.discount_total) || 0);

  return `
    <div class="board-card" data-order-id="${escapeHTMLAccount(order.id)}" style="margin-bottom:20px;">
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
      <div style="font-family:var(--font-mono); font-size:0.78rem; color:var(--ink-soft); margin-top:10px;">
        <div style="display:flex; justify-content:space-between;"><span>Cart total</span><span>${formatGHSAccount(cartTotal)}</span></div>
        ${order.discount_code_amount ? `<div style="display:flex; justify-content:space-between; color:var(--palm);"><span>Discount${order.discount_code ? ` (${escapeHTMLAccount(order.discount_code)})` : ''}</span><span>-${formatGHSAccount(order.discount_code_amount)}</span></div>` : ''}
        ${order.delivery_fee != null ? `<div style="display:flex; justify-content:space-between;"><span>${order.fulfillment_type === 'collect' ? 'Collection' : 'Delivery'}</span><span>${Number(order.delivery_fee) === 0 ? 'Free' : formatGHSAccount(order.delivery_fee)}</span></div>` : ''}
      </div>
      <div class="bag-summary">
        <span>Total</span>
        <span style="font-family:var(--font-display); font-size:1.4rem;">${formatGHSAccount(order.total_amount)}</span>
      </div>
      <div style="margin-top:10px; font-family:var(--font-mono); font-size:0.78rem; color:var(--ink-soft);">
        ${order.fulfillment_type === 'collect' ? 'Collecting in person' : `Delivering to: ${escapeHTMLAccount(order.town)}, ${escapeHTMLAccount(order.region)}`}
      </div>
      <p data-order-status style="font-size:0.85rem; display:none; margin-top:10px;"></p>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        ${order.status === 'pending' ? `<button type="button" class="btn btn-dark order-btn btn-sm" data-resume-payment>Resume payment</button>` : ''}
        <button type="button" class="btn btn-outline btn-sm" data-toggle-report>Report an issue</button>
      </div>
      ${issueReportFormHTML(order)}
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

  function findOrder(id) {
    return orders.find((o) => o.id === id);
  }

  function setCardStatus(card, msg, isError) {
    const status = card.querySelector('[data-order-status]');
    if (!status) return;
    status.textContent = msg;
    status.style.display = 'block';
    status.style.color = isError ? '#B3261E' : 'var(--palm)';
  }

  function buildIssueMessage(order, issueLabel, explanation) {
    return [
      `Order ID: ${order.id}`,
      `Status: ${order.status}`,
      `Total: ${formatGHSAccount(order.total_amount)}`,
      `Paystack reference: ${order.paystack_reference || 'N/A'}`,
      `Date: ${new Date(order.created_at).toLocaleString()}`,
      '',
      `Issue: ${issueLabel}`,
      '',
      'Details:',
      explanation || '(no additional details provided)',
    ].join('\n');
  }

  // ---------- resume payment ----------
  // Clicking "Resume payment" no longer jumps straight into Paystack. It
  // first opens the shared checkout modal on a confirmation step showing the
  // current price (subtotal, whether the original discount code is still
  // active, delivery fee, and grand total) so the shopper isn't surprised if
  // anything changed since they placed the order. Only once they hit
  // "Continue to payment" there do we actually create/resume the transaction.
  container.querySelectorAll('[data-resume-payment]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('[data-order-id]');
      const order = findOrder(card.dataset.orderId);
      if (!order) return;

      if (!window.NxNxComponents?.openResumeConfirm) {
        setCardStatus(card, "Payment isn't available right now — please refresh and try again.", true);
        return;
      }

      window.NxNxComponents.openResumeConfirm(order, {
        onConfirm: async ({ setStatus, button }) => {
          if (typeof PaystackPop === 'undefined') {
            setStatus("Payment isn't available right now — please refresh and try again.", true);
            button.disabled = false;
            return;
          }

          button.disabled = true;
          button.textContent = 'Preparing payment…';

          const { data, error } = await window.supabaseClient.functions.invoke('resume-checkout', {
            body: { order_id: order.id },
          });

          if (error || !data?.access_code) {
            console.error('resume-checkout error:', error, data);
            setStatus(data?.error || 'Could not resume payment. Please try again.', true);
            button.disabled = false;
            button.textContent = 'Continue to payment';
            return;
          }

          button.textContent = 'Waiting for payment…';

          const popup = new PaystackPop();
          popup.resumeTransaction(data.access_code, {
            onSuccess: async (transaction) => {
              const { data: verifyData, error: verifyError } = await window.supabaseClient.functions.invoke('verify-payment', {
                body: { reference: transaction.reference || data.reference },
              });

              if (verifyError || !verifyData?.order) {
                setStatus('Payment received — confirming your order, please refresh in a moment.', false);
                button.disabled = false;
                button.textContent = 'Continue to payment';
                return;
              }

              // Hand off to the receipt step so the shopper can download or
              // screenshot it, then quietly refresh the order list behind it.
              window.NxNxComponents.showReceiptFromOrder(verifyData.order);
              initOrderHistoryPage();
            },
            onCancel: () => {
              button.disabled = false;
              button.textContent = 'Continue to payment';
              setStatus('Payment cancelled.', true);
            },
            onError: (err) => {
              console.error('Paystack error:', err);
              button.disabled = false;
              button.textContent = 'Continue to payment';
              setStatus('Something went wrong with the payment. Please try again.', true);
            },
          });
        },
      });
    });
  });

  // ---------- report an issue ----------
  container.querySelectorAll('[data-toggle-report]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = btn.closest('[data-order-id]').querySelector('[data-report-form]');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
  });

  container.querySelectorAll('[data-issue-type]').forEach((select) => {
    select.addEventListener('change', () => {
      const wrap = select.closest('[data-report-form]').querySelector('[data-issue-custom-wrap]');
      wrap.style.display = select.value === 'other' ? 'block' : 'none';
    });
  });

  function collectIssueDetails(card) {
    const order = findOrder(card.dataset.orderId);
    const form = card.querySelector('[data-report-form]');
    const typeValue = form.querySelector('[data-issue-type]').value;
    const typeMeta = ISSUE_TYPES.find((t) => t.value === typeValue);
    const custom = form.querySelector('[data-issue-custom]')?.value.trim();
    const explanation = form.querySelector('[data-issue-explanation]').value.trim();
    const issueLabel = typeValue === 'other' && custom ? custom : (typeMeta ? typeMeta.label : 'Other');
    return { order, issueLabel, explanation };
  }

  container.querySelectorAll('[data-send-email]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('[data-order-id]');
      const { order, issueLabel, explanation } = collectIssueDetails(card);
      const subject = `Order issue — ${order.id.slice(0, 8)} (${issueLabel})`;
      const bodyText = buildIssueMessage(order, issueLabel, explanation);
      window.location.href = `mailto:${COMPANY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    });
  });

  container.querySelectorAll('[data-send-whatsapp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('[data-order-id]');
      const { order, issueLabel, explanation } = collectIssueDetails(card);
      const text = `Order issue — ${order.id.slice(0, 8)} (${issueLabel})\n\n${buildIssueMessage(order, issueLabel, explanation)}`;
      window.open(`https://wa.me/${COMPANY_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
    });
  });
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