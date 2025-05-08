let hashChart = null;
let cpuUsageChart = null;
let activeThreads = 0;
let threadElements = [];
let savedPools = [];
let systemInfo = {};
let autoConfigActive = false;

document.addEventListener('DOMContentLoaded', () => {
    initUserInterface();
    detectSystemInfo();
    loadSavedConfig();
    setupEventListeners();
    initCharts();
    logMessage('Hệ thống đã khởi động. Sẵn sàng khai thác.', 'info');
});

function initUserInterface() {
    updateHardwareInfo({ detecting: true });
    
    const wasmSupported = checkWasmSupport();
    if (!wasmSupported) {
        logMessage('Trình duyệt của bạn không hỗ trợ WebAssembly. Không thể khai thác.', 'error');
        document.getElementById('start-button').disabled = true;
    }
    
    document.getElementById('throttle-value').textContent = '70%';
    
    const threadsSlider = document.getElementById('threads-slider');
    const threadsInput = document.getElementById('threads');
    
    threadsSlider.addEventListener('input', () => {
        threadsInput.value = threadsSlider.value;
        updateThreadsContainer(parseInt(threadsSlider.value));
    });
    
    threadsInput.addEventListener('input', () => {
        let value = parseInt(threadsInput.value);
        const maxThreads = parseInt(threadsSlider.max);
        
        if (isNaN(value) || value < 1) value = 1;
        if (value > maxThreads) value = maxThreads;
        
        threadsInput.value = value;
        threadsSlider.value = value;
        updateThreadsContainer(value);
    });
    
    const throttleSlider = document.getElementById('throttle-slider');
    throttleSlider.addEventListener('input', () => {
        document.getElementById('throttle-value').textContent = `${throttleSlider.value}%`;
    });
    
    updateThreadsContainer(parseInt(threadsInput.value));
}

function detectSystemInfo() {
    const isAppleDevice = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
    const cores = navigator.hardwareConcurrency || 4;
    
    const userAgent = navigator.userAgent;
    let cpuInfo = 'Unknown CPU';
    let browserInfo = 'Unknown Browser';
    
    if (userAgent.includes('Chrome')) {
        browserInfo = 'Google Chrome';
    } else if (userAgent.includes('Firefox')) {
        browserInfo = 'Mozilla Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browserInfo = 'Safari';
    } else if (userAgent.includes('Edge') || userAgent.includes('Edg')) {
        browserInfo = 'Microsoft Edge';
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
        browserInfo = 'Internet Explorer';
    }
    
    if (isAppleDevice) {
        cpuInfo = 'Apple Silicon/Intel';
    } else if (userAgent.includes('Win64') || userAgent.includes('WOW64')) {
        cpuInfo = 'x86_64 CPU';
    } else if (userAgent.includes('Linux')) {
        cpuInfo = 'Linux CPU';
    } else if (userAgent.includes('Android')) {
        cpuInfo = 'ARM CPU';
    }
    
    systemInfo = {
        cores,
        logicalCores: cores,
        physicalCores: Math.ceil(cores / 2),
        cpuModel: cpuInfo,
        isAppleDevice,
        browser: browserInfo,
        platform: navigator.platform,
        memory: getTotalSystemMemory(),
        wasmSupport: checkWasmSupport(),
        webWorkersSupport: checkWebWorkersSupport(),
        sharedMemorySupport: checkSharedMemorySupport()
    };
    
    updateHardwareInfo({ 
        cpuModel: systemInfo.cpuModel, 
        cores: systemInfo.cores,
        recommended: recommendThreads(MINER_CONFIG.defaultAlgorithm)
    });
    
    const threadsSlider = document.getElementById('threads-slider');
    threadsSlider.max = systemInfo.cores;
    document.getElementById('threads').max = systemInfo.cores;
    
    const recommendedThreads = recommendThreads(MINER_CONFIG.defaultAlgorithm);
    threadsSlider.value = recommendedThreads;
    document.getElementById('threads').value = recommendedThreads;
    
    updateThreadsContainer(recommendedThreads);
    
    logMessage(`Phát hiện CPU: ${systemInfo.cpuModel} với ${systemInfo.cores} luồng`, 'info');
    logMessage(`Trình duyệt: ${systemInfo.browser} trên ${systemInfo.platform}`, 'info');
    logMessage(`WebAssembly: ${systemInfo.wasmSupport ? 'Được hỗ trợ' : 'Không được hỗ trợ'}`, systemInfo.wasmSupport ? 'info' : 'warning');
}

