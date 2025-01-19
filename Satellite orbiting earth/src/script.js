import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, earthMesh, cloudMesh, starMesh, sunlight, controls, satellite;
let azimuthalAngle = Math.PI / 2; 
let polarAngle = Math.PI / 2; 
const radius = 6; 
let satelliteAngle = 0; 
const satelliteOrbitRadiusX = 3; 
const satelliteOrbitRadiusY = 2; 
const satelliteOrbitRadiusZ = 3; 
const satelliteSpeed = 0.01; 

let clickCounter = 0; 
const maxClicks = 5; 

const vertexShader = `
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    varying vec3 vNormal;
    uniform vec3 uColor;
    
    void main() {
        vec3 light = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(vNormal, light), 0.0);
        vec3 color = diff * uColor;
        gl_FragColor = vec4(color, 1.0);
    }
`;

let initialBodyColor, initialPanelColor; 

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(radius * Math.cos(azimuthalAngle) * Math.sin(polarAngle), radius * Math.cos(polarAngle), radius * Math.sin(azimuthalAngle) * Math.sin(polarAngle));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);
    
    // Sunlight
    sunlight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunlight.position.set(5, 0, 5);
    sunlight.castShadow = true;
    scene.add(sunlight);

    const earthGeometry = new THREE.SphereGeometry(2, 32, 32);

    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('textures/earth/earth4.jpg');
    const specularMap = textureLoader.load('textures/earth/e2.jpg');
    const cloudTexture = textureLoader.load('textures/earth/e3.jpg', () => combineCloudTextures(cloudTexture, 'textures/earth/e5.jpg'));
    const nightTexture = textureLoader.load('textures/earth/e4.jpg');
    const starTexture = textureLoader.load('textures/stars/stars.jpg', createStarBackground);

    const earthMaterial = new THREE.MeshPhongMaterial({
        map: earthTexture,
        specularMap: specularMap,
        specular: new THREE.Color('grey')
    });
    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthMesh);

    createSatellite();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0); 

    controls.addEventListener('change', updateAngles); 

    window.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener('click', onDocumentMouseClick, false);

    animate();
}

function combineCloudTextures(baseTexture, additionalTexturePath) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(additionalTexturePath, (additionalTexture) => {
        const canvas = document.createElement('canvas');
        const size = 1024;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        context.drawImage(baseTexture.image, 0, 0, size, size);
        
        context.globalAlpha = 0.5;
        context.drawImage(additionalTexture.image, 0, 0, size, size);

        const blendedTexture = new THREE.CanvasTexture(canvas);

        const cloudGeometry = new THREE.SphereGeometry(2.05, 32, 32);
        const cloudMaterial = new THREE.MeshPhongMaterial({
            map: blendedTexture,
            transparent: true,
            opacity: 0.4
        });
        cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        scene.add(cloudMesh);
    });
}


function createStarBackground(starTexture) {
    const starGeometry = new THREE.SphereGeometry(90, 64, 64);
    const starMaterial = new THREE.MeshBasicMaterial({
        map: starTexture,
        side: THREE.BackSide
    });
    starMesh = new THREE.Mesh(starGeometry, starMaterial);
    scene.add(starMesh);
}

let satelliteMaterials = [];
let solarPanelMaterial; 

