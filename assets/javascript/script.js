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
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
);
camera.position.set(0, 0, 8);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 10));
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
    6.5,  // strength - increased for 2px line visibility
    3.2,  // radius - increased for better glow
    0.6   // threshold - lowered to capture thin lines
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
    uniform float uDirection; // 0.0 = horizontal, 1.0 = diagonal-right, 2.0 = diagonal-left
    uniform float uCurveType; // 0.0 = gentle, 1.0 = moderate, 2.0 = strong
    
    varying vec2 vUv;
    varying float vProgress;
    varying float vDistanceFromCenter;
    
    // Enhanced noise functions for more organic motion
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
    
    // Smooth thickness variation along curve
    float getThicknessMultiplier(float progress) {
        // Slightly thicker in the middle, tapered at ends
        return 0.7 + 0.3 * sin(progress * 3.14159);
    }
    
    void main() {
        vUv = uv;
        vProgress = uv.x; // Progress along wave length
        
        // Base position
        vec3 pos = position;
        
        // Calculate curve strength multiplier based on curve type
        float curveStrengthMult = 1.0 + uCurveType * 0.5; // Stronger curves for higher types
        
        // Base wave phase calculation
        float wavePhase = uFrequency * pos.x + uPhase + mod(uTime * uSpeed, 6.28318);
        float sineWave = sin(wavePhase) * uAmplitude * curveStrengthMult;
        
        // Secondary wave varies with curve type
        float secondaryWave = sin(wavePhase * (1.5 + uCurveType * 0.2) + uTime * uSpeed * 0.5) * uAmplitude * 0.3 * curveStrengthMult;
        
        // Enhanced noise modulation
        vec2 noiseCoord = vec2(
            pos.x * uNoiseScale + uTime * 0.06,
            pos.y * uNoiseScale + uTime * 0.04
        );
        float noiseValue = fbm(noiseCoord) * uNoiseStrength * curveStrengthMult;
        
        // Minimal mouse influence
        float mouseInfluence = length(uMouse) * 0.015;
        float mouseOffset = sin(wavePhase + atan(uMouse.y, uMouse.x) * 0.05) * mouseInfluence;
        
        // Apply vertical displacement
        float verticalDisplacement = sineWave + secondaryWave + noiseValue + mouseOffset;
        
        // Apply directional transformation based on uDirection
        if (uDirection < 0.5) {
            // Horizontal (Section 1)
            pos.y += verticalDisplacement + uVerticalOffset;
        } else if (uDirection < 1.5) {
            // Diagonal right (Section 2) - slight x offset based on y displacement
            pos.y += verticalDisplacement + uVerticalOffset;
            pos.x += verticalDisplacement * 0.15;
        } else {
            // Diagonal left (Section 3) - opposite x offset
            pos.y += verticalDisplacement + uVerticalOffset;
            pos.x -= verticalDisplacement * 0.15;
        }
        
        // Apply thickness variation
        float thicknessMult = getThicknessMultiplier(uv.x);
        pos.y *= thicknessMult;
        
        // Distance from center for edge falloff
        vDistanceFromCenter = abs(uv.y - 0.5) * 2.0;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const fragmentShader = `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uColorIntensity;
    uniform float uVisibility; // Section-based visibility multiplier
    
    varying vec2 vUv;
    varying float vProgress;
    varying float vDistanceFromCenter;
    
    // Enhanced color interpolation matching SVG reference
    // Blue -> Violet -> Magenta -> Orange gradient
    vec3 smoothGradient(float t) {
        // Adjusted colors to match SVG reference more closely
        vec3 color1 = vec3(0.4, 0.55, 0.92);   // Cool blue (slightly more saturated)
        vec3 color2 = vec3(0.55, 0.40, 0.95);  // Violet (richer)
        vec3 color3 = vec3(0.88, 0.35, 0.62);  // Magenta/pink (warmer)
        vec3 color4 = vec3(1.0, 0.50, 0.32);   // Warm orange (more vibrant)
        
        // Ultra-smooth interpolation with enhanced transitions
        float t1 = smoothstep(0.0, 0.3, t);
        float t2 = smoothstep(0.25, 0.55, t);
        float t3 = smoothstep(0.5, 0.8, t);
        float t4 = smoothstep(0.7, 1.0, t);
        
        vec3 color = mix(color1, color2, t1);
        color = mix(color, color3, t2);
        color = mix(color, color4, t3);
        
        // Additional smoothing for seamless transitions
        color = mix(color, mix(color2, color3, 0.5), t4 * 0.25);
        
        return color;
    }
    
    void main() {
        // Smooth gradient along wave length
        vec3 color = smoothGradient(vProgress) * uColorIntensity;
        
        // Precise 2px core with enhanced glow
        // Calculate distance from center line (0.0 = center, 1.0 = edge)
        float distanceFromCenter = vDistanceFromCenter;
        
        // Precise 2px core (very sharp falloff in center)
        float coreWidth = 0.01; // ~2px in normalized UV space
        float coreMask = 1.0 - smoothstep(0.0, coreWidth, distanceFromCenter);
        
        // Soft glow around core (for bloom effect)
        float glowWidth = 0.15;
        float glowMask = 1.0 - smoothstep(coreWidth, glowWidth, distanceFromCenter);
        
        // Combine core and glow for 2px line with bloom
        float lineMask = max(coreMask, glowMask * 0.3);
        
        // Enhanced internal light diffusion with stronger center glow
        float centerIntensity = exp(-distanceFromCenter * 1.5);
        float diffusion = mix(0.4, 1.0, centerIntensity);
        
        // Additional soft glow layer
        float softGlow = exp(-distanceFromCenter * 0.8);
        
        // Slower time-based intensity variation for more graceful pulsing
        float timeIntensity = 0.88 + 0.12 * sin(uTime * 0.3);
        
        // Final alpha with 2px core and enhanced layering
        float alpha = lineMask * diffusion * timeIntensity * uOpacity;
        alpha = alpha + (softGlow * 0.2 * uOpacity);
        
        // Softer glow curve for more diffused appearance
        alpha = pow(alpha, 0.75);
        
        // Apply section-based visibility
        alpha *= uVisibility;
        
        // Enhance color brightness in center
        color = color * (1.0 + centerIntensity * 0.3);
        
        gl_FragColor = vec4(color * alpha, alpha);
    }
`;

// ============================================
// SEPARATE LINE CONFIGURATIONS PER SECTION
// ============================================

const waveBands = [];

// Calculate 2px in world space
function calculate2pxHeight() {
    const viewportHeight = window.innerHeight;
    const cameraDistance = camera.position.z;
    const fovRad = (camera.fov * Math.PI) / 180;
    const worldHeight = (2.0 / viewportHeight) * (cameraDistance * 2.0 * Math.tan(fovRad / 2));
    return worldHeight;
}

// Section 1 Lines - Horizontal flow (Screen-1.svg pattern) - 14 lines
const section1Lines = Array.from({ length: 14 }, (_, i) => ({
    sectionIndex: 0,
    zDepth: -2.0 + (i * 0.3),
    speed: 0.08 + (i * 0.003),
    opacity: 0.35 + (i % 3) * 0.05,
    colorIntensity: 0.8 + (i * 0.01),
    amplitude: 0.4 + (i * 0.02),
    frequency: 0.12 + (i * 0.01),
    height: 0.002, // Will be set to actual 2px
    verticalOffset: -6.0 + (i * 0.9),
    direction: 0.0,
    curveType: 0.0,
    phaseOffset: i * Math.PI * 0.15
}));

// Section 2 Lines - Diagonal flow (Screen-2.svg pattern) - 13 lines
const section2Lines = Array.from({ length: 13 }, (_, i) => ({
    sectionIndex: 1,
    zDepth: -1.8 + (i * 0.3),
    speed: 0.12 + (i * 0.004),
    opacity: 0.40 + (i % 3) * 0.05,
    colorIntensity: 0.85 + (i * 0.01),
    amplitude: 0.6 + (i * 0.03),
    frequency: 0.15 + (i * 0.012),
    height: 0.002,
    verticalOffset: -5.5 + (i * 0.95),
    direction: 1.0,
    curveType: 1.0,
    phaseOffset: i * Math.PI * 0.18
}));

// Section 3 Lines - Opposite diagonal flow (Screen-3.svg pattern) - 13 lines
const section3Lines = Array.from({ length: 13 }, (_, i) => ({
    sectionIndex: 2,
    zDepth: -1.5 + (i * 0.3),
    speed: 0.14 + (i * 0.005),
    opacity: 0.42 + (i % 3) * 0.05,
    colorIntensity: 0.90 + (i * 0.01),
    amplitude: 0.7 + (i * 0.035),
    frequency: 0.18 + (i * 0.014),
    height: 0.002,
    verticalOffset: -5.8 + (i * 0.92),
    direction: 2.0,
    curveType: 2.0,
    phaseOffset: i * Math.PI * 0.20
}));

// Combine all line configurations
const allLineConfigs = [...section1Lines, ...section2Lines, ...section3Lines];

// Calculate actual 2px height in world space
const actual2pxHeight = calculate2pxHeight();

// Create separate, distinct wave bands for each section (40 total lines)
allLineConfigs.forEach((lineConfig, lineIndex) => {
    // Create ribbon plane geometry with precise 2px height
    const width = 50; // Extends beyond viewport
    const height = actual2pxHeight; // Precise 2px in world space
    const widthSegments = 256; // High subdivision for smooth waves
    const heightSegments = 2; // Minimal segments for thin 2px line
    
    const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
    
    // Use phase offset from config
    const phaseOffset = lineConfig.phaseOffset;
    
    // Store line index in config for interpolation
    const configWithIndex = { ...lineConfig, lineIndex };
    
    // Custom shader material with section-specific parameters
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uSpeed: { value: lineConfig.speed },
            uAmplitude: { value: lineConfig.amplitude },
            uFrequency: { value: lineConfig.frequency },
            uNoiseScale: { value: 0.05 }, // Reduced for smoother curves
            uNoiseStrength: { value: 0.10 }, // Reduced for less randomness
            uPhase: { value: phaseOffset },
            uVerticalOffset: { value: lineConfig.verticalOffset },
            uOpacity: { value: lineConfig.opacity },
            uColorIntensity: { value: lineConfig.colorIntensity },
            uMouse: { value: new THREE.Vector2(0, 0) },
            uDirection: { value: lineConfig.direction },
            uCurveType: { value: lineConfig.curveType },
            uVisibility: { value: 1.0 } // Will be updated based on scroll
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = lineConfig.zDepth;
    scene.add(mesh);
    
    waveBands.push({ 
        mesh, 
        material, 
        sectionIndex: lineConfig.sectionIndex,
        lineIndex,
        lineConfig: configWithIndex // Store for interpolation
    });
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
// SCROLL INTERACTION & SECTION DETECTION
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

// Section detection - determines which section is currently in view
function getCurrentSection() {
    const viewportHeight = window.innerHeight;
    const sectionIndex = Math.floor(scrollY / viewportHeight);
    return Math.min(sectionIndex, 2); // 0, 1, or 2 for sections 1-3
}

// Calculate visibility multiplier for lines based on section
function getSectionVisibility(lineSection) {
    const currentSection = getCurrentSection();
    const distance = Math.abs(currentSection - lineSection);
    
    if (distance === 0) return 1.0; // Fully visible in current section
    if (distance === 1) return 0.25; // Slightly visible in adjacent section
    return 0.0; // Hidden in distant sections
}

// Smooth easing function (cubic ease-in-out) for Apple-level smoothness
function smoothEase(t) {
    return t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Get scroll progress within current section (0.0 to 1.0)
function getSectionProgress() {
    const viewportHeight = window.innerHeight;
    const sectionProgress = (scrollY % viewportHeight) / viewportHeight;
    return sectionProgress;
}

// Get interpolation factor between sections
function getInterpolationFactor() {
    const viewportHeight = window.innerHeight;
    const currentSection = getCurrentSection();
    const sectionProgress = (scrollY % viewportHeight) / viewportHeight;
    
    // Smooth transition zone in last 30% of section
    if (sectionProgress > 0.7 && currentSection < 2) {
        const transitionProgress = (sectionProgress - 0.7) / 0.3;
        return smoothEase(transitionProgress);
    }
    return 0.0;
}

// Interpolate line parameters between sections
function getInterpolatedParams(lineConfig, currentSection, interpolationFactor) {
    if (interpolationFactor === 0.0) {
        return lineConfig; // No interpolation needed
    }
    
    const nextSection = currentSection + 1;
    const nextSectionConfigs = nextSection === 1 ? section2Lines : section3Lines;
    const nextConfig = nextSectionConfigs[lineConfig.lineIndex % nextSectionConfigs.length];
    
    // Interpolate all parameters smoothly
    return {
        ...lineConfig,
        speed: lineConfig.speed + (nextConfig.speed - lineConfig.speed) * interpolationFactor,
        amplitude: lineConfig.amplitude + (nextConfig.amplitude - lineConfig.amplitude) * interpolationFactor,
        frequency: lineConfig.frequency + (nextConfig.frequency - lineConfig.frequency) * interpolationFactor,
        direction: lineConfig.direction + (nextConfig.direction - lineConfig.direction) * interpolationFactor,
        curveType: lineConfig.curveType + (nextConfig.curveType - lineConfig.curveType) * interpolationFactor,
        opacity: lineConfig.opacity + (nextConfig.opacity - lineConfig.opacity) * interpolationFactor * 0.5
    };
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
    
    // Update all wave bands with interpolated parameters and visibility
    const currentSection = getCurrentSection();
    const interpolationFactor = getInterpolationFactor();
    
    waveBands.forEach((waveBand) => {
        const uniforms = waveBand.material.uniforms;
        
        // Get interpolated parameters for smooth transitions
        const interpolatedParams = getInterpolatedParams(
            waveBand.lineConfig,
            currentSection,
            interpolationFactor
        );
        
        // Update time with scroll influence
        uniforms.uTime.value = time * scrollInfluence;
        
        // Update parameters with interpolated values
        uniforms.uSpeed.value = interpolatedParams.speed;
        uniforms.uAmplitude.value = interpolatedParams.amplitude;
        uniforms.uFrequency.value = interpolatedParams.frequency;
        uniforms.uDirection.value = interpolatedParams.direction;
        uniforms.uCurveType.value = interpolatedParams.curveType;
        uniforms.uOpacity.value = interpolatedParams.opacity;
        uniforms.uColorIntensity.value = interpolatedParams.colorIntensity;
        
        // Update mouse position (very restrained)
        uniforms.uMouse.value.copy(mouse);
        
        // Apply section-based visibility - smooth transition
        const targetVisibility = getSectionVisibility(waveBand.sectionIndex);
        const currentVisibility = uniforms.uVisibility.value;
        uniforms.uVisibility.value += (targetVisibility - currentVisibility) * 0.08;
    });
    
    // Subtle bloom variation with slower, more graceful pulsing
    bloomPass.strength = 3.5 + Math.sin(time * 0.15) * 0.4;
    
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
    
    // Recalculate 2px height on resize and update all geometries
    const new2pxHeight = calculate2pxHeight();
    waveBands.forEach((waveBand) => {
        const geometry = waveBand.mesh.geometry;
        geometry.dispose();
        const newGeometry = new THREE.PlaneGeometry(50, new2pxHeight, 256, 2);
        waveBand.mesh.geometry = newGeometry;
    });
}

window.addEventListener('resize', handleResize);

// ============================================
// START ANIMATION
// ============================================

animate();
