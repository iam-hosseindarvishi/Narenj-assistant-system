import { TxType, MatchStatus, MatchType, ReconciliationLayer } from './types'

export const SHAPARAK_KEYWORD = 'شاپاراک'
export const FEE_KEYWORD = 'واريزپايا'
export const FEE_CHECK_KEYWORD = 'کارمزد'
export const CHECK_FEE_KEYWORD = 'ثبت چک'
export const NARENJ_KEYWORD = 'نارنج'
export const SHABA_KESHAVARZI_KEYWORD = 'شبا کشاورزی'
export const AGGREGATED_PREFIX = 'سرجمع نارنج'
export const HALAVEH_KEYWORD = 'حواله'
export const CARD_PREFIX = 'ک'
export const CHECK_KEYWORD = 'چک'
export const CHECK_DEPOSIT_KEYWORD = 'واریز به حساب چک'
export const IR_PREFIX = 'IR'

export const PENDING_TOLERANCE_DAYS = 2

export const TX_TYPE_LABELS: Record<TxType, string> = {
  [TxType.Shaparak]: 'شاپاراک',
  [TxType.Fee]: 'کارمزد',
  [TxType.Check]: 'چک',
  [TxType.Transfer]: 'انتقال',
  [TxType.Other]: 'سایر'
}

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  [MatchStatus.Unmatched]: 'تطبیق نشده',
  [MatchStatus.Pending]: 'در انتظار',
  [MatchStatus.Matched]: 'تطبیق شده',
  [MatchStatus.Manual]: 'تطبیق دستی'
}

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  [MatchType.Auto]: 'خودکار',
  [MatchType.Manual]: 'دستی',
  [MatchType.Suggested]: 'پیشنهادی'
}

export const LAYER_LABELS: Record<ReconciliationLayer, string> = {
  [ReconciliationLayer.Layer1]: 'لایه ۱: POS ↔ بانک',
  [ReconciliationLayer.Layer2]: 'لایه ۲: کارمزدها',
  [ReconciliationLayer.Layer3]: 'لایه ۳: بانک ↔ حسابداری',
  [ReconciliationLayer.Layer4]: 'لایه ۴: تراکنش POS ↔ حسابداری'
}