const { json, requireEnv } = require('../lib/supabaseServer');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
  try {
    return json(res, 200, {
      supabaseUrl: requireEnv('SUPABASE_URL'),
      supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY')
    });
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
};
