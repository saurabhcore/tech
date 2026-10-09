const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'demo-only-change-this-secret';
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const seedProducts = [
  { id: 'p1', name: 'Nova X Pro Smartphone', category: 'Smartphones', brand: 'Nova', price: 42999, rating: 4.7, stock: 12, image: '📱', description: 'A vivid AMOLED display, all-day battery and a versatile camera system.' },
  { id: 'p2', name: 'Galaxy S Series Phone', category: 'Smartphones', brand: 'Samsung', price: 58999, rating: 4.6, stock: 8, image: '📲', description: 'Premium performance with a bright display and fast charging.' },
  { id: 'p3', name: 'AirLite Pro Laptop', category: 'Laptops & Tablets', brand: 'AirLite', price: 74999, rating: 4.8, stock: 6, image: '💻', description: 'A lightweight laptop designed for productivity and everyday work.' },
  { id: 'p4', name: 'TabView 11 Tablet', category: 'Laptops & Tablets', brand: 'TabView', price: 28999, rating: 4.3, stock: 15, image: '📟', description: 'A large display for reading, streaming and taking notes.' },
  { id: 'p5', name: 'SonicPods Wireless Earbuds', category: 'Audio & Wearables', brand: 'Sonic', price: 3999, rating: 4.4, stock: 24, image: '🎧', description: 'Comfortable wireless audio with a compact charging case.' },
  { id: 'p6', name: 'Pulse Smartwatch', category: 'Audio & Wearables', brand: 'Pulse', price: 6999, rating: 4.2, stock: 18, image: '⌚', description: 'Track activity, check notifications and view daily stats.' },
  { id: 'p7', name: 'FastCharge Power Bank', category: 'Accessories', brand: 'Volt', price: 1999, rating: 4.1, stock: 30, image: '🔋', description: 'Portable power for compatible devices while you travel.' },
  { id: 'p8', name: 'USB-C Hub & Adapter', category: 'Accessories', brand: 'Connect', price: 1499, rating: 4.0, stock: 20, image: '🔌', description: 'A compact hub for connecting your everyday devices.' }
];
function readStore() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { products: seedProducts, users: [], orders: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { products: seedProducts, users: [], orders: [] }; }
}
let store = readStore();
function saveStore() { fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2)); }
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Please log in to continue.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ message: 'Session expired or token invalid.' }); }
}
function safeUser(user) { return { id: user.id, name: user.name, email: user.email }; }
function makeToken(user) { return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '2h' }); }
function cleanText(value, max = 100) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'TechWorld API', timestamp: new Date().toISOString() }));
app.get('/api/payment/config', (req, res) => {
  res.json({ provider: 'TechWorld Demo Simulator', enabled: true, mode: 'simulation', realPaymentsEnabled: false });
});
app.get('/api/products', (req, res) => {
  let items = [...store.products];
  const q = cleanText(req.query.search, 80).toLowerCase();
  const category = cleanText(req.query.category, 60);
  const brand = cleanText(req.query.brand, 60);
  const maxPrice = Number(req.query.maxPrice);
  if (q) items = items.filter(p => `${p.name} ${p.brand} ${p.category} ${p.description}`.toLowerCase().includes(q));
  if (category && category !== 'All') items = items.filter(p => p.category === category);
  if (brand) items = items.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
  if (Number.isFinite(maxPrice) && maxPrice > 0) items = items.filter(p => p.price <= maxPrice);
  res.json({ count: items.length, products: items });
});
app.get('/api/products/:id', (req, res) => {
  const product = store.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json(product);
});
app.post('/api/auth/register', async (req, res) => {
  const name = cleanText(req.body.name, 60);
  const email = cleanText(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8)
    return res.status(400).json({ message: 'Enter a valid name/email and a password of at least 8 characters.' });
  if (store.users.some(u => u.email === email)) return res.status(409).json({ message: 'An account with this email already exists.' });
  const user = { id: `u${Date.now()}`, name, email, passwordHash: await bcrypt.hash(password, 12), cart: [] };
  store.users.push(user); saveStore();
  res.status(201).json({ token: makeToken(user), user: safeUser(user) });
});
app.post('/api/auth/login', async (req, res) => {
  const email = cleanText(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = store.users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
  res.json({ token: makeToken(user), user: safeUser(user) });
});
app.get('/api/auth/me', auth, (req, res) => {
  const user = store.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: safeUser(user) });
});
function getUser(req) { return store.users.find(u => u.id === req.user.id); }
app.get('/api/cart', auth, (req, res) => {
  const user = getUser(req); if (!user) return res.status(404).json({ message: 'User not found.' });
  const items = (user.cart || []).map(row => { const product = store.products.find(p => p.id === row.productId); return product ? { ...product, quantity: row.quantity, lineTotal: product.price * row.quantity } : null; }).filter(Boolean);
  res.json({ items, total: items.reduce((sum, item) => sum + item.lineTotal, 0) });
});
app.post('/api/cart', auth, (req, res) => {
  const user = getUser(req); const productId = cleanText(req.body.productId, 40); const quantity = Number(req.body.quantity || 1);
  const product = store.products.find(p => p.id === productId);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return res.status(400).json({ message: 'Quantity must be between 1 and 20.' });
  user.cart = user.cart || []; const row = user.cart.find(r => r.productId === productId);
  if (row) row.quantity = Math.min(20, row.quantity + quantity); else user.cart.push({ productId, quantity });
  saveStore(); res.json({ message: 'Cart updated.' });
});
app.patch('/api/cart/:productId', auth, (req, res) => {
  const user = getUser(req); const quantity = Number(req.body.quantity);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) return res.status(400).json({ message: 'Quantity must be between 0 and 20.' });
  user.cart = user.cart || [];
  if (quantity === 0) user.cart = user.cart.filter(r => r.productId !== req.params.productId);
  else { const row = user.cart.find(r => r.productId === req.params.productId); if (row) row.quantity = quantity; else return res.status(404).json({ message: 'Item not in cart.' }); }
  saveStore(); res.json({ message: 'Cart updated.' });
});
// Presentation-only payment simulation. It never contacts a payment provider and never charges money.
app.post('/api/payments/demo', auth, (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const cart = (user.cart || []).map(row => {
    const p = store.products.find(x => x.id === row.productId);
    return p ? { productId: p.id, name: p.name, price: p.price, quantity: row.quantity } : null;
  }).filter(Boolean);
  if (!cart.length) return res.status(400).json({ message: 'Your cart is empty.' });
  const name = cleanText(req.body.name, 80);
  const address = cleanText(req.body.address, 250);
  const phone = cleanText(req.body.phone, 20);
  if (name.length < 2 || address.length < 8 || !/^[0-9+\-\s()]{8,20}$/.test(phone)) return res.status(400).json({ message: 'Please provide valid name, address and phone number.' });
  const total = cart.reduce((sum, p) => sum + p.price * p.quantity, 0);
  if (!Number.isSafeInteger(total) || total < 1) return res.status(400).json({ message: 'Invalid order total.' });
  const order = {
    id: `TW-DEMO-${Date.now()}`, userId: user.id, items: cart, total,
    customer: { name, address, phone }, status: 'Demo payment successful (simulated)',
    paymentProvider: 'Demo Simulator', paymentId: null, realPayment: false,
    createdAt: new Date().toISOString()
  };
  store.orders.push(order); user.cart = []; saveStore();
  const { userId, ...publicOrder } = order;
  res.status(201).json({ message: 'Demo order created. No money was charged.', order: publicOrder });
});

