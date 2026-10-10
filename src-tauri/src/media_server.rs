use std::io::SeekFrom;
use std::net::SocketAddr;
use std::path::Path;
use std::sync::OnceLock;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

static MEDIA_SERVER_PORT: OnceLock<u16> = OnceLock::new();

pub fn get_server_port() -> Option<u16> {
    MEDIA_SERVER_PORT.get().copied()
}

pub fn get_stream_url(file_path: &str) -> Option<String> {
    let port = get_server_port()?;
    let encoded = url_encode(file_path);
    Some(format!("http://127.0.0.1:{}/media?path={}", port, encoded))
}

pub fn start_media_server() {
    tauri::async_runtime::spawn(async move {
        let addr = SocketAddr::from(([127, 0, 0, 1], 0));
        let listener = match TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                log::error!("Failed to bind local media streaming server: {}", e);
                return;
            }
        };

        if let Ok(local_addr) = listener.local_addr() {
            let port = local_addr.port();
            let _ = MEDIA_SERVER_PORT.set(port);
            log::info!("Local media streaming server running at http://127.0.0.1:{}", port);
        }

        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    tokio::spawn(async move {
                        if let Err(e) = handle_connection(stream).await {
                            log::debug!("Media server client connection closed: {}", e);
                        }
                    });
                }
                Err(e) => {
                    log::warn!("Media server accept failed: {}", e);
                    break;
                }
            }
        }
    });
}

async fn handle_connection(mut stream: TcpStream) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).await?;
    if n == 0 {
        return Ok(());
    }

    let req_str = String::from_utf8_lossy(&buf[..n]);
    let mut lines = req_str.lines();
    let request_line = match lines.next() {
        Some(l) => l,
        None => return Ok(()),
    };

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return Ok(());
    }

    let method = parts[0];
    let uri = parts[1];
    let is_get = method == "GET";
    let is_head = method == "HEAD";

    if !is_get && !is_head {
        send_headers(
            &mut stream,
            405,
            "Method Not Allowed",
            &[("Content-Length", "0"), ("Connection", "close")],
        )
        .await?;
        return Ok(());
    }

    // Extract query parameter ?path=...
    let query_path = extract_query_param(uri, "path");
    let file_path_str = match query_path {
        Some(p) => decode_percent(&p),
        None => {
            send_headers(
                &mut stream,
                400,
                "Bad Request",
                &[("Content-Length", "0"), ("Connection", "close")],
            )
            .await?;
            return Ok(());
        }
    };

    let clean_path = file_path_str.trim().trim_start_matches("file://");
    let file_path = Path::new(clean_path);

    if !file_path.is_file() {
        send_headers(
            &mut stream,
            404,
            "Not Found",
            &[
                ("Content-Length", "0"),
                ("Access-Control-Allow-Origin", "*"),
                ("Connection", "close"),
            ],
        )
        .await?;
        return Ok(());
    }

    let metadata = match tokio::fs::metadata(file_path).await {
        Ok(m) => m,
        Err(_) => {
            send_headers(
                &mut stream,
                500,
                "Internal Server Error",
                &[("Content-Length", "0"), ("Connection", "close")],
            )
            .await?;
            return Ok(());
        }
    };

    let total_len = metadata.len();
    let mime = mime_guess::from_path(file_path)
        .first_or_octet_stream()
        .to_string();

    // Check for Range header
    let mut range_start = None;
    let mut range_end = None;

    for line in lines {
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("range:") {
            if let Some(spec) = line.split(':').nth(1) {
                let spec = spec.trim();
                if let Some(range_val) = spec.strip_prefix("bytes=") {
                    let parts: Vec<&str> = range_val.split('-').collect();
                    if let Some(s) = parts.first() {
                        if let Ok(parsed_s) = s.trim().parse::<u64>() {
                            range_start = Some(parsed_s);
                        }
                    }
                    if parts.len() > 1 && !parts[1].trim().is_empty() {
                        if let Ok(parsed_e) = parts[1].trim().parse::<u64>() {
                            range_end = Some(parsed_e);
                        }
                    }
                }
            }
            break;
        }
    }

    if let Some(start) = range_start {
        if start >= total_len {
            let range_hdr = format!("bytes */{}", total_len);
            send_headers(
                &mut stream,
                416,
                "Range Not Satisfiable",
                &[
                    ("Content-Range", &range_hdr),
                    ("Content-Length", "0"),
                    ("Access-Control-Allow-Origin", "*"),
                    ("Connection", "close"),
                ],
            )
            .await?;
            return Ok(());
        }

        let end = match range_end {
            Some(e) => e.min(total_len - 1),
            None => total_len - 1,
        };

        if end < start {
            send_headers(
                &mut stream,
                416,
                "Range Not Satisfiable",
                &[("Content-Length", "0"), ("Connection", "close")],
            )
            .await?;
            return Ok(());
        }

        let chunk_len = end - start + 1;
        let content_range = format!("bytes {}-{}/{}", start, end, total_len);
        let chunk_len_str = chunk_len.to_string();

        send_headers(
            &mut stream,
            206,
            "Partial Content",
            &[
                ("Content-Type", &mime),
                ("Content-Range", &content_range),
                ("Content-Length", &chunk_len_str),
                ("Accept-Ranges", "bytes"),
                ("Access-Control-Allow-Origin", "*"),
                ("Connection", "keep-alive"),
            ],
        )
        .await?;

        if is_get {
            let mut file = tokio::fs::File::open(file_path).await?;
            file.seek(SeekFrom::Start(start)).await?;
            let mut limited = file.take(chunk_len);
            let _ = tokio::io::copy(&mut limited, &mut stream).await;
        }
    } else {
        let total_len_str = total_len.to_string();
        send_headers(
            &mut stream,
            200,
            "OK",
            &[
                ("Content-Type", &mime),
                ("Content-Length", &total_len_str),
                ("Accept-Ranges", "bytes"),
                ("Access-Control-Allow-Origin", "*"),
                ("Connection", "keep-alive"),
            ],
        )
        .await?;

        if is_get {
            let mut file = tokio::fs::File::open(file_path).await?;
            let _ = tokio::io::copy(&mut file, &mut stream).await;
        }
    }

    Ok(())
}

