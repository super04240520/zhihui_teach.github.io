import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

function loadDashboardConstants() {
  const source = readFileSync(new URL('./constant/dashboard.js', import.meta.url), 'utf8');
  const context = {
    window: {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'constant/dashboard.js' });
  return context.window.DASHBOARD_CONSTANTS;
}

test('dashboard constants expose four course dashboards', () => {
  const constants = loadDashboardConstants();

  assert.ok(constants, 'expected dashboard constants');
  assert.equal(constants.GROUP_STORAGE_KEY, 'xuesheng-random-groups-v1');
  assert.deepEqual(Object.keys(constants.COURSES ?? {}).sort(), [
    'ip',
    'review',
    'script',
    'talk',
  ]);
});

test('dashboard pages declare course keys and share dashboard constants', () => {
  const pages = [
    ['dashboard.html', 'talk'],
    ['dashboard-ip.html', 'ip'],
    ['dashboard-script.html', 'script'],
    ['dashboard-review.html', 'review'],
  ];

  pages.forEach(([file, courseKey]) => {
    const pageUrl = new URL(`./${file}`, import.meta.url);
    assert.equal(existsSync(pageUrl), true, `${file} should exist`);

    const html = readFileSync(pageUrl, 'utf8');
    assert.match(html, /constant\/dashboard\.js/, `${file} should load shared dashboard constants`);
    assert.match(
      html,
      new RegExp(`CURRENT_DASHBOARD_COURSE\\s*=\\s*['"]${courseKey}['"]`),
      `${file} should declare course key ${courseKey}`,
    );
  });
});

test('dashboard runtime can load constants and main script in same page context', () => {
  const html = readFileSync(new URL('./dashboard-ip.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);

  class FakeElement {
    constructor(id) {
      this.id = id;
      this.style = {};
      this.dataset = {};
      this.innerHTML = '';
      this.textContent = '';
      this.className = '';
      this.children = [];
      this.classList = { toggle() {}, add() {}, remove() {} };
      this.offsetWidth = 320;
      this.offsetHeight = 240;
    }

    appendChild(child) {
      this.children.push(child);
    }

    addEventListener() {}

    getContext() {
      return {
        scale() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        arc() {},
        fill() {},
        clearRect() {},
        createLinearGradient() {
          return { addColorStop() {} };
        },
        fillText() {},
        set strokeStyle(_value) {},
        set lineWidth(_value) {},
        set lineCap(_value) {},
        set fillStyle(_value) {},
        set font(_value) {},
        set textAlign(_value) {},
        set textBaseline(_value) {},
        set shadowColor(_value) {},
        set shadowBlur(_value) {},
      };
    }
  }

  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  const document = {
    body: { dataset: { course: 'ip' } },
    title: '',
    getElementById(id) {
      if (!elements[id]) elements[id] = new FakeElement(id);
      return elements[id];
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return new FakeElement('created');
    },
  };

  const window = {
    CURRENT_DASHBOARD_COURSE: 'ip',
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    addEventListener() {},
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    setInterval() { return 1; },
    setTimeout(fn) { fn(); return 1; },
    performance: { now() { return 0; } },
  };
  window.Chart = function Chart() {
    return { destroy() {} };
  };
  window.Chart.defaults = { color: '', borderColor: '', font: { family: '', size: 0 } };
  window.document = document;

  const context = {
    window,
    document,
    globalThis: window,
    console,
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 1,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    setInterval: window.setInterval,
    setTimeout: window.setTimeout,
    performance: window.performance,
    addEventListener: window.addEventListener,
    Date,
    Math,
    JSON,
    Array,
    Set,
    Object,
    Number,
    String,
    Error,
  };

  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('./constant/dashboard.js', import.meta.url), 'utf8'), context, { filename: 'constant/dashboard.js' });

  assert.doesNotThrow(() => {
    vm.runInContext(readFileSync(new URL('./js/dashboard.js', import.meta.url), 'utf8'), context, { filename: 'js/dashboard.js' });
  });
});

test('homepage exposes four dashboard entry links', () => {
  const html = readFileSync(new URL('./hompage.html', import.meta.url), 'utf8');

  assert.match(html, /href="\.\/dashboard\.html"/);
  assert.match(html, /href="\.\/dashboard-ip\.html"/);
  assert.match(html, /href="\.\/dashboard-script\.html"/);
  assert.match(html, /href="\.\/dashboard-review\.html"/);
});
