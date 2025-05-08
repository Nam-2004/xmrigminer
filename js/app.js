/**
 * XMRig Web Controller - app.js
 * Quản lý giao diện người dùng và tương tác với XMRig
 */

// Biến toàn cục
let savedCommands = [];
let hashrateInterval = null;
let activeThreads = 0;
let startTime = null;
let totalHashes = 0;
let acceptedShares = 0;
let rejectedShares = 0;
let systemInfo = {};
let commandConfig = null;
let isRunning = false;

// Khởi tạo ứng dụng khi tải trang xong
document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo giao diện
    detectSystemInfo();
    loadSavedCommands();
    setupEventListeners();
    
    // Ghi nhật ký khởi động
    logMessage('Hệ thống đã khởi động. Sẵn sàng khai thác.', 'info');
});

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
        cpuModel: cpuInfo,
        isAppleDevice,
        browser: browserInfo,
        platform: navigator.platform,
        wasmSupport: checkWasmSupport()
    };
    
    // Cập nhật UI
    document.getElementById('cpu-model').textContent = systemInfo.cpuModel;
    document.getElementById('max-threads').textContent = systemInfo.cores;
    document.getElementById('wasm-support').textContent = systemInfo.wasmSupport ? 'Hỗ trợ' : 'Không hỗ trợ';
    document.getElementById('wasm-support').className = systemInfo.wasmSupport ? 'info-value text-success' : 'info-value text-danger';
    
    // Cập nhật giá trị tối đa cho số luồng
    const threadsSlider = document.getElementById('threads-slider');
    threadsSlider.max = systemInfo.cores;
    document.getElementById('threads').max = systemInfo.cores;
    
    // Thiết lập giá trị mặc định
    const recommendedThreads = Math.max(1, Math.floor(systemInfo.cores * 0.75));
    threadsSlider.value = recommendedThreads;
    document.getElementById('threads').value = recommendedThreads;
    
    // Ghi nhật ký thông tin hệ thống
    logMessage(`Phát hiện CPU: ${systemInfo.cpuModel} với ${systemInfo.cores} luồng`, 'info');
    logMessage(`Trình duyệt: ${systemInfo.browser} trên ${systemInfo.platform}`, 'info');
    logMessage(`WebAssembly: ${systemInfo.wasmSupport ? 'Được hỗ trợ' : 'Không được hỗ trợ'}`, systemInfo.wasmSupport ? 'info' : 'warning');
}

/**
 * Thiết lập tất cả các sự kiện lắng nghe
 */
function setupEventListeners() {
    // Phân tích lệnh XMRig
    document.getElementById('parse-command').addEventListener('click', parseXmrigCommand);
    
    // Lưu lệnh XMRig
    document.getElementById('save-command').addEventListener('click', saveCommand);
    
    // Nút bắt đầu và dừng khai thác
    document.getElementById('start-button').addEventListener('click', startMining);
    document.getElementById('stop-button').addEventListener('click', stopMining);
    
    // Xóa nhật ký
    document.getElementById('clear-log').addEventListener('click', clearLog);
    
    // Đồng bộ giữa slider và input số luồng
    const threadsSlider = document.getElementById('threads-slider');
    const threadsInput = document.getElementById('threads');
    
    threadsSlider.addEventListener('input', () => {
        threadsInput.value = threadsSlider.value;
    });
    
    threadsInput.addEventListener('input', () => {
        let value = parseInt(threadsInput.value);
        const maxThreads = parseInt(threadsSlider.max);
        
        if (isNaN(value) || value < 1) value = 1;
        if (value > maxThreads) value = maxThreads;
        
        threadsInput.value = value;
        threadsSlider.value = value;
    });
    
    // Thiết lập throttle slider
    const throttleSlider = document.getElementById('throttle-slider');
    throttleSlider.addEventListener('input', () => {
        document.getElementById('throttle-value').textContent = `${throttleSlider.value}%`;
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
            aboutModal.style.display = 'none';
        });
    });
    
    // Đóng modal khi nhấp bên ngoài
    window.addEventListener('click', (e) => {
        if (e.target === aboutModal) {
            aboutModal.style.display = 'none';
        }
    });
}

