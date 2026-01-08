// Advanced Three.js Light Trails Animation
// Senior motion designer implementation with custom shaders and post-processing

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ============================================
// SCENE & RENDERER SETUP
// ============================================

const scene = new THREE.Scene();
// Deep navy-to-black gradient background
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
    1.5,  // strength
    0.5,  // radius
    0.8   // threshold
);
composer.addPass(bloomPass);

// ============================================
// NOISE FUNCTION (Simplex-like)
// ============================================

function hash(n) {
    return fract(sin(n) * 43758.5453);
}

function fract(x) {
    return x - Math.floor(x);
}

function noise(p) {
    const i = Math.floor(p);
    const f = fract(p);
    const u = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), u);
}

function mix(a, b, t) {
    return a + (b - a) * t;
}

function snoise2D(v) {
    const C = new THREE.Vector4(
        0.211324865405187,
        0.366025403784439,
        -0.577350269189626,
        0.024390243902439
    );
    const i = new THREE.Vector2(
        Math.floor(v.x + v.x * C.x + v.y * C.y),
        Math.floor(v.y + v.x * C.x + v.y * C.y)
    );
    const x0 = new THREE.Vector2(
        v.x - (i.x - (i.x + i.y) * C.x),
        v.y - (i.y - (i.x + i.y) * C.y)
    );
    const i1 = x0.x > x0.y ? new THREE.Vector2(1.0, 0.0) : new THREE.Vector2(0.0, 1.0);
    const x12 = new THREE.Vector4(
        x0.x + C.x - i1.x,
        x0.y + C.y - i1.y,
        x0.x + C.z,
        x0.y + C.w
    );
    
    i.x = i.x % 289.0;
    i.y = i.y % 289.0;
    
    const p = new THREE.Vector3(
        hash(i.x + hash(i.y)),
        hash(i.x + i1.x + hash(i.y + i1.y)),
        hash(i.x + 1.0 + hash(i.y + 1.0))
    );
    
    const m = Math.max(0.5 - new THREE.Vector3(
        x0.x * x0.x + x0.y * x0.y,
        x12.x * x12.x + x12.y * x12.y,
        x12.z * x12.z + x12.w * x12.w
    ).dot(new THREE.Vector3(1, 1, 1)), 0.0);
    
    m = m * m;
    return 105.0 * Math.pow(m, 4) * (
        p.x * (x0.x * x0.x + x0.y * x0.y) +
        p.y * (x12.x * x12.x + x12.y * x12.y) +
        p.z * (x12.z * x12.z + x12.w * x12.w)
    );
}

// Simplified 2D noise for JavaScript
function simpleNoise2D(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return (n - Math.floor(n)) * 2.0 - 1.0;
}

