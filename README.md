# WebGPU-Particles
Experimenting with particle systems in web-GPU
 
## RoadMap

- [x] WebGPU - floating Triangle
- [x] WebGPU - Sample Texture
- [x] Dithering shader
- [ ] Dithering - Clean up shader
- [ ] Dithering - add uniform (resolution, color number)
- [ ] Uniform - Pass resolution of the context to the shader (stuff hardcoded for now in the dithering of the fragment)
- [ ] Input Vertex as a proper [vertex buffer](https://webgpufundamentals.org/webgpu/lessons/webgpu-vertex-buffers.html)
- [ ] Dithering - add pixelisation
- [ ] Shader - Split shader in dedicated file
- [ ] UI - Parameter Tab w/ sliders to input data
- [ ] Input - Display Image from internal path
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


## References

[Learning javascript from cpp](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

[WebGPU comprehensive introduction](https://webgpufundamentals.org/webgpu/lessons/webgpu-fundamentals.html)

![architecture diagram](webgpu-draw-diagram.svg)

[Example with Type Script](https://webgpu.github.io/webgpu-samples/?sample=rotatingCube#main.ts)

[Dither shader](https://www.shadertoy.com/view/cdXGDn)

[WebGPU function references](https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl-function-reference.html#func-modf)




