"""Loads the design's demo data into the emulators so the storefront and admin look lived-in.

    venv/bin/python scripts/seed_firestore.py                     # the local emulators
    venv/bin/python scripts/seed_firestore.py --admin ops@example.com

Creates an Auth user per demo customer (uid = customer id), so you can sign in
as one with their email link, e.g. maya.o@gmail.com. Dates are relative to
today, so the packing queue always has something in it. Seeded subscriptions
have no Stripe subscription, so changing them skips the Stripe calls.
Refuses to run against a live project.
"""
import argparse
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from firebase_admin import auth, firestore

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from _connect import add_connection_args, connect  # noqa: E402
from grant_admin import grant_admin_role  # noqa: E402
from modules.catalog.catalog import Catalog, starter_boxes  # noqa: E402
from seed_catalog import seed_catalog  # noqa: E402

CATALOG = Catalog(starter_boxes())
get_box = CATALOG.get
from modules.fulfilment.orders import order_number, ship_date_for  # noqa: E402
from modules.shared.clock import today_in_london  # noqa: E402
from modules.subscriptions.schedule import add_months, following_delivery, iso_month, pause_resume_date  # noqa: E402

# (id, name, email, city, member since (months ago), subscriptions: (box, cadence, status))
CUSTOMERS = [
    ("c1", "Maya Okafor", "maya.o@gmail.com", "Bristol", 7, [("datenight", "month", "active"), ("snacks", "week", "active"), ("selfcare", "month", "cancelled")]),
    ("c2", "Priya Shah", "priya@shahstudio.co.uk", "London", 4, [("datenight", "month", "active")]),
    ("c3", "Tom Haines", "tomhaines@outlook.com", "Leeds", 2, [("datenight", "month", "active")]),
    ("c4", "Hana Mori", "hana.mori@icloud.com", "Manchester", 7, [("selfcare", "week", "active")]),
    ("c5", "Jordan Reid", "jreid@hey.com", "Glasgow", 5, [("snacks", "week", "active"), ("home", "month", "paused")]),
    ("c6", "Chloe Barnes", "chloe.b@gmail.com", "Brighton", 21, [("beauty", "month", "active")]),
    ("c7", "Ade Bello", "ade@bello.studio", "Birmingham", 9, [("home", "month", "active")]),
    ("c8", "Ella Fitzgerald", "ella.fitz@gmail.com", "York", 8, [("beauty", "month", "paused")]),
    ("c9", "Sam Turner", "samturner@proton.me", "Bath", 6, [("snacks", "week", "cancelled")]),
    ("c10", "Rhys Evans", "rhys.evans@gmail.com", "Cardiff", 2, [("beauty", "week", "cancelled")]),
    ("c11", "Nadia Khan", "nadia.k@gmail.com", "Leicester", 8, [("selfcare", "month", "cancelled")]),
    ("c12", "Olly Price", "olly.price@hey.com", "Exeter", 1, [("home", "month", "cancelled")]),
    ("c13", "Grace Lee", "grace.lee@gmail.com", "Nottingham", 3, [("datenight", "month", "active")]),
    ("c14", "Leo Martin", "leo.martin@gmail.com", "Edinburgh", 4, [("beauty", "week", "active")]),
    ("c15", "Sophie Clarke", "sophie.c@gmail.com", "Cardiff", 6, [("selfcare", "month", "active")]),
]

# Generated subscribers, so the packing queue and charts have some volume.
FIRST_NAMES = ["Amelia", "Noah", "Isla", "Theo", "Ava", "Arlo", "Freya", "Jude", "Ivy", "Reuben", "Poppy", "Kai",
               "Mia", "Ezra", "Lily", "Finn", "Zara", "Otis", "Ruby", "Hugo", "Elsie", "Felix", "Nina", "Max", "Rosa"]
LAST_NAMES = ["Hughes", "Patel", "Wright", "Bennett", "Ali", "Murphy", "Clarke", "Ward", "Begum", "Price", "Kaur", "Ellis"]
CITIES = ["London", "Bristol", "Leeds", "Manchester", "Glasgow", "Cardiff", "Brighton", "York", "Norwich", "Oxford"]
BOX_IDS = ["datenight", "selfcare", "beauty", "snacks", "home"]
for n, first in enumerate(FIRST_NAMES):
    last = LAST_NAMES[n % len(LAST_NAMES)]
    cadence = "week" if n % 3 == 0 else "month"
    status = "paused" if n % 11 == 5 else "active"
    CUSTOMERS.append((f"g{n}", f"{first} {last}", f"{first.lower()}.{last.lower()}@example.com", CITIES[n % len(CITIES)],
                      1 + n % 10, [(BOX_IDS[n % len(BOX_IDS)], cadence, status)]))

# Cancellations in the last 30 days: (customer, box, reason, days ago)
CANCELLATIONS = [
    ("c9", "snacks", "A bit pricey", 1),
    ("c10", "beauty", "Too many boxes", 2),
    ("c11", "selfcare", "Just need a break", 3),
    ("c12", "home", "Something else", 4),
    ("c1", "selfcare", "Too many boxes", 12),
]

