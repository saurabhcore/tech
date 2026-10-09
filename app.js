const API = '/api';
let products = [], cartCount = 0, token = localStorage.getItem('tw_token') || '', currentUser = JSON.parse(localStorage.getItem('tw_user') || 'null'), selectedCategory = 'All', toastTimer;
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800); }
function showModal(html) { $('modalContent').innerHTML = html; $('modalBackdrop').classList.remove('hidden'); }
function closeModal() { $('modalBackdrop').classList.add('hidden'); }
function productCard(p) { return `<article class="product-card"><div class="product-image"><span class="product-tag">${p.category}</span><span class="product-emoji">${p.image}</span></div><div class="product-body"><span class="product-brand">${p.brand}</span><h3>${p.name}</h3><div class="rating">★ ${p.rating} <span>(${p.stock} in stock)</span></div><div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add-btn" data-add="${p.id}">＋ Add</button></div><button class="ghost" style="width:100%;margin-top:9px" data-detail="${p.id}">View details</button></div></article>`; }
async function loadProducts() {
  const query = new URLSearchParams(); const search = $('searchInput').value.trim();
  if (search) query.set('search', search); if (selectedCategory !== 'All') query.set('category', selectedCategory);
  try {
    const data = await api(`/products?${query}`); products = data.products;
    const sort = $('sortFilter').value; if (sort === 'low') products.sort((a,b)=>a.price-b.price); if (sort === 'high') products.sort((a,b)=>b.price-a.price); if (sort === 'rating') products.sort((a,b)=>b.rating-a.rating);
    $('productGrid').innerHTML = products.length ? products.map(productCard).join('') : '<div class="empty">No products found. Try another search.</div>';
    $('apiStatus').textContent = '● Backend connected'; $('apiStatus').classList.remove('offline');
  } catch (err) { $('apiStatus').textContent = '● API unavailable'; $('apiStatus').classList.add('offline'); $('productGrid').innerHTML = `<div class="empty">Could not connect to the backend.<br>${err.message}<br><br>Start the server with <b>npm start</b>.</div>`; }
}
async function refreshCartCount() { if (!token) { cartCount = 0; $('cartCount').textContent = '0'; return; } try { const data = await api('/cart'); cartCount = data.items.reduce((n,p)=>n+p.quantity,0); $('cartCount').textContent = cartCount; } catch { $('cartCount').textContent = '0'; } }
async function addToCart(id) {
  if (!token) { toast('Please log in or register to use your cart.'); openAuth(); return; }
  try { await api('/cart', { method: 'POST', body: JSON.stringify({ productId: id, quantity: 1 }) }); await refreshCartCount(); toast('Added to your cart.'); }
  catch (err) { toast(err.message); }
}
function openAuth(mode = 'login') {
  const register = mode === 'register';
  showModal(`<span class="eyebrow">YOUR TECHWORLD ACCOUNT</span><h2>${register ? 'Create an account' : 'Welcome back'}</h2><p>${register ? 'Register to save your cart and place a demo order.' : 'Log in to manage your cart and orders.'}</p><form class="form" id="authForm">${register ? '<label>Full name<input name="name" required minlength="2" maxlength="60" placeholder="Your name"></label>' : ''}<label>Email address<input name="email" type="email" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" required minlength="8" placeholder="At least 8 characters"></label><button>${register ? 'Create account' : 'Log in'}</button></form><p>${register ? 'Already registered?' : 'New to TechWorld?'} <span class="switch-auth" id="switchAuth">${register ? 'Log in' : 'Create an account'}</span></p>`);
  $('switchAuth').onclick = () => openAuth(register ? 'login' : 'register');
  $('authForm').onsubmit = async e => { e.preventDefault(); const form = Object.fromEntries(new FormData(e.target)); try { const data = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(form) }); token = data.token; currentUser = data.user; localStorage.setItem('tw_token', token); localStorage.setItem('tw_user', JSON.stringify(currentUser)); closeModal(); await refreshCartCount(); toast(`Welcome${currentUser.name ? ', ' + currentUser.name : ''}!`); $('loginBtn').textContent = 'My account'; } catch (err) { toast(err.message); } };
}
async function openCart() {
  if (!token) { openAuth(); return; }
  try {
    const data = await api('/cart');
    const rows = data.items.map(p => `<div class="cart-row"><span class="emoji">${p.image}</span><div class="details"><b>${p.name}</b><small>${money(p.price)} each · Line total ${money(p.lineTotal)}</small><div style="margin-top:8px;display:flex;gap:7px;align-items:center"><button data-qty="${p.id}" data-value="${p.quantity-1}">−</button><span>${p.quantity}</span><button data-qty="${p.id}" data-value="${p.quantity+1}">+</button><button data-qty="${p.id}" data-value="0" style="margin-left:6px;color:#b44c2f">Remove</button></div></div></div>`).join('');
    showModal(`<span class="eyebrow">YOUR SELECTION</span><h2>Shopping cart</h2>${rows || '<p>Your cart is empty. Add a product to get started.</p>'}<div class="modal-total"><span>Subtotal</span><span>${money(data.total)}</span></div>${rows ? '<button class="form" id="checkoutBtn" style="width:100%;border:0;background:var(--navy);color:white;padding:13px;border-radius:8px;font-weight:700;cursor:pointer">Continue to checkout</button>' : ''}`);
    document.querySelectorAll('[data-qty]').forEach(btn => btn.onclick = async () => { try { await api(`/cart/${btn.dataset.qty}`, { method: 'PATCH', body: JSON.stringify({ quantity: Number(btn.dataset.value) }) }); await refreshCartCount(); openCart(); } catch(err) { toast(err.message); } });
    if ($('checkoutBtn')) $('checkoutBtn').onclick = openCheckout;
  } catch (err) { toast(err.message); }
}
function openCheckout() {
  showModal(`<span class="eyebrow">DEMO CHECKOUT</span><h2>Delivery details</h2><div class="demo-notice" style="background:#eef6ff;border:1px solid #bfdbfe;padding:12px;border-radius:10px;margin:12px 0;color:#1e3a8a"><b>Presentation mode</b><br>This is a simulated payment screen. No payment gateway is contacted and no money will be charged.</div><form class="form" id="checkoutForm"><label>Full name<input name="name" required minlength="2" maxlength="80" placeholder="Your full name"></label><label>Phone number<input name="phone" required minlength="8" maxlength="20" placeholder="Phone number"></label><label>Delivery address<textarea name="address" required minlength="8" maxlength="250" rows="3" placeholder="Address, city, PIN code"></textarea></label><button id="payBtn">Simulate demo payment</button></form><small>Demo only · No real transaction · No card details required</small>`);
  $('checkoutForm').onsubmit = async e => {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.target));
    const button = $('payBtn'); button.disabled = true; button.textContent = 'Processing demo…';
    try {
      const result = await api('/payments/demo', { method: 'POST', body: JSON.stringify(form) });
      await refreshCartCount();
      showModal(`<div class="detail-hero">✅</div><span class="eyebrow">SIMULATION COMPLETE</span><h2>Demo payment successful</h2><div class="demo-notice" style="background:#ecfdf5;border:1px solid #a7f3d0;padding:12px;border-radius:10px;margin:12px 0;color:#065f46"><b>No money was charged.</b><br>This confirmation is simulated for your presentation. No payment provider or bank was contacted.</div><p><b>Demo Order ID:</b> ${result.order.id}</p><p><b>Payment status:</b> ${result.order.status}</p><p><b>Order total:</b> ${money(result.order.total)}</p><button class="form" id="doneBtn" style="width:100%;border:0;background:var(--navy);color:white;padding:13px;border-radius:8px;cursor:pointer">Continue shopping</button>`);
      $('doneBtn').onclick = closeModal;
    } catch (err) { toast(err.message); if ($('payBtn')) { $('payBtn').disabled = false; $('payBtn').textContent = 'Simulate demo payment'; } }
  };
}
async function showDetails(id) { try { const p = await api(`/products/${id}`); showModal(`<span class="eyebrow">${p.category.toUpperCase()}</span><div class="detail-hero">${p.image}</div><span class="product-brand">${p.brand}</span><h2>${p.name}</h2><p>${p.description}</p><p class="rating">★ ${p.rating} <span>· ${p.stock} available</span></p><div class="modal-total"><span>Price</span><span class="detail-price">${money(p.price)}</span></div><button class="form" id="detailAdd" style="width:100%;border:0;background:var(--navy);color:white;padding:13px;border-radius:8px;cursor:pointer">Add to cart</button>`); $('detailAdd').onclick = () => addToCart(id); } catch(err) { toast(err.message); } }
$('productGrid').addEventListener('click', e => { const add = e.target.closest('[data-add]'); const detail = e.target.closest('[data-detail]'); if (add) addToCart(add.dataset.add); if (detail) showDetails(detail.dataset.detail); });
document.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => { selectedCategory = btn.dataset.category; $('categoryFilter').value = selectedCategory; loadProducts(); $('products').scrollIntoView({ behavior: 'smooth' }); }));
$('categoryFilter').onchange = e => { selectedCategory = e.target.value; loadProducts(); }; $('sortFilter').onchange = loadProducts;
let searchDebounce; $('searchInput').oninput = () => { clearTimeout(searchDebounce); searchDebounce = setTimeout(loadProducts, 250); };
$('loginBtn').onclick = () => token ? showModal(`<span class="eyebrow">ACCOUNT</span><h2>Hello, ${currentUser?.name || 'TechWorld customer'}</h2><p>${currentUser?.email || ''}</p><button class="form" id="ordersBtn" style="width:100%;border:0;background:var(--navy);color:white;padding:13px;border-radius:8px;cursor:pointer">My orders</button><button class="form" id="logoutBtn" style="width:100%;border:1px solid var(--line);background:white;color:var(--navy);padding:13px;border-radius:8px;cursor:pointer;margin-top:8px">Log out</button>`) : openAuth();
$('loginBtn').addEventListener('click', () => { if ($('ordersBtn')) $('ordersBtn').onclick = async () => { try { const d = await api('/orders'); showModal(`<span class="eyebrow">ACCOUNT</span><h2>My orders</h2>${d.orders.length ? d.orders.map(o=>`<div class="cart-row"><div class="details"><b>${o.id}</b><small>${new Date(o.createdAt).toLocaleString()} · ${o.status}</small></div><b>${money(o.total)}</b></div>`).join('') : '<p>No orders yet.</p>'}`); } catch(e) { toast(e.message); } }; if ($('logoutBtn')) $('logoutBtn').onclick = () => { token=''; currentUser=null; localStorage.removeItem('tw_token'); localStorage.removeItem('tw_user'); refreshCartCount(); closeModal(); $('loginBtn').textContent='Login / Register'; toast('You have logged out.'); }; });
$('cartBtn').onclick = openCart; $('closeModal').onclick = closeModal; $('modalBackdrop').onclick = e => { if (e.target === $('modalBackdrop')) closeModal(); };
(async () => { if (token) { try { const d = await api('/auth/me'); currentUser = d.user; $('loginBtn').textContent = 'My account'; } catch { token=''; localStorage.removeItem('tw_token'); } } await Promise.all([loadProducts(), refreshCartCount()]); })();