/**
 * Phân tích lệnh XMRig và điền thông tin đã phân tích
 */
function parseXmrigCommand() {
    const commandInput = document.getElementById('xmrig-command').value.trim();
    
    if (!commandInput) {
        logMessage('Vui lòng nhập lệnh XMRig', 'warning');
        return;
    }
    
    try {
        // Tách lệnh thành các phần
        const parts = commandInput.split(' ');
        let config = {
            pool: '',
            port: '',
            wallet: '',
            worker: '',
            password: 'x',
            algorithm: 'rx/0'
        };
        
        // Phân tích các tham số
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            if (part === '--url' && i + 1 < parts.length) {
                const url = parts[i + 1];
                const urlParts = url.split(':');
                
                if (urlParts.length >= 2) {
                    config.pool = urlParts[0];
                    config.port = urlParts[1];
                }
            } 
            else if (part === '--user' && i + 1 < parts.length) {
                const user = parts[i + 1];
                
                // Kiểm tra xem có worker id trong user không
                if (user.includes('.')) {
                    const userParts = user.split('.');
                    config.wallet = userParts[0];
                    config.worker = userParts[1];
                } else {
                    config.wallet = user;
                }
            }
            else if (part === '--pass' && i + 1 < parts.length) {
                config.password = parts[i + 1];
            }
            else if (part === '--algo' && i + 1 < parts.length) {
                config.algorithm = parts[i + 1];
            }
            else if (part === '-a' && i + 1 < parts.length) {
                config.algorithm = parts[i + 1];
            }
        }
        
        // Kiểm tra các thông tin bắt buộc
        if (!config.pool || !config.wallet) {
            throw new Error('Không thể phân tích được địa chỉ pool hoặc ví từ lệnh.');
        }
        
        // Lưu cấu hình đã phân tích
        commandConfig = config;
        
        // Hiển thị thông tin đã phân tích
        document.getElementById('parsed-pool').textContent = config.pool;
        document.getElementById('parsed-port').textContent = config.port;
        document.getElementById('parsed-wallet').textContent = truncateWalletAddress(config.wallet);
        document.getElementById('parsed-worker').textContent = config.worker || 'Mặc định';
        document.getElementById('parsed-algorithm').textContent = config.algorithm;
        
        // Hiển thị khu vực thông tin đã phân tích
        document.getElementById('parsed-info').classList.remove('hidden');
        
        logMessage('Đã phân tích lệnh XMRig thành công', 'success');
    } catch (error) {
        logMessage(`Lỗi khi phân tích lệnh: ${error.message}`, 'error');
    }
}

/**
 * Rút gọn địa chỉ ví để hiển thị
 */
function truncateWalletAddress(address) {
    if (!address || address.length < 10) return address;
    return address.substring(0, 6) + '...' + address.substring(address.length - 6);
}

/**
 * Lưu lệnh XMRig vào danh sách đã lưu
 */
function saveCommand() {
    const commandInput = document.getElementById('xmrig-command').value.trim();
    
    if (!commandInput) {
        logMessage('Vui lòng nhập lệnh để lưu', 'warning');
        return;
    }
    
    // Tạo tên cho lệnh
    let name = 'Lệnh XMRig';
    if (commandConfig) {
        name = `${commandConfig.pool} - ${truncateWalletAddress(commandConfig.wallet)}`;
    }
    
    // Lưu lệnh
    const command = {
        id: Date.now(),
        name: name,
        command: commandInput,
        timestamp: new Date().toISOString()
    };
    
    // Thêm vào danh sách
    savedCommands.push(command);
    
    // Lưu vào localStorage
    localStorage.setItem('saved-commands', JSON.stringify(savedCommands));
    
    // Cập nhật UI
    updateSavedCommandsList();
    
    logMessage(`Đã lưu lệnh: ${name}`, 'success');
}

/**
 * Cập nhật danh sách lệnh đã lưu trong UI
 */
