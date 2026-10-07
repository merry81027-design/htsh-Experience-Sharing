export default async function handler(request, response) {
  // =========================
  // 1. 只允許 GET
  // =========================

  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    // =========================
    // 2. 取得登入者的 Access Token
    // =========================

    const authHeader = request.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return response.status(401).json({
        error: "未登入"
      });
    }

    const accessToken = authHeader.slice(7);

    // =========================
    // 3. 請 Supabase 驗證 Access Token
    // =========================

    const supabaseResponse = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/user`,
      {
        method: "GET",
        headers: {
          // 這裡使用你的 Vercel 環境變數
          apikey: process.env.SUPABASE_SECRET_KEY,

          // 使用學生登入後取得的 token
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!supabaseResponse.ok) {
      return response.status(401).json({
        error: "登入已失效，請重新登入"
      });
    }

    const user = await supabaseResponse.json();

    // =========================
    // 4. 確認是本校帳號
    // =========================

    const email = (user.email || "").toLowerCase();

    if (!email.endsWith("@htsh.ntpc.edu.tw")) {
      return response.status(403).json({
        error: "僅限新店高中校內帳號使用"
      });
    }

    // =========================
    // 5. 驗證通過
    //    才向 Google Apps Script 要資料
    // =========================

    const dataResponse = await fetch(
      process.env.EXPERIENCE_API_URL
    );

    if (!dataResponse.ok) {
      return response.status(502).json({
        error: "升學經驗資料暫時無法取得"
      });
    }

    const data = await dataResponse.json();

    // =========================
    // 6. 回傳資料
    // =========================

    return response.status(200).json(data);

  } catch (error) {
    console.error("API Error:", error);

    return response.status(500).json({
      error: "伺服器發生錯誤"
    });
  }
}
