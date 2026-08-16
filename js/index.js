// functions/index.js
//
// Reçoit les webhooks envoyés par le script d'entrepôt du jeu (FiveM) et
// les enregistre dans Firestore, pour affichage en direct sur le site
// (page entrepots.html).
//
// La plupart des scripts FiveM qui ont un champ "webhook" envoient un
// format proche de celui de Discord : { content, embeds: [{ title,
// description, fields: [...] }] }. Comme on ne connaît pas le format exact
// avant d'avoir testé, cette fonction :
//   1) garde TOUJOURS le payload brut ("raw") pour ne jamais rien perdre,
//   2) essaie en plus d'en extraire un texte lisible et une action
//      (pris / posé) de façon "best effort".
// Une fois qu'on aura un vrai exemple reçu, on pourra affiner l'extraction
// précisément.

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.warehouseWebhook = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const body = req.body || {};

    // Construit un texte lisible à partir des formats les plus courants
    // (content brut, ou embeds façon Discord).
    let text = typeof body.content === "string" ? body.content : "";

    if (Array.isArray(body.embeds)) {
      body.embeds.forEach((e) => {
        if (e.title) text += " " + e.title;
        if (e.description) text += " " + e.description;
        if (Array.isArray(e.fields)) {
          text += " " + e.fields.map((f) => `${f.name}: ${f.value}`).join(" | ");
        }
      });
    }

    if (!text && typeof body === "object") {
      // Dernier recours : on transforme tout le JSON en texte.
      text = JSON.stringify(body);
    }

    const lower = text.toLowerCase();
    let action = null;
    if (/(pris|retir|prend|sorti)/.test(lower)) action = "pris";
    if (/(pos[ée]|d[ée]pos|ajout|rang)/.test(lower)) action = "pose";

    await db.collection("entrepots").add({
      raw: body,
      text: text.trim(),
      action,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send("OK");
  } catch (err) {
    console.error("Erreur webhookEntrepot :", err);
    res.status(500).send("Erreur serveur");
  }
});

// ============================================================================
// checkCooldowns
//
// Tourne automatiquement toutes les 5 minutes (Cloud Scheduler), sans avoir
// besoin que qui que ce soit ouvre le site. Regarde toutes les actions
// récentes qui ont un délai (ATM, Cambu, Supérette, Go fast), et dès que le
// délai est écoulé, envoie le message sur Discord (une seule fois par
// action, grâce au marqueur "discordNotified").
// ============================================================================

const COOLDOWN_HOURS = {
  "Go fast": 24,
  "ATM": 3,
  "Supérette": 3,
  "Cambu": 3,
  "Conteneurs": 2,
};

// Même URL de webhook que côté site.
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1530506907570274304/eKV0vr_Xox5mJNscu-fgdNUdFh8CMfzJQm-2HdnMTHBgj-2wCrRr6JZx6FoxuSMJmkgt";

exports.checkCooldowns = onSchedule("every 5 minutes", async () => {
  const now = Date.now();

  // On ne regarde que les actions des 2 derniers jours (largement suffisant
  // vu que le plus long délai est 24h), pour ne pas relire toute la base.
  const twoDaysAgo = admin.firestore.Timestamp.fromMillis(now - 2 * 24 * 3600 * 1000);
  const snap = await db.collection("actions").where("createdAt", ">=", twoDaysAgo).get();

  const userCache = {};

  for (const docSnap of snap.docs) {
    const a = docSnap.data();
    const cooldown = COOLDOWN_HOURS[a.item];
    if (!cooldown) continue;
    if (a.discordNotified) continue;

    const doneAt = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const availableAt = doneAt + cooldown * 3600 * 1000;
    if (now < availableAt) continue;

    // Détermine comment mentionner la personne (ping Discord si elle a
    // renseigné son ID, sinon juste son pseudo).
    let mention = a.username ? `**${a.username}**` : "quelqu'un";
    if (a.uid) {
      if (!(a.uid in userCache)) {
        const userDoc = await db.collection("users").doc(a.uid).get();
        userCache[a.uid] = userDoc.exists ? userDoc.data() : null;
      }
      const u = userCache[a.uid];
      if (u?.discordId) mention = `<@${u.discordId}>`;
      else if (u?.username) mention = `**${u.username}**`;
    }

    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `✅ ${mention} peut maintenant refaire un(e) **${a.item}** !`,
        }),
      });
      await docSnap.ref.update({ discordNotified: true });
    } catch (err) {
      console.error("Erreur envoi Discord pour", docSnap.id, ":", err);
    }
  }
});