function updateSavedCommandsList() {
    const container = document.getElementById('saved-commands-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (savedCommands.length === 0) {
        container.innerHTML = '<div>Chưa có lệnh nào được lưu</div>';
        return;
    }
    
    // Sắp xếp theo thời gian mới nhất
    savedCommands.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Hiển thị tối đa 5 lệnh gần đây
    savedCommands.slice(0, 5).forEach(cmd => {
        const commandElement = document.createElement('div');
        commandElement.className = 'saved-command-item';
        commandElement.innerHTML = `
            <i class="fas fa-terminal"></i> ${cmd.name}
        `;
        
        commandElement.addEventListener('click', () => {
            document.getElementById('xmrig-command').value = cmd.command;
            parseXmrigCommand();
        });
        
        // Thêm nút xóa
        const deleteBtn = document.createElement('i');
        deleteBtn.className = 'fas fa-times';
        deleteBtn.style.marginLeft = '8px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.color = '#dc3545';
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            savedCommands = savedCommands.filter(c => c.id !== cmd.id);
            localStorage.setItem('saved-commands', JSON.stringify(savedCommands));
            updateSavedCommandsList();
            logMessage(`Đã xóa lệnh: ${cmd.name}`, 'info');
        });
        
        commandElement.appendChild(deleteBtn);
        container.appendChild(commandElement);
    });
}

/**
 * Tải các lệnh đã lưu từ localStorage
 */
function loadSavedCommands() {
    try {
        const savedCommandsData = localStorage.getItem('saved-commands');
        if (savedCommandsData) {
            savedCommands = JSON.parse(savedCommandsData);
            updateSavedCommandsList();
        }
    } catch (error) {
        console.error('Lỗi khi tải lệnh đã lưu:', error);
        logMessage('Không thể tải lệnh đã lưu', 'error');
    }
}

/**
 * Bắt đầu quá trình khai thác
 */
function startMining() {
    if (!commandConfig) {
        logMessage('Vui lòng nhập và phân tích lệnh XMRig trước khi bắt đầu', 'error');
        return;
    }
    
    if (!systemInfo.wasmSupport) {
        logMessage('Trình duyệt của bạn không hỗ trợ WebAssembly, không thể khai thác', 'error');
        return;
    }
    
    // Lấy số luồng và throttle từ UI
    const threadsCount = parseInt(document.getElementById('threads').value);
    const throttle = parseInt(document.getElementById('throttle-slider').value);
    
    // Cập nhật cấu hình
    const config = {
        ...commandConfig,
        threads: threadsCount,
        throttle: throttle
    };
    
    logMessage(`Bắt đầu khai thác: ${config.pool}:${config.port} với ${config.threads} luồng`, 'info');
    
    // Cập nhật UI
    document.getElementById('start-button').disabled = true;
    document.getElementById('stop-button').disabled = false;
    document.getElementById('status-text').textContent = 'Đang kết nối...';
    document.getElementById('status-light').className = 'status-light connecting';
    document.getElementById('connection-status').textContent = 'Đang kết nối...';
    
    // Vô hiệu hóa các form đầu vào
    toggleInputs(true);
    
    // Đặt biến trạng thái
    isRunning = true;
    activeThreads = config.threads;
    startTime = new Date();
    totalHashes = 0;
    acceptedShares = 0;
    rejectedShares = 0;
    
    // Mô phỏng kết nối
    setTimeout(() => {
        if (isRunning) {
            document.getElementById('status-text').textContent = 'Đang chạy';
            document.getElementById('status-light').className = 'status-light active';
            document.getElementById('connection-status').textContent = 'Đã kết nối';
            
            logMessage(`Kết nối thành công đến ${config.pool}:${config.port}`, 'success');
            
            // Bắt đầu mô phỏng hashrate
            startHashrateSimulation(config);
        }
    }, 2000);
}

/**
 * Mô phỏng hashrate cho mục đích demo
 */
