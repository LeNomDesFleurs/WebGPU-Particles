export const state = {
	colNb: 2.0,
	ditherStrength: 1.0,
	bayerFilterSize: 8.0,
	pixelate: 1.0,
	LowThreshold: 0.2,
	HighThreshold: 0.6,
	InvertMask: 0.0,
	SpanLimit:200,
	MaskRandomOffset:0.0,
	SortBy:0.0,
	ReverseSorting: 0.0,
	SortedGamma: 1.0,
	angle: 0.0,
	//morpho
	op: 0,
	r: 4,
	brush_type: 0,
	p: 0.3,
	
}

export var IMAGE_URL = '../assets/rose.jpg';

let renderDonePromise;
export function setRenderDonePromise(promise) {
  renderDonePromise = promise;
}
export function getRenderDonePromise() {
  return renderDonePromise;
}



export const CANVAS_ID = 'gfx';

export const TYPE_SIZE = {
	'f32': 4,
	'i32': 4,
	'vec2' : 8,
	'vec3' : 12,
	'vec4' : 16,
	'vec2f' : 8,
	'vec3f' : 12,
	// 'mat3'  : 36,//Quick fix to account for padding
	'mat3' : 36,
	'mat4' : 64,
	'u32' : 4,
	'vec2u' : 8,
	'vec3u' : 12
}

export const TYPE_ATTRIBUTE_FORMAT = {
	'u32': "uint32",
	'vec2u': "uint32x2",
	'vec3u': "uint32x3",
	'f32' : "float32",
	'vec2f' : "float32x2",
	'vec3f' : "float32x3",
}
// Check this list if more types are needed
// "uint8x2"	unsigned int	2	2	vec2<u32>, vec2u
// "uint8x4"	unsigned int	4	4	vec4<u32>, vec4u
// "sint8x2"	signed int	2	2	vec2<i32>, vec2i
// "sint8x4"	signed int	4	4	vec4<i32>, vec4i
// "unorm8x2"	unsigned normalized	2	2	vec2<f32>, vec2f
// "unorm8x4"	unsigned normalized	4	4	vec4<f32>, vec4f
// "snorm8x2"	signed normalized	2	2	vec2<f32>, vec2f
// "snorm8x4"	signed normalized	4	4	vec4<f32>, vec4f
// "uint16x2"	unsigned int	2	4	vec2<u32>, vec2u
// "uint16x4"	unsigned int	4	8	vec4<u32>, vec4u
// "sint16x2"	signed int	2	4	vec2<i32>, vec2i
// "sint16x4"	signed int	4	8	vec4<i32>, vec4i
// "unorm16x2"	unsigned normalized	2	4	vec2<f32>, vec2f
// "unorm16x4"	unsigned normalized	4	8	vec4<f32>, vec4f
// "snorm16x2"	signed normalized	2	4	vec2<f32>, vec2f
// "snorm16x4"	signed normalized	4	8	vec4<f32>, vec4f
// "float16x2"	float	2	4	vec2<f16>, vec2h
// "float16x4"	float	4	8	vec4<f16>, vec4h
// "float32"	float	1	4	f32
// "float32x2"	float	2	8	vec2<f32>, vec2f
// "float32x3"	float	3	12	vec3<f32>, vec3f
// "float32x4"	float	4	16	vec4<f32>, vec4f
// "uint32"	unsigned int	1	4	u32
// "uint32x2"	unsigned int	2	8	vec2<u32>, vec2u
// "uint32x3"	unsigned int	3	12	vec3<u32>, vec3u
// "uint32x4"	unsigned int	4	16	vec4<u32>, vec4u
// "sint32"	signed int	1	4	i32
// "sint32x2"	signed int	2	8	vec2<i32>, vec2i
// "sint32x3"	signed int	3	12	vec3<i32>, vec3i
// "sint32x4"	signed int	4	16	vec4<i32>, vec4i

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

// from here https://stackoverflow.com/questions/33631041/javascript-async-await-in-replace
export async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (full, ...args) => {
        promises.push(asyncFn(full, ...args));
        return full;
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

export function transformCanvas(p, canvasWidth, canvasHeight) {
	let angle = p*180.
	let radians = angle * (Math.PI / 180.);

	const W = canvasWidth * Math.abs(Math.cos(radians)) + canvasHeight * Math.abs(Math.sin(radians));
	const H = canvasWidth * Math.abs(Math.sin(radians)) + canvasHeight * Math.abs(Math.cos(radians));
	const a = Math.min(canvasWidth / W, canvasHeight / H);

	const rotationMatrix = mat4.create();
	mat4.rotate(rotationMatrix, rotationMatrix, radians, [0, 0, 1]);

	const scaleMatrix = mat4.create();
	mat4.scale(scaleMatrix, scaleMatrix, [a, a, 1]);

	const transformMatrix = mat4.multiply(mat4.create(), rotationMatrix, scaleMatrix);

	return transformMatrix;
}
