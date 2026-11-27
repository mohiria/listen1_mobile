import queryString from 'query-string';
import request from '../request';
import {kugouIsRestricted} from '../restricted';
import { isExcerpt } from '../excerpt';

function getSmallImageUrl(url) {
  return `${url}?param=140y140`;
}
function showPlaylist(offset) {
  const url = `http://m.kugou.com/plist/index?json=true&page=${
    Math.floor(offset / 30) + 1
  }`;
  return request(url)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      const result = data.plist.list.info.map((item) => ({
        cover_img_url: item.imgurl ? item.imgurl.replace('{size}', '400') : '',
        title: item.specialname,
        id: `kgplaylist_${item.specialid}`,
        source_url: 'http://www.kugou.com/yy/special/single/{size}.html'.replace(
          '{size}',
          item.specialid,
        ),
      }));
      return {result, hasNextPage: !!data.plist.list.has_next};
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
  const listId = playlistId.split('_')[0];
  const d = playlistId.split('_').pop();
  switch (listId) {
    case 'kgplaylist':
      return kg_get_playlist(d);
    case 'kgalbum':
      return kg_album(d);
    case 'kgartist':
      return kg_artist(d);
    default:
      return null;
  }
}

async function kg_artist(listId) {
  let target_url = `http://mobilecdnbj.kugou.com/api/v3/singer/info?singerid=${listId}`;
  const info = await request(target_url)
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      let {data} = response;
      data = JSON.parse(data);
      return {
        cover_img_url: data.data.imgurl.replace('{size}', '400'),
        title: data.data.singername,
        id: `kgartist_${listId}`,
        source_url: 'http://www.kugou.com/singer/{id}.html'.replace(
          '{id}',
          listId,
        ),
      };
    });
  target_url = `http://mobilecdnbj.kugou.com/api/v3/singer/song?singerid=${listId}&page=1&pagesize=30`;

  const tracks = await request(target_url)
    .then((response) => {
      return response.json();
    })
    .then(({data}) => {
      return data.data.info.map((t) => kg_render_artist_result_item(t, info));
    });
  return {info, tracks};
}

async function kg_render_artist_result_item(item, info) {
  const track = {
    id: `kgtrack_${item.hash}`,
    title: '',
    artist: '',
    artist_id: info.id,
    album: '',
    album_id: `kgalbum_${item.album_id}`,
    source: 'kugou',
    source_url: `http://www.kugou.com/song/#hash=${item.hash}&album_id=${item.album_id}`,
    img_url: '',
    url: `kgtrack_${item.hash}`,
    lyric_url: item.hash,
  };
  const one = item.filename.split('-');
  track.title = one[1].trim();
  track.artist = one[0].trim();
  // Fix album name and img
  const target_url = `${
    'http://www.kugou.com/yy/index.php?' + 'r=play/getdata&hash='
  }${item.hash}`;
  await request(
    `http://mobilecdnbj.kugou.com/api/v3/album/info?albumid=${item.album_id}`,
  )
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      let {data} = response;
      data = JSON.parse(data);
      if (data.status && data.data !== undefined) {
        track.album = data.data.albumname;
      } else {
        track.album = '';
      }
    });

  await request(target_url)
    .then((response) => {
      return response.json();
    })
    .then((res) => {
      const res_data = JSON.parse(res.data);
      track.img_url = res_data.data.img;
    });
  return track;
}

async function kg_album(listId) {
  // eslint-disable-line no-unused-vars
  let target_url = `${
    'http://mobilecdnbj.kugou.com/api/v3/album/info?' + 'albumid='
  }${listId}`;

  const info = await request(target_url)
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      let {data} = response;
      data = JSON.parse(data);

      return {
        cover_img_url: data.data.imgurl.replace('{size}', '400'),
        title: data.data.albumname,
        id: `kgalbum_${data.data.albumid}`,
        source_url: 'http://www.kugou.com/album/{id}.html'.replace(
          '{id}',
          data.data.albumid,
        ),
      };
    });
  target_url = `${
    'http://mobilecdnbj.kugou.com/api/v3/album/song?' + 'albumid='
  }${listId}&page=1&pagesize=-1`;
  const tracks = await request(target_url).then((res) => {
    let res_data = res.data;
    res_data = JSON.parse(res_data);
    return res_data.data.info.map((t) =>
      kg_render_album_result_item(t, info, listId),
    );
  });
  return {info, tracks};
}

// m.kugou.com/plist/list redirects to a web page unless the request looks
// like a phone browser. These two answer any client, and the song list
// already carries name, cover and privilege, so no request per song.
async function kg_get_playlist(listId) {
  const base = 'http://mobilecdnbj.kugou.com/api/v3/special';
  const [{data: special}, {data: songs}] = await Promise.all([
    request(`${base}/info?specialid=${listId}`).then((response) =>
      response.json(),
    ),
    request(`${base}/song?specialid=${listId}&page=1&pagesize=-1`).then(
      (response) => response.json(),
    ),
  ]);
  const info = {
    cover_img_url: special.imgurl ? special.imgurl.replace('{size}', '400') : '',
    title: special.specialname,
    id: `kgplaylist_${listId}`,
    source_url: `http://www.kugou.com/yy/special/single/${listId}.html`,
  };

  return {info, tracks: songs.info.map(kg_render_playlist_result_item)};
}

