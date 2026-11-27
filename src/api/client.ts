import qq from './provider/qq';
import netease from './provider/netease';
import kugou from './provider/kugou';
import kuwo from './provider/kuwo';
import migu from './provider/migu';
import { createResolver } from './resolve';
import { createAggregateSearch, takeInTurn } from './aggregate';
import type {
  AggregateSearch,
  FoundPlaylist,
  ParsedUrl,
  Playlist,
  PlaylistInfo,
  PlaylistSearch,
  Provider,
  ProviderModule,
  Track,
} from './types';

export type {
  AggregateSearch,
  FoundPlaylist,
  PlaylistInfo,
  PlaylistSearch,
  Provider,
  ResolveResult,
  Track,
} from './types';

const availableProvider: ProviderModule[] = [netease, kugou, kuwo, qq, migu];

const enabledProvider = availableProvider;

function getPlatformArray(): Provider[] {
  return enabledProvider.map((provider) => provider.meta);
}

const prefix2provider: { [prefix: string]: ProviderModule } = {};
const enName2NameDict: { [enName: string]: string } = {};

enabledProvider.forEach((provider) => {
  prefix2provider[provider.meta.platformId] = provider;
  enName2NameDict[provider.meta.enName] = provider.meta.name;
});

// the order in which the providers are preferred, when switching and when
// several of them find the same song
const preferredProvider: ProviderModule[] = [netease, qq, kuwo, kugou, migu];

const resolveTrack = createResolver(
  preferredProvider.map((provider) => ({
    name: provider.meta.enName,
    prefix: provider.meta.platformId,
    search: (keyword: string) => provider.search(keyword, 1).then((r) => r.result),
    bootstrapTrack: provider.bootstrapTrack,
  }))
);

function getProviderByItemId(itemId: string): ProviderModule {
  const prefix = itemId.slice(0, 2);

  return prefix2provider[prefix];
}
function getProviderName(enName: string): string {
  return enName2NameDict[enName] || '暂未支持的平台';
}

export default class Client {
  static getPlatformArray = getPlatformArray;
  static getProviderName = getProviderName;
  static showPlaylist(
    offset: number,
    platformId: string
  ): Promise<{ result: PlaylistInfo[] }> {
    const provider = getProviderByItemId(platformId);

    return provider.showPlaylist(offset);
  }

  static search(
    keyword: string,
    page: number,
    platformId: string
  ): Promise<{ result: Track[]; total: number }> {
    const provider = getProviderByItemId(platformId);

    return provider.search(keyword, page);
  }

  // One search over every provider. See ./aggregate.ts for what it gives.
  static searchAll(keyword: string): AggregateSearch {
    return createAggregateSearch(
      preferredProvider.map((provider) => ({
        name: provider.meta.enName,
        search: (text: string, page: number) => provider.search(text, page),
      })),
      keyword
    );
  }

  // The playlists the keyword finds, in one provider or, without platformId,
  // in all of them in turn. more() works as in searchAll.
  static searchPlaylists(keyword: string, platformId?: string): PlaylistSearch {
    const providers =
      platformId === undefined
        ? preferredProvider
        : [getProviderByItemId(platformId)];
    const session = createAggregateSearch<FoundPlaylist>(
      providers.map((provider) => ({
        name: provider.meta.enName,
        search: (text: string, page: number) =>
          provider.searchPlaylist(text, page),
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

  static getPlaylist(playlistId: string): Promise<Playlist> {
    const provider = getProviderByItemId(playlistId);

    return provider.getPlaylist(playlistId) as Promise<Playlist>;
  }

  static bootstrapTrack(trackId: string): Promise<string> {
    const provider = getProviderByItemId(trackId);

    if (provider === undefined) {
      return Promise.resolve('');
    }

    return provider.bootstrapTrack(trackId);
  }

  // Address of a song, taken from another provider when its own withholds
  // it. See ./resolve.ts for what it resolves with.
  static resolveTrack = resolveTrack;

  // The playlist a link shared from a provider points to, if it is one.
  static parseUrl(url: string): ParsedUrl | null {
    let result: ParsedUrl | null = null;

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
