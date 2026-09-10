import type { IDatabaseConnection } from './connection'
import { jalaliAddDays, jalaliDaysBetween, todayJalali } from '../../shared/utils/jalali-date'

export interface Layer1ListRow {
  id: number
  dateJalali: string
  branchId: string
  branchName: string
  terminalId: string
  txCount: number
  posAmount: number
  bankAmount: number | null
  diff: number | null
  status: string
  matchType: string | null
  confidence: number | null
  daysWaiting: number | null
}

export interface Layer2FeeRow {
  id: number
  amount: number
  description: string
  status: string
}

export interface Layer2ListRow {
  dateJalali: string
  totalAmount: number
  linkedCount: number
  unlinkedCount: number
  registered: boolean
  registeredBy: number | null
  registeredAt: string | null
  fees: Layer2FeeRow[]
}

export interface Layer3ListRow {
  bankTxId: number
  dateJalali: string
  amount: number
  bankDescription: string
  status: string
  accountingId: number | null
  accountingEntryId: number | null
  accountingDescription: string | null
  linkId: number | null
  matchType: string | null
  confidence: number | null
}

export interface Layer4ListRow {
  posTxId: number
  refNumber: string
  cardNumberMasked: string
  branchName: string
  dateJalali: string
  amount: number
  status: string
  accountingId: number | null
  entryId: number | null
  accountingDescription: string | null
  matchType: string | null
  aggregated: boolean
}

export interface UploadedFileRow {
  id: number
  templateId: number
  originalFilename: string
  uploadDate: string
  uploadedBy: number | null
  rowCount: number | null
}

export interface StatusCounts {
  matched: number
  pending: number
  unmatched: number
  manual: number
  total: number
}

export interface DashboardStats {
  layer1: StatusCounts
  layer2: StatusCounts
  layer3: StatusCounts
  layer4: StatusCounts
  unregisteredFeeTotal: number
  dateFeeTotal: number | null
}

