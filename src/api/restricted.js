// Rules that tell whether a provider withholds a song from a visitor who is
// not logged in. Each rule was checked against what the provider's own track
// address request returned on 2026-11-26; see tools/test/restricted.test.mjs.

// privilege.pl is the bitrate the visitor may play: 0 for member-only songs,
// which get a 30 to 45 second trial clip instead. st < 0 is an off-shelf song.
export function neteaseIsRestricted(privilege) {
  if (!privilege) {
    return false;
  }

  return privilege.st < 0 || privilege.pl <= 0;
}

// An entry of the track address response. freeTrialInfo is set when the
// address covers only a trial clip of the song.
export function neteaseIsTrialClip(urlInfo) {
  return Boolean(urlInfo.freeTrialInfo);
}

// The track address request answers "需要付费" with an empty address for
// privilege 10, and gives an address for 0 and 8.
export function kugouIsRestricted(privilege) {
  return privilege === 10;
}

// A song from the playlist detail or the search response.
export function kuwoIsRestricted(song) {
  return Boolean(song.payInfo) && song.payInfo.listen_fragment === '1';
}

// For a restricted song Kuwo hands out the address of one fixed 11 second
// spoken prompt. Host and signed prefix vary, the file does not.
export function kuwoIsPromptAudio(url) {
  return /\/n1\/69\/32\/588957081\.mp3/.test(url);
}

// A song of a playlist. The track address request answers "应版权方要求，
// 该内容已经无法提供" for copyright 0 and gives an address for 1 (26 songs of
// one playlist, 2026-11-28).
export function miguIsRestricted(song) {
  return Number(song.copyright) === 0;
}
