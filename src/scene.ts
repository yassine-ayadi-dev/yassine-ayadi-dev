/**
 * 3D Developer Studio Scene using Three.js
 * Reproducing the aesthetic of Rao Muhammad Hamza / Bruno Simon with Yassine Ayadi's portfolio.
 * 100% Procedural meshes, materials, and textures - Zero external 404 dependencies.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SceneCallbacks {
  onSelectHotspot: (id: string) => void;
  onHoverHotspot?: (id: string | null) => void;
}

export class PortfolioScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private animationFrameId = 0;
  private clock = new THREE.Clock();
  private callbacks: SceneCallbacks;

  // Interactive hotspots
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hotspots: {
    mesh: THREE.Group;
    id: string;
    label: string;
    baseY: number;
  }[] = [];
  private hoveredHotspotId: string | null = null;

  // Animated elements
  private robotHead: THREE.Group | null = null;
  private robotLeftEarGear: THREE.Mesh | null = null;
  private robotRightEarGear: THREE.Mesh | null = null;
  private robotEyesCanvas: HTMLCanvasElement | null = null;
  private robotEyesTexture: THREE.CanvasTexture | null = null;
  private monitorScreenCanvas: HTMLCanvasElement | null = null;
  private monitorScreenTexture: THREE.CanvasTexture | null = null;
  private speakerRings: { mesh: THREE.Mesh; scale: number; speed: number }[] = [];
  private palmTreesGroup = new THREE.Group();

  // Camera animation interpolation
  private cameraTargetPos = new THREE.Vector3(0, 1.4, 4.6);
  private cameraTargetLook = new THREE.Vector3(0, 1.15, 0);
  private isAnimatingCamera = false;

  // State
  private currentMonitorText = 'PROJECTS';
  private blinkTimer = 0;
  private isSoftwareGl = false;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f0c1b);
    this.scene.fog = new THREE.FogExp2(0x0f0c1b, 0.045);

    // Camera
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 1.45, 4.6);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1.15, 0);
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.minDistance = 2.2;
    this.controls.maxDistance = 7.5;
    this.controls.minAzimuthAngle = -Math.PI / 3;
    this.controls.maxAzimuthAngle = Math.PI / 3;

    // Studio Environment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Build the 3D scene elements
    this.setupLighting();
    this.buildRoom();
    this.buildCityWindow();
    this.buildDeskWorkstation();
    this.buildRobot();
    this.buildPegboard();
    this.buildSpeaker();
    this.buildDiamondHotspots();

    // Event listeners
    this.bindEvents();

    // Start animation loop
    this.animate();
  }

  private setupLighting(): void {
    // Ambient / Hemisphere lighting (cool twilight sky, warm magenta/purple ground)
    const hemiLight = new THREE.HemisphereLight(0x6366f1, 0x1e1136, 0.9);
    this.scene.add(hemiLight);

    // Key directional light (warm sunset city glow through window)
    const dirLight = new THREE.DirectionalLight(0xf59e0b, 1.6);
    dirLight.position.set(-4, 5, -2);
    dirLight.castShadow = !this.isSoftwareGl;
    if (dirLight.shadow) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.bias = -0.0005;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 15;
      dirLight.shadow.camera.left = -4;
      dirLight.shadow.camera.right = 4;
      dirLight.shadow.camera.top = 4;
      dirLight.shadow.camera.bottom = -4;
    }
    this.scene.add(dirLight);

    // Rim light from camera side for crisp silhouette
    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.8);
    rimLight.position.set(3, 4, 3);
    this.scene.add(rimLight);

    // Warm pink point light from desk lamp
    const lampLight = new THREE.PointLight(0xf43f5e, 1.8, 4.5);
    lampLight.position.set(-1.4, 1.6, 0.2);
    this.scene.add(lampLight);

    // Neon pink back-glow behind monitor
    const monitorLight = new THREE.PointLight(0xec4899, 1.5, 3.2);
    monitorLight.position.set(-0.6, 1.3, -0.4);
    this.scene.add(monitorLight);

    // Soft white edge glow for pegboard
    const pegboardLight = new THREE.PointLight(0x38bdf8, 1.2, 3.5);
    pegboardLight.position.set(1.2, 1.7, -0.7);
    this.scene.add(pegboardLight);
  }

  private buildRoom(): void {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(12, 12);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x110e1c,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    // Back wall
    const wallGeo = new THREE.PlaneGeometry(12, 8);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x161226,
      roughness: 0.9,
      metalness: 0.05,
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 4, -1.8);
    backWall.receiveShadow = !this.isSoftwareGl;
    this.scene.add(backWall);

    // Right wall
    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(4, 4, 0);
    this.scene.add(rightWall);

    // Electromechanical Engineering Wall Art & Posters
    this.buildElectromechanicalWallArt();
  }

  private buildCityWindow(): void {
    const windowGroup = new THREE.Group();
    windowGroup.position.set(-0.8, 2.4, -1.75);

    // Window frame (outer)
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0a0814,
      roughness: 0.5,
      metalness: 0.8,
    });

    const outerFrameGeo = new THREE.BoxGeometry(3.6, 2.8, 0.08);
    const outerFrame = new THREE.Mesh(outerFrameGeo, frameMat);
    windowGroup.add(outerFrame);

    // Vertical & horizontal mullions
    const vMullionGeo = new THREE.BoxGeometry(0.06, 2.76, 0.09);
    for (let x = -1.1; x <= 1.1; x += 1.1) {
      const mullion = new THREE.Mesh(vMullionGeo, frameMat);
      mullion.position.set(x, 0, 0);
      windowGroup.add(mullion);
    }
    const hMullionGeo = new THREE.BoxGeometry(3.56, 0.06, 0.09);
    for (let y = -0.7; y <= 0.7; y += 0.7) {
      const mullion = new THREE.Mesh(hMullionGeo, frameMat);
      mullion.position.set(0, y, 0);
      windowGroup.add(mullion);
    }

    // Procedural Night City Skyline Canvas Texture
    const cityCanvas = document.createElement('canvas');
    cityCanvas.width = 1024;
    cityCanvas.height = 768;
    const ctx = cityCanvas.getContext('2d')!;

    // Sunset / twilight sky gradient (deep purple top, warm orange/amber horizon)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, cityCanvas.height);
    skyGrad.addColorStop(0, '#120b22');
    skyGrad.addColorStop(0.35, '#2e1045');
    skyGrad.addColorStop(0.7, '#6b2154');
    skyGrad.addColorStop(0.95, '#d97706');
    skyGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, cityCanvas.width, cityCanvas.height);

    // Distant skyscraper silhouettes with windows
    const buildingColors = ['#1a102a', '#24143a', '#170e28', '#2d1847'];
    const windowColors = ['#fef08a', '#fde047', '#fed7aa', '#cbd5e1'];

    // Back layer buildings
    for (let i = 0; i < 28; i++) {
      const bx = (i * 38) + (i % 3) * 5;
      const bw = 24 + ((i * 7) % 25);
      const bh = 220 + ((i * 37) % 280);
      const by = cityCanvas.height - bh;

      ctx.fillStyle = buildingColors[i % buildingColors.length];
      ctx.fillRect(bx, by, bw, bh);

      // Windows
      ctx.fillStyle = windowColors[i % windowColors.length];
      for (let wy = by + 12; wy < cityCanvas.height - 20; wy += 14) {
        for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
          if ((wx * wy + i) % 3 === 0) {
            ctx.globalAlpha = 0.75 + Math.sin(wx + wy) * 0.2;
            ctx.fillRect(wx, wy, 4, 7);
          }
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // Front high-rise buildings with warm window grids
    for (let i = 0; i < 16; i++) {
      const bx = i * 65 + 10;
      const bw = 48 + ((i * 13) % 25);
      const bh = 300 + ((i * 47) % 240);
      const by = cityCanvas.height - bh;

      ctx.fillStyle = '#140c24';
      ctx.fillRect(bx, by, bw, bh);

      // Golden illuminated window grid
      for (let wy = by + 16; wy < cityCanvas.height - 10; wy += 15) {
        for (let wx = bx + 6; wx < bx + bw - 6; wx += 10) {
          const isLit = (wx * 11 + wy * 7 + i * 5) % 4 !== 0;
          if (isLit) {
            ctx.fillStyle = (wx + wy) % 5 === 0 ? '#fb923c' : '#fef08a';
            ctx.globalAlpha = 0.85;
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      }
      ctx.globalAlpha = 1.0;
    }

    const cityTexture = new THREE.CanvasTexture(cityCanvas);
    cityTexture.colorSpace = THREE.SRGBColorSpace;

    const cityBackdropGeo = new THREE.PlaneGeometry(3.5, 2.7);
    const cityBackdropMat = new THREE.MeshBasicMaterial({
      map: cityTexture,
    });
    const cityBackdrop = new THREE.Mesh(cityBackdropGeo, cityBackdropMat);
    cityBackdrop.position.set(0, 0, -0.05);
    windowGroup.add(cityBackdrop);

    // Palm tree silhouettes outside the window
    this.palmTreesGroup = new THREE.Group();
    this.palmTreesGroup.position.set(-0.3, -0.9, 0.05);

    const trunkMat = new THREE.MeshBasicMaterial({ color: 0x180f26 });
    for (let p = 0; p < 3; p++) {
      const palm = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(0.025, 0.045, 1.8, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.9;
      trunk.rotation.z = (p - 1) * 0.1;
      palm.add(trunk);

      // Palm fronds
      for (let f = 0; f < 7; f++) {
        const frondAngle = (f / 7) * Math.PI * 2;
        const frondGeo = new THREE.ConeGeometry(0.12, 0.7, 5);
        const frond = new THREE.Mesh(frondGeo, trunkMat);
        frond.position.set(0, 1.75, 0);
        frond.rotation.z = Math.PI / 2.3;
        frond.rotation.y = frondAngle;
        palm.add(frond);
      }
      palm.position.x = (p - 1) * 0.8;
      this.palmTreesGroup.add(palm);
    }
    windowGroup.add(this.palmTreesGroup);

    this.scene.add(windowGroup);
  }

  /**
   * Builds custom Electromechanical Engineering Blueprint Posters & Wall Art
   * Styled in harmony with the cyberpunk developer room lighting.
   */
  private buildElectromechanicalWallArt(): void {
    const artGroup = new THREE.Group();

    // -------------------------------------------------------------
    // POSTER 1: Electromechanical Servo Actuator & Gearbox (Moved to the Right Wall area)
    // -------------------------------------------------------------
    const poster1Canvas = this.createActuatorBlueprintCanvas();
    const poster1Tex = new THREE.CanvasTexture(poster1Canvas);
    poster1Tex.colorSpace = THREE.SRGBColorSpace;

    const p1Group = new THREE.Group();
    // Shifted to the right side of the back wall (x = 2.85) for optimal visibility and decor
    p1Group.position.set(2.85, 2.05, -1.74);

    // Dark frame
    const p1FrameGeo = new THREE.BoxGeometry(1.28, 1.58, 0.04);
    const p1FrameMat = new THREE.MeshStandardMaterial({
      color: 0x120c22,
      roughness: 0.3,
      metalness: 0.8,
    });
    const p1Frame = new THREE.Mesh(p1FrameGeo, p1FrameMat);
    p1Group.add(p1Frame);

    // Glowing Cyan Neon Border
    const p1NeonGeo = new THREE.BoxGeometry(1.31, 1.61, 0.02);
    const p1NeonMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
    });
    const p1Neon = new THREE.Mesh(p1NeonGeo, p1NeonMat);
    p1Neon.position.z = 0.01;
    p1Group.add(p1Neon);

    // Blueprint Plane
    const p1PlaneGeo = new THREE.PlaneGeometry(1.22, 1.52);
    const p1PlaneMat = new THREE.MeshStandardMaterial({
      map: poster1Tex,
      roughness: 0.5,
      metalness: 0.1,
    });
    const p1Plane = new THREE.Mesh(p1PlaneGeo, p1PlaneMat);
    p1Plane.position.z = 0.025;
    p1Group.add(p1Plane);

    artGroup.add(p1Group);

    // -------------------------------------------------------------
    // POSTER 2: 3-Phase BLDC Motor & Flux Schematics (Back Wall Above Pegboard)
    // -------------------------------------------------------------
    const poster2Canvas = this.createBLDCMotorBlueprintCanvas();
    const poster2Tex = new THREE.CanvasTexture(poster2Canvas);
    poster2Tex.colorSpace = THREE.SRGBColorSpace;

    const p2Group = new THREE.Group();
    p2Group.position.set(1.4, 2.85, -1.74);

    const p2FrameGeo = new THREE.BoxGeometry(1.88, 0.88, 0.04);
    const p2FrameMat = new THREE.MeshStandardMaterial({
      color: 0x140e28,
      roughness: 0.3,
      metalness: 0.8,
    });
    const p2Frame = new THREE.Mesh(p2FrameGeo, p2FrameMat);
    p2Group.add(p2Frame);

    // Glowing Magenta Neon Border
    const p2NeonGeo = new THREE.BoxGeometry(1.91, 0.91, 0.02);
    const p2NeonMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      wireframe: true,
    });
    const p2Neon = new THREE.Mesh(p2NeonGeo, p2NeonMat);
    p2Neon.position.z = 0.01;
    p2Group.add(p2Neon);

    const p2PlaneGeo = new THREE.PlaneGeometry(1.82, 0.82);
    const p2PlaneMat = new THREE.MeshStandardMaterial({
      map: poster2Tex,
      roughness: 0.5,
      metalness: 0.1,
    });
    const p2Plane = new THREE.Mesh(p2PlaneGeo, p2PlaneMat);
    p2Plane.position.z = 0.025;
    p2Group.add(p2Plane);

    artGroup.add(p2Group);

    // -------------------------------------------------------------
    // POSTER 3: 6-Axis Articulated Robotic Arm Kinematics (Right Wall)
    // -------------------------------------------------------------
    const poster3Canvas = this.createRoboticArmBlueprintCanvas();
    const poster3Tex = new THREE.CanvasTexture(poster3Canvas);
    poster3Tex.colorSpace = THREE.SRGBColorSpace;

    const p3Group = new THREE.Group();
    p3Group.position.set(3.94, 2.15, -0.3);
    p3Group.rotation.y = -Math.PI / 2;

    const p3FrameGeo = new THREE.BoxGeometry(1.58, 1.78, 0.04);
    const p3FrameMat = new THREE.MeshStandardMaterial({
      color: 0x181026,
      roughness: 0.3,
      metalness: 0.8,
    });
    const p3Frame = new THREE.Mesh(p3FrameGeo, p3FrameMat);
    p3Group.add(p3Frame);

    // Glowing Amber Neon Border
    const p3NeonGeo = new THREE.BoxGeometry(1.61, 1.81, 0.02);
    const p3NeonMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      wireframe: true,
    });
    const p3Neon = new THREE.Mesh(p3NeonGeo, p3NeonMat);
    p3Neon.position.z = 0.01;
    p3Group.add(p3Neon);

    const p3PlaneGeo = new THREE.PlaneGeometry(1.52, 1.72);
    const p3PlaneMat = new THREE.MeshStandardMaterial({
      map: poster3Tex,
      roughness: 0.5,
      metalness: 0.1,
    });
    const p3Plane = new THREE.Mesh(p3PlaneGeo, p3PlaneMat);
    p3Plane.position.z = 0.025;
    p3Group.add(p3Plane);

    artGroup.add(p3Group);

    // -------------------------------------------------------------
    // Wall Shelf with Electromechanical Hardware Models (Shifted to Right Wall)
    // -------------------------------------------------------------
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(2.85, 3.05, -1.62);

    // Shelf plank
    const shelfPlankGeo = new THREE.BoxGeometry(1.4, 0.035, 0.28);
    const shelfPlankMat = new THREE.MeshStandardMaterial({
      color: 0x1e1538,
      roughness: 0.5,
      metalness: 0.4,
    });
    const shelfPlank = new THREE.Mesh(shelfPlankGeo, shelfPlankMat);
    shelfGroup.add(shelfPlank);

    // Metal brackets
    const bracketGeo = new THREE.BoxGeometry(0.03, 0.18, 0.22);
    const bracketMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const b1 = new THREE.Mesh(bracketGeo, bracketMat);
    b1.position.set(-0.55, -0.09, -0.02);
    shelfGroup.add(b1);
    const b2 = new THREE.Mesh(bracketGeo, bracketMat);
    b2.position.set(0.55, -0.09, -0.02);
    shelfGroup.add(b2);

    // Model on shelf: 3D Stepper Motor (NEMA-style metal cube & rotor)
    const motorGroup = new THREE.Group();
    motorGroup.position.set(-0.4, 0.08, 0);

    const motorBodyGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const motorBodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const motorBody = new THREE.Mesh(motorBodyGeo, motorBodyMat);
    motorGroup.add(motorBody);

    const motorShaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.08, 12);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
    const motorShaft = new THREE.Mesh(motorShaftGeo, shaftMat);
    motorShaft.rotation.x = Math.PI / 2;
    motorShaft.position.set(0, 0, 0.09);
    motorGroup.add(motorShaft);

    // Wire harness
    const wireGeo = new THREE.TorusGeometry(0.03, 0.008, 6, 16);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set(0, -0.04, -0.07);
    motorGroup.add(wire);

    shelfGroup.add(motorGroup);

    // Model on shelf: Bevel Gear Pair
    const gearGroup = new THREE.Group();
    gearGroup.position.set(0.1, 0.07, 0);

    const gear1Geo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
    const gear1 = new THREE.Mesh(gear1Geo, brassMat);
    gearGroup.add(gear1);

    const gear2Geo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16);
    const gear2 = new THREE.Mesh(gear2Geo, brassMat);
    gear2.rotation.x = Math.PI / 2;
    gear2.position.set(0, 0.05, 0.04);
    gearGroup.add(gear2);

    shelfGroup.add(gearGroup);

    // Engineering books / binders on shelf
    const bookColors = [0x2563eb, 0x7c3aed, 0x059669];
    bookColors.forEach((color, bIdx) => {
      const bookGeo = new THREE.BoxGeometry(0.03, 0.16, 0.12);
      const bookMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      const book = new THREE.Mesh(bookGeo, bookMat);
      book.position.set(0.42 + bIdx * 0.04, 0.08, 0);
      shelfGroup.add(book);
    });

    artGroup.add(shelfGroup);

    this.scene.add(artGroup);
  }

  /**
   * Canvas 1: Electromechanical Actuator & Planetary Gearbox Blueprint
   */
  private createActuatorBlueprintCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d')!;

    // Blueprint background
    ctx.fillStyle = '#070c1e';
    ctx.fillRect(0, 0, 1024, 1280);

    // Technical grid
    ctx.strokeStyle = '#0f1d3b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1024; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1280);
      ctx.stroke();
    }
    for (let y = 0; y < 1280; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Header border & title block
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, 968, 1224);

    // Title Block
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 26px -apple-system, monospace';
    ctx.fillText('EPI ENGINEERING · ELECTROMECHANICAL SCHEMATICS', 50, 75);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('DOC: EM-ACTUATOR-SPEC-2026 // HARMONIC DRIVE & SERVOMOTOR', 50, 105);

    // Main Diagram: Planetary Gearbox Cross-section
    const cx = 512;
    const cy = 420;

    // Outer Ring Gear (Stationary)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 210, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 225, 0, Math.PI * 2);
    ctx.stroke();

    // Internal Gear Teeth (Ring)
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    for (let a = 0; a < 48; a++) {
      const angle = (a / 48) * Math.PI * 2;
      const x1 = cx + Math.cos(angle) * 195;
      const y1 = cy + Math.sin(angle) * 195;
      const x2 = cx + Math.cos(angle) * 210;
      const y2 = cy + Math.sin(angle) * 210;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Central Sun Gear
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 65, 0, Math.PI * 2);
    ctx.stroke();

    // Center shaft hole & keyway
    ctx.fillStyle = '#070c1e';
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(cx - 5, cy - 35, 10, 14);

    // 3 Planetary Gears revolving around Sun
    const planetDist = 135;
    for (let p = 0; p < 3; p++) {
      const pAngle = (p / 3) * Math.PI * 2 + 0.3;
      const px = cx + Math.cos(pAngle) * planetDist;
      const py = cy + Math.sin(pAngle) * planetDist;

      // Planet gear circle
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, 60, 0, Math.PI * 2);
      ctx.stroke();

      // Planet pin bearing
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();

      // Planet gear teeth
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.5;
      for (let t = 0; t < 18; t++) {
        const tAngle = (t / 18) * Math.PI * 2;
        const tx1 = px + Math.cos(tAngle) * 52;
        const ty1 = py + Math.sin(tAngle) * 52;
        const tx2 = px + Math.cos(tAngle) * 60;
        const ty2 = py + Math.sin(tAngle) * 60;
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.stroke();
      }

      // Carrier link triangle lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Centerlines
    ctx.strokeStyle = '#0284c7';
    ctx.setLineDash([8, 4, 2, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 260, cy);
    ctx.lineTo(cx + 260, cy);
    ctx.moveTo(cx, cy - 260);
    ctx.lineTo(cx, cy + 260);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dimension lines & Annotations
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '13px monospace';

    // Dimension line top
    ctx.beginPath();
    ctx.moveTo(cx - 210, cy - 235);
    ctx.lineTo(cx + 210, cy - 235);
    ctx.stroke();
    ctx.fillText('◄ ø420.0 mm (OUTER CARRIER) ►', cx - 110, cy - 245);

    // Exploded View Motor Stator Diagram (Bottom Half)
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(60, 720, 904, 260);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('ACTUATOR STATOR WINDINGS & TORQUE DYNAMICS', 80, 755);

    // Coil loops
    for (let c = 0; c < 8; c++) {
      const coX = 140 + c * 105;
      ctx.strokeStyle = c % 2 === 0 ? '#f43f5e' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(coX, 785, 65, 120);

      // Copper coils
      ctx.fillStyle = c % 2 === 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(coX, 785, 65, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(`POLE ${c + 1}`, coX + 8, 850);
      ctx.fillText(c % 2 === 0 ? '[ N ]' : '[ S ]', coX + 16, 875);
    }

    // Engineering parameters box (Footer)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(60, 1010, 904, 210);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(60, 1010, 904, 210);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('KINEMATIC & ELECTROMECHANICAL PARAMETERS:', 80, 1045);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('• Reduction Ratio: i = 1 + (Z_ring / Z_sun) = 52.4:1', 80, 1080);
    ctx.fillText('• Nominal Torque: T_n = 4.8 N·m  |  Peak Torque: T_max = 14.2 N·m', 80, 1110);
    ctx.fillText('• Back-EMF Constant: Ke = 0.082 V/(rad/s)  |  Winding Resistance: R = 1.14 Ω', 80, 1140);
    ctx.fillText('• Feedback Sensor: 17-Bit Absolute Optical Encoder (SSI Protocol)', 80, 1170);
    ctx.fillText('• Designed & Analyzed: Yassine Ayadi // EPI Sousse', 80, 1200);

    return canvas;
  }

  /**
   * Canvas 2: 3-Phase BLDC Motor & Stator Flux Schematics (Panoramic)
   */
  private createBLDCMotorBlueprintCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 768;
    const ctx = canvas.getContext('2d')!;

    // Blueprint dark background
    ctx.fillStyle = '#090717';
    ctx.fillRect(0, 0, 1536, 768);

    // Grid lines
    ctx.strokeStyle = '#150f2e';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1536; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 768);
      ctx.stroke();
    }
    for (let y = 0; y < 768; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1536, y);
      ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, 1488, 720);

    // Title
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 24px -apple-system, monospace';
    ctx.fillText('3-PHASE BRUSHLESS DC MOTOR (BLDC) · ELECTROMAGNETIC FLUX DYNAMICS', 45, 65);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('EPI ELECTROMECHANICS LAB // STATOR WINDING COILS & FIELD-ORIENTED CONTROL', 45, 92);

    // Left diagram: Stator cross section
    const sx = 340;
    const sy = 410;

    // Stator outer lamination ring
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 220, 0, Math.PI * 2);
    ctx.stroke();

    // 12 Stator Teeth & Coils
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const x1 = sx + Math.cos(angle) * 120;
      const y1 = sy + Math.sin(angle) * 120;
      const x2 = sx + Math.cos(angle) * 210;
      const y2 = sy + Math.sin(angle) * 210;

      // Stator tooth line
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Coil winding blocks
      const phaseColor = i % 3 === 0 ? '#f43f5e' : (i % 3 === 1 ? '#38bdf8' : '#fbbf24');
      ctx.fillStyle = phaseColor;
      const wx = sx + Math.cos(angle) * 165;
      const wy = sy + Math.sin(angle) * 165;
      ctx.beginPath();
      ctx.arc(wx, wy, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rotor with 8 Permanent Magnets
    ctx.fillStyle = '#170e28';
    ctx.beginPath();
    ctx.arc(sx, sy, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let m = 0; m < 8; m++) {
      const mAngle = (m / 8) * Math.PI * 2;
      const mx = sx + Math.cos(mAngle) * 80;
      const my = sy + Math.sin(mAngle) * 80;
      ctx.fillStyle = m % 2 === 0 ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(mx, my, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(m % 2 === 0 ? 'N' : 'S', mx - 4, my + 4);
    }

    // Rotor Shaft
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();

    // Center Magnetic Flux Vectors (Curved Lines)
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.setLineDash([4, 4]);
    for (let f = 0; f < 6; f++) {
      ctx.beginPath();
      ctx.arc(sx, sy, 60 + f * 25, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Right Side Diagram: 3-Phase Voltage Waveforms (FOC / PWM)
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('3-PHASE VOLTAGE & HALL EFFECT COMMUTATION SEQUENCE', 680, 160);

    const waveStartX = 700;
    const waveStartY = 240;
    const waveLength = 760;

    // Phase U (Red)
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < waveLength; x++) {
      const y = waveStartY + Math.sin((x / 120) * Math.PI * 2) * 45;
      if (x === 0) ctx.moveTo(waveStartX + x, y);
      else ctx.lineTo(waveStartX + x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('Phase U (0°)', waveStartX + waveLength + 10, waveStartY);

    // Phase V (Cyan, 120 deg shifted)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < waveLength; x++) {
      const y = waveStartY + 100 + Math.sin(((x / 120) * Math.PI * 2) - (Math.PI * 2 / 3)) * 45;
      if (x === 0) ctx.moveTo(waveStartX + x, y);
      else ctx.lineTo(waveStartX + x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Phase V (120°)', waveStartX + waveLength + 10, waveStartY + 100);

    // Phase W (Amber, 240 deg shifted)
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < waveLength; x++) {
      const y = waveStartY + 200 + Math.sin(((x / 120) * Math.PI * 2) - (Math.PI * 4 / 3)) * 45;
      if (x === 0) ctx.moveTo(waveStartX + x, y);
      else ctx.lineTo(waveStartX + x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('Phase W (240°)', waveStartX + waveLength + 10, waveStartY + 200);

    // Commutation formulas box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(680, 530, 800, 180);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
    ctx.strokeRect(680, 530, 800, 180);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('ELECTROMAGNETIC TORQUE EQUATION (PARK d-q FRAME):', 700, 565);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('T_em = (3/2) · p · [ λ_pm · i_q + (L_d - L_q) · i_d · i_q ]', 700, 595);
    ctx.fillText('• Stator Poles: 12 Slots  |  Rotor Poles: 8 Permanent Magnets', 700, 625);
    ctx.fillText('• Switching Frequency: f_pwm = 20.0 kHz Space Vector Modulation', 700, 650);
    ctx.fillText('• Speed Control Loop: Digital PI Controller (Ts = 100 µs)', 700, 675);

    return canvas;
  }

  /**
   * Canvas 3: 6-Axis Articulated Robotic Arm Kinematics (Right Wall)
   */
  private createRoboticArmBlueprintCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, 1200, 1440);

    // Technical grid
    ctx.strokeStyle = '#181533';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1200; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1440);
      ctx.stroke();
    }
    for (let y = 0; y < 1440; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1200, y);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, 1148, 1388);

    // Title
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 26px -apple-system, monospace';
    ctx.fillText('6-DOF INDUSTRIAL ROBOTIC ARM · KINEMATIC SCHEMATIC', 50, 75);
    ctx.font = '15px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('ROBOTICS & AUTOMATION // HARMONIC DRIVE REDUCTION // EPI SOUSSE', 50, 105);

    // Draw Vector Robotic Arm Silhouette / Kinematic Links
    // Base pedestal
    ctx.fillStyle = '#1e1b38';
    ctx.fillRect(200, 780, 240, 50);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(200, 780, 240, 50);

    // Joint 1: Base Yaw Joint
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(320, 750, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('J1', 312, 755);

    // Link 1: Shoulder Column
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(320, 750);
    ctx.lineTo(320, 520);
    ctx.stroke();

    // Joint 2: Shoulder Pitch Joint
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(320, 520, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.fillText('J2', 312, 525);

    // Link 2: Upper Arm
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(320, 520);
    ctx.lineTo(540, 340);
    ctx.stroke();

    // Joint 3: Elbow Joint
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(540, 340, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.fillText('J3', 532, 345);

    // Link 3: Forearm
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(540, 340);
    ctx.lineTo(760, 420);
    ctx.stroke();

    // Joint 4 & 5 & 6: Wrist Assembly
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(760, 420, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.fillText('J4', 752, 425);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(760, 420);
    ctx.lineTo(840, 450);
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(840, 450, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('J5-6', 824, 455);

    // End effector / Tool Gripper
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.strokeRect(860, 435, 45, 30);
    ctx.beginPath();
    ctx.moveTo(905, 430);
    ctx.lineTo(935, 430);
    ctx.moveTo(905, 470);
    ctx.lineTo(935, 470);
    ctx.stroke();

    // Rotation arrows (curved) around joints
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(320, 520, 55, -0.6, 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(540, 340, 50, 0.4, 2.2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Denavit-Hartenberg (D-H) Parameter Table
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('DENAVIT-HARTENBERG (D-H) FORWARD KINEMATICS TABLE:', 60, 900);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(60, 925, 1080, 240);

    // Table Header
    ctx.fillStyle = '#1e1b38';
    ctx.fillRect(60, 925, 1080, 40);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Joint i', 85, 950);
    ctx.fillText('Link Length (a_i)', 230, 950);
    ctx.fillText('Link Twist (α_i)', 460, 950);
    ctx.fillText('Link Offset (d_i)', 680, 950);
    ctx.fillText('Joint Angle (θ_i)', 920, 950);

    const dhRows = [
      ['Joint 1 (Base Yaw)', '0 mm', '+90°', '340 mm', 'θ_1 [-170°, +170°]'],
      ['Joint 2 (Shoulder)', '420 mm', '0°', '0 mm', 'θ_2 [-90°, +120°]'],
      ['Joint 3 (Elbow)', '380 mm', '+90°', '0 mm', 'θ_3 [-150°, +80°]'],
      ['Joint 4 (Wrist Roll)', '0 mm', '-90°', '280 mm', 'θ_4 [-180°, +180°]'],
      ['Joint 5 (Wrist Pitch)', '0 mm', '+90°', '0 mm', 'θ_5 [-120°, +120°]'],
      ['Joint 6 (Tool Flange)', '0 mm', '0°', '110 mm', 'θ_6 [Continuous]'],
    ];

    dhRows.forEach((row, rIdx) => {
      const ry = 995 + rIdx * 28;
      ctx.fillStyle = rIdx % 2 === 0 ? '#cbd5e1' : '#94a3b8';
      ctx.font = '13px monospace';
      ctx.fillText(row[0], 85, ry);
      ctx.fillText(row[1], 230, ry);
      ctx.fillText(row[2], 460, ry);
      ctx.fillText(row[3], 680, ry);
      ctx.fillText(row[4], 920, ry);
    });

    // Actuation specs footer
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('HARMONIC DRIVE REDUCTION & SERVO RATINGS:', 60, 1210);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px monospace';
    ctx.fillText('• Harmonic Drive Reduction Ratio: 100:1 (Zero-Backlash Cup Component Set)', 60, 1245);
    ctx.fillText('• Max Payload Capacity: 5.0 kg  |  Reach Radius: R = 850 mm', 60, 1275);
    ctx.fillText('• Pose Repeatability: ±0.02 mm (ISO 9283 Standards Compliance)', 60, 1305);
    ctx.fillText('• Motor Actuators: Synchronous AC Permanent Magnet Servomotors with Absolute Encoders', 60, 1335);
    ctx.fillText('• CAD & Kinematic Model: Yassine Ayadi // Software & Systems Engineering', 60, 1365);

    return canvas;
  }

  private buildDeskWorkstation(): void {
    const workstation = new THREE.Group();

    // Desk top (matte dark wood / slate)
    const deskTopGeo = new THREE.BoxGeometry(2.6, 0.08, 1.2);
    const deskTopMat = new THREE.MeshStandardMaterial({
      color: 0x1e192f,
      roughness: 0.45,
      metalness: 0.2,
    });
    const deskTop = new THREE.Mesh(deskTopGeo, deskTopMat);
    deskTop.position.set(-0.3, 0.85, 0);
    deskTop.castShadow = !this.isSoftwareGl;
    deskTop.receiveShadow = !this.isSoftwareGl;
    workstation.add(deskTop);

    // Desk legs (angled matte metal)
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x110d1c,
      roughness: 0.3,
      metalness: 0.8,
    });

    const legPositions = [
      [-1.5, 0.425, -0.5],
      [-1.5, 0.425, 0.5],
      [0.9, 0.425, -0.5],
      [0.9, 0.425, 0.5],
    ];

    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = !this.isSoftwareGl;
      workstation.add(leg);
    });

    // Ultrawide Curved Computer Monitor
    const monitorGroup = new THREE.Group();
    monitorGroup.position.set(-0.6, 0.9, -0.2);

    // Stand
    const standBaseGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.02, 16);
    const standBaseMat = new THREE.MeshStandardMaterial({
      color: 0x241d38,
      metalness: 0.8,
      roughness: 0.3,
    });
    const standBase = new THREE.Mesh(standBaseGeo, standBaseMat);
    standBase.position.set(0, 0, 0);
    monitorGroup.add(standBase);

    const standArmGeo = new THREE.BoxGeometry(0.06, 0.35, 0.06);
    const standArm = new THREE.Mesh(standArmGeo, standBaseMat);
    standArm.position.set(0, 0.17, 0);
    standArm.rotation.x = -0.15;
    monitorGroup.add(standArm);

    // Bezel & Back
    const bezelGeo = new THREE.BoxGeometry(1.25, 0.55, 0.05);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x0f0b18,
      roughness: 0.3,
      metalness: 0.7,
    });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.set(0, 0.42, 0.02);
    monitorGroup.add(bezel);

    // Screen with Dynamic Canvas Texture (Showing Glowing "PROJECTS" text)
    this.monitorScreenCanvas = document.createElement('canvas');
    this.monitorScreenCanvas.width = 1024;
    this.monitorScreenCanvas.height = 512;
    this.updateMonitorCanvas();

    this.monitorScreenTexture = new THREE.CanvasTexture(this.monitorScreenCanvas);
    this.monitorScreenTexture.colorSpace = THREE.SRGBColorSpace;

    const screenGeo = new THREE.PlaneGeometry(1.2, 0.5);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.monitorScreenTexture,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 0.42, 0.048);
    monitorGroup.add(screen);

    workstation.add(monitorGroup);

    // Mechanical Keyboard
    const kbGeo = new THREE.BoxGeometry(0.48, 0.02, 0.18);
    const kbMat = new THREE.MeshStandardMaterial({
      color: 0x181427,
      roughness: 0.5,
    });
    const keyboard = new THREE.Mesh(kbGeo, kbMat);
    keyboard.position.set(-0.6, 0.9, 0.22);
    workstation.add(keyboard);

    // Keycaps glow
    const keycapsGeo = new THREE.PlaneGeometry(0.44, 0.14);
    const keycapsMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const keycaps = new THREE.Mesh(keycapsGeo, keycapsMat);
    keycaps.rotation.x = -Math.PI / 2;
    keycaps.position.set(-0.6, 0.912, 0.22);
    workstation.add(keycaps);

    // Mouse & Mousepad
    const padGeo = new THREE.BoxGeometry(0.75, 0.005, 0.32);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x130e22, roughness: 0.9 });
    const mousepad = new THREE.Mesh(padGeo, padMat);
    mousepad.position.set(-0.55, 0.892, 0.22);
    workstation.add(mousepad);

    const mouseGeo = new THREE.BoxGeometry(0.06, 0.025, 0.1);
    const mouseMat = new THREE.MeshStandardMaterial({ color: 0x31244d, metalness: 0.5 });
    const mouseMesh = new THREE.Mesh(mouseGeo, mouseMat);
    mouseMesh.position.set(-0.25, 0.905, 0.22);
    workstation.add(mouseMesh);

    // Smartphone lying on desk
    const phoneGeo = new THREE.BoxGeometry(0.08, 0.01, 0.15);
    const phoneMat = new THREE.MeshStandardMaterial({ color: 0x221a36, roughness: 0.2, metalness: 0.9 });
    const phone = new THREE.Mesh(phoneGeo, phoneMat);
    phone.position.set(-0.1, 0.897, 0.35);
    phone.rotation.y = 0.2;
    workstation.add(phone);

    // Desk Lamp with pink conical shade and warm illumination
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-1.4, 0.89, 0.15);

    const lampBaseGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.02, 16);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x2d1f45, metalness: 0.8, roughness: 0.3 });
    const lampBase = new THREE.Mesh(lampBaseGeo, lampMat);
    lampGroup.add(lampBase);

    const armGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8);
    const arm1 = new THREE.Mesh(armGeo, lampMat);
    arm1.position.set(0.05, 0.25, 0);
    arm1.rotation.z = -0.3;
    lampGroup.add(arm1);

    const shadeGeo = new THREE.ConeGeometry(0.14, 0.2, 16, 1, true);
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const shade = new THREE.Mesh(shadeGeo, shadeMat);
    shade.position.set(0.2, 0.5, 0);
    shade.rotation.z = 0.75;
    lampGroup.add(shade);

    workstation.add(lampGroup);

    this.scene.add(workstation);
  }

  private buildRobot(): void {
    const robotGroup = new THREE.Group();
    robotGroup.position.set(-0.6, 0.89, 0.55);

    // Modern ergonomic mesh chair
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, -0.4, 0);

    const chairSeatGeo = new THREE.BoxGeometry(0.5, 0.08, 0.5);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x181228, roughness: 0.8 });
    const chairSeat = new THREE.Mesh(chairSeatGeo, chairMat);
    chairSeat.position.set(0, 0.45, 0);
    chairGroup.add(chairSeat);

    const chairBackGeo = new THREE.BoxGeometry(0.46, 0.6, 0.06);
    const chairBack = new THREE.Mesh(chairBackGeo, chairMat);
    chairBack.position.set(0, 0.75, 0.24);
    chairGroup.add(chairBack);

    const chairPoleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
    const chairPole = new THREE.Mesh(chairPoleGeo, metalMat);
    chairPole.position.set(0, 0.22, 0);
    chairGroup.add(chairPole);

    robotGroup.add(chairGroup);

    // Robot Character Body
    const robotBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.35,
      metalness: 0.2,
    });
    const robotJointMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.6,
    });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.38, 0.36, 0.26);
    const torso = new THREE.Mesh(torsoGeo, robotBodyMat);
    torso.position.set(0, 0.32, 0);
    robotGroup.add(torso);

    // Torso horizontal status vents / stripes
    const ventGeo = new THREE.BoxGeometry(0.24, 0.03, 0.02);
    const ventMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let v = 0; v < 3; v++) {
      const vent = new THREE.Mesh(ventGeo, ventMat);
      vent.position.set(0, 0.36 - v * 0.06, 0.135);
      robotGroup.add(vent);
    }

    // Arms resting on desk
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8);
    const leftArm = new THREE.Mesh(armGeo, robotBodyMat);
    leftArm.position.set(-0.24, 0.28, -0.06);
    leftArm.rotation.x = -Math.PI / 3;
    leftArm.rotation.z = -0.2;
    robotGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, robotBodyMat);
    rightArm.position.set(0.24, 0.28, -0.06);
    rightArm.rotation.x = -Math.PI / 3;
    rightArm.rotation.z = 0.2;
    robotGroup.add(rightArm);

    // Neck joint
    const neckGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12);
    const neck = new THREE.Mesh(neckGeo, robotJointMat);
    neck.position.set(0, 0.52, 0);
    robotGroup.add(neck);

    // Robot Head Group (can look around)
    this.robotHead = new THREE.Group();
    this.robotHead.position.set(0, 0.68, 0);

    const headGeo = new THREE.BoxGeometry(0.42, 0.34, 0.32);
    const head = new THREE.Mesh(headGeo, robotBodyMat);
    this.robotHead.add(head);

    // Dark screen face
    const faceGeo = new THREE.PlaneGeometry(0.36, 0.28);

    // Procedural robot eyes canvas
    this.robotEyesCanvas = document.createElement('canvas');
    this.robotEyesCanvas.width = 256;
    this.robotEyesCanvas.height = 256;
    this.updateRobotEyes(false);

    this.robotEyesTexture = new THREE.CanvasTexture(this.robotEyesCanvas);
    this.robotEyesTexture.colorSpace = THREE.SRGBColorSpace;

    const faceMat = new THREE.MeshBasicMaterial({
      map: this.robotEyesTexture,
    });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0, -0.162);
    face.rotation.y = Math.PI; // Face towards camera/desk
    this.robotHead.add(face);

    // Cute ear gears
    const earGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12);
    this.robotLeftEarGear = new THREE.Mesh(earGeo, robotJointMat);
    this.robotLeftEarGear.rotation.z = Math.PI / 2;
    this.robotLeftEarGear.position.set(-0.23, 0, 0);
    this.robotHead.add(this.robotLeftEarGear);

    this.robotRightEarGear = new THREE.Mesh(earGeo, robotJointMat);
    this.robotRightEarGear.rotation.z = Math.PI / 2;
    this.robotRightEarGear.position.set(0.23, 0, 0);
    this.robotHead.add(this.robotRightEarGear);

    // Antenna on top
    const antennaStemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8);
    const antennaStem = new THREE.Mesh(antennaStemGeo, robotJointMat);
    antennaStem.position.set(0, 0.22, 0);
    this.robotHead.add(antennaStem);

    const antennaTipGeo = new THREE.SphereGeometry(0.035, 12, 12);
    const antennaTipMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    const antennaTip = new THREE.Mesh(antennaTipGeo, antennaTipMat);
    antennaTip.position.set(0, 0.3, 0);
    this.robotHead.add(antennaTip);

    robotGroup.add(this.robotHead);

    this.scene.add(robotGroup);
  }

  private updateRobotEyes(blinking: boolean): void {
    if (!this.robotEyesCanvas) return;
    const ctx = this.robotEyesCanvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#f43f5e';
    if (blinking) {
      // Closed line eyes
      ctx.fillRect(50, 125, 45, 8);
      ctx.fillRect(160, 125, 45, 8);
    } else {
      // Cute friendly rectangular eyes
      ctx.fillRect(52, 95, 42, 60);
      ctx.fillRect(162, 95, 42, 60);

      // Light catch / sparkle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(56, 99, 14, 16);
      ctx.fillRect(166, 99, 14, 16);
    }

    if (this.robotEyesTexture) {
      this.robotEyesTexture.needsUpdate = true;
    }
  }

  private updateMonitorCanvas(): void {
    if (!this.monitorScreenCanvas) return;
    const ctx = this.monitorScreenCanvas.getContext('2d')!;
    ctx.fillStyle = '#0b0817';
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle grid lines
    ctx.strokeStyle = '#1e163b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1024; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y < 512; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Glowing main title
    ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 24;
    ctx.fillText(this.currentMonitorText, 512, 230);
    ctx.shadowBlur = 0;

    // Subtitle & Status lines
    ctx.font = '600 24px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('• SOFTWARE ENGINEERING · EPI / TUNISIA •', 512, 290);

    ctx.font = '400 18px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('> Click diamond hotspots or bottom dock to inspect', 512, 335);

    // Scanline effect
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < 512; y += 4) {
      ctx.fillRect(0, y, 1024, 2);
    }

    if (this.monitorScreenTexture) {
      this.monitorScreenTexture.needsUpdate = true;
    }
  }

  private buildPegboard(): void {
    const pegboardGroup = new THREE.Group();
    pegboardGroup.position.set(1.4, 1.8, -1.65);

    // Illuminated back glow / outer frame
    const frameGeo = new THREE.BoxGeometry(2.1, 1.35, 0.04);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1f1936,
      roughness: 0.3,
      metalness: 0.8,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    pegboardGroup.add(frame);

    // Neon edge border glow
    const neonGeo = new THREE.BoxGeometry(2.14, 1.39, 0.02);
    const neonMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
    });
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.position.z = 0.01;
    pegboardGroup.add(neon);

    // Pegboard canvas texture with dot grid holes
    const pegCanvas = document.createElement('canvas');
    pegCanvas.width = 512;
    pegCanvas.height = 256;
    const pctx = pegCanvas.getContext('2d')!;
    pctx.fillStyle = '#17112b';
    pctx.fillRect(0, 0, 512, 256);

    pctx.fillStyle = '#0a0714';
    for (let py = 16; py < 256; py += 16) {
      for (let px = 16; px < 512; px += 16) {
        pctx.beginPath();
        pctx.arc(px, py, 2.5, 0, Math.PI * 2);
        pctx.fill();
      }
    }
    const pegTexture = new THREE.CanvasTexture(pegCanvas);
    pegTexture.colorSpace = THREE.SRGBColorSpace;

    const boardGeo = new THREE.PlaneGeometry(2.0, 1.25);
    const boardMat = new THREE.MeshStandardMaterial({
      map: pegTexture,
      roughness: 0.85,
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.z = 0.025;
    pegboardGroup.add(board);

    // Hanging ID Badges / Lanyards
    const badgeColors = [
      { name: 'EPI Engineering', color: '#ea580c', ribbon: '#f97316' },
      { name: 'Fullstack Dev', color: '#0d9488', ribbon: '#14b8a6' },
      { name: 'TypeScript', color: '#2563eb', ribbon: '#3b82f6' },
      { name: 'Open Source', color: '#7c3aed', ribbon: '#8b5cf6' },
    ];

    badgeColors.forEach((b, idx) => {
      const badgeGroup = new THREE.Group();
      const bx = -0.7 + idx * 0.42;

      // Peg Hook
      const hookGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8);
      const hookMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const hook = new THREE.Mesh(hookGeo, hookMat);
      hook.rotation.x = Math.PI / 2;
      hook.position.set(bx, 0.45, 0.06);
      pegboardGroup.add(hook);

      // Fabric Lanyard Ribbon
      const ribbonGeo = new THREE.PlaneGeometry(0.04, 0.45);
      const ribbonMat = new THREE.MeshBasicMaterial({ color: b.ribbon });
      const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
      ribbon.position.set(bx, 0.2, 0.05);
      badgeGroup.add(ribbon);

      // ID Badge Card
      const cardGeo = new THREE.BoxGeometry(0.24, 0.32, 0.01);
      const cardMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
      });
      const card = new THREE.Mesh(cardGeo, cardMat);
      card.position.set(bx, -0.06, 0.055);
      badgeGroup.add(card);

      // Badge colored header band
      const bandGeo = new THREE.BoxGeometry(0.24, 0.08, 0.012);
      const bandMat = new THREE.MeshBasicMaterial({ color: b.color });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(bx, 0.06, 0.056);
      badgeGroup.add(band);

      pegboardGroup.add(badgeGroup);
    });

    // Hanging Coiled Cable on right hook
    const cableGeo = new THREE.TorusGeometry(0.1, 0.018, 8, 24);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set(0.72, 0.15, 0.06);
    pegboardGroup.add(cable);

    this.scene.add(pegboardGroup);
  }

  private buildSpeaker(): void {
    const speakerGroup = new THREE.Group();
    speakerGroup.position.set(1.1, 0.45, -0.4);

    // Speaker Cabinet
    const cabGeo = new THREE.BoxGeometry(0.42, 0.72, 0.42);
    const cabMat = new THREE.MeshStandardMaterial({
      color: 0x140f26,
      roughness: 0.4,
      metalness: 0.3,
    });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.y = 0.36;
    cab.castShadow = !this.isSoftwareGl;
    speakerGroup.add(cab);

    // Speaker Woofer Cone
    const wooferGeo = new THREE.CylinderGeometry(0.14, 0.06, 0.04, 24);
    const wooferMat = new THREE.MeshStandardMaterial({
      color: 0x2e1e4a,
      roughness: 0.2,
      metalness: 0.6,
    });
    const woofer = new THREE.Mesh(wooferGeo, wooferMat);
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(0, 0.32, 0.22);
    speakerGroup.add(woofer);

    // Tweeter Cone
    const tweeterGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const tweeterMat = new THREE.MeshStandardMaterial({ color: 0xec4899, metalness: 0.8 });
    const tweeter = new THREE.Mesh(tweeterGeo, tweeterMat);
    tweeter.position.set(0, 0.54, 0.22);
    speakerGroup.add(tweeter);

    // 3 Concentric Glowing Acoustic Sound Waves (Torus rings that pulse)
    for (let r = 0; r < 3; r++) {
      const ringGeo = new THREE.TorusGeometry(0.22 + r * 0.1, 0.012, 12, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.6 - r * 0.18,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 0.32, 0.25 + r * 0.04);
      speakerGroup.add(ring);

      this.speakerRings.push({
        mesh: ring,
        scale: 1 + r * 0.3,
        speed: 1.2 + r * 0.2,
      });
    }

    this.scene.add(speakerGroup);
  }

  private buildDiamondHotspots(): void {
    // 4 Floating glowing pink diamond markers (Octahedrons) matching reference image
    const hotspotConfigs = [
      {
        id: 'projects',
        label: 'Projects',
        pos: new THREE.Vector3(-0.6, 1.85, -0.2),
      },
      {
        id: 'experience',
        label: 'Experience & Badges',
        pos: new THREE.Vector3(1.4, 2.75, -1.6),
      },
      {
        id: 'about',
        label: 'Talk to Robot (About)',
        pos: new THREE.Vector3(-0.6, 1.85, 0.55),
      },
      {
        id: 'contact',
        label: 'Check Phone (Contact)',
        pos: new THREE.Vector3(-0.1, 1.25, 0.35),
      },
      {
        id: 'audio',
        label: 'Music & Ambience',
        pos: new THREE.Vector3(1.1, 1.35, -0.4),
      },
      {
        id: 'electromechanics',
        label: 'Electromechanics Blueprints',
        pos: new THREE.Vector3(2.85, 2.3, -1.5),
      },
    ];

    hotspotConfigs.forEach((cfg) => {
      const markerGroup = new THREE.Group();
      markerGroup.position.copy(cfg.pos);

      // Solid inner diamond
      const diaGeo = new THREE.OctahedronGeometry(0.08, 0);
      const diaMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        roughness: 0.1,
        metalness: 0.9,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.8,
      });
      const innerDia = new THREE.Mesh(diaGeo, diaMat);
      markerGroup.add(innerDia);

      // Wireframe outer diamond
      const wireGeo = new THREE.OctahedronGeometry(0.11, 0);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });
      const outerWire = new THREE.Mesh(wireGeo, wireMat);
      markerGroup.add(outerWire);

      // Invisible larger click collider sphere for easy tapping
      const colliderGeo = new THREE.SphereGeometry(0.24, 8, 8);
      const colliderMat = new THREE.MeshBasicMaterial({ visible: false });
      const collider = new THREE.Mesh(colliderGeo, colliderMat);
      collider.userData = { id: cfg.id, label: cfg.label };
      markerGroup.add(collider);

      this.scene.add(markerGroup);

      this.hotspots.push({
        mesh: markerGroup,
        id: cfg.id,
        label: cfg.label,
        baseY: cfg.pos.y,
      });
    });
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;

    // Pointer move for raycasting and robot head tracking
    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.checkHover();

      // Subtle robot head tracking towards cursor
      if (this.robotHead) {
        this.robotHead.rotation.y = THREE.MathUtils.clamp(-this.mouse.x * 0.45, -0.6, 0.6);
        this.robotHead.rotation.x = THREE.MathUtils.clamp(this.mouse.y * 0.3, -0.3, 0.3);
      }
    });

    // Pointer down / click
    canvas.addEventListener('click', () => {
      this.checkClick();
    });

    // Resize
    window.addEventListener('resize', () => {
      this.onResize();
    });
  }

  private checkHover(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const colliders = this.hotspots.map((h) => h.mesh.children[2]);
    const intersects = this.raycaster.intersectObjects(colliders);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const id = hit.userData.id as string;
      if (this.hoveredHotspotId !== id) {
        this.hoveredHotspotId = id;
        document.body.style.cursor = 'pointer';
        if (this.callbacks.onHoverHotspot) {
          this.callbacks.onHoverHotspot(id);
        }
      }
    } else {
      if (this.hoveredHotspotId !== null) {
        this.hoveredHotspotId = null;
        document.body.style.cursor = 'default';
        if (this.callbacks.onHoverHotspot) {
          this.callbacks.onHoverHotspot(null);
        }
      }
    }
  }

  private checkClick(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const colliders = this.hotspots.map((h) => h.mesh.children[2]);
    const intersects = this.raycaster.intersectObjects(colliders);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const id = hit.userData.id as string;
      this.selectSection(id);
    }
  }

  public selectSection(id: string): void {
    this.callbacks.onSelectHotspot(id);

    // Update text on monitor screen
    if (id === 'projects') this.currentMonitorText = 'PROJECTS';
    else if (id === 'about') this.currentMonitorText = 'ABOUT ME';
    else if (id === 'skills') this.currentMonitorText = 'SKILLS';
    else if (id === 'contact') this.currentMonitorText = 'CONTACT';
    else if (id === 'audio') this.currentMonitorText = 'LOFI BEATS';
    this.updateMonitorCanvas();

    // Camera target transitions based on selected hotspot (matching video views)
    switch (id) {
      case 'projects':
        // Zoom close in front of the curved monitor
        this.animateCameraTo(new THREE.Vector3(-0.6, 1.33, 0.72), new THREE.Vector3(-0.6, 1.32, -0.18));
        break;
      case 'experience':
        // Zoom in front of the pegboard with badges
        this.animateCameraTo(new THREE.Vector3(1.35, 1.76, -0.6), new THREE.Vector3(1.4, 1.76, -1.65));
        break;
      case 'about':
        // Zoom directly in front of the cute robot face
        this.animateCameraTo(new THREE.Vector3(-0.6, 1.58, 1.25), new THREE.Vector3(-0.6, 1.58, 0.55));
        break;
      case 'contact':
        // Zoom directly over the smartphone lying on the desk
        this.animateCameraTo(new THREE.Vector3(-0.1, 1.48, 0.65), new THREE.Vector3(-0.1, 0.9, 0.35));
        break;
      case 'audio':
        // Zoom in front of the Hi-Fi speaker
        this.animateCameraTo(new THREE.Vector3(1.1, 0.8, 0.7), new THREE.Vector3(1.1, 0.72, -0.4));
        break;
      case 'electromechanics':
        // Zoom in to inspect the electromechanical blueprints on the right wall
        this.animateCameraTo(new THREE.Vector3(2.5, 2.1, 0.6), new THREE.Vector3(2.85, 2.1, -1.74));
        break;
      default:
        this.resetCamera();
        break;
    }
  }

  public animateCameraTo(position: THREE.Vector3, target: THREE.Vector3): void {
    this.cameraTargetPos.copy(position);
    this.cameraTargetLook.copy(target);
    this.isAnimatingCamera = true;
  }

  public resetCamera(): void {
    this.currentMonitorText = 'PROJECTS';
    this.updateMonitorCanvas();
    this.animateCameraTo(new THREE.Vector3(0, 1.45, 4.6), new THREE.Vector3(0, 1.15, 0));
  }

  public pulseSpeaker(intensity: number): void {
    this.speakerRings.forEach((r) => {
      r.scale = 1.0 + intensity * 0.4;
    });
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    // Smooth camera damping to target
    if (this.isAnimatingCamera) {
      this.camera.position.lerp(this.cameraTargetPos, 0.06);
      this.controls.target.lerp(this.cameraTargetLook, 0.06);
      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.02) {
        this.isAnimatingCamera = false;
      }
    }
    this.controls.update();

    // Animate floating diamond markers (bobbing & slow rotation)
    this.hotspots.forEach((h, idx) => {
      const bob = Math.sin(elapsed * 2.2 + idx * 1.5) * 0.06;
      h.mesh.position.y = h.baseY + bob;
      h.mesh.children[0].rotation.y = elapsed * 1.5;
      h.mesh.children[1].rotation.y = -elapsed * 1.8;
      h.mesh.children[1].rotation.x = elapsed * 0.8;
    });

    // Animate robot gear ears & blinking
    if (this.robotLeftEarGear) this.robotLeftEarGear.rotation.x = elapsed * 2.0;
    if (this.robotRightEarGear) this.robotRightEarGear.rotation.x = -elapsed * 2.0;

    this.blinkTimer += delta;
    if (this.blinkTimer > 3.8) {
      this.updateRobotEyes(true);
      if (this.blinkTimer > 4.0) {
        this.updateRobotEyes(false);
        this.blinkTimer = 0;
      }
    }

    // Animate speaker rings (sound ripples)
    this.speakerRings.forEach((r, idx) => {
      r.scale += delta * 0.6 * r.speed;
      if (r.scale > 1.8) r.scale = 0.9;
      r.mesh.scale.set(r.scale, r.scale, r.scale);
      const ringMat = r.mesh.material as THREE.MeshBasicMaterial;
      ringMat.opacity = Math.max(0, 0.8 - (r.scale - 0.9) * 0.8);
    });

    // Subtle palm tree swaying outside the window
    if (this.palmTreesGroup) {
      this.palmTreesGroup.children.forEach((palm, pIdx) => {
        palm.rotation.z = Math.sin(elapsed * 1.2 + pIdx * 1.2) * 0.035;
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

  public onResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.renderer.dispose();
  }
}
