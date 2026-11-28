import test from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from './load-state.mjs';

const { default: Client } = await loadSource('src/api/client.ts');

test('every provider lists its charts, and Migu has no rising one', () => {
  const charts = Client.getCharts();
  const kindsOf = source =>
    charts.filter(chart => chart.source === source).map(chart => chart.kind);

  assert.deepEqual(kindsOf('netease'), ['hot', 'rising', 'new']);
  assert.deepEqual(kindsOf('kugou'), ['hot', 'rising', 'new']);
  assert.deepEqual(kindsOf('kuwo'), ['hot', 'rising', 'new']);
  assert.deepEqual(kindsOf('qq'), ['hot', 'rising', 'new']);
  assert.deepEqual(kindsOf('migu'), ['hot', 'new']);
});

test('a chart id starts with the prefix of the provider it belongs to', () => {
  const prefixOf = {};

  Client.getPlatformArray().forEach(provider => {
    prefixOf[provider.enName] = provider.platformId;
  });
  Client.getCharts().forEach(chart => {
    assert.equal(chart.id.slice(0, 2), prefixOf[chart.source], chart.id);
    assert.notEqual(chart.title, '');
  });
});

test('no two charts share an id', () => {
  const ids = Client.getCharts().map(chart => chart.id);

  assert.equal(new Set(ids).size, ids.length);
});
