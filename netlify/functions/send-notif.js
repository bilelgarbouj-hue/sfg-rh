/* ════════════════════════════════════════════════════════
   netlify/functions/send-notif.js
   STE FRÈRES GARBOUJ — Push Notifications via FCM V1 API
   Aucune carte bancaire requise — Netlify Free tier
════════════════════════════════════════════════════════ */

const https = require("https");
const crypto = require("crypto");

const PROJECT_ID = "garbouj-app";
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

/* ── Générer un JWT signé avec la clé privée du service account ── */
function base64url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function getAccessToken() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign
    .sign(serviceAccount.private_key)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const jwt = `${header}.${payload}.${signature}`;

  // Échanger le JWT contre un access token Google
  return new Promise((resolve, reject) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) resolve(json.access_token);
            else reject(new Error("No access_token: " + data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/* ── Envoyer la notification FCM ── */
async function sendFCM(token, title, body, data = {}) {
  const accessToken = await getAccessToken();

  const message = {
    message: {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      webpush: {
        notification: {
          title,
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
        fcm_options: { link: "/" },
      },
      android: {
        priority: "high",
        notification: { sound: "default", priority: "high" },
      },
    },
  };

  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(message);
    const req = https.request(
      {
        hostname: "fcm.googleapis.com",
        path: `/v1/projects/${PROJECT_ID}/messages:send`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          if (res.statusCode === 200) resolve(JSON.parse(data));
          else reject(new Error(`FCM ${res.statusCode}: ${data}`));
        });
      }
    );
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

/* ── Handler principal de la Netlify Function ── */
exports.handler = async (event) => {
  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: '{"error":"Method not allowed"}' };
  }

  try {
    const { token, title, body, data } = JSON.parse(event.body || "{}");

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "token manquant" }),
      };
    }
    if (!title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "title manquant" }),
      };
    }

    const result = await sendFCM(token, title, body || "", data || {});
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (e) {
    console.error("send-notif error:", e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
