import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "diagnostic-logs";
const ALLOWED_ORIGINS = new Set([
  "https://lexirus.cn",
  "https://www.lexirus.cn",
]);

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

function json(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "diagnostic.ips";
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";

  if (request.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response("Forbidden", { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BYTES + 64 * 1024) {
    return json({ error: "File is larger than 5 MB." }, 413, origin);
  }

  try {
    const form = await request.formData();
    const code = String(form.get("code") ?? "");
    const expectedCode = Deno.env.get("DIAGNOSTIC_UPLOAD_CODE") ?? "";
    if (!constantTimeEqual(code, expectedCode)) {
      return json({ error: "Upload code is incorrect." }, 401, origin);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "No diagnostic file was provided." }, 400, origin);
    if (file.size < 1 || file.size > MAX_BYTES) {
      return json({ error: "File is empty or larger than 5 MB." }, 413, origin);
    }
    if (!/\.ips$/i.test(file.name)) {
      return json({ error: "Only .ips diagnostic reports are accepted." }, 415, origin);
    }

    const safeName = safeFilename(file.name);
    const firstLine = (await file.slice(0, 8192).text()).split(/\r?\n/, 1)[0];
    let header: Record<string, unknown>;
    try {
      header = JSON.parse(firstLine);
    } catch {
      return json({ error: "The file does not look like an iOS diagnostic report." }, 422, origin);
    }

    const isLexirus = /^Lexirus[._-]/i.test(file.name) &&
      (header.app_name === "Lexirus" || header.name === "Lexirus");
    const isJetsam = /^JetsamEvent[._-]/i.test(file.name) && String(header.bug_type) === "298";
    if (!isLexirus && !isJetsam) {
      return json({ error: "Please select a Lexirus or JetsamEvent .ips report." }, 422, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey || !expectedCode) {
      return json({ error: "Upload service is not configured." }, 503, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const uploadedAt = new Date();
    const dateFolder = uploadedAt.toISOString().slice(0, 10);
    const objectPath = `${dateFolder}/${crypto.randomUUID()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, bytes, {
        contentType: "application/json",
        cacheControl: "0",
        upsert: false,
      });

    if (storageError) {
      console.error("diagnostic storage upload failed:", storageError.message);
      return json({ error: "Could not store the report. Please try again later." }, 500, origin);
    }

    const note = String(form.get("note") ?? "").trim().slice(0, 500);
    const { data, error: insertError } = await supabase
      .from("diagnostic_uploads")
      .insert({
        object_path: objectPath,
        original_filename: safeName,
        file_size_bytes: file.size,
        uploaded_at: uploadedAt.toISOString(),
        app_version: typeof header.app_version === "string" ? header.app_version.slice(0, 40) : null,
        build_version: typeof header.build_version === "string" ? header.build_version.slice(0, 40) : null,
        os_version: typeof header.os_version === "string" ? header.os_version.slice(0, 80) : null,
        bug_type: typeof header.bug_type === "string" ? header.bug_type.slice(0, 40) : null,
        note: note || null,
      })
      .select("id")
      .single();

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([objectPath]);
      console.error("diagnostic metadata insert failed:", insertError.message);
      return json({ error: "The report could not be registered. Please try again later." }, 500, origin);
    }

    return json({ ok: true, uploadId: data.id }, 201, origin);
  } catch (error) {
    console.error("diagnostic upload request failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Upload failed. Please try again later." }, 500, origin);
  }
});