function startHashrateSimulation(config) {
    const baseHashratePerThread = 25; // H/s cơ bản cho mỗi luồng
    
    // Cập nhật hashrate mỗi 2 giây
    hashrateInterval = setInterval(() => {
        if (isRunning) {
            // Tính tổng hashrate từ tất cả các luồng
            let totalHashrate = 0;
            
            // Cập nhật mỗi luồng
            for (let i = 0; i < config.threads; i++) {
                // Tạo dao động ngẫu nhiên cho hashrate của từng luồng
                const threadFactor = 0.7 + (Math.random() * 0.6);
                const threadIntensity = config.throttle / 100;
                const threadHashrate = baseHashratePerThread * threadFactor * threadIntensity;
                
                totalHashrate += threadHashrate;
            }
            
            // Cập nhật tổng hashrate trên UI
            document.getElementById('hashrate').textContent = `${totalHashrate.toFixed(2)} H/s`;
            
            // Cập nhật tổng hash đã được tính toán
            totalHashes += totalHashrate * 2; // 2 giây giữa các cập nhật
            document.getElementById('total-hashes').textContent = Math.floor(totalHashes).toLocaleString();
            
            // Cập nhật thời gian chạy
            updateRuntime();
            
            // Thỉnh thoảng ghi nhật ký một share để mô phỏng tiến trình
            if (Math.random() < 0.05) { // 5% cơ hội mỗi lần cập nhật
                const accepted = Math.random() > 0.1; // 90% cơ hội chấp nhận
                if (accepted) {
                    acceptedShares++;
                    logMessage(`Share #${acceptedShares + rejectedShares} được chấp nhận: ${totalHashrate.toFixed(1)} H/s`, 'success');
                } else {
                    rejectedShares++;
                    logMessage(`Share #${acceptedShares + rejectedShares} bị từ chối`, 'warning');
                }
                
                // Cập nhật UI
                document.getElementById('accepted-shares').textContent = acceptedShares;
                document.getElementById('rejected-shares').textContent = rejectedShares;
            }
        }
    }, 2000);
}

/**
 * Cập nhật thời gian chạy
 */
function updateRuntime() {
    if (!startTime || !isRunning) return;
    
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const seconds = (diff % 60).toString().padStart(2, '0');
    document.getElementById('runtime').textContent = `${hours}:${minutes}:${seconds}`;
}

/**
 * Dừng quá trình khai thác
 */
function stopMining() {
    // Xóa khoảng thời gian cập nhật hashrate
    clearInterval(hashrateInterval);
    
    // Cập nhật trạng thái
    isRunning = false;
    
    // Cập nhật UI
    document.getElementById('start-button').disabled = false;
    document.getElementById('stop-button').disabled = true;
    document.getElementById('status-text').textContent = 'Đã dừng';
    document.getElementById('status-light').className = 'status-light inactive';
    document.getElementById('connection-status').textContent = 'Không kết nối';
    
    // Bật lại form đầu vào
    toggleInputs(false);
    
    // Ghi nhật ký
    logMessage('Khai thác đã dừng.', 'info');
}

/**
 * Bật/tắt các form đầu vào
 */
function toggleInputs(disabled) {
    const inputs = [
        'xmrig-command', 'parse-command', 'save-command',
        'threads-slider', 'threads', 'throttle-slider'
    ];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = disabled;
    });
}

/**
 * Ghi một thông báo vào nhật ký
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
    const maxLogEntries = 500;
    if (logContainer.children.length > maxLogEntries) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

/**
 * Xóa nhật ký
 */
function clearLog() {
    const logContainer = document.getElementById('logs');
    logContainer.innerHTML = '';
    logMessage('Nhật ký đã được xóa', 'info');
}

/**
 * Kiểm tra hỗ trợ WebAssembly
 */
function checkWasmSupport() {
    try {
        if (typeof WebAssembly === 'object' && 
            typeof WebAssembly.instantiate === 'function') {
            const module = new WebAssembly.Module(new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
            ]));
            if (module instanceof WebAssembly.Module) {
                return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
            }
        }
    } catch (e) {}
    return false;
}

// Thiết lập timer để cập nhật thời gian chạy nếu đang khai thác
setInterval(() => {
    if (isRunning) {
        updateRuntime();
    }
}, 1000);
                
