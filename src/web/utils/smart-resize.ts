class SmartResize {
  private updateStyle = (
    style: CSSStyleDeclaration,
    property: string,
    value: string
  ) => {
    const priority = style.getPropertyPriority(property);
    style.setProperty(property, value, priority);
  };

  private getCssRules = (sheet: CSSStyleSheet) => {
    const rules: CSSStyleRule[] = [];
    if (!sheet.cssRules) {
      return [];
    }
    for (const rule of sheet.cssRules) {
      const ruleWithoutType = rule as any;
      if (ruleWithoutType.style) {
        rules.push(rule as CSSStyleRule);
      } else if (ruleWithoutType.cssRules) {
        const ruleList = Array.from(ruleWithoutType.cssRules) as CSSStyleRule[];
        rules.push(...ruleList);
      }
    }

    return rules;
  };

  private zoomedSize(s: string, scale: number, max = 0) {
    let newSize = "";
    let unit = "";
    let formatMax = max;
    if (s.endsWith("px")) {
      unit = "px";
    } else if (s.endsWith("pt")) {
      unit = "pt";
      formatMax = max * 0.75;
    } else if (s.endsWith("cm")) {
      unit = "cm";
      formatMax = max / 37.8;
    } else if (s.endsWith("mm")) {
      unit = "mm";
      formatMax = max / 3.78;
    } else if (s.endsWith("in")) {
      unit = "in";
      formatMax = max / 96;
    } else if (s.endsWith("pc")) {
      unit = "pc";
      formatMax = max / 16;
    }

    const numS = parseFloat(s);

    if (numS != NaN && unit) {
      if (formatMax) {
        newSize = Math.min(numS, max) * scale + unit;
      } else {
        newSize = numS * scale + unit;
      }
    }

    return newSize;
  }

  private isRelativeFontSize = (s: string) => {
    if (!s) {
      return false;
    }
    return (
      s.endsWith("em") ||
      s.endsWith("rem") ||
      s.endsWith("ch") ||
      s.endsWith("vw") ||
      s.endsWith("%")
    );
  };

  scaleElement = (element: HTMLElement, fromWidth: number, scale: number) => {
    // element scale is a little small then the scale, to keep the width is enough
    const scaleWithBuffer = Math.floor(scale * 100) / 100;
    element.style.width = fromWidth + "px";
    element.style.transform = "scale(" + scaleWithBuffer + ")";
    element.classList.add("edo-transform");
  };

  zoomFontSizeInCss = (sheet: CSSStyleSheet, scale: number) => {
    const max = 17;
    const rules = this.getCssRules(sheet);
    for (const rule of rules) {
      const style = rule.style;
      if (style && style.fontSize) {
        if (parseInt(style.fontSize) < max * scale) {
          const size = this.zoomedSize(style.fontSize, scale, max);
          if (size) {
            this.updateStyle(style, "font-size", size);
          }
        }
      }
      if (style && style.lineHeight) {
        const size = this.zoomedSize(style.lineHeight, scale);
        if (size) {
          this.updateStyle(style, "line-height", size);
        }
      }
    }
  };

  zoomText = (element: HTMLElement, scale: number) => {
    const max = 15;
    if (element.tagName == "IMG") {
      return;
    }
    if (element.style.height && element.style.height.indexOf("%") === -1) {
      if (!element.style.fontSize) {
        const elementStyles = getComputedStyle(element);
        if (elementStyles.fontSize) {
          const updateSize = this.zoomedSize(elementStyles.fontSize, 1 / scale);
          element.style.fontSize = updateSize;
        }
      }
      return;
    }

    let safeScale = 1.0;
    const originalWidth = element.scrollWidth;

    if (element.tagName === "FONT") {
      const sizeAttribute = element.getAttribute("size");
      if (sizeAttribute) {
        element.style.wordBreak = "normal";
        element.style.wordWrap = "normal";
        const originalSize = Number(sizeAttribute);
        let s = Math.ceil(originalSize * scale);
        safeScale = s / originalSize;
        element.setAttribute("size", String(s));
        if (element.scrollWidth > originalWidth) {
          const level2scale = (0.9 * originalWidth) / element.scrollWidth;
          safeScale = safeScale * level2scale;
          s = Math.floor(level2scale * s);
          element.setAttribute("size", String(s));
        }
        element.style.wordBreak = "";
        element.style.wordWrap = "";
        return;
      }
    }

    if (element.style.fontSize) {
      const originalFontSize = element.style.fontSize;
      if (parseInt(originalFontSize) < max * scale) {
        let s = this.zoomedSize(originalFontSize, scale, max);
        if (s) {
          element.style.wordBreak = "normal";
          element.style.wordWrap = "normal";
          this.updateStyle(element.style, "font-size", s);
          if (parseFloat(s) && parseFloat(originalFontSize)) {
            safeScale = parseFloat(s) / parseFloat(originalFontSize);
          }
          if (
            element.previousElementSibling ||
            element.nextElementSibling ||
            element.tagName != "TD"
          ) {
            if (element.scrollWidth > originalWidth) {
              const level2scale = (0.9 * originalWidth) / element.scrollWidth;
              safeScale = safeScale * level2scale;
              s = this.zoomedSize(s, level2scale);
              if (s) {
                this.updateStyle(element.style, "font-size", s);
              }
            }
          }
          element.style.wordBreak = "";
          element.style.wordWrap = "";
        }
      }
    }

    if (safeScale > 1.0) {
      if (element.style.lineHeight) {
        const s = this.zoomedSize(element.style.lineHeight, safeScale);
        if (s) {
          this.updateStyle(element.style, "line-height", s);
        }
      }
    } else if (
      !element.style.fontSize ||
      this.isRelativeFontSize(element.style.fontSize)
    ) {
      if (element.style.lineHeight) {
        this.updateStyle(element.style, "line-height", "");
      }
    }
  };

  scaleDownText = (element: HTMLElement, scale: number) => {
    let scaled = false;
    const sizeAttribute = element.getAttribute("size");

    if (element.tagName == "FONT" && sizeAttribute) {
      const originalSize = Number(sizeAttribute);
      const s = Math.floor(originalSize * scale);
      element.setAttribute("size", String(s));
      scaled = true;
    } else if (element.style.fontSize) {
      const originalSize = element.style.fontSize;
      const originalWidth = element.parentElement?.scrollWidth || 0;
      const s = this.zoomedSize(originalSize, scale);
      if (s) {
        this.updateStyle(element.style, "font-size", s);
        const nowWidth = element.parentElement?.scrollWidth || 0;
        if (originalWidth === nowWidth) {
          this.updateStyle(element.style, "font-size", originalSize);
        } else {
          scaled = true;
        }
      }
    }

    if (scaled && element.style.lineHeight && !element.style.height) {
      const s = this.zoomedSize(element.style.lineHeight, scale);
      if (s) {
        this.updateStyle(element.style, "line-height", s);
      }
    }
  };
}

export default new SmartResize();