# People who started cancelling but stayed: (customer, box, "paused" | "monthly", days ago)
SAVES = [("c5", "home", "paused", 6), ("c8", "beauty", "paused", 9), ("c4", "selfcare", "monthly", 15)]

# (item id, stock) — the rest default to plenty. Low ones match the design's alerts.
STOCK = {
    "datenight-cards": 340, "datenight-game": 210, "datenight-candle": 4, "datenight-chocolate": 180,
    "datenight-shiraz": 150, "datenight-socks": 400, "selfcare-tea": 520, "selfcare-mask": 300,
    "selfcare-guasha": 3, "selfcare-candle": 140, "selfcare-handcream": 260, "beauty-serum": 190,
    "beauty-liptint": 220, "beauty-balm": 2, "beauty-spf": 160, "snacks-chocolate": 800,
    "snacks-crisps": 640, "snacks-cookies": 420, "snacks-nuts": 290, "home-candle": 120,
    "home-spray": 200, "home-dish": 64, "home-plant": 90,
}

PACKING_STAGES = ["topack", "topack", "packed", "labelled", "topack", "packed"]


def iso_at(day: date, hour: int = 9) -> str:
    return datetime.combine(day, time(hour), tzinfo=timezone.utc).isoformat(timespec="seconds")


class Seeder:
    def __init__(self, db, today: date) -> None:
        self.db = db
        self.today = today
        self.batch = db.batch()
        self.writes = 0
        self.order_sequence = 0
        self.ltv: dict[str, int] = {}

    def set(self, path: str, data: dict) -> None:
        self.batch.set(self.db.document(path), data)
        self.writes += 1
        if self.writes % 400 == 0:
            self.batch.commit()
            self.batch = self.db.batch()

    def commit(self) -> None:
        self.batch.commit()

    def event(self, customer_id: str, subscription_id: str, kind: str, day: date, **data) -> None:
        self.set(f"events/seed-{self.writes}", {
            "customerId": customer_id, "subscriptionId": subscription_id, "type": kind,
            "actor": customer_id, "data": data, "at": iso_at(day),
        })

    def order(self, customer, subscription_id: str, box_id: str, cadence: str, delivery: date, status: str) -> str:
        number = order_number(self.order_sequence)
        self.order_sequence += 1
        cid, name, _, city, *_ = customer
        price = get_box(box_id).prices[cadence]
        placed = min(delivery - timedelta(days=3), self.today)
        self.set(f"orders/{number}", {
            "customerId": cid, "customerName": name, "city": city, "subscriptionId": subscription_id,
            "boxId": box_id, "cadence": cadence, "isGift": cid == "c13",
            "items": [item.name for item in get_box(box_id).items_for(cadence)], "deliveryDate": delivery.isoformat(),
            "shipDate": ship_date_for(delivery).isoformat(), "status": status, "pricePence": price,
            "stripeInvoiceId": None, "placedOn": placed.isoformat(), "createdAt": iso_at(placed), "updatedAt": iso_at(placed),
        })
        if status != "refunded":
            self.ltv[cid] = self.ltv.get(cid, 0) + price
            self.set(f"payments/seed-{number}", {
                "customerId": cid, "subscriptionId": subscription_id, "orderId": number, "amountPence": price,
                "status": "paid", "attemptCount": 1, "nextRetryAt": None, "createdAt": iso_at(placed), "updatedAt": iso_at(placed),
            })
            self.event(cid, subscription_id, "payment_paid", placed, boxId=box_id, amountPence=price, delivery=delivery.isoformat())
        return number


