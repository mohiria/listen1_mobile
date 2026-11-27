// Search results this short are excerpts and ringtone cuts of a song, not the
// song. Providers leave them out of what a search shows.
const SHORTEST_SONG = 30;

// seconds: the length a provider reports for a song. A song whose length is
// not known is kept.
export function isExcerpt(seconds: unknown): boolean {
  const length = Number(seconds);

  return length > 0 && length < SHORTEST_SONG;
}