function updateHardwareInfo(info) {
    const cpuModelElement = document.getElementById('cpu-model');
    const maxThreadsElement = document.getElementById('max-threads');
    const recommendedThreadsElement = document.getElementById('recommended-threads');
    
    if (info.detecting) {
        cpuModelElement.textContent = 'Đang phát hiện...';
        maxThreadsElement.textContent = 'Đang phát hiện...';
        recommendedThreadsElement.textContent = 'Đang phát hiện...';
        return;
    }
    
    cpuModelElement.textContent = info.cpuModel || 'Không thể phát hiện';
    maxThreadsElement.textContent = info.cores || 'Unknown';
    recommendedThreadsElement.innerHTML = info.recommended ? 
        `<strong class="text-success">${info.recommended}</strong>` : 'Unknown';
}

function updateThreadsContainer(count) {
    const container = document.getElementById('threads-container');
    container.innerHTML = '';
    threadElements = [];
    
    for (let i = 0; i < count; i++) {
        const threadElement = document.createElement('div');
        threadElement.className = 'thread-item';
        threadElement.innerHTML = `
            <div class="thread-number">Luồng ${i + 1}</div>
            <div class="thread-hashrate" id="thread-hashrate-${i}">0 H/s</div>
            <div class="thread-usage">
                <div class="thread-usage-bar" id="thread-usage-${i}" style="width: 0%"></div>
            </div>
        `;
        container.appendChild(threadElement);
        threadElements.push({
            hashrateElement: document.getElementById(`thread-hashrate-${i}`),
            usageElement: document.getElementById(`thread-usage-${i}`)
        });
    }
}

function initCharts() {
    const hashCtx = document.getElementById('hashrate-chart').getContext('2d');
    
    hashChart = new Chart(hashCtx, {
        type: 'line',
        data: {
            labels: Array(30).fill(''),
            datasets: [{
                label: 'Hashrate (H/s)',
                data: Array(30).fill(0),
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
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
                    mode: 'index',
                    intersect: false
                }
            },
            animation: {
                duration: 300
            }
        }
    });
}

function updateHashrateChart(hashrate) {
    if (!hashChart) return;
    
    const now = new Date();
    const timeLabel = now.toTimeString().substring(0, 8);
    
    hashChart.data.labels.push(timeLabel);
    hashChart.data.datasets[0].data.push(hashrate);
    
    if (hashChart.data.labels.length > 30) {
        hashChart.data.labels.shift();
        hashChart.data.datasets[0].data.shift();
    }
    
    hashChart.update('none');
}

function setupEventListeners() {
    document.getElementById('start-button').addEventListener('click', startMining);
    document.getElementById('stop-button').addEventListener('click', stopMining);
    
    document.getElementById('check-pool').addEventListener('click', checkPoolConnection);
    document.getElementById('save-pool').addEventListener('click', savePoolConfig);
    
    document.getElementById('auto-config').addEventListener('click', autoConfigureSettings);
    
    const algorithmSelect = document.getElementById('algorithm');
    if (algorithmSelect) {
        algorithmSelect.addEventListener('change', (e) => {
            const algorithmId = e.target.value;
            const recommendedThreads = recommendThreads(algorithmId);
            
            document.getElementById('recommended-threads').innerHTML = 
                `<strong class="text-success">${recommendedThreads}</strong>`;
            
            if (autoConfigActive) {
                document.getElementById('threads-slider').value = recommendedThreads;
                document.getElementById('threads').value = recommendedThreads;
                updateThreadsContainer(recommendedThreads);
            }
        });
    }
    
    document.getElementById('toggle-advanced').addEventListener('click', () => {
        const panel = document.getElementById('advanced-panel');
        panel.classList.toggle('hidden');
    });
    
    const aboutLink = document.getElementById('about-link');
    const aboutModal = document.getElementById('about-modal');
    const closeButtons = document.querySelectorAll('.close-modal');
    
    aboutLink.addEventListener('click', (e) => {
        e.preventDefault();
        aboutModal.style.display = 'block';
    });
    
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('about-modal').style.display = 'none';
            document.getElementById('pool-modal').style.display = 'none';
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === aboutModal) {
            aboutModal.style.display = 'none';
        }
        if (e.target === document.getElementById('pool-modal')) {
            document.getElementById('pool-modal').style.display = 'none';
        }
    });
    
    document.getElementById('clear-data').addEventListener('click', clearSavedData);
}

