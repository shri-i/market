from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class ProductBase(SQLModel):
    name: str
    designer: str
    category: str
    price: int
    image: str
    description: str = ""
    badge: Optional[str] = None
    stock: int = 5
    is_new: bool = False
    is_trending: bool = False


class Product(ProductBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class CartItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user: str = Field(index=True)
    product_id: int = Field(foreign_key="product.id")
    qty: int = 1


class WishlistItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user: str = Field(index=True)
    product_id: int = Field(foreign_key="product.id")


class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user: str
    name: str = ""
    email: str = ""
    items_json: str  # [{product_id, name, designer, price, qty, image}]
    total: int
    status: str = "pending"  # pending | paid | shipped | delivered | cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Subscriber(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
