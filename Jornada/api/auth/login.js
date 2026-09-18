const {
  getServiceClient, getAnonClient, json, getBody, sanitizeUsername, profileToClient
} = require('../../lib/supabaseServer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  const body = getBody(req);
  const username = sanitizeUsername(body.username);
  const password = String(body.password || '');
  if (!username || !password) return json(res, 401, { error: 'Usuário ou senha inválidos.' });

  try {
    const service = getServiceClient();
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('id,username,nome,login_email,is_admin,modes,screens')
      .eq('username', username)
      .maybeSingle();
    if (profileError || !profile) return json(res, 401, { error: 'Usuário ou senha inválidos.' });

    const anon = getAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({ email: profile.login_email, password });
    if (error || !data.session) return json(res, 401, { error: 'Usuário ou senha inválidos.' });

    return json(res, 200, {
      user: profileToClient(profile),
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: 'Falha ao autenticar.' });
  }
};
