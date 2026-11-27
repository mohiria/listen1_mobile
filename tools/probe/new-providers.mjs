// Probe the candidate providers of A-12 (migu, bodian, qianqian): can a
// guest search them and get a whole song out of them, above all for songs
// the app's four providers withhold.
//
//   node tools/probe/new-providers.mjs --net <网络标签> [--only mg,bd,th] [--out 目录]
//
// For every sample song the four providers of the app are asked first (the
// baseline), then every candidate. Requests are spaced out. The network label
// is recorded as given; nothing here inspects the network.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const GAP_MS = 800;
const TIMEOUT_MS = 15000;
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30';

// Hits most likely to be withheld, a few everyday songs, one in English.
const SAMPLES = [
  { title: '晴天', artist: '周杰伦' },
  { title: '稻香', artist: '周杰伦' },
  { title: '七里香', artist: '周杰伦' },
  { title: '江南', artist: '林俊杰' },
  { title: '十年', artist: '陈奕迅' },
  { title: '光年之外', artist: 'G.E.M.邓紫棋' },
  { title: '演员', artist: '薛之谦' },
  { title: '倔强', artist: '五月天' },
  { title: '消愁', artist: '毛不易' },
  { title: '起风了', artist: '买辣椒也用券' },
  { title: '后来', artist: '刘若英' },
  { title: 'Love Story', artist: 'Taylor Swift' },
];

function parseArgs(argv) {
  const args = { net: null, only: null, out: null };

  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i].replace(/^--/, '');

    if (!(name in args) || argv[i + 1] === undefined) {
      return null;
    }
    args[name] = argv[i + 1];
    i += 1;
  }

  return args.net ? args : null;
}

const args = parseArgs(process.argv.slice(2));

if (!args) {
  process.stderr.write(
    '用法: node tools/probe/new-providers.mjs --net <网络标签> [--only mg,bd,th] [--out 目录]\n'
  );
  process.exit(2);
}
if (!existsSync(path.join(here, 'node_modules', 'esbuild'))) {
  process.stderr.write('缺少依赖，先执行: npm install --prefix tools/probe\n');
  process.exit(2);
}

// ---- load the app's source layer ------------------------------------------
async function loadApp() {
  const esbuild = await import('esbuild');
  const outfile = path.join(here, 'node_modules', '.cache', 'new-providers.mjs');

  await esbuild.build({
    stdin: {
      contents:
        "export { default as Client } from './src/api/client';\n" +
        "export { isSameSong, searchKeyword } from './src/api/match';\n",
      resolveDir: repoRoot,
      loader: 'js',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'error',
    nodePaths: [path.join(here, 'node_modules')],
    alias: {
      '@react-native-community/async-storage': path.join(here, 'async-storage.js'),
    },
  });
  if (globalThis.window === undefined) {
    globalThis.window = globalThis;
  }

  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

// ---- helpers ---------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const md5 = (text) => createHash('md5').update(text, 'utf8').digest('hex');
const shorten = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);
const log = [];

function describeError(error) {
  const cause = error && error.cause ? ` (${error.cause.code || error.cause.message})` : '';

  return `${(error && error.name) || 'Error'}: ${error && error.message}${cause}`;
}

// One request; never throws. Every request ends up in the archive.
async function send(label, url, init) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const entry = { label, url, method: (init && init.method) || 'GET' };

  await sleep(GAP_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();

    entry.status = response.status;
    entry.body = shorten(text, 700);
    entry.text = text;
  } catch (error) {
    entry.error = describeError(error);
  } finally {
    clearTimeout(timer);
  }
  entry.ms = Date.now() - started;
  log.push({ ...entry, text: undefined });

  return entry;
}

function json(entry) {
  if (entry.error) {
    throw new Error(entry.error);
  }
  try {
    return JSON.parse(entry.text);
  } catch (error) {
    throw new Error(`HTTP ${entry.status}，不是 JSON：${shorten(entry.text, 120)}`);
  }
}

