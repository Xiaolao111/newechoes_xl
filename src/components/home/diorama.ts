import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HOME_PROFILE } from "@/consts";
import {
  loadMusicPlaylist,
  next as playNextTrack,
  previous as playPreviousTrack,
  subscribeMusicPlayer,
  togglePlayback,
  type MusicPlayerState,
} from "@/lib/music/player";

const CLEANUP_KEY = "__homeDioramaCleanup";

type ThemeName = "light" | "dark";

type SeasonPal = {
  sun: number;
  sunI: number;
  amb: number;
  ambI: number;
  sky: number;
  plant: number;
  fogTint: number;
};

const SEASONS_LIGHT: SeasonPal[] = [
  { sun: 0xfff4e0, sunI: 1.55, amb: 0xfff4e6, ambI: 0.58, sky: 0xd8ecff, plant: 0x9fc970, fogTint: 0xeee4d0 },
  { sun: 0xfff8ea, sunI: 1.7,  amb: 0xfffaee, ambI: 0.62, sky: 0x9cd2f0, plant: 0x5a8e3e, fogTint: 0xf2e8d4 },
  { sun: 0xfff0dc, sunI: 1.5,  amb: 0xfff0e0, ambI: 0.56, sky: 0xb4c4d4, plant: 0xc8742a, fogTint: 0xd8d4cc },
  { sun: 0xf0f2f8, sunI: 1.35, amb: 0xeef0f4, ambI: 0.52, sky: 0xc4cfdc, plant: 0x8b5a32, fogTint: 0xdce0e4 },
];

const SEASONS_DARK: SeasonPal[] = [
  { sun: 0xffe4c8, sunI: 0.7,  amb: 0x4a4238, ambI: 0.4,  sky: 0x2a3a5a, plant: 0x6f9450, fogTint: 0x1a2230 },
  { sun: 0xfff0d8, sunI: 0.85, amb: 0x4a483c, ambI: 0.44, sky: 0x1a3a5a, plant: 0x3a6e28, fogTint: 0x182638 },
  { sun: 0xffd4a0, sunI: 0.7,  amb: 0x4a3a30, ambI: 0.4,  sky: 0x2a1e14, plant: 0x9a5418, fogTint: 0x181210 },
  { sun: 0xd8dcec, sunI: 0.55, amb: 0x3a3e4a, ambI: 0.38, sky: 0x1a2636, plant: 0x5a3a20, fogTint: 0x0c1628 },
];

type Theme = {
  floor: number;
  wall: number;
  ceiling: number;
  deskTop: number;
  deskLeg: number;
  lampBody: number;
  lampShade: number;
  lampGlow: number;
  laptopBody: number;
  laptopFrame: number;
  bookA: number;
  bookB: number;
  bookC: number;
  tvBody: number;
  tvEmissive: number;
  pot: number;
  personSkin: number;
  personHair: number;
  personCloth: number;
  screenBg: string;
  screenText: string;
  screenMuted: string;
  screenAccent: string;
  keyTop: number;
  windowFrame: number;
  windowSill: number;
  sceneBg: number;
};

