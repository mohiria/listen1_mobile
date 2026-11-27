import qq from './provider/qq';
import netease from './provider/netease';
import kugou from './provider/kugou';
import kuwo from './provider/kuwo';
import { createResolver } from './resolve';
import { createAggregateSearch, takeInTurn } from './aggregate';
// import bilibili from './provider/bilibili';
// import migu from './provider/migu';

const availableProvider = [netease, kugou, kuwo, qq];

const enabledProvider = availableProvider;

function getPlatformArray() {
  return enabledProvider.map((provider) => provider.meta);
}

const prefix2provider = {};
const enName2NameDict = {};

enabledProvider.forEach((provider) => {
  prefix2provider[provider.meta.platformId] = provider;
  enName2NameDict[provider.meta.enName] = provider.meta.name;
});

// the order in which the providers are preferred, when switching and when
// several of them find the same song
const preferredProvider = [netease, qq, kuwo, kugou];

const resolveTrack = createResolver(
  preferredProvider.map((provider) => ({
    name: provider.meta.enName,
    prefix: provider.meta.platformId,
    search: (keyword) => provider.search(keyword, 1).then((r) => r.result),
    bootstrapTrack: provider.bootstrapTrack,
  }))
);

function getProviderByItemId(itemId) {
  const prefix = itemId.slice(0, 2);

  return prefix2provider[prefix];
}
function getProviderName(enName) {
  return enName2NameDict[enName] || '暂未支持的平台';
}

export default class Client {
  static getPlatformArray = getPlatformArray;
  static getProviderName = getProviderName;
  static showPlaylist(offset, platformId) {
    const provider = getProviderByItemId(platformId);

    return provider.showPlaylist(offset);
  }

  static search(keyword, page, platformId) {
    const provider = getProviderByItemId(platformId);

    return provider.search(keyword, page);
  }

  // One search over every provider. See ./aggregate.js for what it gives.
  static searchAll(keyword) {
    return createAggregateSearch(
      preferredProvider.map((provider) => ({
        name: provider.meta.enName,
        search: (text, page) => provider.search(text, page),
      })),
      keyword
    );
  }

  // The playlists the keyword finds, in one provider or, without platformId,
  // in all of them in turn. more() works as in searchAll.
  static searchPlaylists(keyword, platformId) {
    const providers =
      platformId === undefined
        ? preferredProvider
        : [getProviderByItemId(platformId)];
    const session = createAggregateSearch(
      providers.map((provider) => ({
        name: provider.meta.enName,
        search: (text, page) => provider.searchPlaylist(text, page),
      })),
      keyword,
      takeInTurn
    );

    return {
      more: () =>
        session
          .more()
          .then(({ tracks, failed, done }) => ({ playlists: tracks, failed, done })),
    };
  }

  static getPlaylist(playlistId) {
    const provider = getProviderByItemId(playlistId);

    return provider.getPlaylist(playlistId);
  }

  static bootstrapTrack(trackId) {
    const provider = getProviderByItemId(trackId);

    if (provider === undefined) {
      return Promise.resolve('');
    }

    return provider.bootstrapTrack(trackId);
  }

  // Address of a song, taken from another provider when its own withholds
  // it. See ./resolve.js for what it resolves with.
  static resolveTrack = resolveTrack;

  static parseUrl(url) {
    let result = null;

    // eslint-disable-next-line consistent-return
    enabledProvider.forEach((provider) => {
      const r = provider.parseUrl(url);

      if (r !== null) {
        result = r;
      }
    });

    return result;
  }
}
