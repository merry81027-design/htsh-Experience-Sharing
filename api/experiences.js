export default async function handler(request, response) {
  // 網頁資料每次都應向來源重新取得，避免學生看到過期的表單回應
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");

  if (request.method !== "GET") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const authHeader = request.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return response.status(401).json({ error: "未登入" });
    }

    const accessToken = authHeader.slice(7);
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const experienceApiUrl = process.env.EXPERIENCE_API_URL;

    if (!supabaseUrl || !supabaseKey || !experienceApiUrl) {
      console.error("Missing required environment variable for experiences API");
      return response.status(500).json({ error: "伺服器設定不完整，請聯絡網站管理者" });
    }

    // 由 Supabase 驗證登入 token
    const supabaseResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      cache: "no-store",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!supabaseResponse.ok) {
      return response.status(401).json({ error: "登入已失效，請重新登入" });
    }

    const user = await supabaseResponse.json();
    const email = (user.email || "").toLowerCase();

    if (!email.endsWith("@htsh.ntpc.edu.tw")) {
      return response.status(403).json({ error: "僅限新店高中校內帳號使用" });
    }

    // 加上時間戳並停用快取，要求 Apps Script 重新讀取試算表資料
    const upstreamUrl = new URL(experienceApiUrl);
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
      return response.status(502).json({ error: "升學經驗資料暫時無法取得" });
    }

    const data = await dataResponse.json();
    return response.status(200).json(data);
  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: "伺服器發生錯誤" });
  }
}
