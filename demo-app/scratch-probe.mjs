import { Chart, registerables } from 'chart.js';
import 'chartjs-chart-financial/dist/chartjs-chart-financial.esm.js';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';

const has = (fn) => {
  try { fn(); return true; } catch { return false; }
};

console.log('financial auto-registers candlestick:', has(() => Chart.registry.getController('candlestick')));
console.log('time scale BEFORE registerables:', has(() => Chart.registry.getScale('time')));
Chart.register(...registerables, zoomPlugin);
console.log('time scale after registerables:', has(() => Chart.registry.getScale('time')));
console.log('linear scale after registerables:', has(() => Chart.registry.getScale('linear')));
console.log('bar controller after registerables:', has(() => Chart.registry.getController('bar')));
console.log('zoom plugin registered:', has(() => Chart.registry.getPlugin('zoom')));

const before = Chart._adapters._date;
try { new before({}).format(new Date(), 'yyyy'); console.log('base format: no-throw'); }
catch (e) { console.log('base format throws:', e.message.slice(0, 50)); }

const after = Chart._adapters._date;
console.log('adapter replaced by date-fns import:', after !== before);
try { console.log('fns format:', new after({}).format(Date.UTC(2026, 8, 24), 'yyyy-MM-dd')); }
catch (e) { console.log('fns threw:', e.message.slice(0, 80)); }

try { Chart.register(zoomPlugin); console.log('duplicate register: no throw'); }
catch (e) { console.log('duplicate register threw:', e.message.slice(0, 60)); }

console.log('zoom plugin id:', zoomPlugin?.id);
