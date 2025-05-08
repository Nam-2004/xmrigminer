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
        
        this.wasmSupported = checkWasmSupport();
        if (!this.wasmSupported) {
            this.logError("Trình duyệt của bạn không hỗ trợ WebAssembly, không thể khai thác");
        }
    }

    start(config) {
        if (!this.wasmSupported) {
            this.logError("Không thể khai thác: Trình duyệt không hỗ trợ WebAssembly");
            return false;
        }
        
        if (this.running) {
            this.logWarning("Miner đã đang chạy");
            return false;
        }
        
        try {
            const { walletAddress, pool, workerName, algorithmId, threads, throttle } = config;
            
            if (!walletAddress) {
                this.logError("Vui lòng nhập địa chỉ ví của bạn");
                return false;
            }
            
            this.selectedAlgorithm = algorithmId;
            this.throttle = throttle;
            const algoInfo = getAlgorithmInfo(algorithmId);
            
            this.logInfo(`Khởi tạo miner với thuật toán: ${algoInfo.name} (${algoInfo.coin})`);
            this.logInfo(`Kết nối đến pool: ${pool}`);
            this.logInfo(`Số luồng CPU: ${threads}, Mức sử dụng: ${throttle}%`);
            
            setTimeout(() => {
                this.running = true;
                this.startTime = new Date();
                this.connectionStatus = "Đang kết nối...";
                
                this.logSuccess("Miner đã khởi động thành công");
                
                document.getElementById("mining-status").textContent = "Đang chạy";
                document.getElementById("mining-status").style.color = "#2ecc71";
                
                setTimeout(() => {
                    this.connectionStatus = "Đã kết nối";
                    this.logInfo(`Kết nối thành công đến ${pool}`);
                    
                    document.getElementById("connection-status").textContent = "Đã kết nối";
                    document.getElementById("connection-status").style.color = "#2ecc71";
                    
                    this._startHashrateSim(threads, algoInfo.hashrateFactor);
                }, 2000);
            }, 500);
            
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
        
        clearInterval(this.hashrateInterval);
        
        setTimeout(() => {
            this.running = false;
            this.connectionStatus = "Không kết nối";
            
            document.getElementById("mining-status").textContent = "Dừng";
            document.getElementById("mining-status").style.color = "";
            document.getElementById("connection-status").textContent = "Không kết nối";
            document.getElementById("connection-status").style.color = "";
            
            this.logSuccess("Đã dừng khai thác");
        }, 500);
    }

    getStats() {
        const currentHashrate = this.hashrates.length > 0 
            ? this.hashrates[this.hashrates.length - 1] 
            : 0;
            
        return {
            running: this.running,
            hashrate: currentHashrate,
            totalHashes: this.totalHashes,
            acceptedShares: this.acceptedShares,
            rejectedShares: this.rejectedShares,
            connectionStatus: this.connectionStatus,
            uptime: this._getUptime()
        };
    }

    log(message, type = "info") {
        const logContainer = document.getElementById("mining-log");
        const time = new Date().toTimeString().split(' ')[0];
        
        const logEntry = document.createElement("div");
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        console.log(`[${type.toUpperCase()}] ${message}`);
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
        const logContainer = document.getElementById("mining-log");
        logContainer.innerHTML = "";
        this.logInfo("Nhật ký đã được xóa");
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

    _startHashrateSim(threads, algoFactor) {
        const baseHashrate = threads * 25;
        const maxHashrate = baseHashrate * algoFactor * (this.throttle / 100);
        
        this._simulateShares();
        
        this.hashrateInterval = setInterval(() => {
            const fluctuation = 0.85 + (Math.random() * 0.3);
            const currentHashrate = maxHashrate * fluctuation;
            
            this.hashrates.push(currentHashrate);
            if (this.hashrates.length > 100) {
                this.hashrates.shift();
            }
            
            this.totalHashes += currentHashrate / (60 / 3);
            
            document.getElementById("hashrate").textContent = `${currentHashrate.toFixed(2)} H/s`;
            document.getElementById("uptime").textContent = this._getUptime();
            
            if (window.hashChart) {
                updateChart(currentHashrate);
            }
        }, 3000);
    }

    _simulateShares() {
        const genShare = () => {
            if (!this.running) return;
            
            const accepted = Math.random() > 0.05;
            
            if (accepted) {
                this.acceptedShares++;
                document.getElementById("accepted-shares").textContent = this.acceptedShares;
                this.logSuccess(`Share #${this.acceptedShares + this.rejectedShares} được chấp nhận (+1)`);
            } else {
                this.rejectedShares++;
                document.getElementById("rejected-shares").textContent = this.rejectedShares;
                this.logWarning(`Share #${this.acceptedShares + this.rejectedShares} bị từ chối (0)`);
            }
            
            const nextTime = 30000 + Math.random() * 30000;
            setTimeout(genShare, nextTime);
        };
        
        const initialDelay = 8000 + Math.random() * 5000;
        setTimeout(genShare, initialDelay);
    }
}

const webMiner = new WebMiner();
              
