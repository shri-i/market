"""Fill an empty database with the home-page products and some dummy orders."""
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlmodel import Session, select

from models import Order, Product

CUSTOMERS = [
    ("Sophia Hart", "sophia.hart@couture.com"),
    ("Eleanor Vance", "eleanor@vance.com"),
    ("Arjun Mehta", "arjun.mehta@mail.com"),
    ("Camille Laurent", "camille@laurent.fr"),
    ("Kenji Watanabe", "kenji.w@studio.jp"),
    ("Priya Sharma", "priya.sharma@mail.com"),
    ("Lucas Moreau", "lucas.moreau@mail.com"),
    ("Ava Thompson", "ava.t@mail.com"),
]
STATUSES = ["pending", "paid", "shipped", "delivered", "delivered", "cancelled"]


def seed(engine):
    with Session(engine) as db:
        if db.exec(select(Product)).first():
            return
        data = json.loads((Path(__file__).parent / "seed_products.json").read_text())
        products = [Product(**p) for p in data]
        db.add_all(products)
        db.commit()
        for p in products:
            db.refresh(p)

        rng = random.Random(42)
        for i in range(14):
            name, email = rng.choice(CUSTOMERS)
            picks = rng.sample(products, rng.randint(1, 3))
            items = [
                dict(product_id=p.id, name=p.name, designer=p.designer, price=p.price,
                     qty=rng.choice([1, 1, 2]), image=p.image)
                for p in picks
            ]
            db.add(Order(
                user=email, name=name, email=email, items_json=json.dumps(items),
                total=sum(it["price"] * it["qty"] for it in items),
                status=rng.choice(STATUSES),
                created_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 30), hours=rng.randint(0, 23)),
            ))
        db.commit()
