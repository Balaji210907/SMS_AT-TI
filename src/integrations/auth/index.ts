import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import type { OAuthProvider } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";

const authClient = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const authProvider = {
  auth: {
    signInWithOAuth: async (provider: OAuthProvider, opts?: SignInOptions) => {
      const result = await authClient.signInWithOAuth(provider, {
        ...opts,
        extraParams: {
          ...opts?.extraParams,
        },
      });

      if (result.redirected) {
        return result;
      }

      if (result.error) {
        return result;
      }

      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};

// Backward-compatible alias
export const lovable = authProvider;