/** Reusable read queries for IPC listing endpoints. */
export class QueryHelper {
  private conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
  }

  /** Lists POS summaries with their linked bank deposit and settlement age. */
  listLayer1(): Layer1ListRow[] {
    const rows = this.conn.prepare(`
      SELECT ps.id, ps.date_jalali as dateJalali, ps.branch_id as branchId, ps.branch_name as branchName,
             ps.terminal_id as terminalId, ps.tx_count as txCount, ps.amount as posAmount, ps.status,
             bt.deposit_amount as bankAmount, rl.match_type as matchType, rl.confidence
      FROM pos_summaries ps
      LEFT JOIN reconciliation_links rl ON rl.pos_summary_id = ps.id AND rl.layer = 1
      LEFT JOIN bank_transactions bt ON bt.id = rl.bank_tx_id
      ORDER BY ps.date_jalali, ps.branch_id
    `).all() as Array<Record<string, unknown>>
    const latestBank = (this.conn.prepare('SELECT MAX(date_jalali) as maxDate FROM bank_transactions').get() as { maxDate: string | null }).maxDate
    return rows.map(r => {
      const bankAmount = r.bankAmount === null || r.bankAmount === undefined ? null : Number(r.bankAmount)
      return {
        id: Number(r.id),
        dateJalali: String(r.dateJalali ?? ''),
        branchId: String(r.branchId ?? ''),
        branchName: String(r.branchName ?? ''),
        terminalId: String(r.terminalId ?? ''),
        txCount: Number(r.txCount ?? 0),
        posAmount: Number(r.posAmount ?? 0),
        bankAmount,
        diff: bankAmount === null ? null : Number(r.posAmount) - bankAmount,
        status: String(r.status ?? 'unmatched'),
        matchType: r.matchType === null || r.matchType === undefined ? null : String(r.matchType),
        confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence),
        daysWaiting: r.status === 'matched' ? null : jalaliDaysBetween(jalaliAddDays(String(r.dateJalali ?? ''), 1), latestBank ?? todayJalali())
      }
    })
  }

  /** Lists daily fee aggregations with their fee rows. */
  listLayer2(): Layer2ListRow[] {
    const aggregations = this.conn.prepare(`
      SELECT date_jalali as dateJalali, total_amount as totalAmount, registered,
             registered_by as registeredBy, registered_at as registeredAt
      FROM fee_aggregations ORDER BY date_jalali
    `).all() as Array<Record<string, unknown>>
    const fees = this.conn.prepare(`
      SELECT id, date_jalali as dateJalali, deposit_amount as depositAmount,
             withdrawal_amount as withdrawalAmount, description, status
      FROM bank_transactions WHERE tx_type = 'fee' ORDER BY date_jalali, id
    `).all() as Array<Record<string, unknown>>
    const dates = new Set<string>([...aggregations.map(a => String(a.dateJalali)), ...fees.map(f => String(f.dateJalali))])
    return [...dates].sort().map(date => {
      const agg = aggregations.find(a => String(a.dateJalali) === date)
      const dayFees = fees.filter(f => String(f.dateJalali) === date).map(f => ({
        id: Number(f.id),
        amount: Number(f.depositAmount ?? 0) + Number(f.withdrawalAmount ?? 0),
        description: String(f.description ?? ''),
        status: String(f.status ?? 'unmatched')
      }))
      const fallbackTotal = dayFees.filter(f => f.status !== 'matched').reduce((sum, f) => sum + f.amount, 0)
      const registered = Boolean(agg?.registered)
      return {
        dateJalali: date,
        totalAmount: registered ? 0 : (agg ? Number(agg.totalAmount) : fallbackTotal),
        linkedCount: dayFees.filter(f => f.status === 'matched').length,
        unlinkedCount: registered ? 0 : dayFees.filter(f => f.status !== 'matched').length,
        registered,
        registeredBy: agg && agg.registeredBy !== undefined && agg.registeredBy !== null ? Number(agg.registeredBy) : null,
        registeredAt: agg && agg.registeredAt ? String(agg.registeredAt) : null,
        fees: dayFees
      }
    })
  }

  /** Lists non-POS bank transactions with their accounting link state. */
  listLayer3(): Layer3ListRow[] {
    const rows = this.conn.prepare(`
      SELECT bt.id as bankTxId, bt.date_jalali as dateJalali, bt.description as bankDescription, bt.status,
             (COALESCE(bt.deposit_amount, 0) + COALESCE(bt.withdrawal_amount, 0)) as amount,
             ae.id as accountingId, ae.entry_id as accountingEntryId, ae.description as accountingDescription,
             rl.id as linkId, rl.match_type as matchType, rl.confidence
      FROM bank_transactions bt
      LEFT JOIN reconciliation_links rl ON rl.bank_tx_id = bt.id AND rl.layer = 3
       LEFT JOIN accounting_entries ae ON ae.id = rl.accounting_id
       WHERE bt.tx_type IN ('transfer', 'check', 'other')
         AND (bt.description IS NULL OR (
           bt.description NOT LIKE '%واريزپايا%'
           AND bt.description NOT LIKE '%کارمزد%'
           AND bt.description NOT LIKE '%ثبت چک%'
         ))
         AND NOT EXISTS (
           SELECT 1 FROM accounting_entries ae
           WHERE ae.entry_type = 'fee'
             AND ae.date_jalali = bt.date_jalali
             AND (
               (bt.deposit_amount > 0 AND ae.credit = bt.deposit_amount)
               OR (bt.withdrawal_amount > 0 AND ae.debit = bt.withdrawal_amount)
             )
         )
       ORDER BY bt.date_jalali, bt.id
    `).all() as Array<Record<string, unknown>>
    return rows.map(r => ({
      bankTxId: Number(r.bankTxId),
      dateJalali: String(r.dateJalali ?? ''),
      amount: Number(r.amount ?? 0),
      bankDescription: String(r.bankDescription ?? ''),
      status: String(r.status ?? 'unmatched'),
      accountingId: r.accountingId === null || r.accountingId === undefined ? null : Number(r.accountingId),
      accountingEntryId: r.accountingEntryId === null || r.accountingEntryId === undefined ? null : Number(r.accountingEntryId),
      accountingDescription: r.accountingDescription === null || r.accountingDescription === undefined ? null : String(r.accountingDescription),
      linkId: r.linkId === null || r.linkId === undefined ? null : Number(r.linkId),
      matchType: r.matchType === null || r.matchType === undefined ? null : String(r.matchType),
      confidence: r.confidence === null || r.confidence === undefined ? null : Number(r.confidence)
    }))
  }

  /** Lists individual POS transactions with their accounting link state. */
  listLayer4(): Layer4ListRow[] {
    const rows = this.conn.prepare(`
      SELECT pt.id as posTxId, pt.ref_number as refNumber, pt.card_number_masked as cardNumberMasked,
             pt.branch_name as branchName, pt.date_jalali as dateJalali, pt.amount, pt.status,
             ae.id as accountingId, ae.entry_id as entryId, ae.description as accountingDescription,
             rl.match_type as matchType
      FROM pos_transactions pt
      LEFT JOIN reconciliation_links rl ON rl.pos_tx_id = pt.id AND rl.layer = 4
      LEFT JOIN accounting_entries ae ON ae.id = rl.accounting_id
      ORDER BY pt.date_jalali, pt.branch_name, pt.id
    `).all() as Array<Record<string, unknown>>
    return rows.map(r => ({
      posTxId: Number(r.posTxId),
      refNumber: String(r.refNumber ?? ''),
      cardNumberMasked: String(r.cardNumberMasked ?? ''),
      branchName: String(r.branchName ?? ''),
      dateJalali: String(r.dateJalali ?? ''),
      amount: Number(r.amount ?? 0),
      status: String(r.status ?? 'unmatched'),
      accountingId: r.accountingId === null || r.accountingId === undefined ? null : Number(r.accountingId),
      entryId: r.entryId === null || r.entryId === undefined ? null : Number(r.entryId),
      accountingDescription: r.accountingDescription === null || r.accountingDescription === undefined ? null : String(r.accountingDescription),
      matchType: r.matchType === null || r.matchType === undefined ? null : String(r.matchType),
      aggregated: Boolean(r.accountingDescription && String(r.accountingDescription).includes('سرجمع'))
    }))
  }

  /** Lists uploaded import history. */
  listUploadedFiles(): UploadedFileRow[] {
    return this.conn.prepare(`
      SELECT id, template_id as templateId, original_filename as originalFilename,
             upload_date as uploadDate, uploaded_by as uploadedBy, row_count as rowCount
      FROM uploaded_files ORDER BY upload_date DESC, id DESC
    `).all() as UploadedFileRow[]
  }

  /** Aggregates per-layer status counts plus fee totals, optionally scoped to one jalali date. */
  dashboardStats(dateJalali?: string): DashboardStats {
    const date = dateJalali && dateJalali.length > 0 ? dateJalali : undefined
    const range = date ? `date_jalali = '${date.replace(/'/g, '')}'` : ''
    return {
      layer1: this.counts('pos_summaries', range),
      layer2: this.feeCounts(range),
      layer3: this.counts("bank_transactions", range && `tx_type IN ('transfer','check','other') AND ${range}`),
      layer4: this.counts('pos_transactions', range),
      unregisteredFeeTotal: Number((this.conn.prepare(
        date ? 'SELECT COALESCE(SUM(total_amount), 0) as total FROM fee_aggregations WHERE registered = 0 AND date_jalali = ?' : 'SELECT COALESCE(SUM(total_amount), 0) as total FROM fee_aggregations WHERE registered = 0'
      ).get(...(date ? [date] : [])) as { total: number }).total),
      dateFeeTotal: date
        ? Number((this.conn.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM fee_aggregations WHERE date_jalali = ?').get(date) as { total: number }).total)
        : null
    }
  }

  /** Lists recent audit entries with usernames. */
  listAudit(limit = 50): Array<{ timestamp: string; username: string | null; action: string; entityType: string; entityId: number | null }> {
    return this.conn.prepare(`
      SELECT al.timestamp, u.username, al.action, al.entity_type as entityType, al.entity_id as entityId
      FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.timestamp DESC LIMIT ?
    `).all(limit) as Array<{ timestamp: string; username: string | null; action: string; entityType: string; entityId: number | null }>
  }

  private counts(table: string, extraWhere = ''): StatusCounts {
    const where = extraWhere ? `WHERE ${extraWhere}` : ''
    const rows = this.conn.prepare(
      `SELECT status, COUNT(*) as count FROM ${table} ${where} GROUP BY status`
    ).all() as Array<{ status: string; count: number }>
    const byStatus = new Map(rows.map(r => [r.status, Number(r.count)]))
    const matched = byStatus.get('matched') ?? 0
    const pending = byStatus.get('pending') ?? 0
    const unmatched = byStatus.get('unmatched') ?? 0
    const manual = byStatus.get('manual') ?? 0
    return { matched, pending, unmatched, manual, total: matched + pending + unmatched + manual }
  }

  private feeCounts(range = ''): StatusCounts {
    const where = range ? `WHERE tx_type = 'fee' AND ${range}` : "WHERE tx_type = 'fee'"
    const rows = this.conn.prepare(
      `SELECT status, COUNT(*) as count FROM bank_transactions ${where} GROUP BY status`
    ).all() as Array<{ status: string; count: number }>
    const byStatus = new Map(rows.map(r => [r.status, Number(r.count)]))
    const matched = byStatus.get('matched') ?? 0
    const unmatched = byStatus.get('unmatched') ?? 0
    const registered = Number((this.conn.prepare('SELECT COUNT(*) as count FROM fee_aggregations WHERE registered = 1').get() as { count: number }).count)
    return { matched, pending: registered, unmatched, manual: 0, total: matched + unmatched }
  }
}
