'use strict';

// 시뮬레이션 기본 설정
const canvas = document.getElementById('cavalieriCanvas');
const ctx = canvas.getContext('2d');

let blockCount = 15;      // 블록 쌓기 개수
let shearAmount = 0.0;     // 수평 밀림 정도
let scanY = -1;            // 현재 단면 스캔 중인 Y 위치
let isScanning = false;
let scanProgress = 0;
let activeMode = 'triangle'; // 'triangle'(삼각형), 'sphere'(반구)

// DOM 캐싱
const modeSelect = document.getElementById('modeSelect');
const blockSlider = document.getElementById('blockSlider');
const blockVal = document.getElementById('blockVal');
const shearSlider = document.getElementById('shearSlider');
const shearVal = document.getElementById('shearVal');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
reset();

function resizeCanvas() {
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
    
    ctx.clearRect(0, 0, W, H);
    
    const baseH = H - 40; 
    const totalHeight = 240; 
    const blockH = totalHeight / blockCount; 

    // ----------------------------------------------------
    // [왼쪽 영역] 1. 도형의 기하학적 위상 배치 (적층 구조 원리)
    // ----------------------------------------------------
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, baseH);
    ctx.lineTo(W * 0.55, baseH);
    ctx.stroke();

    const centerA = W * 0.18;
    const centerB = W * 0.42;
    let currentWidth = 0;
    let isCurrentLayerHighlighted = false;

    for (let i = 0; i < blockCount; i++) {
        const yPos = baseH - (i * blockH) - blockH;
        const isHighlighted = isScanning && (scanY >= yPos && scanY <= yPos + blockH);

        let widthA = (activeMode === 'triangle') ? 120 * (1 - (i / blockCount)) : 130 * Math.sqrt(Math.max(0, 1 - Math.pow(i / blockCount, 2)));

        // 도형 A (기준)
        ctx.fillStyle = isHighlighted ? '#f43f5e' : 'rgba(56, 189, 248, 0.75)';
        ctx.strokeStyle = isHighlighted ? '#ffffff' : '#0284c7';
        ctx.fillRect(centerA - widthA / 2, yPos, widthA, blockH);
        ctx.strokeRect(centerA - widthA / 2, yPos, widthA, blockH);

        // 도형 B (변형) - 카발리에리 원리에 의해 두께와 가로 폭이 A와 항상 일치!
        ctx.fillStyle = isHighlighted ? '#f43f5e' : 'rgba(16, 185, 129, 0.75)';
        ctx.strokeStyle = isHighlighted ? '#ffffff' : '#059669';
        const shiftX = (i * 15) * shearAmount; 
        ctx.fillRect(centerB - widthA / 2 + shiftX, yPos, widthA, blockH);
        ctx.strokeRect(centerB - widthA / 2 + shiftX, yPos, widthA, blockH);

        if (isHighlighted) {
            currentWidth = widthA;
            isCurrentLayerHighlighted = true;
        }
    }

    // ----------------------------------------------------
    // [오른쪽 영역] 2. 높이에 따른 단면적 그래프 (항상 표시됨)
    // ----------------------------------------------------
    const graphLeft = W * 0.68;
    const graphWidth = W * 0.26;
    const graphBot = baseH;
    const graphTop = baseH - totalHeight;

    // 그래프 좌표축 그리기
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(graphLeft, graphTop - 10);
    ctx.lineTo(graphLeft, graphBot);
    ctx.lineTo(graphLeft + graphWidth + 10, graphBot);
    ctx.stroke();

    // X축 가이드 라벨
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText("단면 크기 →", graphLeft + graphWidth - 40, graphBot + 15);
    ctx.fillText("↑ 높이 (y)", graphLeft - 45, graphTop - 5);

    // 전체 단면 크기 스펙트럼 곡선 미리 그려두기 (질문 주신 빈 화면 해결!)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= totalHeight; i++) {
        const yLocal = i;
        const ratio = yLocal / totalHeight;
        const wSim = (activeMode === 'triangle') ? 120 * (1 - ratio) : 130 * Math.sqrt(Math.max(0, 1 - ratio * ratio));
        
        // 가로축 스케일 매핑
        const xPos = graphLeft + (wSim * (graphWidth / 130));
        const yPos = graphBot - yLocal;
        if (i === 0) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
    }
    ctx.stroke();

    // ----------------------------------------------------
    // [동적 연출] 실시간 스캔 레이저 및 데이터 바인딩
    // ----------------------------------------------------
    if (isScanning) {
        // 좌우 도형을 가로지르는 빨간색 스캔 레이저
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(15, scanY);
        ctx.lineTo(graphLeft + graphWidth, scanY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 오른쪽 그래프 위에 실시간 추적용 붉은 점 표시
        const graphX = graphLeft + (currentWidth * (graphWidth / 130));
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(graphX, scanY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // 그림자 초기화

        // 단면 수치 가이드 텍스트
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`폭: ${currentWidth.toFixed(0)}px`, centerA - 25, scanY - 6);
        ctx.fillText(`폭: ${currentWidth.toFixed(0)}px`, centerB - 25 + ((baseH - scanY)/blockH * 1.0), scanY - 6);
    }

    // 우측 수식 대시보드 문자열 실시간 연동
    if (isCurrentLayerHighlighted) {
        document.getElementById('formula-curr-y').innerText = ((baseH - scanY) / totalHeight * 10).toFixed(1);
        document.getElementById('formula-curr-size').innerText = (currentWidth * 1.5).toFixed(0);
    }
}

function animateScan() {
    if (!isScanning) return;
    const H = canvas.height / window.devicePixelRatio;
    const baseH = H - 40;
    const totalHeight = 240;

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

// 이벤트 인터페이스 바인딩
modeSelect.addEventListener('change', (e) => {
    activeMode = e.target.value;
    const title = document.getElementById('formula-title');
    const desc = document.getElementById('formula-desc');
    if (activeMode === 'triangle') {
        title.innerText = "2D 삼각형 넓이 쌓기";
        desc.innerText = "조각들의 위치를 옆으로 아무리 비틀고 찌그러트려도, 수평으로 자른 단면 조각의 길이 자체는 변하지 않으므로 전체 넓이는 똑같습니다.";
    } else {
        title.innerText = "3D 동전 부피 쌓기";
        desc.innerText = "반지름과 높이의 비율에 따라 쌓인 원판(동전) 더미입니다. 비틀어 짜여도 낱개 동전의 면적이 완벽히 같으므로 총 부피 역시 유지됩니다.";
    }
    reset();
});

blockSlider.addEventListener('input', (e) => {
    blockCount = parseInt(e.target.value);
    blockVal.innerText = blockCount;
    render();
});

shearSlider.addEventListener('input', (e) => {
    shearAmount = parseFloat(e.target.value);
    shearVal.innerText = shearAmount === 0 ? "0.0 (정렬)" : shearAmount > 0 ? `${shearAmount.toFixed(1)} (우측 밀림)` : `${Math.abs(shearAmount).toFixed(1)} (좌측 밀림)`;
    render();
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
    render();
}

resetBtn.addEventListener('click', reset);
