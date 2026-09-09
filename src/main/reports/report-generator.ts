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

export interface ReportData {
  generatedAt: string
  sections: ReportSection[]
  fees: Array<{ dateJalali: string; totalAmount: number; registered: boolean }>
  unmatched: { bank: number; accounting: number; pos: number; posSummary: number }
  unregisteredFeeTotal: number
  auditTrail: ReportAuditRow[]
}

/** Builds printable reconciliation reports (PDF + Excel) from the database. */
export class ReportGenerator {
  private queries: QueryHelper

  constructor(conn: IDatabaseConnection) {
    this.queries = new QueryHelper(conn)
  }

  /** Collects the full report dataset. */
  generate(): ReportData {
    const stats = this.queries.dashboardStats()
    const fees = this.queries.listLayer2().map(f => ({ dateJalali: f.dateJalali, totalAmount: f.totalAmount, registered: f.registered }))
    return {
      generatedAt: new Date().toISOString(),
      sections: this.buildSections(stats),
      fees,
      unmatched: {
        bank: stats.layer3.unmatched,
        accounting: stats.layer3.unmatched,
        pos: stats.layer4.unmatched,
        posSummary: stats.layer1.unmatched
      },
      unregisteredFeeTotal: stats.unregisteredFeeTotal,
      auditTrail: this.queries.listAudit()
    }
  }

  /** Exports the report as an .xlsx workbook and returns the file path. */
  exportExcel(outputPath?: string): string {
    const data = this.generate()
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.sections.map(s => ({ بخش: s.section, کل: s.total, 'تطبیق‌شده': s.matched, باقی‌مانده: s.total - s.matched }))), 'خلاصه')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.fees.map(f => ({ تاریخ: f.dateJalali, 'مبلغ کل': f.totalAmount, 'ثبت‌شده': f.registered ? 'بله' : 'خیر' }))), 'کارمزدها')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.auditTrail.map(a => ({ زمان: a.timestamp, کاربر: a.username ?? '-', عملیات: a.action, موجودیت: a.entityType, شناسه: a.entityId ?? '-' }))), 'حسابرسی')
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

  private buildSections(stats: DashboardStats): ReportSection[] {
    return [
      { section: 'لایه ۱: پوز-بانک', total: stats.layer1.total, matched: stats.layer1.matched + stats.layer1.manual },
      { section: 'لایه ۲: کارمزد', total: stats.layer2.total, matched: stats.layer2.matched },
      { section: 'لایه ۳: بانک-حسابداری', total: stats.layer3.total, matched: stats.layer3.matched + stats.layer3.manual },
      { section: 'لایه ۴: ریز پوز', total: stats.layer4.total, matched: stats.layer4.matched + stats.layer4.manual }
    ]
  }
}
