// Run with: node --test "tools/test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from './load-state.mjs';

const { createResolver } = await loadSource('src/api/resolve.ts');

// A provider stand-in. songs maps a track id to its address; '' is a song the
// provider withholds. down makes every request fail, as a timeout would.
function provider(name, prefix, songs, options = {}) {
  const calls = { search: [], bootstrapTrack: [] };

  return {
    name,
    prefix,
    calls,
    search(keyword) {
      calls.search.push(keyword);
      if (options.down) {
        return Promise.reject(new Error('timeout'));
      }

      return Promise.resolve(options.catalog || []);
    },
    bootstrapTrack(trackId) {
      calls.bootstrapTrack.push(trackId);
      if (options.down) {
        return Promise.reject(new Error('timeout'));
      }

      return Promise.resolve(songs[trackId] || '');
    },
  };
}

const song = (id, title, artist, disabled = false) => ({
  id,
  title,
  artist,
  disabled,
});

test('a song its own provider can play is not switched', async () => {
  const netease = provider('netease', 'ne', { netrack_1: 'http://ne/1' });
  const qq = provider('qq', 'qq', {});
  const resolveTrack = createResolver([netease, qq]);

  assert.deepEqual(await resolveTrack(song('netrack_1', '晴天', '周杰伦')), {
    url: 'http://ne/1',
    source: 'netease',
    switched: false,
  });
  assert.deepEqual(qq.calls.search, []);
});

test('a restricted song is played from another provider that has it', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq]);

  assert.deepEqual(
    await resolveTrack(song('netrack_1', '晴天', '周杰伦', true)),
    { url: 'http://qq/9', source: 'qq', switched: true }
  );
  // the provider that marked it restricted is not asked for an address
  assert.deepEqual(netease.calls.bootstrapTrack, []);
  assert.deepEqual(netease.calls.search, []);
});

test('the other providers are searched by title and first artist', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider('qq', 'qq', {});
  const resolveTrack = createResolver([netease, qq]);

  await resolveTrack(song('netrack_1', '千里之外 (Live)', '周杰伦;费玉清', true));

  assert.deepEqual(qq.calls.search, ['千里之外 周杰伦']);
});

test('a song whose own address comes back empty is switched too', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq]);

  const result = await resolveTrack(song('netrack_1', '晴天', '周杰伦'));

  assert.equal(result.url, 'http://qq/9');
  assert.equal(result.switched, true);
});

test('a song whose own provider does not answer is switched too', async () => {
  const netease = provider('netease', 'ne', {}, { down: true });
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq]);

  const result = await resolveTrack(song('netrack_1', '晴天', '周杰伦'));

  assert.equal(result.url, 'http://qq/9');
});

test('restricted and different songs in the search results are passed over', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_1: 'http://qq/1', qqtrack_2: 'http://qq/2', qqtrack_3: 'http://qq/3' },
    {
      catalog: [
        song('qqtrack_1', '晴天', '周杰伦', true),
        song('qqtrack_2', '晴天', '刘瑞琦'),
        song('qqtrack_3', '晴天', '周杰伦'),
      ],
    }
  );
  const resolveTrack = createResolver([netease, qq]);

  const result = await resolveTrack(song('netrack_1', '晴天', '周杰伦', true));

  assert.equal(result.url, 'http://qq/3');
});

test('the first provider in the given order wins', async () => {
  const hit = (prefix) => ({
    catalog: [song(`${prefix}track_9`, '晴天', '周杰伦')],
  });
  const netease = provider('netease', 'ne', { netrack_9: 'http://ne/9' }, hit('ne'));
  const qq = provider('qq', 'qq', { qqtrack_9: 'http://qq/9' }, hit('qq'));
  const kuwo = provider('kuwo', 'kw', { kwtrack_9: 'http://kw/9' }, hit('kw'));
  const resolveTrack = createResolver([netease, qq, kuwo]);

  const result = await resolveTrack(song('kwtrack_1', '晴天', '周杰伦', true));

  assert.equal(result.source, 'netease');
  assert.deepEqual(kuwo.calls.search, []);
});

test('a match without an address falls through to the next provider', async () => {
  const kugou = provider('kugou', 'kg', {});
  const netease = provider(
    'netease',
    'ne',
    {},
    { catalog: [song('netrack_9', '晴天', '周杰伦')] }
  );
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq, kugou]);

  const result = await resolveTrack(song('kgtrack_1', '晴天', '周杰伦', true));

  assert.equal(result.source, 'qq');
});

test('a provider that does not answer does not stop the others', async () => {
  const kugou = provider('kugou', 'kg', {});
  const netease = provider('netease', 'ne', {}, { down: true });
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq, kugou]);

  const result = await resolveTrack(song('kgtrack_1', '晴天', '周杰伦', true));

  assert.equal(result.source, 'qq');
});

