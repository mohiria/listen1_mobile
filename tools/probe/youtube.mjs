// Probe YouTube for A-12: can a guest, with plain requests and no script of
// YouTube's run, search for a song and get an address iOS can play.
//
//   node tools/probe/youtube.mjs --net <网络标签> [--out 目录]
//
// Search goes to YouTube Music (songs only). The address is asked of every
// client that yt-dlp lists as needing no player script; the client names and
// versions are yt-dlp's of 2026-11-27. The network label is recorded as given.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const GAP_MS = 800;
const TIMEOUT_MS = 15000;
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
const CLIENTS = [
  {
    key: 'ios',
    id: '5',
    client: {
      clientName: 'IOS',
      clientVersion: '21.26.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.3.2.22D82',
    },
    ua: 'com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
  },
  {
    key: 'android_vr',
    id: '28',
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.65.10',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      androidSdkVersion: 32,
      osName: 'Android',
      osVersion: '12L',
    },
    ua: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
  },
  {
    key: 'android',
    id: '3',
    client: {
      clientName: 'ANDROID',
      clientVersion: '21.26.364',
      androidSdkVersion: 30,
      osName: 'Android',
      osVersion: '11',
    },
    ua: 'com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip',
  },
  {
    key: 'visionos',
    id: '101',
    client: {
      clientName: 'VISIONOS',
      clientVersion: '1.02',
      deviceMake: 'Apple',
      deviceModel: 'RealityDevice17,1',
      osName: 'visionOS',
      osVersion: '26.5.23O471',
    },
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  },
];

const netAt = process.argv.indexOf('--net');
const outAt = process.argv.indexOf('--out');
const net = netAt > 0 ? process.argv[netAt + 1] : null;

if (!net) {
  process.stderr.write('用法: node tools/probe/youtube.mjs --net <网络标签> [--out 目录]\n');
  process.exit(2);
}
if (!existsSync(path.join(here, 'node_modules', 'esbuild'))) {
  process.stderr.write('缺少依赖，先执行: npm install --prefix tools/probe\n');
  process.exit(2);
}

async function loadMatch() {
  const esbuild = await import('esbuild');
  const outfile = path.join(here, 'node_modules', '.cache', 'youtube-match.mjs');

  await esbuild.build({
    entryPoints: [path.join(repoRoot, 'src', 'api', 'match.js')],
    bundle: true,
    format: 'esm',
    outfile,
    logLevel: 'error',
  });

  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shorten = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);
const log = [];

function describeError(error) {
  const cause = error && error.cause ? ` (${error.cause.code || error.cause.message})` : '';

  return `${(error && error.name) || 'Error'}: ${error && error.message}${cause}`;
}

async function send(label, url, init) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const entry = { label, url, method: (init && init.method) || 'GET' };

  await sleep(GAP_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    entry.status = response.status;
    entry.contentType = response.headers.get('content-type');
    entry.range = response.headers.get('content-range');
    entry.buffer = Buffer.from(await response.arrayBuffer());
    entry.body = shorten(entry.buffer.subarray(0, 600).toString('utf8'), 500);
  } catch (error) {
    entry.error = describeError(error);
  } finally {
    clearTimeout(timer);
  }
  entry.ms = Date.now() - started;
  log.push({ ...entry, buffer: undefined, body: /json|text|mpegurl/i.test(entry.contentType || '') ? entry.body : '' });

  return entry;
}

const runs = (node) => ((node && node.runs) || []).map((run) => run.text).join('');

