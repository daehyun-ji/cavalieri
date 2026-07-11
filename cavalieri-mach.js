'use strict';

// 시뮬레이션 기본 설정
const canvas = document.getElementById('cavalieriCanvas');
const ctx = canvas.getContext('2d');

let blockCount = 15;      // 블록(동전) 쌓기 개수
let shearAmount = 0.0;     // 수평 밀림 정도 (0 ~ 1)
let scanY = -1;            // 현재 단면 스캔 중인 Y 위치
let isScanning = false;
let scanProgress = 0;
let activeMode = 'triangle'; // 'triangle'(삼각형/2D), 'sphere'(반구/3D)

// DOM 캐싱
const modeSelect = document.getElementById('modeSelect');
const blockSlider = document.getElementById('blockSlider');
const blockVal = document.getElementById('blockVal');
const shearSlider = document.getElementById('shearSlider');
const shearVal = document.getElementById('shearVal');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

// 초기 세팅 및 캔버스 반응형 리사이즈
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
update();

function resizeCanvas() {
    // 부모 컨테이너 크기에 맞춰 고해상도 대응
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = 380 * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '380px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    render();
}

function render() {
    const W = canvas.width / window.devicePixelRatio;
    const H = canvas.height / window.devicePixelRatio;
    
    // 캔버스 초기화 (다크 테마 배경)
    ctx.clearRect(0, 0, W, H);
    
    const baseH = H - 40; // 바닥 선 기준 위치
    const totalHeight = 240; // 도형들이 가질 총 높이
    const blockH = totalHeight / blockCount; // 블록 하나의 두께

    // 바닥 기준선 그리기
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, baseH);
    ctx.lineTo(W - 30, baseH);
    ctx.stroke();

    // 두 도형의 중심 축 설정
    const centerA = W * 0.28;
    const centerB = W * 0.72;

    // 실시간으로 갱신할 텍스트 창 데이터 초기화
    let currentWidthA = 0;
    let currentWidthB = 0;
    let isCurrentLayerHighlighted = false;

    // 바닥부터 한 층씩 벽돌(동전) 쌓아 올리기
    for (let i = 0; i < blockCount; i++) {
        const yPos = baseH - (i * blockH) - blockH; // 현재 블록의 Y 좌표
        
        // 스캔선이 이 블록 범위 내에 위치하는지 판단
        const isHighlighted = isScanning && (scanY >= yPos && scanY <= yPos + blockH);

        // 1. 왼쪽 도형 (도형 A : 기준 도형)
        ctx.fillStyle = isHighlighted ? '#f43f5e' : 'rgba(56, 189, 248, 0.75)';
        ctx.strokeStyle = isHighlighted ? '#ffffff' : '#0284c7';
        ctx.lineWidth = 1.5;

        let widthA = 0;
        if (activeMode === 'triangle') {
            // 삼각형: 위로 갈수록 선형적으로 줄어듬
            widthA = 140 * (1 - (i / blockCount));
        } else {
            // 반구(3D): 원의 기하학적 단면 r = sqrt(R^2 - h^2) 비율 차용
            const ratio = i / blockCount;
            widthA = 150 * Math.sqrt(Math.max(0, 1 - ratio * ratio));
        }

        // 왼쪽 도형은 제자리에 똑바로 쌓음
        ctx.fillRect(centerA - widthA / 2, yPos, widthA, blockH);
        ctx.strokeRect(centerA - widthA / 2, yPos, widthA, blockH);

        // 2. 오른쪽 도형 (도형 B : 변형/밀린 도형)
        ctx.fillStyle = isHighlighted ? '#f43f5e' : 'rgba(16, 185, 129, 0.75)';
        ctx.strokeStyle = isHighlighted ? '#ffffff' : '#059669';

        // 카발리에리 원리에 의해 두께와 폭(width)은 A와 완전히 동일함!
        let widthB = widthA; 
        
        // [핵심 오락 요소] 슬라이더 값에 따라 층별로 수평 밀림(Shear) 효과 발생
        const shiftX = (i * 18) * shearAmount; 

        ctx.fillRect(centerB - widthB / 2 + shiftX, yPos, widthB, blockH);
        ctx.strokeRect(centerB - widthB / 2 + shiftX, yPos, widthB, blockH);

        // 현재 스캔 중인 레이어의 치수 데이터를 매핑함
        if (isHighlighted) {
            currentWidthA = widthA;
            currentWidthB = widthB;
            isCurrentLayerHighlighted = true;
        }
    }

    // 3. 실시간 빨간색 단면 스캔선 연출
    if (isScanning) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(20, scanY);
        ctx.lineTo(W - 20, scanY);
        ctx.stroke();
        ctx.setLineDash([]); // 대시 초기화

        // 단면선 좌우에 계측 레이블 가이드라인 노출
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`단면 폭: ${currentWidthA.toFixed(0)}px`, centerA - 40, scanY - 6);
        ctx.fillText(`단면 폭: ${currentWidthB.toFixed(0)}px`, centerB - 40 + ((baseH - scanY)/blockH * 1.2), scanY - 6);
    }

    // 우측 수식창 텍스트 동적 업데이트
    if (isCurrentLayerHighlighted) {
        document.getElementById('formula-curr-y').innerText = ((baseH - scanY) / totalHeight * 10).toFixed(1);
        document.getElementById('formula-curr-size').innerText = (currentWidthA * 1.5).toFixed(0);
    }
}

