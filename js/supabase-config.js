// NOTE: this file must load AFTER cookies.js (it uses getCookie/setCookie/deleteCookie).

const SUPABASE_URL = 'https://brjawbihtqvnhsrzgewt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HL7rmcPRGpbwYV6u_M-JYg_PH9PgoN3';

// Store the Supabase auth session in a cookie instead of localStorage, per
// the site's cookie-based approach to client-side data.
// Caveat: cookies cap out around 4KB. A normal Supabase session token fits
// comfortably, but if you add extra user metadata to the JWT this could
// need revisiting (e.g. splitting across multiple cookies).
const cookieAuthStorage = {
  getItem: (key) => getCookie(key),
  setItem: (key, value) => setCookie(key, value, 7),
  removeItem: (key) => deleteCookie(key),
};

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: cookieAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});