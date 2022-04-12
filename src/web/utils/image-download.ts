import { debug } from "webpack";

const longPressDuration = 1000;

let presstimer: number | null = null;

class ImageDownload {
  private node: HTMLImageElement;
  private src: string;
  private onImageDownload: (src: string) => void;

  constructor(image: HTMLImageElement, onImageDownload: (src: string) => void) {
    this.node = image;
    this.src = this.node.src;
    this.onImageDownload = onImageDownload;
  }

  private cancel = () => {
    if (presstimer !== null) {
      clearTimeout(presstimer);
      presstimer = null;
    }
  };

  private start = () => {
    if (presstimer !== null) {
      clearTimeout(presstimer);
    }
    presstimer = setTimeout(() => {
      this.onLongPressImage();
    }, longPressDuration);
  };

  private onLongPressImage = () => {
    if (this.src) {
      this.onImageDownload(this.src);
    }
  };

  addEventListener = () => {
    this.node.addEventListener("touchstart", this.start);
    this.node.addEventListener("touchmove", this.cancel);
    this.node.addEventListener("touchend", this.cancel);
    this.node.addEventListener("touchleave", this.cancel);
    this.node.addEventListener("touchcancel", this.cancel);
  };
}

export default ImageDownload;
