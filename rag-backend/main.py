from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import uuid
from rag_engine import process_and_store_pdf
from pydantic import BaseModel
from db import init_db, save_upload_record, get_all_records
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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# 上传目录
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
@app.post("/api/accept")
async def accept_pdf(
    pdf: UploadFile = File(...),
    customerName: str = Form(...),
    remark: str = Form(""),
):
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

    # 5. 处理 PDF（解析 + 向量化 + 入库）
    print(f"正在处理文件: {saved_name}")
    process_and_store_pdf(file_path)  # 👈 调用 rag_engine.py 里的核心函数
    record_id = save_upload_record(
        original_name=original_name,
        saved_name=saved_name,
        size=size,
        customer_name=customerName,
        remark=remark,
        text_length=0,
        status="success",
    )
    print(f"✅ 已写入数据库，记录 ID: {record_id}")
    # 6. 返回结果（不再需要返回完整 textContent，因为已经存进数据库了）
    return {
        "code": 0,
        "message": "上传并向量化成功",
        "data": {
            "originalName": original_name,
            "savedName": saved_name,
            "size": size,
            "customerName": customerName,
            "remark": remark,
            "backendTip": "🎉 PDF 已成功解析并存入向量数据库！",
        },
    }
    from pydantic import BaseModel
from rag_engine import process_and_store_pdf, ask_question

class ChatRequest(BaseModel):
    question: str

@app.post("/api/chat")
async def chat_with_pdf(req: ChatRequest):
    """接收用户提问，返回 AI 回答"""
    try:
        answer = ask_question(req.question)
        return {
            "code": 0,
            "message": "success",
            "data": {
                "question": req.question,
                "answer": answer,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 回答失败: {str(e)}")
@app.get("/api/records")
async def list_records(limit: int = 50):
    return {"code": 0, "message": "success", "data": get_all_records(limit)}