def seed(db, today: date) -> None:
    seed_catalog(db, overwrite=True)
    seeder = Seeder(db, today)
    # Boxes already charged arrive from tomorrow, so something ships today.
    this_week = [today + timedelta(days=offset) for offset in range(1, 9)]
    this_week = [day for day in this_week if day.weekday() < 5][:5]
    summaries: dict[str, list] = {}

    for index, customer in enumerate(CUSTOMERS):
        cid, name, email, city, months_ago, subscriptions = customer
        member_since = add_months(today, -months_ago)
        for sub_index, (box_id, cadence, status) in enumerate(subscriptions):
            sub_id = f"{cid}-{box_id}"
            box = get_box(box_id)
            delivery = this_week[(index + sub_index) % len(this_week)]
            packed = None
            next_delivery = None
            resumes_on = None
            ended_on = None

            # Past boxes, all delivered.
            history = delivery
            for _ in range(min(months_ago, 3)):
                history = history - timedelta(days=7) if cadence == "week" else add_months(history, -1)
                if history < today:
                    seeder.order(customer, sub_id, box_id, cadence, history, "delivered")

            if status == "active":
                packed = delivery
                seeder.order(customer, sub_id, box_id, cadence, delivery, PACKING_STAGES[(index + sub_index) % len(PACKING_STAGES)])
                next_delivery = following_delivery(delivery, cadence)
            elif status == "paused":
                resumes_on = pause_resume_date(today)
                next_delivery = resumes_on
                seeder.event(cid, sub_id, "paused", today - timedelta(days=6), boxId=box_id, resumesOn=resumes_on.isoformat(), retention=True)
            else:
                ended_on = iso_month(today)

            seeder.set(f"subscriptions/{sub_id}", {
                "customerId": cid, "boxId": box_id, "cadence": cadence, "status": status,
                "nextDelivery": next_delivery.isoformat() if next_delivery else None,
                "packedDelivery": packed.isoformat() if packed else None,
                "resumesOn": resumes_on.isoformat() if resumes_on else None,
                "memberSince": iso_month(member_since), "endedOn": ended_on, "finalDelivery": None,
                "isGift": False, "pricePence": box.prices[cadence], "skippedDelivery": None, "beforeCancel": None, "paymentFailed": cid == "c5" and box_id == "snacks",
                "monthlyValuePence": box.monthly_value_pence(cadence), "stripeSubscriptionId": None,
                "createdAt": iso_at(member_since), "updatedAt": iso_at(today),
            })
            seeder.event(cid, sub_id, "subscription_created", member_since, boxId=box_id, cadence=cadence)
            summaries.setdefault(cid, []).append((box_id, cadence, status, packed or next_delivery if status == "active" else None))

    for cid, box_id, reason, days_ago in CANCELLATIONS:
        seeder.event(cid, f"{cid}-{box_id}", "cancelled", today - timedelta(days=days_ago), boxId=box_id, reason=reason, fromStatus="active")
    for cid, box_id, kind, days_ago in SAVES:
        if kind == "paused":
            continue  # already logged with the paused subscription above
        seeder.event(cid, f"{cid}-{box_id}", "cadence_changed", today - timedelta(days=days_ago), boxId=box_id, retention=True, to="month")

    # One payment failed overnight.
    seeder.set("payments/seed-failed-1", {
        "customerId": "c5", "subscriptionId": "c5-snacks", "orderId": None, "amountPence": 1200, "status": "failed",
        "attemptCount": 2, "nextRetryAt": iso_at(today + timedelta(days=2)), "createdAt": iso_at(today, 3), "updatedAt": iso_at(today, 3),
    })

    status_rank = {"active": 0, "paused": 1, "cancelled": 2}
    for cid, name, email, city, months_ago, _ in CUSTOMERS:
        subs = sorted(summaries[cid], key=lambda sub: status_rank[sub[2]])
        upcoming = [sub[3].isoformat() for sub in subs if sub[3]]
        seeder.set(f"customers/{cid}", {
            "email": email, "name": name, "city": city, "shippingAddress": None,
            "memberSince": iso_month(add_months(today, -months_ago)), "ltvPence": seeder.ltv.get(cid, 0),
            "stripeCustomerId": None,
            "subscriptionSummary": [{"boxId": box, "cadence": cadence, "status": status} for box, cadence, status, _ in subs],
            "nextDelivery": min(upcoming) if upcoming else None, "overallStatus": subs[0][2],
            "createdAt": iso_at(add_months(today, -months_ago)), "updatedAt": iso_at(today),
        })

    for box in CATALOG.all():
        for item in box.items:
            seeder.set(f"inventory/{item.id}", {"boxId": box.id, "name": item.name, "stock": STOCK.get(item.id, 200), "inWeeklyBox": item.in_weekly_box})

    # A month-ago snapshot, so the overview has something to compare against.
    live = [sub for subs in summaries.values() for sub in subs if sub[2] == "active"]
    mrr = sum(get_box(box).monthly_value_pence(cadence) for box, cadence, _, _ in live)
    month_ago = (today - timedelta(days=30)).isoformat()
    seeder.set(f"metrics_snapshots/{month_ago}", {
        "date": month_ago, "activeSubscriptions": round(len(live) * 0.94), "mrrPence": round(mrr * 0.95),
        "churnRate": 0.035, "weekly": 0, "monthly": 0,
    })

    seeder.set("counters/orders", {"next": seeder.order_sequence})
    seeder.commit()
    print(f"Seeded {len(CUSTOMERS)} customers and {seeder.order_sequence} orders ({seeder.writes} writes).")


def create_auth_users() -> None:
    for cid, name, email, *_ in CUSTOMERS:
        try:
            auth.create_user(uid=cid, email=email, display_name=name, email_verified=True)
        except auth.UidAlreadyExistsError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--admin", metavar="EMAIL", help="Also make this email an admin")
    add_connection_args(parser)
    args = parser.parse_args()
    if args.live:
        raise SystemExit("seed_firestore.py only runs against the emulators.")
    connect(args)
    seed(firestore.client(), today_in_london())
    create_auth_users()
    if args.admin:
        grant_admin_role(args.admin, create_if_missing=True)
        print(f"{args.admin} is an admin.")


if __name__ == "__main__":
    main()
