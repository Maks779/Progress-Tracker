const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]/g;

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function safe(name: string | null | undefined): string | null {
  const cleaned = name?.replace(UNSAFE, '-').trim();
  return cleaned ? cleaned : null;
}

/**
 * The file name from a `Content-Disposition` header: the UTF-8 name (`filename*`, RFC 6266)
 * first, then the plain one, then the fallback. Path characters are replaced, so a name can
 * never point outside the folder it is saved to.
 */
export function fileNameFrom(disposition: string | null | undefined, fallback: string): string {
  if (disposition) {
    const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition);
    const fromUtf8 = utf8 ? safe(decode(utf8[1].trim())) : null;
    if (fromUtf8) {
      return fromUtf8;
    }
    const plain = /filename\s*=\s*"([^"]*)"/i.exec(disposition) ?? /filename\s*=\s*([^;]+)/i.exec(disposition);
    const fromPlain = plain ? safe(plain[1].trim()) : null;
    if (fromPlain) {
      return fromPlain;
    }
  }
  return fallback;
}