function fbm(x, y, octaves = 4) {
    let value = 0.0;
    let amplitude = 0.5;
    let frequency = 1.0;
    
    for (let i = 0; i < octaves; i++) {
        value += amplitude * simpleNoise2D(x * frequency, y * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return value;
}

// ============================================
// CUSTOM SHADER MATERIAL
// ============================================

const vertexShader = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uNoiseScale;
    uniform float uNoiseStrength;
    uniform float uThickness;
    
    varying vec2 vUv;
    varying float vProgress;
    varying float vIntensity;
    
    // Simplified fbm for vertex shader
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
        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }
    
    void main() {
        vUv = uv;
        vProgress = uv.x; // Use UV.x as progress along curve
        
        // Noise-based offset for organic motion
        vec2 noiseCoord = vec2(
            position.x * uNoiseScale + uTime * 0.3,
            position.y * uNoiseScale + uTime * 0.2
        );
        float noiseValue = fbm(noiseCoord) * uNoiseStrength;
        
        // Time-based sine wave for smooth motion
        float timeOffset = sin(uTime * 0.5 + vProgress * 2.0) * 0.1;
        
        vec3 pos = position;
        pos.xy += vec2(noiseValue, timeOffset);
        
        // Thickness variation
        vec3 n = normalize(normal);
        pos += n * uThickness * (0.8 + 0.4 * sin(uTime + vProgress * 3.0));
        
        vIntensity = 0.7 + 0.3 * sin(uTime * 1.5 + vProgress * 4.0);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const fragmentShader = `
    uniform float uTime;
    
    varying vec2 vUv;
    varying float vProgress;
    varying float vIntensity;
    
    void main() {
        // Gradient color interpolation along curve
        // Blue -> Violet -> Magenta -> Orange
        vec3 color1 = vec3(0.26, 0.35, 0.58);  // Electric blue
        vec3 color2 = vec3(0.55, 0.36, 0.96); // Violet
        vec3 color3 = vec3(0.92, 0.28, 0.60); // Magenta
        vec3 color4 = vec3(0.98, 0.58, 0.24); // Warm orange
        
        float t = vProgress;
        
        vec3 color;
        if (t < 0.33) {
            color = mix(color1, color2, t * 3.0);
        } else if (t < 0.66) {
            color = mix(color2, color3, (t - 0.33) * 3.0);
        } else {
            color = mix(color3, color4, (t - 0.66) * 3.0);
        }
        
        // Soft alpha falloff at edges
        float edgeFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
        edgeFade = smoothstep(0.0, 0.3, edgeFade);
        
        // Time-based intensity variation
        float timeIntensity = 0.8 + 0.2 * sin(uTime * 0.8);
        
        // Final color with additive blending
        float alpha = edgeFade * vIntensity * timeIntensity * 0.9;
        gl_FragColor = vec4(color * alpha, alpha);
    }
`;

// ============================================
// CURVE GENERATION SYSTEM
// ============================================

function createCurve(index, totalCurves) {
    const points = [];
    const numPoints = 8;
    
    // Diagonal flow from top-right to bottom-left
    const startX = 8 + (index * 0.5);
    const startY = 6 - (index * 0.3);
    const endX = -8 - (index * 0.5);
    const endY = -6 + (index * 0.3);
    
    // Create control points for smooth curve
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = THREE.MathUtils.lerp(startX, endX, t);
        const y = THREE.MathUtils.lerp(startY, endY, t);
        
        // Add curve variation with sine waves
        const curveAmplitude = 2.0 + index * 0.5;
        const curveFreq = 2.0 + index * 0.3;
        const offsetX = Math.sin(t * Math.PI * curveFreq) * curveAmplitude;
        const offsetY = Math.cos(t * Math.PI * curveFreq * 0.7) * curveAmplitude * 0.6;
        
        // Z depth for parallax (different layers)
        const zDepth = (index - totalCurves / 2) * 0.8;
        
        points.push(new THREE.Vector3(
            x + offsetX,
            y + offsetY,
            zDepth
        ));
    }
    
    // Create Catmull-Rom spline curve
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    return curve;
}

// ============================================
// CREATE LIGHT TRAIL MESHES
// ============================================

const curves = [];
const meshes = [];
const numCurves = 7;

for (let i = 0; i < numCurves; i++) {
    const curve = createCurve(i, numCurves);
    curves.push(curve);
    
    // Tube geometry with varying radius
    const radius = 0.02 + (i * 0.008);
    const segments = 128;
    const radialSegments = 8;
    
    const geometry = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
    
    // Custom shader material
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uSpeed: { value: 0.5 + i * 0.1 },
            uNoiseScale: { value: 0.15 + i * 0.05 },
            uNoiseStrength: { value: 0.3 + i * 0.1 },
            uThickness: { value: radius }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshes.push({ mesh, curve, material });
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

// Smooth scroll interpolation
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
    
    // Update scroll
    updateScroll();
    
    // Scroll influence on animation
    const scrollInfluence = 1.0 + (scrollY * 0.0001);
    const scrollIntensity = 1.0 + (scrollY * 0.00005);
    
    // Update each curve mesh
    meshes.forEach((item, index) => {
        // Update shader uniforms for shader-based animation (every frame)
        item.material.uniforms.uTime.value = time * scrollInfluence;
        item.material.uniforms.uSpeed.value = (0.5 + index * 0.1) * scrollInfluence;
        item.material.uniforms.uNoiseStrength.value = (0.3 + index * 0.1) * scrollIntensity;
        
        // Curve point animation (update geometry every 3 frames for performance)
        const frameCount = Math.floor(time * 60);
        if (frameCount % 3 === 0) {
            const curve = item.curve;
            const points = curve.points;
            
            points.forEach((point, pIndex) => {
                // Store original position on first frame
                if (!point.userData.originalX) {
                    point.userData.originalX = point.x;
                    point.userData.originalY = point.y;
                }
                
                const baseX = point.userData.originalX;
                const baseY = point.userData.originalY;
                
                const noiseX = fbm(
                    baseX * 0.1 + time * 0.2,
                    baseY * 0.1 + time * 0.15
                ) * 0.25 * scrollIntensity;
                const noiseY = fbm(
                    baseX * 0.12 + time * 0.18,
                    baseY * 0.12 + time * 0.2
                ) * 0.25 * scrollIntensity;
                
                const sineOffset = Math.sin(time * 0.5 + pIndex * 0.5) * 0.2;
                const cosineOffset = Math.cos(time * 0.4 + pIndex * 0.6) * 0.15;
                
                point.x = baseX + noiseX + sineOffset;
                point.y = baseY + noiseY + cosineOffset;
            });
            
            // Update curve and regenerate geometry
            curve.updateArcLengths();
            
            const radius = 0.02 + (index * 0.008);
            const newGeometry = new THREE.TubeGeometry(curve, 128, radius, 8, false);
            item.mesh.geometry.dispose();
            item.mesh.geometry = newGeometry;
        }
    });
    
    // Update post-processing
    bloomPass.strength = 1.5 + Math.sin(time * 0.3) * 0.3;
    
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
