let hashChart = null;

document.addEventListener('DOMContentLoaded', () => {
    const walletInput = document.getElementById('wallet-address');
    const poolSelect = document.getElementById('mining-pool');
    const workerInput = document.getElementById('worker-name');
    const algoSelect = document.getElementById('algorithm');
    const threadsInput = document.getElementById('threads');
    const throttleInput = document.getElementById('throttle');
    const throttleValue = document.getElementById('throttle-value');
    
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const clearLogButton = document.getElementById('clear-log');
    
    initHashrateChart();
    
    setDefaultThreads();
    
    throttleInput.addEventListener('input', () => {
        throttleValue.textContent = `${throttleInput.value}%`;
    });
    
    startButton.addEventListener('click', () => {
        const config = {
            walletAddress: walletInput.value.trim(),
            pool: poolSelect.value,
            workerName: workerInput.value.trim() || 'web-worker',
            algorithmId: algoSelect.value,
            threads: parseInt(threadsInput.value),
            throttle: parseInt(throttleInput.value)
        };
        
        if (webMiner.start(config)) {
            startButton.disabled = true;
            stopButton.disabled = false;
            disableInputs(true);
        }
    });
    
    stopButton.addEventListener('click', () => {
        webMiner.stop();
        startButton.disabled = false;
        stopButton.disabled = true;
        disableInputs(false);
    });
    
    clearLogButton.addEventListener('click', () => {
        webMiner.clearLog();
    });
    
    const savedWallet = localStorage.getItem('xmr-wallet');
    if (savedWallet) {
        walletInput.value = savedWallet;
    }
    
    walletInput.addEventListener('change', () => {
        const wallet = walletInput.value.trim();
        if (wallet) {
            localStorage.setItem('xmr-wallet', wallet);
        }
    });
    
    logSystemInfo();
});

function initHashrateChart() {
    const ctx = document.getElementById('hashrate-chart').getContext('2d');
    
    hashChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(20).fill(''),
            datasets: [{
                label: 'Hashrate (H/s)',
                data: Array(20).fill(0),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                pointRadius: 1,
                pointHoverRadius: 5,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'H/s'
                    }
                },
                x: {
                    display: false
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    intersect: false,
                    mode: 'index'
                }
            },
            animation: {
                duration: 500
            }
        }
    });
}

function updateChart(hashrate) {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    
    hashChart.data.labels.shift();
    hashChart.data.datasets[0].data.shift();
    
    hashChart.data.labels.push(time);
    hashChart.data.datasets[0].data.push(hashrate);
    
    hashChart.update('none');
}

function setDefaultThreads() {
    const threadsInput = document.getElementById('threads');
    const logicalCores = navigator.hardwareConcurrency || 4;
    
    const recommendedThreads = Math.max(1, Math.floor(logicalCores * 0.75));
    threadsInput.value = recommendedThreads;
    
    threadsInput.max = logicalCores;
}

function disableInputs(disable) {
    const inputs = [
        'wallet-address',
        'mining-pool',
        'worker-name',
        'algorithm',
        'threads',
        'throttle'
    ];
    
    inputs.forEach(id => {
        document.getElementById(id).disabled = disable;
    });
}

function logSystemInfo() {
    const cores = navigator.hardwareConcurrency || 'Unknown';
    const platform = navigator.platform || 'Unknown';
    const userAgent = navigator.userAgent;
    
    let browserInfo = 'Unknown Browser';
    if (userAgent.indexOf('Chrome') > -1) {
        browserInfo = 'Google Chrome';
    } else if (userAgent.indexOf('Firefox') > -1) {
        browserInfo = 'Mozilla Firefox';
    } else if (userAgent.indexOf('Safari') > -1) {
        browserInfo = 'Safari';
    } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg') > -1) {
        browserInfo = 'Microsoft Edge';
    } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) {
        browserInfo = 'Internet Explorer';
    }
    
    const wasmSupport = checkWasmSupport() ? 'Có hỗ trợ' : 'Không hỗ trợ';
    
    webMiner.logInfo(`Hệ thống: ${platform}, CPU: ${cores} nhân`);
    webMiner.logInfo(`Trình duyệt: ${browserInfo}`);
    webMiner.logInfo(`WebAssembly: ${wasmSupport}`);
    webMiner.logInfo(`Web Miner đã sẵn sàng. Nhập địa chỉ ví của bạn và bấm 'Bắt đầu khai thác'.`);
}
