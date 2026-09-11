const Database = require('better-sqlite3');
const db = new Database('C:\\Users\\iamho\\AppData\\Roaming\\narenj-reconciliation\\narenj.db');

console.log('=== Current state ===');
const bankUnmatched = db.prepare("SELECT id, status FROM bank_transactions WHERE status='unmatched' LIMIT 5").all();
const accUnmatched = db.prepare("SELECT id, status FROM accounting_entries WHERE status='unmatched' LIMIT 5").all();
console.log('Bank unmatched:', bankUnmatched);
console.log('Acc unmatched:', accUnmatched);

if (bankUnmatched.length > 0 && accUnmatched.length > 0) {
  const bankId = bankUnmatched[0].id;
  const accId = accUnmatched[0].id;
  
  console.log(`\n=== Linking bank ${bankId} with accounting ${accId} ===`);
  
  const ins = db.prepare("INSERT INTO reconciliation_links (layer, bank_tx_id, accounting_id, match_type, confidence, note) VALUES (3, ?, ?, 'manual', 1.0, 'test')").run(bankId, accId);
  console.log('Insert result:', { lastInsertRowid: Number(ins.lastInsertRowid), changes: ins.changes });
  
  const u1 = db.prepare("UPDATE bank_transactions SET status = 'manual' WHERE id = ?").run(bankId);
  console.log('Update bank result:', { changes: u1.changes });
  
  const u2 = db.prepare("UPDATE accounting_entries SET status = 'manual' WHERE id = ?").run(accId);
  console.log('Update acc result:', { changes: u2.changes });
  
  // Verify
  const bankAfter = db.prepare("SELECT id, status FROM bank_transactions WHERE id = ?").get(bankId);
  const accAfter = db.prepare("SELECT id, status FROM accounting_entries WHERE id = ?").get(accId);
  console.log('\n=== After link ===');
  console.log('Bank:', bankAfter);
  console.log('Acc:', accAfter);
  
  // Undo
  db.prepare("DELETE FROM reconciliation_links WHERE id = ?").run(Number(ins.lastInsertRowid));
  db.prepare("UPDATE bank_transactions SET status = 'unmatched' WHERE id = ?").run(bankId);
  db.prepare("UPDATE accounting_entries SET status = 'unmatched' WHERE id = ?").run(accId);
  console.log('\nCleanup done');
}

db.close();
