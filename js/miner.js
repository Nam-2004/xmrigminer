/**
 * XMR Web Miner - miner.js
 * Lớp WebMiner để quản lý tác vụ khai thác tiền điện tử trong trình duyệt
 */

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
        
        // Kiểm tra hỗ trợ trình duyệt
        this.wasmSupported = checkWasmSupport();
        if (!this.wasmSupported) {
            this.logError("Trình duyệt của bạn không hỗ trợ WebAssembly, không thể khai thác");
        }
        
        this.webWorkersSupported = checkWebWorkersSupport();
        if (!this.webWorkersSupported) {
            this.logError("Trình duyệt của bạn không hỗ trợ Web Workers, không thể khai thác");
        }
    }

    /**
     * Bắt đầu quá trình khai thác
     * @param {Object} config - Cấu hình khai thác
     * @returns {boolean} Kết quả thành công
     */
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

    /**
     * Dừng quá trình khai thác
     */
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

    /**
     * Lấy thống kê khai thác hiện tại
     * @returns {Object} Đối tượng thống kê khai thác
     */
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

    /**
     * Ghi thông báo vào nhật ký
     * @param {string} message - Thông báo để hiển thị
     * @param {string} type - Loại thông báo (info, success, warning, error)
     */
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

    /**
     * Ghi thông báo thông tin vào nhật ký
     * @param {string} message - Thông báo để hiển thị
     */
    logInfo(message) {
        this.log(message, "info");
    }

    /**
     * Ghi thông báo thành công vào nhật ký
     * @param {string} message - Thông báo để hiển thị
     */
    logSuccess(message) {
        this.log(message, "success");
    }

    /**
     * Ghi thông báo cảnh báo vào nhật ký
     * @param {string} message - Thông báo để hiển thị
     */
    logWarning(message) {
        this.log(message, "warning");
    }

    /**
     * Ghi thông báo lỗi vào nhật ký
     * @param {string} message - Thông báo để hiển thị
     */
    logError(message) {
        this.log(message, "error");
    }

    /**
     * Xóa nhật ký
     */
    clearLog() {
        const logContainer = document.getElementById("logs");
        logContainer.innerHTML = "";
        this.logInfo("Nhật ký đã được xóa");
    }
    
    /**
     * Cập nhật số lượng luồng khai thác trong khi đang chạy
     * @param {number} newThreadCount - Số lượng luồng mới
     * @returns {boolean} Kết quả thành công
     */
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
    
    /**
     * Cập nhật mức throttle trong khi đang chạy
     * @param {number} newThrottle - Mức throttle mới (0-100)
     * @returns {boolean} Kết quả thành công
     */
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

    /**
     * Lấy thời gian uptime được định dạng
     * @returns {string} Thời gian uptime định dạng "HH:MM:SS"
     * @private
     */
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
    
    /**
     * Tính toán hashrate hiện tại dựa trên các mẫu gần đây
     * @returns {number} Hashrate hiện tại (H/s)
     * @private
     */
    _calculateCurrentHashrate() {
        if (this.hashrates.length === 0) return 0;
        
        const recentHashrates = this.hashrates.slice(-10);
        return recentHashrates.reduce((a, b) => a + b, 0) / recentHashrates.length;
    }
    
    /**
     * Lấy dữ liệu hiệu suất cho từng luồng
     * @returns {Array} Mảng các đối tượng dữ liệu luồng
     * @private
     */
    _getThreadData() {
        return this.threads.map((thread, index) => ({
            id: index,
            hashrate: thread.hashrate || 0,
            shares: thread.shares || 0,
            lastShareTime: thread.lastShareTime || null
        }));
    }
    
    /**
     * Khởi tạo các đối tượng luồng
     * @private
     */
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
    
    /**
     * Bắt đầu quá trình khai thác
     * @private
     */
    _startMining() {
        const algoConfig = getAlgorithmInfo(this.selectedAlgorithm);
        const optimizedConfig = getOptimizedConfig(this.selectedAlgorithm, this.threadCount, this.throttle);
        
        this.logInfo("Đang bắt đầu các luồng khai thác...");
        
        // Trong môi trường demo này, chúng ta mô phỏng kết nối thành công sau 2 giây
        setTimeout(() => {
            this.connectionStatus = "Đã kết nối";
            this.logSuccess(`Kết nối thành công đến ${this.poolUrl}`);
            
            this._startHashrateSimulation();
        }, 2000);
        
        // Cập nhật UI
        document.getElementById("mining-status").textContent = "Đang chạy";
        document.getElementById("status-light").className = "status-light active";
        document.getElementById("connection-status").textContent = "Đã kết nối";
    }
    
    /**
     * Dừng quá trình khai thác
     * @private
     */
    _stopMining() {
        clearInterval(this.hashrateInterval);
        
        // Dừng tất cả các worker luồng
        this.threads.forEach(thread => {
            if (thread.worker) {
                thread.worker.terminate();
                thread.worker = null;
            }
        });
        
        // Cập nhật UI
        document.getElementById("mining-status").textContent = "Đã dừng";
        document.getElementById("status-light").className = "status-light inactive";
        document.getElementById("connection-status").textContent = "Không kết nối";
    }
    
    /**
     * Thêm các luồng mới vào miner đang chạy
     * @param {number} count - Số lượng luồng cần thêm
     * @private
     */
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
    
    /**
     * Loại bỏ các luồng từ miner đang chạy
     * @param {number} count - Số lượng luồng cần loại bỏ
     * @private
     */
    _removeThreads(count) {
        for (let i = 0; i < count; i++) {
            if (this.threads.length === 0) break;
            
            const thread = this.threads.pop();
            
            // Dừng worker của luồng nếu có
            if (thread.worker) {
                thread.worker.terminate();
            }
            
            this.logInfo(`Đã loại bỏ luồng #${thread.id + 1}`);
        }
    }
    
    /**
     * Áp dụng mức throttle mới cho các luồng
     * @private
     */
    _applyThrottle() {
        this.logInfo(`Áp dụng cường độ mới: ${this.throttle}%`);
        // Trong phiên bản demo này, thay đổi throttle sẽ được thấy trong _startHashrateSimulation
    }
    
    /**
     * Xử lý một share mới
     * @param {boolean} accepted - True nếu share được chấp nhận, False nếu bị từ chối
     * @private
     */
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
    
    /**
     * Xử lý lỗi từ pool khai thác
     * @param {string} error - Thông báo lỗi
     * @private
     */
    _handlePoolError(error) {
        this.connectionStatus = "Lỗi kết nối";
        this.logError(`Lỗi pool: ${error}`);
        
        // Thử kết nối lại nếu cần
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.isReconnecting = true;
            this.reconnectAttempts++;
            
            // Thời gian chờ tăng theo cấp số nhân (1s, 2s, 4s, 8s, ...)
            const delaySeconds = Math.min(30, Math.pow(2, this.reconnectAttempts));
            this.logWarning(`Thử kết nối lại sau ${delaySeconds} giây (lần ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                if (this.running) {
                    this.logInfo("Đang kết nối lại...");
                    this.connectionStatus = "Đang kết nối lại...";
                    document.getElementById("connection-status").textContent = "Đang kết nối lại...";
                    
                    // Mô phỏng kết nối lại thành công
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
    
    /**
     * Bắt đầu mô phỏng hashrate
     * Lưu ý: Trong triển khai thực tế, cái này sẽ được thay thế bằng dữ liệu thực từ công cụ khai thác
     * @private
     */
    _startHashrateSimulation() {
        const algorithm = getAlgorithmInfo(this.selectedAlgorithm);
        const baseHashratePerThread = 25; // H/s cơ bản cho mỗi luồng
        
        this.hashrateInterval = setInterval(() => {
            let totalHashrate = 0;
            
            // Cập nhật dữ liệu cho mỗi luồng
            for (let i = 0; i < this.threadCount; i++) {
                // Tạo dao động ngẫu nhiên cho hashrate của từng luồng
                const threadFactor = 0.7 + (Math.random() * 0.6);
                const threadIntensity = this.throttle / 100;
                const threadHashrate = baseHashratePerThread * algorithm.hashrateFactor * threadFactor * threadIntensity;
                
                // Lưu vào đối tượng luồng
                this.threads[i].hashrate = threadHashrate;
                totalHashrate += threadHashrate;
                
                // Cập nhật UI cho luồng nếu các phần tử tồn tại
                const threadElement = document.getElementById(`thread-hashrate-${i}`);
                const threadUsage = document.getElementById(`thread-usage-${i}`);
                
                if (threadElement) {
                    threadElement.textContent = `${threadHashrate.toFixed(1)} H/s`;
                }
                
                if (threadUsage) {
                    // Mô phỏng CPU usage (50-100% của throttle được đặt)
                    const usagePercent = Math.min(100, (50 + Math.random() * 50) * threadIntensity);
                    threadUsage.style.width = `${usagePercent}%`;
                }
            }
            
            // Thêm hashrate hiện tại vào lịch sử
            this.hashrates.push(totalHashrate);
            if (this.hashrates.length > 100) {
                this.hashrates.shift();
            }
            
            // Cập nhật tổng hashes
            this.totalHashes += totalHashrate * 3; // 3 giây từ lần cập nhật cuối
            
            // Cập nhật UI
            document.getElementById("hashrate").textContent = `${totalHashrate.toFixed(2)} H/s`;
            document.getElementById("total-hashes").textContent = Math.floor(this.totalHashes).toLocaleString();
            document.getElementById("runtime").textContent = this._getUptime();
            
            // Cập nhật biểu đồ nếu hàm cập nhật biểu đồ tồn tại
            if (window.updateHashrateChart) {
                window.updateHashrateChart(totalHashrate);
            }
            
            // Thỉnh thoảng mô phỏng tìm thấy share (5% cơ hội mỗi 3 giây)
            if (Math.random() < 0.05) {
                // 5% cơ hội share bị từ chối
                this._handleShare(Math.random() > 0.05);
            }
        }, 3000);
    }
}

// Tạo một instance của WebMiner và gán nó cho window để có thể truy cập từ các file khác
const webMiner = new WebMiner();

// Trong môi trường thực, chúng ta sẽ xuất nó một cách khác, nhưng trong trình duyệt:
window.webMiner = webMiner;
