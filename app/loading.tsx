import React from 'react';

// Next.js App Router 默认组件都是 Server Component (服务器组件)
// 因此这个文件不需要 'use client' 指令。

export default function Loading() {
  return (
    // min-h-screen 确保加载界面占据整个视口
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800">
      <div className="flex flex-col items-center p-8 bg-white shadow-xl rounded-xl">
        {/* 加载指示器：简单的旋转动画 */}
        <div className="w-12 h-12 border-4 border-t-4 border-blue-500 border-opacity-20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        
        {/* 提示文本 */}
        <p className="text-lg font-semibold text-gray-700">
          少女折寿中
        </p>
        <p className="text-sm text-gray-500 mt-1">
          请稍候，应用数据初始化中。
        </p>
      </div>
    </div>
  );
}