// Songs of YouTube Music for the keyword: { videoId, title, artist, seconds }.
async function searchSongs(keyword) {
  const entry = await send('搜索 music.youtube.com search（只要歌曲）', 'https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://music.youtube.com',
      'x-youtube-client-name': '67',
      'x-youtube-client-version': '1.20260707.12.00',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20260707.12.00', hl: 'zh-CN', gl: 'US' } },
      query: keyword,
      params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==',
    }),
  });

  if (entry.error) {
    throw new Error(entry.error);
  }
  if (entry.status !== 200) {
    throw new Error(`HTTP ${entry.status}：${entry.body.slice(0, 120)}`);
  }
  const songs = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.musicResponsiveListItemRenderer) {
      const item = node.musicResponsiveListItemRenderer;
      const columns = (item.flexColumns || []).map(
        (column) => column.musicResponsiveListItemFlexColumnRenderer.text
      );
      const second = ((columns[1] && columns[1].runs) || []).map((run) => run.text);
      const length = second.find((text) => /^\d+(:\d\d)+$/.test(text));

      if (item.playlistItemData && item.playlistItemData.videoId) {
        songs.push({
          videoId: item.playlistItemData.videoId,
          title: runs(columns[0]),
          artist: second[0] || '',
          seconds: length ? length.split(':').reduce((sum, part) => sum * 60 + Number(part), 0) : 0,
        });
      }

      return;
    }
    Object.values(node).forEach(walk);
  };

  walk(JSON.parse(entry.buffer.toString('utf8')));

  return songs;
}

