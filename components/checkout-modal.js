// Checkout Modal component
// Self-contained: registers markup, wires its own step machine
// (bag → auth → details → review → receipt), and exposes
// window.openCheckoutModal(step) for the cart bag / product modal to call.

(function () {
  window.NxNxComponents = window.NxNxComponents || {};

  const GHANA_REGIONS = [
    'Greater Accra', 'Ashanti', 'Western', 'Western North', 'Central',
    'Eastern', 'Volta', 'Oti', 'Northern', 'Savannah', 'North East',
    'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo',
  ];

  window.NxNxComponents.checkoutModal = `
    <div class="checkout-modal" data-checkout-modal>
      <div class="checkout-backdrop" data-checkout-backdrop></div>
      <div class="checkout-dialog">
        <button type="button" class="review-close" data-checkout-close aria-label="Close checkout">
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div data-checkout-steps></div>
      </div>
    </div>
  `;

  function formatGHS(amount) {
    return `GH₵ ${amount.toFixed(2)}`;
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function initCheckoutModal() {
    const modal = document.querySelector('[data-checkout-modal]');
    if (!modal) return;

    const backdrop = modal.querySelector('[data-checkout-backdrop]');
    const closeBtn = modal.querySelector('[data-checkout-close]');
    const stepsEl = modal.querySelector('[data-checkout-steps]');

    let authMode = 'signin';
    let details = getJSONCookie('nxnx_checkout_details', {});
    let lastOrder = null;

    function openModal(step) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      renderStep(step || 'bag');
    }

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); }, true);
    closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    async function goPastBag() {
      const { data } = await window.supabaseClient.auth.getSession();
      if (data?.session) {
        renderStep('details');
      } else {
        renderStep('auth');
      }
    }

    function renderStep(step) {
      if (step === 'bag') return renderBag();
      if (step === 'auth') return renderAuth();
      if (step === 'details') return renderDetails();
      if (step === 'review') return renderReview();
      if (step === 'receipt') return renderReceipt();
    }

    // ---------- STEP: BAG ----------
    function renderBag() {
      const items = getCart();

      if (!items.length) {
        stepsEl.innerHTML = `
          <span class="route-tag blue">Your bag</span>
          <h3 style="margin-top:16px;">Your bag is empty.</h3>
          <p style="margin-top:8px; color:var(--ink-soft); font-size:0.95rem;">Add something from the merch shop to get started.</p>
          <a href="merch.html" class="btn btn-dark" style="margin-top:22px; display:inline-flex;">Browse merch →</a>
        `;
        return;
      }

      const rows = items.map((item, i) => {
        const lineTotal = cartLineTotal(item);
        return `
          <div class="bag-row" data-bag-row="${i}">
            <img src="${item.image}" alt="" class="bag-row-image">
            <div class="bag-row-info">
              <div style="font-weight:700;">${escapeHTML(item.name)}</div>
              <div style="font-family:var(--font-mono); font-size:0.78rem; color:var(--ink-soft); margin-top:2px;">
                ${item.size ? `Size ${escapeHTML(item.size)} · ` : ''}${formatGHS(item.price * (item.discount_percent ? 1 - item.discount_percent / 100 : 1))}
              </div>
              <div class="bag-row-qty">
                <button type="button" data-bag-minus="${i}" aria-label="Decrease quantity">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-bag-plus="${i}" aria-label="Increase quantity">+</button>
              </div>
            </div>
            <div class="bag-row-right">
              <button type="button" class="bag-remove" data-bag-remove="${i}" aria-label="Remove item">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.3a1.5 1.5 0 0 1-1.5 1.4H7.1a1.5 1.5 0 0 1-1.5-1.4L5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div style="font-family:var(--font-mono); font-weight:700;">${formatGHS(lineTotal)}</div>
            </div>
          </div>
        `;
      }).join('');

      const subtotal = cartTotal();

      stepsEl.innerHTML = `
        <span class="route-tag blue">Your bag</span>
        <h3 style="margin-top:16px;">${items.reduce((s, i) => s + i.quantity, 0)} item(s)</h3>
        <div class="bag-rows">${rows}</div>
        <div class="bag-summary">
          <span>Total</span>
          <span style="font-family:var(--font-display); font-size:1.6rem;">${formatGHS(subtotal)}</span>
        </div>
        <button type="button" class="btn btn-dark" style="margin-top:20px; width:100%; justify-content:center;" data-bag-checkout>Checkout →</button>
      `;

      stepsEl.querySelectorAll('[data-bag-minus]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.bagMinus);
          const item = getCart()[i];
          updateCartQuantity(i, item.quantity - 1);
          renderBag();
        });
      });
      stepsEl.querySelectorAll('[data-bag-plus]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.bagPlus);
          const item = getCart()[i];
          updateCartQuantity(i, Math.min(item.quantity + 1, item.stock ?? 99));
          renderBag();
        });
      });
      stepsEl.querySelectorAll('[data-bag-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          removeFromCart(Number(btn.dataset.bagRemove));
          renderBag();
        });
      });
      stepsEl.querySelector('[data-bag-checkout]')?.addEventListener('click', goPastBag);
    }

    // ---------- STEP: AUTH ----------
    function renderAuth() {
      stepsEl.innerHTML = `
        <span class="route-tag blue">Sign in to check out</span>
        <h3 style="margin-top:16px;">${authMode === 'signin' ? 'Welcome back.' : 'Create an account.'}</h3>
        <div class="auth-tabs">
          <button type="button" class="auth-tab ${authMode === 'signin' ? 'is-active' : ''}" data-auth-tab="signin">Sign in</button>
          <button type="button" class="auth-tab ${authMode === 'signup' ? 'is-active' : ''}" data-auth-tab="signup">Sign up</button>
        </div>
        <form data-auth-form style="margin-top:20px; display:grid; gap:14px;">
          <div>
            <label class="checkout-label">Email</label>
            <input type="email" placeholder="e.g., nxnxtech@anything.com" name="email" required class="checkout-input">
          </div>
          ${authMode === 'signup' ? `
            <div>
              <label class="checkout-label">Full name</label>
              <input type="text" name="full_name" required class="checkout-input" placeholder="e.g., Nana Nketia">
            </div>
          ` : ''}
          <div>
            <label class="checkout-label">Password</label>
            <input type="password" name="password" required minlength="8" class="checkout-input">
          </div>
          ${authMode === 'signup' ? `
            <div>
              <label class="checkout-label">Confirm password</label>
              <input type="password" name="confirm_password" required minlength="8" class="checkout-input">
            </div>
          ` : ''}
          <p data-auth-hint style="font-size:0.8rem; color:var(--ink-soft); margin-top:-4px;">
            ${authMode === 'signup' ? 'Use at least 8 characters with upper and lower case letters, a number, and a symbol.' : 'Use your email and password to continue.'}
          </p>
          <p data-auth-status style="font-size:0.85rem; display:none;"></p>
          <button type="submit" class="btn btn-dark" style="justify-self:start;">${authMode === 'signin' ? 'Sign in' : 'Sign up'}</button>
        </form>
        <button type="button" class="checkout-back" data-back-to-bag>← Back to bag</button>
      `;

      stepsEl.querySelectorAll('[data-auth-tab]').forEach((tab) => {
        tab.addEventListener('click', () => { authMode = tab.dataset.authTab; renderAuth(); });
      });
      stepsEl.querySelector('[data-back-to-bag]')?.addEventListener('click', () => renderStep('bag'));

      stepsEl.querySelector('[data-auth-form]')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const status = form.querySelector('[data-auth-status]');
        const btn = form.querySelector('button[type="submit"]');
        const email = form.email.value.trim();
        const password = form.password.value;
        const fullName = form.full_name?.value.trim() || '';
        const confirmPassword = form.confirm_password?.value || '';

        function setStatus(msg, isError) {
          status.textContent = msg;
          status.style.display = 'block';
          status.style.color = isError ? '#B3261E' : 'var(--palm)';
        }

        function hasStrongPassword(value) {
          return /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
        }

        if (authMode === 'signup') {
          if (!fullName) {
            setStatus('Please enter your full name.', true);
            return;
          }

          if (password !== confirmPassword) {
            setStatus('Passwords do not match.', true);
            return;
          }

          if (!hasStrongPassword(password)) {
            setStatus('Password must be at least 8 characters and include upper and lower case letters, a number, and a symbol.', true);
            return;
          }
        }

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Please wait…';

        const action = authMode === 'signin'
          ? window.supabaseClient.auth.signInWithPassword({ email, password })
          : window.supabaseClient.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: fullName,
                },
              },
            });

        const { data, error } = await action;

        btn.disabled = false;
        btn.textContent = originalText;

        if (error) {
          setStatus(error.message, true);
          return;
        }

        if (authMode === 'signup' && !data.session) {
          setStatus('Check your email to confirm your account, then sign in.', false);
          authMode = 'signin';
          return;
        }

        renderStep('details');
      });
    }

    // ---------- STEP: DETAILS ----------
    async function renderDetails() {
      const { data: userData } = await window.supabaseClient.auth.getUser();
      const user = userData?.user;

      let profile = {};
      if (user) {
        const { data: profileRow } = await window.supabaseClient
          .from('profiles')
          .select('full_name, phone, region, town, gps_address')
          .eq('id', user.id)
          .maybeSingle();
        if (profileRow) profile = profileRow;
      }

      const d = { ...profile, ...details };

      stepsEl.innerHTML = `
        <span class="route-tag blue">Delivery details</span>
        <h3 style="margin-top:16px;" data-delivery-heading>Where should this go?</h3>
        <form data-details-form style="margin-top:20px; display:grid; gap:14px;">
          <div>
            <label class="checkout-label">Your full name *</label>
            <input type="text" placeholder="e.g., Nana Nketia" name="full_name" required class="checkout-input" value="${escapeHTML(d.full_name || '')}">
          </div>
          <div>
            <label class="checkout-label">Your phone number *</label>
            <input type="tel" placeholder="e.g., 020XXXXX11" name="phone" required class="checkout-input" value="${escapeHTML(d.phone || '')}">
          </div>

          <label class="gift-toggle">
            <input type="checkbox" name="is_gift" data-gift-toggle ${d.is_gift ? 'checked' : ''}>
            <span>🎁 Send this as a gift</span>
          </label>

          <div data-gift-fields style="display:${d.is_gift ? 'grid' : 'none'}; gap:14px; padding:16px; border:1.5px dashed var(--ink); border-radius:8px; background:var(--paper);">
            <div>
              <label class="checkout-label">Recipient's full name *</label>
              <input type="text" placeholder="e.g., Some One" name="recipient_name" class="checkout-input" value="${escapeHTML(d.recipient_name || '')}">
            </div>
            <div>
              <label class="checkout-label">Recipient's phone number *</label>
              <input type="tel" placeholder="e.g., 054XXXXX98" name="recipient_phone" class="checkout-input" value="${escapeHTML(d.recipient_phone || '')}">
            </div>
            <div>
              <label class="checkout-label">Gift message (optional)</label>
              <textarea name="gift_message" rows="2" placeholder="e.g., Happy birthday!, I hope you like it!, NXNX TECH, HWBT" class="checkout-input" style="resize:vertical;">${escapeHTML(d.gift_message || '')}</textarea>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div>
              <label class="checkout-label" data-region-label>Region *</label>
              <select name="region" required class="checkout-input">
                <option value="">Select…</option>
                ${GHANA_REGIONS.map((r) => `<option value="${r}" ${d.region === r ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="checkout-label" data-town-label>Town *</label>
              <input type="text" name="town" required class="checkout-input" value="${escapeHTML(d.town || '')}">
            </div>
          </div>
          <div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="checkout-label" data-gps-label>GPS address</label>
            <a href="https://www.ghanapostgps.com/map/" target="_blank" style="font-size:0.85rem; text-decoration: underline; color:var(--ink-soft); margin-bottom:4px; display:inline-block;">Don't know your GPS address?</a>
          </div>
          </div>
            <input type="text" name="gps_address" placeholder="e.g. GE-065-1075" class="checkout-input" value="${escapeHTML(d.gps_address || '')}">
          </div>
          <button type="submit" class="btn btn-dark" style="justify-self:start;">Continue to payment →</button>
        </form>
        <button type="button" class="checkout-back" data-back-to-bag>← Back to bag</button>
      `;

      const giftToggle = stepsEl.querySelector('[data-gift-toggle]');
      const giftFields = stepsEl.querySelector('[data-gift-fields]');
      const recipientNameInput = stepsEl.querySelector('[name="recipient_name"]');
      const recipientPhoneInput = stepsEl.querySelector('[name="recipient_phone"]');
      const deliveryHeading = stepsEl.querySelector('[data-delivery-heading]');
      const regionLabel = stepsEl.querySelector('[data-region-label]');
      const townLabel = stepsEl.querySelector('[data-town-label]');
      const gpsLabel = stepsEl.querySelector('[data-gps-label]');

      function syncGiftUI(isGift) {
        giftFields.style.display = isGift ? 'grid' : 'none';
        recipientNameInput.required = isGift;
        recipientPhoneInput.required = isGift;
        deliveryHeading.textContent = isGift ? 'Where is this being delivered?' : 'Where should this go?';
        regionLabel.textContent = isGift ? "Recipient's region *" : 'Region *';
        townLabel.textContent = isGift ? "Recipient's town *" : 'Town *';
        gpsLabel.textContent = isGift ? "Recipient's GPS address" : 'GPS address';
      }
      syncGiftUI(giftToggle.checked);
      giftToggle.addEventListener('change', () => syncGiftUI(giftToggle.checked));

      stepsEl.querySelector('[data-back-to-bag]')?.addEventListener('click', () => renderStep('bag'));

      stepsEl.querySelector('[data-details-form]')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        details = {
          full_name: form.full_name.value.trim(),
          phone: form.phone.value.trim(),
          region: form.region.value,
          town: form.town.value.trim(),
          gps_address: form.gps_address.value.trim(),
          is_gift: form.is_gift.checked,
          recipient_name: form.is_gift.checked ? form.recipient_name.value.trim() : '',
          recipient_phone: form.is_gift.checked ? form.recipient_phone.value.trim() : '',
          gift_message: form.is_gift.checked ? form.gift_message.value.trim() : '',
        };
        setJSONCookie('nxnx_checkout_details', details, 30);

        if (user) {
          await window.supabaseClient.from('profiles').upsert({
            id: user.id,
            full_name: details.full_name,
            phone: details.phone,
            region: details.region,
            town: details.town,
            gps_address: details.gps_address,
            updated_at: new Date().toISOString(),
          });
        }

        renderStep('review');
      });
    }

    // ---------- STEP: REVIEW + PAY ----------
    function renderReview() {
      const items = getCart();
      const subtotal = cartTotal();

      const rows = items.map((item) => `
        <div class="bag-row" style="grid-template-columns:1fr auto;">
          <div>
            <div style="font-weight:700;">${escapeHTML(item.name)} ${item.size ? `(${escapeHTML(item.size)})` : ''} × ${item.quantity}</div>
          </div>
          <div style="font-family:var(--font-mono);">${formatGHS(cartLineTotal(item))}</div>
        </div>
      `).join('');

      stepsEl.innerHTML = `
        <span class="route-tag blue">Review &amp; pay</span>
        <h3 style="margin-top:16px;">Ready when you are.</h3>
        <div class="bag-rows">${rows}</div>
        <div style="margin-top:16px; padding-top:16px; border-top:2px solid var(--ink); font-family:var(--font-mono); font-size:0.9rem; color:var(--ink-soft);">
          <div>${escapeHTML(details.full_name || '')} · ${escapeHTML(details.phone || '')}</div>
          ${details.is_gift ? `
            <div style="margin-top:8px; color:var(--ink);">🎁 Gift for ${escapeHTML(details.recipient_name || '')} · ${escapeHTML(details.recipient_phone || '')}</div>
            ${details.gift_message ? `<div style="font-style:italic; margin-top:4px;">“${escapeHTML(details.gift_message)}”</div>` : ''}
          ` : ''}
          <div style="margin-top:8px;">${escapeHTML(details.town || '')}, ${escapeHTML(details.region || '')}</div>
          ${details.gps_address ? `<div>${escapeHTML(details.gps_address)}</div>` : ''}
        </div>
        <div class="bag-summary">
          <span>Total</span>
          <span style="font-family:var(--font-display); font-size:1.6rem;">${formatGHS(subtotal)}</span>
        </div>
        <p data-review-status style="font-size:0.85rem; display:none; margin-top:10px;"></p>
        <button type="button" class="btn btn-dark" style="margin-top:20px; width:100%; justify-content:center;" data-make-payment>Make payment</button>
        <button type="button" class="checkout-back" data-back-to-details>← Edit details</button>
      `;

      stepsEl.querySelector('[data-back-to-details]')?.addEventListener('click', () => renderStep('details'));

      stepsEl.querySelector('[data-make-payment]')?.addEventListener('click', async (e) => {
        const btn = e.target;
        const status = stepsEl.querySelector('[data-review-status]');

        function setStatus(msg, isError) {
          status.textContent = msg;
          status.style.display = 'block';
          status.style.color = isError ? '#B3261E' : 'var(--palm)';
        }

        if (typeof PaystackPop === 'undefined') {
          setStatus('Payment isn\'t available right now — please refresh and try again.', true);
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Preparing payment…';

        const payload = {
          items: getCart().map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
          full_name: details.full_name,
          phone: details.phone,
          region: details.region,
          town: details.town,
          gps_address: details.gps_address,
          is_gift: details.is_gift || false,
          recipient_name: details.recipient_name || null,
          recipient_phone: details.recipient_phone || null,
          gift_message: details.gift_message || null,
        };

        const { data, error } = await window.supabaseClient.functions.invoke('create-checkout', { body: payload });

        if (error || !data?.access_code) {
          console.error('create-checkout error:', error, data);
          setStatus('Could not start payment. Please try again.', true);
          btn.disabled = false;
          btn.textContent = 'Make payment';
          return;
        }

        btn.textContent = 'Waiting for payment…';

        const popup = new PaystackPop();
        popup.resumeTransaction(data.access_code, {
          onSuccess: async (transaction) => {
            const { data: verifyData, error: verifyError } = await window.supabaseClient.functions.invoke(
              'verify-payment',
              { body: { reference: transaction.reference || data.reference } }
            );

            btn.disabled = false;
            btn.textContent = 'Make payment';

            if (verifyError || !verifyData?.order) {
              setStatus('Payment received — confirming your order, please wait a moment then check your account.', false);
              return;
            }

            lastOrder = verifyData.order;
            clearCart();
            deleteCookie('nxnx_checkout_details');
            renderStep('receipt');
          },
          onCancel: () => {
            btn.disabled = false;
            btn.textContent = 'Make payment';
            setStatus('Payment cancelled.', true);
          },
          onError: (err) => {
            console.error('Paystack error:', err);
            btn.disabled = false;
            btn.textContent = 'Make payment';
            setStatus('Something went wrong with the payment. Please try again.', true);
          },
        });
      });
    }

    // ---------- STEP: RECEIPT ----------
    function renderReceipt() {
      if (!lastOrder) { renderStep('bag'); return; }

      const items = lastOrder.items || [];
      const rows = items.map((item) => `
        <div class="bag-row" style="grid-template-columns:1fr auto;">
          <div>${escapeHTML(item.name)} ${item.size ? `(${escapeHTML(item.size)})` : ''} × ${item.quantity}</div>
          <div style="font-family:var(--font-mono);">${formatGHS(item.line_total)}</div>
        </div>
      `).join('');

      stepsEl.innerHTML = `
        <span class="route-tag green">Payment successful</span>
        <h3 style="margin-top:16px;">Thanks, ${escapeHTML(lastOrder.full_name)}.</h3>
        <p style="margin-top:8px; color:var(--ink-soft); font-size:0.95rem;">Screenshot or download this receipt for your records.</p>
        <div id="receipt-capture" class="receipt-box">
          <div style="font-family:var(--font-mono); font-size:0.78rem; color:var(--ink-soft);">
            Order ${escapeHTML(lastOrder.id)}<br>
            ${new Date(lastOrder.paid_at || lastOrder.created_at).toLocaleString()}
          </div>
          <div class="bag-rows" style="margin-top:14px;">${rows}</div>
          <div class="bag-summary">
            <span>Total paid</span>
            <span style="font-family:var(--font-display); font-size:1.6rem;">${formatGHS(lastOrder.total_amount)}</span>
          </div>
          ${lastOrder.is_gift ? `
            <div style="margin-top:14px; font-family:var(--font-mono); font-size:0.8rem; color:var(--ink-soft);">
              🎁 Gift for ${escapeHTML(lastOrder.recipient_name)} · ${escapeHTML(lastOrder.recipient_phone)}
            </div>
          ` : ''}
          <div style="margin-top:6px; font-family:var(--font-mono); font-size:0.8rem; color:var(--ink-soft);">
            Delivering to: ${escapeHTML(lastOrder.town)}, ${escapeHTML(lastOrder.region)}
          </div>
        </div>
        <div style="display:flex; gap:12px; margin-top:22px; flex-wrap:wrap;">
          <button type="button" class="btn btn-dark" data-download-receipt>Download receipt</button>
          <button type="button" class="btn btn-outline" data-done>Done</button>
        </div>
      `;

      stepsEl.querySelector('[data-done]')?.addEventListener('click', closeModal);
      stepsEl.querySelector('[data-download-receipt]')?.addEventListener('click', () => downloadReceiptPDF(lastOrder));
    }

    function downloadReceiptPDF(order) {
    if (typeof window.jspdf === "undefined") {
        window.print();
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        unit: "pt",
        format: "a5"
    });

    const pageWidth = 420;
    const pageHeight = 595;
    const margin = 28;

    // Brand Colors
    const primary = [20, 20, 20];
    const accent = [194, 242, 49];
    const gray = [120, 120, 120];
    const light = [245, 245, 245];

    // Background
    doc.setFillColor(250, 250, 250);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // ======================================================
    // HEADER
    // ======================================================

    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, 0, pageWidth, 90, "F");

    // Logo
    doc.addImage(
        "../images/simple-logo-nobg.png",
        "PNG",
        28,
        18,
        50,
        50
    );

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("NxNx Tech", 90, 38);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Official Payment Receipt", 90, 56);

    // PAID Badge
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.roundedRect(310, 24, 80, 28, 6, 6, "F");

    doc.setTextColor(20,20,20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PAID", 350, 42, { align: "center" });

    // ======================================================
    // RECEIPT DETAILS
    // ======================================================

    let y = 110;

    doc.setDrawColor(220);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 115, 6, 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);

    doc.text("Receipt Details", margin + 12, y + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(gray[0], gray[1], gray[2]);

    doc.text(`Receipt #: ${order.id}`, margin + 12, y + 42);

    doc.text(
        `Date: ${new Date(
            order.paid_at || order.created_at
        ).toLocaleString()}`,
        margin + 12,
        y + 58
    );

    doc.text(
        `Customer: ${order.full_name || "Guest"}`,
        margin + 12,
        y + 74
    );

    doc.text(
        `Phone: ${order.phone || "-"}`,
        margin + 12,
        y + 90
    );

    // ======================================================
    // ITEMS
    // ======================================================

    y += 140;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.setFontSize(11);

    doc.text("Items Purchased", margin, y);

    y += 15;

    // Table Header

    doc.setFillColor(light[0], light[1], light[2]);
    doc.rect(margin, y, pageWidth - margin * 2, 24, "F");

    doc.setFontSize(9);
    doc.text("Item", margin + 10, y + 16);
    doc.text("Qty", 250, y + 16);
    doc.text("Amount", 390, y + 16, { align: "right" });

    y += 32;

    doc.setFont("helvetica", "normal");

    (order.items || []).forEach(item => {

        const name = `${item.name}${item.size ? ` (${item.size})` : ""}`;

        doc.text(name, margin + 10, y);

        doc.text(
            String(item.quantity),
            250,
            y
        );

        doc.text(
            `GH₵ ${Number(item.line_total).toFixed(2)}`,
            390,
            y,
            { align: "right" }
        );

        y += 20;
    });

    // Divider

    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);

    y += 20;

    // ======================================================
    // TOTAL
    // ======================================================

    doc.setFillColor(accent[0], accent[1], accent[2]);

    doc.roundedRect(
        margin,
        y,
        pageWidth - margin * 2,
        45,
        6,
        6,
        "F"
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20,20,20);

    doc.text("TOTAL PAID", margin + 15, y + 28);

    doc.text(
        `GH₵ ${Number(order.total_amount).toFixed(2)}`,
        pageWidth - margin - 15,
        y + 28,
        { align: "right" }
    );

    // ======================================================
    // FOOTER
    // ======================================================

    doc.setDrawColor(230);
    doc.line(
        margin,
        pageHeight - 75,
        pageWidth - margin,
        pageHeight - 75
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40);

    doc.text(
        "Thank you for shopping with NxNx Tech!",
        pageWidth / 2,
        pageHeight - 52,
        { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(gray[0], gray[1], gray[2]);

    doc.text(
        "Quality Tech • Fast Delivery • Secure Payments",
        pageWidth / 2,
        pageHeight - 34,
        { align: "center" }
    );

    doc.save(`nxnx-receipt-${order.id.slice(0,8)}.pdf`);
}

    window.openCheckoutModal = openModal;
  }

  document.addEventListener('components:loaded', () => setTimeout(initCheckoutModal, 0), { once: true });
})();