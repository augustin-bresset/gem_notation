// Gemstone Notation - how light meets a stone, computed on the GPU.
//
// Transparent stones (create): for each pixel the view ray refracts into
// the stone and bounces between its facets - where the angle allows,
// part of the light leaves through the facet (Fresnel), otherwise it is
// totally reflected - and is absorbed along the way (Beer-Lambert), so
// the colour deepens where light travels far. Stones with fire are
// traced once per colour channel, each with its own refractive index.
//
// Opaque and translucent stones (createSurface): a procedural texture
// in the stone's own space (mottling, veins, flecks, rings, stripes,
// clouds), lit by the same studio, polished or waxy; a translucent
// stone lets light through where it is thin - the glow of jade at its
// edges - and optical phenomena play on top: cat's eye, star,
// adularescence, play of colour, labradorescence, glitter.
//
// The facets are found with three-mesh-bvh; needs window.THREE (with
// MeshBVH) and WebGL2.
(function (root) {
  'use strict';

  const VERTEX = `
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

  const bvhHead = (glsl) => `
precision highp isampler2D;
precision highp usampler2D;
${glsl.common_functions}
${glsl.bvh_struct_definitions}
${glsl.bvh_ray_functions}
uniform BVH bvh;
uniform sampler2D normalTex;`;

  const STUDIO = `
uniform samplerCube envMap;
varying vec3 vPos;
varying vec3 vNormal;

// the studio around the stone, its ceiling up (+z) in the stone's world;
// lod 0 is sharp, higher levels blur it into soft light
vec3 studio(vec3 d, float lod) {
  return textureLod(envMap, vec3(d.x, d.z, -d.y), lod).rgb;
}

// Schlick; cosTheta measured in the thinner medium
float fresnel(float cosTheta, float n) {
  float r0 = (n - 1.0) / (n + 1.0);
  r0 *= r0;
  return r0 + (1.0 - r0) * pow(1.0 - clamp(cosTheta, 0.0, 1.0), 5.0);
}`;

  const TRANSPARENT = `
uniform vec3 sigma;       // absorption per unit length, per channel
uniform vec3 iors;        // refractive index for red, green, blue
uniform float haze;
uniform vec3 hazeColor;

// light gathered by a ray travelling inside the stone
vec3 inside(vec3 origin, vec3 dir, float n) {
  vec3 carried = vec3(1.0);
  vec3 light = vec3(0.0);
  for (int i = 0; i < BOUNCES; i++) {
    uvec4 faceIndices = uvec4(0u);
    vec3 faceNormal = vec3(0.0);
    vec3 bary = vec3(0.0);
    float side = 1.0;
    float dist = 0.0;
    if (!bvhIntersectFirstHit(bvh, origin, dir, faceIndices, faceNormal, bary, side, dist)) {
      return light + carried * studio(dir, 0.0);
    }
    carried *= exp(-sigma * dist);
    vec3 hit = origin + dir * dist;
    vec3 nrm = normalize(textureSampleBarycoord(normalTex, bary, faceIndices.xyz).xyz);
    if (dot(nrm, dir) < 0.0) nrm = -nrm;
    vec3 leaving = refract(dir, -nrm, n);
    if (dot(leaving, leaving) > 0.0) {
      float f = fresnel(dot(leaving, nrm), n);
      light += carried * (1.0 - f) * studio(leaving, 0.0);
      carried *= f;
    }
    dir = reflect(dir, -nrm);
    origin = hit - nrm * 1e-4;
  }
  return light + carried * studio(dir, 0.0);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 view = normalize(vPos - cameraPosition);
  if (dot(n, view) > 0.0) n = -n;
  vec3 origin = vPos - n * 1e-4;
#ifdef DISPERSION
  vec3 through = vec3(
    inside(origin, refract(view, n, 1.0 / iors.r), iors.r).r,
    inside(origin, refract(view, n, 1.0 / iors.g), iors.g).g,
    inside(origin, refract(view, n, 1.0 / iors.b), iors.b).b);
#else
  vec3 through = inside(origin, refract(view, n, 1.0 / iors.g), iors.g);
#endif
  float f = fresnel(dot(-view, n), iors.g);
  vec3 color = f * studio(reflect(view, n), 0.0) + (1.0 - f) * through;
  color = mix(color, hazeColor, haze);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  const NOISE = `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
        mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
        mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * vnoise(p);
    p = p * 2.03 + 17.1;
    amp *= 0.5;
  }
  return sum / 0.97;
}
// distance to the nearest random point, and that point's cell
vec4 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float best = 8.0;
  vec3 cell = vec3(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 r = g + hash33(i + g) - f;
        float d = dot(r, r);
        if (d < best) { best = d; cell = i + g; }
      }
    }
  }
  return vec4(sqrt(best), cell);
}
vec3 spectrum(float h) {
  return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
}`;

  const SURFACE = `
uniform vec3 albedo;
uniform vec3 second;
uniform vec3 third;
uniform vec3 glint;
uniform vec3 seed;
uniform float scale;
uniform float bands;
uniform float amount;
uniform float roughness;
uniform float translucency;
uniform vec3 sigma;
uniform float density;
uniform float ior;
float fleck = 0.0;

vec3 pattern(vec3 p) {
  vec3 q = p * scale + seed;
  vec3 c = albedo * (0.94 + 0.12 * fbm(q * 2.3));   // no stone is flat colour
#if defined(TEXTURE_MOTTLED)
  c = mix(c, second, smoothstep(0.35, 0.8, fbm(q)) * amount);
  c = mix(c, third, smoothstep(0.62, 0.85, fbm(q * 0.6 + 7.0)) * 0.55);
#elif defined(TEXTURE_VEINED)
  float ridge = 1.0 - abs(fbm(q) * 2.0 - 1.0);
  c = mix(c, second, smoothstep(0.86, 0.97, ridge) * amount);
#elif defined(TEXTURE_FLECKED)
  vec4 w = worley(q * 3.0);
  fleck = (1.0 - smoothstep(0.08, 0.16, w.x)) * step(hash13(w.yzw), amount);
  c = mix(c, third, smoothstep(0.6, 0.8, fbm(q * 0.8 + 3.0)) * 0.6);
  c = mix(c, second, fleck);
#elif defined(TEXTURE_RINGS)
  vec3 warped = p + (vec3(fbm(q * 0.7), fbm(q * 0.7 + 5.0), 0.0) - 0.5) * 0.35;
  float band = 0.5 + 0.5 * sin(length(warped.xy) * bands + fbm(q) * 3.0);
  c = mix(c, second, smoothstep(0.35, 0.65, band) * amount);
#elif defined(TEXTURE_STRIPES)
  float stripe = 0.5 + 0.5 * sin((q.y + (fbm(q * vec3(0.3, 1.0, 1.0)) - 0.5) * 1.2) * 6.2832);
  c = mix(c, second, smoothstep(0.3, 0.7, stripe) * amount);
#elif defined(TEXTURE_CLOUDY)
  c = mix(c, third, smoothstep(0.45, 0.8, fbm(q * 0.8)) * amount);
#endif
  return c;
}

// Parallel fibres or needles reflect the ceiling light as a line: at
// the light's reflection, and on across the stone at right angles to
// them (anisotropic highlight: the fibre projected on the surface, lit
// where it is perpendicular to the half vector).
float silk(vec3 fibre, vec3 n, vec3 hl, float width) {
  vec3 t = normalize(fibre - n * dot(n, fibre));
  float across = dot(t, hl) * width;
  return exp(-across * across);
}

// light the stone throws back by its structure, on top of its colour
vec3 phenomenon(vec3 p, vec3 n, vec3 v) {
  vec3 h = normalize(n + v);
  vec3 hl = normalize(vec3(0.0, 0.0, 1.0) + v);   // ceiling light seen from the eye
  float near = 0.35 + 0.65 * max(dot(n, hl), 0.0);
#if defined(PHENOMENON_CHATOYANT)
  // fibres across the stone: one silky band that follows the eye
  return glint * silk(vec3(0.0, 1.0, 0.0), n, hl, 9.0) * near;
#elif defined(PHENOMENON_STAR)
  // three sets of needles at 60 degrees: a six-rayed star
  float s = 0.0;
  for (int k = 0; k < 3; k++) {
    float a = float(k) * 1.0472;
    s += silk(vec3(cos(a), sin(a), 0.0), n, hl, 14.0);
  }
  return glint * s * 0.85 * near * smoothstep(0.0, 0.3, dot(n, v));
#elif defined(PHENOMENON_ADULARESCENT)
  // a blue glow floating under the surface
  return glint * pow(max(dot(n, normalize(v + vec3(0.0, 0.0, 0.8))), 0.0), 9.0) * 0.75;
#elif defined(PHENOMENON_PLAY)
  // a mosaic of spectral flashes, each grain lit at its own angle
  vec3 q = p * scale * 4.0 + seed + (vec3(fbm(p * 3.0), fbm(p * 3.0 + 9.0), 0.0) - 0.5) * 1.5;
  vec4 w = worley(q);
  vec3 grain = normalize(hash33(w.yzw) * 2.0 - 1.0 + vec3(0.0, 0.0, 1.5));
  float flash = pow(max(dot(grain, h), 0.0), 12.0);
  float hue = fract(hash13(w.yzw) + dot(n, v) * 0.8);
  float cluster = smoothstep(0.35, 0.65, fbm(p * scale + seed));
  return spectrum(hue) * flash * cluster * 0.9;
#elif defined(PHENOMENON_LABRADORESCENT)
  // a blue-green flash across patches, at one angle
  float patchy = smoothstep(0.45, 0.72, fbm(p * scale + seed + 11.0));
  float flash = pow(max(dot(n, normalize(v + vec3(0.25, 0.15, 0.9))), 0.0), 5.0);
  vec3 tint = mix(glint, vec3(0.25, 0.85, 0.7), fbm(p * scale * 0.5 + 4.0));
  return tint * patchy * flash * 1.3;
#elif defined(PHENOMENON_AVENTURESCENT)
  // tiny mirrors - mica, pyrite, copper - glinting one by one
  vec4 w = worley(p * 18.0 + seed);
  float spot = (1.0 - smoothstep(0.06, 0.16, w.x)) * step(hash13(w.yzw), 0.4);
  vec3 facet = normalize(hash33(w.yzw) * 2.0 - 1.0 + vec3(0.0, 0.0, 1.2));
  float sparkle = pow(max(dot(facet, hl), 0.0), 30.0);
  return glint * (spot * sparkle * 5.0 + fleck * sparkle * 3.0);
#else
  return vec3(0.0);
#endif
}

#ifdef TRANSLUCENT
float exitDistance(vec3 origin, vec3 dir) {
  uvec4 faceIndices = uvec4(0u);
  vec3 faceNormal = vec3(0.0);
  vec3 bary = vec3(0.0);
  float side = 1.0;
  float dist = 0.0;
  return bvhIntersectFirstHit(bvh, origin, dir, faceIndices, faceNormal, bary, side, dist)
    ? dist : 0.0;
}
#endif

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vPos);
  if (dot(n, v) < 0.0) n = -n;
  vec3 base = pattern(vPos);
  float f = fresnel(max(dot(n, v), 0.0), 1.55);
  vec3 light = studio(n, 5.5);                  // soft light on the surface
  vec3 body = base * light;
#ifdef TRANSLUCENT
  // thin parts let the studio through, thick parts glow milky
  vec3 dir = refract(-v, n, 1.0 / ior);
  float len = exitDistance(vPos - n * 1e-4, dir);
  vec3 through = studio(dir, 2.0) * base * exp(-(sigma + density) * len);
  vec3 glow = base * mix(light, studio(dir, 5.0), 0.5) * (1.0 - exp(-density * len));
  body = mix(body, through + glow, translucency);
#endif
  vec3 shine = studio(reflect(-v, n), mix(roughness, 0.02, fleck) * 7.0);
  vec3 color = body * (1.0 - f) + shine * f + phenomenon(vPos, n, v);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  const linear = (THREE, hex) => new THREE.Color(hex);

  // Absorption per unit length that turns white light into `color` over
  // `path`.
  function absorption(THREE, color, path) {
    return new THREE.Vector3(...[color.r, color.g, color.b]
      .map((c) => -Math.log(Math.max(c, 0.01)) / path));
  }

  // BVH and normal texture of a geometry, as shader uniforms.
  function traceUniforms(THREE, geometry, material) {
    const bvh = new THREE.MeshBVHUniformStruct();
    bvh.updateFrom(new THREE.MeshBVH(geometry));
    const normals = new THREE.FloatVertexAttributeTexture();
    normals.updateFrom(geometry.attributes.normal);
    material.addEventListener('dispose', () => {
      bvh.dispose();
      normals.dispose();
    });
    return { bvh: { value: bvh }, normalTex: { value: normals } };
  }

  const common = {
    vertexShader: VERTEX,
    // push the faces back a hair so the edge lines win the depth test
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  };

  // A transparent GemStoneLook on a stone mesh -> ShaderMaterial, or null
  // when it does not apply. options: envMap (a mipmapped cube render
  // target texture, y up), depth (the stone's height), bounces.
  function create(THREE, geometry, look, options) {
    if (!THREE || !THREE.MeshBVH || !look || look.family !== 'transparent') return null;
    // the look's colour is what white light turns into over a typical
    // path in a cut stone: down to the pavilion, a bounce or two, back up
    // - about 2.2 times the stone's depth
    const color = linear(THREE, look.color);
    const fire = look.fire || 0;
    const material = new THREE.ShaderMaterial(Object.assign({}, common, {
      defines: Object.assign({ BOUNCES: options.bounces || 6 },
                             fire >= 0.03 ? { DISPERSION: '' } : {}),
      fragmentShader: bvhHead(THREE.BVHShaderGLSL) + STUDIO + TRANSPARENT,
    }));
    material.uniforms = Object.assign(traceUniforms(THREE, geometry, material), {
      envMap: { value: options.envMap },
      sigma: { value: absorption(THREE, color, options.depth * 2.2) },
      iors: { value: new THREE.Vector3(look.ior - fire * 0.35, look.ior, look.ior + fire * 0.45) },
      haze: { value: (look.haze || 0) * 0.8 },
      hazeColor: { value: color.clone().multiplyScalar(0.75) },
    });
    return material;
  }

  // An opaque or translucent GemStoneLook -> ShaderMaterial, or null.
  function createSurface(THREE, geometry, look, options) {
    if (!THREE || !look || !['opaque', 'translucent'].includes(look.family)) return null;
    const texture = look.texture || {};
    const translucent = look.family === 'translucent' && look.translucency > 0
      && Boolean(THREE.MeshBVH);
    const defines = {};
    if (texture.kind) defines[`TEXTURE_${texture.kind.toUpperCase()}`] = '';
    if (look.phenomenon) defines[`PHENOMENON_${look.phenomenon.toUpperCase()}`] = '';
    if (translucent) defines.TRANSLUCENT = '';
    const material = new THREE.ShaderMaterial(Object.assign({}, common, {
      defines,
      fragmentShader: (translucent ? bvhHead(THREE.BVHShaderGLSL) : '')
        + STUDIO + NOISE + SURFACE,
    }));
    const color = linear(THREE, look.color);
    material.uniforms = Object.assign(translucent ? traceUniforms(THREE, geometry, material) : {}, {
      envMap: { value: options.envMap },
      albedo: { value: color },
      second: { value: linear(THREE, texture.second || look.color) },
      third: { value: linear(THREE, texture.third || '#f4f4f0') },
      glint: { value: linear(THREE, look.glint || '#ffffff') },
      seed: { value: new THREE.Vector3(...(look.seed || [0, 0, 0])) },
      scale: { value: texture.scale || 3 },
      bands: { value: texture.bands || 30 },
      amount: { value: texture.amount === undefined ? 0.5 : texture.amount },
      roughness: { value: look.roughness === undefined ? (translucent ? 0.28 : 0.12)
                                                       : look.roughness },
      translucency: { value: translucent ? look.translucency : 0 },
      sigma: { value: absorption(THREE, color, options.depth * 2) },
      density: { value: 4 },
      ior: { value: look.ior || 1.55 },
    });
    return material;
  }

  root.GemOptics = { create, createSurface };
})(this);