// First bytes of the address: is it audio, and how long is the whole file.
async function checkAudio(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-1023', ...headers },
      signal: controller.signal,
    });
    const range = response.headers.get('content-range');
    const total = range
      ? Number(range.split('/').pop())
      : Number(response.headers.get('content-length'));
    const head = Buffer.from(await response.arrayBuffer()).subarray(0, 4);

    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes: Number.isFinite(total) ? total : null,
      magic: head.toString('latin1').replace(/[^\x20-\x7e]/g, '.'),
    };
  } catch (error) {
    return { error: describeError(error) };
  } finally {
    clearTimeout(timer);
  }
}

// A whole song or not, from the size of the file and the length of the song.
function judge(audio, seconds) {
  if (!audio || audio.error || !(audio.status === 200 || audio.status === 206)) {
    return '地址打不开';
  }
  if (!audio.bytes) {
    return '大小未知';
  }
  if (seconds > 0) {
    const kbps = Math.round((audio.bytes * 8) / seconds / 1000);

    return kbps >= 60 ? `全曲（约 ${kbps}kbps）` : `片段（按歌曲时长折算仅 ${kbps}kbps）`;
  }

  return audio.bytes >= 1500000 ? '全曲（时长未知，按大小判断）' : '片段或提示音（按大小判断）';
}

// ---- baseline: the app's four providers ------------------------------------
async function baseline(app, sample) {
  const cells = {};

  for (const platform of app.Client.getPlatformArray()) {
    const name = platform.name;

    await sleep(GAP_MS);
    try {
      const found = await app.Client.search(
        app.searchKeyword(sample),
        1,
        platform.platformId
      );
      const match = (found.result || []).find((track) => app.isSameSong(track, sample));

      if (!match) {
        cells[name] = '搜不到';
      } else if (match.disabled) {
        cells[name] = '受限';
      } else {
        const url = await app.Client.bootstrapTrack(match.id);

        cells[name] = typeof url === 'string' && /^https?:/.test(url) ? '可播' : '取址为空';
      }
    } catch (error) {
      cells[name] = `出错：${shorten(describeError(error), 60)}`;
    }
  }

  return cells;
}

