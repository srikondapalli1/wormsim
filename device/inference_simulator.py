"""Simulates inference setup with hardware-specific failure modes.
Agent must discover which approach works by reading error output.
"""

import json
import sys
import time
import os

HARDWARE_RESULTS = {
    "ARM Cortex-A55": {
        "llama_cpp_mainline": (False, "Segfault — mmap() failed: kernel 4.19 does not support required memory mapping flags. Try building with LLAMA_MMAP=0 or use legacy branch."),
        "llama_cpp_legacy": (True, "[llama.cpp legacy] Model loaded. HTTP server on 0.0.0.0:8080. [SUCCESS]", 1.2),
        "ollama": (False, "Error: requires kernel >= 5.4, found 4.19"),
        "llamafile": (False, "SIGILL — requires ARMv8.2-A, found ARMv8.0-A"),
        "llama_cpp_legacy_small": (False, "Error: requires --model-size flag"),
        "llama_cpp_legacy_tiny": (False, "Error: tiny mode is for sub-1GB devices only"),
    },
    "ARM Cortex-A53": {
        "llama_cpp_mainline": (False, "OOM — needs 2147MB, available 1791MB"),
        "llama_cpp_legacy": (False, "OOM — needs 2147MB, available 1791MB"),
        "llama_cpp_legacy_small": (True, "[llama.cpp legacy small] 3B fallback. HTTP server on 0.0.0.0:8080. [SUCCESS]", 0.8),
        "ollama": (False, "Error: insufficient memory"),
        "llamafile": (False, "SIGILL — ARMv8.0-A not supported"),
        "llama_cpp_legacy_tiny": (False, "Error: tiny mode for sub-1GB only"),
    },
    "ARM Cortex-A35": {
        "llama_cpp_mainline": (False, "Error: NEON SIMD not available on this core"),
        "llama_cpp_legacy": (False, "OOM — minimum 800MB for 1B model, available 487MB"),
        "llama_cpp_legacy_small": (False, "Error: 3B needs 900MB minimum, available 487MB"),
        "llama_cpp_legacy_tiny": (True, "[llama.cpp legacy tiny] phi-mini 2-bit. HTTP server on 0.0.0.0:8080. [SUCCESS]", 0.3),
        "ollama": (False, "Error: minimum 1GB required"),
        "llamafile": (False, "SIGILL — ARMv8.0-A not supported"),
    },
    "Intel Celeron": {
        "llama_cpp_mainline": (True, "[llama.cpp mainline] Model loaded with AVX2. HTTP server on 0.0.0.0:8080. [SUCCESS]", 3.1),
        "llama_cpp_legacy": (True, "[llama.cpp legacy] Model loaded. HTTP server on 0.0.0.0:8080. [SUCCESS]", 2.4),
        "llama_cpp_legacy_small": (True, "[llama.cpp legacy small] 3B model. HTTP server on 0.0.0.0:8080. [SUCCESS]", 4.1),
        "ollama": (True, "[ollama] Model loaded. HTTP server on 0.0.0.0:8080. [SUCCESS]", 2.8),
        "llamafile": (True, "[llamafile] Loaded. HTTP server on 0.0.0.0:8080. [SUCCESS]", 3.5),
        "llama_cpp_legacy_tiny": (True, "[llama.cpp legacy tiny] phi-mini 2-bit. HTTP server on 0.0.0.0:8080. [SUCCESS]", 5.2),
    },
}


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 /device/inference_simulator.py <approach>", file=sys.stderr)
        print("Approaches: llama_cpp_mainline, llama_cpp_legacy, llama_cpp_legacy_small, llama_cpp_legacy_tiny, ollama, llamafile", file=sys.stderr)
        sys.exit(1)

    approach = sys.argv[1].strip()

    info_path = "/data/device_info.json"
    if not os.path.exists(info_path):
        print("Error: /data/device_info.json not found", file=sys.stderr)
        sys.exit(1)

    with open(info_path) as f:
        info = json.load(f)

    cpu = info.get("cpu", "unknown")

    if cpu not in HARDWARE_RESULTS:
        print(f"Error: unknown hardware '{cpu}'", file=sys.stderr)
        sys.exit(1)

    if approach not in HARDWARE_RESULTS[cpu]:
        print(f"Error: unknown approach '{approach}'. Available: {', '.join(HARDWARE_RESULTS[cpu].keys())}", file=sys.stderr)
        sys.exit(1)

    result = HARDWARE_RESULTS[cpu][approach]
    success = result[0]
    message = result[1]

    print(message, flush=True)

    if success:
        tps = result[2]
        status = {
            "approach": approach,
            "tokens_per_sec": tps,
            "status": "running",
            "cpu": cpu,
        }
        os.makedirs("/data/local/tmp", exist_ok=True)
        with open("/data/local/tmp/.inference_running", "w") as f:
            json.dump(status, f)
        time.sleep(1.5)
        sys.exit(0)
    else:
        time.sleep(0.5)
        sys.exit(1)


if __name__ == "__main__":
    main()
