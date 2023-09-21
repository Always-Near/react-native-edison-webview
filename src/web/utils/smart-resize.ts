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

    if (!Number.isNaN(numS) && unit) {
      if (formatMax) {
        newSize = Math.min(numS, max) * scale + unit;
      } else {
        newSize = numS * scale + unit;
      }
    }

    return newSize;
  }

  private preOrderTraverse = (element: HTMLElement) => {
    const nodeList: HTMLElement[] = [];
    let nodeTmp = element.firstChild;
    while (nodeTmp) {
      if (nodeTmp instanceof HTMLElement) {
        nodeList.push(nodeTmp, ...this.preOrderTraverse(nodeTmp));
      }
      nodeTmp = nodeTmp.nextSibling;
    }
    return nodeList;
  };

  private filterElementsThatNeedAdjust = (
    element: HTMLElement,
    scale: number
  ) => {
    const elementList = this.preOrderTraverse(element) as HTMLElement[];
    const filterNodeList: {
      element: HTMLElement;
      styleProp: "fontSize" | "lineHeight";
      value: string;
      originalValue: string;
    }[] = [];

    for (const el of elementList) {
      const hasFontSize =
        (el.style && el.style["fontSize"]) || el.getAttribute("size");
      const hasLineHeight = el.style && el.style["lineHeight"];

      if (hasFontSize || hasLineHeight) {
        const styleProp = hasFontSize ? "fontSize" : "lineHeight";
        let value = "0";
        if (document.defaultView && document.defaultView.getComputedStyle) {
          const style = document.defaultView.getComputedStyle(el, null);
          if (style) {
            value = style[styleProp] || style.getPropertyValue(styleProp) || "";
          }
        }
        filterNodeList.push({
          element: el,
          styleProp,
          value: parseInt(value, 10) * scale + "px",
          originalValue: value,
        });
      }
    }

    return filterNodeList;
  };

  private zoomFontSizeInCss = (scale: number) => {
    const sheets = document.styleSheets;

    const max = 17;
    const resetStylesInCss: Array<[CSSStyleDeclaration, string, string]> = [];

    try {
      for (const sheet of sheets) {
        const rules = this.getCssRules(sheet);
        for (const rule of rules) {
          const style = rule.style;
          if (style && style.fontSize) {
            if (parseInt(style.fontSize) < max * scale) {
              const size = this.zoomedSize(style.fontSize, scale, max);
              if (size) {
                resetStylesInCss.push([style, "font-size", style.fontSize]);
                this.updateStyle(style, "font-size", size);
              }
            }
          }
          if (style && style.lineHeight) {
            const size = this.zoomedSize(style.lineHeight, scale);
            if (size) {
              resetStylesInCss.push([style, "line-height", style.lineHeight]);
              this.updateStyle(style, "line-height", size);
            }
          }
        }
      }
    } catch (err) {
      // pass
    }

    return () => {
      for (const params of resetStylesInCss) {
        this.updateStyle(...params);
      }
    };
  };

  private isOverSizeTextBox = (node: Node) => {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    const fixSizeBox =
      (!node.style.overflow || node.style.overflow.includes("visible")) &&
      (node.style.height || node.style.width);
    if (!fixSizeBox) {
      return false;
    }

    const overSize =
      node.offsetWidth + 20 < node.scrollWidth ||
      node.offsetHeight + 20 < node.scrollHeight;
    return overSize;
  };

  private zoomText = (container: HTMLElement, scale: number) => {
    let originalWidth = container.scrollWidth;
    const viewportScale = Math.max(1 / scale, 0.5);

    if (scale <= 1.1) {
      return true;
    }

    const elementsToAdjust = this.filterElementsThatNeedAdjust(
      container,
      scale
    );

    // 150 is a magic number found in Gmail Web
    if (elementsToAdjust.length > 150) {
      this.adjustViewport(container, viewportScale);
      return false;
    }

    for (const elObj of elementsToAdjust) {
      elObj.element.style[elObj.styleProp] = elObj.value;
    }

    const resetStylesInCss = this.zoomFontSizeInCss(scale);

    const restoreAdjustment = () => {
      for (const elObj of elementsToAdjust) {
        elObj.element.style[elObj.styleProp] = elObj.originalValue;
      }
      resetStylesInCss();
    };

    // restore adjustment case1, a special case for case2
    const threshold =
      (container.scrollWidth - originalWidth) /
      (originalWidth * scale - originalWidth);
    if (threshold >= 0.2) {
      restoreAdjustment();
      this.adjustViewport(container, viewportScale);
      return false;
    }

    // restore adjustment case2
    /* example, if scale the font-size, the content will overflow the <div> element
      <div style="width: 200px; height: 90px; background-color: red">
          <p>
              test test test test test test test test test test test test test test test test test test test test
              test
          </p>
      </div>
    */
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT
    );
    let node = walker.nextNode();
    while (node) {
      if (this.isOverSizeTextBox(node)) {
        restoreAdjustment();
        this.adjustViewport(container, viewportScale);
        return false;
      }
      node = walker.nextNode();
    }

    return true;
  };

  private scaleContent = (
    element: HTMLElement,
    fromWidth: number,
    scale: number
  ) => {
    // element scale is a little small then the scale, to keep the width is enough
    const scaleWithBuffer = Math.floor(scale * 100) / 100;
    element.style.width = fromWidth + "px";
    element.style.transform = "scale(" + scaleWithBuffer + ")";
    element.classList.add("edo-transform");
  };

  private scaleQuotedControl = (element: HTMLElement, scale: number) => {
    element.style.transform = "scale(" + 1 / scale + ")";
    element.classList.add("edo-transform");
  };

  private adjustViewport = (container: HTMLElement, scale: number) => {
    const viewportEl = document.querySelector("meta[name=viewport]");
    viewportEl?.setAttribute(
      "content",
      `width=device-width, initial-scale=${scale}, minimum-scale=${scale}, user-scalable=yes`
    );
    container.style.transform = "";
    container.style.overflow = "auto";
  };

  smartResize = (container: HTMLElement, ratio: number) => {
    if (ratio < 0.15) {
      this.adjustViewport(container, 0.5);
      return 0.5;
    }

    if (ratio < 1) {
      const shouldPerformTransform = this.zoomText(container, 1 / ratio);
      if (shouldPerformTransform) {
        try {
          this.scaleContent(container, container.scrollWidth, ratio);
          const quotedControl = document.querySelector(".quoted-btn svg");
          if (quotedControl) {
            this.scaleQuotedControl(quotedControl as HTMLElement, ratio);
          }
          document.body.style.height =
            container.getBoundingClientRect().height + "px";
          return ratio;
        } catch (err) {
          // pass
        }
      }
      return Math.max(ratio, 0.5);
    }
    return 1;
  };
}

export default new SmartResize();
