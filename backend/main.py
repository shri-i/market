"""Atelier Market prototype API. Run: uvicorn main:app --reload (from backend/)."""
import json
import secrets
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, SQLModel, col, create_engine, func, or_, select

import config
from models import CartItem, Order, Product, ProductBase, Subscriber, WishlistItem
from seed import seed

is_sqlite = config.DB_URL.startswith("sqlite")
engine = create_engine(
    config.DB_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    pool_pre_ping=not is_sqlite,  # Supabase drops idle connections
)
SQLModel.metadata.create_all(engine)
seed(engine)

app = FastAPI(title="Atelier Market API")
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
admin_tokens: set[str] = set()
ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"]


def get_db():
    with Session(engine) as db:
        yield db


def require_admin(authorization: str = Header(default="")):
    if authorization.removeprefix("Bearer ") not in admin_tokens:
        raise HTTPException(401, "Admin login required")


def get_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    return product


# ---------- Products ----------
@app.get("/api/products")
def list_products(category: Optional[str] = None, trending: bool = False, new: bool = False,
                  q: Optional[str] = None, db: Session = Depends(get_db)):
    stmt = select(Product)
    if category:
        stmt = stmt.where(Product.category == category)
    if trending:
        stmt = stmt.where(Product.is_trending)
    if new:
        stmt = stmt.where(Product.is_new)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(col(Product.name).ilike(like), col(Product.designer).ilike(like),
                              col(Product.category).ilike(like)))
    return db.exec(stmt.order_by(Product.id)).all()


@app.get("/api/products/{product_id}")
def product_detail(product_id: int, db: Session = Depends(get_db)):
    return get_product(db, product_id)


# ---------- Cart ----------
class CartIn(BaseModel):
    user: str
    product_id: int
    qty: int = 1


def cart_view(db: Session, user: str):
    rows = db.exec(select(CartItem, Product).join(Product).where(CartItem.user == user)).all()
    items = [dict(id=c.id, qty=c.qty, product=p) for c, p in rows]
    return dict(items=items, count=sum(c.qty for c, _ in rows), total=sum(c.qty * p.price for c, p in rows))


@app.get("/api/cart")
def get_cart(user: str, db: Session = Depends(get_db)):
    return cart_view(db, user)


@app.post("/api/cart")
def add_to_cart(body: CartIn, db: Session = Depends(get_db)):
    get_product(db, body.product_id)
    item = db.exec(select(CartItem).where(CartItem.user == body.user,
                                          CartItem.product_id == body.product_id)).first()
    if item:
        item.qty += body.qty
    else:
        item = CartItem(**body.model_dump())
    if item.qty <= 0:
        db.delete(item)
    else:
        db.add(item)
    db.commit()
    return cart_view(db, body.user)


@app.delete("/api/cart/{item_id}")
def remove_from_cart(item_id: int, db: Session = Depends(get_db)):
    item = db.get(CartItem, item_id)
    if not item:
        raise HTTPException(404, "Cart item not found")
    user = item.user
    db.delete(item)
    db.commit()
    return cart_view(db, user)


# ---------- Wishlist ----------
class WishIn(BaseModel):
    user: str
    product_id: int


@app.get("/api/wishlist")
def get_wishlist(user: str, db: Session = Depends(get_db)):
    rows = db.exec(select(WishlistItem, Product).join(Product).where(WishlistItem.user == user)).all()
    return [dict(id=w.id, product=p) for w, p in rows]


@app.post("/api/wishlist/toggle")
def toggle_wishlist(body: WishIn, db: Session = Depends(get_db)):
    get_product(db, body.product_id)
    item = db.exec(select(WishlistItem).where(WishlistItem.user == body.user,
                                              WishlistItem.product_id == body.product_id)).first()
    if item:
        db.delete(item)
        saved = False
    else:
        db.add(WishlistItem(**body.model_dump()))
        saved = True
    db.commit()
    return {"saved": saved}


