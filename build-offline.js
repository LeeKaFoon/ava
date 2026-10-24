/* 一次性构建脚本：生成自包含的 index-offline.html（内嵌 Tailwind + 字体 + 题库 + 逻辑） */
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const tailwind = fs.readFileSync('vendor/tailwind.js', 'utf8');
const inter = fs.readFileSync('vendor/fonts/inter-latin.woff2').toString('base64');
const lexend = fs.readFileSync('vendor/fonts/lexend-latin.woff2').toString('base64');
const dataJs = fs.readFileSync('data.js', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');

const fontCss = `<style>
/* 内嵌本地字体（base64，离线可用；仅 latin 子集，中文回退系统字体） */
@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${inter}) format('woff2');}
@font-face{font-family:'Lexend';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${lexend}) format('woff2');}
</style>`;

// 自检脚本：加载失败时在页面上直接显示原因（用内联样式写，确保样式引擎挂了也能显示）
const selfCheck = `
<script>
/* 离线版自检（build ${new Date().toISOString().slice(0, 10)}） */
(function () {
    window.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
            var problems = [];
            var probe = document.createElement('div');
            probe.className = 'hidden';
            document.body.appendChild(probe);
            if (getComputedStyle(probe).display !== 'none') {
                problems.push('样式引擎未生效（内嵌的 Tailwind 代码没有运行）');
            }
            probe.remove();
            if (typeof rawData === 'undefined' || typeof mockData === 'undefined') {
                problems.push('题库未加载（data.js 缺失或没和本文件放在同一文件夹）');
            }
            if (document.querySelectorAll('.filter-btn').length === 0) {
                problems.push('应用逻辑未生效（内嵌的 app.js 代码没有运行）');
            }
            if (problems.length === 0) return;
            var bar = document.createElement('div');
            bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#b91c1c;color:#fff;padding:12px 16px;border-radius:12px;font:14px/1.7 sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3)';
            bar.innerHTML = '<strong>离线版自检未通过：</strong>' + problems.join('；') +
                '<br>本版本为完全自包含的单文件，出现此提示说明文件在传输中被截断或损坏。请重新获取完整的 index-offline.html（约 570 KB，标题带"离线版"）；若仍异常，按 F12 打开控制台截图反馈。';
            document.body.appendChild(bar);
        }, 300);
    });
})();
</script>
`;

let out = html
    .replace('<title>广东高考英语听说·三问训练 v2</title>', '<title>广东高考英语听说·三问训练 v2（离线版）</title>')
    .replace(/<!-- 在线版[^>]*>\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/,
        // 注意：必须用函数形式，避免 tailwind 代码中的 $&/$' 等被当作替换模式展开
        () => '    <!-- 离线版：Tailwind 引擎与字体已全部内嵌本文件，单文件即可离线使用，无需 vendor/ 目录 -->\n    <script>/* Tailwind Play CDN runtime (inlined) */\n' + tailwind + '\n</script>\n    ' + fontCss)
    .replace(/<script src="data\.js"><\/script>\s*<script src="app\.js"><\/script>/,
        () => '<script>/* data.js (inlined) */\n' + dataJs + '\n</script>\n    <script>/* app.js (inlined) */\n' + appJs + '\n</script>')
    .replace(/<\/body>/, () => selfCheck + '</body>');

// 校验：内嵌脚本之前的头部区域不得再有外链（运行时代码内部的字符串不算）
const beforeScript = out.slice(0, out.indexOf('Tailwind Play CDN runtime (inlined)'));
if (!out.includes('data:font/woff2;base64') || /src="https?:|href="https?:/.test(beforeScript)) {
    console.error('ERROR: replacement failed or external refs still present in head');
    process.exit(1);
}

// 产物固定输出到 check/（打包分发目录），保证目录存在
fs.mkdirSync('check', { recursive: true });
const outPath = 'check/index-offline.html';
fs.writeFileSync(outPath, out);
console.log('OK ->', outPath, '(' + (fs.statSync(outPath).size / 1024).toFixed(1) + ' KB)');
