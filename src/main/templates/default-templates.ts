import type { CreateTemplateInput } from '../../shared/types'
import { TemplateType } from '../../shared/types'

export const DEFAULT_TEMPLATES: CreateTemplateInput[] = [
  {
    name: 'Bank Keshavarzi',
    type: TemplateType.Bank,
    bankId: null,
    columnMapping: {
      rowNumber: 'A',
      date: 'B',
      time: 'C',
      branchCode: 'D',
      reference: 'E',
      payerPayee: 'F',
      depositRef: 'G',
      deposit: 'H',
      withdrawal: 'I',
      balance: 'J',
      misc: 'K'
    },
    cleanupRules: {
      skipTopRows: [1, 2, 3, 4, 5, 6, 8],
      skipBottomRows: 2,
      headerRow: 9
    },
    extractionRules: [
      {
        field: 'branchId',
        pattern: '^IR.*0{7,}(\\d{7,})',
        mode: 'regex'
      },
      {
        field: 'depositRefClean',
        pattern: '^IR(.+)$',
        mode: 'regex'
      }
    ]
  },
  {
    name: 'POS Summary (Behpardakht)',
    type: TemplateType.PosSummary,
    bankId: null,
    columnMapping: {
      branchId: 'A',
      branchName: 'B',
      terminalId: 'C',
      txCount: 'D',
      amount: 'E',
      date: 'F'
    },
    cleanupRules: {
      skipTopRows: [],
      skipBottomRows: 0,
      headerRow: 1
    },
    extractionRules: []
  },
  {
    name: 'POS Detail (Behpardakht)',
    type: TemplateType.PosDetail,
    bankId: null,
    columnMapping: {
      trackingCode: 'A',
      cardNumber: 'B',
      branchName: 'C',
      time: 'D',
      amount: 'E',
      status: 'F'
    },
    cleanupRules: {
      skipTopRows: [],
      skipBottomRows: 0,
      headerRow: 1
    },
    extractionRules: []
  },
  {
    name: 'Mohkam Accounting',
    type: TemplateType.Accounting,
    bankId: null,
    columnMapping: {
      entryId: 'A',
      date: 'B',
      debit: 'C',
      credit: 'D',
      description: 'E'
    },
    cleanupRules: {
      skipTopRows: [],
      skipBottomRows: 0,
      headerRow: 1
    },
    extractionRules: [
      {
        field: 'halavehRef',
        pattern: 'حواله\\s*\\((\\d+)\\)',
        mode: 'regex'
      },
      {
        field: 'cardLast4',
        pattern: 'ک\\s*(\\d{4})',
        mode: 'regex'
      },
      {
        field: 'branchName',
        pattern: 'نارنج\\s*(\\d+)',
        mode: 'regex'
      }
    ]
  }
]