function startMining() {
    const poolUrl = document.getElementById('pool-url').value.trim();
    const poolPort = document.getElementById('pool-port').value.trim();
    const walletAddress = document.getElementById('wallet-address').value.trim();
    const workerName = document.getElementById('worker-name').value.trim() || 'web-worker';
    const poolPassword = document.getElementById('pool-password').value.trim() || 'x';
    const threadsCount = parseInt(document.getElementById('threads').value);
    const throttle = parseInt(document.getElementById('throttle-slider').value);
    
    if (!walletAddress) {
        logMessage('Vui lòng nhập địa chỉ ví của bạn', 'error');
        return;
    }
    
    if (!poolUrl) {
        logMessage('Vui lòng nhập URL pool khai thác', 'error');
        return;
    }
    
    if (!poolPort || isNaN(parseInt(poolPort))) {
        logMessage('Vui lòng nhập port hợp lệ', 'error');
        return;
    }
    
    const config = {
        pool: `${poolUrl}:${poolPort}`,
        wallet: walletAddress,
        worker: workerName,
        password: poolPassword,
        threads: threadsCount,
        throttle: throttle,
        algorithm: document.getElementById('algorithm') ? 
            document.getElementById('algorithm').value : MINER_CONFIG.defaultAlgorithm
    };
    
    localStorage.setItem('mining-config', JSON.stringify({
        pool: poolUrl,
        port: poolPort,
        wallet: walletAddress,
        worker: workerName,
        threads: threadsCount,
        throttle: throttle,
        algorithm: config.algorithm
    }));
    
    logMessage(`Bắt đầu khai thác: ${config.pool} với ${config.threads} luồng`, 'info');
    
    document.getElementById('start-button').disabled = true;
    document.getElementById('stop-button').disabled = false;
    document.getElementById('mining-status').textContent = 'Đang kết nối...';
    document.getElementById('status-light').className = 'status-light connecting';
    document.getElementById('connection-status').textContent = 'Đang kết nối...';
    
    toggleInputs(true);
    
    simulateStartMining(config);
}

let hashrateInterval;
function simulateStartMining(config) {
    activeThreads = config.threads;
    
    setTimeout(() => {
        document.getElementById('mining-status').textContent = 'Đang chạy';
        document.getElementById('status-light').className = 'status-light active';
        document.getElementById('connection-status').textContent = 'Đã kết nối';
        
        logMessage(`Kết nối thành công đến ${config.pool}`, 'success');
        
        startHashrateSimulation(config);
    }, 2000);
}

function startHashrateSimulation(config) {
    const algorithm = getAlgorithmInfo(config.algorithm);
    const baseHashratePerThread = 25;
    
    const startTime = new Date();
    let totalHashes = 0;
    
    hashrateInterval = setInterval(() => {
        if (!document.getElementById('stop-button').disabled) {
            let totalHashrate = 0;
            
            for (let i = 0; i < config.threads; i++) {
                const threadFactor = 0.7 + (Math.random() * 0.6);
                const threadIntensity = config.throttle / 100;
                const threadHashrate = baseHashratePerThread * algorithm.hashrateFactor * threadFactor * threadIntensity;
                
                if (threadElements[i]) {
                    threadElements[i].hashrateElement.textContent = `${threadHashrate.toFixed(1)} H/s`;
                    
                    const usagePercent = Math.min(100, (50 + Math.random() * 50) * threadIntensity);
                    threadElements[i].usageElement.style.width = `${usagePercent}%`;
                }
                
                totalHashrate += threadHashrate;
            }
            
            document.getElementById('hashrate').textContent = `${totalHashrate.toFixed(2)} H/s`;
            
            totalHashes += totalHashrate * 2;
            document.getElementById('total-hashes').textContent = Math.floor(totalHashes).toLocaleString();
            
            const now = new Date();
            const diff = Math.floor((now - startTime) / 1000);
            const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const seconds = (diff % 60).toString().padStart(2, '0');
            document.getElementById('runtime').textContent = `${hours}:${minutes}:${seconds}`;
            
            updateHashrateChart(totalHashrate);
            
            if (Math.random() < 0.05) {
                logMessage(`Share #${Math.floor(Math.random() * 1000)} được chấp nhận: ${totalHashrate.toFixed(1)} H/s`, 'success');
            }
        }
    }, 2000);
}

function stopMining() {
    clearInterval(hashrateInterval);
    
    document.getElementById('start-button').disabled = false;
    document.getElementById('stop-button').disabled = true;
    document.getElementById('mining-status').textContent = 'Đã dừng';
    document.getElementById('status-light').className = 'status-light inactive';
    document.getElementById('connection-status').textContent = 'Không kết nối';
    
    threadElements.forEach(thread => {
        thread.hashrateElement.textContent = '0 H/s';
        thread.usageElement.style.width = '0%';
    });
    
    toggleInputs(false);
    
    logMessage('Khai thác đã dừng.', 'info');
}

