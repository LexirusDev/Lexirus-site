// Shared by the browser and upload service. Never forward arbitrary source strings.
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const numeric = v => Number.isSafeInteger(v) && v >= 0;
const match = (value, re) => typeof value === 'string' && re.test(value) ? value : null;
const version = v => match(v, /^\d{1,4}(?:\.\d{1,4}){0,3}$/);
const uuid = v => match(v, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const exceptions = ['EXC_BAD_ACCESS','EXC_BAD_INSTRUCTION','EXC_ARITHMETIC','EXC_EMULATION','EXC_SOFTWARE','EXC_BREAKPOINT','EXC_CRASH','EXC_RESOURCE','EXC_GUARD','EXC_CORPSE_NOTIFY'];
export function sanitizeCrash(text) {
  let body, header = {};
  const source = text.trim().replace(/^\uFEFF/, '');
  try { body = JSON.parse(source); }
  catch {
    const newline = source.indexOf('\n');
    if (newline < 0) throw new Error('无法识别日志，请选择 Lexirus 的 .ips 文件。');
    try { header = JSON.parse(source.slice(0, newline)); body = JSON.parse(source.slice(newline + 1)); if (!header || typeof header !== 'object' || Array.isArray(header)) throw Error(); }
    catch { throw new Error('文件格式无法识别，请重新导出 Lexirus 的 .ips 日志。'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      ![body.procName, header.app_name, body.app_name, body.name].some(v => v === 'Lexirus')) {
    throw new Error('这不是可识别的 Lexirus 崩溃日志，请选择文件名以 Lexirus 开头的 .ips 文件。');
  }
  const threads = Array.isArray(body.threads) ? body.threads : [];
  const sourceImages = Array.isArray(body.usedImages) ? body.usedImages : [];
  const frames = [];
  for (const [index, thread] of threads.entries()) {
    if (!thread || (index !== body.faultingThread && thread.triggered !== true)) continue;
    for (const f of (Array.isArray(thread.frames) ? thread.frames : []).slice(0, 200)) {
      if (f && numeric(f.imageIndex) && f.imageIndex < sourceImages.length && numeric(f.imageOffset)) {
        frames.push({image: f.imageIndex, offset: f.imageOffset});
      }
    }
    break;
  }
  const images = sourceImages.slice(0, 1024).map((im, index) => ({
    index, uuid: uuid(im?.uuid),
    arch: ['arm64','arm64e','armv7','armv7s','x86_64','x86_64h'].includes(im?.arch) ? im.arch : null,
    base: numeric(im?.base) ? im.base : null, size: numeric(im?.size) ? im.size : null
  }));
  const report = {
    schema: 1, app: 'Lexirus',
    version: version(body.bundleInfo?.CFBundleShortVersionString ?? header.app_version),
    build: version(body.bundleInfo?.CFBundleVersion ?? header.build_version),
    os: match(body.osVersion?.train ?? header.os_version, /^(?:iPhone OS|iOS|iPadOS|Mac OS X|macOS) \d{1,3}(?:\.\d{1,3}){0,2}(?: \([A-Z0-9]{3,12}\))?$/),
    exception: exceptions.includes(body.exception?.type) ? body.exception.type : null,
    frames: frames.filter(f => f.image < images.length), images
  };
  if (!report.exception || !report.frames.length) throw new Error('这份日志缺少可用的异常类型或崩溃线程，未生成诊断记录。请通过邮件联系开发者确认。');
  return report;
}
export function validateReport(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  const keys = ['schema','app','version','build','os','exception','frames','images'];
  const exact = (o, ks) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === ks.length && ks.every(k => Object.hasOwn(o,k));
  return exact(r, keys) && r.schema === 1 && r.app === 'Lexirus' &&
    [r.version,r.build].every(v => v === null || version(v) !== null) &&
    (r.os === null || match(r.os,/^(?:iPhone OS|iOS|iPadOS|Mac OS X|macOS) \d{1,3}(?:\.\d{1,3}){0,2}(?: \([A-Z0-9]{3,12}\))?$/) !== null) &&
    exceptions.includes(r.exception) && Array.isArray(r.images) && r.images.length <= 1024 &&
    r.images.every((i,n) => exact(i,['index','uuid','arch','base','size']) && i.index === n &&
      (i.uuid === null || uuid(i.uuid) !== null) && (i.arch === null || ['arm64','arm64e','armv7','armv7s','x86_64','x86_64h'].includes(i.arch)) &&
      [i.base,i.size].every(v => v === null || numeric(v))) &&
    Array.isArray(r.frames) && r.frames.length > 0 && r.frames.length <= 200 &&
    r.frames.every(f => exact(f,['image','offset']) && numeric(f.image) && f.image < r.images.length && numeric(f.offset));
}
