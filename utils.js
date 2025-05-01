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