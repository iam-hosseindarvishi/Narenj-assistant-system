import type { IDatabaseConnection } from '../database/connection'

export interface BankFeeRow {
  id: number
  dateJalali: string
  depositAmount: number
  withdrawalAmount: number
  description: string
  status: string
}

export interface AccountingFeeRow {
  id: number
  dateJalali: string
  debit: number
  credit: number
  description: string
  status: string
}

export interface FeeAggregation {
  dateJalali: string
  totalAmount: number
  linkedCount: number
  unlinkedCount: number
  registered: boolean
}

export interface Layer2Result {
  matched: number
  aggregated: number
  fees: FeeAggregation[]
}

export class Layer2Reconciler {
  private conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
  }

  reconcile(): Layer2Result {
    const bankFees = this.getBankFees()
    const accountingFees = this.getAccountingFees()

    let matched = 0

    // Match bank fees with accounting fees by amount
    const usedAccountingIds = new Set<number>()

    for (const bankFee of bankFees) {
      const bankAmount = bankFee.depositAmount || bankFee.withdrawalAmount

      if (bankFee.status === 'matched') continue

      const accountingMatch = accountingFees.find(
        a => a.status === 'unmatched' && !usedAccountingIds.has(a.id) &&
          (a.debit === bankAmount || a.credit === bankAmount) &&
          a.dateJalali === bankFee.dateJalali
      )

      if (accountingMatch) {
        this.writeLink(bankFee.id, accountingMatch.id, 'auto')
        this.updateBankStatus(bankFee.id, 'matched')
        bankFee.status = 'matched'
        this.updateAccountingStatus(accountingMatch.id, 'matched')
        usedAccountingIds.add(accountingMatch.id)
        matched++
      }
    }

    // Aggregate unmatched fees by date
    const unmatchedFees = bankFees.filter(f => f.status !== 'matched')
    const aggregation = this.aggregateFees(unmatchedFees, bankFees)

    // Write fee aggregations
    this.writeAggregations(aggregation)

    return {
      matched,
      aggregated: aggregation.length,
      fees: aggregation
    }
  }

  /**
   * Marks a daily fee aggregation as registered (or not) with an audit entry.
   */
  registerFees(dateJalali: string, registered: boolean, userId: number | null = null): void {
    this.conn.prepare(
      'UPDATE fee_aggregations SET registered = ?, registered_by = ?, registered_at = ? WHERE date_jalali = ?'
    ).run(registered ? 1 : 0, registered ? userId : null, registered ? new Date().toISOString() : null, dateJalali)
    this.conn.prepare(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
       VALUES (?, ?, ?, NULL, ?)`
    ).run(userId, registered ? 'fee-register' : 'fee-unregister', 'fee_aggregations', JSON.stringify({ dateJalali, registered }))
  }

  private getBankFees(): BankFeeRow[] {
    return this.conn.prepare(
      `SELECT id, date_jalali as dateJalali, deposit_amount as depositAmount,
              withdrawal_amount as withdrawalAmount, description, status
       FROM bank_transactions
       WHERE tx_type = 'fee'
          OR (description LIKE '%واريزپايا%' AND description NOT LIKE '%شرح:%')
          OR description LIKE '%کارمزد%'
          OR description LIKE '%ثبت چک%'
          OR EXISTS (
            SELECT 1 FROM accounting_entries ae
            WHERE ae.entry_type = 'fee'
              AND ae.date_jalali = bank_transactions.date_jalali
              AND (
                (bank_transactions.deposit_amount > 0 AND ae.credit = bank_transactions.deposit_amount)
                OR (bank_transactions.withdrawal_amount > 0 AND ae.debit = bank_transactions.withdrawal_amount)
              )
          )`
    ).all() as BankFeeRow[]
  }

  private getAccountingFees(): AccountingFeeRow[] {
    return this.conn.prepare(
      `SELECT id, date_jalali as dateJalali, debit, credit, description, status
       FROM accounting_entries WHERE entry_type = 'fee'`
    ).all() as AccountingFeeRow[]
  }

  private writeLink(bankTxId: number, accountingId: number, matchType: string): void {
    this.conn.prepare(
      `INSERT INTO reconciliation_links (layer, bank_tx_id, accounting_id, match_type, confidence, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(2, bankTxId, accountingId, matchType, 1.0, 'Fee matched by amount')
  }

  private updateBankStatus(bankTxId: number, status: string): void {
    this.conn.prepare('UPDATE bank_transactions SET status = ? WHERE id = ?').run(status, bankTxId)
  }

  private updateAccountingStatus(accountingId: number, status: string): void {
    this.conn.prepare('UPDATE accounting_entries SET status = ? WHERE id = ?').run(status, accountingId)
  }

  private aggregateFees(fees: BankFeeRow[], allFees: BankFeeRow[]): FeeAggregation[] {
    const byDate = new Map<string, number>(allFees.map(fee => [fee.dateJalali, 0]))

    for (const fee of fees) {
      const amount = (fee.depositAmount ?? 0) + (fee.withdrawalAmount ?? 0)
      const current = byDate.get(fee.dateJalali) ?? 0
      byDate.set(fee.dateJalali, current + amount)
    }

    const result: FeeAggregation[] = []
    for (const [date, total] of byDate) {
      result.push({
        dateJalali: date,
        totalAmount: total,
        linkedCount: allFees.filter(f => f.dateJalali === date && f.status === 'matched').length,
        unlinkedCount: fees.filter(f => f.dateJalali === date).length,
        registered: false
      })
    }

    return result
  }

  private writeAggregations(aggregations: FeeAggregation[]): void {
    const dates = new Set(aggregations.map(aggregation => aggregation.dateJalali))
    const existingRows = this.conn.prepare('SELECT date_jalali as dateJalali FROM fee_aggregations').all() as Array<{ dateJalali: string }>
    for (const row of existingRows) {
      if (!dates.has(row.dateJalali)) {
        this.conn.prepare('UPDATE fee_aggregations SET total_amount = 0 WHERE date_jalali = ?').run(row.dateJalali)
      }
    }

    for (const agg of aggregations) {
      const existing = this.conn.prepare(
        'SELECT id FROM fee_aggregations WHERE date_jalali = ?'
      ).get(agg.dateJalali) as { id: number } | undefined

      if (!existing) {
        this.conn.prepare(
          `INSERT INTO fee_aggregations (date_jalali, total_amount, registered)
           VALUES (?, ?, ?)`
        ).run(String(agg.dateJalali), Number(agg.totalAmount), 0)
      } else {
        this.conn.prepare(
          `UPDATE fee_aggregations SET total_amount = ? WHERE date_jalali = ?`
        ).run(Number(agg.totalAmount), String(agg.dateJalali))
      }
    }
  }
}
