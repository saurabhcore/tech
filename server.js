const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "techworld.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL CHECK(price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
    image TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    items_json TEXT NOT NULL,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'demo',
    payment_status TEXT NOT NULL DEFAULT 'SIMULATED',
    status TEXT NOT NULL DEFAULT 'Processing',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
if (productCount === 0) {
  const seed = [
    ["NovaBook Air 14", "Laptops", "Slim everyday laptop for study, work, and creative projects.", 64999, 12, "💻", 1],
    ["Pulse Wireless Headphones", "Audio", "Immersive sound, soft cushions, and all-day wireless comfort.", 4999, 30, "🎧", 1],
    ["Vertex Mechanical Keyboard", "Accessories", "Tactile keys, compact layout, and a clean desk-ready design.", 3499, 24, "⌨️", 1],
    ["Orbit Smart Watch", "Wearables", "Track activity, check notifications, and keep your day moving.", 7999, 18, "⌚", 1],
    ["PixelPro 4K Monitor", "Displays", "Sharp 4K visuals for productivity, design, and entertainment.", 27999, 9, "🖥️", 0],
    ["Glide Wireless Mouse", "Accessories", "Precision tracking with a comfortable ergonomic shape.", 1499, 42, "🖱️", 0],
    ["Aero USB-C Hub", "Accessories", "Expand your workspace with practical ports in one compact hub.", 2299, 20, "🔌", 0],
    ["PowerCore 20K", "Power", "Portable power for long days away from your desk.", 1999, 35, "🔋", 0]
  ];
  const insert = db.prepare(`INSERT INTO products (name,category,description,price,stock,image,featured)
    VALUES (?,?,?,?,?,?,?)`);
  const transaction = db.transaction(rows => rows.forEach(row => insert.run(...row)));
  transaction(seed);
}

const adminEmail = process.env.ADMIN_EMAIL || "admin@techworld.demo";
const adminPassword = process.env.ADMIN_PASSWORD || "Admin@12345";
const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'admin')")
    .run("TechWorld Admin", adminEmail.toLowerCase(), hash);
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(session({
  name: "tw.sid",
  secret: process.env.SESSION_SECRET || "local-demo-change-this-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 4
  }
}));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "public")));

const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: "Please sign in to continue." });
  next();
};
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
};

app.get("/api/health", (req, res) => res.json({ status: "ok", app: "TechWorld Pro", paymentMode: "simulation-only" }));
app.get("/api/products", (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 80);
  const category = String(req.query.category || "").trim().slice(0, 40);
  const products = db.prepare(`
    SELECT id,name,category,description,price,stock,image,featured
    FROM products
    WHERE (? = '' OR name LIKE ? OR description LIKE ? OR category LIKE ?)
      AND (? = '' OR category = ?)
    ORDER BY featured DESC, id DESC
  `).all(q, `%${q}%`, `%${q}%`, `%${q}%`, category, category);
  res.json({ products });
});
app.get("/api/categories", (req, res) => {
  res.json({ categories: db.prepare("SELECT DISTINCT category FROM products ORDER BY category").all().map(x => x.category) });
});

app.post("/api/auth/register", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Name must be between 2 and 60 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be 8–72 characters." });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return res.status(409).json({ error: "An account with this email already exists." });
  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare("INSERT INTO users (name,email,password_hash) VALUES (?,?,?)").run(name, email, hash);
  const user = db.prepare("SELECT id,name,email,role FROM users WHERE id = ?").get(result.lastInsertRowid);
  req.session.user = publicUser(user);
  res.status(201).json({ user: publicUser(user) });
});
app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: "Incorrect email or password." });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Could not start session." });
    req.session.user = publicUser(user);
    res.json({ user: publicUser(user) });
  });
});
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("tw.sid", { httpOnly: true, sameSite: "lax" });
    res.json({ ok: true });
  });
});
app.get("/api/auth/me", (req, res) => res.json({ user: req.session.user || null }));

