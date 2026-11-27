export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  img_url?: string;
  // the provider the song belongs to, by its enName
  source: string;
  disabled?: boolean;
  artist_id?: string;
  album_id?: string;
  source_url?: string;
  url?: string;
  lyric_url?: string;
};

export type Provider = { name: string; platformId: string; enName: string };

export type ResolveResult =
  | { url: string; source: string; switched: boolean }
  | { url: ''; reason: 'unavailable' | 'network' };

// One search over every provider. more() adds the next page of each and
// gives everything found so far; failed holds the enName of the providers
// that did not answer.
export type AggregateSearch = {
  more(): Promise<{ tracks: Track[]; failed: string[]; done: boolean }>;
};

export type PlaylistInfo = {
  id: string;
  title: string;
  cover_img_url: string;
  source_url?: string;
};

export type Playlist = { info: PlaylistInfo; tracks: Track[] };

// A playlist as a search finds it.
export type FoundPlaylist = PlaylistInfo & { author: string; count: number };

export type PlaylistSearch = {
  more(): Promise<{
    playlists: FoundPlaylist[];
    failed: string[];
    done: boolean;
  }>;
};

export type ParsedUrl = { type: string; id: string };

// What every file in ./provider exports.
export type ProviderModule = {
  meta: Provider;
  showPlaylist(
    offset: number
  ): Promise<{ result: PlaylistInfo[]; hasNextPage?: boolean }>;
  // null for an id that is not a playlist of the provider
  getPlaylist(playlistId: string): Promise<Playlist> | null;
  // '' when the provider withholds the song
  bootstrapTrack(trackId: string): Promise<string>;
  search(
    keyword: string,
    page: number
  ): Promise<{ result: Track[]; total: number }>;
  searchPlaylist(
    keyword: string,
    page: number
  ): Promise<{ result: FoundPlaylist[]; total: number }>;
  parseUrl(url: string): ParsedUrl | null;
};
