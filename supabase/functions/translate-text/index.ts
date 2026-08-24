// Supabase Edge Function: translate-text
// Deploy with: supabase functions deploy translate-text --no-verify-jwt
//
// What it does:
// 1. Accepts { text, source_lang, target_lang }
// 2. Translates text server-side using public translation endpoints with cascading fallbacks
// 3. Returns { translated_text, source_lang, target_lang } with full CORS headers

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TranslateRequest {
  text: string;
  source_lang: string;
  target_lang: string;
}

async function translateWithMyMemory(
  text: string,
  source: string,
  target: string,
): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`MyMemory HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json?.responseData?.translatedText) {
    // MyMemory returns HTML entities sometimes, clean them up
    return decodeHtmlEntities(json.responseData.translatedText);
  }
  throw new Error("No translated text in MyMemory response");
}

async function translateWithGoogleGtx(
  text: string,
  source: string,
  target: string,
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`GoogleGTX HTTP ${response.status}`);
  }

  const json = await response.json();
  if (Array.isArray(json) && Array.isArray(json[0])) {
    const combined = json[0]
      .map((item: unknown[]) => (Array.isArray(item) && typeof item[0] === "string" ? item[0] : ""))
      .join("");
    if (combined) return combined;
  }
  throw new Error("No translated text in GoogleGTX response");
}

async function translateWithLibre(text: string, source: string, target: string): Promise<string> {
  const endpoints = [
    "https://translate.argosopentech.com/translate",
    "https://libretranslate.de/translate",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source: source,
          target: target,
          format: "text",
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const json = await response.json();
        if (json?.translatedText) {
          return json.translatedText;
        }
      }
    } catch {
      // Continue to next endpoint or fallback
    }
  }

  throw new Error("LibreTranslate endpoints unavailable");
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: TranslateRequest = await req.json();
    const { text, source_lang = "en", target_lang = "ta" } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Text parameter is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedText = text.trim();
    const src = source_lang.toLowerCase().split("-")[0]; // normalize "en-US" to "en"
    const tgt = target_lang.toLowerCase().split("-")[0];

    // If source and target are the same language, return original
    if (src === tgt) {
      return new Response(
        JSON.stringify({
          translated_text: trimmedText,
          source_lang: src,
          target_lang: tgt,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let translatedText = "";
    const errors: string[] = [];

    // 1. Try LibreTranslate first
    try {
      translatedText = await translateWithLibre(trimmedText, src, tgt);
    } catch (err) {
      errors.push(`Libre: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Try MyMemory Translation API as fallback
    if (!translatedText) {
      try {
        translatedText = await translateWithMyMemory(trimmedText, src, tgt);
      } catch (err) {
        errors.push(`MyMemory: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Try Google GTX free endpoint as fallback 2
    if (!translatedText) {
      try {
        translatedText = await translateWithGoogleGtx(trimmedText, src, tgt);
      } catch (err) {
        errors.push(`GoogleGTX: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!translatedText) {
      throw new Error(`All translation backends failed: ${errors.join("; ")}`);
    }

    return new Response(
      JSON.stringify({
        translated_text: translatedText,
        source_lang: src,
        target_lang: tgt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown translation error";
    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
