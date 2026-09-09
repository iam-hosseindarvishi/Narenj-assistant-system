import type { IDatabaseConnection } from '../database/connection'
import { jalaliAddDays } from '../../shared/utils/jalali-date'

export interface PosSummaryRow {
  id: number
  branchId: string
  branchName: string
  terminalId: string
  amount: number
  dateJalali: string
}

export interface BankShaparakRow {
  id: number
  branchCode: string
  depositAmount: number
  dateJalali: string
  depositRef: string
  description: string
}

export interface Layer1Match {
  posSummaryId: number
  bankTxId: number
  amount: number
  matchType: 'auto' | 'manual' | 'suggested'
  confidence: number
  matchedBy: string
  note: string
}

export interface Layer1Result {
  matched: number
  pending: number
  unmatched: number
  matches: Layer1Match[]
}

export class Layer1Reconciler {
  private conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
  }

  reconcile(): Layer1Result {
    const unmatchedSummaries = this.getUnmatchedPosSummaries()
    const unmatchedBanks = this.getUnmatchedShaparakBankTxs()

    const matches: Layer1Match[] = []
    const usedBankIds = new Set<number>()
    const usedSummaryIds = new Set<number>()

    // Group POS summaries by date
    const summariesByDate = new Map<string, PosSummaryRow[]>()
    for (const summary of unmatchedSummaries) {
      const group = summariesByDate.get(summary.dateJalali) ?? []
      group.push(summary)
      summariesByDate.set(summary.dateJalali, group)
    }

    // For each POS date, find matching bank deposits on D+1
    for (const [posDate, summaries] of summariesByDate) {
      const nextDay = jalaliAddDays(posDate, 1)
      const availableBanks = unmatchedBanks.filter(
        b => !usedBankIds.has(b.id) && b.dateJalali === nextDay
      )

      // 1:1 matching by amount
      for (const summary of summaries) {
        if (usedSummaryIds.has(summary.id)) continue

        const bankMatch = availableBanks.find(
          b => b.depositAmount === summary.amount
        )

        if (bankMatch) {
          matches.push({
            posSummaryId: summary.id,
            bankTxId: bankMatch.id,
            amount: summary.amount,
            matchType: 'auto',
            confidence: 1.0,
            matchedBy: 'system',
            note: `1:1 match: POS ${summary.branchId} @ ${posDate} amount=${summary.amount} == Bank @ ${nextDay}`
          })
          usedBankIds.add(bankMatch.id)
          usedSummaryIds.add(summary.id)
        }
      }

      // Aggregated matching: sum of remaining POS = single bank deposit
      const remainingSummaries = summaries.filter(s => !usedSummaryIds.has(s.id))
      if (remainingSummaries.length >= 2) {
        const totalPosAmount = remainingSummaries.reduce((sum, s) => sum + s.amount, 0)
        const bankMatch = availableBanks.find(
          b => !usedBankIds.has(b.id) && b.depositAmount === totalPosAmount
        )

        if (bankMatch) {
          for (const summary of remainingSummaries) {
            matches.push({
              posSummaryId: summary.id,
              bankTxId: bankMatch.id,
              amount: summary.amount,
              matchType: 'auto',
              confidence: 0.9,
              matchedBy: 'system',
              note: `Aggregated match: POS ${summary.branchId} @ ${posDate} part of sum ${totalPosAmount} == Bank @ ${nextDay}`
            })
            usedSummaryIds.add(summary.id)
          }
          usedBankIds.add(bankMatch.id)
        }
      }
    }

    this.writeMatches(matches)

    const matchedCount = matches.length
    const remainingSummaries = unmatchedSummaries.length - usedSummaryIds.size
    const remainingBanks = unmatchedBanks.length - usedBankIds.size

    return {
      matched: matchedCount,
      pending: remainingSummaries,
      unmatched: remainingBanks,
      matches
    }
  }

  private getUnmatchedPosSummaries(): PosSummaryRow[] {
    return this.conn.prepare(
      'SELECT id, branch_id as branchId, branch_name as branchName, terminal_id as terminalId, amount, date_jalali as dateJalali FROM pos_summaries WHERE status = ?'
    ).all('unmatched') as PosSummaryRow[]
  }

  private getUnmatchedShaparakBankTxs(): BankShaparakRow[] {
    return this.conn.prepare(
      'SELECT id, branch_code as branchCode, deposit_amount as depositAmount, date_jalali as dateJalali, deposit_ref as depositRef, description FROM bank_transactions WHERE status = ? AND tx_type = ?'
    ).all('unmatched', 'shaparak') as BankShaparakRow[]
  }

  private writeMatches(matches: Layer1Match[]): void {
    const linkStmt = this.conn.prepare(
      `INSERT INTO reconciliation_links (layer, bank_tx_id, pos_summary_id, match_type, confidence, created_by, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )

    const updateSummaryStmt = this.conn.prepare(
      'UPDATE pos_summaries SET status = ? WHERE id = ?'
    )

    const updateBankStmt = this.conn.prepare(
      'UPDATE bank_transactions SET status = ? WHERE id = ?'
    )

    this.conn.transaction(() => {
      for (const match of matches) {
        linkStmt.run(1, match.bankTxId, match.posSummaryId, match.matchType, match.confidence, null, match.note)
        updateSummaryStmt.run('matched', match.posSummaryId)
        updateBankStmt.run('matched', match.bankTxId)
      }
    })
  }
}