app.post('/api/orders', auth, (req, res) => {
  const user = getUser(req); if (!user) return res.status(404).json({ message: 'User not found.' });
  const cart = (user.cart || []).map(row => { const p = store.products.find(x => x.id === row.productId); return p ? { productId: p.id, name: p.name, price: p.price, quantity: row.quantity } : null; }).filter(Boolean);
  if (!cart.length) return res.status(400).json({ message: 'Your cart is empty.' });
  const name = cleanText(req.body.name, 80); const address = cleanText(req.body.address, 250); const phone = cleanText(req.body.phone, 20);
  if (name.length < 2 || address.length < 8 || !/^[0-9+\-\s()]{8,20}$/.test(phone)) return res.status(400).json({ message: 'Please provide valid name, address and phone number.' });
  const order = { id: `TW-${Date.now()}`, userId: user.id, items: cart, total: cart.reduce((sum, p) => sum + p.price * p.quantity, 0), customer: { name, address, phone }, status: 'Placed (demo)', createdAt: new Date().toISOString() };
  store.orders.push(order); user.cart = []; saveStore(); res.status(201).json({ message: 'Demo order placed successfully.', order });
});
app.get('/api/orders', auth, (req, res) => res.json({ orders: store.orders.filter(o => o.userId === req.user.id).map(({ userId, ...o }) => o) }));
app.get('/api/admin/summary', auth, (req, res) => {
  const user = getUser(req); if (!user || user.email !== 'admin@techworld.demo') return res.status(403).json({ message: 'Admin access required.' });
  res.json({ products: store.products.length, users: store.users.length, orders: store.orders.length, revenue: store.orders.reduce((sum, o) => sum + o.total, 0), recentOrders: store.orders.slice(-5).reverse() });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html')));
app.listen(PORT, () => console.log(`TechWorld running at http://localhost:${PORT}`));
