# WebGPU-Particles
Experimenting with particle systems in web-GPU
 
## RoadMap

- [x] WebGPU - floating Triangle
- [x] WebGPU - Sample Texture
- [x] Change canvas size dynamicly to fit input image
- [x] Dithering shader
- [x] Dithering - Clean up shader
- [x] Dithering - add uniform (resolution, color number)
- [x] Uniform - Pass resolution of the context to the shader (stuff hardcoded for now in the dithering of the fragment)
- [ ] Input Vertex as a proper [vertex buffer](https://webgpufundamentals.org/webgpu/lessons/webgpu-vertex-buffers.html)
- [x] Dithering - Resolution modification
- [x] Shader - Split shader in dedicated file
- [x] UI - Parameter Tab w/ sliders to input data
- [x] Input - Display Image from internal path
- [ ] Particles - Particle system sampling input image
- [ ] UI - adding parameters to modify particle behaviour
- [ ] UI - Input image on drag and drop
- [ ] Experiment - simple mappings (e.g. color -> depth)
- [ ] WebGPU - Add movement 
	- [ ] Voronoi
	- [ ] Chladni
	- [ ] Gravity
- [ ] Experiment - circuit bend the movement, merge them, sequencer them
- [ ] Experiment - Test new particles properties (life length, form, size, texture)
- [ ] Crystal - create a symmetry group
- [ ] Crystal - simulate Growth


## To-Do

- [ ] selection de mode
- [ ] Uniform generator
- [ ] keyboard shortcut interaction
- [x] shader preprocessor (include)
- [ ] Going from compute to fragment breaks the canvas texture
- [ ] chain shaders
- [ ] preview original
- [ ] Half res preview option


## References

[Learning javascript from cpp](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

[WebGPU comprehensive introduction](https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html)

![architecture diagram](webgpu-draw-diagram.svg)

[Example with Type Script](https://webgpu.github.io/webgpu-samples/?sample=rotatingCube#main.ts)

[Dither shader](https://www.shadertoy.com/view/cdXGDn)

[WebGPU function references](https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl-function-reference.html#func-modf)

[WebGPU types and functions](https://webgpu.rocks/wgsl/functions/texture/)

[Reshade Reference](https://github.com/crosire/reshade-shaders/blob/slim/REFERENCE.md)

[writing to texture from compute shader](https://gist.github.com/greggman/295e38eeedf5957ac50179308666d98b)

[GPU query](https://developer.mozilla.org/en-US/docs/Web/API/GPUQuerySet)
