// Public configuration only. The upload code and Supabase service-role key
// must never be placed in this file.
window.LEXIRUS_DIAGNOSTICS = {
  // Set this after deploying the Supabase Edge Function:
  // https://<project-ref>.supabase.co/functions/v1/diagnostic-upload
  endpoint: "",
  maxFileSizeBytes: 5 * 1024 * 1024
};
