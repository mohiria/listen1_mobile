/* eslint no-bitwise: ["error", { "allow": ["&"] }] */
import queryString from 'query-string';
import request from '../request';
import { kuwoIsRestricted, kuwoIsPromptAudio } from '../restricted';

function getSmallImageUrl(url) {
  return `${url}?param=140y140`;
}
function showPlaylist(offset) {
  const url = `http://www.kuwo.cn/www/categoryNew/getPlayListInfoUnderCategory?type=taglist&digest=10000&id=37&start=${offset}&count=30`;

  return request(url)
    .then((response) => {
      return response.json();
    })
    .then(({ data }) => {
      if (!data[0]) {
        return { result: [], hasNextPage: false };
      }
      const result = data[0].data.map((item) => ({
        cover_img_url: item.img,
        title: item.name,
        id: `kwplaylist_${item.id}`,
        source_url: `http://www.kuwo.cn/playlist/index?pid=${item.id}`,
      }));
      return { result, hasNextPage: true };
    });
}
function getNEScore(song) {
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

function isPlayable(song) {
  return getNEScore(song) < 100;
}

function convert(allowAll) {
  return (songInfo) => ({
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

function getPlaylist(playlistId) {
  const list_id = playlistId.split('_')[0];
  const d = playlistId.split('_').pop();
  switch (list_id) {
    case 'kwplaylist':
      return kw_get_playlist(d);
    // case 'kwalbum':
    //   return kw_album(d);
    // case 'kwartist':
    //   return kw_artist(d);
    default:
      return null;
  }
}

async function kw_get_playlist(playlistId) {
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

      const tracks = data.musiclist.map((t) =>
        kw_render_playlist_result_item(t)
      );
      return { info, tracks };
    });
}

function html_decode(str) {
  return str.replace(/(&nbsp;)/g, ' ');
}

function kw_render_playlist_result_item(item) {
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

function bootstrapTrack(trackId) {
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

function kw_search_cover(item) {
  if (item.web_albumpic_short) {
    return `https://img2.kuwo.cn/star/albumcover/${item.web_albumpic_short}`;
  }
  if (item.web_artistpic_short) {
    return `https://img1.kuwo.cn/star/starheads/${item.web_artistpic_short}`;
  }

  return '';
}

async function search(keyword, curpage) {
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
      const tracks = data.abslist.map((item) => {
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

function parseUrl(url) {
  let result = null;

  const r = /\/\/music\.163\.com\/playlist\/([0-9]+)/g.exec(url);

  if (r !== null) {
    return {
      type: 'playlist',
      id: `neplaylist_${r[1]}`,
    };
  }

  if (
    url.search('//music.163.com/#/m/playlist') !== -1 ||
    url.search('//music.163.com/#/playlist') !== -1 ||
    url.search('//music.163.com/playlist') !== -1 ||
    url.search('//music.163.com/#/my/m/music/playlist') !== -1
  ) {
    const parsed = queryString.parseUrl(url);

    result = {
      type: 'playlist',
      id: `neplaylist_${parsed.query.id}`,
    };
  }

  return result;
}

const meta = { name: '酷我', platformId: 'kw', enName: 'kuwo' };

export default {
  meta,
  showPlaylist,
  getPlaylist,
  bootstrapTrack,
  search,
  parseUrl,
};
