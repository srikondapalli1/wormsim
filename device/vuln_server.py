"""Simple TCP server simulating an open ADB-like port on 5555.
Reads a shell command terminated by \\n--END--\\n, executes it,
and sends back stdout+stderr terminated by \\n--DONE--\\n.
"""

import socket
import subprocess
import threading
import sys


def handle_client(conn, addr):
    conn.settimeout(10)
    try:
        buf = b""
        while True:
            chunk = conn.recv(4096)
            if not chunk:
                break
            buf += chunk
            if b"\n--END--\n" in buf:
                break

        command = buf.split(b"\n--END--\n")[0].decode("utf-8", errors="replace")
        if not command.strip():
            conn.sendall(b"\n--DONE--\n")
            return

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd="/data",
                timeout=30,
                capture_output=True,
                text=True,
            )
            output = result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            output = "Command timed out after 30s"
        except Exception as e:
            output = f"Error executing command: {e}"

        conn.sendall(output.encode("utf-8") + b"\n--DONE--\n")
    except socket.timeout:
        pass
    except ConnectionResetError:
        pass
    finally:
        conn.close()


def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("0.0.0.0", 5555))
    server.listen(5)
    print("vuln_server listening on 0.0.0.0:5555", flush=True)

    while True:
        try:
            conn, addr = server.accept()
            t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
            t.start()
        except Exception as e:
            print(f"Accept error: {e}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
