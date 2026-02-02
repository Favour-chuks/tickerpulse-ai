import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabase } from '../../../shared/infra/libs/supabase.js';

interface UpdateUserBody {
  displayName?: string;
  password?: string;
  avatarUrl?: string;
}

export class UserController {
  // GET /users/:id (Fetch profile from public table)
  public getUserById = async (
    request: FastifyRequest<{ Params: { id: string } }>, 
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !profile) {
      return reply.code(404).send({ error: 'Profile not found' });
    }
    
    return profile;
  };

  // UPDATE /users/me
  public updateUser = async (
    request: FastifyRequest<{ Body: UpdateUserBody }>, 
    reply: FastifyReply
  ) => {
    const userId = request.user?.id;
    const { displayName, password, avatarUrl } = request.body;

    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      if (password) {
        const { error: authError } = await supabase.auth.updateUser({
          password: password
        });
        if (authError) throw authError;
      }

      const profileUpdates: any = {};
      if (displayName) profileUpdates.display_name = displayName;
      if (avatarUrl) profileUpdates.avatar_url = avatarUrl;

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update(profileUpdates)
          .eq('id', userId);

        if (profileError) throw profileError;
      }

      return reply.send({ message: 'User updated successfully' });

    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({ 
        error: error.message || 'Failed to update user' 
      });
    }
  };

  public deleteUser = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        return reply.code(400).send({ error: error.message });
      }

      return reply.send({ message: 'User account and profile deleted successfully' });      
    } catch (error) {
      reply.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  }
}