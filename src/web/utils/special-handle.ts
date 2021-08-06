class SpecialHandle {
  private getFontSizeInStyle = (style: string | null) => {
    if (!style) {
      return "";
    }
    const fontStyle = style
      .split(";")
      .find((style) => style.trim().startsWith("font-size"));
    if (!fontStyle) {
      return "";
    }
    const value = fontStyle.split(":")[1] || "";
    return value.trim();
  };

  /**
   * remove this node like `<span style="font-size:1px;">abc</span>`
   * for facebook
   */
  removeFacebookHiddenText = (node: HTMLElement) => {
    const tagName = node.tagName;
    if (tagName !== "SPAN") {
      return;
    }
    const fontSize = this.getFontSizeInStyle(node.getAttribute("style"));
    if (!fontSize) {
      return;
    }
    if (fontSize === "1px") {
      node.parentNode?.removeChild(node);
    }
  };
}

export default new SpecialHandle();