# ---------- Orders ----------
class CheckoutIn(BaseModel):
    user: str
    name: str = ""
    email: str = ""


@app.post("/api/orders")
def place_order(body: CheckoutIn, db: Session = Depends(get_db)):
    rows = db.exec(select(CartItem, Product).join(Product).where(CartItem.user == body.user)).all()
    if not rows:
        raise HTTPException(400, "Your bag is empty")
    items = [dict(product_id=p.id, name=p.name, designer=p.designer, price=p.price, qty=c.qty, image=p.image)
             for c, p in rows]
    order = Order(user=body.user, name=body.name, email=body.email, items_json=json.dumps(items),
                  total=sum(i["price"] * i["qty"] for i in items), status="paid")
    db.add(order)
    for c, p in rows:
        p.stock = max(0, p.stock - c.qty)
        db.delete(c)
    db.commit()
    db.refresh(order)
    return order


@app.get("/api/orders")
def my_orders(user: str, db: Session = Depends(get_db)):
    return db.exec(select(Order).where(Order.user == user).order_by(col(Order.created_at).desc())).all()


# ---------- Newsletter ----------
class SubscribeIn(BaseModel):
    email: str


@app.post("/api/newsletter")
def subscribe(body: SubscribeIn, db: Session = Depends(get_db)):
    db.add(Subscriber(email=body.email))
    db.commit()
    return {"ok": True}


# ---------- Admin ----------
class LoginIn(BaseModel):
    admin_id: str
    password: str


@app.post("/api/admin/login")
def admin_login(body: LoginIn):
    if not (secrets.compare_digest(body.admin_id, config.ADMIN_ID)
            and secrets.compare_digest(body.password, config.ADMIN_PASSWORD)):
        raise HTTPException(401, "Invalid admin ID or password")
    token = secrets.token_urlsafe(24)
    admin_tokens.add(token)
    return {"token": token}


@app.get("/api/admin/stats", dependencies=[Depends(require_admin)])
def admin_stats(db: Session = Depends(get_db)):
    orders = db.exec(select(Order)).all()
    live = [o for o in orders if o.status != "cancelled"]
    return dict(
        products=db.exec(select(func.count()).select_from(Product)).one(),
        orders=len(orders),
        revenue=sum(o.total for o in live),
        pending=sum(o.status == "pending" for o in orders),
        subscribers=db.exec(select(func.count()).select_from(Subscriber)).one(),
    )


@app.post("/api/admin/products", dependencies=[Depends(require_admin)])
def create_product(body: ProductBase, db: Session = Depends(get_db)):
    product = Product.model_validate(body)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.put("/api/admin/products/{product_id}", dependencies=[Depends(require_admin)])
def update_product(product_id: int, body: ProductBase, db: Session = Depends(get_db)):
    product = get_product(db, product_id)
    product.sqlmodel_update(body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.delete("/api/admin/products/{product_id}", dependencies=[Depends(require_admin)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = get_product(db, product_id)
    for model in (CartItem, WishlistItem):
        for row in db.exec(select(model).where(model.product_id == product_id)).all():
            db.delete(row)
    db.delete(product)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/orders", dependencies=[Depends(require_admin)])
def admin_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    stmt = select(Order).order_by(col(Order.created_at).desc())
    if status:
        stmt = stmt.where(Order.status == status)
    return db.exec(stmt).all()


class StatusIn(BaseModel):
    status: str


@app.patch("/api/admin/orders/{order_id}", dependencies=[Depends(require_admin)])
def update_order_status(order_id: int, body: StatusIn, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    if body.status not in ORDER_STATUSES:
        raise HTTPException(422, f"Status must be one of {ORDER_STATUSES}")
    order.status = body.status
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@app.get("/admin", include_in_schema=False)
def admin_redirect():
    return RedirectResponse("/admin/")


# Static site last so /api routes win.
app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="site")
