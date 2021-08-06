const { FIRST_ORDERED_NODE_TYPE } = XPathResult;

function* walkBackwards(
  node: ChildNode
): Generator<ChildNode | undefined, void, unknown> {
  if (!node) {
    return;
  }
  const childs = node.childNodes;
  if (childs.length > 0) {
    for (let i = childs.length - 1; i >= 0; i--) {
      yield* walkBackwards(childs[i]);
    }
  }
  yield node;
  return;
}

class QuotedHTMLTransformer {
  private parseHTML = (html: string) => {
    const domParser = new DOMParser();
    let doc;
    try {
      doc = domParser.parseFromString(html, "text/html");
    } catch (error) {
      const errText = `HTML Parser Error: ${error.toString()}`;
      doc = domParser.parseFromString(errText, "text/html");
      console.error(error.message);
    }

    // As far as we can tell, when this succeeds, doc /always/ has at least
    // one child: an <html> node.
    return doc;
  };

  private escapeRegExp = (str: string) => {
    return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
  };

  private textAndNodesAfterNode = (el: Node) => {
    let text = "";
    let curEl: Node | null = el;
    const nodes: ChildNode[] = [];
    while (curEl) {
      let sibling = curEl.nextSibling;
      while (sibling) {
        text += sibling.textContent;
        nodes.push(sibling);
        sibling = sibling.nextSibling;
      }
      curEl = curEl.parentNode;
    }
    return { text, nodes };
  };

  private unwrappedSignatureDetector = (
    doc: Element,
    quoteElements: Node[]
  ) => {
    // Find the last quoteBlock
    for (const node of walkBackwards(doc)) {
      if (!node) {
        continue;
      }
      let textAndNodes;
      let focusNode: Node = node;
      if (quoteElements.includes(node)) {
        textAndNodes = this.textAndNodesAfterNode(node);
      } else if (
        node.previousSibling &&
        quoteElements.includes(node.previousSibling)
      ) {
        focusNode = node.previousSibling;
        textAndNodes = this.textAndNodesAfterNode(node.previousSibling);
      } else {
        continue;
      }

      const { text, nodes } = textAndNodes;
      const maybeSig = text.replace(/\s/g, "");
      if (maybeSig.length > 0) {
        if (
          (focusNode.textContent || "")
            .replace(/\s/g, "")
            .search(this.escapeRegExp(maybeSig)) >= 0
        ) {
          return nodes;
        }
      }
      break;
    }
    return [];
  };

  private isElementFollowedByUnquotedElement = (
    el: Element,
    quoteElements: Node[]
  ) => {
    const seen: Node[] = [];
    let head: Node | null = el;

    while (head) {
      // advance to the next sibling, or the parent's next sibling
      while (head && !head.nextSibling) {
        head = head.parentNode;
      }
      if (!head) {
        break;
      }
      head = head.nextSibling;

      // search this branch of the tree for any text nodes / images that
      // are not contained within a matched quoted text block. We mark
      // the subtree as "seen" because we traverse upwards, and would
      // re-evaluate the subtree on each iteration otherwise.
      const pile = [head];
      let node = null;

      while ((node = pile.pop())) {
        if (seen.includes(node)) {
          continue;
        }
        if (quoteElements.includes(node)) {
          continue;
        }
        if (node.childNodes) {
          pile.push(...node.childNodes);
        }
        if (node.nodeName === "IMG") {
          return true;
        }
        if (
          node.nodeType === Node.TEXT_NODE &&
          node.textContent &&
          node.textContent.trim().length > 0
        ) {
          return true;
        }
      }
      if (head) {
        seen.push(head);
      }
    }

    return false;
  };

  private findGmailQuotes = (doc: Document) => {
    // Gmail creates both div.gmail_quote and blockquote.gmail_quote. The div
    // version marks text but does not cause indentation, but both should be
    // considered quoted text.
    const els = Array.from(doc.querySelectorAll(".gmail_quote"));
    const blocks: Element[] = [];
    for (const el of els) {
      // Keep quotes that are followed by non-quote blocks (eg: inline reply text)
      if (this.isElementFollowedByUnquotedElement(el, els)) {
        continue;
      }
      blocks.push(el);
    }
    return blocks;
  };

  private findBlockquoteQuotes = (doc: Document) => {
    const els = Array.from(doc.querySelectorAll("blockquote"));
    const blocks: Element[] = [];
    for (const el of els) {
      // if it is a indent, skip this block
      if (
        el.style.margin === "0px 0px 0px 40px" &&
        el.style.border === "none" &&
        !el.className
      ) {
        continue;
      }
      // Keep quotes that are followed by non-quote blocks (eg: inline reply text)
      if (this.isElementFollowedByUnquotedElement(el, els)) {
        continue;
      }
      blocks.push(el);
    }
    return blocks;
  };

