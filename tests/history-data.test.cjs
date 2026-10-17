const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');

function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const output = { exports: {} };
  new Function('module', 'exports', 'require', code)(output, output.exports, name => {
    if (!(name in dependencies)) throw new Error(`Unexpected runtime dependency: ${name}`);
    return dependencies[name];
  });
  return output.exports;
}
const data = load('src/history/data.ts');
const today = new Date(2026, 10, 3).getTime();

test('uses local calendar midnights and closes previous weeks without overlap', () => {
  const starts = data.historyWeekStarts(today);
  assert.equal(starts.length, 8);
  assert.equal(new Date(starts[0]).getDate(), 28);
  assert.equal(new Date(starts[0]).getMonth(), 9);
  for (const start of starts) assert.equal(new Date(start).getHours(), 0);
  const previous = data.historyWeekStarts(today, -1);
  assert.equal(previous[7], starts[0]);
  assert.equal(starts[6], today);
});

test('merges alert and scan records newest first with stable distinct keys', () => {
  const starts = data.historyWeekStarts(today);
  const alerts = [{ id: 'same', createdAt: starts[2] + 2000 }];
  const scans = [{ id: 'same', createdAt: starts[2] + 3000 }];
  const days = data.buildHistoryDays(starts, alerts, scans, [0, 0, 123 * 60000]);
  assert.deepEqual(days[2].items.map(item => item.key), ['s-same', 'a-same']);
  assert.equal(days[2].alerts, 1);
  assert.equal(days[2].scans, 1);
  assert.equal(days[2].screenMinutes, 123);
  assert.equal(days[0].screenMinutes, 0);
});

test('assigns midnight exactly once and excludes out-of-week records', () => {
  const starts = data.historyWeekStarts(today);
  const alerts = [
    { id: 'before', createdAt: starts[0] - 1 },
    { id: 'midnight', createdAt: starts[1] },
    { id: 'after', createdAt: starts[7] },
  ];
  const days = data.buildHistoryDays(starts, alerts, [], null);
  assert.equal(days[0].alerts, 0);
  assert.equal(days[1].alerts, 1);
  assert.equal(days.reduce((total, day) => total + day.alerts, 0), 1);
  assert.ok(days.every(day => day.screenMinutes === null));
});

test('overall history keeps records outside the visible week and filters without changing totals', () => {
  const alerts = [{ id: 'old-alert', createdAt: today - 90 * 86400000 }];
  const scans = [{ id: 'new-scan', createdAt: today + 60000 }];
  const all = data.mergeHistoryItems(alerts, scans);
  assert.deepEqual(all.map(item => item.key), ['s-new-scan', 'a-old-alert']);
  assert.equal(data.filterHistory(all, 'all').length, 2);
  assert.equal(data.filterHistory(all, 'scans').length, 1);
  assert.equal(data.filterHistory(all, 'alerts').length, 1);
  assert.equal(all.length, 2);
});

test('custom date selection uses calendar boundaries across daylight saving changes', () => {
  const day = new Date(2026, 10, 1).getTime();
  const next = data.nextLocalDay(day);
  assert.equal(new Date(next).getDate(), 2);
  assert.equal(new Date(next).getHours(), 0);
  const all = data.mergeHistoryItems([
    { id: 'start', createdAt: day },
    { id: 'end', createdAt: next - 1 },
    { id: 'next-day', createdAt: next },
  ], []);
  assert.deepEqual(data.historyForDay(all, day).map(item => item.key), ['a-end', 'a-start']);
  assert.equal(data.nextLocalDay(next, -1), day);
});

test('calculateHistoryStreak calculates streak based only on daily alerts and scans', () => {
  const baseDay = new Date(2026, 9, 20).getTime();
  const day1 = data.localDayStart(baseDay);
  const day2 = data.nextLocalDay(day1, 1);
  const day3 = data.nextLocalDay(day2, 1);
  const day4 = data.nextLocalDay(day3, 1);

  // 1. Empty -> streak 0
  const empty = data.calculateHistoryStreak([], [], day4);
  assert.equal(empty.streak, 0);
  assert.equal(empty.activeToday, false);
  assert.equal(empty.todayCount, 0);

  // 2. Active today only -> streak 1
  const todayOnly = data.calculateHistoryStreak(
    [{ id: 'a1', createdAt: day4 + 5000 }],
    [],
    day4
  );
  assert.equal(todayOnly.streak, 1);
  assert.equal(todayOnly.activeToday, true);
  assert.equal(todayOnly.todayCount, 1);
  assert.equal(todayOnly.todayAlerts, 1);

  // 3. Active yesterday (day3) but not today (day4) -> streak 1 maintained
  const yesterdayOnly = data.calculateHistoryStreak(
    [],
    [{ id: 's1', createdAt: day3 + 5000 }],
    day4
  );
  assert.equal(yesterdayOnly.streak, 1);
  assert.equal(yesterdayOnly.activeToday, false);
  assert.equal(yesterdayOnly.todayCount, 0);

  // 4. Consecutive activity across day1, day2, day3, day4 -> streak 4
  const fourDays = data.calculateHistoryStreak(
    [
      { id: 'a1', createdAt: day1 + 1000 },
      { id: 'a3', createdAt: day3 + 1000 },
    ],
    [
      { id: 's2', createdAt: day2 + 1000 },
      { id: 's4', createdAt: day4 + 1000 },
    ],
    day4
  );
  assert.equal(fourDays.streak, 4);
  assert.equal(fourDays.activeToday, true);
  assert.equal(fourDays.todayCount, 1);

  // 5. Gap: day1 active, day2 empty, day3 active, day4 active -> streak 2
  const withGap = data.calculateHistoryStreak(
    [{ id: 'a1', createdAt: day1 + 1000 }],
    [
      { id: 's3', createdAt: day3 + 1000 },
      { id: 's4', createdAt: day4 + 1000 },
    ],
    day4
  );
  assert.equal(withGap.streak, 2);

  // 6. Streak can increase well above 7 days (e.g. 30 days, 100+ days)
  const thirtyScans = Array.from({ length: 30 }, (_, i) => ({
    id: `scan-${i}`,
    createdAt: data.nextLocalDay(day4, -i) + 12000,
  }));
  const thirtyDayStreak = data.calculateHistoryStreak([], thirtyScans, day4);
  assert.equal(thirtyDayStreak.streak, 30);
});
