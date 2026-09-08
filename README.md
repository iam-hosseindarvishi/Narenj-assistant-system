# Narenj Financial Reconciliation System

A desktop application for reconciling POS transactions, bank statements, and accounting records.

## Getting started

```bash
# 1. Run the setup script (one-time)
bash setup.sh

# 2. Copy tasks/master-prompt.md into OpenCode as your first message
#    Model: Kimi K2.5 (recommended for 1M context + strong code generation)
#    OR: GLM 5.2 (strong for multi-step TypeScript projects)
```

## Project structure

```
.
├── exelcs inputs/       # Test fixtures (git-ignored)
│   ├── Bank.xls
│   ├── pos_summarize.xlsx
│   ├── pos_transactions.xlsx
│   └── System.xls
├── tasks/
│   ├── master-task.md      # Full spec (the "brain" of the project)
│   ├── master-prompt.md    # Copy-paste prompt for OpenCode
│   ├── ai-rules.md         # Environment rules + conventions
│   ├── sub-tasks.json      # Task queue (pending/done tracking)
│   └── sub-tasks/          # Individual task files
│       ├── 01-project-init.json
│       ├── ...
│       └── 12-final-qa-package.json
├── src/                   # Source code (created by the agent)
├── .gitignore
└── setup.sh
```

## Tasks (12 steps)

1. Initialize Electron + Vue 3 project
2. SQLite database schema
3. Template engine (simple + advanced)
4. File upload + Excel parsing
5. Layer 1: POS summary ↔ Bank
6. Layer 2: Fee collection
7. Layer 3: Non-POS bank ↔ Accounting
8. Layer 4: POS detail ↔ Accounting
9. Manual reconciliation window
10. Multi-user auth + audit
11. Dashboard + reports
12. Final QA + packaging

## License

TBD — planned for open-source release.
