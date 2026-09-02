import QRCode from 'qrcode';

/** Renders a scalable inline SVG string for a QR code - ideal for crisp printing. */
export function qrToSvgString(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 1, width: 240 });
}

/** Renders a QR code as a PNG data URL - used for the downloadable image. */
export function qrToPngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 2, width: 512 });
}
