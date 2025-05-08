/**
 * Các thuật toán khai thác được hỗ trợ và thông tin chi tiết về chúng
 */
const ALGORITHMS = {
    "rx/0": {
        name: "RandomX",
        coin: "Monero (XMR)",
        description: "Thuật toán chính của Monero, tối ưu cho CPU",
        memory: "2GB",
        hashrateFactor: 1.0,
        difficulty: "Medium",
        config: {
            algo: "rx/0",
            "rx/mode": "auto",
            "1gb-pages": false,
            "huge-pages": true
        }
    },
    "rx/wow": {
        name: "RandomWOW",
        coin: "Wownero (WOW)",
        description: "Biến thể của RandomX cho Wownero",
        memory: "2GB",
        hashrateFactor: 0.9,
        difficulty: "Medium",
        config: {
            algo: "rx/wow",
            "rx/mode": "auto",
            "huge-pages": true
        }
    },
    "rx/arq": {
        name: "RandomARQ",
        coin: "ArQmA (ARQ)",
        description: "Phiên bản nhẹ hơn của RandomX",
        memory: "256MB",
        hashrateFactor: 1.2,
        difficulty: "Low",
        config: {
            algo: "rx/arq",
            "rx/mode": "auto"
        }
    },
    "cn/r": {
        name: "CryptoNight-R",
        coin: "Various CN coins",
        description: "Thuật toán CryptoNight với các thay đổi ngẫu nhiên",
        memory: "2GB",
        hashrateFactor: 0.5,
        difficulty: "High",
        config: {
            algo: "cn/r",
            "cpu/priority": "high"
        }
    },
    "argon2/chukwa": {
        name: "Argon2/Chukwa",
        coin: "TurtleCoin (TRTL)",
        description: "Dựa trên Argon2, tối ưu cho CPU, ít tốn điện",
        memory: "512MB",
        hashrateFactor: 0.3,
        difficulty: "Medium",
        config: {
            algo: "argon2/chukwa",
            "argon2-impl": "SSE2"
        }
    },
    "kawpow": {
        name: "KawPow",
        coin: "Ravencoin (RVN)",
        description: "Biến thể của ProgPow, kháng ASIC",
        memory: "3GB",
        hashrateFactor: 0.2,
        difficulty: "Very High",
        config: {
            algo: "kawpow",
            "kawpow/period": 3
        }
    },
    "ethash": {
        name: "Ethash",
        coin: "Ethereum Classic (ETC)",
        description: "Thuật toán của Ethereum, yêu cầu nhiều bộ nhớ",
        memory: "4GB+",
        hashrateFactor: 0.15,
        difficulty: "Extremely High",
        config: {
            algo: "ethash",
            "ethash/epoch": 0
        }
    }
};

/**
 * Thông tin cấu hình công cụ khai thác
 */
const MINER_CONFIG = {
    defaultThreads: 2,
    maxMemoryPerThread: 2048, // MB
    autoAdjustInterval: 90000, // 1.5 phút
    defaultAlgorithm: "rx/0",
    defaultPool: "pool.supportxmr.com:3333",
    hashrateSamplingInterval: 3000, // 3 giây
    hashrateSamplingSize: 20, // Số lượng mẫu để tính hashrate trung bình
    poolConnectTimeout: 10000, // 10 giây timeout cho kết nối pool
    poolReconnectDelay: 5000, // 5 giây trước khi kết nối lại
    maxLogEntries: 500, // Số lượng mục nhật ký tối đa để lưu
    wasmDownloadUrl: "js/cryptonight.wasm",
    threadScheduling: {
        lowPriority: { throttleMs: 20 }, // Ưu tiên thấp - nhiều thời gian nghỉ giữa các vòng lặp tính toán
        mediumPriority: { throttleMs: 10 }, // Ưu tiên trung bình
        highPriority: { throttleMs: 4 } // Ưu tiên cao - ít thời gian nghỉ
    }
};

/**
 * Chi tiết của các pool khai thác phổ biến
 */
const MINING_POOLS = [
    {
        name: "SupportXMR",
        url: "pool.supportxmr.com",
        ports: [
            { port: 3333, description: "Tiêu chuẩn" },
            { port: 5555, description: "Độ khó cao" },
            { port: 7777, description: "Độ khó thấp" },
            { port: 9000, description: "SSL" }
        ],
        minPayout: 0.01,
        fee: 0.6,
        website: "https://supportxmr.com"
    },
    {
        name: "Monero Ocean",
        url: "gulf.moneroocean.stream",
        ports: [
            { port: 10001, description: "Độ khó cao" },
            { port: 10002, description: "Độ khó trung bình" },
            { port: 10004, description: "Độ khó thấp" },
            { port: 20001, description: "SSL" }
        ],
        minPayout: 0.003,
        fee: 0.0,
        website: "https://moneroocean.stream"
    },
    {
        name: "2Miners",
        url: "xmr.2miners.com",
        ports: [
            { port: 2222, description: "Tiêu chuẩn" },
            { port: 12222, description: "NiceHash" },
            { port: 2221, description: "Solo Mining" }
        ],
        minPayout: 0.1,
        fee: 1.0,
        website: "https://2miners.com"
    },
    {
        name: "Nanopool",
        url: "xmr-eu1.nanopool.org",
        ports: [
            { port: 14444, description: "Tiêu chuẩn" },
            { port: 14433, description: "SSL" }
        ],
        minPayout: 0.1,
        fee: 1.0,
        website: "https://nanopool.org"
    },
    {
        name: "F2Pool",
        url: "xmr.f2pool.com",
        ports: [
            { port: 13531, description: "Tiêu chuẩn" },
            { port: 13532, description: "NiceHash" }
        ],
        minPayout: 0.1,
        fee: 1.0,
        website: "https://f2pool.com"
    }
];

