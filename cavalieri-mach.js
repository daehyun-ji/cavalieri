'use strict';

const maxSteps = 40; // 조각(Slice)의 개수
let currentProgress = 0;
let animationFrameId = null;
let simSpeed = 1.0;
let shearAmount = 0.0; // 밀림 정도 (단면 평행이동)
let activeMode = '2d'; // '2d': 넓이(삼각형), '3d': 부피(구체)

let mainChart, sliceChart;

// DOM 메모리 캐싱
const modeSelect = document.getElementById('modeSelect');
const speedInput = document.getElementById('speedInput');
const shearInput = document.getElementById('shearInput');
const shearVal = document.getElementById('shearVal');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

// 앱 초기 실행
initCharts();
updateFormulaUI();
resetSimulation();

function initCharts() {
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';

    // 1. 전체 도형 및 단면선 시각화 차트
    mainChart = new Chart(document.getElementById('mainChart').getContext('2d'), {
        type: 'scatter',
        data: {
            datasets: [
                { id: 'shape1', label: '도형 A (기준)', data: [], borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.2)', showLine: true, pointRadius: 0, fill: true },
                { id: 'shape2', label: '도형 B (변형)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', showLine: true, pointRadius: 0, fill: true },
                { id: 'scan_line', label: '현재 단면 측정선', data: [], borderColor: '#f43f5e', borderWidth: 2, borderDash: [4,4], showLine: true, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { min: -2.5, max: 5.5 },
                y: { min: -0.5, max: 3.5 }
            },
            animation: false,
            plugins: { legend: { display: true } }
        }
    });

    // 2. 높이에 따른 단면의 크기(길이 또는 넓이) 비교 차트
    sliceChart = new Chart(document.getElementById('sliceChart').getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: '도형 A의 단면 크기', data: [], borderColor: '#38bdf8', borderWidth: 2.5, pointRadius: 0, tension: 0.1 },
                { label: '도형 B의 단면 크기', data: [], borderColor: '#10b981', borderWidth: 2.5, pointRadius: 0, tension: 0.1, borderDash: [3, 3] },
                { label: '현재 높이의 단면 일치성', data: [], backgroundColor: '#f43f5e', borderColor: '#ffffff', borderWidth: 1.5, pointRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: '높이 (y)' }, min: 0, max: 3.0 },
                y: { title: { display: true, text: '단면의 크기 (길이/넓이)' }, min: 0, max: 10.0 }
            },
            animation: false
        }
    });
}

function calculateShapes() {
    const shape1Data = [];
    const shape2Data = [];
    const sliceSpectrumA = [];
    const sliceSpectrumB = [];

    if (activeMode === '2d') {
        // [2D 모드] 밑변과 높이가 같은 삼각형 비교 (도형 A: 직각삼각형, 도형 B: 카발리에리 전단 변형 삼각형)
        // 높이 y는 0부터 3까지
        for (let y = 0; y <= 3.0; y += 0.05) {
            const width = 2.0 * (1 - y / 3.0); // 높이에 따른 단면의 길이 (밑변이 2)
            
            // 도형 A (왼쪽 정렬 정형 삼각형)
            shape1Data.push({ x: 0, y: y });
            shape1Data.push({ x: width, y: y });

            // 도형 B (오른쪽으로 shearAmount만큼 밀린 삼각형)
            const shift = y * shearAmount;
            shape2Data.push({ x: 3.0 + shift, y: y });
            shape2Data.push({ x: 3.0 + shift + width, y: y });

            // 단면의 길이는 둘 다 width로 동일함
            sliceSpectrumA.push({ x: y, y: width });
            sliceSpectrumB.push({ x: y, y: width });
        }
    } else {
        // [3D 모드] 부피 비교 (도형 A: 반구, 도형 B: 원기둥에서 원뿔을 뺀 파형)
        // 반지름 R = 3, 높이 y는 0부터 3까지
        for (let y = 0; y <= 3.0; y += 0.05) {
            // 1. 반지름 3인 반구의 단면 반지름 r = sqrt(R^2 - y^2) -> 단면적 = pi * (9 - y^2)
            const rSemisphere = Math.sqrt(Math.max(0, 9 - y * y));
            shape1Data.push({ x: -rSemisphere, y: y });
            shape1Data.push({ x: rSemisphere, y: y });
            
            const areaA = Math.PI * (9 - y * y);
            sliceSpectrumA.push({ x: y, y: areaA });

            // 2. 외곽 원기둥(반지름3)에서 안쪽 원뿔(반지름=높이 y)을 제외한 영역
            // 단면적 = 원기둥 단면(pi * 9) - 원뿔 단면(pi * y^2) = pi * (9 - y^2)
            // 시각적으로 링(Ring) 구조의 단면 두께 표현
            shape2Data.push({ x: 3.5 + y * shearAmount, y: y });
            shape2Data.push({ x: 3.5 + y * shearAmount + rSemisphere, y: y }); // 기하학적 면적 일치 시각화

            const areaB = Math.PI * (9 - y * y);
            sliceSpectrumB.push({ x: y, y: areaB });
        }
    }

    mainChart.data.datasets[0].data = shape1Data.sort((a,b) => a.y - b.y);
    mainChart.data.datasets[1].data = shape2Data.sort((a,b) => a.y - b.y);
    sliceChart.data.datasets[0].data = sliceSpectrumA;
    sliceChart.data.datasets[1].data = sliceSpectrumB;

    // 차트 스케일 자동 조정
    if (activeMode === '2d') {
        sliceChart.options.scales.y.max = 2.5;
    } else {
        sliceChart.options.scales.y.max = 30.0;
    }

    mainChart.update();
    sliceChart.update();
}

