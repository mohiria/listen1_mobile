// Probe the playlist search of every provider (A-15), and check that a found
// playlist opens with the app's own getPlaylist from src/api/client.ts.
//
//   node tools/probe/playlist-search.mjs --net <网络标签> [--keywords 周杰伦,粤语,纯音乐] [--only ne,qq,kw,kg]
//
// Each provider has one main candidate and some alternatives. Every candidate
// is asked once per keyword (page 1); the main one is also asked for page 2 of
// the first keyword. Requests are spaced out. The network label is recorded
// as given; nothing here inspects the network.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const GAP_MS = 1000;
const TIMEOUT_MS = 15000;
const PAGE_SIZE = 20;
const UA =
  'Mozilla/5.0 (Linux; U; Android 8.1.0; zh-cn; BLA-AL00 Build/HUAWEIBLA-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.132 MQQBrowser/8.9 Mobile Safari/537.36';

function parseArgs(argv) {
  const args = { net: null, keywords: '周杰伦,粤语,纯音乐', only: null, out: null };

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
    '用法: node tools/probe/playlist-search.mjs --net <网络标签> [--keywords 周杰伦,粤语,纯音乐] [--only ne,qq,kw,kg] [--out 目录]\n'
  );
  process.exit(2);
}
if (!existsSync(path.join(here, 'node_modules', 'esbuild'))) {
  process.stderr.write('缺少依赖，先执行: npm install --prefix tools/probe\n');
  process.exit(2);
}

