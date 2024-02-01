import { EventName } from "../constants";
import "./styles";
import DarkModeUtil from "./utils/dark-mode";
import ImageDownload from "./utils/image-download";
import { addProxyForImage, handleImageLoadError } from "./utils/image-proxy";
import OversizeUtil from "./utils/oversize";
import QuotedHTMLTransformer from "./utils/quoted-html-transformer";
import ResizeUtil from "./utils/smart-resize";
import SpecialHandle from "./utils/special-handle";
import { autolink } from "./utils/auto-link";
import { findDecodeErrorString } from "./utils/base";

export {};

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

type EventType = (typeof EventName)[keyof typeof EventName];
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
  private screenWidth = 0;
  private viewportScale = false;
  private viewportScrollEnd = false;
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
    this.screenWidth = screen.width;

    window.setHTML = this.setHTML;
    window.onInlineImageDownload = this.onInlineImageDownload;
    window.addEventListener("resize", this.onWindowResize);
    if (this.state.platform != "ios") {
      window.visualViewport?.addEventListener("resize", this.onResizeViewport);
      window.visualViewport?.addEventListener("scroll", this.onScrollViewport);
    }

    this.render();

    const quotedControlNode = document.querySelector("#quoted-btn");
    if (quotedControlNode) {
      quotedControlNode.addEventListener("click", this.toggleshowQuotedText);
    }

    this.postMessage(EventName.IsMounted, true);
  }

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

  private parseJSON = (
    params: string
  ): {
    html: string;
    imageProxyTemplate: string;
    isDarkMode: boolean;
    isPreviewMode: boolean;
    disabeHideQuotedText: boolean;
    platform: "ios" | "android" | "windows" | "macos" | "web";
  } => {
    const defaultResult = {
      html: "",
      imageProxyTemplate: "",
      isDarkMode: false,
      isPreviewMode: false,
      disabeHideQuotedText: false,
      platform: "ios",
    } as const;
    try {
      const data = JSON.parse(params);
      return {
        html: data.html || defaultResult.html,
        imageProxyTemplate:
          data.imageProxyTemplate || defaultResult.imageProxyTemplate,
        isDarkMode: data.isDarkMode || defaultResult.isDarkMode,
        isPreviewMode: data.isPreviewMode || defaultResult.isPreviewMode,
        disabeHideQuotedText:
          data.disabeHideQuotedText || defaultResult.disabeHideQuotedText,
        platform: data.platform || defaultResult.platform,
      };
    } catch (e: any) {
      this.postMessage(
        EventName.Error,
        `parse JSON input error, string: "${params.slice(0, 20)}".`
      );
      return defaultResult;
    }
  };

  private parseHTML = (html: string) => {
    try {
      const htmlStr = decodeURIComponent(html);
      return htmlStr;
    } catch (e: any) {
      const errorString = findDecodeErrorString(html);
      this.postMessage(
        EventName.Error,
        `decodeURIComponent html error, string: "${errorString}".`
      );
      return "";
    }
  };

  private setHTML = (params: string) => {
    const {
      html,
      imageProxyTemplate,
      isDarkMode,
      isPreviewMode,
      disabeHideQuotedText,
      platform,
    } = this.parseJSON(params);

    if (html) {
      const htmlStr = this.parseHTML(html);
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
  };

  private parseImage = (imageData: string) => {
    try {
      const data = JSON.parse(decodeURIComponent(imageData));
      return {
        attachmentId: data.attachmentId || "",
        path: data.path || "",
      };
    } catch (e: any) {
      this.postMessage(
        EventName.Error,
        `parse JSON input error, string: "${imageData.slice(0, 20)}".`
      );
      return { attachmentId: "", path: "" };
    }
  };

  private onInlineImageDownload = (params: string) => {
    const { attachmentId, path } = this.parseImage(params);

    if (!attachmentId || !path) {
      return;
    }

    const allImages = document.querySelectorAll("img");
    const targetImage = Array.from(allImages).find((img) => {
      const reg = new RegExp(`^cid:${attachmentId}$`, "gi");
      return reg.test(img.src);
    });
    if (targetImage) {
      targetImage.src = path;

      // add load event to update webview size
      targetImage.addEventListener("load", () => this.onImageLoad(targetImage));
      // add load error event to reset src
      targetImage.addEventListener("error", () =>
        handleImageLoadError(targetImage)
      );
      // add longPress event to download image
      if (this.state.platform != "ios") {
        const ImageDownloadUtil = new ImageDownload(
          targetImage,
          this.onImageDownload
        );
        ImageDownloadUtil.addEventListener();
      }

      this.limitImageWidth();
      this.smartResize();
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
      container.scrollHeight * this.ratio + 34 // 2ex buffer
    );
  };

  private onImageLoad = (ele: HTMLImageElement) => {
    this.updateSize("image-load");
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }

    if (ele.width > container.offsetWidth) {
      ele.classList.add("edo-limit-width");
    }

    if (
      Array.from(container.querySelectorAll("img")).every((el) => {
        return el.complete;
      })
    ) {
      this.onAllImageLoad();
    }
  };

  private onWindowResize = () => {
    if (this.screenWidth != screen.width) {
      this.screenWidth = screen.width;
      this.smartResize();
    } else {
      this.updateSize("window-resize");
    }
  };

  private onResizeViewport = () => {
    if (!window.visualViewport) {
      return;
    }
    const newScale = window.visualViewport.scale > 1;
    if (newScale !== this.viewportScale) {
      this.postMessage(EventName.ResizeViewport, newScale);
      this.viewportScale = newScale;
    }
  };

  private onScrollViewport = () => {
    if (!window.visualViewport) {
      return;
    }
    const newViewportScrollEnd =
      window.visualViewport.offsetTop <= 0 ||
      window.visualViewport.height * (window.visualViewport.scale - 1) -
        window.visualViewport.offsetTop <=
        1;
    if (newViewportScrollEnd !== this.viewportScrollEnd) {
      this.viewportScrollEnd = newViewportScrollEnd;
      this.postMessage(EventName.OnScrollEndViewport, newViewportScrollEnd);
    }
  };

  private onAllImageLoad = () => {
    if (!this.hasAllImageLoad) {
      this.hasAllImageLoad = true;
      this.postMessage(EventName.OnLoadFinish, true);
      this.debounceOnContentChange();
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
      OversizeUtil.fixLongURLAndText(container);
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
        this.postMessage(EventName.ClickLink, ele.getAttribute("href"));
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
      ele.addEventListener("load", () => this.onImageLoad(ele));
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
    const containerScale = container.style.transform;
    let scaleX = 1;
    if (containerScale) {
      const scale = Number(/\d+\.?\d*/.exec(containerScale));
      if (!Number.isNaN(scale)) {
        scaleX = scale;
      }
    }
    const ratio = targetWidth / (originalWidth * scaleX);
    this.ratio = ResizeUtil.smartResize(container, ratio);
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
      Array.from(container.querySelectorAll("[contenteditable=true]")).forEach(
        (node) => {
          if (node instanceof HTMLElement) {
            SpecialHandle.disableContentEditableElements(node);
          }
        }
      );
    } catch (err) {
      // pass
    }
  };

  private onContentChange = () => {
    if (this.state.isDarkMode) {
      this.applyDarkMode();
    }
    autolink();
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

  private debounceOnContentChange = debounce(this.onContentChange, 300);

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

    const edoContainerNode = document.querySelector("#edo-container");
    if (edoContainerNode) {
      if (isPreviewMode) {
        edoContainerNode.classList.add("is-preview-mode");
      } else {
        edoContainerNode.classList.remove("is-preview-mode");
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

window.onload = () => new App();
