from pydantic import BaseModel

class Health(BaseModel):
    status: str
    dataset_ready: bool

class Filters(BaseModel):
    countries: list[str]
    min_date: str | None
    max_date: str | None

class Overview(BaseModel):
    revenue: float
    orders: int
    average_order_value: float
    customers: int
    sales_rows: int

class Month(BaseModel):
    month: str
    revenue: float
    orders: int
    partial: bool
    mom_change_pct: float | None

class Product(BaseModel):
    stock_code: str
    description: str
    revenue: float
    quantity: int
    orders: int

class Country(BaseModel):
    country: str
    revenue: float
    orders: int

class SpendingBand(BaseModel):
    band: str
    customers: int

class Customers(BaseModel):
    customers: int
    repeat_customers: int
    repeat_customer_rate: float
    excluded_anonymous_sales_rows: int
    spending_distribution: list[SpendingBand]

class Quality(BaseModel):
    raw_rows: int
    valid_sales_rows: int
    excluded_rows: int
    excluded_by_reason: dict[str, int]
    flags: dict[str, int]
    missing_customer_ids: int
    valid_sales_missing_customer_ids: int
    negative_quantities: int
    invalid_records: int
    missing_descriptions: int
    min_date: str | None
    max_date: str | None
    provenance: dict[str, str]
