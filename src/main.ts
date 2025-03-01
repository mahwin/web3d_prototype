import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import rackInfo from "./rackInfo";

const MODEL_NAMES = ["cabinet", "device", "tile"] as const;
const BASE_PATH = "./asset";
const SLASH = "/";
const DOT = ".";
const UNDERBAR = "_";

const MODEL = "model";
const IMAGE = "image";

const FORMAT = {
  GLB: "glb",
  PNG: "png",
} as const;

const BACK = "back";
const FRONT = "front";

type DIRECTION = typeof BACK | typeof FRONT;

const U_SIZES = [1, 2, 4, 8, 10, 12, 14, 16] as const;
type U_SIZE = (typeof U_SIZES)[number];
const U = "u";

const DEVICE_UNITS = [
  "1u",
  "2u",
  "4u",
  "8u",
  "10u",
  "12u",
  "14u",
  "16u",
] as const;
type DEVICE_UNIT_TYPE = (typeof DEVICE_UNITS)[number];

const randomUSize = () => U_SIZES[Math.floor(Math.random() * U_SIZES.length)];

const getImageName = (uSize: U_SIZE, side: DIRECTION) =>
  `${uSize}${U}${UNDERBAR}${side}`;

const getModelPath = (modelName: string) =>
  `${BASE_PATH}${SLASH}${MODEL}${SLASH}${modelName}${DOT}${FORMAT.GLB}`;

const getFrontImagePath = (uSize: U_SIZE) =>
  `${BASE_PATH}${SLASH}${IMAGE}${SLASH}${getImageName(uSize, FRONT)}${DOT}${
    FORMAT.PNG
  }`;
const getBackImagePath = (uSize: U_SIZE) =>
  `${BASE_PATH}${SLASH}${IMAGE}${SLASH}${getImageName(uSize, BACK)}${DOT}${
    FORMAT.PNG
  }`;

type ModelNames = (typeof MODEL_NAMES)[number];

type TEXTURE_MAP = Record<DIRECTION, THREE.Texture>;

interface ModelMap extends Record<ModelNames, THREE.Object3D> {}
class App {
  private _renderer!: THREE.WebGLRenderer;
  private _container!: HTMLDivElement;
  private _scene!: THREE.Scene;
  private _camera!: THREE.PerspectiveCamera;
  private _modelMap: ModelMap = {} as ModelMap;
  private _deviceTextureMap: Record<string, TEXTURE_MAP> = {};

  constructor() {
    this._setup();

    requestAnimationFrame(this._render.bind(this));
  }

  private async _setup() {
    // 캔버스 만들고, body에 붙이고, this에 바인딩딩
    this._setupScene();
    this._setupRenderer();
    this._setupCamera();
    this._setupLight();
    this._setupResize();
    this._setupControls();

    // 헬퍼
    this._setupHelper();

    // resize 이벤트 추가
    this._addEventListener();

    // load 3d model
    // 로드 중입니다. 표시
    await this._loadModels();
    // model 그리기
    this._addModel();
  }

  async _loadModels() {
    // 모델 로드
    const loader = new GLTFLoader();
    const modelPaths = MODEL_NAMES.map(getModelPath);
    const models = await Promise.all(
      modelPaths.map((path) => loader.loadAsync(path))
    );

    MODEL_NAMES.forEach((modelName, index) => {
      this._modelMap[modelName] = models[index].scene;
    });

    // 이미지 로드
    const imagePaths = U_SIZES.flatMap((uSize) => [
      getBackImagePath(uSize),
      getFrontImagePath(uSize),
    ]);

    const images = await Promise.all(
      imagePaths.map((path) => new THREE.TextureLoader().loadAsync(path))
    );

    images.forEach((imageTexture, index) => {
      const filePath = imagePaths[index];
      const fileName = filePath.split("/").pop();
      if (!fileName) return;

      const [imageName, direction] = fileName?.split(".")[0].split("_");

      if (this._deviceTextureMap[imageName] === undefined) {
        this._deviceTextureMap[imageName] = {} as TEXTURE_MAP;
      }

      this._deviceTextureMap[imageName][direction as DIRECTION] = imageTexture;
    });
  }

  _setupControls() {
    new OrbitControls(this._camera, this._container);
  }

  _setupHelper() {
    const axesHelper = new THREE.AxesHelper(100);
    const gridHelper = new THREE.GridHelper(5);
    this._scene.add(axesHelper);
    this._scene.add(gridHelper);
  }

  private _addEventListener() {
    window.addEventListener("resize", this._setupResize.bind(this));
  }

  private _setupResize() {
    const { clientWidth: width, clientHeight: height } = this._container;

    // 렌더러 크기 업데이트
    this._renderer.setSize(width, height);

    // 카메라 종횡비 업데이트
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
  }

  private _render() {
    this._renderer.render(this._scene, this._camera);

    requestAnimationFrame(this._render.bind(this));
  }
  private _createDevice(deviceUnit: U_SIZE, zScale: number = 1) {
    const originDevice = this._modelMap.device.clone();
    const { x, y, z } = this._getObjectSize(originDevice);
    const customDeviceGeometry = new THREE.BoxGeometry(
      x,
      y * deviceUnit,
      z * zScale
    );
    const deviceMaterial = this._getDeviceMaterial(deviceUnit);
    return new THREE.Mesh(customDeviceGeometry, deviceMaterial);
  }

