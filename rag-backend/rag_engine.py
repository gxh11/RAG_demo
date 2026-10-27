from pypdf import PdfReader
import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import os
from dotenv import load_dotenv

load_dotenv()

print("正在加载本地 embedding 模型...")
embedding_model = SentenceTransformer("BAAI/bge-small-zh-v1.5")
print("模型加载完成！")

chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="pdf_embeddings")


def extract_text_from_pdf(file_path):
    text = ""
    try:
        reader = PdfReader(file_path)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as e:
        print(f"解析 PDF 失败: {e}")
    return text


def process_and_store_pdf(file_path):
    text = extract_text_from_pdf(file_path)
    if not text.strip():
        print("警告：PDF 解析结果为空")
        return

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
    )
    chunks = splitter.split_text(text)
    print(f"文本被切成了 {len(chunks)} 个块")

    embeddings = embedding_model.encode(chunks, normalize_embeddings=True)
    embeddings_list = embeddings.tolist()
    print(f"向量化完成，维度: {len(embeddings_list[0])}")

    ids = [f"chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"source": os.path.basename(file_path), "chunk_index": i} for i in range(len(chunks))]

    collection.add(
        embeddings=embeddings_list,
        documents=chunks,
        metadatas=metadatas,
        ids=ids,
    )
    print(f"✅ 成功将 {len(chunks)} 个文本块存入 ChromaDB！")
    # 在上面已有的导入基础上，顶部补充这一行：
from openai import OpenAI

# 初始化 OpenRouter 客户端
openrouter_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

def ask_question_stream(user_question: str):
    """RAG 问答核心逻辑（流式）：问题向量化 -> 检索 -> 大模型逐段生成回答"""

    # 1. 把用户问题变成向量（用本地模型，和存库时用的一模一样）
    query_embedding = embedding_model.encode(user_question, normalize_embeddings=True).tolist()

    # 2. 去 ChromaDB 里检索最相似的 3 个文本块
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3
    )

    # 取出检索到的文本块，拼成一整段背景信息
    documents = results['documents'][0]  # 这是一个列表
    context = "\n\n".join(documents)

    print(f"🔍 检索到 {len(documents)} 个相关块，总字数: {len(context)}")

    # 3. 拼装 Prompt
    prompt = f"""你是一个专业的文档助手。请根据下面提供的背景信息，准确回答用户的问题。
如果背景信息中没有相关内容，请诚实地说“文档中没有提到”，不要编造。

背景信息：
{context}

用户问题：{user_question}
"""

    # 4. 调用 OpenRouter 的 NVIDIA 模型（stream=True 开启流式输出）
    response = openrouter_client.chat.completions.create(
        model="nvidia/nemotron-3.5-lightning:free",  # 如果限流，可以换成 "meta-llama/llama-3.3-70b-instruct:free"
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        stream=True,
    )

    # 5. 逐段 yield 生成的文本，供接口做流式返回
    for chunk in response:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta