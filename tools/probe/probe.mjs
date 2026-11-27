// Probe every provider's four capabilities (playlist list, playlist detail,
// search, track URL) by running the app's own src/api/client.ts under Node.
//
//   node tools/probe/probe.mjs --net <网络标签> [--only ne,qq] [--keyword 周杰伦]
//
// The network label is whatever the user says the current network is. It is
// recorded as-is; nothing here inspects the network.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const STEP_TIMEOUT_MS = 30000;
const TRACKS_PER_PROVIDER = 3;
const ABILITIES = [
  ['showPlaylist', '歌单列表'],
  ['getPlaylist', '歌单详情'],
  ['search', '搜索'],
  ['bootstrapTrack', '取址'],
];

function parseArgs(argv) {
  const args = { net: null, only: null, keyword: '周杰伦', out: null };

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
    '用法: node tools/probe/probe.mjs --net <网络标签> [--only ne,kg,kw,qq] [--keyword 关键词] [--out 目录]\n'
  );
  process.exit(2);
}
if (!existsSync(path.join(here, 'node_modules', 'esbuild'))) {
  process.stderr.write('缺少依赖，先执行: npm install --prefix tools/probe\n');
  process.exit(2);
}

// ---- request log -----------------------------------------------------------
// Providers swallow errors and return undefined, so the only way to know why a
// step failed is to watch the requests it made.
const realFetch = globalThis.fetch;
const pendingBodies = [];
let currentLog = null;

