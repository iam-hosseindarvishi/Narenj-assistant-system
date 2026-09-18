"""Sales-base module: CRUD for visitors, routes, plans, customers, groups,
exclusive group rules, plus the weekly violation report (Jalali weeks)."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_operator, require_viewer
from app.models.sales import (
    Customer,
    CustomerRoute,
    CustomerVisitorLink,
    ProductGroup,
    Sale,
    SalesRoute,
    Visitor,
    VisitorGroupRule,
    WeeklyPlan,
)

router = APIRouter(prefix="/sales", tags=["sales"])

WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"]


# -- visitors ---------------------------------------------------------------------
class VisitorIn(BaseModel):
    # code is optional: when omitted, it is generated from the DB autoincrement id.
    code: str = Field(default="", max_length=50)
    full_name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    active: bool = True


class VisitorUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    active: bool | None = None


def visitor_out(v: Visitor) -> dict:
    return {"id": v.id, "code": v.code, "full_name": v.full_name, "phone": v.phone, "active": v.active}


@router.get("/visitors", dependencies=[Depends(require_viewer)])
def list_visitors(db: Session = Depends(get_db)):
    rows = list(db.execute(select(Visitor).order_by(Visitor.id)).scalars())
    return [visitor_out(v) for v in rows]


@router.post("/visitors", dependencies=[Depends(require_operator)], status_code=201)
def create_visitor(payload: VisitorIn, db: Session = Depends(get_db)):
    code = payload.code.strip()
    if code and db.execute(select(Visitor).where(Visitor.code == code)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="کد ویزیتور تکراری است")
    v = Visitor(code=code, **payload.model_dump(exclude={"code"}))
    db.add(v)
    db.flush()  # DB autoincrement assigns the id
    if not code:
        v.code = f"V-{v.id}"
    db.commit()
    return visitor_out(v)


@router.put("/visitors/{visitor_id}", dependencies=[Depends(require_operator)])
def update_visitor(visitor_id: int, payload: VisitorUpdate, db: Session = Depends(get_db)):
    v = db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(status_code=404, detail="ویزیتور یافت نشد")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"] != v.code:
        if db.execute(select(Visitor).where(Visitor.code == data["code"])).scalar_one_or_none():
            raise HTTPException(status_code=409, detail="کد ویزیتور تکراری است")
    for key, value in data.items():
        setattr(v, key, value)
    db.commit()
    return visitor_out(v)


@router.delete("/visitors/{visitor_id}", dependencies=[Depends(require_operator)])
def delete_visitor(visitor_id: int, db: Session = Depends(get_db)):
    v = db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(status_code=404, detail="ویزیتور یافت نشد")
    db.delete(v)
    db.commit()
    return {"ok": True}


# -- routes -----------------------------------------------------------------------
class RouteIn(BaseModel):
    code: str = Field(default="", max_length=50)  # optional → auto-generated
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    active: bool = True


class RouteUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    active: bool | None = None


def route_out(r: SalesRoute) -> dict:
    return {"id": r.id, "code": r.code, "name": r.name, "description": r.description, "active": r.active}


@router.get("/routes", dependencies=[Depends(require_viewer)])
def list_routes(db: Session = Depends(get_db)):
    rows = list(db.execute(select(SalesRoute).order_by(SalesRoute.id)).scalars())
    return [route_out(r) for r in rows]


@router.post("/routes", dependencies=[Depends(require_operator)], status_code=201)
def create_route(payload: RouteIn, db: Session = Depends(get_db)):
    code = payload.code.strip()
    if code and db.execute(select(SalesRoute).where(SalesRoute.code == code)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="کد مسیر تکراری است")
    r = SalesRoute(code=code, **payload.model_dump(exclude={"code"}))
    db.add(r)
    db.flush()
    if not code:
        r.code = f"R-{r.id}"
    db.commit()
    return route_out(r)


@router.put("/routes/{route_id}", dependencies=[Depends(require_operator)])
def update_route(route_id: int, payload: RouteUpdate, db: Session = Depends(get_db)):
    r = db.get(SalesRoute, route_id)
    if not r:
        raise HTTPException(status_code=404, detail="مسیر یافت نشد")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"] != r.code:
        if db.execute(select(SalesRoute).where(SalesRoute.code == data["code"])).scalar_one_or_none():
            raise HTTPException(status_code=409, detail="کد مسیر تکراری است")
    for key, value in data.items():
        setattr(r, key, value)
    db.commit()
    return route_out(r)


@router.delete("/routes/{route_id}", dependencies=[Depends(require_operator)])
def delete_route(route_id: int, db: Session = Depends(get_db)):
    r = db.get(SalesRoute, route_id)
    if not r:
        raise HTTPException(status_code=404, detail="مسیر یافت نشد")
    db.delete(r)
    db.commit()
    return {"ok": True}


# -- weekly plans ------------------------------------------------------------------
class WeeklyPlanItem(BaseModel):
    weekday: int = Field(ge=0, le=6)
    route_id: int


class WeeklyPlanIn(BaseModel):
    visitor_id: int
    items: list[WeeklyPlanItem] = Field(min_length=1)


@router.get("/weekly-plans", dependencies=[Depends(require_viewer)])
def list_weekly_plans(db: Session = Depends(get_db)):
    plans = db.execute(select(WeeklyPlan)).scalars().all()
    visitors = {v.id: v for v in db.execute(select(Visitor)).scalars()}
    routes = {r.id: r for r in db.execute(select(SalesRoute)).scalars()}
    grouped: dict[int, dict] = {}
    for p in plans:
        v = visitors.get(p.visitor_id)
        r = routes.get(p.route_id)
        if v is None or r is None:
            continue
        g = grouped.setdefault(
            p.visitor_id,
            {"visitor_id": p.visitor_id, "visitor_code": v.code, "visitor_name": v.full_name, "days": []},
        )
        g["days"].append(
            {"weekday": p.weekday, "weekday_name": WEEKDAY_NAMES[p.weekday], "route_id": p.route_id, "route_name": r.name}
        )
    for g in grouped.values():
        g["days"].sort(key=lambda d: d["weekday"])
    return sorted(grouped.values(), key=lambda g: g["visitor_id"])


@router.post("/weekly-plans", dependencies=[Depends(require_operator)], status_code=201)
def upsert_weekly_plan(payload: WeeklyPlanIn, db: Session = Depends(get_db)):
    """Replaces the plan rows for one visitor (per-weekday planning)."""
    if not db.get(Visitor, payload.visitor_id):
        raise HTTPException(status_code=404, detail="ویزیتور یافت نشد")
    for item in payload.items:
        if not db.get(SalesRoute, item.route_id):
            raise HTTPException(status_code=404, detail=f"مسیر {item.route_id} یافت نشد")
    db.execute(
        WeeklyPlan.__table__.delete().where(WeeklyPlan.visitor_id == payload.visitor_id)
    )
    for item in payload.items:
        db.add(WeeklyPlan(visitor_id=payload.visitor_id, weekday=item.weekday, route_id=item.route_id))
    db.commit()
    return {"ok": True, "visitor_id": payload.visitor_id}


@router.delete("/weekly-plans/{visitor_id}", dependencies=[Depends(require_operator)])
def delete_weekly_plan(visitor_id: int, db: Session = Depends(get_db)):
    db.execute(WeeklyPlan.__table__.delete().where(WeeklyPlan.visitor_id == visitor_id))
    db.commit()
    return {"ok": True}


# -- customers ----------------------------------------------------------------------
class CustomerIn(BaseModel):
    code: str = Field(default="", max_length=50)  # optional → auto-generated
    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    active: bool = True


class CustomerUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    active: bool | None = None


def customer_out(c: Customer) -> dict:
    return {
        "id": c.id, "code": c.code, "name": c.name,
        "phone": c.phone, "address": c.address, "active": c.active,
        "route_ids": sorted(db_route.route_id for db_route in c.routes),
    }


@router.get("/customers", dependencies=[Depends(require_viewer)])
def list_customers(db: Session = Depends(get_db)):
    rows = list(db.execute(select(Customer).order_by(Customer.id)).scalars())
    return [customer_out(c) for c in rows]


@router.post("/customers", dependencies=[Depends(require_operator)], status_code=201)
def create_customer(payload: CustomerIn, db: Session = Depends(get_db)):
    code = payload.code.strip()
    if code and db.execute(select(Customer).where(Customer.code == code)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="کد مشتری تکراری است")
    c = Customer(code=code, **payload.model_dump(exclude={"code"}))
    db.add(c)
    db.flush()
    if not code:
        c.code = f"C-{c.id}"
    db.commit()
    return customer_out(c)


@router.put("/customers/{customer_id}", dependencies=[Depends(require_operator)])
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="مشتری یافت نشد")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"] != c.code:
        if db.execute(select(Customer).where(Customer.code == data["code"])).scalar_one_or_none():
            raise HTTPException(status_code=409, detail="کد مشتری تکراری است")
    for key, value in data.items():
        setattr(c, key, value)
    db.commit()
    return customer_out(c)


@router.delete("/customers/{customer_id}", dependencies=[Depends(require_operator)])
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="مشتری یافت نشد")
    db.delete(c)
    db.commit()
    return {"ok": True}


# -- customer ↔ route / visitor links -----------------------------------------------
class CustomerRouteIn(BaseModel):
    customer_id: int
    route_id: int


class CustomerVisitorIn(BaseModel):
    customer_id: int
    visitor_id: int


@router.get("/customer-routes", dependencies=[Depends(require_viewer)])
def list_customer_routes(db: Session = Depends(get_db)):
    rows = db.execute(select(CustomerRoute)).scalars().all()
    customers = {c.id: c for c in db.execute(select(Customer)).scalars()}
    routes = {r.id: r for r in db.execute(select(SalesRoute)).scalars()}
    return [
        {
            "id": row.id, "customer_id": row.customer_id,
            "customer_name": customers[row.customer_id].name if row.customer_id in customers else "?",
            "route_id": row.route_id,
            "route_name": routes[row.route_id].name if row.route_id in routes else "?",
        }
        for row in rows
    ]


@router.post("/customer-routes", dependencies=[Depends(require_operator)], status_code=201)
def assign_customer_route(payload: CustomerRouteIn, db: Session = Depends(get_db)):
    if not db.get(Customer, payload.customer_id):
        raise HTTPException(status_code=404, detail="مشتری یافت نشد")
    if not db.get(SalesRoute, payload.route_id):
        raise HTTPException(status_code=404, detail="مسیر یافت نشد")
    exists = db.execute(
        select(CustomerRoute).where(
            CustomerRoute.customer_id == payload.customer_id,
            CustomerRoute.route_id == payload.route_id,
        )
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="این مسیر قبلاً به مشتری نسبت داده شده است")
    row = CustomerRoute(**payload.model_dump())
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}


@router.delete("/customer-routes/{row_id}", dependencies=[Depends(require_operator)])
def unassign_customer_route(row_id: int, db: Session = Depends(get_db)):
    row = db.get(CustomerRoute, row_id)
    if not row:
        raise HTTPException(status_code=404, detail="ارتباط یافت نشد")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/customer-visitors", dependencies=[Depends(require_viewer)])
def list_customer_visitors(db: Session = Depends(get_db)):
    rows = db.execute(select(CustomerVisitorLink)).scalars().all()
    customers = {c.id: c for c in db.execute(select(Customer)).scalars()}
    visitors = {v.id: v for v in db.execute(select(Visitor)).scalars()}
    return [
        {
            "id": row.id, "customer_id": row.customer_id,
            "customer_name": customers[row.customer_id].name if row.customer_id in customers else "?",
            "visitor_id": row.visitor_id,
            "visitor_name": visitors[row.visitor_id].full_name if row.visitor_id in visitors else "?",
        }
        for row in rows
    ]


@router.post("/customer-visitors", dependencies=[Depends(require_operator)], status_code=201)
def link_customer_visitor(payload: CustomerVisitorIn, db: Session = Depends(get_db)):
    if not db.get(Customer, payload.customer_id):
        raise HTTPException(status_code=404, detail="مشتری یافت نشد")
    if not db.get(Visitor, payload.visitor_id):
        raise HTTPException(status_code=404, detail="ویزیتور یافت نشد")
    exists = db.execute(
        select(CustomerVisitorLink).where(
            CustomerVisitorLink.customer_id == payload.customer_id,
            CustomerVisitorLink.visitor_id == payload.visitor_id,
        )
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="این ارتباط قبلاً ثبت شده است")
    row = CustomerVisitorLink(**payload.model_dump())
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}


@router.delete("/customer-visitors/{row_id}", dependencies=[Depends(require_operator)])
def unlink_customer_visitor(row_id: int, db: Session = Depends(get_db)):
    row = db.get(CustomerVisitorLink, row_id)
    if not row:
        raise HTTPException(status_code=404, detail="ارتباط یافت نشد")
    db.delete(row)
    db.commit()
    return {"ok": True}


# -- product groups -------------------------------------------------------------------
class GroupIn(BaseModel):
    code: str = Field(default="", max_length=50)  # optional → auto-generated
    name: str = Field(min_length=1, max_length=200)


class GroupUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)


def group_out(g: ProductGroup) -> dict:
    return {"id": g.id, "code": g.code, "name": g.name}


@router.get("/groups", dependencies=[Depends(require_viewer)])
def list_groups(db: Session = Depends(get_db)):
    rows = list(db.execute(select(ProductGroup).order_by(ProductGroup.id)).scalars())
    return [group_out(g) for g in rows]


@router.post("/groups", dependencies=[Depends(require_operator)], status_code=201)
def create_group(payload: GroupIn, db: Session = Depends(get_db)):
    code = payload.code.strip()
    if code and db.execute(select(ProductGroup).where(ProductGroup.code == code)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="کد گروه تکراری است")
    g = ProductGroup(code=code, **payload.model_dump(exclude={"code"}))
    db.add(g)
    db.flush()
    if not code:
        g.code = f"G-{g.id}"
    db.commit()
    return group_out(g)


@router.put("/groups/{group_id}", dependencies=[Depends(require_operator)])
def update_group(group_id: int, payload: GroupUpdate, db: Session = Depends(get_db)):
    g = db.get(ProductGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="گروه کالا یافت نشد")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data and data["code"] != g.code:
        if db.execute(select(ProductGroup).where(ProductGroup.code == data["code"])).scalar_one_or_none():
            raise HTTPException(status_code=409, detail="کد گروه تکراری است")
    for key, value in data.items():
        setattr(g, key, value)
    db.commit()
    return group_out(g)


@router.delete("/groups/{group_id}", dependencies=[Depends(require_operator)])
def delete_group(group_id: int, db: Session = Depends(get_db)):
    g = db.get(ProductGroup, group_id)
    if not g:
        raise HTTPException(status_code=404, detail="گروه کالا یافت نشد")
    db.delete(g)
    db.commit()
    return {"ok": True}


# -- visitor group rules ---------------------------------------------------------------
class GroupRuleIn(BaseModel):
    visitor_id: int
    route_id: int
    group_id: int


@router.get("/group-rules", dependencies=[Depends(require_viewer)])
def list_group_rules(db: Session = Depends(get_db)):
    rows = db.execute(select(VisitorGroupRule)).scalars().all()
    visitors = {v.id: v for v in db.execute(select(Visitor)).scalars()}
    routes = {r.id: r for r in db.execute(select(SalesRoute)).scalars()}
    groups = {g.id: g for g in db.execute(select(ProductGroup)).scalars()}
    return [
        {
            "id": row.id, "visitor_id": row.visitor_id,
            "visitor_name": visitors[row.visitor_id].full_name if row.visitor_id in visitors else "?",
            "route_id": row.route_id,
            "route_name": routes[row.route_id].name if row.route_id in routes else "?",
            "group_id": row.group_id,
            "group_name": groups[row.group_id].name if row.group_id in groups else "?",
        }
        for row in rows
    ]


@router.post("/group-rules", dependencies=[Depends(require_operator)], status_code=201)
def create_group_rule(payload: GroupRuleIn, db: Session = Depends(get_db)):
    if not db.get(Visitor, payload.visitor_id):
        raise HTTPException(status_code=404, detail="ویزیتور یافت نشد")
    if not db.get(SalesRoute, payload.route_id):
        raise HTTPException(status_code=404, detail="مسیر یافت نشد")
    if not db.get(ProductGroup, payload.group_id):
        raise HTTPException(status_code=404, detail="گروه کالا یافت نشد")
    exists = db.execute(
        select(VisitorGroupRule).where(
            VisitorGroupRule.visitor_id == payload.visitor_id,
            VisitorGroupRule.route_id == payload.route_id,
            VisitorGroupRule.group_id == payload.group_id,
        )
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="این قاعده قبلاً ثبت شده است")
    row = VisitorGroupRule(**payload.model_dump())
    db.add(row)
    db.commit()
    return {"ok": True, "id": row.id}


@router.delete("/group-rules/{row_id}", dependencies=[Depends(require_operator)])
def delete_group_rule(row_id: int, db: Session = Depends(get_db)):
    row = db.get(VisitorGroupRule, row_id)
    if not row:
        raise HTTPException(status_code=404, detail="قاعده یافت نشد")
    db.delete(row)
    db.commit()
    return {"ok": True}


# -- bulk import (Excel-ready) -----------------------------------------------------------
class BulkRows(BaseModel):
    rows: list[dict] = Field(min_length=1, max_length=50_000)


@router.post("/bulk/{entity}", dependencies=[Depends(require_operator)], status_code=201)
def bulk_import(entity: str, payload: BulkRows, db: Session = Depends(get_db)):
    """Bulk insert for future Excel imports: visitors|customers|groups."""
    entity_map = {
        "visitors": (Visitor, ("code", "full_name", "phone")),
        "customers": (Customer, ("code", "name", "phone", "address")),
        "groups": (ProductGroup, ("code", "name")),
    }
    if entity not in entity_map:
        raise HTTPException(status_code=404, detail="نوع نامعتبر است")
    model, fields = entity_map[entity]
    created = skipped = 0
    errors: list[str] = []
    seen: set[str] = set()
    for i, row in enumerate(payload.rows, start=1):
        code = str(row.get("code") or "").strip()
        if not code:
            errors.append(f"ردیف {i}: کد خالی است")
            skipped += 1
            continue
        if code in seen or db.execute(select(model).where(model.code == code)).scalar_one_or_none():
            skipped += 1
            continue
        seen.add(code)
        db.add(model(**{f: row.get(f) for f in fields if row.get(f) is not None}))
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


# -- weekly violation report (Jalali) ------------------------------------------------------
class ViolationQuery(BaseModel):
    week_start: str | None = Field(default=None, description="YYYY/MM/DD jalali; defaults to current week")


def _week_bounds(today: date) -> tuple[date, date]:
    """Saturday-start week containing ``today`` (0=Sat .. 6=Fri)."""
    start = today - timedelta(days=(today.weekday() + 2) % 7)
    return start, start + timedelta(days=6)


@router.post("/violations", dependencies=[Depends(require_viewer)])
def weekly_violations(payload: ViolationQuery, db: Session = Depends(get_db)):
    """Sales of a group in a route by a visitor other than the rule's owner
    (only when the group in that route is entitled to someone else)."""
    if payload.week_start:
        jd = parse_jalali_date(payload.week_start)
        if jd is None:
            raise HTTPException(status_code=422, detail="تاریخ نامعتبر است (YYYY/MM/DD)")
        start = jd
    else:
        start, _ = _week_bounds(date.today())
    end = start + timedelta(days=6)
    sales = db.execute(
        select(Sale).where(Sale.sale_date >= start, Sale.sale_date <= end)
    ).scalars().all()
    rules = db.execute(select(VisitorGroupRule)).scalars().all()
    entitled: dict[tuple[int, int], int] = {(r.route_id, r.group_id): r.visitor_id for r in rules}
    visitors = {v.id: v for v in db.execute(select(Visitor)).scalars()}
    routes = {r.id: r for r in db.execute(select(SalesRoute)).scalars()}
    groups = {g.id: g for g in db.execute(select(ProductGroup)).scalars()}

    violations = []
    for s in sales:
        owner = entitled.get((s.route_id, s.group_id))
        if owner is None or owner == s.visitor_id:
            continue
        violations.append(
            {
                "sale_id": s.id,
                "sale_date": s.sale_date.isoformat(),
                "visitor_id": s.visitor_id,
                "visitor_name": visitors[s.visitor_id].full_name if s.visitor_id in visitors else "?",
                "owner_id": owner,
                "owner_name": visitors[owner].full_name if owner in visitors else "?",
                "route_id": s.route_id,
                "route_name": routes[s.route_id].name if s.route_id in routes else "?",
                "group_id": s.group_id,
                "group_name": groups[s.group_id].name if s.group_id in groups else "?",
                "amount": float(s.amount or 0),
            }
        )
    violations.sort(key=lambda v: (v["sale_date"], v["visitor_name"]))
    return {"week_start": start.isoformat(), "week_end": end.isoformat(), "count": len(violations), "items": violations}


def parse_jalali_date(s: str) -> date | None:
    from app.services.jalali import parse_jalali

    jd = parse_jalali(s)
    return jd.togregorian() if jd else None
