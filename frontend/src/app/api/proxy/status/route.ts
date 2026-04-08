import { NextResponse } from 'next/server';

// 开启 Edge Runtime (边缘函数)
export const runtime = 'edge';

/**
 * 这是一个部署在边缘节点的轻量级代理/健康检查接口
 * 相比于传统 Node.js Serverless Function，Edge Function 启动时间几乎为零，
 * 非常适合做请求的鉴权、路由重定向、或者高频的基础 API 转发。
 */
export async function GET() {
  try {
    // 请求实际的 Nest.js 后端
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    
    // 使用 fetch 获取状态，因为部署在边缘节点，这里可以做简单的 CDN 缓存控制
    const res = await fetch(`${backendUrl}/analysis/status`, {
      next: { revalidate: 10 }, // 开启 Next.js 的增量静态再生成 (ISR)，缓存 10 秒
    });

    if (res.ok) {
      const text = await res.text();
      return NextResponse.json({
        success: true,
        message: text,
        source: 'edge-function'
      }, {
        headers: {
          'Cache-Control': 's-maxage=10, stale-while-revalidate=59',
        }
      });
    }

    return NextResponse.json({
      success: false,
      message: '后端响应异常'
    }, { status: 502 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: '无法连接到后端服务器'
    }, { status: 503 });
  }
}
