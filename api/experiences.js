export default function handler(request, response) {
  return response.status(200).json({
    ok: true,
    message: "Vercel API works!"
  });
}
