class DarkModeUtils {
  rgbColor = (color: string) => {
    const reg = /^rgba?\(([\d\s,\.]*)\)$/gi;
    const test = reg.exec(color);
    const rgba = test ? test[1] : "";
    return rgba.split(",").map((n) => {
      const trimStr = n.trim();
      return Number(trimStr);
    });
  };

  private reversedColor = (
    r: number,
    g: number,
    b: number,
    key: "color" | "backgroundColor",
    baseBackground: number[]
  ) => {
    const isBackground = key === "backgroundColor";
    //if color is dark or bright (http://alienryderflex.com/hsp.html)
    const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
    if (hsp < 130 && !isBackground) {
      //foreground dark color
      const delta = 255 - hsp;
      const nr = Math.min(r + delta, 234);
      const ng = Math.min(g + delta, 234);
      const nb = Math.min(b + delta, 234);
      return `rgb(${nr},${ng},${nb})`;
    } else if (hsp > 200 && isBackground) {
      const [baseR, baseG, baseB] = baseBackground;
      //bg color brighter than #cccccc
      const nr = Math.max(r - hsp, baseR || 27);
      const ng = Math.max(g - hsp, baseG || 28);
      const nb = Math.max(b - hsp, baseB || 30);
      return `rgb(${nr},${ng},${nb})`;
    } else {
      return this.desatruate(r, g, b);
    }
  };

  private desatruate = (r: number, g: number, b: number) => {
    const gray = r * 0.3086 + g * 0.6094 + b * 0.082;
    const sat = 0.8; //80%
    const nr = Math.round(r * sat + gray * (1 - sat));
    const ng = Math.round(g * sat + gray * (1 - sat));
    const nb = Math.round(b * sat + gray * (1 - sat));
    return `rgb(${nr},${ng},${nb})`;
  };

  applyDarkModeForNode = (node: HTMLElement, baseBackground: number[]) => {
    const style = window.getComputedStyle(node, null);
    const color = style.color;
    if (color) {
      const [r, g, b, a] = this.rgbColor(color);
      if (a !== 0) {
        // not transparent
        node.style.setProperty(
          "color",
          this.reversedColor(r, g, b, "color", baseBackground),
          "important"
        );
      }
    }
    const backgroundColor = style.backgroundColor;
    if (backgroundColor) {
      const [r, g, b, a] = this.rgbColor(backgroundColor);
      if (a !== 0) {
        // not transparent
        node.style.setProperty(
          "background-color",
          this.reversedColor(r, g, b, "backgroundColor", baseBackground),
          "important"
        );
      }
    }
  };
}

export default new DarkModeUtils();
