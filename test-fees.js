const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

// Create a test database
const db = new Database(':memory:');

// Run the migrations
const migrationsDir = path.join(__dirname, 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  db.exec(sql);
}

// Import the Excel file directly using the adapter
const wb = xlsx.readFile(path.join('exelcs inputs', 'Bank.xls'));
const ws = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

// Parse the data
const rows = data.slice(8); // Skip header rows
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length < 12) continue;
  
  const date = String(row[11] || '').trim();
  const description = String(row[1] || '').trim();
  const deposit = Number(row[7]) || 0;
  const withdrawal = Number(row[8]) || 0;
  
  if (!date) continue;
  
  // Determine transaction type
  let txType = 'other';
  if ((description.includes('واريزپايا') && description.includes('مرکزشاپرک')) || 
      description.includes('شاپارک')) {
    txType = 'shaparak';
  } else if ((description.includes('واريزپايا') && !description.includes('مرکزشاپرک')) || 
             description.includes('کارمزد') || 
             description.includes('ثبت چک')) {
    txType = 'fee';
  } else if (description.includes('چک')) {
    txType = 'check';
  } else if (description.includes('انتقال')) {
    txType = 'transfer';
  }
  
  // Insert into database
  db.prepare('INSERT INTO bank_transactions (file_id, date_jalali, description, deposit_amount, withdrawal_amount, tx_type) VALUES (?, ?, ?, ?, ?, ?)').run(1, date, description, deposit, withdrawal, txType);
}

// Check what's marked as fee
const fees = db.prepare('SELECT date_jalali, deposit_amount, withdrawal_amount, description FROM bank_transactions WHERE tx_type = \'fee\'').all();
console.log('Fee transactions:');
const dailyFees = {};
for (const fee of fees) {
  const amount = fee.withdrawal_amount; // Only withdrawal for fees
  if (!dailyFees[fee.date_jalali]) {
    dailyFees[fee.date_jalali] = 0;
  }
  dailyFees[fee.date_jalali] += amount;
  console.log(fee.date_jalali + ': ' + amount + ' (deposit: ' + fee.deposit_amount + ', withdrawal: ' + fee.withdrawal_amount + ')');
}

console.log('\nDaily fee totals:');
for (const [date, total] of Object.entries(dailyFees)) {
  console.log(date + ': ' + total);
}

db.close();