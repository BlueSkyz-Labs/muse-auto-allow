# v1.21.0 (W4): license UI wiring in popup.js
import io

p = 'extension/popup.js'
s = io.open(p, encoding='utf-8').read()

# 1) storage default + applyV18UI assignment + onChanged
a1 = "    anomaly: null, anomalyLastPause: null, // v1.20.0 (G04)"
assert a1 in s, 'a1'
s = s.replace(a1, "    anomaly: null, anomalyLastPause: null, // v1.20.0 (G04)\n    license: null, // v1.21.0 (W4)", 1)

a2 = "  v18.anomaly = (s.anomaly && typeof s.anomaly === 'object') ? s.anomaly : null; // v1.20.0 (G04)"
assert a2 in s, 'a2'
s = s.replace(a2, a2 + "\n  v18.license = (s.license && typeof s.license === 'object' && typeof s.license.token === 'string') ? s.license : null; // v1.21.0 (W4)", 1)

# find a storage.onChanged area to add the license branch: reuse the anomaly pattern anchor
a3 = "  renderAnomaly(); // v1.20.0 (G04)"
assert a3 in s, 'a3'
# there were three renderAnomaly() call sites; append renderLicense at the applyV18UI one (line ~1195 context has renderRules)
i = s.find("renderRules(); renderSchedule(); renderSmart(); renderSync(); renderAnomaly(); // v1.20.0 (G04)")
assert i >= 0, 'a3b'
s = s.replace("renderRules(); renderSchedule(); renderSmart(); renderSync(); renderAnomaly(); // v1.20.0 (G04)",
              "renderRules(); renderSchedule(); renderSmart(); renderSync(); renderAnomaly(); renderLicense(); // v1.20.0/21", 1)

# 2) license functions after writeAnomaly block
a4 = """function writeAnomaly(patch) {
  try {
    chrome.storage.local.get({ anomaly: null }, (s) => {
      const cur = (s.anomaly && typeof s.anomaly === 'object') ? s.anomaly : {};
      chrome.storage.local.set({ anomaly: Object.assign({}, cur, patch) });
    });
  } catch { /* ignore */ }
}"""
assert a4 in s, 'a4'
lic = a4 + '''

// ---- v1.21.0 (W4): license UI — DORMANT until the Owner's key ceremony (docs/W4_LICENSE_IMPL_PLAN.md).
// The module is pure: we pass the committed key (null = dormant), the stored token and the clock.
// The token is never echoed, never put in title/attributes and never logged.
function licKey() { return (typeof MAA_LICENSE_PUBKEY !== 'undefined' && MAA_LICENSE_PUBKEY) ? MAA_LICENSE_PUBKEY : null; }
function licCodeMsg(code) {
  switch (String(code || '')) {
    case 'malformed': return t('licenseMalformed', 'This license token is malformed.');
    case 'bad_signature': return t('licenseBadSignature', 'This license token could not be verified.');
    case 'wrong_product': return t('licenseWrongProduct', 'This license is for a different product.');
    case 'expired': return t('licenseExpired', 'This license has expired.');
    case 'dormant': return t('licenseDormant', 'License activation is not configured yet.');
    default: return t('licenseBadSignature', 'This license token could not be verified.');
  }
}
async function renderLicense() {
  const chip = $('licTier'), st = $('licenseStatus');
  const key = licKey();
  const rec = v18.license;
  let tier = 'free';
  if (rec && typeof rec.token === 'string' && rec.token && key && typeof MuseLicense !== 'undefined' && MuseLicense) {
    try {
      const v = await MuseLicense.verifyToken(rec.token, key, Date.now(), Number(rec.lastSeenAt) || 0);
      if (v && v.ok) { tier = 'pro'; if (st) st.textContent = t('licenseActivated', 'License activated.'); }
      else if (st) st.textContent = licCodeMsg(v && v.code);
    } catch { /* a verifier error keeps the free tier (fail closed) */ }
  } else if (st && !rec) {
    st.textContent = key ? '' : t('licenseDormant', 'License activation is not configured yet.');
  }
  if (chip) chip.textContent = tier === 'pro' ? t('licensePro', 'PRO') : t('licenseFree', 'Free');
}
function licDeactivate() {
  try {
    chrome.storage.local.set({ license: null }, () => {
      const st = $('licenseStatus');
      if (st) st.textContent = t('licenseFree', 'Free');
      renderLicense();
    });
  } catch {
    const st = $('licenseStatus');
    if (st) st.textContent = t('licenseStorageError', 'Could not save the license. Try again.');
  }
}'''
s = s.replace(a4, lic, 1)

# 3) listeners at the bottom (near the anomaly listeners)
a5 = "$('anomalyEnable').addEventListener('change', () => { writeAnomaly({ enabled: $('anomalyEnable').checked }); });"
assert a5 in s, 'a5'
s = s.replace(a5, '''// v1.21.0 (W4): license activation — always clears the field, never stores a bad token.
$('licActivate').addEventListener('click', async () => {
  const inp = $('licToken'), st = $('licenseStatus');
  const raw = inp ? String(inp.value || '').trim() : '';
  if (inp) inp.value = '';
  const key = licKey();
  if (!key) { if (st) st.textContent = t('licenseDormant', 'License activation is not configured yet.'); return; }
  if (!raw || typeof MuseLicense === 'undefined' || !MuseLicense) { if (st) st.textContent = t('licenseMalformed', 'This license token is malformed.'); return; }
  const parsed = MuseLicense.parseToken(raw);
  if (!parsed || !parsed.ok) { if (st) st.textContent = licCodeMsg(parsed && parsed.code); return; }
  let v = null;
  try { v = await MuseLicense.verifyToken(raw, key, Date.now(), 0); } catch { v = null; }
  if (!v || !v.ok) { if (st) st.textContent = licCodeMsg(v && v.code); return; }
  try {
    chrome.storage.local.set({ license: { token: raw, exp: (v.claims && Number(v.claims.exp)) || null, lastSeenAt: Date.now() } }, () => {
      if (st) st.textContent = t('licenseActivated', 'License activated.');
      renderLicense();
    });
  } catch { if (st) st.textContent = t('licenseStorageError', 'Could not save the license. Try again.'); }
});
$('licDeactivate').addEventListener('click', licDeactivate);
''' + a5, 1)

# 4) license changes ride the existing refresh listener (refresh -> applyV18UI -> assign + renderLicense)
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.js license UI wired')
