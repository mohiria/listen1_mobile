// Searches every provider at once and shows what they find as one list, in
// which a song that several providers have appears once. Another version of
// a song (live, remix, excerpt) is a song of its own here.
import { isSameVersion } from './match.js';

// lists: one list of songs per provider, in the order the providers are
// preferred. shown: the songs already on show.
//
// Returns the songs to add after those on show. They are taken in turn from
// each provider. Of the copies of one song the one that is not restricted is
// kept, and of those the one from the provider preferred most; it stands
// where the first copy stood. A song already on show is left as it is.
export function mergeSongs(lists, shown = []) {
  const same = (a, b) => a.id === b.id || isSameVersion(a, b);
  const added = [];
  // for each song added, the place of its provider in the order
  const ranks = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));

  for (let i = 0; i < longest; i += 1) {
    lists.forEach((list, rank) => {
      const song = list[i];

      if (song === undefined || shown.some((one) => same(one, song))) {
        return;
      }

      const at = added.findIndex((one) => same(one, song));

      if (at === -1) {
        added.push(song);
        ranks.push(rank);
      } else if (
        added[at].id !== song.id &&
        (added[at].disabled
          ? !song.disabled || rank < ranks[at]
          : !song.disabled && rank < ranks[at])
      ) {
        added[at] = song;
        ranks[at] = rank;
      }
    });
  }

  return added;
}

// Takes from each list in turn. For what has no copies in other providers,
// such as playlists.
export function takeInTurn(lists) {
  const added = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));

  for (let i = 0; i < longest; i += 1) {
    lists.forEach((list) => {
      if (list[i] !== undefined) {
        added.push(list[i]);
      }
    });
  }

  return added;
}

// providers: [{ name, search(keyword, page) }], in the order they are
// preferred. search resolves with { result, total }.
//
// more() adds the next page of every provider that has more, and resolves
// with everything found so far:
//   { tracks, failed, done }  failed: names of the providers that did not
//                             answer this time; they are asked for the same
//                             page by the next call
//                             done: no provider has more
// It never rejects. merge(lists, shown) puts the pages of the providers into
// one list; tracks holds whatever was searched for.
export function createAggregateSearch(providers, keyword, merge = mergeSongs) {
  const states = providers.map((provider) => ({
    provider,
    page: 1,
    seen: new Set(),
    ended: false,
  }));
  let tracks = [];

  async function pageOf(state) {
    if (state.ended) {
      return [];
    }

    let found;

    try {
      found = await state.provider.search(keyword, state.page);
    } catch (error) {
      return null;
    }

    const fresh = found.result.filter((song) => !state.seen.has(song.id));

    fresh.forEach((song) => state.seen.add(song.id));
    state.page += 1;
    // a page with nothing new ends the provider whatever the total says
    if (fresh.length === 0 || state.seen.size >= found.total) {
      state.ended = true;
    }

    return fresh;
  }

  return {
    async more() {
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const lists = await Promise.all(states.map(pageOf));
        const failed = states
          .filter((state, i) => lists[i] === null)
          .map((state) => state.provider.name);
        const added = merge(
          lists.map((list) => list || []),
          tracks
        );
        const done = states.every((state) => state.ended);

        tracks = tracks.concat(added);
        // pages that only repeat songs on show would leave the list as it is
        if (added.length > 0 || failed.length > 0 || done) {
          return { tracks, failed, done };
        }
      }
    },
  };
}
