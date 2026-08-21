# Sổ Sạch — attivazione produzione

## 1. Estrazione AI reale (5 min)
1. console.anthropic.com → API key del progetto prodotto (billing metered, come per NINE2FIVE).
2. Render → servizio `so-sach` → Environment → `ANTHROPIC_API_KEY` = la chiave.
3. Redeploy. `/api/config` deve mostrare `"extraction":"claude"`.
   Modello default: Haiku 4.5 (`EXTRACT_MODEL` per cambiarlo). Costo ~fraz. di centesimo/scontrino.

## 2. Zalo Official Account (il canale vero)
1. Crea l'OA su oa.zalo.me (serve verifica business — usa la società VN). Tipo: "Doanh nghiệp".
2. developers.zalo.me → crea App, **Official Account → Quản lý OA → Liên kết** con l'OA
   (possibile solo dopo che l'OA è stato APPROVATO: prima il portale non lo vede).
3. Webhook: imposta l'URL eventi a `https://<dominio>/webhooks/zalo`,
   abilita `user_send_text` e `user_send_image`, e copia l'**OA Secret Key** da quella pagina.
4. **Due chiavi diverse, non confonderle** — è costato ore:
   - `ZALO_OA_SECRET_KEY` = *OA Secret Key* (pagina Webhook) → firma i webhook
   - `ZALO_APP_SECRET` = *Khóa bí mật* dell'app (pagina Cài đặt) → scambio/rinnovo token OAuth

   Impostare solo la seconda fa firmare i webhook con la chiave sbagliata: il server
   ora lo avvisa all'avvio, ma il sintomo naturale è "il bot tace".
5. Render env: `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_OA_SECRET_KEY` → redeploy.
6. **Token**: `Official Account → Thiết lập chung` → metti come *Official Account Callback Url*
   `https://<dominio>/zalo/oa-callback`, spunta i permessi, poi apri l'*Đường dẫn yêu cầu cấp quyền*
   e concedi come admin OA. Zalo rimanda al callback con un `oa_code` monouso che il server
   scambia da solo per access + refresh token, salvandoli nello store.
   → **Non serve incollare `ZALO_OA_ACCESS_TOKEN` / `ZALO_OA_REFRESH_TOKEN`**: esistono solo
   come seme per il primo avvio, e il refresh_token ruota (una env var diventerebbe stantia).
7. Verifica su `/healthz` → `zalo.configured: true` e `expiresInMin` che scende.
8. Test: invia una foto all'OA → deve rispondere "✅ Đã ghi vào Sổ Sạch…".

Verifica firma implementata: `sha256(appId + rawBody + timestamp + OASecretKey)` confrontata con
`X-ZEvent-Signature` — se le env non sono impostate il webhook resta in modalità demo (accetta senza firmare).

## 3. Persistenza (prima dei clienti veri)
`data/ledger.json` è effimero su Render free. Per il pilota da 100 hộ:
- Render Postgres (basic) + migrazione `books` → tabelle `profiles`, `entries` (1-2 ore di lavoro), oppure
- Supabase free tier.

## 4. Pagamenti
69.000đ/mese: per il mercato VN usare MoMo/ZaloPay Business o bonifico QR (VietQR) — il MoR occidentale
non serve qui; fatturazione e-invoice dalla società VN (obbligo tuo stesso!).

## 5. Prezzi/consulenza
Prima del lancio: 1 sessione con un đại lý thuế per validare aliquote (Luật 48/2024 + 109/2025, regime NĐ 68/2026), soglie 2026 e
formato 01/CNKD. Le costanti stanno in `src/tax.js` e via env (`TAX_FREE_THRESHOLD`, `EINVOICE_THRESHOLD`).
