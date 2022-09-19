import { RegExpUtils } from "./regexp";

type Matchers = [string, RegExp, { exclude: RegExp[] }?];

function matchesAnyRegexp(text: string, regexps: RegExp[]) {
  for (const excludeRegexp of regexps) {
    if (excludeRegexp.test(text)) {
      return true;
    }
  }
  return false;
}

function wrap<K extends keyof HTMLElementTagNameMap>(
  range: Range,
  nodeName: K
) {
  const newNode = document.createElement(nodeName);
  try {
    range.surroundContents(newNode);
  } catch (error) {
    newNode.appendChild(range.extractContents());
    range.insertNode(newNode);
  }
  return newNode;
}

function runOnTextNode(node: Node, matchers: Matchers[]) {
  if (node.parentElement) {
    const withinScript = node.parentElement.tagName === "SCRIPT";
    const withinStyle = node.parentElement.tagName === "STYLE";
    const withinA = node.parentElement.closest("a") !== null;
    if (withinScript || withinA || withinStyle) {
      return;
    }
  }

  if (!node.textContent || node.textContent.trim().length < 4) {
    return;
  }

  let longest: [string, RegExpExecArray] | null = null;
  let longestLength: number = 0;
  for (const [prefix, regex, options] of matchers) {
    regex.lastIndex = 0;
    const match = regex.exec(node.textContent);
    if (match !== null) {
      if (options?.exclude && matchesAnyRegexp(match[0], options.exclude)) {
        continue;
      }
      if (match[0].length > longestLength) {
        longest = [prefix, match];
        longestLength = match[0].length;
      }
    }
  }

  if (longest) {
    const [prefix, match] = longest;
    const href = `${prefix}${match[0]}`;
    const range = document.createRange();
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].length);
    const aTag = wrap(range, "a");
    aTag.href = href;
    aTag.title = href;
    return;
  }
}

export function autolink() {
  // Traverse the new DOM tree and make things that look like links clickable,
  // and ensure anything with an href has a title attribute.
  const textWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );
  const matchers: Matchers[] = [
    [
      "mailto:",
      RegExpUtils.emailRegex(),
      {
        exclude: [/\..*[/|?].*@/],
      },
    ],
    ["tel:", RegExpUtils.phoneRegex()],
    ["", RegExpUtils.urlRegex()],
  ];

  while (textWalker.nextNode()) {
    runOnTextNode(textWalker.currentNode, matchers);
  }
}
