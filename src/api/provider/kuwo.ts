/* eslint no-bitwise: ["error", { "allow": ["&"] }] */
import request from '../request';
import { kuwoIsRestricted, kuwoIsPromptAudio } from '../restricted';
import { isExcerpt } from '../excerpt';
import type {
  Chart,
  FoundPlaylist,
  Playlist,
  PlaylistInfo,
  ProviderModule,
  Track,
} from '../types';

function getSmallImageUrl(url: string): string {
  return `${url}?param=140y140`;
}
function showPlaylist(
  offset: number
): Promise<{ result: PlaylistInfo[]; hasNextPage: boolean }> {
  const url = `http://www.kuwo.cn/www/categoryNew/getPlayListInfoUnderCategory?type=taglist&digest=10000&id=37&start=${offset}&count=30`;

  return request(url)
    .then((response) => {
      return response.json();
    })
    .then(({ data }) => {
      if (!data[0]) {
        return { result: [], hasNextPage: false };
      }
      const result = data[0].data.map((item: any) => ({
        cover_img_url: item.img,
        title: item.name,
        id: `kwplaylist_${item.id}`,
        source_url: `http://www.kuwo.cn/playlist/index?pid=${item.id}`,
      }));
      return { result, hasNextPage: true };
    });
}
function getNEScore(song: any): number {
  if (!song) {
    return 0;
  }
  const privilege = song.privilege;

  if (song.program) {
    return 0;
  }

  if (privilege) {
    if (privilege.st != null && privilege.st < 0) {
      return 100;
    }
    if (
      privilege.fee > 0 &&
      privilege.fee !== 8 &&
      privilege.payed === 0 &&
      privilege.pl <= 0
    ) {
      return 10;
    }
    if (
      privilege.fee === 16 ||
      (privilege.fee === 4 && privilege.flag & 2048)
    ) {
      return 11;
    }
    if (
      (privilege.fee === 0 || privilege.payed) &&
      privilege.pl > 0 &&
      privilege.dl === 0
    ) {
      return 1e3;
    }
    if (privilege.pl === 0 && privilege.dl === 0) {
      return 100;
    }

    return 0;
  }

  if (song.status >= 0) {
    return 0;
  }
  if (song.fee > 0) {
    return 10;
  }

  return 100;
}

function isPlayable(song: any): boolean {
  return getNEScore(song) < 100;
}

function convert(allowAll: boolean) {
  return (songInfo: any): Track => ({
    id: `netrack_${songInfo.id}`,
    title: songInfo.name,
    artist: songInfo.ar[0].name,
    artist_id: `neartist_${songInfo.ar[0].id}`,
    album: songInfo.al.name,
    album_id: `nealbum_${songInfo.al.id}`,
    source: 'netease',
    source_url: `http://music.163.com/#/song?id=${songInfo.id}`,
    img_url: getSmallImageUrl(songInfo.al.picUrl),
    url: `netrack_${songInfo.id}`,
    disabled: allowAll ? false : !isPlayable(songInfo),
  });
}

function getPlaylist(playlistId: string): Promise<Playlist> | null {
  const list_id = playlistId.split('_')[0];
  const d = playlistId.split('_').pop() as string;
  switch (list_id) {
    case 'kwplaylist':
      return kw_get_playlist(d);
    case 'kwchart':
      return kw_get_chart(d);
    // case 'kwalbum':
    //   return kw_album(d);
    // case 'kwartist':
    //   return kw_artist(d);
    default:
      return null;
  }
}

async function kw_get_playlist(playlistId: string): Promise<Playlist> {
  const target_url = `http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pn=0&rn=200&encode=utf-8&keyset=pl2012&pcmp4=1&pid=${playlistId}&vipver=MUSIC_9.0.2.0_W1&newver=1`;

  return await request(target_url)
    .then((response) => {
      return response.json();
    })
    .then(async (data) => {
      const info = {
        cover_img_url: data.pic,
        title: data.title,
        id: `kwplaylist_${data.id}`,
        source_url: `http://www.kuwo.cn/playlist/index?pid=${data.id}`,
      };

      const tracks = data.musiclist.map((t: any) =>
        kw_render_playlist_result_item(t)
      );
      return { info, tracks };
    });
}

// The first 100 songs of a chart. Its songs come in the form the songs of a
// playlist do, without a cover.
async function kw_get_chart(bangId: string): Promise<Playlist> {
  const data = await request(
    `http://kbangserver.kuwo.cn/ksong.s?from=pc&fmt=json&pn=0&rn=100&type=bang&data=content&id=${bangId}&show_copyright_off=0&pcmp4=1&isbang=1`
  ).then((response) => response.json());

  return {
    info: {
      // some charts name a folder instead of a picture
      cover_img_url: /\.(jpe?g|png|webp)$/i.test(data.pic || '') ? data.pic : '',
      title: data.name,
      id: `kwchart_${bangId}`,
      source_url: 'http://www.kuwo.cn/rankList',
    },
    tracks: data.musiclist.map((t: any) => kw_render_playlist_result_item(t)),
  };
}

