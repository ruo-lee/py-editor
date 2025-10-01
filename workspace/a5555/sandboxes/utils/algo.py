import base64
import hashlib
import hmac
import time


def generate_hmac_signature(
    host: str,
    client_id: str,
    key_id: str,
    timestamp: int,
    email: str,
    login_id: str,
    secret_key: str
):
    """HMAC-SHA256 서명 생성"""
    string_to_sign = f"{host};{client_id};{key_id};{timestamp};{email};{login_id}"
    
    # HMAC-SHA256으로 서명 생성
    signature = hmac.new(
        secret_key.encode('utf-8'),
        string_to_sign.encode('utf-8'),
        hashlib.sha256
    )
    
    # Base64로 인코딩하여 반환
    return base64.b64encode(signature.digest()).decode('utf-8')


def create_headers(
      client_id: str, 
      key_id: str, 
      secret_key: str,
      host: str, 
      email: str, 
      login_id: str,
    ):
    """lguplus_ixi API 요청용 헤더 생성"""

    timestamp = int(time.time())
    
    # HMAC 서명 생성
    hmac_signature = generate_hmac_signature(
        host, client_id, key_id, timestamp, email, login_id, secret_key
    )
    
    # 헤더 딕셔너리 생성
    headers = {
        "x-client-id": client_id,
        "x-key-id": key_id,
        "x-timestamp": str(timestamp),
        "x-user-email": email,
        "x-user-loginId": login_id,
        "Authorization": f"SEULGI-HMAC-SHA256-V1 SigHeaders=host;x-client-id;x-key-id;x-timestamp,x-user-email,Signature={hmac_signature}",
        "Content-Type": "application/json"
    }
    
    return headers
