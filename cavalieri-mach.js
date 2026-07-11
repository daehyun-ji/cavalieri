'use strict';

// 3D 그래픽 엔진 설정을 위한 Three.js 변수
let scene, camera, renderer;
let shapeAGroup, shapeBGroup;
let scanPlane; // 실시간 레이저 스캔면

let blockCount = 15;
let shearAmount = 0.0;
let scanProgress = 0;
let isScanning = false;
let scanY = 0;
let activeMode = 'sphere'; // 'triangle' (2D 평면), 'sphere' (3D 반구 입체)

// HTML 내 Canvas 요소를 Three.js 뷰포트로 대체하기 위한 초기화
const container = document.getElementById('canvas3dContainer');
const blockSlider = document.getElementById('blockSlider');
const blockVal = document.getElementById('blockVal');
const shearSlider = document.getElementById('shearSlider');
const shearVal = document.getElementById('shearVal');
const modeSelect = document.getElementById('modeSelect');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

init3D();
animate();

function init3D() {
    // 1. 3차원 가상 공간(Scene) 생성
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);

    // 2. 카메라 배치 (입체감을 느낄 수 있는 원근 카메라)
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / 380, 0.1, 1000);
    camera.position.set(0, 15, 30);
    camera.lookAt(0, 5, 0);

    // 3. 웹브라우저 3D 렌더러 생성 및 결합
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, 380);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 4. 조명 추가 (도형의 입체적인 질감과 볼륨감을 살리기 위함)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    // 도형들을 담을 3D 그룹 생성
    shapeAGroup = new THREE.Group();
    shapeBGroup = new THREE.Group();
    shapeAGroup.position.x = -7;
    shapeBGroup.position.x = 7;
    scene.add(shapeAGroup);
    scene.add(scene.add(shapeBGroup));

    // 5. 실시간 단면을 잘라 보여줄 빨간색 반투명 스캔 레이저 면
    const planeGeo = new THREE.PlaneGeometry(30, 30);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide, transparent: true, opacity: 0.0 });
    scanPlane = new THREE.Mesh(planeGeo, planeMat);
    scanPlane.rotation.x = Math.PI / 2; // 수평으로 눕힘
    scene.add(scanPlane);

    // 초기 도형 그리기
    buildShapes();

    // 마우스 드래그로 화면 회전이 가능하도록 간단한 인터랙션 구현 (기초 궤도 로테이션)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    renderer.domElement.addEventListener('mousedown', () => isDragging = true);
    renderer.domElement.addEventListener('mousemove', (e) => {
        const deltaMove = { x: e.offsetX - previousMousePosition.x, y: e.offsetY - previousMousePosition.y };
        if (isDragging) {
            scene.rotation.y += deltaMove.x * 0.005;
            scene.rotation.x += deltaMove.y * 0.005;
        }
        previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('resize', onWindowResize);
}

function buildShapes() {
    // 기존에 생성된 3D 객체 제거
    while(shapeAGroup.children.length > 0) shapeAGroup.remove(shapeAGroup.children[0]);
    while(shapeBGroup.children.length > 0) shapeBGroup.remove(shapeBGroup.children[0]);

    const totalHeight = 8;
    const diskH = totalHeight / blockCount;
    const radiusR = 5; // 기준 반지름 R = 5

    for (let i = 0; i < blockCount; i++) {
        const yPos = (i * diskH) + diskH/2;
        const ratio = i / blockCount;
        
        let currentRadius = 0;
        let geometryA, geometryB;

        if (activeMode === 'sphere') {
            // [진짜 3D 구체 입체 원리] 반지름 계산: r = sqrt(R^2 - y^2)
            const currentYRadius = (i / blockCount) * radiusR;
            currentRadius = Math.sqrt(Math.max(0, radiusR * radiusR - currentYRadius * currentYRadius));
            
            // 3차원 실린더(원판 디스크/동전 모양) 객체 생성
            geometryA = new THREE.CylinderGeometry(currentRadius, currentRadius, diskH, 32);
            geometryB = new THREE.CylinderGeometry(currentRadius, currentRadius, diskH, 32);
        } else {
            // 2D 삼각형 모드일 경우 각 기둥(박스) 형태로 표현
            const boxW = 6 * (1 - ratio);
            geometryA = new THREE.BoxGeometry(boxW, diskH, 2);
            geometryB = new THREE.BoxGeometry(boxW, diskH, 2);
            currentRadius = boxW / 2;
        }

        // 도형 A (똑바로 정렬된 진짜 입체 원판 더미)
        const matA = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, metalness: 0.1 });
        const diskA = new THREE.Mesh(geometryA, matA);
        diskA.position.set(0, yPos, 0);
        shapeAGroup.add(diskA);

        // 도형 B (수평 슬라이더에 의해 옆으로 스르륵 밀리는 원판 더미)
        const matB = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4, metalness: 0.1 });
        const diskB = new THREE.Mesh(geometryB, matB);
        
        // [핵심 인터랙션] 층별로 미끄러지는 수평 Shear 벡터 적용
        const shiftX = (i * 0.6) * shearAmount;
        diskB.position.set(shiftX, yPos, 0);
        shapeBGroup.add(diskB);
    }
}