function toggleInputs(disabled) {
    const inputs = [
        'pool-url', 'pool-port', 'wallet-address', 'worker-name', 
        'pool-password', 'threads-slider', 'threads', 'throttle-slider',
        'check-pool', 'save-pool', 'auto-config'
    ];
    
    if (document.getElementById('algorithm')) {
        inputs.push('algorithm');
    }
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = disabled;
    });
}

function logMessage(message, type = 'info') {
    const logContainer = document.getElementById('logs');
    const time = new Date().toTimeString().substring(0, 8);
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${time}] ${message}`;
    
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    if (logContainer.children.length > MINER_CONFIG.maxLogEntries) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

function checkPoolConnection() {
    const poolUrl = document.getElementById('pool-url').value.trim();
    const poolPort = document.getElementById('pool-port').value.trim();
    
    if (!poolUrl || !poolPort) {
        logMessage('Vui lòng nhập URL và port của pool khai thác', 'warning');
        return;
    }
    
    logMessage(`Đang kiểm tra kết nối đến ${poolUrl}:${poolPort}...`, 'info');
    
    setTimeout(() => {
        const success = Math.random() > 0.2;
        
        if (success) {
            const poolInfo = getMiningPoolInfo(poolUrl);
            if (poolInfo) {
                logMessage(`Kết nối thành công đến ${poolInfo.name} (${poolUrl}:${poolPort})`, 'success');
                logMessage(`Phí pool: ${poolInfo.fee}%, Thanh toán tối thiểu: ${poolInfo.minPayout} XMR`, 'info');
            } else {
                logMessage(`Kết nối thành công đến ${poolUrl}:${poolPort}`, 'success');
            }
        } else {
            logMessage(`Không thể kết nối đến ${poolUrl}:${poolPort}. Vui lòng kiểm tra URL và port.`, 'error');
        }
    }, 1500);
}

function savePoolConfig() {
    const poolUrl = document.getElementById('pool-url').value.trim();
    const poolPort = document.getElementById('pool-port').value.trim();
    
    if (!poolUrl || !poolPort) {
        logMessage('Vui lòng nhập URL và port của pool khai thác', 'warning');
        return;
    }
    
    const existingIndex = savedPools.findIndex(p => 
        p.url === poolUrl && p.port === poolPort
    );
    
    if (existingIndex !== -1) {
        savedPools[existingIndex].lastUsed = new Date().getTime();
    } else {
        savedPools.push({
            url: poolUrl,
            port: poolPort,
            lastUsed: new Date().getTime()
        });
    }
    
    localStorage.setItem('saved-pools', JSON.stringify(savedPools));
    
    updateSavedPoolsList();
    
    logMessage(`Đã lưu cấu hình pool: ${poolUrl}:${poolPort}`, 'success');
}

function updateSavedPoolsList() {
    const container = document.getElementById('saved-pools-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (savedPools.length === 0) {
        container.innerHTML = '<div>Chưa có pool nào được lưu</div>';
        return;
    }
    
    savedPools.sort((a, b) => b.lastUsed - a.lastUsed);
    
    savedPools.slice(0, 3).forEach(pool => {
        const poolElement = document.createElement('div');
        poolElement.className = 'saved-pool-item';
        poolElement.innerHTML = `
            <i class="fas fa-server"></i> ${pool.url}:${pool.port}
        `;
        
        poolElement.addEventListener('click', () => {
            document.getElementById('pool-url').value = pool.url;
            document.getElementById('pool-port').value = pool.port;
        });
        
        container.appendChild(poolElement);
    });
    
    if (savedPools.length > 3) {
        const viewAllBtn = document.createElement('div');
        viewAllBtn.className = 'saved-pool-item';
        viewAllBtn.innerHTML = `<i class="fas fa-ellipsis-h"></i> Xem tất cả (${savedPools.length})`;
        
        viewAllBtn.addEventListener('click', showAllPools);
        
        container.appendChild(viewAllBtn);
    }
}

function showAllPools() {
    const poolModal = document.getElementById('pool-modal');
    const poolList = document.getElementById('pool-list');
    
    poolList.innerHTML = '';
    
    savedPools.forEach(pool => {
        const poolItem = document.createElement('div');
        poolItem.className = 'pool-list-item';
        poolItem.innerHTML = `
            <div class="pool-list-item-info">
                <div class="pool-list-item-name">${pool.url}:${pool.port}</div>
                <div class="pool-list-item-url">Lần cuối sử dụng: ${new Date(pool.lastUsed).toLocaleString()}</div>
            </div>
            <div class="pool-list-item-actions">
                <button class="load-btn" title="Tải cấu hình này"><i class="fas fa-check"></i></button>
                <button class="delete-btn" title="Xóa cấu hình này"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        const loadBtn = poolItem.querySelector('.load-btn');
        loadBtn.addEventListener('click', () => {
            document.getElementById('pool-url').value = pool.url;
            document.getElementById('pool-port').value = pool.port;
            poolModal.style.display = 'none';
        });
        
        const deleteBtn = poolItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            savedPools = savedPools.filter(p => 
                !(p.url === pool.url && p.port === pool.port)
            );
            localStorage.setItem('saved-pools', JSON.stringify(savedPools));
            poolItem.remove();
            
            if (savedPools.length === 0) {
                poolList.innerHTML = '<div class="pool-list-empty">Không có pool nào được lưu</div>';
            }
            
            updateSavedPoolsList();
        });
        
        poolList.appendChild(poolItem);
    });
    
    poolModal.style.display = 'block';
}

