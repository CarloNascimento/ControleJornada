const {
  json, getBody, sanitizeUsername, profileToClient, requireAdmin, createInternalEmail
} = require('../lib/supabaseServer');

module.exports = async function handler(req, res) {
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, 403, { error: admin.error });
  const { service, authUser } = admin;

  if (req.method === 'GET') {
    const { data, error } = await service
      .from('profiles')
      .select('id,username,nome,is_admin,modes,screens,created_at')
      .order('nome', { ascending: true });
    if (error) return json(res, 500, { error: 'Não foi possível listar os usuários.' });
    return json(res, 200, { users: (data || []).map(profileToClient) });
  }

  if (req.method === 'POST') {
    const body = getBody(req);
    const nome = String(body.nome || '').trim();
    const username = sanitizeUsername(body.username);
    const password = String(body.password || '');
    const isAdmin = !!body.isAdmin;
    const modes = body.modes || { consolidado: false, analitico: false };
    const screens = body.screens || { consolidado: [], analitico: [] };

    if (!nome || !username || !password) return json(res, 400, { error: 'Preencha nome, usuário e senha.' });
    if (username.length < 3) return json(res, 400, { error: 'O usuário deve ter pelo menos 3 caracteres.' });
    if (password.length < 8) return json(res, 400, { error: 'A senha deve ter pelo menos 8 caracteres.' });

    const { data: exists } = await service.from('profiles').select('id').eq('username', username).maybeSingle();
    if (exists) return json(res, 409, { error: 'Já existe um usuário com esse login.' });

    const loginEmail = createInternalEmail();
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { nome, username }
    });
    if (createError) return json(res, 400, { error: 'Não foi possível criar o usuário.' });

    const profile = {
      id: created.user.id,
      username,
      nome,
      login_email: loginEmail,
      is_admin: isAdmin,
      modes: isAdmin ? { consolidado: true, analitico: true } : modes,
      screens: isAdmin
        ? { consolidado: ['control','overview','motoristas','filiais','reports','data','help'], analitico: ['overview','motoristas','filiais','placas','dados'] }
        : screens
    };
    const { data: inserted, error: profileError } = await service
      .from('profiles')
      .insert(profile)
      .select('id,username,nome,is_admin,modes,screens')
      .single();
    if (profileError) {
      await service.auth.admin.deleteUser(created.user.id).catch(()=>{});
      return json(res, 500, { error: 'Não foi possível salvar as permissões do usuário.' });
    }
    return json(res, 201, { user: profileToClient(inserted) });
  }

  if (req.method === 'DELETE') {
    const username = sanitizeUsername(req.query?.username);
    if (!username) return json(res, 400, { error: 'Usuário não informado.' });
    const { data: target, error } = await service.from('profiles').select('id,username').eq('username', username).maybeSingle();
    if (error || !target) return json(res, 404, { error: 'Usuário não encontrado.' });
    if (target.id === authUser.id) return json(res, 400, { error: 'Não é possível excluir o próprio usuário logado.' });
    const { error: deleteError } = await service.auth.admin.deleteUser(target.id);
    if (deleteError) return json(res, 500, { error: 'Não foi possível excluir o usuário.' });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Método não permitido.' });
};
