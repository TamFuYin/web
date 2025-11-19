{ pkgs, ... }: {
  # 使用 Nixpkgs 的稳定版频道
  channel = "stable-24.05"; # 或者 "stable-23.11"

  # 1. 系统级依赖包
  packages = [
    pkgs.nodejs_20            # 推荐使用 Node.js LTS 版本
    pkgs.nodePackages.pnpm    # 可选：如果你习惯用 pnpm，否则可以用 npm 或 yarn
    # pkgs.yarn               # 如果你偏好 yarn，可以取消注释这一行
  ];

  # 2. 环境变量配置
  env = {
    JS_RUNTIME = "node";
    # 强制 Next.js 使用端口 3000 (防止冲突)
    PORT = "3000";
  };

  # 3. IDX 特定工具配置
  idx = {
    # 自动安装的 VS Code 扩展
    extensions = [
      # React/Next.js 必备
      "dbaeumer.vscode-eslint"      # 代码规范检查
      "esbenp.prettier-vscode"      # 代码格式化
      "dsznajder.es7-react-js-snippets" # React 代码片段
      
      # Three.js 相关 (可选)
      "slevesque.shader"            # 如果你需要写 GLSL 着色器，这个很有用
      
      # 样式 (如果使用 Tailwind)
      "bradlc.vscode-tailwindcss"
    ];

    # 4. 预览窗口配置
    previews = {
      enable = true;
      previews = {
        web = {
          # 启动命令：对应 package.json 中的 scripts
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
          env = {
            # 再次确保端口匹配
            PORT = "$PORT";
          };
        };
      };
    };

    # 工作区生命周期钩子
    workspace = {
      # 创建环境时运行 (首次)
      onCreate = {
        npm-install = "npm install";
        # 如果是全新项目，可以在这里自动安装 Three.js
        # install-three = "npm install three @types/three @react-three/fiber @react-three/drei";
      };
      # 每次启动环境时运行
      onStart = {
        # 可以在这里运行一些通过检查
        # watch-build = "npm run watch"; 
      };
    };
  };
}