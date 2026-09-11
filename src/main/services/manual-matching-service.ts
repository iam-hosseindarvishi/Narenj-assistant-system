import type { IDatabaseConnection } from '../database/connection'

export interface ManualRecord {
  id: number
  system: 'bank' | 'accounting' | 'pos'
  dateJalali: string
  amount: number
  label: string
  status: string
  suggestion?: boolean
}

export interface ManualQuery {
  from?: string
  to?: string
  system?: 'bank' | 'pos'
}

export interface ManualSelection {
  system: 'bank' | 'accounting' | 'pos'
  id: number
}

export class ManualMatchingService {
  private readonly conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
  }

  list(query: ManualQuery = {}): ManualRecord[] {
    const records = [
      ...this.accounting(query),
      ...(query.system === 'pos' ? this.pos(query) : this.bank(query))
    ]
    return records.sort((a, b) => a.dateJalali.localeCompare(b.dateJalali))
  }

  link(selection: ManualSelection[], userId: number | null = null): number {
    if (selection.length < 2) throw new Error('At least two records are required')
    const ids = { bank: null as number | null, accounting: null as number | null, pos: null as number | null }
    for (const item of selection) ids[item.system] = item.id
    const layer = ids.pos !== null ? 4 : ids.bank !== null && ids.accounting !== null ? 3 : 1
    const result = this.conn.prepare(`INSERT INTO reconciliation_links
      (layer, bank_tx_id, pos_tx_id, accounting_id, match_type, confidence, created_by, note)
      VALUES (?, ?, ?, ?, 'manual', 1.0, ?, 'Manual reconciliation')`).run(
      layer, ids.bank, ids.pos, ids.accounting, userId
    )
    this.setStatuses(ids, 'manual')
    this.audit('manual-link', selection[0].id, userId, { selection })
    return Number(result.lastInsertRowid)
  }

  unlink(linkId: number, userId: number | null = null): void {
    const link = this.conn.prepare('SELECT * FROM reconciliation_links WHERE id = ?').get(linkId) as Record<string, number | null> | undefined
    if (!link) throw new Error('Link not found')
    this.conn.prepare('DELETE FROM reconciliation_links WHERE id = ?').run(linkId)
    const ids = { bank: link.bank_tx_id, accounting: link.accounting_id, pos: link.pos_tx_id }
    this.setStatuses(ids, 'unmatched')
    this.audit('manual-unlink', linkId, userId, { linkId })
  }

  private bank(query: ManualQuery): ManualRecord[] {
    const args: unknown[] = []
    const filters = ["bt.status = 'unmatched'", "bt.tx_type NOT IN ('fee')"]
    if (query.from) { filters.push('bt.date_jalali >= ?'); args.push(query.from) }
    if (query.to) { filters.push('bt.date_jalali <= ?'); args.push(query.to) }
    const rows = this.conn.prepare(`
      SELECT bt.* FROM bank_transactions bt
      WHERE ${filters.join(' AND ')}
      ORDER BY bt.date_jalali
    `).all(...args) as Array<Record<string, unknown>>
    return rows.map(row => ({ id: row.id as number, system: 'bank' as const, dateJalali: String(row.date_jalali ?? ''), amount: Number(row.deposit_amount || row.withdrawal_amount), label: String(row.description || row.reference || ''), status: String(row.status ?? 'unmatched'), suggestion: this.suggested(row.id as number, 'bank_transactions') }))
  }

  private accounting(query: ManualQuery): ManualRecord[] {
    const args: unknown[] = []
    const filters = ["ae.status = 'unmatched'"]
    if (query.from) { filters.push('ae.date_jalali >= ?'); args.push(query.from) }
    if (query.to) { filters.push('ae.date_jalali <= ?'); args.push(query.to) }
    const rows = this.conn.prepare(`
      SELECT ae.* FROM accounting_entries ae
      WHERE ${filters.join(' AND ')}
      ORDER BY ae.date_jalali
    `).all(...args) as Array<Record<string, unknown>>
    return rows.map(row => ({ id: row.id as number, system: 'accounting' as const, dateJalali: String(row.date_jalali ?? ''), amount: Number(row.credit || row.debit), label: String(row.description || String(row.entry_id ?? '')), status: String(row.status ?? 'unmatched'), suggestion: this.suggested(row.id as number, 'accounting_entries') }))
  }

  private pos(query: ManualQuery): ManualRecord[] {
    const rows = this.rows('pos_transactions', query) as Array<Record<string, any>>
    return rows.map(row => ({ id: row.id, system: 'pos', dateJalali: row.date_jalali || '', amount: row.amount, label: `${row.branch_name || ''} ${row.ref_number}`, status: row.status, suggestion: this.suggested(row.id, 'pos_transactions') }))
  }

  private rows(table: string, query: ManualQuery): unknown[] {
    const args: unknown[] = []
    const filters = ["status = 'unmatched'"]
    if (query.from) { filters.push('date_jalali >= ?'); args.push(query.from) }
    if (query.to) { filters.push('date_jalali <= ?'); args.push(query.to) }
    return this.conn.prepare(`SELECT * FROM ${table} WHERE ${filters.join(' AND ')} ORDER BY date_jalali`).all(...args)
  }

  private suggested(id: number, table: string): boolean {
    const col = table === 'bank_transactions' ? 'bank_tx_id' : table === 'accounting_entries' ? 'accounting_id' : 'pos_tx_id'
    return Boolean(this.conn.prepare(`
      SELECT 1 FROM reconciliation_links rl
      WHERE rl.match_type = 'suggested' AND rl.${col} = ?
        AND EXISTS (
          SELECT 1 FROM ${table} t WHERE t.id = rl.${col} AND t.status = 'unmatched'
        )
    `).get(id))
  }

  private setStatuses(ids: { bank: number | null; accounting: number | null; pos: number | null }, status: string): void {
    if (ids.bank !== null) this.conn.prepare('UPDATE bank_transactions SET status = ? WHERE id = ?').run(status, ids.bank)
    if (ids.accounting !== null) this.conn.prepare('UPDATE accounting_entries SET status = ? WHERE id = ?').run(status, ids.accounting)
    if (ids.pos !== null) this.conn.prepare('UPDATE pos_transactions SET status = ? WHERE id = ?').run(status, ids.pos)
  }

  private audit(action: string, entityId: number, userId: number | null, value: unknown): void {
    this.conn.prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, ?, ?, ?, ?)').run(userId, action, 'reconciliation_links', entityId, JSON.stringify(value))
  }

  /** Remove orphaned suggested links that reference deleted or already-matched records. */
  cleanupOrphanedLinks(): number {
    const result = this.conn.prepare(`
      DELETE FROM reconciliation_links
      WHERE match_type = 'suggested' AND (
        (bank_tx_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bank_transactions WHERE id = reconciliation_links.bank_tx_id))
        OR (accounting_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounting_entries WHERE id = reconciliation_links.accounting_id))
        OR (pos_tx_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pos_transactions WHERE id = reconciliation_links.pos_tx_id))
        OR (bank_tx_id IS NOT NULL AND EXISTS (SELECT 1 FROM bank_transactions WHERE id = reconciliation_links.bank_tx_id AND status != 'unmatched'))
        OR (accounting_id IS NOT NULL AND EXISTS (SELECT 1 FROM accounting_entries WHERE id = reconciliation_links.accounting_id AND status != 'unmatched'))
      )
    `).run()
    return result.changes
  }
}