// ---- load the app's source layer (client and netease's weapi) -------------
async function loadApp() {
  const esbuild = await import('esbuild');
  const outfile = path.join(here, 'node_modules', '.cache', 'playlist-search.mjs');

  await esbuild.build({
    stdin: {
      contents:
        "export { default as Client } from './src/api/client';\n" +
        "export { weapi } from './src/modules/crypto';\n",
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
const form = (object) => new URLSearchParams(object).toString();
const shorten = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);

function describeError(error) {
  const cause = error && error.cause ? ` (${error.cause.code || error.cause.message})` : '';

  return `${(error && error.name) || 'Error'}: ${error && error.message}${cause}`;
}

async function send(request) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(request.url, { ...request.init, signal: controller.signal });
    const text = await response.text();

    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      ms: Date.now() - started,
      text,
    };
  } catch (error) {
    return { error: describeError(error), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

// ---- candidates ------------------------------------------------------------
// parse(text) returns { playlists: [{ id, title, cover, creator, trackCount,
// playCount }], total } or throws. id carries the app's prefix.
function candidates(weapi) {
  return {
    ne: [
      {
        name: 'weapi/cloudsearch/pc type=1000',
        main: true,
        build: (keyword, page) => ({
          url: 'https://music.163.com/weapi/cloudsearch/pc',
          init: {
            method: 'POST',
            headers: {
              referer: 'https://music.163.com/',
              'content-type': 'application/x-www-form-urlencoded',
              'user-agent': UA,
            },
            body: form(
              weapi({
                csrf_token: '',
                limit: String(PAGE_SIZE),
                offset: String(PAGE_SIZE * (page - 1)),
                s: keyword,
                total: 'true',
                type: '1000',
              })
            ),
          },
        }),
        parse: (text) => {
          const data = JSON.parse(text);

          if (data.code !== 200) {
            throw new Error(`code ${data.code} ${data.message || ''}`);
          }

          return {
            playlists: (data.result.playlists || []).map((item) => ({
              id: `neplaylist_${item.id}`,
              title: item.name,
              cover: item.coverImgUrl,
              creator: item.creator && item.creator.nickname,
              trackCount: item.trackCount,
              playCount: item.playCount,
            })),
            total: data.result.playlistCount,
            extra: { hasMore: data.result.hasMore },
          };
        },
      },
      {
        name: 'api/search/pc type=1000（不加密）',
        build: (keyword, page) => ({
          url: 'https://music.163.com/api/search/pc',
          init: {
            method: 'POST',
            headers: {
              referer: 'https://music.163.com/',
              'content-type': 'application/x-www-form-urlencoded',
              'user-agent': UA,
            },
            body: form({ s: keyword, offset: PAGE_SIZE * (page - 1), limit: PAGE_SIZE, type: 1000 }),
          },
        }),
        parse: (text) => {
          const data = JSON.parse(text);

          if (data.code !== 200) {
            throw new Error(`code ${data.code} ${data.message || ''}`);
          }

          return {
            playlists: (data.result.playlists || []).map((item) => ({
              id: `neplaylist_${item.id}`,
              title: item.name,
              cover: item.coverImgUrl,
              creator: item.creator && item.creator.nickname,
              trackCount: item.trackCount,
              playCount: item.playCount,
            })),
            total: data.result.playlistCount,
          };
        },
      },
    ],
    qq: [
      {
        name: 'c.y.qq.com soso/client_music_search_songlist',
        main: true,
        build: (keyword, page) => ({
          url:
            'https://c.y.qq.com/soso/fcgi-bin/client_music_search_songlist?remoteplace=txt.yqq.playlist' +
            `&page_no=${page - 1}&num_per_page=${PAGE_SIZE}&query=${encodeURIComponent(keyword)}` +
            '&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq.json&needNewCode=0',
          init: { headers: { Referer: 'https://y.qq.com/' } },
        }),
        parse: (text) => {
          const data = JSON.parse(text);

          if (data.code !== 0) {
            throw new Error(`code ${data.code} ${data.message || ''}`);
          }

          return {
            playlists: (data.data.list || []).map((item) => ({
              id: `qqplaylist_${item.dissid}`,
              title: item.dissname,
              cover: item.imgurl,
              creator: item.creator && item.creator.name,
              trackCount: item.song_count,
              playCount: item.listennum,
            })),
            total: data.data.sum,
            extra: { display_num: data.data.display_num, page_no: data.data.page_no },
          };
        },
      },
      {
        name: 'u.y.qq.com musicu.fcg DoSearchForQQMusicDesktop search_type=3',
        build: (keyword, page) => ({
          url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
          init: {
            method: 'POST',
            headers: { Referer: 'https://y.qq.com/', 'content-type': 'application/json' },
            body: JSON.stringify({
              comm: { ct: '19', cv: '1859', uin: '0' },
              req: {
                method: 'DoSearchForQQMusicDesktop',
                module: 'music.search.SearchCgiService',
                param: { grp: 1, num_per_page: PAGE_SIZE, page_num: page, query: keyword, search_type: 3 },
              },
            }),
          },
        }),
        parse: (text) => {
          const data = JSON.parse(text);

          if (data.req.code !== 0) {
            throw new Error(`req.code ${data.req.code}`);
          }

          return {
            playlists: data.req.data.body.songlist.list.map((item) => ({
              id: `qqplaylist_${item.dissid}`,
              title: item.dissname,
              cover: item.imgurl,
              creator: item.creator && item.creator.name,
              trackCount: item.song_count,
              playCount: item.listennum,
            })),
            total: data.req.data.meta.sum,
          };
        },
      },
    ],
    kw: [
      {
        name: 'search.kuwo.cn/r.s ft=playlist',
        main: true,
        build: (keyword, page) => ({
          url:
            `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(keyword)}` +
            `&pn=${page - 1}&rn=${PAGE_SIZE}&vipver=1&ft=playlist&encoding=utf8&rformat=json&mobi=1`,
        }),
        parse: (text) => {
          const data = JSON.parse(text);

          return {
            playlists: (data.abslist || []).map((item) => ({
              id: `kwplaylist_${item.playlistid}`,
              title: item.name,
              cover: item.pic,
              creator: item.nickname,
              trackCount: Number(item.songnum),
              playCount: Number(item.playcnt),
            })),
            total: Number(data.TOTAL),
            extra: { PN: data.PN, RN: data.RN, HIT: data.HIT },
          };
        },
      },
      {
        name: 'www.kuwo.cn/api/www/search/searchPlayListBykeyWord（不带令牌）',
        build: (keyword, page) => ({
          url:
            'https://www.kuwo.cn/api/www/search/searchPlayListBykeyWord' +
            `?key=${encodeURIComponent(keyword)}&pn=${page}&rn=${PAGE_SIZE}&httpsStatus=1`,
          init: { headers: { Referer: 'https://www.kuwo.cn/' } },
        }),
        parse: (text) => {
          const data = JSON.parse(text);

          return {
            playlists: data.data.list.map((item) => ({
              id: `kwplaylist_${item.id}`,
              title: item.name,
              cover: item.img,
              creator: item.uname,
              trackCount: Number(item.total),
              playCount: Number(item.listencnt),
            })),
            total: Number(data.data.total),
          };
        },
      },
    ],
    kg: [
      {
        name: 'mobilecdnbj.kugou.com/api/v3/search/special',
        main: true,
        build: (keyword, page) => ({
          url:
            `http://mobilecdnbj.kugou.com/api/v3/search/special?keyword=${encodeURIComponent(keyword)}` +
            `&pagesize=${PAGE_SIZE}&filter=0&page=${page}`,
        }),
        parse: parseKugou,
      },
      {
        name: 'msearchretry.kugou.com/api/v3/search/special',
        build: (keyword, page) => ({
          url:
            `http://msearchretry.kugou.com/api/v3/search/special?keyword=${encodeURIComponent(keyword)}` +
            `&page=${page}&pagesize=${PAGE_SIZE}&showtype=10&filter=0&version=7910&sver=2`,
        }),
        parse: parseKugou,
      },
    ],
  };
}

function parseKugou(text) {
  const data = JSON.parse(text);

  if (data.errcode !== 0) {
    throw new Error(`errcode ${data.errcode} ${data.error || ''}`);
  }

  return {
    playlists: (data.data.info || []).map((item) => ({
      id: `kgplaylist_${item.specialid}`,
      title: item.specialname,
      cover: item.imgurl ? item.imgurl.replace('{size}', '400') : '',
      creator: item.nickname,
      trackCount: item.songcount,
      playCount: item.playcount,
    })),
    total: data.data.total,
  };
}

// ---- run -------------------------------------------------------------------
async function runCandidate(candidate, keyword, page) {
  const request = candidate.build(keyword, page);
  const response = await send(request);
  const entry = {
    keyword,
    page,
    method: ((request.init && request.init.method) || 'GET').toUpperCase(),
    url: shorten(request.url, 300),
    status: response.status === undefined ? null : response.status,
    contentType: response.contentType || null,
    ms: response.ms,
    error: response.error || null,
    bodyStart: response.text === undefined ? null : shorten(response.text, 600),
  };

  if (response.text !== undefined) {
    try {
      const parsed = candidate.parse(response.text);

      entry.count = parsed.playlists.length;
      entry.total = parsed.total;
      entry.extra = parsed.extra || null;
      entry.sample = parsed.playlists.slice(0, 2);
      entry.ids = parsed.playlists.map((item) => item.id);
      entry.missing = ['title', 'cover', 'creator', 'trackCount', 'playCount'].filter((field) =>
        parsed.playlists.some((item) => item[field] === undefined || item[field] === null || item[field] === '')
      );
    } catch (error) {
      entry.parseError = describeError(error);
    }
  }
  await sleep(GAP_MS);

  return entry;
}

async function checkDetail(Client, id) {
  const started = Date.now();

  try {
    const detail = await Client.getPlaylist(id);

    if (!detail) {
      return { id, ok: false, error: '返回空值', ms: Date.now() - started };
    }
    const tracks = await Promise.all(detail.tracks || []);

    return {
      id,
      ok: tracks.length > 0,
      title: detail.info && detail.info.title,
      infoId: detail.info && detail.info.id,
      tracks: tracks.length,
      firstTrack: tracks[0] ? `${tracks[0].artist} - ${tracks[0].title}（${tracks[0].id}）` : null,
      ms: Date.now() - started,
    };
  } catch (error) {
    return { id, ok: false, error: describeError(error), ms: Date.now() - started };
  }
}

const NAMES = { ne: '网易', qq: 'QQ', kw: '酷我', kg: '酷狗' };

function renderMarkdown(report) {
  const lines = [
    `# 歌单搜索探测：${report.net}`,
    '',
    `- 网络标签：${report.net}（用户告知）`,
    `- 时间：${report.startedAt}`,
    `- 代码：${report.commit}${report.dirty ? '（工作区有未提交改动）' : ''}`,
    `- 运行环境：Node ${process.version}，${process.platform}`,
    `- 关键词：${report.keywords.join('、')}；每页 ${PAGE_SIZE} 条`,
    '',
    '单次、单一网络下的结果。某项可用或不可用的结论要有两种网络下的结果才算确认。',
    '',
    '| 音源 | 接口 | 关键词/页 | 状态码 | 条数 | 总数 | 结果 |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const provider of report.providers) {
    for (const candidate of provider.candidates) {
      for (const run of candidate.runs) {
        const outcome = run.error || run.parseError || (run.count > 0 ? '通过' : '0 条');

        lines.push(
          `| ${NAMES[provider.id]} | ${candidate.name}${candidate.main ? '（主）' : ''} | ${run.keyword}/${run.page} | ${
            run.status === null ? '—' : run.status
          } | ${run.count === undefined ? '—' : run.count} | ${run.total === undefined ? '—' : run.total} | ${String(
            outcome
          ).replace(/\|/g, '/')} |`
        );
      }
    }
  }

  lines.push('', '## 用搜到的歌单调现有歌单详情', '', '| 音源 | 歌单 id | 结果 |', '|---|---|---|');
  for (const provider of report.providers) {
    for (const detail of provider.details) {
      const outcome = detail.ok
        ? `通过：${detail.tracks} 首，标题「${detail.title}」，首曲 ${detail.firstTrack}，${detail.ms}ms`
        : `失败：${detail.error || `${detail.tracks} 首`}`;

      lines.push(`| ${NAMES[provider.id]} | ${detail.id} | ${outcome.replace(/\|/g, '/')} |`);
    }
  }

  lines.push('', '## 样例与响应开头');
  for (const provider of report.providers) {
    lines.push('', `### ${NAMES[provider.id]}`);
    for (const candidate of provider.candidates) {
      const run = candidate.runs[0];

      lines.push('', `**${candidate.name}**（${run.method} ${run.url}）`);
      if (run.sample && run.sample.length) {
        lines.push('', '```json', JSON.stringify(run.sample[0], null, 2), '```');
        if (run.missing && run.missing.length) {
          lines.push(`- 有条目缺字段：${run.missing.join('、')}`);
        }
        if (run.extra) {
          lines.push(`- 分页相关字段：${JSON.stringify(run.extra)}`);
        }
      } else if (run.bodyStart !== null) {
        lines.push(`- 响应开头：\`${run.bodyStart.replace(/\s+/g, ' ').replace(/`/g, "'")}\``);
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
  const { Client, weapi } = await loadApp();
  const keywords = args.keywords.split(',').filter(Boolean);
  const only = args.only ? args.only.split(',') : null;
  const all = candidates(weapi);
  const now = new Date();
  const report = {
    net: args.net,
    startedAt: now.toString(),
    commit: git('rev-parse --short HEAD') || '未知',
    dirty: git('status --porcelain -- src vendor') !== '',
    keywords,
    providers: [],
  };
  const realLog = console.log;

  // Provider code logs cookies to the console; keep them out of the output.
  console.log = () => {};
  for (const [id, list] of Object.entries(all)) {
    if (only && !only.includes(id)) {
      continue;
    }
    process.stdout.write(`探测 ${NAMES[id]} …\n`);
    const provider = { id, candidates: [], details: [] };

    for (const candidate of list) {
      const runs = [];

      for (const keyword of keywords) {
        runs.push(await runCandidate(candidate, keyword, 1));
      }
      if (candidate.main) {
        runs.push(await runCandidate(candidate, keywords[0], 2));
      }
      provider.candidates.push({ name: candidate.name, main: Boolean(candidate.main), runs });
    }

    // The first playlist of each keyword from the main candidate, or from the
    // first candidate that found any.
    const source =
      provider.candidates.find((c) => c.main && c.runs.some((r) => r.count > 0)) ||
      provider.candidates.find((c) => c.runs.some((r) => r.count > 0));

    if (source) {
      const ids = source.runs.filter((r) => r.page === 1 && r.ids && r.ids.length).map((r) => r.ids[0]);

      for (const playlistId of [...new Set(ids)]) {
        provider.details.push(await checkDetail(Client, playlistId));
        await sleep(GAP_MS);
      }
    }
    report.providers.push(provider);
  }
  console.log = realLog;

  const outDir = path.resolve(args.out || path.join(repoRoot, 'references', 'probe'));
  const base = path.join(
    outDir,
    `${timestamp(now)}-playlist-search-${args.net.replace(/[\\/:*?"<>|\s]+/g, '_')}`
  );
  const markdown = renderMarkdown(report);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${base}.md`, markdown);
  writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
  process.stdout.write(`\n${markdown.split('\n## 样例与响应开头')[0]}\n`);
  process.stdout.write(`存档：${base}.md\n      ${base}.json\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  }
);
