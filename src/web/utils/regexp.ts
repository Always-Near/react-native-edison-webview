const UnicodeEmailChars =
  "\u0080-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1B00-\u1B7F\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u20D0-\u20FF\u2100-\u214F\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2F00-\u2FDF\u2FF0-\u2FFF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA700-\uA71F\uA800-\uA82F\uA840-\uA87F\uAC00-\uD7AF\uF900-\uFAFF";

// https://github.com/agent8/Mailspring/blob/quanzs-gavatar/app/internal_packages/message-list/lib/autolinker.es6#L54
export const RegExpUtils = {
  emailRegex() {
    const parts = [
      `(`,
      `[a-z.A-Z${UnicodeEmailChars}0-9!#$%&\\'*+\\-/=?^_\`{|}~]+`,
      "@",
      `[A-Za-z${UnicodeEmailChars}0-9.-]+\\.[A-Za-z]{2,63}`,
      `)`,
    ];
    return new RegExp(parts.join(""), "g");
  },
  phoneRegex() {
    return new RegExp(
      /([+(]+|\b)(?:(\d{1,3}[- ()]*)?)(\d{3})[- )]+(\d{3})[- ]+(\d{4})(?: *x(\d+))?\b/g
    );
  },
  urlRegex() {
    const commonTlds = [
      "com",
      "org",
      "edu",
      "gov",
      "uk",
      "net",
      "ca",
      "de",
      "jp",
      "fr",
      "au",
      "us",
      "ru",
      "ch",
      "it",
      "nl",
      "se",
      "no",
      "es",
      "mil",
      "ly",
    ];

    const parts = [
      "(",
      // one of:
      "(",
      // This OR block matches any TLD if the URL includes a scheme, and only
      // the top ten TLDs if the scheme is omitted.
      // YES - https://getmailspring.ai
      // YES - https://10.2.3.1
      // YES - getmailspring.com
      // NO  - getmailspring.ai
      "(",
      // scheme, ala https:// (mandatory)
      "([A-Za-z]{3,9}:(?:\\/\\/))",

      // username:password (optional)
      "(?:[\\-;:&=\\+\\$,\\w]+@)?",

      // one of:
      "(",
      // domain with any tld
      "([a-zA-Z0-9-_]+\\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\\.[a-zA-Z]{2,11}",

      "|",

      // ip address
      "(?:[0-9]{1,3}\\.){3}[0-9]{1,3}",
      ")",

      "|",

      // scheme, ala https:// (optional)
      "([A-Za-z]{3,9}:(?:\\/\\/))?",

      // username:password (optional)
      "(?:[\\-;:&=\\+\\$,\\w]+@)?",

      // one of:
      "(",
      // domain with common tld
      `([a-zA-Z0-9-_]+\\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\\.(?:${commonTlds.join(
        "|"
      )})$`,

      "|",

      // ip address
      "(?:[0-9]{1,3}\\.){3}[0-9]{1,3}",
      ")",
      ")",

      // :port (optional)
      "(?::d*)?",

      "|",

      // mailto:username@password.com
      "mailto:\\/*(?:\\w+\\.|[\\-;:&=\\+\\$.,\\w]+@)[A-Za-z0-9\\.\\-]+",
      ")",

      // optionally followed by:
      "(",
      // URL components
      // (last character must not be puncation, hence two groups)
      "(?:[\\+=~%\\/\\.\\w\\-_@]*[\\+~%\\/\\w\\-:_]+)?",

      // optionally followed by: a query string and/or a #location
      // (last character must not be puncation, hence two groups)
      "(?:(\\?[\\-\\+=&;%@\\.\\w_\\#]*[\\#\\-\\+=&;%@\\w_\\/]+)?#?(?:['\\$\\&\\(\\)\\*\\+,;=\\.\\!\\/\\\\\\w%-?]*[\\/\\\\\\w@$\\.&=]+)?)?",
      ")?",
      ")",
    ];

    return new RegExp(parts.join(""), "gi");
  },
};
