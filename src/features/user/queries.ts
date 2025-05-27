import {
  // useMutation,
  useQuery,
  // useQueryClient
} from "@tanstack/react-query";
import api from "@/lib/api";

const getUser = async (): Promise<User> => {
  const { data } = await api.get("/user/me");
  console.log("user:", data);
  return data;
};

export const useCurrentUser = () => {
  return useQuery({ queryKey: ["user"], queryFn: getUser });
};
