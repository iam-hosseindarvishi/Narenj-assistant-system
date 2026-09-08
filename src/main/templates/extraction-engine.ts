import type { ExtractionRule } from '../../shared/types'

export class ExtractionEngine {
  applyRule(value: string, rule: ExtractionRule): string | null {
    if (rule.mode === 'regex') {
      return this.applyRegex(value, rule.pattern)
    }
    if (rule.mode === 'formula') {
      return this.applyFormula(value, rule.pattern)
    }
    return null
  }

  applyAllRules(value: string, rules: ExtractionRule[]): Record<string, string | null> {
    const results: Record<string, string | null> = {}
    for (const rule of rules) {
      results[rule.field] = this.applyRule(value, rule)
    }
    return results
  }

  private applyRegex(value: string, pattern: string): string | null {
    try {
      const regex = new RegExp(pattern)
      const match = regex.exec(value)
      if (match && match[1]) {
        return match[1]
      }
      if (match) {
        return match[0]
      }
      return null
    } catch {
      return null
    }
  }

  private applyFormula(value: string, formula: string): string | null {
    if (formula === 'stripIR') {
      return value.startsWith('IR') ? value.substring(2) : value
    }
    if (formula.startsWith('substring:')) {
      const parts = formula.split(':')
      const start = parseInt(parts[1] ?? '0', 10)
      const end = parts[2] ? parseInt(parts[2], 10) : undefined
      return value.substring(start, end)
    }
    if (formula.startsWith('replace:')) {
      const parts = formula.split(':')
      const from = parts[1] ?? ''
      const to = parts[2] ?? ''
      return value.replaceAll(from, to)
    }
    return null
  }
}