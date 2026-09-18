const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Vercel injeta process.env automaticamente no deploy.
// No desenvolvimento local, também carregamos .env.local/.env explicitamente
// para o projeto funcionar mesmo quando o Vercel CLI não importar o arquivo.
function loadEnvFile(fileName) {
  try {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) return;

    const text = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const idx = line.indexOf('=');
      if (idx <= 0) continue;

      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Nunca sobrescreve variável já fornecida pelo sistema/Vercel.
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.warn(`Não foi possível carregar ${fileName}:`, err.message);
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const ENV_ALIASES = {
  SUPABASE_URL: [
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL'
  ],
  SUPABASE_ANON_KEY: [
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ],
  SUPABASE_SERVICE_ROLE_KEY: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY'
  ]
};

function requireEnv(name) {
  const candidates = ENV_ALIASES[name] || [name];
  for (const candidate of candidates) {
    const value = process.env[candidate];
    if (value && String(value).trim()) return String(value).trim();
  }
  throw new Error(`Variável de ambiente ausente: ${name}`);
}

function getServiceClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getAnonClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function json(res, status, payload) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

function sanitizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function profileToClient(p) {
  if (!p) return null;
  return {
    id: p.id,
    username: p.username,
    nome: p.nome,
    isAdmin: !!p.is_admin,
    modes: p.modes || { consolidado: false, analitico: false },
    screens: p.screens || { consolidado: [], analitico: [] }
  };
}

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

async function requireAdmin(req) {
  const token = bearerToken(req);
  if (!token) return { error: 'Não autenticado.' };
  const service = getServiceClient();
  const { data: userData, error: userError } = await service.auth.getUser(token);
  if (userError || !userData?.user) return { error: 'Sessão inválida.' };
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id,username,nome,is_admin,modes,screens')
    .eq('id', userData.user.id)
    .single();
  if (profileError || !profile) return { error: 'Perfil não encontrado.' };
  if (!profile.is_admin) return { error: 'Apenas administradores podem realizar esta ação.' };
  return { service, authUser: userData.user, profile };
}

function createInternalEmail() {
  const random = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${random}@gazinlog.example.com`;
}

module.exports = {
  requireEnv,
  getServiceClient,
  getAnonClient,
  json,
  getBody,
  sanitizeUsername,
  profileToClient,
  requireAdmin,
  createInternalEmail
};
