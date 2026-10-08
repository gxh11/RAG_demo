import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
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
    original_name = Column(String(255), nullable=False)
    saved_name = Column(String(255), nullable=False)
    size = Column(Integer, nullable=False)
    customer_name = Column(String(255), nullable=False)
    remark = Column(Text, default="")
    text_length = Column(Integer, default=0)
    status = Column(String(32), default="success")
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def save_upload_record(original_name, saved_name, size, customer_name, remark, text_length, status="success"):
    db = SessionLocal()
    try:
        record = UploadRecord(
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


def get_all_records(limit=50):
    db = SessionLocal()
    try:
        rows = db.query(UploadRecord).order_by(UploadRecord.created_at.desc()).limit(limit).all()
        return [
            {
                "id": r.id,
                "originalName": r.original_name,
                "savedName": r.saved_name,
                "size": r.size,
                "customerName": r.customer_name,
                "remark": r.remark,
                "textLength": r.text_length,
                "status": r.status,
                "createdAt": r.created_at.isoformat(),
            }
            for r in rows
        ]
    finally:
        db.close()