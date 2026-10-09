# TechWorld Pro — Full-stack demo e-commerce website

A professional responsive storefront with a Node.js/Express backend, SQLite database, authentication, cart, order processing, admin dashboard, and **simulation-only checkout**.

## Features

- Responsive storefront with product search and category filters
- Cart with quantity controls and subtotal
- Customer registration/login with bcrypt password hashing
- Session-based authentication
- SQLite persistence for users, products, and orders
- Server-side price and stock validation during order creation
- Demo checkout: orders are marked `SIMULATED`; no payment provider is integrated and no money is charged
- Admin dashboard with summary metrics, order status management, and product creation
- Helmet security headers, basic authentication rate limiting, request size limits, input validation, and parameterized SQL
- Demo seed products and admin account

## Requirements

- Node.js 18 or later
- npm

## Run locally

1. Extract the ZIP.
2. Open a terminal in the `TechWorld_Pro` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser.

The SQLite database is created automatically at `data/techworld.sqlite` on first run.

## Admin demo login

- Email: `admin@techworld.demo`
- Password: `Admin@12345`

Use only for a local demonstration. For a real deployment, set a unique `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and strong `SESSION_SECRET` environment variable before the first run. If an admin account has already been seeded, changing the environment values does not automatically reset that existing account.

Example (macOS/Linux):

```bash
ADMIN_EMAIL="your-admin@example.com" ADMIN_PASSWORD="use-a-long-unique-password" SESSION_SECRET="a-long-random-secret" npm start
```

PowerShell example:

```powershell
$env:ADMIN_EMAIL="your-admin@example.com"
$env:ADMIN_PASSWORD="use-a-long-unique-password"
$env:SESSION_SECRET="a-long-random-secret"
npm start
```

## Presentation walkthrough

1. Open the storefront and demonstrate responsive product cards.
2. Search for a product and filter by category.
3. Add an item to the cart and change its quantity.
4. Register a customer account or sign in.
5. Place a demo order. The success screen clearly states that no money was charged.
6. Open **Admin demo**, sign in, and show the order record and simulated order value.
7. Change the order status or add a product in the admin panel.
8. Restart the server to demonstrate that products and orders persist in SQLite.

## API overview

- `GET /api/health`
- `GET /api/products`
- `GET /api/categories`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/orders`
- `GET /api/orders/mine`
- `GET /api/admin/summary` (admin)
- `GET /api/admin/orders` (admin)
- `POST /api/admin/products` (admin)
- `PATCH /api/admin/orders/:id` (admin)
- `DELETE /api/admin/products/:id` (admin)

## Important limitations

This is a local educational/demo project, not a production commerce system. Express's default in-memory session store is used for simplicity and is not appropriate for multi-instance production deployment. Before public production use, configure a persistent session store, HTTPS, CSRF protection where applicable, stronger operational logging, backups, privacy/legal pages, and a proper payment provider only if real payments are ever intended. **No real payment gateway is included in this project.**

## GitHub upload

Upload the extracted project folder to a new GitHub repository. Do not upload `node_modules`, `.env`, or the generated `data/` database file. The `.gitignore` already excludes them.
