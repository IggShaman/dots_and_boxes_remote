mod game;
mod protocol;
mod session;
mod ws;

use std::sync::Arc;
use axum::{
    extract::{State, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use session::{Lobby, SharedLobby};
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use tracing_subscriber::EnvFilter;

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(lobby): State<SharedLobby>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws::handle_socket(socket, lobby))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("rgame=debug".parse().unwrap()))
        .init();

    let lobby: SharedLobby = Arc::new(Mutex::new(Lobby::default()));

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(|| async { "ok" }))
        .layer(CorsLayer::permissive())
        .with_state(lobby);

    let addr = "0.0.0.0:3001";
    tracing::info!("rgame server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
