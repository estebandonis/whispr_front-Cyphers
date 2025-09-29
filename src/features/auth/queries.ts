import {
  useMutation,
  useQuery,
  // useQueryClient
} from "@tanstack/react-query";
import api from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const login = async (
  username: string,
  password: string
): Promise<{
  success?: boolean;
  message?: string;
  mfa?: boolean;
  userId?: string;
}> => {
  const {
    data: { success, message, mfa, userId },
  } = await api.post("/auth/login", { username, password });
  return { success, message, mfa, userId };
};

export const useLogin = () => {
  return useMutation({
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => login(username, password),
  });
};

const loginWithGithubOAuth = async (
  code: string
): Promise<{
  success?: boolean;
  message?: string;
  mfa?: boolean;
  userId?: string;
}> => {
  const response = await api.post("/auth/oauth/github", { code });
  const {
    data: { success, message, mfa, userId },
  } = response;
  return { success, message, mfa, userId };
};

export const useGithubOAuthLogin = () => {
  return useMutation({
    mutationFn: (code: string) => loginWithGithubOAuth(code),
  });
};

const register = async (
  name: string,
  username: string,
  password: string
): Promise<boolean> => {
  const {
    data: { success },
  } = await api.post("/auth/register", { name, username, password });
  return success;
};

export const useRegister = () => {
  return useMutation({
    mutationFn: ({
      name,
      username,
      password,
    }: {
      name: string;
      username: string;
      password: string;
    }) => register(name, username, password),
  });
};

const validateJwtToken = async (token?: string): Promise<boolean> => {
  const {
    data: { valid },
  } = await api.get("/auth/validate-token", {
    params: {
      token,
    },
  });
  return valid;
};

export const useValidateJwtToken = (token?: string) => {
  return useQuery({
    queryKey: ["access_token", token],
    queryFn: () => validateJwtToken(token),
    enabled: !!token,
  });
};

const logout = async (): Promise<boolean> => {
  const {
    data: { success },
  } = await api.post("/auth/logout");
  return success;
};

export const useLogout = () => {
  return useMutation({
    mutationFn: logout,
  });
};

const setupMfa = async (): Promise<{
  secret: string;
  qrCode: string;
}> => {
  const {
    data: { secret, qrCode },
  } = await api.post("/auth/mfa/setup");
  return { secret, qrCode };
};

export const useSetUpMfa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setupMfa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};

const verifyMfa = async (
  token: string,
  userId: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  const {
    data: { success, message },
  } = await api.post("/auth/mfa/verify", { token, userId });
  return { success, message };
};

export const useVerifyMfa = () => {
  return useMutation({
    mutationFn: ({ token, userId }: { token: string; userId: string }) =>
      verifyMfa(token, userId),
  });
};

const resetMfa = async (): Promise<{ message: string }> => {
  const {
    data: { message },
  } = await api.post("/auth/mfa/reset");
  return { message };
};

export const useResetMfa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetMfa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};

const enableMfa = async (): Promise<{ message: string }> => {
  const {
    data: { message },
  } = await api.post("/auth/mfa/enable");
  return { message };
};

export const useEnableMfa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: enableMfa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};
