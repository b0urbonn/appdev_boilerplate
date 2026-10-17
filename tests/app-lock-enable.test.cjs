const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');

function load(path, dependencies) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  const output = { exports: {} };
  new Function('module', 'exports', 'require', code)(output, output.exports, name => dependencies[name] ?? {});
  return output.exports;
}

const tick = () => new Promise(resolve => setImmediate(resolve));

function screen({ result = { success: true }, level = 1, platform = 'android', enabled = false } = {}) {
  const writes = [];
  const prompts = [];
  const messages = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: value => [value, () => {}],
    useRef: current => ({ current }),
  };
  const { default: SettingsScreen } = load('src/app/settings.tsx', {
    react,
    'react-native': { Platform: { OS: platform }, StyleSheet: { create: styles => styles }, Switch: 'Switch' },
    'expo-router': { useRouter: () => ({}) },
    'expo-constants': {},
    '@/theme': { useTheme: () => ({}) },
    '@/components/AnimatedSwitch': { AnimatedSwitch: 'Switch' },
    '@/settings/SettingsContext': { useSettings: () => ({
      settings: { theme: 'light', appLockEnabled: enabled },
      update: async (...args) => { writes.push(args); },
    }) },
    '@/security/deviceAuthentication': {
      getDeviceSecurityLevel: async () => level,
      authenticateWithDevice: async purpose => { prompts.push(purpose); return result; },
    },
    '@/utils/confirm': { showMessage: (...args) => messages.push(args) },
  });
  function findSwitch(node) {
    if (!node || typeof node !== 'object') return undefined;
    if (node.type === 'Switch') return node;
    return (node.children ?? []).flat(Infinity).map(findSwitch).find(Boolean);
  }
  const toggle = findSwitch(SettingsScreen());
  assert.ok(toggle);
  return { toggle, writes, prompts, messages };
}

test('enabling waits for successful device authentication before writing the setting', async () => {
  let finish;
  const result = new Promise(resolve => { finish = resolve; });
  const state = screen({ result });
  state.toggle.props.onValueChange(true);
  await tick();
  assert.deepEqual(state.prompts, ['enable']);
  assert.deepEqual(state.writes, []);
  finish({ success: true });
  await tick();
  assert.deepEqual(state.writes, [['appLockEnabled', true]]);
});

for (const error of ['user_cancel', 'system_cancel', 'app_cancel', 'lockout', 'authentication_failed']) {
  test(`${error} leaves app lock off`, async () => {
    const state = screen({ result: { success: false, error } });
    state.toggle.props.onValueChange(true);
    await tick();
    assert.deepEqual(state.writes, []);
  });
}

test('a phone without an enrolled screen lock cannot enable app lock', async () => {
  const state = screen({ level: 0 });
  state.toggle.props.onValueChange(true);
  await tick();
  assert.deepEqual(state.prompts, []);
  assert.deepEqual(state.writes, []);
  assert.equal(state.messages[0][0], 'Screen lock required');
});

test('rapid repeated taps share one authentication attempt', async () => {
  let finish;
  const result = new Promise(resolve => { finish = resolve; });
  const state = screen({ result });
  state.toggle.props.onValueChange(true);
  state.toggle.props.onValueChange(true);
  await tick();
  assert.deepEqual(state.prompts, ['enable']);
  finish({ success: true });
  await tick();
  assert.deepEqual(state.writes, [['appLockEnabled', true]]);
});

test('the web preview does not attempt native authentication', async () => {
  const state = screen({ platform: 'web' });
  assert.equal(state.toggle.props.disabled, true);
  state.toggle.props.onValueChange(true);
  await tick();
  assert.deepEqual(state.prompts, []);
  assert.deepEqual(state.writes, []);
});

test('the enable prompt allows device credentials and requests biometric confirmation', async () => {
  const prompts = [];
  const { authenticateWithDevice } = load('src/security/deviceAuthentication.ts', {
    expo: { requireOptionalNativeModule: () => ({}) },
    'expo-local-authentication': { authenticateAsync: async options => { prompts.push(options); return { success: true }; } },
  });
  await authenticateWithDevice('enable');
  assert.equal(prompts[0].promptMessage, 'Enable Maalam app lock');
  assert.equal(prompts[0].disableDeviceFallback, false);
  assert.equal(prompts[0].requireConfirmation, true);
  await authenticateWithDevice();
  assert.equal(prompts[1].promptMessage, 'Unlock Maalam');
});

function animatedSwitch(props) {
  let position;
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useEffect: effect => effect(),
  };
  const { AnimatedSwitch } = load('src/components/AnimatedSwitch.tsx', {
    react,
    'react-native': { StyleSheet: { create: styles => styles } },
    'react-native-reanimated': {
      default: { View: 'AnimatedView' },
      useSharedValue: value => (position = { value, get() { return this.value; }, set(next) { this.value = next; } }),
      useAnimatedStyle: style => style(),
      withSpring: value => value,
      interpolateColor: (_value, _range, colors) => colors[0],
    },
    '@/motion': { SPRING: {} },
    '@/theme': { useTheme: () => ({ border: '#888888', buttonPrimary: '#0066CC' }) },
    './AccessibilityPreferences': { useReduceMotion: () => false },
    './SmoothPressable': { SmoothPressable: 'Pressable' },
  });
  return { element: AnimatedSwitch(props), position };
}

test('animated switch waits for the controlled value before moving its thumb', () => {
  const changes = [];
  const { element, position } = animatedSwitch({ value: false, onValueChange: value => changes.push(value) });
  element.props.onPress();
  assert.deepEqual(changes, [true]);
  assert.equal(position.get(), 0);
  assert.equal(element.props.accessibilityRole, 'switch');
  assert.equal(element.props.accessibilityState.checked, false);
  const confirmed = animatedSwitch({ value: true });
  assert.equal(confirmed.position.get(), 1);
  assert.equal(confirmed.element.props.accessibilityState.checked, true);
});

test('disabled animated switch cannot request a value change', () => {
  let changed = false;
  const { element } = animatedSwitch({ value: false, disabled: true, onValueChange: () => { changed = true; } });
  element.props.onPress();
  assert.equal(changed, false);
  assert.equal(element.props.disabled, true);
});
