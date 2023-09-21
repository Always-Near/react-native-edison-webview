class OversizeUtils {
  private isLinkNode = (node: Node) => {
    const tagName = (node as HTMLLinkElement).tagName;
    return tagName === "A";
  };

  private isTextNode = (node: Node) => {
    if (node.nodeType != 3) {
      return false;
    }

    const nodeParent = node.parentNode as HTMLElement | null;
    const nodeParentTagName = nodeParent?.tagName;
    if (nodeParentTagName === "SCRIPT" || nodeParentTagName === "STYLE") {
      return false;
    }
  };

  private textNodeOverLength = (node: Node, maxLength: number) => {
    const value = node.nodeValue || "";
    if (value.length <= maxLength) {
      return false;
    }
    // some word over length
    const reg = new RegExp(`\\s*\\S{${maxLength},}\\s*`);
    return reg.test(value);
  };

  fixLongURLAndText = (element: HTMLElement) => {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
    );
    const maxNumOfCharacters = 30;
    let node = walker.nextNode();
    while (node) {
      if (this.isLinkNode(node)) {
        const a = node as HTMLLinkElement;
        let text = a.innerText;
        if (text === a.innerHTML && text.length > maxNumOfCharacters) {
          const results: string[] = [];
          while (text.length) {
            results.push(text.slice(0, maxNumOfCharacters));
            text = text.slice(maxNumOfCharacters);
            results.push("<wbr>");
          }
          a.innerHTML = results.join("");
        }
      } else if (
        this.isTextNode(node) &&
        this.textNodeOverLength(node, maxNumOfCharacters)
      ) {
        const text = (node.nodeValue || "").trim();
        node.nodeValue = "";
        let current: ChildNode = node as ChildNode;
        let start = 0;

        while (start < text.length) {
          const end = start + maxNumOfCharacters;
          const newText = document.createTextNode(text.slice(start, end));
          const wbr = document.createElement("wbr");

          current.after(newText);
          newText.after(wbr);
          current = wbr;
          start = end;
        }
      }
      node = walker.nextNode();
    }
  };

  private imageIsOverSize = (
    element: HTMLImageElement,
    documentWidth: number
  ) => {
    const elementWidth = element.getAttribute("width");
    if (elementWidth) {
      if (Number(elementWidth) > documentWidth) {
        return true;
      }
      return false;
    }
    const styles = element.style;
    if (
      styles.width == "none" ||
      styles.width == "" ||
      styles.width == undefined
    ) {
      if (
        element.style.maxWidth &&
        parseInt(element.style.maxWidth) > window.innerWidth - 100
      ) {
        return true;
      }
    }
    return false;
  };

  limitImageWidth(element: HTMLImageElement, documentWidth: number) {
    if (this.imageIsOverSize(element, documentWidth)) {
      element.classList.add("edo-limit-width");
      element.style.height = "auto";
      element.style.maxWidth = "100%";
      return;
    }

    const style = window.getComputedStyle(element);
    if (style.position != "static") {
      return;
    }

    if (
      !parseInt(style.minWidth, 10) &&
      !parseInt(style.maxWidth, 10) &&
      !element.style.width &&
      (!element.getAttribute("width") || !element.getAttribute("height"))
    ) {
      element.style.height = "auto";
      element.style.maxWidth = "100%";
    }
  }
}

export default new OversizeUtils();
