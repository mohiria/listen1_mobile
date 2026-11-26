// Decides whether two songs from different providers are the same song.

// Innermost bracket group. NFKC has already turned （） and ［］ into () and [].
const BRACKETED = /\([^()]*\)|\[[^[\]]*\]|【[^【】]*】/g;

function stripBrackets(text) {
  let rest = text;
  let previous;

  do {
    previous = rest;
    rest = rest.replace(BRACKETED, '');
  } while (rest !== previous);

  return rest;
}

function normalize(text) {
  const plain = String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '');

  // A name that is nothing but a bracket is kept as written.
  return stripBrackets(plain) || plain;
}

// Providers join several artists with different separators, and some report
// only the first artist, so the first one is all that can be compared.
function firstArtist(artist) {
  return String(artist)
    .normalize('NFKC')
    .split(/[;&、]/)[0];
}

export function isSameSong(a, b) {
  if (!a.title || !a.artist || !b.title || !b.artist) {
    return false;
  }

  return (
    normalize(a.title) === normalize(b.title) &&
    normalize(firstArtist(a.artist)) === normalize(firstArtist(b.artist))
  );
}
