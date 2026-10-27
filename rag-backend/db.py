import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, text
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class UploadRecord(Base):
    __tablename__ = "upload_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)  # 关联 users.id
    original_name = Column(String(255), nullable=False)
    saved_name = Column(String(255), nullable=False)
    size = Column(Integer, nullable=False)
    customer_name = Column(String(255), nullable=False)
    remark = Column(Text, default="")
    text_length = Column(Integer, default=0)
    status = Column(String(32), default="success")
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_user_by_username(username):
    db = SessionLocal()
    try:
        return db.query(User).filter(User.username == username).first()
    finally:
        db.close()


def create_user(username, password_hash):
    db = SessionLocal()
    try:
        user = User(username=username, password_hash=password_hash)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    # 兼容旧表：为 upload_records 补上 user_id 列
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE upload_records ADD COLUMN IF NOT EXISTS user_id INTEGER"))
    except Exception:
        # SQLite 等不支持 IF NOT EXISTS 的库，失败则忽略（新表已含该列）
        pass


def save_upload_record(user_id, original_name, saved_name, size, customer_name, remark, text_length, status="processing"):
    db = SessionLocal()
    try:
        record = UploadRecord(
            user_id=user_id,
            original_name=original_name,
            saved_name=saved_name,
            size=size,
            customer_name=customer_name,
            remark=remark,
            text_length=text_length,
            status=status,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record.id
    finally:
        db.close()


def update_upload_status(record_id, status, text_length=None):
    db = SessionLocal()
    try:
        record = db.query(UploadRecord).filter(UploadRecord.id == record_id).first()
        if record:
            record.status = status
            if text_length is not None:
                record.text_length = text_length
            db.commit()
    finally:
        db.close()


def _record_to_dict(r):
    return {
        "id": r.id,
        "userId": r.user_id,
        "originalName": r.original_name,
        "savedName": r.saved_name,
        "size": r.size,
        "customerName": r.customer_name,
        "remark": r.remark,
        "textLength": r.text_length,
        "status": r.status,
        "createdAt": r.created_at.isoformat(),
    }


def get_records_by_user(user_id, limit=50):
    """按账号取上传记录"""
    db = SessionLocal()
    try:
        rows = (
            db.query(UploadRecord)
            .filter(UploadRecord.user_id == user_id)
            .order_by(UploadRecord.created_at.desc())
            .limit(limit)
            .all()
        )
        return [_record_to_dict(r) for r in rows]
    finally:
        db.close()


def has_successful_upload(user_id):
    """该账号是否已有解析完成、可提问的文档"""
    db = SessionLocal()
    try:
        return (
            db.query(UploadRecord)
            .filter(UploadRecord.user_id == user_id, UploadRecord.status == "success")
            .count()
            > 0
        )
    finally:
        db.close()


def get_all_records(limit=50):
    db = SessionLocal()
    try:
        rows = db.query(UploadRecord).order_by(UploadRecord.created_at.desc()).limit(limit).all()
        return [_record_to_dict(r) for r in rows]
    finally:
        db.close()