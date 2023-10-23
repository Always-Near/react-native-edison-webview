export const findDecodeErrorString = (string: string) => {
  if (string.length <= 20) {
    return string;
  }
  // keep the %00 - %FF in the same split item
  const split = string.split(/[g-zG-Z-_.!~*'()]/g);
  return (
    split.find((item) => {
      try {
        decodeURIComponent(item);
        return false;
      } catch (err) {
        return true;
      }
    }) || ""
  );
};