app.post("/api/orders", requireAuth, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length || items.length > 30) return res.status(400).json({ error: "Your cart is empty or contains too many items." });
  const cleanItems = [];
  let total = 0;
  for (const item of items) {
    const id = Number(item.id);
    const qty = Number(item.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 20) return res.status(400).json({ error: "Invalid cart item." });
    const product = db.prepare("SELECT id,name,price,stock,image FROM products WHERE id = ?").get(id);
    if (!product) return res.status(400).json({ error: "A product in your cart no longer exists." });
    if (product.stock < qty) return res.status(400).json({ error: `${product.name} does not have enough demo stock.` });
    cleanItems.push({ id: product.id, name: product.name, price: product.price, quantity: qty, image: product.image });
    total += product.price * qty;
  }
  const code = "TW-DEMO-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const user = db.prepare("SELECT id,name,email FROM users WHERE id = ?").get(req.session.user.id);
  const createOrder = db.transaction(() => {
    for (const item of cleanItems) {
      const result = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?").run(item.quantity, item.id, item.quantity);
      if (!result.changes) throw new Error("Stock changed. Please refresh your cart.");
    }
    db.prepare(`INSERT INTO orders (order_code,user_id,customer_name,customer_email,items_json,total,payment_method,payment_status,status)
      VALUES (?,?,?,?,?,?,'demo','SIMULATED','Processing')`)
      .run(code, user.id, user.name, user.email, JSON.stringify(cleanItems), Number(total.toFixed(2)));
  });
  try { createOrder(); } catch (e) { return res.status(409).json({ error: e.message || "Could not place order." }); }
  res.status(201).json({
    order: { code, total: Number(total.toFixed(2)), paymentStatus: "SIMULATED", status: "Processing" },
    notice: "Demo order created. No money was charged and no payment provider was contacted."
  });
});
app.get("/api/orders/mine", requireAuth, (req, res) => {
  const orders = db.prepare("SELECT order_code,total,payment_status,status,created_at,items_json FROM orders WHERE user_id = ? ORDER BY id DESC")
    .all(req.session.user.id).map(o => ({ ...o, items: JSON.parse(o.items_json) }));
  res.json({ orders });
});

app.get("/api/admin/summary", requireAdmin, (req, res) => {
  const products = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  const orders = db.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  const customers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'").get().count;
  const demoRevenue = db.prepare("SELECT COALESCE(SUM(total),0) AS total FROM orders").get().total;
  res.json({ products, orders, customers, demoRevenue });
});
app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const orders = db.prepare("SELECT id,order_code,customer_name,customer_email,total,payment_status,status,created_at,items_json FROM orders ORDER BY id DESC LIMIT 100")
    .all().map(o => ({ ...o, items: JSON.parse(o.items_json) }));
  res.json({ orders });
});
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { name, category, description, price, stock, image } = req.body;
  const clean = {
    name: String(name || "").trim().slice(0, 100),
    category: String(category || "").trim().slice(0, 40),
    description: String(description || "").trim().slice(0, 500),
    price: Number(price), stock: Number(stock), image: String(image || "✨").slice(0, 10)
  };
  if (!clean.name || !clean.category || !clean.description || !Number.isFinite(clean.price) || clean.price < 0 ||
      !Number.isInteger(clean.stock) || clean.stock < 0 || clean.stock > 100000) {
    return res.status(400).json({ error: "Please provide valid product details." });
  }
  const result = db.prepare("INSERT INTO products (name,category,description,price,stock,image) VALUES (?,?,?,?,?,?)")
    .run(clean.name, clean.category, clean.description, clean.price, clean.stock, clean.image);
  res.status(201).json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid) });
});
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const status = String(req.body.status || "");
  if (!["Processing", "Packed", "Shipped", "Delivered", "Cancelled"].includes(status)) return res.status(400).json({ error: "Invalid order status." });
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Order not found." });
  res.json({ ok: true });
});
app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE items_json LIKE ?").get(`%"id":${id},%`).count;
  if (used) return res.status(409).json({ error: "This product appears in an order and cannot be removed from the demo catalog." });
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Product not found." });
  res.json({ ok: true });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, () => console.log(`TechWorld Pro running at http://localhost:${PORT}`));
