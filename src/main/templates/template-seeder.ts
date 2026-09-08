import type { IDatabaseConnection } from '../database/connection'
import { TemplateRepository } from './template-repository'
import { DEFAULT_TEMPLATES } from './default-templates'

export class TemplateSeeder {
  private repo: TemplateRepository

  constructor(conn: IDatabaseConnection) {
    this.repo = new TemplateRepository(conn)
  }

  seedDefaults(): number {
    const existing = this.repo.getAll()
    let count = 0

    for (const tpl of DEFAULT_TEMPLATES) {
      const alreadyExists = existing.some(e => e.name === tpl.name && e.type === tpl.type)
      if (!alreadyExists) {
        this.repo.create(tpl)
        count++
      }
    }

    return count
  }
}