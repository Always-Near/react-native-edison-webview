import React, { Component, createRef } from "react";
import { Platform } from "react-native";
import RNFS from "react-native-fs";
import WebView, {
  WebViewMessageEvent,
  WebViewProps,
} from "react-native-webview";
import { EventName } from "./constants";
import "./index.html";

const packageName = "react-native-edison-webview";

const InjectScriptName = {
  SetHTML: "setHTML",
  OnInlineImageDownload: "onInlineImageDownload",
} as const;

const messageBodyFileTargetPath = `file://${RNFS.CachesDirectoryPath}/messageBody.html`;
let messageBodyFilePath = messageBodyFileTargetPath;

async function copyFileForIos() {
  const htmlPath = `file://${RNFS.MainBundlePath}/assets/node_modules/${packageName}/lib/index.html`;
  try {
    const fileHasExists = await RNFS.exists(messageBodyFileTargetPath);
    if (fileHasExists) {
      await RNFS.unlink(messageBodyFileTargetPath);
    }
    await RNFS.copyFile(htmlPath, messageBodyFileTargetPath);
    return messageBodyFileTargetPath;
  } catch (err) {
    // badcase remedy
    return htmlPath;
  }
}

async function copyFileForAndroid() {
  const htmlResPath = `raw/node_modules_${packageName.replace(
    /-/g,
    ""
  )}_lib_index.html`;
  try {
    const fileHasExists = await RNFS.exists(messageBodyFileTargetPath);
    if (fileHasExists) {
      await RNFS.unlink(messageBodyFileTargetPath);
    }
    await RNFS.copyFileRes(htmlResPath, messageBodyFileTargetPath);
    return messageBodyFileTargetPath;
  } catch (err) {
    // badcase remedy
    return `file:///android_res/${htmlResPath}`;
  }
}

async function copyFile() {
  if (Platform.OS === "ios") {
    const filePath = await copyFileForIos();
    messageBodyFilePath = filePath;
  } else if (Platform.OS === "android") {
    const filePath = await copyFileForAndroid();
    messageBodyFilePath = filePath;
  }
}

copyFile();

export type WebviewEvent = Exclude<
  (typeof EventName)[keyof typeof EventName],
  (typeof EventName)["IsMounted"]
>;

type WithoutProps =
  | "ref"
  | "originWhitelist"
  | "source"
  | "allowingReadAccessToURL"
  | "onMessage";
type EdisonWebViewProps = {
  html: string;
  imageProxyTemplate?: string;
  isDarkMode?: boolean;
  isPreviewMode?: boolean;
  disabeHideQuotedText?: boolean;
  onMessage: (type: WebviewEvent, data: any) => void;
} & Omit<WebViewProps, WithoutProps>;

type EdisonWebViewState = {
  webviewUri: string;
};
export default class RNWebView extends Component<
  EdisonWebViewProps,
  EdisonWebViewState
> {
  timeoutMap: Map<string, NodeJS.Timeout> = new Map();
  webviewMounted: boolean = false;
  constructor(props: any) {
    super(props);
    this.state = {
      webviewUri: "",
    };
  }

  private webViewRef = createRef<WebView>();

  componentDidMount() {
    this.setState({ webviewUri: messageBodyFilePath });
  }

  componentDidUpdate(prevProps: EdisonWebViewProps) {
    if (
      prevProps.isDarkMode !== this.props.isDarkMode ||
      prevProps.isPreviewMode !== this.props.isPreviewMode ||
      prevProps.disabeHideQuotedText !== this.props.disabeHideQuotedText ||
      prevProps.html !== this.props.html ||
      prevProps.imageProxyTemplate !== this.props.imageProxyTemplate
    ) {
      if (this.webviewMounted) {
        this.initHtml();
      }
    }
  }

  private executeScript = (
    functionName: (typeof InjectScriptName)[keyof typeof InjectScriptName],
    parameter?: string
  ) => {
    if (!this.webViewRef.current) {
      return;
    }
    const timeout = this.timeoutMap.get(functionName);
    if (timeout) {
      clearTimeout(timeout);
    }
    if (!this.webviewMounted) {
      this.timeoutMap.set(
        functionName,
        setTimeout(() => {
          this.executeScript(functionName, parameter);
        }, 100)
      );
      return;
    }
    this.webViewRef.current.injectJavaScript(
      `window.${functionName} && window.${functionName}(${
        parameter ? `\`${parameter}\`` : ""
      });true;`
    );
  };

  private executeScriptWhenMounted = (
    functionName: (typeof InjectScriptName)[keyof typeof InjectScriptName],
    parameter?: string
  ) => {
    if (!this.webViewRef.current) {
      return;
    }

    if (!this.webviewMounted) {
      setTimeout(() => {
        this.executeScriptWhenMounted(functionName, parameter);
      }, 100);
      return;
    }
    this.webViewRef.current.injectJavaScript(
      `window.${functionName} && window.${functionName}(${
        parameter ? `\`${parameter}\`` : ""
      });true;`
    );
  };

  private onMessage = (event: WebViewMessageEvent) => {
    try {
      const messageData: {
        type: (typeof EventName)[keyof typeof EventName];
        data: any;
      } = JSON.parse(event.nativeEvent.data);
      if (messageData.type === EventName.IsMounted) {
        this.webviewMounted = true;
        this.initHtml();
      } else if (this.props.onMessage) {
        this.props.onMessage(messageData.type, messageData.data);
      }
    } catch (err) {
      // pass
    }
  };

  private initHtml = () => {
    const formatHtmlBase64 = encodeURIComponent(this.props.html);
    this.executeScript(
      InjectScriptName.SetHTML,
      JSON.stringify({
        html: formatHtmlBase64,
        imageProxyTemplate: this.props.imageProxyTemplate || "",
        isDarkMode: this.props.isDarkMode,
        isPreviewMode: this.props.isPreviewMode,
        disabeHideQuotedText: this.props.disabeHideQuotedText,
        platform: Platform.OS,
      })
    );
  };

  onInlineImageDownload = (attachmentId: string, path: string) => {
    const imageData = encodeURIComponent(
      JSON.stringify({
        attachmentId,
        path,
      })
    );
    this.executeScriptWhenMounted(
      InjectScriptName.OnInlineImageDownload,
      imageData
    );
  };

  render() {
    return (
      <WebView
        {...this.props}
        ref={this.webViewRef}
        originWhitelist={["*"]}
        source={{ uri: this.state.webviewUri }}
        allowFileAccess
        forceDarkOn={this.props.isDarkMode}
        allowingReadAccessToURL={"file://"}
        onMessage={this.onMessage}
        mixedContentMode={"always"}
      />
    );
  }
}
