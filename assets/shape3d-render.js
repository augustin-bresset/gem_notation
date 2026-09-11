// Gemstone Notation - 3D viewer for the generated stones, on three.js
// (vendored as assets/vendor/three.js, window.THREE). Physically based
// shading lit by a studio environment, a soft contact shadow, facet
// edges as lines, orbit controls - drag to turn, right-drag to pan,
// wheel or pinch to zoom, double-click to reset - and STL / GLB export at
// a real size. Z is up: the table faces the sky. Without a look the
// material is a neutral polished one, for studying the shape; with one
// (GemStoneLook) the stone takes its colour and family of material.
(function (root) {
  'use strict';
  const THREE = root.THREE;

  const VIEWS = {
    three: { yaw: -1.15, pitch: 0.5 },
    top: { yaw: -Math.PI / 2, pitch: Math.PI / 2 - 1e-4 },
    side: { yaw: -Math.PI / 2, pitch: 0 },
    front: { yaw: 0, pitch: 0 },
    bottom: { yaw: -Math.PI / 2, pitch: -Math.PI / 2 + 1e-4 },
  };
  const direction = ({ yaw, pitch }) => new THREE.Vector3(
    Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch));

  // The backdrop is painted in the scene, not in CSS: a transparent
  // stone refracts what is behind it.
  function backdrop() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const g = canvas.getContext('2d');
    const glow = g.createRadialGradient(128, 97, 0, 128, 97, 190);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.68, '#ecece8');
    glow.addColorStop(1, '#dcdcd7');
    g.fillStyle = glow;
    g.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // A GemStoneLook (or null for the neutral shape study) -> material.
  // Transparent stones transmit and refract, absorbing their colour
  // with depth; the rest are polished opaque, milky, pearly or metal.
  function materialFor(look, depth) {
    const common = {
      // push the faces back a hair so the edge lines win the depth test
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    };
    if (!look) {
      // reflective enough that each facet catches the studio differently
      return new THREE.MeshPhysicalMaterial(Object.assign(common, {
        color: 0xa9b1bd, roughness: 0.12, metalness: 0.35,
        clearcoat: 1, clearcoatRoughness: 0.05 }));
    }
    const color = new THREE.Color(look.color);
    const pale = new THREE.Color(0xffffff).lerp(color, 0.35);
    const haze = look.haze || 0;
    const shimmer = look.iridescent
      ? { iridescence: 0.6, iridescenceIOR: 1.3, iridescenceThicknessRange: [250, 650] } : {};
    const settings = {
      // white light through the stone's depth comes out about its colour
      transparent: {
        color: new THREE.Color(0xffffff).lerp(color, 0.15),
        roughness: 0.02 + haze * 0.35, metalness: 0,
        transmission: 1 - haze * 0.5, ior: look.ior, thickness: depth,
        attenuationColor: color, attenuationDistance: depth * 1.1,
        dispersion: Math.min(1, look.fire * 12), specularIntensity: 1,
      },
      translucent: {
        color: pale, roughness: 0.3 + haze * 0.3, metalness: 0,
        transmission: 0.6 - haze * 0.4, ior: look.ior, thickness: depth,
        attenuationColor: color, attenuationDistance: depth * 0.6,
        clearcoat: 0.6, clearcoatRoughness: 0.1,
      },
      opaque: { color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 },
      pearl: {
        color, roughness: 0.28, sheen: 1, sheenRoughness: 0.35,
        sheenColor: new THREE.Color(0xffffff).lerp(color, 0.5),
        clearcoat: 0.5, clearcoatRoughness: 0.2,
      },
      metal: { color, metalness: 1, roughness: 0.16 },
    }[look.family];
    return new THREE.MeshPhysicalMaterial(Object.assign(common, settings, shimmer));
  }

  // canvas -> viewer, or null when three.js or WebGL is unavailable.
  // options.compact: a preview inside a page - it turns by itself and
  // leaves the wheel to the page (no zoom, no pan).
  // options.precompile (default true): build a new stone's shader in the
  // background and keep showing the previous one meanwhile, instead of
  // freezing the page; false applies it at once (still pictures, tests).
  function create(canvas, options) {
    if (!THREE) return null;
    const compact = Boolean(options && options.compact);
    const precompile = !(options && options.precompile === false);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true,
                                           preserveDrawingBuffer: true });
    } catch (e) {
      return null;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    // neutral tone mapping keeps a stone's hue where ACES would shift it
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = backdrop();
    const room = new THREE.RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    // the same studio as a cube map, sharp at level 0 and blurred down its
    // mipmaps: what the stone shaders (GemOptics) see and are lit by
    const studio = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter });
    new THREE.CubeCamera(0.05, 50, studio).update(renderer, room);
    let optics = true;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    camera.up.set(0, 0, 1);  // before the controls: they orbit around it
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.autoRotateSpeed = 3;
    if (compact) {
      Object.assign(controls, { enableZoom: false, enablePan: false,
                                autoRotate: true, autoRotateSpeed: 2 });
    }

    const stone = new THREE.Mesh(new THREE.BufferGeometry(), materialFor(null, 1));
    stone.castShadow = true;
    let look = null;
    let depth = 1;
    const edges = new THREE.LineSegments(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x141418, transparent: true, opacity: 0.45 }));

    // a key light for the shadow, caught by an invisible floor
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.receiveShadow = true;
    scene.add(stone, edges, key, key.target, floor);

    let radius = 0;
    let firstView = VIEWS.three;  // a view asked for before any mesh
    // the bounding sphere is generous for a flat stone: a preview frames tighter
    const fitDistance = (r) => (r / Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2))
      * (compact ? 0.72 : 1.02);

    function setMesh(data) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      // the old geometry goes once no material drawn on it is shown
      stone.geometry = geometry;
      const lines = new THREE.BufferGeometry();
      lines.setAttribute('position', new THREE.BufferAttribute(data.edges, 3));
      edges.geometry.dispose();
      edges.geometry = lines;

      const { min, max } = data.bounds;
      const center = new THREE.Vector3(...min.map((x, k) => (x + max[k]) / 2));
      const r = Math.max(1e-3, Math.hypot(...max.map((x, k) => x - min[k])) / 2);
      // keep the viewing direction and the zoom, relative to the new size
      const offset = camera.position.clone().sub(controls.target);
      const zoom = radius ? offset.length() / fitDistance(radius) : 1;
      if (!radius) offset.copy(direction(firstView));
      offset.setLength(zoom * fitDistance(r));
      controls.target.copy(center);
      camera.position.copy(center).add(offset);
      radius = r;
      camera.near = r / 50;
      camera.far = fitDistance(r) * 6;
      camera.updateProjectionMatrix();
      controls.minDistance = fitDistance(r) * 0.3;
      controls.maxDistance = fitDistance(r) * 4;

      key.position.copy(center).add(new THREE.Vector3(-0.5, -0.7, 3).multiplyScalar(r));
      key.target.position.copy(center);
      const box = key.shadow.camera;
      Object.assign(box, { left: -2 * r, right: 2 * r, top: 2 * r, bottom: -2 * r,
                           near: r * 0.1, far: r * 8 });
      box.updateProjectionMatrix();
      key.shadow.normalBias = r * 0.02;  // no self-shadow acne on the curves
      floor.position.set(center.x, center.y, min[2] - r * 0.002);
      floor.scale.setScalar(r * 8);
      depth = Math.max(0.05, max[2] - min[2]);
      smoothShape = (data.stats && data.stats.smooth) > 0.5;
      return applyLook();
    }

    let lookToken = 0;
    let shownGeometry = null;   // the geometry the shown material was built for
    // In a curved stone light trapped by total reflection keeps running
    // along the wall, adding nothing new: fewer bounces there; a faceted
    // stone keeps them all - its brilliance is made of them.
    let smoothShape = false;
    const bounces = () => (smoothShape ? (compact ? 3 : 4) : (compact ? 4 : 7));

    // Build the stone's material and put it on - once compiled, when
    // precompiling. Returns a promise settled when it is shown.
    function applyLook() {
      const token = ++lookToken;
      const built = stone.geometry;
      // light traced inside a transparent stone, texture and phenomena on
      // an opaque or translucent one - else the physically based
      // approximation (pearls, metals, "light rays" off)
      let special = null;
      if (optics && root.GemOptics && radius && look) {
        const settings = { envMap: studio.texture, depth, bounces: bounces() };
        special = look.family === 'transparent'
          ? root.GemOptics.create(THREE, built, look, settings)
          : root.GemOptics.createSurface(THREE, built, look, settings);
      }
      const next = special || materialFor(look, depth);
      const put = () => {
        if (token !== lookToken) {
          // overtaken by a newer look or mesh: drop what was built
          next.dispose();
          if (built !== stone.geometry && built !== shownGeometry) built.dispose();
          return;
        }
        const old = stone.material;
        stone.material = next;
        old.dispose();
        if (shownGeometry && shownGeometry !== built) shownGeometry.dispose();
        shownGeometry = built;
        // colour carries the facets: lighter lines; glass casts a lighter shadow
        edges.material.opacity = look ? 0.22 : 0.45;
        floor.material.opacity = look && look.family === 'transparent' ? 0.08 : 0.16;
        request();
      };
      if (!precompile) {
        put();
        return Promise.resolve();
      }
      return renderer.compileAsync(new THREE.Mesh(built, next), camera, scene).then(put, put);
    }

    function view(name) {
      if (!radius) { firstView = VIEWS[name] || VIEWS.three; return; }
      camera.position.copy(controls.target)
        .add(direction(VIEWS[name] || VIEWS.three).multiplyScalar(fitDistance(radius)));
      controls.update();
      request();
    }

    // always at full resolution: a stone turned by hand stays sharp
    function draw() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const size = renderer.getSize(new THREE.Vector2());
      if (size.x !== w || size.y !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    }

    // a still picture, at once
    function render() {
      controls.update(0);
      draw();
    }

    let frame = 0;
    let lastTick = 0;
    let onScreen = true;
    let interacting = false;     // a drag or a zoom in progress

    function tick(time) {
      frame = 0;
      if (!interacting && controls.autoRotate && !onScreen) {
        lastTick = 0;            // scrolled away: stop turning for nobody
        return;
      }
      const spinning = controls.autoRotate && !interacting;
      if (spinning && lastTick && time - lastTick < 1000 / 30 - 4) {
        request();               // turning by itself, 30 frames a second are plenty
        return;
      }
      const dt = lastTick ? Math.min(0.1, (time - lastTick) / 1000) : 0;
      lastTick = time;
      const moving = controls.update(dt);
      draw();
      if (moving || interacting || spinning) request();
      else lastTick = 0;
    }
    function request() { if (!frame) frame = requestAnimationFrame(tick); }
    controls.addEventListener('change', request);
    controls.addEventListener('start', () => { interacting = true; request(); });
    controls.addEventListener('end', () => { interacting = false; request(); });
    canvas.addEventListener('dblclick', () => view('three'));
    if (window.ResizeObserver) new ResizeObserver(request).observe(canvas);
    if (window.IntersectionObserver) {
      new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        request();
      }).observe(canvas);
    }

    // The stone at `widthMm` millimetres wide (the model's width is 1):
    // STL in millimetres, Z up; GLB in metres, Y up as glTF wants.
    function exportModel(format, widthMm) {
      const mesh = new THREE.Mesh(stone.geometry,
        new THREE.MeshStandardMaterial({ color: 0xcfd5dd, roughness: 0.2 }));
      if (format === 'stl') {
        mesh.scale.setScalar(widthMm);
        mesh.updateMatrixWorld(true);
        const data = new THREE.STLExporter().parse(mesh, { binary: true });
        return Promise.resolve(new Blob([data], { type: 'model/stl' }));
      }
      mesh.scale.setScalar(widthMm / 1000);
      const holder = new THREE.Group();
      holder.rotation.x = -Math.PI / 2;
      holder.add(mesh);
      return new Promise((resolve, reject) => new THREE.GLTFExporter().parse(holder,
        (buffer) => resolve(new Blob([buffer], { type: 'model/gltf-binary' })),
        reject, { binary: true }));
    }

    return {
      setMesh,
      setLook: (value) => { look = value || null; return applyLook(); },
      setOptics: (on) => { optics = Boolean(on); return applyLook(); },
      view,
      render,
      exportModel,
      setEdges: (on) => { edges.visible = Boolean(on); request(); },
      setAutoRotate: (on) => { controls.autoRotate = Boolean(on); request(); },
    };
  }

  root.GemRender3D = { create, VIEWS };
})(this);
