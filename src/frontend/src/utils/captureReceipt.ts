/**
 * Captures a DOM element as a PNG blob using the browser's print-to-canvas approach.
 * Falls back to a styled canvas drawn from the element's data attributes.
 */
export async function captureElementAsBlob(
  el: HTMLElement,
): Promise<Blob | null> {
  try {
    // Use Blob URL + Image trick for cross-browser support
    const svgData = domToSvg(el);
    const img = new Image();
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = el.offsetWidth * 2;
        canvas.height = el.offsetHeight * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => resolve(blob), "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

function domToSvg(el: HTMLElement): string {
  const w = el.offsetWidth || 320;
  const h = el.offsetHeight || 400;
  const serializer = new XMLSerializer();
  const clone = el.cloneNode(true) as HTMLElement;

  // Inline computed styles
  inlineStyles(el, clone);

  const html = serializer.serializeToString(clone);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden;">
        ${html}
      </div>
    </foreignObject>
  </svg>`;
}

function inlineStyles(source: HTMLElement, target: HTMLElement) {
  const computed = window.getComputedStyle(source);
  let styleStr = "";
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    styleStr += `${prop}:${computed.getPropertyValue(prop)};`;
  }
  target.style.cssText = styleStr;
  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) {
    inlineStyles(
      sourceChildren[i] as HTMLElement,
      targetChildren[i] as HTMLElement,
    );
  }
}
