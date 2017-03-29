
const PROTOCOL_SEPARATOR = '://';

export class UrlMatcher {
  prefix: string|null = null;
  segments: string[];

  constructor(url: string) {
    const protocolSep = url.indexOf(PROTOCOL_SEPARATOR);
    if (protocolSep !== -1) {
      this.prefix = url.substr(0, protocolSep);
      url = url.substr(protocolSep + PROTOCOL_SEPARATOR.length);
    } else if (url.charAt(0) === '/') {
      url = url.substr(1);
    }
  }
}