function shorten(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

globalThis.fetch = (input, init) => {
  const log = currentLog;
  const entry = {
    method: ((init && init.method) || 'GET').toUpperCase(),
    url: shorten(String(input), 300),
    status: null,
    ms: null,
    error: null,
    body: null,
  };
  const started = Date.now();

  if (log) {
    log.push(entry);
  }

  return realFetch(input, init).then(
    (response) => {
      entry.status = response.status;
      entry.ms = Date.now() - started;
      entry.contentType = response.headers.get('content-type');
      if (response.url && response.url !== String(input)) {
        entry.finalUrl = shorten(response.url, 300);
      }
      pendingBodies.push(
        response
          .clone()
          .text()
          .then((text) => {
            entry.body = shorten(text, 300);
          })
          .catch(() => {})
      );

      return response;
    },
    (error) => {
      entry.ms = Date.now() - started;
      entry.error = describeError(error);
      throw error;
    }
  );
};

function describeError(error) {
  if (!error) {
    return String(error);
  }
  const cause = error.cause
    ? ` (${error.cause.code || error.cause.message || error.cause})`
    : '';

  return `${error.name || 'Error'}: ${error.message}${cause}`;
}

// ---- load the app's source layer ------------------------------------------
async function loadClient() {
  const esbuild = await import('esbuild');
  const outfile = path.join(here, 'node_modules', '.cache', 'client.mjs');

  await esbuild.build({
    entryPoints: [path.join(repoRoot, 'src', 'api', 'client.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'error',
    nodePaths: [path.join(here, 'node_modules')],
    alias: {
      '@react-native-community/async-storage': path.join(
        here,
        'async-storage.js'
      ),
    },
  });

  // The vendored crypto libraries expect a browser-ish global.
  if (globalThis.window === undefined) {
    globalThis.window = globalThis;
  }

  return (await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`))
    .default;
}

// ---- steps -----------------------------------------------------------------
async function runStep(fn) {
  const requests = [];
  const started = Date.now();
  let timer;
  let outcome;

  currentLog = requests;
  try {
    const value = await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`超过 ${STEP_TIMEOUT_MS / 1000} 秒未返回`)),
          STEP_TIMEOUT_MS
        );
      }),
    ]);

    outcome = { value };
  } catch (error) {
    outcome = { error: describeError(error) };
  }
  clearTimeout(timer);
  currentLog = null;

  return { ...outcome, ms: Date.now() - started, requests };
}

function cell(status, note, step) {
  return {
    status,
    note,
    ms: step ? step.ms : null,
    requests: step ? step.requests : [],
  };
}

function judgeList(step, pick, unit) {
  if (step.error) {
    return cell('失败', step.error, step);
  }
  if (step.value === undefined || step.value === null) {
    return cell('失败', '返回空值（音源代码吞掉了错误，见请求记录）', step);
  }
  const items = pick(step.value);

  if (!Array.isArray(items)) {
    return cell('失败', '返回结构不符', step);
  }
  if (items.length === 0) {
    return cell('失败', `0 ${unit}`, step);
  }

  return cell('通过', `${items.length} ${unit}`, step);
}

async function checkAudio(url) {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
    const range = response.headers.get('content-range');
    const total = range
      ? Number(range.split('/').pop())
      : Number(response.headers.get('content-length'));

    await response.arrayBuffer();

    return {
      ok: response.status === 200 || response.status === 206,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes: Number.isFinite(total) ? total : null,
    };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

async function probeTracks(Client, tracks) {
  const picked = tracks
    .filter((track) => track && track.id && !track.disabled)
    .slice(0, TRACKS_PER_PROVIDER);

  if (picked.length === 0) {
    return cell('未测', '搜索与歌单详情都没给出可用的歌曲');
  }

  const results = [];
  const requests = [];
  let ms = 0;

  for (const track of picked) {
    const step = await runStep(async () => {
      const url = await Client.bootstrapTrack(track.id);

      if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
        return { url: url === undefined ? null : url, audio: null };
      }

      return { url, audio: await checkAudio(url) };
    });
    const result = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      error: step.error || null,
      url: step.value ? step.value.url : null,
      audio: step.value ? step.value.audio : null,
    };

    result.ok = Boolean(result.audio && result.audio.ok);
    results.push(result);
    requests.push(...step.requests);
    ms += step.ms;
  }

  const okCount = results.filter((result) => result.ok).length;
  const status =
    okCount === results.length ? '通过' : okCount === 0 ? '失败' : '部分';
  const sizes = results
    .filter((result) => result.ok && result.audio.bytes)
    .map((result) => `${Math.round(result.audio.bytes / 1024)}KB`);

  // Different songs with byte-identical length are most likely the same
  // placeholder clip rather than the songs themselves.
  const byteCounts = results
    .filter((result) => result.ok && result.audio.bytes)
    .map((result) => result.audio.bytes);
  const repeated = byteCounts.filter(
    (bytes) => byteCounts.indexOf(bytes) !== byteCounts.lastIndexOf(bytes)
  ).length;

  return {
    status,
    note:
      `${okCount}/${results.length} 首取到可下载地址` +
      (sizes.length ? `（${sizes.join('、')}）` : '') +
      (repeated ? `，${repeated} 首大小完全相同，疑似不是歌曲本身` : ''),
    ms,
    requests,
    tracks: results,
  };
}

async function probeProvider(Client, platform, keyword) {
  const id = platform.platformId;
  const cells = {};

  const listStep = await runStep(() => Client.showPlaylist(0, id));

  cells.showPlaylist = judgeList(listStep, (value) => value.result, '个歌单');

  const playlists =
    cells.showPlaylist.status === '通过' ? listStep.value.result : [];
  let playlistTracks = [];

  if (playlists.length === 0) {
    cells.getPlaylist = cell('未测', '歌单列表没给出歌单编号');
  } else {
    const detailStep = await runStep(async () => {
      const detail = await Client.getPlaylist(playlists[0].id);

      if (detail && Array.isArray(detail.tracks)) {
        detail.tracks = await Promise.all(detail.tracks);
      }

      return detail;
    });

    cells.getPlaylist = judgeList(detailStep, (value) => value.tracks, '首');
    cells.getPlaylist.note += `（${playlists[0].id}）`;
    if (cells.getPlaylist.status === '通过') {
      playlistTracks = detailStep.value.tracks;
      const untitled = playlistTracks.filter((track) => !track.title).length;

      if (untitled > 0) {
        cells.getPlaylist.status = '部分';
        cells.getPlaylist.note += `，其中 ${untitled} 首没有歌名`;
      }
    }
  }

  const searchStep = await runStep(() => Client.search(keyword, 1, id));
  let searchTracks = [];

  cells.search = judgeList(searchStep, (value) => value.result, '首');
  if (cells.search.status === '通过') {
    searchTracks = searchStep.value.result;
    const disabled = searchTracks.filter((track) => track.disabled).length;

    cells.search.note += `，其中受限 ${disabled} 首`;
  }

  const fromSearch = searchTracks.some((track) => !track.disabled);

  cells.bootstrapTrack = await probeTracks(
    Client,
    fromSearch ? searchTracks : playlistTracks
  );
  if (cells.bootstrapTrack.tracks) {
    cells.bootstrapTrack.note += fromSearch
      ? '，歌曲取自搜索'
      : '，歌曲取自歌单详情';
  }

  return { platformId: id, name: platform.name, cells };
}

// ---- report ----------------------------------------------------------------
function describeRequest(request) {
  const outcome = request.error
    ? request.error
    : request.status === null
    ? '未返回'
    : `HTTP ${request.status}`;
  const lines = [
    `  - ${request.method} ${request.url} → ${outcome}` +
      (request.ms === null ? '' : `，${request.ms}ms`),
  ];

  if (request.finalUrl) {
    lines.push(`    - 重定向到 ${request.finalUrl}`);
  }
  // U+FFFD or NUL means the body was binary, whatever the content type said.
  if (request.body && !/[�\u0000]/.test(request.body)) {
    lines.push(`    - 响应开头：\`${request.body.replace(/\s+/g, ' ').replace(/`/g, "'")}\``);
  }

  return lines.join('\n');
}

