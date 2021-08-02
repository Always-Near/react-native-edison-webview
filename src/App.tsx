import { Buffer } from "buffer";
import React from "react";
import "./styles";
import DarkModeUtil from "./utils/dark-mode";
import OversizeUtil from "./utils/oversize";
import ResizeUtil from "./utils/samrt-resize";
import SpecialHandle from "./utils/special-handle";
import QuotedHTMLTransformer from "./utils/quoted-html-transformer";
import QuotedControl from "./components/QuotedControl";

const EventName = {
  IsMounted: "isMounted",
  OnLoad: "onLoad",
  HeightChange: "heightChange",
  ClickLink: "clickLink",
  Debugger: "debugger",
} as const;

const darkModeStyle = `
  html, body.edo, #edo-container {
    background-color: #121212 !important;
  }
  body {
    color: #fff;
  }
`;

const lightModeStyle = `
  html, body.edo, #edo-container {
    background-color: #ffffff !important;
  }
`;

type EventType = typeof EventName[keyof typeof EventName];
type State = {
  isDarkMode: boolean;
  isPreviewMode: boolean;
  hasImgOrVideo: boolean;
  html: string;
  showHtml: string;
  showQuotedText: boolean;
};

class App extends React.Component<any, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      isDarkMode: false,
      isPreviewMode: false,
      hasImgOrVideo: false,
      html: "",
      showHtml: "",
      showQuotedText: false,
    };
  }

  componentDidMount() {
    window.setHTML = this.setHTML;
    window.setPreviewMode = this.setPreviewMode;

    window.addEventListener("resize", () => {
      this.updateSize("window-resize");
    });
    this.postMessage(EventName.IsMounted, true);
  }

  componentDidUpdate(preProps: any, preState: State) {
    if (
      preState.showHtml !== this.state.showHtml ||
      preState.isDarkMode !== this.state.isDarkMode ||
      preState.isPreviewMode !== this.state.isPreviewMode
    ) {
      this.debounceOnContentChange();
    }
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
      const { html, isDarkMode } = JSON.parse(params);
      if (html) {
        const htmlStr = Buffer.from(html, "base64").toString("utf-8");
        // clear the meta to keep style
        const reg = /<meta\s+name=(['"\s]?)viewport\1\s+content=[^>]*>/gi;
        const formatHTML = htmlStr.replace(reg, "");
        const hasImgOrVideo = this.calcHasImgOrVideo(formatHTML);
        const showHtml = this.state.showQuotedText
          ? formatHTML
          : QuotedHTMLTransformer.removeQuotedHTML(formatHTML);
        this.setState({
          html: formatHTML,
          showHtml,
          hasImgOrVideo,
          isDarkMode,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  private setPreviewMode = (isPreviewMode: string) => {
    this.setState({ isPreviewMode: isPreviewMode === String(true) });
  };

  private calcHasImgOrVideo = (html: string) => {
    const box = document.createElement("div");
    box.innerHTML = html;
    const image = box.querySelector("img");
    if (image) {
      return true;
    }
    const video = box.querySelector("video");
    if (video) {
      return true;
    }
    return false;
  };

  private updateSize = (info = "") => {
    if (info) {
      this.postMessage(EventName.Debugger, info);
    }
    if (document.fullscreenElement) {
      return;
    }
    const targetWidth = window.innerWidth;
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    const calcHeight = Math.ceil(
      (container.scrollHeight / container.scrollWidth) * targetWidth
    );
    this.postMessage(EventName.HeightChange, calcHeight);
  };

  private applyDarkMode = () => {
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      Array.from(container.querySelectorAll("*"))
        .reverse()
        .forEach((node) => {
          if (node instanceof HTMLElement) {
            DarkModeUtil.applyDarkModeForNode(node);
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
    Array.from(container.querySelectorAll("img")).forEach((ele) => {
      ele.addEventListener("load", (e) => {
        this.updateSize("image-load");
      });
    });
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
      const ratio = targetWidth / originalWidth;
      try {
        ResizeUtil.scaleElement(container, originalWidth, ratio);
      } catch (err) {
        // pass
      }

      const sheets = document.styleSheets;
      try {
        for (const sheet of sheets) {
          ResizeUtil.zoomFontSizeInCss(sheet, 1.0 / ratio);
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
            ResizeUtil.zoomText(element, 1.0 / ratio);
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

      document.body.style.height = container.offsetHeight * ratio + "px";
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

    setTimeout(() => {
      this.postMessage(EventName.OnLoad, true);
    }, 300);
  };

  private debounceOnContentChange = debounce(this.onContentChange, 300);

  private toggleshowQuotedText = () => {
    const { html, showQuotedText } = this.state;
    const showHtml = !showQuotedText
      ? html
      : QuotedHTMLTransformer.removeQuotedHTML(html);
    this.setState({
      showQuotedText: !showQuotedText,
      showHtml,
    });
  };

  render() {
    const {
      html,
      showHtml,
      showQuotedText,
      isDarkMode,
      isPreviewMode,
      hasImgOrVideo,
    } = this.state;
    const containerStyles: React.CSSProperties =
      isPreviewMode && !hasImgOrVideo ? { padding: "2ex" } : {};
    return (
      <>
        <style>{isDarkMode ? darkModeStyle : lightModeStyle}</style>
        <div
          style={containerStyles}
          dangerouslySetInnerHTML={{ __html: showHtml }}
        />
        <QuotedControl html={html} onClick={this.toggleshowQuotedText} />
      </>
    );
  }
}

export default App;

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
