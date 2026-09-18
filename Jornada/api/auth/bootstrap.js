const {
  getServiceClient, json, getBody, sanitizeUsername, createInternalEmail
} = require('../../lib/supabaseServer');

const CONSOLIDADO_SCREENS = ['control','overview','motoristas','filiais','reports','data','help'];
const ANALITICO_SCREENS = ['overview','motoristas','filiais','placas','dados'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const service = getServiceClient();
    const { count, error: countError } = await service.from('profiles').select('id', { count: 'exact', head: true });
    if (countError) throw countError;
    if ((count || 0) > 0) return json(res, 409, { error: 'O administrador inicial já foi criado.' });

    const body = getBody(req);
    const nome = String(body.nome || '').trim();
    const username = sanitizeUsername(body.username);
    const password = String(body.password || '');
    if (!nome || !username || !password) return json(res, 400, { error: 'Preencha nome, usuário e senha.' });
    if (username.length < 3) return json(res, 400, { error: 'O usuário deve ter pelo menos 3 caracteres.' });
    if (password.length < 8) return json(res, 400, { error: 'A senha deve ter pelo menos 8 caracteres.' });

    const loginEmail = createInternalEmail();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { nome, username }
    });
    if (createError) throw createError;

    const profile = {
      id: created.user.id,
      username,
      nome,
      login_email: loginEmail,
      is_admin: true,
      modes: { consolidado: true, analitico: true },
      screens: { consolidado: CONSOLIDADO_SCREENS, analitico: ANALITICO_SCREENS }
    };
    const { error: profileError } = await service.from('profiles').insert(profile);
    if (profileError) {
      await service.auth.admin.deleteUser(created.user.id).catch(()=>{});
      throw profileError;
    }
    return json(res, 201, { ok: true });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: 'Não foi possível criar o administrador inicial.' });
  }
};
