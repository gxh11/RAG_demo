import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const customerName = formData.get('customerName') as string;
    const remark = formData.get('remark') as string;

    if (!file) {
      return NextResponse.json({ error: '未检测到提交的文件' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: '文件格式不符，仅支持接收 PDF 文件' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log(`[接收成功] 来自客户 [${customerName || '未命名'}] 的 PDF 文件：`, {
      filename: file.name,
      fileSize: buffer.length,
      remark: remark || '无备注',
    });

    return NextResponse.json({ success: true, message: 'PDF 接收并归档成功' });
  } catch (error) {
    return NextResponse.json({ error: '服务端接收处理失败' }, { status: 500 });
  }
}