"""Domain constants ported from the Electron app (single source of truth)."""
SHAPARAK_KEYWORD = "شاپاراک"
FEE_KEYWORD = "واريزپايا"
FEE_CHECK_KEYWORD = "کارمزد"
CHECK_FEE_KEYWORD = "ثبت چک"
NARENJ_KEYWORD = "نارنج"
SHABA_KESHAVARZI_KEYWORD = "شبا کشاورزی"
AGGREGATED_PREFIX = "سرجمع نارنج"
HAVALE_KEYWORD = "حواله"
CARD_PREFIX = "ک"
CHECK_KEYWORD = "چک"
CHECK_DEPOSIT_KEYWORD = "واریز به حساب چک"
IR_PREFIX = "IR"

PENDING_TOLERANCE_DAYS = 2

STATUS_UNMATCHED = "unmatched"
STATUS_PENDING = "pending"
STATUS_MATCHED = "matched"
STATUS_MANUAL = "manual"

MATCH_AUTO = "auto"
MATCH_MANUAL = "manual"
MATCH_SUGGESTED = "suggested"

TX_TYPES = ("shaparak", "fee", "check", "transfer", "other")
ENTRY_TYPES = ("receipt", "payment", "fee", "check", "other")
LAYERS = (1, 2, 3, 4)

STATUS_LABELS = {
    "unmatched": "تطبیق نشده",
    "pending": "در انتظار",
    "matched": "تطبیق شده",
    "manual": "تطبیق دستی",
}

MATCH_TYPE_LABELS = {"auto": "خودکار", "manual": "دستی", "suggested": "پیشنهادی"}

LAYER_LABELS = {
    1: "لایه ۱: POS ↔ بانک",
    2: "لایه ۲: کارمزدها",
    3: "لایه ۳: بانک ↔ حسابداری",
    4: "لایه ۴: تراکنش POS ↔ حسابداری",
}
