const longPressDuration = 750;

let presstimer: number | null = null;
let longpress = false;

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

  private click = () => {
    if (presstimer !== null) {
      clearTimeout(presstimer);
      presstimer = null;
    }
    if (longpress) {
      return false;
    }
  };

  private start = (e: MouseEvent | TouchEvent) => {
    if (e.type === "click" && (!("button" in e) || e.button !== 0)) {
      return;
    }

    longpress = false;

    if (presstimer === null) {
      presstimer = setTimeout(() => {
        this.onLongPressImage();
        longpress = true;
      }, longPressDuration);
    }

    return false;
  };

  addEventListener = () => {
    this.node.addEventListener("mousedown", this.start);
    this.node.addEventListener("touchstart", this.start);
    this.node.addEventListener("click", this.click);
    this.node.addEventListener("mouseout", this.cancel);
    this.node.addEventListener("touchend", this.cancel);
    this.node.addEventListener("touchleave", this.cancel);
    this.node.addEventListener("touchcancel", this.cancel);
  };

  private onLongPressImage = () => {
    if (this.src) {
      this.onImageDownload(this.src);
    }
  };
}

export default ImageDownload;
