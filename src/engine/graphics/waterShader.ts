import * as THREE from 'three';

export interface DynamicWaterUniforms {
  uTime: { value: number };
  uWaterLevel: { value: number };
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
  waterLevel = -0.55,
): THREE.ShaderMaterial {
  const uniforms: DynamicWaterUniforms = {
    uTime: { value: 0 },
    uWaterLevel: { value: waterLevel },
    uSunDirection: { value: new THREE.Vector3(0.55, 0.78, 0.3).normalize() },
    uShallowColor: { value: new THREE.Color(shallowHex) },
    uDeepColor: { value: new THREE.Color(deepHex) },
    uFoamColor: { value: new THREE.Color('#eefcf9') },
    uWaterBump: { value: waterBumpTexture },
    uWaveSpeed: { value: 0.88 },
    uWaveHeight: { value: 0.055 },
  };

  const vertexShader = `
    attribute float aTerrainY;

    uniform float uTime;
    uniform float uWaveSpeed;
    uniform float uWaveHeight;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    varying float vTerrainY;

    void main() {
      vUv = uv;
      vTerrainY = aTerrainY;
      vec3 pos = position;

      float t = uTime * uWaveSpeed;
      float wave1 = sin(pos.x * 0.16 + pos.z * 0.11 + t * 1.65) * uWaveHeight;
      float wave2 = cos(pos.x * 0.24 - pos.z * 0.19 + t * 2.25) * (uWaveHeight * 0.5);
      float wave3 = sin(pos.x * 0.42 + pos.z * 0.33 + t * 3.1) * (uWaveHeight * 0.24);
      pos.y += wave1 + wave2 + wave3;

      float dx = 0.16 * cos(pos.x * 0.16 + pos.z * 0.11 + t * 1.65) * uWaveHeight
               - 0.24 * sin(pos.x * 0.24 - pos.z * 0.19 + t * 2.25) * (uWaveHeight * 0.5);
      float dz = 0.11 * cos(pos.x * 0.16 + pos.z * 0.11 + t * 1.65) * uWaveHeight
               + 0.19 * sin(pos.x * 0.24 - pos.z * 0.19 + t * 2.25) * (uWaveHeight * 0.5);
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
    uniform float uWaterLevel;
    uniform vec3 uSunDirection;
    uniform vec3 uShallowColor;
    uniform vec3 uDeepColor;
    uniform vec3 uFoamColor;
    uniform sampler2D uWaterBump;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vViewPosition;
    varying float vTerrainY;

    void main() {
      vec3 viewDir = normalize(vViewPosition);

      // Compute true local water depth over sculpted riverbed
      float depth = max(0.0, uWaterLevel - vTerrainY);
      float shoreMask = 1.0 - smoothstep(0.0, 0.38, depth);
      float depthFactor = smoothstep(0.05, 1.45, depth);

      // Dual flowing river current texture coordinates
      vec2 flow1 = vUv * 34.0 + vec2(uTime * 0.045, uTime * 0.016);
      vec2 flow2 = vUv * 52.0 - vec2(uTime * 0.018, uTime * 0.036);
      vec4 bump1 = texture2D(uWaterBump, flow1);
      vec4 bump2 = texture2D(uWaterBump, flow2);
      vec3 rippleNormal = normalize(
        vNormal + vec3(
          (bump1.r - 0.5) * 0.30 + (bump2.r - 0.5) * 0.22,
          0.0,
          (bump1.g - 0.5) * 0.30 + (bump2.g - 0.5) * 0.22
        )
      );

      // Fresnel sky reflection
      float NdotV = max(dot(rippleNormal, viewDir), 0.0);
      float fresnel = pow(1.0 - NdotV, 3.2);

      // Specular sun glint
      vec3 lightDir = normalize(uSunDirection);
      vec3 halfVec = normalize(lightDir + viewDir);
      float NdotH = max(dot(rippleNormal, halfVec), 0.0);
      float spec = pow(NdotH, 108.0) * 1.45;

      // Shoreline lapping foam & mid-stream eddy highlights
      float lapWave = sin(depth * 26.0 - uTime * 2.6 + vWorldPosition.x * 0.65);
      float shoreFoam = shoreMask * smoothstep(0.25, 0.92, lapWave * 0.5 + 0.5) * 0.68;
      float crestFoam = clamp((bump1.r + bump2.r - 1.32) * 3.2, 0.0, 1.0) * 0.42;

      vec3 waterCol = mix(uShallowColor, uDeepColor, depthFactor);
      waterCol = mix(waterCol, uShallowColor * 1.18, clamp(fresnel * 0.7, 0.0, 1.0));
      waterCol = mix(waterCol, uFoamColor, clamp(shoreFoam + crestFoam, 0.0, 0.85));
      waterCol += vec3(1.0, 0.96, 0.84) * spec;

      // Translucent shallows revealing submerged pebbles & sand, deeper opaque river current
      float alpha = mix(0.42, 0.94, smoothstep(0.0, 0.9, depth)) + fresnel * 0.06;
      if (depth <= 0.002) {
        alpha = 0.0;
      }

      gl_FragColor = vec4(waterCol, clamp(alpha, 0.0, 0.96));
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
