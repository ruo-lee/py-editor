import httpx
import json
import traceback

from exceptions import format_sse_error
from utils.commons.redis import r


def is_json(my_str: str) -> bool:
    try:
        json.loads(my_str)
    except (ValueError, json.JSONDecodeError):
        return False
    return True


def parse_json(data: str):
    return (json.loads(data[6:])
            if data.startswith("data: ") and is_json(data[6:]) is True
            else {})


def get_text(obj: dict):
    choices = obj.get("choices", [{}])
    if not choices:
        return ""
    
    delta = choices[0].get("delta", {})
    if isinstance(delta, dict):
        return delta.get("content", "")
    return ""


def parse_sse_chunk_publish_to_redis(x_request_id: str, chunk: bytes) -> None:
    """
    SSE 형식의 chunk를 파싱하여 Redis에 퍼블리시합니다.
    Args:
        chunk: SSE 형식의 바이트 데이터
    """
    redis_text_content = ""
    decoded_chunk = chunk.decode("utf-8", errors="replace")
    parsed_chunk = parse_json(decoded_chunk)
    redis_text_content = get_text(parsed_chunk)

    if redis_text_content:
        pub_data = {
            "type": "answer",
            "content": redis_text_content,
        }
        json_str = json.dumps(pub_data, ensure_ascii=False)
        r.publish(f"sse.response:{x_request_id}", json_str)
    return redis_text_content


async def generate(x_request_id: str, url: str, body: dict, headers: dict, logger):
    try:
        async with httpx.AsyncClient(
                timeout=float(600)
        ) as client:
            request_kwargs = {
                "json": body,
                "headers": headers
            }
            async with client.stream(
                    "POST", url, **request_kwargs
            ) as response:
                if response.status_code == 200 or response.status_code == 201:
                    buffer = ""
                    async for chunk in response.aiter_bytes():
                        buffer += chunk.decode("utf-8", errors="replace")

                        events = buffer.split("\n\n")
                        buffer = events[-1]

                        for event_text in events[:-1]:
                            if not event_text.strip():
                                continue

                            if "data:" in event_text:
                                complete_event = event_text + "\n\n"
                                text_content = parse_sse_chunk_publish_to_redis(
                                    x_request_id,
                                    complete_event.encode("utf-8"),
                                )
                                yield True, text_content

                else:
                    # SSE 스트리밍 에러 처리
                    logger.error(
                        f"Athena API call failed: [{response.status_code}]"
                    )

                    # 에러 응답 본문 읽기 시도
                    try:
                        error_text = await response.aread()
                        error_data = (
                            json.loads(error_text.decode("utf-8", errors="replace"))
                            if error_text
                            else {}
                        )
                    except Exception as e:
                        logger.error(f"Failed to parse error response: {str(e)}")
                        error_data = {}

                    # SSE 형식으로 에러 전송
                    error_message = format_sse_error(
                        status_code=response.status_code,
                        code="60100",
                        message=error_data.get(
                            "message",
                            "An error occurred during LLM API call",
                        ),
                        data=error_data.get("data", None),
                    )
                    yield False, error_message.encode("utf-8")

    except httpx.ConnectError as e:
        # 네트워크 연결 에러
        logger.error(f"Network error in Athena API call: {str(e)}")
        error_message = format_sse_error(
            status_code=500,
            code="60100",
            message="Network error occurred during Athena API call",
            data={"detail": str(e)},
        )
        yield False, error_message.encode("utf-8")

    except httpx.TimeoutException as e:
        # 타임아웃 에러
        logger.error(f"Timeout in Athena API call: {str(e)}")
        error_message = format_sse_error(
            status_code=504,
            code="60100",
            message="Athena API request timed out",
            data={"timeout": 600},
        )
        yield False, error_message.encode("utf-8")

    except Exception as e:
        # 기타 예외
        logger.error(f"Unexpected error in SSE streaming: {str(e)}")
        error_message = format_sse_error(
            status_code=500,
            code="60100",
            message=f"Unexpected error: {str(traceback.format_exc())}",
            data=None,
        )
        yield False, error_message.encode("utf-8")
