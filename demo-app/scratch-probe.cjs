const Chart = require('chart.js');
const has = (fn) => {
  try { fn(); return true; } catch { return false; }
};

require('chartjs-chart-financial');
console.log('financial auto-registers candlestick:', has(() => Chart.registry.getController('candlestick')));

console.log('Chart.register fn:', typeof Chart.register);
Chart.register(...Chart.registerables);
console.log('time scale after registerables:', has(() => Chart.registry.getScale('time')));
console.log('linear scale after registerables:', has(() => Chart.registry.getScale('linear')));
console.log('bar controller after registerables:', has(() => Chart.registry.getController('bar')));

const before = Chart._adapters._date;
try { new before({}).format(new Date(), 'yyyy'); console.log('base format: no-throw'); }
catch (e) { console.log('base format throws:', e.message.slice(0, 50)); }

require('chartjs-adapter-date-fns');
const after = Chart._adapters._date;
console.log('adapter replaced by date-fns import:', after !== before);
try { console.log('fns format:', new after({}).format(Date.UTC(2026, 8, 24), 'yyyy-MM-dd')); }
catch (e) { console.log('fns threw:', e.message.slice(0, 80)); }

const zoomMod = require('chartjs-plugin-zoom');
const zoom = zoomMod.default || zoomMod;
console.log('zoom plugin id:', zoom.id);
Chart.register(zoom);
console.log('zoom registered?', has(() => Chart.registry.getPlugin('zoom')));

// Duplicate registration safety (component may register, spec may re-register)
try { Chart.register(zoom); console.log('duplicate register: no throw'); }
catch (e) { console.log('duplicate register threw:', e.message.slice(0, 60)); }

// ESM interop of chartjs-plugin-zoom under vitest (it ships an ESM default export)
console.log('zoom default export type:', typeof (require('chartjs-plugin-zoom').default));
