import { Buffer } from "buffer";
import { EventName } from "../constants";
import "./styles";
import DarkModeUtil from "./utils/dark-mode";
import ImageDownload from "./utils/image-download";
import { addProxyForImage, handleImageLoadError } from "./utils/image-proxy";
import OversizeUtil from "./utils/oversize";
import QuotedHTMLTransformer from "./utils/quoted-html-transformer";
import ResizeUtil from "./utils/samrt-resize";
import SpecialHandle from "./utils/special-handle";

function debounce<T extends Array<any>>(
  fn: (...args: T) => void,
  delay: number
) {
  let timer: number | null = null; //借助闭包
  return function (...args: T) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), delay);
  };
}

const BackgroundBaseColorForDark = {
  PreviewMode: "rgb(37,37,37)",
  DetailMode: "rgb(18,18,18)",
} as const;

const darkModeStyle = (isPreviewMode: boolean) => `
  html, body.edo, #edo-container {
    background-color: ${
      isPreviewMode
        ? BackgroundBaseColorForDark.PreviewMode
        : BackgroundBaseColorForDark.DetailMode
    } !important;
  }
  body {
    color: #fff;
  }
`;

const lightModeStyle = () => `
  html, body.edo, #edo-container {
    background-color: #fffffe !important;
  }
`;

export {};

type EventType = typeof EventName[keyof typeof EventName];

type State = {
  isDarkMode: boolean;
  isPreviewMode: boolean;
  hasImgOrVideo: boolean;
  html: string;
  showHtml: string;
  platform?: "ios" | "android" | "windows" | "macos" | "web";
  disabeHideQuotedText: boolean;
  showQuotedText: boolean;
};

class App {
  private hasImageInBody: boolean = true;
  private hasAllImageLoad: boolean = false;
  private ratio = 1;
  private state: State = {
    isDarkMode: false,
    isPreviewMode: false,
    hasImgOrVideo: false,
    html: "",
    showHtml: "",
    disabeHideQuotedText: false,
    showQuotedText: false,
  };

  constructor() {
    window.setHTML = this.setHTML;

    window.addEventListener("resize", () => {
      this.updateSize("window-resize");
    });
    this.render();
    const quotedControlNode = document.querySelector("#quoted-btn");
    if (quotedControlNode) {
      quotedControlNode.addEventListener("click", this.toggleshowQuotedText);
    }
    this.postMessage(EventName.IsMounted, true);
  }

