const { getServiceClient, json } = require('../../lib/supabaseServer');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const service = getServiceClient();
    const { count, error } = await service.from('profiles').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return json(res, 200, { needsBootstrap: (count || 0) === 0 });
  } catch (err) {
    return json(res, 500, { error: 'Banco ainda não configurado. Execute supabase/schema.sql e confira as variáveis da Vercel.' });
  }
};
