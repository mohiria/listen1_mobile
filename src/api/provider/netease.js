import queryString from 'query-string';
import { weapi } from '../../modules/crypto';
import request from '../request';
import { neteaseIsRestricted, neteaseIsTrialClip } from '../restricted';
import { isExcerpt } from '../excerpt';

function requestAPI(url, data) {
  return request(url, {
    method: 'POST',
    headers: {
      referer: 'https://music.163.com/',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent':
        'Mozilla/5.0 (Linux; U; Android 8.1.0; zh-cn; BLA-AL00 Build/HUAWEIBLA-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.132 MQQBrowser/8.9 Mobile Safari/537.36',
    },
    body: queryString.stringify(weapi(data)),
  })
    .then((response) => {
      return response.json();
    });
}
function getSmallImageUrl(url) {
  return `${url}?param=140y140`;
}
function showPlaylist(offset) {
  const query = {
    offset,
  };
  const data = {
    cat: query.cat || '全部',
    order: query.order || 'hot', // hot,new
    limit: query.limit || 30,
    offset: query.offset || 0,
    total: true,
  };

  const url = 'https://music.163.com/weapi/playlist/list';

  return requestAPI(url, data)
    .then((r) => {
      const playlists = r.playlists.map((item) => ({
        cover_img_url: getSmallImageUrl(item.coverImgUrl),
        title: item.name,
        id: `neplaylist_${item.id}`,
        source_url: `http://music.163.com/#/playlist?id=${item.id}`,
      }));

      return { result: playlists };
    });
}
function convert(songInfo, privilege) {
  return {
    id: `netrack_${songInfo.id}`,
    title: songInfo.name,
    artist: songInfo.ar[0].name,
    artist_id: `neartist_${songInfo.ar[0].id}`,
    album: songInfo.al.name,
    album_id: `nealbum_${songInfo.al.id}`,
    source: 'netease',
    source_url: `http://music.163.com/#/song?id=${songInfo.id}`,
    img_url: songInfo.al.picUrl,
    url: `netrack_${songInfo.id}`,
    disabled: neteaseIsRestricted(privilege),
  };
}

function getPlaylist(playlistId) {
  const listId = playlistId.split('_').pop();
  const data = {
    id: listId,
    offset: 0,
    total: true,
    limit: 1000,
    n: 1000,
    csrf_token: '',
  };

  const playlist_url = 'https://music.163.com/weapi/v3/playlist/detail';
  const tracks_url = 'https://music.163.com/weapi/v3/song/detail';

  return requestAPI(playlist_url, data).then((resData) => {
    const info = {
      id: `neplaylist_${listId}`,
      cover_img_url: getSmallImageUrl(resData.playlist.coverImgUrl),
      title: resData.playlist.name,
      source_url: `http://music.163.com/#/playlist?id=${listId}`,
    };

    // request all tracks to fetch song info
    // Code reference from listen1_chrome_extension
    const track_ids = resData.playlist.trackIds.map((i) => i.id);
    const data = {
      c: '[' + track_ids.map((id) => '{"id":' + id + '}').join(',') + ']',
      ids: '[' + track_ids.join(',') + ']',
    };

    return requestAPI(tracks_url, data).then((response) => {
      // the privilege data comes in a list beside the songs
      const privileges = {};

      (response.privileges || []).forEach((privilege) => {
        privileges[privilege.id] = privilege;
      });
      const tracks = response.songs.map((song) =>
        convert(song, privileges[song.id])
      );
      return { info, tracks };
    });
  });
}

function bootstrapTrack(trackId) {
  const url =
    'https://music.163.com/weapi/song/enhance/player/url/v1?csrf_token=';

  const songId = trackId.slice('netrack_'.length);

  const data = {
    ids: [songId],
    level: 'standard',
    encodeType: 'aac',
    csrf_token: '',
  };

  return requestAPI(url, data).then((resData) => {
    const urlInfo = resData.data[0];

    // a member-only song yields the address of a 30 to 45 second trial clip
    if (!urlInfo.url || neteaseIsTrialClip(urlInfo)) {
      return '';
    }

    return urlInfo.url;
  });
}

function search(keyword, page) {
  // cloudsearch/get/web answers {"code":50000005} to this request, whatever
  // user agent it carries; cloudsearch/pc returns the same structure.
  const url = 'https://music.163.com/weapi/cloudsearch/pc';
  // the search screen pages by 20
  const data = {
    csrf_token: '',
    limit: '20',
    offset: (20 * (page - 1)).toString(),
    s: keyword,
    total: 'false',
    type: '1',
  };

  return requestAPI(url, data).then((resData) => {
    // a search without matches has no songs field
    const tracks = (resData.result.songs || [])
      .filter((song) => !isExcerpt(song.dt / 1000))
      .map((song) => convert(song, song.privilege));

    return {
      result: tracks,
      total: resData.result.songCount,
    };
  });
}

// The playlists whose names match the keyword: the search of songs with
// another type.
function searchPlaylist(keyword, page) {
  const url = 'https://music.163.com/weapi/cloudsearch/pc';
  const data = {
    csrf_token: '',
    limit: '20',
    offset: (20 * (page - 1)).toString(),
    s: keyword,
    total: 'false',
    type: '1000',
  };

  return requestAPI(url, data).then((resData) => ({
    // a search without matches has no playlists field
    result: (resData.result.playlists || []).map((item) => ({
      cover_img_url: getSmallImageUrl(item.coverImgUrl),
      title: item.name,
      id: `neplaylist_${item.id}`,
      source_url: `http://music.163.com/#/playlist?id=${item.id}`,
      author: item.creator ? item.creator.nickname : '',
      count: item.trackCount,
    })),
    total: resData.result.playlistCount || 0,
  }));
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

const meta = { name: '网易', platformId: 'ne', enName: 'netease' };

export default {
  meta,
  showPlaylist,
  getPlaylist,
  bootstrapTrack,
  search,
  searchPlaylist,
  parseUrl,
};
