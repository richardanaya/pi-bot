const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXT.test(urlPath(url));
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXT.test(urlPath(url));
}

export function isYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "http://localhost");
    return (
      parsed.hostname === "youtu.be" ||
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com"
    );
  } catch {
    return false;
  }
}

export function youtubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    const id = parsed.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export function kindFromMime(mimeType: string): "image" | "video" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

function urlPath(url: string): string {
  const cut = url.split("?")[0] ?? url;
  return cut.split("#")[0] ?? cut;
}