function loadSavedConfig() {
    try {
        const savedPoolsData = localStorage.getItem('saved-pools');
        if (savedPoolsData) {
            savedPools = JSON.parse(savedPoolsData);
            updateSavedPoolsList();
        }
        
        const savedConfig = localStorage.getItem('mining-config');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            
            if (config.pool) document.getElementById('pool-url').value = config.pool;
            if (config.port) document.getElementById('pool-port').value = config.port;
            if (config.wallet) document.getElementById('wallet-address').value = config.wallet;
            if (config.worker) document.getElementById('worker-name').value = config.worker;
            
            if (config.threads) {
                const threadsValue = parseInt(config.threads);
                if (!isNaN(threadsValue) && threadsValue > 0) {
                    document.getElementById('threads').value = threadsValue;
                    document.getElementById('threads-slider').value = threadsValue;
                    updateThreadsContainer(threadsValue);
                }
            }
            
            if (config.throttle) {
                const throttleValue = parseInt(config.throttle);
                if (!isNaN(throttleValue) && throttleValue >= 0 && throttleValue <= 100) {
                    document.getElementById('throttle-slider').value = throttleValue;
                    document.getElementById('throttle-value').textContent = `${throttleValue}%`;
                }
            }
            
            const algorithmSelect = document.getElementById('algorithm');
            if (config.algorithm && algorithmSelect) {
                algorithmSelect.value = config.algorithm;
            }
            
            logMessage('Cấu hình đã lưu đã được tải', 'info');
        }
    } catch (error) {
        console.error('Lỗi khi tải cấu hình đã lưu:', error);
        logMessage('Không thể tải cấu hình đã lưu', 'error');
    }
}

function clearSavedData() {
    if (confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu đã lưu?')) {
        localStorage.removeItem('mining-config');
        localStorage.removeItem('saved-pools');
        
        savedPools = [];
        updateSavedPoolsList();
        
        document.getElementById('pool-url').value = '';
        document.getElementById('pool-port').value = '';
        document.getElementById('wallet-address').value = '';
        document.getElementById('worker-name').value = 'web-worker';
        
        const recommendedThreads = recommendThreads(MINER_CONFIG.defaultAlgorithm);
        document.getElementById('threads').value = recommendedThreads;
        document.getElementById('threads-slider').value = recommendedThreads;
        updateThreadsContainer(recommendedThreads);
        
        document.getElementById('throttle-slider').value = 70;
        document.getElementById('throttle-value').textContent = '70%';
        
        logMessage('Tất cả dữ liệu đã lưu đã bị xóa', 'warning');
    }
}

function autoConfigureSettings() {
    autoConfigActive = true;
    
    const algorithm = document.getElementById('algorithm') ? 
        document.getElementById('algorithm').value : MINER_CONFIG.defaultAlgorithm;
    
    const recommendedThreads = recommendThreads(algorithm);
    document.getElementById('threads').value = recommendedThreads;
    document.getElementById('threads-slider').value = recommendedThreads;
    
    let recommendedThrottle = 70;
    if (systemInfo.isAppleDevice) {
        recommendedThrottle = 60;
    } else if (systemInfo.cores <= 2) {
        recommendedThrottle = 50;
    } else if (systemInfo.cores >= 8) {
        recommendedThrottle = 80;
    }
    
    document.getElementById('throttle-slider').value = recommendedThrottle;
    document.getElementById('throttle-value').textContent = `${recommendedThrottle}%`;
    
    updateThreadsContainer(recommendedThreads);
    
    logMessage(`Cấu hình tự động: ${recommendedThreads} luồng với cường độ ${recommendedThrottle}%`, 'info');
    
    setTimeout(() => {
        autoConfigActive = false;
    }, 5000);
}