function html_decode(str: string): string {
  return str.replace(/(&nbsp;)/g, ' ');
}

function kw_render_playlist_result_item(item: any): Track {
  return {
    id: `kwtrack_${item.id}`,
    title: html_decode(item.name),
    artist: item.artist,
    artist_id: `kwartist_${item.artistid}`,
    album: html_decode(item.album),
    album_id: `kwalbum_${item.albumid}`,
    source: 'kuwo',
    source_url: `http://www.kuwo.cn/yinyue/${item.id}`,
    img_url: item.albumpic || item.artistPic || '',
    url: `kwtrack_${item.id}`,
    lyric_url: item.id,
    disabled: kuwoIsRestricted(item),
  };
}

function bootstrapTrack(trackId: string): Promise<string> {
  const songId = trackId.slice('kwtrack_'.length);

  const target_url = `${
    'http://antiserver.kuwo.cn/anti.s?' +
    'type=convert_url&format=mp3&response=url&rid='
  }${songId}`;

  return request(target_url, {
    headers: {
      referer: 'https://www.kuwo.cn/',
    },
  })
    .then((res) => {
      return res.text();
    })
    .then((res) => {
      // a restricted song yields the address of a spoken prompt, not the song
      if (!/^https?:\/\//.test(res) || kuwoIsPromptAudio(res)) {
        return '';
      }

      return res;
    });
}

function kw_search_cover(item: any): string {
  if (item.web_albumpic_short) {
    return `https://img2.kuwo.cn/star/albumcover/${item.web_albumpic_short}`;
  }
  if (item.web_artistpic_short) {
    return `https://img1.kuwo.cn/star/starheads/${item.web_artistpic_short}`;
  }

  return '';
}

async function search(
  keyword: string,
  curpage: number
): Promise<{ result: Track[]; total: number }> {
  // www.kuwo.cn/api/www/search needs a token and a Secret header derived
  // from a cookie whose name keeps changing, and answers "The request is
  // illegal!" without them. This one needs neither. Its pages count from 0.
  const target_url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(
    keyword
  )}&pn=${
    curpage - 1
  }&rn=20&vipver=1&ft=music&encoding=utf8&rformat=json&mobi=1`;

  return request(target_url)
    .then((response) => response.json())
    .then((data) => {
      const songs = data.abslist.filter(
        (item: any) => !isExcerpt(item.DURATION)
      );
      const tracks = songs.map((item: any): Track => {
        const musicrid = item.MUSICRID.split('_')[1];

        return {
          id: `kwtrack_${musicrid}`,
          title: html_decode(item.NAME),
          artist: html_decode(item.ARTIST),
          artist_id: `kwartist_${item.ARTISTID}`,
          album: html_decode(item.ALBUM),
          album_id: `kwalbum_${item.ALBUMID}`,
          source: 'kuwo',
          source_url: `http://www.kuwo.cn/yinyue/${musicrid}`,
          img_url: kw_search_cover(item),
          url: `kwtrack_${musicrid}`,
          lyric_url: musicrid,
          disabled: kuwoIsRestricted(item),
        };
      });

      return { result: tracks, total: Number(data.TOTAL) };
    });
}

// The playlists whose names match the keyword: the search of songs with
// another ft. Its pages count from 0.
async function searchPlaylist(
  keyword: string,
  curpage: number
): Promise<{ result: FoundPlaylist[]; total: number }> {
  const target_url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(
    keyword
  )}&pn=${
    curpage - 1
  }&rn=20&vipver=1&ft=playlist&encoding=utf8&rformat=json&mobi=1`;

  return request(target_url)
    .then((response) => response.json())
    .then((data) => ({
      result: data.abslist.map((item: any) => ({
        cover_img_url: item.pic,
        title: html_decode(item.name),
        id: `kwplaylist_${item.playlistid}`,
        source_url: `http://www.kuwo.cn/playlist/index?pid=${item.playlistid}`,
        author: html_decode(item.nickname || ''),
        count: Number(item.songnum),
      })),
      total: Number(data.TOTAL),
    }));
}


const meta = { name: '酷我', platformId: 'kw', enName: 'kuwo' };

const charts: Chart[] = (
  [
    ['hot', '热歌榜', '16'],
    ['rising', '飙升榜', '93'],
    ['new', '新歌榜', '17'],
  ] as const
).map(([kind, title, id]) => ({
  kind,
  title,
  id: `kwchart_${id}`,
  cover_img_url: '',
  source: 'kuwo',
}));

const provider: ProviderModule = {
  charts,
  meta,
  showPlaylist,
  getPlaylist,
  bootstrapTrack,
  search,
  searchPlaylist,
};

export default provider;
