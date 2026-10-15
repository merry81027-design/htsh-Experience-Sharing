export default async function handler(request, response) {
  // 不讓瀏覽器、代理伺服器或 CDN 快取舊的資料回應
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");

  if (request.method !== "GET") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  // Supabase Auth 的 /auth/v1/user 使用 Publishable Key 搭配使用者的 Access Token。
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const experienceApiUrl = process.env.EXPERIENCE_API_URL || "";

  if (!supabaseUrl || !publishableKey || !experienceApiUrl) {
    console.error("Missing required environment variable: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, or EXPERIENCE_API_URL");
    return response.status(500).json({
      error: "網站伺服器設定不完整，請通知網站管理者檢查環境變數"
    });
  }

  const authHeader = request.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return response.status(401).json({ error: "尚未登入，請重新登入後再更新資料" });
  }

  const accessToken = authHeader.slice(7);

  try {
    // 由 Supabase Auth 驗證目前登入者的 Access Token
    const supabaseResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      cache: "no-store",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!supabaseResponse.ok) {
      const details = await supabaseResponse.text().catch(() => "");
      console.error("Supabase token validation failed:", supabaseResponse.status, details.slice(0, 300));
      return response.status(401).json({
        error: "登入驗證失敗，請重新整理網站並重新登入"
      });
    }

    const user = await supabaseResponse.json();
    const email = (user.email || "").toLowerCase();

    if (!email.endsWith("@htsh.ntpc.edu.tw")) {
      return response.status(403).json({ error: "僅限新店高中校內帳號使用" });
    }

    // 加上時間戳並停用快取，要求 Apps Script 重新讀取試算表資料
    let upstreamUrl;
    try {
      upstreamUrl = new URL(experienceApiUrl);
    } catch (error) {
      console.error("EXPERIENCE_API_URL is not a valid URL");
      return response.status(500).json({ error: "Apps Script 資料來源網址設定錯誤" });
    }
    upstreamUrl.searchParams.set("_refresh", String(Date.now()));

    const dataResponse = await fetch(upstreamUrl.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    });

    if (!dataResponse.ok) {
      console.error("Apps Script response status:", dataResponse.status);
      return response.status(502).json({ error: "Apps Script 資料來源回應失敗，請檢查部署網址與權限" });
    }

    let data;
    try {
      data = await dataResponse.json();
    } catch (error) {
      const responseType = dataResponse.headers.get("content-type") || "unknown";
      console.error("Apps Script did not return valid JSON. Content-Type:", responseType);
      return response.status(502).json({ error: "Apps Script 沒有回傳有效的 JSON 資料" });
    }

    if (!Array.isArray(data) && (!data || !Array.isArray(data.data))) {
      console.error("Unexpected Apps Script response format");
      return response.status(502).json({ error: "Apps Script 回傳格式不符，請檢查資料來源程式" });
    }

    return response.status(200).json(data);
  } catch (error) {
    console.error("Experiences API error:", error);
    return response.status(500).json({ error: "伺服器讀取資料時發生錯誤，請稍後再試" });
  }
}
