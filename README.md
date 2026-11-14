# Lexirus 官网

基于 Kami 模板的静态官网，包含产品介绍、正式图标、技术支持、隐私政策、用户反馈案例与崩溃诊断文件生成工具。

诊断日志只在浏览器本机处理，用户预览下载后，在邮件应用手动添加附件发送至 xzwdev@163.com。网站不提供在线上传接口。

源正文位于 templates/，共享生成器为 scripts/build-site.py。npm run build 生成四个页面，npm run check 检查生成漂移，npm test 检查诊断解析。
