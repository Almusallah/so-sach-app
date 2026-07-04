# Sổ Sạch — attivazione produzione

## 1. Estrazione AI reale (5 min)
1. console.anthropic.com → API key del progetto prodotto (billing metered, come per NINE2FIVE).
2. Render → servizio `so-sach` → Environment → `ANTHROPIC_API_KEY` = la chiave.
3. Redeploy. `/api/config` deve mostrare `"extraction":"claude"`.
   Modello default: Haiku 4.5 (`EXTRACT_MODEL` per cambiarlo). Costo ~fraz. di centesimo/scontrino.

## 2. Zalo Official Account (il canale vero)
1. Crea l'OA su oa.zalo.me (serve verifica business — usa la società VN). Tipo: "Doanh nghiệp".
2. developers.zalo.me → crea App, collega l'OA, prendi **App ID** e **App Secret**.
3. Ottieni l'**OA access token** (flow OAuth dell'app; il token va rinnovato — v. docs Zalo).
4. Webhook: nelle impostazioni app imposta l'URL eventi a
   `https://<il-tuo-dominio>/webhooks/zalo`
   e abilita gli eventi `user_send_text`, `user_send_image`.
5. Render env: `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_ACCESS_TOKEN` → redeploy.
6. Test: invia una foto all'OA → deve rispondere "✅ Đã ghi vào Sổ Sạch…".

Verifica firma implementata: `sha256(appId + rawBody + timestamp + appSecret)` confrontata con
`X-ZEvent-Signature` — se le env non sono impostate il webhook resta in modalità demo (accetta senza firmare).

## 3. Persistenza (prima dei clienti veri)
`data/ledger.json` è effimero su Render free. Per il pilota da 100 hộ:
- Render Postgres (basic) + migrazione `books` → tabelle `profiles`, `entries` (1-2 ore di lavoro), oppure
- Supabase free tier.

## 4. Pagamenti
69.000đ/mese: per il mercato VN usare MoMo/ZaloPay Business o bonifico QR (VietQR) — il MoR occidentale
non serve qui; fatturazione e-invoice dalla società VN (obbligo tuo stesso!).

## 5. Prezzi/consulenza
Prima del lancio: 1 sessione con un đại lý thuế per validare aliquote (Circ. 40/2021), soglie 2026 e
formato 01/CNKD. Le costanti stanno in `src/tax.js` e via env (`TAX_FREE_THRESHOLD`, `EINVOICE_THRESHOLD`).
