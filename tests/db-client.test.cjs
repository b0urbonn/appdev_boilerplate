const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');

function client(sqlite) {
  const code = ts.transpileModule(readFileSync('src/db/client.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const output = { exports: {} };
  new Function('module', 'exports', 'require', code)(output, output.exports, name => {
    assert.equal(name, 'expo-sqlite');
    return sqlite;
  });
  return output.exports;
}
function database(version = 5) {
  return {
    execAsync: async () => {},
    getFirstAsync: async () => ({ user_version: version }),
    withTransactionAsync: async run => run(),
    closeAsync: async () => {},
  };
}

test('retries a failed first open instead of caching its rejection forever', async () => {
  let opens = 0;
  const db = database();
  const { getDb } = client({ openDatabaseAsync: async () => {
    opens++;
    if (opens === 1) throw new Error('temporary database lock');
    return db;
  } });
  await assert.rejects(getDb(), /temporary database lock/);
  assert.equal(await getDb(), db);
  assert.equal(opens, 2);
  assert.equal(await getDb(), db);
  assert.equal(opens, 2);
});

test('concurrent readers share one initialization and one connection', async () => {
  let opens = 0;
  const db = database();
  const { getDb } = client({ openDatabaseAsync: async () => { opens++; return db; } });
  const first = getDb();
  const second = getDb();
  assert.equal(first, second);
  assert.deepEqual(await Promise.all([first, second]), [db, db]);
  assert.equal(opens, 1);
});

test('closes failed initialization and reruns migration inside a transaction on retry', async () => {
  let opens = 0;
  let closes = 0;
  let transactions = 0;
  let shouldFail = true;
  const db = database(4);
  db.closeAsync = async () => { closes++; };
  db.withTransactionAsync = async run => { transactions++; await run(); };
  db.execAsync = async sql => {
    if (shouldFail && /CREATE TABLE/.test(sql)) throw new Error('migration interrupted');
  };
  const { getDb } = client({ openDatabaseAsync: async () => { opens++; return db; } });
  await assert.rejects(getDb(), /migration interrupted/);
  assert.equal(closes, 1);
  shouldFail = false;
  assert.equal(await getDb(), db);
  assert.equal(opens, 2);
  assert.equal(transactions, 2);
});
