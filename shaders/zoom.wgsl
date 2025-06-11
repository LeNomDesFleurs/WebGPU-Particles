struct ZoomParams {
    center: vec2f,
    zoom: f32,
    resolution: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    var pos = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f(1.0, -1.0),
        vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0),
        vec2f(1.0, -1.0),
        vec2f(1.0, 1.0)
    );

    return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@group(0) @binding(0) var imgSampler: sampler;
@group(0) @binding(1) var imgTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> zoomParams: ZoomParams;

@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let uv = pos.xy / zoomParams.resolution;
    let zoomedUV = zoomParams.center + (uv - vec2f(0.5)) / zoomParams.zoom;
    return textureSample(imgTexture, imgSampler, zoomedUV);
}