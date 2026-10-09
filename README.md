# TechWorld — Electronics & Gadgets (Full-Stack Demo)

A responsive electronics storefront based on internship task **WD-EC-003**. It includes a browser frontend and a working Node.js/Express REST API.

## Features
- Responsive TechWorld homepage, category cards, product cards and product details
- Product search, category filtering and sorting
- Registration and login with bcrypt password hashing and JWT sessions
- Authenticated cart: add, update quantity and remove items
- Demo checkout with server-side validation and order history
- Admin summary endpoint (demo admin email: `admin@techworld.demo`; create an account with this email to view the endpoint)
- Helmet security headers, JSON request size limit, API rate limiting, input validation
- Local JSON persistence so the demo works without a database server

## Requirements
- Node.js 18 or later
- Internet connection is not required for API functionality. Google Fonts are optional visual enhancement.

## Run locally
1. Extract the ZIP.
2. Open a terminal in the `techworld-fullstack` folder.
3. Run `npm install --prefix backend`.
4. Run `npm start`.
5. Open `http://localhost:5000` in your browser.

The frontend is served by Express and calls the backend at `/api`. Keep the terminal open while presenting.

## API routes
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | API health check | No |
| GET | `/api/products` | List/search/filter products | No |
| GET | `/api/products/:id` | Product detail | No |
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login | No |
| GET | `/api/auth/me` | Current user | Yes |
| GET/POST | `/api/cart` | Read cart / add item | Yes |
| PATCH | `/api/cart/:productId` | Update quantity; 0 removes item | Yes |
| POST | `/api/orders` | Place a simulated order | Yes |
| GET | `/api/orders` | Current user's order history | Yes |
| GET | `/api/admin/summary` | Demo admin summary | Yes, demo email allow-list |

## Important demo notes
- Checkout is simulated; there is no real payment gateway.
- Data is stored in `backend/data/store.json`, created on first run. This is a lightweight local demo store, not a production database.
- For public deployment, set a strong `JWT_SECRET`, restrict CORS to the exact frontend origin, use a managed database such as MongoDB, enable HTTPS, and add proper admin role management. Do not use the fallback JWT secret in a deployed app.
- Never commit real secrets or real customer data to GitHub.

## GitHub upload
Upload the complete `techworld-fullstack` folder contents, including `frontend`, `backend`, and this README. Do not upload `node_modules` if created. Add a `.gitignore` before committing if you add local environment files.


## Payment screen (presentation/demo mode)

The checkout uses a **simulated payment flow only**. It does not contact Razorpay or any other payment provider, does not request card/bank details, and does not charge money. After valid delivery details are submitted, the backend creates an order marked as a demo/simulated payment so you can demonstrate the checkout and order-confirmation flow during your presentation.

- Demo endpoint: `POST /api/payments/demo` (requires login)
- Payment config: `GET /api/payment/config` reports `mode: simulation` and `realPaymentsEnabled: false`
- No payment gateway API keys are required.
- Do not describe the simulated payment as a real gateway integration. A real gateway would require separate provider onboarding, test credentials, server-side verification, webhooks, HTTPS, and security review.

The sample stores data in local JSON for learning/presentation use. For public production use, move to a managed database, configure HTTPS and restricted CORS, and review all security and deployment settings.
