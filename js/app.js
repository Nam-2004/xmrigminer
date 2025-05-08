/**
 * XMR Web Miner - App.js
 * Quản lý giao diện người dùng và tương tác với miner
 */

// Các biến toàn cục
let hashChart = null;
let activeThreads = 0;
let threadElements = [];
let savedPools = [];
let systemInfo = {};
let autoConfigActive = false;

// Khởi tạo ứng dụng khi tải trang xong
document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo giao diện người dùng
    initUserInterface();
    
    // Khởi tạo thông tin CPU và phát hiện hệ thống
    detectSystemInfo();
    
    // Tải cấu hình đã lưu
    loadSavedConfig();
    
    // Khởi tạo kết nối sự kiện
    setupEventListeners();
    
    // Khởi tạo biểu đồ
    initCharts();
    
    // Ghi nhật ký khởi động
    logMessage('Hệ thống đã khởi động. Sẵn sàng khai thác.', 'info');
});

/**
 * Khởi tạo và cấu hình các thành phần giao diện người dùng
 */
function initUserInterface() {
    // Hiển thị khả năng phần cứng
    updateHardwareInfo({ detecting: true });
    
    // Cập nhật kết quả kiểm tra WebAssembly
    const wasmSupported = checkWasmSupport();
    if (!wasmSupported) {
        logMessage('Trình duyệt của bạn không hỗ trợ WebAssembly. Không thể khai thác.', 'error');
        document.getElementById('start-button').disabled = true;
    }
    
    // Thiết lập giá trị mặc định cho throttle
    document.getElementById('throttle-value').textContent = '70%';
    
    // Đồng bộ giữa slider và input số luồng
    const threadsSlider = document.getElementById('threads-slider');
    const threadsInput = document.getElementById('threads');
    
    threadsSlider.addEventListener('input', () => {
        threadsInput.value = threadsSlider.value;
        updateThreadsContainer(parseInt(threadsSlider.value));
    });
    
    threadsInput.addEventListener('input', () => {
        let value = parseInt(threadsInput.value);
        const maxThreads = parseInt(threadsSlider.max);
        
        // Giới hạn trong phạm vi hợp lệ
        if (isNaN(value) || value < 1) value = 1;
        if (value > maxThreads) value = maxThreads;
        
        threadsInput.value = value;
        threadsSlider.value = value;
        updateThreadsContainer(value);
    });
    
    // Thiết lập throttle slider
    const throttleSlider = document.getElementById('throttle-slider');
    throttleSlider.addEventListener('input', () => {
        document.getElementById('throttle-value').textContent = `${throttleSlider.value}%`;
    });
    
    // Khởi tạo container hiệu suất luồng
    updateThreadsContainer(parseInt(threadsInput.value));
}

/**
 * Phát hiện thông tin hệ thống và CPU
 */
function detectSystemInfo() {
    const isAppleDevice = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
    const cores = navigator.hardwareConcurrency || 4;
    
    const userAgent = navigator.userAgent;
    let cpuInfo = 'Unknown CPU';
    let browserInfo = 'Unknown Browser';
    
    // Phát hiện trình duyệt
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
    
    // Phát hiện CPU dựa trên platform
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
        physicalCores: Math.ceil(cores / 2), // Ước tính
        cpuModel: cpuInfo,
        isAppleDevice,
        browser: browserInfo,
        platform: navigator.platform,
        memory: getTotalSystemMemory(),
        wasmSupport: checkWasmSupport(),
        webWorkersSupport: checkWebWorkersSupport(),
        sharedMemorySupport: checkSharedMemorySupport()
    };
    
    // Cập nhật UI với thông tin phát hiện được
    updateHardwareInfo({ 
        cpuModel: systemInfo.cpuModel, 
        cores: systemInfo.cores,
        recommended: recommendThreads(MINER_CONFIG.defaultAlgorithm)
    });
    
    // Cập nhật giá trị tối đa cho thanh trượt luồng
    const threadsSlider = document.getElementById('threads-slider');
    threadsSlider.max = systemInfo.cores;
    document.getElementById('threads').max = systemInfo.cores;
    
    // Thiết lập số luồng đề xuất
    const recommendedThreads = recommendThreads(MINER_CONFIG.defaultAlgorithm);
    threadsSlider.value = recommendedThreads;
    document.getElementById('threads').value = recommendedThreads;
    
    // Cập nhật UI luồng
    updateThreadsContainer(recommendedThreads);
    
    // Ghi nhật ký thông tin hệ thống
    logMessage(`Phát hiện CPU: ${systemInfo.cpuModel} với ${systemInfo.cores} luồng`, 'info');
    logMessage(`Trình duyệt: ${systemInfo.browser} trên ${systemInfo.platform}`, 'info');
    logMessage(`WebAssembly: ${systemInfo.wasmSupport ? 'Được hỗ trợ' : 'Không được hỗ trợ'}`, systemInfo.wasmSupport ? 'info' : 'warning');
}

