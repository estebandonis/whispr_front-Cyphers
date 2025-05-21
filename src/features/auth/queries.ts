import {
  useMutation,
  useQuery,
  // useQueryClient
} from "@tanstack/react-query";
import api from "@/lib/api";

const login = async (email: string, password: string): Promise<string> => {
  const {
    data: { token },
  } = await api.post("/auth/login", { email, password });
  return token;
};

export const useLogin = () => {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
  });
};

const loginWithGithubOAuth = async (code: string): Promise<string> => {
  const {
    data: { token },
  } = await api.post("/auth/oauth/github", { code });
  return token;
};

export const useGithubOAuthLogin = () => {
  return useMutation({
    mutationFn: (code: string) => loginWithGithubOAuth(code),
  });
};

const register = async (email: string, password: string): Promise<boolean> => {
  const {
    data: { success },
  } = await api.post("/auth/register", { email, password });
  return success;
};

export const useRegister = () => {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      register(email, password),
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
  console.log("valid jwt token:", valid);
  return valid;
};

export const useValidateJwtToken = (token?: string) => {
  return useQuery({
    queryKey: ["jwt-token", token],
    queryFn: () => validateJwtToken(token),
    enabled: !!token,
  });
};

const validateGithubToken = async (token?: string): Promise<boolean> => {
  const {
    data: { valid },
  } = await api.get("/auth/validate-token/github", {
    params: {
      token,
    },
  });
  console.log("valid github token:", valid);
  return valid;
};

export const useValidateGithubToken = (token?: string) => {
  return useQuery({
    queryKey: ["github-token", token],
    queryFn: () => validateGithubToken(token),
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
