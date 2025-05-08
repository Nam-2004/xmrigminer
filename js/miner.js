class WebMiner {
    constructor() {
        this.miner = null;
        this.running = false;
        this.startTime = null;
        this.hashrates = [];
        this.totalHashes = 0;
        this.acceptedShares = 0;
        this.rejectedShares = 0;
        this.connectionStatus = "Không kết nối";
        this.selectedAlgorithm = "rx/0";
        this.throttle = 70;
        this.threads = [];
        this.poolUrl = "";
        this.walletAddress = "";
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.autoReconnect = true;
        this.lastShareTime = null;
        
        this.wasmSupported = checkWasmSupport();
        if (!this.wasmSupported) {
            this.logError("Trình duyệt của bạn không hỗ trợ WebAssembly, không thể khai thác");
        }
        
        this.webWorkersSupported = checkWebWorkersSupport();
        if (!this.webWorkersSupported) {
            this.logError("Trình duyệt của bạn không hỗ trợ Web Workers, không thể khai thác");
        }
    }

    start(config) {
        if (!this.wasmSupported || !this.webWorkersSupported) {
            this.logError("Không thể khai thác: Trình duyệt không hỗ trợ công nghệ cần thiết");
            return false;
        }
        
        if (this.running) {
            this.logWarning("Miner đã đang chạy");
            return false;
        }
        
        try {
            const { pool, wallet, worker, password, threads, throttle, algorithm } = config;
            
            if (!wallet) {
                this.logError("Vui lòng nhập địa chỉ ví của bạn");
                return false;
            }
            
            if (!pool) {
                this.logError("Vui lòng nhập địa chỉ pool khai thác");
                return false;
            }
            
            this.walletAddress = wallet;
            this.poolUrl = pool;
            this.workerName = worker || 'web-worker';
            this.poolPassword = password || 'x';
            this.threadCount = threads || 1;
            this.throttle = throttle || 70;
            this.selectedAlgorithm = algorithm || "rx/0";
            
            const algoInfo = getAlgorithmInfo(this.selectedAlgorithm);
            
            this.logInfo(`Khởi tạo miner với thuật toán: ${algoInfo.name} (${algoInfo.coin})`);
            this.logInfo(`Kết nối đến pool: ${this.poolUrl}`);
            this.logInfo(`Số luồng CPU: ${this.threadCount}, Mức sử dụng: ${this.throttle}%`);
            
            this._initThreads();
            
            this.running = true;
            this.startTime = new Date();
            this.connectionStatus = "Đang kết nối...";
            
            this._startMining();
            
            return true;
        } catch (error) {
            this.logError(`Không thể khởi động miner: ${error.message}`);
            return false;
        }
    }

    stop() {
        if (!this.running) {
            return;
        }
        
        this.logInfo("Đang dừng khai thác...");
        
        this._stopMining();
        
        this.running = false;
        this.connectionStatus = "Không kết nối";
        this.startTime = null;
        
        this.logSuccess("Đã dừng khai thác");
    }

    getStats() {
        const currentHashrate = this._calculateCurrentHashrate();
            
        return {
            running: this.running,
            hashrate: currentHashrate,
            totalHashes: this.totalHashes,
            acceptedShares: this.acceptedShares,
            rejectedShares: this.rejectedShares,
            connectionStatus: this.connectionStatus,
            uptime: this._getUptime(),
            algorithm: this.selectedAlgorithm,
            threadsCount: this.threadCount,
            threadData: this._getThreadData()
        };
    }

    log(message, type = "info") {
        const logContainer = document.getElementById("logs");
        const time = new Date().toTimeString().split(' ')[0];
        
        const logEntry = document.createElement("div");
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${time}] ${message}`;
        
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        if (logContainer.children.length > MINER_CONFIG.maxLogEntries) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    logInfo(message) {
        this.log(message, "info");
    }

    logSuccess(message) {
        this.log(message, "success");
    }

    logWarning(message) {
        this.log(message, "warning");
    }

    logError(message) {
        this.log(message, "error");
    }

    clearLog() {
        const logContainer = document.getElementById("logs");
        logContainer.innerHTML = "";
        this.logInfo("Nhật ký đã được xóa");
    }
    
    updateThreads(newThreadCount) {
        if (!this.running) {
            this.threadCount = newThreadCount;
            return true;
        }
        
        if (newThreadCount === this.threadCount) return true;
        
        if (newThreadCount > this.threadCount) {
            this.logInfo(`Tăng số luồng từ ${this.threadCount} lên ${newThreadCount}`);
            const additionalThreads = newThreadCount - this.threadCount;
            this._addThreads(additionalThreads);
            this.threadCount = newThreadCount;
        } else {
            this.logInfo(`Giảm số luồng từ ${this.threadCount} xuống ${newThreadCount}`);
            const threadsToRemove = this.threadCount - newThreadCount;
            this._removeThreads(threadsToRemove);
            this.threadCount = newThreadCount;
        }
        
        return true;
    }
    
    updateThrottle(newThrottle) {
        if (newThrottle < 0 || newThrottle > 100) {
            this.logWarning("Mức sử dụng CPU phải từ 0-100%");
            return false;
        }
        
        this.throttle = newThrottle;
        this.logInfo(`Đã cập nhật mức sử dụng CPU thành ${newThrottle}%`);
        
        if (this.running) {
            this._applyThrottle();
        }
        
        return true;
    }

    _getUptime() {
        if (!this.startTime || !this.running) {
            return "00:00:00";
        }
        
        const now = new Date();
        const diff = Math.floor((now - this.startTime) / 1000);
        
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0')
        ].join(':');
    }
    
    _calculateCurrentHashrate() {
        if (this.hashrates.length === 0) return 0;
        
        const recentHashrates = this.hashrates.slice(-10);
        return recentHashrates.reduce((a, b) => a + b, 0) / recentHashrates.length;
    }
    
    _getThreadData() {
        return this.threads.map((thread, index) => ({
            id: index,
            hashrate: thread.hashrate || 0,
            shares: thread.shares || 0,
            lastShareTime: thread.lastShareTime || null
        }));
    }
    
    _initThreads() {
        this.threads = [];
        
        for (let i = 0; i < this.threadCount; i++) {
            this.threads.push({
                id: i,
                hashrate: 0,
                shares: 0,
                lastShareTime: null,
                worker: null
            });
        }
    }
    
    _startMining() {
        const algoConfig = getAlgorithmInfo(this.selectedAlgorithm);
        const optimizedConfig = getOptimizedConfig(this.selectedAlgorithm, this.threadCount, this.throttle);
        
        this.logInfo("Đang bắt đầu các luồng khai thác...");
        
        setTimeout(() => {
            this.connectionStatus = "Đã kết nối";
            this.logSuccess(`Kết nối thành công đến ${this.poolUrl}`);
            
            this._startHashrateSimulation();
        }, 2000);
        
        document.getElementById("mining-status").textContent = "Đang chạy";
        document.getElementById("status-light").className = "status-light active";
        document.getElementById("connection-status").textContent = "Đã kết nối";
    }
    
    _stopMining() {
        clearInterval(this.hashrateInterval);
        
        this.threads.forEach(thread => {
            if (thread.worker) {
                thread.worker.terminate();
                thread.worker = null;
            }
        });
        
        document.getElementById("mining-status").textContent = "Đã dừng";
        document.getElementById("status-light").className = "status-light inactive";
        document.getElementById("connection-status").textContent = "Không kết nối";
    }
    
    _addThreads(count) {
        const startIndex = this.threads.length;
        
        for (let i = 0; i < count; i++) {
            const threadId = startIndex + i;
            
            this.threads.push({
                id: threadId,
                hashrate: 0,
                shares: 0,
                lastShareTime: null,
                worker: null
            });
            
            this.logInfo(`Đã thêm luồng #${threadId + 1}`);
        }
    }
    
    _removeThreads(count) {
        for (let i = 0; i < count; i++) {
            if (this.threads.length === 0) break;
            
            const thread = this.threads.pop();
            
            if (thread.worker) {
                thread.worker.terminate();
            }
            
            this.logInfo(`Đã loại bỏ luồng #${thread.id + 1}`);
        }
    }
    
    _applyThrottle() {
        this.logInfo(`Áp dụng cường độ mới: ${this.throttle}%`);
    }
    
    _handleShare(accepted) {
        if (accepted) {
            this.acceptedShares++;
            this.logSuccess(`Share #${this.acceptedShares + this.rejectedShares} được chấp nhận (+1)`);
        } else {
            this.rejectedShares++;
            this.logWarning(`Share #${this.acceptedShares + this.rejectedShares} bị từ chối (0)`);
        }
        
        this.lastShareTime = new Date();
        document.getElementById("accepted-shares").textContent = this.acceptedShares;
        document.getElementById("rejected-shares").textContent = this.rejectedShares;
    }
    
    _handlePoolError(error) {
        this.connectionStatus = "Lỗi kết nối";
        this.logError(`Lỗi pool: ${error}`);
        
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.isReconnecting = true;
            this.reconnectAttempts++;
            
            const delaySeconds = Math.min(30, Math.pow(2, this.reconnectAttempts));
            this.logWarning(`Thử kết nối lại sau ${delaySeconds} giây (lần ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                if (this.running) {
                    this.logInfo("Đang kết nối lại...");
                    this.connectionStatus = "Đang kết nối lại...";
                    document.getElementById("connection-status").textContent = "Đang kết nối lại...";
                    
                    setTimeout(() => {
                        this.connectionStatus = "Đã kết nối";
                        this.isReconnecting = false;
                        document.getElementById("connection-status").textContent = "Đã kết nối";
                        this.logSuccess("Kết nối lại thành công");
                    }, 2000);
                }
            }, delaySeconds * 1000);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logError(`Đã đạt giới hạn kết nối lại (${this.maxReconnectAttempts} lần). Dừng khai thác.`);
            this.stop();
        }
    }
    
    _startHashrateSimulation() {
        const algorithm = getAlgorithmInfo(this.selectedAlgorithm);
        const baseHashratePerThread = 25;
        
        this.hashrateInterval = setInterval(() => {
            let totalHashrate = 0;
            
            for (let i = 0; i < this.threadCount; i++) {
                const threadFactor = 0.7 + (Math.random() * 0.6);
                const threadIntensity = this.throttle / 100;
                const threadHashrate = baseHashratePerThread * algorithm.hashrateFactor * threadFactor * threadIntensity;
                
                this.threads[i].hashrate = threadHashrate;
                totalHashrate += threadHashrate;
                
                const threadElement = document.getElementById(`thread-hashrate-${i}`);
                const threadUsage = document.getElementById(`thread-usage-${i}`);
                
                if (threadElement) {
                    threadElement.textContent = `${threadHashrate.toFixed(1)} H/s`;
                }
                
                if (threadUsage) {
                    const usagePercent = Math.min(100, (50 + Math.random() * 50) * threadIntensity);
                    threadUsage.style.width = `${usagePercent}%`;
                }
            }
            
            this.hashrates.push(totalHashrate);
            if (this.hashrates.length > 100) {
                this.hashrates.shift();
            }
            
            this.totalHashes += totalHashrate * 3;
            
            document.getElementById("hashrate").textContent = `${totalHashrate.toFixed(2)} H/s`;
            document.getElementById("total-hashes").textContent = Math.floor(this.totalHashes).toLocaleString();
            document.getElementById("runtime").textContent = this._getUptime();
            
            if (window.updateHashrateChart) {
                window.updateHashrateChart(totalHashrate);
            }
            
            if (Math.random() < 0.05) {
                this._handleShare(Math.random() > 0.05);
            }
        }, 3000);
    }
}

const webMiner = new WebMiner();

// Các hàm hỗ trợ
function checkWasmSupport() {
    try {
        if (typeof WebAssembly === 'object' && 
            typeof WebAssembly.instantiate === 'function') {
            const module = new WebAssembly.Module(new Uint8Array([
                0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
            ]));
            if (module instanceof WebAssembly.Module) {
                return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
            }
        }
    } catch (e) {}
    return false;
}

function checkWebWorkersSupport() {
    return typeof Worker !== 'undefined';
}

function checkSharedMemorySupport() {
    try {
        return typeof SharedArrayBuffer !== 'undefined';
    } catch (e) {
        return false;
    }
}

function getTotalSystemMemory() {
    if (navigator.deviceMemory) {
        return `${navigator.deviceMemory} GB`;
    }
    return 'Không xác định';
}

function getAlgorithmInfo(algorithmId) {
    const algorithms = {
        'rx/0': {
            name: 'RandomX',
            coin: 'Monero (XMR)',
            hashrateFactor: 1.0,
            difficulty: 'High',
            memoryRequirement: 'High (2GB+)',
            description: 'RandomX là thuật toán hashing chống ASIC được thiết kế cho Monero'
        },
        'cn/r': {
            name: 'CryptoNight-R',
            coin: 'Monero (XMR - legacy)',
            hashrateFactor: 0.5,
            difficulty: 'Medium',
            memoryRequirement: 'Medium (1GB+)',
            description: 'Thuật toán khai thác legacy của Monero'
        },
        'cn-lite/1': {
            name: 'CryptoNight Lite v1',
            coin: 'Aeon (AEON)',
            hashrateFactor: 1.8,
            difficulty: 'Medium',
            memoryRequirement: 'Low (512MB+)',
            description: 'Phiên bản nhẹ hơn của CryptoNight'
        },
        'cn-pico': {
            name: 'CryptoNight Pico',
            coin: 'Turtlecoin (TRTL)',
            hashrateFactor: 2.5,
            difficulty: 'Low',
            memoryRequirement: 'Very Low (256MB+)',
            description: 'Thuật toán siêu nhẹ dành cho thiết bị có ít RAM'
        },
        'rx/wow': {
            name: 'RandomWOW',
            coin: 'Wownero (WOW)',
            hashrateFactor: 1.1,
            difficulty: 'Medium-High',
            memoryRequirement: 'Medium (1GB+)',
            description: 'Biến thể của RandomX cho Wownero'
        },
        'argon2/chukwa': {
            name: 'Chukwa',
            coin: 'Turtlecoin (TRTL)',
            hashrateFactor: 1.5,
            difficulty: 'Medium',
            memoryRequirement: 'Medium (1GB+)',
            description: 'Thuật toán mới của Turtlecoin dựa trên Argon2'
        }
    };
    
    return algorithms[algorithmId] || {
        name: 'Unknown',
        coin: 'Unknown',
        hashrateFactor: 1.0,
        difficulty: 'Unknown',
        memoryRequirement: 'Unknown',
        description: 'Không có thông tin'
    };
}

function recommendThreads(algorithmId) {
    const algorithm = getAlgorithmInfo(algorithmId);
    const cores = navigator.hardwareConcurrency || 4;
    
    // Tùy chỉnh số thread theo thuật toán
    let recommendedThreads = Math.max(1, Math.floor(cores / 2));
    
    // Các thuật toán nặng giảm số thread
    if (algorithmId === 'rx/0') {
        recommendedThreads = Math.max(1, Math.floor(cores / 3));
    }
    
    // Các thuật toán nhẹ tăng số thread
    if (algorithmId === 'cn-pico' || algorithmId === 'cn-lite/1') {
        recommendedThreads = Math.max(1, Math.ceil(cores * 0.75));
    }
    
    // Thiết bị ít lõi, chỉ sử dụng 1 thread
    if (cores <= 2) {
        recommendedThreads = 1;
    }
    
    return recommendedThreads;
}

function getOptimizedConfig(algorithmId, threadCount, throttle) {
    const algorithm = getAlgorithmInfo(algorithmId);
    
    // Các thông số tối ưu cho mỗi thuật toán
    const configs = {
        'rx/0': {
            hardwareAES: true,
            initThreads: 1,
            memory: 2097152, // 2GB
            astrobwtMaxSize: 550,
            astrobwtAvgSize: 500
        },
        'cn/r': {
            hardwareAES: true,
            memory: 1048576, // 1GB
        },
        'cn-lite/1': {
            hardwareAES: true,
            memory: 524288, // 512MB
        },
        'cn-pico': {
            hardwareAES: true,
            memory: 262144, // 256MB
        }
    };
    
    return configs[algorithmId] || {};
}

function getMiningPoolInfo(poolUrl) {
    const pools = {
        'pool.supportxmr.com': {
            name: 'SupportXMR',
            fee: 0.6,
            minPayout: 0.01,
            regions: ['EU', 'US'],
            type: 'PPLNS'
        },
        'xmr.2miners.com': {
            name: '2Miners',
            fee: 1.0,
            minPayout: 0.1,
            regions: ['EU', 'US', 'ASIA'],
            type: 'PPLNS'
        },
        'xmrpool.eu': {
            name: 'XMRPool.eu',
            fee: 1.0,
            minPayout: 0.1,
            regions: ['EU'],
            type: 'PPLNS'
        },
        'hashvault.pro': {
            name: 'HashVault',
            fee: 1.0,
            minPayout: 0.1,
            regions: ['EU', 'US', 'ASIA', 'AUS'],
            type: 'PPLNS'
        },
        'xmr.nanopool.org': {
            name: 'Nanopool',
            fee: 1.0,
            minPayout: 0.1,
            regions: ['EU', 'US', 'ASIA', 'AUS'],
            type: 'PPLNS'
        },
        'minexmr.com': {
            name: 'MineXMR',
            fee: 1.0,
            minPayout: 0.004,
            regions: ['EU', 'US', 'ASIA', 'AUS'],
            type: 'PPLNS'
        }
    };
    
    // Kiểm tra xem pool có trong danh sách không
    for (const key in pools) {
        if (poolUrl.includes(key)) {
            return pools[key];
        }
    }
    
    return null;
}

// Đăng ký sự kiện
document.addEventListener('DOMContentLoaded', () => {
    // Các nút điều khiển
    document.getElementById('start-button').addEventListener('click', () => {
        const config = {
            pool: `${document.getElementById('pool-url').value}:${document.getElementById('pool-port').value}`,
            wallet: document.getElementById('wallet-address').value,
            worker: document.getElementById('worker-name').value || 'web-worker',
            password: document.getElementById('pool-password').value || 'x',
            threads: parseInt(document.getElementById('threads').value),
            throttle: parseInt(document.getElementById('throttle-slider').value),
            algorithm: document.getElementById('algorithm') ? 
                document.getElementById('algorithm').value : 'rx/0'
        };
        
        webMiner.start(config);
    });
    
    document.getElementById('stop-button').addEventListener('click', () => {
        webMiner.stop();
    });
    
    // Cập nhật số luồng khi thay đổi
    document.getElementById('threads-slider').addEventListener('change', () => {
        const newThreadCount = parseInt(document.getElementById('threads-slider').value);
        webMiner.updateThreads(newThreadCount);
    });
    
    // Cập nhật cường độ khi thay đổi
    document.getElementById('throttle-slider').addEventListener('change', () => {
        const newThrottle = parseInt(document.getElementById('throttle-slider').value);
        webMiner.updateThrottle(newThrottle);
    });
    
    // Xóa nhật ký
    const clearLogBtn = document.getElementById('clear-log');
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            webMiner.clearLog();
        });
    }
});

// Cập nhật trạng thái theo chu kỳ
setInterval(() => {
    if (webMiner.running) {
        const stats = webMiner.getStats();
        
        if (window.updateDashboard) {
            window.updateDashboard(stats);
        }
    }
}, 1000);