const THEMES: Record<ThemeName, Theme> = {
  light: {
    floor: 0xb89068,
    wall: 0xe8dfc8,
    ceiling: 0xf2ebd8,
    deskTop: 0xb58863,
    deskLeg: 0x6b4a32,
    lampBody: 0x2a2420,
    lampShade: 0xe4a94a,
    lampGlow: 0xffd58a,
    laptopBody: 0x8a8d94,
    laptopFrame: 0x3a3e48,
    bookA: 0xb04444,
    bookB: 0x3e7d6a,
    bookC: 0xd4a94a,
    tvBody: 0x2a2a30,
    tvEmissive: 0xff8866,
    pot: 0x9a6b4a,
    personSkin: 0xeec8a8,
    personHair: 0x241811,
    personCloth: 0x4a6a8a,
    screenBg: "#0e0f14",
    screenText: "#f5f0e6",
    screenMuted: "#b8ac98",
    screenAccent: "#e4b95a",
    keyTop: 0x2a2a30,
    windowFrame: 0x6b4a32,
    windowSill: 0xa27c54,
    sceneBg: 0xede4cf,
  },
  dark: {
    floor: 0x4a3824,
    wall: 0x152131,
    ceiling: 0x1a2838,
    deskTop: 0x5a4432,
    deskLeg: 0x2a1e14,
    lampBody: 0x12100e,
    lampShade: 0xffb866,
    lampGlow: 0xffb866,
    laptopBody: 0x252a30,
    laptopFrame: 0x14161a,
    bookA: 0x7a3030,
    bookB: 0x2a5a4a,
    bookC: 0xb08830,
    tvBody: 0x0a0a10,
    tvEmissive: 0x4fbba7,
    pot: 0x5a3a28,
    personSkin: 0xa88060,
    personHair: 0x100a08,
    personCloth: 0x2a3a5a,
    screenBg: "#090a10",
    screenText: "#f5f0e6",
    screenMuted: "#9d8e7b",
    screenAccent: "#ffc878",
    keyTop: 0x0e0e12,
    windowFrame: 0x2a1e14,
    windowSill: 0x3a2a1c,
    sceneBg: 0x080c14,
  },
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type Interactive = {
  object: THREE.Object3D;
  label: string;
  route: string;
  basePos: THREE.Vector3;
  kind?: "music";
};

export function initDiorama() {
  if (typeof window === "undefined") return () => {};

  const prev = (window as unknown as Record<string, (() => void) | undefined>)[CLEANUP_KEY];
  if (typeof prev === "function") prev();

  const canvasEl = document.querySelector<HTMLCanvasElement>("[data-diorama-canvas]");
  if (!canvasEl) return () => {};

  const hintEl = document.querySelector<HTMLElement>("[data-diorama-hint]");
  const tooltip = document.querySelector<HTMLElement>("[data-diorama-tooltip]");
  const musicPlayer = document.querySelector<HTMLElement>(
    "[data-diorama-music-player]",
  );
  const musicCover = musicPlayer?.querySelector<HTMLImageElement>("[data-music-cover]");
  const musicTitle = musicPlayer?.querySelector<HTMLElement>("[data-music-title]");
  const musicArtist = musicPlayer?.querySelector<HTMLElement>("[data-music-artist]");
  const musicError = musicPlayer?.querySelector<HTMLElement>("[data-music-error]");
  const musicToggle = musicPlayer?.querySelector<HTMLButtonElement>("[data-music-toggle]");
  const musicPrevious = musicPlayer?.querySelector<HTMLButtonElement>("[data-music-previous]");
  const musicNext = musicPlayer?.querySelector<HTMLButtonElement>("[data-music-next]");
  const musicPlayIcon = musicPlayer?.querySelector<SVGElement>("[data-music-play-icon]");
  const musicPauseIcon = musicPlayer?.querySelector<SVGElement>("[data-music-pause-icon]");

  let musicPlayerHovered = false;
  let musicHideTimer = 0;
  let musicIsPlaying = false;

  const renderMusicPlayer = (state: MusicPlayerState) => {
    musicIsPlaying = state.isPlaying;
    if (musicCover) {
      musicCover.src = state.track.cover;
      musicCover.alt = `${state.track.title} 封面`;
    }
    if (musicTitle) musicTitle.textContent = state.track.title;
    if (musicArtist) musicArtist.textContent = state.track.artist;
    if (musicError) musicError.textContent = state.error ?? "";
    if (musicToggle) musicToggle.ariaLabel = state.isPlaying ? "暂停" : "播放";
    if (musicPlayIcon) musicPlayIcon.hidden = state.isPlaying;
    if (musicPauseIcon) musicPauseIcon.hidden = !state.isPlaying;
  };

  const unsubscribeMusicPlayer = subscribeMusicPlayer(renderMusicPlayer);
  void loadMusicPlaylist();

  const cancelMusicHide = () => {
    if (!musicHideTimer) return;
    window.clearTimeout(musicHideTimer);
    musicHideTimer = 0;
  };

  const showMusicPlayer = (clientX: number, clientY: number) => {
    if (!musicPlayer) return;
    cancelMusicHide();
    if (!musicPlayer.classList.contains("is-visible")) {
      const panelWidth = Math.min(336, window.innerWidth - 32);
      const left = Math.min(clientX + 18, window.innerWidth - panelWidth - 16);
      const top = Math.min(clientY + 18, window.innerHeight - 150);
      musicPlayer.style.left = `${Math.max(16, left)}px`;
      musicPlayer.style.top = `${Math.max(72, top)}px`;
    }
    musicPlayer.classList.add("is-visible");
    musicPlayer.setAttribute("aria-hidden", "false");
  };

  const hideMusicPlayer = () => {
    if (!musicPlayer || musicPlayerHovered) return;
    musicPlayer.classList.remove("is-visible");
    musicPlayer.setAttribute("aria-hidden", "true");
  };

  const scheduleMusicHide = () => {
    cancelMusicHide();
    musicHideTimer = window.setTimeout(hideMusicPlayer, 180);
  };

  const musicMouseEnter = () => {
    musicPlayerHovered = true;
    cancelMusicHide();
  };
  const musicMouseLeave = () => {
    musicPlayerHovered = false;
    scheduleMusicHide();
  };
  const musicToggleHandler = () => void togglePlayback();
  const musicPreviousHandler = () => void playPreviousTrack();
  const musicNextHandler = () => void playNextTrack();

  musicPlayer?.addEventListener("mouseenter", musicMouseEnter);
  musicPlayer?.addEventListener("mouseleave", musicMouseLeave);
  musicToggle?.addEventListener("click", musicToggleHandler);
  musicPrevious?.addEventListener("click", musicPreviousHandler);
  musicNext?.addEventListener("click", musicNextHandler);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd8ecff, 7, 16);

  // ===== Camera (inside-the-room view, wide framing) =====
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  camera.position.set(1.15, 1.95, 1.55);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.set(0, 0.5, -0.6);
  controls.minPolarAngle = Math.PI * 0.22;
  controls.maxPolarAngle = Math.PI * 0.5;
  // No azimuth limits — user can orbit freely around the diorama
  controls.rotateSpeed = 0.75;

  // ===== Lights =====
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
  sunLight.position.set(3, 5, 1.5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.3;
  sunLight.shadow.camera.far = 14;
  sunLight.shadow.camera.left = -4;
  sunLight.shadow.camera.right = 4;
  sunLight.shadow.camera.top = 4;
  sunLight.shadow.camera.bottom = -3;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const windowLight = new THREE.DirectionalLight(0xffffff, 0.55);
  windowLight.position.set(0, 2, -5);
  windowLight.target.position.set(0, 0.5, 0);
  scene.add(windowLight);
  scene.add(windowLight.target);

  const lampLight = new THREE.PointLight(0xffd58a, 0.85, 4, 1.6);
  lampLight.position.set(-1.1, 0.85, -0.6);
  scene.add(lampLight);

  const screenLight = new THREE.PointLight(0xede8df, 0.3, 1.2, 1.5);
  screenLight.position.set(0.1, 0.6, -0.25);
  scene.add(screenLight);

  // ===== Materials =====
  const mats = {
    floor: new THREE.MeshStandardMaterial({ color: 0xb89068, roughness: 0.92 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.96 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xf2ebd8, roughness: 0.98 }),
    deskTop: new THREE.MeshToonMaterial({ color: 0xb58863 }),
    deskLeg: new THREE.MeshToonMaterial({ color: 0x6b4a32 }),
    lampBody: new THREE.MeshToonMaterial({ color: 0x2a2420 }),
    lampShade: new THREE.MeshToonMaterial({ color: 0xe4a94a, side: THREE.DoubleSide }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xffeaa0, emissive: 0xffd58a, emissiveIntensity: 0.5, roughness: 0.25 }),
    laptopBody: new THREE.MeshToonMaterial({ color: 0x8a8d94 }),
    laptopFrame: new THREE.MeshToonMaterial({ color: 0x3a3e48 }),
    screen: null as unknown as THREE.MeshBasicMaterial,
    windowFrame: new THREE.MeshToonMaterial({ color: 0x6b4a32 }),
    windowSill: new THREE.MeshToonMaterial({ color: 0xa27c54 }),
    sky: new THREE.MeshBasicMaterial({ color: 0xd8ecff }),
    books: [
      new THREE.MeshToonMaterial({ color: 0xb04444 }),
      new THREE.MeshToonMaterial({ color: 0x3e7d6a }),
      new THREE.MeshToonMaterial({ color: 0xd4a94a }),
    ],
    tvBody: new THREE.MeshToonMaterial({ color: 0x2a2a30 }),
    pot: new THREE.MeshToonMaterial({ color: 0x9a6b4a }),
    leaf: new THREE.MeshToonMaterial({ color: 0x9fc970, side: THREE.DoubleSide }),
    personSkin: new THREE.MeshToonMaterial({ color: 0xeec8a8 }),
    personHair: new THREE.MeshToonMaterial({ color: 0x241811 }),
    personCloth: new THREE.MeshToonMaterial({ color: 0x4a6a8a }),
    key: new THREE.MeshToonMaterial({ color: 0x2a2a30 }),
    petal: new THREE.MeshBasicMaterial({ color: 0xffc8dc, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    rain: new THREE.MeshBasicMaterial({ color: 0xaec8e0, transparent: true, opacity: 0 }),
    mapleLeaf: new THREE.MeshBasicMaterial({ color: 0xd46830, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    snow: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  };

  // ===== Room =====
  const roomX = 3.2;
  const roomFloorY = -0.5;
  const roomCeilingY = 3.4;
  const roomBackZ = -2.8;
  const roomFrontZ = 1.6;

  // Floor (bounded interior)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomX * 2, roomFrontZ - roomBackZ),
    mats.floor,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, roomFloorY, (roomBackZ + roomFrontZ) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(roomX * 2, roomFrontZ - roomBackZ),
    mats.ceiling,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, roomCeilingY, (roomBackZ + roomFrontZ) / 2);
  scene.add(ceiling);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(roomFrontZ - roomBackZ, roomCeilingY - roomFloorY),
    mats.wall,
  );
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-roomX, (roomFloorY + roomCeilingY) / 2, (roomBackZ + roomFrontZ) / 2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(roomFrontZ - roomBackZ, roomCeilingY - roomFloorY),
    mats.wall,
  );
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(roomX, (roomFloorY + roomCeilingY) / 2, (roomBackZ + roomFrontZ) / 2);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Back wall: slim strips framing a near floor-to-ceiling window opening.
  const winW = 3.15;
  const winCx = 0;
  const wB = roomFloorY + 0.08;
  const wT = roomCeilingY - 0.18;
  const winH = wT - wB;
  const winCy = (wT + wB) / 2;
  const wL = winCx - winW / 2;
  const wR = winCx + winW / 2;

  const topStripH = roomCeilingY - wT;
  const topStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(roomX * 2, topStripH),
    mats.wall,
  );
  topStrip.position.set(0, (wT + roomCeilingY) / 2, roomBackZ);
  topStrip.receiveShadow = true;
  scene.add(topStrip);

  const botStripH = wB - roomFloorY;
  const botStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(roomX * 2, botStripH),
    mats.wall,
  );
  botStrip.position.set(0, (wB + roomFloorY) / 2, roomBackZ);
  botStrip.receiveShadow = true;
  scene.add(botStrip);

  const sideStripW = roomX - winW / 2;
  const leftStripBack = new THREE.Mesh(
    new THREE.PlaneGeometry(sideStripW, winH),
    mats.wall,
  );
  leftStripBack.position.set(-roomX + sideStripW / 2, winCy, roomBackZ);
  leftStripBack.receiveShadow = true;
  scene.add(leftStripBack);

  const rightStripBack = new THREE.Mesh(
    new THREE.PlaneGeometry(sideStripW, winH),
    mats.wall,
  );
  rightStripBack.position.set(roomX - sideStripW / 2, winCy, roomBackZ);
  rightStripBack.receiveShadow = true;
  scene.add(rightStripBack);

  // ===== Floor-to-ceiling window (frame, 4 panes, floor threshold) =====
  const winFrame = new THREE.Group();
  const frameT = 0.11;
  const frameDepth = 0.12;

  // Outer frame (around opening)
  const outerTop = new THREE.Mesh(
    new THREE.BoxGeometry(winW + frameT * 2, frameT, frameDepth),
    mats.windowFrame,
  );
  outerTop.position.set(winCx, wT + frameT / 2, roomBackZ + 0.02);
  outerTop.castShadow = true;
  winFrame.add(outerTop);

  const outerBot = new THREE.Mesh(
    new THREE.BoxGeometry(winW + frameT * 2, frameT, frameDepth),
    mats.windowFrame,
  );
  outerBot.position.set(winCx, wB - frameT / 2, roomBackZ + 0.02);
  winFrame.add(outerBot);

  const outerL = new THREE.Mesh(
    new THREE.BoxGeometry(frameT, winH + frameT * 2, frameDepth),
    mats.windowFrame,
  );
  outerL.position.set(wL - frameT / 2, winCy, roomBackZ + 0.02);
  winFrame.add(outerL);

  const outerR = new THREE.Mesh(
    new THREE.BoxGeometry(frameT, winH + frameT * 2, frameDepth),
    mats.windowFrame,
  );
  outerR.position.set(wR + frameT / 2, winCy, roomBackZ + 0.02);
  winFrame.add(outerR);

  // Cross mullions: vertical + horizontal → 4 panes
  const mullT = 0.045;
  const vMullion = new THREE.Mesh(
    new THREE.BoxGeometry(mullT, winH, frameDepth * 0.7),
    mats.windowFrame,
  );
  vMullion.position.set(winCx, winCy, roomBackZ + 0.04);
  winFrame.add(vMullion);

  const hMullion = new THREE.Mesh(
    new THREE.BoxGeometry(winW, mullT, frameDepth * 0.7),
    mats.windowFrame,
  );
  hMullion.position.set(winCx, winCy, roomBackZ + 0.04);
  winFrame.add(hMullion);

  // A shallow floor threshold replaces the raised windowsill.
  const sillW = winW + frameT * 2 + 0.18;
  const sillDepth = 0.22;
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(sillW, 0.05, sillDepth),
    mats.windowSill,
  );
  sill.position.set(winCx, wB - frameT - 0.025, roomBackZ + sillDepth / 2 - 0.02);
  sill.castShadow = true;
  sill.receiveShadow = true;
  winFrame.add(sill);

  scene.add(winFrame);

  // Window hitbox for raycast
  const windowHitbox = new THREE.Mesh(
    new THREE.PlaneGeometry(winW, winH),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  windowHitbox.position.set(winCx, winCy, roomBackZ + 0.05);
  scene.add(windowHitbox);

  // ===== Outside (sky + beach + sea + sun + clouds + particles) =====
  const skyPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 9),
    mats.sky,
  );
  skyPlane.position.set(0, 2, roomBackZ - 3);
  scene.add(skyPlane);

  // Layered seaside view, composed from back to front.
  const seaMaterial = new THREE.MeshBasicMaterial({ color: 0x58aeca });
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 1.9),
    seaMaterial,
  );
  sea.position.set(0, 0.55, roomBackZ - 2.55);
  scene.add(sea);

  const beachMaterial = new THREE.MeshBasicMaterial({ color: 0xe7c58d });
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 1.05),
    beachMaterial,
  );
  beach.position.set(0, -0.1, roomBackZ - 1.95);
  scene.add(beach);

  // A low island silhouette breaks up the horizon.
  const islandShape = new THREE.Shape();
  islandShape.moveTo(-1.25, 0);
  islandShape.bezierCurveTo(-0.9, 0.08, -0.72, 0.32, -0.42, 0.28);
  islandShape.bezierCurveTo(-0.12, 0.5, 0.18, 0.46, 0.38, 0.25);
  islandShape.bezierCurveTo(0.7, 0.3, 0.92, 0.1, 1.25, 0);
  islandShape.lineTo(-1.25, 0);
  const islandMaterial = new THREE.MeshBasicMaterial({ color: 0x55765a });
  const island = new THREE.Mesh(
    new THREE.ShapeGeometry(islandShape, 12),
    islandMaterial,
  );
  island.position.set(-0.65, 1.28, roomBackZ - 2.2);
  island.scale.set(0.75, 0.75, 1);
  scene.add(island);

  // Soft animated foam lines where the sea meets the sand.
  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xf8fbf6,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  type BeachWaveData = { mesh: THREE.Mesh; baseX: number; phase: number };
  const beachWaveData: BeachWaveData[] = [];
  const makeFoamShape = (width: number, thickness: number, phase: number) => {
    const shape = new THREE.Shape();
    const points = 28;
    for (let i = 0; i <= points; i++) {
      const x = -width / 2 + (width * i) / points;
      const y = Math.sin((i / points) * Math.PI * 4 + phase) * 0.025;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    for (let i = points; i >= 0; i--) {
      const x = -width / 2 + (width * i) / points;
      const y =
        Math.sin((i / points) * Math.PI * 4 + phase) * 0.025 - thickness;
      shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  };
  [
    { y: 0.52, width: 4.8, phase: 0 },
    { y: 0.7, width: 4.2, phase: 1.7 },
    { y: 0.88, width: 3.6, phase: 3.1 },
  ].forEach((wave, index) => {
    const foam = new THREE.Mesh(
      makeFoamShape(wave.width, 0.025, wave.phase),
      foamMaterial,
    );
    const baseX = index % 2 === 0 ? -0.25 : 0.35;
    // Keep foam in front of the sea but behind the foreground beach.
    foam.position.set(baseX, wave.y, roomBackZ - 2.08 + index * 0.015);
    beachWaveData.push({ mesh: foam, baseX, phase: wave.phase });
    scene.add(foam);
  });

  // Sun (bright disc, visible through window on sunny seasons)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffe8a4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  sunDisc.position.set(0.7, 2.8, roomBackZ - 2.6);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffd880,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  sunGlow.position.set(0.7, 2.8, roomBackZ - 2.65);
  scene.add(sunGlow);

  // Drifting clouds (soft planes) — always present, cross-fade intensity by season
  const cloudsGroup = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  type CloudData = { mesh: THREE.Mesh; speed: number; baseY: number };
  const cloudData: CloudData[] = [];
  for (let i = 0; i < 5; i++) {
    const w = 1.2 + Math.random() * 0.8;
    const h = 0.35 + Math.random() * 0.2;
    const geo = new THREE.PlaneGeometry(w, h);
    const cloud = new THREE.Mesh(geo, cloudMat);
    const x = (i - 2) * 1.8 + (Math.random() - 0.5) * 0.6;
    const y = 2.6 + Math.random() * 0.8;
    const z = roomBackZ - 2.4 - i * 0.18;
    cloud.position.set(x, y, z);
    cloudData.push({ mesh: cloud, speed: 0.03 + Math.random() * 0.05, baseY: y });
    cloudsGroup.add(cloud);
  }
  scene.add(cloudsGroup);

  // ===== Seasonal particle systems =====
  const particleCount = window.innerWidth < 768 ? 28 : 60;

  function makePetalGeo() {
    // soft teardrop oval
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.055);
    shape.bezierCurveTo(0.05, 0.04, 0.035, -0.03, 0, -0.055);
    shape.bezierCurveTo(-0.035, -0.03, -0.05, 0.04, 0, 0.055);
    return new THREE.ShapeGeometry(shape, 8);
  }
  function makeRainGeo() {
    return new THREE.PlaneGeometry(0.006, 0.16);
  }
  function makeMapleGeo() {
    // stylized 5-pointed leaf
    const shape = new THREE.Shape();
    const points: [number, number][] = [
      [0, 0.09], [0.05, 0.055], [0.085, 0.065], [0.06, 0.01],
      [0.1, -0.02], [0.055, -0.03], [0.035, -0.09], [0, -0.05],
      [-0.035, -0.09], [-0.055, -0.03], [-0.1, -0.02], [-0.06, 0.01],
      [-0.085, 0.065], [-0.05, 0.055], [0, 0.09],
    ];
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    return new THREE.ShapeGeometry(shape);
  }
  function makeSnowGeo() {
    return new THREE.CircleGeometry(0.03, 6);
  }

  type ParticleSystem = {
    mesh: THREE.InstancedMesh;
    material: THREE.MeshBasicMaterial;
    positions: Float32Array;
    rotations: Float32Array;
    rotVel: Float32Array;
    phases: Float32Array;
    fall: number;
    sway: number;
    tumble: boolean;
    rotateFace: boolean; // rain: face camera (no rotation)
  };

  function buildParticleSystem(
    geo: THREE.BufferGeometry,
    mat: THREE.MeshBasicMaterial,
    fall: number,
    sway: number,
    tumble: boolean,
    rotateFace: boolean,
  ): ParticleSystem {
    const mesh = new THREE.InstancedMesh(geo, mat, particleCount);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const positions = new Float32Array(particleCount * 3);
    const rotations = new Float32Array(particleCount);
    const rotVel = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 5 - 0.3;
      positions[i * 3 + 2] = roomBackZ - 0.6 - Math.random() * 2.4;
      rotations[i] = Math.random() * Math.PI * 2;
      rotVel[i] = (Math.random() - 0.5) * 0.05;
      phases[i] = Math.random() * Math.PI * 2;
    }
    scene.add(mesh);
    return { mesh, material: mat, positions, rotations, rotVel, phases, fall, sway, tumble, rotateFace };
  }

  const particleSystems = {
    spring: buildParticleSystem(makePetalGeo(), mats.petal, 0.3, 0.55, true, false),
    summer: buildParticleSystem(makeRainGeo(), mats.rain, 1.8, 0.02, false, true),
    autumn: buildParticleSystem(makeMapleGeo(), mats.mapleLeaf, 0.5, 0.45, true, false),
    winter: buildParticleSystem(makeSnowGeo(), mats.snow, 0.5, 0.18, false, true),
  };

  // ===== Desk =====
  const desk = new THREE.Group();
  const deskW = 3.8;
  const deskD = 1.9;
  const deskTopH = 0.08;
  const deskTopY = 0.22; // top surface at y=0.26 world, so thighs clear underneath

  const deskTopMesh = new THREE.Mesh(
    new THREE.BoxGeometry(deskW, deskTopH, deskD),
    mats.deskTop,
  );
  deskTopMesh.position.y = deskTopY;
  deskTopMesh.castShadow = true;
  deskTopMesh.receiveShadow = true;
  desk.add(deskTopMesh);

  // Legs: from floor y=-0.5 to desk bottom y=0.18. Height 0.68, center y=-0.16.
  const legH = 0.68;
  const legW = 0.1;
  [[-deskW / 2 + 0.1, -deskD / 2 + 0.1], [deskW / 2 - 0.1, -deskD / 2 + 0.1],
   [-deskW / 2 + 0.1, deskD / 2 - 0.1], [deskW / 2 - 0.1, deskD / 2 - 0.1]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), mats.deskLeg);
    leg.position.set(x, -0.16, z);
    leg.castShadow = true;
    desk.add(leg);
  });
  desk.position.set(0, 0, -0.6);
  scene.add(desk);
  const deskTopWorldY = desk.position.y + deskTopY + deskTopH / 2; // world y of top surface

  // ===== Lamp (→ /articles) =====
  const lamp = new THREE.Group();
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.05, 18),
    mats.lampBody,
  );
  lampBase.position.y = 0.025;
  lampBase.castShadow = true;
  lamp.add(lampBase);

  const lampArm1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.8, 10),
    mats.lampBody,
  );
  lampArm1.position.y = 0.45;
  lampArm1.castShadow = true;
  lamp.add(lampArm1);

  const lampJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 10),
    mats.lampBody,
  );
  lampJoint.position.y = 0.85;
  lamp.add(lampJoint);

  const lampArm2Len = 0.4;
  const lampArm2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, lampArm2Len, 10),
    mats.lampBody,
  );
  // arm2 tilts forward-down from joint
  lampArm2.position.set(0.13, 0.98, 0.12);
  lampArm2.rotation.x = 0.55;
  lampArm2.rotation.z = -0.45;
  lampArm2.castShadow = true;
  lamp.add(lampArm2);

  // Shade: apex UP (attachment), base DOWN (light emits down) — default ConeGeo orientation
  // Tilt it to match arm2's end direction (slightly forward-down)
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.28, 22, 1, true),
    mats.lampShade,
  );
  shade.position.set(0.28, 1.12, 0.22);
  shade.rotation.x = 0.3;
  shade.rotation.z = -0.35;
  shade.castShadow = true;
  lamp.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 14, 12),
    mats.bulb,
  );
  bulb.position.set(0.31, 1.0, 0.26);
  lamp.add(bulb);

  lamp.position.set(-1.2, deskTopWorldY, -0.9);
  scene.add(lamp);

  // ===== Laptop (→ /projects) =====
  const laptop = new THREE.Group();

  const lpBaseW = 1.1;
  const lpBaseD = 0.76;
  const lpBaseH = 0.034;

  const lpBase = new THREE.Mesh(
    new THREE.BoxGeometry(lpBaseW, lpBaseH, lpBaseD),
    mats.laptopBody,
  );
  lpBase.position.y = lpBaseH / 2 + 0.002;
  lpBase.castShadow = true;
  lpBase.receiveShadow = true;
  laptop.add(lpBase);

  // Screen (hinged at back edge)
  const lpScreenGroup = new THREE.Group();
  lpScreenGroup.position.set(0, lpBaseH + 0.005, -lpBaseD / 2 + 0.02);
  const lpScreenW = 1.05;
  const lpScreenH = 0.68;
  const lpScreenT = 0.017;
  const lpScreenBody = new THREE.Mesh(
    new THREE.BoxGeometry(lpScreenW, lpScreenH, lpScreenT),
    mats.laptopFrame,
  );
  lpScreenBody.position.y = lpScreenH / 2;
  lpScreenBody.position.z = -lpScreenT / 2;
  lpScreenBody.castShadow = true;
  lpScreenGroup.add(lpScreenBody);

  // Screen canvas texture (1024×640 logical — fast to regen, crisp enough with high aniso)
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 1024;
  screenCanvas.height = 640;
  const screenCtx = screenCanvas.getContext("2d")!;
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);
  screenTexture.generateMipmaps = false;
  screenTexture.minFilter = THREE.LinearFilter;
  screenTexture.magFilter = THREE.LinearFilter;
  mats.screen = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });

  const screenFace = new THREE.Mesh(
    new THREE.PlaneGeometry(lpScreenW - 0.06, lpScreenH - 0.06),
    mats.screen,
  );
  screenFace.position.set(0, lpScreenH / 2, 0.002);
  lpScreenGroup.add(screenFace);

  lpScreenGroup.rotation.x = -0.22;
  laptop.add(lpScreenGroup);

  // Keyboard (InstancedMesh)
  const cols = 11;
  const rows = 4;
  const keyW = 0.066;
  const keyD = 0.058;
  const keyH = 0.011;
  const keyGapX = 0.01;
  const keyGapZ = 0.011;
  const kbW = cols * keyW + (cols - 1) * keyGapX;
  const kbX0 = -kbW / 2;
  const kbZ0 = -0.28; // starting z (toward hinge)
  const totalKeys = rows * cols + 1;
  const keyGeo = new THREE.BoxGeometry(keyW, keyH, keyD);
  const keyMesh = new THREE.InstancedMesh(keyGeo, mats.key, totalKeys);
  keyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  keyMesh.castShadow = true;
  const keyStates: { baseY: number; press: number; x: number; z: number; side: -1 | 1 }[] = [];
  const keyBaseY = lpBaseH + keyH / 2 + 0.003;
  const keyDummy = new THREE.Object3D();
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = kbX0 + c * (keyW + keyGapX) + keyW / 2;
      const z = kbZ0 + r * (keyD + keyGapZ) + keyD / 2;
      const side: -1 | 1 = c < cols / 2 ? -1 : 1;
      keyStates.push({ baseY: keyBaseY, press: 0, x, z, side });
      keyDummy.position.set(x, keyBaseY, z);
      keyDummy.updateMatrix();
      keyMesh.setMatrixAt(k++, keyDummy.matrix);
    }
  }
  // Space bar
  const spaceW = keyW * 5 + keyGapX * 4;
  const spaceZ = kbZ0 + rows * (keyD + keyGapZ) + keyD / 2;
  keyStates.push({ baseY: keyBaseY, press: 0, x: 0, z: spaceZ, side: 1 });
  keyDummy.position.set(0, keyBaseY, spaceZ);
  keyDummy.scale.set(spaceW / keyW, 1, 1);
  keyDummy.updateMatrix();
  keyMesh.setMatrixAt(k++, keyDummy.matrix);
  keyDummy.scale.set(1, 1, 1);
  keyMesh.instanceMatrix.needsUpdate = true;
  laptop.add(keyMesh);

  // Trackpad (visual only)
  const trackpad = new THREE.Mesh(
    new THREE.BoxGeometry(0.33, 0.002, 0.18),
    mats.laptopFrame,
  );
  trackpad.position.set(0, lpBaseH + 0.002, 0.245);
  laptop.add(trackpad);

  laptop.position.set(0.1, deskTopWorldY, -0.2);
  scene.add(laptop);

  // ===== Coffee cup (right side of desk) =====
  const coffeeCup = new THREE.Group();
  const cupCeramicMaterial = new THREE.MeshToonMaterial({ color: 0xf1e4d2 });
  const coffeeMaterial = new THREE.MeshBasicMaterial({ color: 0x4a2818 });
  const iceMaterial = new THREE.MeshToonMaterial({
    color: 0xd9f2f5,
    transparent: true,
    opacity: 0.78,
  });
  const steamMaterial = new THREE.MeshBasicMaterial({
    color: 0xc7d0d3,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });

  // A small, straight-sided everyday mug.
  const cupBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.22, 24, 1, true),
    cupCeramicMaterial,
  );
  cupBody.position.y = 0.11;
  cupBody.castShadow = true;
  cupBody.receiveShadow = true;
  coffeeCup.add(cupBody);

  const cupRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.105, 0.01, 8, 28),
    cupCeramicMaterial,
  );
  cupRim.rotation.x = Math.PI / 2;
  cupRim.position.y = 0.22;
  cupRim.castShadow = true;
  coffeeCup.add(cupRim);

  const coffeeSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.092, 28),
    coffeeMaterial,
  );
  coffeeSurface.rotation.x = -Math.PI / 2;
  coffeeSurface.position.y = 0.219;
  coffeeCup.add(coffeeSurface);

  const cupHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.016, 8, 22),
    cupCeramicMaterial,
  );
  // Keep the loop in a vertical radial plane so it projects out from the mug,
  // rather than lying tangent to the cup wall.
  cupHandle.position.set(0.115, 0.115, 0);
  cupHandle.scale.set(1, 1.08, 1);
  cupHandle.castShadow = true;
  coffeeCup.add(cupHandle);

  // Ice cubes sit partly above the coffee surface in light mode.
  const iceCubes = new THREE.Group();
  [
    { x: -0.035, z: -0.02, ry: 0.35 },
    { x: 0.035, z: 0.018, ry: -0.42 },
    { x: 0.005, z: -0.05, ry: 0.8 },
  ].forEach(({ x, z, ry }, index) => {
    const ice = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.036, 0.052),
      iceMaterial,
    );
    ice.position.set(x, 0.232 + index * 0.002, z);
    ice.rotation.set(index * 0.08, ry, index * 0.06);
    ice.castShadow = true;
    iceCubes.add(ice);
  });
  coffeeCup.add(iceCubes);

  // Night mode swaps the ice for two soft curls of steam.
  const coffeeSteam = new THREE.Group();
  [-0.026, 0.026].forEach((x, index) => {
    const steamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 0.235, 0),
      new THREE.Vector3(x + 0.018, 0.31, 0),
      new THREE.Vector3(x - 0.015, 0.39, 0),
      new THREE.Vector3(x + 0.012, 0.47, 0),
    ]);
    const steam = new THREE.Mesh(
      new THREE.TubeGeometry(steamCurve, 18, 0.0045, 5, false),
      steamMaterial,
    );
    steam.position.z = index === 0 ? -0.012 : 0.012;
    coffeeSteam.add(steam);
  });
  coffeeSteam.visible = false;
  coffeeCup.add(coffeeSteam);

  coffeeCup.position.set(0.95, deskTopWorldY, -0.2);
  coffeeCup.rotation.y = -0.12;
  scene.add(coffeeCup);

  // ===== Closed notebook (desk-right corner → /articles) =====
  const deskNotebook = new THREE.Group();
  const notebookCoverMaterial = new THREE.MeshToonMaterial({ color: 0x496b67 });
  const notebookPageMaterial = new THREE.MeshToonMaterial({ color: 0xeee7d7 });
  const notebookDetailMaterial = new THREE.MeshToonMaterial({ color: 0xc8a66a });

  const notebookPages = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.052, 0.3),
    notebookPageMaterial,
  );
  notebookPages.position.y = 0.045;
  notebookPages.castShadow = true;
  deskNotebook.add(notebookPages);

  [0.012, 0.08].forEach((y) => {
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.018, 0.34),
      notebookCoverMaterial,
    );
    cover.position.y = y;
    cover.castShadow = true;
    deskNotebook.add(cover);
  });

  const notebookSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.086, 0.35),
    notebookCoverMaterial,
  );
  notebookSpine.position.set(-0.235, 0.045, 0);
  notebookSpine.castShadow = true;
  deskNotebook.add(notebookSpine);

  // A narrow elastic strap and a small cover label.
  const notebookStrap = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.012, 0.35),
    notebookDetailMaterial,
  );
  notebookStrap.position.set(0.15, 0.096, 0);
  deskNotebook.add(notebookStrap);

  const notebookLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.09),
    notebookPageMaterial,
  );
  notebookLabel.rotation.x = -Math.PI / 2;
  notebookLabel.position.set(-0.02, 0.092, -0.015);
  deskNotebook.add(notebookLabel);

  deskNotebook.position.set(1.48, deskTopWorldY, 0.08);
  deskNotebook.rotation.y = 0.14;
  scene.add(deskNotebook);

  // ===== Sleeping orange-and-white cat (→ /articles) =====
  // Procedural low-poly model based on the owner's mostly-white ginger cat.
  const sleepingCat = new THREE.Group();
  const catWhite = new THREE.MeshToonMaterial({ color: 0xf5f1e8 });
  const catGinger = new THREE.MeshToonMaterial({ color: 0xc8793c });
  const catLightGinger = new THREE.MeshToonMaterial({ color: 0xe4a064 });
  const catPink = new THREE.MeshToonMaterial({ color: 0xd99b91 });
  const catDark = new THREE.MeshBasicMaterial({ color: 0x30251f });

  const catBodyBaseScale = new THREE.Vector3(1.15, 0.62, 0.85);
  const catBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 24, 16),
    catWhite,
  );
  catBody.scale.copy(catBodyBaseScale);
  catBody.position.set(0.08, 0.22, -0.01);
  catBody.castShadow = true;
  catBody.receiveShadow = true;
  sleepingCat.add(catBody);

  // The ginger rump is sunk deeply into the white body instead of sitting
  // above it, so the colour transition reads as one continuous coat.
  const rumpPatch = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 18, 12),
    catGinger,
  );
  rumpPatch.scale.set(0.8, 0.72, 0.78);
  rumpPatch.position.set(0.33, 0.24, -0.055);
  rumpPatch.castShadow = true;
  sleepingCat.add(rumpPatch);

  // Colour the forehead directly on the sphere vertices. Unlike an overlay
  // mesh, the ginger fringe now follows the exact curvature of the head.
  const catHeadGeometry = new THREE.SphereGeometry(0.2, 40, 24);
  const headPositions = catHeadGeometry.getAttribute("position");
  const headColors = new Float32Array(headPositions.count * 3);
  const headWhiteColor = new THREE.Color(0xf5f1e8);
  const headGingerColor = new THREE.Color(0xc8793c);
  for (let i = 0; i < headPositions.count; i += 1) {
    const nx = headPositions.getX(i) / 0.2;
    const ny = headPositions.getY(i) / 0.2;
    const nz = headPositions.getZ(i) / 0.2;
    const absX = Math.abs(nx);

    // Each lock starts near the middle of the crown and opens outward as it
    // descends, forming a curved 八字 pattern with a narrow white centre.
    const descent = clamp((0.58 - ny) / 0.72);
    const lockCenter = 0.16 + descent * 0.3;
    const lockHalfWidth = 0.12 + descent * 0.06;
    const onFront = nz > 0.22;
    const inLock =
      ny > 0.2 &&
      ny < 0.72 &&
      Math.abs(absX - lockCenter) < lockHalfWidth;
    const onCrown = ny >= 0.5 && absX > 0.08 && absX < 0.82;
    const color = onFront && (inLock || onCrown)
      ? headGingerColor
      : headWhiteColor;

    headColors[i * 3] = color.r;
    headColors[i * 3 + 1] = color.g;
    headColors[i * 3 + 2] = color.b;
  }
  catHeadGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(headColors, 3),
  );
  const catHeadMaterial = new THREE.MeshToonMaterial({ vertexColors: true });
  const catHead = new THREE.Mesh(catHeadGeometry, catHeadMaterial);
  catHead.scale.set(1, 0.88, 0.94);
  catHead.position.set(-0.28, 0.25, 0.12);
  catHead.castShadow = true;
  sleepingCat.add(catHead);

  const catEarGinger = new THREE.MeshToonMaterial({
    color: 0xc8793c,
    side: THREE.DoubleSide,
  });
  const catEarPink = new THREE.MeshToonMaterial({
    color: 0xd99b91,
    side: THREE.DoubleSide,
  });
  const makeCatEar = (x: number, rotationZ: number) => {
    // The orange frame and pink centre tile the same flat surface. The hole
    // prevents overlap, so the inner colour is part of the ear, not a layer.
    const outerEarShape = new THREE.Shape();
    outerEarShape.moveTo(0, 0.075);
    outerEarShape.lineTo(-0.075, -0.075);
    outerEarShape.lineTo(0.075, -0.075);
    outerEarShape.closePath();

    const innerEarHole = new THREE.Path();
    innerEarHole.moveTo(0, 0.045);
    innerEarHole.lineTo(0.034, -0.042);
    innerEarHole.lineTo(-0.034, -0.042);
    innerEarHole.closePath();
    outerEarShape.holes.push(innerEarHole);

    const innerEarShape = new THREE.Shape();
    innerEarShape.moveTo(0, 0.045);
    innerEarShape.lineTo(-0.034, -0.042);
    innerEarShape.lineTo(0.034, -0.042);
    innerEarShape.closePath();

    const earGroup = new THREE.Group();
    const outerEar = new THREE.Mesh(
      new THREE.ShapeGeometry(outerEarShape),
      catEarGinger,
    );
    const innerEar = new THREE.Mesh(
      new THREE.ShapeGeometry(innerEarShape),
      catEarPink,
    );
    outerEar.castShadow = true;
    earGroup.add(outerEar, innerEar);
    earGroup.position.set(x, 0.43, 0.18);
    earGroup.rotation.z = rotationZ;
    sleepingCat.add(earGroup);
  };
  makeCatEar(-0.39, 0.16);
  makeCatEar(-0.17, -0.16);

  // Closed eyes and tucked paws make the sleeping pose readable.
  for (const x of [-0.34, -0.22]) {
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.009, 0.009),
      catDark,
    );
    eye.position.set(x, 0.275, 0.304);
    eye.rotation.z = x < -0.28 ? -0.08 : 0.08;
    sleepingCat.add(eye);
  }

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.035, 3),
    catPink,
  );
  nose.position.set(-0.28, 0.225, 0.315);
  nose.rotation.x = Math.PI / 2;
  sleepingCat.add(nose);

  // Three whiskers on each cheek.
  const whiskerMaterial = new THREE.MeshBasicMaterial({ color: 0x746960 });
  const whiskerUp = new THREE.Vector3(0, 1, 0);
  const addWhisker = (start: THREE.Vector3, end: THREE.Vector3) => {
    const direction = end.clone().sub(start);
    const whisker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0025, 0.0025, direction.length(), 6),
      whiskerMaterial,
    );
    whisker.position.copy(start).add(end).multiplyScalar(0.5);
    whisker.quaternion.setFromUnitVectors(
      whiskerUp,
      direction.clone().normalize(),
    );
    sleepingCat.add(whisker);
  };
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 3; i += 1) {
      const start = new THREE.Vector3(
        -0.28 + side * 0.075,
        0.22 - i * 0.023,
        0.31,
      );
      const end = new THREE.Vector3(
        -0.28 + side * (0.245 + i * 0.012),
        start.y + (1 - i) * 0.025,
        0.325,
      );
      addWhisker(start, end);
    }
  }

  for (const x of [-0.2, -0.08]) {
    const paw = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 10),
      catWhite,
    );
    paw.scale.set(1.25, 0.45, 0.72);
    paw.position.set(x, 0.085, 0.16);
    paw.castShadow = true;
    sleepingCat.add(paw);
  }

  // The curled tail alternates dark and pale ginger in visible short rings.
  const catTail = new THREE.Group();
  const tailSegmentCount = 20;
  const tailArc = Math.PI * 1.55;
  const tailSegmentArc = tailArc / tailSegmentCount;
  for (let i = 0; i < tailSegmentCount; i += 1) {
    const segment = new THREE.Mesh(
      new THREE.TorusGeometry(
        0.28,
        0.055,
        12,
        8,
        tailSegmentArc + 0.025,
      ),
      i % 2 === 0 ? catGinger : catLightGinger,
    );
    segment.rotation.z = i * tailSegmentArc;
    segment.castShadow = true;
    catTail.add(segment);
  }
  catTail.rotation.set(Math.PI / 2, 0, -0.35);
  catTail.position.set(0.12, 0.13, -0.005);
  sleepingCat.add(catTail);

  // Rounded root bridges the rump marking and curled tail.
  const tailRoot = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 10),
    catGinger,
  );
  tailRoot.scale.set(1.25, 0.72, 0.82);
  tailRoot.position.set(0.35, 0.17, -0.08);
  tailRoot.castShadow = true;
  sleepingCat.add(tailRoot);

  const tailTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 14, 10),
    catLightGinger,
  );
  tailTip.scale.set(1.35, 0.8, 0.8);
  tailTip.position.set(-0.09, 0.13, 0.22);
  tailTip.castShadow = true;
  sleepingCat.add(tailTip);

  sleepingCat.position.set(-1.05, deskTopWorldY, -0.2);
  sleepingCat.rotation.y = -0.18;
  sleepingCat.scale.setScalar(0.75);
  scene.add(sleepingCat);

  // ===== Bonsai Tree (with 8 seasonal states) =====
  const plant = new THREE.Group();

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.13, 0.18, 14),
    mats.pot,
  );
  pot.position.y = 0.09;
  pot.castShadow = true;
  plant.add(pot);

  // Soil cap
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 0.02, 14),
    mats.deskLeg,
  );
  soil.position.y = 0.185;
  plant.add(soil);

  // Procedural Trunk and Branches (L-System style)
  const trunkGroup = new THREE.Group();
  trunkGroup.position.y = 0.2;
  plant.add(trunkGroup);

  const branches = new THREE.Group();
  trunkGroup.add(branches);

  const branchTips: THREE.Vector3[] = [];
  const maxDepth = 4;

  const buildBranch = (
    startPos: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
    upVector: THREE.Vector3
  ) => {
    // 1. Create the mesh
    const branchGeo = new THREE.CylinderGeometry(radius * 0.6, radius, length, 6);
    // Translate geometry so origin is at the base
    branchGeo.translate(0, length / 2, 0);
    const branch = new THREE.Mesh(branchGeo, mats.deskLeg);

    // 2. Position at the base
    branch.position.copy(startPos);

    // 3. Orient the branch
    const quaternion = new THREE.Quaternion();
    // Cylinder by default points along Y axis (0, 1, 0)
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    branch.quaternion.copy(quaternion);

    branch.castShadow = true;
    branches.add(branch);

    // 4. Calculate the tip position for the next branches or foliage
    const endPos = startPos.clone().add(dir.clone().normalize().multiplyScalar(length));

    // 5. Recursion or collect tip
    if (depth >= maxDepth) {
      branchTips.push(endPos);
      return;
    }

    // Add foliage not just at max depth
    if (depth >= maxDepth - 1 || (depth === maxDepth - 2 && Math.random() > 0.5)) {
       // Interpolate along the branch to make foliage denser
       const midPos = startPos.clone().lerp(endPos, 0.5 + Math.random() * 0.4);
       branchTips.push(midPos);
    }

    // Parameters for next branches
    const lengthDecay = 0.65 + Math.random() * 0.15;
    const radiusDecay = 0.6 + Math.random() * 0.1;
    const branchCount = depth === 1 ? 2 : (Math.random() > 0.3 ? 2 : 3); // More branches at lower depths

    // Create a base local rotation frame perpendicular to current direction
    let localRight = new THREE.Vector3().crossVectors(upVector, dir).normalize();
    if (localRight.lengthSq() < 0.001) {
       localRight = new THREE.Vector3(1, 0, 0);
    }
    const localForward = new THREE.Vector3().crossVectors(localRight, dir).normalize();

    // Determine how much to spread out from the main axis
    let baseSpreadAngle = (0.6 + Math.random() * 0.3) / depth;
    // Phototropism: bend slightly towards global up
    const globalUpWeight = 0.15 * depth;

    // Roll angle distributes branches around the stem
    let currentRoll = Math.random() * Math.PI * 2;
    const rollStep = (Math.random() > 0.5 ? 1 : -1) * (Math.PI * 2 / branchCount + (Math.random() - 0.5) * 0.5);

    for (let i = 0; i < branchCount; i++) {
        // Calculate new direction
        const spreadAngle = baseSpreadAngle * (0.8 + Math.random() * 0.4);

        // Vector spreading outward
        const spreadVec = localRight.clone().multiplyScalar(Math.cos(currentRoll)).add(
             localForward.clone().multiplyScalar(Math.sin(currentRoll))
        );

        // Combine forward direction with spread
        let newDir = dir.clone().normalize().multiplyScalar(Math.cos(spreadAngle)).add(
            spreadVec.multiplyScalar(Math.sin(spreadAngle))
        );

        // Apply phototropism (blend with global up)
        newDir.lerp(new THREE.Vector3(0, 1, 0), globalUpWeight).normalize();

        buildBranch(endPos, newDir, length * lengthDecay, radius * radiusDecay, depth + 1, dir);

        currentRoll += rollStep;
    }
  };

  // Start the recursive tree build
  const startPos = new THREE.Vector3(0, 0, 0);
  // Initial slightly twisted direction
  const startDir = new THREE.Vector3((Math.random()-0.5)*0.2, 1, (Math.random()-0.5)*0.2).normalize();
  const startLength = 0.2 + Math.random() * 0.05;
  const startRadius = 0.025;
  buildBranch(startPos, startDir, startLength, startRadius, 1, new THREE.Vector3(0,0,-1));

  // Foliage elements (Leaves, Flowers, Buds)
  const foliageGroup = new THREE.Group();
  trunkGroup.add(foliageGroup);

  type FoliageItem = {
    mesh: THREE.Mesh;
    type: "leaf" | "flower" | "bud";
    baseScale: THREE.Vector3;
    tipIdx: number;
    localPos: THREE.Vector3;
  };
  const foliageItems: FoliageItem[] = [];

  const addFoliageCluster = (tip: THREE.Vector3, tipIdx: number) => {
    // 1. Leaves (flat planes, starburst/fan pattern, crossed for volume)
    const numLeaves = 7;
    for (let i = 0; i < numLeaves; i++) {
      const offsetX = (Math.random() - 0.5) * 0.12;
      const offsetY = (Math.random() - 0.2) * 0.08;
      const offsetZ = (Math.random() - 0.5) * 0.12;
      const baseScale = new THREE.Vector3(0.6 + Math.random() * 0.3, 0.6 + Math.random() * 0.3, 0.6 + Math.random() * 0.3);
      const angle = (i / numLeaves) * Math.PI * 2 + Math.random() * 0.5;
      const tilt = Math.random() * 0.8 + 0.2;

      // Base leaf material with jitter
      const leafMat = mats.leaf.clone();
      leafMat.side = THREE.DoubleSide;
      const hsl = { h: 0, s: 0, l: 0 };
      leafMat.color.getHSL(hsl);
      leafMat.color.setHSL(
        hsl.h + (Math.random() - 0.5) * 0.05,
        hsl.s + (Math.random() - 0.5) * 0.1,
        hsl.l + (Math.random() - 0.5) * 0.1
      );

      // Create two meshes for volume (crossed planes)
      for (let j = 0; j < 2; j++) {
        const leafGeo = makeMapleGeo();
        const leaf = new THREE.Mesh(leafGeo, leafMat);

        leaf.position.set(tip.x + offsetX, tip.y + offsetY, tip.z + offsetZ);
        leaf.scale.copy(baseScale);

        const offsetAngle = angle + (j * Math.PI / 2); // 90-degree offset for the second plane
        leaf.rotation.set(tilt * Math.cos(offsetAngle), offsetAngle, tilt * Math.sin(offsetAngle));

        leaf.castShadow = true;
        foliageGroup.add(leaf);
        foliageItems.push({ mesh: leaf, type: "leaf", baseScale, tipIdx, localPos: leaf.position.clone() });
      }
    }

    // 2. Flowers (Pink blossoms for spring, flat planes, crossed for volume, tighter cluster)
    const numFlowers = 5;
    for (let i = 0; i < numFlowers; i++) {
      // Tighter cluster offsets
      const offsetX = (Math.random() - 0.5) * 0.05;
      const offsetY = (Math.random() - 0.5) * 0.05;
      const offsetZ = (Math.random() - 0.5) * 0.05;
      const baseScale = new THREE.Vector3(0.5, 0.5, 0.5);
      const angle = (i / numFlowers) * Math.PI * 2 + Math.random() * 0.5;
      const tilt = Math.random() * 0.8 + 0.2;

      // Flower material with jitter
      const flowerMat = new THREE.MeshToonMaterial({ color: 0xffb6c1, side: THREE.DoubleSide });
      const hsl = { h: 0, s: 0, l: 0 };
      flowerMat.color.getHSL(hsl);
      flowerMat.color.setHSL(
        hsl.h + (Math.random() - 0.5) * 0.05,
        hsl.s + (Math.random() - 0.5) * 0.1,
        hsl.l + (Math.random() - 0.5) * 0.1
      );

      // Create two meshes for volume (crossed planes)
      for (let j = 0; j < 2; j++) {
        const flowerGeo = makePetalGeo();
        const flower = new THREE.Mesh(flowerGeo, flowerMat);

        flower.position.set(tip.x + offsetX, tip.y + offsetY, tip.z + offsetZ);
        flower.scale.copy(baseScale);

        const offsetAngle = angle + (j * Math.PI / 2); // 90-degree offset for the second plane
        flower.rotation.set(tilt * Math.cos(offsetAngle), offsetAngle, tilt * Math.sin(offsetAngle));

        flower.castShadow = true;
        foliageGroup.add(flower);
        foliageItems.push({ mesh: flower, type: "flower", baseScale, tipIdx, localPos: flower.position.clone() });
      }
    }

    // 3. Buds (True buds for early spring, using DodecahedronGeometry for volume)
    const numBuds = 3;
    for (let i = 0; i < numBuds; i++) {
      const offsetX = (Math.random() - 0.5) * 0.08;
      const offsetY = (Math.random() - 0.5) * 0.08;
      const offsetZ = (Math.random() - 0.5) * 0.08;
      const baseScale = new THREE.Vector3(1, 1, 1);
      const angle = (i / numBuds) * Math.PI * 2 + Math.random() * 0.5;
      const tilt = Math.random() * 0.8 + 0.2;

      // Bud material with jitter
      const budMat = new THREE.MeshToonMaterial({ color: 0x8fbc8f }); // Dark sea green
      const hsl = { h: 0, s: 0, l: 0 };
      budMat.color.getHSL(hsl);
      budMat.color.setHSL(
        hsl.h + (Math.random() - 0.5) * 0.05,
        hsl.s + (Math.random() - 0.5) * 0.1,
        hsl.l + (Math.random() - 0.5) * 0.1
      );

      // Volume bud
      const budGeo = new THREE.DodecahedronGeometry(0.015, 0);
      const bud = new THREE.Mesh(budGeo, budMat);

      bud.position.set(tip.x + offsetX, tip.y + offsetY, tip.z + offsetZ);
      bud.scale.copy(baseScale);
      bud.rotation.set(tilt * Math.cos(angle), angle, tilt * Math.sin(angle));

      bud.castShadow = true;
      foliageGroup.add(bud);
      foliageItems.push({ mesh: bud, type: "bud", baseScale, tipIdx, localPos: bud.position.clone() });
    }
  };

  branchTips.forEach((tip, i) => addFoliageCluster(tip, i));

  // Occupy the rear-right spot formerly used by the desk book stack.
  plant.position.set(1.3, deskTopWorldY, -0.85);
  scene.add(plant);

  // ===== Small bookshelf (back-right corner) =====
  const bookshelf = new THREE.Group();
  const bookshelfWood = new THREE.MeshToonMaterial({ color: 0x8b5c3e });
  const shelfW = 0.86;
  const shelfH = 1.42;
  const shelfD = 0.32;
  const shelfT = 0.065;

  const addShelfPart = (
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const part = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      bookshelfWood,
    );
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    bookshelf.add(part);
  };

  // Side panels, top, bottom, back and two middle shelves.
  addShelfPart(shelfT, shelfH, shelfD, -shelfW / 2 + shelfT / 2, shelfH / 2, 0);
  addShelfPart(shelfT, shelfH, shelfD, shelfW / 2 - shelfT / 2, shelfH / 2, 0);
  addShelfPart(shelfW, shelfT, shelfD, 0, shelfT / 2, 0);
  addShelfPart(shelfW, shelfT, shelfD, 0, shelfH - shelfT / 2, 0);
  addShelfPart(shelfW, shelfH, 0.035, 0, shelfH / 2, -shelfD / 2);
  [0.48, 0.92].forEach((y) => {
    addShelfPart(shelfW - shelfT * 2, shelfT, shelfD, 0, y, 0);
  });

  const shelfBookRows = [
    {
      y: 0.1,
      books: [
        { w: 0.14, h: 0.28, color: 0 },
        { w: 0.12, h: 0.34, color: 1 },
        { w: 0.16, h: 0.25, color: 2 },
        { w: 0.11, h: 0.31, color: 0 },
      ],
    },
    {
      y: 0.55,
      books: [
        { w: 0.13, h: 0.29, color: 2 },
        { w: 0.15, h: 0.32, color: 0 },
        { w: 0.1, h: 0.24, color: 1 },
      ],
    },
    {
      y: 0.99,
      books: [
        { w: 0.12, h: 0.26, color: 1 },
        { w: 0.14, h: 0.31, color: 2 },
        { w: 0.11, h: 0.28, color: 0 },
      ],
    },
  ];
  shelfBookRows.forEach(({ y, books }, rowIndex) => {
    let x = -shelfW / 2 + shelfT + 0.04;
    books.forEach(({ w, h, color }, bookIndex) => {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, shelfD * 0.58),
        mats.books[color],
      );
      book.position.set(x + w / 2, y + h / 2, 0.025);
      book.rotation.z =
        bookIndex === books.length - 1 && rowIndex > 0 ? -0.12 : 0;
      book.castShadow = true;
      bookshelf.add(book);
      x += w + 0.018;
    });
  });

  bookshelf.position.set(2.55, roomFloorY, roomBackZ + shelfD / 2 + 0.025);
  scene.add(bookshelf);

  // ===== Retro record player (back-left corner) =====
  const recordPlayer = new THREE.Group();
  const recordWoodMaterial = new THREE.MeshToonMaterial({ color: 0x85563a });
  const recordTrimMaterial = new THREE.MeshToonMaterial({ color: 0xc39358 });
  const vinylMaterial = new THREE.MeshToonMaterial({ color: 0x17171b });
  const recordLabelMaterial = new THREE.MeshToonMaterial({ color: 0xb94d45 });
  const recordMetalMaterial = new THREE.MeshToonMaterial({ color: 0xb9ad99 });

  const recordCabinet = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.5, 0.5),
    recordWoodMaterial,
  );
  recordCabinet.position.y = 0.36;
  recordCabinet.castShadow = true;
  recordCabinet.receiveShadow = true;
  recordPlayer.add(recordCabinet);

  // Short feet lift the cabinet slightly off the floor.
  [
    [-0.29, -0.19],
    [0.29, -0.19],
    [-0.29, 0.19],
    [0.29, 0.19],
  ].forEach(([x, z]) => {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.12, 0.065),
      recordWoodMaterial,
    );
    foot.position.set(x, 0.06, z);
    foot.castShadow = true;
    recordPlayer.add(foot);
  });

  const recordTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.055, 0.56),
    recordTrimMaterial,
  );
  recordTop.position.y = 0.635;
  recordTop.castShadow = true;
  recordPlayer.add(recordTop);

  // Open lid behind the turntable.
  const recordLid = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.48, 0.035),
    recordWoodMaterial,
  );
  recordLid.position.set(0, 0.88, -0.245);
  recordLid.rotation.x = -0.13;
  recordLid.castShadow = true;
  recordPlayer.add(recordLid);

  const lidInset = new THREE.Mesh(
    new THREE.PlaneGeometry(0.61, 0.39),
    new THREE.MeshToonMaterial({ color: 0x3b2922 }),
  );
  lidInset.position.set(0, 0.88, -0.224);
  lidInset.rotation.x = -0.13;
  recordPlayer.add(lidInset);

  const platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.235, 0.235, 0.025, 32),
    recordMetalMaterial,
  );
  platter.position.set(-0.06, 0.677, 0);
  platter.castShadow = true;
  recordPlayer.add(platter);

  const spinningRecord = new THREE.Group();
  spinningRecord.position.set(-0.06, 0.697, 0);
  const vinyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.215, 0.215, 0.012, 40),
    vinylMaterial,
  );
  vinyl.castShadow = true;
  spinningRecord.add(vinyl);

  const recordLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.014, 24),
    recordLabelMaterial,
  );
  recordLabel.position.y = 0.008;
  spinningRecord.add(recordLabel);

  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.035, 10),
    recordMetalMaterial,
  );
  spindle.position.y = 0.025;
  spinningRecord.add(spindle);
  recordPlayer.add(spinningRecord);

  // Floating musical notes (visible while audio plays)
  const noteGlyphs = ["♪", "♫", "♩", "♬"];
  const makeNoteTexture = (glyph: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      ctx.font = "72px Georgia, 'Times New Roman', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#2b211c";
      ctx.fillText(glyph, 64, 68);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  type FloatingNote = {
    mesh: THREE.Sprite;
    age: number;
    life: number;
    driftX: number;
    driftZ: number;
    spin: number;
    rise: number;
  };

  const floatingNotes: FloatingNote[] = [];
  const noteTextures = noteGlyphs.map(makeNoteTexture);
  let noteSpawnAccum = 0;

  const spawnFloatingNote = () => {
    const material = new THREE.SpriteMaterial({
      map: noteTextures[Math.floor(Math.random() * noteTextures.length)]!,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(material);
    const scale = 0.16 + Math.random() * 0.1;
    sprite.scale.set(scale, scale, scale);
    sprite.position.set(
      recordPlayer.position.x - 0.06 + (Math.random() - 0.5) * 0.2,
      recordPlayer.position.y + 0.75,
      recordPlayer.position.z + (Math.random() - 0.5) * 0.18,
    );
    scene.add(sprite);
    floatingNotes.push({
      mesh: sprite,
      age: 0,
      life: 2.4 + Math.random() * 1.4,
      driftX: (Math.random() - 0.5) * 0.22,
      driftZ: (Math.random() - 0.5) * 0.18,
      spin: (Math.random() - 0.5) * 1.2,
      rise: 0.35 + Math.random() * 0.25,
    });
  };

  // Curved tonearm resting over the outer edge of the record.
  const tonearmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.27, 0.71, 0.13),
    new THREE.Vector3(0.24, 0.75, 0.02),
    new THREE.Vector3(0.13, 0.735, -0.08),
    new THREE.Vector3(0.08, 0.72, -0.11),
  ]);
  const tonearm = new THREE.Mesh(
    new THREE.TubeGeometry(tonearmCurve, 22, 0.012, 7, false),
    recordMetalMaterial,
  );
  tonearm.castShadow = true;
  recordPlayer.add(tonearm);

  const tonearmPivot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 0.055, 16),
    recordMetalMaterial,
  );
  tonearmPivot.position.set(0.27, 0.7, 0.13);
  recordPlayer.add(tonearmPivot);

  // Two simple brass controls on the front panel.
  [-0.12, 0.12].forEach((x) => {
    const control = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.025, 14),
      recordTrimMaterial,
    );
    control.rotation.x = Math.PI / 2;
    control.position.set(x, 0.39, 0.263);
    recordPlayer.add(control);
  });

  recordPlayer.position.set(-2.55, roomFloorY, roomBackZ + 0.55);
  scene.add(recordPlayer);

  // ===== Three movie posters (left wall → /movies) =====
  const moviePosters = new THREE.Group();
  const posterW = 0.5;
  const posterH = 0.75;

  const createPosterTexture = (index: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 540;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    if (index === 0) {
      const sunset = ctx.createLinearGradient(0, 0, 0, H);
      sunset.addColorStop(0, "#42306f");
      sunset.addColorStop(0.48, "#df6f62");
      sunset.addColorStop(1, "#f4c56d");
      ctx.fillStyle = sunset;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffd783";
      ctx.beginPath();
      ctx.arc(W * 0.68, H * 0.34, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#283c59";
      ctx.fillRect(0, H * 0.58, W, H * 0.42);
      ctx.strokeStyle = "rgba(255,225,170,.7)";
      ctx.lineWidth = 5;
      [0.64, 0.71, 0.79].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(35, H * y);
        ctx.quadraticCurveTo(W / 2, H * (y - 0.025), W - 28, H * y);
        ctx.stroke();
      });
    } else if (index === 1) {
      const space = ctx.createRadialGradient(W * 0.55, H * 0.4, 15, W / 2, H / 2, H);
      space.addColorStop(0, "#31528a");
      space.addColorStop(0.55, "#111d42");
      space.addColorStop(1, "#070913");
      ctx.fillStyle = space;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#dceaff";
      for (let i = 0; i < 55; i++) {
        const x = (i * 83) % W;
        const y = (i * 137) % (H * 0.72);
        const r = i % 5 === 0 ? 2.2 : 1.1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#89b7e8";
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.42, 115, 54, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#c87f72";
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.42, 70, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const night = ctx.createLinearGradient(0, 0, 0, H);
      night.addColorStop(0, "#24142d");
      night.addColorStop(0.55, "#671f35");
      night.addColorStop(1, "#120f18");
      ctx.fillStyle = night;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f1c77a";
      ctx.beginPath();
      ctx.arc(W * 0.72, H * 0.23, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#16141c";
      const buildings = [110, 175, 135, 205, 150, 188, 120];
      buildings.forEach((height, i) => {
        const x = i * 54 - 8;
        ctx.fillRect(x, H - height, 48, height);
        ctx.fillStyle = i % 2 ? "#e08a58" : "#d8b166";
        for (let row = 0; row < 4; row++) {
          ctx.fillRect(x + 10, H - height + 24 + row * 32, 7, 12);
          ctx.fillRect(x + 29, H - height + 24 + row * 32, 7, 12);
        }
        ctx.fillStyle = "#16141c";
      });
    }

    const titles = [
      ["AFTERGLOW", "海边日落"],
      ["ORBIT", "漫游星轨"],
      ["MIDNIGHT", "城市雨夜"],
    ];
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff7e8";
    ctx.font = "700 34px Georgia, serif";
    ctx.fillText(titles[index][0], W / 2, H - 72);
    ctx.font = "18px sans-serif";
    ctx.fillText(titles[index][1], W / 2, H - 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  };

  for (let i = 0; i < 3; i++) {
    const poster = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(posterW + 0.045, posterH + 0.045, 0.035),
      mats.tvBody,
    );
    frame.castShadow = true;
    poster.add(frame);

    const image = new THREE.Mesh(
      new THREE.PlaneGeometry(posterW, posterH),
      new THREE.MeshBasicMaterial({
        map: createPosterTexture(i),
        toneMapped: false,
      }),
    );
    image.position.z = 0.019;
    poster.add(image);
    poster.position.x = (i - 1) * 0.66;
    poster.position.y = i === 1 ? 0.12 : 0;
    moviePosters.add(poster);
  }

  moviePosters.position.set(-3.16, 1.65, -0.5);
  moviePosters.rotation.y = Math.PI / 2;
  scene.add(moviePosters);

  // ===== Person (seated on chair, feet on floor, facing -Z toward laptop) =====
  // Coordinate system: person group at world y=0 (so floor at local y=-0.5)
  //   hip  local y = 0.03 (just above chair seat)
  //   shoulder local y = 0.58
  //   head center local y = 0.85
  //   feet bottom local y = -0.5 (exactly on floor)
  const person = new THREE.Group();
  const personShirtMaterial = new THREE.MeshToonMaterial({ color: 0xe88aa5 });
  const personPantsMaterial = new THREE.MeshToonMaterial({ color: 0x17171b });

  // ---- Chair ----
  const chairSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.05, 0.52),
    mats.personCloth,
  );
  chairSeat.position.set(0, -0.015, 0.05);
  chairSeat.castShadow = true;
  chairSeat.receiveShadow = true;
  person.add(chairSeat);

  const chairBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.05),
    mats.personCloth,
  );
  chairBack.position.set(0, 0.22, 0.28);
  chairBack.castShadow = true;
  person.add(chairBack);

  // Chair legs (4 short legs under seat)
  [[-0.22, -0.16], [0.22, -0.16], [-0.22, 0.24], [0.22, 0.24]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.45, 0.04),
      mats.deskLeg,
    );
    leg.position.set(x, -0.26, z);
    leg.castShadow = true;
    person.add(leg);
  });

  // ---- Torso ----
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.27, 0.58, 14),
    personShirtMaterial,
  );
  torso.position.y = 0.32;
  torso.castShadow = true;
  person.add(torso);

  // ---- Neck ----
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.07, 10),
    mats.personSkin,
  );
  neck.position.y = 0.64;
  person.add(neck);

  // ---- Head ----
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 20, 16),
    mats.personSkin,
  );
  head.position.y = 0.82;
  head.scale.set(1, 1.08, 1);
  head.castShadow = true;
  person.add(head);

  // ---- Hair (back + top, since we see from behind) ----
  const hairGeo = new THREE.SphereGeometry(0.156, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const hair = new THREE.Mesh(hairGeo, mats.personHair);
  hair.position.y = 0.82;
  hair.scale.set(1, 1.1, 1);
  hair.rotation.x = -0.15;
  person.add(hair);

  // Long hair falls from the back of the head to below the shoulders.
  const backHair = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.36, 8, 16),
    mats.personHair,
  );
  backHair.position.set(0, 0.64, 0.075);
  backHair.scale.set(1.06, 1, 0.72);
  backHair.castShadow = true;
  person.add(backHair);

  // ---- Shoulder joints ----
  const shoulderGeo = new THREE.SphereGeometry(0.09, 14, 12);
  const shoulderL = new THREE.Mesh(shoulderGeo, personShirtMaterial);
  shoulderL.position.set(-0.26, 0.55, 0);
  shoulderL.castShadow = true;
  person.add(shoulderL);
  const shoulderR = new THREE.Mesh(shoulderGeo, personShirtMaterial);
  shoulderR.position.set(0.26, 0.55, 0);
  shoulderR.castShadow = true;
  person.add(shoulderR);

  // ---- Arms (reach -Z toward laptop) ----
  function makeArm(side: -1 | 1) {
    const armGroup = new THREE.Group();
    armGroup.position.set(0.26 * side, 0.55, 0);
    armGroup.rotation.x = 1.24;
    armGroup.rotation.z = -0.06 * side;

    const upperLen = 0.42;
    const sleeveLen = 0.15;
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.072, sleeveLen, 12),
      personShirtMaterial,
    );
    sleeve.position.y = -sleeveLen / 2;
    sleeve.castShadow = true;
    armGroup.add(sleeve);

    const bareUpperLen = upperLen - sleeveLen;
    const bareUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.064, bareUpperLen, 12),
      mats.personSkin,
    );
    bareUpperArm.position.y = -sleeveLen - bareUpperLen / 2;
    bareUpperArm.castShadow = true;
    armGroup.add(bareUpperArm);

    const elbowGroup = new THREE.Group();
    elbowGroup.position.y = -upperLen;
    elbowGroup.rotation.x = 0.32;
    armGroup.add(elbowGroup);

    const elbowSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 12, 10),
      mats.personSkin,
    );
    elbowGroup.add(elbowSphere);

    const forearmLen = 0.4;
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.052, forearmLen, 12),
      mats.personSkin,
    );
    forearm.position.y = -forearmLen / 2;
    forearm.castShadow = true;
    elbowGroup.add(forearm);

    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.058, 0.02, 12),
      mats.personSkin,
    );
    cuff.position.y = -forearmLen - 0.01;
    elbowGroup.add(cuff);

    const wrist = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 12, 10),
      mats.personSkin,
    );
    wrist.position.y = -forearmLen - 0.035;
    elbowGroup.add(wrist);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 18, 14),
      mats.personSkin,
    );
    // Round fist shape — reads as a "hand" from any camera angle, no awkward
    // stretched-box look.
    hand.position.set(0, -forearmLen - 0.035, 0.04);
    hand.castShadow = true;
    elbowGroup.add(hand);

    person.add(armGroup);
    return { armGroup, elbowGroup, hand };
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // ---- Legs: thighs horizontal forward (-Z), shins vertical down, feet on floor ----
  function makeLeg(side: -1 | 1) {
    const thighLen = 0.42;
    // Thigh oriented along -Z: cylinder's Y-axis rotates -π/2 around X → +Y becomes +Z, -Y becomes -Z
    // So cylinder axis ends: top at +Z, bottom at -Z. We want thigh to go from hip at z=0 to knee at z=-0.42
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.09, thighLen, 12),
      personPantsMaterial,
    );
    thigh.rotation.x = Math.PI / 2;
    thigh.position.set(0.12 * side, 0.02, -thighLen / 2);
    thigh.castShadow = true;
    person.add(thigh);

    // Knee sphere (at -Z end of thigh)
    const knee = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 12, 10),
      personPantsMaterial,
    );
    knee.position.set(0.12 * side, 0.02, -thighLen);
    person.add(knee);

    // Shin from knee vertically down to ankle just above floor
    const shinTopY = 0.02;
    const shinBottomY = -0.44;
    const shinLen = shinTopY - shinBottomY;
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.06, shinLen, 12),
      personPantsMaterial,
    );
    shin.position.set(0.12 * side, (shinTopY + shinBottomY) / 2, -thighLen);
    shin.castShadow = true;
    person.add(shin);

    // Foot (skin shoe color via deskLeg dark)
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.07, 0.22),
      mats.personHair,
    );
    foot.position.set(0.12 * side, -0.465, -thighLen - 0.04);
    foot.castShadow = true;
    foot.receiveShadow = true;
    person.add(foot);
  }
  makeLeg(-1);
  makeLeg(1);

  // Pelvis (hide gap between torso and thighs)
  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.14, 0.3),
    personPantsMaterial,
  );
  pelvis.position.set(0, 0.04, 0);
  pelvis.castShadow = true;
  person.add(pelvis);

  // Seated further back from laptop: chair+seat at z=0.55, so hips at z=0.55
  person.position.set(0.15, 0, 0.55);
  scene.add(person);

  // ===== Interactive registry =====
  // Lamp, window and sleeping cat are decorative only.
  const interactives: Interactive[] = [
    { object: deskNotebook, label: "笔记本 · 博文", route: "/articles", basePos: deskNotebook.position.clone() },
    { object: laptop, label: "电脑 · 项目", route: "/projects", basePos: laptop.position.clone() },
    { object: person, label: "xiaolao · 关于", route: "/about", basePos: person.position.clone() },
    { object: bookshelf, label: "书架 · 读书", route: "/books", basePos: bookshelf.position.clone() },
    { object: moviePosters, label: "电影海报 · 观影", route: "/movies", basePos: moviePosters.position.clone() },
    { object: recordPlayer, label: "唱片机 · 歌单", route: "/music", basePos: recordPlayer.position.clone(), kind: "music" },
  ];

  // ===== Theme =====
  const getTheme = (): ThemeName => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  let theme: ThemeName = getTheme();

  const applyTheme = (t: ThemeName) => {
    const p = THEMES[t];
    mats.floor.color.setHex(p.floor);
    mats.wall.color.setHex(p.wall);
    mats.ceiling.color.setHex(p.ceiling);
    mats.deskTop.color.setHex(p.deskTop);
    mats.deskLeg.color.setHex(p.deskLeg);
    mats.lampBody.color.setHex(p.lampBody);
    mats.lampShade.color.setHex(p.lampShade);
    mats.bulb.emissive.setHex(p.lampGlow);
    lampLight.color.setHex(p.lampGlow);
    mats.laptopBody.color.setHex(p.laptopBody);
    mats.laptopFrame.color.setHex(p.laptopFrame);
    mats.books[0].color.setHex(p.bookA);
    mats.books[1].color.setHex(p.bookB);
    mats.books[2].color.setHex(p.bookC);
    mats.tvBody.color.setHex(p.tvBody);
    mats.pot.color.setHex(p.pot);
    mats.personSkin.color.setHex(p.personSkin);
    mats.personHair.color.setHex(p.personHair);
    mats.personCloth.color.setHex(p.personCloth);
    personShirtMaterial.color.setHex(t === "dark" ? 0xb75f7c : 0xe88aa5);
    personPantsMaterial.color.setHex(t === "dark" ? 0x0c0c10 : 0x17171b);
    mats.key.color.setHex(p.keyTop);
    mats.windowFrame.color.setHex(p.windowFrame);
    mats.windowSill.color.setHex(p.windowSill);
    seaMaterial.color.setHex(t === "dark" ? 0x214e67 : 0x58aeca);
    beachMaterial.color.setHex(t === "dark" ? 0x765f45 : 0xe7c58d);
    islandMaterial.color.setHex(t === "dark" ? 0x263f38 : 0x55765a);
    foamMaterial.color.setHex(t === "dark" ? 0xa9c7cc : 0xf8fbf6);
    cupCeramicMaterial.color.setHex(t === "dark" ? 0xb58f72 : 0xf1e4d2);
    iceMaterial.color.setHex(t === "dark" ? 0x8db6c0 : 0xd9f2f5);
    iceCubes.visible = t !== "dark";
    coffeeSteam.visible = t === "dark";
    steamMaterial.color.setHex(t === "dark" ? 0xb9c5c9 : 0xe8eeee);
    notebookCoverMaterial.color.setHex(t === "dark" ? 0x29423f : 0x496b67);
    notebookPageMaterial.color.setHex(t === "dark" ? 0xbdb6a7 : 0xeee7d7);
    bookshelfWood.color.setHex(t === "dark" ? 0x4f3325 : 0x8b5c3e);
    recordWoodMaterial.color.setHex(t === "dark" ? 0x452c22 : 0x85563a);
    recordTrimMaterial.color.setHex(t === "dark" ? 0x80623f : 0xc39358);
  };
  applyTheme(theme);

  const themeObserver = new MutationObserver(() => {
    const t = getTheme();
    if (t !== theme) {
      theme = t;
      applyTheme(t);
      needScreenRedraw = true;
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ===== Season state =====
  let seasonOfYear = 0.3;
  let targetSeason = seasonOfYear;
  let currentTermIndex = -1;
  let needScreenRedraw = true;
  let cursorOn = true;
  let cursorLastToggle = performance.now();

  // ===== Time formatter (Beijing: YYYY-MM-DD HH:mm · 周X) =====
  const dateFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const weekdayFmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  });
  const formatNowBeijing = () => {
    const d = new Date();
    // zh-CN date format returns e.g. "2026/04/19" — normalize to "2026-04-19"
    const date = dateFmt.format(d).replace(/\//g, "-");
    return `${date} ${timeFmt.format(d)} · ${weekdayFmt.format(d)}`;
  };
  let lastTimeStr = "";

  // ===== Typewriter state (rotating status line at bottom of screen) =====
  type TyperPhase = "typing" | "hold" | "deleting" | "idle";
  const TYPEWRITER_LINES: string[] = HOME_PROFILE.typewriter.length
    ? HOME_PROFILE.typewriter
    : ["now building ·"];
  const TYPER_SPEED_TYPE = 55;    // ms per char while typing
  const TYPER_SPEED_DELETE = 26;  // ms per char while deleting
  const TYPER_HOLD_MS = 1800;     // pause after finishing typing
  const TYPER_IDLE_MS = 250;      // pause after fully deleted before next line
  let typerIndex = 0;
  let typerPhase: TyperPhase = "typing";
  let typerText = "";
  let typerLastTick = performance.now();
  let typerHoldUntil = 0;

  const tmpColor = new THREE.Color();
  const tmpColor2 = new THREE.Color();
  const blendSeason = (s: number, key: keyof SeasonPal, out: THREE.Color) => {
    const seasons = theme === "dark" ? SEASONS_DARK : SEASONS_LIGHT;
    const raw = s * 4;
    const idx = Math.floor(raw) % 4;
    const next = (idx + 1) % 4;
    const local = raw - Math.floor(raw);
    const t = easeInOutCubic(local);
    const a = seasons[idx][key] as number;
    const b = seasons[next][key] as number;
    tmpColor.setHex(a);
    tmpColor2.setHex(b);
    out.copy(tmpColor).lerp(tmpColor2, t);
  };
  const blendSeasonScalar = (s: number, key: keyof SeasonPal): number => {
    const seasons = theme === "dark" ? SEASONS_DARK : SEASONS_LIGHT;
    const raw = s * 4;
    const idx = Math.floor(raw) % 4;
    const next = (idx + 1) % 4;
    const local = raw - Math.floor(raw);
    const t = easeInOutCubic(local);
    return lerp(seasons[idx][key] as number, seasons[next][key] as number, t);
  };

  const sunColor = new THREE.Color();
  const ambColor = new THREE.Color();
  const skyColor = new THREE.Color();
  const plantColor = new THREE.Color();
  const fogColor = new THREE.Color();

  // Screen canvas drawing
  const drawScreen = () => {
    const ctx = screenCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = screenCanvas.width;
    const H = screenCanvas.height;
    const p = THEMES[theme];

    // bg + vignette
    ctx.fillStyle = p.screenBg;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // title bar (mac-style)
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, 0, W, 50);
    ctx.beginPath(); ctx.fillStyle = "#ff5f57"; ctx.arc(26, 25, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle = "#febc2e"; ctx.arc(48, 25, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle = "#28c840"; ctx.arc(70, 25, 7, 0, Math.PI * 2); ctx.fill();
    ctx.font = "600 19px 'JetBrains Mono', monospace";
    ctx.fillStyle = p.screenMuted;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("echoes ~ /home", W / 2, 32);

    // big name (Fraunces)
    ctx.fillStyle = p.screenText;
    ctx.font = "400 168px 'Fraunces', 'Noto Serif SC', serif";
    ctx.textAlign = "center";
    ctx.fillText(HOME_PROFILE.title, W / 2, 200);

    // subtitle
    ctx.font = "600 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = p.screenMuted;
    ctx.fillText(HOME_PROFILE.subtitle, W / 2, 258);

    // separator hairline
    ctx.strokeStyle = p.screenMuted;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, 298);
    ctx.lineTo(W * 0.8, 298);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Info rows (label right-aligned, value left-aligned from pillar)
    ctx.font = "600 24px 'JetBrains Mono', monospace";
    const pillarX = W * 0.36;
    const labelX = pillarX - 16;
    const valueX = pillarX + 16;
    const rowH = 42;
    let rowY = 345;

    const rows = [...HOME_PROFILE.rows];
    // append auto-computed "posts" row (count + years from Astro content)
    const autoPosts = (window as unknown as { __HOME_POSTS_LABEL?: string }).__HOME_POSTS_LABEL;
    if (autoPosts) {
      rows.push({ label: "posts", value: autoPosts });
    }
    // append live "now" row
    const nowStr = formatNowBeijing();
    rows.push({ label: "now", value: nowStr });

    for (const row of rows) {
      ctx.textAlign = "right";
      ctx.fillStyle = p.screenMuted;
      ctx.font = "500 22px 'JetBrains Mono', monospace";
      ctx.fillText(row.label, labelX, rowY);
      ctx.textAlign = "left";
      ctx.fillStyle = row.label === "now" ? p.screenAccent : p.screenText;
      ctx.font = "600 24px 'JetBrains Mono', monospace";
      ctx.fillText(row.value, valueX, rowY);
      rowY += rowH;
    }

    // Typewriter line (rotating status, types → holds → deletes → next)
    rowY += 14;
    ctx.font = "600 26px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    const prefix = "> ";
    const prefixW = ctx.measureText(prefix).width;
    const typerX = pillarX - 80;
    ctx.fillStyle = p.screenAccent;
    ctx.fillText(prefix, typerX, rowY);
    ctx.fillStyle = p.screenText;
    ctx.fillText(typerText, typerX + prefixW, rowY);
    if (cursorOn) {
      const tw = ctx.measureText(typerText);
      ctx.fillStyle = p.screenAccent;
      ctx.fillRect(typerX + prefixW + tw.width + 4, rowY - 22, 13, 28);
    }

    // bottom hint
    ctx.font = "500 18px 'JetBrains Mono', monospace";
    ctx.fillStyle = p.screenMuted;
    ctx.textAlign = "center";
    ctx.fillText("drag to orbit · scroll for seasons · click objects", W / 2, H - 32);

    screenTexture.needsUpdate = true;
  };
  drawScreen();

  // ===== Resize =====
  const resize = () => {
    const rect = canvasEl.getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth);
    const h = Math.max(1, rect.height || window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const resizeObs = new ResizeObserver(resize);
  resizeObs.observe(canvasEl);

  // ===== Input =====
  let hintHidden = false;
  const markInteracted = () => {
    if (hintHidden) return;
    hintHidden = true;
    hintEl?.classList.add("is-hidden");
  };

  const wheelHandler = (e: WheelEvent) => {
    e.preventDefault();
    targetSeason = (targetSeason + e.deltaY * 0.00026 + 1) % 1;
    markInteracted();
  };
  canvasEl.addEventListener("wheel", wheelHandler, { passive: false });

  let touchY: number | null = null;
  const touchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; };
  const touchMove = (e: TouchEvent) => {
    if (touchY == null) return;
    const y = e.touches[0]?.clientY;
    if (typeof y !== "number") return;
    const dy = touchY - y;
    if (Math.abs(dy) < 2) return;
    targetSeason = (targetSeason + dy * 0.0006 + 1) % 1;
    touchY = y;
    markInteracted();
  };
  const touchEnd = () => { touchY = null; };
  canvasEl.addEventListener("touchstart", touchStart, { passive: true });
  canvasEl.addEventListener("touchmove", touchMove, { passive: true });
  canvasEl.addEventListener("touchend", touchEnd);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered: Interactive | null = null;
  let tweening = false;

  const updatePointer = (clientX: number, clientY: number) => {
    const rect = canvasEl.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  };

  const hitTest = (): Interactive | null => {
    raycaster.setFromCamera(pointer, camera);
    for (const it of interactives) {
      if (raycaster.intersectObject(it.object, true).length > 0) return it;
    }
    return null;
  };

  const pointerMove = (e: PointerEvent) => {
    if (tweening) return;
    updatePointer(e.clientX, e.clientY);
    const hit = hitTest();
    if (hit !== hovered) {
      hovered = hit;
      canvasEl.style.cursor = hit ? "pointer" : "grab";
      if (tooltip) {
        if (hit && hit.kind !== "music") {
          tooltip.textContent = hit.label;
          tooltip.classList.add("is-visible");
        } else {
          tooltip.classList.remove("is-visible");
        }
      }
    }
    if (hit?.kind === "music") {
      showMusicPlayer(e.clientX, e.clientY);
    } else {
      scheduleMusicHide();
    }
    if (tooltip && hit && hit.kind !== "music") {
      tooltip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    }
  };
  canvasEl.addEventListener("pointermove", pointerMove);
  const pointerLeave = () => {
    hovered = null;
    canvasEl.style.cursor = "grab";
    tooltip?.classList.remove("is-visible");
    scheduleMusicHide();
  };
  canvasEl.addEventListener("pointerleave", pointerLeave);
  canvasEl.style.cursor = "grab";

  let startX = 0;
  let startY = 0;

  const pointerDownHandler = (e: PointerEvent) => {
    startX = e.clientX;
    startY = e.clientY;
  };
  canvasEl.addEventListener("pointerdown", pointerDownHandler);

  let tweenRafId = 0;
  let navFailSafeTimer = 0;

  const unlockInteraction = () => {
    tweening = false;
    controls.enabled = true;
    if (navFailSafeTimer) {
      window.clearTimeout(navFailSafeTimer);
      navFailSafeTimer = 0;
    }
    if (tweenRafId) {
      cancelAnimationFrame(tweenRafId);
      tweenRafId = 0;
    }
  };

  const pointerUpHandler = (e: PointerEvent) => {
    if (tweening) return;

    // Ignore if this was a drag/rotation
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (dist > 5) return;

    updatePointer(e.clientX, e.clientY);
    const hit = hitTest();
    if (!hit) return;
    markInteracted();
    tweening = true;
    controls.enabled = false;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const objPos = hit.basePos.clone().add(new THREE.Vector3(0, 0.25, 0));
    const dir = new THREE.Vector3().subVectors(startPos, objPos).normalize();
    const endPos = objPos.clone().add(dir.multiplyScalar(1.5));
    const endTarget = objPos;

    // If navigation is blocked/interrupted, unlock orbit after a short delay
    // so the homepage does not stay frozen until a full remount.
    navFailSafeTimer = window.setTimeout(() => {
      unlockInteraction();
    }, 2500);

    const duration = 650;
    const t0 = performance.now();
    const step = () => {
      const t = clamp((performance.now() - t0) / duration);
      const ee = easeInOutCubic(t);
      camera.position.lerpVectors(startPos, endPos, ee);
      controls.target.lerpVectors(startTarget, endTarget, ee);
      if (t < 1) {
        tweenRafId = requestAnimationFrame(step);
        return;
      }
      tweenRafId = 0;
      window.location.assign(hit.route);
    };
    tweenRafId = requestAnimationFrame(step);
  };
  canvasEl.addEventListener("pointerup", pointerUpHandler);

  // ===== Animation loop =====
  let rafId = 0;
  let lastFrame = performance.now();

  // Arm AI — each arm picks a target key, lerps its shoulder rotation toward it,
  // and dips the elbow onto that specific key at the end of the move.
  type ArmAI = {
    startRotZ: number;
    targetRotZ: number;
    currentRotZ: number;
    targetKeyIdx: number;
    moveStart: number;
    moveEnd: number;
    holdUntil: number;
    phase: "moving" | "hold";
    dipValue: number;
  };
  const leftAI: ArmAI = {
    startRotZ: 0.06, targetRotZ: 0.06, currentRotZ: 0.06,
    targetKeyIdx: 0, moveStart: 0, moveEnd: 0,
    holdUntil: performance.now(), phase: "hold", dipValue: 0,
  };
  const rightAI: ArmAI = {
    startRotZ: -0.06, targetRotZ: -0.06, currentRotZ: -0.06,
    targetKeyIdx: 0, moveStart: 0, moveEnd: 0,
    holdUntil: performance.now() + 120, phase: "hold", dipValue: 0,
  };
  const planNextKey = (ai: ArmAI, side: -1 | 1, nowTs: number) => {
    // Each arm only targets keys near its own shoulder — narrow home-row range
    // so the hand never over-reaches beyond the keyboard.
    const shoulderWorldX = 0.15 + 0.26 * side;
    const candidates = keyStates
      .map((s, i) => ({ s, i }))
      .filter((k) => k.s.side === side)
      .filter((k) => {
        const worldX = 0.1 + k.s.x;
        return Math.abs(worldX - shoulderWorldX) < 0.18;
      });
    if (!candidates.length) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const keyWorldX = 0.1 + pick.s.x;
    const deltaX = keyWorldX - shoulderWorldX;
    const baseRotZ = -0.06 * side;
    // SIGN FIX: for right arm (side=1), a key to the RIGHT of shoulder (deltaX > 0)
    // needs POSITIVE rotation.z to swing arm outward (previous code had wrong sign).
    const raw = baseRotZ + side * deltaX * 1.2;
    const targetRotZ = clamp(raw, -0.3, 0.3);
    ai.startRotZ = ai.currentRotZ;
    ai.targetRotZ = targetRotZ;
    ai.targetKeyIdx = pick.i;
    ai.moveStart = nowTs;
    ai.moveEnd = nowTs + 180 + Math.random() * 220;
    ai.phase = "moving";
  };

  const particleDummy = new THREE.Object3D();
  const SEASON_KEYS = ["spring", "summer", "autumn", "winter"] as const;

  const animate = () => {
    const now = performance.now();
    const dt = Math.min(64, now - lastFrame);
    lastFrame = now;

    let diff = targetSeason - seasonOfYear;
    if (diff > 0.5) diff -= 1;
    if (diff < -0.5) diff += 1;
    seasonOfYear = (seasonOfYear + diff * Math.min(1, dt * 0.0022) + 1) % 1;

    const termIdx = Math.floor(seasonOfYear * 24) % 24;
    if (termIdx !== currentTermIndex) {
      currentTermIndex = termIdx;
    }

    // Typewriter tick (types → holds → deletes → idle → next line)
    const typerTarget = TYPEWRITER_LINES[typerIndex];
    if (typerPhase === "typing") {
      if (now - typerLastTick >= TYPER_SPEED_TYPE) {
        typerLastTick = now;
        if (typerText.length < typerTarget.length) {
          typerText = typerTarget.slice(0, typerText.length + 1);
          needScreenRedraw = true;
        } else {
          typerPhase = "hold";
          typerHoldUntil = now + TYPER_HOLD_MS;
        }
      }
    } else if (typerPhase === "hold") {
      if (now >= typerHoldUntil) {
        typerPhase = "deleting";
        typerLastTick = now;
      }
    } else if (typerPhase === "deleting") {
      if (now - typerLastTick >= TYPER_SPEED_DELETE) {
        typerLastTick = now;
        if (typerText.length > 0) {
          typerText = typerText.slice(0, -1);
          needScreenRedraw = true;
        } else {
          typerPhase = "idle";
          typerHoldUntil = now + TYPER_IDLE_MS;
        }
      }
    } else if (typerPhase === "idle") {
      if (now >= typerHoldUntil) {
        typerIndex = (typerIndex + 1) % TYPEWRITER_LINES.length;
        typerPhase = "typing";
        typerLastTick = now;
      }
    }

    // Time tick — redraw when formatted time string changes (minute change)
    const newTimeStr = formatNowBeijing();
    if (newTimeStr !== lastTimeStr) {
      lastTimeStr = newTimeStr;
      needScreenRedraw = true;
    }

    blendSeason(seasonOfYear, "sun", sunColor);
    blendSeason(seasonOfYear, "amb", ambColor);
    blendSeason(seasonOfYear, "sky", skyColor);
    blendSeason(seasonOfYear, "plant", plantColor);
    blendSeason(seasonOfYear, "fogTint", fogColor);
    const sunI = blendSeasonScalar(seasonOfYear, "sunI");
    const ambI = blendSeasonScalar(seasonOfYear, "ambI");

    // Season affects INTERIOR only through intensity — color stays mostly neutral.
    // Only outdoor (sky, window light, plant leaves, particles) shows full seasonal hue.
    const neutralSun = new THREE.Color(theme === "dark" ? 0xeadabf : 0xfff0dc);
    const neutralAmb = new THREE.Color(theme === "dark" ? 0x4a4538 : 0xf2ead8);
    sunLight.color.copy(neutralSun).lerp(sunColor, 0.08);
    sunLight.intensity = lerp(theme === "dark" ? 0.7 : 1.5, sunI, 0.5);
    ambient.color.copy(neutralAmb).lerp(ambColor, 0.08);
    ambient.intensity = lerp(theme === "dark" ? 0.45 : 0.6, ambI, 0.35);
    windowLight.color.copy(skyColor);
    windowLight.intensity = Math.max(0.3, sunI * 0.45);
    mats.sky.color.copy(skyColor);
    mats.leaf.color.copy(plantColor);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(fogColor);

    scene.background = new THREE.Color(THEMES[theme].sceneBg);

    // Particle system opacity (cross-fade between current/next season)
    const raw = seasonOfYear * 4;
    const seasonIdx = Math.floor(raw) % 4;
    const nextIdx = (seasonIdx + 1) % 4;
    const localFrac = raw - Math.floor(raw);
    for (let s = 0; s < 4; s++) {
      const key = SEASON_KEYS[s];
      let op = 0;
      if (s === seasonIdx) op = 1 - easeInOutCubic(localFrac);
      else if (s === nextIdx) op = easeInOutCubic(localFrac);
      particleSystems[key].material.opacity = op * 0.95;
    }

    // Screen cursor blink & redraw
    if (now - cursorLastToggle > 520) {
      cursorLastToggle = now;
      cursorOn = !cursorOn;
      needScreenRedraw = true;
    }
    if (needScreenRedraw) {
      needScreenRedraw = false;
      drawScreen();
    }

    // Hover bob
    for (const it of interactives) {
      if (it.object === windowHitbox) continue;
      const isH = hovered === it;
      const bobY = isH ? 0.04 + Math.sin(now * 0.005) * 0.01 : 0;
      it.object.position.y += (it.basePos.y + bobY - it.object.position.y) * 0.18;
    }

    // Plant sway + seasonal growth
    foliageGroup.rotation.y = Math.sin(now * 0.0005) * 0.05;
    foliageGroup.rotation.x = Math.sin(now * 0.0008) * 0.02;
    branches.rotation.y = foliageGroup.rotation.y * 0.5;

    const s = (seasonOfYear * 4) % 4; // 0.0 to 4.0 continuum for seasons

    const smooth = (val: number) => easeInOutCubic(clamp(val, 0, 1));

    for (const item of foliageItems) {
      let scale = 0;

      if (item.type === "bud") {
        if (s > 3.5) scale = lerp(0.0, 1.0, smooth((s - 3.5) / 0.5));
        else if (s <= 0.4) scale = lerp(1.0, 0.0, smooth(s / 0.4));
        else scale = 0;
      } else if (item.type === "flower") {
        if (s <= 0.4) scale = lerp(0.0, 1.0, smooth(s / 0.4));
        else if (s <= 0.8) scale = lerp(1.0, 0.0, smooth((s - 0.4) / 0.4));
        else scale = 0;
      } else if (item.type === "leaf") {
        if (s <= 0.4) scale = 0;
        else if (s <= 0.8) scale = lerp(0.0, 1.0, smooth((s - 0.4) / 0.4));
        else if (s <= 2.5) scale = 1.0;
        else if (s <= 3.0) {
          const dropOffset = Math.abs(item.localPos.x * 10) % 0.3;
          const t = s - dropOffset;
          if (t < 2.5) scale = 1.0;
          else if (t < 3.0) scale = lerp(1.0, 0.0, smooth((t - 2.5) / 0.5));
          else scale = 0;
        } else scale = 0;

        if (scale > 0) {
          const c = item.mesh.material as THREE.MeshToonMaterial;
          if (s < 1.5) {
            c.color.copy(plantColor); // Global green plant color
          } else if (s < 2.5) {
            // Gradual color change from green -> yellow -> orange -> red (1.5 to 2.0)
            const tColor = clamp((s - 1.5) / 0.5, 0, 1);
            if (tColor < 0.33) c.color.copy(plantColor).lerp(new THREE.Color(0xd4b84a), tColor / 0.33);
            else if (tColor < 0.66) c.color.setHex(0xd4b84a).lerp(new THREE.Color(0xd4884a), (tColor - 0.33) / 0.33);
            else c.color.setHex(0xd4884a).lerp(new THREE.Color(0xb04444), (tColor - 0.66) / 0.34);
          } else {
            c.color.setHex(0xb04444); // Stay red while falling
          }
        }
      }

      item.mesh.visible = scale > 0.01;
      const v = Math.max(0.001, scale);
      item.mesh.scale.set(item.baseScale.x * v, item.baseScale.y * v, item.baseScale.z * v);
    }

    // Slow breathing keeps the sleeping cat subtly alive.
    const catBreath = 1 + Math.sin(now * 0.0018) * 0.012;
    catBody.scale.set(
      catBodyBaseScale.x,
      catBodyBaseScale.y * catBreath,
      catBodyBaseScale.z,
    );
    catHead.rotation.z = Math.sin(now * 0.0012) * 0.008;

    // Person head/torso idle motion
    head.rotation.x = Math.sin(now * 0.0004) * 0.02 + 0.1;
    head.rotation.y = Math.sin(now * 0.0003) * 0.03;
    hair.rotation.x = head.rotation.x - 0.15;
    hair.rotation.y = head.rotation.y;
    torso.rotation.y = Math.sin(now * 0.0003) * 0.015;

    // Arm AI — each hand drifts across keyboard to a target key,
    // presses that specific key on arrival, then picks another.
    const updateArmAI = (ai: ArmAI, arm: { armGroup: THREE.Group; elbowGroup: THREE.Group }, side: -1 | 1) => {
      if (ai.phase === "moving") {
        const total = Math.max(1, ai.moveEnd - ai.moveStart);
        const t = clamp((now - ai.moveStart) / total);
        const ee = easeInOutCubic(t);
        ai.currentRotZ = lerp(ai.startRotZ, ai.targetRotZ, ee);
        arm.armGroup.rotation.z = ai.currentRotZ;
        // Small dip — hand taps key, doesn't drive through laptop.
        ai.dipValue = t > 0.65 ? Math.sin(((t - 0.65) / 0.35) * Math.PI) * 0.04 : 0;
        arm.elbowGroup.rotation.x = 0.32 - ai.dipValue;
        if (t >= 1) {
          keyStates[ai.targetKeyIdx].press = 1;
          ai.phase = "hold";
          ai.holdUntil = now + 70 + Math.random() * 150;
        }
      } else {
        arm.armGroup.rotation.z = ai.currentRotZ;
        ai.dipValue *= 0.72;
        arm.elbowGroup.rotation.x = 0.32 - ai.dipValue;
        if (now >= ai.holdUntil) planNextKey(ai, side, now);
      }
    };
    if (!reduceMotion) {
      updateArmAI(leftAI, leftArm, -1);
      updateArmAI(rightAI, rightArm, 1);
    }
    for (let i = 0; i < keyStates.length; i++) keyStates[i].press *= 0.8;

    // Update key matrices
    let ki = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const s = keyStates[ki];
        keyDummy.position.set(s.x, s.baseY - s.press * 0.009, s.z);
        keyDummy.scale.set(1, 1, 1);
        keyDummy.updateMatrix();
        keyMesh.setMatrixAt(ki, keyDummy.matrix);
        ki++;
      }
    }
    {
      const s = keyStates[ki];
      keyDummy.position.set(s.x, s.baseY - s.press * 0.009, s.z);
      keyDummy.scale.set(spaceW / keyW, 1, 1);
      keyDummy.updateMatrix();
      keyMesh.setMatrixAt(ki, keyDummy.matrix);
      keyDummy.scale.set(1, 1, 1);
    }
    keyMesh.instanceMatrix.needsUpdate = true;

    // Outdoor particles (all 4 systems, each with own motion pattern)
    const dtSec = dt / 1000;

    // Sun visibility — strong in spring (0–0.25) + summer (0.25–0.5), fade out autumn/winter
    const sunOp = (() => {
      const sy = seasonOfYear;
      if (sy < 0.42) return 1;
      if (sy < 0.55) return 1 - (sy - 0.42) / 0.13;
      if (sy < 0.9) return 0;
      return (sy - 0.9) / 0.1; // ghost sun starts coming back late winter / early spring
    })();
    (sunDisc.material as THREE.MeshBasicMaterial).opacity = sunOp * 0.95;
    (sunGlow.material as THREE.MeshBasicMaterial).opacity = sunOp * 0.35;
    // Sun color shifts with theme (dark theme = dimmer warm)
    const sunTint = theme === "dark" ? 0xffd080 : 0xffecb3;
    (sunDisc.material as THREE.MeshBasicMaterial).color.setHex(sunTint);
    (sunGlow.material as THREE.MeshBasicMaterial).color.setHex(sunTint);

    // Clouds drift + density by season (more in autumn/winter = overcast)
    const overcast = (() => {
      const sy = seasonOfYear;
      if (sy < 0.5) return 0.35; // spring + summer: light clouds
      return 0.55 + easeInOutCubic(Math.min(1, (sy - 0.5) / 0.3)) * 0.35; // autumn + winter: heavier
    })();
    (cloudMat as THREE.MeshBasicMaterial).opacity = overcast;
    (cloudMat as THREE.MeshBasicMaterial).color.setHex(
      theme === "dark" ? 0x8894a8 : 0xf8f4ec,
    );
    for (const cd of cloudData) {
      cd.mesh.position.x += cd.speed * dtSec;
      if (cd.mesh.position.x > 5.5) cd.mesh.position.x = -5.5;
      cd.mesh.position.y = cd.baseY + Math.sin(now * 0.0002 + cd.mesh.position.x) * 0.03;
    }
    for (const wave of beachWaveData) {
      wave.mesh.position.x =
        wave.baseX + Math.sin(now * 0.00035 + wave.phase) * 0.09;
    }
    spinningRecord.rotation.y += musicIsPlaying ? dtSec * 1.35 : 0;
    if (musicIsPlaying) {
      noteSpawnAccum += dtSec;
      while (noteSpawnAccum > 0.55) {
        noteSpawnAccum -= 0.55;
        if (floatingNotes.length < 10) spawnFloatingNote();
      }
    } else {
      noteSpawnAccum = 0;
    }
    for (let i = floatingNotes.length - 1; i >= 0; i--) {
      const note = floatingNotes[i]!;
      note.age += dtSec;
      const t = note.age / note.life;
      note.mesh.position.y += note.rise * dtSec;
      note.mesh.position.x += note.driftX * dtSec;
      note.mesh.position.z += note.driftZ * dtSec;
      note.mesh.material.rotation += note.spin * dtSec;
      const fade =
        t < 0.15 ? t / 0.15 : t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
      note.mesh.material.opacity = fade * (musicIsPlaying ? 0.9 : 0.35);
      note.mesh.material.color.setHex(theme === "dark" ? 0xf3e6d8 : 0x2b211c);
      if (t >= 1) {
        scene.remove(note.mesh);
        note.mesh.material.dispose();
        floatingNotes.splice(i, 1);
      }
    }
    if (coffeeSteam.visible) {
      coffeeSteam.position.y = Math.sin(now * 0.0012) * 0.008;
      coffeeSteam.rotation.y = Math.sin(now * 0.00055) * 0.08;
    }

    for (let s = 0; s < 4; s++) {
      const key = SEASON_KEYS[s];
      const sys = particleSystems[key];
      if (sys.material.opacity < 0.005) continue;
      for (let i = 0; i < particleCount; i++) {
        sys.positions[i * 3 + 1] -= sys.fall * dtSec * 0.9;
        if (sys.sway > 0) {
          const phase = sys.phases[i] + now * 0.001;
          sys.positions[i * 3] += Math.sin(phase) * sys.sway * dtSec * 0.6;
        }
        if (sys.tumble) sys.rotations[i] += sys.rotVel[i];

        if (sys.positions[i * 3 + 1] < -0.6) {
          sys.positions[i * 3 + 1] = 5;
          sys.positions[i * 3] = (Math.random() - 0.5) * 7;
        }

        particleDummy.position.set(
          sys.positions[i * 3],
          sys.positions[i * 3 + 1],
          sys.positions[i * 3 + 2],
        );
        if (sys.rotateFace) {
          // face camera for rain/snow
          particleDummy.rotation.set(0, 0, 0);
        } else {
          particleDummy.rotation.set(
            sys.tumble ? sys.rotations[i] * 0.4 : 0,
            0,
            sys.tumble ? sys.rotations[i] : 0,
          );
        }
        particleDummy.updateMatrix();
        sys.mesh.setMatrixAt(i, particleDummy.matrix);
      }
      sys.mesh.instanceMatrix.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };

  if ("fonts" in document) {
    Promise.all([
      document.fonts.load("300 240px Fraunces"),
      document.fonts.load("400 26px 'JetBrains Mono'"),
      document.fonts.load("400 64px 'Noto Serif SC'"),
    ]).then(() => drawScreen()).catch(() => {});
  }

  if (reduceMotion) {
    drawScreen();
    renderer.render(scene, camera);
  } else {
    rafId = requestAnimationFrame(animate);
  }

  // ===== Cleanup =====
  const cleanup = () => {
    unlockInteraction();
    if (rafId) cancelAnimationFrame(rafId);
    canvasEl.removeEventListener("wheel", wheelHandler);
    canvasEl.removeEventListener("touchstart", touchStart);
    canvasEl.removeEventListener("touchmove", touchMove);
    canvasEl.removeEventListener("touchend", touchEnd);
    canvasEl.removeEventListener("pointermove", pointerMove);
    canvasEl.removeEventListener("pointerleave", pointerLeave);
    canvasEl.removeEventListener("pointerdown", pointerDownHandler);
    canvasEl.removeEventListener("pointerup", pointerUpHandler);
    cancelMusicHide();
    unsubscribeMusicPlayer();
    musicPlayer?.removeEventListener("mouseenter", musicMouseEnter);
    musicPlayer?.removeEventListener("mouseleave", musicMouseLeave);
    musicToggle?.removeEventListener("click", musicToggleHandler);
    musicPrevious?.removeEventListener("click", musicPreviousHandler);
    musicNext?.removeEventListener("click", musicNextHandler);
    musicPlayer?.classList.remove("is-visible");
    for (const note of floatingNotes) {
      scene.remove(note.mesh);
      note.mesh.material.dispose();
    }
    floatingNotes.length = 0;
    for (const texture of noteTextures) texture.dispose();
    themeObserver.disconnect();
    resizeObs.disconnect();
    controls.dispose();

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mm = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mm)) mm.forEach((m) => m.dispose());
        else mm.dispose();
      }
    });
    screenTexture.dispose();
    renderer.dispose();

    const w = window as unknown as Record<string, unknown>;
    if (w[CLEANUP_KEY] === cleanup) delete w[CLEANUP_KEY];
  };

  (window as unknown as Record<string, () => void>)[CLEANUP_KEY] = cleanup;
  document.addEventListener("astro:before-swap", cleanup, { once: true });
  document.addEventListener("swup:willReplaceContent", cleanup, { once: true });

  return cleanup;
}