// ---- candidates ------------------------------------------------------------
// search(sample) resolves with the songs it found, as
// { title, artist, seconds, paid, ref }; address(ref) resolves with
// [{ way, url, note }], one per way of asking.
const migu = {
  id: 'mg',
  name: '咪咕',
  async search(sample) {
    const keyword = encodeURIComponent(`${sample.title} ${sample.artist}`);
    const viaListen1 = await send(
      'mg 搜索 pc/resource/song/item/search',
      `https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0?text=${keyword}&pageNo=1&pageSize=20`
    );
    let songs = [];
    let note = '';

    try {
      songs = (json(viaListen1) || []).map((song) => ({
        title: song.songName,
        artist: song.singerList && song.singerList[0] ? song.singerList[0].name : song.singer,
        seconds: Number(song.duration) || 0,
        paid: `copyright=${song.copyright} vipType=${song.vipType || ''}`,
        ref: { copyrightId: song.copyrightId, contentId: song.contentId, songId: song.songId },
      }));
    } catch (error) {
      note = error.message;
    }
    if (songs.length === 0) {
      const switches = encodeURIComponent(
        '{"song":1,"album":0,"singer":0,"tagSong":0,"mvSong":0,"songlist":0,"bestShow":1}'
      );
      const viaApp = await send(
        'mg 搜索 search_all.do',
        `http://pd.musicapp.migu.cn/MIGUM2.0/v1.0/content/search_all.do?ua=Android_migu&version=5.0.1&text=${keyword}&pageNo=1&pageSize=20&searchSwitch=${switches}`,
        { headers: { 'user-agent': ANDROID_UA, referer: 'http://music.migu.cn/' } }
      );

      try {
        const result = (json(viaApp).songResultData || {}).result || [];

        songs = result.map((song) => ({
          title: song.name || song.songName,
          artist: song.singers && song.singers[0] ? song.singers[0].name : '',
          seconds: Number(song.duration) || 0,
          paid: `chargeAuditions=${song.chargeAuditions || ''}`,
          ref: { copyrightId: song.copyrightId, contentId: song.contentId, songId: song.id },
        }));
        note = `${note}；改用 search_all.do`;
      } catch (error) {
        note = `${note}；search_all.do：${error.message}`;
      }
    }

    return { songs, note };
  },
  async address(ref) {
    const ways = [
      {
        way: 'listen1：MIGUM3.0/strategy/pc/listen/v1.0',
        url: `https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=${ref.copyrightId}&contentId=${ref.contentId}&toneFlag=PQ`,
        headers: { channel: '0146951', uid: '1234' },
      },
      {
        way: 'UNM：MIGUM2.0/strategy/listen-url/v2.4',
        url: `https://app.c.nf.migu.cn/MIGUM2.0/strategy/listen-url/v2.4?netType=01&resourceType=2&songId=${ref.songId}&toneFlag=PQ`,
        headers: {
          origin: 'http://music.migu.cn/',
          referer: 'http://m.music.migu.cn/v3/',
          channel: '0146921',
        },
      },
      {
        way: 'music-lib：MIGUM2.0/v2.1/content/listen-url',
        url: `https://c.musicapp.migu.cn/MIGUM2.0/v2.1/content/listen-url?netType=01&resourceType=2&contentId=${ref.contentId}&toneFlag=PQ&copyrightId=${ref.copyrightId}&songId=${ref.songId}`,
        headers: {
          'user-agent': ANDROID_UA,
          channel: '0146832',
          version: '7.41.13',
          referer: 'https://music.migu.cn/',
        },
      },
    ];
    const results = [];

    for (const way of ways) {
      const entry = await send(`mg 取址 ${way.way}`, way.url, { headers: way.headers });

      try {
        const data = json(entry);
        let url = data.data ? data.data.url : null;

        if (url && url.startsWith('//')) {
          url = `https:${url}`;
        }
        if (url && url.startsWith('ftp://218.200.160.122:21/')) {
          url = `https://freetyst.nf.migu.cn/${url.slice('ftp://218.200.160.122:21/'.length)}`;
        }
        results.push({
          way: way.way,
          url: url || null,
          note: url ? '' : `code=${data.code} ${data.info || data.msg || ''}`.trim(),
        });
      } catch (error) {
        results.push({ way: way.way, url: null, note: error.message });
      }
    }

    return results;
  },
  async playlists() {
    const list = await send(
      'mg 歌单列表 getMusicData.do',
      'https://app.c.nf.migu.cn/MIGUM2.0/v2.0/content/getMusicData.do?count=30&start=1&templateVersion=5&type=1'
    );
    const items = json(list).data.contentItemList[0].itemList;
    const first = items
      .map((item) => ({ title: item.title, id: (/id=([0-9]+)&/.exec(item.actionUrl) || [])[1] }))
      .find((item) => item.id);
    const out = { list: `${items.length} 个歌单` };

    if (!first) {
      return { ...out, detail: '列表里没有取到歌单 id' };
    }
    const info = json(
      await send(
        'mg 歌单详情 resourceinfo.do',
        `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?needSimple=00&resourceType=2021&resourceId=${first.id}`
      )
    );
    const songs = json(
      await send(
        'mg 歌单详情 queryMusicListSongs.do',
        `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=${first.id}&pageNo=1&pageSize=50`
      )
    );

    return {
      ...out,
      detail: `「${info.resource[0].title}」共 ${info.resource[0].musicNum} 首，第 1 页 ${
        (songs.list || []).length
      } 首`,
    };
  },
};

const BODIAN_HEADERS = {
  'user-agent': 'Dart/2.19 (dart:io)',
  plat: 'ar',
  channel: 'aliopen',
  devid: String(Math.floor(Math.random() * 100000000000)),
  ver: '3.9.0',
};

