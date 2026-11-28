import request from '../request';
import { miguIsRestricted } from '../restricted';
import { isExcerpt } from '../excerpt';
import type {
  Chart,
  FoundPlaylist,
  ParsedUrl,
  Playlist,
  PlaylistInfo,
  ProviderModule,
  Track,
} from '../types';

const APP_HOST = 'https://app.c.nf.migu.cn';
const IMAGE_HOST = 'https://d.musicapp.migu.cn';
const SONGS_PER_PAGE = 50;
// what one playlist shows at most, so that a huge one cannot ask without end
const MOST_PAGES = 20;

function json(url: string, init?: RequestInit): Promise<any> {
  return request(url, init).then((response) => response.json());
}

function showPlaylist(
  offset: number
): Promise<{ result: PlaylistInfo[]; hasNextPage: boolean }> {
  const url = `${APP_HOST}/MIGUM2.0/v2.0/content/getMusicData.do?count=30&start=${
    offset / 30 + 1
  }&templateVersion=5&type=1`;

  return json(url).then(({ data }) => {
    const items = data.contentItemList[0].itemList;
    const result: PlaylistInfo[] = [];

    items.forEach((item: any) => {
      const match = /id=([0-9]+)&/.exec(item.actionUrl);

      if (match) {
        result.push({
          cover_img_url: item.imageUrl,
          title: item.title,
          id: `mgplaylist_${match[1]}`,
          source_url: `https://music.migu.cn/v3/music/playlist/${match[1]}`,
        });
      }
    });

    return { result, hasNextPage: items.length > 0 };
  });
}

// Several singers come as "周杰伦|费玉清"; the others give the first only.
function firstSinger(singer: unknown): string {
  return String(singer || '').split('|')[0];
}

function cover(song: any): string {
  const images = song.albumImgs || [];
  // the smallest is the last of the three
  const image = images[images.length - 1];

  return image ? image.img : '';
}

// A song of a playlist. A song is asked for by its contentId alone.
function convertListed(song: any): Track {
  return {
    id: `mgtrack_${song.contentId}`,
    title: song.songName,
    artist: firstSinger(song.singer),
    artist_id: `mgartist_${firstSinger(song.singerId)}`,
    album: song.album,
    album_id: `mgalbum_${song.albumId}`,
    source: 'migu',
    source_url: `https://music.migu.cn/v3/music/song/${song.copyrightId}`,
    img_url: cover(song),
    url: `mgtrack_${song.contentId}`,
    disabled: miguIsRestricted(song),
  };
}

function songsOfPlaylist(listId: string, page: number): Promise<Track[]> {
  return json(
    `${APP_HOST}/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=${listId}&pageNo=${page}&pageSize=${SONGS_PER_PAGE}`
  ).then((data) => (data.list || []).map(convertListed));
}

// A chart comes whole, 50 or 100 songs, in the form the songs of a playlist
// do.
function getChart(columnId: string): Promise<Playlist> {
  return json(
    `${APP_HOST}/MIGUM2.0/v1.0/content/querycontentbyId.do?columnId=${columnId}&needAll=0`,
    { headers: { channel: '0146832' } }
  ).then((data) => {
    const column = data.columnInfo;

    return {
      info: {
        cover_img_url: column.columnSmallpicUrl || column.columnPicUrl || '',
        title: column.columnTitle,
        id: `mgchart_${columnId}`,
        source_url: 'https://music.migu.cn/v3/music/top',
      },
      tracks: (column.contents || [])
        .filter((content: any) => content.objectInfo)
        .map((content: any) => convertListed(content.objectInfo)),
    };
  });
}

function getPlaylist(playlistId: string): Promise<Playlist> {
  const listId = playlistId.split('_').pop() as string;

  if (playlistId.startsWith('mgchart_')) {
    return getChart(listId);
  }

  return json(
    `${APP_HOST}/MIGUM2.0/v1.0/content/resourceinfo.do?needSimple=00&resourceType=2021&resourceId=${listId}`
  ).then(async (data) => {
    const found = data.resource[0];

    if (!found) {
      throw new Error(`咪咕没有这个歌单：${listId}`);
    }
    const pages = Math.min(
      Math.ceil(found.musicNum / SONGS_PER_PAGE),
      MOST_PAGES
    );
    const lists = await Promise.all(
      Array.from({ length: pages }, (_, index) =>
        songsOfPlaylist(listId, index + 1)
      )
    );

    return {
      info: {
        cover_img_url: found.imgItem ? found.imgItem.img : '',
        title: found.title,
        id: `mgplaylist_${listId}`,
        source_url: `https://music.migu.cn/v3/music/playlist/${listId}`,
      },
      tracks: ([] as Track[]).concat(...lists),
    };
  });
}

