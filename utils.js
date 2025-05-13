export const state = {
    p : 0.0,
	colNb: 2.0,
	ditherStrength: 1.0
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
