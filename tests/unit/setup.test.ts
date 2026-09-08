import { describe, it, expect } from 'vitest'
import { TxType, MatchStatus, MatchType, ReconciliationLayer } from '../../src/shared/types'

describe('project setup', () => {
  it('should run vitest', () => {
    expect(true).toBe(true)
  })

  it('should export enums from shared types', () => {
    expect(TxType.Shaparak).toBe('shaparak')
    expect(MatchStatus.Unmatched).toBe('unmatched')
    expect(MatchType.Auto).toBe('auto')
    expect(ReconciliationLayer.Layer1).toBe(1)
  })
})