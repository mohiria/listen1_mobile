import type { ParsedUrl } from './types';

// The forms a link to a playlist takes, provider by provider: on the web
// sites, on their pages for phones, and in what the apps share. Each finds
// the number of the playlist. Short links that only redirect are not among
// them; they would take a request to follow.
const FORMS: { prefix: string; patterns: RegExp[] }[] = [
  {
    prefix: 'neplaylist_',
    patterns: [
      // music.163.com/playlist/123, music.163.com/#/playlist?id=123,
      // y.music.163.com/m/playlist?id=123, .../#/my/m/music/playlist?id=123
      /music\.163\.com\/(?:#\/)?(?:my\/)?(?:m\/)?(?:music\/)?playlist\/(\d+)/,
      /music\.163\.com\/(?:#\/)?(?:my\/)?(?:m\/)?(?:music\/)?playlist\?(?:\S*?&)?id=(\d+)/,
    ],
  },
  {
    prefix: 'qqplaylist_',
    patterns: [
      /y\.qq\.com\/n\/(?:yqq|ryqq|ryqq_v2)\/(?:playlist|playsquare)\/(\d+)/,
      // .../n/m/detail/taoge/index.html?id=123,
      // .../n2/m/share/details/taoge.html?id=123
      /y\.qq\.com\/\S*taoge\S*?[?&]id=(\d+)/,
      // what the app itself records for a playlist of this provider
      /y\.qq\.com\/#type=taoge&id=(\d+)/,
    ],
  },
  {
    prefix: 'kgplaylist_',
    patterns: [
      /kugou\.com\/yy\/special\/single\/(\d+)/,
      /kugou\.com\/plist\/list\/(\d+)/,
    ],
  },
  {
    prefix: 'kwplaylist_',
    patterns: [
      /kuwo\.cn\/(?:newh5app\/)?playlist_detail\/(\d+)/,
      /kuwo\.cn\/playlist\/index\?(?:\S*?&)?pid=(\d+)/,
      /kuwo\.cn\/h5app\/playlist\/(\d+)/,
    ],
  },
  {
    prefix: 'mgplaylist_',
    patterns: [
      /music\.migu\.cn\/v3\/music\/playlist\/(\d+)/,
      // the page the app shares:
      // h5.nf.migu.cn/app/v4/p/share/playlist/index.html?id=123
      /migu\.cn\/\S*playlist\S*?[?&]id=(\d+)/,
    ],
  },
];

// The playlist that a link points to, or null. The text may hold more than
// the link, as what an app puts on the clipboard does.
export function parsePlaylistLink(text: string): ParsedUrl | null {
  for (const { prefix, patterns } of FORMS) {
    for (const pattern of patterns) {
      const match = pattern.exec(text);

      if (match !== null) {
        return { type: 'playlist', id: `${prefix}${match[1]}` };
      }
    }
  }

  return null;
}
