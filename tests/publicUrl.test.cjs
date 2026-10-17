// Run with node --test tests/publicUrl.test.cjs; uses the project's TypeScript compiler.
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync('src/detection/publicUrl.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function reader(fetch) {
  const exports = {};
  vm.runInNewContext(code, { exports, URL, AbortController, setTimeout, clearTimeout, fetch });
  return exports;
}
const pageText = 'This public post describes how to recognize payment scams and verify a sender before sending money. '.repeat(3);
const response = (body, type = 'text/html', status = 200) => new Response(body, { status, headers: { 'content-type': type } });

test('rejects local addresses, credentials and non-web schemes', () => {
  const { normalizePublicUrl } = reader();
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'https://user:pass@example.com', 'http://localhost', 'http://192.168.1.1', 'http://2130706433', 'http://[::1]', 'https://device.local']) {
    assert.throws(() => normalizePublicUrl(url));
  }
  assert.equal(normalizePublicUrl('https://example.com/post?id=1').hostname, 'example.com');
});

test('extracts public text, removes scripts and includes the inspection scope', async () => {
  const { readPublicUrl } = reader(async (_, options) => {
    assert.equal(options.credentials, 'omit');
    return response(`<html><script>hidden instructions</script><style>.hidden {}</style><main>${pageText} &amp; &#x1F6E1;</main></html>`);
  });
  const result = await readPublicUrl('https://example.com/post');
  assert.match(result, /retrieved page text only/);
  assert.match(result, /🛡/u);
  assert.doesNotMatch(result, /hidden instructions/);
});

test('does not treat login walls, empty pages, HTTP errors or media as scanned content', async () => {
  for (const [body, type, status] of [
    ['Log in to continue ' + pageText, 'text/html', 200],
    ['<main></main>', 'text/html', 200],
    [pageText, 'text/html', 403],
    [pageText, 'video/mp4', 200],
  ]) {
    const { readPublicUrl } = reader(async () => response(body, type, status));
    await assert.rejects(readPublicUrl('https://example.com/post'));
  }
});

test('limits large responses and propagates cancellation to fetch', async () => {
  const oversized = reader(async () => response('x'.repeat(1_000_001), 'text/plain'));
  await assert.rejects(oversized.readPublicUrl('https://example.com/post'), /too large/);
  const controller = new AbortController();
  controller.abort();
  const cancelled = reader(async (_, options) => {
    assert.equal(options.signal.aborted, true);
    throw new Error('aborted');
  });
  await assert.rejects(cancelled.readPublicUrl('https://example.com/post', controller.signal), /aborted/);
});
