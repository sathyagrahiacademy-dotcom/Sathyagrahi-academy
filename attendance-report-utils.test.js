const assert = require('assert');
const u = require('./attendance-report-utils.js');

assert.strictEqual(u.pdfStatusCode('present'), 'P');
assert.strictEqual(u.pdfStatusCode('absent'), 'A');
assert.strictEqual(u.pdfStatusCode('leave'), 'L');
assert.strictEqual(u.pdfStatusCode('weekly_off'), 'S');
assert.strictEqual(u.pdfStatusCode('holiday'), 'H');
assert.strictEqual(u.pdfStatusCode('unmarked'), '—');
assert.strictEqual(u.pdfStatusCode('future'), '—');

console.log('attendance-report-utils PDF status tests passed');
