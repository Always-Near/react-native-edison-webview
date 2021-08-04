class OversizeUtils {
  fixLongURL = (element: HTMLAnchorElement) => {
    let text = element.innerText;
    if (text === element.innerHTML && text.length > 30) {
      const results = [];
      while (text.length) {
        results.push(text.slice(0, 30));
        text = text.slice(30);
        results.push("<wbr>");
      }
      element.innerHTML = results.join("");
    }
  };

  private imageIsOverSize = (
    element: HTMLImageElement,
    documentWidth: number
  ) => {
    const elementWidth = element.getAttribute("width");
    if (elementWidth) {
      if (Number(elementWidth) > documentWidth) {
        return true;
      }
      return false;
    }
    const styles = element.style;
    if (
      styles.width == "none" ||
      styles.width == "" ||
      styles.width == undefined
    ) {
      if (
        element.style.maxWidth &&
        parseInt(element.style.maxWidth) > window.innerWidth - 100
      ) {
        return true;
      }
    }
    return false;
  };

  limitImageWidth(element: HTMLImageElement, documentWidth: number) {
    if (this.imageIsOverSize(element, documentWidth)) {
      element.classList.add("edo-limit-width");
    }
  }
}

export default new OversizeUtils();
