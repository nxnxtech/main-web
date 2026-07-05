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
    return `GHs ${amount.toFixed(2)}`;
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // ---------- DELIVERY FEE (from public.delivery_settings) ----------
  let deliverySettingsCache = null;

  async function getDeliverySettings() {
    if (deliverySettingsCache) return deliverySettingsCache;

    const { data, error } = await window.supabaseClient
      .from('delivery_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      console.error('Error loading delivery settings:', error);
      // Safe fallback so the UI doesn't break if the row is missing.
      deliverySettingsCache = { base_fee: 0, half_off_threshold: Infinity, half_off_percent: 0, free_threshold: Infinity };
    } else {
      deliverySettingsCache = data;
    }
    return deliverySettingsCache;
  }

  function computeDeliveryFee(subtotal, fulfillmentType, settings) {
    if (fulfillmentType === 'collect' || !settings) return 0;
    if (subtotal >= Number(settings.free_threshold)) return 0;
    if (subtotal >= Number(settings.half_off_threshold)) {
      return Number(settings.base_fee) * (1 - Number(settings.half_off_percent) / 100);
    }
    return Number(settings.base_fee);
  }

  // ---------- DISCOUNT CODES (from public.discount_codes / discount_code_products) ----------
  async function validateDiscountCode(rawCode, items) {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) return { error: 'Please enter a code.' };

    const { data: discount, error } = await window.supabaseClient
      .from('discount_codes')
      .select('*, discount_code_products(product_id)')
      .eq('code', code)
      .maybeSingle();

    if (error || !discount) return { error: "That code isn't valid." };
    if (!discount.is_active) return { error: 'That code is no longer active.' };

    const now = new Date();
    if (discount.starts_at && new Date(discount.starts_at) > now) return { error: "That code isn't active yet." };
    if (discount.expires_at && new Date(discount.expires_at) < now) return { error: 'That code has expired.' };
    if (discount.max_uses != null && discount.used_count >= discount.max_uses) {
      return { error: 'That code has reached its usage limit.' };
    }

    // applies_to: 'all' → whole bag, 'products' → only the linked merch_products rows
    const eligibleProductIds = discount.applies_to === 'products'
      ? new Set((discount.discount_code_products || []).map((p) => p.product_id))
      : null;

    let discountableTotal = 0;
    items.forEach((item) => {
      const lineTotal = cartLineTotal(item);
      if (eligibleProductIds === null || eligibleProductIds.has(item.product_id)) {
        discountableTotal += lineTotal;
      }
    });

    if (eligibleProductIds !== null && discountableTotal === 0) {
      return { error: "This code doesn't apply to anything in your bag." };
    }

    const discountAmount = discountableTotal * (Number(discount.percent) / 100);

    return {
      code: discount.code,
      percent: Number(discount.percent),
      appliesTo: discount.applies_to,
      discountAmount,
    };
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
    let fulfillmentType = details.fulfillment_type || 'delivery'; // 'delivery' | 'collect'
    let appliedDiscount = null; // { code, percent, appliesTo, discountAmount }
    let isGuest = false; // true once someone explicitly chooses to check out without an account

    function openModal(step) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      renderStep(step || 'bag');
    }

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    document.addEventListener('cart:updated', () => { appliedDiscount = null; });

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
      if (step === 'guest-warning') return renderGuestWarning();
      if (step === 'guest-contact') return renderGuestContact();
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
                <button type="button" data-bag-minus="${i}" aria-label="Decrease quantity" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
                <span>${item.quantity}</span>
                <button type="button" data-bag-plus="${i}" aria-label="Increase quantity" ${item.quantity >= (item.stock ?? 99) ? 'disabled' : ''}>+</button>
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
      isGuest = false; // arriving here (fresh, or "back") always means "not guest" until they say otherwise

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
        <button type="button" class="checkout-guest-link" data-continue-guest style="margin-top:16px; background:none; border:none; padding:0; text-decoration:underline; cursor:pointer; font-family:var(--font-mono); font-size:0.85rem; color:var(--ink-soft);">Continue as guest →</button>
        <button type="button" class="checkout-back" data-back-to-bag>← Back to bag</button>
      `;

      stepsEl.querySelectorAll('[data-auth-tab]').forEach((tab) => {
        tab.addEventListener('click', () => { authMode = tab.dataset.authTab; renderAuth(); });
      });
      stepsEl.querySelector('[data-continue-guest]')?.addEventListener('click', () => renderStep('guest-warning'));
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

    // ---------- STEP: GUEST WARNING ----------
    // Shown before letting someone skip account creation, so the trade-off is
    // explicit rather than a dark pattern buried in fine print.
    function renderGuestWarning() {
      stepsEl.innerHTML = `
        <span class="route-tag blue">Continue as guest</span>
        <h3 style="margin-top:16px;">Before you skip creating an account…</h3>
        <p style="margin-top:8px; color:var(--ink-soft); font-size:0.95rem;">Here's what an account gets you that a one-off guest order won't:</p>
        <ul style="margin-top:16px; padding-left:0; list-style:none; display:grid; gap:12px; font-size:0.92rem;">
          <li style="display:flex; gap:10px;"><span>🏷️</span><span><strong>Member-only discounts</strong> — some codes and early sale access are only ever sent to account holders.</span></li>
          <li style="display:flex; gap:10px;"><span>📦</span><span><strong>Order history &amp; resume payment</strong> — come back and finish a payment, or look up a past order, any time.</span></li>
          <li style="display:flex; gap:10px;"><span>⚡</span><span><strong>Faster checkout next time</strong> — your delivery details are saved, so you won't retype them.</span></li>
          <li style="display:flex; gap:10px;"><span>🛟</span><span><strong>Easier support</strong> — we can pull up your order instantly if something needs fixing.</span></li>
        </ul>
        <p style="margin-top:16px; color:var(--ink-soft); font-size:0.9rem;">As a guest, your receipt is the only record of this order — make sure to download or screenshot it.</p>
        <div style="margin-top:22px; display:flex; gap:12px; flex-wrap:wrap;">
          <button type="button" class="btn btn-dark" data-guest-create-account>Create a free account</button>
          <button type="button" class=".btn btn-sm btn-outline" data-guest-continue>Continue as guest</button>
        </div>
        <button type="button" class="checkout-back" data-back-to-auth>← Back</button>
      `;

      stepsEl.querySelector('[data-guest-create-account]')?.addEventListener('click', () => {
        authMode = 'signup';
        renderStep('auth');
      });
      stepsEl.querySelector('[data-guest-continue]')?.addEventListener('click', () => renderStep('guest-contact'));
      stepsEl.querySelector('[data-back-to-auth]')?.addEventListener('click', () => renderStep('auth'));
    }

    // ---------- STEP: GUEST CONTACT ----------
    // Guests have no auth email on file, so we collect one here purely to
    // send/confirm the order — it's carried through in `details.email`.
    function renderGuestContact() {
      stepsEl.innerHTML = `
        <span class="route-tag blue">Continue as guest</span>
        <h3 style="margin-top:16px;">Where should we send your receipt?</h3>
        <p style="margin-top:8px; color:var(--ink-soft); font-size:0.95rem;">We'll only use this to confirm your order — no account, no saved history.</p>
        <form data-guest-contact-form style="margin-top:20px; display:grid; gap:14px;">
          <div>
            <label class="checkout-label">Email *</label>
            <input type="email" name="email" required class="checkout-input" placeholder="e.g., you@email.com" value="${escapeHTML(details.email || '')}">
          </div>
          <p data-guest-contact-status style="font-size:0.85rem; display:none; color:#B3261E;"></p>
          <button type="submit" class="btn btn-dark" style="justify-self:start;">Continue →</button>
        </form>
        <button type="button" class="checkout-back" data-back-to-guest-warning>← Back</button>
      `;

      stepsEl.querySelector('[data-back-to-guest-warning]')?.addEventListener('click', () => renderStep('guest-warning'));

      stepsEl.querySelector('[data-guest-contact-form]')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const email = form.email.value.trim();
        const status = form.querySelector('[data-guest-contact-status]');

        if (!email) {
          status.textContent = 'Please enter an email address.';
          status.style.display = 'block';
          return;
        }

        isGuest = true;
        details = { ...details, email };
        setJSONCookie('nxnx_checkout_details', details, 30);
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
        <span class="route-tag blue">${isGuest ? 'Guest checkout — delivery details' : 'Delivery details'}</span>
        <h3 style="margin-top:16px;" data-delivery-heading>Where should this go?</h3>

        <div class="auth-tabs" style="margin-top:16px;">
          <button type="button" class="auth-tab ${fulfillmentType === 'delivery' ? 'is-active' : ''}" data-fulfillment-tab="delivery">Delivery</button>
          <button type="button" class="auth-tab ${fulfillmentType === 'collect' ? 'is-active' : ''}" data-fulfillment-tab="collect">Collect</button>
        </div>

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

          <div data-delivery-fields style="display:${fulfillmentType === 'collect' ? 'none' : 'grid'}; gap:14px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <div>
                <label class="checkout-label" data-region-label>Region *</label>
                <select name="region" ${fulfillmentType === 'collect' ? '' : 'required'} class="checkout-input">
                  <option value="">Select…</option>
                  ${GHANA_REGIONS.map((r) => `<option value="${r}" ${d.region === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="checkout-label" data-town-label>Town *</label>
                <input type="text" name="town" ${fulfillmentType === 'collect' ? '' : 'required'} class="checkout-input" value="${escapeHTML(d.town || '')}">
              </div>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label class="checkout-label" data-gps-label>GPS address</label>
                <a href="https://www.ghanapostgps.com/map/" target="_blank" style="font-size:0.85rem; text-decoration: underline; color:var(--ink-soft); margin-bottom:4px; display:inline-block;">Don't know your GPS address?</a>
              </div>
              <input type="text" name="gps_address" placeholder="e.g. GE-065-1075" class="checkout-input" value="${escapeHTML(d.gps_address || '')}">
            </div>
          </div>

          <p data-collect-note style="font-size:0.85rem; color:var(--ink-soft); display:${fulfillmentType === 'collect' ? 'block' : 'none'};">
            No delivery fee — pick this up from us once your order is confirmed. We'll reach you on the phone number above.
          </p>

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
      const regionInput = stepsEl.querySelector('[name="region"]');
      const townInput = stepsEl.querySelector('[name="town"]');
      const deliveryFieldsWrap = stepsEl.querySelector('[data-delivery-fields]');
      const collectNote = stepsEl.querySelector('[data-collect-note]');

      function syncHeading() {
        const isGift = giftToggle.checked;
        if (fulfillmentType === 'collect') {
          //alert(`Sorry, Collect is not available at the moment. Please use Delivery instead. \n\nIt'll be active soon. \nThank you for understanding.`);
          //fulfillmentType = 'delivery';
          //syncFulfillmentUI();

          deliveryHeading.textContent = isGift ? "Who's collecting this?" : 'Just need a few details.';
        } else {
          deliveryHeading.textContent = isGift ? 'Where is this being delivered?' : 'Where should this go?';
        }
        regionLabel.textContent = isGift ? "Recipient's region *" : 'Region *';
        townLabel.textContent = isGift ? "Recipient's town *" : 'Town *';
        gpsLabel.textContent = isGift ? "Recipient's GPS address" : 'GPS address';
      }

      function syncGiftUI(isGift) {
        giftFields.style.display = isGift ? 'grid' : 'none';
        recipientNameInput.required = isGift;
        recipientPhoneInput.required = isGift;
        syncHeading();
      }

      function syncFulfillmentUI() {
        stepsEl.querySelectorAll('[data-fulfillment-tab]').forEach((tab) => {
          tab.classList.toggle('is-active', tab.dataset.fulfillmentTab === fulfillmentType);
        });
        const isCollect = fulfillmentType === 'collect';
        deliveryFieldsWrap.style.display = isCollect ? 'none' : 'grid';
        collectNote.style.display = isCollect ? 'block' : 'none';
        regionInput.required = !isCollect;
        townInput.required = !isCollect;
        syncHeading();
      }

      syncGiftUI(giftToggle.checked);
      giftToggle.addEventListener('change', () => syncGiftUI(giftToggle.checked));

      stepsEl.querySelectorAll('[data-fulfillment-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
          fulfillmentType = tab.dataset.fulfillmentTab;
          syncFulfillmentUI();
        });
      });

      stepsEl.querySelector('[data-back-to-bag]')?.addEventListener('click', () => renderStep('bag'));

      stepsEl.querySelector('[data-details-form]')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        details = {
          email: details.email || '', // set during the guest-contact step; not shown/edited on this form
          full_name: form.full_name.value.trim(),
          phone: form.phone.value.trim(),
          region: fulfillmentType === 'collect' ? '' : form.region.value,
          town: fulfillmentType === 'collect' ? '' : form.town.value.trim(),
          gps_address: fulfillmentType === 'collect' ? '' : form.gps_address.value.trim(),
          is_gift: form.is_gift.checked,
          recipient_name: form.is_gift.checked ? form.recipient_name.value.trim() : '',
          recipient_phone: form.is_gift.checked ? form.recipient_phone.value.trim() : '',
          gift_message: form.is_gift.checked ? form.gift_message.value.trim() : '',
          fulfillment_type: fulfillmentType,
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
    async function renderReview() {
      const items = getCart();
      const subtotal = cartTotal();
      const settings = await getDeliverySettings();

      function currentDeliveryFee() {
        return computeDeliveryFee(subtotal, fulfillmentType, settings);
      }

      function currentDiscountAmount() {
        return appliedDiscount ? appliedDiscount.discountAmount : 0;
      }

      function grandTotal() {
        const total = subtotal - currentDiscountAmount() + currentDeliveryFee();
        return Math.max(0, total);
      }

      const rows = items.map((item) => `
        <div class="bag-row" style="grid-template-columns:1fr auto;">
          <div>
            <div style="font-weight:700;">${escapeHTML(item.name)} ${item.size ? `(${escapeHTML(item.size)})` : ''} × ${item.quantity}</div>
          </div>
          <div style="font-family:var(--font-mono);">${formatGHS(cartLineTotal(item))}</div>
        </div>
      `).join('');

      function summaryHTML() {
        const deliveryFee = currentDeliveryFee();
        const discountAmount = currentDiscountAmount();
        return `
          <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--ink-soft); font-family:var(--font-mono);">
            <span>Subtotal</span><span>${formatGHS(subtotal)}</span>
          </div>
          ${appliedDiscount ? `
            <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--palm); font-family:var(--font-mono); margin-top:6px;">
              <span>Discount (${escapeHTML(appliedDiscount.code)} · -${appliedDiscount.percent}%)</span><span>-${formatGHS(discountAmount)}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--ink-soft); font-family:var(--font-mono); margin-top:6px;">
            <span>${fulfillmentType === 'collect' ? 'Collection' : 'Delivery'}</span>
            <span>${deliveryFee === 0 ? 'Free' : formatGHS(deliveryFee)}</span>
          </div>
          <div class="bag-summary" style="margin-top:12px;">
            <span>Total</span>
            <span style="font-family:var(--font-display); font-size:1.6rem;">${formatGHS(grandTotal())}</span>
          </div>
        `;
      }

      stepsEl.innerHTML = `
        <span class="route-tag blue">${isGuest ? 'Review & pay — guest checkout' : 'Review & pay'}</span>
        <h3 style="margin-top:16px;">Ready when you are.</h3>
        <div class="bag-rows">${rows}</div>
        <div style="margin-top:16px; padding-top:16px; border-top:2px solid var(--ink); font-family:var(--font-mono); font-size:0.9rem; color:var(--ink-soft);">
          <div>${escapeHTML(details.full_name || '')} · ${escapeHTML(details.phone || '')}</div>
          ${isGuest ? `<div style="margin-top:4px;">${escapeHTML(details.email || '')}</div>` : ''}
          ${details.is_gift ? `
            <div style="margin-top:8px; color:var(--ink);">🎁 Gift for ${escapeHTML(details.recipient_name || '')} · ${escapeHTML(details.recipient_phone || '')}</div>
            ${details.gift_message ? `<div style="font-style:italic; margin-top:4px;">“${escapeHTML(details.gift_message)}”</div>` : ''}
          ` : ''}
          ${fulfillmentType === 'collect'
            ? `<div style="margin-top:8px;">🧔‍♀️ Collecting in person</div>`
            : `<div style="margin-top:8px;">🚚 ${escapeHTML(details.town || '')}, ${escapeHTML(details.region || '')}</div>
               ${details.gps_address ? `<div>${escapeHTML(details.gps_address)}</div>` : ''}`}
        </div>

        <div style="margin-top:18px;">
          <label class="checkout-label">Discount code</label>
          <div style="display:flex; gap:8px;">
            <input type="text" data-discount-input class="checkout-input" placeholder="e.g. NXNX10" value="${appliedDiscount ? escapeHTML(appliedDiscount.code) : ''}" ${appliedDiscount ? 'disabled' : ''} style="flex:1;">
            ${appliedDiscount
              ? `<button type="button" class="btn btn-outline" data-discount-remove>Remove</button>`
              : `<button type="button" class="btn btn-outline btn-sm" data-discount-apply>Apply</button>`}
          </div>
          <p data-discount-status style="font-size:0.85rem; margin-top:6px; ${appliedDiscount ? '' : 'display:none;'} color:${appliedDiscount ? 'var(--palm)' : '#B3261E'};">${appliedDiscount ? `${appliedDiscount.percent}% off applied.` : ''}</p>
        </div>

        <div data-summary style="margin-top:16px;">${summaryHTML()}</div>

        <p data-review-status style="font-size:0.85rem; display:none; margin-top:10px;"></p>
        <button type="button" class="btn btn-dark" style="margin-top:20px; width:100%; justify-content:center;" data-make-payment>Make payment</button>
        <button type="button" class="checkout-back" data-back-to-details>← Edit details</button>
      `;

      stepsEl.querySelector('[data-back-to-details]')?.addEventListener('click', () => renderStep('details'));

      stepsEl.querySelector('[data-discount-apply]')?.addEventListener('click', async () => {
        const input = stepsEl.querySelector('[data-discount-input]');
        const discountStatus = stepsEl.querySelector('[data-discount-status]');
        const applyBtn = stepsEl.querySelector('[data-discount-apply]');

        applyBtn.disabled = true;
        applyBtn.textContent = 'Checking…';

        const result = await validateDiscountCode(input.value, items);

        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';

        if (result.error) {
          discountStatus.textContent = result.error;
          discountStatus.style.display = 'block';
          discountStatus.style.color = '#B3261E';
          return;
        }

        appliedDiscount = result;
        renderReview();
      });

      stepsEl.querySelector('[data-discount-remove]')?.addEventListener('click', () => {
        appliedDiscount = null;
        renderReview();
      });

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
          fulfillment_type: fulfillmentType,
          discount_code: appliedDiscount ? appliedDiscount.code : null,
          is_guest: isGuest,
          guest_email: isGuest ? (details.email || null) : null,
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

    function renderReceipt() {
      if (!lastOrder) { renderStep('bag'); return; }

      const items = lastOrder.items || [];
      const rows = items.map((item) => `
        <div class="bag-row" style="grid-template-columns:1fr auto;">
          <div>${escapeHTML(item.name)} ${item.size ? `(${escapeHTML(item.size)})` : ''} × ${item.quantity}</div>
          <div style="font-family:var(--font-mono);">${formatGHS(item.line_total)}</div>
        </div>
      `).join('');

      const cartTotal = (Number(lastOrder.subtotal) || 0) - (Number(lastOrder.discount_total) || 0);

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
          <div style="font-family:var(--font-mono); font-size:0.8rem; color:var(--ink-soft); margin-top:10px;">
            <div style="display:flex; justify-content:space-between;"><span>Cart total</span><span>${formatGHS(cartTotal)}</span></div>
            ${lastOrder.discount_code_amount ? `<div style="display:flex; justify-content:space-between; color:var(--palm);"><span>Discount${lastOrder.discount_code ? ` (${escapeHTML(lastOrder.discount_code)})` : ''}</span><span>-${formatGHS(Number(lastOrder.discount_code_amount))}</span></div>` : ''}
            ${lastOrder.delivery_fee != null ? `<div style="display:flex; justify-content:space-between;"><span>${lastOrder.fulfillment_type === 'collect' ? 'Collection' : 'Delivery'}</span><span>${lastOrder.delivery_fee === 0 ? 'Free' : formatGHS(Number(lastOrder.delivery_fee))}</span></div>` : ''}
          </div>
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
            ${lastOrder.fulfillment_type === 'collect'
              ? 'Collecting in person'
              : `Delivering to: ${escapeHTML(lastOrder.town)}, ${escapeHTML(lastOrder.region)}`}
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
        `Customer: ${order.full_name || "Your Person"}`,
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

    y += 28;

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
            `GHs ${Number(item.line_total).toFixed(2)}`,
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
    // SUMMARY (cart total, discount, delivery)
    // ======================================================

    const cartTotal = (Number(order.subtotal) || 0) - (Number(order.discount_total) || 0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(gray[0], gray[1], gray[2]);

    doc.text("Cart total", margin + 10, y);
    doc.text(`GHs ${cartTotal.toFixed(2)}`, pageWidth - margin - 12, y, { align: "right" });
    y += 16;

    if (order.discount_code_amount) {
        const codeLabel = order.discount_code ? `Discount (${order.discount_code})` : "Discount";
        doc.text(codeLabel, margin + 10, y);
        doc.text(`-GHs ${Number(order.discount_code_amount).toFixed(2)}`, pageWidth - margin - 12, y, { align: "right" });
        y += 16;
    }

    if (order.delivery_fee != null) {
        const deliveryLabel = order.fulfillment_type === "collect" ? "Collection" : "Delivery";
        const deliveryValue = Number(order.delivery_fee) === 0 ? "Free" : `GHs ${Number(order.delivery_fee).toFixed(2)}`;
        doc.text(deliveryLabel, margin + 10, y);
        doc.text(deliveryValue, pageWidth - margin - 12, y, { align: "right" });
        y += 16;
    }

    y += 8;

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

    doc.text("TOTAL PAID", margin + 10, y + 28);

    doc.text(
        `GHs ${Number(order.total_amount).toFixed(2)}`,
        pageWidth - margin - 12,
        y + 24,
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

    // ---------- RESUME PAYMENT: confirm current price before paying ----------
    // Used by order-history.html when someone resumes a pending order. Prices,
    // delivery thresholds, and discount codes can all change between when an
    // order was placed and when it's actually paid for, so we re-check what we
    // reasonably can and let the shopper confirm before charging them.
    async function computeResumePricing(order) {
      const settings = await getDeliverySettings();
      const deliveryFee = computeDeliveryFee(Number(order.subtotal) || 0, order.fulfillment_type, settings);

      let discountStillActive = null; // null = no code on this order / unknown
      let discountAmount = Number(order.discount_code_amount ?? order.discount_total ?? 0);

      if (order.discount_code) {
        const { data: discount, error } = await window.supabaseClient
          .from('discount_codes')
          .select('*')
          .eq('code', order.discount_code)
          .maybeSingle();

        if (!error && discount) {
          const now = new Date();
          const active = discount.is_active
            && !(discount.starts_at && new Date(discount.starts_at) > now)
            && !(discount.expires_at && new Date(discount.expires_at) < now)
            && !(discount.max_uses != null && discount.used_count >= discount.max_uses);

          discountStillActive = active;
          if (!active) discountAmount = 0;
        }
      }

      // Best-effort live re-pricing of line items. Only attempted when every
      // item on the order carries a variant_id we can look up. NOTE: adjust
      // the table/column names here (currently 'merch_product_variants' /
      // 'price') to match whatever your products schema actually uses — this
      // wasn't visible in the files provided, so it fails safe (falls back to
      // the order's stored subtotal) rather than guess wrong.
      let subtotal = Number(order.subtotal) || 0;
      const items = order.items || [];

      if (items.length && items.every((i) => i.variant_id)) {
        try {
          const { data: variants, error } = await window.supabaseClient
            .from('merch_product_variants')
            .select('id, price')
            .in('id', items.map((i) => i.variant_id));

          if (!error && variants) {
            const priceById = new Map(variants.map((v) => [v.id, Number(v.price)]));
            let freshSubtotal = 0;
            let allFound = true;
            items.forEach((item) => {
              const price = priceById.get(item.variant_id);
              if (price == null) { allFound = false; return; }
              freshSubtotal += price * item.quantity;
            });
            if (allFound) subtotal = freshSubtotal;
          }
        } catch (e) {
          console.warn('Resume payment: live price check skipped:', e);
        }
      }

      const grandTotal = Math.max(0, subtotal - discountAmount + deliveryFee);
      return { subtotal, deliveryFee, discountAmount, discountStillActive, grandTotal };
    }

    function resumeSummaryHTML(order, pricing) {
      const originalTotal = Number(order.total_amount) || 0;
      const totalChanged = Math.abs(pricing.grandTotal - originalTotal) > 0.005;

      return `
        <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--ink-soft); font-family:var(--font-mono);">
          <span>Subtotal</span><span>${formatGHS(pricing.subtotal)}</span>
        </div>
        ${order.discount_code ? `
          <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-family:var(--font-mono); margin-top:6px; color:${pricing.discountStillActive === false ? '#B3261E' : 'var(--palm)'};">
            <span>Discount (${escapeHTML(order.discount_code)})${pricing.discountStillActive === false ? ' — no longer active' : ''}</span>
            <span>${pricing.discountAmount > 0 ? '-' + formatGHS(pricing.discountAmount) : formatGHS(0)}</span>
          </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--ink-soft); font-family:var(--font-mono); margin-top:6px;">
          <span>${order.fulfillment_type === 'collect' ? 'Collection' : 'Delivery'}</span>
          <span>${pricing.deliveryFee === 0 ? 'Free' : formatGHS(pricing.deliveryFee)}</span>
        </div>
        <div class="bag-summary" style="margin-top:12px;">
          <span>${totalChanged ? 'New total' : 'Total'}</span>
          <span style="font-family:var(--font-display); font-size:1.6rem;">${formatGHS(pricing.grandTotal)}</span>
        </div>
        ${totalChanged ? `
          <p style="font-size:0.82rem; color:var(--ink-soft); margin-top:6px; font-family:var(--font-mono);">
            Was ${formatGHS(originalTotal)} when this order was placed.
          </p>
        ` : ''}
      `;
    }

    // order: the merch_orders row. options.onConfirm(({ setStatus, button }))
    // is called when the shopper clicks "Continue to payment" — it should
    // carry out the actual payment (Paystack, verify-payment, etc.) and call
    // showReceiptFromOrder() on success.
    async function renderResumeConfirm(order, { onConfirm } = {}) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';

      stepsEl.innerHTML = `
        <span class="route-tag blue">Resume payment</span>
        <h3 style="margin-top:16px;">Let's confirm the price first.</h3>
        <p style="margin-top:6px; color:var(--ink-soft); font-size:0.9rem;">Prices and discount codes can change between placing an order and paying for it. Here's where things stand right now.</p>
        <div data-resume-summary style="margin-top:18px; color:var(--ink-soft); font-size:0.9rem;">Checking current prices…</div>
        <p data-resume-status style="font-size:0.85rem; display:none; margin-top:10px;"></p>
        <div style="display:flex; gap:12px; margin-top:20px; flex-wrap:wrap;">
          <button type="button" class="btn btn-dark" data-resume-continue disabled>Continue to payment</button>
          <button type="button" class="btn btn-outline" data-resume-cancel>Cancel</button>
        </div>
      `;

      stepsEl.querySelector('[data-resume-cancel]')?.addEventListener('click', closeModal);

      const pricing = await computeResumePricing(order);
      const summaryEl = stepsEl.querySelector('[data-resume-summary]');
      if (summaryEl) summaryEl.innerHTML = resumeSummaryHTML(order, pricing);

      const continueBtn = stepsEl.querySelector('[data-resume-continue]');
      if (!continueBtn) return;
      continueBtn.disabled = false;

      continueBtn.addEventListener('click', async () => {
        const status = stepsEl.querySelector('[data-resume-status]');
        const setStatus = (msg, isError) => {
          if (!status) return;
          status.textContent = msg;
          status.style.display = 'block';
          status.style.color = isError ? '#B3261E' : 'var(--palm)';
        };
        try {
          await onConfirm?.({ setStatus, button: continueBtn });
        } catch (e) {
          console.error('Resume payment error:', e);
          setStatus('Something went wrong. Please try again.', true);
          continueBtn.disabled = false;
          continueBtn.textContent = 'Continue to payment';
        }
      });
    }

    // Jumps the (shared, site-wide) checkout modal straight to the receipt
    // step for an arbitrary order — used after a resumed payment succeeds,
    // so the same download/screenshot UI works from order-history.html too.
    function showReceiptFromOrder(order) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      lastOrder = order;
      renderStep('receipt');
    }

    window.NxNxComponents.openResumeConfirm = renderResumeConfirm;
    window.NxNxComponents.showReceiptFromOrder = showReceiptFromOrder;

    window.openCheckoutModal = openModal;
  }

  document.addEventListener('components:loaded', () => setTimeout(initCheckoutModal, 0), { once: true });
})();