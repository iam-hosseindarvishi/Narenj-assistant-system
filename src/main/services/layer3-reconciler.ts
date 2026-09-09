import type { IDatabaseConnection } from '../database/connection'
import {
  ReconciliationLayer,
  MatchType,
  MatchStatus,
  type ReconciliationResult,
  type ReconciliationLink,
  type ServiceResult
} from '../../shared/types'

interface BankTxCandidate {
  id: number
  fileId: number
  dateJalali: string
  reference: string | null
  depositRef: string | null
  depositAmount: number
  withdrawalAmount: number
  description: string | null
  txType: string
  status: string
}

interface AccountingEntryCandidate {
  id: number
  fileId: number
  entryId: number | null
  dateJalali: string
  debit: number
  credit: number
  description: string | null
  entryType: string | null
  status: string
}

export class Layer3Reconciler {
  private conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
  }

  reconcile(): ServiceResult<ReconciliationResult> {
    try {
      const bankCandidates = this.getBankCandidates()
      const accountingCandidates = this.getAccountingCandidates()

      const links: ReconciliationLink[] = []
      let matchedCount = 0
      let pendingCount = 0
      let unmatchedCount = 0

      const matchedAccountingIds = new Set<number>()

      for (const bankTx of bankCandidates) {
        const isDeposit = (bankTx.depositAmount || 0) > 0
        const bankAmount = isDeposit ? bankTx.depositAmount : bankTx.withdrawalAmount

        const sameDateAmountMatches = accountingCandidates.filter(a => {
          if (matchedAccountingIds.has(a.id)) return false
          if (a.dateJalali !== bankTx.dateJalali) return false
          const accAmount = isDeposit ? a.credit : a.debit
          return Math.abs(accAmount - bankAmount) < 0.01
        })

        if (sameDateAmountMatches.length === 0) {
          unmatchedCount++
          continue
        }

        if (sameDateAmountMatches.length === 1) {
          const accMatch = sameDateAmountMatches[0]
          matchedAccountingIds.add(accMatch.id)
          matchedCount++

          const link: ReconciliationLink = {
            layer: ReconciliationLayer.Layer3,
            bankTxId: bankTx.id,
            accountingId: accMatch.id,
            matchType: MatchType.Auto,
            confidence: 1.0,
            note: `Layer 3 1:1 match on date ${bankTx.dateJalali} and amount ${bankAmount}`
          }
          links.push(link)
          this.writeLink(link)
          this.updateBankStatus(bankTx.id, MatchStatus.Matched)
          this.updateAccountingStatus(accMatch.id, MatchStatus.Matched)
          this.writeAuditLog('match', 'bank_transactions', bankTx.id, null, {
            accountingId: accMatch.id,
            matchType: 'auto',
            layer: 3
          })
          continue
        }

        // Multiple matches: apply sub-rules
        // Sub-rule a: Filter out records with 'نارنج' in description
        const nonNarenjMatches = sameDateAmountMatches.filter(a => {
          const desc = a.description || ''
          return !desc.includes('نارنج')
        })

        let resolvedMatch: AccountingEntryCandidate | null = null
        let resolvedConfidence = 1.0
        let isSuggested = false

        // Sub-rule b: SHABA / Havale trailing digits
        for (const candidate of nonNarenjMatches) {
          const accHavale = this.extractHavaleDigits(candidate.description)
          const bankRefDigits = this.extractBankRefDigits(bankTx)

          if (accHavale && bankRefDigits) {
            const minLen = 4
            if (
              accHavale.length >= minLen &&
              bankRefDigits.length >= minLen &&
              (bankRefDigits.endsWith(accHavale) || accHavale.endsWith(bankRefDigits))
            ) {
              resolvedMatch = candidate
              resolvedConfidence = 0.85
              break
            }
          }
        }

        // Sub-rule c: Check number extraction
        if (!resolvedMatch && (bankTx.txType === 'check' || (bankTx.description && /چک|چکاوک/.test(bankTx.description)))) {
          const bankCheckNum = this.extractCheckNumber(bankTx.description)
          if (bankCheckNum) {
            for (const candidate of nonNarenjMatches) {
              const accCheckNum = this.extractCheckNumber(candidate.description)
              if (accCheckNum && (accCheckNum === bankCheckNum || accCheckNum.endsWith(bankCheckNum) || bankCheckNum.endsWith(accCheckNum))) {
                resolvedMatch = candidate
                resolvedConfidence = 0.9
                break
              }
            }
          }
        }

        // Sub-rule d: Suggestion fallback
        if (!resolvedMatch && nonNarenjMatches.length > 0) {
          resolvedMatch = nonNarenjMatches[0]
          resolvedConfidence = 0.6
          isSuggested = true
        }

        if (resolvedMatch && !isSuggested) {
          matchedAccountingIds.add(resolvedMatch.id)
          matchedCount++

          const link: ReconciliationLink = {
            layer: ReconciliationLayer.Layer3,
            bankTxId: bankTx.id,
            accountingId: resolvedMatch.id,
            matchType: MatchType.Auto,
            confidence: resolvedConfidence,
            note: `Layer 3 disambiguated match (confidence ${resolvedConfidence})`
          }
          links.push(link)
          this.writeLink(link)
          this.updateBankStatus(bankTx.id, MatchStatus.Matched)
          this.updateAccountingStatus(resolvedMatch.id, MatchStatus.Matched)
          this.writeAuditLog('match', 'bank_transactions', bankTx.id, null, {
            accountingId: resolvedMatch.id,
            matchType: 'auto',
            layer: 3,
            confidence: resolvedConfidence
          })
        } else if (resolvedMatch && isSuggested) {
          pendingCount++
          const link: ReconciliationLink = {
            layer: ReconciliationLayer.Layer3,
            bankTxId: bankTx.id,
            accountingId: resolvedMatch.id,
            matchType: MatchType.Suggested,
            confidence: resolvedConfidence,
            note: `Layer 3 suggestion for user review`
          }
          links.push(link)
          this.writeLink(link)
        } else {
          unmatchedCount++
        }
      }

      return {
        ok: true,
        data: {
          matched: matchedCount,
          pending: pendingCount,
          unmatched: unmatchedCount,
          links
        }
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  private extractHavaleDigits(description: string | null): string | null {
    if (!description) return null
    const match = description.match(/حواله\s*\(?([0-9]+)\)?/)
    return match ? match[1] : null
  }

  private extractBankRefDigits(bankTx: BankTxCandidate): string | null {
    const candidates = [bankTx.reference, bankTx.depositRef, bankTx.description]
    for (const item of candidates) {
      if (!item) continue
      const match = item.match(/([0-9]{4,})/)
      if (match) return match[1]
    }
    return null
  }

  private extractCheckNumber(description: string | null): string | null {
    if (!description) return null
    const match = description.match(/(?:چک|چکاوک|ثبت چک|شماره چک)\s*\(?([0-9]+)\)?/)
    if (match) return match[1]
    const generalDigits = description.match(/[0-9]{5,}/)
    return generalDigits ? generalDigits[0] : null
  }

  private getBankCandidates(): BankTxCandidate[] {
    return this.conn.prepare(
      `SELECT id, file_id as fileId, date_jalali as dateJalali,
              reference, deposit_ref as depositRef,
              deposit_amount as depositAmount, withdrawal_amount as withdrawalAmount,
              description, tx_type as txType, status
       FROM bank_transactions
       WHERE status = 'unmatched'
         AND tx_type IN ('transfer', 'check', 'other')
       ORDER BY date_jalali ASC`
    ).all() as BankTxCandidate[]
  }

  private getAccountingCandidates(): AccountingEntryCandidate[] {
    return this.conn.prepare(
      `SELECT id, file_id as fileId, entry_id as entryId,
              date_jalali as dateJalali, debit, credit,
              description, entry_type as entryType, status
       FROM accounting_entries
       WHERE status = 'unmatched'
       ORDER BY date_jalali ASC`
    ).all() as AccountingEntryCandidate[]
  }

  private writeLink(link: ReconciliationLink): void {
    this.conn.prepare(
      `INSERT INTO reconciliation_links
        (layer, bank_tx_id, accounting_id, match_type, confidence, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      link.layer,
      link.bankTxId ?? null,
      link.accountingId ?? null,
      link.matchType,
      link.confidence,
      link.note ?? null
    )
  }

  private updateBankStatus(id: number, status: string): void {
    this.conn.prepare('UPDATE bank_transactions SET status = ? WHERE id = ?').run(status, id)
  }

  private updateAccountingStatus(id: number, status: string): void {
    this.conn.prepare('UPDATE accounting_entries SET status = ? WHERE id = ?').run(status, id)
  }

  private writeAuditLog(
    action: string,
    entityType: string,
    entityId: number,
    oldValue: unknown,
    newValue: unknown
  ): void {
    this.conn.prepare(
      `INSERT INTO audit_logs (action, entity_type, entity_id, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      action,
      entityType,
      entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null
    )
  }
}
