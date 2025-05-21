export const state = {
	colNb: 2.0,
	ditherStrength: 1.0,
	bayerFilterSize: 8.0
}

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
export async function loadImageBitmap(bloborurl) {
	if (! (bloborurl instanceof ImageBitmap)) {
		const res = await fetch(bloborurl);
		bloborurl = await res.blob();
	}
	return await createImageBitmap(bloborurl, { colorSpaceConversion: 'none' });
}

export async function loadWGSL(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load WGSL shader from ${url}: ${response.statusText}`);
    }
    return await response.text();
}

export function getUniformBufferSize(currentSize) {
	return Math.ceil(currentSize / 16) * 16
}

export function throttle(callback, interval) {
	let lastTime = 0;
	return function (...args) {
		const now = Date.now();
		if (now - lastTime >= interval) {
			lastTime = now;
			callback.apply(this, args);
		}
	};
}
