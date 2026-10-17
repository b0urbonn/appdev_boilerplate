const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAvatar } = require('@dicebear/core');
const micah = require('@dicebear/micah');

const PASTEL_BACKGROUNDS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'];

function generateMicahSvg(seed) {
  const cacheKey = seed || 'felix';
  const avatar = createAvatar(micah, {
    seed: cacheKey,
    backgroundColor: PASTEL_BACKGROUNDS,
  });

  return avatar
    .toString()
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/style="mix-blend-mode:multiply"/gi, 'opacity="0.18"')
    .replace(/<svg\b([^>]*)>/i, '<svg$1 width="100%" height="100%">');
}

test('generateMicahSvg produces clean SVG without metadata tags', () => {
  const svg = generateMicahSvg('Felix');
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.endsWith('</svg>'));
  assert.equal(svg.includes('<metadata'), false);
  assert.equal(svg.includes('mix-blend-mode'), false);
  assert.ok(svg.includes('viewBox="0 0 360 360"'));
});

test('generateMicahSvg is deterministic for a given seed', () => {
  const svg1 = generateMicahSvg('Luna');
  const svg2 = generateMicahSvg('Luna');
  assert.equal(svg1, svg2);

  const svgDifferent = generateMicahSvg('Oliver');
  assert.notEqual(svg1, svgDifferent);
});

test('generateMicahSvg handles multiple seeds cleanly', () => {
  const seeds = ['kai', 'felix', 'aneka', 'oliver', 'luna', 'milo', 'maya', 'leo'];
  for (const seed of seeds) {
    const svg = generateMicahSvg(seed);
    assert.ok(svg.length > 500);
    assert.ok(svg.includes('viewboxMask'));
  }
});