  private findQuotesAfterMessageHeaderBlock = (doc: Document) => {
    // This detector looks for a element in the DOM tree containing
    // three children: <b>Sent:</b> or <b>Date:</b> and <b>To:</b> and
    // <b>Subject:</b>. It then returns every node after that as quoted text.

    // Find a DOM node exactly matching <b>Sent:</b>
    const dateXPath = `
      //b[. = 'Sent:'] |
      //b[. = 'Date:'] |
      //span[. = 'Sent: '] |
      //span[. = 'Date: '] |
      //span[. = 'Sent:'] |
      //span[. = 'Date:']`;
    const dateMarker = doc.evaluate(
      dateXPath,
      doc.body,
      null,
      FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!dateMarker) {
      return [];
    }

    // check to see if the parent container also contains the other two
    const headerContainer = dateMarker.parentElement;
    if (!headerContainer) {
      return [];
    }

    let matches = 0;
    for (const child of Array.from(headerContainer.children)) {
      const tc = (child.textContent || "").trim();
      if (tc === "To:" || tc === "Subject:") {
        matches++;
      }
    }

    if (matches != 2) {
      return [];
    }
    // got a hit! let's cut some text.
    const quotedTextNodes: Element[] = [];

    // Special case to add "From:" because it's often detatched from the rest of the
    // header fields. We just add it where ever it's located.
    const fromXPath =
      "//b[. = 'From:'] | //span[. = 'From:']| //span[. = 'From: ']";
    const from = doc.evaluate(
      fromXPath,
      doc.body,
      null,
      FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (from) {
      if (from.nodeName === "SPAN") {
        const parent = from.parentElement;
        if (parent) {
          quotedTextNodes.push(parent);
        }
      } else {
        quotedTextNodes.push(from as Element);
      }
    }

    // The headers container and everything past it in the document is quoted text.
    // This traverses the DOM, walking up the tree and adding all siblings below
    // our current path to the array.
    let head: Element | null = headerContainer;
    while (head) {
      quotedTextNodes.push(head);
      while (head && !head.nextElementSibling) {
        head = head.parentElement;
      }
      if (head) {
        head = head.nextElementSibling;
      }
    }
    return quotedTextNodes;
  };

  private findConfidentialityNotice = (doc: Document) => {
    // Traverse from the body down the tree of "last" nodes looking for a
    // Confidentiality Notice TEXT_NODE. We need to count this node as quoted
    // text or it'll be handled as an inline reply and totally disable quoted
    // text removal.
    let head: ChildNode | null = doc.body;
    while (head) {
      const tc = (head.textContent || "").trim();
      if (
        head.nodeType === Node.TEXT_NODE &&
        tc.startsWith("Confidentiality Notice")
      ) {
        return [head];
      }
      if (head.childNodes.length === 0 && tc === "") {
        head = head.previousSibling;
      } else {
        head = head.lastChild;
      }
    }
    return [];
  };

  private findQuoteElements = (doc: Document) => {
    const parsers = [
      this.findGmailQuotes,
      this.findBlockquoteQuotes,
      this.findQuotesAfterMessageHeaderBlock,
      this.findConfidentialityNotice,
    ];

    const quoteElements: Array<Element | ChildNode> = [];
    for (const parser of parsers) {
      quoteElements.push(...parser(doc));
    }

    // Find top-level nodes that look like a signature - some clients append
    // a signature block /beneath/ the quoted text and we need to count is as
    // quoted text as well — otherwise it gets considered an inline reply block.
    const unwrappedSignatureNodes = this.unwrappedSignatureDetector(
      doc as any,
      quoteElements
    );
    quoteElements.push(...unwrappedSignatureNodes);

    // Keep quotes that are followed by non-quote blocks (eg: inline reply text)
    // quoteElements = quoteElements.filter(
    //   el => !this._isElementFollowedByUnquotedElement(el, quoteElements)
    // );

    return quoteElements;
  };

  private outputHTMLFor(doc: Document, initialHTML: string) {
    if (!doc.body) {
      doc = this.parseHTML("");
    }
    if (
      /<\s?head\s?>/i.test(initialHTML) ||
      /<\s?body[\s>]/i.test(initialHTML)
    ) {
      return doc.children[0].innerHTML;
    }
    return doc.body.innerHTML;
  }

  private quoteStringDetector = (doc: Document) => {
    const quoteNodesToRemove = [];
    let seenInitialQuoteEnd = false;

    for (const node of walkBackwards(doc as any)) {
      if (!node) {
        continue;
      }
      if (node.nodeType === Node.DOCUMENT_NODE) {
        continue;
      }
      if (
        node.nodeType === Node.TEXT_NODE &&
        (node.nodeValue || "").trim().length > 0
      ) {
        if (!seenInitialQuoteEnd) {
          if (/wrote:\s*$/gim.test(node.nodeValue || "")) {
            seenInitialQuoteEnd = true;
            quoteNodesToRemove.push(node);
            if (/[On,At] \S/gim.test(node.nodeValue || "")) {
              // The beginning of the quoted string may be in the same node
              return quoteNodesToRemove;
            }
          } else {
            // This means there's some text in between the end of the content
            // (adjacent to the blockquote) and the quote string. We shouldn't be
            // killing any text in this case.
            return quoteNodesToRemove;
          }
        } else {
          quoteNodesToRemove.push(node);
          if (/[On,At] \S/gim.test(node.nodeValue || "")) {
            // This means we've reached the beginning of the quoted string.
            return quoteNodesToRemove;
          }
        }
      } else {
        if (seenInitialQuoteEnd) {
          quoteNodesToRemove.push(node);
        }
      }
    }
    return quoteNodesToRemove;
  };

  private removeImagesStrippedByAnotherClient = (doc: Document) => {
    if (!doc.body) {
      return;
    }

    const result = doc.evaluate(
      "//img[contains(@alt,'removed by sender')]",
      doc.body,
      null,
      XPathResult.ANY_TYPE,
      null
    );
    const nodes: any[] = [];

    // collect all the results and then remove them all
    // to avoid modifying the dom while using the xpath selector
    let node = result.iterateNext();
    while (node) {
      nodes.push(node);
      node = result.iterateNext();
    }
    nodes.forEach((n) => n.remove());
  };

  private removeUnnecessaryWhitespace = (doc: Document) => {
    if (!doc.body) {
      return;
    }

    // quanzs: Should not replace <br><br> to <br>, so comment it out
    // Find back-to-back <br><br> at the top level and de-duplicate them
    // const { children } = doc.body;
    // const extraTailBrTags = [];
    // for (let i = children.length - 1; i >= 0; i--) {
    //   const curr = children[i];
    //   const next = children[i - 1];
    //   if (curr && curr.nodeName === 'BR' && next && next.nodeName === 'BR') {
    //     extraTailBrTags.push(curr);
    //   } else {
    //     break;
    //   }
    // }
    // for (const el of extraTailBrTags) {
    //   el.remove();
    // }

    // Traverse down the tree of "last child" nodes to get the last child of the last child.
    // The deepest node at the end of the document.
    let lastOfLast: Element = doc.body;
    while (lastOfLast.lastElementChild) {
      lastOfLast = lastOfLast.lastElementChild;
    }

    // Traverse back up the tree - at each level, attempt to remove
    // whitespace from the last child and then remove the child itself
    // if it's completely empty. Repeat until a child has meaningful content,
    // then move up the tree.
    //
    // Containers with empty space at the end occur pretty often when we
    // remove the quoted text and it had preceding spaces.
    const removeTrailingWhitespaceChildren = (el: ChildNode) => {
      while (el.lastChild) {
        const child = el.lastChild;
        if (!child) {
          continue;
        }
        if (child.nodeType === Node.TEXT_NODE) {
          if ((child.textContent || "").trim() === "") {
            child.remove();
            continue;
          }
        }
        if (["BR", "P", "DIV", "SPAN", "HR"].includes(child.nodeName)) {
          const el = child as Element;
          removeTrailingWhitespaceChildren(el);
          if (
            el.childElementCount === 0 &&
            (el.textContent || "").trim() === ""
          ) {
            el.remove();
            continue;
          }
        }
        break;
      }
    };

    while (lastOfLast.parentElement) {
      lastOfLast = lastOfLast.parentElement;
      removeTrailingWhitespaceChildren(lastOfLast);
    }
  };

  hasQuotedHTML(html: string) {
    const doc = this.parseHTML(html);
    const quoteElements = this.findQuoteElements(doc);
    const quoteString = this.quoteStringDetector(doc);
    return quoteElements.length > 0 || quoteString.length > 0;
  }

  removeQuotedHTML(html: string) {
    const doc = this.parseHTML(html);

    for (const el of this.findQuoteElements(doc)) {
      if (el) {
        el.remove();
      }
    }

    if (!doc.body) {
      return this.outputHTMLFor(this.parseHTML(""), html);
    }

    for (const el of this.quoteStringDetector(doc)) {
      if (el && el !== doc.body) {
        el.remove();
      }
    }
    // It's possible that the entire body was quoted text anyway and we've
    // removed everything.

    if (
      !doc.body ||
      !doc.children[0] ||
      (doc.body.textContent || "").trim().length === 0
    ) {
      return this.outputHTMLFor(this.parseHTML(html), html);
    }

    this.removeImagesStrippedByAnotherClient(doc);
    this.removeUnnecessaryWhitespace(doc);
    return this.outputHTMLFor(doc, html);
  }
}

export default new QuotedHTMLTransformer();
