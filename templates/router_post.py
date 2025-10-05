# 파이썬 기본 모듈
import os
import sys
import json
import time
import traceback
from typing import Dict, List, Any, Optional, Union

# 외부 라이브러리
from fastapi import APIRouter, Request, Body, HTTPException
from pydantic import BaseModel

# 내부 프로젝트 모듈
from local_codes import *
from exceptions import error_handler, raise_error
from utils.commons.logger import SandboxLogging

# 라우터 설정
router = APIRouter()

# 로거 설정
# 호출한 파일의 디렉토리에 따라 적절한 로거를 자동으로 반환합니다.
logger = SandboxLogging.get_logger()

# 모델 정의
class RequestModel(BaseModel):
    field: str = None

class ResponseModel(BaseModel):
    result: str
    data: Optional[Dict[str, Any]] = None


@router.post(
    "/path",
    response_model=ResponseModel,
    tags=["태그"],
    summary="요약",
    description="설명"
)
@error_handler(logger)
async def function_name(request: Request, body: RequestModel):
    """
    상세 설명
    """
    try:
        # 요청 데이터 처리
        data = body.model_dump()
        
        # 요청 헤더 정보 확인 (선택적)
        x_user_id = request.headers.get("x-user-id")
        x_request_id = request.headers.get("x-request-id")
        
        # 비즈니스 로직 구현
        # 로직 구현
        # 샘플 데이터 (실행 오류 방지)
        result = {"sample": "data"}
        
        logger.info(f"POST 요청 처리 완료: /path")
        
        # 응답 반환
        return {"result": "success", "data": result}
    except Exception as e:
        logger.error(f"오류 발생: {str(e)}\n{traceback.format_exc()}")
        raise
