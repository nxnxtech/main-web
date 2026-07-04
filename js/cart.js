const CART_COOKIE = 'nxnx_cart';
const CART_COOKIE_DAYS = 14;

function getCart() {
  return getJSONCookie(CART_COOKIE, []);
}

function saveCart(items) {
  setJSONCookie(CART_COOKIE, items, CART_COOKIE_DAYS);
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
}

function addToCart(item) {
  const items = getCart();
  const existing = items.find((i) => i.variant_id === item.variant_id);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + item.quantity, item.stock ?? 99);
  } else {
    items.push(item);
  }

  saveCart(items);
  return items;
}

function updateCartQuantity(index, quantity) {
  const items = getCart();
  if (!items[index]) return items;

  if (quantity <= 0) {
    items.splice(index, 1);
  } else {
    items[index].quantity = quantity;
  }

  saveCart(items);
  return items;
}

function removeFromCart(index) {
  const items = getCart();
  items.splice(index, 1);
  saveCart(items);
  return items;
}

function clearCart() {
  saveCart([]);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

function cartLineTotal(item) {
  const unit = item.discount_percent
    ? item.price * (1 - item.discount_percent / 100)
    : item.price;
  return unit * item.quantity;
}

function cartTotal() {
  return getCart().reduce((sum, item) => sum + cartLineTotal(item), 0);
}