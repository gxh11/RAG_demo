from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pathlib import Path
import uuid
import os
from datetime import datetime, timedelta
import jwt
import bcrypt
from rag_engine import process_and_store_pdf
from pydantic import BaseModel
from db import (
    init_db,
    save_upload_record,
    update_upload_status,
    get_records_by_user,
    has_successful_upload,
    get_user_by_username,
    create_user,
)
app = FastAPI(title="PDF 接收接口")
@app.on_event("startup")
def on_startup():
    init_db()
    print("✅ 数据库表已就绪")
# 开发环境跨域配置，按需修改
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://rag.zkqcoc.shop",
        "https://rag.zkqcoc.shop",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# 上传目录
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 各账号的后台解析状态：username -> {"state": "processing"/"done"/"error", "filename": ..., "message": ...}
user_processing = {}

# 20MB
MAX_SIZE = 20 * 1024 * 1024

def extract_text_from_pdf(file_path: Path) -> str:
    """提取 PDF 中的文本"""
    text = ""
    try:
        reader = PdfReader(file_path)
        # 遍历每一页，把文字拼起来
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as e:
        print(f"解析 PDF 失败: {e}")
        text = "【解析失败，可能文件已加密或损坏】"
    return text
def process_pdf_task(record_id, file_path: Path, user_id, username, original_name):
    """后台任务：解析 PDF 并向量化入库（不阻塞上传响应）"""
    user_processing[username] = {"state": "processing", "filename": original_name}
    try:
        process_and_store_pdf(file_path, user_id)
        update_upload_status(record_id, "success")
        user_processing[username] = {"state": "done", "filename": original_name}
        print(f"✅ 后台解析完成: {original_name} (user_id={user_id})")
    except Exception as e:
        update_upload_status(record_id, "failed")
        user_processing[username] = {"state": "error", "filename": original_name, "message": str(e)}
        print(f"❌ 后台解析失败: {original_name}: {e}")


@app.post("/api/accept")
async def accept_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    pdf: UploadFile = File(...),
    customerName: str = Form(...),
    remark: str = Form(""),
):
    username, user_id = require_login(request)
    # 1. 基础校验
    if not pdf.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    original_name = pdf.filename
    filename_lower = original_name.lower()

    if not filename_lower.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 格式文件")

    # 2. 生成安全文件名，避免重名和路径穿越
    saved_name = f"{uuid.uuid4().hex}.pdf"
    file_path = UPLOAD_DIR / saved_name

    # 3. 流式保存，并限制 20MB
    size = 0
    try:
        with file_path.open("wb") as buffer:
            while True:
                chunk = await pdf.read(1024 * 1024)  # 每次读 1MB
                if not chunk:
                    break

                size += len(chunk)

                if size > MAX_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="文件大小不能超过 20MB",
                    )

                buffer.write(chunk)

    except HTTPException:
        if file_path.exists():
            file_path.unlink()
        raise

    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"保存文件失败：{e}")

    finally:
        await pdf.close()

    # 4. 校验 PDF 魔数，防止有人改后缀
    with file_path.open("rb") as f:
        header = f.read(5)

    if header != b"%PDF-":
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="文件内容不是有效的 PDF")

    # 5. 写入记录（状态 processing），交给后台解析，立即返回
    record_id = save_upload_record(
        user_id=user_id,
        original_name=original_name,
        saved_name=saved_name,
        size=size,
        customer_name=customerName,
        remark=remark,
        text_length=0,
        status="processing",
    )
    print(f"✅ 已写入数据库，记录 ID: {record_id}，后台开始解析")
    user_processing[username] = {"state": "processing", "filename": original_name}
    background_tasks.add_task(process_pdf_task, record_id, file_path, user_id, username, original_name)

    # 6. 上传已完成即返回，解析在后台继续，用户可以离开页面
    return {
        "code": 0,
        "message": "上传完成，后台正在解析文件",
        "data": {
            "originalName": original_name,
            "savedName": saved_name,
            "size": size,
            "customerName": customerName,
            "remark": remark,
            "status": "processing",
            "backendTip": "上传已完成，后台正在解析文件并建立索引，现在可以退出页面，稍后回来即可提问。",
        },
    }
from rag_engine import process_and_store_pdf, ask_question_stream

class ChatRequest(BaseModel):
    question: str

@app.post("/api/chat")
async def chat_with_pdf(request: Request, req: ChatRequest):
    """接收用户提问，流式返回 AI 回答（需登录，只能问自己上传的文档）"""
    username, user_id = require_login(request)

    if user_processing.get(username, {}).get("state") == "processing":
        raise HTTPException(status_code=400, detail="文件正在后台解析，请稍后再试")
    if not has_successful_upload(user_id):
        raise HTTPException(status_code=400, detail="请先上传 PDF 文件，再进行提问")

    def generate():
        try:
            for delta in ask_question_stream(req.question, user_id):
                yield delta
        except Exception as e:
            yield f"\n❌ AI 回答失败: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


@app.get("/api/upload-status")
async def upload_status(request: Request):
    """查询当前账号的解析状态和上传记录（前端轮询 / 恢复页面状态用）"""
    username, user_id = require_login(request)
    state = user_processing.get(username, {"state": "idle"})
    return {
        "code": 0,
        "message": "success",
        "data": {
            "processing": state,
            "hasPdf": has_successful_upload(user_id),
            "files": get_records_by_user(user_id),
        },
    }


@app.get("/api/records")
async def list_records(request: Request, limit: int = 50):
    _, user_id = require_login(request)
    return {"code": 0, "message": "success", "data": get_records_by_user(user_id, limit)}


# ============ 登录鉴权（JWT） ============
JWT_SECRET = os.getenv("JWT_SECRET", "rag-demo-jwt-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(request: Request) -> str:
    """从 Authorization: Bearer <token> 解析用户名，无效则返回空串"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return ""
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub", "")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的登录凭证")


def require_login(request: Request):
    """要求登录，返回 (username, user_id)"""
    username = get_current_user(request)
    if not username:
        raise HTTPException(status_code=401, detail="请先登录")
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return username, user.id


@app.post("/api/register")
async def register(req: RegisterRequest):
    username = req.username.strip()
    password = req.password

    if not username or len(username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少 2 个字符")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 个字符")
    if get_user_by_username(username):
        raise HTTPException(status_code=400, detail="用户名已存在")

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = create_user(username, pw_hash)
    return {
        "code": 0,
        "message": "注册成功",
        "data": {"id": user_id, "username": username, "token": create_token(username)},
    }


@app.post("/api/login")
async def login(req: LoginRequest):
    user = get_user_by_username(req.username.strip())
    if not user or not bcrypt.checkpw(req.password.encode("utf-8"), user.password_hash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {
        "code": 0,
        "message": "登录成功",
        "data": {"id": user.id, "username": user.username, "token": create_token(user.username)},
    }


@app.get("/api/me")
async def me(request: Request):
    """校验 token 并返回当前登录用户"""
    username = get_current_user(request)
    return {"code": 0, "message": "success", "data": {"username": username}}