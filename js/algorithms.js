const ALGORITHMS = {
    "rx/0": {
        name: "RandomX",
        coin: "Monero (XMR)",
        memory: "Medium (2GB)",
        hashrateFactor: 1.0,
        difficulty: "Medium",
        config: {
            algo: "rx/0",
            "rx/mode": "auto",
            "1gb-pages": false
        }
    },
    "rx/wow": {
        name: "RandomWOW",
        coin: "Wownero (WOW)",
        memory: "Medium (2GB)",
        hashrateFactor: 0.9,
        difficulty: "Medium",
        config: {
            algo: "rx/wow",
            "rx/mode": "auto"
        }
    },
    "rx/arq": {
        name: "RandomARQ",
        coin: "ArQmA (ARQ)",
        memory: "Low (256MB)",
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
        memory: "Medium (2GB)",
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
        memory: "Low (512MB)",
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
        memory: "High (3GB)",
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
        memory: "Very High (4GB+)",
        hashrateFactor: 0.15,
        difficulty: "Extremely High",
        config: {
            algo: "ethash",
            "ethash/epoch": 0
        }
    }
};

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
    } catch (e) { }
    return false;
}

function getAlgorithmInfo(algorithmId) {
    return ALGORITHMS[algorithmId] || ALGORITHMS["rx/0"];
}