function createSatellite() {
    satellite = new THREE.Group();

    const colors = [
        new THREE.Color(1.0, 1.0, 1.0),  // White
        new THREE.Color(1.0, 0.0, 0.0),  // Red
        new THREE.Color(0.0, 1.0, 1.0),  // Green
        new THREE.Color(0.0, 0.0, 1.0),  // Blue
    ];

    // Satellite body
    satelliteMaterials = colors.map(color => new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            uColor: { value: color }
        },
        side: THREE.DoubleSide,
    }));

  
    initialBodyColor = satelliteMaterials[0].uniforms.uColor.value;
    initialPanelColor = new THREE.Color(0.0, 0.0, 0.5); 

    // solar panel material 
    solarPanelMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            uColor: { value: initialPanelColor }
        },
        side: THREE.DoubleSide,
    });

    // Antenna
    const antennaMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            uColor: { value: new THREE.Color(1.0, 0.84, 0.0) } // Gold
        },
        side: THREE.DoubleSide,
    });

    // Main body
    const bodyGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.2);
    const bodyMesh = new THREE.Mesh(bodyGeometry, satelliteMaterials[0]);
    satellite.add(bodyMesh);

    // Solar panels
    const panelGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.01);
    const leftPanelMesh = new THREE.Mesh(panelGeometry, solarPanelMaterial);
    leftPanelMesh.position.set(-0.25, 0, 0.0);
    satellite.add(leftPanelMesh);

    const rightPanelMesh = new THREE.Mesh(panelGeometry, solarPanelMaterial);
    rightPanelMesh.position.set(0.25, 0, 0.0);
    satellite.add(rightPanelMesh);

    // Antenna
    const antennaGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.1);
    const antennaMesh = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antennaMesh.position.set(0, 0.1, 0);
    satellite.add(antennaMesh);

    satellite.position.set(satelliteOrbitRadiusX, 0, 0);

    scene.add(satellite);
}

function onDocumentKeyDown(event) {
    const keyCode = event.which;
    const angleStep = 0.05;

    switch (keyCode) {
        case 37: // left arrow key
            azimuthalAngle -= angleStep;
            break;
        case 39: // right arrow key
            azimuthalAngle += angleStep;
            break;
        case 38: // up arrow key
            polarAngle = Math.max(0.1, polarAngle - angleStep);
            break;
        case 40: // down arrow key
            polarAngle = Math.min(Math.PI - 0.1, polarAngle + angleStep);
            break;
    }

    updateCameraPosition();
}

function onDocumentMouseClick(event) {
    clickCounter++;

    if (clickCounter >= maxClicks) {
        satelliteMaterials[0].uniforms.uColor.value = initialBodyColor;
        solarPanelMaterial.uniforms.uColor.value = initialPanelColor;
        clickCounter = 0; 
    } else {
        // Change the satellite body color
        let nextColorIndex = (clickCounter) % satelliteMaterials.length;
        satelliteMaterials[0].uniforms.uColor.value = satelliteMaterials[nextColorIndex].uniforms.uColor.value;

        // Change solar panel color
        let newPanelColor = new THREE.Color(Math.random(), Math.random(), Math.random());
        solarPanelMaterial.uniforms.uColor.value = newPanelColor;
    }
}

function updateAngles() {
    const deltaX = camera.position.x - satellite.position.x;
    const deltaY = camera.position.y - satellite.position.y;
    const deltaZ = camera.position.z - satellite.position.z;

    const r = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
    polarAngle = Math.acos(deltaY / r);
    azimuthalAngle = Math.atan2(deltaZ, deltaX);
}

function updateCameraPosition() {
    const x = satellite.position.x + radius * Math.sin(polarAngle) * Math.cos(azimuthalAngle);
    const y = satellite.position.y + radius * Math.cos(polarAngle);
    const z = satellite.position.z + radius * Math.sin(polarAngle) * Math.sin(azimuthalAngle);

    camera.position.set(x, y, z);
    camera.lookAt(satellite.position);
}

function animate() {
    requestAnimationFrame(animate);
    if (earthMesh) earthMesh.rotation.y += 0.001;
    if (cloudMesh) cloudMesh.rotation.y += 0.002;

    satelliteAngle += satelliteSpeed;
    satellite.position.set(
        satelliteOrbitRadiusX * Math.cos(satelliteAngle),
        satelliteOrbitRadiusY * Math.sin(satelliteAngle),
        satelliteOrbitRadiusZ * Math.sin(satelliteAngle)
    );

    satellite.lookAt(earthMesh.position);

    controls.update();
    renderer.render(scene, camera);
}

init();
