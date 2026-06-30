FROM python:3.11-slim-bullseye

RUN useradd -m sandbox

WORKDIR /workspace

USER sandbox

ENTRYPOINT ["python3", "-I", "/workspace/script.py"]