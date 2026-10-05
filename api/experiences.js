export default async function handler(request, response) {
  // 只允許 GET
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    // =========================
    // 1. 取得瀏覽器送來的 Supabase Access Token
    // =========================

    const authHeader = request.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return response.status(401).json({
        error: "未登入"
      });
    }

    const accessToken = authHeader.slice(7);

    // =========================
    // 2. 向 Supabase 驗證這個 Token
    // =========================

    const supabaseUserResponse = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/user`,
      {
        method: "GET",
        headers: {
          apikey: process.env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!supabaseUserResponse.ok) {
      return response.status(401).json({
        error: "登入已失效，請重新登入"
      });
    }

    const user = await supabaseUserResponse.json();

    // =========================
    // 3. 檢查是否為本校帳號
    // =========================

    const email = (user.email || "").toLowerCase();

    if (!email.endsWith("@htsh.ntpc.edu.tw")) {
      return response.status(403).json({
        error: "僅限新店高中校內帳號使用"
      });
    }

    // =========================
    // 4. 通過驗證後，才去取得 Google Sheet 資料
    // =========================

    const dataResponse = await fetch(
      process.env.EXPERIENCE_API_URL,
      {
        method: "GET"
      }
    );

    if (!dataResponse.ok) {
      return response.status(502).json({
        error: "升學經驗資料暫時無法取得"
      });
    }

    const data = await dataResponse.json();

    // =========================
    // 5. 回傳資料給前端
    // =========================

    return response.status(200).json(data);

  } catch (error) {
    console.error("API Error:", error);

    return response.status(500).json({
      error: "伺服器發生錯誤"
    });
  }
}
