import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import type { IDatabaseConnection } from '../database/connection'
import { QueryHelper, type DashboardStats } from '../database/query-helper'

export interface ReportSection {
  section: string
  total: number
  matched: number
}

export interface ReportAuditRow {
  timestamp: string
  username: string | null
  action: string
  entityType: string
  entityId: number | null
}

export interface ReportUnmatchedRow {
  dateJalali: string
  amount: number
  label: string
}

export interface ReportUnmatchedLists {
  bank: ReportUnmatchedRow[]
  accounting: ReportUnmatchedRow[]
  pos: ReportUnmatchedRow[]
  posSummary: ReportUnmatchedRow[]
}

export interface ReportData {
  generatedAt: string
  from: string | null
  to: string | null
  sections: ReportSection[]
  fees: Array<{ dateJalali: string; totalAmount: number; linkedCount: number; unlinkedCount: number; registered: boolean }>
  unmatched: ReportUnmatchedLists
  unregisteredFeeTotal: number
  auditTrail: ReportAuditRow[]
}

const UNMATCHED_LIMIT = 200

/** Builds printable reconciliation reports (PDF + Excel) from the database. */
export class ReportGenerator {
  private conn: IDatabaseConnection
  private queries: QueryHelper

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
    this.queries = new QueryHelper(conn)
  }

  /** Collects the full report dataset for an optional jalali date range. */
  generate(from?: string, to?: string): ReportData {
    const range = this.rangeParams(from, to)
    const stats = this.statsByRange(range.where, range.params)
    return {
      generatedAt: new Date().toISOString(),
      from: from ?? null,
      to: to ?? null,
      sections: this.buildSections(stats),
      fees: this.queries.listLayer2().filter(f => this.inRange(f.dateJalali, from, to)),
      unmatched: this.unmatchedLists(from, to),
      unregisteredFeeTotal: stats.unregisteredFeeTotal,
      auditTrail: this.queries.listAudit(20)
    }
  }

  /** Exports the report as an .xlsx workbook and returns the file path. */
  exportExcel(outputPath?: string): string {
    const data = this.generate()
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.sections.map(s => ({ بخش: s.section, کل: s.total, 'تطبیق‌شده': s.matched, باقی‌مانده: s.total - s.matched }))), 'خلاصه')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(this.unmatchedSheetRows(data)), 'رکوردهای تطبیق‌نشده')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.fees.map(f => ({ تاریخ: f.dateJalali, 'مبلغ کل': f.totalAmount, متصل: f.linkedCount, متصل‌نشده: f.unlinkedCount, 'ثبت‌شده': f.registered ? 'بله' : 'خیر' }))), 'کارمزدها')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.auditTrail.map(a => ({ زمان: a.timestamp, کاربر: a.username ?? '-', عملیات: a.action, موجودیت: a.entityType, شناسه: a.entityId ?? '-' }))), 'گزارش حسابرسی')
    const path = outputPath ?? join(app.getPath('userData'), `narenj-report-${Date.now()}.xlsx`)
    XLSX.writeFile(workbook, path)
    return path
  }

  /** Renders the report to PDF via a hidden window and returns the file path. */
  async exportPdf(outputPath?: string): Promise<string> {
    const data = this.generate()
    const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } })
    const rows = data.sections.map(s => `<tr><td>${s.section}</td><td>${s.total}</td><td>${s.matched}</td><td>${s.total - s.matched}</td></tr>`).join('')
    const html = `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>
      body{font-family:Tahoma,sans-serif;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #999;padding:6px;text-align:right;font-size:12px}th{background:#f0f0f0}
    </style></head><body><h1>گزارش تطبیق مالی نارنج</h1>
    <p>تاریخ تولید: ${data.generatedAt}</p><table><thead><tr><th>بخش</th><th>کل</th><th>تطبیق‌شده</th><th>باقی‌مانده</th></tr></thead><tbody>${rows}</tbody></table>
    <p>کارمزد ثبت‌نشده: ${data.unregisteredFeeTotal.toLocaleString('fa-IR')} تومان</p></body></html>`
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await win.webContents.printToPDF({ printBackground: true })
    win.close()
    const path = outputPath ?? join(app.getPath('userData'), `narenj-report-${Date.now()}.pdf`)
    writeFileSync(path, pdf)
    return path
  }

  private rangeParams(from?: string, to?: string): { where: string; params: unknown[] } {
    const parts: string[] = []
    const params: unknown[] = []
    if (from) { parts.push('date_jalali >= ?'); params.push(from) }
    if (to) { parts.push('date_jalali <= ?'); params.push(to) }
    return { where: parts.join(' AND '), params }
  }

  private inRange(date: string, from?: string, to?: string): boolean {
    if (from && date < from) return false
    if (to && date > to) return false
    return true
  }

  private statsByRange(where: string, params: unknown[]): DashboardStats {
    const dateFilter = where ? `AND ${where}` : ''
    const dateParams = where ? params : []
    const feeRows = this.rows<{ status: string; count: number }[]>(
      `SELECT status, COUNT(*) as count FROM bank_transactions WHERE tx_type = 'fee' ${dateFilter} GROUP BY status`, dateParams
    )
    const feeByStatus = new Map(feeRows.map(r => [r.status, Number(r.count)]))
    const feeMatched = feeByStatus.get('matched') ?? 0
    const feeUnmatched = feeByStatus.get('unmatched') ?? 0
    return {
      layer1: this.counts('pos_summaries', where, dateParams),
      layer2: { matched: feeMatched, pending: 0, unmatched: feeUnmatched, manual: 0, total: feeMatched + feeUnmatched },
      layer3: this.counts('bank_transactions', where ? `tx_type IN ('transfer','check','other') AND ${where}` : "tx_type IN ('transfer','check','other')", where ? dateParams : []),
      layer4: this.counts('pos_transactions', where, dateParams),
      unregisteredFeeTotal: Number((this.rows<Array<{ total: number }>>('SELECT COALESCE(SUM(total_amount), 0) as total FROM fee_aggregations WHERE registered = 0', [])[0]).total),
      dateFeeTotal: null
    }
  }

  private counts(table: string, where: string, params: unknown[]): DashboardStats['layer1'] {
    const rows = this.rows<Array<{ status: string; count: number }>>(
      `SELECT status, COUNT(*) as count FROM ${table} ${where ? `WHERE ${where}` : ''} GROUP BY status`, params
    )
    const byStatus = new Map(rows.map(r => [r.status, Number(r.count)]))
    const matched = byStatus.get('matched') ?? 0
    const pending = byStatus.get('pending') ?? 0
    const unmatched = byStatus.get('unmatched') ?? 0
    const manual = byStatus.get('manual') ?? 0
    return { matched, pending, unmatched, manual, total: matched + pending + unmatched + manual }
  }

  private rows<T>(sql: string, params: unknown[]): T {
    return this.conn.prepare(sql).all(...params) as T
  }

  private unmatchedLists(from?: string, to?: string): ReportUnmatchedLists {
    const bank = this.rows<Array<{ date_jalali: string | null; deposit_amount: number | null; withdrawal_amount: number | null; description: string | null; reference: string | null }>>(
      `SELECT date_jalali, deposit_amount, withdrawal_amount, description, reference FROM bank_transactions WHERE status = 'unmatched' ${from ? 'AND date_jalali >= ?' : ''} ${to ? 'AND date_jalali <= ?' : ''} ORDER BY date_jalali LIMIT ${UNMATCHED_LIMIT}`,
      [from, to].filter((v): v is string => Boolean(v))
    )
    const accounting = this.rows<Array<{ date_jalali: string | null; debit: number | null; credit: number | null; description: string | null; entry_id: number | null }>>(
      `SELECT date_jalali, debit, credit, description, entry_id FROM accounting_entries WHERE status = 'unmatched' ${from ? 'AND date_jalali >= ?' : ''} ${to ? 'AND date_jalali <= ?' : ''} ORDER BY date_jalali LIMIT ${UNMATCHED_LIMIT}`,
      [from, to].filter((v): v is string => Boolean(v))
    )
    const pos = this.rows<Array<{ date_jalali: string | null; amount: number; branch_name: string | null; ref_number: string | null }>>(
      `SELECT date_jalali, amount, branch_name, ref_number FROM pos_transactions WHERE status = 'unmatched' ${from ? 'AND date_jalali >= ?' : ''} ${to ? 'AND date_jalali <= ?' : ''} ORDER BY date_jalali LIMIT ${UNMATCHED_LIMIT}`,
      [from, to].filter((v): v is string => Boolean(v))
    )
    const posSummary = this.rows<Array<{ date_jalali: string | null; amount: number; branch_id: string | null; branch_name: string | null }>>(
      `SELECT date_jalali, amount, branch_id, branch_name FROM pos_summaries WHERE status = 'unmatched' ${from ? 'AND date_jalali >= ?' : ''} ${to ? 'AND date_jalali <= ?' : ''} ORDER BY date_jalali LIMIT ${UNMATCHED_LIMIT}`,
      [from, to].filter((v): v is string => Boolean(v))
    )
    return {
      bank: bank.map(r => ({ dateJalali: r.date_jalali ?? '', amount: Number(r.deposit_amount ?? 0) + Number(r.withdrawal_amount ?? 0), label: r.description || r.reference || '' })),
      accounting: accounting.map(r => ({ dateJalali: r.date_jalali ?? '', amount: Number(r.credit ?? 0) || Number(r.debit ?? 0), label: r.description || String(r.entry_id ?? '') })),
      pos: pos.map(r => ({ dateJalali: r.date_jalali ?? '', amount: Number(r.amount ?? 0), label: `${r.branch_name ?? ''} ${r.ref_number ?? ''}`.trim() })),
      posSummary: posSummary.map(r => ({ dateJalali: r.date_jalali ?? '', amount: Number(r.amount ?? 0), label: `${r.branch_id ?? ''} ${r.branch_name ?? ''}`.trim() }))
    }
  }

  private unmatchedSheetRows(data: ReportData): Array<Record<string, string | number>> {
    return [
      ...data.unmatched.bank.map(r => ({ سیستم: 'بانک', تاریخ: r.dateJalali, مبلغ: r.amount, شرح: r.label })),
      ...data.unmatched.accounting.map(r => ({ سیستم: 'حسابداری', تاریخ: r.dateJalali, مبلغ: r.amount, شرح: r.label })),
      ...data.unmatched.pos.map(r => ({ سیستم: 'پوز', تاریخ: r.dateJalali, مبلغ: r.amount, شرح: r.label })),
      ...data.unmatched.posSummary.map(r => ({ سیستم: 'خلاصه پوز', تاریخ: r.dateJalali, مبلغ: r.amount, شرح: r.label }))
    ]
  }

  private buildSections(stats: DashboardStats): ReportSection[] {
    return [
      { section: 'لایه ۱: پوز-بانک', total: stats.layer1.total, matched: stats.layer1.matched + stats.layer1.manual },
      { section: 'لایه ۲: کارمزد', total: stats.layer2.total, matched: stats.layer2.matched },
      { section: 'لایه ۳: بانک-حسابداری', total: stats.layer3.total, matched: stats.layer3.matched + stats.layer3.manual },
      { section: 'لایه ۴: ریز پوز', total: stats.layer4.total, matched: stats.layer4.matched + stats.layer4.manual }
    ]
  }
}
