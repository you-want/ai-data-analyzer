'use server'

export async function uploadDataAction(formData: FormData) {
  // 这个函数运行在 Node.js 环境，可以直接调用后端微服务
  try {
    const res = await fetch('http://localhost:3001/data/upload/csv', {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      throw new Error(`后端响应异常: ${res.status}`);
    }
    
    return await res.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return { success: false, error: errorMessage };
  }
}
