import type { IDatabaseConnection } from '../database/connection'
import {
  MatchStatus,
  MatchType,
  ReconciliationLayer,
  type ReconciliationLink,
  type ReconciliationResult,
  type ServiceResult
} from '../../shared/types'

interface PosTransaction {
  id: number
  refNumber: string
  cardNumberMasked: string | null
  branchName: string | null
  amount: number
  dateJalali: string | null
  status: string
}

interface AccountingEntry {
  id: number
  entryId: number
  dateJalali: string
  debit: number
  credit: number
  description: string | null
  status: string
}

export class Layer4Reconciler {
  private conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
  }

  reconcile(): ServiceResult<ReconciliationResult> {
    try {
      const posTransactions = this.getPosTransactions()
      const accountingEntries = this.getAccountingEntries()
      const links: ReconciliationLink[] = []
      const usedAccountingIds = new Set<number>()
      const matchedPosIds = new Set<number>()
      let matched = 0

      for (const entry of accountingEntries) {
        if (usedAccountingIds.has(entry.id) || !this.isAggregateDescription(entry.description ?? '')) continue

        const entryAmount = entry.debit > 0 ? entry.debit : entry.credit
        if (entryAmount <= 0) continue

        const branchFilter = this.extractAggregateBranch(entry.description ?? '')
        const candidates = posTransactions.filter(pos =>
          !matchedPosIds.has(pos.id) &&
          pos.dateJalali === entry.dateJalali &&
          (!branchFilter || this.branchNameMatches(pos.branchName ?? '', branchFilter))
        )

        const total = candidates.reduce((sum, pos) => sum + pos.amount, 0)
        if (candidates.length === 0 || Math.abs(total - entryAmount) >= 0.01) continue

        for (const pos of candidates) {
          const link = this.createLink(pos.id, entry.id, MatchType.Auto, 0.9, 'Layer 4 aggregated POS transaction match')
          links.push(link)
          matchedPosIds.add(pos.id)
          matched++
          this.persistMatch(pos.id, entry.id, link, { posTxId: pos.id, accountingId: entry.id, layer: 4, aggregated: true })
        }
        usedAccountingIds.add(entry.id)
      }

      for (const pos of posTransactions) {
        const last6 = this.extractLast6(pos.refNumber)
        const last4 = this.extractCardLast4(pos.cardNumberMasked ?? '')
        const candidates = accountingEntries.filter(entry =>
          !usedAccountingIds.has(entry.id) &&
          this.matchesDescription(entry.description ?? '', last6, last4)
        )

        if (candidates.length === 1) {
          const entry = candidates[0]
          const link = this.createLink(pos.id, entry.id, MatchType.Auto, 1, 'Layer 4 individual POS transaction match')
          links.push(link)
          usedAccountingIds.add(entry.id)
          matchedPosIds.add(pos.id)
          matched++
          this.persistMatch(pos.id, entry.id, link, { posTxId: pos.id, accountingId: entry.id, layer: 4 })
        }
      }

      return { ok: true, data: { matched, pending: 0, unmatched: posTransactions.length - matched, links } }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  private extractLast6(refNumber: string): string {
    return (refNumber.match(/\d/g) ?? []).join('').slice(-6)
  }

  private extractCardLast4(cardNumber: string): string {
    return cardNumber.replace(/\*/g, '').replace(/\D/g, '').slice(-4)
  }

  private matchesDescription(description: string, last6: string, last4: string): boolean {
    const hasHavale = last6.length >= 4 && description.includes(`حواله (${last6})`)
    const hasCard = last4.length >= 4 && description.includes(`ک ${last4}`)
    return hasHavale && hasCard
  }

  private extractAggregateReference(description: string): string | null {
    const references = [...description.matchAll(/حواله\s*\(?([0-9]{5,})\)?/g)].map(match => match[1])
    return references.length > 0 ? references[references.length - 1] : null
  }

  private isAggregateDescription(description: string): boolean {
    return /سرجمع|تجمیع|تجمیعی|جمع\s*کل/.test(description)
  }

  private extractAggregateBranch(description: string): string | null {
    const match = description.match(/سرجمع\s+(نارنج\s+\S+)/)
    return match ? match[1] : null
  }

  private branchNameMatches(branchName: string, branchFilter: string): boolean {
    return branchName.includes(branchFilter)
  }

  private getPosTransactions(): PosTransaction[] {
    return this.conn.prepare(`
      SELECT id, ref_number as refNumber, card_number_masked as cardNumberMasked,
             branch_name as branchName, amount, date_jalali as dateJalali, status
      FROM pos_transactions WHERE status = 'unmatched'
    `).all() as PosTransaction[]
  }

  private getAccountingEntries(): AccountingEntry[] {
    return this.conn.prepare(`
      SELECT id, entry_id as entryId, date_jalali as dateJalali, debit, credit,
             description, status
      FROM accounting_entries WHERE status = 'unmatched'
    `).all() as AccountingEntry[]
  }

  private createLink(posTxId: number, accountingId: number, matchType: MatchType, confidence: number, note: string): ReconciliationLink {
    return { layer: ReconciliationLayer.Layer4, posTxId, accountingId, matchType, confidence, note }
  }

  private persistMatch(posTxId: number, accountingId: number, link: ReconciliationLink, auditValue: unknown): void {
    this.conn.prepare(`
      INSERT INTO reconciliation_links (layer, pos_tx_id, accounting_id, match_type, confidence, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(link.layer, posTxId, accountingId, link.matchType, link.confidence, link.note ?? null)
    this.conn.prepare('UPDATE pos_transactions SET status = ? WHERE id = ?').run(MatchStatus.Matched, posTxId)
    this.conn.prepare('UPDATE accounting_entries SET status = ? WHERE id = ?').run(MatchStatus.Matched, accountingId)
    this.conn.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, old_value, new_value)
      VALUES (?, ?, ?, ?, ?)
    `).run('match', 'pos_transactions', posTxId, null, JSON.stringify(auditValue))
  }
}
