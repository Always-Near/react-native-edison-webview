const imageShouldAddProxy = (img: HTMLImageElement) => {
  const src = img.src;
  return src.startsWith("http://") || src.startsWith("https://");
};

const calcProxyURLForImage = (src: string, proxyTemplate: string) => {
  if (proxyTemplate) {
    return proxyTemplate.replace("$1", encodeURIComponent(src));
  }
};

export const addProxyForImage = (html: string, proxyTemplate: string) => {
  const box = document.createElement("div");
  box.innerHTML = html;
  const images = box.querySelectorAll("img");
  images.forEach((img) => {
    if (!imageShouldAddProxy(img)) {
      return;
    }

    const src = img.src;
    const proxySrc = calcProxyURLForImage(src, proxyTemplate);
    if (proxySrc) {
      img.setAttribute("data-src", src);
      img.setAttribute("src", proxySrc);
    }
  });
  const video = box.querySelector("video");
  const hasImgOrVideo = images.length > 0 || !!video;
  return {
    html: box.innerHTML,
    hasImgOrVideo,
  };
};

export const handleImageLoadError = (img: HTMLImageElement) => {
  const originalSrc = img.getAttribute("data-src");
  if (!originalSrc) {
    return;
  }
  img.setAttribute("src", originalSrc);
};
