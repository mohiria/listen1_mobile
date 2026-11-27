// Decides whether two songs from different providers are the same song.

// What of a song is compared.
type Named = { title: string; artist: string };

// Innermost bracket group. NFKC has already turned （） and ［］ into () and [].
const BRACKETED = /\([^()]*\)|\[[^[\]]*\]|【[^【】]*】/g;

function stripBrackets(text: string): string {
  let rest = text;
  let previous: string;

  do {
    previous = rest;
    rest = rest.replace(BRACKETED, '');
  } while (rest !== previous);

  return rest;
}

function plain(text: unknown): string {
  return String(text).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function normalize(text: unknown): string {
  const whole = plain(text);

  // A name that is nothing but a bracket is kept as written.
  return stripBrackets(whole) || whole;
}

// Providers join several artists with different separators, and some report
// only the first artist, so the first one is all that can be compared.
function firstArtist(artist: unknown): string {
  return String(artist)
    .normalize('NFKC')
    .split(/[;&、]/)[0];
}

export function isSameSong(a: Named, b: Named): boolean {
  if (!a.title || !a.artist || !b.title || !b.artist) {
    return false;
  }

  return (
    normalize(a.title) === normalize(b.title) &&
    normalize(firstArtist(a.artist)) === normalize(firstArtist(b.artist))
  );
}

// Stricter than isSameSong: what the title says in brackets counts, so a live
// take, a remix or an excerpt is not the same as the song itself.
export function isSameVersion(a: Named, b: Named): boolean {
  if (!a.title || !a.artist || !b.title || !b.artist) {
    return false;
  }

  return (
    plain(a.title) === plain(b.title) &&
    normalize(firstArtist(a.artist)) === normalize(firstArtist(b.artist))
  );
}

// What to type into another provider's search box to find this song.
export function searchKeyword(song: Named): string {
  const plain = (text: unknown) => {
    const whole = String(text).normalize('NFKC');

    return (stripBrackets(whole).trim() || whole.trim()).replace(/\s+/g, ' ');
  };

  return `${plain(song.title)} ${plain(firstArtist(song.artist))}`;
}