// What one client gives for the video, and whether the addresses open.
async function askClient(spec, videoId) {
  const out = { client: spec.key };
  const entry = await send(`取址 player（${spec.key}）`, 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': spec.ua,
      'x-youtube-client-name': spec.id,
      'x-youtube-client-version': spec.client.clientVersion,
    },
    body: JSON.stringify({
      context: { client: { ...spec.client, hl: 'zh-CN', gl: 'US' } },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });

  if (entry.error || entry.status !== 200) {
    out.verdict = `player 请求失败：${entry.error || `HTTP ${entry.status}`}`;

    return out;
  }
  const data = JSON.parse(entry.buffer.toString('utf8'));
  const status = data.playabilityStatus || {};
  const streaming = data.streamingData || {};
  const audio = (streaming.adaptiveFormats || []).filter((format) => /^audio\/mp4/.test(format.mimeType));
  const direct = audio.find((format) => format.itag === 140 && format.url) || audio.find((format) => format.url);

  out.playability = `${status.status}${status.reason ? `（${status.reason}）` : ''}`;
  out.audioMp4 = audio.length;
  out.audioMp4WithUrl = audio.filter((format) => format.url).length;
  out.onlyCipher = audio.filter((format) => format.signatureCipher).length;
  out.sabr = Boolean(streaming.serverAbrStreamingUrl);
  out.hls = Boolean(streaming.hlsManifestUrl);
  if (direct) {
    const size = Number(direct.contentLength) || 0;
    const first = await send(`音频 itag ${direct.itag} 开头（${spec.key}）`, direct.url, {
      headers: { 'user-agent': spec.ua, Range: 'bytes=0-2047' },
    });
    const from = Math.max(0, Math.floor(size / 2));
    const middle = await send(`音频 itag ${direct.itag} 中段（${spec.key}）`, direct.url, {
      headers: { 'user-agent': spec.ua, Range: `bytes=${from}-${from + 2047}` },
    });
    const bare = await send(`音频 itag ${direct.itag} 中段，不带 UA（${spec.key}）`, direct.url, {
      headers: { Range: `bytes=${from}-${from + 2047}` },
    });

    out.direct = {
      itag: direct.itag,
      mime: direct.mimeType,
      bytes: size,
      seconds: Math.round(Number(direct.approxDurationMs) / 1000) || 0,
      first: first.error || first.status,
      middle: middle.error || middle.status,
      middleWithoutUa: bare.error || bare.status,
    };
  }
  if (streaming.hlsManifestUrl) {
    const manifest = await send(`HLS 清单（${spec.key}）`, streaming.hlsManifestUrl, {
      headers: { 'user-agent': spec.ua },
    });
    const text = manifest.buffer ? manifest.buffer.toString('utf8') : '';

    out.hlsManifest = {
      status: manifest.error || manifest.status,
      audioOnly: (text.match(/#EXT-X-MEDIA:[^\n]*TYPE=AUDIO/g) || []).length,
      variants: (text.match(/#EXT-X-STREAM-INF/g) || []).length,
    };
  }
  const directOk = out.direct && out.direct.first === 206 && out.direct.middle === 206;
  const hlsOk = out.hlsManifest && out.hlsManifest.status === 200;

  out.verdict = directOk
    ? `m4a 可直接取（${Math.round(out.direct.bytes / 1024)}KB，${out.direct.seconds} 秒）`
    : hlsOk
      ? `只有 HLS 清单可取（音频轨 ${out.hlsManifest.audioOnly}，视频档 ${out.hlsManifest.variants}）`
      : `不可取：${out.playability}` +
        (out.direct ? `，m4a 开头 ${out.direct.first}、中段 ${out.direct.middle}` : `，带地址的 m4a ${out.audioMp4WithUrl}/${out.audioMp4}`) +
        (out.sabr ? '，有 SABR' : '');
  if (directOk && hlsOk) {
    out.verdict += '；另有 HLS 清单';
  }

  return out;
}

const { isSameSong } = await loadMatch();
const started = new Date();
const report = { net, startedAt: String(started), samples: [] };

for (const sample of SAMPLES) {
  const row = { ...sample, found: null, how: '', clients: [] };

  try {
    const songs = await searchSongs(`${sample.title} ${sample.artist}`);
    const same = songs.find((song) => isSameSong(song, sample));
    const pick = same || songs[0];

    row.results = songs.slice(0, 5).map((song) => `${song.title} - ${song.artist}`);
    if (pick) {
      row.found = `${pick.title} - ${pick.artist}`;
      row.how = same ? '歌名与歌手都相同' : '没有歌名与歌手都相同的，取第一条';
      row.videoId = pick.videoId;
      for (const spec of CLIENTS) {
        row.clients.push(await askClient(spec, pick.videoId));
      }
    } else {
      row.how = '搜索无结果';
    }
  } catch (error) {
    row.how = `搜索出错：${shorten(describeError(error), 120)}`;
  }
  report.samples.push(row);
  process.stderr.write(
    `${sample.title}：${row.found || row.how}${row.found ? `（${row.how}）` : ''}\n` +
      row.clients.map((client) => `    ${client.client}: ${client.verdict}\n`).join('')
  );
}
report.requests = log;

const lines = [
  `# YouTube 探测：${net}`,
  '',
  `- 网络标签：${net}（用户告知）`,
  `- 时间：${report.startedAt}`,
  `- 运行环境：Node ${process.version}，${process.platform}`,
  '- 访客身份，不带 cookie，不执行 YouTube 的任何脚本，不带 PO Token。',
  '',
  '单次、单一网络下的结果。某项可用或不可用的结论要有两种网络下的结果才算确认。',
  '',
  `| 样本 | 搜到的歌曲 | ${CLIENTS.map((spec) => spec.key).join(' | ')} |`,
  `|---|---|${CLIENTS.map(() => '---').join('|')}|`,
];

for (const row of report.samples) {
  lines.push(
    `| ${row.title} - ${row.artist} | ${row.found ? `${row.found}（${row.how}）` : row.how} | ${CLIENTS.map(
      (spec) => ((row.clients.find((client) => client.client === spec.key) || {}).verdict || '未测').replace(/\|/g, '/')
    ).join(' | ')} |`
  );
}
lines.push('', '## 搜索返回的前 5 条');
for (const row of report.samples) {
  lines.push('', `- ${row.title} - ${row.artist}：${(row.results || []).join('；') || row.how}`);
}

const pad = (n) => String(n).padStart(2, '0');
const stamp =
  `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}-` +
  `${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}`;
const outDir = outAt > 0 ? path.resolve(process.argv[outAt + 1]) : path.join(repoRoot, 'references', 'probe');
const base = path.join(outDir, `${stamp}-youtube-${net}`);

report.commit = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
mkdirSync(outDir, { recursive: true });
writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
writeFileSync(`${base}.md`, `${lines.join('\n')}\n`);
process.stdout.write(`${base}.md\n`);
