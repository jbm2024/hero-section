---
name: Advanced Three.js Light Trails Animation
overview: Recreate a high-fidelity animated background with flowing curved light trails using advanced Three.js techniques including custom GLSL shaders, post-processing effects, parametric curve generation, and scroll-based interaction.
todos: []
---

# Advanced Three.js Light Trails Animation

## Overview

Transform the basic Three.js boilerplate into a sophisticated animated background featuring multiple layered, flowing curved light trails with smooth color gradients, bloom effects, and scroll-based interaction. The implementation will use advanced WebGL techniques including custom shaders, post-processing, and procedural animation.

## Files to Modify

### 1. [index.html](index.html)

- Upgrade Three.js to r160+ via CDN with ES modules
- Add post-processing dependencies (EffectComposer, RenderPass, UnrealBloomPass)
- Add shader pass utilities if needed
- Update script to use ES modules

### 2. [assets/javascript/script.js](assets/javascript/script.js)

**Complete rewrite with:**

- **Scene & Renderer Setup:**
- Deep navy-to-black gradient background
- WebGL renderer with proper alpha and tone mapping
- EffectComposer for post-processing pipeline

- **Curve Generation System:**
- Catmull-Rom spline curve generator
- Multiple curve groups (5-8 curves) with varied parameters
- Curves positioned diagonally (top-right to bottom-left flow)
- Different Z depths for parallax layering

- **Geometry Creation:**
- TubeGeometry for each curve with radius variation
- High segment count for smooth curves (64+ segments)
- UV mapping for gradient shader

- **Custom Shader System:**
- Vertex shader: curve position, thickness variation, noise-based offsets
- Fragment shader: gradient color interpolation (blue → violet → magenta → orange)
- Soft alpha falloff at edges
- Time-based intensity variation
- Additive blending support

- **Animation System:**
- Time-based sine wave offsets for smooth motion
- Simplex/Perlin noise for organic variation
- Continuous seamless looping
- Different speeds per layer for depth

- **Post-Processing Pipeline:**
- RenderPass for base scene
- UnrealBloomPass for glow/bloom effect
- Proper tone mapping and color space

- **Interaction:**
- Scroll event listener
- Scroll position affects curve flow speed/intensity
- Smooth interpolation for interaction changes

- **Performance Optimization:**
- Efficient shader calculations
- Instancing consideration for multiple curves
- Responsive scaling
- Frame rate management

### 3. [assets/css/style.css](assets/css/style.css)

- Ensure canvas has proper background (deep navy/black gradient)
- Maintain fullscreen hero section
- Optimize for performance (will-paint, transform optimizations)

## Implementation Details

**Color Gradient:**

- Start: Deep blue (#1a1a3e, #2d2d5e)
- Mid: Violet/Magenta (#8b5cf6, #ec4899)
- End: Warm orange (#f97316, #fb923c)
- Smooth interpolation along curve length using shader

**Curve Parameters:**

- 5-8 curves total
- Varying thickness (0.02 - 0.08 units)
- Different curve lengths and amplitudes
- Layered at Z positions: -2, -1, 0, 1, 2 for parallax

**Animation:**

- Base speed: 0.3-0.8 units/second per layer
- Sine wave frequency: 0.5-2.0 Hz
- Noise scale: 0.1-0.5
- Seamless loop with modulo wrapping

**Post-Processing:**

- Bloom threshold: 0.5
- Bloom strength: 1.5-2.0
- Bloom radius: 0.8-1.2
- Tone mapping: ACESFilmic

**Performance Targets:**

- 60fps on modern hardware
- Graceful degradation on lower-end devices
- Responsive to screen size changes