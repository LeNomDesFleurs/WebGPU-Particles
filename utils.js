export const CANVAS_ID = 'gfx';

export const TYPE_SIZE = {
  'f32' : 4,
  'vec2' : 8,
  'vec3' : 12,
  'vec4' : 16,
  'mat3'  : 36,
  'mat4' : 64
}
//get bitmap from url
export async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
}

export async function loadWGSL(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load WGSL shader from ${url}: ${response.statusText}`);
    }
    return await response.text();
}