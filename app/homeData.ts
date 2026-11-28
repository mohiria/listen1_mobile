import type { Chart, Playlist, PlaylistInfo } from '../src/api/types';

// The song that leads a chart: its name, and its picture as the cover of the
// chart. Where the song has no picture the chart's own takes its place.
export type Lead = { song: string; cover: string };

export type HomeState = {
  // by the id of the chart
  leads: { [chartId: string]: Lead };
  // one playlist of each provider that answered, the first it recommends
  recommended: PlaylistInfo[];
  loading: boolean;
  // what the last load did not get: ids of charts, and of providers for
  // their playlist
  failed: string[];
  // why the last of them failed
  error: string;
};

type Source = {
  charts: Chart[];
  platformIds: string[];
  getPlaylist(playlistId: string): Promise<Playlist>;
  showPlaylist(
    offset: number,
    platformId: string
  ): Promise<{ result: PlaylistInfo[] }>;
};

// What the home screen shows of the providers, kept outside the screen so
// that it stays while the screen comes and goes. load() asks for what is
// missing, one request at a time per provider; load(true) asks for all of it
// again and keeps what is shown until the new answer is there.
export function createHomeData(source: Source) {
  let state: HomeState = {
    leads: {},
    recommended: [],
    loading: false,
    failed: [],
    error: '',
  };
  const recommendedBy: { [platformId: string]: PlaylistInfo } = {};
  const listeners = new Set<() => void>();

  function set(next: Partial<HomeState>) {
    state = { ...state, ...next };
    listeners.forEach(listener => listener());
  }

  async function load(all = false): Promise<void> {
    if (state.loading) {
      return;
    }
    set({ loading: true, failed: [], error: '' });

    const failed: string[] = [];
    let error = '';
    const note = (what: string, reason: unknown) => {
      failed.push(what);
      error = `${what}: ${
        reason instanceof Error ? reason.message : String(reason)
      }`;
    };

    await Promise.all(
      source.platformIds.map(async platformId => {
        const mine = source.charts.filter(
          chart => chart.id.slice(0, 2) === platformId
        );

        for (const chart of mine) {
          if (all || state.leads[chart.id] === undefined) {
            try {
              // Promise.resolve: getPlaylist can throw for an id it does not
              // recognise
              const playlist = await Promise.resolve().then(() =>
                source.getPlaylist(chart.id)
              );

              if (playlist.tracks.length === 0) {
                throw new Error('榜单里没有歌曲');
              }
              set({
                leads: {
                  ...state.leads,
                  [chart.id]: {
                    song: playlist.tracks[0].title,
                    cover:
                      playlist.tracks[0].img_url ||
                      playlist.info.cover_img_url ||
                      '',
                  },
                },
              });
            } catch (reason) {
              note(chart.id, reason);
            }
          }
        }

        if (all || recommendedBy[platformId] === undefined) {
          try {
            const { result } = await source.showPlaylist(0, platformId);

            if (result.length === 0) {
              throw new Error('没有推荐歌单');
            }
            recommendedBy[platformId] = result[0];
            set({
              recommended: source.platformIds
                .map(id => recommendedBy[id])
                .filter(info => info !== undefined),
            });
          } catch (reason) {
            note(platformId, reason);
          }
        }
      })
    );

    set({ loading: false, failed, error });
  }

  return {
    load,
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
