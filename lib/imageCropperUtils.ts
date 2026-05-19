/**
 * Utility functions for image cropping and resizing
 */

import { Area } from "react-easy-crop";

/**
 * Creates an image element from a file or URL
 */
export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}

/**
 * Gets the cropped image as a Blob with exact dimensions
 * @param imageSrc - Source image URL/data URL
 * @param pixelCrop - Crop area coordinates (in pixels relative to original image from react-easy-crop)
 * @param targetWidth - Target width in pixels
 * @param targetHeight - Target height in pixels
 * @returns Promise resolving to a Blob
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  targetWidth: number,
  targetHeight: number
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Set canvas size to target dimensions
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Draw the cropped and scaled image
  // react-easy-crop provides pixelCrop in pixels relative to the original image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.95
    );
  });
}


/**
 * Creates a data URL from a File
 */
export function getFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