async fn send_headers(
    stream: &mut TcpStream,
    status_code: u16,
    reason: &str,
    headers: &[(&str, &str)],
) -> Result<(), std::io::Error> {
    let mut header_buf = format!("HTTP/1.1 {} {}\r\n", status_code, reason);
    for (k, v) in headers {
        header_buf.push_str(k);
        header_buf.push_str(": ");
        header_buf.push_str(v);
        header_buf.push_str("\r\n");
    }
    header_buf.push_str("\r\n");
    stream.write_all(header_buf.as_bytes()).await?;
    stream.flush().await?;
    Ok(())
}

fn extract_query_param(uri: &str, param_name: &str) -> Option<String> {
    let query_start = uri.find('?')?;
    let query_string = &uri[query_start + 1..];
    for pair in query_string.split('&') {
        let mut key_val = pair.splitn(2, '=');
        let key = key_val.next()?;
        if key == param_name {
            return key_val.next().map(|s| s.to_string());
        }
    }
    None
}

pub fn decode_percent(input: &str) -> String {
    let mut result = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(val) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16) {
                result.push(val);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(result).unwrap_or_else(|_| input.to_string())
}

pub fn url_encode(input: &str) -> String {
    let mut result = String::new();
    for byte in input.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                result.push(byte as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_percent() {
        assert_eq!(decode_percent("/path/to/my%20video.mp4"), "/path/to/my video.mp4");
        assert_eq!(decode_percent("%2Ftmp%2Ftest.mkv"), "/tmp/test.mkv");
        assert_eq!(decode_percent("normal_path.webm"), "normal_path.webm");
    }

    #[test]
    fn test_url_encode() {
        assert_eq!(url_encode("/tmp/my video.mp4"), "/tmp/my%20video.mp4");
        assert_eq!(url_encode("/home/user/video.webm"), "/home/user/video.webm");
    }

    #[test]
    fn test_extract_query_param() {
        assert_eq!(
            extract_query_param("/media?path=/tmp/test.mp4&t=12", "path"),
            Some("/tmp/test.mp4".to_string())
        );
        assert_eq!(extract_query_param("/media", "path"), None);
    }
}
