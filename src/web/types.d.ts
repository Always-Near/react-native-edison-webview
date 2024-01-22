declare interface Window {
  ReactNativeWebView: any;
  setHTML: (params: string) => void;
  onInlineImageDownload: (params: string) => void;
}