function animate() {
    requestAnimationFrame(animate);

    // 실시간 스캔 애니메이션 연출
    if (isScanning) {
        scanProgress += 0.005;
        if (scanProgress > 1.0) {
            isScanning = false;
            scanPlane.material.opacity = 0.0;
            scanProgress = 0;
        } else {
            scanY = scanProgress * 8;
            scanPlane.position.y = scanY;
            scanPlane.material.opacity = 0.4;

            // 스캔선이 지나는 위치의 레이어 색상을 빨간색으로 하이라이트
            const activeIndex = Math.floor(scanProgress * blockCount);
            
            // 실시간 계측 데이터 텍스트 화면 연동
            document.getElementById('formula-curr-y').innerText = (scanProgress * 10).toFixed(1);
            
            let displaySize = 0;
            if (activeMode === 'sphere') {
                const radiusR = 5;
                const currentYRadius = scanProgress * radiusR;
                const r = Math.sqrt(Math.max(0, radiusR * radiusR - currentYRadius * currentYRadius));
                displaySize = Math.PI * r * r; // 진짜 원의 면적 (pi * r^2)
                document.getElementById('formula-curr-size').innerText = `${displaySize.toFixed(1)} (πr² 면적)`;
            } else {
                displaySize = 6 * (1 - scanProgress);
                document.getElementById('formula-curr-size').innerText = `${displaySize.toFixed(1)} (선분 길이)`;
            }
        }
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = container.clientWidth / 380;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, 380);
}

// UI 이벤트 리스너 바인딩
modeSelect.addEventListener('change', (e) => {
    activeMode = e.target.value;
    buildShapes();
});

blockSlider.addEventListener('input', (e) => {
    blockCount = parseInt(e.target.value);
    blockVal.innerText = blockCount;
    buildShapes();
});

shearSlider.addEventListener('input', (e) => {
    shearAmount = parseFloat(e.target.value);
    shearVal.innerText = shearAmount === 0 ? "0.0 (수직 정렬)" : `${shearAmount > 0 ? '우측' : '좌측'} 비틀림 (${Math.abs(shearAmount).toFixed(1)})`;
    buildShapes();
});

startBtn.addEventListener('click', () => {
    isScanning = true;
    scanProgress = 0;
});

resetBtn.addEventListener('click', () => {
    isScanning = false;
    scanProgress = 0;
    scanPlane.material.opacity = 0.0;
    shearAmount = 0;
    shearSlider.value = 0;
    shearVal.innerText = "0.0 (수직 정렬)";
    buildShapes();
    document.getElementById('formula-curr-y').innerText = "0.0";
    document.getElementById('formula-curr-size').innerText = "0";
});