function resetSimulation() {
    cancelAnimationFrame(animationFrameId);
    currentProgress = 0;
    calculateShapes();
    
    mainChart.data.datasets[2].data = [];
    sliceChart.data.datasets[2].data = [];
    
    mainChart.update();
    sliceChart.update();
}

function startSimulation() {
    resetSimulation();
    animate();
}

function animate() {
    if (currentProgress > 3.0) {
        cancelAnimationFrame(animationFrameId);
        return;
    }

    const y = currentProgress;
    
    // 1. 메인 차트에 현재 단면 스캔선 표시
    mainChart.data.datasets[2].data = [
        { x: -2.5, y: y },
        { x: 5.5, y: y }
    ];

    // 2. 단면 차트에 현재 단면 크기 포인트 매핑
    let currentSize = 0;
    if (activeMode === '2d') {
        currentSize = 2.0 * (1 - y / 3.0);
    } else {
        currentSize = Math.PI * (9 - y * y);
    }
    
    sliceChart.data.datasets[2].data = [{ x: y, y: currentSize }];

    mainChart.update('none');
    sliceChart.update('none');

    // 실시간 수식 수치 반영
    document.getElementById('formula-curr-y').innerText = y.toFixed(2);
    document.getElementById('formula-curr-size').innerText = currentSize.toFixed(2);

    currentProgress += (0.02 * simSpeed);
    animationFrameId = requestAnimationFrame(animate);
}

function updateFormulaUI() {
    const titleBox = document.getElementById('formula-title');
    const descBox = document.getElementById('formula-desc');
    
    if (activeMode === '2d') {
        titleBox.innerText = "2D 넓이 검증: 삼각형의 전단 변형";
        descBox.innerText = "밑변의 길이(b)와 높이(h)가 같은 두 삼각형은 모양이 아무리 찌그러져도(Sheared), 임의의 높이 y에서의 선분 단면의 길이 f(y)가 항상 동일하므로 전체 넓이가 같습니다.";
    } else {
        titleBox.innerText = "3D 부피 검증: 반구 vs 사이 영역";
        descBox.innerText = "높이가 y인 지점에서 반구의 단면적 A₁(y) = π(R²-y²) 이며, 원기둥에서 원뿔을 뺀 대조군의 단면적 A₂(y) = πR² - πy² = π(R²-y²) 로 완벽히 동일하므로 전체 부피가 같습니다.";
    }
}

// 이벤트 리스너
modeSelect.addEventListener('change', (e) => {
    activeMode = e.target.value;
    updateFormulaUI();
    resetSimulation();
});

shearInput.addEventListener('input', (e) => {
    shearAmount = parseFloat(e.target.value);
    shearVal.innerText = shearAmount.toFixed(1);
    resetSimulation();
});

speedInput.addEventListener('input', (e) => {
    simSpeed = parseFloat(e.target.value);
});

startBtn.addEventListener('click', startSimulation);
resetBtn.addEventListener('click', resetSimulation);
