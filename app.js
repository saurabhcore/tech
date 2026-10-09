const $ = selector => document.querySelector(selector);
const state = { products: [], categories: [], cart: JSON.parse(localStorage.getItem("tw-cart") || "[]"), user: null, category: "", query: "", adminTab: "orders" };
const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
let toastTimer;
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800); }
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function persistCart() { localStorage.setItem("tw-cart", JSON.stringify(state.cart)); renderCart(); }
function cartCount() { return state.cart.reduce((sum, item) => sum + item.quantity, 0); }
function cartTotal() { return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }
function renderCart() {
  $("#cartCount").textContent = cartCount();
  $("#drawerCount").textContent = `(${cartCount()})`;
  $("#cartSubtotal").textContent = money(cartTotal());
  const container = $("#cartItems");
  if (!state.cart.length) { container.innerHTML = '<div class="empty-state">Your cart is taking a little break.<br><br>Explore the collection to find something useful.</div>'; return; }
  container.innerHTML = state.cart.map(item => `<div class="cart-line"><div class="cart-thumb">${escapeHtml(item.image)}</div><div><h4>${escapeHtml(item.name)}</h4><small>${money(item.price)} each</small><div class="qty-control"><button data-qty="${item.id}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button data-qty="${item.id}" data-delta="1" aria-label="Increase quantity">+</button></div></div><div class="cart-line-price">${money(item.price * item.quantity)}<button class="remove-item" data-remove="${item.id}">Remove</button></div></div>`).join("");
}
function renderCategories() {
  const el = $("#categories");
  el.innerHTML = `<button class="pill ${state.category === "" ? "active" : ""}" data-category="">All products</button>` + state.categories.map(c => `<button class="pill ${state.category === c ? "active" : ""}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
}
function renderProducts() {
  const list = state.products.filter(p => (!state.category || p.category === state.category) && (!state.query || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(state.query.toLowerCase())));
  const grid = $("#productGrid");
  if (!list.length) { grid.innerHTML = '<div class="empty-state">No products found. Try another search or category.</div>'; return; }
  grid.innerHTML = list.map(p => `<article class="product-card"><div class="product-visual"><span class="product-badge">${p.featured ? "EDITOR'S PICK" : escapeHtml(p.category.toUpperCase())}</span><span class="product-emoji">${escapeHtml(p.image)}</span><button class="quick-add" data-add="${p.id}" aria-label="Add ${escapeHtml(p.name)} to cart">+</button></div><div class="product-info"><div class="product-category">${escapeHtml(p.category)}</div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><div class="product-bottom"><span class="price">${money(p.price)}</span><span class="stock">${p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</span></div></div></article>`).join("");
}
async function loadProducts() {
  try {
    const [productData, categoryData] = await Promise.all([api("/api/products"), api("/api/categories")]);
    state.products = productData.products; state.categories = categoryData.categories;
    renderCategories(); renderProducts();
  } catch (e) { $("#productGrid").innerHTML = `<div class="empty-state">${escapeHtml(e.message)}<br>Make sure the server is running.</div>`; }
}
function addToCart(id) {
  const product = state.products.find(p => p.id === Number(id));
  if (!product || product.stock < 1) return toast("This item is currently out of stock.");
  const existing = state.cart.find(item => item.id === product.id);
  if (existing) {
    if (existing.quantity >= Math.min(product.stock, 20)) return toast("You've reached the available demo stock.");
    existing.quantity++;
  } else state.cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 });
  persistCart(); toast(`${product.name} added to your cart.`);
}
function openCart() { $("#cartDrawer").classList.add("open"); $("#overlay").classList.add("show"); }
function closeCart() { $("#cartDrawer").classList.remove("open"); $("#overlay").classList.remove("show"); }
function openModal(html) { $("#modalBody").innerHTML = html; $("#modalWrap").classList.add("show"); }
function closeModal() { $("#modalWrap").classList.remove("show"); }
function authModal(mode = "login") {
  const register = mode === "register";
  openModal(`<div class="eyebrow"><span class="eyebrow-line"></span> YOUR TECHWORLD</div><h2 id="modalTitle">${register ? "Create your account." : "Welcome back."}</h2><p class="modal-intro">${register ? "A few details and you're ready to go." : "Sign in to place demo orders and see your order history."}</p>
    <form id="authForm">${register ? '<label class="form-field"><span>Full name</span><input name="name" required minlength="2" maxlength="60" autocomplete="name" placeholder="Your name"></label>' : ""}
    <label class="form-field"><span>Email address</span><input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label>
    <label class="form-field"><span>Password</span><input name="password" type="password" required minlength="${register ? 8 : 1}" maxlength="72" autocomplete="${register ? "new-password" : "current-password"}" placeholder="${register ? "At least 8 characters" : "Your password"}"></label>
    <button class="btn btn-primary full-width" type="submit">${register ? "Create account" : "Sign in"} <span>→</span></button></form>
    <div class="form-switch">${register ? "Already have an account?" : "New to TechWorld?"} <button id="switchAuth">${register ? "Sign in" : "Create an account"}</button></div>`);
  $("#switchAuth").onclick = () => authModal(register ? "login" : "register");
  $("#authForm").onsubmit = async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const result = await api(register ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
      state.user = result.user; closeModal(); toast(`Welcome${state.user.name ? ", " + state.user.name.split(" ")[0] : ""}!`);
      if (window.afterAuth) { const fn = window.afterAuth; window.afterAuth = null; fn(); }
    } catch (err) { toast(err.message); }
  };
}
function checkout() {
  if (!state.cart.length) return toast("Your cart is empty.");
  if (!state.user) { window.afterAuth = checkout; return authModal("login"); }
  const total = cartTotal();
  openModal(`<div class="eyebrow"><span class="eyebrow-line"></span> SAFE DEMO CHECKOUT</div><h2 id="modalTitle">Review your order.</h2><p class="modal-intro">This checkout simulates an order only. No payment details are requested or processed.</p>
    <div class="admin-list">${state.cart.map(i => `<div class="admin-row"><span>${escapeHtml(i.image)} &nbsp; ${escapeHtml(i.name)} × ${i.quantity}</span><strong>${money(i.price * i.quantity)}</strong></div>`).join("")}<div class="admin-row"><strong>Demo total</strong><strong>${money(total)}</strong></div></div>
    <div class="demo-warning"><strong>SIMULATION ONLY</strong><br>Clicking “Place demo order” creates an order in the local database and marks payment as SIMULATED. No real money is charged, and no payment gateway is contacted.</div>
    <button class="btn btn-primary full-width" id="placeOrder">Place demo order · ${money(total)} <span>→</span></button><p class="muted">Signed in as ${escapeHtml(state.user.email)}.</p>`);
  $("#placeOrder").onclick = async () => {
    const btn = $("#placeOrder"); btn.disabled = true; btn.textContent = "Creating demo order…";
    try {
      const result = await api("/api/orders", { method: "POST", body: JSON.stringify({ items: state.cart.map(i => ({ id: i.id, quantity: i.quantity })) }) });
      state.cart = []; persistCart(); closeModal(); closeCart(); await loadProducts(); successModal(result.order, result.notice);
    } catch (e) { btn.disabled = false; btn.innerHTML = 'Place demo order <span>→</span>'; toast(e.message); }
  };
}
function successModal(order, notice) {
  openModal(`<div class="order-success"><div class="success-mark">✓</div><div class="eyebrow" style="justify-content:center">ORDER CREATED</div><h2 id="modalTitle" style="margin:12px 0">You're all set.</h2><p class="modal-intro">${escapeHtml(notice)}</p><div class="order-code">${escapeHtml(order.code)}</div><div class="admin-list"><div class="admin-row"><span>Demo total</span><strong>${money(order.total)}</strong></div><div class="admin-row"><span>Payment status</span><span class="status-chip">SIMULATED</span></div><div class="admin-row"><span>Order status</span><strong>${escapeHtml(order.status)}</strong></div></div><button class="btn btn-primary full-width" id="successDone" style="margin-top:20px">Continue shopping <span>→</span></button></div>`);
  $("#successDone").onclick = closeModal;
}
async function showOrders() {
  if (!state.user) { window.afterAuth = showOrders; return authModal("login"); }
  try {
    const { orders } = await api("/api/orders/mine");
    openModal(`<div class="eyebrow"><span class="eyebrow-line"></span> YOUR ACCOUNT</div><h2 id="modalTitle">Order history.</h2><p class="modal-intro">Demo orders placed using this account.</p>${orders.length ? `<div class="admin-list">${orders.map(o => `<div class="admin-row"><span><strong>${escapeHtml(o.order_code)}</strong><br><small>${new Date(o.created_at + "Z").toLocaleString()}</small><br><small>${o.items.map(i => `${escapeHtml(i.name)} × ${i.quantity}`).join(", ")}</small></span><span style="text-align:right"><strong>${money(o.total)}</strong><br><span class="status-chip">${escapeHtml(o.payment_status)}</span><br><small>${escapeHtml(o.status)}</small></span></div>`).join("")}</div>` : '<p class="muted">No orders yet. Your next great find is waiting in the collection.</p>'}<button class="btn btn-primary full-width" id="ordersDone" style="margin-top:20px">Done</button>`);
    $("#ordersDone").onclick = closeModal;
  } catch (e) { toast(e.message); }
}
async function showAdmin() {
  if (!state.user || state.user.role !== "admin") {
    openModal(`<div class="eyebrow"><span class="eyebrow-line"></span> STORE MANAGEMENT</div><h2 id="modalTitle">Admin sign in.</h2><p class="modal-intro">Use the local demo admin account to view the store dashboard.</p><div class="demo-warning">Demo email: <strong>admin@techworld.demo</strong><br>Demo password: <strong>Admin@12345</strong><br>For local presentation use only. Change these before any public deployment.</div><form id="adminLoginForm"><label class="form-field"><span>Email</span><input name="email" type="email" value="admin@techworld.demo" required></label><label class="form-field"><span>Password</span><input name="password" type="password" value="Admin@12345" required></label><button class="btn btn-primary full-width">Sign in to dashboard <span>→</span></button></form>`);
    $("#adminLoginForm").onsubmit = async e => { e.preventDefault(); const payload = Object.fromEntries(new FormData(e.currentTarget).entries()); try { const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }); state.user = r.user; if (state.user.role !== "admin") { toast("This account does not have admin access."); return; } await renderAdmin(); } catch (err) { toast(err.message); } };
    return;
  }
  await renderAdmin();
}
async function renderAdmin() {
  try {
    const summary = await api("/api/admin/summary");
    const { orders } = await api("/api/admin/orders");
    openModal(`<div class="eyebrow"><span class="eyebrow-line"></span> STORE OVERVIEW</div><h2 id="modalTitle">Admin dashboard.</h2><p class="modal-intro">Welcome, ${escapeHtml(state.user.name)}. This local dashboard uses demo data and simulated revenue.</p>
      <div class="admin-metrics"><div class="metric"><small>Products</small><strong>${summary.products}</strong></div><div class="metric"><small>Demo orders</small><strong>${summary.orders}</strong></div><div class="metric"><small>Customers</small><strong>${summary.customers}</strong></div><div class="metric"><small>Demo order value</small><strong style="font-size:18px">${money(summary.demoRevenue)}</strong></div></div>
      <div class="admin-tabs"><button class="active" data-tab="orders">Orders</button><button data-tab="products">Add product</button><button data-tab="account">Account</button></div><div id="adminPanel"></div>
      <p class="muted" style="margin-top:18px">All figures are from the local SQLite database. Demo order value is not actual revenue.</p>`);
    const panel = $("#adminPanel");
    function setTab(tab) {
      state.adminTab = tab; document.querySelectorAll(".admin-tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
      if (tab === "orders") {
        panel.innerHTML = orders.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${orders.map(o => `<tr><td>${escapeHtml(o.order_code)}<br><small>${escapeHtml(o.payment_status)}</small></td><td>${escapeHtml(o.customer_name)}<br><small>${escapeHtml(o.customer_email)}</small></td><td>${money(o.total)}</td><td><select data-status-id="${o.id}" aria-label="Update status for ${escapeHtml(o.order_code)}">${["Processing","Packed","Shipped","Delivered","Cancelled"].map(s => `<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">No orders yet. Place a demo order to see it here.</p>';
        panel.querySelectorAll("[data-status-id]").forEach(select => select.onchange = async () => { try { await api(`/api/admin/orders/${select.dataset.statusId}`, { method: "PATCH", body: JSON.stringify({ status: select.value }) }); toast("Order status updated."); } catch (e) { toast(e.message); } });
      } else if (tab === "products") {
        panel.innerHTML = `<form id="productForm"><label class="form-field"><span>Product name</span><input name="name" required maxlength="100"></label><div class="form-row"><label class="form-field"><span>Category</span><input name="category" required maxlength="40" placeholder="Accessories"></label><label class="form-field"><span>Price (₹)</span><input name="price" type="number" min="0" step="1" required></label></div><div class="form-row"><label class="form-field"><span>Stock</span><input name="stock" type="number" min="0" max="100000" required value="10"></label><label class="form-field"><span>Emoji icon</span><input name="image" maxlength="10" value="✨"></label></div><label class="form-field"><span>Description</span><textarea name="description" rows="2" maxlength="500" required></textarea></label><button class="btn btn-primary full-width">Add product <span>+</span></button></form>`;
        $("#productForm").onsubmit = async e => { e.preventDefault(); const payload = Object.fromEntries(new FormData(e.currentTarget).entries()); payload.price = Number(payload.price); payload.stock = Number(payload.stock); try { await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) }); toast("Product added to the catalog."); await loadProducts(); await renderAdmin(); } catch (err) { toast(err.message); } };
      } else {
        panel.innerHTML = `<p class="muted">Signed in as <strong>${escapeHtml(state.user.email)}</strong> with administrator access.</p><button class="btn btn-primary" id="adminLogout">Sign out <span>→</span></button>`;
        $("#adminLogout").onclick = async () => { await api("/api/auth/logout", { method: "POST" }); state.user = null; closeModal(); toast("Signed out."); };
      }
    }
    document.querySelectorAll(".admin-tabs button").forEach(b => b.onclick = () => setTab(b.dataset.tab));
    setTab("orders");
  } catch (e) { toast(e.message); }
}
async function init() {
  renderCart(); await loadProducts();
  try { const r = await api("/api/auth/me"); state.user = r.user; } catch {}
  $("#searchInput").addEventListener("input", e => { state.query = e.target.value; renderProducts(); });
  $("#categories").addEventListener("click", e => { const b = e.target.closest("[data-category]"); if (!b) return; state.category = b.dataset.category; renderCategories(); renderProducts(); });
  $("#productGrid").addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) addToCart(b.dataset.add); });
  $("#cartItems").addEventListener("click", e => {
    const qty = e.target.closest("[data-qty]"); const remove = e.target.closest("[data-remove]");
    if (qty) { const item = state.cart.find(i => i.id === Number(qty.dataset.qty)); if (!item) return; item.quantity += Number(qty.dataset.delta); if (item.quantity < 1) state.cart = state.cart.filter(i => i.id !== item.id); else if (item.quantity > 20) { item.quantity = 20; toast("Maximum quantity is 20 per item."); } persistCart(); }
    if (remove) { state.cart = state.cart.filter(i => i.id !== Number(remove.dataset.remove)); persistCart(); }
  });
  $("#cartBtn").onclick = openCart; $("#closeCart").onclick = closeCart; $("#overlay").onclick = closeCart;
  $("#checkoutBtn").onclick = checkout; $("#accountBtn").onclick = () => state.user ? openModal(`<div class="eyebrow"><span class="eyebrow-line"></span> YOUR ACCOUNT</div><h2 id="modalTitle">Hello, ${escapeHtml(state.user.name)}.</h2><p class="modal-intro">${escapeHtml(state.user.email)}<br>Account type: ${escapeHtml(state.user.role)}</p><button class="btn btn-primary full-width" id="accountOrders">View my orders</button><button class="small-btn" id="logoutBtn" style="width:100%;margin-top:10px;padding:12px">Sign out</button>`) : authModal("login");
  $("#accountBtn").addEventListener("click", () => { if (state.user && $("#accountOrders")) { $("#accountOrders").onclick = showOrders; $("#logoutBtn").onclick = async () => { await api("/api/auth/logout", { method: "POST" }); state.user = null; closeModal(); toast("Signed out."); }; } });
  $("#closeModal").onclick = closeModal; $("#modalWrap").addEventListener("click", e => { if (e.target === $("#modalWrap")) closeModal(); });
  $("#ordersBtn").onclick = showOrders; $("#adminBtn").onclick = showAdmin;
  $("#menuToggle").onclick = () => $(".nav").classList.toggle("open");
  $(".nav").addEventListener("click", e => { if (e.target.closest("a")) $(".nav").classList.remove("open"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeCart(); } });
}
init();
