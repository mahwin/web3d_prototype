import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MODEL_NAMES = ['cabinet', 'device', 'tile'] as const;
const BASE_PATH = './asset';
const SLASH = '/';
const DOT = '.' ;
const UNDERBAR = '_';

const MODEL = 'model';
const IMAGE = 'image';

const FORMAT = {
    GLB: 'glb',
    PNG: 'png',
} as const;


const BACK ='back';
const FRONT ='front';

type DIRECTION = typeof BACK | typeof FRONT;

const U_SIZES = [1, 2, 4, 8, 10, 12, 14, 16] as const;
type U_SIZE = typeof U_SIZES[number];
const U ='u'

const DEVICE_UNITS = ['1u', '2u', '4u', '8u', '10u', '12u', '14u', '16u'] as const;
type DEVICE_UNIT_TYPE = typeof DEVICE_UNITS[number]

const randomUSize = () => U_SIZES[Math.floor(Math.random() * U_SIZES.length)];
    
const getImageName = (uSize: U_SIZE, side: DIRECTION) => `${uSize}${U}${UNDERBAR}${side}`;

const getModelPath = (modelName: string) => `${BASE_PATH}${SLASH}${MODEL}${SLASH}${modelName}${DOT}${FORMAT.GLB}`; 

const getFrontImagePath = (uSize: U_SIZE) => `${BASE_PATH}${SLASH}${IMAGE}${SLASH}${getImageName(uSize, FRONT)}${DOT}${FORMAT.PNG}`;
const getBackImagePath = (uSize: U_SIZE) => `${BASE_PATH}${SLASH}${IMAGE}${SLASH}${getImageName(uSize, BACK)}${DOT}${FORMAT.PNG}`;

type ModelNames = typeof MODEL_NAMES[number]; 

type TEXTURE_MAP = Record< DIRECTION, THREE.Texture>;

interface ModelMap extends Record<ModelNames, THREE.Object3D> {}
class App {
    
    private _renderer!: THREE.WebGLRenderer;
    private _container!: HTMLDivElement;
    private _scene!: THREE.Scene;
    private _camera!: THREE.PerspectiveCamera;
    private _modelMap: ModelMap = {} as ModelMap;
    private _deviceTextureMap: Record<string, TEXTURE_MAP>={}


    constructor() {
        this._setup();

        requestAnimationFrame(this._render.bind(this));
    }
        
