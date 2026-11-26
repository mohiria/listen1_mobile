export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  img_url?: string;
  // the provider the song belongs to, by its enName
  source: string;
  disabled?: boolean;
};

export type Provider = { name: string; platformId: string; enName: string };

export type ResolveResult =
  | { url: string; source: string; switched: boolean }
  | { url: ''; reason: 'unavailable' | 'network' };

export type PlaylistInfo = { id: string; title: string; cover_img_url: string };

export default class Client {
  static getPlatformArray(): Provider[];
  static getProviderName(enName: string): string;
  static showPlaylist(
    offset: number,
    platformId: string
  ): Promise<{ result: PlaylistInfo[] }>;
  static search(
    keyword: string,
    page: number,
    platformId: string
  ): Promise<{ result: Track[]; total: number }>;
  static getPlaylist(
    playlistId: string
  ): Promise<{ info: PlaylistInfo; tracks: Track[] }>;
  static resolveTrack(track: Track): Promise<ResolveResult>;
}