  private _addCabinets() {
    // 왼쪽쪽 row
    for (let c = 0; c < 10; c++) {
      const cabinet = this._combinationDeviceOnCabinet();
      cabinet.position.x = -2;
      cabinet.position.z = -2.25 + c * 0.5;
      this._scene.add(cabinet);
    }

    // 오른쪽 row
    for (let c = 0; c < 10; c++) {
      const cabinet = this._combinationDeviceOnCabinet();
      cabinet.position.x = -2 + 4.5;
      cabinet.position.z = -2.25 + c * 0.5;
      cabinet.rotateY(Math.PI);
      this._scene.add(cabinet);
    }
  }

  private _addModel() {
    this._addCabinets();
    this._addTilesGroup(11, 10);
  }

  private _addTilesGroup(rowLen: number, colLen: number, factor: number = 1) {
    const group = new THREE.Group();

    this._modelMap.tile.scale.set(1 / 4, 1 / 2, 1 / 4);

    const grid = 0.5 * factor;
    const startR = -4.5 * grid * factor;
    const startC = -4.5 * grid * factor;

    for (let r = 0; r < rowLen; r++) {
      for (let c = 0; c < colLen; c++) {
        const tile = this._modelMap.tile.clone();

        // 3번째 row는 노란색으로
        if (r % 3 === 2) {
          tile.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = child.material.clone();
              child.material.color.set(0xaaaa00);
            }
          });
        }

        tile.position.x = startR + grid * r;
        tile.position.z = startC + grid * c;

        group.add(tile);
      }
    }
    const tileSize = this._getObjectSize(group);
    group.position.y -= tileSize.y / 2;

    this._scene.add(group);
  }

  private _getObjectSize(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    return size;
  }

  private _setupScene() {
    this._scene = new THREE.Scene();
  }

  private _setupCamera() {
    const { clientWidth: width, clientHeight: height } = this._container;
    this._camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this._camera.position.x = 0;
    this._camera.position.z = 0;
    this._camera.position.y = 4;
    this._camera.lookAt(0, 4, 4);
  }
  private _setupLight() {
    const color = 0xffffff;
    const intensity = 100;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(-1, 2, 4);
    this._scene.add(light);
  }

  private _createTrailFair(trailWidth: number) {
    const originDevice = this._modelMap.device.clone();
    const { z: deviceZ, x: deviceX } = this._getObjectSize(originDevice);
    const { y: cabinetY } = this._getObjectSize(this._modelMap.cabinet);

    const trailY = cabinetY * 0.92;

    const trailFair = new THREE.Group();

    const rightTrail = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, trailY, trailWidth),
      new THREE.MeshBasicMaterial({ color: "cyan" })
    );

    rightTrail.position.x = -deviceX / 2;
    rightTrail.position.z = -deviceZ / 2 + trailWidth / 2 - 0.001;

    const leftTrail = rightTrail.clone();
    leftTrail.position.x = deviceX / 2;

    trailFair.add(rightTrail);
    trailFair.add(leftTrail);
    trailFair.position.y = trailY / 2;
    return trailFair;
  }

  private _combinationDeviceOnCabinet() {
    const { y: cabinetY } = this._getObjectSize(this._modelMap.cabinet);
    const { z: deviceZ } = this._getObjectSize(this._modelMap.device);

    // 트레일 만들기
    const trailWidth = 0.05;
    const frontTrailFair = this._createTrailFair(trailWidth);
    const backTrailFair = this._createTrailFair(trailWidth);

    // 랙 마운트에 필요한 단위 값
    const uPerCm = 4.445;
    const startCm = 5;
    const realYPerCm = cabinetY / 223;

    rackInfo.forEach((info) => {
      if (Math.random() < 0.3) return;
      const deviceScale = info.z;
      const uSize = info.y as U_SIZE;
      const device = this._createDevice(uSize, deviceScale);

      const centerU = info.uPosition - uSize / 2;

      const centerCm = startCm + centerU * uPerCm;
      device.position.z -= ((1 - deviceScale) * deviceZ) / 2;
      device.position.y = realYPerCm * centerCm - (cabinetY * 0.92) / 2;

      info.railsUsed === FRONT
        ? frontTrailFair.add(device)
        : backTrailFair.add(device);
    });

    backTrailFair.rotateY(Math.PI);

    const cabinet = this._modelMap.cabinet.clone();

    cabinet.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material.transparent = true;
        child.material.opacity = 0.8; // 투명도 설정 (0: 완전 투명, 1: 불투명)
      }
    });

    cabinet.scale.set(0.9, 0.9, 0.9);
    cabinet.lookAt(-1, 0, 0);

    cabinet.add(frontTrailFair);
    cabinet.add(backTrailFair);

    return cabinet;
  }

  private _setupRenderer() {
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._container = document.querySelector("#app") as HTMLDivElement;
    this._container.appendChild(this._renderer.domElement);
  }

  private _getDeviceMaterial(uSize: U_SIZE) {
    const color = "lightgray";
    return [
      new THREE.MeshBasicMaterial({ color }),
      new THREE.MeshBasicMaterial({ color }),
      new THREE.MeshBasicMaterial({ color }),
      new THREE.MeshBasicMaterial({ color }),
      new THREE.MeshBasicMaterial({
        map: this._deviceTextureMap[`${uSize}${U}`][BACK],
      }),
      new THREE.MeshBasicMaterial({
        map: this._deviceTextureMap[`${uSize}${U}`][FRONT],
      }),
    ];
  }
}

new App();
