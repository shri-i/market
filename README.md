# Atelier Market — hackathon prototype

FastAPI + SQLite backend serving the static Tailwind pages in `public/`.

## Run

```bash
cd backend
python3 -m venv .venv            # first time only
.venv/bin/pip install -r requirements.txt   # first time only
.venv/bin/uvicorn main:app --reload --port 8000
```

| URL | What |
|---|---|
| http://localhost:8000 | Storefront (home) |
| http://localhost:8000/bag/code.html | Bag, wishlist, my orders, checkout |
| http://localhost:8000/admin | Admin console (products + orders) |
| http://localhost:8000/docs | Interactive API docs |

**Admin login:** the ID and password are in `backend/config.py` (`ADMIN_ID`, `ADMIN_PASSWORD`).
Override them with the `ATELIER_ADMIN_ID` / `ATELIER_ADMIN_PASSWORD` environment variables.

## Data

- `backend/atelier.db` is created on first start and seeded with the 12 home-page products and 14 dummy orders.
- Delete `backend/atelier.db` and restart to reset everything.
- Shopper "login" is a prototype: signing in or registering just stores the name/email in `localStorage`; no password is checked.

## Layout

```
backend/   main.py (API + static hosting), models.py, seed.py, config.py, seed_products.json
public/    home_marketplace_discover/, buyer_sign_in/, buyer_registration/, forgot_password/,
           bag/, admin/, shared/ (atelier.js animations, store.js API client)
```
