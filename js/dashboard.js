(() => {
const CONSTANTS = window.DASHBOARD_CONSTANTS || {};
const {
  SCORE_FLOOR = 82,
  GROUP_NAMES = [],
  GROUP_STORAGE_KEY = 'xuesheng-random-groups-v1',
  STUDENT_NAMES = [],
  COURSES = {},
} = CONSTANTS;
const COURSE_KEY = window.CURRENT_DASHBOARD_COURSE || document.body.dataset.course || 'talk';
const COURSE = COURSES[COURSE_KEY] || COURSES.talk;

if (!COURSE) {
  throw new Error('未找到课程配置，无法渲染评价大屏。');
}

const MODULE_META = COURSE.modules;
const MODULE_BY_KEY = Object.fromEntries(MODULE_META.map((module) => [module.key, module]));

function getGrade(score) {
  if (score >= 90) return { text: '优秀 · A', color: '#34d399' };
  if (score >= 80) return { text: '良好 · B+', color: '#fbbf24' };
  if (score >= 70) return { text: '及格 · C', color: '#f59e0b' };
  return { text: '待提升 · D', color: '#f43f5e' };
}

function round1(num) {
  return Math.round(num * 10) / 10;
}

function avg(nums) {
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function sum(nums) {
  return nums.reduce((total, value) => total + value, 0);
}

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

function hashString(str) {
  let hash = 2166136261;
  for (let index = 0; index < str.length; index += 1) {
    hash ^= str.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function rand() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (_err) {}
  return null;
}

function getBorderColor(color) {
  if (color === 'var(--cyan)') return 'rgba(0,229,255,.3)';
  if (color === 'var(--blue)') return 'rgba(59,130,246,.3)';
  if (color === 'var(--violet)') return 'rgba(139,92,246,.3)';
  if (color === 'var(--amber)') return 'rgba(245,158,11,.3)';
  if (color === 'var(--green)') return 'rgba(16,185,129,.3)';
  if (color === 'var(--teal)') return 'rgba(20,184,166,.3)';
  return 'rgba(251,191,36,.4)';
}

function formatChartLabel(label) {
  if (label.length <= 8) return label;
  if (label.includes('（') && label.includes('）')) {
    const start = label.indexOf('（');
    return [label.slice(0, start), label.slice(start)];
  }
  if (label.includes('+')) return label.split('+');
  if (label.includes('/')) return label.split('/');
  return [label.slice(0, Math.ceil(label.length / 2)), label.slice(Math.ceil(label.length / 2))];
}

function getModuleScoreLabel(module, score) {
  return `${round1(score)} / ${module.max}`;
}

function getScoreLevelLabel(score, max) {
  const percent = score / max;
  if (percent >= 0.9) return `满分 ${max} 分 · 优秀`;
  if (percent >= 0.75) return `满分 ${max} 分 · 良好`;
  return `满分 ${max} 分 · 待提升`;
}

function buildSubList(subs, color) {
  return subs.map((sub) => `<div class="sub-row">
    <div class="sub-name">${sub.n}</div>
    <div class="sub-bg"><div class="sub-fill" style="width:0%;background:${color}" data-pct="${(sub.v / sub.max * 100).toFixed(1)}"></div></div>
    <div class="sub-val" style="color:${color}">${sub.v}/${sub.max}</div>
  </div>`).join('');
}

function avgSubs(items, key) {
  return items[0][key].subs.map((sub, index) => ({
    n: sub.n,
    max: sub.max,
    v: round1(avg(items.map((item) => item[key].subs[index].v))),
  }));
}

function avgArray(items, key, prop) {
  return items[0][key][prop].map((_, index) => round1(avg(items.map((item) => item[key][prop][index]))));
}

function moduleScoreMap(entity) {
  return MODULE_META.map((module) => ({
    ...module,
    score: entity[module.key].score,
    pct: entity[module.key].score / module.max * 100,
  }));
}

function splitUnits(totalUnits, caps, seed) {
  const rand = mulberry32(seed);
  const weights = caps.map((cap, index) => cap * (0.84 + rand() * 0.45 + (index % 2 === 0 ? 0.05 : 0)));
  const totalWeight = sum(weights);
  const units = weights.map((weight, index) => Math.min(Math.floor(totalUnits * weight / totalWeight), caps[index]));
  let used = sum(units);
  let cursor = Math.floor(rand() * caps.length);
  while (used < totalUnits) {
    let placed = false;
    for (let step = 0; step < caps.length; step += 1) {
      const index = (cursor + step) % caps.length;
      if (units[index] < caps[index]) {
        units[index] += 1;
        used += 1;
        cursor = index + 1;
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
  return units;
}

function adjustUnitsToRange(units, minTotal, maxTotal, seed) {
  const maxUnits = MODULE_META.map((module) => Math.round(module.max * 10 * 0.98));
  const minUnits = MODULE_META.map((module) => Math.round(module.max * 10 * 0.55));
  let total = sum(units);
  let cursor = seed % units.length;
  while (total < minTotal) {
    let changed = false;
    for (let step = 0; step < units.length; step += 1) {
      const index = (cursor + step) % units.length;
      if (units[index] < maxUnits[index]) {
        units[index] += 1;
        total += 1;
        cursor = index + 1;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  while (total > maxTotal) {
    let changed = false;
    for (let step = 0; step < units.length; step += 1) {
      const index = (cursor + step) % units.length;
      if (units[index] > minUnits[index]) {
        units[index] -= 1;
        total -= 1;
        cursor = index + 1;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return units;
}

function buildTrend(score, max, seed, trendOverride) {
  if (Array.isArray(trendOverride) && trendOverride.length) return [...trendOverride];
  const rand = mulberry32(seed);
  const start = round1(clamp(score - (max * 0.18 + rand() * 0.12 * max), max * 0.35, score - 0.6));
  const second = round1(clamp(start + (score - start) * (0.4 + rand() * 0.15), start + 0.3, score - 0.4));
  const third = round1(clamp(start + (score - start) * (0.72 + rand() * 0.08), second + 0.2, score - 0.1));
  return [start, second, third, round1(score)];
}

function buildBarData(module, subs, score) {
  const values = subs.map((sub) => sub.v);
  if (module.includeModuleTotal) values.push(round1(score));
  return values;
}

function buildModuleState(module, subs, score, seed, trendOverride) {
  const state = { score: round1(score), subs };
  if (module.chartType === 'bar') {
    state.data = buildBarData(module, subs, state.score);
  } else if (module.chartType === 'radar') {
    state.data = subs.map((sub) => round1(sub.v / sub.max * 100));
  } else if (module.chartType === 'line') {
    state.trend = buildTrend(state.score, module.max, seed, trendOverride);
  }
  return state;
}

function buildStaticModuleState(module, index) {
  const subs = module.items.map((item) => ({ n: item.name, v: item.score, max: item.max }));
  return buildModuleState(module, subs, module.score, hashString(`${COURSE.key}-${module.key}-${index}`), module.trend);
}

function getCourseTotal() {
  return round1(sum(MODULE_META.map((module) => module.score)));
}

function buildStudentModuleUnits(seed) {
  const rand = mulberry32(seed);
  const centerTotal = getCourseTotal();
  const units = MODULE_META.map((module, index) => {
    const basePercent = module.score / module.max;
    const noise = (rand() - 0.5) * 0.12 + (index === 2 || index === 4 ? 0.015 : 0);
    const percent = clamp(basePercent + noise, 0.6, 0.98);
    return Math.round(module.max * 10 * percent);
  });
  return adjustUnitsToRange(units, Math.round((centerTotal - 8) * 10), Math.round(Math.min(97, centerTotal + 7) * 10), seed);
}

function buildDynamicModuleState(module, totalUnits, seed) {
  const itemCaps = module.items.map((item) => Math.round(item.max * 10));
  const itemUnits = splitUnits(totalUnits, itemCaps, seed);
  const subs = module.items.map((item, index) => ({
    n: item.name,
    v: round1(itemUnits[index] / 10),
    max: item.max,
  }));
  return buildModuleState(module, subs, totalUnits / 10, seed + 17);
}

function buildEntityInsights(entity, type, members = []) {
  const modules = moduleScoreMap(entity).sort((a, b) => b.pct - a.pct);
  const weakest = modules[modules.length - 1];
  const secondWeakest = modules[modules.length - 2];
  const growth = entity.m6 && entity.m6.trend ? round1(entity.m6.trend.at(-1) - entity.m6.trend[0]) : 0;
  if (type === 'student') {
    return [
      { ico: '🏆', tag: 'tg-g', label: '概览', text: `${entity.name} 在 ${COURSE.screenTitle} 的当前综合得分为 <strong style="color:var(--cyan)">${entity.total}分</strong>，达到 ${getGrade(entity.total).text.split(' · ')[0]} 水平。` },
      { ico: '📚', tag: 'tg-i', label: '强项', text: `优势模块为 <strong style="color:${modules[0].color}">${modules[0].label} · ${modules[0].title}</strong>，完成度 ${round1(modules[0].pct)}%。` },
      { ico: '⚠️', tag: 'tg-w', label: '关注', text: `当前最需要补强的是 <strong style="color:${weakest.color}">${weakest.label}</strong>，继续提升会更容易拉开总分。` },
      { ico: '📈', tag: 'tg-i', label: '趋势', text: `复盘优化模块从 ${entity.m6.trend[0]} 提升到 ${entity.m6.trend.at(-1)}，累计提升 <strong style="color:var(--teal)">${growth} 分</strong>。` },
      { ico: '🔮', tag: 'tg-p', label: '建议', text: `优先强化 ${weakest.label} 与 ${secondWeakest.label}，总分有望继续提升到 <strong style="color:var(--cyan)">${round1(Math.min(97, entity.total + 3.2))}分</strong>。` },
    ];
  }
  const topStudent = members.length ? [...members].sort((a, b) => b.total - a.total)[0] : { name: '--', total: 0 };
  return [
    { ico: '🏆', tag: 'tg-g', label: '概览', text: `${entity.name} 当前综合均分为 <strong style="color:var(--cyan)">${entity.total}分</strong>，最高分学生是 ${topStudent.name} ${topStudent.total} 分。` },
    { ico: '📚', tag: 'tg-i', label: '强项', text: `整体最强模块为 <strong style="color:${modules[0].color}">${modules[0].label} · ${modules[0].title}</strong>，平均完成度 ${round1(modules[0].pct)}%。` },
    { ico: '⚠️', tag: 'tg-w', label: '短板', text: `当前短板模块是 <strong style="color:${weakest.color}">${weakest.label}</strong>，建议优先补强。` },
    { ico: '👥', tag: 'tg-p', label: '成员', text: type === 'class'
      ? `班级共 ${members.length} 人，其中 ${SCORE_FLOOR}+ 为 ${entity.metrics.aboveFloor} 人，90+ 为 ${entity.metrics.above90} 人。`
      : `${entity.metrics.groupName}成员：${members.map((member) => member.name).join('、')}，${SCORE_FLOOR}+ ${entity.metrics.aboveFloor}/${members.length} 人。` },
    { ico: '🔮', tag: 'tg-p', label: '建议', text: `若优先提升 ${weakest.label} 与 ${secondWeakest.label}，${type === 'class' ? '班级' : '小组'}整体表现还有明显上升空间。` },
  ];
}

function buildStudent(name, index) {
  const seed = hashString(`${COURSE.key}-${name}-${index + 1}`);
  const moduleUnits = buildStudentModuleUnits(seed);
  const student = { name, avatar: name[0] };
  MODULE_META.forEach((module, moduleIndex) => {
    student[module.key] = buildDynamicModuleState(module, moduleUnits[moduleIndex], seed + (moduleIndex + 1) * 97);
  });
  student.total = round1(sum(MODULE_META.map((module) => student[module.key].score)));
  student.insights = buildEntityInsights(student, 'student');
  return student;
}

function aggregateEntity(name, avatar, members, type, groupName = '') {
  const entity = {
    type,
    name,
    avatar,
    memberNames: members.map((member) => member.name),
    memberCount: members.length,
    studentCount: members.length,
  };
  MODULE_META.forEach((module) => {
    const state = { score: round1(avg(members.map((member) => member[module.key].score))) };
    if (members[0][module.key].subs) state.subs = avgSubs(members, module.key);
    if (members[0][module.key].data) state.data = avgArray(members, module.key, 'data');
    if (members[0][module.key].trend) state.trend = avgArray(members, module.key, 'trend');
    entity[module.key] = state;
  });
  entity.total = round1(sum(MODULE_META.map((module) => entity[module.key].score)));
  const modules = moduleScoreMap(entity).sort((a, b) => b.pct - a.pct);
  const topStudent = [...members].sort((a, b) => b.total - a.total)[0];
  const lowStudent = [...members].sort((a, b) => a.total - b.total)[0];
  entity.metrics = {
    topStudent,
    lowStudent,
    topModule: modules[0],
    weakModule: modules[modules.length - 1],
    aboveFloor: members.filter((member) => member.total >= SCORE_FLOOR).length,
    above90: members.filter((member) => member.total >= 90).length,
    groupName: groupName || name,
  };
  entity.insights = buildEntityInsights(entity, type, members);
  return entity;
}

function buildClassEntity(members) {
  const entity = {
    type: 'class',
    name: '班级总评',
    avatar: '班',
    memberNames: members.map((member) => member.name),
    memberCount: members.length,
    studentCount: members.length,
  };
  MODULE_META.forEach((module, index) => {
    entity[module.key] = buildStaticModuleState(module, index);
  });
  entity.total = getCourseTotal();
  const modules = moduleScoreMap(entity).sort((a, b) => b.pct - a.pct);
  const topStudent = [...members].sort((a, b) => b.total - a.total)[0];
  const lowStudent = [...members].sort((a, b) => a.total - b.total)[0];
  entity.metrics = {
    topStudent,
    lowStudent,
    topModule: modules[0],
    weakModule: modules[modules.length - 1],
    aboveFloor: members.filter((member) => member.total >= SCORE_FLOOR).length,
    above90: members.filter((member) => member.total >= 90).length,
    groupName: '班级总评',
  };
  entity.insights = buildEntityInsights(entity, 'class', members);
  return entity;
}

let STUDENTS = STUDENT_NAMES.map((name, index) => buildStudent(name, index));
let GROUPS = [];
let GROUP_ENTITIES = [];
let STUDENT_GROUP_INDEXES = Array(STUDENTS.length).fill(0);
let CLASS_ENTITY = null;

function isValidStoredGroups(groups) {
  if (!Array.isArray(groups) || groups.length !== GROUP_NAMES.length) return false;
  const flattened = groups.flatMap((group) => (group && Array.isArray(group.members) ? group.members : []));
  if (flattened.length !== STUDENTS.length) return false;
  const unique = new Set(flattened);
  if (unique.size !== STUDENTS.length) return false;
  return groups.every((group, index) => (
    group
    && group.name === GROUP_NAMES[index]
    && Array.isArray(group.members)
    && group.members.length === 6
    && group.members.every((member) => Number.isInteger(member) && member >= 0 && member < STUDENTS.length)
  ));
}

function loadStoredGroups() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(GROUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidStoredGroups(parsed) ? parsed : null;
  } catch (_err) {
    return null;
  }
}

function saveStoredGroups(groups) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groups));
  } catch (_err) {}
}

function rebuildEntities(forceShuffle = false) {
  STUDENTS = STUDENT_NAMES.map((name, index) => buildStudent(name, index));
  CLASS_ENTITY = buildClassEntity(STUDENTS);
  const storedGroups = !forceShuffle && loadStoredGroups();
  if (storedGroups) {
    GROUPS = storedGroups;
  } else {
    const shuffledIndexes = shuffleArray(STUDENTS.map((_, index) => index));
    GROUPS = GROUP_NAMES.map((name, groupIndex) => ({
      name,
      members: shuffledIndexes.slice(groupIndex * 6, (groupIndex + 1) * 6),
    }));
    saveStoredGroups(GROUPS);
  }
  STUDENT_GROUP_INDEXES = Array(STUDENTS.length).fill(0);
  GROUPS.forEach((group, groupIndex) => {
    group.members.forEach((studentIndex) => {
      STUDENT_GROUP_INDEXES[studentIndex] = groupIndex;
    });
  });
  GROUP_ENTITIES = GROUPS.map((group, groupIndex) => aggregateEntity(
    group.name,
    `G${groupIndex + 1}`,
    group.members.map((studentIndex) => STUDENTS[studentIndex]),
    'group',
    group.name,
  ));
}

const HAS_CHART = typeof globalThis !== 'undefined' && typeof globalThis.Chart !== 'undefined';
if (HAS_CHART) {
  globalThis.Chart.defaults.color = 'rgba(180,220,255,0.45)';
  globalThis.Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  globalThis.Chart.defaults.font.family = "'PingFang SC','Microsoft YaHei',system-ui,sans-serif";
  globalThis.Chart.defaults.font.size = 11;
} else {
  console.warn('Chart.js 未加载，仪表盘将仅展示基础数据。');
}

let CHARTS = {};
let CURRENT_GROUP_INDEX = 0;
let CURRENT_VIEW = { type: 'class' };
let gaugeScore = MODULE_BY_KEY.m5.score;
let totalRaf = null;

function getBarScaleMax(module) {
  return Math.max(...module.items.map((item) => item.max), module.includeModuleTotal ? module.max : 0) + 1;
}

function createBarChart(canvasId, module, dataset, color) {
  return new globalThis.Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels: module.items.map((item) => formatChartLabel(item.name)).concat(module.includeModuleTotal ? ['模块总分'] : []),
      datasets: [
        {
          label: '得分',
          data: dataset,
          backgroundColor: Array.from({ length: dataset.length }, (_, index) => index === dataset.length - 1 && module.includeModuleTotal ? color.replace('.72', '.85') : color),
          borderColor: module.color === 'var(--blue)' ? '#3b82f6' : module.color === 'var(--amber)' ? '#f59e0b' : '#8b5cf6',
          borderWidth: 1.5,
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: '满分',
          data: module.items.map((item) => item.max).concat(module.includeModuleTotal ? [module.max] : []),
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}` } },
      },
      scales: {
        y: { max: getBarScaleMax(module), grid: { color: 'rgba(255,255,255,.04)' } },
        x: { grid: { display: false } },
      },
    },
  });
}

function initCharts(entity) {
  if (!HAS_CHART) return;
  Object.values(CHARTS).forEach((chart) => chart && chart.destroy());
  CHARTS = {};

  const m1 = MODULE_BY_KEY.m1;
  CHARTS.m1 = new globalThis.Chart(document.getElementById('chartM1'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [entity.m1.score, round1(m1.max - entity.m1.score)],
        backgroundColor: ['rgba(0,229,255,0.75)', 'rgba(255,255,255,0.05)'],
        borderColor: ['#00e5ff', 'rgba(255,255,255,0.04)'],
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed} 分` } },
      },
    },
  });

  CHARTS.m2 = createBarChart('chartM2', MODULE_BY_KEY.m2, entity.m2.data, 'rgba(59,130,246,.7)');

  CHARTS.m3 = new globalThis.Chart(document.getElementById('chartM3'), {
    type: 'radar',
    data: {
      labels: MODULE_BY_KEY.m3.items.map((item) => formatChartLabel(item.name)),
      datasets: [{
        label: '得分率',
        data: entity.m3.data,
        backgroundColor: 'rgba(139,92,246,0.15)',
        borderColor: 'rgba(139,92,246,0.8)',
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: '#071525',
        pointBorderWidth: 2,
        pointRadius: 5,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.r.toFixed(1)}%` } },
      },
      scales: {
        r: {
          min: 55,
          max: 100,
          grid: { color: 'rgba(255,255,255,.07)' },
          angleLines: { color: 'rgba(255,255,255,.07)' },
          pointLabels: { font: { size: 10 }, color: 'rgba(180,220,255,0.6)' },
          ticks: { display: false },
        },
      },
    },
  });

  CHARTS.m4 = createBarChart('chartM4', MODULE_BY_KEY.m4, entity.m4.data, 'rgba(245,158,11,.72)');

  CHARTS.m6 = new globalThis.Chart(document.getElementById('chartM6'), {
    type: 'line',
    data: {
      labels: entity.m6.trend.map((_, index) => `第${index + 1}次`),
      datasets: [{
        label: '复盘得分',
        data: entity.m6.trend,
        borderColor: '#14b8a6',
        backgroundColor: 'rgba(20,184,166,.08)',
        borderWidth: 2.5,
        pointRadius: 6,
        pointBackgroundColor: '#14b8a6',
        pointBorderColor: '#071525',
        pointBorderWidth: 2,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} 分` } },
      },
      scales: {
        y: { min: 0, max: MODULE_BY_KEY.m6.max, grid: { color: 'rgba(255,255,255,.04)' } },
        x: { grid: { display: false } },
      },
    },
  });

  CHARTS.m7 = createBarChart('chartM7', MODULE_BY_KEY.m7, entity.m7.data, 'rgba(139,92,246,.7)');
}

function drawGauge(score) {
  const module = MODULE_BY_KEY.m5;
  const canvas = document.getElementById('chartM5');
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const cx = width / 2;
  const cy = height * 0.62;
  const radius = Math.min(width, height) * 0.38;
  const percent = score / module.max;
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const range = endAngle - startAngle;
  const filledEnd = startAngle + range * percent;
  for (let index = 0; index <= 10; index += 1) {
    const angle = startAngle + range * index / 10;
    const major = index % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (radius + (major ? 5 : 2)), cy + Math.sin(angle) * (radius + (major ? 5 : 2)));
    ctx.lineTo(cx + Math.cos(angle) * (radius + (major ? 12 : 6)), cy + Math.sin(angle) * (radius + (major ? 12 : 6)));
    ctx.strokeStyle = major ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.1)';
    ctx.lineWidth = major ? 1.5 : 0.8;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, filledEnd);
  ctx.strokeStyle = 'rgba(16,185,129,.25)';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.stroke();

  const gradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
  gradient.addColorStop(0, '#10b981');
  gradient.addColorStop(1, '#34d399');
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, filledEnd);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(filledEnd) * (radius - 8), cy + Math.sin(filledEnd) * (radius - 8));
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  ctx.fillStyle = '#cde8ff';
  ctx.font = `bold ${Math.round(height * 0.14)}px Orbitron,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(score.toFixed(1), cx, cy + radius * 0.12);
  ctx.font = `${Math.round(height * 0.065)}px PingFang SC,sans-serif`;
  ctx.fillStyle = 'rgba(180,220,255,0.42)';
  ctx.fillText(`/ ${module.max}`, cx, cy + radius * 0.3);
}

function animBars() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.sub-fill[data-pct]').forEach((element) => {
      element.style.width = `${element.dataset.pct}%`;
    });
  });
}

function animTotal(target) {
  const ring = document.getElementById('totalRing');
  const numEl = document.getElementById('totalNum');
  const circumference = 2 * Math.PI * 45;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference;
  if (totalRaf) cancelAnimationFrame(totalRaf);
  setTimeout(() => {
    ring.style.strokeDashoffset = circumference * (1 - target / 100);
  }, 100);
  const duration = 1200;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    numEl.textContent = (eased * target).toFixed(1);
    if (progress < 1) totalRaf = requestAnimationFrame(step);
  }
  totalRaf = requestAnimationFrame(step);
}

function renderStaticCourseText() {
  document.title = `${COURSE.screenTitle}评价大屏`;
  document.getElementById('brandIcon').textContent = COURSE.icon;
  document.getElementById('brandTitleText').textContent = COURSE.brandTitle;
  document.getElementById('brandSubText').textContent = COURSE.brandSubtitle;
  document.getElementById('groupSub').textContent = `点击小组下钻查看 ${COURSE.screenTitle} 成员与模块表现`;
  document.getElementById('bigCardTitle').textContent = COURSE.projectLabel;
  document.getElementById('totalLabel').textContent = COURSE.totalLabel;
  document.getElementById('aiPanelTitle').textContent = COURSE.aiPanelTitle;
  document.getElementById('aiPanelFooter').textContent = COURSE.aiPanelFooter;
  document.getElementById('dcMax1').textContent = `/ ${MODULE_BY_KEY.m1.max} 分`;
  MODULE_META.forEach((module) => {
    document.getElementById(`moduleTitle${module.label}`).textContent = `${module.label} · ${module.title}`;
  });
  document.getElementById('footerModules').innerHTML = MODULE_META.map((module, index) => `
    <div class="fm"><div class="fm-dot" style="background:${module.color}"></div>${COURSE.moduleFooterLabels[index]}</div>
  `).join('');
}

function getCurrentEntity(view) {
  if (view.type === 'class') return CLASS_ENTITY;
  if (view.type === 'group') return GROUP_ENTITIES[view.index];
  return STUDENTS[view.index];
}

function renderClassSummary(entity, isActive) {
  document.getElementById('classSummaryCard').classList.toggle('active', isActive);
  document.getElementById('classSummaryCard').innerHTML = `
    <div class="sum-head">
      <div class="sum-title">${COURSE.summaryTitle}</div>
      <div class="sum-tag">${COURSE.summaryTag}</div>
    </div>
    <div class="sum-score-row">
      <div class="sum-score">${entity.total}</div>
      <div class="sum-score-desc">${COURSE.screenTitle}班级均分 / 100</div>
    </div>
    <div class="sum-stats">
      <div class="sum-stat"><div class="sum-stat-label">学生数</div><div class="sum-stat-value">${entity.studentCount}</div></div>
      <div class="sum-stat"><div class="sum-stat-label">${SCORE_FLOOR}+人数</div><div class="sum-stat-value">${entity.metrics.aboveFloor}</div></div>
      <div class="sum-stat"><div class="sum-stat-label">90+人数</div><div class="sum-stat-value">${entity.metrics.above90}</div></div>
      <div class="sum-stat"><div class="sum-stat-label">最强模块</div><div class="sum-stat-value">${entity.metrics.topModule.label}</div></div>
    </div>
    <div class="sum-foot">
      <div>最高分：${entity.metrics.topStudent.name} ${entity.metrics.topStudent.total}</div>
      <div>待提升：${entity.metrics.weakModule.label}</div>
    </div>`;
}

function getStudentGroupIndex(studentIndex) {
  return STUDENT_GROUP_INDEXES[studentIndex] ?? 0;
}

function getVisibleStudentIndexes() {
  if (CURRENT_VIEW.type === 'group') return GROUPS[CURRENT_VIEW.index].members;
  if (CURRENT_VIEW.type === 'student') return GROUPS[CURRENT_GROUP_INDEX].members;
  return STUDENTS.map((_, index) => index);
}

function getEntrySubText() {
  if (CURRENT_VIEW.type === 'group') {
    return `当前展示 ${GROUPS[CURRENT_VIEW.index].name} 6 名成员，点击头像查看${COURSE.screenTitle}个人明细。`;
  }
  if (CURRENT_VIEW.type === 'student') {
    return `当前展示 ${GROUPS[CURRENT_GROUP_INDEX].name} 成员，便于组内快速切换对比。`;
  }
  return `当前展示全部 ${STUDENTS.length} 名学生，点击任一学生可进入个人明细。`;
}

function renderGroups() {
  const groups = [...GROUP_ENTITIES].sort((a, b) => b.total - a.total);
  document.getElementById('groupSummaryList').innerHTML = groups.map((group, rank) => {
    const realIndex = GROUP_ENTITIES.findIndex((item) => item.name === group.name);
    const isActive = (CURRENT_VIEW.type === 'group' && CURRENT_VIEW.index === realIndex)
      || (CURRENT_VIEW.type === 'student' && CURRENT_GROUP_INDEX === realIndex);
    return `<div class="group-card${isActive ? ' active' : ''}" data-group-index="${realIndex}">
      <div class="group-topline">
        <div class="group-rank">TOP ${rank + 1}</div>
        <div class="group-mini">G${realIndex + 1}</div>
      </div>
      <div class="group-name">${group.name}</div>
      <div class="group-score">${group.total}</div>
      <div class="group-meta">最佳 ${group.metrics.topStudent.name} · ${group.metrics.topStudent.total}</div>
      <div class="group-strong">${SCORE_FLOOR}+ ${group.metrics.aboveFloor}/${group.memberCount} · 强项 ${group.metrics.topModule.label}</div>
    </div>`;
  }).join('');
  document.querySelectorAll('.group-card').forEach((card) => {
    card.addEventListener('click', () => renderView({ type: 'group', index: Number(card.dataset.groupIndex) }));
  });
}

function renderStudents() {
  const picker = document.getElementById('stuPicker');
  const visibleIndexes = getVisibleStudentIndexes();
  picker.innerHTML = '';
  visibleIndexes.forEach((studentIndex) => {
    const student = STUDENTS[studentIndex];
    const button = document.createElement('div');
    button.className = `stu-btn${CURRENT_VIEW.type === 'student' && CURRENT_VIEW.index === studentIndex ? ' active' : ''}`;
    button.innerHTML = `<div class="stu-avatar">${student.avatar}</div>
      <div class="stu-name-sm">${student.name}</div>
      <div class="stu-score-sm">${student.total}</div>`;
    button.addEventListener('click', () => renderView({
      type: 'student',
      index: studentIndex,
      groupIndex: getStudentGroupIndex(studentIndex),
    }));
    picker.appendChild(button);
  });
  document.getElementById('entrySub').textContent = getEntrySubText();
}

function getEntityMeta(entity, view) {
  if (view.type === 'class') {
    return {
      title: `班级总评 · ${COURSE.screenTitle}模块均分视角`,
      desc: `覆盖 ${entity.studentCount} 名学生，支持 4 个小组与成员快速下钻。`,
      chip: `班级均分 ${entity.total} / 100`,
    };
  }
  if (view.type === 'group') {
    return {
      title: `${entity.name} · 小组总评`,
      desc: `当前显示 ${entity.name} 6 名成员的${COURSE.screenTitle}模块均分，点击头像进入个人画像。`,
      chip: `组均分 ${entity.total} / 100`,
    };
  }
  return {
    title: `${entity.name} · 个人明细`,
    desc: `当前聚焦 ${entity.name}，所在分组 ${GROUPS[CURRENT_GROUP_INDEX].name}，可在同组成员中快速切换。`,
    chip: `个人总分 ${entity.total} / 100`,
  };
}

function renderView(view) {
  if (view.type === 'group') {
    CURRENT_GROUP_INDEX = view.index;
  } else if (view.type === 'student') {
    CURRENT_GROUP_INDEX = typeof view.groupIndex === 'number' ? view.groupIndex : getStudentGroupIndex(view.index);
    view = { ...view, groupIndex: CURRENT_GROUP_INDEX };
  }
  CURRENT_VIEW = view;
  const entity = getCurrentEntity(view);
  const meta = getEntityMeta(entity, view);
  renderClassSummary(CLASS_ENTITY, view.type === 'class');
  renderGroups();
  renderStudents();

  document.getElementById('viewTitle').textContent = meta.title;
  document.getElementById('viewDesc').textContent = meta.desc;
  document.getElementById('viewChip').textContent = meta.chip;

  MODULE_META.forEach((module, index) => {
    document.getElementById(`chip${index + 1}`).textContent = getModuleScoreLabel(module, entity[module.key].score);
  });
  document.getElementById('chipTotal').textContent = `${entity.total} / 100`;

  document.getElementById('dc1').textContent = entity.m1.score.toFixed(1);
  document.getElementById('subM1').innerHTML = buildSubList(entity.m1.subs, MODULE_BY_KEY.m1.color);
  document.getElementById('subM4').innerHTML = buildSubList(entity.m4.subs, MODULE_BY_KEY.m4.color);
  document.getElementById('subM5').innerHTML = buildSubList(entity.m5.subs, MODULE_BY_KEY.m5.color);
  document.getElementById('subM6').innerHTML = buildSubList(entity.m6.subs, MODULE_BY_KEY.m6.color);

  document.getElementById('bigScore').textContent = entity.m8.score.toFixed(1);
  document.getElementById('bigLabel').textContent = getScoreLevelLabel(entity.m8.score, MODULE_BY_KEY.m8.max);
  document.getElementById('bigSub').innerHTML = entity.m8.subs.map((sub, index) => `
    <div class="big-sub-row"><div class="big-sub-name">✦ ${sub.n}</div><div class="big-sub-score">${sub.v}/${sub.max}</div></div>
    <div class="sub-bg"${index === 0 ? ' style="margin-bottom:6px"' : ''}><div class="sub-fill" style="width:0%;background:${MODULE_BY_KEY.m8.color}" data-pct="${(sub.v / sub.max * 100).toFixed(1)}"></div></div>
  `).join('');

  const grade = getGrade(entity.total);
  document.getElementById('totalGrade').textContent = grade.text;
  document.getElementById('totalGrade').style.color = grade.color;

  document.getElementById('modulePills').innerHTML = MODULE_META.map((module) => `
    <div class="mpill" style="border-color:${getBorderColor(module.color)};color:${module.color}">
      ${module.label} ${entity[module.key].score}
    </div>
  `).join('');

  document.getElementById('aiInsights').innerHTML = entity.insights.map((insight, index) => `
    <div class="api" style="animation-delay:${index * 0.06}s">
      <div class="api-ico">${insight.ico}</div>
      <div><div class="apt-tag ${insight.tag}">${insight.label}</div><div>${insight.text}</div></div>
    </div>
  `).join('');

  initCharts(entity);
  animBars();
  gaugeScore = entity.m5.score;
  setTimeout(() => drawGauge(entity.m5.score), 50);
  animTotal(entity.total);
}

function reshuffleGroups() {
  rebuildEntities(true);
  if (CURRENT_VIEW.type === 'group') {
    renderView({ type: 'group', index: CURRENT_VIEW.index });
    return;
  }
  if (CURRENT_VIEW.type === 'student') {
    renderView({
      type: 'student',
      index: CURRENT_VIEW.index,
      groupIndex: getStudentGroupIndex(CURRENT_VIEW.index),
    });
    return;
  }
  renderView({ type: 'class' });
}

(function neuralBackground() {
  const canvas = document.getElementById('neuralBg');
  const ctx = canvas.getContext('2d');
  let width;
  let height;
  let nodes = [];
  const count = 50;
  const maxDistance = 155;
  function resize() {
    width = canvas.width = innerWidth;
    height = canvas.height = innerHeight;
  }
  addEventListener('resize', resize);
  resize();
  for (let index = 0; index < count; index += 1) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.8 + 0.8,
    });
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < maxDistance) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,229,255,${(1 - distance / maxDistance) * 0.1})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    nodes.forEach((node) => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,229,255,0.4)';
      ctx.shadowColor = 'rgba(0,229,255,.7)';
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0;
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
}());

function tick() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  document.getElementById('clockTime').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  document.getElementById('clockDate').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · 周${days[now.getDay()]}`;
  document.getElementById('lastUpdate').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

setInterval(tick, 1000);
tick();
renderStaticCourseText();

document.getElementById('aiMascotWrap').addEventListener('click', () => {
  document.getElementById('aiPanel').classList.toggle('open');
});
document.getElementById('aiClose').addEventListener('click', (event) => {
  event.stopPropagation();
  document.getElementById('aiPanel').classList.remove('open');
});
document.getElementById('classSummaryCard').addEventListener('click', () => renderView({ type: 'class' }));
document.getElementById('reshuffleBtn').addEventListener('click', reshuffleGroups);
window.addEventListener('resize', () => drawGauge(gaugeScore));
window.addEventListener('storage', (event) => {
  if (event.key === GROUP_STORAGE_KEY) {
    rebuildEntities(false);
    renderView(CURRENT_VIEW.type === 'student'
      ? { ...CURRENT_VIEW, groupIndex: getStudentGroupIndex(CURRENT_VIEW.index) }
      : CURRENT_VIEW);
  }
});

rebuildEntities();
renderView({ type: 'class' });
})();