/**
 * Kiểm tra thiết bị có hỗ trợ WebAssembly không
 * @returns {boolean} True nếu hỗ trợ WebAssembly
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
    } catch (e) {
        console.error("WebAssembly check failed:", e);
    }
    return false;
}

/**
 * Kiểm tra WebWorkers có được hỗ trợ không
 * @returns {boolean} True nếu hỗ trợ WebWorkers
 */
function checkWebWorkersSupport() {
    return typeof Worker !== 'undefined';
}

/**
 * Kiểm tra xem code WebAssembly bộ nhớ chia sẻ có khả dụng không
 * @returns {boolean} True nếu hỗ trợ Shared Array Buffer
 */
function checkSharedMemorySupport() {
    try {
        return typeof SharedArrayBuffer !== 'undefined';
    } catch (e) {
        return false;
    }
}

/**
 * Nhận thông tin thuật toán
 * @param {string} algorithmId - ID của thuật toán
 * @returns {Object} Thông tin thuật toán
 */
function getAlgorithmInfo(algorithmId) {
    return ALGORITHMS[algorithmId] || ALGORITHMS[MINER_CONFIG.defaultAlgorithm];
}

/**
 * Nhận thông tin pool khai thác
 * @param {string} poolUrl - URL của pool
 * @returns {Object|null} Thông tin pool hoặc null nếu không tìm thấy
 */
function getMiningPoolInfo(poolUrl) {
    if (!poolUrl) return null;
    
    // Tách hostname từ URL pool đầy đủ
    const hostname = poolUrl.split(':')[0];
    
    return MINING_POOLS.find(pool => 
        pool.url === hostname || 
        hostname.includes(pool.url) || 
        pool.url.includes(hostname)
    );
}

/**
 * Nhận cấu hình cụ thể cho số luồng và thuật toán
 * @param {string} algorithmId - ID của thuật toán
 * @param {number} threads - Số luồng
 * @param {number} intensity - Cường độ khai thác (0-100)
 * @returns {Object} Cấu hình tối ưu cho tham số đã cho
 */
function getOptimizedConfig(algorithmId, threads, intensity) {
    const algorithm = getAlgorithmInfo(algorithmId);
    const config = { ...algorithm.config };
    
    // Tính toán số lượng bộ nhớ có sẵn trên mỗi luồng
    const totalRAM = getTotalSystemMemory();
    const availablePerThread = Math.floor(totalRAM * 0.75 / threads);
    
    // Tối ưu hóa bộ nhớ
    if (availablePerThread < 1024 && config["huge-pages"]) {
        config["huge-pages"] = false;
    }
    
    // Áp dụng cường độ tính toán
    if (intensity < 70) {
        config.priority = MINER_CONFIG.threadScheduling.lowPriority.throttleMs;
    } else if (intensity < 90) {
        config.priority = MINER_CONFIG.threadScheduling.mediumPriority.throttleMs;
    } else {
        config.priority = MINER_CONFIG.threadScheduling.highPriority.throttleMs;
    }
    
    return config;
}

/**
 * Ước tính tổng bộ nhớ hệ thống (giá trị gần đúng)
 * @returns {number} Ước tính RAM (MB)
 */
function getTotalSystemMemory() {
    // Không có cách chính xác để lấy RAM trong trình duyệt
    // Sử dụng số lượng luồng CPU để ước tính
    const cores = navigator.hardwareConcurrency || 4;
    return cores * 2048; // Giả định mỗi lõi tương ứng với khoảng 2GB RAM
}

/**
 * Đề xuất số lượng luồng tối ưu dựa trên thuật toán và cấu hình thiết bị
 * @param {string} algorithmId - ID của thuật toán
 * @returns {number} Số lượng thread được đề xuất
 */
function recommendThreads(algorithmId) {
    const algorithm = getAlgorithmInfo(algorithmId);
    const cores = navigator.hardwareConcurrency || 4;
    
    // RandomX yêu cầu nhiều bộ nhớ, do đó sử dụng ít luồng hơn
    if (algorithmId.startsWith('rx/')) {
        return Math.max(1, Math.floor(cores * 0.75));
    }
    
    // Các thuật toán Argon2 cũng yêu cầu bộ nhớ cao
    if (algorithmId.startsWith('argon2/')) {
        return Math.max(1, Math.floor(cores * 0.75));
    }
    
    // Các thuật toán khác có thể sử dụng nhiều luồng hơn
    return Math.max(1, Math.floor(cores * 0.85));
}

/**
 * Xuất thông tin về các thuật toán và pools được hỗ trợ để sử dụng trong UI
 */
const MINER_INFO = {
    algorithms: Object.keys(ALGORITHMS).map(id => ({
        id,
        name: ALGORITHMS[id].name,
        coin: ALGORITHMS[id].coin,
        description: ALGORITHMS[id].description,
        memory: ALGORITHMS[id].memory,
        difficulty: ALGORITHMS[id].difficulty
    })),
    
    pools: MINING_POOLS.map(pool => ({
        name: pool.name,
        url: pool.url,
        ports: pool.ports,
        fee: pool.fee,
        minPayout: pool.minPayout,
        website: pool.website
    })),
    
    features: {
        wasmSupported: checkWasmSupport(),
        webWorkersSupported: checkWebWorkersSupport(),
        sharedMemorySupported: checkSharedMemorySupport(),
        estimatedDeviceRam: getTotalSystemMemory()
    }
};

// Export nếu chạy trong môi trường Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ALGORITHMS, 
        MINER_CONFIG, 
        MINING_POOLS, 
        MINER_INFO,
        getAlgorithmInfo, 
        checkWasmSupport,
        recommendThreads
    };
                }
                