function update() {
    render();
}

function animateScan() {
    if (!isScanning) return;

    const H = canvas.height / window.devicePixelRatio;
    const baseH = H - 40;
    const totalHeight = 240;

    // 바닥에서부터 위로 부드럽게 진행하도록 설정
    scanProgress += 0.008;
    if (scanProgress > 1.0) {
        isScanning = false;
        scanProgress = 0;
        scanY = -1;
        render();
        return;
    }

    scanY = baseH - (totalHeight * scanProgress);
    render();
    requestAnimationFrame(animateScan);
}

// UI 이벤트 바인딩
modeSelect.addEventListener('change', (e) => {
    activeMode = e.target.value;
    const title = document.getElementById('formula-title');
    const desc = document.getElementById('formula-desc');
    
    if (activeMode === 'triangle') {
        title.innerText = "2D 삼각형 넓이 쌓기";
        desc.innerText = "동일한 두께와 길이를 가진 종이 띠(블록)를 비스듬히 밀어도, 각 층의 길이는 변하지 않으므로 전체 넓이는 늘어나거나 줄어들지 않고 똑같습니다.";
    } else {
        title.innerText = "3D 동전 부피 쌓기 (구의 부피)";
        desc.innerText = "동전을 수직으로 이쁘게 쌓으나, 옆으로 비틀어 쌓으나 각 층에 놓인 동전 하나의 면적과 두께가 똑같다면 전체 누적된 부피는 완전히 동일합니다.";
    }
    reset();
});

blockSlider.addEventListener('input', (e) => {
    blockCount = parseInt(e.target.value);
    blockVal.innerText = blockCount;
    update();
});

shearSlider.addEventListener('input', (e) => {
    shearAmount = parseFloat(e.target.value);
    shearVal.innerText = shearAmount === 0 ? "0.0 (정렬)" : shearAmount > 0 ? `${shearAmount.toFixed(1)} (우측 밀림)` : `${Math.abs(shearAmount).toFixed(1)} (좌측 밀림)`;
    update();
});

startBtn.addEventListener('click', () => {
    isScanning = true;
    scanProgress = 0;
    animateScan();
});

function reset() {
    isScanning = false;
    scanProgress = 0;
    scanY = -1;
    document.getElementById('formula-curr-y').innerText = "0.0";
    document.getElementById('formula-curr-size').innerText = "0";
    update();
}

resetBtn.addEventListener('click', reset);
