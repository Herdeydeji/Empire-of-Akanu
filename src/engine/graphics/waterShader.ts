import * as THREE from 'three';

export interface DynamicWaterUniforms {
  uTime: { value: number };
  uSunDirection: { value: THREE.Vector3 };
  uShallowColor: { value: THREE.Color };
  uDeepColor: { value: THREE.Color };
  uFoamColor: { value: THREE.Color };
  uWaterBump: { value: THREE.Texture };
  uWaveSpeed: { value: number };
  uWaveHeight: { value: number };
}

export function createDynamicWaterMaterial(
  shallowHex: string,
  deepHex: string,
  waterBumpTexture: THREE.Texture,
): THREE.ShaderMaterial {
  const uniforms: DynamicWaterUniforms = {
    uTime: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(0.55, 0.78, 0.3).normalize() },
    uShallowColor: { value: new THREE.Color(shallowHex) },
    uDeepColor: { value: new THREE.Color(deepHex) },
    uFoamColor: { value: new THREE.Color('#f0fdfa') },
    uWaterBump: { value: waterBumpTexture },
    uWaveSpeed: { value: 0.85 },
    uWaveHeight: { value: 0.08 },
  };

  const vertexShader = `
    uniform float uTime;
    uniform float uWaveSpeed;
    uniform float uWaveHeight;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Multi-frequency directional swell & cross-ripples
      float t = uTime * uWaveSpeed;
      float wave1 = sin(pos.x * 0.14 + pos.z * 0.09 + t * 1.6) * uWaveHeight;
      float wave2 = cos(pos.x * 0.22 - pos.z * 0.18 + t * 2.2) * (uWaveHeight * 0.55);
      float wave3 = sin(pos.x * 0.38 + pos.z * 0.31 + t * 3.1) * (uWaveHeight * 0.25);
      pos.y += wave1 + wave2 + wave3;

      // Compute analytical normal from wave gradients
      float dx = 0.14 * cos(pos.x * 0.14 + pos.z * 0.09 + t * 1.6) * uWaveHeight
               - 0.22 * sin(pos.x * 0.22 - pos.z * 0.18 + t * 2.2) * (uWaveHeight * 0.55);
      float dz = 0.09 * cos(pos.x * 0.14 + pos.z * 0.09 + t * 1.6) * uWaveHeight
               + 0.18 * sin(pos.x * 0.22 - pos.z * 0.18 + t * 2.2) * (uWaveHeight * 0.55);
      vec3 waveNormal = normalize(vec3(-dx, 1.0, -dz));

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
      vNormal = normalize(mat3(modelMatrix) * waveNormal);
      vViewPosition = - (modelViewMatrix * vec4(pos, 1.0)).xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uSunDirection;
    uniform vec3 uShallowColor;
    uniform vec3 uDeepColor;
    uniform vec3 uFoamColor;
    uniform sampler2D uWaterBump;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;

    void main() {
      vec3 viewDir = normalize(vViewPosition);

      // Dual scrolling ripple texture coordinates
      vec2 flow1 = vUv * 32.0 + vec2(uTime * 0.035, uTime * 0.018);
      vec2 flow2 = vUv * 48.0 - vec2(uTime * 0.022, uTime * 0.042);
      vec4 bump1 = texture2D(uWaterBump, flow1);
      vec4 bump2 = texture2D(uWaterBump, flow2);
      vec3 rippleNormal = normalize(vNormal + vec3((bump1.r - 0.5) * 0.25 + (bump2.r - 0.5) * 0.18, 0.0, (bump1.g - 0.5) * 0.25 + (bump2.g - 0.5) * 0.18));

      // Fresnel reflectance
      float NdotV = max(dot(rippleNormal, viewDir), 0.0);
      float fresnel = pow(1.0 - NdotV, 3.5);

      // Specular sun reflection glint
      vec3 lightDir = normalize(uSunDirection);
      vec3 halfVec = normalize(lightDir + viewDir);
      float NdotH = max(dot(rippleNormal, halfVec), 0.0);
      float spec = pow(NdotH, 96.0) * 1.4;

      // Animated surface foam ripples along wave crests
      float crest = clamp((bump1.r + bump2.r - 1.25) * 3.5, 0.0, 1.0);
      float foamWave = sin(vWorldPosition.x * 0.35 + vWorldPosition.z * 0.28 + uTime * 1.8);
      float foamLine = smoothstep(0.72, 0.98, foamWave) * 0.45;

      // Color blending from deep water to sunlit shallow water
      vec3 waterCol = mix(uDeepColor, uShallowColor, clamp(fresnel * 1.2 + 0.3, 0.0, 1.0));
      waterCol = mix(waterCol, uFoamColor, clamp(crest + foamLine, 0.0, 0.85));
      waterCol += vec3(1.0, 0.96, 0.84) * spec;

      gl_FragColor = vec4(waterCol, 0.90 + fresnel * 0.08);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
