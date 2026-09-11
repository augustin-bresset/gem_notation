// Gemstone Notation - light inside a transparent stone, ray traced on
// the GPU. For each pixel the view ray refracts into the stone and
// bounces between its facets: where the angle allows, part of the light
// leaves through the facet (Fresnel), otherwise it is totally reflected.
// Along the way it is absorbed (Beer-Lambert), so the colour deepens
// where light travels far - the dark edges and saturated centre of a
// real cut stone. Stones with fire are traced once per colour channel,
// each with its own refractive index. The facets are found with
// three-mesh-bvh; needs window.THREE with MeshBVH, and WebGL2.
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

  const fragment = (glsl) => `
precision highp isampler2D;
precision highp usampler2D;
${glsl.common_functions}
${glsl.bvh_struct_definitions}
${glsl.bvh_ray_functions}

uniform BVH bvh;
uniform sampler2D normalTex;
uniform samplerCube envMap;
uniform vec3 sigma;       // absorption per unit length, per channel
uniform vec3 iors;        // refractive index for red, green, blue
uniform float haze;
uniform vec3 hazeColor;
varying vec3 vPos;
varying vec3 vNormal;

// the studio around the stone, its ceiling up (+z) in the stone's world
vec3 studio(vec3 d) {
  return textureCube(envMap, vec3(d.x, d.z, -d.y)).rgb;
}

// Schlick; cosTheta measured in the thinner medium
float fresnel(float cosTheta, float n) {
  float r0 = (n - 1.0) / (n + 1.0);
  r0 *= r0;
  return r0 + (1.0 - r0) * pow(1.0 - clamp(cosTheta, 0.0, 1.0), 5.0);
}

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
      return light + carried * studio(dir);
    }
    carried *= exp(-sigma * dist);
    vec3 hit = origin + dir * dist;
    vec3 nrm = normalize(textureSampleBarycoord(normalTex, bary, faceIndices.xyz).xyz);
    if (dot(nrm, dir) < 0.0) nrm = -nrm;
    vec3 leaving = refract(dir, -nrm, n);
    if (dot(leaving, leaving) > 0.0) {
      float f = fresnel(dot(leaving, nrm), n);
      light += carried * (1.0 - f) * studio(leaving);
      carried *= f;
    }
    dir = reflect(dir, -nrm);
    origin = hit - nrm * 1e-4;
  }
  return light + carried * studio(dir);
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
  vec3 color = f * studio(reflect(view, n)) + (1.0 - f) * through;
  color = mix(color, hazeColor, haze);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  // A transparent GemStoneLook on a stone mesh -> ShaderMaterial, or null
  // when it does not apply. options: envMap (a cube render target
  // texture, y up), depth (the stone's height), bounces.
  function create(THREE, geometry, look, options) {
    if (!THREE || !THREE.MeshBVH || !look || look.family !== 'transparent') return null;
    const bvh = new THREE.MeshBVHUniformStruct();
    bvh.updateFrom(new THREE.MeshBVH(geometry));
    const normals = new THREE.FloatVertexAttributeTexture();
    normals.updateFrom(geometry.attributes.normal);
    // the look's colour is what white light turns into over a typical
    // path in a cut stone: down to the pavilion, a bounce or two, back up
    // - about 2.2 times the stone's depth
    const color = new THREE.Color(look.color);
    const path = options.depth * 2.2;
    const sigma = new THREE.Vector3(...[color.r, color.g, color.b]
      .map((c) => -Math.log(Math.max(c, 0.01)) / path));
    const fire = look.fire || 0;
    const material = new THREE.ShaderMaterial({
      defines: Object.assign({ BOUNCES: options.bounces || 6 },
                             fire >= 0.03 ? { DISPERSION: '' } : {}),
      uniforms: {
        bvh: { value: bvh },
        normalTex: { value: normals },
        envMap: { value: options.envMap },
        sigma: { value: sigma },
        iors: { value: new THREE.Vector3(look.ior - fire * 0.35, look.ior,
                                         look.ior + fire * 0.45) },
        haze: { value: (look.haze || 0) * 0.8 },
        hazeColor: { value: color.clone().multiplyScalar(0.75) },
      },
      vertexShader: VERTEX,
      fragmentShader: fragment(THREE.BVHShaderGLSL),
      // push the faces back a hair so the edge lines win the depth test
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    material.addEventListener('dispose', () => {
      bvh.dispose();
      normals.dispose();
    });
    return material;
  }

  root.GemOptics = { create };
})(this);
