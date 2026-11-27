// Reads bytes as UTF-8 and puts U+FFFD where they are not. Some answers cut
// a text in the middle of a character, and the decoder of the device gives
// nothing at all for such an answer.
export function decodeUtf8(bytes: ArrayLike<number>): string {
  const parts: string[] = [];
  let i = 0;

  while (i < bytes.length) {
    const first = bytes[i];
    let more = 0;
    let code = 0;

    if (first < 0x80) {
      code = first;
    } else if (first >= 0xc2 && first <= 0xdf) {
      more = 1;
      code = first % 0x20;
    } else if (first >= 0xe0 && first <= 0xef) {
      more = 2;
      code = first % 0x10;
    } else if (first >= 0xf0 && first <= 0xf4) {
      more = 3;
      code = first % 0x08;
    } else {
      code = -1;
    }

    let taken = 1;

    while (code !== -1 && taken <= more) {
      const next = bytes[i + taken];

      // the byte that breaks the character is read again as the next one
      if (next === undefined || next < 0x80 || next > 0xbf) {
        code = -1;
      } else {
        code = code * 0x40 + (next % 0x40);
        taken += 1;
      }
    }

    parts.push(
      code === -1 || code > 0x10ffff ? '�' : String.fromCodePoint(code)
    );
    i += taken;
  }

  return parts.join('');
}
