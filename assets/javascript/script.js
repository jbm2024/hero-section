// Smooth Light-Wave Bands Animation
// Horizontally-dominant ribbon surfaces creating continuous wave fields

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ============================================
// SCENE & RENDERER SETUP
// ============================================

const scene = new THREE.Scene();
// Deep navy-to-black gradient background (matches CSS)
scene.background = new THREE.Color(0x0a0a1a);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const heroSection = document.querySelector('.hero-section');
heroSection.appendChild(renderer.domElement);

// ============================================
// POST-PROCESSING PIPELINE
// ============================================

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    2.0,  // strength - increased for better glow
    0.8,  // radius
    0.6   // threshold
);
composer.addPass(bloomPass);

// ============================================
// CUSTOM SHADER MATERIAL FOR WAVE BANDS
// ============================================

const vertexShader = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uAmplitude;
    uniform float uFrequency;
    uniform float uNoiseScale;
    uniform float uNoiseStrength;
    uniform float uPhase;
    uniform float uVerticalOffset;
    uniform vec2 uMouse;
    
    varying vec2 vUv;
    varying float vProgress;
    varying float vDistanceFromCenter;
    
    // Noise functions for organic motion
    float hash(float n) {
        return fract(sin(n) * 43758.5453);
    }
    
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = i.x + i.y * 57.0;
        return mix(
            mix(hash(n + 0.0), hash(n + 1.0), f.x),
            mix(hash(n + 57.0), hash(n + 58.0), f.x),
            f.y
        );
    }
    
    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 3; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }
    
    void main() {
        vUv = uv;
        vProgress = uv.x; // Progress along wave length
        
        // Base position
        vec3 pos = position;
        
        // Horizontal sine wave displacement (gentle vertical undulation)
        // Use modulo for seamless looping
        float wavePhase = uFrequency * pos.x + uPhase + mod(uTime * uSpeed, 6.28318);
        float sineWave = sin(wavePhase) * uAmplitude;
        
        // Low-frequency noise modulation for organic motion
        vec2 noiseCoord = vec2(
            pos.x * uNoiseScale + uTime * 0.1,
            pos.y * uNoiseScale + uTime * 0.08
        );
        float noiseValue = fbm(noiseCoord) * uNoiseStrength;
        
        // Subtle mouse influence (very restrained)
        float mouseInfluence = length(uMouse) * 0.05;
        float mouseOffset = sin(wavePhase + atan(uMouse.y, uMouse.x) * 0.1) * mouseInfluence;
        
        // Apply vertical displacement
        pos.y += sineWave + noiseValue + mouseOffset + uVerticalOffset;
        
        // Distance from center for edge falloff
        vDistanceFromCenter = abs(uv.y - 0.5) * 2.0;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const fragmentShader = `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uColorIntensity;
    
    varying vec2 vUv;
    varying float vProgress;
    varying float vDistanceFromCenter;
    
    // Smooth color interpolation
    // Based on reference: Orange/Peach -> Magenta/Violet -> Blue
    vec3 smoothGradient(float t) {
        // Warm orange/peach -> Magenta -> Violet -> Electric blue
        vec3 color1 = vec3(0.98, 0.65, 0.40);  // Warm orange/peach
        vec3 color2 = vec3(0.92, 0.28, 0.60);  // Magenta #ec4899
        vec3 color3 = vec3(0.55, 0.36, 0.96);  // Violet #8b5cf6
        vec3 color4 = vec3(0.26, 0.50, 0.85);  // Electric blue
        
        // Ultra-smooth interpolation using multiple smoothstep layers
        // This creates seamless color transitions
        float t1 = smoothstep(0.0, 0.25, t);
        float t2 = smoothstep(0.25, 0.50, t);
        float t3 = smoothstep(0.50, 0.75, t);
        float t4 = smoothstep(0.75, 1.0, t);
        
        vec3 color = mix(color1, color2, t1);
        color = mix(color, color3, t2);
        color = mix(color, color4, t3);
        
        // Additional smoothing pass
        color = mix(color, mix(color2, color3, 0.5), t4 * 0.3);
        
        return color;
    }
    
    void main() {
        // Smooth gradient along wave length
        vec3 color = smoothGradient(vProgress) * uColorIntensity;
        
        // Soft feathered edges (smoothstep falloff)
        // Wider falloff for softer edges
        float edgeFade = 1.0 - smoothstep(0.0, 0.5, vDistanceFromCenter);
        
        // Internal light diffusion (volumetric feel)
        // Create brighter center with exponential falloff
        float centerIntensity = exp(-vDistanceFromCenter * 2.0);
        float diffusion = mix(0.5, 1.0, centerIntensity);
        
        // Time-based subtle intensity variation
        float timeIntensity = 0.85 + 0.15 * sin(uTime * 0.5);
        
        // Final alpha with multiple falloff layers
        float alpha = edgeFade * diffusion * timeIntensity * uOpacity;
        
        // Soft glow with exponential falloff
        alpha = pow(alpha, 0.8);
        
        gl_FragColor = vec4(color * alpha, alpha);
    }
`;

// ============================================
// WAVE BAND GENERATION
// ============================================

const waveBands = [];
const numLayers = 6;
const wavesPerLayer = 3;

// Layer configuration for parallax
const layerConfigs = [
    { zDepth: -2.5, speed: 0.12, opacity: 0.35, colorIntensity: 0.8, amplitude: 0.6, frequency: 0.15 },
    { zDepth: -1.5, speed: 0.15, opacity: 0.45, colorIntensity: 0.9, amplitude: 0.8, frequency: 0.18 },
    { zDepth: -0.5, speed: 0.18, opacity: 0.55, colorIntensity: 1.0, amplitude: 1.0, frequency: 0.20 },
    { zDepth: 0.5, speed: 0.20, opacity: 0.60, colorIntensity: 1.1, amplitude: 1.2, frequency: 0.22 },
    { zDepth: 1.5, speed: 0.22, opacity: 0.50, colorIntensity: 1.0, amplitude: 1.0, frequency: 0.18 },
    { zDepth: 2.5, speed: 0.25, opacity: 0.40, colorIntensity: 0.9, amplitude: 0.8, frequency: 0.15 }
];

// Create wave bands
layerConfigs.forEach((layerConfig, layerIndex) => {
    for (let waveIndex = 0; waveIndex < wavesPerLayer; waveIndex++) {
        // Create broad ribbon plane geometry
        // Wide horizontal bands that span beyond viewport
        const width = 50; // Extends beyond viewport for infinite feel
        const height = 2.0; // Broad ribbon surface
        const widthSegments = 256; // High subdivision for smooth waves
        const heightSegments = 8; // More vertical segments for better edge falloff
        
        const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
        
        // Center the geometry
        geometry.translate(0, 0, 0);
        
        // Phase offset for each wave in layer
        const phaseOffset = (waveIndex / wavesPerLayer) * Math.PI * 2;
        
        // Vertical spacing between waves
        const verticalSpacing = 2.5;
        const verticalOffset = (waveIndex - (wavesPerLayer - 1) / 2) * verticalSpacing;
        
        // Custom shader material
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uSpeed: { value: layerConfig.speed },
                uAmplitude: { value: layerConfig.amplitude },
                uFrequency: { value: layerConfig.frequency },
                uNoiseScale: { value: 0.08 },
                uNoiseStrength: { value: 0.15 },
                uPhase: { value: phaseOffset },
                uVerticalOffset: { value: verticalOffset },
                uOpacity: { value: layerConfig.opacity },
                uColorIntensity: { value: layerConfig.colorIntensity },
                uMouse: { value: new THREE.Vector2(0, 0) }
            },
            transparent: true,
            blending: THREE.AdditiveBlending, // Screen blending for visual fusion
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = layerConfig.zDepth;
        scene.add(mesh);
        
        waveBands.push({ mesh, material, layerIndex, waveIndex });
    }
});

