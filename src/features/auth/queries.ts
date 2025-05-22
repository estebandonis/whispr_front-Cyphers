import {
  useMutation,
  useQuery,
  // useQueryClient
} from "@tanstack/react-query";
import api from "@/lib/api";

const login = async (
  username: string,
  password: string
): Promise<{ access_token: string; refresh_token: string }> => {
  const {
    data: { access_token, refresh_token },
  } = await api.post("/auth/login", { username, password });
  return { access_token, refresh_token };
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
): Promise<{ access_token: string; refresh_token: string }> => {
  const {
    data: { access_token, refresh_token },
  } = await api.post("/auth/oauth/github", { code });
  return { access_token, refresh_token };
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