/**
 * Cập nhật thông tin phần cứng được hiển thị
 * @param {Object} info - Thông tin phần cứng để hiển thị
 */
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

/**
 * Cập nhật container hiệu suất luồng
 * @param {number} count - Số lượng luồng
 */
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

/**
 * Khởi tạo các biểu đồ
 */
function initCharts() {
    // Biểu đồ hashrate
    const hashCtx = document.getElementById('hashrate-chart').getContext('2d');
    
    hashChart = new Chart(hashCtx, {
        type: 'line',
        data: {
            labels: Array(30).fill(''),
            datasets: [{
                label: 'Hashrate (H/s)',
                data: Array(30).fill(0),
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
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

/**
 * Cập nhật biểu đồ hashrate
 * @param {number} hashrate - Giá trị hashrate hiện tại
 */
function updateHashrateChart(hashrate) {
    if (!hashChart) return;
    
    const now = new Date();
    const timeLabel = now.toTimeString().substring(0, 8);
    
    // Thêm dữ liệu mới vào biểu đồ
    hashChart.data.labels.push(timeLabel);
    hashChart.data.datasets[0].data.push(hashrate);
    
    // Duy trì độ dài tối đa 30 điểm dữ liệu
    if (hashChart.data.labels.length > 30) {
        hashChart.data.labels.shift();
        hashChart.data.datasets[0].data.shift();
    }
    
    // Cập nhật biểu đồ với animation hạn chế để tránh lag
    hashChart.update('none');
}

/**
 * Thiết lập tất cả các sự kiện lắng nghe
 */
function setupEventListeners() {
    // Nút bắt đầu và dừng khai thác
    document.getElementById('start-button').addEventListener('click', startMining);
    document.getElementById('stop-button').addEventListener('click', stopMining);
    
    // Nút kiểm tra kết nối và lưu cấu hình pool
    document.getElementById('check-pool').addEventListener('click', checkPoolConnection);
    document.getElementById('save-pool').addEventListener('click', savePoolConfig);
    
    // Nút tự động cấu hình
    document.getElementById('auto-config').addEventListener('click', autoConfigureSettings);
    
    // Chọn thuật toán (nếu có trong HTML)
    const algorithmSelect = document.getElementById('algorithm');
    if (algorithmSelect) {
        algorithmSelect.addEventListener('change', (e) => {
            const algorithmId = e.target.value;
            const recommendedThreads = recommendThreads(algorithmId);
            
            // Cập nhật UI với đề xuất mới
            document.getElementById('recommended-threads').innerHTML = 
                `<strong class="text-success">${recommendedThreads}</strong>`;
            
            if (autoConfigActive) {
                // Nếu đang tự động cấu hình, cập nhật số luồng
                document.getElementById('threads-slider').value = recommendedThreads;
                document.getElementById('threads').value = recommendedThreads;
                updateThreadsContainer(recommendedThreads);
            }
        });
    }
    
    // Toggle panel tùy chọn nâng cao
    document.getElementById('toggle-advanced').addEventListener('click', () => {
        const panel = document.getElementById('advanced-panel');
        panel.classList.toggle('hidden');
    });
    
    // Xử lý modal about
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
    
    // Đóng modal khi nhấp bên ngoài
    window.addEventListener('click', (e) => {
        if (e.target === aboutModal) {
            aboutModal.style.display = 'none';
        }
        if (e.target === document.getElementById('pool-modal')) {
            document.getElementById('pool-modal').style.display = 'none';
        }
    });
    
    // Nút xóa dữ liệu
    document.getElementById('clear-data').addEventListener('click', clearSavedData);
}

/**
 * Bắt đầu khai thác
 */
function startMining() {
    // Xác thực đầu vào
    const poolUrl = document.getElementById('pool-url').value.trim();
    const poolPort = document.getElementById('pool-port').value.trim();
    const walletAddress = document.getElementById('wallet-address').value.trim();
    const workerName = document.getElementById('worker-name').value.trim() || 'web-worker';
    const poolPassword = document.getElementById('pool-password').value.trim() || 'x';
    const threadsCount = parseInt(document.getElementById('threads').value);
    const throttle = parseInt(document.getElementById('throttle-slider').value);
    
    // Kiểm tra wallet address
    if (!walletAddress) {
        logMessage('Vui lòng nhập địa chỉ ví của bạn', 'error');
        return;
    }
    
    // Kiểm tra URL pool
    if (!poolUrl) {
        logMessage('Vui lòng nhập URL pool khai thác', 'error');
        return;
    }
    
    // Kiểm tra port
    if (!poolPort || isNaN(parseInt(poolPort))) {
        logMessage('Vui lòng nhập port hợp lệ', 'error');
        return;
    }
    
    // Tạo cấu hình đầy đủ cho miner
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
    
    // Lưu cấu hình vào local storage
    localStorage.setItem('mining-config', JSON.stringify({
        pool: poolUrl,
        port: poolPort,
        wallet: walletAddress,
        worker: workerName,
        threads: threadsCount,
        throttle: throttle,
        algorithm: config.algorithm
    }));
    
    // Ghi nhật ký
    logMessage(`Bắt đầu khai thác: ${config.pool} với ${config.threads} luồng`, 'info');
    
    // Cập nhật UI
    document.getElementById('start-button').disabled = true;
    document.getElementById('stop-button').disabled = false;
    document.getElementById('mining-status').textContent = 'Đang kết nối...';
    document.getElementById('status-light').className = 'status-light connecting';
    document.getElementById('connection-status').textContent = 'Đang kết nối...';
    
    // Vô hiệu hóa các form đầu vào
    toggleInputs(true);
    
    // Sử dụng WebMiner để bắt đầu khai thác
    if (window.webMiner) {
        window.webMiner.start(config);
    } else {
        // Nếu không có WebMiner, mô phỏng khai thác (cho mục đích demo)
        simulateStartMining(config);
    }
}

/**
 * Mô phỏng việc bắt đầu khai thác - thay thế bằng gọi thực tế đến miner.js khi triển khai
 * @param {Object} config - Cấu hình khai thác
 */
let hashrateInterval;
function simulateStartMining(config) {
    activeThreads = config.threads;
    
    // Mô phỏng kết nối
    setTimeout(() => {
        // Cập nhật UI để hiển thị kết nối thành công
        document.getElementById('mining-status').textContent = 'Đang chạy';
        document.getElementById('status-light').className = 'status-light active';
        document.getElementById('connection-status').textContent = 'Đã kết nối';
        
        logMessage(`Kết nối thành công đến ${config.pool}`, 'success');
        
        // Bắt đầu mô phỏng hashrate
        startHashrateSimulation(config);
    }, 2000);
}

/**
 * Mô phỏng hashrate cho mục đích demo
 * @param {Object} config - Cấu hình khai thác
 */
function startHashrateSimulation(config) {
    const algorithm = getAlgorithmInfo(config.algorithm);
    const baseHashratePerThread = 25; // H/s cơ bản cho mỗi luồng
    
    // Khởi tạo thời gian bắt đầu
    const startTime = new Date();
    let totalHashes = 0;
    
    // Cập nhật hashrate mỗi 2 giây
    hashrateInterval = setInterval(() => {
        // Chỉ chạy nếu active
        if (!document.getElementById('stop-button').disabled) {
            // Tính tổng hashrate từ tất cả các luồng
            let totalHashrate = 0;
            
            // Cập nhật mỗi luồng
            for (let i = 0; i < config.threads; i++) {
                // Tạo dao động ngẫu nhiên cho hashrate của từng luồng
                const threadFactor = 0.7 + (Math.random() * 0.6);
                const threadIntensity = config.throttle / 100;
                const threadHashrate = baseHashratePerThread * algorithm.hashrateFactor * threadFactor * threadIntensity;
                
                // Cập nhật UI cho luồng
                if (threadElements[i]) {
                    threadElements[i].hashrateElement.textContent = `${threadHashrate.toFixed(1)} H/s`;
                    
                    // Mô phỏng CPU usage (50-100% của throttle được đặt)
                    const usagePercent = Math.min(100, (50 + Math.random() * 50) * threadIntensity);
                    threadElements[i].usageElement.style.width = `${usagePercent}%`;
                }
                
                totalHashrate += threadHashrate;
            }
            
            // Cập nhật tổng hashrate trên UI
            document.getElementById('hashrate').textContent = `${totalHashrate.toFixed(2)} H/s`;
            
            // Cập nhật tổng hash đã được tính toán
            totalHashes += totalHashrate * 2; // 2 giây giữa các cập nhật
            document.getElementById('total-hashes').textContent = Math.floor(totalHashes).toLocaleString();
            
            // Cập nhật thời gian chạy
            const now = new Date();
            const diff = Math.floor((now - startTime) / 1000);
            const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const seconds = (diff % 60).toString().padStart(2, '0');
            document.getElementById('runtime').textContent = `${hours}:${minutes}:${seconds}`;
            
            // Cập nhật biểu đồ hashrate
            updateHashrateChart(totalHashrate);
            
            // Thỉnh thoảng ghi nhật ký một share để mô phỏng tiến trình
            if (Math.random() < 0.05) { // 5% cơ hội mỗi lần cập nhật
                logMessage(`Share #${Math.floor(Math.random() * 1000)} được chấp nhận: ${totalHashrate.toFixed(1)} H/s`, 'success');
            }
        }
    }, 2000);
}

/**
 * Dừng khai thác
 */
function stopMining() {
    // Xóa khoảng thời gian cập nhật hashrate
    clearInterval(hashrateInterval);
    
    // Sử dụng WebMiner để dừng khai thác
    if (window.webMiner) {
        window.webMiner.stop();
    }
    
    // Cập nhật UI
    document.getElementById('start-button').disabled = false;
    document.getElementById('stop-button').disabled = true;
    document.getElementById('mining-status').textContent = 'Đã dừng';
    document.getElementById('status-light').className = 'status-light inactive';
    document.getElementById('connection-status').textContent = 'Không kết nối';
    
    // Đặt lại các thanh hiệu suất luồng
    threadElements.forEach(thread => {
        thread.hashrateElement.textContent = '0 H/s';
        thread.usageElement.style.width = '0%';
    });
    
    // Bật lại form đầu vào
    toggleInputs(false);
    
    // Ghi nhật ký
    logMessage('Khai thác đã dừng.', 'info');
}

/**
 * Bật/tắt các form đầu vào
 * @param {boolean} disabled - True để vô hiệu hóa các phần tử đầu vào
 */
function toggleInputs(disabled) {
    const inputs = [
        'pool-url', 'pool-port', 'wallet-address', 'worker-name', 
        'pool-password', 'threads-slider', 'threads', 'throttle-slider',
        'check-pool', 'save-pool', 'auto-config'
    ];
    
    // Thêm algorithm nếu có
    if (document.getElementById('algorithm')) {
        inputs.push('algorithm');
    }
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = disabled;
    });
}

/**
 * Ghi một thông báo vào nhật ký
 * @param {string} message - Thông báo để hiển thị
 * @param {string} type - Loại thông báo (info, success, warning, error)
 */
function logMessage(message, type = 'info') {
    const logContainer = document.getElementById('logs');
    const time = new Date().toTimeString().substring(0, 8);
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${time}] ${message}`;
    
    // Thêm vào đầu logs để dễ đọc
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    // Giới hạn số lượng mục nhật ký để tránh quá nhiều DOM
    if (logContainer.children.length > MINER_CONFIG.maxLogEntries) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

/**
 * Kiểm tra kết nối đến pool khai thác
 */
function checkPoolConnection() {
    const poolUrl = document.getElementById('pool-url').value.trim();
    const poolPort = document.getElementById('pool-port').value.trim();
    
    if (!poolUrl || !poolPort) {
        logMessage('Vui lòng nhập URL và port của pool khai thác', 'warning');
        return;
    }
    
    // Trong trình duyệt, chúng ta không thể thực sự kiểm tra kết nối TCP
    // Do đó, mô phỏng kiểm tra
    logMessage(`Đang kiểm tra kết nối đến ${poolUrl}:${poolPort}...`, 'info');
    
    setTimeout(() => {
        // Mô phỏng kết quả kiểm tra
        const success = Math.random() > 0.2; // 80% cơ hội thành công
        
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

/**
 * Lưu cấu hình pool hiện tại
 */
function savePoolConfig() {
    const poolUrl = document.getElementById('pool-url').value.trim();
    const poolPort = document.getElementById('pool-port').value.trim();
    
    if (!poolUrl || !poolPort) {
        logMessage('Vui lòng nhập URL và port của pool khai thác', 'warning');
        return;
    }
    
    // Kiểm tra xem pool này đã tồn tại chưa
    const existingIndex = savedPools.findIndex(p => 
        p.url === poolUrl && p.port === poolPort
    );
    
    if (existingIndex !== -1) {
        // Cập nhật pool hiện có
        savedPools[existingIndex].lastUsed = new Date().getTime();
    } else {
        // Thêm pool mới
        savedPools.push({
            url: poolUrl,
            port: poolPort,
            lastUsed: new Date().getTime()
        });
    }
    
    // Lưu vào localStorage
    localStorage.setItem('saved-pools', JSON.stringify(savedPools));
    
    // Cập nhật UI
    updateSavedPoolsList();
    
    logMessage(`Đã lưu cấu hình pool: ${poolUrl}:${poolPort}`, 'success');
}

/**
 * Cập nhật danh sách các pool đã lưu
 */
function updateSavedPoolsList() {
    const container = document.getElementById('saved-pools-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (savedPools.length === 0) {
        container.innerHTML = '<div>Chưa có pool nào được lưu</div>';
        return;
    }
    
    // Sắp xếp theo thời gian sử dụng gần đây nhất
    savedPools.sort((a, b) => b.lastUsed - a.lastUsed);
    
    // Hiển thị tối đa 3 pool gần đây nhất
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
    
    // Nếu có nhiều hơn 3 pool, thêm nút để xem tất cả
    if (savedPools.length > 3) {
        const viewAllBtn = document.createElement('div');
        viewAllBtn.className = 'saved-pool-item';
        viewAllBtn.innerHTML = `<i class="fas fa-ellipsis-h"></i> Xem tất cả (${savedPools.length})`;
        
        viewAllBtn.addEventListener('click', showAllPools);
        
        container.appendChild(viewAllBtn);
    }
}

/**
 * Hiển thị tất cả các pool đã lưu trong modal
 */
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

/**
 * Tải cấu hình đã lưu từ localStorage
 */
function loadSavedConfig() {
    try {
        // Tải danh sách pool đã lưu
        const savedPoolsData = localStorage.getItem('saved-pools');
        if (savedPoolsData) {
            savedPools = JSON.parse(savedPoolsData);
            updateSavedPoolsList();
        }
        
        // Tải cấu hình khai thác
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
                const option = Array.from(algorithmSelect.options).find(opt => opt.value === config.algorithm);
                if (option) algorithmSelect.value = config.algorithm;
            }
            
            logMessage('Cấu hình đã lưu đã được tải', 'info');
        }
    } catch (error) {
        console.error('Lỗi khi tải cấu hình đã lưu:', error);
        logMessage('Không thể tải cấu hình đã lưu', 'error');
    }
}

/**
 * Xóa tất cả dữ liệu đã lưu
 */
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

/**
 * Tự động cấu hình các thiết lập dựa trên hệ thống
 */
function autoConfigureSettings() {
    autoConfigActive = true;
    
    const algorithm = document.getElementById('algorithm') ? 
        document.getElementById('algorithm').value : MINER_CONFIG.defaultAlgorithm;
    
    const recommendedThreads = recommendThreads(algorithm);
    document.getElementById('threads').value = recommendedThreads;
    document.getElementById('threads-slider').value = recommendedThreads;
    
    let recommendedThrottle = 70; // Mặc định
    if (systemInfo.isAppleDevice) {
        recommendedThrottle = 60; // Giảm cường độ cho thiết bị Apple
    } else if (systemInfo.cores <= 2) {
        recommendedThrottle = 50; // Giảm cường độ cho CPU ít lõi
    } else if (systemInfo.cores >= 8) {
        recommendedThrottle = 80; // Tăng cường độ cho CPU nhiều lõi
    }
    
    document.getElementById('throttle-slider').value = recommendedThrottle;
    document.getElementById('throttle-value').textContent = `${recommendedThrottle}%`;
    
    updateThreadsContainer(recommendedThreads);
    
    logMessage(`Cấu hình tự động: ${recommendedThreads} luồng với cường độ ${recommendedThrottle}%`, 'info');
    
    // Đặt lại cờ sau 5 giây
    setTimeout(() => {
        autoConfigActive = false;
    }, 5000);
}

// Đây là hàm ở phạm vi toàn cục để miner.js có thể gọi khi cần
window.updateHashrateChart = updateHashrateChart;
