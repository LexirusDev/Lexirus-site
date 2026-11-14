# Lexirus 诊断日志上传入口

## 当前状态

- 静态页面：`/diagnostics/`
- 后端：Supabase Edge Function + 私有 Storage Bucket
- 页面默认关闭上传，直到 `diagnostics/config.js` 配置真实 Edge Function URL。
- 不把 Supabase service-role key 或上传口令写入网站静态文件。
- 当前代码只接受 Lexirus / JetsamEvent 的 iOS `.ips` 文件，单文件上限 5 MB。
- Storage bucket 为 private；页面不会生成公开下载链接。
- 诊断文件仅用于排查问题；上线前需确认 Supabase 项目实际区域，并据此完善隐私政策。
- 当前保留策略为人工检查并在上传后 30 天内删除；若后续需要自动清理，再增加定时清理任务。

## 部署步骤

1. 创建 Supabase 项目。建议选择离主要用户较近、且满足数据合规要求的区域；创建后把实际区域记录在隐私政策中。
2. 在 Supabase SQL Editor 执行 `supabase/migrations/202611140001_diagnostic_uploads.sql`。
3. 安装 Supabase CLI 并登录，在仓库根目录执行：
   ```sh
   supabase link --project-ref <PROJECT_REF>
   supabase secrets set DIAGNOSTIC_UPLOAD_CODE='<生成的高强度随机口令>'
   supabase functions deploy diagnostic-upload
   ```
   上传口令建议用密码管理器生成至少 24 字节随机值，只私下发给需要上传日志的用户；测试结束后立即轮换。
4. 将 `diagnostics/config.js` 的 `endpoint` 设置为：
   `https://<PROJECT_REF>.supabase.co/functions/v1/diagnostic-upload`
5. 确认 Supabase Edge Function 环境变量包含平台提供的 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。不要把 service-role key 放到浏览器代码。
6. 在真实 iPhone Safari 上测试：错误口令、非 IPS 文件、超 5 MB 文件、Lexirus 报告、JetsamEvent 报告、网络中断。
7. 检查 Supabase Storage 中的 `diagnostic-logs` bucket 为 private，并从非登录浏览器确认对象不可公开读取。
8. 更新隐私政策中的实际存储区域和保留说明后，再合并到 main，让 GitHub Pages 发布。

## 查看和删除报告

- 在 Supabase Dashboard → Storage → `diagnostic-logs` 查看并下载原始报告。
- 在 Table Editor → `diagnostic_uploads` 查看上传时间、原始文件名、大小、系统版本、App 版本和用户补充说明。
- 处理完问题后删除对应 Storage 对象及表记录；无论是否已分析，都应在上传后 30 天内删除。
- 不要把上传的原始 `.ips` 文件提交到 Git 仓库、公开工单或公开链接。

## 安全约束

- 只允许 `https://lexirus.cn` 与 `https://www.lexirus.cn` 来源请求。
- 需要服务端校验上传口令；口令只保存在 Supabase Edge Function Secret。
- 只接受符合文件名和首行 JSON 标识的 Lexirus / JetsamEvent 报告。
- 文件上限 5 MB；文件名在服务端净化；对象随机命名并存入私有 bucket。
- 数据库 RLS 开启，anon / authenticated 无表权限；Storage 不添加公开读策略。
- 上传报告可能含设备型号、系统/App 版本、诊断标识符、崩溃堆栈和进程名。不要向用户承诺日志绝对不含任何个人或设备信息。
