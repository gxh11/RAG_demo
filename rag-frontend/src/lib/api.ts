// 后端 API 基地址
// - 本地开发默认 http://127.0.0.1:8000
// - 部署构建时设 NEXT_PUBLIC_API_BASE=（空值），走同域 /api 由 Nginx 反代到后端
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE !== undefined
    ? process.env.NEXT_PUBLIC_API_BASE
    : 'http://127.0.0.1:8000';