test('a song no provider can play is reported as unavailable', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider('qq', 'qq', {}, {
    catalog: [song('qqtrack_1', '晴天', '周杰伦', true)],
  });
  const kuwo = provider('kuwo', 'kw', {}, { down: true });
  const resolveTrack = createResolver([netease, qq, kuwo]);

  assert.deepEqual(await resolveTrack(song('netrack_1', '晴天', '周杰伦')), {
    url: '',
    reason: 'unavailable',
  });
});

test('when no provider answers at all the failure is a network one', async () => {
  const netease = provider('netease', 'ne', {}, { down: true });
  const qq = provider('qq', 'qq', {}, { down: true });
  const resolveTrack = createResolver([netease, qq]);

  assert.deepEqual(await resolveTrack(song('netrack_1', '晴天', '周杰伦')), {
    url: '',
    reason: 'network',
  });
  assert.deepEqual(
    await resolveTrack(song('netrack_2', '稻香', '周杰伦', true)),
    { url: '', reason: 'network' }
  );
});

test('a switch is remembered and not searched for again', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq]);
  const restricted = song('netrack_1', '晴天', '周杰伦', true);

  await resolveTrack(restricted);
  const again = await resolveTrack(restricted);

  assert.deepEqual(again, { url: 'http://qq/9', source: 'qq', switched: true });
  assert.equal(qq.calls.search.length, 1);
  // the address is asked for each time, it expires
  assert.equal(qq.calls.bootstrapTrack.length, 2);
});

test('a remembered switch that stops working is searched for again', async () => {
  const netease = provider('netease', 'ne', {});
  const songs = { qqtrack_9: 'http://qq/9' };
  const qq = provider('qq', 'qq', songs, {
    catalog: [song('qqtrack_9', '晴天', '周杰伦')],
  });
  const kuwo = provider(
    'kuwo',
    'kw',
    { kwtrack_9: 'http://kw/9' },
    { catalog: [song('kwtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq, kuwo]);
  const restricted = song('netrack_1', '晴天', '周杰伦', true);

  await resolveTrack(restricted);
  songs.qqtrack_9 = '';

  assert.equal((await resolveTrack(restricted)).source, 'kuwo');
});

test('a song from a provider that is not known is looked for everywhere', async () => {
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([qq]);

  const result = await resolveTrack(song('xmtrack_1', '晴天', '周杰伦'));

  assert.deepEqual(result, { url: 'http://qq/9', source: 'qq', switched: true });
});

test('the same version is preferred to another version listed before it', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_1: 'http://qq/1', qqtrack_2: 'http://qq/2' },
    {
      catalog: [
        song('qqtrack_1', '晴天 (Live)', '周杰伦'),
        song('qqtrack_2', '晴天', '周杰伦'),
      ],
    }
  );
  const resolveTrack = createResolver([netease, qq]);

  const result = await resolveTrack(song('netrack_1', '晴天', '周杰伦', true));

  assert.equal(result.url, 'http://qq/2');
});

test('the same version at a later provider is preferred to another version at an earlier one', async () => {
  const kugou = provider('kugou', 'kg', {});
  const netease = provider(
    'netease',
    'ne',
    { netrack_9: 'http://ne/9' },
    { catalog: [song('netrack_9', '晴天 (13秒片段)', '周杰伦')] }
  );
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '晴天', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq, kugou]);

  const result = await resolveTrack(song('kgtrack_1', '晴天', '周杰伦', true));

  assert.equal(result.source, 'qq');
});

test('another version is played when no provider has the same one', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_9: 'http://qq/9' },
    { catalog: [song('qqtrack_9', '稻香', '周杰伦')] }
  );
  const resolveTrack = createResolver([netease, qq]);

  const result = await resolveTrack(
    song('netrack_1', '稻香 (2008 魔杰座)', '周杰伦', true)
  );

  assert.equal(result.url, 'http://qq/9');
});

test('another version is played when the same version has no address', async () => {
  const netease = provider('netease', 'ne', {});
  const qq = provider(
    'qq',
    'qq',
    { qqtrack_2: 'http://qq/2' },
    {
      catalog: [
        song('qqtrack_1', '晴天', '周杰伦'),
        song('qqtrack_2', '晴天 (Live)', '周杰伦'),
      ],
    }
  );
  const resolveTrack = createResolver([netease, qq]);

  const result = await resolveTrack(song('netrack_1', '晴天', '周杰伦', true));

  assert.equal(result.url, 'http://qq/2');
  assert.deepEqual(qq.calls.bootstrapTrack, ['qqtrack_1', 'qqtrack_2']);
});