// ============================================
// MOUSE INTERACTION (Minimal)
// ============================================

const mouse = new THREE.Vector2(0, 0);
let targetMouse = new THREE.Vector2(0, 0);

window.addEventListener('mousemove', (event) => {
    // Normalize mouse position to -1 to 1 range
    targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Smooth mouse interpolation
function updateMouse() {
    mouse.lerp(targetMouse, 0.05);
}

// ============================================
// SCROLL INTERACTION
// ============================================

let scrollY = 0;
let targetScrollY = 0;
const scrollSpeed = 0.02;

window.addEventListener('scroll', () => {
    targetScrollY = window.scrollY;
});

function updateScroll() {
    scrollY += (targetScrollY - scrollY) * scrollSpeed;
}

// ============================================
// ANIMATION LOOP
// ============================================

let time = 0;
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    time += deltaTime;
    
    // Update interactions
    updateMouse();
    updateScroll();
    
    // Scroll influence (very subtle)
    const scrollInfluence = 1.0 + (scrollY * 0.00005);
    
    // Update all wave bands
    waveBands.forEach((waveBand) => {
        const uniforms = waveBand.material.uniforms;
        
        // Update time with scroll influence
        uniforms.uTime.value = time * scrollInfluence;
        
        // Update mouse position (very restrained)
        uniforms.uMouse.value.copy(mouse);
    });
    
    // Subtle bloom variation
    bloomPass.strength = 2.0 + Math.sin(time * 0.2) * 0.2;
    
    // Render with post-processing
    composer.render();
}

// ============================================
// WINDOW RESIZE HANDLER
// ============================================

function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', handleResize);

// ============================================
// START ANIMATION
// ============================================

animate();
