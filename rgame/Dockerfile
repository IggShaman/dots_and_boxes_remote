# ── Stage 1: build ────────────────────────────────────────────────────────
FROM rust:slim-bookworm AS builder
WORKDIR /app

# Cache dependency compilation separately from source changes.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src target/release/deps/rgame*

COPY src ./src
RUN cargo build --release

# ── Stage 2: runtime ───────────────────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/rgame /usr/local/bin/rgame

EXPOSE 3001
ENV RUST_LOG=rgame=info
CMD ["rgame"]