function renderMarkdown(report) {
  const lines = [
    `# 音源探测：${report.net}`,
    '',
    `- 网络标签：${report.net}（用户告知）`,
    `- 时间：${report.startedAt}`,
    `- 代码：${report.commit}${report.dirty ? '（工作区有未提交改动）' : ''}`,
    `- 运行环境：Node ${process.version}，${process.platform}`,
    `- 搜索关键词：${report.keyword}`,
    '',
    '单次、单一网络下的结果。某项可用或不可用的结论要有两种网络下的结果才算确认。',
    '',
    `| 音源 | ${ABILITIES.map(([, label]) => label).join(' | ')} |`,
    `|---|${ABILITIES.map(() => '---').join('|')}|`,
  ];

  for (const provider of report.providers) {
    const cols = ABILITIES.map(([key]) => {
      const c = provider.cells[key];

      return `${c.status}：${c.note.replace(/\|/g, '/')}`;
    });

    lines.push(`| ${provider.name} | ${cols.join(' | ')} |`);
  }

  lines.push('', '## 明细');
  for (const provider of report.providers) {
    lines.push('', `### ${provider.name}`);
    for (const [key, label] of ABILITIES) {
      const c = provider.cells[key];

      lines.push(
        '',
        `**${label}**：${c.status}，${c.note}` +
          (c.ms === null ? '' : `，耗时 ${c.ms}ms`)
      );
      for (const track of c.tracks || []) {
        const audio = track.audio
          ? track.audio.error ||
            `HTTP ${track.audio.status}，${track.audio.contentType}，${track.audio.bytes} 字节`
          : track.error || `取址返回 ${JSON.stringify(track.url)}`;

        lines.push(`- ${track.artist} - ${track.title}（${track.id}）：${audio}`);
      }
      // Passing steps keep their request log in the JSON only.
      if (c.status !== '通过' && c.requests.length > 0) {
        lines.push('- 请求记录：', ...c.requests.slice(0, 8).map(describeRequest));
        if (c.requests.length > 8) {
          lines.push(`  - 另有 ${c.requests.length - 8} 条，见同名 JSON`);
        }
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (error) {
    return '';
  }
}

function timestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');

  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

async function main() {
  const Client = await loadClient();
  const only = args.only ? args.only.split(',') : null;
  const platforms = Client.getPlatformArray().filter(
    (platform) => !only || only.includes(platform.platformId)
  );
  const now = new Date();
  const report = {
    net: args.net,
    startedAt: now.toString(),
    commit: git('rev-parse --short HEAD') || '未知',
    dirty: git('status --porcelain -- src vendor') !== '',
    keyword: args.keyword,
    providers: [],
  };

  // Provider code logs cookies to the console; keep them out of the output.
  const realLog = console.log;

  console.log = () => {};
  for (const platform of platforms) {
    process.stdout.write(`探测 ${platform.name} …\n`);
    report.providers.push(await probeProvider(Client, platform, args.keyword));
  }
  console.log = realLog;

  await Promise.race([
    Promise.allSettled(pendingBodies),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);

  const outDir = path.resolve(args.out || path.join(repoRoot, 'references', 'probe'));
  const base = path.join(
    outDir,
    `${timestamp(now)}-${args.net.replace(/[\\/:*?"<>|\s]+/g, '_')}`
  );
  const markdown = renderMarkdown(report);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${base}.md`, markdown);
  writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));

  process.stdout.write(`\n${markdown.split('\n## 明细')[0]}\n`);
  process.stdout.write(`存档：${base}.md\n      ${base}.json\n`);
}

main().then(
  // Requests that never return would otherwise keep the process alive.
  () => process.exit(0),
  (error) => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  }
);