// The address the visitor gets is the 128k mp3; the better ones come back
// empty. Without the channel header the answer is "channel不能为空".
function bootstrapTrack(trackId: string): Promise<string> {
  const contentId = trackId.slice('mgtrack_'.length);
  const url = `https://c.musicapp.migu.cn/MIGUM2.0/v2.1/content/listen-url?netType=01&resourceType=2&toneFlag=PQ&contentId=${contentId}`;

  return json(url, { headers: { channel: '0146832' } }).then(({ data }) => {
    let address = data && data.url;

    if (!address) {
      return '';
    }
    if (address.startsWith('//')) {
      address = `https:${address}`;
    }
    // an old form of the same file server
    address = address.replace(
      /^ftp:\/\/218\.200\.160\.122:21\//,
      'https://freetyst.nf.migu.cn/'
    );

    return /^https?:\/\//.test(address) ? address.replace(/\+/g, '%2B') : '';
  });
}

function search(
  keyword: string,
  curpage: number
): Promise<{ result: Track[]; total: number }> {
  const url = `https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0?text=${encodeURIComponent(
    keyword
  )}&pageNo=${curpage}&pageSize=20`;

  return json(url).then((data) => {
    const songs = (data || []).filter((song: any) => !isExcerpt(song.duration));
    const result = songs.map((song: any): Track => {
      const singer = (song.singerList || [])[0] || {};

      return {
        id: `mgtrack_${song.contentId}`,
        title: song.songName,
        artist: singer.name || '',
        artist_id: `mgartist_${singer.id || ''}`,
        album: song.album || '',
        album_id: `mgalbum_${song.albumId || ''}`,
        source: 'migu',
        source_url: `https://music.migu.cn/v3/music/song/${song.copyrightId}`,
        img_url: song.img3 ? `${IMAGE_HOST}${song.img3}` : '',
        url: `mgtrack_${song.contentId}`,
        // nothing in a found song was seen to tell a withheld one apart
        disabled: false,
      };
    });

    // the answer carries no total; a full page means there may be more
    return { result, total: (data || []).length < 20 ? 0 : Infinity };
  });
}

function searchPlaylist(
  keyword: string,
  curpage: number
): Promise<{ result: FoundPlaylist[]; total: number }> {
  const url = `https://app.u.nf.migu.cn/pc/v1.0/content/search_all.do?text=${encodeURIComponent(
    keyword
  )}&pageNo=${curpage}&pageSize=20&searchSwitch=${encodeURIComponent(
    '{"songlist":1}'
  )}`;

  return json(url).then((data) => {
    const found = data.songListResultData || {};

    return {
      result: (found.result || []).map((item: any) => ({
        cover_img_url: item.musicListPicUrl,
        title: item.name,
        id: `mgplaylist_${item.id}`,
        source_url: `https://music.migu.cn/v3/music/playlist/${item.id}`,
        // the answer names the owner by an id only
        author: '',
        count: Number(item.musicNum),
      })),
      total: Number(found.totalCount) || 0,
    };
  });
}

function parseUrl(url: string): ParsedUrl | null {
  const match = /\/\/music\.migu\.cn\/v3\/music\/playlist\/([0-9]+)/.exec(url);

  return match ? { type: 'playlist', id: `mgplaylist_${match[1]}` } : null;
}

const meta = { name: '咪咕', platformId: 'mg', enName: 'migu' };

// Migu has no rising chart.
const charts: Chart[] = (
  [
    ['hot', '尖叫热歌榜', '27186466'],
    ['new', '尖叫新歌榜', '27553319'],
  ] as const
).map(([kind, title, id]) => ({
  kind,
  title,
  id: `mgchart_${id}`,
  cover_img_url: '',
  source: 'migu',
}));

const provider: ProviderModule = {
  charts,
  meta,
  showPlaylist,
  getPlaylist,
  bootstrapTrack,
  search,
  searchPlaylist,
  parseUrl,
};

export default provider;
