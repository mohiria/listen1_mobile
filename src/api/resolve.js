// Finds a playable address for a song: from its own provider when that one
// gives it out, otherwise from the first other provider that has the same
// song and gives its address out. The same version of the song is looked for
// at every provider before another version (live, remix) is settled for.
import { isSameSong, isSameVersion, searchKeyword } from './match.js';

// providers: [{ name, prefix, search(keyword), bootstrapTrack(trackId) }], in
// the order they are preferred when switching. prefix is what the ids of the
// provider's songs start with. search resolves with the first page of songs.
//
// The returned function never rejects. It resolves with
//   { url, source, switched }  source is the name of the provider that plays
//   { url: '', reason }        'unavailable': no provider has a playable copy
//                              'network': not one provider answered
export function createResolver(providers) {
  // id of a song -> the same song at the provider it was switched to. The
  // song is kept rather than its address, which expires.
  const remembered = new Map();

  return async function resolveTrack(track) {
    let answers = 0;

    async function addressOf(provider, trackId) {
      try {
        const url = await provider.bootstrapTrack(trackId);

        answers += 1;

        return url || '';
      } catch (error) {
        return '';
      }
    }

    // the same version of the song at the provider, then another version
    async function matchesAt(provider, keyword) {
      try {
        const songs = (await provider.search(keyword)).filter(
          (song) => !song.disabled
        );

        answers += 1;

        const exact = songs.find((song) => isSameVersion(track, song));

        return [
          exact,
          songs.find((song) => song !== exact && isSameSong(track, song)),
        ];
      } catch (error) {
        return [];
      }
    }

    const own = providers.find((provider) =>
      track.id.startsWith(provider.prefix)
    );

    // a provider that marked the song restricted is not asked for its address
    if (own !== undefined && !track.disabled) {
      const url = await addressOf(own, track.id);

      if (url !== '') {
        return { url, source: own.name, switched: false };
      }
    }

    const earlier = remembered.get(track.id);

    if (earlier !== undefined) {
      const url = await addressOf(earlier.provider, earlier.song.id);

      if (url !== '') {
        return { url, source: earlier.provider.name, switched: true };
      }
      remembered.delete(track.id);
    }

    const others = providers.filter((provider) => provider !== own);
    const keyword = searchKeyword(track);
    const matches = await Promise.all(
      others.map((provider) => matchesAt(provider, keyword))
    );

    for (let pick = 0; pick < 2; pick += 1) {
      for (let i = 0; i < others.length; i += 1) {
        const song = matches[i][pick];

        if (song !== undefined) {
          // eslint-disable-next-line no-await-in-loop
          const url = await addressOf(others[i], song.id);

          if (url !== '') {
            remembered.set(track.id, { provider: others[i], song });

            return { url, source: others[i].name, switched: true };
          }
        }
      }
    }

    return { url: '', reason: answers === 0 ? 'network' : 'unavailable' };
  };
}
