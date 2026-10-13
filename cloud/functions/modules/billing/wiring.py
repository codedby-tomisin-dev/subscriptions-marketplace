"""Builds services with their real dependencies. Handlers call these; tests build services with fakes."""
from core import config
from core.firestore import get_db
from modules.billing.gateway import StripeGateway
from modules.billing.repository import BillingRepository
from modules.billing.service import BillingService
from modules.catalog.repository import CatalogRepository
from modules.customers.repository import CustomersRepository
from modules.fulfilment.repository import OrdersRepository
from modules.subscriptions.repository import SubscriptionsRepository
from modules.subscriptions.service import SubscriptionService


def stripe_gateway() -> StripeGateway:
    return StripeGateway(config.stripe_secret_key(), config.stripe_webhook_secret())


def subscriptions_repository() -> SubscriptionsRepository:
    db = get_db()
    return SubscriptionsRepository(db, CustomersRepository(db))


def load_catalog():
    return CatalogRepository(get_db()).load()


def build_subscription_service() -> SubscriptionService:
    return SubscriptionService(subscriptions_repository(), stripe_gateway, load_catalog)


def build_billing_service() -> BillingService:
    db = get_db()
    return BillingService(
        gateway=stripe_gateway,
        catalog=load_catalog,
        customers=CustomersRepository(db),
        subscriptions=subscriptions_repository(),
        orders=OrdersRepository(db),
        billing=BillingRepository(db),
    )