  private postMessage = (type: EventType, data: any) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: type,
          data: data,
        })
      );
    }
  };

  private setHTML = (params: string) => {
    try {
      const {
        html,
        imageProxyTemplate,
        isDarkMode = false,
        isPreviewMode = false,
        disabeHideQuotedText,
        platform,
      } = JSON.parse(params);
      if (html) {
        const htmlStr = Buffer.from(html, "base64").toString("utf-8");
        // clear the meta to keep style
        const regMeta = /<meta\s+name=(['"\s]?)viewport\1\s+content=[^>]*>/gi;
        // clear @media for orientation: landscape
        const regOrientation =
          /@media screen and [:()\s\w-]*\(orientation: landscape\)/g;
        const formatHTML = htmlStr
          .replace(regMeta, "")
          .replace(regOrientation, "");
        const { hasImgOrVideo, html: addImageProxyHtml } = addProxyForImage(
          formatHTML,
          imageProxyTemplate
        );
        const { showQuotedText } = this.state;
        const showHtml =
          showQuotedText || disabeHideQuotedText
            ? addImageProxyHtml
            : QuotedHTMLTransformer.removeQuotedHTML(addImageProxyHtml);
        this.setState({
          html: addImageProxyHtml,
          showHtml,
          hasImgOrVideo,
          isDarkMode,
          isPreviewMode,
          platform,
          disabeHideQuotedText,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  private updateSize = (info = "") => {
    if (info) {
      this.postMessage(EventName.Debugger, info);
    }
    if (document.fullscreenElement) {
      return;
    }

    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }

    this.postMessage(
      EventName.HeightChange,
      container.scrollHeight * this.ratio
    );
  };

  private onImageLoad = () => {
    this.updateSize("image-load");
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    if (
      Array.from(container.querySelectorAll("img")).every((el) => {
        return el.complete;
      })
    ) {
      this.onAllImageLoad();
    }
  };

  private onAllImageLoad = () => {
    if (!this.hasAllImageLoad) {
      this.hasAllImageLoad = true;
      this.postMessage(EventName.OnLoadFinish, true);
    }
  };

  private applyDarkMode = () => {
    const { isPreviewMode } = this.state;
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      const baseBackground = DarkModeUtil.rgbColor(
        isPreviewMode
          ? BackgroundBaseColorForDark.PreviewMode
          : BackgroundBaseColorForDark.DetailMode
      );
      Array.from(container.querySelectorAll("*"))
        .reverse()
        .forEach((node) => {
          if (node instanceof HTMLElement) {
            DarkModeUtil.applyDarkModeForNode(node, baseBackground);
          }
        });
    } catch (err) {
      // pass
    }
  };

  private fixLongURL = () => {
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      Array.from(container.querySelectorAll("a")).forEach((ele) => {
        OversizeUtil.fixLongURL(ele);
      });
    } catch (err) {
      // pass
    }
  };

  private limitImageWidth = () => {
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      Array.from(container.querySelectorAll("img")).forEach((ele) => {
        OversizeUtil.limitImageWidth(ele, container.offsetWidth);
      });
    } catch (err) {
      // pass
    }
  };

  private addEventListenerForLink = () => {
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    Array.from(container.querySelectorAll("a")).forEach((ele) => {
      ele.addEventListener("click", (e) => {
        e.preventDefault();
        this.postMessage(EventName.ClickLink, ele.href);
      });
    });
  };

  private addEventListenerForImage = () => {
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    const images = Array.from(container.querySelectorAll("img"));

    this.hasImageInBody = images.length > 0;

    images.forEach((ele) => {
      // add load event to update webview size
      ele.addEventListener("load", this.onImageLoad);
      // add load error event to reset src
      ele.addEventListener("error", () => handleImageLoadError(ele));
      // add longPress event to download image
      if (this.state.platform != "ios") {
        const ImageDownloadUtil = new ImageDownload(ele, this.onImageDownload);
        ImageDownloadUtil.addEventListener();
      }
    });
  };

  private onImageDownload = (src: string) => {
    this.postMessage(EventName.onImageDownload, src);
  };

  private removeObjectDom = () => {
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    Array.from(container.querySelectorAll("object")).forEach((ele) => {
      ele.addEventListener("click", (e) => {
        ele.style.display = "none";
      });
    });
  };

  private smartResize = () => {
    document.body.style.minWidth = "initial";
    document.body.style.width = "initial";
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    const targetWidth = window.innerWidth;
    const originalWidth = container.scrollWidth;
    if (originalWidth > targetWidth) {
      this.ratio = targetWidth / originalWidth;
      try {
        ResizeUtil.scaleElement(container, originalWidth, this.ratio);
      } catch (err) {
        // pass
      }

      const sheets = document.styleSheets;
      try {
        for (const sheet of sheets) {
          ResizeUtil.zoomFontSizeInCss(sheet, 1.0 / this.ratio);
        }
      } catch (err) {
        // pass
      }

      const fontSizeElements = container.querySelectorAll(
        "*[style], font[size]"
      );
      try {
        for (const element of fontSizeElements) {
          if (element instanceof HTMLElement) {
            ResizeUtil.zoomText(element, 1.0 / this.ratio);
          }
        }
      } catch (err) {
        // pass
      }
      try {
        if (container.scrollWidth > container.offsetWidth + 20) {
          const elements = container.querySelectorAll(
            "td>a[style], td>span[style], td>font[size]"
          );
          for (const element of elements) {
            if (element instanceof HTMLElement) {
              ResizeUtil.scaleDownText(
                element,
                (container.offsetWidth - 20) / container.scrollWidth
              );
            }
          }
        }
      } catch (err) {
        // pass
      }

      document.body.style.height = container.offsetHeight * this.ratio + "px";
    }
    this.updateSize("html-reload");
  };

  private specialHandle = () => {
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      Array.from(container.querySelectorAll("*")).forEach((node) => {
        if (node instanceof HTMLElement) {
          SpecialHandle.removeFacebookHiddenText(node);
        }
      });
    } catch (err) {
      // pass
    }
  };

  private onload = () => {
    this.postMessage(EventName.OnLoad, true);
  };

  private debounceOnload = debounce(this.onload, 300);

  private toggleshowQuotedText = () => {
    const { html, showQuotedText, disabeHideQuotedText } = this.state;
    const nextShowQuotedText = !showQuotedText;
    const showHtml =
      nextShowQuotedText || disabeHideQuotedText
        ? html
        : QuotedHTMLTransformer.removeQuotedHTML(html);
    this.setState({
      showQuotedText: nextShowQuotedText,
      showHtml,
    });
  };

  private setState = <K extends keyof State>(state: Pick<State, K> | State) => {
    const preState = Object.assign({}, this.state);
    const nextState = Object.assign({}, this.state);
    Object.keys(state).forEach((key) => {
      nextState[key as K] = state[key as K] as State[K];
    });
    this.state = nextState;
    this.render();
    if (
      preState.showHtml !== nextState.showHtml ||
      preState.isDarkMode !== nextState.isDarkMode ||
      preState.isPreviewMode !== nextState.isPreviewMode
    ) {
      this.onContentChange();
    }
  };

  private onContentChange = () => {
    if (this.state.isDarkMode) {
      this.applyDarkMode();
    }
    this.addEventListenerForLink();
    this.addEventListenerForImage();
    this.removeObjectDom();
    this.fixLongURL();
    this.limitImageWidth();
    this.smartResize();
    this.specialHandle();

    if (this.state.isDarkMode) {
      this.debounceOnload();
    } else {
      this.onload();
    }

    if (!this.hasImageInBody) {
      this.onAllImageLoad();
    }
  };

  render() {
    const {
      html,
      showHtml,
      disabeHideQuotedText,
      isDarkMode,
      isPreviewMode,
      hasImgOrVideo,
    } = this.state;

    const globalStyleNode = document.querySelector(".global-style");
    if (globalStyleNode) {
      const globalStyle = isDarkMode
        ? darkModeStyle(isPreviewMode)
        : lightModeStyle();
      globalStyleNode.innerHTML = globalStyle || "";
    }

    const containerNode = document.querySelector("#container");
    if (containerNode) {
      const showPadding = isPreviewMode && !hasImgOrVideo;
      if (showPadding) {
        containerNode.classList.add("padding");
      } else {
        containerNode.classList.remove("padding");
      }
    }

    const bodyNode = document.querySelector("#body");
    if (bodyNode) {
      bodyNode.innerHTML = showHtml;
    }

    const quotedControlNode = document.querySelector("#quoted-btn");
    if (quotedControlNode) {
      const showQuotedControl =
        !disabeHideQuotedText && QuotedHTMLTransformer.hasQuotedHTML(html);
      if (showQuotedControl) {
        quotedControlNode.classList.remove("hidden");
      } else {
        quotedControlNode.classList.add("hidden");
      }
    }
  }
}

window.onload = () => new App();