function kg_render_playlist_result_item(item) {
  // filename is "歌手 - 歌名"
  const separator = item.filename.indexOf(' - ');
  const cover = item.trans_param && item.trans_param.union_cover;

  return {
    id: `kgtrack_${item.hash}`,
    title:
      separator < 0 ? item.filename : item.filename.slice(separator + 3).trim(),
    artist: separator < 0 ? '未知' : item.filename.slice(0, separator).trim(),
    artist_id: '',
    album: item.remark || '',
    album_id: `kgalbum_${item.album_id}`,
    source: 'kugou',
    source_url: `http://www.kugou.com/song/#hash=${item.hash}&album_id=${item.album_id}`,
    img_url: cover ? cover.replace('{size}', '400') : '',
    url: `kgtrack_${item.hash}`,
    lyric_url: item.hash,
    disabled: kugouIsRestricted(item.privilege),
  };
}

async function kg_render_album_result_item(item, info, album_id) {
  const track = {
    id: `kgtrack_${item.hash}`,
    title: '',
    artist: '',
    artist_id: '',
    album: info.title,
    album_id: `kgalbum_${album_id}`,
    source: 'kugou',
    source_url: `http://www.kugou.com/song/#hash=${item.hash}&album_id=${album_id}`,
    img_url: '',
    url: `xmtrack_${item.hash}`,
    lyric_url: item.hash,
  };
  // Fix other data
  const target_url = `${
    'http://m.kugou.com/app/i/getSongInfo.php?' + 'cmd=playInfo&hash='
  }${item.hash}`;
  await request(target_url)
    .then((response) => {
      return response.json();
    })
    .then(({data}) => {
      track.title = data.songName;
      track.artist = data.singerId === 0 ? '未知' : data.singerName;
      track.artist_id = `kgartist_${data.singerId}`;
      track.img_url = data.imgUrl.replace('{size}', '400');
    });
  return track;
}

async function bootstrapTrack(trackId) {
  const song_id = trackId.slice('kgtrack_'.length);
  let target_url = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${song_id}`;

  return request(target_url, {
    headers: {
      referer: 'http://m.kugou.com',
      'content-type': 'application/x-www-form-urlencoded',
    },
  })
    .then((res) => res.json())
    .then((res) => {
      // a song that needs payment comes back with an empty url
      return res.url || '';
    });
}

async function search(keyword, curpage) {
  // Without privilege_filter=0 the server drops most songs that need payment
  // and reports the rest as free, including some that are not.
  const target_url = `http://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(
    keyword,
  )}&page=${curpage}&pagesize=20&platform=WebFilter&privilege_filter=0`;

  return request(target_url)
    .then((response) => response.json())
    .then(({data}) => {
      return {
        result: data.lists
          .filter((song) => !isExcerpt(song.Duration))
          .map(kg_convert_song),
        total: data.total,
      };
    });
}

// The playlists whose names match the keyword. The total stops at 480.
async function searchPlaylist(keyword, curpage) {
  const target_url = `http://mobilecdnbj.kugou.com/api/v3/search/special?keyword=${encodeURIComponent(
    keyword,
  )}&pagesize=20&filter=0&page=${curpage}`;

  return request(target_url)
    .then((response) => response.json())
    .then(({data}) => ({
      result: data.info.map((item) => ({
        cover_img_url: item.imgurl ? item.imgurl.replace('{size}', '400') : '',
        title: item.specialname,
        id: `kgplaylist_${item.specialid}`,
        source_url: `http://www.kugou.com/yy/special/single/${item.specialid}.html`,
        author: item.nickname || '',
        count: item.songcount,
      })),
      total: data.total,
    }));
}

function kg_convert_song(song) {
  const track = {
    id: `kgtrack_${song.FileHash}`,
    title: song.SongName,
    artist: '',
    artist_id: '',
    album: song.AlbumName,
    album_id: `kgalbum_${song.AlbumID}`,
    source: 'kugou',
    source_url: `http://www.kugou.com/song/#hash=${song.FileHash}&album_id=${song.AlbumID}`,
    img_url: song.Image ? song.Image.replace('{size}', '400') : '',
    url: `kgtrack_${song.FileHash}`,
    lyric_url: song.FileHash,
    disabled: kugouIsRestricted(song.Privilege),
  };
  let singer_id = song.SingerId;
  let singer_name = song.SingerName;
  if (song.SingerId instanceof Array) {
    [singer_id] = singer_id;
    [singer_name] = singer_name.split('、');
  }
  track.artist = singer_name;
  track.artist_id = `kgartist_${singer_id}`;
  return track;
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

const meta = {name: '酷狗', platformId: 'kg', enName: 'kugou'};

export default {
  meta,
  showPlaylist,
  getPlaylist,
  bootstrapTrack,
  search,
  searchPlaylist,
  parseUrl,
};
