FROM alpine:3.18
RUN apk add --no-cache python3 py3-pip bash curl nmap netcat-openbsd procps
RUN mkdir -p /data/local/tmp /data/media/.thumbnails/cache /var/log /device
COPY vuln_server.py /device/vuln_server.py
COPY inference_simulator.py /device/inference_simulator.py
CMD ["sh", "-c", "python3 /device/vuln_server.py & tail -f /dev/null"]
