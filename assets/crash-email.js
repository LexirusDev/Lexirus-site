import {sanitizeCrash, MAX_SOURCE_BYTES} from './crash-core.js';
const $ = id => document.getElementById(id);
let report = null, revision = 0;
const status = message => { $('upload-status').textContent = message; };
$('crash-file').addEventListener('change', async e => {
  const mine = ++revision; report = null; $('report-preview').textContent = ''; $('download-button').disabled = true;
  const file = e.target.files[0]; if (!file) return status('尚未选择文件。');
  if (!/\.(ips|json|txt)$/i.test(file.name)) return status('请选择 .ips 日志，或保存为 .json / .txt 的同一份 JSON 日志。不支持截图、压缩包或个人资料备份。');
  if (!file.size || file.size > MAX_SOURCE_BYTES) return status('请选择非空且不超过 5 MB 的日志。');
  status('正在本机提取技术字段，原始文件不会上传……');
  try {
    const result = sanitizeCrash(await file.text()); if (mine !== revision) return;
    report = result; $('report-preview').textContent = JSON.stringify(report,null,2);
    $('preview-details').open = true; $('download-button').disabled = false;
    status('诊断文件已生成。请检查内容后下载，再在邮件中手动添加附件。文件尚未发送。');
  } catch (err) { if (mine === revision) status(err.message); }
});
$('download-button').addEventListener('click', () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'Lexirus-diagnostic.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
  status('已生成下载文件，请确认保存位置；然后点击「发邮件反馈」，在邮件中手动添加 Lexirus-diagnostic.json。文件尚未发送。');
});
