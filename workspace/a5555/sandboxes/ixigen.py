import traceback
from enum import Enum
from typing import List

from fastapi import APIRouter, Request
from pydantic import BaseModel

from exceptions import error_handler
from utils.commons.logger import SandboxLogging
from .utils.sse import generate
from .utils.algo import create_headers

router = APIRouter()
logger = SandboxLogging.get_logger()


class IxigenModels(str, Enum):
    PJ0003 = "IXI.PJ0003pw"


class IxigenMessagesRoles(str, Enum):
    USER = "user"
    SYSTEM = "system"
    ASSISTANT = "assistant"


class IxigenMessages(BaseModel):
    role: IxigenMessagesRoles
    content: str


class IxigenRequestBody(BaseModel):
    secret_key: str
    bundle: str
    model: IxigenModels = IxigenModels.PJ0003
    messages: List[IxigenMessages]
    stream: bool = True


@router.post(
    "/chat/completions",
    summary="ixigen IXI.PJ0003pw 모델 호출",
    description="ixigen IXI.PJ0003pw 모델 호출"
)
@error_handler(logger)
async def function_name(request: Request, body: IxigenRequestBody):
    """
    ixigen IXI.PJ0003pw 모델 호출 API
    """
    try:
        x_request_id = request.headers.get("x-request-id")

        request_headers = {}
        exclude_headers = ["host", "content-length", "connection", "authorization"]

        for key, value in request.headers.items():
            if key.lower() not in exclude_headers:
                request_headers[key] = value

        request_headers.update(
            create_headers(
                client_id="kplus", 
                key_id="87d89fac93c57de6", 
                secret_key=body.secret_key,
                host="seulgiapi.lguplus.co.kr", 
                email="bangkang@lguplus.co.kr", 
                login_id="bangkang@lguplus.co.kr",
            )
        )
        logger.info(f"HEADERS: {request_headers}")

        internal_url = "https://seulgiapi.lguplus.co.kr/v1/chat/completions"
        ixigen_body = {
            "model": body.model,
            "stream": body.stream,
            "bundle": body.bundle,
            "messages": [msg.model_dump() for msg in body.messages]
        }       

        complete_text = ""
        async for is_ok, text in generate(
            x_request_id=x_request_id,
            url=internal_url,
            body=ixigen_body,
            headers=request_headers,
            logger=logger
        ):
            if is_ok:
                complete_text += text
            else:
                logger.error(text)
        logger.info(complete_text)
        return {
            "status": "ok",
            "text": complete_text
        }

    except Exception as e:
        logger.error(f"Error occured: {str(e)}\n{traceback.format_exc()}")
        return {
            "status": "failed"
        }