    private async _setup(){
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

    async _loadModels(){
        // 모델 로드
        const loader = new GLTFLoader();
        const modelPaths = MODEL_NAMES.map(getModelPath);
        const models = await Promise.all(modelPaths.map(path => loader.loadAsync(path)));

        MODEL_NAMES.forEach((modelName, index) => {
            this._modelMap[modelName] = models[index].scene;
        })
        
        // 이미지 로드
        const imagePaths = U_SIZES.flatMap((uSize) => [getBackImagePath(uSize), getFrontImagePath(uSize)]);
        
        const images = await Promise.all(imagePaths.map(path => new THREE.TextureLoader().loadAsync(path)));
        
        images.forEach((imageTexture, index) => {
            const filePath = imagePaths[index];
            const fileName = filePath.split('/').pop();
            if(!fileName) return;
            
            const [imageName, direction] = fileName?.split('.')[0].split('_');

            if(this._deviceTextureMap[imageName] === undefined) {
                this._deviceTextureMap[imageName] = {} as TEXTURE_MAP;
            }
             
            this._deviceTextureMap[imageName][direction as DIRECTION] =imageTexture;
        })
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

    private _addEventListener(){
        window.addEventListener('resize', this._setupResize.bind(this));
    }

    private _setupResize(){
        const { clientWidth: width, clientHeight: height } = this._container;
        
        // 렌더러 크기 업데이트
        this._renderer.setSize(width, height);

        // 카메라 종횡비 업데이트
        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();
    }

    private _render(){
        this._renderer.render(this._scene, this._camera);
        
        requestAnimationFrame(this._render.bind(this));
    }
    private _createDevice(deviceUnit: DEVICE_UNIT_TYPE){
        const originDevice = this._modelMap.device.clone();
        const originDeviceVector = this._getObjectSize(originDevice);
        const customDeviceGeometry = new THREE.BoxGeometry(...originDeviceVector)
        customDeviceGeometry.scale(1,Number(deviceUnit[0]),1);
        const deviceMaterial = this._getDeviceMaterial(deviceUnit);
        return new THREE.Mesh(customDeviceGeometry, deviceMaterial);
    }
    
    private _createCabinet(){
        
        const cabinet = this._modelMap.cabinet.clone();
        cabinet.scale.set(0.9, 0.9, 0.9);
        cabinet.lookAt(-1, 0, 0);
        
        
        const { y: totalY } = this._getObjectSize(cabinet);
        const CABINET_HEIGHT = 223;
        const realYPerCm = totalY / CABINET_HEIGHT;
        
        const uCm = 4.445;
        const startY = realYPerCm * (5 + uCm / 2 ) ;
        
        let lackU = 1
        while(lackU < 42){
            let uPosition = randomUSize();
            const divice = this._createDevice(`${uPosition}u`);
            divice.position.y = startY + realYPerCm * lackU * uCm;
            cabinet.add(divice);
            lackU += uPosition;
        }

        return cabinet;
    }

    private _addCabinets(){
        for (let c = 0; c < 10; c++) {
            const cabinet = this._createCabinet();
            cabinet.position.x = -2 ;
            cabinet.position.z = -2.25 + c * 0.5;
            this._scene.add(cabinet);
        }

        for (let c = 0; c < 10; c++) {
            const cabinet = this._createCabinet();
            cabinet.position.x = -2 + 4.5;
            cabinet.position.z = -2.25 + c * 0.5;
            cabinet.rotateY(Math.PI);
            this._scene.add(cabinet);
        }
    }

    private _addModel(){
        this._addCabinets();
        this._addTilesGroup(11, 10);
        
    }

    private _addTilesGroup(rowLen:number, colLen:number, factor:number = 1){
        const group = new THREE.Group();
        
        this._modelMap.tile.scale.set(1/4, 1/2 ,1/4);
       
        const grid = 0.5 * factor;
        const startR = -4.5 * grid * factor;
        const startC = -4.5 * grid * factor;
        
        
        for (let r = 0; r < rowLen; r++) {
            for (let c = 0; c < colLen; c++) {
                const tile =  this._modelMap.tile.clone();
                
                if( r % 3 === 2) {
                    tile.traverse((child) => {
                    if(child instanceof THREE.Mesh){
                        child.material = child.material.clone();
                        child.material.color.set(0xaaaa00);
                    }
                })}
                
                tile.position.x = startR + grid * r;
                tile.position.z = startC + grid * c;

                group.add(tile);
            }
        }
        const tileSize = this._getObjectSize(group);
        group.position.y -= tileSize.y/2;

        this._scene.add(group);
    }

    private _getObjectSize(object: THREE.Object3D){
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        box.getSize(size);
        return size;
    }

    private _setupScene(){
        this._scene = new THREE.Scene();
        
    }

    private _setupCamera(){
        const { clientWidth: width, clientHeight: height } = this._container;
        this._camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this._camera.position.x = 0;
        this._camera.position.z = 0;
        this._camera.position.y = 5;
    }
    private _setupLight(){
        const color = 0xffffff;
        const intensity = 100;
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(-1, 2, 4);
        this._scene.add(light);
    }

    private _setupRenderer(){
        this._renderer =  new THREE.WebGLRenderer({ antialias : true });
        this._renderer.setPixelRatio(window.devicePixelRatio);
        this._container = document.querySelector('#app') as HTMLDivElement; 
        this._container.appendChild(this._renderer.domElement);
    }

    private _getDeviceMaterial(deviceUnit:DEVICE_UNIT_TYPE){
        return [
            new THREE.MeshBasicMaterial({color:'lavender'}),
            new THREE.MeshBasicMaterial({color:'lavender'}),
            new THREE.MeshBasicMaterial({color:'lavender'}),
            new THREE.MeshBasicMaterial({color:'lavender'}),
            new THREE.MeshBasicMaterial({map: this._deviceTextureMap[deviceUnit][BACK]}),
            new THREE.MeshBasicMaterial({map: this._deviceTextureMap[deviceUnit][FRONT]}),
            
        ]
    }
}

new App();



