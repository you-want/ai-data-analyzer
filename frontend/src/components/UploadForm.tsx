"use client";

import { useState } from 'react';
import { uploadDataAction } from '@/app/actions/upload';

interface UploadResponse {
  message?: string;
  rowCount?: number;
  preview?: Record<string, string>[];
  agentResult?: string;
  error?: string;
  success?: boolean;
}

export default function UploadForm() {
  const [message, setMessage] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  async function clientAction(formData: FormData) {
    setMessage('上传中...');
    setUploadResult(null);
    
    const result = await uploadDataAction(formData) as UploadResponse;
    
    if (result?.error || result?.success === false) {
      setMessage(`上传失败: ${result.error || '未知错误'}`);
    } else {
      setMessage('上传成功！');
      setUploadResult(result);
    }
  }

  return (
    <div className="flex flex-col gap-4 mt-6 max-w-xl">
      <form action={clientAction} className="flex flex-col gap-4">
        <div className="border border-dashed border-gray-300 dark:border-zinc-700 p-4 rounded-md">
          <input 
            type="file" 
            name="file" 
            className="w-full text-black dark:text-zinc-100"
            accept=".csv,.json"
          />
        </div>
        <button 
          type="submit"
          className="bg-black dark:bg-white text-white dark:text-black font-semibold px-6 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
        >
          上传数据 (Server Action)
        </button>
        {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
      </form>

      {/* 展示解析结果预览 */}
      {uploadResult && uploadResult.preview && (
        <div className="mt-2 p-4 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-md">
          <h3 className="font-bold mb-2 text-sm text-gray-800 dark:text-gray-200">文件解析结果：</h3>
          <p className="text-sm mb-2 text-gray-600 dark:text-gray-400">成功读取数据行数: <span className="font-bold text-black dark:text-white">{uploadResult.rowCount}</span> 行</p>
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">数据预览 (前3行):</p>
            <pre className="text-xs overflow-x-auto bg-gray-100 dark:bg-zinc-900 p-3 rounded border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-300">
              {JSON.stringify(uploadResult.preview, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