function bodianSign(url) {
  const stamped = `${url}&timestamp=${Date.now()}`;
  const chars = stamped
    .slice(stamped.indexOf('?') + 1)
    .replace(/[^a-zA-Z0-9]/g, '')
    .split('')
    .sort()
    .join('');

  return `${stamped}&sign=${md5(`kuwotest${chars}${new URL(url).pathname}`)}`;
}

const bodian = {
  id: 'bd',
  name: '波点',
  async search(sample) {
    const entry = await send(
      'bd 搜索 search.kuwo.cn/r.s',
      'http://search.kuwo.cn/r.s?&correct=1&vipver=1&stype=comprehensive&encoding=utf8' +
        '&rformat=json&mobi=1&show_copyright_off=1&searchapi=6&all=' +
        encodeURIComponent(`${sample.title} ${sample.artist}`)
    );
    const body = json(entry);
    const page = body.content && body.content[1] ? body.content[1].musicpage : null;

    return {
      songs: ((page && page.abslist) || []).map((song) => ({
        title: song.SONGNAME,
        artist: song.ARTIST,
        seconds: Number(song.DURATION) || 0,
        paid: `payInfo.listen_fragment=${song.payInfo ? song.payInfo.listen_fragment : ''}`,
        ref: String(song.MUSICRID).split('_').pop(),
      })),
      note: '',
    };
  },
  async address(ref) {
    const results = [];

    for (const withAd of [false, true]) {
      if (withAd) {
        await send(
          'bd 看广告 advert/watch',
          'http://bd-api.kuwo.cn/api/service/advert/watch?uid=-1&token=&timestamp=1724306124436&sign=15a676d66285117ad714e8c8371691da',
          {
            method: 'POST',
            headers: {
              ...BODIAN_HEADERS,
              qimei36: '1e9970cbcdc20a031dee9f37100017e1840e',
              'content-type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({ type: 5, subType: 5, musicId: 0, adToken: '' }),
          }
        );
      }
      const way = withAd ? 'audioUrl（先调看广告接口）' : 'audioUrl（不调看广告接口）';
      const entry = await send(
        `bd 取址 ${way}`,
        bodianSign(`http://bd-api.kuwo.cn/api/play/music/v2/audioUrl?&br=320kmp3&musicId=${ref}`),
        { headers: { ...BODIAN_HEADERS, 'X-Forwarded-For': '1.0.1.114' } }
      );

      try {
        const data = json(entry);
        const url = data.data && typeof data.data === 'object' ? data.data.audioUrl : null;

        results.push({
          way,
          url: url || null,
          note: url ? '' : `code=${data.code} ${data.msg || ''}`.trim(),
        });
      } catch (error) {
        results.push({ way, url: null, note: error.message });
      }
      if (results[0].url) {
        break;
      }
    }

    return results;
  },
  playlists: null,
};

function qianqianUrl(host, pathname, params) {
  const all = { ...params, appid: '16073360', timestamp: String(Math.round(Date.now() / 1000)) };
  const keys = Object.keys(all).sort();
  const plain = keys.map((key) => `${key}=${all[key]}`).join('&');
  const sign = md5(`${plain}0b50b02fd0d73a9c4c8c3a781c30845f`);
  const query = keys.map((key) => `${key}=${encodeURIComponent(all[key])}`).join('&');

  return `https://${host}/v1${pathname}?${query}&sign=${sign}`;
}

const QIANQIAN_HOSTS = [
  { host: 'music.91q.com', referer: 'https://music.91q.com/player' },
  { host: 'music.taihe.com', referer: 'https://music.taihe.com/' },
];

async function qianqianGet(label, pathname, params) {
  let last;

  for (const { host, referer } of QIANQIAN_HOSTS) {
    const entry = await send(`th ${label} ${host}`, qianqianUrl(host, pathname, params), {
      headers: { 'user-agent': DESKTOP_UA, referer },
    });

    try {
      const data = json(entry);

      if (data.state !== false || data.errno === 22000) {
        return { data, host };
      }
      last = new Error(`${host}：errno=${data.errno} ${data.errmsg || ''}`);
    } catch (error) {
      last = new Error(`${host}：${error.message}`);
    }
  }
  throw last;
}

const qianqian = {
  id: 'th',
  name: '千千',
  async search(sample) {
    const { data, host } = await qianqianGet('搜索 /search', '/search', {
      word: `${sample.title} ${sample.artist}`,
      type: '1',
      pageNo: '1',
      pageSize: '20',
    });

    return {
      songs: ((data.data && data.data.typeTrack) || []).map((song) => ({
        title: song.title,
        artist: song.artist && song.artist[0] ? song.artist[0].name : '',
        seconds: Number(song.duration) || 0,
        paid: `isVip=${song.isVip}`,
        ref: song.TSID || song.id,
      })),
      note: `经 ${host}`,
    };
  },
  async address(ref) {
    try {
      const { data, host } = await qianqianGet('取址 /song/tracklink', '/song/tracklink', {
        TSID: String(ref),
        rate: '128',
      });
      const info = data.data || {};
      const trial = info.trail_audio_info && info.trail_audio_info.path;

      return [
        {
          way: `/song/tracklink（${host}）`,
          url: info.path || null,
          note: info.path
            ? `rate=${info.rate} format=${info.format}`
            : `path 为空${trial ? '，只有试听片段地址' : ''} errno=${data.errno} ${data.errmsg || ''}`,
        },
      ];
    } catch (error) {
      return [{ way: '/song/tracklink', url: null, note: error.message }];
    }
  },
  async playlists() {
    const { data, host } = await qianqianGet('歌单列表 /tracklist/list', '/tracklist/list', {
      pageNo: '1',
      pageSize: '25',
    });
    const items = (data.data && data.data.result) || [];
    const out = { list: `${items.length} 个歌单（${host}）` };

    if (items.length === 0) {
      return { ...out, detail: '未测' };
    }
    const info = await qianqianGet('歌单详情 /tracklist/info', '/tracklist/info', {
      id: String(items[0].id),
      pageNo: '1',
      pageSize: '100',
    });

    return {
      ...out,
      detail: `「${info.data.data.title}」共 ${info.data.data.trackCount} 首，第 1 页 ${
        (info.data.data.trackList || []).length
      } 首`,
    };
  },
};

// ---- run -------------------------------------------------------------------
async function probeSample(app, candidate, sample) {
  const row = { found: null, paid: '', note: '', ways: [], verdict: '' };

  try {
    const { songs, note } = await candidate.search(sample);
    const match = songs.find((song) => app.isSameSong(song, sample));

    row.note = note;
    if (!match) {
      row.verdict = songs.length ? `搜到 ${songs.length} 条，没有同名同歌手的` : '搜索无结果';

      return row;
    }
    row.found = `${match.title} - ${match.artist}`;
    row.paid = match.paid;
    for (const way of await candidate.address(match.ref)) {
      const audio = way.url ? await checkAudio(way.url) : null;

      row.ways.push({ ...way, audio, verdict: way.url ? judge(audio, match.seconds) : '取址为空' });
    }
    const good = row.ways.find((way) => way.verdict.startsWith('全曲'));

    row.verdict = good ? good.verdict : row.ways.map((way) => way.verdict).join(' / ');
  } catch (error) {
    row.verdict = `出错：${shorten(describeError(error), 100)}`;
  }

  return row;
}

function renderMarkdown(report) {
  const names = report.candidates.map((candidate) => candidate.name);
  const lines = [
    `# 新音源探测：${report.net}`,
    '',
    `- 网络标签：${report.net}（用户告知）`,
    `- 时间：${report.startedAt}`,
    `- 代码：${report.commit}${report.dirty ? '（工作区有未提交改动）' : ''}`,
    `- 运行环境：Node ${process.version}，${process.platform}`,
    '',
    '单次、单一网络下的结果。某项可用或不可用的结论要有两种网络下的结果才算确认。',
    '',
    '## 歌单列表与歌单详情',
    '',
    '| 候选 | 歌单列表 | 歌单详情 |',
    '|---|---|---|',
  ];

  for (const candidate of report.candidates) {
    lines.push(`| ${candidate.name} | ${candidate.playlists.list} | ${candidate.playlists.detail} |`);
  }
  lines.push(
    '',
    '## 搜索与取址',
    '',
    `| 样本 | ${report.baselineNames.join(' | ')} | ${names.join(' | ')} |`,
    `|---|${report.baselineNames.map(() => '---').join('|')}|${names.map(() => '---').join('|')}|`
  );
  for (const sample of report.samples) {
    lines.push(
      `| ${sample.title} - ${sample.artist} | ${report.baselineNames
        .map((name) => sample.baseline[name])
        .join(' | ')} | ${names.map((name) => sample.rows[name].verdict.replace(/\|/g, '/')).join(' | ')} |`
    );
  }
  lines.push('', '## 明细');
  for (const sample of report.samples) {
    lines.push('', `### ${sample.title} - ${sample.artist}`);
    for (const name of names) {
      const row = sample.rows[name];

      lines.push(
        '',
        `**${name}**：${row.verdict}` +
          (row.found ? `；匹配到「${row.found}」，${row.paid}` : '') +
          (row.note ? `；${row.note}` : '')
      );
      for (const way of row.ways) {
        const audio = way.audio
          ? way.audio.error ||
            `HTTP ${way.audio.status}，${way.audio.contentType}，${way.audio.bytes} 字节，开头 ${way.audio.magic}`
          : '';

        lines.push(
          `- ${way.way}：${way.verdict}${way.note ? `（${way.note}）` : ''}${audio ? `；${audio}` : ''}` +
            (way.url ? `；\`${shorten(way.url, 110)}\`` : '')
        );
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

const git = (command) => {
  try {
    return execSync(command, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (error) {
    return '';
  }
};

const app = await loadApp();
const only = args.only ? args.only.split(',') : null;
const chosen = [migu, bodian, qianqian].filter((candidate) => !only || only.includes(candidate.id));
const started = new Date();
const report = {
  net: args.net,
  startedAt: String(started),
  commit: git('git rev-parse --short HEAD'),
  dirty: git('git status --porcelain') !== '',
  baselineNames: app.Client.getPlatformArray().map((platform) => platform.name),
  candidates: [],
  samples: [],
};

for (const candidate of chosen) {
  let playlists = { list: '没有已知接口', detail: '没有已知接口' };

  if (candidate.playlists) {
    try {
      playlists = await candidate.playlists();
    } catch (error) {
      playlists = { list: `出错：${shorten(describeError(error), 100)}`, detail: '未测', ...error.partial };
    }
  }
  report.candidates.push({ id: candidate.id, name: candidate.name, playlists });
  process.stderr.write(`${candidate.name} 歌单：${playlists.list} / ${playlists.detail}\n`);
}
for (const sample of SAMPLES) {
  const entry = { ...sample, baseline: await baseline(app, sample), rows: {} };

  for (const candidate of chosen) {
    entry.rows[candidate.name] = await probeSample(app, candidate, sample);
  }
  report.samples.push(entry);
  process.stderr.write(
    `${sample.title}：${report.baselineNames.map((name) => entry.baseline[name]).join('/')} → ${chosen
      .map((candidate) => `${candidate.name} ${entry.rows[candidate.name].verdict}`)
      .join('；')}\n`
  );
}
report.requests = log;

const pad = (n) => String(n).padStart(2, '0');
const stamp =
  `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}-` +
  `${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
const outDir = args.out ? path.resolve(args.out) : path.join(repoRoot, 'references', 'probe');
const base = path.join(outDir, `${stamp}-new-providers-${args.net}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
writeFileSync(`${base}.md`, renderMarkdown(report));
process.stdout.write(`${base}.md\n`);
